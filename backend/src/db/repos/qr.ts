import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';

export function listQrLocations(hospitalId: string): Row[] {
  return all(
    `SELECT q.*, r.room_number, r.name AS room_name, f.floor_label, f.floor_number,
            b.name AS building_name
     FROM qr_locations q
     LEFT JOIN rooms r ON r.id = q.room_id
     LEFT JOIN floors f ON f.id = q.floor_id
     LEFT JOIN buildings b ON b.id = q.building_id
     WHERE q.hospital_id = ? ORDER BY q.floor_id, q.location_identifier`, hospitalId);
}

export function createQrLocation(input: {
  hospital_id: string; building_id: string; floor_id: string;
  room_id?: string | null; node_id?: string | null; location_identifier: string; label: string;
  x_metres?: number; y_metres?: number; verification_status?: string;
}): Row {
  const id = uuid();
  run(
    `INSERT INTO qr_locations (id, hospital_id, building_id, floor_id, room_id, node_id,
       location_identifier, label, x_metres, y_metres, is_active, generated_at, verification_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.hospital_id, input.building_id, input.floor_id, input.room_id ?? null,
    input.node_id ?? null, input.location_identifier, input.label,
    input.x_metres ?? null, input.y_metres ?? null, 1, nowIso(),
    input.verification_status ?? 'unverified',
  );
  return get<Row>('SELECT * FROM qr_locations WHERE id = ?', id)!;
}

export function setQrVerification(id: string, status: string): void {
  run(`UPDATE qr_locations SET verification_status = ? WHERE id = ?`, status, id);
}

export function deleteQrLocation(id: string): void {
  run(`DELETE FROM qr_locations WHERE id = ?`, id);
}
