import { Router } from 'express';
import {
  submitLeaveApplication,
  getLeaveApplications,
  updateLeaveStatus,
  verifyGatePass,
  logGateMovement
} from '../controllers/leaveController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.post('/apply', authenticate, submitLeaveApplication);
router.get('/', authenticate, getLeaveApplications);
router.patch('/:id/status', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), updateLeaveStatus);
router.get('/gate-pass/:passCode', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), verifyGatePass);
router.post('/gate-movements', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), logGateMovement);

export default router;
