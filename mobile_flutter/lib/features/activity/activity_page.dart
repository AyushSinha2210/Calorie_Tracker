import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'application/activity_search_controller.dart';

class ActivityPage extends ConsumerStatefulWidget {
  const ActivityPage({super.key});

  @override
  ConsumerState<ActivityPage> createState() => _ActivityPageState();
}

class _ActivityPageState extends ConsumerState<ActivityPage> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    Future.microtask(() {
      ref.read(activitySearchControllerProvider.notifier).loadQuickStart();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(activitySearchControllerProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Workout Search', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Live results from your backend API with offline fallback cache', style: TextStyle(fontSize: 13, color: Color(0xFF9AA8CB))),
        const SizedBox(height: 14),
        TextField(
          controller: _controller,
          textInputAction: TextInputAction.search,
          onSubmitted: (value) {
            ref.read(activitySearchControllerProvider.notifier).search(value);
          },
          decoration: InputDecoration(
            hintText: 'Search exercise (push up, squat, run...)',
            filled: true,
            fillColor: const Color(0xFF141D34),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF2D3B62)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF2D3B62)),
            ),
            suffixIcon: IconButton(
              onPressed: () {
                ref.read(activitySearchControllerProvider.notifier).search(_controller.text);
              },
              icon: const Icon(Icons.search),
            ),
          ),
        ),
        const SizedBox(height: 14),
        if (state.loading) const Center(child: CircularProgressIndicator()),
        if (!state.loading && state.error != null)
          Text(state.error!, style: const TextStyle(color: Colors.redAccent)),
        if (!state.loading && state.items.isEmpty && state.query.isNotEmpty)
          const Text('No workout found for this term.'),
        if (!state.loading && state.items.isEmpty && state.query.isEmpty)
          const Text('Search for an exercise to get started.'),
        ...state.items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFFFF6A3D),
                  child: Text(item.name.isNotEmpty ? item.name[0].toUpperCase() : '?'),
                ),
                title: Text(item.name),
                subtitle: Text(item.category),
                trailing: const Icon(Icons.chevron_right),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
