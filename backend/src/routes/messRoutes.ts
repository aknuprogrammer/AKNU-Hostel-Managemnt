import { Router } from 'express';
import {
  getMessMenu,
  updateMessMenu,
  deleteMessMenu,
  getMealSessions,
  getInventory,
  recordInventoryTransaction,
  recordFoodWastage
} from '../controllers/messController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/sessions', authenticate, getMealSessions);
router.get('/menu', authenticate, getMessMenu);
router.post('/menu', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), updateMessMenu);
router.delete('/menu/:id', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), deleteMessMenu);
router.get('/inventory', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), getInventory);
router.post('/inventory/transactions', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), recordInventoryTransaction);
router.post('/wastage', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), recordFoodWastage);

export default router;
