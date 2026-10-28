import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'backend.dart';
import 'protect.dart';

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

/// Per-profile library. My List, ratings, progress, reminders, viewing activity and the data meter
/// are kept in Supabase (shared with the website and other devices). Downloads and recent searches
/// stay on this device.
class LibraryStore extends ChangeNotifier {
  late SharedPreferences _prefs;
  String? _profile;

  List<String> list = [];
  Map<String, int> ratings = {}; // -1 not for me, 1 like, 2 love
  Map<String, Progress> progress = {};
  Set<String> reminders = {};
  List<String> recentSearches = [];
  Map<String, Map<String, double>> usage = {}; // month -> {seconds, gb}
  Map<String, double> today = {}; // date -> seconds
  List<Map<String, dynamic>> activity = []; // {titleId, season, episode, at}
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

  /// Switches to a profile and loads its library from the server (device-only items from storage).
  void loadProfile(String? profileId, {required bool kids}) {
    if (profileId == _profile) return;
    for (final s in _active.values) {
      s.cancel();
    }
    _active.clear();
    _flushUsage();
    _profile = profileId;
    list = [];
    ratings = {};
    progress = {};
    reminders = {};
    recentSearches = [];
    downloads = {};
    usage = {};
    today = {};
    activity = [];
    if (profileId == null) return notifyListeners();
    final raw = _prefs.getString(_key);
    if (raw != null) {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      recentSearches = List<String>.from(j['recent'] ?? []);
      downloads = (j['downloads'] as Map? ?? {}).map((k, v) => MapEntry(k as String, DownloadItem.fromJson(Map<String, dynamic>.from(v))));
    }
    notifyListeners();
    _loadRemote(profileId);
  }

  Future<void> reload() async {
    if (_profile != null) await _loadRemote(_profile!);
  }

  Future<void> _loadRemote(String pid) async {
    if (!backendConfigured) return;
    try {
      final first = DateTime(DateTime.now().year, DateTime.now().month, 1);
      final r = await Future.wait([
        sb.from('my_list').select('title_id').eq('profile_id', pid).order('added_at', ascending: false),
        sb.from('ratings').select('title_id, rating').eq('profile_id', pid),
        sb.from('progress').select().eq('profile_id', pid),
        sb.from('reminders').select('title_id').eq('profile_id', pid),
        sb.from('activity').select('id, title_id, season, episode, watched_at').eq('profile_id', pid).eq('hidden', false).order('watched_at', ascending: false).limit(300),
        sb.from('usage_daily').select('day, seconds, gb').eq('profile_id', pid).gte('day', first.toIso8601String().substring(0, 10)),
      ]);
      if (_profile != pid) return;
      list = [for (final x in r[0] as List) '${x['title_id']}'];
      ratings = {for (final x in r[1] as List) '${x['title_id']}': (x['rating'] as num).toInt()};
      progress = {
        for (final x in r[2] as List)
          '${x['title_id']}': Progress(pct: (x['pct'] as num).toDouble(), time: (x['position'] as num?)?.toDouble() ?? 0, season: x['season'] ?? 1, episode: x['episode'] ?? 1, updatedAt: x['updated_at'] ?? ''),
      };
      reminders = {for (final x in r[3] as List) '${x['title_id']}'};
      activity = [for (final x in r[4] as List) {'id': x['id'], 'titleId': x['title_id'], 'season': x['season'], 'episode': x['episode'], 'at': x['watched_at']}];
      var secs = 0.0, gb = 0.0;
      for (final x in r[5] as List) {
        secs += (x['seconds'] as num).toDouble();
        gb += (x['gb'] as num).toDouble();
        if (x['day'] == _day()) today = {_day(): (x['seconds'] as num).toDouble()};
      }
      usage = {_month(): {'seconds': secs, 'gb': gb}};
      notifyListeners();
    } catch (e) {
      debugPrint('library load failed: $e');
    }
  }

  void _save() {
    if (_profile == null) return;
    _prefs.setString(_key, jsonEncode({'recent': recentSearches, 'downloads': downloads.map((k, v) => MapEntry(k, v.toJson()))}));
  }

