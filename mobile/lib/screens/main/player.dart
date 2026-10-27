import 'dart:async';
import 'dart:io' show File;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import '../../data/auth_store.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/models.dart';
import '../../theme.dart';

class PlayerScreen extends StatefulWidget {
  final String id;
  final int? season, episode;
  const PlayerScreen({super.key, required this.id, this.season, this.episode});
  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

const _intro = (start: 5.0, end: 35.0);
const _speeds = [0.5, 0.75, 1.0, 1.25, 1.5];

class _PlayerScreenState extends State<PlayerScreen> {
  late final MediaTitle t = Catalog.byId(widget.id)!;
  late final LibraryStore lib = context.read<LibraryStore>();
  late final Profile profile = context.read<AuthStore>().activeProfile!;
  VideoPlayerController? _c;
  late int _season, _episode;
  bool _ui = true, _locked = false, _subs = false, _ended = false, _offline = false;
  String? _error;
  Timer? _hide, _saveTimer, _countdownTimer;
  int _countdown = 10;
  double? _drag;
  DateTime? _lastTick, _sleepAt;
  bool _sleepEnd = false, _capWarned = false, _logged = false;
  String? _blocked; // sleep | limit | still
  static int _autoplayChain = 0;

  @override
  void initState() {
    super.initState();
    final p = lib.progress[t.id];
    _season = widget.season ?? (t.isSeries ? p?.season ?? 1 : 1);
    _episode = widget.episode ?? (t.isSeries ? p?.episode ?? 1 : 1);
    _subs = profile.settings.language != 'English';
    if (!kIsWeb) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
    _load();
    _saveTimer = Timer.periodic(const Duration(seconds: 5), (_) => _save());
  }

  ({int season, int episode})? get _next {
    if (!t.isSeries) return null;
    final count = Catalog.episodes(t, _season).length;
    if (_episode < count) return (season: _season, episode: _episode + 1);
    if (_season < (t.seasons ?? 1)) return (season: _season + 1, episode: 1);
    return null;
  }

  String get _epTitle => t.isSeries ? Catalog.episodes(t, _season).firstWhere((e) => e.number == _episode).title : '';

  Future<ClosedCaptionFile> _captions() async {
    final lines = [
      if (t.isSeries) 'Previously on ${t.title}...' else t.title,
      ...t.synopsis.split(RegExp(r'(?<=[.!?,])\s+')),
      'Subtitles: ${profile.settings.language}',
    ];
    final b = StringBuffer('WEBVTT\n\n');
    String ts(int s) => '00:${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}.000';
    for (var i = 0; i < lines.length; i++) {
      b.write('${ts(2 + i * 5)} --> ${ts(6 + i * 5)}\n${lines[i]}\n\n');
    }
    return WebVTTCaptionFile(b.toString());
  }

  Future<void> _load() async {
    final old = _c;
    setState(() {
      _c = null;
      _error = null;
      _ended = false;
    });
    await old?.dispose();

    final key = t.isSeries ? LibraryStore.dlKey(t.id, _season, _episode) : t.id;
    final dl = lib.download(key);
    final p = lib.progress[t.id];
    final resume = (p != null && p.season == _season && p.episode == _episode) ? p.time : 0.0;

    final candidates = <VideoPlayerController Function()>[];
    if (!kIsWeb && dl?.state == DlState.done && dl?.path != null && File(dl!.path!).existsSync()) {
      candidates.add(() => VideoPlayerController.file(File(dl.path!), closedCaptionFile: _captions()));
    }
    for (final s in Catalog.sourcesFor(t)) {
      candidates.add(() => VideoPlayerController.networkUrl(Uri.parse(s), formatHint: s.endsWith('.m3u8') ? VideoFormat.hls : null, closedCaptionFile: _captions()));
    }

    for (var i = 0; i < candidates.length; i++) {
      final c = candidates[i]();
      try {
        await c.initialize().timeout(const Duration(seconds: 15));
        if (!mounted) {
          await c.dispose();
          return;
        }
        _offline = i == 0 && candidates.length > Catalog.sourcesFor(t).length;
        if (resume > 0 && resume < c.value.duration.inSeconds - 30) await c.seekTo(Duration(milliseconds: (resume * 1000).round()));
        c.addListener(_tick);
        await c.play();
        if (!_logged) {
          _logged = true;
          lib.logActivity(t.id, season: t.isSeries ? _season : null, episode: t.isSeries ? _episode : null);
        }
        setState(() => _c = c);
        _poke();
        return;
      } catch (_) {
        await c.dispose();
      }
    }
    if (mounted) setState(() => _error = "We're having trouble playing this title right now. Check your connection and try again.");
  }

