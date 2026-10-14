import { Router } from 'express';
import {
  getHostels,
  getHostelDetails,
  getRoomsWithBeds,
  allocateBed,
  transferRoom,
  createHostel,
  deleteHostel,
  addRoomToHostel,
  getUnallocatedCandidates,
  batchAllocateCohort,
  batchVacateStudents
} from '../controllers/hostelController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getHostels);
router.get('/rooms/beds', authenticate, getRoomsWithBeds);
router.get('/batch/unallocated-candidates', authenticate, getUnallocatedCandidates);
router.get('/:id', authenticate, getHostelDetails);
router.post('/', authenticate, requireRoles('super_admin', 'chief_warden', 'univ_mgmt'), createHostel);
router.delete('/:id', authenticate, requireRoles('super_admin', 'chief_warden'), deleteHostel);
router.post('/:id/rooms', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), addRoomToHostel);
router.post('/allocations', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), allocateBed);
router.post('/transfers', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), transferRoom);
router.post('/batch/allocate', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), batchAllocateCohort);
router.post('/batch/vacate', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), batchVacateStudents);

export default router;
