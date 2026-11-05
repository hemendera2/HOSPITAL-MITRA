import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../core/routes.dart';
import '../engine/routing/graph.dart';
import '../services/api_service.dart';
import '../widgets/step_card.dart';

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({super.key, required this.args});
  final MapArgs args;
  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  RouteResult? _route;
  bool _loading = true;
  int _currentStep = 0;
  Timer? _timer;
  bool _voice = false;
  bool _hindi = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    try {
      final state = context.read<AppState>();
      final r = await state.api.route(widget.args.hospitalId, widget.args.startId!, widget.args.endId!);
      setState(() {
        _route = r;
        _loading = false;
      });
      if (r.found) _beginPlayback();
    } on ApiException {
      setState(() => _loading = false);
    }
  }

  void _beginPlayback() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 2), (t) {
      setState(() {
        if (_currentStep < (_route?.steps.length ?? 0) - 1) {
          _currentStep++;
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    final route = _route;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('navigation'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : route == null || !route.found
              ? EmptyState(icon: Icons.route, text: l10n.t('no_results'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(children: [
                          const Icon(Icons.walk, size: 28),
                          const SizedBox(width: 12),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${route.totalDistanceMetres.toStringAsFixed(0)} m', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                            Text('${route.estimatedWalkingTimeSeconds} s  ·  ${route.steps.length} ${l10n.t('steps')}'),
                          ])),
                          if (route.accessible) const Icon(Icons.accessibility_new, color: Colors.green) else const Icon(Icons.accessibility_new, color: Colors.grey),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(children: [
                      Switch(value: _voice, onChanged: (v) => setState(() => _voice = v)),
                      Text(l10n.t('voice_directions'), style: const TextStyle(fontSize: 14)),
                      const SizedBox(width: 12),
                      Switch(value: _hindi, onChanged: (v) => setState(() => _hindi = v)),
                      Text(l10n.t('hindi_voice'), style: const TextStyle(fontSize: 14)),
                    ]),
                    const SizedBox(height: 12),
                    if (_voice && _route != null && _route!.found) _stepCard(_route!.steps[_currentStep], isCurrent: true),
                    const SizedBox(height: 8),
                    for (var i = 0; i < route.steps.length; i++)
                      if (_voice || i > _currentStep) ...[
                        if (i > 0) const _Divider(),
                        _stepCard(route.steps[i], isCurrent: i == _currentStep && !_voice, highlight: i == _currentStep),
                      ],
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: _start,
                      icon: const Icon(Icons.refresh),
                      label: Text(l10n.t('reroute')),
                    ),
                  ],
                ),
    );
  }

  Widget _stepCard(RouteStep step, {bool isCurrent = false, bool highlight = false}) {
    final state = context.read<AppState>();
    final l10n = state.l10n;
    final text = l10n.isHindi && state.locale.value == AppLocale.hi ? step.instructionHindi : step.instruction;
    final emoji = _iconFor(step.kind);
    return StepCard(
      emoji: emoji,
      kindLabel: step.kind,
      text: text,
      distance: step.distanceMetres,
      accessibility: step.accessibility == AccessibilityClass.wheelchairAccessible ? l10n.t('accessible_route') : l10n.t('not_accessible'),
      isVertical: step.isVertical,
      floorLabel: step.toFloorLabel,
      isCurrent: isCurrent,
      highlight: highlight,
    );
  }

  String _iconFor(String kind) => switch (kind) {
        'entrance' || 'exit' => '🚪',
        'corridor' || 'walk' => '👣',
        'lift' => '⬆️',
        'stair' => '🪜',
        'escalator' => '🛗',
        _ => '🧭',
      };
}

class _Divider extends StatelessWidget {
  const _Divider({super.key});
  @override
  Widget build(BuildContext context) => const Padding(padding: EdgeInsets.symmetric(vertical: 4), child: Divider(height: 1));
}
