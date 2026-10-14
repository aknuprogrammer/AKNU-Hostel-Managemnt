import { Router } from 'express';
import { getFeeStructures, getStudentFeeLedgers, recordPayment } from '../controllers/financeController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/structures', authenticate, getFeeStructures);
router.get('/ledgers', authenticate, getStudentFeeLedgers);
router.post('/payments', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), recordPayment);

export default router;
