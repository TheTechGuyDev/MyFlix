import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../data/library_store.dart';
import '../data/models.dart';
import '../theme.dart';
import 'common.dart';

void openTitle(BuildContext context, MediaTitle t) => context.push('/title/${t.id}');

void playTitle(BuildContext context, MediaTitle t, {int? season, int? episode}) {
  final q = season != null ? '?s=$season&e=$episode' : '';
  context.push('/watch/${t.id}$q');
}

/// Portrait poster with title overlay (stock images carry no artwork text).
class PosterCard extends StatelessWidget {
  final MediaTitle t;
  final double width;
  final bool showNew;
  const PosterCard(this.t, {super.key, this.width = 112, this.showNew = true});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => openTitle(context, t),
      child: SizedBox(
        width: width,
        child: AspectRatio(
          aspectRatio: 2 / 3,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: Stack(fit: StackFit.expand, children: [
              NetImage(img(t.image, w: 300, h: 450)),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.transparent, Colors.black87], stops: [0, 0.5, 1]),
                ),
              ),
              if (t.original)
                const Positioned(top: 6, left: 6, child: Text('M', style: TextStyle(fontFamily: kDisplay, fontSize: 22, color: AppColors.brandBright, height: 1))),
              if (showNew && t.isNew)
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    color: AppColors.brand,
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: const Text('NEW EPISODES', textAlign: TextAlign.center, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                  ),
                ),
              Positioned(
                left: 6,
                right: 6,
                bottom: showNew && t.isNew ? 18 : 6,
                child: Text(t.title.toUpperCase(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: kDisplay, fontSize: 19, height: 0.95)),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Continue Watching card: poster + progress + info/more buttons.
class ContinueCard extends StatelessWidget {
  final MediaTitle t;
  const ContinueCard(this.t, {super.key});

  @override
  Widget build(BuildContext context) {
    final lib = context.watch<LibraryStore>();
    final p = lib.progress[t.id];
    return SizedBox(
      width: 112,
      child: Column(children: [
        GestureDetector(
          onTap: () => playTitle(context, t, season: t.isSeries ? p?.season : null, episode: t.isSeries ? p?.episode : null),
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
            child: AspectRatio(
              aspectRatio: 2 / 2.6,
              child: Stack(fit: StackFit.expand, children: [
                NetImage(img(t.image, w: 300, h: 390)),
                Container(color: Colors.black26),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.black54, border: Border.all(color: Colors.white, width: 1.5)),
                    child: const Icon(Icons.play_arrow, size: 28),
                  ),
                ),
                Positioned(
                  left: 6,
                  bottom: 6,
                  right: 6,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    if (t.isSeries && p != null) Text('S${p.season}:E${p.episode}', style: const TextStyle(fontSize: 11, color: Colors.white70)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        LinearProgressIndicator(value: (p?.pct ?? 0) / 100, minHeight: 3, backgroundColor: Colors.white24, color: AppColors.brandBright),
        Container(
          color: AppColors.ink2,
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.info_outline, size: 20), onPressed: () => openTitle(context, t)),
            IconButton(
              visualDensity: VisualDensity.compact,
              icon: const Icon(Icons.more_vert, size: 20),
              onPressed: () => showModalBottomSheet(
                context: context,
                backgroundColor: AppColors.ink2,
                builder: (c) => SafeArea(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    ListTile(title: Text(t.title, style: const TextStyle(fontWeight: FontWeight.w700))),
                    ListTile(leading: const Icon(Icons.info_outline), title: const Text('Episodes & Info'), onTap: () {
                      Navigator.pop(c);
                      openTitle(context, t);
                    }),
                    ListTile(leading: const Icon(Icons.thumb_up_outlined), title: const Text('Rate this'), onTap: () {
                      lib.rate(t.id, 1);
                      Navigator.pop(c);
                      toast(context, 'Thanks! Your rating improves your recommendations.');
                    }),
                    ListTile(leading: const Icon(Icons.remove_circle_outline), title: const Text('Remove from Continue Watching'), onTap: () {
                      lib.removeProgress(t.id);
                      Navigator.pop(c);
                    }),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

class RankedCard extends StatelessWidget {
  final MediaTitle t;
  final int rank;
  const RankedCard(this.t, this.rank, {super.key});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 170,
      child: Stack(children: [
        Positioned(
          left: 0,
          bottom: -14,
          child: Text(
            '$rank',
            style: TextStyle(
              fontFamily: kDisplay,
              fontSize: 150,
              height: 1,
              foreground: Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = 3
                ..color = Colors.white70,
            ),
          ),
        ),
        Positioned(right: 0, top: 0, bottom: 0, child: PosterCard(t, width: 112, showNew: false)),
      ]),
    );
  }
}

class RowSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  final double height;
  final VoidCallback? onTitleTap;
  const RowSection({super.key, required this.title, required this.children, this.height = 168, this.onTitleTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
          child: GestureDetector(
            onTap: onTitleTap,
            child: Row(children: [
              Flexible(child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
              if (onTitleTap != null) const Icon(Icons.chevron_right, size: 22),
            ]),
          ),
        ),
        SizedBox(
          height: height,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            scrollDirection: Axis.horizontal,
            itemCount: children.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) => children[i],
          ),
        ),
      ]),
    );
  }
}

/// Wide list tile used in search results / lists.
class TitleListTile extends StatelessWidget {
  final MediaTitle t;
  final Widget? trailing;
  final String? subtitle;
  const TitleListTile(this.t, {super.key, this.trailing, this.subtitle});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => openTitle(context, t),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          SizedBox(
            width: 140,
            child: AspectRatio(aspectRatio: 16 / 9, child: ClipRRect(borderRadius: BorderRadius.circular(4), child: NetImage(img(t.image, w: 400, h: 225)))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              if (subtitle != null) Text(subtitle!, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ]),
          ),
          trailing ??
              IconButton(
                onPressed: () => playTitle(context, t),
                icon: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)),
                  child: const Icon(Icons.play_arrow, size: 22),
                ),
              ),
        ]),
      ),
    );
  }
}

class MetaLine extends StatelessWidget {
  final MediaTitle t;
  const MetaLine(this.t, {super.key});
  @override
  Widget build(BuildContext context) {
    Widget badge(String s) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
          decoration: BoxDecoration(color: AppColors.ink3, borderRadius: BorderRadius.circular(3)),
          child: Text(s, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        );
    return Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
      Text('${t.match}% Match', style: const TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w700)),
      Text('${t.year}', style: const TextStyle(color: AppColors.muted)),
      badge(t.maturity),
      Text(t.meta, style: const TextStyle(color: AppColors.muted)),
      badge(t.quality),
    ]);
  }
}
