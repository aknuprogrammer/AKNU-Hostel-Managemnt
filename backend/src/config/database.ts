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
      const pidFile = path.join(dataDir, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
        } catch (e) {}
      }

      try {
        pgliteInstance = new PGlite(dataDir);
        await pgliteInstance.waitReady;
      } catch (initErr: any) {
        console.warn('[Database] PGlite failed to resume interrupted storage, performing recovery...', initErr?.message);
        try {
          if (fs.existsSync(dataDir)) {
            fs.rmSync(dataDir, { recursive: true, force: true });
            fs.mkdirSync(dataDir, { recursive: true });
          }
          pgliteInstance = new PGlite(dataDir);
          await pgliteInstance.waitReady;
          console.log('[Database] Clean local storage reinitialized after recovery.');
        } catch (recoverErr) {
          console.error('[Database Recovery Failed]', recoverErr);
          throw recoverErr;
        }
      }

      console.log(`[Database] Initialized local PostgreSQL engine (PGlite WASM) at ${dataDir}`);
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
