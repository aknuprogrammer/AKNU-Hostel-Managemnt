import { executeQuery } from '../config/database.js';

async function main() {
  console.log('[Migrate] Setting up separate Boys & Girls Chief Wardens and Hostel Wardens...');

  // 1. Update Boys Chief Warden
  await executeQuery(`
    UPDATE users 
    SET email = 'chiefwarden.boys@aknu.edu.in', full_name = 'Prof. M. Ramana (Chief Warden Boys)' 
    WHERE id = 'usr-chief'
  `);

  // 2. Insert or update Girls Chief Warden
  const adminRes = await executeQuery(`SELECT password_hash FROM users WHERE id = 'usr-admin'`);
  const passwordHash = adminRes.rows[0].password_hash;

  await executeQuery(`
    INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active)
    VALUES ('usr-chief-gh', 'chiefwarden.girls@aknu.edu.in', $1, 'Prof. K. Vijaya (Chief Warden Girls)', '9848011235', 'chief_warden', true)
    ON CONFLICT (id) DO UPDATE 
    SET email = 'chiefwarden.girls@aknu.edu.in', full_name = 'Prof. K. Vijaya (Chief Warden Girls)'
  `, [passwordHash]);

  // 3. Update hostel warden full names
  await executeQuery(`UPDATE users SET full_name = 'Dr. P. Satyanarayana (Hostel Warden Boys)' WHERE id = 'usr-warden-bh'`);
  await executeQuery(`UPDATE users SET full_name = 'Dr. S. Lakshmi (Hostel Warden Girls)' WHERE id = 'usr-warden-gh'`);

  // 4. Update hostel chief wardens
  await executeQuery(`UPDATE hostels SET chief_warden_id = 'usr-chief' WHERE id IN ('hostel-bh1', 'hostel-bh2')`);
  await executeQuery(`UPDATE hostels SET chief_warden_id = 'usr-chief-gh' WHERE id IN ('hostel-gh1', 'hostel-gh2')`);

  // 5. User Hostel Assignments
  // Boys
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-cw-bh1', 'usr-chief', 'hostel-bh1') ON CONFLICT (user_id, hostel_id) DO NOTHING`);
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-cw-bh2', 'usr-chief', 'hostel-bh2') ON CONFLICT (user_id, hostel_id) DO NOTHING`);
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-hw-bh1', 'usr-warden-bh', 'hostel-bh1') ON CONFLICT (user_id, hostel_id) DO NOTHING`);
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-hw-bh2', 'usr-warden-bh', 'hostel-bh2') ON CONFLICT (user_id, hostel_id) DO NOTHING`);

  // Girls
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-cw-gh1', 'usr-chief-gh', 'hostel-gh1') ON CONFLICT (user_id, hostel_id) DO NOTHING`);
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-cw-gh2', 'usr-chief-gh', 'hostel-gh2') ON CONFLICT (user_id, hostel_id) DO NOTHING`);
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-hw-gh1', 'usr-warden-gh', 'hostel-gh1') ON CONFLICT (user_id, hostel_id) DO NOTHING`);
  await executeQuery(`INSERT INTO user_hostel_assignments (id, user_id, hostel_id) VALUES ('uha-hw-gh2', 'usr-warden-gh', 'hostel-gh2') ON CONFLICT (user_id, hostel_id) DO NOTHING`);

  console.log('[Migrate] Successfully updated database users & hostel assignments.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Migrate Error]', err);
  process.exit(1);
});
