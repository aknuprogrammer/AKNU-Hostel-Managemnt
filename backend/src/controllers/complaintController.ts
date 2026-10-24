import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export async function submitComplaint(req: AuthRequest, res: Response): Promise<void> {
  const { category, description, priority = 'medium', hostelId, roomId, imageUrls } = req.body;

  if (!category || !description) {
    res.status(400).json({ success: false, error: 'Category and description are required' });
    return;
  }

  try {
    let studentId = req.user?.studentId;
    let targetHostelId = hostelId;
    let targetRoomId = roomId;

    if (req.user?.role === 'student') {
      const studentAlloc = await executeQuery(
        `SELECT s.id as student_id, sa.hostel_id, sa.room_id
         FROM students s
         LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
         WHERE s.user_id = $1`,
        [req.user.id]
      );
      if (studentAlloc.rowCount > 0) {
        studentId = studentAlloc.rows[0].student_id;
        targetHostelId = targetHostelId || studentAlloc.rows[0].hostel_id;
        targetRoomId = targetRoomId || studentAlloc.rows[0].room_id;
      }
    }

    if (!studentId || !targetHostelId) {
      res.status(400).json({ success: false, error: 'Student profile or assigned hostel could not be determined' });
      return;
    }

    const complaintId = uuidv4();
    const complaintNumber = `CMP-${Date.now().toString().slice(-6)}`;
    const imagesJson = imageUrls ? JSON.stringify(imageUrls) : '[]';

    await executeQuery(
      `INSERT INTO complaints (
        id, complaint_number, student_id, hostel_id, room_id, category, description, image_urls, priority, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted')`,
      [complaintId, complaintNumber, studentId, targetHostelId, targetRoomId || null, category, description, imagesJson, priority]
    );

    await logAudit(req.user?.id, 'SUBMIT_COMPLAINT', 'complaint', complaintId, { complaintNumber, category }, req);

    res.status(201).json({
      success: true,
      message: 'Complaint lodged successfully. Assigned ticket: ' + complaintNumber,
      data: { complaintId, complaintNumber }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getComplaints(req: AuthRequest, res: Response): Promise<void> {
  const { status, category, priority, hostelId } = req.query;

  try {
    let sql = `
      SELECT c.*, s.full_name as student_name, s.roll_number, s.phone as student_phone,
             h.name as hostel_name, r.room_number,
             u.full_name as assigned_to_name
      FROM complaints c
      JOIN students s ON c.student_id = s.id
      JOIN hostels h ON c.hostel_id = h.id
      LEFT JOIN rooms r ON c.room_id = r.id
      LEFT JOIN users u ON c.assigned_to_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.user?.role === 'student') {
      params.push(req.user.studentId);
      sql += ` AND c.student_id = $${params.length}`;
    } else if (req.user?.role === 'maint_staff') {
      params.push(req.user.id);
      sql += ` AND (c.assigned_to_user_id = $${params.length} OR c.status = 'submitted')`;
    }

    if (hostelId) {
      params.push(hostelId);
      sql += ` AND c.hostel_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND c.status = $${params.length}`;
    }
    if (category) {
      params.push(category);
      sql += ` AND c.category = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      sql += ` AND c.priority = $${params.length}`;
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
        sql += ` AND c.hostel_id IN (${placeholders})`;
      } else {
        sql += ` AND h.category = $${params.length + 1}`;
        params.push(wing);
      }
    }

    sql += ' ORDER BY c.created_at DESC';

    const complaints = await executeQuery(sql, params);
    res.json({ success: true, data: complaints.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateComplaintStatus(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, assignedToUserId, resolutionNotes } = req.body;

  try {
    const validStatuses = ['submitted', 'assigned', 'in_progress', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    let updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    let params: any[] = [id];
    let pIdx = 2;

    if (status) {
      updates.push(`status = $${pIdx}`);
      params.push(status);
      pIdx++;
      if (status === 'resolved' || status === 'closed') {
        updates.push(`resolved_at = CURRENT_TIMESTAMP`);
      }
    }

    if (assignedToUserId) {
      updates.push(`assigned_to_user_id = $${pIdx}`);
      params.push(assignedToUserId);
      pIdx++;
    }

    if (resolutionNotes) {
      updates.push(`resolution_notes = $${pIdx}`);
      params.push(resolutionNotes);
      pIdx++;
    }

    await executeQuery(`UPDATE complaints SET ${updates.join(', ')} WHERE id = $1`, params);
    await logAudit(req.user?.id, 'UPDATE_COMPLAINT', 'complaint', id, { status, assignedToUserId }, req);

    res.json({ success: true, message: 'Complaint ticket updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function rateComplaint(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { rating, feedback } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ success: false, error: 'Rating must be an integer between 1 and 5' });
    return;
  }

  try {
    await executeQuery(
      `UPDATE complaints SET student_rating = $1, student_feedback = $2, status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [rating, feedback || null, id]
    );

    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
