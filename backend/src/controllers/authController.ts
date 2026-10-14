import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';
import { generateToken } from '../config/jwt.js';
import { logAudit, AuthRequest } from '../middleware/auth.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, u.role, u.is_active, r.display_name as role_display
       FROM users u
       JOIN roles r ON u.role = r.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ success: false, error: 'Invalid email address or password' });
      return;
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      res.status(403).json({ success: false, error: 'Your account has been deactivated. Please contact administrator.' });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ success: false, error: 'Invalid email address or password' });
      return;
    }

    // Roles maintained strictly as personnel records without application access
    const RECORD_ONLY_ROLES = ['univ_mgmt', 'mess_staff', 'security_staff', 'accounts_staff', 'maint_staff'];
    if (RECORD_ONLY_ROLES.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: 'Access Restricted: This role is maintained in university personnel records only and does not have login access to the application.'
      });
      return;
    }

    // Get assigned hostels if staff
    const hostelAssignments = await executeQuery(
      `SELECT DISTINCT h.id, h.name, h.code, h.category
       FROM hostels h
       LEFT JOIN user_hostel_assignments uha ON uha.hostel_id = h.id
       WHERE uha.user_id = $1 OR h.chief_warden_id = $1`,
      [user.id]
    );

    let assignedCategory: 'boys' | 'girls' | 'all' = 'all';
    if (user.role !== 'super_admin' && hostelAssignments.rows.length > 0) {
      const allBoys = hostelAssignments.rows.every((h: any) => h.category === 'boys');
      const allGirls = hostelAssignments.rows.every((h: any) => h.category === 'girls');
      if (allBoys) assignedCategory = 'boys';
      else if (allGirls) assignedCategory = 'girls';
    }

    // Get student details if student
    let studentProfile = null;
    if (user.role === 'student') {
      const studentRes = await executeQuery(
        `SELECT s.*, h.name as hostel_name, h.id as hostel_id, r.room_number, b.bed_number
         FROM students s
         LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
         LEFT JOIN hostels h ON sa.hostel_id = h.id
         LEFT JOIN rooms r ON sa.room_id = r.id
         LEFT JOIN beds b ON sa.bed_id = b.id
         WHERE s.user_id = $1`,
        [user.id]
      );
      if (studentRes.rowCount > 0) {
        studentProfile = studentRes.rows[0];
      }
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      assignedHostels: hostelAssignments.rows.map((h: any) => h.id),
      assignedCategory,
      studentId: studentProfile ? studentProfile.id : undefined
    };

    const token = generateToken(tokenPayload);

    await logAudit(user.id, 'LOGIN', 'user', user.id, { role: user.role }, req);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        roleDisplay: user.role_display,
        assignedHostels: hostelAssignments.rows,
        assignedCategory,
        student: studentProfile
      }
    });
  } catch (err: any) {
    console.error('[Login Error]', err);
    res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.full_name, u.phone, u.role, r.display_name as role_display
       FROM users u
       JOIN roles r ON u.role = r.id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (userResult.rowCount === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const hostelAssignments = await executeQuery(
      `SELECT DISTINCT h.id, h.name, h.code, h.category
       FROM hostels h
       LEFT JOIN user_hostel_assignments uha ON uha.hostel_id = h.id
       WHERE uha.user_id = $1 OR h.chief_warden_id = $1`,
      [user.id]
    );

    let assignedCategory: 'boys' | 'girls' | 'all' = 'all';
    if (user.role !== 'super_admin' && hostelAssignments.rows.length > 0) {
      const allBoys = hostelAssignments.rows.every((h: any) => h.category === 'boys');
      const allGirls = hostelAssignments.rows.every((h: any) => h.category === 'girls');
      if (allBoys) assignedCategory = 'boys';
      else if (allGirls) assignedCategory = 'girls';
    }

    let studentProfile = null;
    if (user.role === 'student') {
      const studentRes = await executeQuery(
        `SELECT s.*, h.name as hostel_name, h.id as hostel_id, r.room_number, b.bed_number
         FROM students s
         LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
         LEFT JOIN hostels h ON sa.hostel_id = h.id
         LEFT JOIN rooms r ON sa.room_id = r.id
         LEFT JOIN beds b ON sa.bed_id = b.id
         WHERE s.user_id = $1`,
        [user.id]
      );
      if (studentRes.rowCount > 0) {
        studentProfile = studentRes.rows[0];
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        roleDisplay: user.role_display,
        assignedHostels: hostelAssignments.rows,
        assignedCategory,
        student: studentProfile
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    return;
  }

  try {
    const userRes = await executeQuery('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const match = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!match) {
      res.status(400).json({ success: false, error: 'Current password does not match' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await executeQuery('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.user!.id]);
    await logAudit(req.user!.id, 'CHANGE_PASSWORD', 'user', req.user!.id, null, req);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
