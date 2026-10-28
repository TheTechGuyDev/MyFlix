import 'package:flutter_test/flutter_test.dart';
import 'package:myflix/data/backend.dart';
import 'package:myflix/data/catalog.dart';
import 'package:myflix/data/messages.dart';
import 'package:myflix/data/models.dart';

Map<String, dynamic> title(String id, {String type = 'movie', String status = 'published', String? releaseAt, Map? video, bool sample = false, List<String> genres = const ['Drama'], bool kids = false, String maturity = '13+'}) => {
      'id': id,
      'title': id.toUpperCase(),
      'type': type,
      'status': status,
      'release_at': releaseAt,
      'video': video,
      'sample': sample,
      'genres': genres,
      'kids': kids,
      'maturity': maturity,
      'year': 2026,
    };

void main() {
  group('Nigerian phone numbers', () {
    test('normalises local and international formats', () {
      expect(normalPhone('0803 123 4567'), '2348031234567');
      expect(normalPhone('+234 803 123 4567'), '2348031234567');
      expect(normalPhone('8031234567'), '2348031234567');
      expect(normalPhone('12345'), '');
    });
    test('pretty prints', () => expect(prettyPhone('2348031234567'), '+234 803 123 4567'));
    test('detects phone-like input', () {
      expect(isPhoneLike('0803 123 4567'), isTrue);
      expect(isPhoneLike('ada@example.com'), isFalse);
    });
  });

  group('Titles from the database', () {
    test('hasVideo only when a Mux video is ready, or a sample', () {
      expect(MediaTitle.fromDb(title('a', video: {'status': 'ready'}), []).hasVideo, isTrue);
      expect(MediaTitle.fromDb(title('b', video: {'status': 'processing'}), []).hasVideo, isFalse);
      expect(MediaTitle.fromDb(title('c', sample: true), []).hasVideo, isTrue);
    });
    test('series take seasons and episodes from episode rows', () {
      final t = MediaTitle.fromDb(title('s', type: 'series'), [
        {'id': 'e2', 'season': 1, 'number': 2, 'title': 'Two', 'video': {'status': 'ready'}},
        {'id': 'e1', 'season': 1, 'number': 1, 'title': 'One'},
        {'id': 'e3', 'season': 2, 'number': 1, 'title': 'Three'},
      ]);
      expect(t.seasonNumbers, [1, 2]);
      expect(Catalog.episodes(t, 1).map((e) => e.title), ['One', 'Two']);
      expect(t.hasVideo, isTrue);
    });
    test('future release shows as coming soon', () {
      final next = DateTime.now().add(const Duration(days: 3)).toIso8601String();
      expect(MediaTitle.fromDb(title('f', status: 'scheduled', releaseAt: next), []).comingSoon, isNotNull);
      expect(MediaTitle.fromDb(title('g'), []).comingSoon, isNull);
    });
  });

  group('Catalogue rules', () {
    setUp(() {
      Catalog.titles = [
        MediaTitle.fromDb(title('kid', kids: true, maturity: 'All', genres: ['Family']), []),
        MediaTitle.fromDb(title('adult', maturity: '18+', genres: ['Thriller']), []),
        MediaTitle.fromDb(title('teen', maturity: '13+', genres: ['Thriller']), []),
      ];
      Catalog.curation = {'heroHome': 'teen', 'rows': [{'title': 'Staff picks', 'titleIds': ['teen', 'adult'], 'enabled': true}]};
    });
    test('maturity limits hide titles', () {
      expect(Catalog.visible(kids: false, max: '13+').map((t) => t.id), containsAll(['kid', 'teen']));
      expect(Catalog.visible(kids: false, max: '13+').map((t) => t.id), isNot(contains('adult')));
      expect(Catalog.visible(kids: true, max: '18+').map((t) => t.id), ['kid']);
    });
    test('hero and rows follow Home Curation', () {
      expect(Catalog.featured(filter: 'all', kids: false, max: '18+')?.id, 'teen');
      expect(Catalog.rows(filter: 'all', kids: false, max: '18+').first.title, 'Staff picks');
    });
    test('empty catalogue has no hero (no crash)', () {
      Catalog.titles = [];
      expect(Catalog.featured(filter: 'all', kids: false, max: '18+'), isNull);
    });
  });

  group('Membership', () {
    Account acc(String status, Duration until) => Account(id: 'x', email: 'a@b.ng', createdAt: '2026-01-01', status: status, paidUntil: DateTime.now().add(until).toIso8601String());
    test('access needs a paid-up period', () {
      expect(acc('active', const Duration(days: 3)).hasAccess, isTrue);
      expect(acc('cancelled', const Duration(days: 3)).hasAccess, isTrue);
      expect(acc('active', const Duration(days: -1)).hasAccess, isFalse);
      expect(acc('suspended', const Duration(days: 3)).hasAccess, isFalse);
      expect(acc('pending', const Duration(days: 3)).hasAccess, isFalse);
    });
    test('annual price uses the plan discount', () {
      final p = Plan.fromJson({'id': 'basic', 'name': 'Basic', 'resolution': '720p', 'quality': 'Good', 'devices': 'All', 'price': 2500, 'screens': 1, 'downloads': 1, 'annual_discount': 20});
      expect(annualPrice(p), 24000);
    });
  });

  group('Helpers', () {
    test('artwork accepts uploaded URLs and stock ids', () {
      expect(img('https://x.supabase.co/storage/v1/object/public/artwork/a.jpg'), startsWith('https://x.supabase.co'));
      expect(img('123-abc'), contains('images.unsplash.com/photo-123-abc'));
    });
    test('friendly error messages', () {
      expect(friendly(Exception('Invalid login credentials')), contains('Incorrect email or password'));
      expect(friendly(Exception('SocketException: Failed host lookup')), contains('No internet'));
    });
  });
}
