import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/workout_exercise.dart';
import '../../../core/repositories/fitness_repository.dart';

class ActivitySearchState {
  const ActivitySearchState({
    this.query = '',
    this.loading = false,
    this.error,
    this.items = const [],
  });

  final String query;
  final bool loading;
  final String? error;
  final List<WorkoutExercise> items;

  ActivitySearchState copyWith({
    String? query,
    bool? loading,
    String? error,
    List<WorkoutExercise>? items,
  }) {
    return ActivitySearchState(
      query: query ?? this.query,
      loading: loading ?? this.loading,
      error: error,
      items: items ?? this.items,
    );
  }
}

final activitySearchControllerProvider =
    StateNotifierProvider<ActivitySearchController, ActivitySearchState>((ref) {
  final repo = ref.watch(fitnessRepositoryProvider);
  return ActivitySearchController(repo);
});

class ActivitySearchController extends StateNotifier<ActivitySearchState> {
  ActivitySearchController(this._repo) : super(const ActivitySearchState());

  final FitnessRepository _repo;

  Future<void> loadQuickStart() async {
    final items = await _repo.quickStartExercises();
    if (items.isEmpty) return;
    state = state.copyWith(items: items, query: '', loading: false, error: null);
  }

  Future<void> search(String term) async {
    final normalized = term.trim();
    state = state.copyWith(query: normalized, loading: true, error: null);

    if (normalized.length < 2) {
      state = state.copyWith(loading: false, items: const []);
      return;
    }

    try {
      final items = await _repo.searchExercises(normalized);
      state = state.copyWith(loading: false, items: items, error: null);
    } catch (_) {
      state = state.copyWith(
        loading: false,
        items: const [],
        error: 'Search unavailable right now.',
      );
    }
  }
}
