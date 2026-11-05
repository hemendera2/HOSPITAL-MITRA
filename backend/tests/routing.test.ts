import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  route, buildGraph, nodeDistanceMetres,
  type FloorGraph, type NavNode, type NavEdge,
} from '../src/map/graph.js';

// Build a small 2-floor graph mirroring the demo hospital geometry.
function demoFloors(): FloorGraph[] {
  const n = (id: string, floorId: string, type: NavNode['type'], x: number, y: number, label?: string): NavNode =>
    ({ id, floorId, type, x, y, label: label ?? id, accessibility: 'wheelchair_accessible' });
  const e = (id: string, floorId: string, a: string, b: string, kind: string, d: number, acc: NavEdge['accessibility'] = 'wheelchair_accessible', vertical = false, toFloor?: string): NavEdge =>
    ({ id, floorId, startNodeId: a, endNodeId: b, kind, distanceMetres: d, accessibility: acc, isBidirectional: true, isVertical: vertical, connectsToFloorId: toFloor, isActive: true });

  const ground: FloorGraph = {
    floorId: 'F1', hospitalId: 'H', buildingId: 'B', floorNumber: 1, floorLabel: 'Ground', levelElevationM: 0,
    nodes: [
      n('entrance', 'F1', 'entrance', 0, 50, 'Main Entrance'),
      n('A', 'F1', 'junction', 10, 50, 'Junction A'),
      n('B', 'F1', 'junction', 10, 20, 'Junction B'),
      n('C', 'F1', 'junction', 40, 20, 'Junction C'),
      n('reg', 'F1', 'room', 5, 8, 'Registration'),
      n('pha', 'F1', 'room', 30, 8, 'Pharmacy'),
      n('emg', 'F1', 'room', 5, 40, 'Emergency'),
      n('lift', 'F1', 'lift', 10, 15, 'Lift'),
      n('stair', 'F1', 'stair', 12, 15, 'Stairs'),
    ],
    edges: [
      e('e1', 'F1', 'entrance', 'A', 'corridor', 10),
      e('e2', 'F1', 'A', 'B', 'corridor', 30),
      e('e3', 'F1', 'B', 'C', 'corridor', 30),
      e('e4', 'F1', 'B', 'reg', 'corridor', 13),
      e('e5', 'F1', 'B', 'pha', 'corridor', 25),
      e('e6', 'F1', 'B', 'emg', 'corridor', 20),
      e('e7', 'F1', 'A', 'lift', 'corridor', 5),
      e('e8', 'F1', 'A', 'stair', 'corridor', 5, 'stairs_only'),
    ],
  };
  const first: FloorGraph = {
    floorId: 'F2', hospitalId: 'H', buildingId: 'B', floorNumber: 2, floorLabel: 'First', levelElevationM: 3.5,
    nodes: [
      n('lift2', 'F2', 'lift', 10, 15, 'Lift from Ground'),
      n('stair2', 'F2', 'stair', 12, 15, 'Stairs from Ground'),
      n('D', 'F2', 'junction', 10, 20, 'Junction D'),
      n('E', 'F2', 'junction', 30, 20, 'Junction E'),
      n('opd', 'F2', 'room', 15, 15, 'OPD'),
      n('lab', 'F2', 'room', 35, 15, 'Laboratory'),
    ],
    edges: [
      e('e11', 'F2', 'lift2', 'D', 'corridor', 5),
      e('e12', 'F2', 'D', 'E', 'corridor', 20),
      e('e13', 'F2', 'D', 'opd', 'corridor', 7),
      e('e14', 'F2', 'E', 'lab', 'corridor', 7),
    ],
  };
  // vertical edges
  ground.edges.push(e('v-lift', 'F1', 'lift', 'lift2', 'lift', 3.5, 'wheelchair_accessible', true, 'F2'));
  ground.edges.push(e('v-stair', 'F1', 'stair', 'stair2', 'stair', 3.5, 'stairs_only', true, 'F2'));
  return [ground, first];
}

