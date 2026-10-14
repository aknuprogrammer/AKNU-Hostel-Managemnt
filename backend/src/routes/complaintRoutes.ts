import { Router } from 'express';
import {
  submitComplaint,
  getComplaints,
  updateComplaintStatus,
  rateComplaint
} from '../controllers/complaintController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, submitComplaint);
router.get('/', authenticate, getComplaints);
router.patch('/:id/status', authenticate, updateComplaintStatus);
router.post('/:id/rate', authenticate, rateComplaint);

export default router;
