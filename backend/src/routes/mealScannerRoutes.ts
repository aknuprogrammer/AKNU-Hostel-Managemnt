import { Router } from 'express';
import {
  getActiveSessionInfo,
  processMealScan,
  manualMealOverride,
  correctMealTransaction,
  getRecentScans,
  getMealReports,
  getWingStudentsForFaceScan,
  getLateMealPermissions,
  createLateMealPermission
} from '../controllers/mealScannerController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/active-session', authenticate, getActiveSessionInfo);
router.get('/students-directory', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), getWingStudentsForFaceScan);
router.get('/late-permissions', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), getLateMealPermissions);
router.post('/late-permissions', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), createLateMealPermission);

router.post('/face-scan', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), processMealScan);
router.post('/scan', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), processMealScan);
router.post('/verify-scan', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), processMealScan);
router.post('/manual-override', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), manualMealOverride);
router.post('/correct-transaction', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), correctMealTransaction);
router.get('/recent-scans', authenticate, getRecentScans);
router.get('/reports', authenticate, getMealReports);

export default router;