  void _tick() {
    final c = _c;
    if (c == null || !mounted) return;
    final v = c.value;
    // Data meter, screen time, sleep timer
    final now = DateTime.now();
    if (v.isPlaying && _lastTick != null) lib.addUsage(now.difference(_lastTick!).inMilliseconds / 1000, profile.settings.dataUsage);
    _lastTick = v.isPlaying ? now : null;
    final limit = profile.settings.dailyLimitMinutes;
    if (limit != null && v.isPlaying && lib.todayMinutes >= limit) {
      c.pause();
      _blocked = 'limit';
    }
    final cap = profile.settings.monthlyDataCapGB;
    if (cap != null && !_capWarned && lib.monthGb >= cap) {
      _capWarned = true;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("You've reached your $cap GB monthly data limit for this profile.")));
    }
    if (_sleepAt != null && now.isAfter(_sleepAt!)) {
      c.pause();
      _sleepAt = null;
      _blocked = 'sleep';
    }
    if (!_ended && v.duration > Duration.zero && v.position >= v.duration - const Duration(milliseconds: 300) && !v.isPlaying) {
      _ended = true;
      _save();
      _ui = true;
      if (_sleepEnd) {
        _sleepEnd = false;
        _blocked = 'sleep';
      } else if (_next != null && profile.settings.autoplayNext) {
        _startCountdown();
      }
    }
    setState(() {});
  }

  void _startCountdown() {
    _countdown = 10;
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (tm) {
      if (!mounted) return tm.cancel();
      setState(() => _countdown--);
      if (_countdown <= 0) {
        tm.cancel();
        // "Are you still watching?" after 3 autoplayed episodes in a row
        if (++_autoplayChain >= 3) {
          setState(() => _blocked = 'still');
        } else {
          _goEpisode(_next!.season, _next!.episode);
        }
      }
    });
  }

  void _save() {
    final c = _c;
    if (c == null || !c.value.isInitialized) return;
    lib.saveProgress(
      t.id,
      time: c.value.position.inMilliseconds / 1000,
      duration: c.value.duration.inMilliseconds / 1000,
      season: _season,
      episode: _episode,
      next: _next,
    );
  }

  void _goEpisode(int s, int e) {
    _save();
    _countdownTimer?.cancel();
    setState(() {
      _season = s;
      _episode = e;
    });
    _load();
  }

  void _poke() {
    _hide?.cancel();
    setState(() => _ui = true);
    _hide = Timer(const Duration(seconds: 4), () {
      if (mounted && (_c?.value.isPlaying ?? false)) setState(() => _ui = false);
    });
  }

  void _seekBy(int s) {
    final c = _c;
    if (c == null) return;
    final to = c.value.position + Duration(seconds: s);
    c.seekTo(to < Duration.zero ? Duration.zero : to);
    _poke();
  }

  void _toggle() {
    final c = _c;
    if (c == null) return;
    if (_ended) {
      c.seekTo(Duration.zero);
      _ended = false;
    }
    c.value.isPlaying ? c.pause() : c.play();
    _poke();
  }

  @override
  void dispose() {
    _save();
    _hide?.cancel();
    _saveTimer?.cancel();
    _countdownTimer?.cancel();
    _c?.dispose();
    if (!kIsWeb) {
      SystemChrome.setPreferredOrientations(DeviceOrientation.values);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    super.dispose();
  }

  String _fmt(Duration d) {
    final h = d.inHours, m = d.inMinutes % 60, s = d.inSeconds % 60;
    final ss = s.toString().padLeft(2, '0');
    return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$ss' : '$m:$ss';
  }

  void _sheet(Widget Function(BuildContext) b) {
    _hide?.cancel();
    showModalBottomSheet(context: context, backgroundColor: AppColors.ink2, isScrollControlled: true, builder: (c) => SafeArea(child: b(c))).then((_) => _poke());
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    final v = c?.value;
    final dur = v?.duration ?? Duration.zero;
    final pos = _drag != null ? Duration(milliseconds: (_drag! * dur.inMilliseconds).round()) : (v?.position ?? Duration.zero);
    final secs = pos.inMilliseconds / 1000;
    final inIntro = t.isSeries && secs >= _intro.start && secs < _intro.end && dur.inSeconds > _intro.end + 60;
    final remaining = dur - pos;
    final next = _next;
    final showNext = next != null && dur > Duration.zero && (remaining.inSeconds <= 20 || _ended);
    final s = profile.settings;
    final capSize = s.subtitleSize == 'small' ? 15.0 : s.subtitleSize == 'large' ? 24.0 : 19.0;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _ui ? setState(() => _ui = false) : _poke(),
        onDoubleTapDown: _locked
            ? null
            : (d) {
                final w = MediaQuery.of(context).size.width;
                _seekBy(d.localPosition.dx < w / 2 ? -10 : 10);
              },
        child: Stack(fit: StackFit.expand, children: [
          if (c != null) Center(child: AspectRatio(aspectRatio: v!.aspectRatio, child: VideoPlayer(c))),
          if (c != null && _subs && (v?.caption.text.isNotEmpty ?? false))
            Positioned(
              left: 40,
              right: 40,
              bottom: _ui ? 110 : 40,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  color: s.subtitleBg == 'box' ? Colors.black87 : Colors.transparent,
                  child: Text(
                    v!.caption.text,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: capSize, shadows: s.subtitleBg == 'shadow' ? const [Shadow(blurRadius: 4), Shadow(blurRadius: 4)] : null),
                  ),
                ),
              ),
            ),
          if (c == null && _error == null) const Center(child: CircularProgressIndicator(color: AppColors.brandBright)),
          if (c != null && v!.isBuffering) const Center(child: CircularProgressIndicator(color: AppColors.brandBright)),
          if (_error != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(_error!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16)),
                  const SizedBox(height: 16),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    FilledButton(onPressed: _load, style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.ink), child: const Text('Try Again')),
                    const SizedBox(width: 12),
                    OutlinedButton(onPressed: () => context.pop(), child: const Text('Back', style: TextStyle(color: Colors.white))),
                  ]),
                ]),
              ),
            ),

          // Locked: only an unlock button
          if (_locked && _ui)
            Positioned(
              bottom: 28,
              left: 0,
              right: 0,
              child: Center(
                child: TextButton.icon(
                  onPressed: () => setState(() => _locked = false),
                  icon: const Icon(Icons.lock_open, color: Colors.white),
                  label: const Text('Unlock screen', style: TextStyle(color: Colors.white)),
                ),
              ),
            ),

          if (!_locked)
            IgnorePointer(
              ignoring: !_ui,
              child: AnimatedOpacity(
                opacity: _ui ? 1 : 0,
                duration: const Duration(milliseconds: 250),
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black87, Colors.transparent, Colors.transparent, Colors.black87], stops: [0, 0.25, 0.7, 1]),
                  ),
                  child: SafeArea(
                    child: Column(children: [
                      // Top bar
                      Row(children: [
                        IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back, size: 28)),
                        Expanded(
                          child: Text(
                            t.isSeries ? '${t.title}  S$_season:E$_episode "$_epTitle"' : t.title,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                          ),
                        ),
                        if (_offline)
                          const Padding(padding: EdgeInsets.only(right: 12), child: Row(children: [Icon(Icons.download_done, size: 18, color: AppColors.brandBright), SizedBox(width: 4), Text('Offline', style: TextStyle(fontSize: 12))])),
                        const SizedBox(width: 48),
                      ]),
                      const Spacer(),
                      // Centre controls
                      if (c != null)
                        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          IconButton(iconSize: 44, onPressed: () => _seekBy(-10), icon: const Icon(Icons.replay_10)),
                          const SizedBox(width: 40),
                          IconButton(iconSize: 64, onPressed: _toggle, icon: Icon(_ended ? Icons.replay : v!.isPlaying ? Icons.pause : Icons.play_arrow)),
                          const SizedBox(width: 40),
                          IconButton(iconSize: 44, onPressed: () => _seekBy(10), icon: const Icon(Icons.forward_10)),
                        ]),
                      const Spacer(),
                      // Seek bar
                      if (c != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Row(children: [
                            Expanded(
                              child: SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  trackHeight: 3,
                                  activeTrackColor: AppColors.brandBright,
                                  inactiveTrackColor: Colors.white24,
                                  thumbColor: AppColors.brandBright,
                                  overlayShape: SliderComponentShape.noOverlay,
                                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                                ),
                                child: Slider(
                                  value: dur.inMilliseconds == 0 ? 0 : (pos.inMilliseconds / dur.inMilliseconds).clamp(0, 1),
                                  onChangeStart: (_) => _hide?.cancel(),
                                  onChanged: (x) => setState(() => _drag = x),
                                  onChangeEnd: (x) {
                                    c.seekTo(Duration(milliseconds: (x * dur.inMilliseconds).round()));
                                    setState(() => _drag = null);
                                    _poke();
                                  },
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(_fmt(remaining.isNegative ? Duration.zero : remaining), style: const TextStyle(fontSize: 13)),
                          ]),
                        ),
                      // Bottom actions
                      if (c != null)
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(children: [
                            _Btn(icon: Icons.speed, label: 'Speed (${v!.playbackSpeed}x)', onTap: () => _sheet((ctx) => _speedSheet(ctx))),
                            _Btn(icon: Icons.lock_outline, label: 'Lock', onTap: () => setState(() => _locked = true)),
                            _Btn(icon: Icons.bedtime_outlined, label: _sleepAt != null || _sleepEnd ? 'Sleep (on)' : 'Sleep timer', onTap: () => _sheet((ctx) => _sleepSheet(ctx))),
                            _Btn(icon: Icons.share_outlined, label: 'Share moment', onTap: _share),
                            if (t.isSeries) _Btn(icon: Icons.video_library_outlined, label: 'Episodes', onTap: () => _sheet((ctx) => _episodesSheet(ctx))),
                            _Btn(icon: Icons.subtitles_outlined, label: 'Audio & Subtitles', onTap: () => _sheet((ctx) => _audioSheet(ctx))),
                            if (next != null) _Btn(icon: Icons.skip_next, label: 'Next Ep.', onTap: () => _goEpisode(next.season, next.episode)),
                          ]),
                        ),
                    ]),
                  ),
                ),
              ),
            ),

          if (_blocked != null)
            Positioned.fill(
              child: Container(
                color: Colors.black87,
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(
                    _blocked == 'sleep' ? 'Sleep timer ended' : _blocked == 'limit' ? "That's all for today" : 'Are you still watching ${t.title}?',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _blocked == 'sleep'
                        ? "Good night! We've paused so you don't miss anything."
                        : _blocked == 'limit'
                            ? 'This profile has a ${profile.settings.dailyLimitMinutes}-minute daily limit. A parent can change it in Profile Settings.'
                            : 'We paused to save your data in case you fell asleep.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(height: 20),
                  Wrap(spacing: 12, children: [
                    if (_blocked == 'still' && next != null)
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.ink),
                        onPressed: () {
                          _autoplayChain = 0;
                          setState(() => _blocked = null);
                          _goEpisode(next.season, next.episode);
                        },
                        child: const Text('Continue Watching'),
                      ),
                    if (_blocked == 'sleep')
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.ink),
                        onPressed: () {
                          setState(() => _blocked = null);
                          _c?.play();
                        },
                        child: const Text('Keep Watching'),
                      ),
                    OutlinedButton(onPressed: () => context.pop(), child: const Text('Back', style: TextStyle(color: Colors.white))),
                  ]),
                ]),
              ),
            ),

          if (inIntro && !_locked && !showNext)
            Positioned(
              right: 24,
              bottom: _ui ? 120 : 40,
              child: OutlinedButton(
                onPressed: () => c?.seekTo(Duration(seconds: _intro.end.toInt())),
                style: OutlinedButton.styleFrom(backgroundColor: Colors.black54, side: const BorderSide(color: Colors.white, width: 1.5), padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14)),
                child: const Text('Skip Intro', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ),

          if (showNext && !_locked)
            Positioned(
              right: 24,
              bottom: _ui ? 120 : 40,
              child: FilledButton.icon(
                onPressed: () => _goEpisode(next.season, next.episode),
                style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.ink, padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14)),
                icon: const Icon(Icons.skip_next),
                label: Text(_ended && s.autoplayNext ? 'Next Episode in $_countdown' : 'Next Episode', style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
        ]),
      ),
    );
  }

  void _share() {
    final secs = _c?.value.position.inSeconds ?? 0;
    final url = 'https://thetechguydev.github.io/MyFlix/watch/?id=${t.id}${t.isSeries ? '&s=$_season&e=$_episode' : ''}&t=$secs';
    SharePlus.instance.share(ShareParams(text: 'Watch this moment of "${t.title}" on MyFlix: $url'));
  }

  Widget _sleepSheet(BuildContext ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Sleep Timer', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 8),
          ListTile(title: const Text('Off'), trailing: _sleepAt == null && !_sleepEnd ? const Icon(Icons.check, color: AppColors.brandBright) : null, onTap: () {
            setState(() {
              _sleepAt = null;
              _sleepEnd = false;
            });
            Navigator.pop(ctx);
          }),
          for (final m in const [15, 30, 45, 60])
            ListTile(title: Text('$m minutes'), onTap: () {
              setState(() {
                _sleepAt = DateTime.now().add(Duration(minutes: m));
                _sleepEnd = false;
              });
              Navigator.pop(ctx);
            }),
          ListTile(title: Text(t.isSeries ? 'End of episode' : 'End of film'), trailing: _sleepEnd ? const Icon(Icons.check, color: AppColors.brandBright) : null, onTap: () {
            setState(() {
              _sleepEnd = true;
              _sleepAt = null;
            });
            Navigator.pop(ctx);
          }),
        ]),
      );

  Widget _speedSheet(BuildContext ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Playback Speed', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            for (final sp in _speeds)
              InkWell(
                onTap: () {
                  _c?.setPlaybackSpeed(sp);
                  Navigator.pop(ctx);
                },
                child: Column(children: [
                  Icon(_c?.value.playbackSpeed == sp ? Icons.radio_button_checked : Icons.radio_button_off, color: _c?.value.playbackSpeed == sp ? AppColors.brandBright : Colors.white54),
                  const SizedBox(height: 6),
                  Text(sp == 1 ? '1x (Normal)' : '${sp}x'),
                ]),
              ),
          ]),
        ]),
      );

  Widget _audioSheet(BuildContext ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: const EdgeInsets.all(20),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                Text('Audio', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                SizedBox(height: 10),
                Row(children: [Icon(Icons.check, color: AppColors.brandBright, size: 20), SizedBox(width: 8), Text('Original')]),
              ]),
            ),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Subtitles', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 4),
                for (final o in [(false, 'Off'), (true, profile.settings.language)])
                  TextButton.icon(
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, foregroundColor: Colors.white, alignment: Alignment.centerLeft),
                    onPressed: () {
                      setState(() => _subs = o.$1);
                      set(() {});
                    },
                    icon: Icon(Icons.check, size: 20, color: _subs == o.$1 ? AppColors.brandBright : Colors.transparent),
                    label: Text(o.$2),
                  ),
              ]),
            ),
          ]),
        ),
      );

  Widget _episodesSheet(BuildContext ctx) {
    var season = _season;
    return StatefulBuilder(
      builder: (ctx, set) => SizedBox(
        height: MediaQuery.of(ctx).size.height * 0.8,
        child: Column(children: [
          if ((t.seasons ?? 1) > 1)
            SizedBox(
              height: 52,
              child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.all(8), children: [
                for (var s2 = 1; s2 <= (t.seasons ?? 1); s2++)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(label: Text('Season $s2'), selected: season == s2, onSelected: (_) => set(() => season = s2)),
                  ),
              ]),
            ),
          Expanded(
            child: ListView(children: [
              for (final e in Catalog.episodes(t, season))
                ListTile(
                  selected: season == _season && e.number == _episode,
                  selectedColor: AppColors.brandBright,
                  leading: Text('${e.number}', style: const TextStyle(fontSize: 18)),
                  title: Text(e.title),
                  subtitle: Text(e.runtime, style: const TextStyle(color: AppColors.muted)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _goEpisode(season, e.number);
                  },
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Btn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _Btn({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) => TextButton.icon(
        onPressed: onTap,
        icon: Icon(icon, color: Colors.white, size: 22),
        label: Text(label, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
      );
}
