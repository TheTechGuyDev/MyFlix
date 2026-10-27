import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/models.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/titles.dart';

/* ======================= Search ======================= */
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _q = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile!;
    final lib = context.watch<LibraryStore>();
    final q = _q.text;
    final results = Catalog.search(q, kids: p.kids, max: p.settings.maturity);
    final top = Catalog.rows(filter: 'all', kids: p.kids, max: p.settings.maturity).first.items;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _q,
          autofocus: true,
          onChanged: (_) => setState(() {}),
          onSubmitted: lib.addSearch,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Search shows, movies, genres, people',
            prefixIcon: const Icon(Icons.search, color: AppColors.muted),
            suffixIcon: q.isEmpty ? null : IconButton(onPressed: () => setState(_q.clear), icon: const Icon(Icons.close)),
            contentPadding: const EdgeInsets.symmetric(vertical: 10),
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
          ),
        ),
      ),
      body: q.isEmpty
          ? ListView(padding: const EdgeInsets.symmetric(horizontal: 14), children: [
              if (lib.recentSearches.isNotEmpty) ...[
                Row(children: [
                  const Text('Recent Searches', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  TextButton(onPressed: lib.clearSearches, child: const Text('Clear', style: TextStyle(color: AppColors.muted))),
                ]),
                Wrap(spacing: 8, children: [
                  for (final s in lib.recentSearches)
                    ActionChip(
                      label: Text(s),
                      backgroundColor: AppColors.ink3,
                      side: BorderSide.none,
                      onPressed: () => setState(() => _q.text = s),
                    ),
                ]),
                const SizedBox(height: 12),
              ],
              const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Text('Recommended Shows & Movies', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
              for (final t in top) TitleListTile(t),
            ])
          : results.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(children: [
                    const SizedBox(height: 40),
                    const Icon(Icons.search_off, size: 64, color: AppColors.muted),
                    const SizedBox(height: 12),
                    Text('No results for "$q"', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    const Text('Try a title, a person, or a genre like Nollywood, Comedy or Thriller.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
                  ]),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(14),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, childAspectRatio: 2 / 3, mainAxisSpacing: 8, crossAxisSpacing: 8),
                  itemCount: results.length,
                  itemBuilder: (_, i) => GestureDetector(onTapDown: (_) => lib.addSearch(q), child: PosterCard(results[i], width: double.infinity)),
                ),
    );
  }
}

/* ======================= New & Hot ======================= */
class NewHotScreen extends StatefulWidget {
  const NewHotScreen({super.key});
  @override
  State<NewHotScreen> createState() => _NewHotScreenState();
}

