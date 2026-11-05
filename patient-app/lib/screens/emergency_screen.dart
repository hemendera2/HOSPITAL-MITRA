import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';

class EmergencyScreen extends StatelessWidget {
  const EmergencyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    return Scaffold(
      appBar: AppBar(title: const Text('Emergency'), backgroundColor: Colors.red),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Row(children: [Icon(Icons.local_fire_department, color: Colors.red, size: 28), SizedBox(width: 12), Text('Call Emergency Services', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold))]),
            ),
            elevation: 0,
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: OutlinedButton.icon(onPressed: () {}, style: OutlinedButton.styleFrom(foregroundColor: Colors.red, minimumSize: const Size.fromHeight(54)), icon: const Icon(Icons.call), label: const Text('108'))),
            const SizedBox(width: 12),
            Expanded(child: OutlinedButton.icon(onPressed: () {}, style: OutlinedButton.styleFrom(foregroundColor: Colors.red, minimumSize: const Size.fromHeight(54)), icon: const Icon(Icons.phone), label: const Text('100'))),
          ]),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(12)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.info_outline, color: Colors.red),
              const SizedBox(width: 8),
              Expanded(child: Text(l10n.t('emergency_disclaimer'), style: const TextStyle(fontSize: 13))),
            ]),
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.directions_run, color: Colors.red),
              title: Text(l10n.t('emergency_nav')),
              subtitle: Text(l10n.t('emergency_entrance')),
              onTap: () {
                // Navigate to the nearest emergency entrance
                Navigator.of(context).popUntil((r) => r.settings.name == '/home');
              },
            ),
          ),
        ],
      ),
    );
  }
}
