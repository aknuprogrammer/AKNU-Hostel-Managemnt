import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

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

  console.log('[Seed] Database ready: Super Admin active, academic master list verified, live data preserved.');
}
