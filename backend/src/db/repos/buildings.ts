import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';

export function listBuildings(hospitalId: string): Row[] {
  return all(
    `SELECT b.*, (SELECT COUNT(*) FROM floors f WHERE f.building_id = b.id) AS floor_count
     FROM buildings b WHERE b.hospital_id = ? AND b.is_active = 1
     ORDER BY b.name ASC`, hospitalId);
}

export function getBuilding(id: string): Row | undefined {
  return get(`SELECT * FROM buildings WHERE id = ?`, id);
}

export function createBuilding(hospitalId: string, input: {
  name: string; code?: string; latitude?: number; longitude?: number;
}): Row {
  const t = nowIso();
  const id = uuid();
  run(
    `INSERT INTO buildings (id, hospital_id, name, code, latitude, longitude, floor_count, is_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, hospitalId, input.name, input.code ?? null, input.latitude ?? null,
    input.longitude ?? null, 0, 1, t, t,
  );
  return getBuilding(id)!;
}

export function updateBuilding(id: string, input: {
  name?: string; code?: string; latitude?: number; longitude?: number;
}): Row | undefined {
  run(
    `UPDATE buildings SET name = COALESCE(?, name), code = COALESCE(?, code),
       latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), updated_at = ?
     WHERE id = ?`,
    input.name ?? null, input.code ?? null, input.latitude ?? null,
    input.longitude ?? null, nowIso(), id,
  );
  return getBuilding(id);
}

export function deleteBuilding(id: string): void {
  run(`DELETE FROM buildings WHERE id = ?`, id);
}
