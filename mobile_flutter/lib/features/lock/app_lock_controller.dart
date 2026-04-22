import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/security/secure_storage.dart';

class AppLockState {
  const AppLockState({
    this.enabled = false,
    this.unlocked = true,
    this.initialized = false,
  });

  final bool enabled;
  final bool unlocked;
  final bool initialized;

  AppLockState copyWith({
    bool? enabled,
    bool? unlocked,
    bool? initialized,
  }) {
    return AppLockState(
      enabled: enabled ?? this.enabled,
      unlocked: unlocked ?? this.unlocked,
      initialized: initialized ?? this.initialized,
    );
  }
}

final appLockControllerProvider =
    StateNotifierProvider<AppLockController, AppLockState>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return AppLockController(storage)..initialize();
});

class AppLockController extends StateNotifier<AppLockState> {
  AppLockController(this._storage) : super(const AppLockState());

  final SecureStorage _storage;

  static const _enabledKey = 'app_lock_enabled';
  static const _pinHashKey = 'app_lock_pin_hash';

  Future<void> initialize() async {
    final enabled = await _storage.read(_enabledKey) == '1';
    state = state.copyWith(
      enabled: enabled,
      unlocked: !enabled,
      initialized: true,
    );
  }

  Future<void> enableLock(String pin) async {
    await _storage.write(_enabledKey, '1');
    await _storage.write(_pinHashKey, _hash(pin));
    state = state.copyWith(enabled: true, unlocked: true);
  }

  Future<void> disableLock() async {
    await _storage.delete(_enabledKey);
    await _storage.delete(_pinHashKey);
    state = state.copyWith(enabled: false, unlocked: true);
  }

  Future<bool> unlock(String pin) async {
    final storedHash = await _storage.read(_pinHashKey);
    if (storedHash == null) {
      state = state.copyWith(unlocked: true);
      return true;
    }

    final isValid = storedHash == _hash(pin);
    if (isValid) {
      state = state.copyWith(unlocked: true);
    }
    return isValid;
  }

  void lockNow() {
    if (state.enabled) {
      state = state.copyWith(unlocked: false);
    }
  }

  String _hash(String value) {
    return sha256.convert(utf8.encode(value)).toString();
  }
}
