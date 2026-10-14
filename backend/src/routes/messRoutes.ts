import { Router } from 'express';
import {
  getMessMenu,
  updateMessMenu,
  getInventory,
  recordInventoryTransaction,
  recordFoodWastage
} from '../controllers/messController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/menu', authenticate, getMessMenu);
router.post('/menu', authenticate, requireRoles('super_admin', 'mess_manager'), updateMessMenu);
router.get('/inventory', authenticate, requireRoles('super_admin', 'mess_manager', 'univ_mgmt'), getInventory);
router.post('/inventory/transactions', authenticate, requireRoles('super_admin', 'mess_manager'), recordInventoryTransaction);
router.post('/wastage', authenticate, requireRoles('super_admin', 'mess_manager'), recordFoodWastage);

export default router;
