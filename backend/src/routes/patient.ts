import { Router } from 'express';
import { wrap } from '../http.js';
import { ApiError } from '../errors.js';
import { listHospitals, getHospital } from '../db/repos/hospitals.js';
import { listBuildings } from '../db/repos/buildings.js';
import { listFloors } from '../db/repos/floors.js';
import { listDepartments, listDoctors } from '../db/repos/rooms.js';
import { listFacilities } from '../db/repos/rooms.js';
import { listRooms } from '../db/repos/rooms.js';
import { listNodes } from '../db/repos/navgraph.js';
import { computeRoute, buildOfflineBundle, loadHospitalFloors } from '../db/repos/navgraph.js';
import { z } from 'zod';
import { parse } from '../http.js';

// Smart search synonyms (English + Hindi transliterations). Each canonical
// intent maps to a list of tokens matched against departments, rooms,
// facilities and doctors. Extend freely — this is the patient-facing NLU.
const SYNONYMS: Record<string, string[]> = {
  registration: ['registration', 'register', 'registration counter', 'पंजीकरण', ' mendaftar', 'admission'],
  pharmacy: ['pharmacy', 'medical store', 'drugstore', 'फार्मेसी', 'दवाखाना'],
  emergency: ['emergency', 'accident', 'trauma', 'caul', 'casualty', 'आपतकालीन', 'ईंधन'],
  opd: ['opd', 'outpatient', 'outpatient department', 'क缅िड', 'out patient'],
  laboratory: ['laboratory', 'lab', 'pathology', 'test', 'blood test', 'urine test', 'परीक्षणशाला', 'लैब', 'अभ्यास'],
  diagnostic: ['diagnostic', 'xray', 'x-ray', 'ct scan', 'scan', 'ultrasound', 'निदान'],
  ward: ['ward', 'icu', 'emergency ward', 'stay', 'वेर्ड', 'आवर'],
  lift: ['lift', 'elevator', 'ลิफ्ट'],
  stairs: ['stairs', 'staircase', 'stairs', 'सीढ़ियाँ'],
  doctor: ['doctor', 'dr', 'physician', 'specialist', 'doctor', 'चिकित्सक'],
  room: ['room', 'कमरा'],
  entrance: ['entrance', 'entry', 'ra entry', 'दरवाज़ा'],
  exit: ['exit', 'ra exit', 'خروج'],
};

function expandQuery(q: string): { intents: string[]; terms: string[] } {
  const lower = q.trim().toLowerCase();
  const intents: string[] = [];
  for (const [intent, tokens] of Object.entries(SYNONYMS)) {
    if (tokens.some((t) => lower.includes(t.toLowerCase()))) intents.push(intent);
  }
  return { intents, terms: [lower] };
}

export const patientRouter = Router();

// Public hospital directory (demo flagged).
patientRouter.get('/hospitals', wrap(async (req, res) => {
  const search = (req.query.search as string) || undefined;
  const city = (req.query.city as string) || undefined;
  const hospitals = listHospitals({ search, city, includeDemo: true }).map((h) => ({
    ...h,
    building_count: h.building_count,
    published_floors: h.published_floors,
  }));
  res.json({ hospitals });
}));

patientRouter.get('/hospitals/:id', wrap(async (req, res) => {
  const hospital = getHospital(req.params.id);
  if (!hospital) throw ApiError.notFound('Hospital not found');
  res.json({
    hospital: {
      id: hospital.id, name: hospital.name, short_name: hospital.short_name,
      city: hospital.city, district: hospital.district, state: hospital.state,
      address: hospital.address, latitude: hospital.latitude, longitude: hospital.longitude,
      phone_emergency: hospital.phone_emergency, hospital_type: hospital.hospital_type,
      mapping_status: hospital.mapping_status, map_verified: hospital.map_verified,
      map_last_updated_at: hospital.map_last_updated_at, is_demo: hospital.is_demo,
    },
    buildings: listBuildings(req.params.id).map((b) => ({
      id: b.id, name: b.name, code: b.code, latitude: b.latitude, longitude: b.longitude, floor_count: b.floor_count,
    })),
    floors: listFloors(req.params.id).filter((f) => f.map_status === 'published').map((f) => ({
      id: f.id, building_id: f.building_id, floor_number: f.floor_number, floor_label: f.floor_label,
      level_elevation_m: f.level_elevation_m, map_status: f.map_status, is_demo: f.is_demo,
    })),
    departments: listDepartments(req.params.id).map((d) => ({
      id: d.id, name: d.name, name_hi: d.name_hi, category: d.category, short_code: d.short_code,
    })),
    facilities: listFacilities(req.params.id).filter((f) => f.verification_status === 'verified').map((f) => ({
      id: f.id, name: f.name, name_hi: f.name_hi, facility_type: f.facility_type,
      floor_id: f.floor_id, room_id: f.room_id, x_metres: f.x_metres, y_metres: f.y_metres,
    })),
    doctors: listDoctors(req.params.id).filter((d) => d.verification_status === 'verified').map((d) => ({
      id: d.id, name: d.name, department_id: d.department_id, specialization: d.specialization,
      qualifications: d.qualifications, room_id: d.room_id,
    })),
  });
}));