class _NewHotScreenState extends State<NewHotScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile!;
    final lib = context.watch<LibraryStore>();
    final max = p.settings.maturity;
    final visible = Catalog.visible(kids: p.kids, max: max);
    final coming = Catalog.comingSoon(kids: p.kids, max: max);
    final watching = ([...visible]..sort((a, b) => b.year != a.year ? b.year.compareTo(a.year) : b.match.compareTo(a.match))).take(10).toList();
    final topSeries = ([...visible.where((t) => t.isSeries)]..sort((a, b) => b.match.compareTo(a.match))).take(10).toList();
    final topMovies = ([...visible.where((t) => !t.isSeries)]..sort((a, b) => b.match.compareTo(a.match))).take(10).toList();
    final tabs = [
      (Icons.local_movies_outlined, 'Coming Soon', coming),
      (Icons.local_fire_department_outlined, "Everyone's Watching", watching),
      (Icons.leaderboard_outlined, 'Top 10 Series', topSeries),
      (Icons.leaderboard_outlined, 'Top 10 Movies', topMovies),
    ];
    final cur = tabs[_tab];

    return Scaffold(
      appBar: AppBar(
        title: const Text('New & Hot', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        actions: [
          IconButton(onPressed: () => context.push('/downloads'), icon: const Icon(Icons.download_outlined)),
          IconButton(onPressed: () => context.push('/search'), icon: const Icon(Icons.search)),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: SizedBox(
            height: 48,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), children: [
              for (var i = 0; i < tabs.length; i++)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    showCheckmark: false,
                    avatar: Icon(tabs[i].$1, size: 18, color: _tab == i ? AppColors.ink : Colors.white),
                    label: Text(tabs[i].$2, style: TextStyle(color: _tab == i ? AppColors.ink : Colors.white, fontWeight: FontWeight.w700)),
                    selected: _tab == i,
                    selectedColor: Colors.white,
                    backgroundColor: AppColors.ink,
                    side: BorderSide(color: _tab == i ? Colors.white : Colors.transparent),
                    shape: const StadiumBorder(),
                    onSelected: (_) => setState(() => _tab = i),
                  ),
                ),
            ]),
          ),
        ),
      ),
      body: cur.$3.isEmpty
          ? const Center(child: Text('Nothing here for this profile right now.', style: TextStyle(color: AppColors.muted)))
          : ListView.builder(
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: cur.$3.length,
              itemBuilder: (_, i) {
                final t = cur.$3[i];
                final isComing = _tab == 0;
                final rank = _tab >= 2 ? i + 1 : null;
                return InkWell(
                  onTap: () => openTitle(context, t),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(0, 14, 14, 14),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      SizedBox(
                        width: 56,
                        child: isComing
                            ? Column(children: [
                                Text(t.comingSoon!.split(' ')[0].toUpperCase(), style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                                Text(t.comingSoon!.split(' ')[1], style: const TextStyle(fontFamily: kDisplay, fontSize: 34, height: 1)),
                                Text(t.comingSoon!.split(' ')[2].toUpperCase(), style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                              ])
                            : rank != null
                                ? Text('$rank', textAlign: TextAlign.center, style: const TextStyle(fontFamily: kDisplay, fontSize: 44, height: 1))
                                : const SizedBox(),
                      ),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          AspectRatio(
                            aspectRatio: 16 / 9,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Stack(fit: StackFit.expand, children: [
                                NetImage(img(t.image, w: 800, h: 450)),
                                Positioned(left: 12, bottom: 8, child: Text(t.title.toUpperCase(), style: const TextStyle(fontFamily: kDisplay, fontSize: 30, shadows: [Shadow(blurRadius: 8)]))),
                              ]),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(children: [
                            Expanded(child: Text(t.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                            if (isComing) ...[
                              _MiniAction(
                                icon: lib.reminders.contains(t.id) ? Icons.notifications_active : Icons.notifications_none,
                                label: lib.reminders.contains(t.id) ? 'Reminder set' : 'Remind Me',
                                onTap: () {
                                  lib.toggleReminder(t.id);
                                  toast(context, lib.reminders.contains(t.id) ? "We'll notify you when ${t.title} arrives." : 'Reminder removed.');
                                },
                              ),
                              _MiniAction(icon: Icons.info_outline, label: 'Info', onTap: () => openTitle(context, t)),
                            ] else ...[
                              _MiniAction(icon: Icons.play_arrow, label: 'Play', onTap: () => playTitle(context, t)),
                              _MiniAction(icon: lib.inList(t.id) ? Icons.check : Icons.add, label: 'My List', onTap: () => lib.toggleList(t.id)),
                            ],
                          ]),
                          if (isComing) Text('Coming ${t.comingSoon}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                          const SizedBox(height: 6),
                          Text(t.synopsis, style: const TextStyle(color: AppColors.muted, fontSize: 13, height: 1.35)),
                          const SizedBox(height: 6),
                          Text(t.tags.followedBy(t.genres).join(' • '), style: const TextStyle(fontSize: 12)),
                        ]),
                      ),
                    ]),
                  ),
                );
              },
            ),
    );
  }
}

class _MiniAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _MiniAction({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(children: [Icon(icon, size: 24), Text(label, style: const TextStyle(fontSize: 10, color: AppColors.muted))]),
        ),
      );
}

