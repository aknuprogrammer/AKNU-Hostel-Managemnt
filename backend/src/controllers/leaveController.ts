import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export async function submitLeaveApplication(req: AuthRequest, res: Response): Promise<void> {
  const { leaveType, departureDate, returnDate, destination, reason, guardianPhone } = req.body;

  if (!leaveType || !departureDate || !returnDate || !destination || !reason) {
    res.status(400).json({ success: false, error: 'Mandatory fields missing (type, dates, destination, reason)' });
    return;
  }

  try {
    let studentId = req.user?.studentId;
    if (!studentId && req.user?.role === 'student') {
      const stuRes = await executeQuery('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (stuRes.rowCount > 0) studentId = stuRes.rows[0].id;
    }

    if (!studentId) {
      res.status(403).json({ success: false, error: 'Only registered hostel students can submit leave applications' });
      return;
    }

    const leaveId = uuidv4();
    await executeQuery(
      `INSERT INTO leave_applications (
        id, student_id, leave_type, departure_date, return_date, destination, reason, guardian_phone, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted')`,
      [leaveId, studentId, leaveType, departureDate, returnDate, destination, reason, guardianPhone || null]
    );

    await logAudit(req.user?.id, 'SUBMIT_LEAVE', 'leave_application', leaveId, { destination, departureDate }, req);

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully for warden review',
      data: { leaveId }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getLeaveApplications(req: AuthRequest, res: Response): Promise<void> {
  const { status, studentId } = req.query;

  try {
    let sql = `
      SELECT la.*, s.full_name as student_name, s.roll_number, s.photo_url,
             h.name as hostel_name, r.room_number,
             gp.id as gate_pass_id, gp.pass_code, gp.status as gate_pass_status
      FROM leave_applications la
      JOIN students s ON la.student_id = s.id
      LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
      LEFT JOIN hostels h ON sa.hostel_id = h.id
      LEFT JOIN rooms r ON sa.room_id = r.id
      LEFT JOIN gate_passes gp ON la.id = gp.leave_application_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // If student role, view only their own
    if (req.user?.role === 'student') {
      params.push(req.user.studentId);
      sql += ` AND la.student_id = $${params.length}`;
    } else if (studentId) {
      params.push(studentId);
      sql += ` AND la.student_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND la.status = $${params.length}`;
    }

    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      const placeholders = req.user.assignedHostels.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...req.user.assignedHostels);
      const gender = req.user.assignedCategory === 'girls' ? 'female' : (req.user.assignedCategory === 'boys' ? 'male' : null);
      if (gender) {
        sql += ` AND (sa.hostel_id IN (${placeholders}) OR (sa.hostel_id IS NULL AND s.gender = '${gender}'))`;
      } else {
        sql += ` AND sa.hostel_id IN (${placeholders})`;
      }
    }

    sql += ' ORDER BY la.created_at DESC';

    const leaves = await executeQuery(sql, params);
    res.json({ success: true, data: leaves.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateLeaveStatus(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, rejectionReason } = req.body; // status: 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, error: 'Status must be approved or rejected' });
    return;
  }

  try {
    const leaveRes = await executeQuery('SELECT * FROM leave_applications WHERE id = $1', [id]);
    if (leaveRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Leave application not found' });
      return;
    }

    const leave = leaveRes.rows[0];

    await executeTransaction(async (query) => {
      await query(
        `UPDATE leave_applications
         SET status = $1, approved_by_user_id = $2, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, req.user?.id, rejectionReason || null, id]
      );

      // If approved, issue a digital gate pass
      if (status === 'approved') {
        const passId = uuidv4();
        const passCode = `GP-${Math.floor(100000 + Math.random() * 900000)}`;
        await query(
          `INSERT INTO gate_passes (id, leave_application_id, student_id, pass_code, valid_from, valid_to, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'issued')`,
          [passId, leave.id, leave.student_id, passCode, leave.departure_date, leave.return_date]
        );
      }
    });

    await logAudit(req.user?.id, `LEAVE_${status.toUpperCase()}`, 'leave_application', id, { rejectionReason }, req);

    res.json({
      success: true,
      message: `Leave application ${status} successfully`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function verifyGatePass(req: AuthRequest, res: Response): Promise<void> {
  const { passCode } = req.params;

  try {
    const passRes = await executeQuery(
      `SELECT gp.*, la.leave_type, la.destination, la.reason,
              s.id as student_id, s.full_name as student_name, s.roll_number, s.photo_url, s.phone as student_phone,
              h.name as hostel_name, r.room_number
       FROM gate_passes gp
       JOIN leave_applications la ON gp.leave_application_id = la.id
       JOIN students s ON gp.student_id = s.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       WHERE UPPER(gp.pass_code) = UPPER($1)`,
      [passCode.trim()]
    );

    if (passRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Gate pass not found' });
      return;
    }

    const pass = passRes.rows[0];
    const movements = await executeQuery(
      `SELECT * FROM gate_movements WHERE gate_pass_id = $1 ORDER BY logged_at DESC`,
      [pass.id]
    );

    res.json({
      success: true,
      data: {
        pass,
        movements: movements.rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function logGateMovement(req: AuthRequest, res: Response): Promise<void> {
  const { gatePassId, studentId, movementType, checkpoint = 'Main University Gate', notes } = req.body;

  if (!studentId || !['EXIT', 'ENTRY'].includes(movementType)) {
    res.status(400).json({ success: false, error: 'Student ID and movement type (EXIT/ENTRY) are required' });
    return;
  }

  try {
    const movementId = uuidv4();
    await executeQuery(
      `INSERT INTO gate_movements (id, gate_pass_id, student_id, movement_type, verified_by_user_id, checkpoint, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [movementId, gatePassId || null, studentId, movementType, req.user?.id, checkpoint, notes || null]
    );

    if (gatePassId && movementType === 'ENTRY') {
      await executeQuery("UPDATE gate_passes SET status = 'used' WHERE id = $1", [gatePassId]);
    }

    await logAudit(req.user?.id, `GATE_MOVEMENT_${movementType}`, 'gate_movement', movementId, { studentId, checkpoint }, req);

    res.json({
      success: true,
      message: `Security gate ${movementType} logged successfully`,
      data: { movementId }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
