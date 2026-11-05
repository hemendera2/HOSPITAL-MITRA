import { Router } from 'express';
import { z } from 'zod';
import { all } from '../db/sqlite.js';
import { wrap, parse } from '../http.js';
import { ApiError } from '../errors.js';
import { authenticate, requirePermission, requireHospitalAccess, audit } from '../auth/middleware.js';
import {
  listHospitals, getHospital, createHospital, updateHospital, deleteHospital, setMappingStatus,
} from '../db/repos/hospitals.js';
import {
  listBuildings, createBuilding, updateBuilding, deleteBuilding,
} from '../db/repos/buildings.js';
import {
  listFloors, createFloor, updateFloor, deleteFloor,
  listMapVersions, createMapVersion, verifyMapVersion, publishFloor, unpublishFloor,
} from '../db/repos/floors.js';
import { listDepartments, createDepartment, updateDepartment, deleteDepartment } from '../db/repos/rooms.js';
import { listFacilities, createFacility, listDoctors, createDoctor } from '../db/repos/rooms.js';
import { listRooms, createRoom, updateRoom, deleteRoom, setRoomVerification } from '../db/repos/rooms.js';
import { validateCalibration } from '../map/calibration.js';

export const hospitalRouter = Router();

// All admin hospital routes require authentication.
hospitalRouter.use(authenticate);

// ---- Hospitals -------------------------------------------------------------

hospitalRouter.get('/', wrap(async (req, res) => {
  res.json({ hospitals: listHospitals({ search: (req.query.search as string) || undefined, city: (req.query.city as string) || undefined, includeDemo: (req.query.demo as string) !== '0' }) });
}));

const hospitalSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().optional(),
  city: z.string().min(1),
  district: z.string().min(1),
  state: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone_emergency: z.string().optional(),
  hospital_type: z.string().optional(),
  bed_count: z.number().int().positive().optional(),
  mapping_status: z.enum(['unmapped', 'mapping_planned', 'partially_mapped', 'fully_mapped']).optional(),
});

hospitalRouter.post('/', requirePermission('hospital:manage'), wrap(async (req, res) => {
  const body = parse(hospitalSchema, req.body);
  const created = createHospital(body);
  audit(req.admin!, 'hospital.create', { entityType: 'hospital', entityId: created.id, hospitalId: created.id, details: body });
  res.status(201).json(created);
}));

hospitalRouter.get('/:id', requireHospitalAccess, wrap(async (req, res) => {
  const hospital = getHospital(req.params.id);
  if (!hospital) throw ApiError.notFound('Hospital not found');
  res.json({
    hospital,
    buildings: listBuildings(req.params.id),
    floors: listFloors(req.params.id),
    departments: listDepartments(req.params.id),
    facilities: listFacilities(req.params.id),
    doctors: listDoctors(req.params.id),
  });
}));

hospitalRouter.get('/:hospitalId/buildings', requireHospitalAccess, wrap(async (req, res) => {
  res.json({ buildings: listBuildings(req.params.hospitalId) });
}));

hospitalRouter.get('/:hospitalId/floors', requireHospitalAccess, wrap(async (req, res) => {
  res.json({ floors: listFloors(req.params.hospitalId) });
}));

hospitalRouter.patch('/:id', requirePermission('hospital:manage'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(hospitalSchema.partial(), req.body);
  const updated = updateHospital(req.params.id, body);
  audit(req.admin!, 'hospital.update', { entityType: 'hospital', entityId: req.params.id, hospitalId: req.params.id, details: body });
  res.json(updated);
}));

hospitalRouter.delete('/:id', requirePermission('hospital:manage'), wrap(async (req, res) => {
  deleteHospital(req.params.id);
  audit(req.admin!, 'hospital.delete', { entityType: 'hospital', entityId: req.params.id, hospitalId: req.params.id });
  res.json({ ok: true });
}));

// ---- Buildings -------------------------------------------------------------

const buildingSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

