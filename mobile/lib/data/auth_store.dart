import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'backend.dart';
import 'catalog.dart';
import 'messages.dart';
import 'models.dart';

typedef Quote = ({bool ok, int base, int discount, int creditUsed, int freeMonths, int amount, int months, String? promoLabel, String? promoError, String? error});

/// The signed-in member on Supabase: sign-up/in, codes, password reset, plans, Paystack payments,
/// profiles, devices and privacy (export/delete). Screens listen to it with Provider.
class AuthStore extends ChangeNotifier {
  static const _profileKey = 'myflix.activeProfile';
  static const _onboardedKey = 'myflix.onboarded';
  static const _deviceKey = 'myflix.deviceId';
  static const _pendingPayKey = 'myflix.pendingPayment';
  static const maxProfiles = 5;

  late SharedPreferences _prefs;
  Account? account;
  List<Device> devicesList = [];
  String? activeProfileId;
  bool onboarded = false;
  bool pendingAnnual = false;
  bool ready = false;
  String? notice; // e.g. "signed out remotely"
  StreamSubscription<AuthState>? _sub;

  Profile? get activeProfile {
    final a = account;
    if (a == null) return null;
    for (final p in a.profiles) {
      if (p.id == activeProfileId) return p;
    }
    return null;
  }

  /// Temporary id for something not yet saved (e.g. a new profile); the database assigns the real one.
  static String newId() => List.generate(10, (_) => 'abcdefghijklmnopqrstuvwxyz0123456789'[Random().nextInt(36)]).join();

  String get deviceId {
    var id = _prefs.getString(_deviceKey);
    if (id == null) {
      id = '${kIsWeb ? 'web' : 'app'}-${List.generate(20, (_) => 'abcdefghijklmnopqrstuvwxyz0123456789'[Random.secure().nextInt(36)]).join()}';
      _prefs.setString(_deviceKey, id);
    }
    return id;
  }

  String get _deviceKind => kIsWeb ? 'web' : defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
  String get _deviceName => kIsWeb ? 'MyFlix app (browser)' : defaultTargetPlatform == TargetPlatform.iOS ? 'MyFlix app on iPhone' : 'MyFlix app on Android';

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    activeProfileId = _prefs.getString(_profileKey);
    onboarded = _prefs.getBool(_onboardedKey) ?? false;
    if (!backendConfigured) {
      ready = true;
      return;
    }
    await refresh();
    _sub = sb.auth.onAuthStateChange.listen((s) {
      if (s.event == AuthChangeEvent.signedIn || s.event == AuthChangeEvent.signedOut || s.event == AuthChangeEvent.userUpdated) refresh();
    });
    ready = true;
    notifyListeners();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  /// Reloads the account, profiles, billing and devices from the database.
  Future<void> refresh() async {
    final session = sb.auth.currentSession;
    if (session == null) {
      account = null;
      devicesList = [];
      notifyListeners();
      return;
    }
    try {
      final uid = session.user.id;
      final r = await Future.wait([
        sb.from('accounts').select().eq('id', uid).maybeSingle(),
        sb.from('viewer_profiles').select('id, name, avatar, kids, settings, has_pin, sort').eq('account_id', uid).order('sort').order('created_at'),
        sb.rpc('my_billing'),
        sb.from('devices').select().eq('account_id', uid).isFilter('revoked_at', null).order('last_seen', ascending: false),
      ]);
      final a = r[0] as Map<String, dynamic>?;
      if (a == null) {
        account = null;
        notifyListeners();
        return;
      }
      final billing = Map<String, dynamic>.from((r[2] as Map?) ?? {});
      final method = billing['method'] == null ? null : Map<String, dynamic>.from(billing['method']);
      final me = deviceId;
      account = Account(
        id: a['id'],
        email: a['email'] ?? '',
        createdAt: a['created_at'],
        status: a['status'],
        billingCycle: a['billing_cycle'] ?? 'monthly',
        planId: a['plan_id'] ?? a['pending_plan_id'],
        pendingPlanId: a['pending_plan_id'],
        phone: a['phone'],
        paidUntil: a['paid_until'],
        cancelAt: a['cancel_at'],
        referralCode: a['referral_code'],
        referredBy: a['referred_by'],
        promoLabel: (a['promo'] as Map?)?['label'],
        credit: a['credit'] ?? 0,
        notifications: {
          'newArrivals': true, 'reminders': true, 'recommendations': true, 'billing': true, 'offers': false, 'push': true,
          ...Map<String, bool>.from((a['notifications'] as Map?)?.map((k, v) => MapEntry('$k', v == true)) ?? {}),
        },
        profiles: [for (final p in List<Map<String, dynamic>>.from(r[1] as List)) Profile.fromJson(p)],
        billing: [
          for (final p in List<Map<String, dynamic>>.from(billing['payments'] ?? const []))
            BillingRecord(
              id: p['reference'],
              date: p['paid_at'] ?? p['created_at'],
              planId: p['plan_id'] ?? '',
              method: p['channel'] == 'bank_transfer' ? 'transfer' : (p['channel'] ?? 'card'),
              amount: p['amount'] ?? 0,
              last4: p['last4'],
              status: p['status'] == 'refunded' ? 'Refunded' : 'Paid',
            ),
        ],
        cardLast4: method?['last4'],
        cardType: method?['card_type'],
        cardReusable: method?['reusable'] == true,
      );
      devicesList = [
        for (final d in List<Map<String, dynamic>>.from(r[3] as List))
          Device(id: d['id'], name: d['name'], kind: d['kind'], lastSeen: d['last_seen'], location: d['location'], current: d['id'] == me),
      ];
      if (account!.profiles.every((p) => p.id != activeProfileId)) activeProfileId = null;
    } catch (e) {
      debugPrint('refresh failed: $e');
    }
    notifyListeners();
  }

