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
router.patch('/:id/status', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), updateLeaveStatus);
router.get('/gate-pass/:passCode', authenticate, requireRoles('super_admin', 'security_staff', 'chief_warden', 'hostel_warden'), verifyGatePass);
router.post('/gate-movements', authenticate, requireRoles('super_admin', 'security_staff'), logGateMovement);

export default router;
