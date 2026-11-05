// ============================================================================
// Indoor routing engine — graph-based, multi-floor, accessibility-aware.
// Implements Dijkstra and A* over the navigation_nodes / navigation_edges
// graph. This is the reference implementation; the Flutter patient app ships
// an equivalent pure-Dart engine with identical semantics and its own tests.
//
// Coordinates are metric floor-local metres. Vertical edges (lift/stair)
// connect nodes on different floors, enabling true multi-building,
// multi-floor route computation.
// ============================================================================

export type NodeType =
  | 'junction' | 'room' | 'entrance' | 'exit' | 'stair' | 'lift'
  | 'escalator' | 'ramp' | 'emergency' | 'info_point' | 'corridor_end';

export type AccessibilityClass =
  | 'wheelchair_accessible' | 'step_free' | 'stairs_only'
  | 'limited_access' | 'staff_assistance_required';

export interface NavNode {
  id: string;
  floorId: string;
  type: NodeType;
  x: number;
  y: number;
  roomId?: string | null;
  facilityId?: string | null;
  accessibility?: AccessibilityClass | null;
  label?: string | null;
}

export interface NavEdge {
  id: string;
  floorId: string;
  startNodeId: string;
  endNodeId: string;
  kind: string;
  distanceMetres: number;
  accessibility: AccessibilityClass;
  isBidirectional: boolean;
  oneWayDirection?: string | null;
  isVertical: boolean;
  connectsToFloorId?: string | null;
  isActive: boolean;
}

export interface FloorGraph {
  floorId: string;
  hospitalId: string;
  buildingId: string;
  floorNumber: number;
  floorLabel: string;
  levelElevationM: number | null;
  nodes: NavNode[];
  edges: NavEdge[];
}

export interface RouteStep {
  fromNodeId: string;
  toNodeId: string;
  floorId: string;
  kind: string;
  distanceMetres: number;
  instruction: string;
  instructionHindi: string;
  accessibility: AccessibilityClass;
  isVertical: boolean;
  toFloorLabel?: string;
}

export interface RouteResult {
  startNodeId: string;
  endNodeId: string;
  startFloorId: string;
  endFloorId: string;
  totalDistanceMetres: number;
  estimatedWalkingTimeSeconds: number;
  steps: RouteStep[];
  pathNodeIds: string[];
  accessible: boolean;
  algorithm: 'dijkstra' | 'astar';
  found: boolean;
}

export interface RoutingOptions {
  wheelchairOnly?: boolean;
  allowVertical?: boolean;
  preferLift?: boolean;
  algorithm?: 'dijkstra' | 'astar';
}

const WALKING_SPEED_MPS = 1.0; // ~3.6 km/h, conservative indoor pace

/** A graph key is "floorId::nodeId" so the same node id on different floors is unique. */
function nodeKey(floorId: string, nodeId: string): string {
  return `${floorId}::${nodeId}`;
}

/** Build a combined multi-floor node map from per-floor graphs. */
export function buildGraph(floors: FloorGraph[]): { nodes: Map<string, NavNode>; edges: Map<string, NavEdge[]> } {
  const nodes = new Map<string, NavNode>();
  const edges = new Map<string, NavEdge[]>();
  for (const f of floors) {
    for (const n of f.nodes) nodes.set(nodeKey(n.floorId, n.id), n);
    edges.set(f.floorId, f.edges);
  }
  return { nodes, edges };
}

function isAccessible(a: AccessibilityClass): boolean {
  return a === 'wheelchair_accessible' || a === 'step_free';
}

/**
 * Compute the shortest path. Both Dijkstra and A* are supported; A* uses an
 * admissible Euclidean heuristic (edges are metric distances). Returns a full
 * RouteResult with turn-by-turn instructions in EN + HI.
 */
