import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

async function seedLogins() {
  console.log('[Seed] Setting up separate logins for Boys & Girls staff...');

  // 1. Add gender_wing column to users table if not exists
  await executeQuery(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_wing VARCHAR(10) DEFAULT 'all';
  `);

  const passwordHash = await bcrypt.hash('Aknu@2026!', 10);

  // 2. Clear out any old staff users, keeping roles clean
  await executeQuery("DELETE FROM users WHERE role NOT IN ('super_admin', 'student')");

  // 3. Define the dedicated 7 logins (Super Admin + 3 Boys Staff + 3 Girls Staff)
  const staffAccounts = [
    {
      id: 'usr-admin',
      email: 'admin@aknu.edu.in',
      fullName: 'Dr. K. S. Rao (Super Admin)',
      role: 'super_admin',
      genderWing: 'all',
      phone: '9848011221'
    },
    {
      id: 'usr-chief-boys',
      email: 'chiefwarden.boys@aknu.edu.in',
      fullName: 'Prof. M. Ramana (Chief Warden Boys)',
      role: 'chief_warden',
      genderWing: 'boys',
      phone: '9848011223'
    },
    {
      id: 'usr-chief-girls',
      email: 'chiefwarden.girls@aknu.edu.in',
      fullName: 'Prof. K. Vijaya (Chief Warden Girls)',
      role: 'chief_warden',
      genderWing: 'girls',
      phone: '9848011235'
    },
    {
      id: 'usr-warden-boys',
      email: 'warden.boys@aknu.edu.in',
      fullName: 'Dr. P. Satyanarayana (Assistant Warden Boys)',
      role: 'assistant_warden',
      genderWing: 'boys',
      phone: '9848011224'
    },
    {
      id: 'usr-warden-girls',
      email: 'warden.girls@aknu.edu.in',
      fullName: 'Dr. S. Lakshmi (Assistant Warden Girls)',
      role: 'assistant_warden',
      genderWing: 'girls',
      phone: '9848011225'
    },
    {
      id: 'usr-ja-boys',
      email: 'ja.boys@aknu.edu.in',
      fullName: 'Mr. B. Suresh (Junior Assistant Boys)',
      role: 'junior_assistant',
      genderWing: 'boys',
      phone: '9848011241'
    },
    {
      id: 'usr-ja-girls',
      email: 'ja.girls@aknu.edu.in',
      fullName: 'Mrs. K. Anitha (Junior Assistant Girls)',
      role: 'junior_assistant',
      genderWing: 'girls',
      phone: '9848011242'
    }
  ];

  for (const acc of staffAccounts) {
    await executeQuery(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, gender_wing, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         role = EXCLUDED.role,
         gender_wing = EXCLUDED.gender_wing,
         is_active = true`,
      [acc.id, acc.email, passwordHash, acc.fullName, acc.phone, acc.role, acc.genderWing]
    );
  }

  const result = await executeQuery(`
    SELECT id, email, full_name, role, gender_wing
    FROM users
    ORDER BY role, gender_wing, full_name
  `);

  console.log('[Seed] Separate staff logins configured successfully:');
  console.table(result.rows);
  process.exit(0);
}

seedLogins().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
