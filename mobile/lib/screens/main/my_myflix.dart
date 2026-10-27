import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/models.dart';
import '../../theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/titles.dart';
import '../profiles.dart';
import 'extras.dart';

class MyMyFlixScreen extends StatelessWidget {
  const MyMyFlixScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final lib = context.watch<LibraryStore>();
    final p = auth.activeProfile!;
    final max = p.settings.maturity;
    bool ok(MediaTitle t) => Catalog.allowed(t, max) && (!p.kids || t.kids);
    final myList = lib.list.map(Catalog.byId).whereType<MediaTitle>().where(ok).toList();
    final liked = lib.ratings.entries.where((e) => e.value > 0).map((e) => Catalog.byId(e.key)).whereType<MediaTitle>().where(ok).toList();
    final watched = (lib.progress.entries.toList()..sort((a, b) => b.value.updatedAt.compareTo(a.value.updatedAt))).map((e) => Catalog.byId(e.key)).whereType<MediaTitle>().where(ok).toList();
    final dlCount = lib.downloads.values.where((d) => d.state == DlState.done).length;
    final reminders = Catalog.comingSoon(kids: p.kids, max: max).where((t) => lib.reminders.contains(t.id)).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My MyFlix', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        actions: [
          IconButton(onPressed: () => context.push('/search'), icon: const Icon(Icons.search)),
          IconButton(
            onPressed: () => showModalBottomSheet(
              context: context,
              backgroundColor: AppColors.ink2,
              builder: (c) => SafeArea(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('Manage Profiles'), onTap: () => _go(c, context, '/profiles')),
                  ListTile(leading: const Icon(Icons.tune), title: const Text('Profile Settings'), onTap: () => _go(c, context, '/profile-settings/${p.id}')),
                  ListTile(leading: const Icon(Icons.settings_outlined), title: const Text('App Settings'), onTap: () => _go(c, context, '/app-settings')),
                  ListTile(leading: const Icon(Icons.person_outline), title: const Text('Account'), onTap: () => _go(c, context, '/account')),
                  ListTile(leading: const Icon(Icons.help_outline), title: const Text('Help'), onTap: () => _go(c, context, '/help')),
                  ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('Sign Out'),
                    onTap: () async {
                      Navigator.pop(c);
                      final yes = await showDialog<bool>(
                        context: context,
                        builder: (d) => AlertDialog(
                          backgroundColor: AppColors.ink2,
                          title: const Text('Sign out?'),
                          content: const Text('Downloads on this device will stay until you delete them.'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
                            TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Sign Out')),
                          ],
                        ),
                      );
                      if (yes == true) await auth.signOut();
                    },
                  ),
                ]),
              ),
            ),
            icon: const Icon(Icons.menu),
          ),
        ],
      ),
      body: ListView(children: [
        const SizedBox(height: 8),
        Center(
          child: GestureDetector(
            onTap: () => _switcher(context),
            child: Column(children: [
              Avatar(index: p.avatar, size: 72, kids: p.kids),
              const SizedBox(height: 10),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Text(p.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                const Icon(Icons.keyboard_arrow_down),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        _Tile(icon: Icons.notifications_none, color: AppColors.danger, title: 'Notifications', sub: reminders > 0 ? '$reminders reminder${reminders == 1 ? '' : 's'} set' : 'New arrivals and reminders', onTap: () => context.push('/notifications')),
        _Tile(icon: Icons.download_outlined, color: const Color(0xFF3B82F6), title: 'Downloads', sub: dlCount == 0 ? 'Watch without internet' : '$dlCount downloaded', onTap: () => context.push('/downloads')),
        _Tile(icon: Icons.history, color: const Color(0xFF8B5CF6), title: 'Viewing activity', sub: 'History and ratings', onTap: () => context.push('/activity')),
        _Tile(icon: Icons.card_giftcard, color: AppColors.brand, title: 'Invite friends', sub: 'You both get a free month', onTap: () => context.push('/invite')),
        _Tile(icon: Icons.tv, color: const Color(0xFFF59E0B), title: 'Sign in on TV', sub: 'Enter the code shown on your TV', onTap: () => context.push('/tv')),
        const SizedBox(height: 12),
        const DataUsageCard(),
        if (myList.isNotEmpty) RowSection(title: 'My List', onTitleTap: () => context.push('/mylist'), children: [for (final t in myList) PosterCard(t)]),
        if (liked.isNotEmpty) RowSection(title: 'Titles You Liked', children: [for (final t in liked) PosterCard(t)]),
        if (watched.isNotEmpty) RowSection(title: 'Continue Watching', height: 228, children: [for (final t in watched) ContinueCard(t)]),
        if (myList.isEmpty && liked.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text('Add titles to My List and rate what you watch. They will show up here.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
          ),
      ]),
    );
  }

  void _go(BuildContext sheet, BuildContext context, String path) {
    Navigator.pop(sheet);
    context.push(path);
  }

  void _switcher(BuildContext context) {
    final auth = context.read<AuthStore>();
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.ink2,
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Switch Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 18),
            Wrap(spacing: 18, runSpacing: 14, children: [
              for (final x in auth.account!.profiles)
                GestureDetector(
                  onTap: () async {
                    Navigator.pop(c);
                    if (x.settings.pin != null) {
                      final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(fullscreenDialog: true, builder: (_) => PinScreen(profile: x)));
                      if (ok != true) return;
                    }
                    await auth.selectProfile(x.id);
                  },
                  child: Column(children: [
                    Container(
                      decoration: BoxDecoration(border: Border.all(color: x.id == auth.activeProfileId ? Colors.white : Colors.transparent, width: 2), borderRadius: BorderRadius.circular(8)),
                      child: Avatar(index: x.avatar, size: 64, kids: x.kids),
                    ),
                    const SizedBox(height: 6),
                    Text(x.name, style: const TextStyle(color: AppColors.muted)),
                  ]),
                ),
            ]),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: () {
                Navigator.pop(c);
                context.push('/profiles');
              },
              icon: const Icon(Icons.edit_outlined, color: Colors.white),
              label: const Text('Manage Profiles', style: TextStyle(color: Colors.white)),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, sub;
  final VoidCallback onTap;
  const _Tile({required this.icon, required this.color, required this.title, required this.sub, required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        leading: CircleAvatar(backgroundColor: color, child: Icon(icon, color: Colors.white)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(sub, style: const TextStyle(color: AppColors.muted)),
        trailing: const Icon(Icons.chevron_right),
      );
}
