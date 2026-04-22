import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../security/secure_storage.dart';

final dioProvider = Provider<Dio>((ref) {
  final secureStorage = ref.watch(secureStorageProvider);
  const allowedHost = 'calorie-tracker-k014.onrender.com';

  final dio = Dio(
    BaseOptions(
      baseUrl: 'https://calorie-tracker-k014.onrender.com',
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
      sendTimeout: const Duration(seconds: 8),
      responseType: ResponseType.json,
      headers: const {
        'Accept': 'application/json',
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final host = options.uri.host;
        if (host != allowedHost) {
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.badCertificate,
              message: 'Blocked request to untrusted host.',
            ),
          );
          return;
        }

        final token = await secureStorage.readToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }

        handler.next(options);
      },
      onError: (e, handler) {
        final status = e.response?.statusCode;
        final message = status == null
            ? 'Cannot reach server. Check network and try again.'
            : status >= 500
                ? 'Server is temporarily unavailable.'
                : 'Request failed. Please try again.';

        final sanitized = DioException(
          requestOptions: e.requestOptions,
          type: e.type,
          message: message,
          error: e.error,
          response: e.response,
        );
        handler.next(sanitized);
      },
    ),
  );

  return dio;
});
