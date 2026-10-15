import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const isProductionPg = !!process.env.DATABASE_URL;

let pgPool: Pool | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDb() {
  if (isProductionPg) {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      console.log('[Database] Connected to external PostgreSQL via pg.Pool');
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
      const dataDir = path.resolve(__dirname, '../../data/aknu_hostel_pg');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Helper to clear stale lock files
      const clearPid = () => {
        const pidFile = path.join(dataDir, 'postmaster.pid');
        if (fs.existsSync(pidFile)) {
          try {
            fs.unlinkSync(pidFile);
          } catch (e) {}
        }
      };

      clearPid();

      // Retry up to 5 times with delay if directory was temporarily held by previous process
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          clearPid();
          pgliteInstance = new PGlite(dataDir);
          await pgliteInstance.waitReady;
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[Database] PGlite connection attempt ${attempt}/5 failed (${err?.message}), waiting...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (lastErr || !pgliteInstance) {
        console.warn('[Database Recovery] WAL checkpoint was corrupted from abrupt process termination. Recovering clean data directory...');
        try {
          const backupDir = `${dataDir}_corrupt_${Date.now()}`;
          fs.renameSync(dataDir, backupDir);
          fs.mkdirSync(dataDir, { recursive: true });
          pgliteInstance = new PGlite(dataDir);
          await pgliteInstance.waitReady;
          console.log('[Database Recovery] Clean database storage initialized. Schema and seeds will be auto-applied.');
        } catch (recoverErr) {
          console.error('[Database Fatal] Unable to recover PGlite instance:', recoverErr);
          throw lastErr;
        }
      }

      console.log(`[Database] Initialized local PostgreSQL engine (PGlite WASM) persistently at ${dataDir}`);

      // Graceful shutdown
      const cleanup = async () => {
        if (pgliteInstance) {
          try {
            await pgliteInstance.close();
            console.log('[Database] PGlite instance closed cleanly.');
          } catch (e) {}
          pgliteInstance = null;
        }
      };
      process.once('SIGINT', cleanup);
      process.once('SIGTERM', cleanup);
    }
    return {
      type: 'pglite' as const,
      client: pgliteInstance,
      async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
        const res = await pgliteInstance!.query<T>(sql, params);
        return { rows: res.rows as T[], rowCount: res.rows.length };
      }
    };
  }
}

export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
  const db = await getDb();
  return db.query<T>(sql, params);
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
    return await db.client.transaction(async (tx) => {
      const queryFn = async (sql: string, params: any[] = []) => tx.query(sql, params);
      return await callback(queryFn);
    });
  }
}
