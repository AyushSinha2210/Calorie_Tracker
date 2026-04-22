import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const bg = Color(0xFF090F1F);
  static const bgElevated = Color(0xFF141D34);
  static const card = Color(0xFF1A2542);
  static const line = Color(0xFF2D3B62);
  static const text = Color(0xFFF6F8FF);
  static const textMuted = Color(0xFF9AA8CB);
  static const accent = Color(0xFFFF6A3D);
  static const accent2 = Color(0xFF3CD8C5);
  static const accent3 = Color(0xFF7B7BFF);
}

ThemeData buildAppTheme() {
  final textTheme = GoogleFonts.spaceGroteskTextTheme().apply(
    bodyColor: AppColors.text,
    displayColor: AppColors.text,
  );

  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.bg,
    textTheme: textTheme,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.accent,
      secondary: AppColors.accent2,
      surface: AppColors.card,
      onSurface: AppColors.text,
    ),
    cardTheme: const CardTheme(
      color: AppColors.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(20)),
        side: BorderSide(color: AppColors.line),
      ),
    ),
  );
}
