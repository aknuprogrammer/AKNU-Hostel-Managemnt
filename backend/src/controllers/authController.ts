import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';
import { generateToken } from '../config/jwt.js';
import { logAudit, AuthRequest } from '../middleware/auth.js';
import { generateQrSalt, signStudentQrToken } from '../utils/qr.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, u.role, u.is_active, u.is_first_login, r.display_name as role_display
       FROM users u
       JOIN roles r ON u.role = r.id
       LEFT JOIN students s ON s.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1) OR UPPER(s.roll_number) = UPPER($1)`,
      [email.trim()]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ success: false, error: 'Invalid email/roll number or password' });
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

    // Require first-time login students with temporary password to create their personal password
    if (user.role === 'student' && user.is_first_login) {
      res.json({
        success: true,
        requiresPasswordChange: true,
        identifier: user.email,
        message: 'First-time login detected with temporary credentials. Please set up your private password.'
      });
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
        `SELECT s.*, h.name as hostel_name, h.id as hostel_id, h.code as hostel_code, h.category as hostel_category, r.room_number, b.bed_number
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
        if (studentProfile.hostel_category) {
          assignedCategory = studentProfile.hostel_category;
        }
        if (!studentProfile.qr_credential_token || !studentProfile.qr_credential_token.startsWith('aknu_v1.')) {
          const salt = generateQrSalt();
          const qrToken = signStudentQrToken(studentProfile.id, studentProfile.reg_number, salt);
          await executeQuery(
            `UPDATE students SET qr_credential_token = $1, qr_salt = $2, qr_status = 'active' WHERE id = $3`,
            [qrToken, salt, studentProfile.id]
          );
          studentProfile.qr_credential_token = qrToken;
          studentProfile.qr_salt = salt;
          studentProfile.qr_status = 'active';
        }
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
        `SELECT s.*, h.name as hostel_name, h.id as hostel_id, h.code as hostel_code, h.category as hostel_category, r.room_number, b.bed_number
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
        if (studentProfile.hostel_category) {
          assignedCategory = studentProfile.hostel_category;
        }
        if (!studentProfile.qr_credential_token || !studentProfile.qr_credential_token.startsWith('aknu_v1.')) {
          const salt = generateQrSalt();
          const qrToken = signStudentQrToken(studentProfile.id, studentProfile.reg_number, salt);
          await executeQuery(
            `UPDATE students SET qr_credential_token = $1, qr_salt = $2, qr_status = 'active' WHERE id = $3`,
            [qrToken, salt, studentProfile.id]
          );
          studentProfile.qr_credential_token = qrToken;
          studentProfile.qr_salt = salt;
          studentProfile.qr_status = 'active';
        }
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
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    return;
  }

  try {
    const userRes = await executeQuery('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (currentPassword) {
      const match = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
      if (!match) {
        res.status(400).json({ success: false, error: 'Current password does not match' });
        return;
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await executeQuery('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.user!.id]);
    await logAudit(req.user!.id, 'CHANGE_PASSWORD', 'user', req.user!.id, null, req);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function setupPassword(req: Request, res: Response): Promise<void> {
  const { identifier, temporaryPassword, newPassword } = req.body;

  if (!identifier || !temporaryPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'Email or Roll number, temporary password, and new password are required' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    return;
  }

  try {
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.is_active
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1) OR UPPER(s.roll_number) = UPPER($1)`,
      [identifier.trim()]
    );

    if (userResult.rowCount === 0) {
      res.status(404).json({ success: false, error: 'User account not found with this email or roll number' });
      return;
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      res.status(403).json({ success: false, error: 'Your account has been deactivated. Please contact administrator.' });
      return;
    }

    const match = await bcrypt.compare(temporaryPassword, user.password_hash);
    if (!match) {
      res.status(400).json({ success: false, error: 'Temporary password is incorrect. Please check your temporary credentials.' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await executeQuery(
      'UPDATE users SET password_hash = $1, is_first_login = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, user.id]
    );

    await logAudit(user.id, 'SETUP_PASSWORD', 'user', user.id, { role: user.role }, req);

    // Fetch student profile for direct session authorization
    let studentProfile = null;
    let assignedCategory: 'boys' | 'girls' | 'all' = 'all';
    if (user.role === 'student') {
      const studentRes = await executeQuery(
        `SELECT s.*, h.name as hostel_name, h.id as hostel_id, h.code as hostel_code, h.category as hostel_category, r.room_number, b.bed_number
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
        if (studentProfile.hostel_category) {
          assignedCategory = studentProfile.hostel_category;
        }
      }
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      assignedHostels: [],
      assignedCategory,
      studentId: studentProfile ? studentProfile.id : undefined
    });

    res.json({
      success: true,
      message: 'New password set up successfully! You are now logged in.',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        roleDisplay: 'Student Resident',
        assignedHostels: [],
        assignedCategory,
        student: studentProfile
      }
    });
  } catch (err: any) {
    console.error('[Setup Password Error]', err);
    res.status(500).json({ success: false, error: 'Failed to set up new password: ' + err.message });
  }
}
