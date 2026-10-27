import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../data/auth_store.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/models.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/titles.dart';

Future<void> startDownload(BuildContext context, MediaTitle t, {int? season, int? episode}) async {
  final lib = context.read<LibraryStore>();
  final plan = Catalog.plan(context.read<AuthStore>().account?.planId);
  final err = await lib.startDownload(t.id, season: season, episode: episode, maxDownloads: plan?.downloads ?? 1);
  if (err != null && context.mounted) toast(context, err);
}

class DetailsScreen extends StatefulWidget {
  final String id;
  const DetailsScreen({super.key, required this.id});
  @override
  State<DetailsScreen> createState() => _DetailsScreenState();
}

class _DetailsScreenState extends State<DetailsScreen> {
  int _tab = 0;
  int _season = 1;

  @override
  Widget build(BuildContext context) {
    final t = Catalog.byId(widget.id);
    if (t == null) return const Scaffold(body: Center(child: Text('Title not found')));
    final p = context.watch<AuthStore>().activeProfile!;
    final lib = context.watch<LibraryStore>();
    final prog = lib.progress[t.id];
    final similar = Catalog.similar(t, kids: p.kids, max: p.settings.maturity);
    final top10 = Catalog.rows(filter: 'all', kids: p.kids, max: p.settings.maturity).where((r) => r.ranked).expand((r) => r.items).toList();
    final rank = top10.indexOf(t);
    final coming = t.comingSoon != null;
    final firstKey = t.isSeries ? LibraryStore.dlKey(t.id, 1, 1) : t.id;
    final dl = lib.download(firstKey);
    final tabs = t.isSeries ? ['Episodes', 'More Like This'] : ['More Like This', 'About'];

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(slivers: [
          SliverToBoxAdapter(
            child: Stack(children: [
              AspectRatio(aspectRatio: 16 / 9, child: NetImage(img(t.image, w: 1000, h: 563))),
              Positioned.fill(
                child: Center(
                  child: coming
                      ? const SizedBox()
                      : GestureDetector(
                          onTap: () => playTitle(context, t, season: t.isSeries ? prog?.season ?? 1 : null, episode: t.isSeries ? prog?.episode ?? 1 : null),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.black45, border: Border.all(color: Colors.white, width: 2)),
                            child: const Icon(Icons.play_arrow, size: 36),
                          ),
                        ),
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: IconButton.filled(
                  style: IconButton.styleFrom(backgroundColor: Colors.black54),
                  onPressed: () => context.canPop() ? context.pop() : context.go('/home'),
                  icon: const Icon(Icons.close),
                ),
              ),
            ]),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            sliver: SliverList.list(children: [
              if (t.original)
                Row(children: [
                  const Text('M', style: TextStyle(fontFamily: kDisplay, fontSize: 20, color: AppColors.brandBright)),
                  const SizedBox(width: 6),
                  Text(t.isSeries ? 'S E R I E S' : 'F I L M', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.muted)),
                ]),
              Text(t.title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              MetaLine(t),
              if (rank >= 0) ...[
                const SizedBox(height: 8),
                Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(3)),
                    child: const Column(children: [
                      Text('TOP', style: TextStyle(fontSize: 7, fontWeight: FontWeight.w900, height: 1)),
                      Text('10', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, height: 1)),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  Text('#${rank + 1} in Nigeria Today', style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
              ],
              const SizedBox(height: 12),
              if (coming) ...[
                Text('Coming ${t.comingSoon}', style: const TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 10),
                PrimaryButton(
                  lib.reminders.contains(t.id) ? 'Reminder Set' : 'Remind Me',
                  icon: lib.reminders.contains(t.id) ? Icons.notifications_active : Icons.notifications_none,
                  color: Colors.white,
                  textColor: AppColors.ink,
                  height: 44,
                  onPressed: () => lib.toggleReminder(t.id),
                ),
              ] else ...[
                PrimaryButton(
                  prog != null ? (t.isSeries ? 'Resume S${prog.season}:E${prog.episode}' : 'Resume') : 'Play',
                  icon: Icons.play_arrow,
                  color: Colors.white,
                  textColor: AppColors.ink,
                  height: 44,
                  onPressed: () => playTitle(context, t, season: t.isSeries ? prog?.season ?? 1 : null, episode: t.isSeries ? prog?.episode ?? 1 : null),
                ),
                if (prog != null) ...[
                  const SizedBox(height: 6),
                  LinearProgressIndicator(value: prog.pct / 100, minHeight: 3, backgroundColor: Colors.white24, color: AppColors.brandBright),
                ],
                const SizedBox(height: 8),
                _DownloadButton(t: t, item: dl, label: t.isSeries ? 'Download S1:E1' : 'Download'),
              ],
              const SizedBox(height: 12),
              Text(t.synopsis, style: const TextStyle(fontSize: 14, height: 1.4)),
              const SizedBox(height: 8),
              Text('Starring: ${t.cast.join(', ')}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              Text('Genres: ${t.genres.join(', ')}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              const SizedBox(height: 14),
              Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                _Action(icon: lib.inList(t.id) ? Icons.check : Icons.add, label: 'My List', onTap: () => lib.toggleList(t.id)),
                _RateAction(t: t),
                _Action(
                  icon: Icons.share_outlined,
                  label: 'Share',
                  onTap: () => SharePlus.instance.share(ShareParams(text: 'Watch "${t.title}" on MyFlix: https://thetechguydev.github.io/MyFlix/')),
                ),
              ]),
              const SizedBox(height: 10),
              const Divider(color: AppColors.line, height: 1),
              Row(children: [
                for (var i = 0; i < tabs.length; i++)
                  InkWell(
                    onTap: () => setState(() => _tab = i),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      margin: const EdgeInsets.only(right: 22),
                      decoration: BoxDecoration(border: Border(top: BorderSide(color: _tab == i ? AppColors.brandBright : Colors.transparent, width: 4))),
                      child: Text(tabs[i], style: TextStyle(fontWeight: FontWeight.w700, color: _tab == i ? Colors.white : AppColors.muted)),
                    ),
                  ),
              ]),
            ]),
          ),
          if (tabs[_tab] == 'Episodes') ..._episodes(context, t, lib),
          if (tabs[_tab] == 'More Like This')
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 24),
              sliver: similar.isEmpty
                  ? const SliverToBoxAdapter(child: Text('Nothing similar yet.', style: TextStyle(color: AppColors.muted)))
                  : SliverGrid.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, childAspectRatio: 2 / 3, mainAxisSpacing: 8, crossAxisSpacing: 8),
                      itemCount: similar.length,
                      itemBuilder: (_, i) => PosterCard(similar[i], width: double.infinity),
                    ),
            ),
          if (tabs[_tab] == 'About')
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
              sliver: SliverList.list(children: [
                Text('About ${t.title}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                _about('Cast', t.cast.join(', ')),
                _about('Genres', t.genres.join(', ')),
                _about('This film is', t.tags.join(', ')),
                _about('Maturity rating', t.maturity),
                _about('Released', '${t.year}'),
                _about('Runtime', t.meta),
              ]),
            ),
        ]),
      ),
    );
  }

  Widget _about(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text.rich(TextSpan(children: [TextSpan(text: '$k: ', style: const TextStyle(color: AppColors.muted)), TextSpan(text: v)])),
      );

  List<Widget> _episodes(BuildContext context, MediaTitle t, LibraryStore lib) {
    final eps = Catalog.episodes(t, _season);
    return [
      if ((t.seasons ?? 1) > 1)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: () => showModalBottomSheet(
                  context: context,
                  backgroundColor: AppColors.ink2,
                  builder: (c) => SafeArea(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      for (var s = 1; s <= (t.seasons ?? 1); s++)
                        ListTile(
                          title: Text('Season $s', textAlign: TextAlign.center, style: TextStyle(fontWeight: s == _season ? FontWeight.w800 : FontWeight.w400, fontSize: 18)),
                          onTap: () {
                            setState(() => _season = s);
                            Navigator.pop(c);
                          },
                        ),
                    ]),
                  ),
                ),
                icon: const Icon(Icons.keyboard_arrow_down),
                label: Text('Season $_season'),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white, backgroundColor: AppColors.ink3, side: BorderSide.none),
              ),
            ),
          ),
        ),
      SliverList.builder(
        itemCount: eps.length,
        itemBuilder: (_, i) {
          final e = eps[i];
          final key = LibraryStore.dlKey(t.id, e.season, e.number);
          return Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                GestureDetector(
                  onTap: () => playTitle(context, t, season: e.season, episode: e.number),
                  child: SizedBox(
                    width: 130,
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Stack(fit: StackFit.expand, children: [
                          NetImage(img(t.image, w: 320, h: 180)),
                          Center(
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.black45, border: Border.all(color: Colors.white)),
                              child: const Icon(Icons.play_arrow, size: 22),
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${e.number}. ${e.title}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(e.runtime, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  ]),
                ),
                _DownloadIcon(t: t, item: lib.download(key), season: e.season, episode: e.number),
              ]),
              const SizedBox(height: 8),
              Text(e.synopsis, style: const TextStyle(color: AppColors.muted, fontSize: 13, height: 1.35)),
            ]),
          );
        },
      ),
      const SliverToBoxAdapter(child: SizedBox(height: 24)),
    ];
  }
}

