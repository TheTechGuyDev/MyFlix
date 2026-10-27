import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'catalog.dart';

class Progress {
  final double pct; // 0-100
  final double time; // seconds
  final int season, episode;
  final String updatedAt;
  Progress({required this.pct, this.time = 0, this.season = 1, this.episode = 1, required this.updatedAt});
  factory Progress.fromJson(Map<String, dynamic> j) => Progress(
        pct: (j['pct'] as num).toDouble(),
        time: (j['time'] as num?)?.toDouble() ?? 0,
        season: j['season'] ?? 1,
        episode: j['episode'] ?? 1,
        updatedAt: j['updatedAt'] ?? '',
      );
  Map<String, dynamic> toJson() => {'pct': pct, 'time': time, 'season': season, 'episode': episode, 'updatedAt': updatedAt};
}

enum DlState { queued, downloading, done, failed, paused }

class DownloadItem {
  final String key; // titleId or titleId|s|e
  final String titleId;
  final int? season, episode;
  DlState state;
  double progress; // 0-1
  int bytes;
  String? path;
  String? error;
  DownloadItem({required this.key, required this.titleId, this.season, this.episode, this.state = DlState.queued, this.progress = 0, this.bytes = 0, this.path, this.error});

  factory DownloadItem.fromJson(Map<String, dynamic> j) => DownloadItem(
        key: j['key'],
        titleId: j['titleId'],
        season: j['season'],
        episode: j['episode'],
        state: DlState.values.byName(j['state'] == 'downloading' || j['state'] == 'queued' ? 'paused' : j['state']),
        progress: (j['progress'] as num?)?.toDouble() ?? 0,
        bytes: j['bytes'] ?? 0,
        path: j['path'],
      );
  Map<String, dynamic> toJson() => {
        'key': key,
        'titleId': titleId,
        if (season != null) 'season': season,
        if (episode != null) 'episode': episode,
        'state': state.name,
        'progress': progress,
        'bytes': bytes,
        if (path != null) 'path': path,
      };
}

/// Per-profile library: My List, ratings, progress, reminders and downloads.
class LibraryStore extends ChangeNotifier {
  late SharedPreferences _prefs;
  String? _profile;

  List<String> list = [];
  Map<String, int> ratings = {}; // -1 not for me, 1 like, 2 love
  Map<String, Progress> progress = {};
  Set<String> reminders = {};
  List<String> recentSearches = [];
  Map<String, DownloadItem> downloads = {};
  final Map<String, StreamSubscription> _active = {};

