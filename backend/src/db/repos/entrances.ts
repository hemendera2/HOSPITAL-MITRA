import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';

export function listEntrances(floorId: string): Row[] {
  return all(
    `SELECT e.*, n.x_metres, n.y_metres FROM entrances e
     LEFT JOIN navigation_nodes n ON n.id = e.node_id
     WHERE e.floor_id = ? AND e.is_active = 1 ORDER BY e.name ASC`, floorId);
}

export function listExits(floorId: string): Row[] {
  return all(
    `SELECT x.*, n.x_metres, n.y_metres FROM exits x
     LEFT JOIN navigation_nodes n ON n.id = x.node_id
     WHERE x.floor_id = ? AND x.is_active = 1 ORDER BY x.name ASC`, floorId);
}

export function createEntrance(input: {
  hospital_id: string; building_id: string; floor_id: string; node_id?: string | null;
  name: string; kind?: string; latitude?: number; longitude?: number;
  x_metres?: number; y_metres?: number; is_emergency?: boolean;
  is_accessible?: boolean; verification_status?: string;
}): Row {
  const id = uuid();
  run(
    `INSERT INTO entrances (id, hospital_id, building_id, floor_id, node_id, name, kind,
       latitude, longitude, x_metres, y_metres, is_emergency, is_accessible, verification_status, is_demo, is_active, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.hospital_id, input.building_id, input.floor_id, input.node_id ?? null,
    input.name, input.kind ?? 'public', input.latitude ?? null, input.longitude ?? null,
    input.x_metres ?? null, input.y_metres ?? null, input.is_emergency ? 1 : 0,
    input.is_accessible ? 1 : 0, input.verification_status ?? 'unverified', 0, 1, nowIso(),
  );
  return get<Row>('SELECT * FROM entrances WHERE id = ?', id)!;
}

export function createExit(input: {
  hospital_id: string; building_id: string; floor_id: string; node_id?: string | null;
  name: string; kind?: string; latitude?: number; longitude?: number;
  x_metres?: number; y_metres?: number; is_emergency?: boolean;
  is_accessible?: boolean; verification_status?: string;
}): Row {
  const id = uuid();
  run(
    `INSERT INTO exits (id, hospital_id, building_id, floor_id, node_id, name, kind,
       latitude, longitude, x_metres, y_metres, is_emergency, is_accessible, verification_status, is_demo, is_active, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.hospital_id, input.building_id, input.floor_id, input.node_id ?? null,
    input.name, input.kind ?? 'public', input.latitude ?? null, input.longitude ?? null,
    input.x_metres ?? null, input.y_metres ?? null, input.is_emergency ? 1 : 0,
    input.is_accessible ? 1 : 0, input.verification_status ?? 'unverified', 0, 1, nowIso(),
  );
  return get<Row>('SELECT * FROM exits WHERE id = ?', id)!;
}

export function deleteEntrance(id: string): void { run(`DELETE FROM entrances WHERE id = ?`, id); }
export function deleteExit(id: string): void { run(`DELETE FROM exits WHERE id = ?`, id); }
