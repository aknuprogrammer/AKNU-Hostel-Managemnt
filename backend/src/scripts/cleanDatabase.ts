import { executeQuery } from '../config/database.js';

async function clean() {
  console.log('[Clean] Cleaning database of all dummy records...');

  const tables = [
    'audit_logs',
    'announcements',
    'visitors',
    'gate_movements',
    'gate_passes',
    'leave_applications',
    'complaints',
    'meal_transaction_corrections',
    'scan_attempts',
    'meal_transactions',
    'allocation_history',
    'student_allocations',
    'students',
    'beds',
    'rooms',
    'floors',
    'blocks',
    'user_hostel_assignments',
    'hostels'
  ];

  for (const t of tables) {
    try {
      await executeQuery(`DELETE FROM ${t}`);
      console.log(`[Clean] Cleared table: ${t}`);
    } catch (e: any) {
      console.log(`[Clean] Notice on ${t}: ${e.message}`);
    }
  }

  // Clear dummy staff users, retain only super_admin
  await executeQuery("DELETE FROM users WHERE role != 'super_admin'");
  console.log('[Clean] Retained only Super Admin user.');

  // Update roles table to only contain the 5 requested roles
  const cleanRoles = [
    { id: 'super_admin', name: 'super_admin', display_name: 'Super Administrator', description: 'Full system configuration and governance' },
    { id: 'chief_warden', name: 'chief_warden', display_name: 'Chief Warden', description: 'Hostel and student oversight, late meal approvals' },
    { id: 'assistant_warden', name: 'assistant_warden', display_name: 'Assistant Warden', description: 'Hostel operations, late meal approvals, mess supervision' },
    { id: 'junior_assistant', name: 'junior_assistant', display_name: 'Junior Assistant', description: 'Student entry, room allocation, mess face recognition' },
    { id: 'student', name: 'student', display_name: 'Student', description: 'Hostel resident' }
  ];

  for (const r of cleanRoles) {
    await executeQuery(
      `INSERT INTO roles (id, name, display_name, description) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description`,
      [r.id, r.name, r.display_name, r.description]
    );
  }

  // Delete obsolete roles
  await executeQuery("DELETE FROM roles WHERE id NOT IN ('super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant', 'student')");
  console.log('[Clean] Cleaned roles to 5 core roles.');

  const u = await executeQuery('SELECT id, email, role, full_name FROM users');
  console.log('[Clean] Users remaining:', u.rows);

  const r = await executeQuery('SELECT id, display_name FROM roles');
  console.log('[Clean] Roles remaining:', r.rows);

  process.exit(0);
}

clean().catch((err) => {
  console.error('[Clean Error]', err);
  process.exit(1);
});
