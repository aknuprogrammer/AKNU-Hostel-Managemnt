import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';
import { verifyStudentQrToken } from '../utils/qr.js';

interface ScanRequestBody {
  qrToken?: string;
  studentId?: string;
  rollNumber?: string;
  regNumber?: string;
  faceMatchScore?: number;
  verificationMethod?: 'FACE_RECOGNITION' | 'QR_SCAN' | 'MANUAL_OVERRIDE' | 'PROXY_COLLECTION';
  mealSessionId?: string;
  hostelId?: string;
  checkpointName?: string;
  idempotencyKey?: string;
  serviceDate?: string;
  isLateMealAllowed?: boolean;
  lateReason?: string;
  proxyStudentId?: string;
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
  const {
    qrToken,
    studentId,
    rollNumber,
    regNumber,
    faceMatchScore,
    verificationMethod: requestedMethod,
    mealSessionId,
    hostelId,
    checkpointName = 'Main Dining Counter',
    isLateMealAllowed,
    lateReason,
    proxyStudentId
  } = req.body as ScanRequestBody;

  if (!qrToken && !studentId && !rollNumber && !regNumber) {
    res.status(400).json({
      success: false,
      resultStatus: 'INVALID_CREDENTIAL',
      error: 'Student identifier or face scan match is required'
    });
    return;
  }

  const scannedByUserId = req.user?.id || 'anonymous';
  const now = new Date();
  const serviceDate = now.toISOString().split('T')[0];

