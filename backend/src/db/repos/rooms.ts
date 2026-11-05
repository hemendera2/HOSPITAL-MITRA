import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';

// ---- Departments ------------------------------------------------------------

export function listDepartments(hospitalId: string): Row[] {
  return all(
    `SELECT d.*, (SELECT COUNT(*) FROM rooms r WHERE r.department_id = d.id) AS room_count
     FROM departments d WHERE d.hospital_id = ? AND d.is_active = 1 ORDER BY d.name ASC`, hospitalId);
}

export function createDepartment(hospitalId: string, input: {
  name: string; name_hi?: string; category?: string; short_code?: string; operating_hours?: string;
}): Row {
  const id = uuid();
  run(
    `INSERT INTO departments (id, hospital_id, name, name_hi, category, short_code, operating_hours, is_active, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id, hospitalId, input.name, input.name_hi ?? null, input.category ?? null,
    input.short_code ?? null, input.operating_hours ?? null, 1, nowIso(),
  );
  return get<Row>('SELECT * FROM departments WHERE id = ?', id)!;
}

export function updateDepartment(id: string, input: Partial<{ name: string; name_hi: string; category: string; short_code: string; operating_hours: string }>): Row | undefined {
  run(
    `UPDATE departments SET name=COALESCE(?,name), name_hi=COALESCE(?,name_hi),
       category=COALESCE(?,category), short_code=COALESCE(?,short_code),
       operating_hours=COALESCE(?,operating_hours) WHERE id=?`,
    input.name ?? null, input.name_hi ?? null, input.category ?? null,
    input.short_code ?? null, input.operating_hours ?? null, id,
  );
  return get<Row>('SELECT * FROM departments WHERE id = ?', id);
}

export function deleteDepartment(id: string): void {
  run(`DELETE FROM departments WHERE id = ?`, id);
}

// ---- Rooms ------------------------------------------------------------------

export interface RoomInput {
  hospital_id: string; building_id: string; floor_id: string;
  room_number: string; name?: string; name_hi?: string; department_id?: string | null;
  category?: string; geometry?: unknown; x_centroid?: number; y_centroid?: number;
  verification_status?: string; operating_info?: string;
}

export function listRooms(floorId: string): Row[] {
  return all(
    `SELECT r.*, d.name AS department_name FROM rooms r
     LEFT JOIN departments d ON d.id = r.department_id
     WHERE r.floor_id = ? AND r.is_active = 1 ORDER BY r.room_number ASC`, floorId);
}

export function getRoom(id: string): Row | undefined {
  return get(`SELECT * FROM rooms WHERE id = ?`, id);
}

export function createRoom(input: RoomInput): Row {
  const t = nowIso();
  const id = uuid();
  run(
    `INSERT INTO rooms (id, hospital_id, building_id, floor_id, room_number, name, name_hi,
       department_id, category, geometry, x_centroid, y_centroid, verification_status,
       operating_info, is_demo, is_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.hospital_id, input.building_id, input.floor_id, input.room_number,
    input.name ?? null, input.name_hi ?? null, input.department_id ?? null,
    input.category ?? null, JSON.stringify(input.geometry ?? {}),
    input.x_centroid ?? null, input.y_centroid ?? null,
    input.verification_status ?? 'unverified', input.operating_info ?? null, 0, 1, t, t,
  );
  return getRoom(id)!;
}

export function updateRoom(id: string, input: Partial<RoomInput>): Row | undefined {
  run(
    `UPDATE rooms SET
        room_number=COALESCE(?,room_number), name=COALESCE(?,name), name_hi=COALESCE(?,name_hi),
        department_id=COALESCE(?,department_id), category=COALESCE(?,category),
        geometry=COALESCE(?,geometry), x_centroid=COALESCE(?,x_centroid),
        y_centroid=COALESCE(?,y_centroid), verification_status=COALESCE(?,verification_status),
        operating_info=COALESCE(?,operating_info), updated_at=? WHERE id=?`,
    input.room_number ?? null, input.name ?? null, input.name_hi ?? null,
    input.department_id ?? null, input.category ?? null,
    input.geometry !== undefined ? JSON.stringify(input.geometry) : null,
    input.x_centroid ?? null, input.y_centroid ?? null,
    input.verification_status ?? null, input.operating_info ?? null, nowIso(), id,
  );
  return getRoom(id);
}

export function setRoomVerification(id: string, status: string): void {
  run(`UPDATE rooms SET verification_status = ?, updated_at = ? WHERE id = ?`, status, nowIso(), id);
}

export function deleteRoom(id: string): void {
  run(`DELETE FROM rooms WHERE id = ?`, id);
}

// ---- Facilities -------------------------------------------------------------

export function listFacilities(hospitalId: string): Row[] {
  return all(`SELECT * FROM facilities WHERE hospital_id = ? AND is_active = 1 ORDER BY name ASC`, hospitalId);
}

export function createFacility(hospitalId: string, input: {
  building_id?: string | null; floor_id?: string | null; room_id?: string | null;
  name: string; name_hi?: string; facility_type: string;
  x_metres?: number; y_metres?: number; operating_info?: string;
}): Row {
  const id = uuid();
  run(
    `INSERT INTO facilities (id, hospital_id, building_id, floor_id, room_id, name, name_hi,
       facility_type, x_metres, y_metres, verification_status, operating_info, is_demo, is_active, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, hospitalId, input.building_id ?? null, input.floor_id ?? null, input.room_id ?? null,
    input.name, input.name_hi ?? null, input.facility_type, input.x_metres ?? null,
    input.y_metres ?? null, 'unverified', input.operating_info ?? null, 0, 1, nowIso(),
  );
  return get<Row>('SELECT * FROM facilities WHERE id = ?', id)!;
}

// ---- Doctors (directory only, no availability/booking) --------------------

export function listDoctors(hospitalId: string): Row[] {
  return all(
    `SELECT doc.*, d.name AS department_name, r.room_number
     FROM doctors doc
     LEFT JOIN departments d ON d.id = doc.department_id
     LEFT JOIN rooms r ON r.id = doc.room_id
     WHERE doc.hospital_id = ? AND doc.is_active = 1 ORDER BY doc.name ASC`, hospitalId);
}

export function createDoctor(hospitalId: string, input: {
  department_id?: string | null; name: string; qualifications?: string;
  specialization?: string; registration_number?: string; room_id?: string | null;
}): Row {
  const id = uuid();
  run(
    `INSERT INTO doctors (id, hospital_id, department_id, name, qualifications, specialization,
       registration_number, room_id, verification_status, is_demo, is_active, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, hospitalId, input.department_id ?? null, input.name, input.qualifications ?? null,
    input.specialization ?? null, input.registration_number ?? null, input.room_id ?? null,
    'unverified', 0, 1, nowIso(),
  );
  return get<Row>('SELECT * FROM doctors WHERE id = ?', id)!;
}
