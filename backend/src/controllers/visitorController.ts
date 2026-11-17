import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export async function registerVisitor(req: AuthRequest, res: Response): Promise<void> {
  let { hostelId, studentId, studentRoll, visitorName, visitorPhone, relationToStudent, purpose, idProofType = 'Aadhaar Card', idProofNumber } = req.body;

  if ((!studentId && !studentRoll) || !visitorName || !visitorPhone || !purpose) {
    res.status(400).json({ success: false, error: 'Mandatory fields missing (student, name, phone, purpose)' });
    return;
  }

  try {
    if (!studentId && studentRoll) {
      const stuRes = await executeQuery(
        `SELECT s.id, (SELECT sa.hostel_id FROM student_allocations sa WHERE sa.student_id = s.id AND sa.is_active = true LIMIT 1) as allocated_hostel_id
         FROM students s
         WHERE UPPER(s.roll_number) = UPPER($1) OR s.id = $1`,
        [studentRoll.trim()]
      );
      if (stuRes.rows.length === 0) {
        res.status(404).json({ success: false, error: `Student with roll number "${studentRoll}" not found` });
        return;
      }
      studentId = stuRes.rows[0].id;
      if (!hostelId && stuRes.rows[0].allocated_hostel_id) {
        hostelId = stuRes.rows[0].allocated_hostel_id;
      }
    }

    if (!hostelId) {
      // Find hostel from student's allocation
      const alloc = await executeQuery(
        `SELECT hostel_id FROM student_allocations WHERE student_id = $1 AND is_active = true LIMIT 1`,
        [studentId]
      );
      if (alloc.rows.length > 0) {
        hostelId = alloc.rows[0].hostel_id;
      } else {
        const firstHostel = await executeQuery(`SELECT id FROM hostels LIMIT 1`);
        if (firstHostel.rows.length > 0) {
          hostelId = firstHostel.rows[0].id;
        } else {
          res.status(400).json({ success: false, error: 'Hostel is required and no active hostels exist' });
          return;
        }
      }
    }

    const visitorId = uuidv4();
    await executeQuery(
      `INSERT INTO visitors (
        id, hostel_id, student_id, visitor_name, visitor_phone, relation_to_student,
        purpose, id_proof_type, id_proof_number, check_in_time, security_user_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, 'checked_in')`,
      [visitorId, hostelId, studentId, visitorName.trim(), visitorPhone.trim(), relationToStudent || 'Relative', purpose.trim(), idProofType, idProofNumber || null, req.user?.id]
    );

    await logAudit(req.user?.id, 'REGISTER_VISITOR', 'visitor', visitorId, { visitorName, studentId }, req);

    res.status(201).json({
      success: true,
      message: 'Visitor checked in successfully',
      data: { visitorId }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function checkoutVisitor(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    await executeQuery(
      `UPDATE visitors SET status = 'checked_out', check_out_time = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Visitor marked as checked out' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getVisitors(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId, status } = req.query;

  try {
    let sql = `
      SELECT v.*, s.full_name as student_name, s.roll_number, h.name as hostel_name, u.full_name as security_officer_name
      FROM visitors v
      JOIN students s ON v.student_id = s.id
      JOIN hostels h ON v.hostel_id = h.id
      JOIN users u ON v.security_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (hostelId) {
      params.push(hostelId);
      sql += ` AND v.hostel_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND v.status = $${params.length}`;
    }

    // RBAC: Strict Gender Wing Isolation
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;

    if (wing) {
      if (req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
        const placeholders = req.user.assignedHostels.map((_, i) => `$${params.length + i + 1}`).join(',');
        params.push(...req.user.assignedHostels);
        sql += ` AND v.hostel_id IN (${placeholders})`;
      } else {
        sql += ` AND h.category = $${params.length + 1}`;
        params.push(wing);
      }
    }

    sql += ' ORDER BY v.check_in_time DESC';

    const visitors = await executeQuery(sql, params);
    res.json({ success: true, data: visitors.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
