import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AdminToken {
  sub: string;      // admin user id
  email: string;
  role: string;     // role_key
  hospitalId: string | null;
}

export function signToken(payload: AdminToken): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): AdminToken {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AdminToken;
    return decoded;
  } catch {
    throw new Error('invalid_token');
  }
}
