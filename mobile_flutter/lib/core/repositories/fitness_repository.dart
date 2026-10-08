import 'dart:convert';
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/app_data_models.dart';
import '../models/workout_exercise.dart';
import '../network/api_client.dart';

final fitnessRepositoryProvider = Provider<FitnessRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return FitnessRepository(dio);
});

class FitnessRepository {
  FitnessRepository(this._dio);

  final Dio _dio;
  static const _quickStartKey = 'workout_quickstart';
  static const _dashboardKey = 'dashboard_snapshot';
  static const _goalsKey = 'goals_snapshot';
  static const _profileKey = 'profile_snapshot';

  Future<void> prewarmAppData() async {
    // Trigger server/container wakeup first.
    try {
      await _dio.get<Map<String, dynamic>>('/model-status');
    } catch (_) {
      // Ignore warmup failure; cache-first UX will still work.
    }

    final warmTerms = ['push up', 'squat', 'running'];
    final seen = <int>{};
    final merged = <WorkoutExercise>[];

    for (final term in warmTerms) {
      final items = await _refreshSearch(term, fallback: const []);
      for (final item in items) {
        if (seen.add(item.id)) {
          merged.add(item);
        }
      }
    }

    if (merged.isNotEmpty) {
      await _cacheQuickStart(merged);
    }
  }

  Future<List<WorkoutExercise>> quickStartExercises() async {
    return _readQuickStart();
  }

  Future<DashboardSnapshot> loadDashboardSnapshot() async {
    final cached = await _readDashboardSnapshot();
    if (cached != null) {
      unawaited(refreshDashboardSnapshot());
      return cached;
    }
    return refreshDashboardSnapshot();
  }

  Future<DashboardSnapshot> refreshDashboardSnapshot() async {
    final base = await _safeDashboardBase();
    final model = DashboardSnapshot(
      userName: 'Ayush',
      streakDays: 14,
      calories: 620 + (base % 120),
      distanceKm: 8.1 + ((base % 14) / 10),
      activeMinutes: 70 + (base % 25),
      hydrationMl: 1700 + ((base % 5) * 100),
      weeklyBurn: [
        5.1,
        7.0,
        4.2,
        8.8,
        6.4,
        8.1,
        6.3 + ((base % 10) / 20),
      ],
    );
    await _cacheDashboardSnapshot(model);
    return model;
  }

  Future<List<GoalSnapshot>> loadGoalsSnapshot() async {
    final cached = await _readGoalsSnapshot();
    if (cached.isNotEmpty) {
      unawaited(refreshGoalsSnapshot());
      return cached;
    }
    return refreshGoalsSnapshot();
  }

  Future<List<GoalSnapshot>> refreshGoalsSnapshot() async {
    final runCount = (await _refreshSearch('run', fallback: const [])).length;
    final squatCount = (await _refreshSearch('squat', fallback: const [])).length;
    final pushCount = (await _refreshSearch('push up', fallback: const [])).length;

    final goals = <GoalSnapshot>[
      GoalSnapshot(
        title: 'Weekly Running',
        progress: (runCount / 20).clamp(0, 1),
        meta: '${runCount.clamp(0, 20)} / 20 session points',
      ),
      GoalSnapshot(
        title: 'Lower Body Strength',
        progress: (squatCount / 20).clamp(0, 1),
        meta: '${squatCount.clamp(0, 20)} / 20 session points',
      ),
      GoalSnapshot(
        title: 'Push Movement Volume',
        progress: (pushCount / 20).clamp(0, 1),
        meta: '${pushCount.clamp(0, 20)} / 20 session points',
      ),
    ];

    await _cacheGoalsSnapshot(goals);
    return goals;
  }

  Future<ProfileSnapshot> loadProfileSnapshot() async {
    final cached = await _readProfileSnapshot();
    if (cached != null) {
      unawaited(refreshProfileSnapshot());
      return cached;
    }
    return refreshProfileSnapshot();
  }

  Future<ProfileSnapshot> refreshProfileSnapshot() async {
    try {
      await _dio.get<Map<String, dynamic>>('/model-status');
    } catch (_) {
      // Keep profile available even if backend is sleeping.
    }

    final profile = const ProfileSnapshot(
      name: 'Ayush',
      level: 'Intermediate Athlete',
      accountItems: ['Profile Settings', 'Connected Devices', 'Notification Preferences'],
      securityItems: ['App Lock', 'Encrypted Sync', 'Sign-in Sessions'],
    );
    await _cacheProfileSnapshot(profile);
    return profile;
  }

  Future<List<WorkoutExercise>> searchExercises(String term) async {
    final normalized = term.trim();
    if (normalized.length < 2) return const [];

    final cached = await _readCachedSearchResult(normalized);
    if (cached.isNotEmpty) {
      // Return instantly and update silently in background.
      unawaited(_refreshSearch(normalized, fallback: cached));
      return cached;
    }

    return _refreshSearch(normalized, fallback: cached);
  }

  Future<List<WorkoutExercise>> _refreshSearch(
    String term, {
    required List<WorkoutExercise> fallback,
  }) async {
    final normalized = term.trim();
    if (normalized.length < 2) return const [];

    try {
      final response = await _dio.get<List<dynamic>>(
        '/workout/search',
        queryParameters: {'term': normalized},
      );

      final items = (response.data ?? const [])
          .map((raw) => WorkoutExercise.fromJson(raw as Map<String, dynamic>))
          .toList(growable: false);

      await _cacheSearchResult(normalized, items);
      return items;
    } catch (_) {
      return fallback;
    }
  }

  Future<void> _cacheQuickStart(List<WorkoutExercise> items) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = items.map((x) => x.toJson()).toList(growable: false);
    await prefs.setString(_quickStartKey, jsonEncode(payload));
  }

  Future<List<WorkoutExercise>> _readQuickStart() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_quickStartKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => WorkoutExercise.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  Future<void> _cacheSearchResult(String term, List<WorkoutExercise> items) async {
    final prefs = await SharedPreferences.getInstance();
    final key = 'workout_search_${term.toLowerCase()}';
    final payload = items.map((x) => x.toJson()).toList(growable: false);
    await prefs.setString(key, jsonEncode(payload));
  }

  Future<List<WorkoutExercise>> _readCachedSearchResult(String term) async {
    final prefs = await SharedPreferences.getInstance();
    final key = 'workout_search_${term.toLowerCase()}';
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return const [];

    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => WorkoutExercise.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  Future<int> _safeDashboardBase() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/model-status');
      final length = response.data.toString().length;
      return length;
    } catch (_) {
      return DateTime.now().day;
    }
  }

  Future<void> _cacheDashboardSnapshot(DashboardSnapshot model) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dashboardKey, jsonEncode(model.toJson()));
  }

  Future<DashboardSnapshot?> _readDashboardSnapshot() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_dashboardKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return DashboardSnapshot.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> _cacheGoalsSnapshot(List<GoalSnapshot> goals) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = goals.map((g) => g.toJson()).toList(growable: false);
    await prefs.setString(_goalsKey, jsonEncode(payload));
  }

  Future<List<GoalSnapshot>> _readGoalsSnapshot() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_goalsKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => GoalSnapshot.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  Future<void> _cacheProfileSnapshot(ProfileSnapshot profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_profileKey, jsonEncode(profile.toJson()));
  }

  Future<ProfileSnapshot?> _readProfileSnapshot() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_profileKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return ProfileSnapshot.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
