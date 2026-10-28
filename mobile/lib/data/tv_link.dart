import 'backend.dart';

/// Approves a code shown on MyFlix for TV, signing the TV in to this account.
class TvLink {
  static Future<String?> approve(String code) async {
    final c = code.replaceAll(RegExp(r'\D'), '');
    if (c.length != 8) return 'Enter the 8 digits shown on your TV.';
    try {
      await fn('tv', {'action': 'approve', 'code': c});
      return null;
    } catch (e) {
      return friendly(e);
    }
  }
}
