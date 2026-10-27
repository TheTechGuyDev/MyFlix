import 'package:shared_preferences/shared_preferences.dart';

SharedPreferences? _prefs;
const bool sharedWithWebsite = false;

Future<void> init() async => _prefs = await SharedPreferences.getInstance();
String? getRaw(String key) => _prefs?.getString('shared.$key');
void setRaw(String key, String value) => _prefs?.setString('shared.$key', value);