  // App-wide settings
  bool wifiOnly = true;
  String downloadQuality = 'standard';
  String cellularData = 'auto';

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    wifiOnly = _prefs.getBool('myflix.app.wifiOnly') ?? true;
    downloadQuality = _prefs.getString('myflix.app.dlQuality') ?? 'standard';
    cellularData = _prefs.getString('myflix.app.cellular') ?? 'auto';
  }

  String get _key => 'myflix.lib.$_profile';

  void loadProfile(String? profileId, {required bool kids}) {
    if (profileId == _profile) return;
    for (final s in _active.values) {
      s.cancel();
    }
    _active.clear();
    _profile = profileId;
    list = [];
    ratings = {};
    progress = {};
    reminders = {};
    recentSearches = [];
    downloads = {};
    if (profileId == null) return notifyListeners();
    final raw = _prefs.getString(_key);
    if (raw != null) {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      list = List<String>.from(j['list'] ?? []);
      ratings = Map<String, int>.from(j['ratings'] ?? {});
      progress = (j['progress'] as Map? ?? {}).map((k, v) => MapEntry(k as String, Progress.fromJson(Map<String, dynamic>.from(v))));
      reminders = Set<String>.from(j['reminders'] ?? []);
      recentSearches = List<String>.from(j['recent'] ?? []);
      downloads = (j['downloads'] as Map? ?? {}).map((k, v) => MapEntry(k as String, DownloadItem.fromJson(Map<String, dynamic>.from(v))));
    } else {
      // Fresh profile: give Continue Watching something to show (demo)
      final now = DateTime.now().toIso8601String();
      final seed = kids ? ['compound-kids', 'market-day'] : ['no-witness', 'chairmans-son', 'danfo-diaries'];
      for (var i = 0; i < seed.length; i++) {
        progress[seed[i]] = Progress(pct: [35.0, 62.0, 18.0][i % 3], season: 1, episode: i + 2, updatedAt: now);
      }
      _save();
    }
    notifyListeners();
  }

  void _save() {
    if (_profile == null) return;
    _prefs.setString(
      _key,
      jsonEncode({
        'list': list,
        'ratings': ratings,
        'progress': progress.map((k, v) => MapEntry(k, v.toJson())),
        'reminders': reminders.toList(),
        'recent': recentSearches,
        'downloads': downloads.map((k, v) => MapEntry(k, v.toJson())),
      }),
    );
  }

  void _changed() {
    _save();
    notifyListeners();
  }

  bool inList(String id) => list.contains(id);
  void toggleList(String id) {
    list.contains(id) ? list.remove(id) : list.insert(0, id);
    _changed();
  }

  void rate(String id, int r) {
    ratings[id] == r ? ratings.remove(id) : ratings[id] = r;
    _changed();
  }

  void toggleReminder(String id) {
    reminders.contains(id) ? reminders.remove(id) : reminders.add(id);
    _changed();
  }

  void addSearch(String q) {
    final s = q.trim();
    if (s.isEmpty) return;
    recentSearches
      ..remove(s)
      ..insert(0, s);
    if (recentSearches.length > 8) recentSearches = recentSearches.sublist(0, 8);
    _changed();
  }

  void clearSearches() {
    recentSearches = [];
    _changed();
  }

  void saveProgress(String titleId, {required double time, required double duration, required int season, required int episode, ({int season, int episode})? next}) {
    if (duration <= 0) return;
    final pct = time / duration * 100;
    final now = DateTime.now().toIso8601String();
    if (pct >= 95) {
      if (next != null) {
        progress[titleId] = Progress(pct: 0, time: 0, season: next.season, episode: next.episode, updatedAt: now);
      } else {
        progress.remove(titleId);
      }
    } else if (time > 10) {
      progress[titleId] = Progress(pct: pct, time: time, season: season, episode: episode, updatedAt: now);
    } else {
      return;
    }
    _changed();
  }

  void removeProgress(String id) {
    progress.remove(id);
    _changed();
  }

  /* ---------------- App settings ---------------- */
  void setWifiOnly(bool v) {
    wifiOnly = v;
    _prefs.setBool('myflix.app.wifiOnly', v);
    notifyListeners();
  }

  void setDownloadQuality(String v) {
    downloadQuality = v;
    _prefs.setString('myflix.app.dlQuality', v);
    notifyListeners();
  }

  void setCellular(String v) {
    cellularData = v;
    _prefs.setString('myflix.app.cellular', v);
    notifyListeners();
  }

  /* ---------------- Downloads ---------------- */
  static String dlKey(String titleId, [int? s, int? e]) => s == null ? titleId : '$titleId|$s|$e';

  DownloadItem? download(String key) => downloads[key];

  int get downloadedBytes => downloads.values.where((d) => d.state == DlState.done).fold(0, (a, d) => a + d.bytes);

  /// Starts a download. Returns an error message if it can't start.
  Future<String?> startDownload(String titleId, {int? season, int? episode, int maxDownloads = 6}) async {
    if (kIsWeb) return 'Downloads are available in the MyFlix app for Android and iOS.';
    final key = dlKey(titleId, season, episode);
    final distinctTitles = downloads.values.map((d) => d.titleId).toSet();
    if (!distinctTitles.contains(titleId) && distinctTitles.length >= maxDownloads * 5) {
      return 'You have reached the download limit for your plan.';
    }
    if (wifiOnly) {
      final c = await Connectivity().checkConnectivity();
      if (!c.contains(ConnectivityResult.wifi) && !c.contains(ConnectivityResult.ethernet)) {
        return 'Downloads are set to Wi-Fi only. Connect to Wi-Fi or change this in App Settings.';
      }
    }
    final item = downloads[key] ?? DownloadItem(key: key, titleId: titleId, season: season, episode: episode);
    item
      ..state = DlState.downloading
      ..progress = 0
      ..error = null;
    downloads[key] = item;
    _changed();
    _run(item);
    return null;
  }

  Future<void> _run(DownloadItem item) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final folder = Directory('${dir.path}/downloads');
      if (!folder.existsSync()) folder.createSync(recursive: true);
      final file = File('${folder.path}/${_profile}_${item.key.replaceAll('|', '_')}.mp4');
      final req = http.Request('GET', Uri.parse(Catalog.demoMp4));
      final res = await http.Client().send(req);
      if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
      final total = res.contentLength ?? 0;
      final sink = file.openWrite();
      var received = 0;
      final completer = Completer<void>();
      _active[item.key] = res.stream.listen(
        (chunk) {
          sink.add(chunk);
          received += chunk.length;
          if (total > 0) {
            item.progress = received / total;
            notifyListeners();
          }
        },
        onDone: () async {
          await sink.close();
          item
            ..state = DlState.done
            ..progress = 1
            ..bytes = received
            ..path = file.path;
          _active.remove(item.key);
          _changed();
          completer.complete();
        },
        onError: (Object e) async {
          await sink.close();
          item
            ..state = DlState.failed
            ..error = 'Download failed. Check your connection and try again.';
          _active.remove(item.key);
          _changed();
          completer.complete();
        },
        cancelOnError: true,
      );
      await completer.future;
    } catch (_) {
      item
        ..state = DlState.failed
        ..error = 'Download failed. Check your connection and try again.';
      _changed();
    }
  }

  Future<void> deleteDownload(String key) async {
    await _active.remove(key)?.cancel();
    final d = downloads.remove(key);
    if (d?.path != null && !kIsWeb) {
      final f = File(d!.path!);
      if (f.existsSync()) f.deleteSync();
    }
    _changed();
  }

  Future<void> deleteAllDownloads() async {
    for (final k in [...downloads.keys]) {
      await deleteDownload(k);
    }
  }
}
