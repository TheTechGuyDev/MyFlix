import 'package:shared_preferences/shared_preferences.dart';
import 'backend.dart';
import 'native.dart';

/// A notification from MyFlix (new releases, reminders, campaigns from the admin dashboard).
class AppNotice {
  final int id;
  final String head, body, at;
  final String? titleId, link;
  AppNotice({required this.id, required this.head, required this.body, required this.at, this.titleId, this.link});
}

class Notices {
  static Future<List<AppNotice>> fetch() async {
    if (!backendConfigured || sb.auth.currentSession == null) return [];
    try {
      final r = await sb.from('notifications').select('id, head, body, title_id, link, created_at').order('created_at', ascending: false).limit(30);
      return [
        for (final n in List<Map<String, dynamic>>.from(r))
          AppNotice(id: n['id'], head: n['head'], body: n['body'], at: n['created_at'], titleId: n['title_id'], link: n['link']),
      ];
    } catch (_) {
      return [];
    }
  }

  /// Shows new notifications as phone notifications (once each).
  static Future<void> deliverNew({bool enabled = true}) async {
    final list = await fetch();
    if (list.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getInt('myflix.noticeSeen') ?? 0;
    final top = list.map((n) => n.id).reduce((a, b) => a > b ? a : b);
    if (seen == 0) {
      await prefs.setInt('myflix.noticeSeen', top); // first run: don't replay old ones
      return;
    }
    if (enabled) {
      for (final n in list.where((n) => n.id > seen).take(2)) {
        await Native.notify(n.head, n.body);
      }
    }
    await prefs.setInt('myflix.noticeSeen', top);
  }
}

/* ---------------- Phone numbers ---------------- */
String normalPhone(String input) {
  var d = input.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('0') && d.length == 11) d = '234${d.substring(1)}';
  if (d.length == 10 && RegExp(r'^[789]').hasMatch(d)) d = '234$d';
  return RegExp(r'^234[789]\d{9}$').hasMatch(d) ? d : '';
}

String prettyPhone(String p) => p.startsWith('234') && p.length == 13 ? '+234 ${p.substring(3, 6)} ${p.substring(6, 9)} ${p.substring(9)}' : p;
bool isPhoneLike(String s) => RegExp(r'^[+\d][\d\s-]{6,}$').hasMatch(s.trim());
