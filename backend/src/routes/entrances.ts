import { Router } from 'express';
import { z } from 'zod';
import { wrap, parse } from '../http.js';
import { authenticate, requirePermission, requireHospitalAccess, audit } from '../auth/middleware.js';
import { listEntrances, listExits, createEntrance, createExit, deleteEntrance, deleteExit } from '../db/repos/entrances.js';

export const entranceRouter = Router({ mergeParams: true });
entranceRouter.use(authenticate);

const entranceSchema = z.object({
  building_id: z.string().uuid(), floor_id: z.string().uuid(), node_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1), kind: z.enum(['public', 'main', 'emergency', 'staff', 'service']).optional(),
  latitude: z.number().optional(), longitude: z.number().optional(),
  x_metres: z.number().optional(), y_metres: z.number().optional(),
  is_emergency: z.boolean().optional(), is_accessible: z.boolean().optional(),
  verification_status: z.enum(['unverified', 'verified', 'rejected', 'deprecated']).optional(),
});

entranceRouter.post('/:hospitalId/floors/:floorId/entrances', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(entranceSchema, req.body);
  const created = createEntrance({ hospital_id: req.params.hospitalId, ...body });
  audit(req.admin!, 'entrance.create', { entityType: 'entrance', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

entranceRouter.delete('/:hospitalId/entrances/:entranceId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  deleteEntrance(req.params.entranceId);
  audit(req.admin!, 'entrance.delete', { entityType: 'entrance', entityId: req.params.entranceId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

entranceRouter.post('/:hospitalId/floors/:floorId/exits', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(entranceSchema, req.body);
  const created = createExit({ hospital_id: req.params.hospitalId, ...body });
  audit(req.admin!, 'exit.create', { entityType: 'exit', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

entranceRouter.delete('/:hospitalId/exits/:exitId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  deleteExit(req.params.exitId);
  audit(req.admin!, 'exit.delete', { entityType: 'exit', entityId: req.params.exitId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));
