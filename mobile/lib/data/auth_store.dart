import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'catalog.dart';
import 'messages.dart';
import 'models.dart';

/// Temporary on-device auth + account store (mirrors the web mock).
/// Swap the internals for Supabase later; the screens only use this API.
class AuthStore extends ChangeNotifier {
  static const _usersKey = 'myflix.users';
  static const _sessionKey = 'myflix.session';
  static const _profileKey = 'myflix.activeProfile';
  static const _onboardedKey = 'myflix.onboarded';
  static const maxProfiles = 5;

  late SharedPreferences _prefs;
  Map<String, Account> _users = {};
  String? _session;
  String? activeProfileId;
  bool onboarded = false;
  bool pendingAnnual = false;

  Account? get account => _session == null ? null : _users[_session];
  Profile? get activeProfile {
    final a = account;
    if (a == null) return null;
    for (final p in a.profiles) {
      if (p.id == activeProfileId) return p;
    }
    return null;
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs.getString(_usersKey);
    if (raw != null) {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      _users = m.map((k, v) => MapEntry(k, Account.fromJson(Map<String, dynamic>.from(v))));
    }
    _session = _prefs.getString(_sessionKey);
    activeProfileId = _prefs.getString(_profileKey);
    onboarded = _prefs.getBool(_onboardedKey) ?? false;
  }

  Future<void> _persist() async {
    await _prefs.setString(_usersKey, jsonEncode(_users.map((k, v) => MapEntry(k, v.toJson()))));
    if (_session == null) {
      await _prefs.remove(_sessionKey);
    } else {
      await _prefs.setString(_sessionKey, _session!);
    }
    if (activeProfileId == null) {
      await _prefs.remove(_profileKey);
    } else {
      await _prefs.setString(_profileKey, activeProfileId!);
    }
    notifyListeners();
  }

  Future<void> _wait([int ms = 600]) => Future.delayed(Duration(milliseconds: ms));
  String _hash(String s) => sha256.convert(utf8.encode(s)).toString();
  String _norm(String e) => e.trim().toLowerCase();
  static String newId() => List.generate(8, (_) => 'abcdefghijklmnopqrstuvwxyz0123456789'[Random().nextInt(36)]).join();

  /// Where a signed-in user should go next to finish setup.
  String nextStep() {
    final a = account;
    if (a == null) return '/signup';
    if (a.planId == null) return '/signup/plan';
    if (a.payment == null) return '/signup/payment';
    if (a.profiles.isEmpty) return '/signup/profiles';
    if (activeProfile == null) return '/profiles';
    return '/home';
  }

  Future<void> finishOnboarding() async {
    onboarded = true;
    await _prefs.setBool(_onboardedKey, true);
    notifyListeners();
  }

  bool emailExists(String email) => _users.containsKey(_norm(email));

  Future<String?> signUp(String email, String password) async {
    await _wait();
    final e = _norm(email);
    if (_users.containsKey(e)) return 'An account with this email already exists. Sign in instead.';
    _users[e] = Account(email: e, passwordHash: _hash(password), createdAt: DateTime.now().toIso8601String());
    _session = e;
    _msg.send(channel: 'email', kind: 'welcome', to: e, subject: 'Welcome to MyFlix', body: 'Your account is ready. Pick a plan to start watching Nollywood hits, series and more.');
    activeProfileId = null;
    await _persist();
    return null;
  }

  Future<String?> signIn(String email, String password) async {
    await _wait();
    final a = _users[_norm(email)];
    if (a == null) return "We can't find an account with this email address. Please try again or create a new account.";
    if (a.passwordHash != _hash(password)) return 'Incorrect password. Please try again or reset your password.';
    _session = a.email;
    activeProfileId = null;
    await _persist();
    return null;
  }

  Future<void> signOut() async {
    _session = null;
    activeProfileId = null;
    await _persist();
  }

  /* ---------------- Codes, reset links, phone ---------------- */
  final Map<String, ({String code, String email, DateTime exp, int tries})> _codes = {};
  final Map<String, ({String email, DateTime exp})> _resets = {};
  Messages get _msg => Messages.instance;

  Account? findAccount(String identifier) {
    if (isPhoneLike(identifier)) {
      final p = normalPhone(identifier);
      for (final a in _users.values) {
        if (a.phone != null && normalPhone(a.phone!) == p) return a;
      }
      return null;
    }
    return _users[_norm(identifier)];
  }

  String _issueCode(String key, String email) {
    final code = (100000 + Random().nextInt(900000)).toString();
    _codes[key] = (code: code, email: email, exp: DateTime.now().add(const Duration(minutes: 10)), tries: 0);
    return code;
  }

