import crypto from 'crypto';

export function sha256Hash(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}