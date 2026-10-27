import 'dart:convert';
import 'package:flutter/services.dart';
import 'models.dart';

/// Mock catalogue (same data as the web app) until the admin dashboard + backend supply titles.
class Catalog {
  static late List<MediaTitle> titles;
  static late List<Plan> plans;
  static late List<String> streams;

  static Future<void> load() async {
    final raw = jsonDecode(await rootBundle.loadString('assets/data/catalog.json')) as Map<String, dynamic>;
    titles = (raw['titles'] as List).map((e) => MediaTitle.fromJson(Map<String, dynamic>.from(e))).toList();
    plans = (raw['plans'] as List).map((e) => Plan.fromJson(Map<String, dynamic>.from(e))).toList();
    streams = List<String>.from(raw['streams']);
  }

  static MediaTitle? byId(String id) {
    for (final t in titles) {
      if (t.id == id) return t;
    }
    return null;
  }

  static Plan? plan(String? id) {
    for (final p in plans) {
      if (p.id == id) return p;
    }
    return null;
  }

  static const _order = ['All', '7+', '13+', '16+', '18+'];
  static bool allowed(MediaTitle t, String max) => _order.indexOf(t.maturity) <= _order.indexOf(max);
}