  void _changed() {
    _save();
    notifyListeners();
  }

  /// Fire-and-forget write; the screen already shows the change.
  void _remote(Future<dynamic> Function() run) {
    if (_profile == null || !backendConfigured) return;
    run().catchError((Object e) {
      debugPrint('library write failed: $e');
      return null;
    });
  }

  bool inList(String id) => list.contains(id);
  void toggleList(String id) {
    final pid = _profile;
    if (list.contains(id)) {
      list.remove(id);
      _remote(() => sb.from('my_list').delete().eq('profile_id', pid!).eq('title_id', id));
    } else {
      list.insert(0, id);
      _remote(() => sb.from('my_list').upsert({'profile_id': pid, 'title_id': id}));
    }
    _changed();
  }

  void rate(String id, int r) {
    final pid = _profile;
    if (ratings[id] == r) {
      ratings.remove(id);
      _remote(() => sb.from('ratings').delete().eq('profile_id', pid!).eq('title_id', id));
    } else {
      ratings[id] = r;
      _remote(() => sb.from('ratings').upsert({'profile_id': pid, 'title_id': id, 'rating': r, 'rated_at': DateTime.now().toUtc().toIso8601String()}));
    }
    _changed();
  }

  void toggleReminder(String id) {
    final pid = _profile;
    if (reminders.contains(id)) {
      reminders.remove(id);
      _remote(() => sb.from('reminders').delete().eq('profile_id', pid!).eq('title_id', id));
    } else {
      reminders.add(id);
      _remote(() => sb.from('reminders').upsert({'profile_id': pid, 'title_id': id}));
    }
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
    final now = DateTime.now().toUtc().toIso8601String();
    final pid = _profile;
    Progress? p;
    if (pct >= 95) {
      if (next != null) {
        p = Progress(pct: 0, time: 0, season: next.season, episode: next.episode, updatedAt: now);
      } else {
        progress.remove(titleId);
        _remote(() => sb.from('progress').delete().eq('profile_id', pid!).eq('title_id', titleId));
        _changed();
        return;
      }
    } else if (time > 10) {
      p = Progress(pct: pct, time: time, season: season, episode: episode, updatedAt: now);
    } else {
      return;
    }
    progress[titleId] = p;
    _remote(() => sb.from('progress').upsert({'profile_id': pid, 'title_id': titleId, 'season': p!.season, 'episode': p.episode, 'position': p.time, 'duration': duration, 'pct': p.pct.round(), 'updated_at': now}));
    _changed();
  }

  void removeProgress(String id) {
    final pid = _profile;
    progress.remove(id);
    _remote(() => sb.from('progress').delete().eq('profile_id', pid!).eq('title_id', id));
    _changed();
  }

  /* ---------------- Data meter, screen time, activity ---------------- */
  static String _month([DateTime? d]) {
    final x = d ?? DateTime.now();
    return '${x.year}-${x.month.toString().padLeft(2, '0')}';
  }

  static String _day() => DateTime.now().toIso8601String().substring(0, 10);

  /// GB per hour by quality: Save Data ~0.3, SD ~0.7, HD ~3, 4K ~7.
  static double gbPerHour(String dataUsage) => switch (dataUsage) { 'saver' => 0.3, 'hd' => 3.0, '4k' => 7.0, _ => 1.2 };

  double _unsentSeconds = 0, _unsentGb = 0;
  void addUsage(double seconds, String dataUsage) {
    if (seconds <= 0 || seconds > 30) return;
    final gb = gbPerHour(dataUsage) * seconds / 3600;
    final m = usage[_month()] ?? {'seconds': 0, 'gb': 0};
    usage[_month()] = {'seconds': (m['seconds'] ?? 0) + seconds, 'gb': (m['gb'] ?? 0) + gb};
    today = {_day(): (today[_day()] ?? 0) + seconds};
    _unsentSeconds += seconds;
    _unsentGb += gb;
    if (_unsentSeconds >= 60) _flushUsage();
  }

