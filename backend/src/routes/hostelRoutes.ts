import { Router } from 'express';
import {
  getHostels,
  getHostelDetails,
  getRoomsWithBeds,
  allocateBed,
  transferRoom,
  createHostel,
  updateHostel,
  deleteHostel,
  addRoomToHostel,
  getUnallocatedCandidates,
  batchAllocateCohort,
  batchVacateStudents,
  deleteBed,
  addBedToRoom
} from '../controllers/hostelController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getHostels);
router.get('/rooms/beds', authenticate, getRoomsWithBeds);
router.get('/batch/unallocated-candidates', authenticate, getUnallocatedCandidates);
router.get('/:id', authenticate, getHostelDetails);
router.post('/', authenticate, requireRoles('super_admin', 'chief_warden', 'univ_mgmt'), createHostel);
router.put('/:id', authenticate, requireRoles('super_admin', 'chief_warden'), updateHostel);
router.delete('/:id', authenticate, requireRoles('super_admin', 'chief_warden'), deleteHostel);
router.post('/:id/rooms', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), addRoomToHostel);
router.delete('/beds/:bedId', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), deleteBed);
router.post('/rooms/:roomId/beds', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), addBedToRoom);
router.post('/allocations', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), allocateBed);
router.post('/transfers', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), transferRoom);
router.post('/batch/allocate', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), batchAllocateCohort);
router.post('/batch/vacate', authenticate, requireRoles('super_admin', 'chief_warden', 'hostel_warden'), batchVacateStudents);

export default router;
