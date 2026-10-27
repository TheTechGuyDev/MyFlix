import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';
import '../../data/auth_store.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/models.dart';
import '../../data/shared_store.dart';
import '../../i18n.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// One short moment from a title.
class ClipItem {
  final String id, titleId, caption;
  final int start, end;
  const ClipItem(this.id, this.titleId, this.start, this.end, this.caption);
}

const _captions = ['This scene though', 'Wait for it…', 'No one saw this coming', 'The way she said it!', 'Lagos traffic be like', 'Plot twist alert', 'Pure vibes', 'When the music hits'];

/// Admin-curated clips (Home Curation > Clips feed), else an automatic mix.
List<(ClipItem, MediaTitle)> clipsFor({required bool kids, required String max}) {
  final curated = (SharedStore.read<Map>('myflix.admin.curation', {})['clips'] as List?) ?? [];
  final list = curated.isNotEmpty
      ? [for (final c in curated) ClipItem(c['id'], c['titleId'], (c['start'] as num).toInt(), (c['end'] as num).toInt(), c['caption'] ?? '')]
      : [
          for (final (i, t) in Catalog.titles.where((t) => t.comingSoon == null).take(14).indexed) ClipItem('c-${t.id}', t.id, (i * 13) % 80, (i * 13) % 80 + 22, _captions[i % _captions.length]),
        ];
  return [
    for (final c in list)
      if (Catalog.byId(c.titleId) case final t? when t.comingSoon == null && Catalog.allowed(t, max) && (!kids || t.kids)) (c, t),
  ];
}

int _baseLaughs(String id) {
  var h = 0;
  for (final c in id.codeUnits) {
    h = (h * 33 + c) & 0xffffffff;
  }
  return 800 + h % 24000;
}

String _compact(int n) => n >= 1000 ? '${(n / 1000).toStringAsFixed(n >= 10000 ? 0 : 1)}K' : '$n';

class ClipsScreen extends StatefulWidget {
  const ClipsScreen({super.key});
  @override
  State<ClipsScreen> createState() => _ClipsScreenState();
}

class _ClipsScreenState extends State<ClipsScreen> {
  int _index = 0;
  bool _muted = true;
  Set<String> _laughs = {};
  String? _pid;

  Future<void> _loadReacts(String pid) async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() => _laughs = (prefs.getStringList('myflix.clipReacts.$pid') ?? []).toSet());
  }

  Future<void> _toggleLaugh(String pid, String id) async {
    setState(() => _laughs.contains(id) ? _laughs.remove(id) : _laughs.add(id));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('myflix.clipReacts.$pid', _laughs.toList());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile!;
    if (_pid != p.id) {
      _pid = p.id;
      _loadReacts(p.id);
    }
    final lib = context.watch<LibraryStore>();
    final items = clipsFor(kids: p.kids, max: p.settings.maturity);
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(children: [
        PageView.builder(
          scrollDirection: Axis.vertical,
          itemCount: items.length,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (context, i) {
            final (clip, t) = items[i];
            final laughed = _laughs.contains(clip.id);
            return Stack(fit: StackFit.expand, children: [
              if ((i - _index).abs() <= 1) _ClipVideo(key: ValueKey(clip.id), clip: clip, title: t, active: i == _index, muted: _muted, onTap: () => setState(() => _muted = !_muted)) else NetImage(img(t.image, w: 500, h: 900)),
              if (_muted && i == _index)
                Center(
                  child: GestureDetector(
                    onTap: () => setState(() => _muted = false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.volume_off, size: 18), const SizedBox(width: 6), Text(context.tr('Tap for sound'), style: const TextStyle(fontWeight: FontWeight.w600))]),
                    ),
                  ),
                ),
              // Actions
              Positioned(
                right: 10,
                bottom: 150,
                child: Column(children: [
                  _Action(icon: Icons.sentiment_very_satisfied, label: _compact(_baseLaughs(clip.id) + (laughed ? 1 : 0)), on: laughed, onTap: () => _toggleLaugh(p.id, clip.id)),
                  _Action(icon: lib.inList(t.id) ? Icons.check : Icons.add, label: context.tr('My List'), onTap: () => lib.toggleList(t.id)),
                  _Action(
                    icon: Icons.share_outlined,
                    label: context.tr('Share'),
                    onTap: () => SharePlus.instance.share(ShareParams(text: '${clip.caption} ${t.title} on MyFlix: https://thetechguydev.github.io/MyFlix/watch/?id=${t.id}&t=${clip.start}')),
                  ),
                ]),
              ),
              // Info
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 60, 16, 18),
                  decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Colors.black, Colors.black54, Colors.transparent])),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (clip.caption.isNotEmpty) Text(clip.caption, style: const TextStyle(color: Colors.white70)),
                    Text(t.title.toUpperCase(), style: const TextStyle(fontFamily: kDisplay, fontSize: 38, height: 1)),
                    Text('${t.genres.take(3).join(' • ')} · ${t.maturity}', style: const TextStyle(color: Colors.white60, fontSize: 12)),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => context.push('/watch/${t.id}'),
                          icon: const Icon(Icons.play_arrow),
                          label: Text(context.tr('Watch now'), style: const TextStyle(fontWeight: FontWeight.w700)),
                          style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.ink, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5))),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => context.push('/title/${t.id}'),
                          style: FilledButton.styleFrom(backgroundColor: Colors.white24, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5))),
                          child: Text(context.tr('More Info'), style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ]),
                  ]),
                ),
              ),
            ]);
          },
        ),
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(children: [
              const SizedBox(width: 40),
              Expanded(child: Center(child: Text(context.tr('Clips'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)))),
              IconButton(icon: Icon(_muted ? Icons.volume_off : Icons.volume_up), onPressed: () => setState(() => _muted = !_muted)),
            ]),
          ),
        ),
        ),
      ]),
    );
  }
}

