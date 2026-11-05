import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type AdminToken } from './jwt.js';
import { get, run, uuid, nowIso } from '../db/sqlite.js';
import { ApiError } from '../errors.js';

export type Permission =
  | '*'
  | 'hospital:manage'
  | 'map:edit'
  | 'map:verify'
  | 'map:publish'
  | 'room:edit'
  | 'department:edit'
  | 'qr:generate'
  | 'feedback:read'
  | 'feedback:review'
  | 'audit:read';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminToken & { id: string; displayName: string; roleId: string; permissions: string[] };
    }
  }
}

/** Internal shape used to attach the authenticated admin to the request. */
export interface AdminContext extends AdminToken {
  id: string;
  displayName: string;
  roleId: string;
  permissions: string[];
}

/** Authenticate: parse Bearer token, load user + permissions from DB. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const m = /^Bearer (.+)$/.exec(header);
  if (!m) return next(ApiError.unauthorized('Missing bearer token'));
  try {
    const token = verifyToken(m[1]);
    const user = get<{
      id: string; email: string; display_name: string; role_id: string; role_key: string;
      hospital_id: string | null; is_active: number; permissions: string;
    }>(
      `SELECT u.id, u.email, u.display_name, u.role_id, u.hospital_id, r.role_key,
              r.permissions, u.is_active
       FROM admin_users u JOIN admin_roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      token.sub,
    );
    if (!user || user.is_active !== 1) return next(ApiError.unauthorized('Account inactive or not found'));
    req.admin = {
      sub: token.sub,
      id: user.id,
      email: user.email,
      role: user.role_key,
      hospitalId: user.hospital_id,
      displayName: user.display_name,
      roleId: user.role_id,
      permissions: JSON.parse(user.permissions),
    };
    next();
  } catch (e) {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/** Require a specific permission. Super admin ('*') always allowed. */
export function requirePermission(perm: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const admin = req.admin;
    if (!admin) return next(ApiError.unauthorized());
    if (admin.permissions.includes('*')) return next();
    if (!admin.permissions.includes(perm)) return next(ApiError.forbidden(`Requires permission: ${perm}`));
    next();
  };
}

/** Restrict access to a specific hospital (platform-wide roles bypass). */
export function requireHospitalAccess(req: Request, _res: Response, next: NextFunction) {
  const admin = req.admin;
  if (!admin) return next(ApiError.unauthorized());
  if (admin.permissions.includes('*')) return next();
  const hospitalId = String(req.params.hospitalId ?? req.params.id ?? '');
  if (admin.hospitalId && admin.hospitalId === hospitalId) return next();
  return next(ApiError.forbidden('Access to this hospital is restricted to its assigned admins'));
}

/** Load-bearing: record an audit entry. */
export function audit(actor: { id: string; role: string } | undefined, action: string, opts: {
  entityType?: string; entityId?: unknown; hospitalId?: unknown; details?: unknown;
}) {
  run(
    `INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, hospital_id, details, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    uuid(),
    actor?.id ?? null,
    actor?.role ?? 'system',
    action,
    opts.entityType ?? null,
    opts.entityId ?? null,
    opts.hospitalId ?? null,
    JSON.stringify(opts.details ?? {}),
    nowIso(),
  );
}
