import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import 'application/goals_controller.dart';

class GoalsPage extends ConsumerWidget {
  const GoalsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(goalsControllerProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Goals', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Performance targets and completion progress', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
        const SizedBox(height: 14),
        if (state.loading && state.items.isEmpty)
          const Center(child: CircularProgressIndicator()),
        ...state.items.map(
          (goal) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _goal(goal.title, goal.progress, goal.meta),
          ),
        ),
        if (!state.loading && state.items.isEmpty)
          const Text('No goals loaded.'),
        if (state.error != null)
          Text(state.error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
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
