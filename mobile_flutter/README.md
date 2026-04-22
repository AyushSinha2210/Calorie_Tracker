# Fitness Goal Tracker - Flutter Mobile

A modern Flutter app with a fast UI and security-minded architecture.

## Why this stack

- Flutter + Material 3 for high-performance rendering
- Riverpod for predictable state management
- GoRouter for typed/declarative navigation
- Dio client with strict timeouts and safe defaults
- Flutter Secure Storage for token/session storage

## Run

1. Install Flutter SDK (stable channel)
2. From this folder run:

```bash
flutter pub get
flutter run
```

## Project layout

- lib/app.dart: app shell + navigation
- lib/core/theme: theme tokens
- lib/core/network: hardened API client
- lib/core/security: secure key-value storage
- lib/features/*: screens
- lib/widgets: reusable UI widgets
