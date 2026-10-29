import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';
import { generateQrSalt, signStudentQrToken, generateQrDataUri } from '../utils/qr.js';

export async function getStudents(req: AuthRequest, res: Response): Promise<void> {
  const { search, hostelId, departmentId, courseId, programLevel, status, page = '1', limit = '10' } = req.query;
  const isAll = String(limit).toLowerCase() === 'all' || parseInt(limit as string) === -1;
  const parsedLimit = isAll ? 100000 : (parseInt(limit as string) || 10);
  const parsedPage = isAll ? 1 : Math.max(1, parseInt(page as string) || 1);
  const offset = (parsedPage - 1) * parsedLimit;

  try {
    let whereClauses = ['1=1'];
    let params: any[] = [];
    let pIdx = 1;

    if (search) {
      whereClauses.push(`(s.full_name ILIKE $${pIdx} OR s.roll_number ILIKE $${pIdx} OR s.reg_number ILIKE $${pIdx} OR s.email ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    if (hostelId) {
      if (hostelId === 'unassigned') {
        whereClauses.push('sa.hostel_id IS NULL');
      } else {
        whereClauses.push(`sa.hostel_id = $${pIdx}`);
        params.push(hostelId);
        pIdx++;
      }
    }

    if (departmentId) {
      whereClauses.push(`s.department_id = $${pIdx}`);
      params.push(departmentId);
      pIdx++;
    }

    if (courseId) {
      whereClauses.push(`s.course_id = $${pIdx}`);
      params.push(courseId);
      pIdx++;
    }

    if (programLevel) {
      whereClauses.push(`(s.program_level = $${pIdx} OR (s.program_level IS NULL AND c.program_level = $${pIdx}))`);
      params.push(programLevel);
      pIdx++;
    }

    if (status) {
      whereClauses.push(`s.hostel_status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    // RBAC: Strict Gender Wing Isolation (Zero Cross-Wing Leakage)
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;
    const wingGender = wing === 'girls' ? 'female' : (wing === 'boys' ? 'male' : null);

    if (wing) {
      if (req.user?.assignedHostels?.length) {
        const allowedPlaceholders = req.user.assignedHostels.map((_, i) => `$${pIdx + i}`).join(',');
        params.push(...req.user.assignedHostels);
        pIdx += req.user.assignedHostels.length;
        whereClauses.push(`(sa.hostel_id IN (${allowedPlaceholders}) OR (sa.hostel_id IS NULL AND s.gender = '${wingGender}'))`);
      } else {
        whereClauses.push(`(h.category = $${pIdx} OR (sa.hostel_id IS NULL AND s.gender = $${pIdx + 1}))`);
        params.push(wing, wingGender);
        pIdx += 2;
      }
    }

    const whereSql = whereClauses.join(' AND ');

    const countRes = await executeQuery(
      `SELECT 
         COUNT(DISTINCT s.id) as total,
         COUNT(DISTINCT CASE WHEN s.gender = 'male' THEN s.id END) as total_boys,
         COUNT(DISTINCT CASE WHEN s.gender = 'female' THEN s.id END) as total_girls,
         COUNT(DISTINCT CASE WHEN s.mess_eligibility = true THEN s.id END) as total_mess_active
       FROM students s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       WHERE ${whereSql}`,
      params
    );

    const total = parseInt(countRes.rows[0]?.total || '0');
    const totalBoys = parseInt(countRes.rows[0]?.total_boys || '0');
    const totalGirls = parseInt(countRes.rows[0]?.total_girls || '0');
    const totalMessActive = parseInt(countRes.rows[0]?.total_mess_active || '0');

    const querySql = `
      SELECT s.*,
             COALESCE(s.program_level, c.program_level, 'UG') as program_level,
             d.name as department_name, c.name as course_name, c.duration_years as course_duration,
             h.name as hostel_name, h.code as hostel_code,
             r.room_number, b.bed_number, sa.id as allocation_id
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
      LEFT JOIN hostels h ON sa.hostel_id = h.id
      LEFT JOIN rooms r ON sa.room_id = r.id
      LEFT JOIN beds b ON sa.bed_id = b.id
      WHERE ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;
    params.push(parsedLimit, offset);

    const studentsRes = await executeQuery(querySql, params);

    res.json({
      success: true,
      data: studentsRes.rows,
      pagination: {
        page: parsedPage,
        limit: isAll ? total : parsedLimit,
        total,
        totalPages: isAll ? 1 : (Math.ceil(total / parsedLimit) || 1)
      },
      stats: {
        total,
        totalBoys,
        totalGirls,
        totalMessActive
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getStudentById(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const studentRes = await executeQuery(
      `SELECT s.*,
              COALESCE(s.program_level, c.program_level, 'UG') as program_level,
              d.name as department_name, c.name as course_name, c.duration_years as course_duration,
              h.name as hostel_name, h.code as hostel_code, h.id as hostel_id,
              r.room_number, r.id as room_id, b.bed_number, b.id as bed_id,
              sa.id as allocation_id, sa.check_in_date
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       LEFT JOIN rooms r ON sa.room_id = r.id
       LEFT JOIN beds b ON sa.bed_id = b.id
       WHERE s.id = $1`,
      [id]
    );

    if (studentRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Student record not found' });
      return;
    }

    const student = studentRes.rows[0];
    
    // RBAC: Wing boundary check
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;
    const wingGender = wing === 'girls' ? 'female' : (wing === 'boys' ? 'male' : null);
    if (wing && student.gender !== wingGender) {
      res.status(403).json({ success: false, error: 'Access denied: Cannot access student belonging to a different gender wing' });
      return;
    }

    const qrDataUri = await generateQrDataUri(student.qr_credential_token);

    res.json({
      success: true,
      data: {
        ...student,
        qrDataUri
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getAcademicStructure(req: AuthRequest, res: Response): Promise<void> {
  try {
    const departmentsRes = await executeQuery('SELECT id, code, name FROM departments ORDER BY name ASC');
    const coursesRes = await executeQuery('SELECT id, department_id, code, name, duration_years, COALESCE(program_level, \'UG\') as program_level FROM courses ORDER BY name ASC');
    const academicYearsRes = await executeQuery('SELECT id, name, is_current FROM academic_years ORDER BY start_date DESC');

    res.json({
      success: true,
      data: {
        departments: departmentsRes.rows,
        courses: coursesRes.rows,
        academicYears: academicYearsRes.rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getStudentFilterOptions(req: AuthRequest, res: Response): Promise<void> {
  try {
    let whereClauses = ['1=1'];
    let params: any[] = [];
    let pIdx = 1;

    // RBAC: Strict Gender Wing Isolation (Zero Cross-Wing Leakage)
    const isSuperAdmin = req.user?.role === 'super_admin';
    const wing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;
    const wingGender = wing === 'girls' ? 'female' : (wing === 'boys' ? 'male' : null);

    if (wing) {
      if (req.user?.assignedHostels?.length) {
        const allowedPlaceholders = req.user.assignedHostels.map((_, i) => `$${pIdx + i}`).join(',');
        params.push(...req.user.assignedHostels);
        pIdx += req.user.assignedHostels.length;
        whereClauses.push(`(sa.hostel_id IN (${allowedPlaceholders}) OR (sa.hostel_id IS NULL AND s.gender = '${wingGender}'))`);
      } else {
        whereClauses.push(`(h.category = $${pIdx} OR (sa.hostel_id IS NULL AND s.gender = $${pIdx + 1}))`);
        params.push(wing, wingGender);
        pIdx += 2;
      }
    }

    const whereSql = whereClauses.join(' AND ');

    // 1. Program Levels actually present in students table
    const levelsRes = await executeQuery(
      `SELECT COALESCE(s.program_level, c.program_level, 'UG') as level, COUNT(DISTINCT s.id) as count
       FROM students s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY count DESC, level ASC`,
      params
    );

    // 2. Courses/Degrees actually present in students table
    const coursesRes = await executeQuery(
      `SELECT COALESCE(c.id, s.course_id) as id,
              COALESCE(c.name, 'Unassigned Course') as name,
              COALESCE(s.program_level, c.program_level, 'UG') as program_level,
              COUNT(DISTINCT s.id) as count
       FROM students s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       WHERE ${whereSql} AND (c.id IS NOT NULL OR s.course_id IS NOT NULL)
       GROUP BY 1, 2, 3
       ORDER BY count DESC, name ASC`,
      params
    );

    // 3. Hostels & Allocation states actually present in students table
    const hostelsRes = await executeQuery(
      `SELECT 
         sa.hostel_id as id,
         h.name as name,
         h.code as code,
         COUNT(DISTINCT s.id) as count,
         (sa.hostel_id IS NULL) as is_unassigned
       FROM students s
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       WHERE ${whereSql}
       GROUP BY sa.hostel_id, h.name, h.code
       ORDER BY is_unassigned DESC, count DESC, h.name ASC`,
      params
    );

    // 4. Statuses actually present in students table
    const statusesRes = await executeQuery(
      `SELECT s.hostel_status as status, COUNT(DISTINCT s.id) as count
       FROM students s
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       LEFT JOIN hostels h ON sa.hostel_id = h.id
       WHERE ${whereSql}
       GROUP BY s.hostel_status
       ORDER BY count DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        levels: levelsRes.rows.map((r: any) => ({
          value: r.level,
          label: r.level === 'UG' ? 'UG (Undergrad)' : r.level === 'PG' ? 'PG (Postgrad)' : r.level === 'PhD' ? 'Ph.D (Doctoral)' : r.level,
          count: parseInt(r.count || '0')
        })),
        courses: coursesRes.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          program_level: r.program_level,
          count: parseInt(r.count || '0')
        })),
        hostels: hostelsRes.rows.map((r: any) => ({
          id: r.id || 'unassigned',
          name: r.is_unassigned ? 'Unassigned to Bed' : r.name,
          code: r.code || '',
          isUnassigned: Boolean(r.is_unassigned),
          count: parseInt(r.count || '0')
        })),
        statuses: statusesRes.rows.map((r: any) => ({
          value: r.status,
          label: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Unknown',
          count: parseInt(r.count || '0')
        }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createDepartment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const rawName = String(req.body.name || '').trim();
    if (!rawName) {
      res.status(400).json({ success: false, error: 'Department name is required' });
      return;
    }

    // Auto-derive code if not supplied
    let code = String(req.body.code || '').trim().toUpperCase();
    if (!code) {
      const words = rawName.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        code = words.map(w => w[0]).join('').toUpperCase().slice(0, 8);
      } else {
        code = rawName.slice(0, 8).toUpperCase();
      }
    }
    code = code.replace(/[^A-Z0-9]/g, '') || 'DEPT';

    // Check if department already exists by name
    const existing = await executeQuery(
      'SELECT id, code, name FROM departments WHERE LOWER(name) = LOWER($1)',
      [rawName]
    );

    if (existing.rows.length > 0) {
      res.json({ success: true, data: existing.rows[0], message: 'Department already exists' });
      return;
    }

    // Ensure code uniqueness
    let finalCode = code;
    let counter = 1;
    while (true) {
      const checkCode = await executeQuery('SELECT 1 FROM departments WHERE code = $1', [finalCode]);
      if (checkCode.rows.length === 0) break;
      finalCode = `${code.slice(0, 5)}${counter++}`;
    }

    const deptId = `dept-${finalCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    await executeQuery(
      'INSERT INTO departments (id, code, name) VALUES ($1, $2, $3)',
      [deptId, finalCode, rawName]
    );

    res.status(201).json({
      success: true,
      data: { id: deptId, code: finalCode, name: rawName }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createCourse(req: AuthRequest, res: Response): Promise<void> {
  try {
    const rawName = String(req.body.name || '').trim();
    const departmentId = String(req.body.departmentId || req.body.department_id || '').trim();

    if (!rawName) {
      res.status(400).json({ success: false, error: 'Course name is required' });
      return;
    }

    let finalDeptId = departmentId;
    if (!finalDeptId) {
      const firstDept = await executeQuery('SELECT id FROM departments LIMIT 1');
      if (firstDept.rows.length > 0) {
        finalDeptId = firstDept.rows[0].id;
      } else {
        finalDeptId = 'dept-gen';
        await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-gen', 'GEN', 'General Studies') ON CONFLICT DO NOTHING");
      }
    }

    // Auto-derive code
    let code = String(req.body.code || '').trim().toUpperCase();
    if (!code) {
      const words = rawName.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        code = words.map(w => w[0]).join('').toUpperCase().slice(0, 10);
      } else {
        code = rawName.slice(0, 10).toUpperCase();
      }
    }
    code = code.replace(/[^A-Z0-9-]/g, '') || 'CRS';

    // Check if course already exists
    const existing = await executeQuery(
      'SELECT id, department_id, code, name, duration_years FROM courses WHERE LOWER(name) = LOWER($1)',
      [rawName]
    );

    if (existing.rows.length > 0) {
      res.json({ success: true, data: existing.rows[0], message: 'Course already exists' });
      return;
    }

    // Ensure code uniqueness
    let finalCode = code;
    let counter = 1;
    while (true) {
      const checkCode = await executeQuery('SELECT 1 FROM courses WHERE code = $1', [finalCode]);
      if (checkCode.rows.length === 0) break;
      finalCode = `${code.slice(0, 6)}${counter++}`;
    }

    const durationYears = parseInt(String(req.body.durationYears || req.body.duration_years || '4')) || 4;
    const courseId = `course-${finalCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

    await executeQuery(
      'INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ($1, $2, $3, $4, $5)',
      [courseId, finalDeptId, finalCode, rawName, durationYears]
    );

    res.status(201).json({
      success: true,
      data: { id: courseId, department_id: finalDeptId, code: finalCode, name: rawName, duration_years: durationYears }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function computeRegistrationNumber(params: {
  year?: number | string;
  hostelId?: string;
  courseId?: string;
  departmentId?: string;
  gender?: string;
}): Promise<string> {
  const currentYear = params.year ? parseInt(String(params.year), 10) : new Date().getFullYear();
  const validYear = isNaN(currentYear) || currentYear < 2000 ? new Date().getFullYear() : currentYear;

  // 1. Resolve hostel short name (e.g. BH-1 -> BH1, GH-1 -> GH1)
  let hostelShort = '';
  if (params.hostelId) {
    const hRes = await executeQuery('SELECT id, code, name FROM hostels WHERE id = $1', [params.hostelId]);
    if (hRes.rows.length > 0) {
      const h = hRes.rows[0];
      hostelShort = (h.code || h.name).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }
  }
  if (!hostelShort) {
    hostelShort = params.gender === 'female' ? 'GH1' : 'BH1';
  }

  // 2. Resolve course short name (e.g. BTECH, MTECH, MBA, MCA)
  let courseShort = '';
  if (params.courseId) {
    const cRes = await executeQuery('SELECT id, code, name FROM courses WHERE id = $1', [params.courseId]);
    if (cRes.rows.length > 0) {
      const c = cRes.rows[0];
      courseShort = (c.code || c.name).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }
  }
  if (!courseShort) {
    courseShort = 'BTECH';
  }

  // 3. Resolve department short name (e.g. CSE, ECE, MECH, CIVIL)
  let deptShort = '';
  if (params.departmentId) {
    const dRes = await executeQuery('SELECT id, code, name FROM departments WHERE id = $1', [params.departmentId]);
    if (dRes.rows.length > 0) {
      const d = dRes.rows[0];
      deptShort = (d.code || d.name).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }
  }
  if (!deptShort) {
    deptShort = 'CSE';
  }

  // 4. Prefix pattern: AKNU/<year>/<hostel short name>/<Course short name>/<Department short name>/
  const prefix = `AKNU/${validYear}/${hostelShort}/${courseShort}/${deptShort}/`;

  // 5. Query max serial number specifically for this Course and Department.
  // Each course and department has its own 4-digit serial sequence starting from 0001 up to 9999.
  // It does NOT continue from other departments.
  const matchRes = await executeQuery(
    `SELECT reg_number FROM students 
     WHERE reg_number LIKE $1 OR reg_number LIKE $2`,
    [
      `AKNU/${validYear}/%/${courseShort}/${deptShort}/%`,
      `${prefix}%`
    ]
  );

  let maxSerial = 0;
  for (const row of matchRes.rows) {
    const parts = String(row.reg_number || '').split('/');
    const lastPart = parts[parts.length - 1];
    const n = parseInt(lastPart, 10);
    if (!isNaN(n) && n > maxSerial) {
      maxSerial = n;
    }
  }

  // 4-digit serial starting from 0001 up to 9999
  const nextSerial = (maxSerial + 1).toString().padStart(4, '0');
  return `${prefix}${nextSerial}`;
}

export async function generateRegistrationNumberHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { year, hostelId, courseId, departmentId, gender } = req.query;
    const regNumber = await computeRegistrationNumber({
      year: year as string,
      hostelId: hostelId as string,
      courseId: courseId as string,
      departmentId: departmentId as string,
      gender: gender as string
    });

    res.json({
      success: true,
      data: { regNumber }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createStudent(req: AuthRequest, res: Response): Promise<void> {
  const {
    rollNumber, regNumber, fullName, photoUrl, gender, dob,
    departmentId, courseId, programLevel, academicYearId, currentSemester, yearOfStudy,
    phone, email, permanentAddress, guardianName, guardianPhone,
    emergencyContact, hostelId, roomId, bedId, messEligibility,
    mealEligibilityStart, mealEligibilityEnd, notes,
    // Admission Fee Fields
    admissionFeeStatus, admissionFeeTotal, admissionFeePaid,
    admissionFeePaymentDate, admissionFeeReceiptNo, admissionFeePaymentMode
  } = req.body;

  if (!rollNumber || !fullName || !phone || !email || !gender) {
    res.status(400).json({ success: false, error: 'Missing mandatory fields (roll, name, phone, email, gender)' });
    return;
  }

  // RBAC: Wing boundary restriction
  const isSuperAdmin = req.user?.role === 'super_admin';
  const staffWing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
    ? req.user.assignedCategory
    : null;
  const staffGender = staffWing === 'girls' ? 'female' : (staffWing === 'boys' ? 'male' : null);

  if (staffWing && staffGender && gender !== staffGender) {
    res.status(403).json({
      success: false,
      error: `Access Denied: ${staffWing.toUpperCase()} wing staff can only register ${staffGender} students.`
    });
    return;
  }

  let resolvedProgramLevel = programLevel;
  if (!resolvedProgramLevel && courseId) {
    const cRes = await executeQuery('SELECT program_level FROM courses WHERE id = $1', [courseId]);
    if (cRes.rowCount && cRes.rows[0].program_level) {
      resolvedProgramLevel = cRes.rows[0].program_level;
    }
  }
  if (!resolvedProgramLevel) resolvedProgramLevel = 'UG';

  const computedYear = yearOfStudy ? parseInt(String(yearOfStudy)) : (currentSemester ? Math.ceil(parseInt(String(currentSemester)) / 2) : 1);

  try {
    // Auto-generate or validate registration number
    let finalRegNumber = regNumber ? String(regNumber).trim().toUpperCase() : '';
    if (!finalRegNumber || finalRegNumber.startsWith('AUTO')) {
      finalRegNumber = await computeRegistrationNumber({
        hostelId,
        courseId,
        departmentId,
        gender
      });
    } else {
      const dupCheck = await executeQuery('SELECT 1 FROM students WHERE reg_number = $1', [finalRegNumber]);
      if (dupCheck.rows.length > 0) {
        finalRegNumber = await computeRegistrationNumber({
          hostelId,
          courseId,
          departmentId,
          gender
        });
      }
    }

    const studentId = uuidv4();
    const studentIdCode = `AKNU-STU-${Date.now().toString().slice(-6)}`;
    const salt = generateQrSalt();
    const qrToken = signStudentQrToken(studentId, finalRegNumber, salt);
    const userId = uuidv4();
    const defaultPasswordHash = await bcrypt.hash('Aknu@2026!', 10);

    // Compute fee details
    const feeTotal = parseFloat(String(admissionFeeTotal || 0)) || 0;
    const feePaid = parseFloat(String(admissionFeePaid || 0)) || 0;
    const feePending = Math.max(0, feeTotal - feePaid);
    let resolvedFeeStatus = admissionFeeStatus;
    if (!resolvedFeeStatus) {
      if (feePaid >= feeTotal && feeTotal > 0) resolvedFeeStatus = 'paid';
      else if (feePaid > 0) resolvedFeeStatus = 'partial';
      else resolvedFeeStatus = 'unpaid';
    }
    const feePaymentDate = admissionFeePaymentDate || (feePaid > 0 ? new Date().toISOString().split('T')[0] : null);
    const feePaymentMode = admissionFeePaymentMode || 'upi';
    const feeReceiptNo = admissionFeeReceiptNo ? String(admissionFeeReceiptNo).trim() : null;

    await executeTransaction(async (query) => {
      // 1. Create linked student user account
      await query(
        `INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active, is_first_login)
         VALUES ($1, $2, $3, $4, $5, 'student', true, true)`,
        [userId, email.trim(), defaultPasswordHash, fullName.trim(), phone.trim()]
      );

      // 2. Insert student record
      await query(
        `INSERT INTO students (
          id, student_id_code, roll_number, reg_number, full_name, photo_url, gender, dob,
          department_id, course_id, program_level, academic_year_id, year_of_study, current_semester, phone, email,
          permanent_address, guardian_name, guardian_phone, emergency_contact, hostel_status,
          mess_eligibility, meal_eligibility_start, meal_eligibility_end,
          qr_credential_token, qr_salt, qr_status, user_id, notes,
          admission_fee_status, admission_fee_total, admission_fee_paid, admission_fee_pending,
          admission_fee_payment_date, admission_fee_receipt_no, admission_fee_payment_mode
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, 'active', $21, $22, $23, $24, $25, 'active', $26, $27,
          $28, $29, $30, $31, $32, $33, $34
        )`,
        [
          studentId, studentIdCode, rollNumber.trim().toUpperCase(), finalRegNumber,
          fullName.trim(), photoUrl || null, gender, dob || null,
          departmentId || null, courseId || null, resolvedProgramLevel, academicYearId || null, computedYear || 1, currentSemester || 1,
          phone.trim(), email.trim(), permanentAddress || null, guardianName || null, guardianPhone || null,
          emergencyContact || null, messEligibility !== false, mealEligibilityStart || null, mealEligibilityEnd || null,
          qrToken, salt, userId, notes || null,
          resolvedFeeStatus, feeTotal, feePaid, feePending,
          feePaymentDate, feeReceiptNo, feePaymentMode
        ]
      );

      // 3. Bed allocation if provided
      if (hostelId && roomId && bedId) {
        const allocId = uuidv4();
        await query(
          `INSERT INTO student_allocations (id, student_id, hostel_id, room_id, bed_id, academic_year_id, check_in_date, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'active', $7)`,
          [allocId, studentId, hostelId, roomId, bedId, academicYearId || null, req.user?.id || null]
        );
        await query(`UPDATE beds SET status = 'occupied' WHERE id = $1`, [bedId]);
        await query(`UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = $1`, [roomId]);
      }
    });

    await logAudit(req.user?.id, 'CREATE_STUDENT', 'student', studentId, { rollNumber, fullName }, req);

    res.status(201).json({
      success: true,
      message: 'Student registered successfully for hostel residence & biometric verification',
      data: { id: studentId, studentIdCode, rollNumber, qrToken }
    });
  } catch (err: any) {
    if (err.message?.includes('unique') || err.message?.includes('duplicate key')) {
      res.status(409).json({ success: false, error: 'Student with this Roll Number, Reg Number, or Email already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function regenerateStudentQr(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const studentRes = await executeQuery('SELECT id, reg_number FROM students WHERE id = $1', [id]);
    if (studentRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    const student = studentRes.rows[0];
    const newSalt = generateQrSalt();
    const newQrToken = signStudentQrToken(student.id, student.reg_number, newSalt);

    await executeQuery(
      `UPDATE students
       SET qr_credential_token = $1, qr_salt = $2, qr_status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newQrToken, newSalt, student.id]
    );

    const qrDataUri = await generateQrDataUri(newQrToken);
    await logAudit(req.user?.id, 'REGENERATE_QR', 'student', student.id, null, req);

    res.json({
      success: true,
      message: 'Biometric verification credential successfully synchronized.',
      data: {
        qrToken: newQrToken,
        qrDataUri
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function bulkImportStudents(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, error: 'No spreadsheet file uploaded (.xlsx or .csv required)' });
    return;
  }

  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawRows.length === 0) {
      res.status(400).json({ success: false, error: 'The uploaded file contains no data rows.' });
      return;
    }

    const validRows: any[] = [];
    const failedRows: any[] = [];

    // Fetch existing roll numbers and emails to avoid collision
    const existingRolls = new Set(
      (await executeQuery('SELECT roll_number FROM students')).rows.map((r: any) => r.roll_number.toUpperCase())
    );
    const existingEmails = new Set(
      (await executeQuery('SELECT email FROM users')).rows.map((r: any) => r.email.toLowerCase())
    );

    // Pre-load departments, courses, and academic years for intelligent mapping
    const departmentsRes = await executeQuery('SELECT id, code, name FROM departments');
    const coursesRes = await executeQuery('SELECT id, department_id, code, name, duration_years, program_level FROM courses');
    const academicYearsRes = await executeQuery('SELECT id, name, is_current FROM academic_years');
    const defaultAcademicYearId = academicYearsRes.rows.find((ay: any) => ay.is_current)?.id || academicYearsRes.rows[0]?.id || null;

    const deptMap = new Map<string, string>();
    departmentsRes.rows.forEach((d: any) => {
      deptMap.set(d.id.toLowerCase(), d.id);
      deptMap.set(d.code.toLowerCase(), d.id);
      deptMap.set(d.name.toLowerCase(), d.id);
    });

    const courseMap = new Map<string, { id: string; department_id: string; program_level: string }>();
    coursesRes.rows.forEach((c: any) => {
      courseMap.set(c.id.toLowerCase(), { id: c.id, department_id: c.department_id, program_level: c.program_level || 'UG' });
      courseMap.set(c.code.toLowerCase(), { id: c.id, department_id: c.department_id, program_level: c.program_level || 'UG' });
      courseMap.set(c.name.toLowerCase(), { id: c.id, department_id: c.department_id, program_level: c.program_level || 'UG' });
    });

    // RBAC: Wing boundary restriction for bulk import
    const isSuperAdmin = req.user?.role === 'super_admin';
    const staffWing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;
    const staffGender = staffWing === 'girls' ? 'female' : (staffWing === 'boys' ? 'male' : null);

    const defaultPasswordHash = await bcrypt.hash('Aknu@2026!', 10);

    // Flexible row header value accessor
    const getRowVal = (rowObj: any, ...aliases: string[]): string => {
      for (const alias of aliases) {
        if (rowObj[alias] !== undefined && rowObj[alias] !== null) {
          const val = String(rowObj[alias]).trim();
          if (val) return val;
        }
      }
      const objKeys = Object.keys(rowObj);
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const k of objKeys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanK === cleanAlias && rowObj[k] !== undefined && rowObj[k] !== null) {
            const val = String(rowObj[k]).trim();
            if (val) return val;
          }
        }
      }
      return '';
    };

    // Dictionary normalization helpers
    const normalizeDegree = (raw: string) => {
      const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.includes('btech') || clean === 'ug' || clean.includes('bacheloroftechnology')) {
        return { code: 'BTECH', name: 'B.Tech', duration: 4, programLevel: 'UG' as const };
      }
      if (clean.includes('bpharm') || clean.includes('bachelorofpharmacy')) {
        return { code: 'BPHARM', name: 'B.Pharmacy', duration: 4, programLevel: 'UG' as const };
      }
      if (clean.includes('bed') || clean.includes('bachelorofeducation')) {
        return { code: 'BED', name: 'B.Ed', duration: 2, programLevel: 'UG' as const };
      }
      if (clean.includes('mtech') || clean.includes('masteroftechnology')) {
        return { code: 'MTECH', name: 'M.Tech', duration: 2, programLevel: 'PG' as const };
      }
      if (clean.includes('mca') || clean.includes('masterofcomputerapplications')) {
        return { code: 'MCA', name: 'MCA', duration: 2, programLevel: 'PG' as const };
      }
      if (clean.includes('mba') || clean.includes('managementstudies') || clean.includes('businessadmin')) {
        return { code: 'MBA', name: 'MBA', duration: 2, programLevel: 'PG' as const };
      }
      if (clean.includes('bsc') || clean.includes('bachelorofscience')) {
        return { code: 'BSC', name: 'B.Sc', duration: 3, programLevel: 'UG' as const };
      }
      if (clean.includes('msc') || clean.includes('masterofscience')) {
        return { code: 'MSC', name: 'M.Sc', duration: 2, programLevel: 'PG' as const };
      }
      if (clean.includes('bcom') || clean.includes('bachelorofcommerce')) {
        return { code: 'BCOM', name: 'B.Com', duration: 3, programLevel: 'UG' as const };
      }
      if (clean.includes('mcom') || clean.includes('masterofcommerce')) {
        return { code: 'MCOM', name: 'M.Com', duration: 2, programLevel: 'PG' as const };
      }
      if (clean.includes('ba') || clean.includes('bachelorofarts')) {
        return { code: 'BA', name: 'B.A', duration: 3, programLevel: 'UG' as const };
      }
      if (clean.includes('ma') || clean.includes('masterofarts')) {
        return { code: 'MA', name: 'M.A', duration: 2, programLevel: 'PG' as const };
      }
      if (clean.includes('mpharm') || clean.includes('masterofpharmacy')) {
        return { code: 'MPHARM', name: 'M.Pharmacy', duration: 2, programLevel: 'PG' as const };
      }
      if (clean.includes('phd') || clean.includes('doctor') || clean.includes('research')) {
        return { code: 'PHD', name: 'Ph.D', duration: 3, programLevel: 'PhD' as const };
      }
      return { code: raw.toUpperCase().slice(0, 10) || 'BTECH', name: raw || 'B.Tech', duration: 4, programLevel: 'UG' as const };
    };

    const normalizeBranch = (raw: string) => {
      const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean === 'civil' || clean === 'ce' || clean.includes('civil')) {
        return { deptId: 'dept-civil', code: 'CIVIL', name: 'Civil Engineering', key: 'civil' };
      }
      if (clean === 'cse' || clean === 'cs' || clean.includes('computerscience') || clean.includes('computer')) {
        return { deptId: 'dept-cse', code: 'CSE', name: 'Computer Science & Engineering', key: 'cse' };
      }
      if (clean === 'ece' || clean === 'ec' || clean.includes('electronic') || clean.includes('telecom')) {
        return { deptId: 'dept-ece', code: 'ECE', name: 'Electronics & Communication Engineering', key: 'ece' };
      }
      if (clean === 'mech' || clean === 'me' || clean.includes('mechanical')) {
        return { deptId: 'dept-mech', code: 'MECH', name: 'Mechanical Engineering', key: 'mech' };
      }
      if (clean === 'eee' || clean === 'ee' || clean.includes('electrical')) {
        return { deptId: 'dept-eee', code: 'EEE', name: 'Electrical & Electronics Engineering', key: 'eee' };
      }
      if (clean === 'it' || clean.includes('infotech') || clean.includes('informationtech')) {
        return { deptId: 'dept-it', code: 'IT', name: 'Information Technology', key: 'it' };
      }
      if (clean.includes('aids') || clean.includes('ai') || clean.includes('datascience') || clean.includes('artificial')) {
        return { deptId: 'dept-aids', code: 'AI-DS', name: 'Artificial Intelligence & Data Science', key: 'aids' };
      }
      if (clean === 'mca' || clean.includes('computerapplication')) {
        return { deptId: 'dept-mca', code: 'MCA', name: 'Master of Computer Applications', key: 'mca' };
      }
      if (clean === 'mba' || clean.includes('management') || clean.includes('business')) {
        return { deptId: 'dept-mba', code: 'MBA', name: 'Department of Management Studies', key: 'mba' };
      }
      if (clean.includes('chem') || clean.includes('chemistry')) {
        return { deptId: 'dept-chem', code: 'CHEM', name: 'Chemistry', key: 'chem' };
      }
      if (clean.includes('phys') || clean.includes('physics')) {
        return { deptId: 'dept-phys', code: 'PHYS', name: 'Physics', key: 'phys' };
      }
      if (clean.includes('math') || clean.includes('mathematics')) {
        return { deptId: 'dept-math', code: 'MATH', name: 'Mathematics', key: 'math' };
      }
      if (clean.includes('bio') || clean.includes('biotech')) {
        return { deptId: 'dept-biotech', code: 'BIOTECH', name: 'Biotechnology', key: 'biotech' };
      }
      if (clean.includes('pharm')) {
        return { deptId: 'dept-pharm', code: 'PHARM', name: 'Pharmaceutical Sciences', key: 'pharm' };
      }
      if (clean.includes('comm') || clean.includes('commerce') || clean.includes('account')) {
        return { deptId: 'dept-comm', code: 'COMM', name: 'Commerce & Accountancy', key: 'comm' };
      }
      if (clean.includes('eng') || clean.includes('humanities')) {
        return { deptId: 'dept-eng', code: 'ENG', name: 'English & Humanities', key: 'eng' };
      }
      if (clean.includes('econ')) {
        return { deptId: 'dept-econ', code: 'ECON', name: 'Economics', key: 'econ' };
      }
      return null;
    };

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNumber = index + 2; // spreadsheet 1-indexed header is row 1

      const rollNumber = getRowVal(row, 'Roll Number', 'roll_number', 'RollNo', 'Roll No', 'Roll', 'HTNO', 'HallTicket').toUpperCase();
      let regNumber = getRowVal(row, 'Registration Number', 'reg_number', 'RegNo', 'Reg No', 'RegistrationNo').toUpperCase();
      if (regNumber) {
        const parts = regNumber.split('/');
        if (parts.length >= 6) {
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum)) {
            parts[parts.length - 1] = lastNum.toString().padStart(4, '0');
            regNumber = parts.join('/');
          }
        }
      }
      const fullName = getRowVal(row, 'Full Name', 'full_name', 'Name', 'Student Name', 'Candidate Name');
      let email = getRowVal(row, 'Email', 'email', 'E-mail', 'Email Address', 'Mail').toLowerCase();
      const phone = getRowVal(row, 'Phone', 'phone', 'Mobile', 'Mobile Number', 'Contact');
      
      const rawGender = getRowVal(row, 'Gender', 'gender', 'Sex', 'sex').toLowerCase();
      const gender: 'male' | 'female' = (rawGender.startsWith('f') || rawGender.includes('girl') || rawGender.includes('women')) ? 'female' : 'male';

      // Read Program Level, Course, Degree, Branch, Department, Year, Semester, Permanent Address
      const rawProgramLevel = getRowVal(row, 'Program Level', 'ProgramLevel', 'Level', 'program_level', 'Program Type', 'Degree Level', 'UG/PG', 'UG_PG');
      const rawDegree = getRowVal(row, 'Degree', 'degree', 'Program', 'program', 'Course', 'course', 'Course Name', 'Course Code', 'course_id');
      const rawBranch = getRowVal(row, 'Branch', 'branch', 'Specialization', 'specialization', 'Department', 'department', 'Dept', 'dept', 'Department Name', 'department_id');
      const rawYear = getRowVal(row, 'Year', 'year', 'Year of Study', 'YearOfStudy', 'Academic Year', 'Class');
      const rawSemester = getRowVal(row, 'Semester', 'semester', 'Sem', 'Current Semester');
      const rawAddress = getRowVal(row, 'Permanent Address', 'permanent_address', 'Address', 'address', 'PermanentAddress', 'City', 'Native');

      if (!rollNumber) {
        failedRows.push({ rowNumber, rollNumber, reason: 'Missing Roll Number' });
        continue;
      }
      if (!fullName) {
        failedRows.push({ rowNumber, rollNumber, reason: 'Missing Full Name' });
        continue;
      }

      // RBAC Wing Boundary Restriction: Prevent Boys' staff from uploading Girls or Girls' staff uploading Boys
      if (staffWing && staffGender && gender !== staffGender) {
        failedRows.push({
          rowNumber,
          rollNumber,
          reason: `Access Denied: ${staffWing.toUpperCase()} wing staff can only upload ${staffGender} students (row gender: ${gender})`
        });
        continue;
      }

      // Auto-generate standard AKNU email if blank
      if (!email) {
        email = `${rollNumber.toLowerCase()}@aknu.edu.in`;
      } else if (!email.includes('@')) {
        failedRows.push({ rowNumber, rollNumber, reason: `Invalid email address format: "${email}"` });
        continue;
      }

      if (existingRolls.has(rollNumber)) {
        failedRows.push({ rowNumber, rollNumber, reason: `Duplicate Roll Number: ${rollNumber} already exists in university records` });
        continue;
      }
      if (existingEmails.has(email)) {
        failedRows.push({ rowNumber, rollNumber, reason: `Duplicate Email: ${email} already registered` });
        continue;
      }

      existingRolls.add(rollNumber);
      existingEmails.add(email);

      // Intelligent Program Level, Degree & Branch Resolution
      const normDeg = normalizeDegree(rawDegree || rawBranch || 'B.Tech');
      const normBranch = normalizeBranch(rawBranch || rawDegree || 'CSE');

      let resolvedProgramLevel: 'UG' | 'PG' | 'PhD' = normDeg.programLevel || 'UG';
      if (rawProgramLevel) {
        const cleanPl = rawProgramLevel.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanPl.includes('phd') || cleanPl.includes('doctor') || cleanPl.includes('research')) {
          resolvedProgramLevel = 'PhD';
        } else if (cleanPl.includes('pg') || cleanPl.includes('post')) {
          resolvedProgramLevel = 'PG';
        } else if (cleanPl.includes('ug') || cleanPl.includes('under')) {
          resolvedProgramLevel = 'UG';
        }
      }

      let matchedDeptId: string | null = null;
      let matchedCourseId: string | null = null;

      if (normBranch && deptMap.has(normBranch.deptId.toLowerCase())) {
        matchedDeptId = deptMap.get(normBranch.deptId.toLowerCase())!;
      } else if (rawBranch && deptMap.has(rawBranch.toLowerCase())) {
        matchedDeptId = deptMap.get(rawBranch.toLowerCase())!;
      }

      // Match distinct degree course (crs-btech, crs-mtech, crs-mca, crs-mba, crs-bsc, crs-phd, etc.)
      const degreeCourseId = `crs-${normDeg.code.toLowerCase()}`;
      if (courseMap.has(degreeCourseId.toLowerCase())) {
        matchedCourseId = courseMap.get(degreeCourseId.toLowerCase())!.id;
      } else if (courseMap.has(normDeg.code.toLowerCase())) {
        matchedCourseId = courseMap.get(normDeg.code.toLowerCase())!.id;
      } else if (rawDegree && courseMap.has(rawDegree.toLowerCase())) {
        matchedCourseId = courseMap.get(rawDegree.toLowerCase())!.id;
      }

      // If department is still not resolved, resolve from matched course or create dynamic
      if (!matchedDeptId && matchedCourseId) {
        const cObj = coursesRes.rows.find((c: any) => c.id === matchedCourseId);
        if (cObj) matchedDeptId = cObj.department_id;
      }

      if (!matchedDeptId && rawBranch) {
        const words = rawBranch.split(/\s+/).filter(Boolean);
        const genCode = (words.length > 1 ? words.map((w: string) => w[0]).join('') : rawBranch.slice(0, 6)).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEPT';
        const newDeptId = `dept-${genCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
        await executeQuery('INSERT INTO departments (id, code, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [newDeptId, genCode, rawBranch]);
        matchedDeptId = newDeptId;
        deptMap.set(rawBranch.toLowerCase(), newDeptId);
        deptMap.set(genCode.toLowerCase(), newDeptId);
      } else if (!matchedDeptId && departmentsRes.rows.length > 0) {
        matchedDeptId = departmentsRes.rows[0].id;
      }

      if (!matchedCourseId && rawDegree && matchedDeptId) {
        const words = rawDegree.split(/\s+/).filter(Boolean);
        const genCode = (words.length > 1 ? words.map((w: string) => w[0]).join('') : rawDegree.slice(0, 8)).toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'CRS';
        const newCourseId = `crs-${genCode.toLowerCase()}`;
        await executeQuery(
          'INSERT INTO courses (id, department_id, code, name, duration_years, program_level) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
          [newCourseId, matchedDeptId, genCode, rawDegree, normDeg.duration, resolvedProgramLevel]
        );
        const matchedCourse = { id: newCourseId, department_id: matchedDeptId, program_level: resolvedProgramLevel };
        courseMap.set(rawDegree.toLowerCase(), matchedCourse);
        courseMap.set(genCode.toLowerCase(), matchedCourse);
        matchedCourseId = newCourseId;
      }

      if (!matchedCourseId) {
        matchedCourseId = coursesRes.rows.find((c: any) => c.department_id === matchedDeptId)?.id || coursesRes.rows[0]?.id || null;
      }

      if (!regNumber) {
        regNumber = await computeRegistrationNumber({
          courseId: matchedCourseId || undefined,
          departmentId: matchedDeptId || undefined,
          gender
        });
      }

      // Year of study parsing (handles "1", "1st year", "First Year", "Final year", "IV", etc.)
      let year = 0;
      const yearStr = rawYear.toLowerCase().trim();
      if (yearStr === 'i' || yearStr.startsWith('1') || yearStr.includes('first')) year = 1;
      else if (yearStr === 'ii' || yearStr.startsWith('2') || yearStr.includes('second')) year = 2;
      else if (yearStr === 'iii' || yearStr.startsWith('3') || yearStr.includes('third')) year = 3;
      else if (yearStr === 'iv' || yearStr.startsWith('4') || yearStr.includes('fourth') || yearStr.includes('final')) year = 4;
      else if (yearStr.startsWith('5')) year = 5;
      else {
        const digits = parseInt(yearStr.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(digits) && digits > 0) year = digits;
      }

      let semester = parseInt(rawSemester.replace(/[^0-9]/g, ''), 10) || 0;

      if (!year && semester) {
        year = Math.ceil(semester / 2);
      } else if (year && !semester) {
        semester = Math.max(1, year * 2 - 1);
      } else if (!year && !semester) {
        year = 1;
        semester = 1;
      }

      // Cap year and semester to degree duration
      const maxDuration = normDeg.duration || 4;
      if (year > maxDuration) {
        year = maxDuration;
      }
      if (semester > maxDuration * 2) {
        semester = maxDuration * 2;
      }

      validRows.push({
        rollNumber,
        regNumber,
        fullName,
        email,
        phone: phone || '0000000000',
        gender,
        programLevel: resolvedProgramLevel,
        departmentId: matchedDeptId,
        courseId: matchedCourseId,
        academicYearId: defaultAcademicYearId,
        yearOfStudy: year,
        currentSemester: semester,
        permanentAddress: rawAddress || null,
        guardianName: getRowVal(row, 'Guardian Name', 'guardian_name', 'Father Name', 'Parent Name') || null,
        guardianPhone: getRowVal(row, 'Guardian Phone', 'guardian_phone', 'Parent Phone', 'Father Mobile') || null,
        admissionFeeStatus: getRowVal(row, 'Admission Fee Status', 'Fee Status', 'FeeStatus', 'Admission Status') || 'unpaid',
        admissionFeeTotal: parseFloat(getRowVal(row, 'Total Admission Fee', 'Hostel Fee', 'Total Fee', 'TotalFee')) || 0,
        admissionFeePaid: parseFloat(getRowVal(row, 'Fee Paid', 'Paid Amount', 'Amount Paid', 'FeePaid', 'PaidAmount')) || 0,
        admissionFeePaymentDate: getRowVal(row, 'Payment Date', 'Paid Date', 'Fee Date', 'PaymentDate') || null,
        admissionFeeReceiptNo: getRowVal(row, 'Receipt Number', 'Receipt No', 'Challan Number', 'ReceiptNo') || null,
        admissionFeePaymentMode: getRowVal(row, 'Payment Mode', 'Mode', 'PaymentMode') || 'upi'
      });
    }

    // Insert valid rows in batch transaction
    let importedCount = 0;
    if (validRows.length > 0) {
      await executeTransaction(async (query) => {
        for (const item of validRows) {
          const studentId = uuidv4();
          const userId = uuidv4();
          const studentIdCode = `AKNU-STU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
          const salt = generateQrSalt();
          const qrToken = signStudentQrToken(studentId, item.regNumber, salt);

          const feeTotal = item.admissionFeeTotal || 0;
          const feePaid = item.admissionFeePaid || 0;
          const feePending = Math.max(0, feeTotal - feePaid);
          let feeStatus = item.admissionFeeStatus;
          if (!feeStatus || feeStatus === 'unpaid') {
            if (feePaid >= feeTotal && feeTotal > 0) feeStatus = 'paid';
            else if (feePaid > 0) feeStatus = 'partial';
            else feeStatus = 'unpaid';
          }

          await query(
            `INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active, is_first_login)
             VALUES ($1, $2, $3, $4, $5, 'student', true, true)`,
            [userId, item.email, defaultPasswordHash, item.fullName, item.phone]
          );

          await query(
            `INSERT INTO students (
              id, student_id_code, roll_number, reg_number, full_name, gender,
              department_id, course_id, program_level, academic_year_id, year_of_study, current_semester,
              phone, email, permanent_address, guardian_name, guardian_phone,
              hostel_status, mess_eligibility, qr_credential_token, qr_salt, qr_status, user_id,
              admission_fee_status, admission_fee_total, admission_fee_paid, admission_fee_pending,
              admission_fee_payment_date, admission_fee_receipt_no, admission_fee_payment_mode
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17,
              'active', true, $18, $19, 'active', $20,
              $21, $22, $23, $24,
              $25, $26, $27
            )`,
            [
              studentId, studentIdCode, item.rollNumber, item.regNumber, item.fullName, item.gender,
              item.departmentId, item.courseId, item.programLevel, item.academicYearId, item.yearOfStudy, item.currentSemester,
              item.phone, item.email, item.permanentAddress, item.guardianName, item.guardianPhone,
              qrToken, salt, userId,
              feeStatus, feeTotal, feePaid, feePending,
              item.admissionFeePaymentDate || (feePaid > 0 ? new Date().toISOString().split('T')[0] : null),
              item.admissionFeeReceiptNo,
              item.admissionFeePaymentMode || 'upi'
            ]
          );
          importedCount++;
        }
      });
    }

    await logAudit(req.user?.id, 'BULK_IMPORT_STUDENTS', 'student', undefined, {
      totalRows: rawRows.length,
      importedCount,
      failedCount: failedRows.length
    }, req);

    res.json({
      success: true,
      summary: {
        totalRows: rawRows.length,
        importedCount,
        failedCount: failedRows.length
      },
      failedRows
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Bulk import failed: ' + err.message });
  }
}

export async function updateStudent(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    fullName,
    phone,
    email,
    gender,
    departmentId,
    courseId,
    programLevel,
    yearOfStudy,
    currentSemester,
    permanentAddress,
    guardianName,
    guardianPhone,
    messEligibility,
    hostelStatus,
    admissionFeeStatus,
    admissionFeeTotal,
    admissionFeePaid,
    admissionFeePaymentDate,
    admissionFeeReceiptNo,
    admissionFeePaymentMode,
    photoUrl
  } = req.body;

  try {
    const existing = await executeQuery('SELECT * FROM students WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Student record not found' });
      return;
    }

    const current = existing.rows[0];

    // RBAC: Wing check
    const isSuperAdmin = req.user?.role === 'super_admin';
    const staffWing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;
    const staffGender = staffWing === 'girls' ? 'female' : (staffWing === 'boys' ? 'male' : null);

    if (staffGender && current.gender !== staffGender) {
      res.status(403).json({ success: false, error: 'Access denied: Cannot modify student belonging to a different gender wing' });
      return;
    }

    // Resolve program level if changing course
    let resolvedProgramLevel = programLevel;
    if (!resolvedProgramLevel && courseId && courseId !== current.course_id) {
      const cRes = await executeQuery('SELECT program_level FROM courses WHERE id = $1', [courseId]);
      if (cRes.rowCount && cRes.rows[0].program_level) {
        resolvedProgramLevel = cRes.rows[0].program_level;
      }
    }

    // Check email uniqueness if changing email
    if (email && email.toLowerCase() !== (current.email || '').toLowerCase()) {
      const emailCheck = await executeQuery(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2',
        [email.trim(), current.user_id]
      );
      if (emailCheck.rowCount > 0) {
        res.status(400).json({ success: false, error: 'Email address is already in use by another user' });
        return;
      }
    }

    const feeTotal = admissionFeeTotal !== undefined ? parseFloat(String(admissionFeeTotal)) || 0 : undefined;
    const feePaid = admissionFeePaid !== undefined ? parseFloat(String(admissionFeePaid)) || 0 : undefined;
    const feePending = feeTotal !== undefined && feePaid !== undefined ? Math.max(0, feeTotal - feePaid) : undefined;

    await executeTransaction(async (query) => {
      // 1. Update students record
      await query(
        `UPDATE students SET
          full_name = COALESCE($1, full_name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          gender = COALESCE($4, gender),
          department_id = COALESCE($5, department_id),
          course_id = COALESCE($6, course_id),
          program_level = COALESCE($7, program_level),
          year_of_study = COALESCE($8, year_of_study),
          current_semester = COALESCE($9, current_semester),
          permanent_address = COALESCE($10, permanent_address),
          guardian_name = COALESCE($11, guardian_name),
          guardian_phone = COALESCE($12, guardian_phone),
          mess_eligibility = COALESCE($13, mess_eligibility),
          hostel_status = COALESCE($14, hostel_status),
          admission_fee_status = COALESCE($15, admission_fee_status),
          admission_fee_total = COALESCE($16, admission_fee_total),
          admission_fee_paid = COALESCE($17, admission_fee_paid),
          admission_fee_pending = COALESCE($18, admission_fee_pending),
          admission_fee_payment_date = COALESCE($19, admission_fee_payment_date),
          admission_fee_receipt_no = COALESCE($20, admission_fee_receipt_no),
          admission_fee_payment_mode = COALESCE($21, admission_fee_payment_mode),
          photo_url = COALESCE($22, photo_url),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $23`,
        [
          fullName ? fullName.trim() : null,
          phone ? phone.trim() : null,
          email ? email.trim().toLowerCase() : null,
          gender || null,
          departmentId || null,
          courseId || null,
          resolvedProgramLevel || null,
          yearOfStudy ? parseInt(String(yearOfStudy), 10) : null,
          currentSemester ? parseInt(String(currentSemester), 10) : null,
          permanentAddress !== undefined ? permanentAddress : null,
          guardianName !== undefined ? guardianName : null,
          guardianPhone !== undefined ? guardianPhone : null,
          typeof messEligibility === 'boolean' ? messEligibility : null,
          hostelStatus || null,
          admissionFeeStatus || null,
          feeTotal,
          feePaid,
          feePending,
          admissionFeePaymentDate || null,
          admissionFeeReceiptNo || null,
          admissionFeePaymentMode || null,
          photoUrl !== undefined ? photoUrl : null,
          id
        ]
      );

      // 2. Update associated user login record if user_id exists
      if (current.user_id) {
        await query(
          `UPDATE users SET
            full_name = COALESCE($1, full_name),
            phone = COALESCE($2, phone),
            email = COALESCE($3, email),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4`,
          [
            fullName ? fullName.trim() : null,
            phone ? phone.trim() : null,
            email ? email.trim().toLowerCase() : null,
            current.user_id
          ]
        );
      }
    });

    if (req.user) {
      await logAudit(req.user.id, 'UPDATE_STUDENT_RECORD', 'students', id, `Updated student profile for ${fullName || current.full_name}`, req);
    }

    res.json({ success: true, message: 'Student profile updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update student: ' + err.message });
  }
}

export async function deleteStudent(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const existing = await executeQuery('SELECT * FROM students WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Student record not found' });
      return;
    }

    const student = existing.rows[0];

    // RBAC: Wing boundary restriction
    const isSuperAdmin = req.user?.role === 'super_admin';
    const staffWing = (!isSuperAdmin && req.user?.assignedCategory && req.user.assignedCategory !== 'all')
      ? req.user.assignedCategory
      : null;
    const staffGender = staffWing === 'girls' ? 'female' : (staffWing === 'boys' ? 'male' : null);

    if (staffGender && student.gender !== staffGender) {
      res.status(403).json({ success: false, error: 'Access denied: Cannot delete student from another gender wing' });
      return;
    }

    await executeTransaction(async (query) => {
      // 1. Find active allocations to vacate beds & decrement room occupancy
      const activeAllocs = await query(
        `SELECT sa.id as alloc_id, sa.bed_id, b.room_id
         FROM student_allocations sa
         JOIN beds b ON sa.bed_id = b.id
         WHERE sa.student_id = $1 AND sa.status = 'active'`,
        [id]
      );

      for (const alloc of activeAllocs.rows) {
        await query(`UPDATE beds SET status = 'vacant' WHERE id = $1`, [alloc.bed_id]);
        await query(`UPDATE rooms SET current_occupancy = GREATEST(0, current_occupancy - 1) WHERE id = $1`, [alloc.room_id]);
      }

      // 2. Delete allocations
      await query(`DELETE FROM student_allocations WHERE student_id = $1`, [id]);

      // 3. Delete related transactions, leaves, complaints, fees, visitors, etc.
      await query(`DELETE FROM meal_transactions WHERE student_id = $1`, [id]);
      await query(`DELETE FROM proxy_meal_permissions WHERE target_student_id = $1 OR proxy_student_id = $1`, [id]);
      await query(`DELETE FROM leave_applications WHERE student_id = $1`, [id]);
      await query(`DELETE FROM complaints WHERE student_id = $1`, [id]);
      await query(`DELETE FROM fee_payments WHERE student_id = $1`, [id]);
      await query(`DELETE FROM student_fee_ledgers WHERE student_id = $1`, [id]);
      await query(`DELETE FROM visitors WHERE student_id = $1`, [id]);

      // 4. Delete student record
      await query(`DELETE FROM students WHERE id = $1`, [id]);

      // 5. Delete user account
      if (student.user_id) {
        await query(`DELETE FROM users WHERE id = $1`, [student.user_id]);
      }
    });

    if (req.user) {
      await logAudit(req.user.id, 'DELETE_STUDENT_RECORD', 'students', id, `Deleted student ${student.full_name} (${student.roll_number})`, req);
    }

    res.json({ success: true, message: `Student ${student.full_name} removed successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete student: ' + err.message });
  }
}

