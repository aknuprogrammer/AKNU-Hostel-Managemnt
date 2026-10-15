import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { executeQuery, executeTransaction } from '../config/database.js';
import { AuthRequest, logAudit } from '../middleware/auth.js';
import { generateQrSalt, signStudentQrToken, generateQrDataUri } from '../utils/qr.js';

export async function getStudents(req: AuthRequest, res: Response): Promise<void> {
  const { search, hostelId, departmentId, status, page = '1', limit = '10' } = req.query;
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

    if (status) {
      whereClauses.push(`s.hostel_status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    // RBAC: if not super_admin and assigned hostels exist, restrict to assigned hostels and gender
    if (req.user?.role !== 'super_admin' && req.user?.assignedHostels?.length) {
      const allowedPlaceholders = req.user.assignedHostels.map((_, i) => `$${pIdx + i}`).join(',');
      params.push(...req.user.assignedHostels);
      pIdx += req.user.assignedHostels.length;

      const gender = req.user.assignedCategory === 'girls' ? 'female' : (req.user.assignedCategory === 'boys' ? 'male' : null);
      if (gender) {
        whereClauses.push(`(sa.hostel_id IN (${allowedPlaceholders}) OR (sa.hostel_id IS NULL AND s.gender = '${gender}'))`);
      } else {
        whereClauses.push(`sa.hostel_id IN (${allowedPlaceholders})`);
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
       LEFT JOIN student_allocations sa ON s.id = sa.student_id AND sa.status = 'active'
       WHERE ${whereSql}`,
      params
    );

    const total = parseInt(countRes.rows[0]?.total || '0');
    const totalBoys = parseInt(countRes.rows[0]?.total_boys || '0');
    const totalGirls = parseInt(countRes.rows[0]?.total_girls || '0');
    const totalMessActive = parseInt(countRes.rows[0]?.total_mess_active || '0');

    const querySql = `
      SELECT s.*,
             d.name as department_name, c.name as course_name,
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
              d.name as department_name, c.name as course_name,
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
    const coursesRes = await executeQuery('SELECT id, department_id, code, name, duration_years FROM courses ORDER BY name ASC');
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
    departmentId, courseId, academicYearId, currentSemester, yearOfStudy,
    phone, email, permanentAddress, guardianName, guardianPhone,
    emergencyContact, hostelId, roomId, bedId, messEligibility,
    mealEligibilityStart, mealEligibilityEnd, notes
  } = req.body;

  if (!rollNumber || !fullName || !phone || !email || !gender) {
    res.status(400).json({ success: false, error: 'Missing mandatory fields (roll, name, phone, email, gender)' });
    return;
  }

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
          department_id, course_id, academic_year_id, year_of_study, current_semester, phone, email,
          permanent_address, guardian_name, guardian_phone, emergency_contact, hostel_status,
          mess_eligibility, meal_eligibility_start, meal_eligibility_end,
          qr_credential_token, qr_salt, qr_status, user_id, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, 'active', $20, $21, $22, $23, $24, 'active', $25, $26
        )`,
        [
          studentId, studentIdCode, rollNumber.trim().toUpperCase(), finalRegNumber,
          fullName.trim(), photoUrl || null, gender, dob || null,
          departmentId || null, courseId || null, academicYearId || null, computedYear || 1, currentSemester || 1,
          phone.trim(), email.trim(), permanentAddress || null, guardianName || null, guardianPhone || null,
          emergencyContact || null, messEligibility !== false, mealEligibilityStart || null, mealEligibilityEnd || null,
          qrToken, salt, userId, notes || null
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
      message: 'Student created successfully with unique signed QR credential',
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
      message: 'QR credential successfully regenerated. Previous QR tokens are now revoked.',
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
    const coursesRes = await executeQuery('SELECT id, department_id, code, name FROM courses');
    const academicYearsRes = await executeQuery('SELECT id, name, is_current FROM academic_years');
    const defaultAcademicYearId = academicYearsRes.rows.find((ay: any) => ay.is_current)?.id || academicYearsRes.rows[0]?.id || null;

    const deptMap = new Map<string, string>();
    departmentsRes.rows.forEach((d: any) => {
      deptMap.set(d.id.toLowerCase(), d.id);
      deptMap.set(d.code.toLowerCase(), d.id);
      deptMap.set(d.name.toLowerCase(), d.id);
    });

    const courseMap = new Map<string, { id: string; department_id: string }>();
    coursesRes.rows.forEach((c: any) => {
      courseMap.set(c.id.toLowerCase(), { id: c.id, department_id: c.department_id });
      courseMap.set(c.code.toLowerCase(), { id: c.id, department_id: c.department_id });
      courseMap.set(c.name.toLowerCase(), { id: c.id, department_id: c.department_id });
    });

    const defaultPasswordHash = await bcrypt.hash('Aknu@2026!', 10);

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNumber = index + 2; // spreadsheet 1-indexed header is row 1

      const rollNumber = String(row['Roll Number'] || row['roll_number'] || row['RollNo'] || row['Roll'] || '').trim().toUpperCase();
      let regNumber = String(row['Registration Number'] || row['reg_number'] || row['RegNo'] || row['RegistrationNo'] || '').trim().toUpperCase();
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
      const fullName = String(row['Full Name'] || row['full_name'] || row['Name'] || '').trim();
      const email = String(row['Email'] || row['email'] || '').trim().toLowerCase();
      const phone = String(row['Phone'] || row['phone'] || row['Mobile'] || '').trim();
      const gender = String(row['Gender'] || row['gender'] || 'male').trim().toLowerCase();

      // Read Course, Department, Year, Permanent Address
      const rawCourse = String(row['Course'] || row['course'] || row['Course Name'] || row['Course Code'] || row['course_id'] || '').trim();
      const rawDept = String(row['Department'] || row['department'] || row['Dept'] || row['Department Name'] || row['department_id'] || '').trim();
      const rawYear = String(row['Year'] || row['year'] || row['Year of Study'] || row['YearOfStudy'] || row['Academic Year'] || '').trim();
      const rawAddress = String(row['Permanent Address'] || row['permanent_address'] || row['Address'] || row['address'] || row['PermanentAddress'] || '').trim();

      if (!rollNumber) {
        failedRows.push({ rowNumber, rollNumber, reason: 'Missing Roll Number' });
        continue;
      }
      if (!fullName) {
        failedRows.push({ rowNumber, rollNumber, reason: 'Missing Full Name' });
        continue;
      }
      if (!email || !email.includes('@')) {
        failedRows.push({ rowNumber, rollNumber, reason: 'Invalid or missing Email address' });
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

      // Match course and department dynamically
      let matchedCourse = courseMap.get(rawCourse.toLowerCase());
      let matchedDeptId = deptMap.get(rawDept.toLowerCase()) || (matchedCourse ? matchedCourse.department_id : null);

      if (!matchedDeptId && rawDept) {
        const words = rawDept.split(/\s+/).filter(Boolean);
        const genCode = (words.length > 1 ? words.map((w: string) => w[0]).join('') : rawDept.slice(0, 6)).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEPT';
        const newDeptId = `dept-${genCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
        await executeQuery('INSERT INTO departments (id, code, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [newDeptId, genCode, rawDept]);
        matchedDeptId = newDeptId;
        deptMap.set(rawDept.toLowerCase(), newDeptId);
        deptMap.set(genCode.toLowerCase(), newDeptId);
      } else if (!matchedDeptId && departmentsRes.rows.length > 0) {
        matchedDeptId = departmentsRes.rows[0].id;
      }

      if (!matchedCourse && rawCourse && matchedDeptId) {
        const words = rawCourse.split(/\s+/).filter(Boolean);
        const genCode = (words.length > 1 ? words.map((w: string) => w[0]).join('') : rawCourse.slice(0, 8)).toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'CRS';
        const newCourseId = `course-${genCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
        await executeQuery('INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [newCourseId, matchedDeptId, genCode, rawCourse, 4]);
        matchedCourse = { id: newCourseId, department_id: matchedDeptId };
        courseMap.set(rawCourse.toLowerCase(), matchedCourse);
        courseMap.set(genCode.toLowerCase(), matchedCourse);
      }

      let matchedCourseId = matchedCourse ? matchedCourse.id : (coursesRes.rows.find((c: any) => c.department_id === matchedDeptId)?.id || coursesRes.rows[0]?.id || null);

      if (!regNumber) {
        regNumber = await computeRegistrationNumber({
          courseId: matchedCourseId || undefined,
          departmentId: matchedDeptId || undefined,
          gender
        });
      }

      let semester = parseInt(row['Semester'] || row['semester'] || '0') || 0;
      let year = parseInt(rawYear.replace(/[^0-9]/g, '')) || 0;

      if (!year && semester) {
        year = Math.ceil(semester / 2);
      } else if (year && !semester) {
        semester = Math.max(1, year * 2 - 1);
      } else if (!year && !semester) {
        year = 1;
        semester = 1;
      }

      validRows.push({
        rollNumber,
        regNumber,
        fullName,
        email,
        phone: phone || '0000000000',
        gender: ['male', 'female'].includes(gender) ? gender : 'male',
        departmentId: matchedDeptId,
        courseId: matchedCourseId,
        academicYearId: defaultAcademicYearId,
        yearOfStudy: year,
        currentSemester: semester,
        permanentAddress: rawAddress || null,
        guardianName: row['Guardian Name'] || row['guardian_name'] || null,
        guardianPhone: row['Guardian Phone'] || row['guardian_phone'] || null
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

          await query(
            `INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active, is_first_login)
             VALUES ($1, $2, $3, $4, $5, 'student', true, true)`,
            [userId, item.email, defaultPasswordHash, item.fullName, item.phone]
          );

          await query(
            `INSERT INTO students (
              id, student_id_code, roll_number, reg_number, full_name, gender,
              department_id, course_id, academic_year_id, year_of_study, current_semester,
              phone, email, permanent_address, guardian_name, guardian_phone,
              hostel_status, mess_eligibility, qr_credential_token, qr_salt, qr_status, user_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16,
              'active', true, $17, $18, 'active', $19
            )`,
            [
              studentId, studentIdCode, item.rollNumber, item.regNumber, item.fullName, item.gender,
              item.departmentId, item.courseId, item.academicYearId, item.yearOfStudy, item.currentSemester,
              item.phone, item.email, item.permanentAddress, item.guardianName, item.guardianPhone,
              qrToken, salt, userId
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
    yearOfStudy,
    currentSemester,
    permanentAddress,
    guardianName,
    guardianPhone,
    messEligibility,
    hostelStatus
  } = req.body;

  try {
    const existing = await executeQuery('SELECT * FROM students WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Student record not found' });
      return;
    }

    const current = existing.rows[0];

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
          year_of_study = COALESCE($7, year_of_study),
          current_semester = COALESCE($8, current_semester),
          permanent_address = COALESCE($9, permanent_address),
          guardian_name = COALESCE($10, guardian_name),
          guardian_phone = COALESCE($11, guardian_phone),
          mess_eligibility = COALESCE($12, mess_eligibility),
          hostel_status = COALESCE($13, hostel_status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $14`,
        [
          fullName ? fullName.trim() : null,
          phone ? phone.trim() : null,
          email ? email.trim().toLowerCase() : null,
          gender || null,
          departmentId || null,
          courseId || null,
          yearOfStudy ? parseInt(String(yearOfStudy), 10) : null,
          currentSemester ? parseInt(String(currentSemester), 10) : null,
          permanentAddress !== undefined ? permanentAddress : null,
          guardianName !== undefined ? guardianName : null,
          guardianPhone !== undefined ? guardianPhone : null,
          typeof messEligibility === 'boolean' ? messEligibility : null,
          hostelStatus || null,
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

      // 3. Delete related transactions, leaves, complaints, etc.
      await query(`DELETE FROM meal_transactions WHERE student_id = $1`, [id]);
      await query(`DELETE FROM leave_applications WHERE student_id = $1`, [id]);
      await query(`DELETE FROM complaints WHERE student_id = $1`, [id]);
      await query(`DELETE FROM student_dues WHERE student_id = $1`, [id]);

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

