import { Router } from 'express';
import multer from 'multer';
import {
  getStudents,
  getStudentById,
  createStudent,
  regenerateStudentQr,
  bulkImportStudents,
  getAcademicStructure,
  createDepartment,
  createCourse,
  generateRegistrationNumberHandler
} from '../controllers/studentController.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.get('/meta/academic-structure', authenticate, getAcademicStructure);
router.get('/meta/generate-reg-number', authenticate, generateRegistrationNumberHandler);
router.post('/meta/departments', authenticate, createDepartment);
router.post('/meta/courses', authenticate, createCourse);
router.get('/', authenticate, getStudents);
router.get('/:id', authenticate, getStudentById);
router.post('/', authenticate, requireRoles('super_admin', 'hostel_warden'), createStudent);
router.post('/:id/regenerate-qr', authenticate, requireRoles('super_admin', 'hostel_warden'), regenerateStudentQr);
router.post('/bulk-import', authenticate, requireRoles('super_admin'), upload.single('file'), bulkImportStudents);

export default router;