  String? _checkCode(String key, String code, void Function(String email) ok) {
    final c = _codes[key];
    if (c == null || c.exp.isBefore(DateTime.now())) return 'That code has expired. Request a new one.';
    if (c.tries >= 5) return 'Too many attempts. Request a new code.';
    if (c.code != code.trim()) {
      _codes[key] = (code: c.code, email: c.email, exp: c.exp, tries: c.tries + 1);
      return "That code isn't right. Check the message and try again.";
    }
    _codes.remove(key);
    ok(c.email);
    return null;
  }

  /// Sends a reset link by email, or by SMS when a phone number is given.
  Future<void> requestPasswordReset(String identifier) async {
    await _wait();
    final a = findAccount(identifier);
    if (a == null) return; // same response either way so accounts can't be discovered
    final token = newId() + newId();
    _resets[token] = (email: a.email, exp: DateTime.now().add(const Duration(hours: 1)));
    final sms = isPhoneLike(identifier);
    _msg.send(
      channel: sms ? 'sms' : 'email',
      kind: 'reset',
      to: sms ? prettyPhone(normalPhone(identifier)) : a.email,
      subject: sms ? 'MyFlix password reset' : 'Reset your MyFlix password',
      body: 'Use the link below to reset your password. It works for 1 hour. If this wasn\'t you, ignore this message.',
      link: '/reset?token=$token',
    );
  }

  String? resetEmail(String token) {
    final r = _resets[token];
    return r == null || r.exp.isBefore(DateTime.now()) ? null : r.email;
  }

  Future<String?> resetPassword(String token, String password) async {
    await _wait();
    final email = resetEmail(token);
    if (email == null || _users[email] == null) return 'This reset link has expired or was already used. Request a new one.';
    _resets.remove(token);
    _users[email]!.passwordHash = _hash(password);
    _session = email;
    activeProfileId = null;
    _msg.send(channel: 'email', kind: 'security', to: email, subject: 'Your MyFlix password was changed', body: "Your password was just reset. If you didn't do this, contact help@myflix.ng right away.");
    await _persist();
    return null;
  }

  /// "Use a sign-in code": 6-digit code by SMS (phone) or email. Returns (error, sentTo).
  Future<(String?, String?)> requestSignInCode(String identifier) async {
    await _wait();
    final a = findAccount(identifier);
    final sms = isPhoneLike(identifier);
    if (a == null) return (sms ? 'No account uses this phone number. Add your number in Account, Security first.' : "We can't find an account with this email address.", null);
    final key = sms ? normalPhone(identifier) : a.email;
    final code = _issueCode(key, a.email);
    final to = sms ? prettyPhone(key) : a.email;
    _msg.send(channel: sms ? 'sms' : 'email', kind: 'code', to: to, subject: 'Your MyFlix sign-in code', body: '$code is your MyFlix sign-in code. It expires in 10 minutes. Never share it with anyone.');
    return (null, to);
  }

  Future<String?> verifySignInCode(String identifier, String code) async {
    await _wait(400);
    final key = isPhoneLike(identifier) ? normalPhone(identifier) : _norm(identifier);
    String? email;
    final err = _checkCode(key, code, (e) => email = e);
    if (err != null) return err;
    _session = email;
    activeProfileId = null;
    await _persist();
    return null;
  }

  /// Step 1 of adding a phone: text a code to it. Returns (error, prettyNumber).
  Future<(String?, String?)> requestPhoneCode(String phone) async {
    await _wait(500);
    final a = account;
    final p = normalPhone(phone);
    if (a == null) return ('Your session has expired. Please sign in again.', null);
    if (p.isEmpty) return ('Enter a valid Nigerian phone number.', null);
    if (_users.values.any((u) => u.email != a.email && u.phone != null && normalPhone(u.phone!) == p)) return ('Another account already uses this number.', null);
    final code = _issueCode('verify:$p', a.email);
    _msg.send(channel: 'sms', kind: 'code', to: prettyPhone(p), subject: 'Verify your number', body: '$code is your MyFlix verification code.');
    return (null, prettyPhone(p));
  }

  Future<String?> confirmPhone(String phone, String code) async {
    await _wait(400);
    final p = normalPhone(phone);
    final err = _checkCode('verify:$p', code, (_) {});
    if (err != null) return err;
    account?.phone = p;
    await _persist();
    return null;
  }

  Future<void> choosePlan(String planId) async {
    await _wait(300);
    account?.planId = planId;
    await _persist();
  }

