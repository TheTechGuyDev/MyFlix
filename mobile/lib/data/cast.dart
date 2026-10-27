import 'dart:async';
import 'package:flutter/foundation.dart';

/// Casting session (Chromecast / smart TVs on the same Wi-Fi).
/// Demo: discovers sample devices. Production: Google Cast SDK / DIAL via a native plugin.
class CastStore extends ChangeNotifier {
  static final instance = CastStore._();
  CastStore._();

  static const devices = ['Living Room TV', 'Bedroom Chromecast', 'Samsung Smart TV (MyFlix app)'];

  String? device;
  String? titleId;
  String? label;
  bool playing = false;
  bool scanning = false;
  Duration position = Duration.zero;
  Timer? _clock;

  bool get connected => device != null;

  Future<void> scan() async {
    scanning = true;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 1200));
    scanning = false;
    notifyListeners();
  }

  void connect(String d) {
    device = d;
    notifyListeners();
  }

  void cast(String id, String text, {Duration from = Duration.zero}) {
    titleId = id;
    label = text;
    position = from;
    playing = true;
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
    playing = !playing;
    notifyListeners();
  }

  void disconnect() {
    _clock?.cancel();
    device = null;
    titleId = null;
    label = null;
    playing = false;
    notifyListeners();
  }
}
