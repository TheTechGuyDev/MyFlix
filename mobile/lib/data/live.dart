import 'package:flutter/foundation.dart';
import 'shared_store.dart';

/// Concurrent stream registry ("Too many people are using your account"). Shared with the website
/// and the admin Live Now page in the web preview. With Supabase: a `streams` table + realtime.
class LiveStreams {
  static const stale = Duration(seconds: 30);

  static Map<String, dynamic> _all() => Map<String, dynamic>.from(SharedStore.read<Map>('myflix.live', {}));

  static List<Map<String, dynamic>> active(String email, {String? except}) {
    final now = DateTime.now().millisecondsSinceEpoch;
    return _all()
        .values
        .map((e) => Map<String, dynamic>.from(e))
        .where((s) => s['email'] == email && s['id'] != except && s['stoppedBy'] == null && now - (s['beat'] as num) < stale.inMilliseconds)
        .toList();
  }

  static bool get enforced => SharedStore.read<Map>('myflix.admin.settings', {})['streamLimitEnforced'] != false;

  /// Returns null when the stream may play; 'stopped' if it was stopped remotely; otherwise 'limit'.
  static String? claim({required String id, required String email, required String profile, required String titleId, required String title, required int screens}) {
    final all = _all();
    final now = DateTime.now().millisecondsSinceEpoch;
    all.removeWhere((_, v) => now - ((v as Map)['beat'] as num) > stale.inMilliseconds * 4);
    final mine = all[id] as Map?;
    if (mine?['stoppedBy'] != null) return 'stopped';
    if (mine == null && enforced && active(email, except: id).length >= screens) return 'limit';
    all[id] = {
      'id': id,
      'email': email,
      'profile': profile,
      'device': kIsWeb ? 'MyFlix app (web)' : defaultTargetPlatform == TargetPlatform.iOS ? 'MyFlix app on iPhone' : 'MyFlix app on Android',
      'titleId': titleId,
      'title': title,
      'startedAt': (mine?['startedAt'] as String?) ?? DateTime.now().toUtc().toIso8601String(),
      'beat': now,
    };
    SharedStore.write('myflix.live', all);
    return null;
  }

  static void release(String id) {
    final all = _all()..remove(id);
    SharedStore.write('myflix.live', all);
  }

  static void stop(String id) {
    final all = _all();
    if (all[id] != null) {
      all[id] = {...Map<String, dynamic>.from(all[id]), 'stoppedBy': 'member'};
      SharedStore.write('myflix.live', all);
    }
  }
}

/// Platform protection settings published from the admin dashboard.
class Protection {
  static Map get _s => SharedStore.read<Map>('myflix.admin.settings', {});
  static bool get watermark => _s['watermarkEnabled'] != false;
  static bool get screenshotBlock => _s['screenshotBlock'] != false;
}
