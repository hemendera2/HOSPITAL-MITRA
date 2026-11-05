import { Router } from 'express';
import { wrap } from '../http.js';
import { authenticate, requirePermission } from '../auth/middleware.js';
import { listAuditLogs } from '../db/repos/users.js';

export const auditRouter = Router({ mergeParams: true });
auditRouter.use(authenticate);

auditRouter.get('/:hospitalId/audit', requirePermission('audit:read'), wrap(async (req, res) => {
  res.json({ logs: listAuditLogs(req.params.hospitalId, 200) });
}));
