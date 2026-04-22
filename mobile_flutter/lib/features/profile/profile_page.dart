import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../lock/app_lock_controller.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  Future<String?> _promptPin(BuildContext context) async {
    final pinController = TextEditingController();
    final confirmController = TextEditingController();

    final pin = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Set App Lock PIN'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: pinController,
                keyboardType: TextInputType.number,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'PIN (4+ digits)'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: confirmController,
                keyboardType: TextInputType.number,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirm PIN'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final pin = pinController.text.trim();
                final confirm = confirmController.text.trim();
                if (pin.length < 4 || pin != confirm) {
                  Navigator.pop(context, '');
                  return;
                }
                Navigator.pop(context, pin);
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );

    if (pinController.text.trim().length < 4 ||
        pinController.text.trim() != confirmController.text.trim()) {
      return '';
    }

    return pin;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lock = ref.watch(appLockControllerProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(vertical: 22),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: const LinearGradient(colors: [Color(0xFFFF6A3D), Color(0xFFFF924E)]),
          ),
          child: const Column(
            children: [
              CircleAvatar(radius: 34, backgroundColor: Colors.black26, child: Text('A', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w700))),
              SizedBox(height: 10),
              Text('Ayush', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
              SizedBox(height: 2),
              Text('Intermediate Athlete', style: TextStyle(fontSize: 13, color: Colors.white70)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const _ProfileSection(title: 'Account', items: ['Profile Settings', 'Connected Devices', 'Notification Preferences']),
        const SizedBox(height: 10),
        const _ProfileSection(title: 'Privacy & Security', items: ['App Lock', 'Encrypted Sync', 'Sign-in Sessions']),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('App Lock', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                const Text('Protect access with a local PIN', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: lock.enabled
                            ? null
                            : () async {
                                final pin = await _promptPin(context);
                                if (pin == null) return;
                                if (pin.isEmpty) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('PIN must match and be at least 4 digits.')),
                                    );
                                  }
                                  return;
                                }

                                await ref.read(appLockControllerProvider.notifier).enableLock(pin);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('App lock enabled successfully.')),
                                  );
                                }
                              },
                        child: const Text('Enable'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: lock.enabled
                            ? () async {
                                await ref.read(appLockControllerProvider.notifier).disableLock();
                              }
                            : null,
                        child: const Text('Disable'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Text(item, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
