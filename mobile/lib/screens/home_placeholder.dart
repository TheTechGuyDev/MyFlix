import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../data/auth_store.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import '../widgets/common.dart';

/// Temporary home: replaced by the full Home/Browse screen in the next step.
class HomePlaceholder extends StatelessWidget {
  const HomePlaceholder({super.key});
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final p = auth.activeProfile;
    return Scaffold(
      appBar: AppBar(
        title: const Logo(size: 30),
        actions: [
          if (p != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: GestureDetector(onTap: () => context.go('/profiles'), child: Avatar(index: p.avatar, size: 32, radius: 4)),
            ),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('Welcome, ${p?.name ?? ''}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('The MyFlix home screen is coming in the next step.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
            const SizedBox(height: 24),
            OutlinedButton(onPressed: () => context.go('/profiles'), child: const Text('Switch Profile')),
            TextButton(
              onPressed: () async {
                await auth.signOut();
                if (context.mounted) context.go('/login');
              },
              child: const Text('Sign Out'),
            ),
          ]),
        ),
      ),
    );
  }
}