  /// Registers this device; returns false if it was signed out remotely (Account > Devices or admin).
  Future<bool> touchDevice() async {
    if (sb.auth.currentSession == null) return true;
    try {
      final ok = await sb.rpc('touch_device', params: {'p_id': deviceId, 'p_name': _deviceName, 'p_kind': _deviceKind});
      if (ok == false) {
        notice = 'You were signed out of this device from another device.';
        await signOut();
        return false;
      }
    } catch (_) {}
    return true;
  }

  /// Where a signed-in member should go next to finish setup.
  String nextStep() {
    final a = account;
    if (a == null) return '/signup';
    if (a.planId == null) return '/signup/plan';
    if (!a.hasAccess) return '/signup/payment';
    if (a.profiles.isEmpty) return '/signup/profiles';
    if (activeProfile == null) return '/profiles';
    return '/home';
  }

  Future<void> finishOnboarding() async {
    onboarded = true;
    await _prefs.setBool(_onboardedKey, true);
    notifyListeners();
  }

  Future<String?> _guard(Future<void> Function() run) async {
    try {
      await run();
      return null;
    } catch (e) {
      return friendly(e);
    }
  }

  String _norm(String e) => e.trim().toLowerCase();

  /* ---------------- Sign up / sign in ---------------- */

  /// Creates the account. Returns (error, needsCode): when needsCode, the member enters the code we emailed.
  Future<(String?, bool)> signUp(String email, String password, {String? ref}) async {
    try {
      final r = await sb.auth.signUp(email: _norm(email), password: password, data: ref == null ? null : {'ref': ref}, emailRedirectTo: '$siteUrl/auth/confirm/');
      if (r.user != null && (r.user!.identities ?? []).isEmpty) return ('An account with this email already exists. Sign in instead.', false);
      if (r.session != null) {
        await refresh();
        await touchDevice();
      }
      return (null, r.session == null);
    } catch (e) {
      return (friendly(e), false);
    }
  }

  Future<String?> verifySignupCode(String email, String code) => _guard(() async {
        await sb.auth.verifyOTP(email: _norm(email), token: code.trim(), type: OtpType.signup);
        await refresh();
        await touchDevice();
      });

  Future<String?> resendSignupCode(String email) => _guard(() => sb.auth.resend(type: OtpType.signup, email: _norm(email)));

  Future<String?> _afterSignIn() async {
    await refresh();
    if (account?.suspended == true) {
      await signOut();
      return 'This account has been suspended. Contact MyFlix support to restore access.';
    }
    activeProfileId = null;
    await _prefs.remove(_profileKey);
    await touchDevice();
    notifyListeners();
    return null;
  }

