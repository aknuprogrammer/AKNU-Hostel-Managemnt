import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../config/database.js';
import { generateToken } from '../config/jwt.js';
import { logAudit, AuthRequest } from '../middleware/auth.js';
import { generateQrSalt, signStudentQrToken } from '../utils/qr.js';
import { sendOtpEmail, sendStudentActivationOtpEmail } from '../services/emailService.js';

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

        // RULE ENFORCEMENT:
        // A student cannot complete first-time registration / portal sign in until hostel & room are allocated
        if (!studentProfile.hostel_id && user.is_first_login) {
          res.status(403).json({
            success: false,
            error: 'Hostel accommodation not yet allocated. You can only register and activate your student portal once your hostel and room have been allocated by the warden.'
          });
          return;
        }

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
      requiresPasswordChange: Boolean(user.is_first_login),
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

    // RULE ENFORCEMENT: Student cannot register or setup password until hostel is allocated
    if (user.role === 'student') {
      const allocCheck = await executeQuery(
        `SELECT sa.id FROM student_allocations sa 
         JOIN students s ON s.id = sa.student_id 
         WHERE s.user_id = $1 AND sa.status = 'active'`,
        [user.id]
      );
      if (allocCheck.rowCount === 0) {
        res.status(403).json({
          success: false,
          error: 'Hostel accommodation not yet allocated. You can only register and activate your student account once your hostel and room have been allocated by the warden.'
        });
        return;
      }
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

    // Invalidate prior unused OTPs for this user
    await executeQuery(`
      UPDATE password_reset_otps SET used = true WHERE user_id = $1 AND used = false
    `, [user.id]);

    const otpId = `otp-${uuidv4().slice(0, 8)}`;
    await executeQuery(`
      INSERT INTO password_reset_otps (id, user_id, email, otp, expires_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '10 minutes')
    `, [otpId, user.id, user.email, otp]);

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
      SELECT id, expires_at, used, (expires_at < CURRENT_TIMESTAMP) as is_expired
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
    if (record.is_expired) {
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

export async function studentActivationSendOtp(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body;
  if (!identifier || !identifier.trim()) {
    res.status(400).json({ success: false, error: 'Please enter your Student Roll Number or Registration Number' });
    return;
  }
  const cleanId = identifier.trim();

  try {
    // 1. Find student and linked user
    const studentRes = await executeQuery(
      `SELECT s.id as student_id, s.roll_number, s.reg_number, s.full_name, s.email, s.phone,
              u.id as user_id, u.is_first_login, u.is_active,
              sa.id as alloc_id, h.name as hostel_name, r.room_number, b.bed_number
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       LEFT JOIN beds b ON sa.bed_id = b.id
       WHERE UPPER(s.roll_number) = UPPER($1) OR UPPER(s.reg_number) = UPPER($1) OR LOWER(s.email) = LOWER($1)`,
      [cleanId]
    );

    if (studentRes.rowCount === 0) {
      res.status(404).json({
        success: false,
        error: `No student record found matching "${cleanId}". Please check your Roll Number or contact the hostel office.`
      });
      return;
    }

    const row = studentRes.rows[0];

    // 2. Gatekeeper rule: Hostel must be allocated first
    if (!row.alloc_id) {
      res.status(403).json({
        success: false,
        error: `Hostel allocation pending. You have not been allocated a hostel room yet. You can only register and activate your student account once the warden has allocated your hostel, floor, and room.`
      });
      return;
    }

    // 3. Check if already activated
    if (!row.is_first_login) {
      res.status(400).json({
        success: false,
        error: `Your account (${row.roll_number}) is already registered and activated. Please sign in directly on the login page or use "Forgot Password?" if you forgot your credentials.`
      });
      return;
    }

    // 4. Check user status
    if (!row.is_active) {
      res.status(403).json({
        success: false,
        error: 'Your student account is currently deactivated. Please contact the Chief Warden office.'
      });
      return;
    }

    // 5. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Invalidate existing unused OTPs
    await executeQuery(
      `UPDATE password_reset_otps SET used = true WHERE user_id = $1 AND used = false`,
      [row.user_id]
    );

    const otpId = `act-${uuidv4().slice(0, 8)}`;
    await executeQuery(
      `INSERT INTO password_reset_otps (id, user_id, email, otp, expires_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
      [otpId, row.user_id, row.email, otp]
    );

    // 6. Send activation email
    const emailSent = await sendStudentActivationOtpEmail(row.email, row.full_name, otp, {
      hostelName: row.hostel_name,
      roomNumber: row.room_number,
      bedNumber: row.bed_number
    });

    if (!emailSent) {
      res.status(500).json({
        success: false,
        error: 'Unable to send OTP email at this time. Please check your internet connection or contact the Chief Warden.'
      });
      return;
    }

    // Mask email for display
    const [local, domain] = (row.email || '').split('@');
    const maskedLocal = local.length > 2
      ? `${local[0]}***${local[local.length - 1]}`
      : `${local[0]}***`;
    const maskedEmail = `${maskedLocal}@${domain}`;

    res.json({
      success: true,
      message: `Registration OTP has been sent to your registered email (${maskedEmail}).`,
      maskedEmail,
      identifier: row.roll_number,
      studentName: row.full_name,
      regNumber: row.reg_number,
      hostelName: row.hostel_name,
      roomNumber: row.room_number,
      bedNumber: row.bed_number
    });
  } catch (err: any) {
    console.error('[Student Activation Send OTP Error]', err);
    res.status(500).json({ success: false, error: 'Internal server error: ' + err.message });
  }
}

export async function studentActivationVerifyAndRegister(req: Request, res: Response): Promise<void> {
  const {
    identifier,
    otp,
    password,
    photoUrl,
    admissionFeeStatus,
    admissionFeePaymentDate,
    admissionFeeReceiptNo,
    admissionFeePaymentMode
  } = req.body;

  if (!identifier || !otp || !password) {
    res.status(400).json({ success: false, error: 'Roll number, 6-digit OTP, and password are required' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    return;
  }

  const cleanId = identifier.trim();
  const cleanOtp = otp.trim();

  try {
    const studentRes = await executeQuery(
      `SELECT s.*, u.id as user_id, u.is_first_login, u.is_active,
              sa.id as alloc_id, h.name as hostel_name, h.id as hostel_id, h.code as hostel_code, h.category as hostel_category, r.room_number, b.bed_number
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       LEFT JOIN beds b ON sa.bed_id = b.id
       WHERE UPPER(s.roll_number) = UPPER($1) OR UPPER(s.reg_number) = UPPER($1) OR LOWER(s.email) = LOWER($1)`,
      [cleanId]
    );

    if (studentRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Student record not found' });
      return;
    }

    const studentProfile = studentRes.rows[0];

    // Gatekeeper rule: Hostel must be allocated first
    if (!studentProfile.alloc_id) {
      res.status(403).json({
        success: false,
        error: 'Hostel accommodation not yet allocated. You can only register and activate your student account once your hostel and room have been allocated.'
      });
      return;
    }

    // Verify OTP
    const otpRes = await executeQuery(
      `SELECT id, expires_at, used, (expires_at < CURRENT_TIMESTAMP) as is_expired
       FROM password_reset_otps
       WHERE user_id = $1 AND otp = $2 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentProfile.user_id, cleanOtp]
    );

    if (otpRes.rowCount === 0) {
      res.status(400).json({ success: false, error: 'Invalid or expired OTP. Please verify the 6 digits or request a new code.' });
      return;
    }

    const otpRecord = otpRes.rows[0];
    if (otpRecord.is_expired) {
      res.status(400).json({ success: false, error: 'This OTP has expired. Please request a new activation OTP.' });
      return;
    }

    // Hash password & activate account
    const newHash = await bcrypt.hash(password, 10);
    await executeQuery(
      `UPDATE users SET password_hash = $1, is_first_login = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newHash, studentProfile.user_id]
    );
    await executeQuery(`UPDATE password_reset_otps SET used = true WHERE id = $1`, [otpRecord.id]);

    // Save profile photo and hostel admission fee details
    const feeStatus = admissionFeeStatus || studentProfile.admission_fee_status || 'pending';
    const feeDate = (feeStatus === 'paid' || feeStatus === 'partial') ? (admissionFeePaymentDate || new Date().toISOString().split('T')[0]) : null;
    const feeReceipt = admissionFeeReceiptNo ? String(admissionFeeReceiptNo).trim() : null;
    const feeMode = admissionFeePaymentMode || null;
    const photoToSave = photoUrl || studentProfile.photo_url || null;

    await executeQuery(
      `UPDATE students 
       SET photo_url = COALESCE($1, photo_url),
           admission_fee_status = $2,
           admission_fee_payment_date = $3,
           admission_fee_receipt_no = $4,
           admission_fee_payment_mode = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [photoToSave, feeStatus, feeDate, feeReceipt, feeMode, studentProfile.id]
    );

    studentProfile.photo_url = photoToSave;
    studentProfile.admission_fee_status = feeStatus;
    studentProfile.admission_fee_payment_date = feeDate;
    studentProfile.admission_fee_receipt_no = feeReceipt;
    studentProfile.admission_fee_payment_mode = feeMode;

    // Ensure QR token is signed and active
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

    await logAudit(studentProfile.user_id, 'STUDENT_REGISTRATION_ACTIVATED', 'students', studentProfile.id, {
      rollNumber: studentProfile.roll_number,
      hostel: studentProfile.hostel_name,
      room: studentProfile.room_number,
      hasPhoto: !!photoToSave,
      admissionFeeStatus: feeStatus
    }, req);

    // Generate JWT token
    const token = generateToken({
      id: studentProfile.user_id,
      email: studentProfile.email,
      role: 'student',
      fullName: studentProfile.full_name,
      assignedHostels: [],
      assignedCategory: studentProfile.hostel_category || 'all',
      studentId: studentProfile.id
    });

    res.json({
      success: true,
      message: 'Account successfully registered and activated! Welcome to AKNU Hostel Resident Portal.',
      token,
      user: {
        id: studentProfile.user_id,
        email: studentProfile.email,
        fullName: studentProfile.full_name,
        phone: studentProfile.phone,
        role: 'student',
        roleDisplay: 'Student Resident',
        assignedHostels: [],
        assignedCategory: studentProfile.hostel_category || 'all',
        student: studentProfile
      }
    });
  } catch (err: any) {
    console.error('[Student Activation Verify Error]', err);
    res.status(500).json({ success: false, error: 'Failed to complete registration: ' + err.message });
  }
}