  try {
    // 1. Resolve Meal Session
    let session: any = null;
    if (mealSessionId) {
      const sRes = await executeQuery('SELECT * FROM meal_sessions WHERE id = $1 AND is_active = true', [mealSessionId]);
      if (sRes.rowCount > 0) session = sRes.rows[0];
    }
    if (!session) {
      session = await getActiveMealSession();
    }

    // 2. Resolve Student
    let student: any = null;
    let verificationMethod = requestedMethod || 'FACE_RECOGNITION';

    if (studentId) {
      const sRes = await executeQuery(
        `SELECT s.*, sa.hostel_id as allocated_hostel_id, h.name as allocated_hostel_name, h.category as hostel_category,
                r.room_number, b.bed_number
         FROM students s
         LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
         LEFT JOIN hostels h ON sa.hostel_id = h.id
         LEFT JOIN rooms r ON sa.room_id = r.id
         LEFT JOIN beds b ON sa.bed_id = b.id
         WHERE s.id = $1`,
        [studentId]
      );
      if (sRes.rowCount > 0) student = sRes.rows[0];
    } else if (rollNumber || regNumber) {
      const iden = (rollNumber || regNumber)!.trim();
      const sRes = await executeQuery(
        `SELECT s.*, sa.hostel_id as allocated_hostel_id, h.name as allocated_hostel_name, h.category as hostel_category,
                r.room_number, b.bed_number
         FROM students s
         LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
         LEFT JOIN hostels h ON sa.hostel_id = h.id
         LEFT JOIN rooms r ON sa.room_id = r.id
         LEFT JOIN beds b ON sa.bed_id = b.id
         WHERE UPPER(s.roll_number) = UPPER($1) OR UPPER(s.reg_number) = UPPER($1)`,
        [iden]
      );
      if (sRes.rowCount > 0) student = sRes.rows[0];
    } else if (qrToken) {
      const cleanToken = qrToken.trim();
      const verification = verifyStudentQrToken(cleanToken);
      if (verification.valid && verification.payload) {
        const sRes = await executeQuery(
          `SELECT s.*, sa.hostel_id as allocated_hostel_id, h.name as allocated_hostel_name, h.category as hostel_category,
                  r.room_number, b.bed_number
           FROM students s
           LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
           LEFT JOIN hostels h ON sa.hostel_id = h.id
           LEFT JOIN rooms r ON sa.room_id = r.id
           LEFT JOIN beds b ON sa.bed_id = b.id
           WHERE s.id = $1`,
          [verification.payload.studentId]
        );
        if (sRes.rowCount > 0) {
          student = sRes.rows[0];
          verificationMethod = 'QR_SCAN';
        }
      }

      if (!student) {
        let extractedRoll = cleanToken;
        const legacyMatch = cleanToken.match(/aknu_qr_token_([a-zA-Z0-9]+)/i);
        if (legacyMatch) extractedRoll = legacyMatch[1];

        const directRes = await executeQuery(
          `SELECT s.*, sa.hostel_id as allocated_hostel_id, h.name as allocated_hostel_name, h.category as hostel_category,
                  r.room_number, b.bed_number
           FROM students s
           LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
           LEFT JOIN hostels h ON sa.hostel_id = h.id
           LEFT JOIN rooms r ON sa.room_id = r.id
           LEFT JOIN beds b ON sa.bed_id = b.id
           WHERE s.qr_credential_token = $1
              OR UPPER(s.roll_number) = UPPER($1)
              OR UPPER(s.roll_number) = UPPER($2)
              OR UPPER(s.reg_number) = UPPER($1)
              OR s.id = $1`,
          [cleanToken, extractedRoll]
        );
        if (directRes.rowCount > 0) {
          student = directRes.rows[0];
        }
      }
    }

    if (!student) {
      await recordScanAttempt(null, null, session?.id || null, hostelId || null, checkpointName, scannedByUserId, 'INVALID_CREDENTIAL', 'Student not found in registry');
      res.status(404).json({
        success: false,
        resultStatus: 'INVALID_CREDENTIAL',
        title: 'Student Not Found',
        message: 'No registered student matching the facial biometric or ID credential was found in the database.'
      });
      return;
    }

    // 3. Check for Late Meal Approval
    let latePermission: any = null;
    const permRes = await executeQuery(
      `SELECT p.*, u.full_name as approved_by_name, u.role as approved_by_role
       FROM proxy_meal_permissions p
       JOIN users u ON p.approved_by_user_id = u.id
       WHERE p.target_student_id = $1
         AND p.service_date = $2
         AND p.status = 'approved'
         AND p.is_collected = false
       ORDER BY p.created_at DESC LIMIT 1`,
      [student.id, serviceDate]
    );

    if (permRes.rowCount > 0) {
      latePermission = permRes.rows[0];
      if (!session && latePermission.meal_session_id) {
        const sRes = await executeQuery('SELECT * FROM meal_sessions WHERE id = $1', [latePermission.meal_session_id]);
        if (sRes.rowCount > 0) session = sRes.rows[0];
      }
    }

    // If still no session active and staff didn't grant instant override:
    if (!session) {
      if (isLateMealAllowed && (req.user?.role === 'super_admin' || req.user?.role === 'chief_warden' || req.user?.role === 'assistant_warden' || req.user?.role === 'junior_assistant')) {
        // Find most recent session today
        const latestSessionRes = await executeQuery('SELECT * FROM meal_sessions WHERE is_active = true ORDER BY end_time DESC LIMIT 1');
        if (latestSessionRes.rowCount > 0) session = latestSessionRes.rows[0];
      }

      if (!session) {
        await recordScanAttempt(student.id, student.roll_number, null, hostelId || null, checkpointName, scannedByUserId, 'OUTSIDE_HOURS', 'Late arrival without permission');
        res.status(400).json({
          success: false,
          resultStatus: 'OUTSIDE_HOURS',
          title: 'Late Arrival - Permission Required',
          message: 'The regular meal session has ended. To receive food, the student must obtain permission from the Junior Assistant or Chief Warden.',
          student: {
            id: student.id,
            fullName: student.full_name,
            rollNumber: student.roll_number,
            regNumber: student.reg_number,
            photoUrl: student.photo_url
          }
        });
        return;
      }
    }

    // 4. Check Hostel Status & Mess Eligibility
    if (student.hostel_status !== 'active') {
      await recordScanAttempt(student.id, student.roll_number, session.id, hostelId || null, checkpointName, scannedByUserId, 'NOT_ELIGIBLE', `Hostel account status: ${student.hostel_status}`);
      res.status(403).json({
        success: false,
        resultStatus: 'NOT_ELIGIBLE',
        title: 'Hostel Status Inactive',
        message: `Student account is currently ${student.hostel_status}. Only active residents can take meals.`
      });
      return;
    }

    if (!student.mess_eligibility) {
      await recordScanAttempt(student.id, student.roll_number, session.id, hostelId || null, checkpointName, scannedByUserId, 'NOT_ELIGIBLE', 'Mess eligibility disabled');
      res.status(403).json({
        success: false,
        resultStatus: 'NOT_ELIGIBLE',
        title: 'Mess Eligibility Inactive',
        message: 'Student is not enrolled or active for hostel mess dining.'
      });
      return;
    }

    // 5. Gender Wing Separation Enforcement
    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      const staffWing = req.user.assignedCategory; // 'boys' or 'girls'
      const studentGender = (student.gender || '').toLowerCase();
      const studentWing = (studentGender === 'female' || student.hostel_category === 'girls') ? 'girls' : 'boys';

      if (staffWing !== studentWing) {
        await recordScanAttempt(student.id, student.roll_number, session.id, hostelId || null, checkpointName, scannedByUserId, 'HOSTEL_MISMATCH', `Wing mismatch: ${staffWing} counter scanned ${studentWing} student`);
        res.status(403).json({
          success: false,
          resultStatus: 'HOSTEL_MISMATCH',
          title: 'Hostel Wing Mismatch',
          message: `This is the ${staffWing.toUpperCase()} counter. This student belongs to the ${studentWing.toUpperCase()} hostel and cannot take food here.`
        });
        return;
      }
    }

