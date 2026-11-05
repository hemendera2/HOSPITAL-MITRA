import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/app_state.dart';
import 'core/l10n.dart';
import 'core/routes.dart';
import 'screens/home_screen.dart';
import 'screens/hospital_detail_screen.dart';
import 'screens/floors_screen.dart';
import 'screens/search_screen.dart';
import 'screens/indoor_map_screen.dart';
import 'screens/navigation_screen.dart';
import 'screens/offline_screen.dart';
import 'screens/accessibility_screen.dart';
import 'screens/emergency_screen.dart';
import 'screens/qr_screen.dart';
import 'screens/feedback_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiService(); // baseUrl overridable via build flag / env
  runApp(
    ChangeNotifierProvider.value(
      value: AppState(api: api),
      child: const HospitalMitraApp(),
    ),
  );
}

class HospitalMitraApp extends StatelessWidget {
  const HospitalMitraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (_, state, __) {
        return MaterialApp(
          title: state.l10n.t('app_name'),
          debugShowCheckedModeBanner: false,
          theme: state.theme,
          home: const _RootShell(),
          routes: {
            '/detail': (_) => const HospitalDetailScreen(),
            '/floors': (_) => const FloorsScreen(),
            '/search': (_) => const SearchScreen(),
            '/map': (_) => const IndoorMapScreen(),
            '/navigation': (_) => const NavigationScreen(),
            '/offline': (_) => const OfflineScreen(),
            '/accessibility': (_) => const AccessibilityScreen(),
            '/emergency': (_) => const EmergencyScreen(),
            '/qr': (_) => const QrScreen(),
            '/feedback': (_) => const FeedbackScreen(),
          },
        );
      },
    );
  }
}

// Bottom-nav shell so the patient app keeps a single entry point.
class _RootShell extends StatefulWidget {
  const _RootShell({super.key});
  @override
  State<_RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<_RootShell> {
  int _idx = 0;
  final List<_Tab> _tabs = const [
    _Tab(Icons.home_outlined, Icons.home, '/home'),
    _Tab(Icons.cloud_off_outlined, Icons.cloud_off, '/offline'),
    _Tab(Icons.accessibility_new_outlined, Icons.accessibility_new, '/accessibility'),
    _Tab(Icons.local_hospital_outlined, Icons.local_hospital, '/emergency'),
  ];

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = state.l10n;
    return Scaffold(
      body: IndexedStack(index: _idx, children: [
        const HomeScreen(),
        const OfflineScreen(),
        const AccessibilityScreen(),
        const EmergencyScreen(),
      ]),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: SizedBox(
            width: double.infinity,
            height: 64,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  IconButton(
                    key: ValueKey(i),
                    selectedColor: state.theme.colorScheme.primary,
                    icon: Icon(_tabs[i].selected ? _tabs[i].iconActive : _tabs[i].icon, size: 26),
                    selected: _idx == i,
                    onPressed: () => setState(() => _idx = i),
                    tooltip: l10n.t(_tabs[i].label),
                  ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).pushNamed('/qr'),
        child: const Icon(Icons.qr_code_scanner),
      ),
    );
  }
}

class _Tab {
  final IconData icon;
  final IconData iconActive;
  final String label;
  const _Tab(this.icon, this.iconActive, this.label);
}
