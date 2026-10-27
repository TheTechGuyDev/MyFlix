import 'shared_store.dart';

/// Approves a code shown on MyFlix for TV. In the web preview this pairs the real /tv page;
/// on phones it is recorded for when the backend connects.
class TvLink {
  static String? approve(String code, String email) {
    final c = code.replaceAll(RegExp(r'\D'), '');
    if (c.length != 8) return 'Enter the 8 digits shown on your TV.';
    if (SharedStore.sharedWithWebsite) {
      final pending = Map<String, dynamic>.from(SharedStore.read<Map>('myflix.tv.pending', {}));
      final p = pending[c] as Map?;
      if (p == null || (p['exp'] as num) < DateTime.now().millisecondsSinceEpoch) {
        return "That code isn't valid or has expired. Check the code on your TV.";
      }
      if (p['paired'] != null) return 'This code was already used. Ask the TV for a new one.';
      pending[c] = {...Map<String, dynamic>.from(p), 'paired': {'email': email, 'at': DateTime.now().toUtc().toIso8601String(), 'via': 'app'}};
      SharedStore.write('myflix.tv.pending', pending);
    }
    final links = SharedStore.read<List>('myflix.tv.links', []);
    SharedStore.write('myflix.tv.links', [...links, {'code': c, 'email': email}]);
    return null;
  }
}
