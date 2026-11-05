import { Router } from 'express';
import { z } from 'zod';
import { wrap, parse } from '../http.js';
import { ApiError } from '../errors.js';
import { authenticate, requirePermission, requireHospitalAccess, audit } from '../auth/middleware.js';
import { listQrLocations, createQrLocation, deleteQrLocation, setQrVerification } from '../db/repos/qr.js';
import {
  buildIdentifier, generateQrDataUrl, isValidIdentifier, resolveIdentifier, assertNoDuplicate,
} from '../map/qr.js';

export const qrRouter = Router({ mergeParams: true });
qrRouter.use(authenticate);

qrRouter.get('/:hospitalId/qr', requirePermission('qr:generate'), requireHospitalAccess, wrap(async (req, res) => {
  res.json({ locations: listQrLocations(req.params.hospitalId) });
}));

const qrSchema = z.object({
  building_id: z.string().uuid(), floor_id: z.string().uuid(),
  room_id: z.string().uuid().optional().nullable(), node_id: z.string().uuid().optional().nullable(),
  label: z.string().min(1),
  // either an explicit identifier, or auto-generated from slot+sequence
  location_identifier: z.string().optional(),
  slot: z.string().optional(),
  sequence: z.number().int().positive().optional(),
  x_metres: z.number().optional(), y_metres: z.number().optional(),
  verification_status: z.enum(['unverified', 'verified', 'rejected', 'deprecated']).optional(),
});

qrRouter.post('/:hospitalId/qr', requirePermission('qr:generate'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(qrSchema, req.body);
  const hospital = await import('../db/repos/hospitals.js').then((m) => m.getHospital(req.params.hospitalId));
  const short = (hospital?.short_name as string)?.toUpperCase() ?? 'MITRA';

  let identifier = body.location_identifier;
  if (!identifier) {
    const floor = body.floor_id;
    const letter = floor.slice(-1).toUpperCase(); // not ideal; prefer DB floor_label
    identifier = buildIdentifier({
      hospitalShort: short,
      floorLetter: letter,
      slot: (body.slot ?? body.label.slice(0, 3)).toUpperCase(),
      sequence: body.sequence ?? 1,
    });
  }
  if (!isValidIdentifier(identifier)) {
    throw ApiError.badRequest(`Generated identifier "${identifier}" is not valid`);
  }
  identifier = identifier.toUpperCase();
  assertNoDuplicate(identifier, req.params.hospitalId);

  const created = createQrLocation({
    hospital_id: req.params.hospitalId, building_id: body.building_id, floor_id: body.floor_id,
    room_id: body.room_id, node_id: body.node_id, location_identifier: identifier,
    label: body.label, x_metres: body.x_metres, y_metres: body.y_metres,
    verification_status: body.verification_status,
  });
  const dataUrl = await generateQrDataUrl(identifier);
  audit(req.admin!, 'qr.create', { entityType: 'qr_location', entityId: created.id, hospitalId: req.params.hospitalId, details: { identifier } });
  res.status(201).json({ ...created, qr_data_url: dataUrl });
}));

qrRouter.patch('/:hospitalId/qr/:qrId/verify', requirePermission('map:verify'), requireHospitalAccess, wrap(async (req, res) => {
  const status = (req.query.status as string) || 'verified';
  setQrVerification(req.params.qrId, ['verified', 'rejected', 'deprecated'].includes(status) ? status : 'verified');
  audit(req.admin!, 'qr.verify', { entityType: 'qr_location', entityId: req.params.qrId, hospitalId: req.params.hospitalId, details: { status } });
  res.json({ ok: true });
}));

qrRouter.delete('/:hospitalId/qr/:qrId', requirePermission('qr:generate'), requireHospitalAccess, wrap(async (req, res) => {
  deleteQrLocation(req.params.qrId);
  audit(req.admin!, 'qr.delete', { entityType: 'qr_location', entityId: req.params.qrId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

/** Public endpoint: resolve a scanned identifier to a verified location. */
export const qrResolveRouter = Router();
qrResolveRouter.get('/qr/resolve/:identifier', wrap(async (req, res) => {
  const hospitalId = (req.query.hospital_id as string) || undefined;
  try {
    const location = resolveIdentifier(req.params.identifier, hospitalId);
    res.json({ location });
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code) {
      throw ApiError.badRequest(e.message);
    }
    throw e;
  }
}));

qrResolveRouter.get('/qr/validate/:identifier', wrap(async (req, res) => {
  res.json({ valid: isValidIdentifier(req.params.identifier) });
}));
