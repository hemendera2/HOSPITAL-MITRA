import 'package:flutter/material.dart';
import '../core/l10n.dart';
import '../core/app_theme.dart';
import '../services/api_service.dart';

// Central app state: API client, locale, accessibility mode, dark mode,
// selected hospital.

class AppState {
  final ApiService api;
  final ValueNotifier<AppLocale> locale;
  final ValueNotifier<AccessibilityMode> accessibility;
  final ValueNotifier<bool> darkMode;
  final ValueNotifier<String?> selectedHospitalId;

  AppState({required this.api})
      : locale = ValueNotifier(AppLocale.en),
        accessibility = ValueNotifier(const AccessibilityMode()),
        darkMode = ValueNotifier(false),
        selectedHospitalId = ValueNotifier(null);

  L10n get l10n => L10n(locale.value);

  ThemeData get theme {
    final dark = darkMode.value;
    if (accessibility.value.highContrast) return AppTheme.highContrast(dark);
    return dark ? AppTheme.dark() : AppTheme.light();
  }

  double get fontScale => accessibility.value.largeText ? 1.25 : 1.0;
}
