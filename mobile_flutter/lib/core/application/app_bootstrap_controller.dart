import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../repositories/fitness_repository.dart';

class AppBootstrapState {
  const AppBootstrapState({
    this.initialized = false,
    this.warming = false,
    this.message = 'Starting...',
  });

  final bool initialized;
  final bool warming;
  final String message;

  AppBootstrapState copyWith({
    bool? initialized,
    bool? warming,
    String? message,
  }) {
    return AppBootstrapState(
      initialized: initialized ?? this.initialized,
      warming: warming ?? this.warming,
      message: message ?? this.message,
    );
  }
}

final appBootstrapControllerProvider =
    StateNotifierProvider<AppBootstrapController, AppBootstrapState>((ref) {
  final repo = ref.watch(fitnessRepositoryProvider);
  return AppBootstrapController(repo)..initialize();
});

class AppBootstrapController extends StateNotifier<AppBootstrapState> {
  AppBootstrapController(this._repo) : super(const AppBootstrapState());

  final FitnessRepository _repo;

  Future<void> initialize() async {
    state = state.copyWith(warming: true, message: 'Loading quick data...');

    // Quick read path (cached startup cards/searches).
    await _repo.quickStartExercises();

    state = state.copyWith(message: 'Warming backend...');
    await _repo.prewarmAppData();

    state = state.copyWith(
      initialized: true,
      warming: false,
      message: 'Ready',
    );
  }
}
