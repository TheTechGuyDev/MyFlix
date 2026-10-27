import 'package:flutter/material.dart';

class AppColors {
  static const ink = Color(0xFF0A0A0B);
  static const ink2 = Color(0xFF141416);
  static const ink3 = Color(0xFF1F1F23);
  static const line = Color(0xFF2C2C31);
  static const muted = Color(0xFFA3A3AD);
  static const brand = Color(0xFF0D9B5F);
  static const brandBright = Color(0xFF19C37D);
  static const danger = Color(0xFFEB3942);
}

const kDisplay = 'BebasNeue';

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    fontFamily: 'Inter',
    scaffoldBackgroundColor: AppColors.ink,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.brand,
      secondary: AppColors.brandBright,
      surface: AppColors.ink2,
      error: AppColors.danger,
    ),
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.ink3,
      labelStyle: const TextStyle(color: AppColors.muted),
      floatingLabelStyle: const TextStyle(color: AppColors.muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppColors.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Colors.white, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppColors.danger)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppColors.danger, width: 1.5)),
      errorStyle: const TextStyle(color: AppColors.danger),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Colors.white,
      contentTextStyle: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w500),
      behavior: SnackBarBehavior.floating,
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.brand : Colors.transparent),
      side: const BorderSide(color: AppColors.muted, width: 1.5),
    ),
  );
}
