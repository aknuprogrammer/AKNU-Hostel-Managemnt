import fs from 'fs';
import path from 'path';
import { executeQuery, getDb } from '../config/database.js';

export async function initializeSchema() {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }
  const rawSql = fs.readFileSync(schemaPath, 'utf-8');

  // Strip single-line comments
  const cleanedSql = rawSql.replace(/--.*$/gm, '');

  const db = await getDb();
  if (db.type === 'pglite') {
    // PGlite can execute full multi-statement scripts directly
    await db.client.exec(cleanedSql);
  } else {
    // For pg Pool
    const statements = cleanedSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await executeQuery(statement);
      } catch (err: any) {
        if (!err.message?.includes('already exists')) {
          console.warn(`[SchemaInit Warning] ${err.message}`);
        }
      }
    }
  }

  // Ensure new columns exist on existing tables regardless of DB engine
  try {
    await executeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT FALSE');
    await executeQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255)');
    await executeQuery("UPDATE users SET plain_password = 'Aknu@2026!' WHERE plain_password IS NULL");
    await executeQuery("ALTER TABLE courses ADD COLUMN IF NOT EXISTS program_level VARCHAR(20) DEFAULT 'UG'");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS program_level VARCHAR(20) DEFAULT 'UG'");
    await executeQuery("ALTER TABLE user_hostel_assignments ADD COLUMN IF NOT EXISTS role VARCHAR(50)");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee_status VARCHAR(20) DEFAULT 'unpaid'");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee_total NUMERIC(10,2) DEFAULT 0");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee_paid NUMERIC(10,2) DEFAULT 0");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee_pending NUMERIC(10,2) DEFAULT 0");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee_payment_date DATE");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee_receipt_no VARCHAR(100)");
    await executeQuery("ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee_payment_mode VARCHAR(30) DEFAULT 'upi'");

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS student_meal_attendance (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
        service_date DATE NOT NULL,
        breakfast BOOLEAN DEFAULT TRUE,
        lunch BOOLEAN DEFAULT TRUE,
        snacks BOOLEAN DEFAULT TRUE,
        dinner BOOLEAN DEFAULT TRUE,
        source VARCHAR(20) DEFAULT 'STUDENT_APP',
        notes TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_student_meal_date UNIQUE (student_id, service_date)
      )
    `);
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_meal_attendance_date_hostel ON student_meal_attendance(service_date, hostel_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_meal_attendance_student_date ON student_meal_attendance(student_id, service_date)');
  } catch (e) {
    // Ignore if column already exists
  }

  console.log('[SchemaInit] Database schema successfully verified and initialized.');
}
