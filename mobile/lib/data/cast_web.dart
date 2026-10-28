import 'package:flutter/foundation.dart';

/// Browsers cast with their own Cast button in the video player, so the app's picker is off here.
class CastDevice {
  final String name;
  const CastDevice(this.name);
}

class CastStore extends ChangeNotifier {
  static final instance = CastStore._();
  CastStore._();
  static bool get supported => false;
  List<CastDevice> found = const [];
  String? device, titleId, label, error;
  bool playing = false, scanning = false;
  Duration position = Duration.zero;
  bool get connected => false;
  Future<void> scan() async {}
  Future<bool> connect(CastDevice d) async => false;
  void cast(String id, String text, {required String url, String? poster, Duration from = Duration.zero}) {}
  void toggle() {}
  Future<void> disconnect() async {}
}
