import 'package:flutter/foundation.dart';
import 'backend.dart';
import 'catalog.dart';

/// Concurrent streams ("Too many people are using your account"), enforced on the server.
class LiveStreams {
  static String get device => kIsWeb ? 'MyFlix app (browser)' : defaultTargetPlatform == TargetPlatform.iOS ? 'MyFlix app on iPhone' : 'MyFlix app on Android';

  /// Heartbeat for a playing stream. Returns null when it may keep playing, otherwise the reason
  /// ('stopped' remotely, 'screens' limit, 'membership' ended, 'suspended').
  static Future<String?> beat({required String id, required String profileId, required String titleId}) async {
    try {
      final r = await sb.rpc('claim_stream', params: {'p_id': id, 'p_profile': profileId, 'p_device': device, 'p_title': titleId});
      final m = Map<String, dynamic>.from(r as Map);
      return m['ok'] == true ? null : '${m['reason'] ?? 'stopped'}';
    } catch (_) {
      return null; // a network blip shouldn't stop playback
    }
  }

  /// Other streams on this account right now (for the "too many screens" screen).
  static Future<List<Map<String, dynamic>>> others(String except) async {
    try {
      final r = await sb.from('streams').select('id, profile_name, device, title, beat_at').isFilter('stopped_by', null).neq('id', except);
      final cutoff = DateTime.now().toUtc().subtract(const Duration(seconds: 30));
      return [
        for (final s in List<Map<String, dynamic>>.from(r))
          if (DateTime.parse(s['beat_at']).isAfter(cutoff)) {'id': s['id'], 'profile': s['profile_name'] ?? 'Someone', 'device': s['device'] ?? 'another device', 'title': s['title'] ?? ''},
      ];
    } catch (_) {
      return [];
    }
  }

  static Future<void> release(String id) async {
    try {
      await sb.rpc('end_stream', params: {'p_id': id});
    } catch (_) {}
  }

  static Future<void> stop(String id) async {
    try {
      await sb.rpc('stop_stream', params: {'p_id': id});
    } catch (_) {}
  }
}

/// Platform protection settings from the admin dashboard.
class Protection {
  static bool get watermark => Catalog.settings['watermarkEnabled'] != false;
  static bool get screenshotBlock => Catalog.settings['screenshotBlock'] != false;
  static bool get downloads => Catalog.settings['downloadsEnabled'] != false;
}
