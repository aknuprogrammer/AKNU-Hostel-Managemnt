import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../config/database.js';
import { generateToken } from '../config/jwt.js';
import { logAudit, AuthRequest } from '../middleware/auth.js';
import { generateQrSalt, signStudentQrToken } from '../utils/qr.js';
import { sendOtpEmail } from '../services/emailService.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, u.role, u.gender_wing, u.is_active, u.is_first_login, r.display_name as role_display
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



    // Get assigned hostels if staff or wing-level hostels
    let hostelAssignments;
    if (user.role === 'super_admin') {
      hostelAssignments = await executeQuery(
        `SELECT DISTINCT h.id, h.name, h.code, h.category FROM hostels h ORDER BY h.name ASC`
      );
    } else if (user.gender_wing && (user.gender_wing === 'boys' || user.gender_wing === 'girls')) {
      hostelAssignments = await executeQuery(
        `SELECT DISTINCT h.id, h.name, h.code, h.category
         FROM hostels h
         LEFT JOIN user_hostel_assignments uha ON uha.hostel_id = h.id
         WHERE uha.user_id = $1 OR h.chief_warden_id = $1 OR h.category = $2
         ORDER BY h.name ASC`,
        [user.id, user.gender_wing]
      );
    } else {
      hostelAssignments = await executeQuery(
        `SELECT DISTINCT h.id, h.name, h.code, h.category
         FROM hostels h
         LEFT JOIN user_hostel_assignments uha ON uha.hostel_id = h.id
         WHERE uha.user_id = $1 OR h.chief_warden_id = $1
         ORDER BY h.name ASC`,
        [user.id]
      );
    }

    let assignedCategory: 'boys' | 'girls' | 'all' = (user.gender_wing as 'boys' | 'girls' | 'all') || 'all';
    if (user.role !== 'super_admin' && (!user.gender_wing || user.gender_wing === 'all') && hostelAssignments.rows.length > 0) {
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
      `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.gender_wing, r.display_name as role_display
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
    // Get assigned hostels if staff or wing-level hostels
    let hostelAssignments;
    if (user.role === 'super_admin') {
      hostelAssignments = await executeQuery(
        `SELECT DISTINCT h.id, h.name, h.code, h.category FROM hostels h ORDER BY h.name ASC`
      );
    } else if (user.gender_wing && (user.gender_wing === 'boys' || user.gender_wing === 'girls')) {
      hostelAssignments = await executeQuery(
        `SELECT DISTINCT h.id, h.name, h.code, h.category
         FROM hostels h
         LEFT JOIN user_hostel_assignments uha ON uha.hostel_id = h.id
         WHERE uha.user_id = $1 OR h.chief_warden_id = $1 OR h.category = $2
         ORDER BY h.name ASC`,
        [user.id, user.gender_wing]
      );
    } else {
      hostelAssignments = await executeQuery(
        `SELECT DISTINCT h.id, h.name, h.code, h.category
         FROM hostels h
         LEFT JOIN user_hostel_assignments uha ON uha.hostel_id = h.id
         WHERE uha.user_id = $1 OR h.chief_warden_id = $1
         ORDER BY h.name ASC`,
        [user.id]
      );
    }

    let assignedCategory: 'boys' | 'girls' | 'all' = (user.gender_wing as 'boys' | 'girls' | 'all') || 'all';
    if (user.role !== 'super_admin' && (!user.gender_wing || user.gender_wing === 'all') && hostelAssignments.rows.length > 0) {
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

export async function forgotPasswordSendOtp(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body;
  if (!identifier || !identifier.trim()) {
    res.status(400).json({ success: false, error: 'Please enter your registered email address or registration number' });
    return;
  }
  const cleanId = identifier.trim();

  try {
    // Look up user by email or student reg_number / roll_number
    const userRes = await executeQuery(`
      SELECT u.id, u.email, u.full_name, u.role
      FROM users u
      LEFT JOIN students s ON s.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1) OR UPPER(s.reg_number) = UPPER($1) OR UPPER(s.roll_number) = UPPER($1)
    `, [cleanId]);

    if (userRes.rowCount === 0) {
      res.status(404).json({
        success: false,
        error: 'No account found matching this email address or registration number. Please check your credentials.'
      });
      return;
    }

    const user = userRes.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate prior unused OTPs for this user
    await executeQuery(`
      UPDATE password_reset_otps SET used = true WHERE user_id = $1 AND used = false
    `, [user.id]);

    const otpId = `otp-${uuidv4().slice(0, 8)}`;
    await executeQuery(`
      INSERT INTO password_reset_otps (id, user_id, email, otp, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [otpId, user.id, user.email, otp, expiresAt]);

    const emailSent = await sendOtpEmail(user.email, user.full_name, otp);
    if (!emailSent) {
      res.status(500).json({
        success: false,
        error: 'Unable to send OTP email at this moment. Please check your internet connection or contact the Chief Warden.'
      });
      return;
    }

    // Mask email for security/privacy display (e.g. j***s@aknu.edu.in)
    const [local, domain] = user.email.split('@');
    const maskedLocal = local.length > 2
      ? `${local[0]}***${local[local.length - 1]}`
      : `${local[0]}***`;
    const maskedEmail = `${maskedLocal}@${domain}`;

    res.json({
      success: true,
      message: `A 6-digit One-Time Password (OTP) has been sent to your registered email (${maskedEmail}).`,
      maskedEmail,
      identifier: user.email
    });
  } catch (err: any) {
    console.error('[Forgot Password Send OTP Error]', err);
    res.status(500).json({ success: false, error: 'Internal server error: ' + err.message });
  }
}