  Future<String?> signIn(String email, String password) async {
    try {
      await sb.auth.signInWithPassword(email: _norm(email), password: password);
      return await _afterSignIn();
    } catch (e) {
      return friendly(e);
    }
  }

  Future<void> signOut() async {
    activeProfileId = null;
    await _prefs.remove(_profileKey);
    try {
      await sb.auth.signOut(scope: SignOutScope.local);
    } catch (_) {}
    account = null;
    devicesList = [];
    notifyListeners();
  }

  /// "Use a sign-in code": 6-digit code by email, or by SMS to a verified phone. Returns (error, sentTo).
  Future<(String?, String?)> requestSignInCode(String identifier) async {
    try {
      if (isPhoneLike(identifier)) {
        final p = normalPhone(identifier);
        if (p.isEmpty) return ('Enter a valid Nigerian phone number.', null);
        await sb.auth.signInWithOtp(phone: '+$p', shouldCreateUser: false);
        return (null, prettyPhone(p));
      }
      await sb.auth.signInWithOtp(email: _norm(identifier), shouldCreateUser: false);
      return (null, identifier.trim());
    } catch (e) {
      return (friendly(e), null);
    }
  }

  Future<String?> verifySignInCode(String identifier, String code) async {
    try {
      if (isPhoneLike(identifier)) {
        await sb.auth.verifyOTP(phone: '+${normalPhone(identifier)}', token: code.trim(), type: OtpType.sms);
      } else {
        await sb.auth.verifyOTP(email: _norm(identifier), token: code.trim(), type: OtpType.email);
      }
      return await _afterSignIn();
    } catch (e) {
      return friendly(e);
    }
  }

  /// Sends a reset code (and link) by email, or a code by SMS for a phone number.
  /// Same answer whether or not the account exists, so accounts can't be discovered.
  Future<String?> requestPasswordReset(String identifier) async {
    try {
      if (isPhoneLike(identifier)) {
        final p = normalPhone(identifier);
        if (p.isEmpty) return 'Enter a valid Nigerian phone number.';
        await sb.auth.signInWithOtp(phone: '+$p', shouldCreateUser: false);
      } else {
        await sb.auth.resetPasswordForEmail(_norm(identifier), redirectTo: '$siteUrl/login/reset/');
      }
      return null;
    } catch (e) {
      final m = friendly(e);
      if (m.contains("can't find an account")) return null;
      return m;
    }
  }

  /// Checks the reset code; on success the member is signed in and can set a new password.
  Future<String?> verifyResetCode(String identifier, String code) => _guard(() async {
        if (isPhoneLike(identifier)) {
          await sb.auth.verifyOTP(phone: '+${normalPhone(identifier)}', token: code.trim(), type: OtpType.sms);
        } else {
          await sb.auth.verifyOTP(email: _norm(identifier), token: code.trim(), type: OtpType.recovery);
        }
      });

  Future<String?> resetPassword(String password) => _guard(() async {
        await sb.auth.updateUser(UserAttributes(password: password));
        final err = await _afterSignIn();
        if (err != null) throw BackendError(err);
      });

  /* ---------------- Phone ---------------- */
  Future<(String?, String?)> requestPhoneCode(String phone) async {
    final p = normalPhone(phone);
    if (p.isEmpty) return ('Enter a valid Nigerian phone number.', null);
    try {
      await sb.auth.updateUser(UserAttributes(phone: '+$p'));
      return (null, prettyPhone(p));
    } catch (e) {
      return (friendly(e), null);
    }
  }

  Future<String?> confirmPhone(String phone, String code) => _guard(() async {
        await sb.auth.verifyOTP(phone: '+${normalPhone(phone)}', token: code.trim(), type: OtpType.phoneChange);
        await refresh();
      });

  /* ---------------- Plans & payments ---------------- */
  Future<String?> choosePlan(String planId) => _guard(() async {
        await sb.rpc('choose_plan', params: {'p_plan': planId});
        await refresh();
      });

