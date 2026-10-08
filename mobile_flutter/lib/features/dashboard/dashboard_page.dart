import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/stat_tile.dart';
import 'application/dashboard_controller.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(dashboardControllerProvider);
    final data = state.data;

    if (state.loading && data == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (data == null) {
      return const Center(child: Text('Unable to load dashboard.'));
    }

    return CustomScrollView(
      slivers: [
        SliverAppBar.large(
          pinned: true,
          backgroundColor: AppColors.bg,
          title: const Text('Athlete Dashboard'),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFFFF6A3D), Color(0xFFFF924E)]),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Welcome back, ${data.userName}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('${data.streakDays} day streak  •  Stay consistent', style: const TextStyle(fontSize: 12, color: Colors.white70)),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.35,
                children: [
                  StatTile(icon: Icons.local_fire_department, label: 'Calories', value: '${data.calories}', unit: 'kcal'),
                  StatTile(icon: Icons.route, label: 'Distance', value: data.distanceKm.toStringAsFixed(1), unit: 'km'),
                  StatTile(icon: Icons.timer, label: 'Active', value: '${data.activeMinutes}', unit: 'min'),
                  StatTile(icon: Icons.water_drop, label: 'Hydration', value: '${data.hydrationMl}', unit: 'ml'),
                ],
              ),
              const SizedBox(height: 14),
              Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 18),
                  child: SizedBox(
                    height: 180,
                    child: BarChart(
                      BarChartData(
                        gridData: const FlGridData(show: false),
                        borderData: FlBorderData(show: false),
                        titlesData: FlTitlesData(
                          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (value, _) {
                                const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                                final i = value.toInt();
                                if (i < 0 || i >= days.length) return const SizedBox.shrink();
                                return Text(days[i], style: const TextStyle(fontSize: 11, color: AppColors.textMuted));
                              },
                            ),
                          ),
                        ),
                        barGroups: [
                          for (var i = 0; i < data.weeklyBurn.length; i++)
                            _bar(i, data.weeklyBurn[i]),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (state.loading)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text('Refreshing data...', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                ),
              if (state.error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(state.error!, style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
                ),
            ]),
          ),
        ),
      ],
    );
  }

  static BarChartGroupData _bar(int x, double y) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: y,
          width: 11,
          borderRadius: BorderRadius.circular(8),
          gradient: const LinearGradient(colors: [AppColors.accent2, AppColors.accent3]),
        ),
      ],
    );
  }
}
