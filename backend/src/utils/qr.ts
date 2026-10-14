import crypto from 'crypto';
import QRCode from 'qrcode';

const QR_SECRET = process.env.QR_SECRET_KEY || 'aknu_qr_signature_key_2026_default';

export interface QrTokenPayload {
  studentId: string;
  regNumber: string;
  salt: string;
  issuedAt: number;
  version: number;
}

export function generateQrSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function signStudentQrToken(studentId: string, regNumber: string, salt: string): string {
  const payload: QrTokenPayload = {
    studentId,
    regNumber,
    salt,
    issuedAt: Date.now(),
    version: 1
  };
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payloadEncoded)
    .digest('base64url');

  return `aknu_v1.${payloadEncoded}.${signature}`;
}

export function verifyStudentQrToken(rawToken: string): { valid: boolean; payload?: QrTokenPayload; error?: string } {
  try {
    if (!rawToken || !rawToken.startsWith('aknu_v1.')) {
      return { valid: false, error: 'Invalid QR token format' };
    }
    const parts = rawToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed QR token structure' };
    }
    const [, payloadEncoded, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(payloadEncoded)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Digital signature verification failed (tampered QR)' };
    }

    const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf-8');
    const payload: QrTokenPayload = JSON.parse(payloadJson);

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Failed to decode QR token: ' + err.message };
  }
}

export async function generateQrDataUri(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f2744', // AKNU deep navy
      light: '#ffffff'
    }
  });
}