// Smart search across the hospital's verified content.
patientRouter.get('/hospitals/:id/search', wrap(async (req, res) => {
  const q = (req.query.q as string) || '';
  if (q.trim().length === 0) return res.json({ results: [], intents: [] });
  const { intents } = expandQuery(q);
  const lower = q.trim().toLowerCase();
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length ? v : undefined);
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

  const results: { type: string; id: string; label: string; label_hi?: string; floor_id?: string; room_number?: string; category?: string; x?: number; y?: number }[] = [];

  // rooms
  const floors = listFloors(req.params.id);
  for (const f of floors) {
    if (f.map_status !== 'published') continue;
    for (const r of listRooms(f.id as string)) {
      const hay = `${str(r.room_number)} ${str(r.name)} ${str(r.name_hi)} ${str(r.category)}`.toLowerCase();
      if (hay.includes(lower)) {
        results.push({ type: 'room', id: r.id as string, label: str(r.name) ?? str(r.room_number) ?? 'Room', label_hi: str(r.name_hi), floor_id: r.floor_id as string, room_number: str(r.room_number), category: str(r.category), x: num(r.x_centroid), y: num(r.y_centroid) });
      }
    }
  }
  // departments
  for (const d of listDepartments(req.params.id)) {
    const hay = `${str(d.name)} ${str(d.name_hi)} ${str(d.category)}`.toLowerCase();
    if (hay.includes(lower)) {
      results.push({ type: 'department', id: d.id as string, label: str(d.name) ?? 'Department', label_hi: str(d.name_hi), category: str(d.category) });
    }
  }
  // facilities
  for (const f of listFacilities(req.params.id)) {
    const hay = `${str(f.name)} ${str(f.name_hi)} ${str(f.facility_type)}`.toLowerCase();
    if (hay.includes(lower)) {
      results.push({ type: 'facility', id: f.id as string, label: str(f.name) ?? 'Facility', label_hi: str(f.name_hi), floor_id: f.floor_id as string | undefined, category: str(f.facility_type) });
    }
  }
  // doctors
  for (const d of listDoctors(req.params.id)) {
    const hay = `${str(d.name)} ${str(d.specialization)} ${str(d.qualifications)}`.toLowerCase();
    if (hay.includes(lower)) {
      results.push({ type: 'doctor', id: d.id as string, label: str(d.name) ?? 'Doctor', category: str(d.specialization) });
    }
  }
  // intent-based results (e.g. "emergency" -> emergency room/entrance/facility)
  if (intents.includes('emergency')) {
    for (const f of floors) {
      if (f.map_status !== 'published') continue;
      for (const r of listRooms(f.id as string)) {
        if ((str(r.category) ?? '').toLowerCase() === 'emergency' || (str(r.name) ?? '').toLowerCase() === 'emergency') {
          if (!results.some((x) => x.id === r.id)) {
            results.push({ type: 'room', id: r.id as string, label: str(r.name) ?? str(r.room_number) ?? 'Emergency', floor_id: r.floor_id as string, room_number: str(r.room_number), category: 'Emergency', x: num(r.x_centroid), y: num(r.y_centroid) });
          }
        }
      }
    }
  }

  res.json({ results: results.slice(0, 50), intents });
}));

// Floor graph for the patient app (published only).
patientRouter.get('/hospitals/:id/floors/:floorId/graph', wrap(async (req, res) => {
  const floors = loadHospitalFloors(req.params.id);
  const graph = floors.find((f) => f.floorId === req.params.floorId);
  if (!graph) throw ApiError.notFound('Floor not found or not published');
  res.json({ floorGraph: graph, rooms: listRooms(req.params.floorId) });
}));

// Public routing (published graphs only).
const publicRouteSchema = z.object({
  start_node_id: z.string().uuid(),
  end_node_id: z.string().uuid(),
  wheelchair_only: z.boolean().optional(),
});

patientRouter.post('/hospitals/:id/route', wrap(async (req, res) => {
  const body = parse(publicRouteSchema, req.body);
  const result = computeRoute(req.params.id, body.start_node_id, body.end_node_id, {
    wheelchairOnly: body.wheelchair_only,
  });
  if (!result.found) throw ApiError.badRequest('No route exists between the selected nodes');
  res.json(result);
}));

// Offline map bundle download.
patientRouter.get('/hospitals/:id/offline-bundle', wrap(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(buildOfflineBundle(req.params.id));
}));

// List navigation nodes on a published floor (for QR/manual start point selection).
patientRouter.get('/hospitals/:id/floors/:floorId/nodes', wrap(async (req, res) => {
  const floors = loadHospitalFloors(req.params.id);
  if (!floors.some((f) => f.floorId === req.params.floorId)) throw ApiError.notFound('Floor not published');
  res.json({ nodes: listNodes(req.params.floorId) });
}));
