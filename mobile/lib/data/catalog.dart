import 'backend.dart';
import 'models.dart';

export 'models.dart' show Episode;

/// Titles, plans and platform settings, loaded from Supabase at start-up and refreshed on resume.
class Catalog {
  static List<MediaTitle> titles = [];
  static List<Plan> plans = [];
  static Map<String, dynamic> settings = {};
  static Map<String, dynamic>? curation;
  static bool loaded = false;
  static String? error;

  static Future<void> load() async {
    if (!backendConfigured) {
      error = 'not-configured';
      return;
    }
    try {
      final r = await Future.wait([
        sb.from('titles').select(),
        sb.from('episodes').select().order('season').order('number'),
        sb.from('plans').select().eq('active', true).order('sort'),
        sb.from('site_settings').select('data').eq('id', 1).maybeSingle(),
        sb.from('curation').select('data').eq('id', 1).maybeSingle(),
      ]);
      final rows = List<Map<String, dynamic>>.from(r[0] as List);
      final eps = List<Map<String, dynamic>>.from(r[1] as List);
      final now = DateTime.now();
      titles = [
        for (final t in rows)
          if ((t['status'] == 'published' || t['status'] == 'scheduled') && (t['expires_at'] == null || DateTime.parse(t['expires_at']).isAfter(now)))
            MediaTitle.fromDb(t, eps.where((e) => e['title_id'] == t['id']).toList()),
      ];
      plans = [for (final p in List<Map<String, dynamic>>.from(r[2] as List)) Plan.fromJson(p)];
      settings = Map<String, dynamic>.from((r[3] as Map?)?['data'] ?? {});
      curation = (r[4] as Map?)?['data'] == null ? null : Map<String, dynamic>.from((r[4] as Map)['data']);
      loaded = true;
      error = null;
    } catch (e) {
      error = friendly(e);
    }
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
    // Rows and Top 10 chosen in the admin dashboard's Home Curation come first on the home tab
    final curated = <ContentRow>[];
    if (filter == 'all' || filter == '') {
      final top = [for (final id in List<String>.from(curation?['top10'] ?? const [])) ...pool.where((t) => t.id == id)];
      if (top.length >= 3) curated.add(ContentRow('Top 10 in Nigeria Today', top, ranked: true));
      for (final r in List.from(curation?['rows'] ?? const [])) {
        if (r is! Map || r['enabled'] == false) continue;
        final items = [for (final id in List<String>.from(r['titleIds'] ?? const [])) ...pool.where((t) => t.id == id)];
        if (items.length >= 2) curated.add(ContentRow('${r['title']}', items));
      }
    }
    return [
      ...curated,
      ContentRow(label.isEmpty ? 'Trending Now' : 'Trending $label', ([...pool]..sort((a, b) => b.year != a.year ? b.year.compareTo(a.year) : b.match.compareTo(a.match))).take(14).toList()),
      if (curated.every((r) => !r.ranked)) ContentRow('Top 10 ${label.isEmpty ? 'in Nigeria' : '$label in Nigeria'} Today', ([...pool]..sort((a, b) => b.views != a.views ? b.views.compareTo(a.views) : b.match.compareTo(a.match))).take(10).toList(), ranked: true),
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

  /// Hero title: the one picked in Home Curation, else the best match that can be played.
  static MediaTitle? featured({required String filter, required bool kids, required String max}) {
    final pool = visible(kids: kids, max: max);
    if (pool.isEmpty) return null;
    final key = kids ? 'heroKids' : filter == 'movies' ? 'heroMovies' : filter == 'series' ? 'heroSeries' : 'heroHome';
    final pick = curation?[key];
    for (final t in pool) {
      if (t.id == pick && (filter == 'movies' ? !t.isSeries : filter == 'series' ? t.isSeries : true)) return t;
    }
    final typed = pool.where((t) => filter == 'movies' ? !t.isSeries : filter == 'series' ? t.isSeries : true).toList()
      ..sort((a, b) => (b.hasVideo ? 1 : 0) - (a.hasVideo ? 1 : 0) != 0 ? (b.hasVideo ? 1 : 0) - (a.hasVideo ? 1 : 0) : b.match.compareTo(a.match));
    return typed.isNotEmpty ? typed.first : pool.first;
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

  static List<Episode> episodes(MediaTitle t, int season) => t.episodes.where((e) => e.season == season).toList();
}

int annualPrice(Plan p) => (p.price * 12 * (100 - p.annualDiscount) / 100).round();

class ContentRow {
  final String title;
  final List<MediaTitle> items;
  final bool ranked, tall, progress;
  ContentRow(this.title, this.items, {this.ranked = false, this.tall = false, this.progress = false});
}
