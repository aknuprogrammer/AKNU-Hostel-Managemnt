import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

export async function seedHostelsAndStudents() {
  console.log('[Seed] Standalone seed script - no sample infrastructure inserted.');
}

if (process.argv[1]?.includes('seedHostelsAndStudents')) {
  seedHostelsAndStudents().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