    const targetHostelId = hostelId || student.allocated_hostel_id || null;

    // 6. ATOMIC TRANSACTION & DUPLICATE MEAL PREVENTION
    // Strict atomic guarantee: No student can take food multiple times in the same session
    const transactionId = uuidv4();

    try {
      await executeTransaction(async (query) => {
        // Pre-check for duplicate with row lock
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

        let notes = latePermission
          ? `Late Permission Approved by ${latePermission.approved_by_name} (${latePermission.approved_by_role}): ${latePermission.reason}`
          : (isLateMealAllowed ? `Late meal granted on spot by staff: ${lateReason || 'Approved'}` : null);

        if (faceMatchScore) {
          notes = (notes ? notes + ' | ' : '') + `Face Match Confidence: ${Math.round(faceMatchScore * 100)}%`;
        }

        const approvedBy = latePermission?.approved_by_user_id || (isLateMealAllowed ? scannedByUserId : null);
        const proxyId = proxyStudentId || latePermission?.proxy_student_id || null;

        await query(
          `INSERT INTO meal_transactions (
            id, student_id, meal_session_id, hostel_id, checkpoint_name,
            service_date, scanned_at, scanned_by_user_id, status, verification_method,
            proxy_student_id, proxy_approved_by, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, 'SUCCESS', $8, $9, $10, $11
          )`,
          [
            transactionId,
            student.id,
            session.id,
            targetHostelId,
            checkpointName,
            serviceDate,
            scannedByUserId,
            verificationMethod,
            proxyId,
            approvedBy,
            notes
          ]
        );

        // If a late permission was used, mark it as collected
        if (latePermission) {
          await query(
            `UPDATE proxy_meal_permissions
             SET is_collected = true, status = 'collected', collected_at = CURRENT_TIMESTAMP, collected_by_staff_id = $1
             WHERE id = $2`,
            [scannedByUserId, latePermission.id]
          );
        }
      });

      // Record successful scan attempt
      await recordScanAttempt(student.id, student.roll_number, session.id, targetHostelId, checkpointName, scannedByUserId, 'SUCCESS', 'Face recognition verified meal');
      await logAudit(scannedByUserId, 'MEAL_FACE_SCAN_SUCCESS', 'meal_transaction', transactionId, { studentId: student.id, session: session.name }, req);

      res.status(200).json({
        success: true,
        resultStatus: 'SUCCESS',
        title: 'Present - Face Verified',
        message: 'Identity verified. Student is present and permitted to take food.',
        transaction: {
          id: transactionId,
          scannedAt: new Date().toISOString(),
          sessionName: session.name,
          checkpoint: checkpointName,
          verificationMethod,
          isLateMeal: !!latePermission || !!isLateMealAllowed,
          lateApprovedBy: latePermission?.approved_by_name || null
        },
        student: {
          id: student.id,
          fullName: student.full_name,
          rollNumber: student.roll_number,
          regNumber: student.reg_number,
          photoUrl: student.photo_url,
          hostelName: student.allocated_hostel_name,
          roomNumber: student.room_number,
          bedNumber: student.bed_number,
          gender: student.gender
        }
      });
    } catch (txErr: any) {
      if (txErr.message?.startsWith('DUPLICATE_SCAN:') || txErr.message?.includes('uq_meal_student_date_session') || txErr.message?.includes('unique constraint')) {
        let scannedTimeStr = '';
        if (txErr.message?.startsWith('DUPLICATE_SCAN:')) {
          const rawTime = txErr.message.split('DUPLICATE_SCAN:')[1];
          scannedTimeStr = new Date(rawTime).toLocaleTimeString('en-IN');
        }

        await recordScanAttempt(student.id, student.roll_number, session.id, targetHostelId, checkpointName, scannedByUserId, 'DUPLICATE', `Meal already taken earlier at ${scannedTimeStr}`);

        res.status(409).json({
          success: false,
          resultStatus: 'DUPLICATE',
          title: 'Double-Dip Blocked: Already Taken Food',
          message: `${student.full_name} (${student.roll_number}) has ALREADY collected food for ${session.name} today${scannedTimeStr ? ' at ' + scannedTimeStr : ''}. Multiple collections and sharing meals are strictly prohibited.`,
          student: {
            id: student.id,
            fullName: student.full_name,
            rollNumber: student.roll_number,
            regNumber: student.reg_number,
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
    console.error('[Meal Face Scan Error]', err);
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

// Students Directory for Face Recognition Scanning (filtered by counter's wing)
export async function getWingStudentsForFaceScan(req: AuthRequest, res: Response): Promise<void> {
  try {
    let whereClauses = ["s.hostel_status = 'active'", "s.mess_eligibility = true"];
    let params: any[] = [];
    let pIdx = 1;

    // Filter by staff wing (boys / girls)
    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      const gender = req.user.assignedCategory === 'girls' ? 'female' : 'male';
      whereClauses.push(`(s.gender = $${pIdx} OR h.category = '${req.user.assignedCategory}')`);
      params.push(gender);
      pIdx++;
    }

    const studentsRes = await executeQuery(
      `SELECT s.id, s.full_name, s.roll_number, s.reg_number, s.photo_url, s.gender,
              h.id as hostel_id, h.name as hostel_name, h.category as hostel_category,
              r.room_number, b.bed_number
       FROM students s
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       LEFT JOIN beds b ON sa.bed_id = b.id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY s.full_name ASC`,
      params
    );

    res.json({
      success: true,
      data: studentsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Get today's late permissions
export async function getLateMealPermissions(req: AuthRequest, res: Response): Promise<void> {
  const serviceDate = (req.query.date as string) || new Date().toISOString().split('T')[0];

  try {
    let whereClauses = ['p.service_date = $1'];
    let params: any[] = [serviceDate];
    let pIdx = 2;

    if (req.user?.role !== 'super_admin' && req.user?.assignedCategory && req.user.assignedCategory !== 'all') {
      const gender = req.user.assignedCategory === 'girls' ? 'female' : 'male';
      whereClauses.push(`(s.gender = $${pIdx} OR h.category = '${req.user.assignedCategory}')`);
      params.push(gender);
      pIdx++;
    }

    const permsRes = await executeQuery(
      `SELECT p.*,
              s.full_name as student_name, s.roll_number, s.reg_number, s.photo_url, s.gender,
              h.name as hostel_name, r.room_number,
              ms.name as session_name,
              u.full_name as approved_by_name, u.role as approved_by_role,
              ps.full_name as proxy_student_name, ps.roll_number as proxy_roll_number
       FROM proxy_meal_permissions p
       JOIN students s ON p.target_student_id = s.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       LEFT JOIN meal_sessions ms ON p.meal_session_id = ms.id
       LEFT JOIN users u ON p.approved_by_user_id = u.id
       LEFT JOIN students ps ON p.proxy_student_id = ps.id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: permsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Create or grant late meal permission (By Junior Assistant, Assistant Warden, or Chief Warden)
export async function createLateMealPermission(req: AuthRequest, res: Response): Promise<void> {
  const { studentIdentifier, mealSessionId, reason, proxyStudentIdentifier } = req.body;

  if (!studentIdentifier || !reason) {
    res.status(400).json({ success: false, error: 'Student roll/reg number and reason are required' });
    return;
  }

  const approverUserId = req.user?.id;
  const now = new Date();
  const serviceDate = now.toISOString().split('T')[0];

  try {
    // Find target student
    const studentRes = await executeQuery(
      `SELECT s.*, sa.hostel_id, h.name as hostel_name, h.category as hostel_category
       FROM students s
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       WHERE UPPER(s.roll_number) = UPPER($1) OR UPPER(s.reg_number) = UPPER($1) OR s.id = $1`,
      [studentIdentifier.trim()]
    );

    if (studentRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Student not found in registry' });
      return;
    }

    const student = studentRes.rows[0];

    // Optional proxy student
    let proxyStudentId = null;
    if (proxyStudentIdentifier && proxyStudentIdentifier.trim()) {
      const pRes = await executeQuery(
        `SELECT id FROM students WHERE UPPER(roll_number) = UPPER($1) OR UPPER(reg_number) = UPPER($1) OR id = $1`,
        [proxyStudentIdentifier.trim()]
      );
      if (pRes.rowCount > 0) {
        proxyStudentId = pRes.rows[0].id;
      }
    }

    // Resolve meal session
    let targetSessionId = mealSessionId;
    if (!targetSessionId) {
      const activeSession = await getActiveMealSession();
      if (activeSession) {
        targetSessionId = activeSession.id;
      } else {
        const latestRes = await executeQuery('SELECT id FROM meal_sessions WHERE is_active = true ORDER BY end_time DESC LIMIT 1');
        targetSessionId = latestRes.rows[0]?.id || 'ms-dinner';
      }
    }

    const permId = uuidv4();
    await executeQuery(
      `INSERT INTO proxy_meal_permissions (
        id, target_student_id, proxy_student_id, meal_session_id, service_date,
        reason, status, approved_by_user_id, is_collected
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'approved', $7, false
      )`,
      [permId, student.id, proxyStudentId, targetSessionId, serviceDate, reason, approverUserId]
    );

    await logAudit(approverUserId, 'GRANT_LATE_MEAL_PERMISSION', 'proxy_meal_permissions', permId, {
      studentId: student.id,
      reason
    }, req);

    res.json({
      success: true,
      message: `Late meal permission approved for ${student.full_name} (${student.roll_number})`,
      permissionId: permId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