/* ======================= My List ======================= */
class MyListScreen extends StatelessWidget {
  const MyListScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile!;
    final lib = context.watch<LibraryStore>();
    final items = lib.list.map(Catalog.byId).whereType<MediaTitle>().where((t) => Catalog.allowed(t, p.settings.maturity) && (!p.kids || t.kids)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('My List', style: TextStyle(fontWeight: FontWeight.w800))),
      body: items.isEmpty
          ? _Empty(icon: Icons.add_circle_outline, title: 'Your list is empty', body: 'Tap + My List on any title to save it here.', action: 'Browse titles', onAction: () => context.go('/home'))
          : GridView.builder(
              padding: const EdgeInsets.all(14),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, childAspectRatio: 2 / 3, mainAxisSpacing: 8, crossAxisSpacing: 8),
              itemCount: items.length,
              itemBuilder: (_, i) => PosterCard(items[i], width: double.infinity),
            ),
    );
  }
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String title, body;
  final String? action;
  final VoidCallback? onAction;
  const _Empty({required this.icon, required this.title, required this.body, this.action, this.onAction});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 72, color: AppColors.muted),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, height: 1.4)),
            if (action != null) ...[
              const SizedBox(height: 20),
              FilledButton(onPressed: onAction, style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.ink), child: Text(action!)),
            ],
          ]),
        ),
      );
}

/* ======================= Downloads ======================= */
class DownloadsScreen extends StatelessWidget {
  const DownloadsScreen({super.key});

  String _size(int b) => b > 1 << 20 ? '${(b / (1 << 20)).toStringAsFixed(1)} MB' : '${(b / 1024).round()} KB';

  @override
  Widget build(BuildContext context) {
    final lib = context.watch<LibraryStore>();
    final items = lib.downloads.values.toList();
    final byTitle = <String, List<DownloadItem>>{};
    for (final d in items) {
      byTitle.putIfAbsent(d.titleId, () => []).add(d);
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Downloads', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [IconButton(onPressed: () => context.push('/app-settings'), icon: const Icon(Icons.settings_outlined))],
      ),
      body: Column(children: [
        ListTile(
          leading: const Icon(Icons.download_for_offline_outlined, color: AppColors.brandBright),
          title: const Text('Smart Downloads'),
          subtitle: Text(lib.wifiOnly ? 'Wi-Fi only  •  Download quality: ${lib.downloadQuality == 'higher' ? 'Higher' : 'Standard'}' : 'Wi-Fi and mobile data', style: const TextStyle(color: AppColors.muted)),
          onTap: () => context.push('/app-settings'),
        ),
        const Divider(color: AppColors.line, height: 1),
        Expanded(
          child: byTitle.isEmpty
              ? _Empty(
                  icon: Icons.download_for_offline_outlined,
                  title: 'Movies and shows that you download appear here.',
                  body: 'Download titles to watch without internet, on the road or when the network is bad.',
                  action: 'Find Something to Download',
                  onAction: () => context.go('/home'),
                )
              : ListView(padding: const EdgeInsets.all(14), children: [
                  for (final e in byTitle.entries)
                    Builder(builder: (context) {
                      final t = Catalog.byId(e.key);
                      if (t == null) return const SizedBox();
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 18),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(t.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 8),
                          for (final d in e.value..sort((a, b) => (a.season ?? 0) * 100 + (a.episode ?? 0) - ((b.season ?? 0) * 100 + (b.episode ?? 0))))
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Row(children: [
                                GestureDetector(
                                  onTap: d.state == DlState.done ? () => playTitle(context, t, season: d.season, episode: d.episode) : null,
                                  child: SizedBox(
                                    width: 130,
                                    child: AspectRatio(
                                      aspectRatio: 16 / 9,
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(4),
                                        child: Stack(fit: StackFit.expand, children: [
                                          NetImage(img(t.image, w: 320, h: 180)),
                                          if (d.state == DlState.done) const Center(child: Icon(Icons.play_circle_outline, size: 36)),
                                        ]),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(d.season != null ? 'S${d.season}:E${d.episode}' : t.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 4),
                                    if (d.state == DlState.downloading) ...[
                                      LinearProgressIndicator(value: d.progress, color: AppColors.brandBright, backgroundColor: Colors.white24),
                                      const SizedBox(height: 4),
                                      Text('Downloading ${(d.progress * 100).round()}%', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                                    ] else if (d.state == DlState.done)
                                      Text('${t.maturity}  •  ${_size(d.bytes)}', style: const TextStyle(color: AppColors.muted, fontSize: 12))
                                    else
                                      Text(d.error ?? 'Paused', style: const TextStyle(color: AppColors.danger, fontSize: 12)),
                                  ]),
                                ),
                                PopupMenuButton<String>(
                                  color: AppColors.ink3,
                                  icon: Icon(d.state == DlState.done ? Icons.download_done : d.state == DlState.downloading ? Icons.downloading : Icons.error_outline,
                                      color: d.state == DlState.done ? AppColors.brandBright : d.state == DlState.downloading ? Colors.white : AppColors.danger),
                                  onSelected: (v) {
                                    if (v == 'play') playTitle(context, t, season: d.season, episode: d.episode);
                                    if (v == 'retry') lib.startDownload(t.id, season: d.season, episode: d.episode);
                                    if (v == 'delete') lib.deleteDownload(d.key);
                                  },
                                  itemBuilder: (_) => [
                                    if (d.state == DlState.done) const PopupMenuItem(value: 'play', child: Text('Play')),
                                    if (d.state == DlState.failed || d.state == DlState.paused) const PopupMenuItem(value: 'retry', child: Text('Retry download')),
                                    PopupMenuItem(value: 'delete', child: Text(d.state == DlState.downloading ? 'Cancel download' : 'Delete download')),
                                  ],
                                ),
                              ]),
                            ),
                        ]),
                      );
                    }),
                ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
            child: Row(children: [
              const Icon(Icons.phone_android, size: 16, color: AppColors.muted),
              const SizedBox(width: 6),
              Text('MyFlix downloads: ${_size(lib.downloadedBytes)}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ]),
          ),
        ),
      ]),
    );
  }
}

