// API client for the Hospital Mitra backend. Talks to the same origin in dev
// (vite proxy) and can be pointed at any base URL via VITE_API_BASE.

const BASE = import.meta.env.VITE_API_BASE || '';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

let token: string | null = null;
const TOKEN_KEY = 'mitra_token';
export function setToken(t: string | null) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* SSR / private mode */ }
}
export function getToken() {
  if (token) return token;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = data.error || {};
    throw new ApiError(res.status, err.code || 'error', err.message || 'Request failed', err.details);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T,>(path: string) => request<T>('DELETE', path),
};

// ---- Types ----
export interface Hospital {
  id: string; name: string; short_name?: string; city: string; district: string; state: string;
  address?: string; latitude?: number; longitude?: number; phone_emergency?: string;
  hospital_type?: string; bed_count?: number; mapping_status: string; map_verified: number;
  map_last_updated_at?: string; is_demo: number; is_active: number; building_count?: number; published_floors?: number;
}
export interface Building { id: string; hospital_id: string; name: string; code?: string; latitude?: number; longitude?: number; floor_count: number; }
export interface Floor {
  id: string; hospital_id: string; building_id: string; floor_number: number; floor_label: string;
  level_elevation_m?: number; map_image_url?: string; map_status: string; is_demo: number;
  calibration_scale_ppm?: number; calibration_origin_x?: number; calibration_origin_y?: number;
  calibration_rotation_deg?: number; image_width_px?: number; image_height_px?: number;
  map_verified_at?: string; published_at?: string; building_name?: string;
}
export interface Department { id: string; hospital_id: string; name: string; name_hi?: string; category?: string; short_code?: string; room_count?: number; }
export interface Room {
  id: string; hospital_id: string; building_id: string; floor_id: string; room_number: string;
  name?: string; name_hi?: string; department_id?: string | null; category?: string;
  x_centroid?: number; y_centroid?: number; verification_status: string; operating_info?: string; is_demo: number;
  department_name?: string;
}
export interface Facility { id: string; hospital_id: string; name: string; name_hi?: string; facility_type: string; floor_id?: string; room_id?: string; x_metres?: number; y_metres?: number; verification_status: string; }
export interface Doctor { id: string; hospital_id: string; name: string; department_id?: string; specialization?: string; qualifications?: string; registration_number?: string; room_id?: string; verification_status: string; department_name?: string; room_number?: string; }
export interface NavNode {
  id: string; floor_id: string; node_type: string; x_metres: number; y_metres: number;
  room_id?: string | null; facility_id?: string | null; accessibility?: string; label?: string;
}
export interface NavEdge {
  id: string; floor_id: string; start_node_id: string; end_node_id: string; kind: string;
  distance_metres: number; accessibility: string; is_bidirectional: number; is_vertical: number;
  connects_to_floor_id?: string | null; is_active: number;
}
export interface QrLocation {
  id: string; hospital_id: string; building_id: string; floor_id: string; room_id?: string; node_id?: string;
  location_identifier: string; label: string; x_metres?: number; y_metres?: number; verification_status: string;
  room_number?: string; floor_label?: string;
}
export interface Feedback { id: string; hospital_id: string; category: string; description: string; status: string; created_at: string; reviewed_by_name?: string; resolution_note?: string; }
export interface AuditLog { id: string; actor_role: string; action: string; entity_type?: string; created_at: string; actor_name?: string; details: string; }
export interface AdminUser { id: string; email: string; display_name: string; role_id: string; role_key: string; role_name: string; role?: string; hospital_id?: string | null; is_active: number; }
export interface AdminRole { id: string; role_key: string; name: string; description?: string; permissions: string; }
export interface MapVersion { id: string; floor_id: string; version_number: number; status: string; change_summary?: string; created_at: string; created_by_name?: string; }
export interface HospitalDetail {
  hospital: Hospital; buildings: Building[]; floors: Floor[]; departments: Department[]; facilities: Facility[]; doctors: Doctor[];
}
export interface FloorGraph {
  floorId: string; hospitalId: string; buildingId: string; floorNumber: number; floorLabel: string;
  levelElevationM: number | null; nodes: NavNode[]; edges: NavEdge[];
}
export interface FloorGraphResponse { floorGraph: FloorGraph; rooms: Room[]; entrances: unknown[]; exits: unknown[]; }
export interface RouteResult {
  found: boolean; startNodeId: string; endNodeId: string; startFloorId: string; endFloorId: string;
  totalDistanceMetres: number; estimatedWalkingTimeSeconds: number; steps: { fromNodeId: string; toNodeId: string; floorId: string; kind: string; distanceMetres: number; instruction: string; instructionHindi: string; accessibility: string; isVertical: boolean; toFloorLabel?: string }[];
  pathNodeIds: string[]; accessible: boolean; algorithm: string;
}
