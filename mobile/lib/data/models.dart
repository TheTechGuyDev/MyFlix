/// Unsplash image id or full URL (artwork uploaded in the admin dashboard lives in Supabase Storage).
class Episode {
  final String id;
  final int season, number;
  final String title, runtime, synopsis;
  final bool hasVideo;
  final double? introStart, introEnd;
  Episode({this.id = '', required this.season, required this.number, required this.title, required this.runtime, required this.synopsis, this.hasVideo = false, this.introStart, this.introEnd});
}

class Subtitle {
  final String lang, label, url;
  const Subtitle(this.lang, this.label, this.url);
}

class MediaTitle {
  final String id, title, image, type, maturity, synopsis, quality;
  final String? backdrop;
  final int year, match;
  final List<String> genres, cast, tags, languages;
  final String? runtime, comingSoon;
  final int? seasons;
  final bool original, kids, isNew, sample, hasVideo;
  final List<Episode> episodes;
  final List<Subtitle> subtitles;
  final double? introStart, introEnd;
  final int views;

  MediaTitle.fromDb(Map<String, dynamic> r, List<Map<String, dynamic>> eps)
      : id = r['id'],
        title = r['title'],
        image = (r['image'] as String?) ?? '',
        backdrop = r['backdrop'],
        type = r['type'],
        maturity = r['maturity'] ?? '13+',
        synopsis = r['synopsis'] ?? '',
        quality = r['quality'] ?? 'HD',
        year = r['year'] ?? DateTime.now().year,
        match = r['match'] ?? 90,
        genres = List<String>.from(r['genres'] ?? const []),
        cast = List<String>.from(r['cast_list'] ?? const []),
        tags = List<String>.from(r['tags'] ?? const []),
        languages = List<String>.from(r['languages'] ?? const []),
        runtime = r['runtime'],
        comingSoon = _coming(r),
        seasons = r['type'] == 'series' ? (r['seasons'] ?? (eps.map((e) => e['season']).toSet().length.clamp(1, 99))) : null,
        original = r['original'] == true,
        kids = r['kids'] == true,
        isNew = r['is_new'] == true,
        sample = r['sample'] == true,
        hasVideo = r['sample'] == true || (r['video'] is Map && r['video']['status'] == 'ready') || eps.any((e) => e['video'] is Map && e['video']['status'] == 'ready'),
        episodes = [
          for (final e in eps)
            Episode(
              id: '${e['id']}',
              season: e['season'] ?? 1,
              number: e['number'] ?? 1,
              title: e['title'] ?? '',
              runtime: e['runtime'] ?? '',
              synopsis: e['synopsis'] ?? '',
              hasVideo: r['sample'] == true || (e['video'] is Map && e['video']['status'] == 'ready'),
              introStart: (e['intro_start'] as num?)?.toDouble(),
              introEnd: (e['intro_end'] as num?)?.toDouble(),
            ),
        ]..sort((a, b) => a.season != b.season ? a.season.compareTo(b.season) : a.number.compareTo(b.number)),
        subtitles = [
          for (final x in (r['subtitles'] as List? ?? const []))
            if (x is Map && x['url'] != null) Subtitle('${x['lang']}', '${x['label']}', '${x['url']}'),
        ],
        introStart = (r['intro_start'] as num?)?.toDouble(),
        introEnd = (r['intro_end'] as num?)?.toDouble(),
        views = r['views'] ?? 0;

  static String? _coming(Map<String, dynamic> r) {
    final rel = r['release_at'] == null ? null : DateTime.tryParse(r['release_at']);
    final future = rel != null && rel.isAfter(DateTime.now());
    if (r['status'] != 'scheduled' && !future) return null;
    if (rel == null) return 'Soon';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final l = rel.toLocal();
    return '${days[l.weekday - 1]} ${l.day} ${months[l.month - 1]}';
  }

  bool get isSeries => type == 'series';
  String get meta => isSeries ? '$seasons Season${seasons == 1 ? '' : 's'}' : (runtime ?? '');
  List<int> get seasonNumbers => episodes.map((e) => e.season).toSet().toList()..sort();
}

class Plan {
  final String id, name, resolution, quality, devices;
  final int price, screens, downloads, annualDiscount, maxHeight;
  final String? badge;
  Plan.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        resolution = j['resolution'],
        quality = j['quality'],
        devices = j['devices'],
        price = j['price'],
        screens = j['screens'],
        downloads = j['downloads'],
        annualDiscount = j['annual_discount'] ?? 15,
        maxHeight = j['max_height'] ?? 1080,
        badge = j['badge'];
}

String naira(int n) {
  final s = n.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
  return '₦$s';
}

/// Artwork URL: uploaded images are full URLs; older stock images are Unsplash ids.
String img(String id, {int w = 600, int? h}) {
  if (id.isEmpty) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=$w&q=60';
  if (id.startsWith('http')) return id;
  return 'https://images.unsplash.com/photo-$id?auto=format&fit=crop&w=$w${h != null ? '&h=$h' : ''}&q=70';
}

class ProfileSettings {
  String language, maturity, dataUsage, subtitleSize, subtitleBg;
  String? pin;
  bool autoplayNext, autoplayPreviews, downloadOnWifiOnly;
  String downloadQuality;
  int? dailyLimitMinutes;
  int? monthlyDataCapGB;