test('buildGraph indexes all nodes across floors', () => {
  const g = buildGraph(demoFloors());
  assert.equal(g.nodes.size, 15);
  assert.equal(g.edges.get('F1')?.length, 10);
  assert.equal(g.edges.get('F2')?.length, 4);
});

test('A* finds the shortest same-floor route', () => {
  const r = route(demoFloors(), 'entrance', 'pha', { algorithm: 'astar' });
  assert.equal(r.found, true);
  assert.equal(r.startNodeId, 'entrance');
  assert.equal(r.endNodeId, 'pha');
  // entrance->A (10) + A->B (30) + B->pha (25) = 65
  assert.equal(r.totalDistanceMetres, 65);
  assert.ok(r.steps.length >= 3);
});

test('Dijkstra matches A* distance on the same graph', () => {
  const a = route(demoFloors(), 'entrance', 'pha', { algorithm: 'astar' });
  const d = route(demoFloors(), 'entrance', 'pha', { algorithm: 'dijkstra' });
  assert.equal(a.totalDistanceMetres, d.totalDistanceMetres);
});

test('multi-floor route uses the lift (shortest) to reach OPD', () => {
  const r = route(demoFloors(), 'entrance', 'opd', { algorithm: 'astar' });
  assert.equal(r.found, true);
  assert.equal(r.endFloorId, 'F2');
  // entrance->A(10) + A->lift(5) + lift vertical(3.5) + lift2->D(5) + D->opd(7) = 30.5
  assert.equal(r.totalDistanceMetres, 30.5);
  const hasLiftStep = r.steps.some((s) => s.kind === 'lift' && s.isVertical);
  assert.ok(hasLiftStep, 'route should include a vertical lift step');
});

test('wheelchair-only route avoids stairs and prefers the lift', () => {
  const r = route(demoFloors(), 'entrance', 'lab', { wheelchairOnly: true, algorithm: 'astar' });
  assert.equal(r.found, true);
  assert.equal(r.accessible, true);
  const hasStair = r.steps.some((s) => s.kind === 'stair');
  assert.equal(hasStair, false, 'wheelchair route must not use stairs');
  const hasLift = r.steps.some((s) => s.kind === 'lift' && s.isVertical);
  assert.ok(hasLift, 'wheelchair route should use the lift for vertical movement');
});

test('wheelchair-only route to a stairs-only destination is impossible', () => {
  // lab is reachable without stairs, but force a stairs-only vertical scenario:
  // route from entrance to stair2 (top of stairs) with wheelchairOnly -> not found
  const r = route(demoFloors(), 'entrance', 'stair2', { wheelchairOnly: true, algorithm: 'astar' });
  assert.equal(r.found, false);
});

test('returns not-found for disconnected nodes', () => {
  const r = route(demoFloors(), 'entrance', 'nonexistent', { algorithm: 'astar' });
  assert.equal(r.found, false);
  assert.equal(r.steps.length, 0);
});

test('turn-by-turn instructions are produced in EN and HI', () => {
  const r = route(demoFloors(), 'entrance', 'pha', { algorithm: 'astar' });
  assert.ok(r.steps.length > 0);
  for (const s of r.steps) {
    assert.ok(s.instruction.length > 0);
    assert.ok(s.instructionHindi.length > 0);
  }
  const arrival = r.steps[r.steps.length - 1];
  assert.match(arrival.instruction, /Arrive at/);
});

test('estimated walking time = distance / 1 m/s', () => {
  const r = route(demoFloors(), 'entrance', 'pha', { algorithm: 'astar' });
  assert.equal(r.estimatedWalkingTimeSeconds, r.totalDistanceMetres);
});

test('nodeDistanceMetres computes Euclidean distance', () => {
  const a = { id: 'a', floorId: 'F1', type: 'junction' as const, x: 0, y: 0 };
  const b = { id: 'b', floorId: 'F1', type: 'junction' as const, x: 3, y: 4 };
  assert.equal(nodeDistanceMetres(a, b), 5);
});
