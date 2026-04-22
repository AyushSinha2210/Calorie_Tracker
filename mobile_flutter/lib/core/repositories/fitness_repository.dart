import 'dart:convert';
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
}