export function route(
  floors: FloorGraph[],
  startNodeId: string,
  endNodeId: string,
  opts: RoutingOptions = {},
): RouteResult {
  const algorithm = opts.algorithm ?? 'astar';
  const graph = buildGraph(floors);
  const floorById = new Map(floors.map((f) => [f.floorId, f]));

  const startKey = findNodeKey(graph.nodes, startNodeId);
  const endKey = findNodeKey(graph.nodes, endNodeId);
  if (!startKey || !endKey) return notFound(startNodeId, endNodeId, algorithm);

  const start = graph.nodes.get(startKey)!;
  const end = graph.nodes.get(endKey)!;
  const adjacency = buildAdjacency(graph, opts);

  const dist = new Map<string, number>();
  const prevKey = new Map<string, string>();
  const prevEdge = new Map<string, NavEdge>();
  const visited = new Set<string>();
  const queue: { key: string; f: number; g: number }[] = [];

  const heuristic = (k: string): number => {
    const n = graph.nodes.get(k)!;
    return Math.hypot(n.x - end.x, n.y - end.y);
  };

  dist.set(startKey, 0);
  queue.push({ key: startKey, f: algorithm === 'astar' ? heuristic(startKey) : 0, g: 0 });

  while (queue.length > 0) {
    queue.sort((a, b) => a.f - b.f || a.g - b.g);
    const cur = queue.shift()!;
    if (visited.has(cur.key)) continue;
    visited.add(cur.key);
    if (cur.key === endKey) break;

    for (const { to, edge } of adjacency.get(cur.key) ?? []) {
      if (visited.has(to)) continue;
      const g = cur.g + edge.distanceMetres;
      if (g < (dist.get(to) ?? Infinity)) {
        dist.set(to, g);
        prevKey.set(to, cur.key);
        prevEdge.set(to, edge);
        queue.push({ key: to, f: g + (algorithm === 'astar' ? heuristic(to) : 0), g });
      }
    }
  }

  if (!dist.has(endKey)) return notFound(startNodeId, endNodeId, algorithm);

  // Reconstruct path (keys) + edges used.
  const pathKeys: string[] = [];
  const edgesUsed: NavEdge[] = [];
  let cur: string | undefined = endKey;
  while (cur) {
    pathKeys.push(cur);
    const e = prevEdge.get(cur);
    if (e) edgesUsed.push(e);
    cur = prevKey.get(cur);
  }
  pathKeys.reverse();
  edgesUsed.reverse();

  const steps = buildSteps(pathKeys, edgesUsed, graph, floorById);
  const distance = edgesUsed.reduce((a, e) => a + e.distanceMetres, 0);

  return {
    startNodeId: start.id,
    endNodeId: end.id,
    startFloorId: start.floorId,
    endFloorId: end.floorId,
    totalDistanceMetres: Math.round(distance * 1000) / 1000,
    estimatedWalkingTimeSeconds: Math.round(distance / WALKING_SPEED_MPS),
    steps,
    pathNodeIds: pathKeys.map((k) => graph.nodes.get(k)!.id),
    accessible: edgesUsed.every((e) => isAccessible(e.accessibility)),
    algorithm,
    found: true,
  };
}

function findNodeKey(nodes: Map<string, NavNode>, nodeId: string): string | undefined {
  for (const [key, node] of nodes) if (node.id === nodeId) return key;
  return undefined;
}

function buildAdjacency(
  graph: { nodes: Map<string, NavNode>; edges: Map<string, NavEdge[]> },
  opts: RoutingOptions,
): Map<string, { to: string; edge: NavEdge }[]> {
  const adj = new Map<string, { to: string; edge: NavEdge }[]>();
  const push = (from: string, to: string, edge: NavEdge) => {
    const list = adj.get(from) ?? [];
    list.push({ to, edge });
    adj.set(from, list);
  };

  for (const [floorId, edges] of graph.edges) {
    for (const e of edges) {
      if (!e.isActive) continue;
      if (opts.wheelchairOnly && !isAccessible(e.accessibility)) continue;
      if (opts.allowVertical === false && e.isVertical) continue;
      if (opts.preferLift && e.kind === 'stair' && opts.wheelchairOnly) continue;

      // Forward direction: start node (on this floor) -> end node (on connectsToFloorId if vertical).
      const toFloor = e.isVertical && e.connectsToFloorId ? e.connectsToFloorId : floorId;
      const fromKey = nodeKey(floorId, e.startNodeId);
      const toKey = nodeKey(toFloor, e.endNodeId);
      push(fromKey, toKey, e);

      // Reverse direction only if bidirectional.
      if (e.isBidirectional) {
        const revFromFloor = toFloor;
        const revToFloor = floorId;
        push(nodeKey(revFromFloor, e.endNodeId), nodeKey(revToFloor, e.startNodeId), e);
      }
    }
  }
  return adj;
}

