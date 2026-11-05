import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../models/hospital.dart';
import '../services/offline_store.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _search = TextEditingController();
  List<Hospital> _hospitals = [];
  bool _loading = true;
  List<OfflineHospitalMeta> _offline = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final state = context.read<AppState>();
      final hosps = await state.api.hospitals();
      final offline = await OfflineStore.listHospitals();
      setState(() {
        _hospitals = hosps;
        _offline = offline;
        _loading = false;
      });
    } on Exception catch (e) {
      setState(() {
        _loading = false;
        _hospitals = _offline.map((o) => Hospital(id: o.id, name: o.name, city: o.city)).toList();
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  List<Hospital> get _filtered {
    final q = _search.text.trim().toLowerCase();
    if (q.isEmpty) return _hospitals;
    return _hospitals.where((h) => h.name.toLowerCase().contains(q) || h.city.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    return Scaffold(
      appBar: AppBar(title: const Text('Hospital Mitra')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(children: [
                IconButton(
                  onPressed: () => state.locale.value == AppLocale.en ? state.locale.value = AppLocale.hi : state.locale.value = AppLocale.en,
                  tooltip: l10n.t('language'),
                  icon: const Icon(Icons.language),
                ),
                Expanded(
                  child: TextField(
                    controller: _search,
                    decoration: InputDecoration(
                      hintText: l10n.t('search_hospitals'),
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _search.text.isEmpty ? null : IconButton(onPressed: () => _search.clear(), icon: const Icon(Icons.clear)),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _loading ? null : _load(),
                  ),
                ),
              ]),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? EmptyState(icon: Icons.hospital_outlined, text: l10n.t('no_results'))
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: _filtered.length,
                          itemBuilder: (context, i) => _hospitalCard(context, _filtered[i]),
                        ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).pushNamed('/qr'),
        child: const Icon(Icons.qr_code_scanner),
      ),
    );
  }

  Widget _hospitalCard(BuildContext context, Hospital h) {
    final state = context.read<AppState>();
    final offline = _offline.any((o) => o.id == h.id);
    return Card(
      child: ListTile(
        leading: Icon(h.mapVerified ? Icons.map : Icons.map_outlined, color: h.mapVerified ? Colors.green : Colors.grey),
        title: Row(children: [
          Expanded(child: Text(h.name)),
          if (h.isDemo) DemoBadge(),
        ]),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${h.city}, ${h.district}'),
          Row(children: [
            h.mapVerified ? const Icon(Icons.check_circle, size: 14, color: Colors.green) : const Icon(Icons.circle_outline, size: 14, color: Colors.grey),
            const SizedBox(width: 4),
            Text(h.mapVerified ? state.l10n.t('mapped') : state.l10n.t('unmapped'), style: const TextStyle(fontSize: 12)),
            if (offline) ...[const SizedBox(width: 6), const Icon(Icons.cloud_off, size: 14, color: Colors.green)],
          ]),
        ]),
        trailing: offline ? const Icon(Icons.cloud_done, color: Colors.green) : null,
        onTap: () {
          state.selectedHospitalId.value = h.id;
          Navigator.of(context).pushNamed('/detail', arguments: h.id);
        },
      ),
    );
  }
}

class DemoBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: Colors.amber.shade100, borderRadius: BorderRadius.circular(6)),
        child: const Text('DEMO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber.shade800)),
      );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String text;
  const EmptyState({super.key, required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 56, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
          const SizedBox(height: 12),
          Text(text, style: Theme.of(context).textTheme.bodyMedium),
        ]),
      );
}
