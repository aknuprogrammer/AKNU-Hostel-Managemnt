import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

export async function seedDatabase() {
  console.log('[Seed] Verifying AKNU database base records...');
  const passwordHash = await bcrypt.hash('Aknu@2026!', 10);

  const roleCheck = await executeQuery('SELECT COUNT(*) as count FROM roles');
  if (parseInt(roleCheck.rows[0].count) === 0) {
    console.log('[Seed] Seeding AKNU roles...');

  // 1. Roles
  const roles = [
    { id: 'super_admin', name: 'super_admin', display_name: 'Super Administrator', description: 'Full system configuration and audit access' },
    { id: 'univ_mgmt', name: 'univ_mgmt', display_name: 'University Management', description: 'Consolidated reporting and campus overview' },
    { id: 'chief_warden', name: 'chief_warden', display_name: 'Chief Warden', description: 'Oversees all university hostels and wardens' },
    { id: 'hostel_warden', name: 'hostel_warden', display_name: 'Hostel Warden', description: 'Hostel allocations, meal scanning, and leaves' },
    { id: 'mess_manager', name: 'mess_manager', display_name: 'Mess Manager', description: 'Mess menus, inventory, and wastage records' },
    { id: 'mess_staff', name: 'mess_staff', display_name: 'Mess Staff', description: 'Meal QR scanning at mess checkpoints' },
    { id: 'security_staff', name: 'security_staff', display_name: 'Security Staff', description: 'Gate pass verification and visitor registry' },
    { id: 'accounts_staff', name: 'accounts_staff', display_name: 'Accounts Staff', description: 'Hostel fee ledgers and payment receipts' },
    { id: 'maint_staff', name: 'maint_staff', display_name: 'Maintenance Staff', description: 'Work orders and repairs' },
    { id: 'student', name: 'student', display_name: 'Student', description: 'Hostel resident with self-service portal' }
  ];

  for (const r of roles) {
    await executeQuery(
      'INSERT INTO roles (id, name, display_name, description) VALUES ($1, $2, $3, $4)',
      [r.id, r.name, r.display_name, r.description]
    );
  }
  }

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

  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-btech-cse', 'dept-cse', 'BTECH', 'B.Tech', 4) ON CONFLICT (id) DO UPDATE SET name = 'B.Tech', code = 'BTECH'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-mtech-cse', 'dept-cse', 'MTECH', 'M.Tech', 2) ON CONFLICT (id) DO UPDATE SET name = 'M.Tech', code = 'MTECH'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-mba', 'dept-mba', 'MBA', 'MBA', 2) ON CONFLICT (id) DO UPDATE SET name = 'MBA', code = 'MBA'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-mca', 'dept-cse', 'MCA', 'MCA', 2) ON CONFLICT (id) DO UPDATE SET name = 'MCA', code = 'MCA'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-bsc', 'dept-cse', 'BSC', 'B.Sc', 3) ON CONFLICT (id) DO UPDATE SET name = 'B.Sc', code = 'BSC'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-msc', 'dept-cse', 'MSC', 'M.Sc', 2) ON CONFLICT (id) DO UPDATE SET name = 'M.Sc', code = 'MSC'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-bcom', 'dept-mba', 'BCOM', 'B.Com', 3) ON CONFLICT (id) DO UPDATE SET name = 'B.Com', code = 'BCOM'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-ba', 'dept-mba', 'BA', 'B.A', 3) ON CONFLICT (id) DO UPDATE SET name = 'B.A', code = 'BA'");
  await executeQuery("INSERT INTO courses (id, department_id, code, name, duration_years) VALUES ('crs-phd', 'dept-cse', 'PHD', 'Ph.D', 3) ON CONFLICT (id) DO UPDATE SET name = 'Ph.D', code = 'PHD'");

  await executeQuery("INSERT INTO academic_years (id, name, start_date, end_date, is_current) VALUES ('ay-2026-27', '2026-2027', '2026-07-01', '2027-06-30', true) ON CONFLICT (id) DO NOTHING");

  // 3. Staff Users (Only the 10 designated staff users)
  const staffUsers = [
    { id: 'usr-admin', email: 'admin@aknu.edu.in', fullName: 'Dr. K. S. Rao (Super Admin)', role: 'super_admin', phone: '9848011221' },
    { id: 'usr-mgmt', email: 'registrar@aknu.edu.in', fullName: 'Prof. V. Sharma (Registrar)', role: 'univ_mgmt', phone: '9848011222' },
    { id: 'usr-chief', email: 'chiefwarden.boys@aknu.edu.in', fullName: 'Prof. M. Ramana (Chief Warden Boys)', role: 'chief_warden', phone: '9848011223' },
    { id: 'usr-chief-gh', email: 'chiefwarden.girls@aknu.edu.in', fullName: 'Prof. K. Vijaya (Chief Warden Girls)', role: 'chief_warden', phone: '9848011235' },
    { id: 'usr-warden-bh', email: 'warden.boys@aknu.edu.in', fullName: 'Dr. P. Satyanarayana (Hostel Warden Boys)', role: 'hostel_warden', phone: '9848011224' },
    { id: 'usr-warden-gh', email: 'warden.girls@aknu.edu.in', fullName: 'Dr. S. Lakshmi (Hostel Warden Girls)', role: 'hostel_warden', phone: '9848011225' },
    { id: 'usr-mess-mgr', email: 'messmanager@aknu.edu.in', fullName: 'Mr. G. Srinivas (Mess Manager)', role: 'mess_manager', phone: '9848011226' },
    { id: 'usr-mess-staff', email: 'messstaff1@aknu.edu.in', fullName: 'Mr. B. Krishna (Mess Counter Staff)', role: 'mess_staff', phone: '9848011227' },
    { id: 'usr-accounts', email: 'accounts@aknu.edu.in', fullName: 'Mr. Ch. Venkatesh (Accounts Officer)', role: 'accounts_staff', phone: '9848011229' },
    { id: 'usr-maint', email: 'maintenance@aknu.edu.in', fullName: 'Mr. K. Appa Rao (Maintenance Sup.)', role: 'maint_staff', phone: '9848011230' }
  ];

  for (const u of staffUsers) {
    await executeQuery(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, email = EXCLUDED.email`,
      [u.id, u.email, passwordHash, u.fullName, u.phone, u.role]
    );
  }

  // 4. Meal Sessions (Daily timings schedule)
  const sessions = [
    { id: 'ms-breakfast', name: 'Morning Breakfast', code: 'breakfast', startTime: '07:00', endTime: '10:00', grace: 0 },
    { id: 'ms-lunch', name: 'Afternoon Lunch', code: 'lunch', startTime: '12:00', endTime: '15:00', grace: 0 },
    { id: 'ms-snacks', name: 'Evening Snacks (Optional)', code: 'snacks', startTime: '16:30', endTime: '18:00', grace: 0 },
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

  // 5. Hostels
  await executeQuery(`
    INSERT INTO hostels (id, name, code, category, campus, total_capacity, chief_warden_id, status)
    VALUES 
      ('hostel-ibh', 'International Boys Hostel', 'IBH', 'boys', 'Main Campus, Rajahmundry', 40, 'usr-chief', 'active'),
      ('hostel-gh', 'Girls Hostel', 'GH', 'girls', 'Main Campus, Rajahmundry', 32, 'usr-chief-gh', 'active')
    ON CONFLICT (id) DO NOTHING
  `);

  // 6. User Hostel Assignments
  await executeQuery(`
    INSERT INTO user_hostel_assignments (id, user_id, hostel_id)
    VALUES 
      ('uha-1', 'usr-warden-bh', 'hostel-ibh'),
      ('uha-2', 'usr-chief', 'hostel-ibh'),
      ('uha-3', 'usr-warden-gh', 'hostel-gh'),
      ('uha-4', 'usr-chief-gh', 'hostel-gh')
    ON CONFLICT (id) DO NOTHING
  `);

  // 7. Blocks, Floors, Rooms & Beds
  await executeQuery(`
    INSERT INTO blocks (id, hostel_id, name, code)
    VALUES
      ('blk-ibh-main', 'hostel-ibh', 'Main Block', 'MB'),
      ('blk-gh-main', 'hostel-gh', 'Main Block', 'MB')
    ON CONFLICT (id) DO NOTHING
  `);

  await executeQuery(`
    INSERT INTO floors (id, block_id, floor_number, name)
    VALUES
      ('flr-ibh-1', 'blk-ibh-main', 1, 'First Floor'),
      ('flr-gh-1', 'blk-gh-main', 1, 'First Floor')
    ON CONFLICT (id) DO NOTHING
  `);

  await executeQuery(`
    INSERT INTO rooms (id, floor_id, hostel_id, room_number, room_type, capacity, current_occupancy, status)
    VALUES
      ('room-ibh-101', 'flr-ibh-1', 'hostel-ibh', '101', 'four_share', 4, 1, 'active'),
      ('room-gh-101', 'flr-gh-1', 'hostel-gh', '101', 'four_share', 4, 1, 'active')
    ON CONFLICT (id) DO NOTHING
  `);

  await executeQuery(`
    INSERT INTO beds (id, room_id, bed_number, status)
    VALUES
      ('bed-ibh-101-1', 'room-ibh-101', 'Bed 1', 'occupied'),
      ('bed-gh-101-1', 'room-gh-101', 'Bed 1', 'occupied')
    ON CONFLICT (id) DO NOTHING
  `);

  // 8. Student Users
  await executeQuery(`
    INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active)
    VALUES
      ('usr-stu-saiteja', 'saiteja@aknu.edu.in', $1, 'K. Sai Teja', '9848099889', 'student', true),
      ('usr-stu-anusha', 'anusha@aknu.edu.in', $1, 'B. Anusha', '9848099890', 'student', true)
    ON CONFLICT (id) DO NOTHING
  `, [passwordHash]);

  // 9. Student Profiles
  await executeQuery(`
    INSERT INTO students (
      id, user_id, student_id_code, roll_number, reg_number, full_name, gender,
      department_id, course_id, year_of_study, current_semester, phone, email,
      permanent_address, guardian_name, guardian_phone, hostel_status, mess_eligibility,
      eligible_meal_sessions, qr_credential_token, qr_salt, qr_status
    ) VALUES
      (
        'stu-saiteja', 'usr-stu-saiteja', 'AKNU-STU-331115', '22CSE099', 'AKNU/2026/IBH/BTECH/CSE/0001',
        'K. Sai Teja', 'male', 'dept-cse', 'crs-btech-cse', 3, 5, '9848099889', 'saiteja@aknu.edu.in',
        'H.No 4-12, Main Road, Rajahmundry, AP 533101', 'K. Ramarao', '9848011223', 'active', true,
        '["breakfast","lunch","snacks","dinner"]', 'aknu_qr_token_22cse099_sample', 'salt_22cse099_sample', 'active'
      ),
      (
        'stu-anusha', 'usr-stu-anusha', 'AKNU-STU-331116', '22ECE050', 'AKNU/2026/GH1/BTECH/ECE/0001',
        'B. Anusha', 'female', 'dept-ece', 'crs-btech-cse', 3, 5, '9848099890', 'anusha@aknu.edu.in',
        'Flat 201, River View Apts, Danavaipeta, Rajahmundry, AP 533103', 'B. Prasad', '9848011224', 'active', true,
        '["breakfast","lunch","snacks","dinner"]', 'aknu_qr_token_22ece050_sample', 'salt_22ece050_sample', 'active'
      )
    ON CONFLICT (id) DO NOTHING
  `);

  // 10. Student Allocations
  await executeQuery(`
    INSERT INTO student_allocations (id, student_id, hostel_id, room_id, bed_id, academic_year_id, check_in_date, status)
    VALUES
      ('alloc-1', 'stu-saiteja', 'hostel-ibh', 'room-ibh-101', 'bed-ibh-101-1', 'ay-2026-27', '2026-07-01', 'active'),
      ('alloc-2', 'stu-anusha', 'hostel-gh', 'room-gh-101', 'bed-gh-101-1', 'ay-2026-27', '2026-07-01', 'active')
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('[Seed] System initialized with staff, hostels, students, and academic structure.');
}