  /// Sends watch time to the server (screen-time limits and the data meter work across devices).
  void _flushUsage() {
    if (_unsentSeconds < 1 || _profile == null) return;
    final pid = _profile, s = _unsentSeconds.round(), g = double.parse(_unsentGb.toStringAsFixed(3));
    _unsentSeconds = 0;
    _unsentGb = 0;
    _remote(() => sb.rpc('add_usage', params: {'p_profile': pid, 'p_seconds': s, 'p_gb': g}));
  }

  void flushUsage() => _flushUsage();

  double get monthGb => usage[_month()]?['gb'] ?? 0;
  double get monthHours => (usage[_month()]?['seconds'] ?? 0) / 3600;
  int get todayMinutes => ((today[_day()] ?? 0) / 60).floor();

  void logActivity(String titleId, {int? season, int? episode}) {
    final pid = _profile;
    activity.removeWhere((a) => a['titleId'] == titleId && a['season'] == season && a['episode'] == episode);
    activity.insert(0, {'titleId': titleId, 'season': season, 'episode': episode, 'at': DateTime.now().toUtc().toIso8601String()});
    if (activity.length > 300) activity = activity.sublist(0, 300);
    _remote(() => sb.from('activity').insert({'profile_id': pid, 'title_id': titleId, 'season': season, 'episode': episode}));
    _changed();
  }

  void hideActivity(String at) {
    final pid = _profile;
    final item = activity.where((a) => a['at'] == at).firstOrNull;
    activity.removeWhere((a) => a['at'] == at);
    if (item != null) {
      _remote(() {
        var q = sb.from('activity').update({'hidden': true}).eq('profile_id', pid!).eq('title_id', item['titleId']);
        if (item['season'] != null) q = q.eq('season', item['season']).eq('episode', item['episode']);
        return q;
      });
    }
    _changed();
  }

  void clearActivity() {
    final pid = _profile;
    activity = [];
    _remote(() => sb.from('activity').update({'hidden': true}).eq('profile_id', pid!));
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
  Future<String?> startDownload(String titleId, {int? season, int? episode, int maxDownloads = 6, required String deviceName}) async {
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
    // Ask the server for a download link (checks the membership; only titles prepared for download have one)
    String url;
    try {
      final r = await fn('playback', {'title_id': titleId, 'season': season ?? 1, 'episode': episode ?? 1, 'stream_id': 'dl-${DateTime.now().millisecondsSinceEpoch}', 'profile_id': _profile, 'device': deviceName, 'download': true});
      if (r['ok'] == false) return r['reason'] == 'membership' ? 'Your membership has ended. Renew to download.' : r['reason'] == 'plan' ? "Your plan doesn't include downloads." : "This title can't be downloaded right now.";
      final link = r['download'] ?? (r['sample'] == true ? (r['sources'] as List?)?.first : null);
      if (link == null) return "This title isn't available for download yet.";
      url = '$link';
    } catch (e) {
      return friendly(e);
    }
    final item = downloads[key] ?? DownloadItem(key: key, titleId: titleId, season: season, episode: episode);
    item
      ..state = DlState.downloading
      ..progress = 0
      ..error = null;
    downloads[key] = item;
    _changed();
    _run(item, url);
    return null;
  }

  Future<void> _run(DownloadItem item, String url) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final folder = Directory('${dir.path}/downloads');
      if (!folder.existsSync()) folder.createSync(recursive: true);
      // Stored encrypted (.mfx) so the file can't be copied off the phone and played elsewhere
      final file = File('${folder.path}/${_profile}_${item.key.replaceAll('|', '_')}.mfx');
      final enc = await Protect.cipher();
      final req = http.Request('GET', Uri.parse(url));
      final res = await http.Client().send(req);
      if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
      final total = res.contentLength ?? 0;
      final sink = file.openWrite();
      var received = 0;
      final completer = Completer<void>();
      _active[item.key] = res.stream.listen(
        (chunk) {
          sink.add(enc(chunk, received));
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
