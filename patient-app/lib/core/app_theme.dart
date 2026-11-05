import 'package:flutter/material.dart';

// Hospital Mitra patient app theme — calm healthcare identity, large touch
// targets, light + dark, high-contrast accessible variants.

class AppTheme {
  static const _brand = Color(0xFF0D9488);
  static const _brandDark = Color(0xFF0F766E);
  static const _danger = Color(0xFFDC2626);
  static const _warn = Color(0xFFD97706);

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: _brand, brightness: Brightness.light),
      scaffoldBackgroundColor: const Color(0xFFF6F8F9),
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0, backgroundColor: Colors.white),
    );
    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(primary: _brand, onPrimary: Colors.white, surface: Colors.white),
      inputDecorationTheme: base.inputDecorationTheme.copyWith(
        filled: true, fillColor: const Color(0xFFF1F5F4),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(54), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
      ),
      cardTheme: CardThemeData(elevation: 0, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), side: const BorderSide(color: Color(0xFFE5E7EB))),
    );
  }

  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: _brand, brightness: Brightness.dark),
      scaffoldBackgroundColor: const Color(0xFF0B1220),
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0, backgroundColor: const Color(0xFF111A2B)),
    );
    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(primary: _brand, onPrimary: Colors.white, surface: const Color(0xFF111A2B)),
      inputDecorationTheme: base.inputDecorationTheme.copyWith(
        filled: true, fillColor: const Color(0xFF0F1828),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(54), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
      ),
      cardTheme: CardThemeData(elevation: 0, color: const Color(0xFF111A2B), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), side: const BorderSide(color: Color(0xFF243149))),
    );
  }

  static ThemeData highContrast(bool dark) {
    final base = dark ? dark() : light();
    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(
        primary: dark ? const Color(0xFF5EEAD4) : _brand,
        onPrimary: dark ? const Color(0xFF0B1220) : Colors.white,
        surface: dark ? const Color(0xFF000000) : Colors.white,
        onSurface: dark ? Colors.white : const Color(0xFF000000),
        error: _danger,
      ),
      textTheme: base.textTheme.apply(bodyColor: dark ? Colors.white : const Color(0xFF000000)),
    );
  }
}

class AccessibilityMode {
  final bool largeText;
  final bool highContrast;
  final bool wheelchair;
  final bool voiceDirections;
  final bool hindiVoice;
  const AccessibilityMode({
    this.largeText = false,
    this.highContrast = false,
    this.wheelchair = false,
    this.voiceDirections = false,
    this.hindiVoice = false,
  });
  AccessibilityMode copyWith({bool? largeText, bool? highContrast, bool? wheelchair, bool? voiceDirections, bool? hindiVoice}) =>
      AccessibilityMode(
        largeText: largeText ?? this.largeText,
        highContrast: highContrast ?? this.highContrast,
        wheelchair: wheelchair ?? this.wheelchair,
        voiceDirections: voiceDirections ?? this.voiceDirections,
        hindiVoice: hindiVoice ?? this.hindiVoice,
      );
}