  Future<Quote?> quote(String planId, {required bool annual, String? promo}) async {
    try {
      final d = Map<String, dynamic>.from(await sb.rpc('my_quote', params: {'p_plan': planId, 'p_cycle': annual ? 'annual' : 'monthly', 'p_promo': (promo ?? '').trim().isEmpty ? null : promo!.trim().toUpperCase()}) as Map);
      return (
        ok: d['ok'] != false,
        base: (d['base'] as num?)?.toInt() ?? 0,
        discount: (d['discount'] as num?)?.toInt() ?? 0,
        creditUsed: (d['credit_used'] as num?)?.toInt() ?? 0,
        freeMonths: (d['free_months'] as num?)?.toInt() ?? 0,
        amount: (d['amount'] as num?)?.toInt() ?? 0,
        months: (d['months'] as num?)?.toInt() ?? 1,
        promoLabel: (d['promo'] as Map?)?['label'] as String?,
        promoError: d['promo_error'] as String?,
        error: d['error'] as String?,
      );
    } catch (_) {
      return null;
    }
  }

  /// Starts a Paystack checkout. Returns (error, checkoutUrl). A null URL with no error means
  /// credit or a promo covered it and the membership is already active.
  Future<(String?, String?)> startPayment(String planId, {required bool annual, String? promo}) async {
    try {
      final r = await fn('payments', {
        'action': 'init',
        'plan': planId,
        'cycle': annual ? 'annual' : 'monthly',
        'promo': (promo ?? '').trim().isEmpty ? null : promo!.trim().toUpperCase(),
        'callback_url': '$siteUrl/paid/',
      });
      if (r['done'] == true) {
        await refresh();
        return (null, null);
      }
      await _prefs.setString(_pendingPayKey, '${r['reference']}');
      return (null, r['authorization_url'] as String?);
    } catch (e) {
      return (friendly(e), null);
    }
  }

  String? get pendingPayment => _prefs.getString(_pendingPayKey);

  /// Checks the last checkout with Paystack (called when the member comes back to the app).
  /// Returns (paid, message).
  Future<(bool, String?)> verifyPendingPayment() async {
    final ref = pendingPayment;
    if (ref == null) return (account?.hasAccess == true, null);
    try {
      final r = await fn('payments', {'action': 'verify', 'reference': ref});
      await refresh();
      if (r['status'] == 'success') {
        await _prefs.remove(_pendingPayKey);
        return (true, null);
      }
      if (r['status'] == 'failed' || r['status'] == 'abandoned') await _prefs.remove(_pendingPayKey);
      return (false, r['message'] == null ? null : 'Payment not completed: ${r['message']}');
    } catch (e) {
      return (false, friendly(e));
    }
  }

  /// Upgrades now (charged the difference), downgrades at renewal. Returns (error, message).
  Future<(String?, String?)> changePlan(String planId) async {
    try {
      final d = Map<String, dynamic>.from(await sb.rpc('change_plan', params: {'p_plan': planId}) as Map);
      await refresh();
      final when = d['when'];
      return (null, when == 'renewal' ? 'Your new plan starts at your next renewal.' : when == 'payment' ? 'Complete payment to switch plans.' : 'Your plan has changed.');
    } catch (e) {
      return (friendly(e), null);
    }
  }

  Future<String?> cancelMembership() => _guard(() async {
        await sb.rpc('cancel_membership');
        await refresh();
      });

  Future<String?> restartMembership() => _guard(() async {
        await sb.rpc('restart_membership');
        await refresh();
      });

  /// Replaces the saved card: Paystack checks it with a ₦50 charge that is refunded straight away.
  Future<(String?, String?)> updatePaymentMethod() async {
    try {
      final r = await fn('payments', {'action': 'card', 'callback_url': '$siteUrl/paid/'});
      return (null, r['authorization_url'] as String?);
    } catch (e) {
      return (friendly(e), null);
    }
  }

  Future<(String?, int?)> redeemGift(String code) async {
    try {
      final n = await sb.rpc('redeem_gift', params: {'p_code': code.trim().toUpperCase()});
      await refresh();
      return (null, (n as num?)?.toInt());
    } catch (e) {
      return (friendly(e), null);
    }
  }

  /* ---------------- Profiles ---------------- */
  Map<String, dynamic> _settingsRow(Profile p) => p.settings.toJson()..remove('pin');

