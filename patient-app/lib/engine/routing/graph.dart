// ============================================================================
// Hospital Mitra — indoor routing engine (Dart)
// Mirrors the TypeScript reference implementation in backend/src/map/graph.ts.
// Graph-based Dijkstra / A* over navigation nodes & edges, with multi-floor
// (vertical lift/stair) support and wheelchair accessibility filtering.
// Pure Dart (no Flutter) so it is unit-testable.
// ============================================================================

enum NodeType {
  junction, room, entrance, exit, stair, lift, escalator, ramp, emergency, infoPoint, corridorEnd;

  static NodeType fromString(String s) {
    switch (s) {
      case 'junction': return NodeType.junction;
      case 'room': return NodeType.room;
      case 'entrance': return NodeType.entrance;
      case 'exit': return NodeType.exit;
      case 'stair': return NodeType.stair;
      case 'lift': return NodeType.lift;
      case 'escalator': return NodeType.escalator;
      case 'ramp': return NodeType.ramp;
      case 'emergency': return NodeType.emergency;
      case 'info_point': return NodeType.infoPoint;
      case 'corridor_end': return NodeType.corridorEnd;
      default: return NodeType.junction;
    }
  }
}

enum AccessibilityClass {
  wheelchairAccessible, stepFree, stairsOnly, limitedAccess, staffAssistanceRequired;

  bool get isAccessible =>
      this == AccessibilityClass.wheelchairAccessible || this == AccessibilityClass.stepFree;

  static AccessibilityClass fromString(String s) {
    switch (s) {
      case 'wheelchair_accessible': return AccessibilityClass.wheelchairAccessible;
      case 'step_free': return AccessibilityClass.stepFree;
      case 'stairs_only': return AccessibilityClass.stairsOnly;
      case 'limited_access': return AccessibilityClass.limitedAccess;
      case 'staff_assistance_required': return AccessibilityClass.staffAssistanceRequired;
      default: return AccessibilityClass.wheelchairAccessible;
    }
  }
}

class NavNode {
  final String id;
  final String floorId;
  final NodeType type;
  final double x; // metres
  final double y; // metres
  final String? roomId;
  final String? facilityId;
  final AccessibilityClass? accessibility;
  final String? label;

  NavNode({
    required this.id,
    required this.floorId,
    required this.type,
    required this.x,
    required this.y,
    this.roomId,
    this.facilityId,
    this.accessibility,
    this.label,
  });

  factory NavNode.fromJson(Map<String, dynamic> j) => NavNode(
        id: j['id'] as String,
        floorId: j['floorId'] as String,
        type: NodeType.fromString(j['type'] as String),
        x: (j['x'] as num).toDouble(),
        y: (j['y'] as num).toDouble(),
        roomId: j['roomId'] as String?,
        facilityId: j['facilityId'] as String?,
        accessibility: j['accessibility'] != null
            ? AccessibilityClass.fromString(j['accessibility'] as String)
            : null,
        label: j['label'] as String?,
      );
}

class NavEdge {
  final String id;
  final String floorId;
  final String startNodeId;
  final String endNodeId;
  final String kind;
  final double distanceMetres;
  final AccessibilityClass accessibility;
  final bool isBidirectional;
  final bool isVertical;
  final String? connectsToFloorId;
  final bool isActive;

  NavEdge({
    required this.id,
    required this.floorId,
    required this.startNodeId,
    required this.endNodeId,
    required this.kind,
    required this.distanceMetres,
    required this.accessibility,
    this.isBidirectional = true,
    this.isVertical = false,
    this.connectsToFloorId,
    this.isActive = true,
  });

  factory NavEdge.fromJson(Map<String, dynamic> j) => NavEdge(
        id: j['id'] as String,
        floorId: j['floorId'] as String,
        startNodeId: j['startNodeId'] as String,
        endNodeId: j['endNodeId'] as String,
        kind: j['kind'] as String,
        distanceMetres: (j['distanceMetres'] as num).toDouble(),
        accessibility: AccessibilityClass.fromString(j['accessibility'] as String),
        isBidirectional: (j['isBidirectional'] as bool?) ?? true,
        isVertical: (j['isVertical'] as bool?) ?? false,
        connectsToFloorId: j['connectsToFloorId'] as String?,
        isActive: (j['isActive'] as bool?) ?? true,
      );
}