/* ======================= Notifications ======================= */
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile!;
    final lib = context.watch<LibraryStore>();
    final vis = Catalog.visible(kids: p.kids, max: p.settings.maturity, includeComing: true);
    final items = <(MediaTitle, String, String, String)>[];
    for (final t in vis.where((t) => t.comingSoon != null && lib.reminders.contains(t.id))) {
      items.add((t, 'Reminder', '${t.title} arrives ${t.comingSoon}', 'Reminder'));
    }
    for (final t in vis.where((t) => t.isNew && t.comingSoon == null).take(4)) {
      items.add((t, t.isSeries ? 'New Episodes' : 'New Arrival', t.title, t.isSeries ? 'Today' : '2 days ago'));
    }
    for (final t in vis.where((t) => t.comingSoon != null && !lib.reminders.contains(t.id)).take(2)) {
      items.add((t, 'Coming Soon', '${t.title}: ${t.comingSoon}', 'This week'));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w800))),
      body: items.isEmpty
          ? const _Empty(icon: Icons.notifications_none, title: 'No notifications', body: 'New arrivals and reminders will appear here.')
          : ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, _) => const Divider(color: AppColors.line, height: 1),
              itemBuilder: (_, i) {
                final n = items[i];
                return InkWell(
                  onTap: () => openTitle(context, n.$1),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Container(width: 8, height: 8, margin: const EdgeInsets.only(right: 10), decoration: BoxDecoration(shape: BoxShape.circle, color: i < 2 ? AppColors.brandBright : Colors.transparent)),
                      SizedBox(width: 120, child: AspectRatio(aspectRatio: 16 / 9, child: ClipRRect(borderRadius: BorderRadius.circular(4), child: NetImage(img(n.$1.image, w: 300, h: 170))))),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(n.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(n.$3, style: const TextStyle(color: Colors.white70)),
                          const SizedBox(height: 4),
                          Text(n.$4, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                        ]),
                      ),
                    ]),
                  ),
                );
              },
            ),
    );
  }
}
