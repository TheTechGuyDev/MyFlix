import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../theme.dart';
import '../../widgets/avatar.dart';

class MainShell extends StatelessWidget {
  final StatefulNavigationShell nav;
  const MainShell({super.key, required this.nav});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile;
    return Scaffold(
      body: nav,
      bottomNavigationBar: NavigationBarTheme(
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
          selectedIndex: nav.currentIndex,
          onDestinationSelected: (i) => nav.goBranch(i, initialLocation: i == nav.currentIndex),
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
            const NavigationDestination(icon: Icon(Icons.video_library_outlined), selectedIcon: Icon(Icons.video_library), label: 'New & Hot'),
            NavigationDestination(
              icon: p == null ? const Icon(Icons.person_outline) : Opacity(opacity: 0.75, child: Avatar(index: p.avatar, size: 24, radius: 4)),
              selectedIcon: p == null
                  ? const Icon(Icons.person)
                  : Container(
                      decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 1.5), borderRadius: BorderRadius.circular(5)),
                      child: Avatar(index: p.avatar, size: 24, radius: 4),
                    ),
              label: 'My MyFlix',
            ),
          ],
        ),
      ),
    );
  }
}
