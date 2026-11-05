import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';

class AccessibilityScreen extends StatelessWidget {
  const AccessibilityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    final acc = state.accessibility.value;
    return Scaffold(
      appBar: AppBar(title: const Text('Accessibility')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: SwitchListTile(
              value: state.darkMode.value,
              title: Text(l10n.t('language')),
              subtitle: const Text('Dark theme'),
              onChanged: (v) => state.darkMode.value = v,
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: SwitchListTile(
              value: acc.largeText,
              title: Text(l10n.t('large_text')),
              onChanged: (v) => state.accessibility.value = acc.copyWith(largeText: v),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: SwitchListTile(
              value: acc.highContrast,
              title: Text(l10n.t('high_contrast')),
              onChanged: (v) => state.accessibility.value = acc.copyWith(highContrast: v),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: SwitchListTile(
              value: acc.wheelchair,
              title: Text(l10n.t('wheelchair_routes')),
              onChanged: (v) => state.accessibility.value = acc.copyWith(wheelchair: v),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: SwitchListTile(
              value: acc.voiceDirections,
              title: Text(l10n.t('voice_directions')),
              onChanged: (v) => state.accessibility.value = acc.copyWith(voiceDirections: v),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: SwitchListTile(
              value: acc.hindiVoice,
              title: Text(l10n.t('hindi_voice')),
              onChanged: (v) => state.accessibility.value = acc.copyWith(hindiVoice: v),
            ),
          ),
        ],
      ),
    );
  }
}
