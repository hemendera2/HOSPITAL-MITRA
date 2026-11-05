import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../models/hospital.dart';
import '../services/api_service.dart';

class FloorsScreen extends StatefulWidget {
  const FloorsScreen({super.key, required this.hospitalId, required this.buildingId});
  final String hospitalId;
  final String buildingId;
  @override
  State<FloorsScreen> createState() => _FloorsScreenState();
}

class _FloorsScreenState extends State<FloorsScreen> {
  List<Floor> _floors = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<AppState>().api;
      final h = await api.hospitalDetail(widget.hospitalId);
      setState(() {
        _floors = h.floors.where((f) => f.buildingId == widget.buildingId).toList();
        _loading = false;
      });
    } on ApiException {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    return Scaffold(
      appBar: AppBar(title: const Text('Floors')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _floors.isEmpty
              ? EmptyState(icon: Icons.aspect_ratio, text: l10n.t('unmapped'))
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 1.4),
                  itemCount: _floors.length,
                  itemBuilder: (context, i) => _floorTile(context, _floors[i]),
                ),
    );
  }

  Widget _floorTile(BuildContext context, Floor f) {
    final l10n = context.read<AppState>().l10n;
    final color = f.mapStatus == 'published' ? Colors.green : Colors.grey;
    return Card(
      child: ListTile(
        leading: Icon(f.mapStatus == 'published' ? Icons.map : Icons.map_outlined, color: color),
        title: Text(f.floorLabel),
        subtitle: Text('M${f.floorNumber} · ${f.mapStatus}'),
        onTap: f.mapStatus == 'published'
            ? () => Navigator.of(context).pushNamed('/map', arguments: MapArgs(hospitalId: widget.hospitalId, floorId: f.id))
            : null,
      ),
    );
  }
}
