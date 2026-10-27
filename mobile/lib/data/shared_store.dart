/// Raw key/value storage shared with the MyFlix website and admin dashboard.
///
/// In the web preview (same site as the website) this is the browser's localStorage, so the app,
/// website and admin see the same outbox, live streams, TV codes and admin settings.
/// On Android/iOS it falls back to on-device storage. With Supabase these become database tables.
library;

import 'dart:convert';
import 'shared_store_io.dart' if (dart.library.js_interop) 'shared_store_web.dart' as impl;

class SharedStore {
  static Future<void> init() => impl.init();
  static bool get sharedWithWebsite => impl.sharedWithWebsite;
  static String? raw(String key) => impl.getRaw(key);
  static void setRaw(String key, String value) => impl.setRaw(key, value);

  static T read<T>(String key, T fallback) {
    final r = raw(key);
    if (r == null) return fallback;
    try {
      final v = jsonDecode(r);
      return v is T ? v : fallback;
    } catch (_) {
      return fallback;
    }
  }

  static void write(String key, Object? value) => setRaw(key, jsonEncode(value));
}
