import { Router } from 'express';
import { z } from 'zod';
import { wrap, parse } from '../http.js';
import { authenticate, requirePermission, requireHospitalAccess, audit } from '../auth/middleware.js';
import { listFeedback, createFeedback, reviewFeedback } from '../db/repos/feedback.js';

export const feedbackRouter = Router({ mergeParams: true });
feedbackRouter.use(authenticate);

feedbackRouter.get('/:hospitalId/feedback', requirePermission('feedback:read'), requireHospitalAccess, wrap(async (req, res) => {
  const status = (req.query.status as string) || undefined;
  res.json({ feedback: listFeedback(req.params.hospitalId, status) });
}));

const feedbackSchema = z.object({
  floor_id: z.string().uuid().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  category: z.enum(['room_location', 'department_location', 'facility', 'route_blocked', 'accessibility', 'qr_issue', 'data_error', 'other']),
  description: z.string().min(1),
  contact_hint: z.string().optional(),
});

/** Public submission endpoint (patient / staff). Requires no auth. */
export const feedbackPublicRouter = Router();
feedbackPublicRouter.post('/hospitals/:hospitalId/feedback', wrap(async (req, res) => {
  const body = parse(feedbackSchema, req.body);
  const created = createFeedback(req.params.hospitalId, body);
  res.status(201).json({ id: created.id, status: created.status });
}));

const reviewSchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'rejected']),
  resolution_note: z.string().optional(),
});

feedbackRouter.post('/:hospitalId/feedback/:feedbackId/review', requirePermission('feedback:review'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(reviewSchema, req.body);
  const updated = reviewFeedback(req.params.feedbackId, req.admin!.id, body.status, body.resolution_note);
  audit(req.admin!, 'feedback.review', { entityType: 'user_feedback', entityId: req.params.feedbackId, hospitalId: req.params.hospitalId, details: body });
  res.json(updated);
}));