class _Action extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool on;
  final VoidCallback onTap;
  const _Action({required this.icon, required this.label, this.on = false, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: GestureDetector(
          onTap: onTap,
          child: Column(children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: on ? AppColors.brand : Colors.black54, shape: BoxShape.circle),
              child: Icon(icon, size: 26),
            ),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
          ]),
        ),
      );
}

class _ClipVideo extends StatefulWidget {
  final ClipItem clip;
  final MediaTitle title;
  final bool active, muted;
  final VoidCallback onTap;
  const _ClipVideo({super.key, required this.clip, required this.title, required this.active, required this.muted, required this.onTap});
  @override
  State<_ClipVideo> createState() => _ClipVideoState();
}

class _ClipVideoState extends State<_ClipVideo> {
  VideoPlayerController? _c;
  int _start = 0, _end = 20;

  @override
  void initState() {
    super.initState();
    final c = VideoPlayerController.networkUrl(Uri.parse(Catalog.demoMp4));
    c.initialize().then((_) async {
      if (!mounted) return c.dispose();
      final len = c.value.duration.inSeconds;
      _start = widget.clip.start < len ? widget.clip.start : 0;
      _end = widget.clip.end.clamp(_start + 5, len);
      await c.seekTo(Duration(seconds: _start));
      await c.setVolume(widget.muted ? 0 : 1);
      c.addListener(_loop);
      if (widget.active) c.play();
      setState(() => _c = c);
    }).catchError((_) {});
  }

  void _loop() {
    final c = _c;
    if (c == null) return;
    if (c.value.position.inMilliseconds >= _end * 1000) c.seekTo(Duration(seconds: _start));
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(_ClipVideo old) {
    super.didUpdateWidget(old);
    final c = _c;
    if (c == null) return;
    if (widget.active && !c.value.isPlaying) c.play();
    if (!widget.active && c.value.isPlaying) c.pause();
    c.setVolume(widget.muted ? 0 : 1);
  }

  @override
  void dispose() {
    _c?.removeListener(_loop);
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    final pos = c == null ? 0.0 : ((c.value.position.inMilliseconds / 1000 - _start) / (_end - _start)).clamp(0.0, 1.0);
    return GestureDetector(
      onTap: widget.onTap,
      child: Stack(fit: StackFit.expand, children: [
        if (c == null) NetImage(img(widget.title.image, w: 500, h: 900)),
        if (c != null)
          FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(width: c.value.size.width, height: c.value.size.height, child: VideoPlayer(c)),
          ),
        Positioned(left: 0, right: 0, bottom: 0, child: LinearProgressIndicator(value: pos, minHeight: 2, color: AppColors.brandBright, backgroundColor: Colors.white24)),
      ]),
    );
  }
}
