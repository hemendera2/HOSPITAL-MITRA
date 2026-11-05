import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../models/hospital.dart';
import '../services/api_service.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, required this.hospitalId});
  final String hospitalId;
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _search = TextEditingController();
  List<SearchResult> _results = [];
  bool _loading = false;
  String? _selectedFloorId;

  Future<void> _submit(String q) async {
    setState(() => _loading = true);
    try {
      final api = context.read<AppState>().api;
      final r = await api.search(widget.hospitalId, q);
      setState(() {
        _results = r;
        _selectedFloorId = r.firstOrNull?.floorId;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.status}')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _search,
                decoration: InputDecoration(
                  hintText: l10n.t('search_hint'),
                  prefixIcon: const Icon(Icons.search),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                ),
                textInputAction: TextInputAction.search,
                onSubmitted: _submit,
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _results.isEmpty
                      ? EmptyState(icon: Icons.search_off, text: l10n.t('no_results'))
                      : ListView.builder(
                          itemCount: _results.length,
                          itemBuilder: (context, i) => _resultTile(context, _results[i]),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _resultTile(BuildContext context, SearchResult r) {
    return Card(
      child: ListTile(
        leading: Icon(_iconFor(r.type)),
        title: Text(r.label),
        subtitle: Text([r.roomNumber, r.floorId, r.category].whereType<String>().join(' · ')),
        onTap: () {
          if (r.floorId == null || r.floorId == '') {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Destination not on an indoor map')));
            return;
          }
          Navigator.of(context).pushNamed('/map', arguments: MapArgs(hospitalId: widget.hospitalId, floorId: r.floorId!, destinationId: r.id));
        },
      ),
    );
  }

  IconData _iconFor(String type) => switch (type) {
        'room' => Icons.meeting_room,
        'department' => Icons.local_hospital,
        'facility' => Icons.accessibility_new,
        'doctor' => Icons.person,
        _ => Icons.location_on,
      };
}