class FloorGraph {
  final String floorId;
  final String hospitalId;
  final String buildingId;
  final int floorNumber;
  final String floorLabel;
  final double? levelElevationM;
  final List<NavNode> nodes;
  final List<NavEdge> edges;

  FloorGraph({
    required this.floorId,
    required this.hospitalId,
    required this.buildingId,
    required this.floorNumber,
    required this.floorLabel,
    this.levelElevationM,
    required this.nodes,
    required this.edges,
  });

  factory FloorGraph.fromJson(Map<String, dynamic> j) => FloorGraph(
        floorId: j['floorId'] as String,
        hospitalId: j['hospitalId'] as String,
        buildingId: j['buildingId'] as String,
        floorNumber: (j['floorNumber'] as num).toInt(),
        floorLabel: j['floorLabel'] as String,
        levelElevationM: j['levelElevationM'] != null ? (j['levelElevationM'] as num).toDouble() : null,
        nodes: (j['nodes'] as List).map((e) => NavNode.fromJson(e as Map)).toList(),
        edges: (j['edges'] as List).map((e) => NavEdge.fromJson(e as Map)).toList(),
      );
}

class RouteStep {
  final String fromNodeId;
  final String toNodeId;
  final String floorId;
  final String kind;
  final double distanceMetres;
  final String instruction; // English
  final String instructionHindi;
  final AccessibilityClass accessibility;
  final bool isVertical;
  final String? toFloorLabel;

  RouteStep({
    required this.fromNodeId,
    required this.toNodeId,
    required this.floorId,
    required this.kind,
    required this.distanceMetres,
    required this.instruction,
    required this.instructionHindi,
    required this.accessibility,
    this.isVertical = false,
    this.toFloorLabel,
  });
}

class RouteResult {
  final String startNodeId;
  final String endNodeId;
  final String startFloorId;
  final String endFloorId;
  final double totalDistanceMetres;
  final int estimatedWalkingTimeSeconds;
  final List<RouteStep> steps;
  final List<String> pathNodeIds;
  final bool accessible;
  final String algorithm;
  final bool found;

  const RouteResult({
    required this.startNodeId,
    required this.endNodeId,
    required this.startFloorId,
    required this.endFloorId,
    required this.totalDistanceMetres,
    required this.estimatedWalkingTimeSeconds,
    required this.steps,
    required this.pathNodeIds,
    required this.accessible,
    required this.algorithm,
    required this.found,
  });

  factory RouteResult.notFound(String start, String end, String algorithm) => RouteResult(
        startNodeId: start,
        endNodeId: end,
        startFloorId: '',
        endFloorId: '',
        totalDistanceMetres: 0,
        estimatedWalkingTimeSeconds: 0,
        steps: const [],
        pathNodeIds: const [],
        accessible: false,
        algorithm: algorithm,
        found: false,
      );
}

class RoutingOptions {
  final bool wheelchairOnly;
  final bool allowVertical;
  final bool preferLift;
  final String algorithm; // 'astar' | 'dijkstra'

  const RoutingOptions({
    this.wheelchairOnly = false,
    this.allowVertical = true,
    this.preferLift = false,
    this.algorithm = 'astar',
  });
}

class Router {
  static const double walkingSpeedMps = 1.0;

  static String nodeKey(String floorId, String nodeId) => '$floorId::$nodeId';

