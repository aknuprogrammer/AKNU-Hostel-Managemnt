import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenUser } from '../config/jwt.js';
import { executeQuery } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuthRequest extends Request {
  user?: TokenUser;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required. Missing or malformed token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    return;
  }
}

export function requireRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    // super_admin always has access
    if (req.user.role === 'super_admin') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Authorized roles: ${roles.join(', ')}. Current role: ${req.user.role}`
      });
      return;
    }
    next();
  };
}

export async function logAudit(userId: string | undefined, action: string, entityType: string, entityId?: string, details?: any, req?: Request) {
  try {
    const id = uuidv4();
    const ip = req ? (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress : undefined;
    const ua = req ? req.headers['user-agent'] : undefined;
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;

    await executeQuery(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [id, userId || null, action, entityType, entityId || null, ip || null, ua || null, detailsStr]
    );
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}
