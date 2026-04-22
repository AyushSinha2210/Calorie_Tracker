import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/stat_tile.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
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
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Welcome back, Ayush', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                    SizedBox(height: 4),
                    Text('14 day streak  •  Stay consistent', style: TextStyle(fontSize: 12, color: Colors.white70)),
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
                children: const [
                  StatTile(icon: Icons.local_fire_department, label: 'Calories', value: '684', unit: 'kcal'),
                  StatTile(icon: Icons.route, label: 'Distance', value: '9.4', unit: 'km'),
                  StatTile(icon: Icons.timer, label: 'Active', value: '78', unit: 'min'),
                  StatTile(icon: Icons.water_drop, label: 'Hydration', value: '1900', unit: 'ml'),
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
                          _bar(0, 5.2),
                          _bar(1, 7.4),
                          _bar(2, 4.3),
                          _bar(3, 9.1),
                          _bar(4, 6.0),
                          _bar(5, 8.4),
                          _bar(6, 6.8),
                        ],
                      ),
                    ),
                  ),
                ),
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
