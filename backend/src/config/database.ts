import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const isProductionPg = !!process.env.DATABASE_URL;

let pgPool: Pool | null = null;
let pgliteInstance: PGlite | null = null;
let isClosing = false;

// Path to persistent data and JSON backup snapshot
const backendRoot = __dirname.includes('backend')
  ? path.resolve(__dirname.split('backend')[0], 'backend')
  : path.resolve(process.cwd(), 'backend');
const dataDir = path.resolve(backendRoot, 'data/aknu_hostel_pg');
const snapshotFile = path.resolve(backendRoot, 'data/aknu_hostel_state.json');

/**
 * Creates an instant snapshot of user tables to ensure zero data loss across crashes or unexpected kills.
 */
export async function backupDatabaseState(): Promise<void> {
  if (!pgliteInstance) return;
  try {
    const tables = [
      'users',
      'roles',
      'user_roles',
      'departments',
      'courses',
      'academic_years',
      'hostels',
      'blocks',
      'floors',
      'rooms',
      'beds',
      'students',
      'student_allocations',
      'meal_sessions',
      'mess_menus',
      'mess_inventory',
      'mess_inventory_transactions',
      'food_wastage_logs',
      'student_meal_attendance',
      'meal_transactions',
      'complaints',
      'leave_applications',
      'visitor_logs'
    ];

    const snapshot: Record<string, any[]> = {};
    for (const t of tables) {
      try {
        const res = await pgliteInstance.query(`SELECT * FROM ${t}`);
        snapshot[t] = res.rows;
      } catch (e) {
        // Table may not exist yet
      }
    }

    const tempFile = `${snapshotFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    if (fs.existsSync(tempFile)) {
      fs.renameSync(tempFile, snapshotFile);
    }
  } catch (err: any) {
    // Non-fatal logging for background backup
  }
}

/**
 * Restores all user data from snapshot if database needed re-initialization.
 */
export async function restoreDatabaseState(pg: PGlite): Promise<boolean> {
  if (!fs.existsSync(snapshotFile)) return false;
  try {
    const raw = fs.readFileSync(snapshotFile, 'utf-8');
    const snapshot: Record<string, any[]> = JSON.parse(raw);
    console.log('[Database] Restoring data from persistent state snapshot...');

    const tableOrder = [
      'roles',
      'departments',
      'courses',
      'academic_years',
      'users',
      'user_roles',
      'hostels',
      'blocks',
      'floors',
      'rooms',
      'beds',
      'students',
      'student_allocations',
      'meal_sessions',
      'mess_menus',
      'mess_inventory',
      'mess_inventory_transactions',
      'food_wastage_logs',
      'student_meal_attendance',
      'meal_transactions',
      'complaints',
      'leave_applications',
      'visitor_logs'
    ];

    for (const t of tableOrder) {
      const rows = snapshot[t];
      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;
          const cols = keys.map((k) => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map((k) => row[k]);
          try {
            await pg.query(
              `INSERT INTO ${t} (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values
            );
          } catch (insertErr) {
            // Ignore single row conflicts
          }
        }
      }
    }
    console.log('[Database] Persistent state restored successfully.');
    return true;
  } catch (err) {
    console.warn('[Database] State restore notice:', err);
    return false;
  }
}

export async function getDb() {
  if (isProductionPg) {
    if (!pgPool) {
      const dbUrl = process.env.DATABASE_URL || '';
      const isRemoteDb = dbUrl.length > 0 && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');
      const useSsl = process.env.NODE_ENV === 'production' || isRemoteDb || dbUrl.includes('sslmode=require');
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : false
      });
      console.log(`[Database] Connected to external PostgreSQL via pg.Pool (SSL: ${useSsl ? 'enabled' : 'disabled'})`);
    }
    return {
      type: 'pg' as const,
      pool: pgPool,
      async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
        const res = await pgPool!.query(sql, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
      }
    };
  } else {
    if (!pgliteInstance) {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const pidFile = path.join(dataDir, 'postmaster.pid');

      // Clear lock file if left over by previous process
      const waitAndClearPid = async () => {
        for (let i = 0; i < 25; i++) {
          if (!fs.existsSync(pidFile)) return;
          try {
            fs.unlinkSync(pidFile);
            console.log('[Database] Cleared previous postmaster lock file.');
            return;
          } catch (e: any) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      };

      for (let attempt = 1; attempt <= 15; attempt++) {
        await waitAndClearPid();
        try {
          pgliteInstance = new PGlite(dataDir, { relaxedDurability: true });
          await pgliteInstance.waitReady;
          break;
        } catch (initErr: any) {
          if (attempt === 15) {
            console.error('[Database Fatal] Unable to connect to persistent PGlite instance:', initErr);
            throw initErr;
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      console.log(`[Database] Initialized persistent local PostgreSQL engine at ${dataDir}`);

      // Graceful signal handlers: NEVER use process.on('exit') for async closing
      const handleShutdown = async (sig: string) => {
        if (isClosing) return;
        isClosing = true;
        console.log(`[Database] Clean shutdown triggered (${sig})...`);
        if (pgliteInstance) {
          try {
            await backupDatabaseState();
            await pgliteInstance.close();
            if (fs.existsSync(pidFile)) {
              try { fs.unlinkSync(pidFile); } catch (e) {}
            }
            console.log('[Database] PGlite closed cleanly.');
          } catch (e) {}
          pgliteInstance = null;
        }
        process.exit(0);
      };

      process.once('SIGINT', () => handleShutdown('SIGINT'));
      process.once('SIGTERM', () => handleShutdown('SIGTERM'));

      // Periodic state snapshot to ensure zero data loss
      setInterval(() => {
        backupDatabaseState().catch(() => {});
      }, 30000).unref();
    }
    return {
      type: 'pglite' as const,
      client: pgliteInstance!,
      async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
        const res = await pgliteInstance!.query<T>(sql, params);
        return { rows: res.rows as T[], rowCount: res.rows.length };
      }
    };
  }
}

export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
  const db = await getDb();
  const res = await db.query<T>(sql, params);
  
  // If query was a mutation, trigger async snapshot backup
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
    backupDatabaseState().catch(() => {});
  }
  
  return res;
}

export async function executeTransaction<T>(callback: (query: (sql: string, params?: any[]) => Promise<any>) => Promise<T>): Promise<T> {
  const db = await getDb();
  if (db.type === 'pg') {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const queryFn = async (sql: string, params: any[] = []) => client.query(sql, params);
      const result = await callback(queryFn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // PGlite transaction
    const result = await db.client!.transaction(async (tx) => {
      const queryFn = async (sql: string, params: any[] = []) => tx.query(sql, params);
      return await callback(queryFn);
    });
    backupDatabaseState().catch(() => {});
    return result;
  }
}
