import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';

export interface HospitalInput {
  name: string;
  short_name?: string;
  city: string;
  district: string;
  state?: string;
  country?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone_emergency?: string;
  hospital_type?: string;
  bed_count?: number;
  mapping_status?: string;
}

export function listHospitals(opts: { search?: string; city?: string; includeDemo?: boolean } = {}): Row[] {
  let sql = `SELECT h.*, (SELECT COUNT(*) FROM buildings b WHERE b.hospital_id = h.id) AS building_count,
                    (SELECT COUNT(*) FROM floors f WHERE f.hospital_id = h.id AND f.map_status = 'published') AS published_floors
             FROM hospitals h WHERE h.is_active = 1`;
  const params: unknown[] = [];
  if (opts.includeDemo === false) {
    sql += ` AND h.is_demo = 0`;
  }
  if (opts.search) {
    sql += ` AND (h.name ILIKE ? OR h.short_name ILIKE ? OR h.city ILIKE ? OR h.district ILIKE ?)`;
    const s = `%${opts.search}%`;
    params.push(s, s, s, s);
  }
  if (opts.city) {
    sql += ` AND h.city ILIKE ?`;
    params.push(`%${opts.city}%`);
  }
  sql += ` ORDER BY h.is_demo ASC, h.name ASC`;
  return all(sql, ...params);
}

export function getHospital(id: string): Row | undefined {
  return get(`SELECT * FROM hospitals WHERE id = ?`, id);
}

export function createHospital(input: HospitalInput): Row {
  const t = nowIso();
  const id = uuid();
  run(
    `INSERT INTO hospitals (id, name, short_name, city, district, state, country, address,
        latitude, longitude, phone_emergency, hospital_type, bed_count, mapping_status,
        map_verified, is_demo, is_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.name, input.short_name ?? null, input.city, input.district,
    input.state ?? 'Rajasthan', input.country ?? 'IN', input.address ?? null,
    input.latitude ?? null, input.longitude ?? null, input.phone_emergency ?? null,
    input.hospital_type ?? null, input.bed_count ?? null,
    input.mapping_status ?? 'unmapped', 0, 0, 1, t, t,
  );
  return getHospital(id)!;
}

export function updateHospital(id: string, input: Partial<HospitalInput>): Row | undefined {
  run(
    `UPDATE hospitals SET
        name = COALESCE(?, name), short_name = COALESCE(?, short_name),
        city = COALESCE(?, city), district = COALESCE(?, district),
        state = COALESCE(?, state), country = COALESCE(?, country),
        address = COALESCE(?, address), latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude), phone_emergency = COALESCE(?, phone_emergency),
        hospital_type = COALESCE(?, hospital_type), bed_count = COALESCE(?, bed_count),
        mapping_status = COALESCE(?, mapping_status), updated_at = ?
     WHERE id = ?`,
    input.name ?? null, input.short_name ?? null, input.city ?? null, input.district ?? null,
    input.state ?? null, input.country ?? null, input.address ?? null,
    input.latitude ?? null, input.longitude ?? null, input.phone_emergency ?? null,
    input.hospital_type ?? null, input.bed_count ?? null, input.mapping_status ?? null,
    nowIso(), id,
  );
  return getHospital(id);
}

export function deleteHospital(id: string): void {
  run(`DELETE FROM hospitals WHERE id = ?`, id);
}

export function setMappingStatus(id: string, status: string): void {
  run(`UPDATE hospitals SET mapping_status = ?, map_verified = ?, updated_at = ? WHERE id = ?`,
    status, status !== 'unmapped' ? 1 : 0, nowIso(), id);
}
