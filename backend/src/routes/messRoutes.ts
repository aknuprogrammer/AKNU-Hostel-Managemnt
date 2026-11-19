import { Router } from 'express';
import {
  getMessMenu,
  updateMessMenu,
  deleteMessMenu,
  getMealSessions,
  updateMealSession,
  updateAllMealSessions,
  getInventory,
  recordInventoryTransaction,
  recordFoodWastage,
  getMealAttendanceCounts,
  getMealAttendanceRoster,
  getMyMealAttendance,
  toggleMyMealAttendance,
  staffUpdateMealAttendance,
  staffBulkMarkAttendance
} from '../controllers/messController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/sessions', authenticate, getMealSessions);
router.put('/sessions', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), updateAllMealSessions);
router.put('/sessions/:id', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), updateMealSession);
router.get('/menu', authenticate, getMessMenu);
router.post('/menu', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), updateMessMenu);
router.delete('/menu/:id', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden'), deleteMessMenu);
router.get('/inventory', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), getInventory);
router.post('/inventory/transactions', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), recordInventoryTransaction);
router.post('/wastage', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), recordFoodWastage);

// Daily Student Meal Attendance & Kitchen Food Preparation Headcount
router.get('/attendance/counts', authenticate, getMealAttendanceCounts);
router.get('/attendance/roster', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), getMealAttendanceRoster);
router.get('/attendance/my-status', authenticate, getMyMealAttendance);
router.post('/attendance/toggle-my-meal', authenticate, toggleMyMealAttendance);
router.post('/attendance/staff-override', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), staffUpdateMealAttendance);
router.post('/attendance/staff-bulk', authenticate, requireRoles('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'), staffBulkMarkAttendance);

export default router;
