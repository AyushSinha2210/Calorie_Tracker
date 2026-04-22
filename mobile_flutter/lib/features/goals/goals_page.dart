import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class GoalsPage extends StatelessWidget {
  const GoalsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Goals', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Performance targets and completion progress', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
        const SizedBox(height: 14),
        _goal('Weekly Running', 0.72, '25.2 / 35 km'),
        const SizedBox(height: 10),
        _goal('Calories Burn', 0.58, '2,320 / 4,000 kcal'),
        const SizedBox(height: 10),
        _goal('Strength Sessions', 0.80, '4 / 5 sessions'),
      ],
    );
  }

  Widget _goal(String title, double progress, String meta) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                minHeight: 9,
                value: progress,
                backgroundColor: AppColors.bgElevated,
                valueColor: const AlwaysStoppedAnimation(AppColors.accent),
              ),
            ),
            const SizedBox(height: 8),
            Text(meta, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
