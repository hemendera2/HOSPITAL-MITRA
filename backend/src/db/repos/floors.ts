import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';
import { ApiError } from '../../errors.js';

export interface FloorInput {
  hospital_id: string;
  building_id: string;
  floor_number: number;
  floor_label: string;
  level_elevation_m?: number;
  map_image_url?: string;
  map_svg_url?: string;
  map_pdf_url?: string;
  calibration_scale_ppm?: number;
  calibration_origin_x?: number;
  calibration_origin_y?: number;
  calibration_rotation_deg?: number;
  image_width_px?: number;
  image_height_px?: number;
}

export function listFloors(hospitalId: string): Row[] {
  return all(
    `SELECT f.*, b.name AS building_name, b.code AS building_code
     FROM floors f JOIN buildings b ON b.id = f.building_id
     WHERE f.hospital_id = ? AND f.is_active = 1
     ORDER BY b.name ASC, f.floor_number ASC`, hospitalId);
}

export function getFloor(id: string): Row | undefined {
  return get(`SELECT * FROM floors WHERE id = ?`, id);
}

export function createFloor(input: FloorInput): Row {
  const t = nowIso();
  const id = uuid();
  const existing = get<{ id: string }>('SELECT id FROM floors WHERE building_id = ? AND floor_number = ?',
    input.building_id, input.floor_number);
  if (existing) throw ApiError.conflict(`Floor ${input.floor_number} already exists in this building`);
  run(
    `INSERT INTO floors (id, hospital_id, building_id, floor_number, floor_label, level_elevation_m,
       map_image_url, map_svg_url, map_pdf_url, calibration_scale_ppm, calibration_origin_x,
       calibration_origin_y, calibration_rotation_deg, image_width_px, image_height_px,
       map_status, is_demo, is_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.hospital_id, input.building_id, input.floor_number, input.floor_label,
    input.level_elevation_m ?? null, input.map_image_url ?? null, input.map_svg_url ?? null,
    input.map_pdf_url ?? null, input.calibration_scale_ppm ?? null,
    input.calibration_origin_x ?? null, input.calibration_origin_y ?? null,
    input.calibration_rotation_deg ?? 0, input.image_width_px ?? null,
    input.image_height_px ?? null, 'draft', 0, 1, t, t,
  );
  return getFloor(id)!;
}

export function updateFloor(id: string, input: Partial<FloorInput>): Row | undefined {
  run(
    `UPDATE floors SET
        floor_label = COALESCE(?, floor_label), level_elevation_m = COALESCE(?, level_elevation_m),
        map_image_url = COALESCE(?, map_image_url), map_svg_url = COALESCE(?, map_svg_url),
        map_pdf_url = COALESCE(?, map_pdf_url),
        calibration_scale_ppm = COALESCE(?, calibration_scale_ppm),
        calibration_origin_x = COALESCE(?, calibration_origin_x),
        calibration_origin_y = COALESCE(?, calibration_origin_y),
        calibration_rotation_deg = COALESCE(?, calibration_rotation_deg),
        image_width_px = COALESCE(?, image_width_px), image_height_px = COALESCE(?, image_height_px),
        updated_at = ? WHERE id = ?`,
    input.floor_label ?? null, input.level_elevation_m ?? null, input.map_image_url ?? null,
    input.map_svg_url ?? null, input.map_pdf_url ?? null, input.calibration_scale_ppm ?? null,
    input.calibration_origin_x ?? null, input.calibration_origin_y ?? null,
    input.calibration_rotation_deg ?? null, input.image_width_px ?? null,
    input.image_height_px ?? null, nowIso(), id,
  );
  return getFloor(id);
}

export function deleteFloor(id: string): void {
  run(`DELETE FROM floors WHERE id = ?`, id);
}

// ---- Map versions -----------------------------------------------------------

export function listMapVersions(floorId: string): Row[] {
  return all(
    `SELECT mv.*, u.display_name AS created_by_name
     FROM map_versions mv JOIN admin_users u ON u.id = mv.created_by
     WHERE mv.floor_id = ? ORDER BY mv.version_number DESC`, floorId);
}

export function getMapVersion(id: string): Row | undefined {
  return get(`SELECT * FROM map_versions WHERE id = ?`, id);
}

/** Snapshot the current graph state of a floor into a new version. */
export function createMapVersion(floorId: string, actorId: string, changeSummary: string, snapshot: unknown): Row {
  const t = nowIso();
  const floor = getFloor(floorId);
  if (!floor) throw ApiError.notFound('Floor not found');
  const max = get<{ v: number }>('SELECT COALESCE(MAX(version_number),0) AS v FROM map_versions WHERE floor_id = ?', floorId);
  const versionNumber = (max?.v ?? 0) + 1;
  const id = uuid();
  run(
    `INSERT INTO map_versions (id, floor_id, version_number, snapshot, status, change_summary, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    id, floorId, versionNumber, JSON.stringify(snapshot), 'draft', changeSummary, actorId, t,
  );
  run(`UPDATE floors SET map_version_id = ?, updated_at = ? WHERE id = ?`, id, t, floorId);
  return getMapVersion(id)!;
}

// ---- Verification & publish workflow ----------------------------------------

/**
 * Verify a map version. A verifier marks the snapshot 'verified'. Publishing is
 * a separate, explicitly-guarded step so a map never becomes public without an
 * authorized publish action.
 */
export function verifyMapVersion(floorId: string, mapVersionId: string, actorId: string, status: 'verified' | 'rejected', comments?: string): Row {
  const t = nowIso();
  const mv = getMapVersion(mapVersionId);
  if (!mv || mv.floor_id !== floorId) throw ApiError.notFound('Map version not found');
  const id = uuid();
  run(
    `INSERT INTO map_verifications (id, floor_id, map_version_id, verified_by, verification_status, comments, checked_at)
     VALUES (?,?,?,?,?,?,?)`,
    id, floorId, mapVersionId, actorId, status, comments ?? null, t,
  );
  if (status === 'verified') {
    run(`UPDATE floors SET map_verified_at = ?, map_verified_by = ?, map_status = 'verified', updated_at = ? WHERE id = ?`,
      t, actorId, t, floorId);
    run(`UPDATE map_versions SET status = 'verified' WHERE id = ?`, mapVersionId);
  } else {
    run(`UPDATE map_versions SET status = 'draft' WHERE id = ?`, mapVersionId);
    run(`UPDATE floors SET map_status = 'draft', updated_at = ? WHERE id = ?`, t, floorId);
  }
  return getMapVersion(mapVersionId)!;
}

/** Publish a verified floor map. This is the only path to make a map public. */
export function publishFloor(floorId: string, actorId: string): Row {
  const t = nowIso();
  const floor = getFloor(floorId);
  if (!floor) throw ApiError.notFound('Floor not found');
  const mv = get<{ id: string; status: string }>(
    `SELECT mv.id, mv.status FROM map_versions mv WHERE mv.floor_id = ? ORDER BY mv.version_number DESC LIMIT 1`,
    floorId);
  if (!mv) throw ApiError.badRequest('Cannot publish a floor with no map version');
  if (mv.status !== 'verified') {
    throw ApiError.forbidden('Only a verified map version can be published');
  }
  run(`UPDATE floors SET map_status = 'published', published_at = ?, updated_at = ? WHERE id = ?`, t, t, floorId);
  run(`UPDATE map_versions SET status = 'published', published_at = ?, published_by = ? WHERE id = ?`, t, actorId, mv.id);
  // reflect publication on the hospital mapping status
  run(`UPDATE hospitals SET map_verified = 1, mapping_status = CASE
        WHEN (SELECT COUNT(*) FROM floors f2 WHERE f2.hospital_id = floors.hospital_id AND f2.map_status='published') > 0
        THEN 'partially_mapped' ELSE mapping_status END,
        map_last_updated_at = ?, updated_at = ?
      WHERE id = floors.hospital_id`, t, t, floor.hospital_id);
  return getFloor(floorId)!;
}

export function unpublishFloor(floorId: string, actorId: string): Row {
  const t = nowIso();
  const floor = getFloor(floorId);
  if (!floor) throw ApiError.notFound('Floor not found');
  run(`UPDATE floors SET map_status = 'unpublished', published_at = NULL, updated_at = ? WHERE id = ?`, t, floorId);
  run(`UPDATE map_versions SET status = 'unpublished' WHERE floor_id = ? AND status = 'published'`, floorId);
  run(`UPDATE hospitals SET map_verified = 0, mapping_status = 'unmapped', updated_at = ? WHERE id = ?`, t, floor.hospital_id);
  void actorId;
  return getFloor(floorId)!;
}
