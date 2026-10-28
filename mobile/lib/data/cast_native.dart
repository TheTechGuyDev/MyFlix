import 'dart:async';
import 'package:cast/cast.dart';
import 'package:flutter/foundation.dart';

/// Casting to Chromecast and Google TV devices on the same Wi-Fi (Google's default media receiver).
/// The phone hands the TV the same short-lived signed stream link, then acts as a remote.
class CastStore extends ChangeNotifier {
  static final instance = CastStore._();
  CastStore._();

  /// Casting needs the phone app (browsers use their own Cast button in the player).
  static bool get supported => !kIsWeb;

  List<CastDevice> found = [];
  CastSession? _session;
  StreamSubscription? _msgs, _state;
  String? device;
  String? titleId;
  String? label;
  String? error;
  bool playing = false;
  bool scanning = false;
  int? _mediaSession;
  Duration position = Duration.zero;
  Timer? _clock;

  bool get connected => device != null;

  Future<void> scan() async {
    if (!supported || scanning) return;
    scanning = true;
    error = null;
    notifyListeners();
    try {
      found = await CastDiscoveryService().search(timeout: const Duration(seconds: 4));
    } catch (_) {
      found = [];
      error = "Couldn't search your Wi-Fi for TVs.";
    }
    scanning = false;
    notifyListeners();
  }

  /// Connects and launches the media receiver on the TV.
  Future<bool> connect(CastDevice d) async {
    try {
      final s = await CastSessionManager().startSession(d, const Duration(seconds: 8));
      _session = s;
      _state = s.stateStream.listen((st) {
        if (st == CastSessionState.closed) _reset();
      });
      _msgs = s.messageStream.listen(_onMessage);
      // Wait until the receiver app is running (listen before asking, so the reply isn't missed)
      final ready = s.stateStream.firstWhere((st) => st == CastSessionState.connected).timeout(const Duration(seconds: 10));
      s.sendMessage(CastSession.kNamespaceReceiver, {'type': 'LAUNCH', 'appId': 'CC1AD845', 'requestId': 1});
      await ready;
      device = d.name;
      error = null;
      notifyListeners();
      return true;
    } catch (_) {
      error = "Couldn't connect to ${d.name}. Make sure it's on and on the same Wi-Fi.";
      await _close();
      notifyListeners();
      return false;
    }
  }

  void _onMessage(Map<String, dynamic> m) {
    if (m['type'] != 'MEDIA_STATUS') return;
    final list = m['status'];
    if (list is! List || list.isEmpty) return;
    final st = list.first as Map;
    _mediaSession = st['mediaSessionId'] as int? ?? _mediaSession;
    final t = st['currentTime'];
    if (t is num) position = Duration(milliseconds: (t * 1000).round());
    final ps = st['playerState'];
    if (ps == 'PLAYING' || ps == 'BUFFERING') playing = true;
    if (ps == 'PAUSED') playing = false;
    if (ps == 'IDLE' && st['idleReason'] == 'FINISHED') playing = false;
    notifyListeners();
  }

  /// Starts a title on the TV from [from].
  void cast(String id, String text, {required String url, String? poster, Duration from = Duration.zero}) {
    final s = _session;
    if (s == null) return;
    titleId = id;
    label = text;
    position = from;
    playing = true;
    s.sendMessage(CastSession.kNamespaceMedia, {
      'type': 'LOAD',
      'requestId': 2,
      'autoplay': true,
      'currentTime': from.inMilliseconds / 1000,
      'media': {
        'contentId': url,
        'contentType': url.contains('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
        'streamType': 'BUFFERED',
        'metadata': {
          'type': 0,
          'metadataType': 0,
          'title': text,
          if (poster != null) 'images': [{'url': poster}],
        },
      },
    });
    // Local clock between status updates from the TV
    _clock?.cancel();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (playing) {
        position += const Duration(seconds: 1);
        notifyListeners();
      }
    });
    notifyListeners();
  }

  void toggle() {
    final s = _session;
    if (s == null || _mediaSession == null) return;
    s.sendMessage(CastSession.kNamespaceMedia, {'type': playing ? 'PAUSE' : 'PLAY', 'mediaSessionId': _mediaSession, 'requestId': 3});
    playing = !playing;
    notifyListeners();
  }

  Future<void> disconnect() async {
    final s = _session;
    if (s != null && _mediaSession != null) s.sendMessage(CastSession.kNamespaceMedia, {'type': 'STOP', 'mediaSessionId': _mediaSession, 'requestId': 4});
    await _close();
    _reset();
  }

  Future<void> _close() async {
    final s = _session;
    _session = null;
    await _msgs?.cancel();
    await _state?.cancel();
    if (s != null) {
      try {
        await CastSessionManager().endSession(s.sessionId);
      } catch (_) {}
    }
  }

  void _reset() {
    _clock?.cancel();
    device = null;
    titleId = null;
    label = null;
    playing = false;
    _mediaSession = null;
    notifyListeners();
  }
}
