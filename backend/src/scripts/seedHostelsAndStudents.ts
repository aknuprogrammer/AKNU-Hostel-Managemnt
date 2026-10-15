import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

export async function seedHostelsAndStudents() {
  console.log('[Seed] Seeding Hostels, Rooms, and Students...');

  const passwordHash = await bcrypt.hash('Aknu@2026!', 10);

  // 1. Hostels
  await executeQuery(`
    INSERT INTO hostels (id, name, code, category, campus, total_capacity, chief_warden_id, status)
    VALUES 
      ('hostel-ibh', 'International Boys Hostel', 'IBH', 'boys', 'Main Campus, Rajahmundry', 40, 'usr-chief', 'active'),
      ('hostel-gh', 'Girls Hostel', 'GH', 'girls', 'Main Campus, Rajahmundry', 32, 'usr-chief-gh', 'active')
    ON CONFLICT (id) DO NOTHING
  `);

  // 2. Warden Assignments
  await executeQuery(`
    INSERT INTO warden_hostel_assignments (id, warden_id, hostel_id, is_primary)
    VALUES 
      ('wha-1', 'usr-warden-bh', 'hostel-ibh', true),
      ('wha-2', 'usr-chief', 'hostel-ibh', false),
      ('wha-3', 'usr-warden-gh', 'hostel-gh', true),
      ('wha-4', 'usr-chief-gh', 'hostel-gh', false)
    ON CONFLICT (id) DO NOTHING
  `);

  // 3. Rooms
  await executeQuery(`
    INSERT INTO rooms (id, hostel_id, room_number, floor_number, capacity, room_type, status)
    VALUES
      ('room-ibh-101', 'hostel-ibh', '101', 1, 4, 'standard', 'available'),
      ('room-ibh-102', 'hostel-ibh', '102', 1, 4, 'standard', 'available'),
      ('room-gh-101', 'hostel-gh', '101', 1, 4, 'standard', 'available'),
      ('room-gh-102', 'hostel-gh', '102', 1, 4, 'standard', 'available')
    ON CONFLICT (id) DO NOTHING
  `);

  // 4. Beds
  await executeQuery(`
    INSERT INTO beds (id, room_id, bed_number, status)
    VALUES
      ('bed-ibh-101-1', 'room-ibh-101', 'Bed 1', 'occupied'),
      ('bed-ibh-101-2', 'room-ibh-101', 'Bed 2', 'available'),
      ('bed-gh-101-1', 'room-gh-101', 'Bed 1', 'occupied'),
      ('bed-gh-101-2', 'room-gh-101', 'Bed 2', 'available')
    ON CONFLICT (id) DO NOTHING
  `);

  // 5. Student Users
  await executeQuery(`
    INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active)
    VALUES
      ('usr-stu-saiteja', 'saiteja@aknu.edu.in', $1, 'K. Sai Teja', '9848099889', 'student', true),
      ('usr-stu-anusha', 'anusha@aknu.edu.in', $1, 'B. Anusha', '9848099890', 'student', true)
    ON CONFLICT (id) DO NOTHING
  `, [passwordHash]);

  // 6. Student Profiles
  await executeQuery(`
    INSERT INTO students (
      id, user_id, student_id_code, roll_number, reg_number, full_name, gender,
      department_id, course_id, year_of_study, current_semester, phone, email,
      permanent_address, guardian_name, guardian_phone, hostel_status, mess_eligibility,
      eligible_meal_sessions, qr_credential_token, qr_status
    ) VALUES
      (
        'stu-saiteja', 'usr-stu-saiteja', 'AKNU-STU-331115', '22CSE099', 'AKNU/2026/IBH/BTECH/CSE/0001',
        'K. Sai Teja', 'male', 'dept-cse', 'crs-btech-cse', 3, 5, '9848099889', 'saiteja@aknu.edu.in',
        'H.No 4-12, Main Road, Rajahmundry, AP 533101', 'K. Ramarao', '9848011223', 'active', true,
        '["breakfast","lunch","snacks","dinner"]', 'aknu_qr_token_22cse099_sample', 'active'
      ),
      (
        'stu-anusha', 'usr-stu-anusha', 'AKNU-STU-331116', '22ECE050', 'AKNU/2026/GH1/BTECH/ECE/0001',
        'B. Anusha', 'female', 'dept-ece', 'crs-btech-cse', 3, 5, '9848099890', 'anusha@aknu.edu.in',
        'Flat 201, River View Apts, Danavaipeta, Rajahmundry, AP 533103', 'B. Prasad', '9848011224', 'active', true,
        '["breakfast","lunch","snacks","dinner"]', 'aknu_qr_token_22ece050_sample', 'active'
      )
    ON CONFLICT (id) DO NOTHING
  `);

  // 7. Student Allocations
  await executeQuery(`
    INSERT INTO student_allocations (id, student_id, hostel_id, room_id, bed_id, academic_year_id, status)
    VALUES
      ('alloc-1', 'stu-saiteja', 'hostel-ibh', 'room-ibh-101', 'bed-ibh-101-1', 'ay-2026-27', 'active'),
      ('alloc-2', 'stu-anusha', 'hostel-gh', 'room-gh-101', 'bed-gh-101-1', 'ay-2026-27', 'active')
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('[Seed] Hostels, Rooms, and Students seeded successfully!');
}

if (process.argv[1]?.includes('seedHostelsAndStudents')) {
  seedHostelsAndStudents().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
