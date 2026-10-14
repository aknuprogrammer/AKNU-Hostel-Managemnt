import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export const RECORD_ONLY_ROLES = [
  'univ_mgmt',
  'mess_staff',
  'security_staff',
  'accounts_staff',
  'maint_staff'
];

export async function getStaffList(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await executeQuery(`
      SELECT u.id, u.email, u.full_name, u.phone, u.role, u.is_active, u.created_at,
             r.display_name as role_display,
             h.id as hostel_id, h.name as hostel_name, h.code as hostel_code
      FROM users u
      JOIN roles r ON u.role = r.id
      LEFT JOIN user_hostel_assignments uha ON u.id = uha.user_id
      LEFT JOIN hostels h ON uha.hostel_id = h.id
      WHERE u.role != 'student'
      ORDER BY
        CASE WHEN u.role IN ('univ_mgmt', 'mess_staff', 'security_staff', 'accounts_staff', 'maint_staff') THEN 1 ELSE 0 END,
        u.full_name ASC
    `);

    const staffWithAccessFlag = result.rows.map((row: any) => ({
      ...row,
      isRecordOnly: RECORD_ONLY_ROLES.includes(row.role),
      accessType: RECORD_ONLY_ROLES.includes(row.role) ? 'Record Only (No Login)' : 'Active Login Access'
    }));

    res.json({ success: true, data: staffWithAccessFlag });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function addStaffRecord(req: AuthRequest, res: Response): Promise<void> {
  const { fullName, role, email, phone, hostelId } = req.body;

  if (!fullName || !role) {
    res.status(400).json({ success: false, error: 'Full name and role are required' });
    return;
  }

  const staffEmail = email && email.trim() !== ''
    ? email.trim().toLowerCase()
    : `staff.${Date.now().toString().slice(-6)}@aknu.edu.in`;

  try {
    // Check if email already exists
    const existing = await executeQuery('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [staffEmail]);
    if (existing.rowCount > 0) {
      res.status(400).json({ success: false, error: 'A staff member with this email address already exists' });
      return;
    }

    const newId = `usr-${uuidv4().slice(0, 8)}`;
    const defaultHash = await bcrypt.hash('Aknu@2026!', 10);

    await executeTransaction(async (query) => {
      await query(
        `INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [newId, staffEmail, defaultHash, fullName.trim(), phone || null, role]
      );

      if (hostelId) {
        await query(
          `INSERT INTO user_hostel_assignments (id, user_id, hostel_id)
           VALUES ($1, $2, $3)`,
          [`uha-${uuidv4().slice(0, 8)}`, newId, hostelId]
        );
      }
    });

    if (req.user) {
      await logAudit(
        req.user.id,
        'ADD_STAFF_RECORD',
        'users',
        newId,
        `Added ${role} staff record for ${fullName}`,
        req
      );
    }

    res.status(201).json({
      success: true,
      message: 'Staff record added successfully to the university roster',
      data: {
        id: newId,
        fullName,
        role,
        email: staffEmail,
        isRecordOnly: RECORD_ONLY_ROLES.includes(role)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteStaffRecord(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const userRes = await executeQuery('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Staff member not found' });
      return;
    }

    if (userRes.rows[0].role === 'super_admin') {
      res.status(403).json({ success: false, error: 'Super Administrator record cannot be deleted' });
      return;
    }

    await executeTransaction(async (query) => {
      await query('DELETE FROM user_hostel_assignments WHERE user_id = $1', [id]);
      await query('DELETE FROM users WHERE id = $1', [id]);
    });

    if (req.user) {
      await logAudit(
        req.user.id,
        'DELETE_STAFF_RECORD',
        'users',
        id,
        `Deleted staff record ${userRes.rows[0].full_name}`,
        req
      );
    }

    res.json({ success: true, message: 'Staff record removed from university roster' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