  ProfileSettings({
    this.language = 'English',
    this.maturity = '18+',
    this.dataUsage = 'auto',
    this.subtitleSize = 'medium',
    this.subtitleBg = 'shadow',
    this.pin,
    this.autoplayNext = true,
    this.autoplayPreviews = true,
    this.downloadOnWifiOnly = true,
    this.downloadQuality = 'standard',
    this.dailyLimitMinutes,
    this.monthlyDataCapGB,
  });

  factory ProfileSettings.fromJson(Map<String, dynamic>? j, bool kids) {
    final s = ProfileSettings(maturity: kids ? '7+' : '18+');
    if (j == null) return s;
    s.language = j['language'] ?? s.language;
    s.maturity = j['maturity'] ?? s.maturity;
    s.dataUsage = j['dataUsage'] ?? s.dataUsage;
    s.subtitleSize = j['subtitleSize'] ?? s.subtitleSize;
    s.subtitleBg = j['subtitleBg'] ?? s.subtitleBg;
    s.pin = j['pin'];
    s.autoplayNext = j['autoplayNext'] ?? true;
    s.autoplayPreviews = j['autoplayPreviews'] ?? true;
    s.downloadOnWifiOnly = j['downloadOnWifiOnly'] ?? true;
    s.downloadQuality = j['downloadQuality'] ?? 'standard';
    s.dailyLimitMinutes = j['dailyLimitMinutes'];
    s.monthlyDataCapGB = j['monthlyDataCapGB'];
    return s;
  }

  Map<String, dynamic> toJson() => {
        'language': language,
        'maturity': maturity,
        'dataUsage': dataUsage,
        'subtitleSize': subtitleSize,
        'subtitleBg': subtitleBg,
        if (pin != null) 'pin': pin,
        'autoplayNext': autoplayNext,
        'autoplayPreviews': autoplayPreviews,
        'downloadOnWifiOnly': downloadOnWifiOnly,
        'downloadQuality': downloadQuality,
        if (dailyLimitMinutes != null) 'dailyLimitMinutes': dailyLimitMinutes,
        if (monthlyDataCapGB != null) 'monthlyDataCapGB': monthlyDataCapGB,
      };
}

/// Stands in for a PIN that is set on the server (the real PIN is never sent to the app).
const pinSet = '••••';

class Profile {
  final String id;
  String name;
  int avatar;
  bool kids;
  ProfileSettings settings;

  Profile({required this.id, required this.name, required this.avatar, this.kids = false, ProfileSettings? settings})
      : settings = settings ?? ProfileSettings(maturity: kids ? '7+' : '18+');

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
        id: '${j['id']}',
        name: j['name'],
        avatar: j['avatar'] ?? 0,
        kids: j['kids'] == true,
        settings: ProfileSettings.fromJson(j['settings'] == null ? null : Map<String, dynamic>.from(j['settings']), j['kids'] == true)..pin = j['has_pin'] == true ? pinSet : null,
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'avatar': avatar, 'kids': kids, 'settings': settings.toJson()};
}

class BillingRecord {
  final String id, date, planId, method, status;
  final int amount;
  final String? last4;
  BillingRecord({required this.id, required this.date, required this.planId, required this.method, required this.amount, this.last4, this.status = 'Paid'});
}

class Device {
  final String id, name, kind, lastSeen;
  final String? location;
  final bool current;
  Device({required this.id, required this.name, required this.kind, required this.lastSeen, this.location, this.current = false});
}

/// The signed-in member, as loaded from the database.
class Account {
  final String id, email, createdAt, status, billingCycle;
  final String? planId, pendingPlanId, phone, paidUntil, cancelAt, referralCode, referredBy, promoLabel;
  final int credit;
  final Map<String, bool> notifications;
  final List<Profile> profiles;
  final List<BillingRecord> billing;
  final String? cardLast4, cardType;
  final bool cardReusable;

  Account({
    required this.id,
    required this.email,
    required this.createdAt,
    required this.status,
    this.billingCycle = 'monthly',
    this.planId,
    this.pendingPlanId,
    this.phone,
    this.paidUntil,
    this.cancelAt,
    this.referralCode,
    this.referredBy,
    this.promoLabel,
    this.credit = 0,
    Map<String, bool>? notifications,
    List<Profile>? profiles,
    List<BillingRecord>? billing,
    this.cardLast4,
    this.cardType,
    this.cardReusable = false,
  })  : notifications = notifications ?? {'newArrivals': true, 'reminders': true, 'recommendations': true, 'billing': true, 'offers': false, 'push': true},
        profiles = profiles ?? [],
        billing = billing ?? [];

  bool get suspended => status == 'suspended';
  bool get hasAccess => const ['active', 'cancelled', 'past_due'].contains(status) && paidUntil != null && DateTime.parse(paidUntil!).isAfter(DateTime.now());

  /// Payment summary for the Account screen (null until the first payment).
  Payment? get payment {
    if (!hasAccess) return null;
    final last = billing.where((b) => b.status == 'Paid').firstOrNull;
    return Payment(method: last?.method ?? 'card', last4: cardLast4 ?? last?.last4, paidAt: last?.date ?? createdAt, renewsAt: paidUntil!);
  }
}

class Payment {
  final String method;
  final String? last4;
  final String paidAt, renewsAt;
  Payment({required this.method, this.last4, required this.paidAt, required this.renewsAt});
}
