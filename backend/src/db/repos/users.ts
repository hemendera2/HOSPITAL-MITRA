import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';

export function listAuditLogs(hospitalId?: string, limit = 100): Row[] {
  if (hospitalId) {
    return all(
      `SELECT a.*, u.display_name AS actor_name, u.email AS actor_email
       FROM audit_logs a LEFT JOIN admin_users u ON u.id = a.actor_id
       WHERE a.hospital_id = ? ORDER BY a.created_at DESC LIMIT ?`, hospitalId, limit);
  }
  return all(
    `SELECT a.*, u.display_name AS actor_name, u.email AS actor_email
     FROM audit_logs a LEFT JOIN admin_users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC LIMIT ?`, limit);
}

// ---- Admin users ------------------------------------------------------------

export function listUsers(roleId?: string): Row[] {
  if (roleId) {
    return all(
      `SELECT u.id, u.email, u.display_name, u.role_id, r.role_key, r.name AS role_name,
              u.hospital_id, u.is_active, u.last_login_at, u.created_at
       FROM admin_users u JOIN admin_roles r ON r.id = u.role_id
       WHERE u.role_id = ? ORDER BY u.email`, roleId);
  }
  return all(
    `SELECT u.id, u.email, u.display_name, u.role_id, r.role_key, r.name AS role_name,
            u.hospital_id, u.is_active, u.last_login_at, u.created_at
     FROM admin_users u JOIN admin_roles r ON r.id = u.role_id
     ORDER BY u.email`);
}

export function listRoles(): Row[] {
  return all('SELECT * FROM admin_roles ORDER BY role_key');
}

export function getUserByEmail(email: string): Row | undefined {
  return get(
    `SELECT u.*, r.role_key, r.permissions, r.name AS role_name
     FROM admin_users u JOIN admin_roles r ON r.id = u.role_id
     WHERE u.email = ?`, email.toLowerCase());
}

export function createUser(input: {
  email: string; display_name: string; password_hash: string;
  role_id: string; hospital_id?: string;
}): Row {
  const t = nowIso();
  const id = uuid();
  run(
    `INSERT INTO admin_users (id, email, display_name, password_hash, role_id, hospital_id, is_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id, input.email.toLowerCase(), input.display_name, input.password_hash,
    input.role_id, input.hospital_id ?? null, 1, t, t,
  );
  return get<Row>('SELECT * FROM admin_users WHERE id = ?', id)!;
}

export function touchLogin(id: string): void {
  run(`UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?`, nowIso(), nowIso(), id);
}
