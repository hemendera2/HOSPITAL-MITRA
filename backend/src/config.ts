import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppConfig {
  port: number;
  dbFile: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  isProduction: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  return v === '1' || v === 'true' || v === 'yes';
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 8787),
  dbFile: process.env.DB_FILE ?? path.resolve(__dirname, '../.data/hospital-mitra.sqlite'),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8788').split(',').map((s) => s.trim()),
  isProduction: bool(process.env.NODE_ENV, false),
};

export const APP_VERSION = '1.0.0';