hospitalRouter.post('/:hospitalId/buildings', requirePermission('hospital:manage'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(buildingSchema, req.body);
  const created = createBuilding(req.params.hospitalId, body);
  audit(req.admin!, 'building.create', { entityType: 'building', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

hospitalRouter.patch('/:hospitalId/buildings/:buildingId', requirePermission('hospital:manage'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(buildingSchema.partial(), req.body);
  res.json(updateBuilding(req.params.buildingId, body));
}));

hospitalRouter.delete('/:hospitalId/buildings/:buildingId', requirePermission('hospital:manage'), requireHospitalAccess, wrap(async (req, res) => {
  deleteBuilding(req.params.buildingId);
  audit(req.admin!, 'building.delete', { entityType: 'building', entityId: req.params.buildingId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

// ---- Floors ----------------------------------------------------------------

const floorSchema = z.object({
  hospital_id: z.string().uuid(),
  building_id: z.string().uuid(),
  floor_number: z.number().int().positive(),
  floor_label: z.string().min(1),
  level_elevation_m: z.number().optional(),
  map_image_url: z.string().optional(),
  map_svg_url: z.string().optional(),
  map_pdf_url: z.string().optional(),
  calibration_scale_ppm: z.number().positive().optional(),
  calibration_origin_x: z.number().optional(),
  calibration_origin_y: z.number().optional(),
  calibration_rotation_deg: z.number().optional(),
  image_width_px: z.number().int().positive().optional(),
  image_height_px: z.number().int().positive().optional(),
});

hospitalRouter.post('/:hospitalId/floors', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(floorSchema, req.body);
  if (body.calibration_scale_ppm !== undefined || body.calibration_origin_x !== undefined) {
    const cal = validateCalibration({
      scalePpm: body.calibration_scale_ppm ?? 100,
      originX: body.calibration_origin_x ?? 0,
      originY: body.calibration_origin_y ?? 0,
      rotationDeg: body.calibration_rotation_deg ?? 0,
      imageWidthPx: body.image_width_px ?? 0,
      imageHeightPx: body.image_height_px ?? 0,
    });
    if (!cal.ok) throw ApiError.badRequest(`Invalid calibration: ${cal.error}`);
  }
  const created = createFloor(body);
  audit(req.admin!, 'floor.create', { entityType: 'floor', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

hospitalRouter.patch('/:hospitalId/floors/:floorId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(floorSchema.partial(), req.body);
  res.json(updateFloor(req.params.floorId, body));
}));

hospitalRouter.delete('/:hospitalId/floors/:floorId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  deleteFloor(req.params.floorId);
  audit(req.admin!, 'floor.delete', { entityType: 'floor', entityId: req.params.floorId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

// ---- Map versions, verification, publish ----------------------------------

hospitalRouter.get('/:hospitalId/floors/:floorId/versions', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json({ versions: listMapVersions(req.params.floorId) });
}));

const versionSchema = z.object({ change_summary: z.string().optional() });

hospitalRouter.post('/:hospitalId/floors/:floorId/versions', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(versionSchema, req.body);
  // Snapshot = current nodes + edges + rooms of the floor.
  const snapshot = {
    nodes: allNodes(req.params.floorId),
    edges: allEdges(req.params.floorId),
  };
  const created = createMapVersion(req.params.floorId, req.admin!.id, body.change_summary ?? 'New version', snapshot);
  audit(req.admin!, 'map_version.create', { entityType: 'map_version', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

const verifySchema = z.object({
  map_version_id: z.string().uuid(),
  status: z.enum(['verified', 'rejected']),
  comments: z.string().optional(),
});

hospitalRouter.post('/:hospitalId/floors/:floorId/verify', requirePermission('map:verify'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(verifySchema, req.body);
  const result = verifyMapVersion(req.params.floorId, body.map_version_id, req.admin!.id, body.status, body.comments);
  audit(req.admin!, 'map.verify', { entityType: 'map_version', entityId: body.map_version_id, hospitalId: req.params.hospitalId, details: { status: body.status, comments: body.comments } });
  res.json(result);
}));

hospitalRouter.post('/:hospitalId/floors/:floorId/publish', requirePermission('map:publish'), requireHospitalAccess, wrap(async (req, res) => {
  const result = publishFloor(req.params.floorId, req.admin!.id);
  audit(req.admin!, 'map.publish', { entityType: 'floor', entityId: req.params.floorId, hospitalId: req.params.hospitalId });
  res.json(result);
}));

hospitalRouter.post('/:hospitalId/floors/:floorId/unpublish', requirePermission('map:publish'), requireHospitalAccess, wrap(async (req, res) => {
  const result = unpublishFloor(req.params.floorId, req.admin!.id);
  audit(req.admin!, 'map.unpublish', { entityType: 'floor', entityId: req.params.floorId, hospitalId: req.params.hospitalId });
  res.json(result);
}));

// ---- Departments / Rooms / Facilities / Doctors ---------------------------

hospitalRouter.get('/:hospitalId/departments', wrap(async (req, res) => res.json({ departments: listDepartments(req.params.hospitalId) })));

const deptSchema = z.object({
  name: z.string().min(1), name_hi: z.string().optional(),
  category: z.string().optional(), short_code: z.string().optional(), operating_hours: z.string().optional(),
});

hospitalRouter.post('/:hospitalId/departments', requirePermission('department:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(deptSchema, req.body);
  const created = createDepartment(req.params.hospitalId, body);
  audit(req.admin!, 'department.create', { entityType: 'department', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

hospitalRouter.patch('/:hospitalId/departments/:deptId', requirePermission('department:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json(updateDepartment(req.params.deptId, parse(deptSchema.partial(), req.body)));
}));

hospitalRouter.delete('/:hospitalId/departments/:deptId', requirePermission('department:edit'), requireHospitalAccess, wrap(async (req, res) => {
  deleteDepartment(req.params.deptId);
  audit(req.admin!, 'department.delete', { entityType: 'department', entityId: req.params.deptId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

hospitalRouter.get('/:hospitalId/floors/:floorId/rooms', wrap(async (req, res) => res.json({ rooms: listRooms(req.params.floorId) })));

const roomSchema = z.object({
  hospital_id: z.string().uuid(), building_id: z.string().uuid(), floor_id: z.string().uuid(),
  room_number: z.string().min(1), name: z.string().optional(), name_hi: z.string().optional(),
  department_id: z.string().uuid().optional().nullable(), category: z.string().optional(),
  x_centroid: z.number().optional(), y_centroid: z.number().optional(),
  verification_status: z.enum(['unverified', 'verified', 'rejected', 'deprecated']).optional(),
  operating_info: z.string().optional(),
});

hospitalRouter.post('/:hospitalId/floors/:floorId/rooms', requirePermission('room:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(roomSchema, req.body);
  const created = createRoom({ ...body, geometry: {} });
  audit(req.admin!, 'room.create', { entityType: 'room', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

hospitalRouter.patch('/:hospitalId/rooms/:roomId', requirePermission('room:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json(updateRoom(req.params.roomId, parse(roomSchema.partial(), req.body)));
}));

hospitalRouter.delete('/:hospitalId/rooms/:roomId', requirePermission('room:edit'), requireHospitalAccess, wrap(async (req, res) => {
  deleteRoom(req.params.roomId);
  audit(req.admin!, 'room.delete', { entityType: 'room', entityId: req.params.roomId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

hospitalRouter.patch('/:hospitalId/rooms/:roomId/verify', requirePermission('map:verify'), requireHospitalAccess, wrap(async (req, res) => {
  const status = (req.query.status as string) || 'verified';
  setRoomVerification(req.params.roomId, ['verified', 'rejected', 'deprecated'].includes(status) ? status : 'verified');
  audit(req.admin!, 'room.verify', { entityType: 'room', entityId: req.params.roomId, hospitalId: req.params.hospitalId, details: { status } });
  res.json({ ok: true });
}));

const facilitySchema = z.object({
  building_id: z.string().uuid().optional().nullable(), floor_id: z.string().uuid().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(), name: z.string().min(1), name_hi: z.string().optional(),
  facility_type: z.string().min(1), x_metres: z.number().optional(), y_metres: z.number().optional(),
  operating_info: z.string().optional(),
});

hospitalRouter.post('/:hospitalId/facilities', requirePermission('room:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(facilitySchema, req.body);
  const created = createFacility(req.params.hospitalId, body);
  audit(req.admin!, 'facility.create', { entityType: 'facility', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

const doctorSchema = z.object({
  department_id: z.string().uuid().optional().nullable(), name: z.string().min(1),
  qualifications: z.string().optional(), specialization: z.string().optional(),
  registration_number: z.string().optional(), room_id: z.string().uuid().optional().nullable(),
});

hospitalRouter.post('/:hospitalId/doctors', requirePermission('department:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(doctorSchema, req.body);
  const created = createDoctor(req.params.hospitalId, body);
  audit(req.admin!, 'doctor.create', { entityType: 'doctor', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

// Helpers to snapshot nodes/edges for map version snapshots.
function allNodes(floorId: string) {
  return all('SELECT id, floor_id, node_type, x_metres, y_metres, room_id, facility_id, accessibility, label, metadata FROM navigation_nodes WHERE floor_id = ?', floorId);
}
function allEdges(floorId: string) {
  return all('SELECT id, floor_id, start_node_id, end_node_id, kind, distance_metres, accessibility, is_bidirectional, one_way_direction, is_vertical, connects_to_floor_id, is_active FROM navigation_edges WHERE floor_id = ?', floorId);
}
