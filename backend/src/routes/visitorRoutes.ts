import { Router } from 'express';
import { registerVisitor, checkoutVisitor, getVisitors } from '../controllers/visitorController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getVisitors);
router.post('/register', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), registerVisitor);
router.patch('/:id/checkout', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), checkoutVisitor);

export default router;
