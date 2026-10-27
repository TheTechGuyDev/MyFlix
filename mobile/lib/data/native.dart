import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Android bridge (MainActivity.kt): screenshot blocking and system notifications.
class Native {
  static const _ch = MethodChannel('myflix/native');
  static bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// Blocks screenshots and screen recording (FLAG_SECURE) while protected video is on screen.
  static Future<void> secure(bool on) async {
    if (!_android) return;
    try {
      await _ch.invokeMethod('secure', on);
    } catch (_) {}
  }

  static Future<bool> requestNotifications() async {
    if (!_android) return false;
    try {
      return await _ch.invokeMethod<bool>('notifyPermission') ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> notify(String title, String body) async {
    if (!_android) return;
    try {
      await _ch.invokeMethod('notify', {'title': title, 'body': body});
    } catch (_) {}
  }
}
