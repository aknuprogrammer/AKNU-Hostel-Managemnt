import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';
import { verifyStudentQrToken } from '../utils/qr.js';

interface ScanRequestBody {
  qrToken: string;
  mealSessionId?: string;
  hostelId?: string;
  checkpointName?: string;
  idempotencyKey?: string;
  serviceDate?: string; // YYYY-MM-DD, defaults to current local date
}

// Helper to determine the active meal session based on time
export async function getActiveMealSession(): Promise<any | null> {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sessionsRes = await executeQuery(
    `SELECT * FROM meal_sessions WHERE is_active = true ORDER BY start_time ASC`
  );

  for (const session of sessionsRes.rows) {
    const [startH, startM] = session.start_time.split(':').map(Number);
    const [endH, endM] = session.end_time.split(':').map(Number);
    const grace = session.grace_minutes || 0;

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM + grace;

    if (currentMinutes >= startTotal && currentMinutes <= endTotal) {
      return {
        ...session,
        remainingMinutes: endTotal - currentMinutes
      };
    }
  }

  return null;
}

export async function getActiveSessionInfo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const activeSession = await getActiveMealSession();
    const allSessions = (await executeQuery('SELECT * FROM meal_sessions WHERE is_active = true ORDER BY start_time ASC')).rows;

    res.json({
      success: true,
      data: {
        activeSession,
        allSessions,
        currentTime: new Date().toLocaleTimeString('en-IN', { hour12: false })
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function processMealScan(req: AuthRequest, res: Response): Promise<void> {
  const { qrToken, mealSessionId, hostelId, checkpointName = 'Main Dining Counter' } = req.body as ScanRequestBody;

  if (!qrToken) {
    res.status(400).json({
      success: false,
      resultStatus: 'INVALID_CREDENTIAL',
      error: 'QR token is required'
    });
    return;
  }

  const scannedByUserId = req.user?.id || 'anonymous';
  const now = new Date();
  const serviceDate = now.toISOString().split('T')[0];

  try {
    // 1. Resolve Session
    let session: any = null;
    if (mealSessionId) {
      const sRes = await executeQuery('SELECT * FROM meal_sessions WHERE id = $1 AND is_active = true', [mealSessionId]);
      if (sRes.rowCount > 0) session = sRes.rows[0];
    }
    if (!session) {
      session = await getActiveMealSession();
    }

    if (!session) {
      // Record scan attempt
      await recordScanAttempt(null, null, null, hostelId || null, checkpointName, scannedByUserId, 'OUTSIDE_HOURS', 'No active meal session at this time');
      res.status(400).json({
        success: false,
        resultStatus: 'OUTSIDE_HOURS',
        title: 'Outside Meal Hours',
        message: 'There is no active meal session currently open.'
      });
      return;
    }

    // 2. Cryptographic QR Verification
    const verification = verifyStudentQrToken(qrToken);
    if (!verification.valid || !verification.payload) {
      await recordScanAttempt(null, null, session.id, hostelId || null, checkpointName, scannedByUserId, 'INVALID_CREDENTIAL', verification.error || 'Cryptographic signature mismatch');
      res.status(400).json({
        success: false,
        resultStatus: 'INVALID_CREDENTIAL',
        title: 'Invalid QR Credential',
        message: 'The scanned QR code is malformed, expired, or has an invalid university signature.'
      });
      return;
    }

    const { studentId, salt } = verification.payload;

    // 3. Lookup Student Record
    const studentRes = await executeQuery(
      `SELECT s.*,
              sa.hostel_id as allocated_hostel_id, h.name as allocated_hostel_name,
              r.room_number, b.bed_number
       FROM students s
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       LEFT JOIN beds b ON sa.bed_id = b.id
       WHERE s.id = $1`,
      [studentId]
    );

    if (studentRes.rowCount === 0) {
      await recordScanAttempt(studentId, null, session.id, hostelId || null, checkpointName, scannedByUserId, 'NOT_ELIGIBLE', 'Student record not found in system');
      res.status(404).json({
        success: false,
        resultStatus: 'NOT_ELIGIBLE',
        title: 'Student Not Found',
        message: 'No student matches this credential in the university database.'
      });
      return;
    }

    const student = studentRes.rows[0];

    // 4. Verify Salt & Token Revocation Status
    if (student.qr_salt !== salt || student.qr_status !== 'active') {
      await recordScanAttempt(student.id, student.roll_number, session.id, hostelId || null, checkpointName, scannedByUserId, 'INVALID_CREDENTIAL', 'QR token revoked or replaced');
      res.status(403).json({
        success: false,
        resultStatus: 'INVALID_CREDENTIAL',
        title: 'Revoked Credential',
        message: 'This digital ID has been revoked or replaced with a newer version. Please instruct the student to generate or refresh their QR ID.'
      });
      return;
    }

    // 5. Check Hostel Status & Mess Eligibility
    if (student.hostel_status !== 'active') {
      await recordScanAttempt(student.id, student.roll_number, session.id, hostelId || null, checkpointName, scannedByUserId, 'NOT_ELIGIBLE', `Hostel account status: ${student.hostel_status}`);
      res.status(403).json({
        success: false,
        resultStatus: 'NOT_ELIGIBLE',
        title: 'Hostel Status Inactive',
        message: `Student account is currently ${student.hostel_status}.`
      });
      return;
    }

    if (!student.mess_eligibility) {
      await recordScanAttempt(student.id, student.roll_number, session.id, hostelId || null, checkpointName, scannedByUserId, 'NOT_ELIGIBLE', 'Mess eligibility is disabled');
      res.status(403).json({
        success: false,
        resultStatus: 'NOT_ELIGIBLE',
        title: 'Mess Eligibility Expired',
        message: 'Student is not enrolled or active for hostel mess dining.'
      });
      return;
    }

    // Check wing separation: if staff has assigned hostels, ensure student is within their wing
    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      if (student.allocated_hostel_id && !req.user.assignedHostels.includes(student.allocated_hostel_id)) {
        await recordScanAttempt(student.id, student.roll_number, session.id, hostelId || null, checkpointName, scannedByUserId, 'HOSTEL_MISMATCH', 'Student is registered in a different hostel wing');
        res.status(403).json({
          success: false,
          resultStatus: 'HOSTEL_MISMATCH',
          title: 'Hostel Wing Mismatch',
          message: `This student is registered in ${student.allocated_hostel_name || 'another wing'} and cannot be scanned at this counter.`
        });
        return;
      }
    }

    const targetHostelId = hostelId || student.allocated_hostel_id || null;

    // 6. ATOMIC TRANSACTION & DUPLICATE PREVENTION
    // We execute an atomic insert into meal_transactions guarded by UNIQUE(student_id, service_date, meal_session_id)
    const transactionId = uuidv4();

    try {
      await executeTransaction(async (query) => {
        // Pre-check for duplicate with row lock or check constraint
        const existingTx = await query(
          `SELECT id, scanned_at, verification_method, status
           FROM meal_transactions
           WHERE student_id = $1 AND service_date = $2 AND meal_session_id = $3`,
          [student.id, serviceDate, session.id]
        );

        if (existingTx.rows && existingTx.rows.length > 0) {
          const prior = existingTx.rows[0];
          throw new Error(`DUPLICATE_SCAN:${prior.scanned_at}`);
        }

        // Insert atomically
        await query(
          `INSERT INTO meal_transactions (
            id, student_id, meal_session_id, hostel_id, checkpoint_name,
            service_date, scanned_at, scanned_by_user_id, status, verification_method
          ) VALUES (
            $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, 'SUCCESS', 'QR_SCAN'
          )`,
          [transactionId, student.id, session.id, targetHostelId, checkpointName, serviceDate, scannedByUserId]
        );
      });

      // Record successful scan attempt
      await recordScanAttempt(student.id, student.roll_number, session.id, targetHostelId, checkpointName, scannedByUserId, 'SUCCESS', 'Meal verified successfully');
      await logAudit(scannedByUserId, 'MEAL_SCAN_SUCCESS', 'meal_transaction', transactionId, { studentId: student.id, session: session.name }, req);

      res.status(200).json({
        success: true,
        resultStatus: 'SUCCESS',
        title: 'Meal Verified & Recorded',
        message: 'Access granted. Meal transaction recorded successfully.',
        transaction: {
          id: transactionId,
          scannedAt: new Date().toISOString(),
          sessionName: session.name,
          checkpoint: checkpointName
        },
        student: {
          id: student.id,
          fullName: student.full_name,
          rollNumber: student.roll_number,
          regNumber: student.reg_number,
          photoUrl: student.photo_url,
          hostelName: student.allocated_hostel_name,
          roomNumber: student.room_number,
          bedNumber: student.bed_number
        }
      });
    } catch (txErr: any) {
      if (txErr.message?.startsWith('DUPLICATE_SCAN:') || txErr.message?.includes('uq_meal_student_date_session') || txErr.message?.includes('unique constraint')) {
        let scannedTimeStr = '';
        if (txErr.message?.startsWith('DUPLICATE_SCAN:')) {
          const rawTime = txErr.message.split('DUPLICATE_SCAN:')[1];
          scannedTimeStr = new Date(rawTime).toLocaleTimeString('en-IN');
        }

        await recordScanAttempt(student.id, student.roll_number, session.id, targetHostelId, checkpointName, scannedByUserId, 'DUPLICATE', `Meal already recorded earlier at ${scannedTimeStr}`);

        res.status(409).json({
          success: false,
          resultStatus: 'DUPLICATE',
          title: 'Duplicate Meal Scan Detected',
          message: `This student has already availed ${session.name} today${scannedTimeStr ? ' at ' + scannedTimeStr : ''}. Multiple meals in a single session are prohibited.`,
          student: {
            fullName: student.full_name,
            rollNumber: student.roll_number,
            photoUrl: student.photo_url,
            hostelName: student.allocated_hostel_name,
            roomNumber: student.room_number
          }
        });
        return;
      }
      throw txErr;
    }
  } catch (err: any) {
    console.error('[Meal Scan Internal Error]', err);
    res.status(500).json({ success: false, error: 'Database transaction error during meal scanning: ' + err.message });
  }
}

// Authorized Manual Search & Override by Warden
export async function manualMealOverride(req: AuthRequest, res: Response): Promise<void> {
  const { rollNumber, mealSessionId, hostelId, checkpointName = 'Manual Warden Counter', overrideReason } = req.body;

  if (!rollNumber || !overrideReason) {
    res.status(400).json({ success: false, error: 'Student Roll Number and mandatory Override Reason are required' });
    return;
  }

  const scannedByUserId = req.user?.id || 'anonymous';
  const now = new Date();
  const serviceDate = now.toISOString().split('T')[0];

  try {
    let session: any = null;
    if (mealSessionId) {
      const sRes = await executeQuery('SELECT * FROM meal_sessions WHERE id = $1', [mealSessionId]);
      if (sRes.rowCount > 0) session = sRes.rows[0];
    }
    if (!session) {
      session = await getActiveMealSession();
    }
    if (!session) {
      res.status(400).json({ success: false, error: 'No active meal session selected or running' });
      return;
    }

    const studentRes = await executeQuery(
      `SELECT s.*, sa.hostel_id as allocated_hostel_id, h.name as allocated_hostel_name, r.room_number
       FROM students s
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       WHERE UPPER(s.roll_number) = UPPER($1)`,
      [rollNumber.trim()]
    );

    if (studentRes.rowCount === 0) {
      res.status(404).json({ success: false, error: `Student with roll number ${rollNumber} not found` });
      return;
    }

    const student = studentRes.rows[0];
    const targetHostelId = hostelId || student.allocated_hostel_id || null;
    const txId = uuidv4();

    try {
      await executeTransaction(async (query) => {
        const existingTx = await query(
          `SELECT id FROM meal_transactions WHERE student_id = $1 AND service_date = $2 AND meal_session_id = $3`,
          [student.id, serviceDate, session.id]
        );
        if (existingTx.rows && existingTx.rows.length > 0) {
          throw new Error('DUPLICATE_SCAN');
        }

        await query(
          `INSERT INTO meal_transactions (
            id, student_id, meal_session_id, hostel_id, checkpoint_name,
            service_date, scanned_at, scanned_by_user_id, status, verification_method, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, 'SUCCESS', 'MANUAL_OVERRIDE', $8
          )`,
          [txId, student.id, session.id, targetHostelId, checkpointName, serviceDate, scannedByUserId, overrideReason]
        );
      });

      await recordScanAttempt(student.id, student.roll_number, session.id, targetHostelId, checkpointName, scannedByUserId, 'SUCCESS', `Manual override: ${overrideReason}`);
      await logAudit(scannedByUserId, 'MEAL_MANUAL_OVERRIDE', 'meal_transaction', txId, { rollNumber, reason: overrideReason }, req);

      res.json({
        success: true,
        message: 'Manual meal entry recorded successfully under warden authorization',
        data: {
          transactionId: txId,
          studentName: student.full_name,
          rollNumber: student.roll_number,
          sessionName: session.name
        }
      });
    } catch (e: any) {
      if (e.message === 'DUPLICATE_SCAN' || e.message?.includes('uq_meal_student_date_session')) {
        res.status(409).json({ success: false, error: 'Student already has a recorded meal transaction for this session today.' });
        return;
      }
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Transaction Correction & Reversal Workflow
export async function correctMealTransaction(req: AuthRequest, res: Response): Promise<void> {
  const { transactionId, newStatus = 'REVERSED', reason } = req.body;

  if (!transactionId || !reason) {
    res.status(400).json({ success: false, error: 'Transaction ID and justification reason are required' });
    return;
  }

  try {
    const txRes = await executeQuery('SELECT * FROM meal_transactions WHERE id = $1', [transactionId]);
    if (txRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Meal transaction not found' });
      return;
    }

    const tx = txRes.rows[0];
    const correctionId = uuidv4();

    await executeTransaction(async (query) => {
      await query(
        `INSERT INTO meal_transaction_corrections (
          id, meal_transaction_id, requested_by_user_id, approved_by_user_id,
          original_status, new_status, reason, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
        )`,
        [correctionId, tx.id, req.user?.id, req.user?.id, tx.status, newStatus, reason]
      );

      await query(
        `UPDATE meal_transactions SET status = $1, notes = COALESCE(notes, '') || ' | ' || $2 WHERE id = $3`,
        [newStatus, `Corrected: ${reason}`, tx.id]
      );
    });

    await logAudit(req.user?.id, 'CORRECT_MEAL_TX', 'meal_transaction', tx.id, { reason, newStatus }, req);

    res.json({
      success: true,
      message: `Transaction successfully updated to ${newStatus}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Helper to record scan attempts for analytics and fraud detection
async function recordScanAttempt(
  studentId: string | null,
  rollNumber: string | null,
  mealSessionId: string | null,
  hostelId: string | null,
  checkpoint: string,
  userId: string,
  resultStatus: string,
  reason: string
) {
  try {
    const attemptId = uuidv4();
    await executeQuery(
      `INSERT INTO scan_attempts (
        id, student_id, roll_number, meal_session_id, hostel_id, checkpoint_name,
        scanned_at, scanned_by_user_id, result_status, reason
      ) VALUES (
        $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9
      )`,
      [attemptId, studentId, rollNumber, mealSessionId, hostelId, checkpoint, userId, resultStatus, reason]
    );
  } catch (err) {
    console.error('[ScanAttempt Error]', err);
  }
}

// Recent Scans & Stats for Warden Dashboard
export async function getRecentScans(req: AuthRequest, res: Response): Promise<void> {
  const { hostelId, limit = '20' } = req.query;

  try {
    let whereClauses = ['1=1'];
    let params: any[] = [];
    let pIdx = 1;

    if (hostelId) {
      whereClauses.push(`mt.hostel_id = $${pIdx}`);
      params.push(hostelId);
      pIdx++;
    }

    params.push(parseInt(limit as string));

    const scans = await executeQuery(
      `SELECT mt.id, mt.service_date, mt.scanned_at, mt.verification_method, mt.status,
              s.full_name as student_name, s.roll_number, s.photo_url,
              ms.name as session_name, h.name as hostel_name, u.full_name as scanned_by_name
       FROM meal_transactions mt
       JOIN students s ON mt.student_id = s.id
       JOIN meal_sessions ms ON mt.meal_session_id = ms.id
       JOIN hostels h ON mt.hostel_id = h.id
       JOIN users u ON mt.scanned_by_user_id = u.id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY mt.scanned_at DESC
       LIMIT $${pIdx}`,
      params
    );

    res.json({
      success: true,
      data: scans.rows
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Meal Reports and Analytics
export async function getMealReports(req: AuthRequest, res: Response): Promise<void> {
  const { date, hostelId } = req.query;
  const targetDate = (date as string) || new Date().toISOString().split('T')[0];

  try {
    // Session counts for target date
    const sessionCountsRes = await executeQuery(
      `SELECT ms.id as session_id, ms.name as session_name, ms.code,
              COUNT(mt.id) as successful_meals
       FROM meal_sessions ms
       LEFT JOIN meal_transactions mt ON ms.id = mt.meal_session_id AND mt.service_date = $1 AND mt.status = 'SUCCESS'
       ${hostelId ? 'AND mt.hostel_id = $2' : ''}
       GROUP BY ms.id, ms.name, ms.code, ms.start_time
       ORDER BY ms.start_time ASC`,
      hostelId ? [targetDate, hostelId] : [targetDate]
    );

    // Scan attempts breakdown
    const attemptsRes = await executeQuery(
      `SELECT result_status, COUNT(*) as count
       FROM scan_attempts
       WHERE DATE(scanned_at) = $1
       GROUP BY result_status`,
      [targetDate]
    );

    res.json({
      success: true,
      data: {
        date: targetDate,
        sessionBreakdown: sessionCountsRes.rows,
        attemptsBreakdown: attemptsRes.rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