function buildSteps(
  pathKeys: string[],
  edgesUsed: NavEdge[],
  graph: { nodes: Map<string, NavNode> },
  floorById: Map<string, FloorGraph>,
): RouteStep[] {
  const steps: RouteStep[] = [];
  for (let i = 0; i < edgesUsed.length; i++) {
    const edge = edgesUsed[i];
    const fromKey = pathKeys[i];
    const toKey = pathKeys[i + 1];
    const from = graph.nodes.get(fromKey)!;
    const to = graph.nodes.get(toKey)!;
    const dir = directionLabel(from, to);
    const toFloor = floorById.get(to.floorId);
    const toFloorLabel = toFloor?.floorLabel ?? to.floorId;
    steps.push({
      fromNodeId: from.id,
      toNodeId: to.id,
      floorId: to.floorId,
      kind: edge.kind,
      distanceMetres: edge.distanceMetres,
      instruction: instructionEn(edge, dir, from, to, toFloorLabel),
      instructionHindi: instructionHi(edge, dir, from, to, toFloorLabel),
      accessibility: edge.accessibility,
      isVertical: edge.isVertical,
      toFloorLabel: edge.isVertical ? toFloorLabel : undefined,
    });
  }
  return steps;
}

function directionLabel(from: NavNode, to: NavNode): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'north' : 'south';
}

const DIR_EN: Record<string, string> = { north: 'north', south: 'south', east: 'east', west: 'west' };
const DIR_HI: Record<string, string> = { north: 'उत्तर', south: 'दक्षिण', east: 'पूरब', west: 'पश्चिम' };

function instructionEn(edge: NavEdge, dir: string, from: NavNode, to: NavNode, toFloorLabel: string): string {
  if (edge.isVertical) {
    if (edge.kind === 'lift') return `Take the lift near ${from.label ?? 'here'} to the ${toFloorLabel} floor.`;
    if (edge.kind === 'stair') return `Take the stairs near ${from.label ?? 'here'} to the ${toFloorLabel} floor.`;
    return `Use the ${edge.kind} to reach the ${toFloorLabel} floor.`;
  }
  if (edge.kind === 'room_access' || to.type === 'room') {
    return `Arrive at ${to.label ?? 'destination'}.`;
  }
  return `Walk ${edge.distanceMetres.toFixed(1)} m ${DIR_EN[dir]} to ${to.label ?? 'the next point'}.`;
}

function instructionHi(edge: NavEdge, dir: string, from: NavNode, to: NavNode, toFloorLabel: string): string {
  if (edge.isVertical) {
    if (edge.kind === 'lift') return `यहाँ से ${toFloorLabel} तल तक लिफ्ट ले लें।`;
    if (edge.kind === 'stair') return `यहाँ से ${toFloorLabel} तल तक सीढ़ियाँ ले लें।`;
    return `${toFloorLabel} तल तक जायें।`;
  }
  if (edge.kind === 'room_access' || to.type === 'room') {
    return `${to.label ?? 'मंजिल'} पर पहुँच गए।`;
  }
  return `${edge.distanceMetres.toFixed(1)} मीटर ${DIR_HI[dir]} की ओर चलें।`;
}

function notFound(start: string, end: string, algorithm: 'dijkstra' | 'astar'): RouteResult {
  return {
    startNodeId: start,
    endNodeId: end,
    startFloorId: '',
    endFloorId: '',
    totalDistanceMetres: 0,
    estimatedWalkingTimeSeconds: 0,
    steps: [],
    pathNodeIds: [],
    accessible: false,
    algorithm,
    found: false,
  };
}

/** Helper used by the API layer: Euclidean distance between two nodes (for
 * proximity / "distance estimation from mapped paths"). */
export function nodeDistanceMetres(a: NavNode, b: NavNode): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 1000) / 1000;
}
