import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../models/hospital.dart';
import '../services/api_service.dart';
import '../services/offline_store.dart';

class HospitalDetailScreen extends StatefulWidget {
  const HospitalDetailScreen({super.key, required this.hospitalId});
  final String hospitalId;
  @override
  State<HospitalDetailScreen> createState() => _HospitalDetailScreenState();
}

class _HospitalDetailScreenState extends State<HospitalDetailScreen> {
  HospitalDetail? _detail;
  bool _loading = true;
  bool _offlineDownloaded = false;
  bool _downloading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = context.read<AppState>().api;
      _detail = await api.hospitalDetail(widget.hospitalId);
      setState(() {
        _loading = false;
        _offlineDownloaded = await OfflineStore.isDownloaded(widget.hospitalId);
      });
    } on ApiException catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.status}: ${e.message}')));
    }
  }

  Future<void> _downloadOffline() async {
    setState(() => _downloading = true);
    try {
      final api = context.read<AppState>().api;
      final raw = await api.offlineBundleRaw(widget.hospitalId);
      await OfflineStore.saveBundle(raw);
      setState(() {
        _offlineDownloaded = true;
        _downloading = false;
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Offline map saved')));
    } on ApiException catch (e) {
      setState(() => _downloading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.status}: ${e.message}')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(title: Text(detail?.hospital.name ?? 'Hospital')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : detail == null
              ? EmptyState(icon: Icons.error_outline, text: 'Not available')
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Row(children: [
                      if (detail.hospital.mapVerified)
                          const Padding(padding: EdgeInsets.only(right: 8), child: Icon(Icons.verified, color: Colors.green, size: 20))
                      else
                          const Padding(padding: EdgeInsets.only(right: 8), child: Icon(Icons.verified_user_outlined, color: Colors.grey, size: 20)),
                      Expanded(child: Text(detail.hospital.mapVerified ? l10n.t('mapped') : l10n.t('unmapped'), style: const TextStyle(fontSize: 12))),
                    ]),
                    const SizedBox(height: 8),
                    Text(detail.hospital.address ?? '', style: const TextStyle(fontSize: 13)),
                    const SizedBox(height: 16),
                    Text(l10n.t('buildings'), style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    for (final b in detail.buildings)
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.apartment),
                          title: Text(b.name),
                          subtitle: Text('${b.floorCount} ${l10n.t('floors')}'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.of(context).pushNamed('/floors', arguments: b.id),
                        ),
                      ),
                    const SizedBox(height: 16),
                    Row(children: [
                      Expanded(child: OutlinedButton.icon(
                          onPressed: _offlineDownloaded ? _downloadOffline : _downloadOffline,
                          icon: _downloading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.cloud_off),
                          label: Text(_offlineDownloaded ? l10n.t('downloaded') : l10n.t('download_offline')))),
                      const SizedBox(width: 12),
                      OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).pushNamed('/search', arguments: widget.hospitalId),
                          icon: const Icon(Icons.search),
                          label: const Text('Search')),
                    ]),
                  ],
                ),
    );
  }
}
