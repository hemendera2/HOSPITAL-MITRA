import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../services/offline_store.dart';

class OfflineScreen extends StatefulWidget {
  const OfflineScreen({super.key});
  @override
  State<OfflineScreen> createState() => _OfflineScreenState();
}

class _OfflineScreenState extends State<OfflineScreen> {
  List<OfflineHospitalMeta> _hospitals = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    setState(() => _hospitals = await OfflineStore.listHospitals());
    setState(() => _loading = false);
  }

  Future<void> _delete(String id) async {
    await OfflineStore.deleteHospital(id);
    if (mounted) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<AppState>().l10n;
    return Scaffold(
      appBar: AppBar(title: const Text('Offline Maps')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _hospitals.isEmpty
              ? EmptyState(icon: Icons.cloud_off, text: l10n.t('offline_available'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _hospitals.length,
                  itemBuilder: (context, i) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.cloud_off, color: Colors.green),
                      title: Text(_hospitals[i].name),
                      subtitle: Text('${l10n.t('last_updated')}: ${_hospitals[i].updatedAt}'),
                      trailing: PopupMenuButton<String>(
                        itemBuilder: (_) => const [PopupMenuItem(value: 'delete', child: Text('Delete'))],
                        onSelected: (v) => _delete(_hospitals[i].id),
                      ),
                    ),
                  ),
                ),
    );
  }
}