class _Action extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _Action({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Column(children: [Icon(icon, size: 26), const SizedBox(height: 4), Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted))]),
        ),
      );
}

class _RateAction extends StatelessWidget {
  final MediaTitle t;
  const _RateAction({required this.t});
  @override
  Widget build(BuildContext context) {
    final lib = context.watch<LibraryStore>();
    final r = lib.ratings[t.id];
    final icon = r == -1 ? Icons.thumb_down : r == 2 ? Icons.favorite : r == 1 ? Icons.thumb_up : Icons.thumb_up_outlined;
    return _Action(
      icon: icon,
      label: r == null ? 'Rate' : r == -1 ? 'Not for me' : r == 2 ? 'Love this!' : 'I like this',
      onTap: () => showModalBottomSheet(
        context: context,
        backgroundColor: AppColors.ink2,
        builder: (c) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              for (final o in const [(-1, Icons.thumb_down_outlined, 'Not for me'), (1, Icons.thumb_up_outlined, 'I like this'), (2, Icons.favorite_border, 'Love this!')])
                _Action(
                  icon: o.$2,
                  label: o.$3,
                  onTap: () {
                    lib.rate(t.id, o.$1);
                    Navigator.pop(c);
                  },
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _DownloadButton extends StatelessWidget {
  final MediaTitle t;
  final DownloadItem? item;
  final String label;
  const _DownloadButton({required this.t, required this.item, required this.label});
  @override
  Widget build(BuildContext context) {
    final d = item;
    final state = d?.state;
    String text = label;
    IconData icon = Icons.download;
    if (state == DlState.downloading) {
      text = 'Downloading ${(d!.progress * 100).round()}%';
      icon = Icons.downloading;
    } else if (state == DlState.done) {
      text = 'Downloaded';
      icon = Icons.download_done;
    } else if (state == DlState.failed || state == DlState.paused) {
      text = 'Retry download';
      icon = Icons.refresh;
    }
    return Stack(children: [
      PrimaryButton(
        text,
        icon: icon,
        color: AppColors.ink3,
        height: 44,
        onPressed: () {
          if (state == DlState.done) {
            context.push('/downloads');
            return;
          }
          if (state == DlState.downloading) return;
          startDownload(context, t, season: t.isSeries ? 1 : null, episode: t.isSeries ? 1 : null);
        },
      ),
      if (state == DlState.downloading)
        Positioned(
          left: 0,
          bottom: 0,
          right: 0,
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(6)),
            child: LinearProgressIndicator(value: d!.progress, minHeight: 3, backgroundColor: Colors.transparent, color: AppColors.brandBright),
          ),
        ),
    ]);
  }
}

class _DownloadIcon extends StatelessWidget {
  final MediaTitle t;
  final DownloadItem? item;
  final int season, episode;
  const _DownloadIcon({required this.t, required this.item, required this.season, required this.episode});
  @override
  Widget build(BuildContext context) {
    final s = item?.state;
    if (s == DlState.downloading) {
      return SizedBox(width: 48, child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(value: item!.progress, strokeWidth: 2.5, color: AppColors.brandBright))));
    }
    if (s == DlState.done) {
      return IconButton(onPressed: () => context.push('/downloads'), icon: const Icon(Icons.download_done, color: AppColors.brandBright));
    }
    return IconButton(onPressed: () => startDownload(context, t, season: season, episode: episode), icon: Icon(s == DlState.failed ? Icons.refresh : Icons.download_outlined));
  }
}
