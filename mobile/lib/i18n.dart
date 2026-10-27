import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import 'data/auth_store.dart';
import 'i18n_data.dart';

/// Display languages: English, Yorùbá, Hausa, Igbo and Nigerian Pidgin (per profile).
String langCode(String? name) {
  final n = (name ?? '').toLowerCase();
  if (n.startsWith('yor')) return 'yo';
  if (n.startsWith('hau')) return 'ha';
  if (n.startsWith('igb')) return 'ig';
  if (n.startsWith('pid') || n == 'naija') return 'pcm';
  return 'en';
}

final _patterns = <String, List<(RegExp, String)>>{};

String translate(String lang, String s, [Object? arg]) {
  String fill(String x) => arg == null ? x : x.replaceAll('{0}', '$arg');
  final d = kDicts[lang];
  if (d == null) return fill(s);
  final hit = d[s];
  if (hit != null) return fill(hit);
  final pats = _patterns.putIfAbsent(lang, () => [
        for (final k in d.keys.where((k) => k.contains('{0}')))
          (RegExp('^${RegExp.escape(k).replaceAll(RegExp.escape('{0}'), '(.+)').replaceAll(r'\{0\}', '(.+)')}\$'), d[k]!),
      ]);
  for (final (re, v) in pats) {
    final m = re.firstMatch(s);
    if (m != null) return v.replaceAll('{0}', m.group(1)!);
  }
  return fill(s);
}

extension Tr on BuildContext {
  /// Translate a UI string into the active profile's language. Use inside build methods.
  String tr(String s, [Object? arg]) {
    final lang = select<AuthStore, String>((a) => langCode(a.activeProfile?.settings.language));
    return translate(lang, s, arg);
  }
}
