import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../i18n.dart';
import '../../theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/cast.dart';

class MainShell extends StatelessWidget {
  final StatefulNavigationShell nav;
  const MainShell({super.key, required this.nav});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile;
    final kids = p?.kids ?? false;
    // Branch order: Home, New & Hot, Clips, My MyFlix. Kids profiles skip Clips.
    final branches = kids ? [0, 1, 3] : [0, 1, 2, 3];
    final selected = branches.indexOf(nav.currentIndex).clamp(0, branches.length - 1);
    return Scaffold(
      body: nav,
      bottomNavigationBar: Column(mainAxisSize: MainAxisSize.min, children: [
        const CastMiniBar(),
        NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: AppColors.ink2,
            indicatorColor: Colors.transparent,
            labelTextStyle: WidgetStateProperty.resolveWith(
              (s) => TextStyle(fontSize: 11, fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500, color: s.contains(WidgetState.selected) ? Colors.white : AppColors.muted),
            ),
            iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? Colors.white : AppColors.muted)),
          ),
          child: NavigationBar(
            height: 64,
            selectedIndex: selected,
            onDestinationSelected: (i) => nav.goBranch(branches[i], initialLocation: branches[i] == nav.currentIndex),
            destinations: [
              NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: context.tr('Home')),
              NavigationDestination(icon: const Icon(Icons.video_library_outlined), selectedIcon: const Icon(Icons.video_library), label: context.tr('New & Hot')),
              if (!kids) NavigationDestination(icon: const Icon(Icons.sentiment_very_satisfied_outlined), selectedIcon: const Icon(Icons.sentiment_very_satisfied), label: context.tr('Clips')),
              NavigationDestination(
                icon: p == null ? const Icon(Icons.person_outline) : Opacity(opacity: 0.75, child: Avatar(index: p.avatar, size: 24, radius: 4)),
                selectedIcon: p == null
                    ? const Icon(Icons.person)
                    : Container(
                        decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 1.5), borderRadius: BorderRadius.circular(5)),
                        child: Avatar(index: p.avatar, size: 24, radius: 4),
                      ),
                label: context.tr('My MyFlix'),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}
