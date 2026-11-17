import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'aknuprogrammer@aknu.edu.in',
    pass: process.env.SMTP_PASS || 'mswffrftrqzhmrjd'
  }
});

export async function sendOtpEmail(toEmail: string, recipientName: string, otp: string): Promise<boolean> {
  try {
    const fromAddress = process.env.EMAIL_FROM || '"AKNU Hostel Management" <aknuprogrammer@aknu.edu.in>';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
        <!-- Header -->
        <div style="background-color: #23395d; padding: 24px 28px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
            ADIKAVI NANNAYA UNIVERSITY
          </h1>
          <p style="color: #dce5f1; margin: 4px 0 0 0; font-size: 13px;">Hostel Management & Dining System</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 28px;">
          <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0;">
            Hello <strong>${recipientName || 'User'}</strong>,
          </p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
            We received a request to reset your password for your AKNU Hostel Management System account. Please use the One-Time Password (OTP) below to complete your password reset:
          </p>

          <!-- OTP Box -->
          <div style="background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 8px;">Your One-Time Password (OTP)</span>
            <div style="font-family: monospace, Courier, sans-serif; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a;">
              ${otp}
            </div>
            <span style="display: block; font-size: 12px; color: #ef4444; margin-top: 8px; font-weight: 600;">
              ⏱️ Valid for 10 minutes only
            </span>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0;">
            If you did not request this password reset, please ignore this email or notify the Chief Warden immediately. Your password will remain unchanged.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 11px; color: #64748b; margin: 0;">
            This is an automated system email. Please do not reply directly to this message.
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0;">
            &copy; 2026 Adikavi Nannaya University, Rajahmundry. All rights reserved.
          </p>
        </div>
      </div>
    `;

    console.log(`\n🔑 [PASSWORD RESET OTP] Email: ${toEmail} | Name: ${recipientName} | OTP: ${otp}\n`);
    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `[AKNU Hostel] ${otp} is your Password Reset OTP`,
      text: `Hello ${recipientName},\n\nYour password reset OTP for AKNU Hostel Management is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not make this request, please ignore this email.`,
      html: htmlContent
    });

    console.log(`[Email Service] Password reset OTP sent to ${toEmail} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error(`[Email Service Error] Failed to send email to ${toEmail}:`, error);
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DEV MODE] Allowing password reset to proceed with console OTP: ${otp}`);
      return true;
    }
    return false;
  }
}

export async function sendStudentActivationOtpEmail(
  toEmail: string,
  recipientName: string,
  otp: string,
  hostelInfo: { hostelName: string; roomNumber?: string; bedNumber?: string }
): Promise<boolean> {
  try {
    const fromAddress = process.env.EMAIL_FROM || '"AKNU Hostel Management" <aknuprogrammer@aknu.edu.in>';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
        <!-- Header -->
        <div style="background-color: #23395d; padding: 24px 28px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
            ADIKAVI NANNAYA UNIVERSITY
          </h1>
          <p style="color: #dce5f1; margin: 4px 0 0 0; font-size: 13px;">Hostel Resident Portal & Digital Identity</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 28px;">
          <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0;">
            Dear <strong>${recipientName || 'Student'}</strong>,
          </p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
            Congratulations! Your hostel accommodation has been confirmed by the hostel administration:
          </p>

          <!-- Allocation Details Card -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 13px; font-weight: 700; color: #166534;">
              🏨 Hostel: ${hostelInfo.hostelName || 'Assigned University Hostel'}
            </p>
            ${hostelInfo.roomNumber ? `
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #15803d;">
                🚪 Room: <strong>${hostelInfo.roomNumber}</strong> ${hostelInfo.bedNumber ? `• Bed: <strong>${hostelInfo.bedNumber}</strong>` : ''}
              </p>
            ` : ''}
          </div>

          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
            Please use the One-Time Password (OTP) below to complete your student registration, set your account password, and activate your digital resident ID:
          </p>

          <!-- OTP Box -->
          <div style="background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 8px;">Registration Activation OTP</span>
            <div style="font-family: monospace, Courier, sans-serif; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a;">
              ${otp}
            </div>
            <span style="display: block; font-size: 12px; color: #ef4444; margin-top: 8px; font-weight: 600;">
              ⏱️ Valid for 10 minutes only
            </span>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0;">
            After registration, you will have access to your biometric face verification attendance, leave applications, mess feedback, and digital hostel ID card.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 11px; color: #64748b; margin: 0;">
            Adikavi Nannaya University • Chief Warden Residential Directorate
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0;">
            &copy; 2026 Adikavi Nannaya University, Rajamahendravaram. All rights reserved.
          </p>
        </div>
      </div>
    `;

    console.log(`\n🔑 [STUDENT ACTIVATION OTP] Email: ${toEmail} | Name: ${recipientName} | OTP: ${otp}\n`);
    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `[AKNU Hostel] ${otp} is your Student Registration & Account Activation OTP`,
      text: `Hello ${recipientName},\n\nYour hostel accommodation has been confirmed at ${hostelInfo.hostelName}.\nYour registration activation OTP is: ${otp}\n\nValid for 10 minutes.`,
      html: htmlContent
    });

    console.log(`[Email Service] Student activation OTP sent to ${toEmail} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error(`[Email Service Error] Failed to send activation OTP to ${toEmail}:`, error);
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DEV MODE] Allowing registration flow to proceed with console OTP: ${otp}`);
      return true;
    }
    return false;
  }
}


