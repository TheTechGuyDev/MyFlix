import 'dart:math';
import 'package:flutter/foundation.dart';
import 'native.dart';
import 'shared_store.dart';

/// One outgoing email, SMS or push notification.
class OutMsg {
  final String id, channel, kind, to, subject, body, at;
  final String? link;
  OutMsg({required this.id, required this.channel, required this.kind, required this.to, required this.subject, required this.body, required this.at, this.link});
  Map<String, dynamic> toJson() => {'id': id, 'channel': channel, 'kind': kind, 'to': to, 'subject': subject, 'body': body, 'at': at, if (link != null) 'link': link};
}

/// Sends emails/SMS/push. In the demo they go to the shared outbox (admin > Campaigns > Delivery log)
/// and appear in an on-screen "demo inbox" so codes and reset links can be used.
class Messages extends ChangeNotifier {
  static final instance = Messages._();
  Messages._();

  final List<OutMsg> inbox = [];

  OutMsg send({required String channel, required String kind, required String to, required String subject, required String body, String? link}) {
    final m = OutMsg(
      id: List.generate(8, (_) => 'abcdefghijklmnopqrstuvwxyz0123456789'[Random().nextInt(36)]).join(),
      channel: channel,
      kind: kind,
      to: to,
      subject: subject,
      body: body,
      link: link,
      at: DateTime.now().toUtc().toIso8601String(),
    );
    final list = SharedStore.read<List>('myflix.outbox', []);
    SharedStore.write('myflix.outbox', [m.toJson(), ...list].take(300).toList());
    if (channel == 'push') {
      Native.notify(subject, body);
      if (!kIsWeb) return m;
    }
    inbox.insert(0, m);
    if (inbox.length > 3) inbox.removeLast();
    notifyListeners();
    return m;
  }

  void dismiss(String id) {
    inbox.removeWhere((m) => m.id == id);
    notifyListeners();
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

/// Push notifications for admin campaigns this account hasn't seen yet (once per campaign).
void deliverCampaignPush(String email, {bool enabled = true}) {
  if (!enabled) return;
  final campaigns = SharedStore.read<List>('myflix.admin.campaigns', []);
  final seenKey = 'myflix.pushed.app.$email';
  final seen = SharedStore.read<List>(seenKey, []).cast<String>().toSet();
  final fresh = [
    for (final c in campaigns)
      if (c is Map && c['status'] == 'sent' && c['channel'] == 'push' && !seen.contains(c['id'])) c,
  ];
  for (final c in fresh.take(2)) {
    Messages.instance.send(channel: 'push', kind: 'campaign', to: email, subject: '${c['subject']}', body: '${c['body']}');
  }
  if (fresh.isNotEmpty) SharedStore.write(seenKey, [...seen, ...fresh.map((c) => c['id'])]);
}
