import 'package:web/web.dart' as web;

const bool sharedWithWebsite = true;

Future<void> init() async {}
String? getRaw(String key) => web.window.localStorage.getItem(key);
void setRaw(String key, String value) => web.window.localStorage.setItem(key, value);
