import 'dart:convert';
import 'package:flutter/services.dart';
import 'models.dart';

/// Mock catalogue (same data as the web app) until the admin dashboard + backend supply titles.
class Catalog {
  static late List<MediaTitle> titles;
  static late List<Plan> plans;
  static late List<String> streams;

  /// Progressive MP4 served from the MyFlix site: used for downloads and where HLS isn't supported.
  static const demoMp4 = 'https://thetechguydev.github.io/MyFlix/media/demo.mp4';

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

  static int indexOf(MediaTitle t) => titles.indexOf(t);

  static Plan? plan(String? id) {
    for (final p in plans) {
      if (p.id == id) return p;
    }
    return null;
  }

  static const _order = ['All', '7+', '13+', '16+', '18+'];
  static bool allowed(MediaTitle t, String max) => _order.indexOf(t.maturity) <= _order.indexOf(max);

  /// Titles a profile may see (released, kids-only for kids, within maturity).
  static List<MediaTitle> visible({required bool kids, required String max, bool includeComing = false}) => titles
      .where((t) => (includeComing || t.comingSoon == null) && (!kids || t.kids) && allowed(t, max))
      .toList();

  static List<String> sourcesFor(MediaTitle t) {
    final i = indexOf(t) % streams.length;
    return [...streams.sublist(i), ...streams.sublist(0, i), demoMp4];
  }

  static List<ContentRow> rows({required String filter, required bool kids, required String max}) {
    var pool = visible(kids: kids, max: max);
    if (filter == 'series') pool = pool.where((t) => t.isSeries).toList();
    if (filter == 'movies') pool = pool.where((t) => !t.isSeries).toList();
    List<MediaTitle> g(List<String> genres) => pool.where((t) => t.genres.any(genres.contains)).toList();
    final byMatch = [...pool]..sort((a, b) => b.match.compareTo(a.match));
    final label = filter == 'series' ? 'Series' : filter == 'movies' ? 'Movies' : '';

    if (kids) {
      return [
        ContentRow('Popular with Kids', byMatch),
        ContentRow('Family Movie Night', g(['Family'])),
        ContentRow("Kids' Shows", pool.where((t) => t.isSeries).toList()),
        ContentRow('Fun & Adventure', g(['Adventure', 'Comedy', 'Sports'])),
      ].where((r) => r.items.isNotEmpty).toList();
    }
    return [
      ContentRow(label.isEmpty ? 'Trending Now' : 'Trending $label', ([...pool]..sort((a, b) => b.year != a.year ? b.year.compareTo(a.year) : b.match.compareTo(a.match))).take(14).toList()),
      ContentRow('Top 10 ${label.isEmpty ? 'in Nigeria' : '$label in Nigeria'} Today', byMatch.take(10).toList(), ranked: true),
      ContentRow('Nollywood Hits', g(['Nollywood'])),
      ContentRow('Only on MyFlix', pool.where((t) => t.original).toList(), tall: true),
      ContentRow('New Releases', pool.where((t) => t.isNew).toList()),
      ContentRow('Crime & Thrillers', g(['Crime', 'Thriller', 'Suspense'])),
      ContentRow('Comedies to Lift Your Mood', g(['Comedy'])),
      ContentRow('Love Stories', g(['Romance'])),
      ContentRow('Family Favourites', g(['Family'])),
      ContentRow('Scary Nights', g(['Horror'])),
      ContentRow('Documentaries', g(['Documentary'])),
    ].where((r) => r.items.length >= 2).toList();
  }

  static MediaTitle featured({required String filter, required bool kids, required String max}) {
    final pool = visible(kids: kids, max: max);
    final pick = kids ? 'compound-kids' : filter == 'movies' ? 'third-mainland' : filter == 'series' ? 'queen-of-balogun' : 'eko-nights';
    for (final t in pool) {
      if (t.id == pick) return t;
    }
    final typed = pool.where((t) => filter == 'movies' ? !t.isSeries : filter == 'series' ? t.isSeries : true).toList()
      ..sort((a, b) => b.match.compareTo(a.match));
    return typed.isNotEmpty ? typed.first : (pool.isNotEmpty ? pool.first : titles.first);
  }

  static List<MediaTitle> search(String q, {required bool kids, required String max}) {
    final s = q.trim().toLowerCase();
    if (s.isEmpty) return [];
    return visible(kids: kids, max: max)
        .where((t) => [t.title, ...t.genres, ...t.cast, ...t.tags].any((x) => x.toLowerCase().contains(s)))
        .toList();
  }

  static List<MediaTitle> similar(MediaTitle t, {required bool kids, required String max}) =>
      visible(kids: kids, max: max).where((x) => x.id != t.id && x.genres.any(t.genres.contains)).take(12).toList();

  static List<MediaTitle> comingSoon({required bool kids, required String max}) =>
      titles.where((t) => t.comingSoon != null && (!kids || t.kids) && allowed(t, max)).toList();

  static List<Episode> episodes(MediaTitle t, int season) {
    final count = 6 + ((t.title.length + season) % 4);
    return List.generate(count, (i) {
      return Episode(
        season: season,
        number: i + 1,
        title: i == 0 ? 'Pilot' : 'Episode ${i + 1}',
        runtime: '${42 + ((i * 7 + season) % 15)}m',
        synopsis: i == 0 ? t.synopsis : 'The stakes rise for everyone in ${t.title} as old loyalties are tested and a new secret comes to light.',
      );
    });
  }
}

class ContentRow {
  final String title;
  final List<MediaTitle> items;
  final bool ranked, tall, progress;
  ContentRow(this.title, this.items, {this.ranked = false, this.tall = false, this.progress = false});
}

class Episode {
  final int season, number;
  final String title, runtime, synopsis;
  Episode({required this.season, required this.number, required this.title, required this.runtime, required this.synopsis});
}
