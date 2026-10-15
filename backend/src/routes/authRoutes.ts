import { Router } from 'express';
import { login, getCurrentUser, changePassword, setupPassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);
router.post('/setup-password', setupPassword);

export default router;
