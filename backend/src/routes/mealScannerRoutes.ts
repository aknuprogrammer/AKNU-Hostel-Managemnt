import { Router } from 'express';
import {
  getActiveSessionInfo,
  processMealScan,
  manualMealOverride,
  correctMealTransaction,
  getRecentScans,
  getMealReports
} from '../controllers/mealScannerController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/active-session', authenticate, getActiveSessionInfo);
router.post('/scan', authenticate, requireRoles('super_admin', 'hostel_warden', 'chief_warden', 'mess_manager'), processMealScan);
router.post('/manual-override', authenticate, requireRoles('super_admin', 'hostel_warden', 'chief_warden'), manualMealOverride);
router.post('/correct-transaction', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), correctMealTransaction);
router.get('/recent-scans', authenticate, getRecentScans);
router.get('/reports', authenticate, getMealReports);

export default router;
