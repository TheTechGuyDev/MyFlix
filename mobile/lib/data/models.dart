class MediaTitle {
  final String id, title, image, type, maturity, synopsis, quality;
  final int year, match;
  final List<String> genres, cast, tags;
  final String? runtime, comingSoon;
  final int? seasons;
  final bool original, kids, isNew;

  MediaTitle.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        title = j['title'],
        image = j['image'],
        type = j['type'],
        maturity = j['maturity'],
        synopsis = j['synopsis'],
        quality = j['quality'] ?? 'HD',
        year = j['year'],
        match = j['match'] ?? 90,
        genres = List<String>.from(j['genres'] ?? const []),
        cast = List<String>.from(j['cast'] ?? const []),
        tags = List<String>.from(j['tags'] ?? const []),
        runtime = j['runtime'],
        comingSoon = j['comingSoon'],
        seasons = j['seasons'],
        original = j['original'] == true,
        kids = j['kids'] == true,
        isNew = j['isNew'] == true;

  bool get isSeries => type == 'series';
  String get meta => isSeries ? '$seasons Season${seasons == 1 ? '' : 's'}' : (runtime ?? '');
}

class Plan {
  final String id, name, resolution, quality, devices;
  final int price, screens, downloads;
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
        badge = j['badge'];
}

String naira(int n) {
  final s = n.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
  return '₦$s';
}

/// Unsplash image URL (same helper as the web app).
String img(String id, {int w = 600, int? h}) =>
    'https://images.unsplash.com/photo-$id?auto=format&fit=crop&w=$w${h != null ? '&h=$h' : ''}&q=70';

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

class Profile {
  final String id;
  String name;
  int avatar;
  bool kids;
  ProfileSettings settings;

  Profile({required this.id, required this.name, required this.avatar, this.kids = false, ProfileSettings? settings})
      : settings = settings ?? ProfileSettings(maturity: kids ? '7+' : '18+');

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
        id: j['id'],
        name: j['name'],
        avatar: j['avatar'] ?? 0,
        kids: j['kids'] == true,
        settings: ProfileSettings.fromJson(j['settings'], j['kids'] == true),
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'avatar': avatar, 'kids': kids, 'settings': settings.toJson()};
}

class Payment {
  final String method;
  final String? last4;
  final String paidAt, renewsAt;
  Payment({required this.method, this.last4, required this.paidAt, required this.renewsAt});
  factory Payment.fromJson(Map<String, dynamic> j) =>
      Payment(method: j['method'], last4: j['last4'], paidAt: j['paidAt'], renewsAt: j['renewsAt']);
  Map<String, dynamic> toJson() => {'method': method, if (last4 != null) 'last4': last4, 'paidAt': paidAt, 'renewsAt': renewsAt};
}

class BillingRecord {
  final String id, date, planId, method, status;
  final int amount;
  final String? last4;
  BillingRecord({required this.id, required this.date, required this.planId, required this.method, required this.amount, this.last4, this.status = 'Paid'});
  factory BillingRecord.fromJson(Map<String, dynamic> j) => BillingRecord(
      id: j['id'], date: j['date'], planId: j['planId'], method: j['method'], amount: j['amount'], last4: j['last4'], status: j['status'] ?? 'Paid');
  Map<String, dynamic> toJson() =>
      {'id': id, 'date': date, 'planId': planId, 'method': method, 'amount': amount, if (last4 != null) 'last4': last4, 'status': status};
}

class Account {
  String email, passwordHash;
  final String createdAt;
  String? planId, phone, cancelAt, billingCycle, promoLabel, referredBy;
  Payment? payment;
  List<BillingRecord> billing;
  List<Profile> profiles;
  Map<String, bool> notifications;

  Account({
    required this.email,
    required this.passwordHash,
    required this.createdAt,
    this.planId,
    this.phone,
    this.cancelAt,
    this.billingCycle,
    this.promoLabel,
    this.referredBy,
    this.payment,
    List<BillingRecord>? billing,
    List<Profile>? profiles,
    Map<String, bool>? notifications,
  })  : billing = billing ?? [],
        profiles = profiles ?? [],
        notifications = notifications ??
            {'newArrivals': true, 'reminders': true, 'recommendations': true, 'billing': true, 'offers': false, 'push': true};

  factory Account.fromJson(Map<String, dynamic> j) => Account(
        email: j['email'],
        passwordHash: j['passwordHash'],
        createdAt: j['createdAt'],
        planId: j['planId'],
        phone: j['phone'],
        cancelAt: j['cancelAt'],
        billingCycle: j['billingCycle'],
        promoLabel: j['promoLabel'],
        referredBy: j['referredBy'],
        payment: j['payment'] == null ? null : Payment.fromJson(Map<String, dynamic>.from(j['payment'])),
        billing: ((j['billing'] as List?) ?? []).map((e) => BillingRecord.fromJson(Map<String, dynamic>.from(e))).toList(),
        profiles: ((j['profiles'] as List?) ?? []).map((e) => Profile.fromJson(Map<String, dynamic>.from(e))).toList(),
        notifications: j['notifications'] == null ? null : Map<String, bool>.from(j['notifications']),
      );

  Map<String, dynamic> toJson() => {
        'email': email,
        'passwordHash': passwordHash,
        'createdAt': createdAt,
        if (planId != null) 'planId': planId,
        if (phone != null) 'phone': phone,
        if (cancelAt != null) 'cancelAt': cancelAt,
        if (billingCycle != null) 'billingCycle': billingCycle,
        if (promoLabel != null) 'promoLabel': promoLabel,
        if (referredBy != null) 'referredBy': referredBy,
        if (payment != null) 'payment': payment!.toJson(),
        'billing': billing.map((b) => b.toJson()).toList(),
        'profiles': profiles.map((p) => p.toJson()).toList(),
        'notifications': notifications,
      };
}
