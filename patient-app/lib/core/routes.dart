// Shared navigation route arguments.

class MapArgs {
  final String hospitalId;
  final String floorId;
  final String? destinationId;
  final String? startId;
  final String? endId;
  MapArgs({
    required this.hospitalId,
    required this.floorId,
    this.destinationId,
    this.startId,
    this.endId,
  });
}
