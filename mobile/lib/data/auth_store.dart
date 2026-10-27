import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'catalog.dart';
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

  Future<void> requestPasswordReset(String email) => _wait();

  Future<void> choosePlan(String planId) async {
    await _wait(300);
    account?.planId = planId;
    await _persist();
  }

  Future<void> completePayment(String method, {String? last4}) async {
    await _wait(1500);
    final a = account;
    if (a == null) return;
    final now = DateTime.now();
    final renews = DateTime(now.year, now.month + 1, now.day);
    a.payment = Payment(method: method, last4: last4, paidAt: now.toIso8601String(), renewsAt: renews.toIso8601String());
    a.billing.insert(
      0,
      BillingRecord(
        id: 'INV-${now.millisecondsSinceEpoch.toString().substring(5)}',
        date: now.toIso8601String(),
        planId: a.planId ?? 'standard',
        method: method,
        last4: last4,
        amount: Catalog.plan(a.planId)?.price ?? 0,
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
}
