import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';

export function listFeedback(hospitalId: string, status?: string): Row[] {
  if (status) {
    return all(
      `SELECT fb.*, u.display_name AS reviewed_by_name FROM user_feedback fb
       LEFT JOIN admin_users u ON u.id = fb.reviewed_by
       WHERE fb.hospital_id = ? AND fb.status = ? ORDER BY fb.created_at DESC`, hospitalId, status);
  }
  return all(
    `SELECT fb.*, u.display_name AS reviewed_by_name FROM user_feedback fb
     LEFT JOIN admin_users u ON u.id = fb.reviewed_by
     WHERE fb.hospital_id = ? ORDER BY fb.created_at DESC`, hospitalId);
}

export function createFeedback(hospitalId: string, input: {
  floor_id?: string | null; room_id?: string | null; category: string; description: string; contact_hint?: string;
}): Row {
  const id = uuid();
  run(
    `INSERT INTO user_feedback (id, hospital_id, floor_id, room_id, category, description, contact_hint, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id, hospitalId, input.floor_id ?? null, input.room_id ?? null,
    input.category, input.description, input.contact_hint ?? null, 'open', nowIso(),
  );
  return get<Row>('SELECT * FROM user_feedback WHERE id = ?', id)!;
}

export function reviewFeedback(id: string, actorId: string, status: 'reviewing' | 'resolved' | 'rejected', resolutionNote?: string): Row | undefined {
  run(
    `UPDATE user_feedback SET status = ?, reviewed_by = ?, reviewed_at = ?, resolution_note = ? WHERE id = ?`,
    status, actorId, nowIso(), resolutionNote ?? null, id,
  );
  return get<Row>('SELECT * FROM user_feedback WHERE id = ?', id);
}
