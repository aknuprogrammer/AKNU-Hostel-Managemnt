import { Router } from 'express';
import { registerVisitor, checkoutVisitor, getVisitors } from '../controllers/visitorController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getVisitors);
router.post('/register', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), registerVisitor);
router.patch('/:id/checkout', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), checkoutVisitor);

export default router;
