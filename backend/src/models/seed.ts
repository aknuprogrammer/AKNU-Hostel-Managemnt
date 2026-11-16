import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { executeQuery } from '../config/database.js';
import { generateQrSalt, signStudentQrToken } from '../utils/qr.js';

export async function seedDatabase() {
  console.log('[Seed] Verifying AKNU database base records...');
  const passwordHash = await bcrypt.hash('Aknu@2026!', 10);

  const roleCheck = await executeQuery('SELECT COUNT(*) as count FROM roles');
  if (parseInt(roleCheck.rows[0].count) === 0) {
    console.log('[Seed] Seeding AKNU roles...');

    // 1. Roles: exactly 5 active roles
    const roles = [
      { id: 'super_admin', name: 'super_admin', display_name: 'Super Administrator', description: 'Full system configuration and governance' },
      { id: 'chief_warden', name: 'chief_warden', display_name: 'Chief Warden', description: 'Hostel and student oversight, late meal approvals' },
      { id: 'assistant_warden', name: 'assistant_warden', display_name: 'Assistant Warden', description: 'Hostel operations, late meal approvals, mess supervision' },
      { id: 'junior_assistant', name: 'junior_assistant', display_name: 'Junior Assistant', description: 'Student entry, room allocation, mess face recognition' },
      { id: 'student', name: 'student', display_name: 'Student', description: 'Hostel resident' }
    ];

    for (const r of roles) {
      await executeQuery(
        'INSERT INTO roles (id, name, display_name, description) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description',
        [r.id, r.name, r.display_name, r.description]
      );
    }
  }

  // Ensure obsolete roles are deleted
  await executeQuery("DELETE FROM roles WHERE id NOT IN ('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant', 'student')");

  // 2. Academic Departments & Courses
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-cse', 'CSE', 'Computer Science & Engineering') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-ece', 'ECE', 'Electronics & Communication Engineering') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-mech', 'MECH', 'Mechanical Engineering') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-civil', 'CIVIL', 'Civil Engineering') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-eee', 'EEE', 'Electrical & Electronics Engineering') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-it', 'IT', 'Information Technology') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-aids', 'AI-DS', 'Artificial Intelligence & Data Science') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-mba', 'MBA', 'Department of Management Studies') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-comm', 'COMM', 'Commerce & Accountancy') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-chem', 'CHEM', 'Chemistry') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-phys', 'PHYS', 'Physics') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-math', 'MATH', 'Mathematics') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-biotech', 'BIOTECH', 'Biotechnology') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-pharm', 'PHARM', 'Pharmaceutical Sciences') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-eng', 'ENG', 'English & Humanities') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");
  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-econ', 'ECON', 'Economics') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");

  await executeQuery("INSERT INTO departments (id, code, name) VALUES ('dept-mca', 'MCA', 'Master of Computer Applications') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code");

  // Remove duplicate branch-merged courses so B.Tech appears once
  await executeQuery("DELETE FROM courses WHERE id IN ('crs-btech-cse', 'crs-btech-civil', 'crs-btech-ece', 'crs-btech-mech', 'crs-btech-eee', 'crs-btech-it', 'crs-btech-aids', 'crs-mtech-cse')");

  const safeInsertCourse = async (id: string, deptId: string, code: string, name: string, duration: number, programLevel: 'UG' | 'PG' | 'PhD' = 'UG') => {
    try {
      await executeQuery(
        `INSERT INTO courses (id, department_id, code, name, duration_years, program_level)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, duration_years = EXCLUDED.duration_years, program_level = EXCLUDED.program_level`,
        [id, deptId, code, name, duration, programLevel]
      );
    } catch (e: any) {
      if (!e.message?.includes('unique') && !e.message?.includes('already exists')) {
        console.warn(`[Course Seed Notice] ${id}: ${e.message}`);
      }
    }
  };

  // UG Programmes (Undergraduate)
  await safeInsertCourse('crs-btech', 'dept-cse', 'BTECH', 'B.Tech', 4, 'UG');
  await safeInsertCourse('crs-bsc', 'dept-chem', 'BSC', 'B.Sc', 3, 'UG');
  await safeInsertCourse('crs-bcom', 'dept-comm', 'BCOM', 'B.Com', 3, 'UG');
  await safeInsertCourse('crs-ba', 'dept-eng', 'BA', 'B.A', 3, 'UG');
  await safeInsertCourse('crs-bpharm', 'dept-pharm', 'BPHARM', 'B.Pharmacy', 4, 'UG');
  await safeInsertCourse('crs-bed', 'dept-eng', 'BED', 'B.Ed', 2, 'UG');

  // PG Programmes (Postgraduate)
  await safeInsertCourse('crs-mtech', 'dept-cse', 'MTECH', 'M.Tech', 2, 'PG');
  await safeInsertCourse('crs-mca', 'dept-mca', 'MCA', 'MCA', 2, 'PG');
  await safeInsertCourse('crs-mba', 'dept-mba', 'MBA', 'MBA', 2, 'PG');
  await safeInsertCourse('crs-msc', 'dept-chem', 'MSC', 'M.Sc', 2, 'PG');
  await safeInsertCourse('crs-mcom', 'dept-comm', 'MCOM', 'M.Com', 2, 'PG');
  await safeInsertCourse('crs-ma', 'dept-eng', 'MA', 'M.A', 2, 'PG');
  await safeInsertCourse('crs-mpharm', 'dept-pharm', 'MPHARM', 'M.Pharmacy', 2, 'PG');

  // Doctoral / Research
  await safeInsertCourse('crs-phd', 'dept-cse', 'PHD', 'Ph.D', 3, 'PhD');

  await executeQuery("INSERT INTO academic_years (id, name, start_date, end_date, is_current) VALUES ('ay-2026-27', '2026-2027', '2026-07-01', '2027-06-30', true) ON CONFLICT (id) DO NOTHING");

  // Ensure gender_wing column exists on users
  await executeQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_wing VARCHAR(10) DEFAULT 'all'");

  // 3. Super Admin User Account (Campus-wide administrator)
  // ONLY Super Admin is seeded. All Wardens, Assistants, and Staff are added by Super Admin from the UI.
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, full_name, phone, role, gender_wing, is_active)
     VALUES ('usr-admin', 'admin@aknu.edu.in', $1, 'Dr. K. S. Rao (Super Admin)', '9848011221', 'super_admin', 'all', true)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role,
       gender_wing = EXCLUDED.gender_wing,
       is_active = true`,
    [passwordHash]
  );

  // 4. Meal Sessions (Daily timings schedule for dining attendance)
  const sessions = [
    { id: 'ms-breakfast', name: 'Morning Breakfast', code: 'breakfast', startTime: '07:00', endTime: '10:00', grace: 0 },
    { id: 'ms-lunch', name: 'Afternoon Lunch', code: 'lunch', startTime: '12:00', endTime: '15:00', grace: 0 },
    { id: 'ms-snacks', name: 'Evening Snacks', code: 'snacks', startTime: '16:30', endTime: '18:00', grace: 0 },
    { id: 'ms-dinner', name: 'Night Dinner', code: 'dinner', startTime: '19:00', endTime: '22:30', grace: 0 }
  ];

  for (const s of sessions) {
    await executeQuery(
      `INSERT INTO meal_sessions (id, name, code, start_time, end_time, grace_minutes, is_active, allow_correction)
       VALUES ($1, $2, $3, $4, $5, $6, true, true)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.name, s.code, s.startTime, s.endTime, s.grace]
    );
  }

  // 5. Password Reset OTPs Table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_pw_reset_user ON password_reset_otps(user_id, otp)
  `);

  // 6. Ensure meal_transactions columns and proxy_meal_permissions table
  await executeQuery(`
    ALTER TABLE meal_transactions ADD COLUMN IF NOT EXISTS proxy_student_id VARCHAR(50)
  `);
  await executeQuery(`
    ALTER TABLE meal_transactions ADD COLUMN IF NOT EXISTS proxy_approved_by VARCHAR(50)
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS proxy_meal_permissions (
      id VARCHAR(50) PRIMARY KEY,
      target_student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      proxy_student_id VARCHAR(50) REFERENCES students(id) ON DELETE CASCADE,
      meal_session_id VARCHAR(50) NOT NULL REFERENCES meal_sessions(id),
      service_date DATE NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'collected')),
      approved_by_user_id VARCHAR(50) REFERENCES users(id),
      is_collected BOOLEAN DEFAULT FALSE,
      collected_at TIMESTAMP,
      collected_by_staff_id VARCHAR(50) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_proxy_target_date ON proxy_meal_permissions(target_student_id, service_date, meal_session_id)
  `);

  // 7. Base Hostels, Floors, Rooms & Beds
  const hostelCount = await executeQuery('SELECT COUNT(*) as count FROM hostels');
  if (parseInt(hostelCount.rows[0].count) === 0) {
    console.log('[Seed] Seeding AKNU campus hostels and rooms...');
    
    // Hostels
    await executeQuery(`
      INSERT INTO hostels (id, name, code, category, campus, total_capacity, status)
      VALUES 
        ('hostel-vbh', 'Vynatheya Boys Hostel', 'VBH', 'boys', 'Main Campus, Rajahmundry', 100, 'active'),
        ('hostel-gh1', 'Godavari Bhavan', 'BH-1', 'boys', 'Main Campus, Rajahmundry', 120, 'active'),
        ('hostel-sgh', 'Saraswati Girls Hostel', 'SGH-1', 'girls', 'Main Campus, Rajahmundry', 100, 'active')
      ON CONFLICT (id) DO NOTHING
    `);

    // Blocks & Floors for VBH
    await executeQuery(`
      INSERT INTO blocks (id, hostel_id, name, code)
      VALUES ('block-vbh-a', 'hostel-vbh', 'Block A', 'A')
      ON CONFLICT (id) DO NOTHING
    `);

    await executeQuery(`
      INSERT INTO floors (id, block_id, floor_number, name)
      VALUES 
        ('floor-vbh-1', 'block-vbh-a', 1, 'First Floor'),
        ('floor-vbh-2', 'block-vbh-a', 2, 'Second Floor')
      ON CONFLICT (id) DO NOTHING
    `);

    // Rooms for VBH
    await executeQuery(`
      INSERT INTO rooms (id, floor_id, hostel_id, room_number, room_type, capacity, current_occupancy, status)
      VALUES 
        ('room-vbh-101', 'floor-vbh-1', 'hostel-vbh', '101', 'double', 2, 0, 'active'),
        ('room-vbh-102', 'floor-vbh-1', 'hostel-vbh', '102', 'double', 2, 1, 'active'),
        ('room-vbh-201', 'floor-vbh-2', 'hostel-vbh', '201', 'double', 2, 0, 'active')
      ON CONFLICT (id) DO NOTHING
    `);

    // Beds for VBH Room 102
    await executeQuery(`
      INSERT INTO beds (id, room_id, bed_number, status)
      VALUES 
        ('bed-vbh-102-1', 'room-vbh-102', 'Bed 1', 'occupied'),
        ('bed-vbh-102-2', 'room-vbh-102', 'Bed 2', 'vacant'),
        ('bed-vbh-101-1', 'room-vbh-101', 'Bed 1', 'vacant'),
        ('bed-vbh-101-2', 'room-vbh-101', 'Bed 2', 'vacant')
      ON CONFLICT (id) DO NOTHING
    `);

    // Wardens
    await executeQuery(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role, gender_wing, is_active)
      VALUES 
        ('usr-chief-warden', 'chiefwarden@aknu.edu.in', $1, 'Prof. T. V. Ramana (Chief Warden)', '9848011222', 'chief_warden', 'all', true),
        ('usr-warden-boys', 'warden@aknu.edu.in', $1, 'Dr. K. Srinivas (Warden)', '9848011223', 'assistant_warden', 'boys', true)
      ON CONFLICT (id) DO NOTHING
    `, [passwordHash]);

    await executeQuery(`
      INSERT INTO user_hostel_assignments (id, user_id, hostel_id)
      VALUES 
        ('uha-cw-vbh', 'usr-chief-warden', 'hostel-vbh'),
        ('uha-cw-gh1', 'usr-chief-warden', 'hostel-gh1'),
        ('uha-cw-sgh', 'usr-chief-warden', 'hostel-sgh'),
        ('uha-wb-vbh', 'usr-warden-boys', 'hostel-vbh'),
        ('uha-wb-gh1', 'usr-warden-boys', 'hostel-gh1')
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // 8. Resident Student N. Rajesh (25PHDCSE01) with Face Photo & Allocation
  const rajeshCheck = await executeQuery("SELECT id FROM students WHERE roll_number = '25PHDCSE01'");
  if (rajeshCheck.rowCount === 0) {
    console.log('[Seed] Seeding resident student N. Rajesh (25PHDCSE01) with registered biometric photo...');
    
    // Read photo if available
    let studentPhoto = null;
    const photoPath = path.resolve(__dirname, '../../data/extracted_rajesh_photo.txt');
    if (fs.existsSync(photoPath)) {
      studentPhoto = fs.readFileSync(photoPath, 'utf8').trim();
    }

    const studentUserId = 'usr-student-rajesh';
    const studentId = 'stu-rajesh-phd';
    const regNumber = 'AKNU/2026/BH1/PHD/CSE/0001';
    const salt = generateQrSalt();
    const qrToken = signStudentQrToken(studentId, regNumber, salt);

    // Create student User account
    await executeQuery(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role, gender_wing, is_active, is_first_login)
      VALUES ($1, 'nrajesh@aknu.edu.in', $2, 'N. Rajesh', '9848091122', 'student', 'boys', true, false)
      ON CONFLICT (id) DO UPDATE SET is_active = true, is_first_login = false
    `, [studentUserId, passwordHash]);

    // Create student profile
    await executeQuery(`
      INSERT INTO students (
        id, student_id_code, roll_number, reg_number, full_name, photo_url,
        gender, department_id, course_id, program_level, academic_year_id,
        year_of_study, current_semester, phone, email, permanent_address,
        guardian_name, guardian_phone, hostel_status, mess_eligibility,
        eligible_meal_sessions, qr_credential_token, qr_salt, qr_status,
        user_id, admission_fee_status, admission_fee_total, admission_fee_paid,
        admission_fee_payment_date, admission_fee_receipt_no, admission_fee_payment_mode
      ) VALUES (
        $1, 'STD-2026-PHD-001', '25PHDCSE01', $2, 'N. Rajesh', $3,
        'male', 'dept-cse', 'crs-phd', 'PhD', 'ay-2026-27',
        1, 1, '9848091122', 'nrajesh@aknu.edu.in', 'D.No 12-4, Danavaipeta, Rajahmundry, AP 533103',
        'N. Subba Rao', '9848091123', 'active', true,
        '["breakfast","lunch","snacks","dinner"]', $4, $5, 'active',
        $6, 'paid', 25000, 25000,
        '2026-10-20', 'UPI-2026-9921', 'upi'
      )
      ON CONFLICT (id) DO NOTHING
    `, [studentId, regNumber, studentPhoto, qrToken, salt, studentUserId]);

    // Create room allocation
    await executeQuery(`
      INSERT INTO student_allocations (
        id, student_id, hostel_id, room_id, bed_id,
        academic_year_id, check_in_date, status, created_by, notes
      ) VALUES (
        'alloc-rajesh', $1, 'hostel-vbh', 'room-vbh-102', 'bed-vbh-102-1',
        'ay-2026-27', '2026-07-01', 'active', 'usr-admin', 'Official PhD scholar allocation'
      )
      ON CONFLICT (id) DO NOTHING
    `, [studentId]);
  }

  console.log('[Seed] Database ready: Super Admin active, academic master list verified, live data preserved.');
}
