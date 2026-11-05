import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_mitra/engine/routing/graph.dart';

NavNode n(String id, String floor, NodeType type, double x, double y, {String? label}) =>
    NavNode(id: id, floorId: floor, type: type, x: x, y: y, label: label ?? id,
        accessibility: AccessibilityClass.wheelchairAccessible);

NavEdge e(String id, String floor, String a, String b, String kind, double d,
    {AccessibilityClass acc = AccessibilityClass.wheelchairAccessible,
    bool vertical = false, String? toFloor}) =>
    NavEdge(id: id, floorId: floor, startNodeId: a, endNodeId: b, kind: kind,
        distanceMetres: d, accessibility: acc, isBidirectional: true,
        isVertical: vertical, connectsToFloorId: toFloor, isActive: true);

List<FloorGraph> demoFloors() {
  final ground = FloorGraph(
    floorId: 'F1', hospitalId: 'H', buildingId: 'B', floorNumber: 1, floorLabel: 'Ground', levelElevationM: 0,
    nodes: [
      n('entrance', 'F1', NodeType.entrance, 0, 50, label: 'Main Entrance'),
      n('A', 'F1', NodeType.junction, 10, 50, label: 'Junction A'),
      n('B', 'F1', NodeType.junction, 10, 20, label: 'Junction B'),
      n('C', 'F1', NodeType.junction, 40, 20, label: 'Junction C'),
      n('reg', 'F1', NodeType.room, 5, 8, label: 'Registration'),
      n('pha', 'F1', NodeType.room, 30, 8, label: 'Pharmacy'),
      n('emg', 'F1', NodeType.room, 5, 40, label: 'Emergency'),
      n('lift', 'F1', NodeType.lift, 10, 15, label: 'Lift'),
      n('stair', 'F1', NodeType.stair, 12, 15, label: 'Stairs'),
    ],
    edges: [
      e('e1', 'F1', 'entrance', 'A', 'corridor', 10),
      e('e2', 'F1', 'A', 'B', 'corridor', 30),
      e('e3', 'F1', 'B', 'C', 'corridor', 30),
      e('e4', 'F1', 'B', 'reg', 'corridor', 13),
      e('e5', 'F1', 'B', 'pha', 'corridor', 25),
      e('e6', 'F1', 'B', 'emg', 'corridor', 20),
      e('e7', 'F1', 'A', 'lift', 'corridor', 5),
      e('e8', 'F1', 'A', 'stair', 'corridor', 5, acc: AccessibilityClass.stairsOnly),
    ],
  );
  final first = FloorGraph(
    floorId: 'F2', hospitalId: 'H', buildingId: 'B', floorNumber: 2, floorLabel: 'First', levelElevationM: 3.5,
    nodes: [
      n('lift2', 'F2', NodeType.lift, 10, 15, label: 'Lift from Ground'),
      n('stair2', 'F2', NodeType.stair, 12, 15, label: 'Stairs from Ground'),
      n('D', 'F2', NodeType.junction, 10, 20, label: 'Junction D'),
      n('E', 'F2', NodeType.junction, 30, 20, label: 'Junction E'),
      n('opd', 'F2', NodeType.room, 15, 15, label: 'OPD'),
      n('lab', 'F2', NodeType.room, 35, 15, label: 'Laboratory'),
    ],
    edges: [
      e('e11', 'F2', 'lift2', 'D', 'corridor', 5),
      e('e12', 'F2', 'D', 'E', 'corridor', 20),
      e('e13', 'F2', 'D', 'opd', 'corridor', 7),
      e('e14', 'F2', 'E', 'lab', 'corridor', 7),
    ],
  );
  ground.edges.add(e('v-lift', 'F1', 'lift', 'lift2', 'lift', 3.5, vertical: true, toFloor: 'F2'));
  ground.edges.add(e('v-stair', 'F1', 'stair', 'stair2', 'stair', 3.5, acc: AccessibilityClass.stairsOnly, vertical: true, toFloor: 'F2'));
  return [ground, first];
}

void main() {
  test('A* finds the shortest same-floor route', () {
    final r = Router.route(demoFloors(), 'entrance', 'pha', const RoutingOptions(algorithm: 'astar'));
    expect(r.found, isTrue);
    expect(r.totalDistanceMetres, 65);
    expect(r.steps.length, greaterThanOrEqualTo(3));
  });

  test('Dijkstra matches A* distance', () {
    final a = Router.route(demoFloors(), 'entrance', 'pha', const RoutingOptions(algorithm: 'astar'));
    final d = Router.route(demoFloors(), 'entrance', 'pha', const RoutingOptions(algorithm: 'dijkstra'));
    expect(a.totalDistanceMetres, d.totalDistanceMetres);
  });

  test('multi-floor route uses the lift to reach OPD', () {
    final r = Router.route(demoFloors(), 'entrance', 'opd', const RoutingOptions(algorithm: 'astar'));
    expect(r.found, isTrue);
    expect(r.endFloorId, 'F2');
    expect(r.totalDistanceMetres, 30.5);
    expect(r.steps.any((s) => s.kind == 'lift' && s.isVertical), isTrue);
  });

  test('wheelchair-only route avoids stairs', () {
    final r = Router.route(demoFloors(), 'entrance', 'lab',
        const RoutingOptions(wheelchairOnly: true, algorithm: 'astar'));
    expect(r.found, isTrue);
    expect(r.accessible, isTrue);
    expect(r.steps.any((s) => s.kind == 'stair'), isFalse);
    expect(r.steps.any((s) => s.kind == 'lift' && s.isVertical), isTrue);
  });

  test('wheelchair-only to a stairs-only vertical destination is impossible', () {
    final r = Router.route(demoFloors(), 'entrance', 'stair2',
        const RoutingOptions(wheelchairOnly: true, algorithm: 'astar'));
    expect(r.found, isFalse);
  });

  test('not-found for disconnected nodes', () {
    final r = Router.route(demoFloors(), 'entrance', 'nonexistent');
    expect(r.found, isFalse);
    expect(r.steps, isEmpty);
  });

  test('turn-by-turn instructions in EN and HI', () {
    final r = Router.route(demoFloors(), 'entrance', 'pha');
    for (final s in r.steps) {
      expect(s.instruction.isNotEmpty, isTrue);
      expect(s.instructionHindi.isNotEmpty, isTrue);
    }
    expect(r.steps.last.instruction, contains('Arrive at'));
  });

  test('estimated walking time = distance / 1 m/s', () {
    final r = Router.route(demoFloors(), 'entrance', 'pha');
    expect(r.estimatedWalkingTimeSeconds, r.totalDistanceMetres.round());
  });

  test('nodeDistanceMetres computes Euclidean distance', () {
    final a = NavNode(id: 'a', floorId: 'F1', type: NodeType.junction, x: 0, y: 0);
    final b = NavNode(id: 'b', floorId: 'F1', type: NodeType.junction, x: 3, y: 4);
    expect(nodeDistanceMetres(a, b), closeTo(5, 1e-9));
  });
}
