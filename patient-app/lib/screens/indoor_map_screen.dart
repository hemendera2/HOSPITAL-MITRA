import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../core/routes.dart';
import '../models/hospital.dart';
import '../engine/routing/graph.dart';
import '../services/api_service.dart';

class IndoorMapScreen extends StatefulWidget {
  const IndoorMapScreen({super.key, required this.args});
  final MapArgs args;
  @override
  State<IndoorMapScreen> createState() => _IndoorMapScreenState();
}

class _IndoorMapScreenState extends State<IndoorMapScreen> {
  FloorGraph? _graph;
  Floor? _floor;
  List<Floor>? _floors;
  RouteResult? _route;
  String? _startId;
  String? _endId;
  bool _loading = true;
  bool _wheelchair = false;
  double _scale = 1.0;
  Offset _pan = Offset.zero;
  Offset _startPan = Offset.zero;

  static const _nodeColors = <NodeType, String>{
    NodeType.entrance: '#2E7D32',
    NodeType.junction: '#546E7A',
    NodeType.room: '#6A1B9A',
    NodeType.lift: '#EF6C00',
    NodeType.stair: '#6D4C41',
    NodeType.wc: '#00838F',
    NodeType.waiting: '#283593',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final state = context.read<AppState>();
      final h = await state.api.hospitalDetail(widget.args.hospitalId);
      final g = await state.api.floorGraph(widget.args.hospitalId, widget.args.floorId);
      setState(() {
        _graph = g;
        _floors = h.floors;
        _floor = h.floors.firstWhere((f) => f.id == widget.args.floorId, orElse: () => null);
        _loading = false;
        if (widget.args.destinationId != null) _endId = widget.args.destinationId;
        _startId = g.nodes.firstWhere((n) => n.type == NodeType.entrance, orElse: () => g.nodes.first).id;
      });
    } on ApiException catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.status}: ${e.message}')));
    }
  }

  Future<void> _computeRoute() async {
    if (_startId == null || _endId == null) return;
    setState(() => _loading = true);
    try {
      final state = context.read<AppState>();
      final r = await state.api.route(widget.args.hospitalId, _startId!, _endId!, wheelchairOnly: _wheelchair);
      setState(() {
        _route = r;
        _loading = false;
      });
      if (!r.found && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No route found')));
      }
    } on ApiException catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.status}')));
    }
  }

  // Coordinate transform: node (metres) -> SVG pixels, given a bounding box.
  (double, double) _toSvg(double x, double y) {
    final g = _graph!;
    final xs = g.nodes.map((n) => n.x);
    final ys = g.nodes.map((n) => n.y);
    final minX = xs.reduce(math.min), maxX = xs.reduce(math.max);
    final minY = ys.reduce(math.min), maxY = ys.reduce(math.max);
    const pad = 40.0;
    final spanX = (maxX - minX).clamp(1, 1) + pad * 2;
    final spanY = (maxY - minY).clamp(1, 1) + pad * 2;
    final span = math.max(spanX, spanY);
    final cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    final sx = ((x - cx) + span / 2) * _scale + _pan.dx;
    final sy = ((y - cy) + span / 2) * _scale + _pan.dy;
    return (sx, sy);
  }

  Widget _svg() {
    final graph = _graph;
    if (graph == null) return const SizedBox.shrink();
    final xs = graph.nodes.map((n) => n.x);
    final ys = graph.nodes.map((n) => n.y);
    const pad = 40.0;
    final span = math.max((xs.reduce(math.max) - xs.reduce(math.min)).clamp(1, 1),
            (ys.reduce(math.max) - ys.reduce(math.min)).clamp(1, 1)) + pad * 2;
    final vb = (span * _scale);

    final pathNodeIds = _route?.pathNodeIds ?? [];
    final svg = StringBuffer();
    svg.write('<svg viewBox="0 0 $vb $vb" xmlns="http://www.w3.org/2000/svg">');
    svg.write('<rect x="0" y="0" width="$vb" height="$vb" fill="#F3F6F5"/>');
    for (final e in graph.edges) {
      final (x1, y1) = _toSvg(e.start.x, e.start.y);
      final (x2, y2) = _toSvg(e.end.x, e.end.y);
      svg.write('<line x1="$x1" y1="$y1" x2="$x2" y2="$y2" stroke="#E0E0E0" stroke-width="${6 * _scale}"/>');
    }
    if (pathNodeIds.length >= 2) {
      final pts = pathNodeIds.map((id) {
        final n = graph.getNode(id)!;
        final (x, y) = _toSvg(n.x, n.y);
        return '$x,$y';
      }).join(' ');
      svg.write('<polyline points="$pts" fill="none" stroke="#0D9488" stroke-width="${10 * _scale}" stroke-linejoin="round" stroke-linecap="round"/>');
    }
    for (final n in graph.nodes) {
      final (x, y) = _toSvg(n.x, n.y);
      final col = _nodeColors[n.type] ?? '#9E9E9E';
      svg.write('<circle cx="$x" cy="$y" r="${14 * _scale}" fill="$col" stroke="#fff" stroke-width="3"/>');
    }
    if (_startId != null) _ring(svg, graph.getNode(_startId!)!, '#0D9488');
    if (_endId != null) _ring(svg, graph.getNode(_endId!)!, '#DC2626');
    svg.write('</svg>');
    return SizedBox(
      width: double.infinity,
      height: 340,
      child: InteractiveViewer(
        boundaryKey: const ValueKey('boundary'),
        minScale: 0.5,
        maxScale: 4.0,
        onInteraction: (d) {
          if (d.pointerDeviceType == PointerDeviceType.touch && d.delta.distance > 0) {
            setState(() => _pan = _startPan + d.delta);
          }
        },
        onInteractionEnd: (_) => setState(() => _startPan = _pan),
        child: SvgPicture.string(svg.toString()),
      ),
    );
  }

  void _ring(StringBuffer svg, NavNode n, String color) {
    final (x, y) = _toSvg(n.x, n.y);
    svg.write('<circle cx="$x" cy="$y" r="${22 * _scale}" fill="$color" fill-opacity="0.18" stroke="$color" stroke-width="4"/>');
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    final graph = _graph;
    return Scaffold(
      appBar: AppBar(title: Text(_floor?.floorLabel ?? widget.args.floorId)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : graph == null
              ? EmptyState(icon: Icons.map, text: l10n.t('unmapped'))
              : Column(
                  children: [
                    if ((_floors ?? const []).where((f) => f.buildingId == _floor?.buildingId).length > 1)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: SizedBox(
                          width: 360,
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isExpanded: true,
                              value: widget.args.floorId,
                              items: (_floors ?? const []).map((f) => DropdownMenuItem(value: f.id, child: Text(f.floorLabel))).toList(),
                              onChanged: (v) {
                                if (v != null) Navigator.of(context).pushReplacementNamed('/map', arguments: MapArgs(hospitalId: widget.args.hospitalId, floorId: v));
                              },
                            ),
                          ),
                        ),
                      ),
                    Expanded(child: _svg()),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(children: [
                        Expanded(child: DropdownButtonHideUnderline(child: DropdownButton<String>(
                          value: _startId,
                          items: graph.nodes.map((n) => DropdownMenuItem(value: n.id, child: Text(n.label ?? n.id))).toList(),
                          onChanged: (v) => setState(() => _startId = v),
                        ))),
                        const SizedBox(width: 8),
                        Expanded(child: DropdownButtonHideUnderline(child: DropdownButton<String>(
                          value: _endId,
                          items: graph.nodes.map((n) => DropdownMenuItem(value: n.id, child: Text(n.label ?? n.id))).toList(),
                          onChanged: (v) => setState(() => _endId = v),
                        ))),
                      ]),
                    ),
                    if (_route != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('${l10n.t('total_distance')}: ${_route!.totalDistanceMetres.toStringAsFixed(0)} m  ·  ${l10n.t('steps')}: ${_route!.steps.length}', style: const TextStyle(fontSize: 14)),
                      ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(children: [
                        Switch(value: _wheelchair, onChanged: (v) => setState(() => _wheelchair = v)),
                        Text(l10n.t('accessible_route'), style: const TextStyle(fontSize: 14)),
                        const Spacer(),
                        OutlinedButton.icon(
                          onPressed: _computeRoute,
                          icon: const Icon(Icons.show_chart),
                          label: const Text('Route'),
                        ),
                        const SizedBox(width: 8),
                        FilledButton.icon(
                          onPressed: (_startId != null && _endId != null)
                              ? () => Navigator.of(context).pushNamed('/navigation', arguments: MapArgs(
                                  hospitalId: widget.args.hospitalId,
                                  floorId: widget.args.floorId,
                                  startId: _startId!,
                                  endId: _endId!,
                                  destinationId: widget.args.destinationId))
                              : null,
                          icon: const Icon(Icons.directions_walk),
                          label: Text(l10n.t('start_navigation')),
                        ),
                      ]),
                    ),
                  ],
                ),
    );
  }
}