  Future<void> completePayment(String method, {String? last4, bool annual = false, int? amount, int freeMonths = 0, String? promoLabel}) async {
    await _wait(1500);
    final a = account;
    if (a == null) return;
    final now = DateTime.now();
    final renews = DateTime(now.year, now.month + (annual ? 12 : 1) + freeMonths, now.day);
    _msg.send(channel: 'email', kind: 'receipt', to: a.email, subject: 'Your MyFlix receipt', body: 'Thanks for your payment of ₦${amount ?? Catalog.plan(a.planId)?.price ?? 0}. Your membership is active.');
    a.billingCycle = annual ? 'annual' : 'monthly';
    a.promoLabel = promoLabel;
    a.payment = Payment(method: method, last4: last4, paidAt: now.toIso8601String(), renewsAt: renews.toIso8601String());
    a.billing.insert(
      0,
      BillingRecord(
        id: 'INV-${now.millisecondsSinceEpoch.toString().substring(5)}',
        date: now.toIso8601String(),
        planId: a.planId ?? 'standard',
        method: method,
        last4: last4,
        amount: amount ?? Catalog.plan(a.planId)?.price ?? 0,
      ),
    );
    await _persist();
  }

  Future<void> saveProfiles(List<Profile> profiles) async {
    await _wait(400);
    account?.profiles = profiles.take(maxProfiles).toList();
    if (account?.profiles.any((p) => p.id == activeProfileId) != true) activeProfileId = null;
    await _persist();
  }

  Future<void> updateProfile(Profile p) async {
    final a = account;
    if (a == null) return;
    a.profiles = a.profiles.map((x) => x.id == p.id ? p : x).toList();
    await _persist();
  }

  Future<void> selectProfile(String id) async {
    activeProfileId = id;
    await _persist();
  }

  Future<void> save() => _persist();

  /* ---------------- Account management ---------------- */
  Future<void> changePlan(String planId) async {
    await _wait(700);
    account?.planId = planId;
    await _persist();
  }

  Future<void> cancelMembership() async {
    await _wait(700);
    final a = account;
    if (a == null) return;
    a.cancelAt = a.payment?.renewsAt ?? DateTime.now().toIso8601String();
    await _persist();
  }

  Future<void> restartMembership() async {
    await _wait(700);
    account?.cancelAt = null;
    await _persist();
  }

  Future<void> updatePaymentMethod(String method, {String? last4}) async {
    await _wait(900);
    final p = account?.payment;
    if (p == null) return;
    account!.payment = Payment(method: method, last4: last4, paidAt: p.paidAt, renewsAt: p.renewsAt);
    await _persist();
  }

  Future<String?> changeEmail(String newEmail, String password) async {
    await _wait(700);
    final a = account;
    if (a == null) return 'Your session has expired. Please sign in again.';
    if (a.passwordHash != _hash(password)) return 'Incorrect password.';
    final e = _norm(newEmail);
    if (e != a.email && _users.containsKey(e)) return 'Another account already uses this email.';
    _users.remove(a.email);
    a.email = e;
    _users[e] = a;
    _session = e;
    await _persist();
    return null;
  }

  Future<String?> changePassword(String current, String next) async {
    await _wait(700);
    final a = account;
    if (a == null) return 'Your session has expired. Please sign in again.';
    if (a.passwordHash != _hash(current)) return 'Your current password is incorrect.';
    a.passwordHash = _hash(next);
    _msg.send(channel: 'email', kind: 'security', to: a.email, subject: 'Your MyFlix password was changed', body: 'Your password was changed from Account settings. If this wasn\'t you, reset it now.');
    await _persist();
    return null;
  }

  Future<void> updatePhone(String phone) async {
    await _wait(400);
    account?.phone = phone;
    await _persist();
  }

  Future<void> updateNotifications(Map<String, bool> n) async {
    account?.notifications = n;
    await _persist();
  }

  final List<Map<String, String>> _removedDevices = [];
  List<Map<String, String>> devices() {
    final now = DateTime.now();
    final all = [
      {'id': 'this', 'name': kIsWeb ? 'MyFlix web app' : 'This phone (MyFlix app)', 'location': 'Lagos, Nigeria', 'last': now.toIso8601String(), 'current': '1'},
      {'id': 'tv', 'name': 'Samsung Smart TV', 'location': 'Lagos, Nigeria', 'last': now.subtract(const Duration(days: 1)).toIso8601String()},
      {'id': 'web', 'name': 'Chrome on Windows', 'location': 'Ibadan, Nigeria', 'last': now.subtract(const Duration(days: 3)).toIso8601String()},
    ];
    return all.where((d) => !_removedDevices.any((r) => r['id'] == d['id'])).toList();
  }

  void removeDevice(String id) {
    _removedDevices.add({'id': id});
    notifyListeners();
  }
}