export async function forgotPasswordVerifyOtp(req: Request, res: Response): Promise<void> {
  const { identifier, otp, newPassword } = req.body;
  if (!identifier || !otp || !newPassword) {
    res.status(400).json({ success: false, error: 'Identifier, 6-digit OTP, and new password are required' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    return;
  }

  const cleanId = identifier.trim();
  const cleanOtp = otp.trim();

  try {
    // Find user
    const userRes = await executeQuery(`
      SELECT u.id, u.email, u.full_name
      FROM users u
      LEFT JOIN students s ON s.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1) OR UPPER(s.reg_number) = UPPER($1) OR UPPER(s.roll_number) = UPPER($1)
    `, [cleanId]);

    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'User account not found' });
      return;
    }

    const user = userRes.rows[0];

    // Check latest valid OTP
    const otpRes = await executeQuery(`
      SELECT id, expires_at, used
      FROM password_reset_otps
      WHERE user_id = $1 AND otp = $2 AND used = false
      ORDER BY created_at DESC
      LIMIT 1
    `, [user.id, cleanOtp]);

    if (otpRes.rowCount === 0) {
      res.status(400).json({ success: false, error: 'Invalid or already used OTP. Please check the code or request a new one.' });
      return;
    }

    const record = otpRes.rows[0];
    if (new Date() > new Date(record.expires_at)) {
      res.status(400).json({ success: false, error: 'This OTP has expired. Please request a new OTP.' });
      return;
    }

    // Hash and update password
    const newHash = await bcrypt.hash(newPassword, 10);
    await executeQuery(`UPDATE users SET password_hash = $1, is_first_login = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newHash, user.id]);
    await executeQuery(`UPDATE password_reset_otps SET used = true WHERE id = $1`, [record.id]);

    await logAudit(user.id, 'PASSWORD_RESET_VIA_OTP', 'users', user.id, `Password reset via email OTP for ${user.email}`, req);

    res.json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.'
    });
  } catch (err: any) {
    console.error('[Forgot Password Verify OTP Error]', err);
    res.status(500).json({ success: false, error: 'Failed to reset password: ' + err.message });
  }
}
