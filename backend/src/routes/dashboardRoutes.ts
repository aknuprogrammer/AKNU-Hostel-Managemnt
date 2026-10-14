import { Router } from 'express';
import { getDashboardStats, executeAdminQuery } from '../controllers/dashboardController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticate, getDashboardStats);
router.post('/query', authenticate, requireRoles('super_admin'), executeAdminQuery);

export default router;
