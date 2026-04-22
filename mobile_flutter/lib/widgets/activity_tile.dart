import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

class ActivityTile extends StatelessWidget {
  const ActivityTile({
    super.key,
    required this.title,
    required this.meta,
    required this.kcal,
    required this.time,
  });

  final String title;
  final String meta;
  final int kcal;
  final String time;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                Text(time, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              ],
            ),
            const SizedBox(height: 4),
            Text(meta, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.accent.withOpacity(0.2),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('$kcal kcal', style: const TextStyle(fontSize: 12, color: AppColors.accent, fontWeight: FontWeight.w700)),
            )
          ],
        ),
      ),
    );
  }
}