  Future<String?> saveProfiles(List<Profile> profiles) => _guard(() async {
        final a = account;
        if (a == null) throw BackendError('Please sign in again.');
        final existing = {for (final p in a.profiles) p.id};
        final keep = {for (final p in profiles) p.id};
        for (final old in a.profiles) {
          if (!keep.contains(old.id)) await sb.from('viewer_profiles').delete().eq('id', old.id);
        }
        var i = 0;
        for (final p in profiles.take(maxProfiles)) {
          final row = {'name': p.name.trim().isEmpty ? 'Profile' : p.name.trim().substring(0, min(30, p.name.trim().length)), 'avatar': p.avatar, 'kids': p.kids, 'settings': _settingsRow(p), 'sort': i++};
          if (existing.contains(p.id)) {
            await sb.from('viewer_profiles').update(row).eq('id', p.id);
          } else {
            await sb.from('viewer_profiles').insert({...row, 'account_id': a.id});
          }
        }
        await refresh();
      });

  Future<String?> updateProfile(Profile p) => _guard(() async {
        await sb.from('viewer_profiles').update({'name': p.name, 'avatar': p.avatar, 'kids': p.kids, 'settings': _settingsRow(p)}).eq('id', p.id);
        // PIN: unchanged when it still shows the placeholder, otherwise set or cleared on the server
        if (p.settings.pin != pinSet) await sb.rpc('set_profile_pin', params: {'pid': p.id, 'pin': p.settings.pin});
        await refresh();
      });

  Future<bool> checkPin(String profileId, String pin) async {
    try {
      return await sb.rpc('check_profile_pin', params: {'pid': profileId, 'pin': pin}) == true;
    } catch (_) {
      return false;
    }
  }

  Future<void> selectProfile(String id) async {
    activeProfileId = id;
    await _prefs.setString(_profileKey, id);
    notifyListeners();
  }

  Future<void> leaveProfile() async {
    activeProfileId = null;
    await _prefs.remove(_profileKey);
    notifyListeners();
  }

  /* ---------------- Account settings ---------------- */
  Future<bool> _checkPassword(String password) async {
    final email = sb.auth.currentUser?.email;
    if (email == null) return false;
    try {
      await sb.auth.signInWithPassword(email: email, password: password);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Sends a confirmation to the new address; the change applies once it's confirmed.
  Future<String?> changeEmail(String newEmail, String password) async {
    if (!await _checkPassword(password)) return 'Incorrect password.';
    return _guard(() => sb.auth.updateUser(UserAttributes(email: _norm(newEmail)), emailRedirectTo: '$siteUrl/auth/confirm/'));
  }

  Future<String?> changePassword(String current, String next) async {
    if (!await _checkPassword(current)) return 'Your current password is incorrect.';
    return _guard(() => sb.auth.updateUser(UserAttributes(password: next)));
  }

  Future<String?> updateNotifications(Map<String, bool> n) => _guard(() async {
        final a = account;
        if (a == null) return;
        await sb.from('accounts').update({'notifications': n}).eq('id', a.id);
        await refresh();
      });

  List<Device> devices() => devicesList;

  Future<String?> removeDevice(String id) => _guard(() async {
        await sb.from('devices').update({'revoked_at': DateTime.now().toUtc().toIso8601String()}).eq('id', id);
        await refresh();
      });

  Future<String?> signOutEverywhere() => _guard(() async {
        final a = account;
        if (a != null) await sb.from('devices').update({'revoked_at': DateTime.now().toUtc().toIso8601String()}).eq('account_id', a.id);
        await sb.auth.signOut(scope: SignOutScope.global);
        await signOut();
      });

  /* ---------------- Privacy ---------------- */
  Future<(String?, Map<String, dynamic>?)> exportData() async {
    try {
      return (null, await fn('account', {'action': 'export'}));
    } catch (e) {
      return (friendly(e), null);
    }
  }

  Future<String?> deleteAccount(String confirmEmail) => _guard(() async {
        await fn('account', {'action': 'delete', 'confirm': confirmEmail.trim().toLowerCase()});
        await signOut();
      });

  Plan? get plan => Catalog.plan(account?.planId);
}
