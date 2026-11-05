import { Router } from 'express';
import { z } from 'zod';
import { wrap, parse } from '../http.js';
import { ApiError } from '../errors.js';
import { authenticate, requirePermission, requireHospitalAccess, audit } from '../auth/middleware.js';
import {
  listNodes, createNode, updateNode, deleteNode,
  listEdges, createEdge, updateEdge, deleteEdge,
  computeRoute, buildOfflineBundle, loadFloorGraph,
} from '../db/repos/navgraph.js';
import { listRooms } from '../db/repos/rooms.js';
import { listEntrances, listExits } from '../db/repos/entrances.js';

export const mapRouter = Router({ mergeParams: true });

mapRouter.use(authenticate);

// ---- Navigation nodes ------------------------------------------------------

const nodeSchema = z.object({
  floor_id: z.string().uuid(),
  node_type: z.enum(['junction', 'room', 'entrance', 'exit', 'stair', 'lift', 'escalator', 'ramp', 'emergency', 'info_point', 'corridor_end']),
  x_metres: z.number(),
  y_metres: z.number(),
  room_id: z.string().uuid().optional().nullable(),
  facility_id: z.string().uuid().optional().nullable(),
  accessibility: z.enum(['wheelchair_accessible', 'step_free', 'stairs_only', 'limited_access', 'staff_assistance_required']).optional(),
  label: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

mapRouter.get('/:hospitalId/floors/:floorId/nodes', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json({ nodes: listNodes(req.params.floorId) });
}));

mapRouter.post('/:hospitalId/floors/:floorId/nodes', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(nodeSchema, req.body);
  const created = createNode(body);
  audit(req.admin!, 'node.create', { entityType: 'navigation_node', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

mapRouter.patch('/:hospitalId/nodes/:nodeId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json(updateNode(req.params.nodeId, parse(nodeSchema.partial(), req.body)));
}));

mapRouter.delete('/:hospitalId/nodes/:nodeId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  deleteNode(req.params.nodeId);
  audit(req.admin!, 'node.delete', { entityType: 'navigation_node', entityId: req.params.nodeId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

// ---- Navigation edges ------------------------------------------------------

const edgeSchema = z.object({
  floor_id: z.string().uuid(),
  start_node_id: z.string().uuid(),
  end_node_id: z.string().uuid(),
  kind: z.enum(['corridor', 'room_access', 'stair', 'lift', 'ramp', 'escalator', 'bridge', 'outdoor']),
  distance_metres: z.number().nonnegative(),
  accessibility: z.enum(['wheelchair_accessible', 'step_free', 'stairs_only', 'limited_access', 'staff_assistance_required']),
  is_bidirectional: z.boolean().optional(),
  one_way_direction: z.enum(['north', 'south', 'east', 'west']).optional().nullable(),
  is_vertical: z.boolean().optional(),
  connects_to_floor_id: z.string().uuid().optional().nullable(),
});

mapRouter.get('/:hospitalId/floors/:floorId/edges', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json({ edges: listEdges(req.params.floorId) });
}));

mapRouter.post('/:hospitalId/floors/:floorId/edges', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(edgeSchema, req.body);
  const created = createEdge(body);
  audit(req.admin!, 'edge.create', { entityType: 'navigation_edge', entityId: created.id, hospitalId: req.params.hospitalId });
  res.status(201).json(created);
}));

mapRouter.patch('/:hospitalId/edges/:edgeId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json(updateEdge(req.params.edgeId, parse(edgeSchema.partial(), req.body)));
}));

mapRouter.delete('/:hospitalId/edges/:edgeId', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  deleteEdge(req.params.edgeId);
  audit(req.admin!, 'edge.delete', { entityType: 'navigation_edge', entityId: req.params.edgeId, hospitalId: req.params.hospitalId });
  res.json({ ok: true });
}));

// ---- Graph view (nodes + edges + rooms + entrances + exits for the editor) --

mapRouter.get('/:hospitalId/floors/:floorId/graph', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const graph = loadFloorGraph(req.params.floorId);
  res.json({
    floorGraph: graph,
    rooms: listRooms(req.params.floorId),
    entrances: listEntrances(req.params.floorId),
    exits: listExits(req.params.floorId),
  });
}));

// ---- Routing ---------------------------------------------------------------

const routeSchema = z.object({
  start_node_id: z.string().uuid(),
  end_node_id: z.string().uuid(),
  wheelchair_only: z.boolean().optional(),
  allow_vertical: z.boolean().optional(),
  prefer_lift: z.boolean().optional(),
  algorithm: z.enum(['dijkstra', 'astar']).optional(),
});

mapRouter.post('/:hospitalId/route', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  const body = parse(routeSchema, req.body);
  const result = computeRoute(req.params.hospitalId, body.start_node_id, body.end_node_id, {
    wheelchairOnly: body.wheelchair_only,
    allowVertical: body.allow_vertical,
    preferLift: body.prefer_lift,
    algorithm: body.algorithm,
  });
  if (!result.found) {
    throw ApiError.badRequest('No route exists between the selected nodes');
  }
  audit(req.admin!, 'route.compute', { entityType: 'hospital', entityId: req.params.hospitalId, details: { start: body.start_node_id, end: body.end_node_id, distance: result.totalDistanceMetres } });
  res.json(result);
}));

// ---- Offline bundle --------------------------------------------------------

mapRouter.get('/:hospitalId/offline-bundle', requirePermission('map:edit'), requireHospitalAccess, wrap(async (req, res) => {
  res.json(buildOfflineBundle(req.params.hospitalId));
}));
