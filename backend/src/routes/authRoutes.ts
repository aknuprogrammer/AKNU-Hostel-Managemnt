import { Router } from 'express';
import {
  login,
  getCurrentUser,
  changePassword,
  setupPassword,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);
router.post('/setup-password', setupPassword);
router.post('/forgot-password/send-otp', forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', forgotPasswordVerifyOtp);

export default router;
