import { Router } from 'express';
import { z } from 'zod';
import { wrap, parse } from '../http.js';
import { ApiError } from '../errors.js';
import { getUserByEmail, touchLogin, listUsers, listRoles, createUser } from '../db/repos/users.js';
import { verifyPassword, hashPassword } from '../auth/rbac.js';
import { signToken } from '../auth/jwt.js';
import { authenticate, audit } from '../auth/middleware.js';
import { uuid } from '../db/sqlite.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', wrap(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash as string)) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.is_active !== 1) throw ApiError.forbidden('Account is inactive');
  touchLogin(user.id as string);
  const token = signToken({
    sub: user.id as string,
    email: user.email as string,
    role: user.role_key as string,
    hospitalId: (user.hospital_id as string) ?? null,
  });
  audit({ id: user.id as string, role: user.role_key as string }, 'auth.login', { entityType: 'admin_user', entityId: user.id as string });
  res.json({
    token,
    user: {
      id: user.id, email: user.email, display_name: user.display_name,
      role: user.role_key, role_name: user.role_name, hospital_id: user.hospital_id,
      permissions: JSON.parse(user.permissions as string),
    },
  });
}));

authRouter.get('/me', authenticate, wrap(async (req, res) => {
  res.json({
    id: req.admin!.id,
    email: req.admin!.email,
    display_name: req.admin!.displayName,
    role: req.admin!.role,
    hospital_id: req.admin!.hospitalId,
    permissions: req.admin!.permissions,
  });
}));

const createUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1),
  password: z.string().min(8),
  role_id: z.string().uuid(),
  hospital_id: z.string().uuid().optional().nullable(),
});

authRouter.post('/users', authenticate, wrap(async (req, res) => {
  // Only super admin or hospital admin may create users.
  if (!req.admin!.permissions.includes('*') && !req.admin!.permissions.includes('hospital:manage')) {
    throw ApiError.forbidden('Requires hospital:manage permission');
  }
  const body = parse(createUserSchema, req.body);
  const created = createUser({
    email: body.email,
    display_name: body.display_name,
    password_hash: hashPassword(body.password),
    role_id: body.role_id,
    hospital_id: body.hospital_id ?? undefined,
  });
  audit(req.admin!, 'admin_user.create', { entityType: 'admin_user', entityId: created.id, details: { email: body.email, role_id: body.role_id } });
  res.status(201).json({ id: created.id, email: created.email, display_name: created.display_name, role_id: created.role_id });
}));

authRouter.get('/users', authenticate, wrap(async (req, res) => {
  if (!req.admin!.permissions.includes('*') && !req.admin!.permissions.includes('hospital:manage')) {
    throw ApiError.forbidden('Requires hospital:manage permission');
  }
  res.json({ users: listUsers(), roles: listRoles() });
}));

// Regenerate/rotate is intentionally out of scope for MVP; audit logs the id.
void uuid;
