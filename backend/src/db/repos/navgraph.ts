import { all, get, run, uuid, nowIso } from '../sqlite.js';
import type { Row } from '../sqlite.js';
import { ApiError } from '../../errors.js';
import type { NavNode, NavEdge, FloorGraph, RoutingOptions, RouteResult } from '../../map/graph.js';
import { route } from '../../map/graph.js';

// ---- Navigation nodes ------------------------------------------------------

export interface NodeInput {
  floor_id: string; node_type: string; x_metres: number; y_metres: number;
  room_id?: string | null; facility_id?: string | null; accessibility?: string; label?: string; metadata?: unknown;
}

export function listNodes(floorId: string): Row[] {
  return all(
    `SELECT n.*, r.room_number, r.name AS room_name FROM navigation_nodes n
     LEFT JOIN rooms r ON r.id = n.room_id
     WHERE n.floor_id = ? ORDER BY n.node_type ASC, n.y_metres ASC, n.x_metres ASC`, floorId);
}

export function createNode(input: NodeInput): Row {
  const t = nowIso();
  const id = uuid();
  run(
    `INSERT INTO navigation_nodes (id, floor_id, node_type, x_metres, y_metres, room_id,
       facility_id, accessibility, label, metadata, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.floor_id, input.node_type, input.x_metres, input.y_metres,
    input.room_id ?? null, input.facility_id ?? null, input.accessibility ?? null,
    input.label ?? null, JSON.stringify(input.metadata ?? {}), t, t,
  );
  return get<Row>('SELECT * FROM navigation_nodes WHERE id = ?', id)!;
}

export function updateNode(id: string, input: Partial<NodeInput>): Row | undefined {
  run(
    `UPDATE navigation_nodes SET
        node_type=COALESCE(?,node_type), x_metres=COALESCE(?,x_metres),
        y_metres=COALESCE(?,y_metres), room_id=COALESCE(?,room_id),
        facility_id=COALESCE(?,facility_id), accessibility=COALESCE(?,accessibility),
        label=COALESCE(?,label), metadata=COALESCE(?,metadata), updated_at=? WHERE id=?`,
    input.node_type ?? null, input.x_metres ?? null, input.y_metres ?? null,
    input.room_id ?? null, input.facility_id ?? null, input.accessibility ?? null,
    input.label ?? null, input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
    nowIso(), id,
  );
  return get<Row>('SELECT * FROM navigation_nodes WHERE id = ?', id);
}

export function deleteNode(id: string): void {
  run(`DELETE FROM navigation_nodes WHERE id = ?`, id);
}

// ---- Navigation edges ------------------------------------------------------

export interface EdgeInput {
  floor_id: string; start_node_id: string; end_node_id: string; kind: string;
  distance_metres: number; accessibility: string; is_bidirectional?: boolean;
  one_way_direction?: string | null; is_vertical?: boolean; connects_to_floor_id?: string | null;
}

export function listEdges(floorId: string): Row[] {
  return all(
    `SELECT e.*, s.label AS start_label, s.x_metres AS sx, s.y_metres AS sy,
            t.label AS end_label, t.x_metres AS tx, t.y_metres AS ty
     FROM navigation_edges e
     JOIN navigation_nodes s ON s.id = e.start_node_id
     JOIN navigation_nodes t ON t.id = e.end_node_id
     WHERE e.floor_id = ? ORDER BY e.kind ASC`, floorId);
}

export function createEdge(input: EdgeInput): Row {
  const t = nowIso();
  const id = uuid();
  // Validate nodes exist & distance roughly matches Euclidean geometry.
  const a = get<Row>('SELECT * FROM navigation_nodes WHERE id = ?', input.start_node_id);
  const b = get<Row>('SELECT * FROM navigation_nodes WHERE id = ?', input.end_node_id);
  if (!a || !b) throw ApiError.badRequest('Both edge endpoints must be existing nodes');
  const euclidean = Math.hypot((a.x_metres as number) - (b.x_metres as number), (a.y_metres as number) - (b.y_metres as number));
  if (!input.is_vertical && Math.abs(euclidean - input.distance_metres) > 1.0) {
    throw ApiError.badRequest(
      `Edge distance ${input.distance_metres}m deviates from mapped geometry (${euclidean.toFixed(1)}m); recalibrate`,
    );
  }
  run(
    `INSERT INTO navigation_edges (id, floor_id, start_node_id, end_node_id, kind, distance_metres,
       accessibility, is_bidirectional, one_way_direction, is_vertical, connects_to_floor_id, is_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.floor_id, input.start_node_id, input.end_node_id, input.kind,
    input.distance_metres, input.accessibility, input.is_bidirectional === false ? 0 : 1,
    input.one_way_direction ?? null, input.is_vertical ? 1 : 0,
    input.connects_to_floor_id ?? null, 1, t, t,
  );
  return get<Row>('SELECT * FROM navigation_edges WHERE id = ?', id)!;
}

export function updateEdge(id: string, input: Partial<EdgeInput>): Row | undefined {
  run(
    `UPDATE navigation_edges SET
        kind=COALESCE(?,kind), distance_metres=COALESCE(?,distance_metres),
        accessibility=COALESCE(?,accessibility), is_bidirectional=COALESCE(?,is_bidirectional),
        one_way_direction=COALESCE(?,one_way_direction), is_vertical=COALESCE(?,is_vertical),
        connects_to_floor_id=COALESCE(?,connects_to_floor_id), is_active=COALESCE(?,is_active), updated_at=?
     WHERE id=?`,
    input.kind ?? null, input.distance_metres ?? null, input.accessibility ?? null,
    input.is_bidirectional !== undefined ? (input.is_bidirectional ? 1 : 0) : null,
    input.one_way_direction ?? null, input.is_vertical !== undefined ? (input.is_vertical ? 1 : 0) : null,
    input.connects_to_floor_id ?? null, null, nowIso(), id,
  );
  return get<Row>('SELECT * FROM navigation_edges WHERE id = ?', id);
}

export function deleteEdge(id: string): void {
  run(`DELETE FROM navigation_edges WHERE id = ?`, id);
}

// ---- Floor bundles (for routing + offline export) -------------------------

function toNavNode(r: Row): NavNode {
  return {
    id: r.id as string,
    floorId: r.floor_id as string,
    type: r.node_type as NavNode['type'],
    x: r.x_metres as number,
    y: r.y_metres as number,
    roomId: (r.room_id as string) ?? null,
    facilityId: (r.facility_id as string) ?? null,
    accessibility: (r.accessibility as NavNode['accessibility']) ?? null,
    label: (r.label as string) ?? null,
  };
}

function toNavEdge(r: Row): NavEdge {
  return {
    id: r.id as string,
    floorId: r.floor_id as string,
    startNodeId: r.start_node_id as string,
    endNodeId: r.end_node_id as string,
    kind: r.kind as string,
    distanceMetres: r.distance_metres as number,
    accessibility: r.accessibility as NavEdge['accessibility'],
    isBidirectional: (r.is_bidirectional as number) === 1,
    oneWayDirection: (r.one_way_direction as string) ?? null,
    isVertical: (r.is_vertical as number) === 1,
    connectsToFloorId: (r.connects_to_floor_id as string) ?? null,
    isActive: (r.is_active as number) === 1,
  };
}

/** Build a FloorGraph from the DB for a single floor. */
export function loadFloorGraph(floorId: string): FloorGraph {
  const floor = get<Row>('SELECT * FROM floors WHERE id = ?', floorId);
  if (!floor) throw ApiError.notFound('Floor not found');
  const nodeRows = all('SELECT * FROM navigation_nodes WHERE floor_id = ?', floorId);
  const edgeRows = all('SELECT * FROM navigation_edges WHERE floor_id = ? AND is_active = 1', floorId);
  return {
    floorId,
    hospitalId: floor.hospital_id as string,
    buildingId: floor.building_id as string,
    floorNumber: floor.floor_number as number,
    floorLabel: floor.floor_label as string,
    levelElevationM: (floor.level_elevation_m as number) ?? null,
    nodes: nodeRows.map(toNavNode),
    edges: edgeRows.map(toNavEdge),
  };
}

/** Load all published floor graphs for a hospital (used by patient routing). */
export function loadHospitalFloors(hospitalId: string): FloorGraph[] {
  const floors = all(`SELECT id FROM floors WHERE hospital_id = ? AND map_status = 'published' AND is_active = 1`, hospitalId);
  return floors.map((f) => loadFloorGraph(f.id as string));
}

/** Compute a route within a hospital. */
export function computeRoute(hospitalId: string, startNodeId: string, endNodeId: string, opts: RoutingOptions = {}): RouteResult {
  const floors = loadHospitalFloors(hospitalId);
  return route(floors, startNodeId, endNodeId, opts);
}

/** Build an offline-downloadable map bundle for a hospital. */
export function buildOfflineBundle(hospitalId: string) {
  const hospital = get<Row>('SELECT * FROM hospitals WHERE id = ?', hospitalId);
  if (!hospital) throw ApiError.notFound('Hospital not found');
  const floors = loadHospitalFloors(hospitalId);
  const buildings = all('SELECT * FROM buildings WHERE hospital_id = ?', hospitalId);
  return {
    hospital: {
      id: hospital.id, name: hospital.name, short_name: hospital.short_name,
      city: hospital.city, district: hospital.district, state: hospital.state,
      latitude: hospital.latitude, longitude: hospital.longitude,
      mapping_status: hospital.mapping_status, is_demo: hospital.is_demo,
    },
    buildings: buildings.map((b) => ({ id: b.id, name: b.name, code: b.code, floorCount: b.floor_count })),
    floors: floors.map((f) => ({
      floorId: f.floorId, buildingId: f.buildingId, floorNumber: f.floorNumber,
      floorLabel: f.floorLabel, levelElevationM: f.levelElevationM,
      calibration_scale_ppm: (get<Row>('SELECT calibration_scale_ppm FROM floors WHERE id = ?', f.floorId)?.calibration_scale_ppm as number) ?? null,
      calibration_origin_x: (get<Row>('SELECT calibration_origin_x FROM floors WHERE id = ?', f.floorId)?.calibration_origin_x as number) ?? null,
      calibration_origin_y: (get<Row>('SELECT calibration_origin_y FROM floors WHERE id = ?', f.floorId)?.calibration_origin_y as number) ?? null,
      calibration_rotation_deg: (get<Row>('SELECT calibration_rotation_deg FROM floors WHERE id = ?', f.floorId)?.calibration_rotation_deg as number) ?? 0,
      image_width_px: (get<Row>('SELECT image_width_px FROM floors WHERE id = ?', f.floorId)?.image_width_px as number) ?? null,
      image_height_px: (get<Row>('SELECT image_height_px FROM floors WHERE id = ?', f.floorId)?.image_height_px as number) ?? null,
      nodes: f.nodes,
      edges: f.edges,
    })),
    generated_at: nowIso(),
  };
}
