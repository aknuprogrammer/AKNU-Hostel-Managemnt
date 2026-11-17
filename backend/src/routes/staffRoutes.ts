import { Router } from 'express';
import { getStaffList, addStaffRecord, updateStaffRecord, deleteStaffRecord } from '../controllers/staffController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getStaffList);
router.post('/', authenticate, requireRoles('super_admin', 'chief_warden'), addStaffRecord);
router.put('/:id', authenticate, requireRoles('super_admin', 'chief_warden'), updateStaffRecord);
router.delete('/:id', authenticate, requireRoles('super_admin', 'chief_warden'), deleteStaffRecord);

export default router;
