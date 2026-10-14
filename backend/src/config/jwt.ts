import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'aknu_default_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
  assignedHostels?: string[];
  assignedCategory?: 'boys' | 'girls' | 'all';
  studentId?: string;
}

export function generateToken(payload: TokenUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): TokenUser {
  return jwt.verify(token, JWT_SECRET) as TokenUser;
}
