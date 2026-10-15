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
  } catch (e) {
    // Ignore if column already exists
  }

  console.log('[SchemaInit] Database schema successfully verified and initialized.');
}