  static RouteResult route(
    List<FloorGraph> floors,
    String startNodeId,
    String endNodeId, [
    const RoutingOptions? options,
  ]) {
    final opts = options ?? const RoutingOptions();
    final algorithm = opts.algorithm;

    final nodes = <String, NavNode>{};
    final edgesByFloor = <String, List<NavEdge>>{};
    for (final f in floors) {
      for (final n in f.nodes) {
        nodes[nodeKey(n.floorId, n.id)] = n;
      }
      edgesByFloor[f.floorId] = f.edges;
    }
    final floorById = Map<String, FloorGraph>.fromEntries(floors.map((f) => MapEntry(f.floorId, f)));

    final startKey = _findNodeKey(nodes, startNodeId);
    final endKey = _findNodeKey(nodes, endNodeId);
    if (startKey == null || endKey == null) {
      return RouteResult.notFound(startNodeId, endNodeId, algorithm);
    }
    final start = nodes[startKey]!;
    final end = nodes[endKey]!;

    final adjacency = _buildAdjacency(nodes, edgesByFloor, opts);

    final dist = <String, double>{};
    final prevKey = <String, String>{};
    final prevEdge = <String, NavEdge>{};
    final visited = <String>{};
    // Priority queue as a sorted list (small graphs; fine for hospital floors).
    final queue = <_QueueEntry>[];
    final heuristic = (String k) {
      final n = nodes[k]!;
      return ((n.x - end.x) * (n.x - end.x) + (n.y - end.y) * (n.y - end.y)).sqrt();
    };

    dist[startKey] = 0;
    queue.add(_QueueEntry(startKey, algorithm == 'astar' ? heuristic(startKey) : 0, 0));

    while (queue.isNotEmpty) {
      queue.sort((a, b) => a.f.compareTo(b.f));
      final cur = queue.removeAt(0);
      if (visited.contains(cur.key)) continue;
      visited.add(cur.key);
      if (cur.key == endKey) break;

      for (final nbr in adjacency[cur.key] ?? const []) {
        if (visited.contains(nbr.to)) continue;
        final g = cur.g + nbr.edge.distanceMetres;
        if (g < (dist[nbr.to] ?? double.infinity)) {
          dist[nbr.to] = g;
          prevKey[nbr.to] = cur.key;
          prevEdge[nbr.to] = nbr.edge;
          queue.add(_QueueEntry(nbr.to, g + (algorithm == 'astar' ? heuristic(nbr.to) : 0), g));
        }
      }
    }

    if (!dist.containsKey(endKey)) {
      return RouteResult.notFound(startNodeId, endNodeId, algorithm);
    }

    // Reconstruct path.
    final pathKeys = <String>[];
    final edgesUsed = <NavEdge>[];
    String? cur = endKey;
    while (cur != null) {
      pathKeys.add(cur);
      final e = prevEdge[cur];
      if (e != null) edgesUsed.add(e);
      cur = prevKey[cur];
    }
    pathKeys.reverse();
    edgesUsed.reverse();

    final steps = _buildSteps(pathKeys, edgesUsed, nodes, floorById);
    final distance = edgesUsed.fold<double>(0, (a, e) => a + e.distanceMetres);

    return RouteResult(
      startNodeId: start.id,
      endNodeId: end.id,
      startFloorId: start.floorId,
      endFloorId: end.floorId,
      totalDistanceMetres: double.parse((distance * 1000).toStringAsFixed(0)) / 1000,
      estimatedWalkingTimeSeconds: (distance / walkingSpeedMps).round(),
      steps: steps,
      pathNodeIds: pathKeys.map((k) => nodes[k]!.id).toList(),
      accessible: edgesUsed.every((e) => e.accessibility.isAccessible),
      algorithm: algorithm,
      found: true,
    );
  }

  static String? _findNodeKey(Map<String, NavNode> nodes, String nodeId) {
    for (final entry in nodes.entries) {
      if (entry.value.id == nodeId) return entry.key;
    }
    return null;
  }

  static Map<String, List<_AdjEntry>> _buildAdjacency(
    Map<String, NavNode> nodes,
    Map<String, List<NavEdge>> edgesByFloor,
    RoutingOptions opts,
  ) {
    final adj = <String, List<_AdjEntry>>{};
    void push(String from, String to, NavEdge e) {
      adj.putIfAbsent(from, () => []);
      adj[from]!.add(_AdjEntry(to, e));
    }

    for (final entry in edgesByFloor.entries) {
      final floorId = entry.key;
      for (final e in entry.value) {
        if (!e.isActive) continue;
        if (opts.wheelchairOnly && !e.accessibility.isAccessible) continue;
        if (!opts.allowVertical && e.isVertical) continue;
        if (opts.preferLift && e.kind == 'stair' && opts.wheelchairOnly) continue;

        final toFloor = (e.isVertical && e.connectsToFloorId != null) ? e.connectsToFloorId! : floorId;
        final fromKey = nodeKey(floorId, e.startNodeId);
        final toKey = nodeKey(toFloor, e.endNodeId);
        push(fromKey, toKey, e);

        if (e.isBidirectional) {
          push(nodeKey(toFloor, e.endNodeId), nodeKey(floorId, e.startNodeId), e);
        }
      }
    }
    return adj;
  }

