import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';

export async function getFeeStructures(req: AuthRequest, res: Response): Promise<void> {
  try {
    let whereClause = '';
    const params: any[] = [];
    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      const placeholders = req.user.assignedHostels.map((_, i) => `$${i + 1}`).join(',');
      whereClause = `WHERE fs.hostel_id IN (${placeholders})`;
      params.push(...req.user.assignedHostels);
    }

    const fees = await executeQuery(`
      SELECT fs.*, h.name as hostel_name, ay.name as academic_year_name
      FROM fee_structures fs
      JOIN hostels h ON fs.hostel_id = h.id
      JOIN academic_years ay ON fs.academic_year_id = ay.id
      ${whereClause}
      ORDER BY fs.due_date ASC
    `, params);
    res.json({ success: true, data: fees.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getStudentFeeLedgers(req: AuthRequest, res: Response): Promise<void> {
  const { studentId, status } = req.query;

  try {
    let sql = `
      SELECT sfl.*, s.full_name as student_name, s.roll_number, s.phone as student_phone,
             fs.fee_type, fs.amount as total_prescribed_amount, fs.due_date,
             h.name as hostel_name
      FROM student_fee_ledgers sfl
      JOIN students s ON sfl.student_id = s.id
      JOIN fee_structures fs ON sfl.fee_structure_id = fs.id
      JOIN hostels h ON fs.hostel_id = h.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.user?.role === 'student') {
      params.push(req.user.studentId);
      sql += ` AND sfl.student_id = $${params.length}`;
    } else if (studentId) {
      params.push(studentId);
      sql += ` AND sfl.student_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND sfl.status = $${params.length}`;
    }

    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels && req.user.assignedHostels.length > 0) {
      const placeholders = req.user.assignedHostels.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...req.user.assignedHostels);
      sql += ` AND fs.hostel_id IN (${placeholders})`;
    }

    const ledgers = await executeQuery(sql, params);
    res.json({ success: true, data: ledgers.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function recordPayment(req: AuthRequest, res: Response): Promise<void> {
  const { ledgerId, amount, paymentMode = 'upi', transactionReference } = req.body;

  if (!ledgerId || !amount || amount <= 0 || !transactionReference) {
    res.status(400).json({ success: false, error: 'Ledger ID, positive amount, and transaction reference are required' });
    return;
  }

  try {
    const ledgerRes = await executeQuery('SELECT * FROM student_fee_ledgers WHERE id = $1', [ledgerId]);
    if (ledgerRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Fee ledger entry not found' });
      return;
    }

    const ledger = ledgerRes.rows[0];
    const paymentId = uuidv4();
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
    const newPaid = Number(ledger.amount_paid) + Number(amount);
    const newBalance = Math.max(0, Number(ledger.amount_due) - newPaid);
    const newStatus = newBalance === 0 ? 'paid' : 'partial';

    await executeTransaction(async (query) => {
      await query(
        `INSERT INTO fee_payments (id, student_id, ledger_id, transaction_reference, payment_mode, amount, status, receipt_number, verified_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8)`,
        [paymentId, ledger.student_id, ledger.id, transactionReference.trim(), paymentMode, amount, receiptNumber, req.user?.id]
      );

      await query(
        `UPDATE student_fee_ledgers
         SET amount_paid = $1, balance = $2, status = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newPaid, newBalance, newStatus, ledger.id]
      );
    });

    await logAudit(req.user?.id, 'RECORD_FEE_PAYMENT', 'fee_payment', paymentId, { receiptNumber, amount }, req);

    res.json({
      success: true,
      message: 'Payment recorded and receipt generated successfully',
      data: {
        paymentId,
        receiptNumber,
        newBalance,
        status: newStatus
      }
    });
  } catch (err: any) {
    if (err.message?.includes('unique') || err.message?.includes('duplicate key')) {
      res.status(409).json({ success: false, error: 'Transaction reference has already been used' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
}
