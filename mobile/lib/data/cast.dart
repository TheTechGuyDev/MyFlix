/// Chromecast on Android/iOS; a no-op on the web preview (browsers cast from the player).
library;

export 'cast_native.dart' if (dart.library.js_interop) 'cast_web.dart';