  static List<RouteStep> _buildSteps(
    List<String> pathKeys,
    List<NavEdge> edgesUsed,
    Map<String, NavNode> nodes,
    Map<String, FloorGraph> floorById,
  ) {
    final steps = <RouteStep>[];
    for (var i = 0; i < edgesUsed.length; i++) {
      final edge = edgesUsed[i];
      final from = nodes[pathKeys[i]]!;
      final to = nodes[pathKeys[i + 1]]!;
      final dir = _directionLabel(from, to);
      final toFloor = floorById[to.floorId];
      final toFloorLabel = toFloor?.floorLabel ?? to.floorId;
      steps.add(RouteStep(
        fromNodeId: from.id,
        toNodeId: to.id,
        floorId: to.floorId,
        kind: edge.kind,
        distanceMetres: edge.distanceMetres,
        instruction: _instructionEn(edge, dir, from, to, toFloorLabel),
        instructionHindi: _instructionHi(edge, dir, from, to, toFloorLabel),
        accessibility: edge.accessibility,
        isVertical: edge.isVertical,
        toFloorLabel: edge.isVertical ? toFloorLabel : null,
      ));
    }
    return steps;
  }

  static String _directionLabel(NavNode from, NavNode to) {
    final dx = to.x - from.x;
    final dy = to.y - from.y;
    if (dx.abs() >= dy.abs()) return dx >= 0 ? 'east' : 'west';
    return dy >= 0 ? 'north' : 'south';
  }

  static final _dirEn = {'north': 'north', 'south': 'south', 'east': 'east', 'west': 'west'};
  static final _dirHi = {'north': 'उत्तर', 'south': 'दक्षिण', 'east': 'पूरब', 'west': 'पश्चिम'};

  static String _instructionEn(NavEdge edge, String dir, NavNode from, NavNode to, String toFloorLabel) {
    if (edge.isVertical) {
      if (edge.kind == 'lift') return 'Take the lift near ${from.label ?? 'here'} to the $toFloorLabel floor.';
      if (edge.kind == 'stair') return 'Take the stairs near ${from.label ?? 'here'} to the $toFloorLabel floor.';
      return 'Use the ${edge.kind} to reach the $toFloorLabel floor.';
    }
    if (edge.kind == 'room_access' || to.type == NodeType.room) {
      return 'Arrive at ${to.label ?? 'destination'}.';
    }
    return 'Walk ${edge.distanceMetres.toStringAsFixed(1)} m ${_dirEn[dir] ?? ''} to ${to.label ?? 'the next point'}.';
  }

  static String _instructionHi(NavEdge edge, String dir, NavNode from, NavNode to, String toFloorLabel) {
    if (edge.isVertical) {
      if (edge.kind == 'lift') return 'यहाँ से $toFloorLabel तल तक लिफ्ट ले लें।';
      if (edge.kind == 'stair') return 'यहाँ से $toFloorLabel तल तक सीढ़ियाँ ले लें।';
      return '$toFloorLabel तल तक जायें।';
    }
    if (edge.kind == 'room_access' || to.type == NodeType.room) {
      return '${to.label ?? 'मंजिल'} पर पहुँच गए।';
    }
    return '${edge.distanceMetres.toStringAsFixed(1)} मीटर ${_dirHi[dir] ?? ''} की ओर चलें।';
  }
}

class _QueueEntry {
  final String key;
  final double f;
  final double g;
  _QueueEntry(this.key, this.f, this.g);
}

class _AdjEntry {
  final String to;
  final NavEdge edge;
  _AdjEntry(this.to, this.edge);
}

double nodeDistanceMetres(NavNode a, NavNode b) =>
    ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)).sqrt();
