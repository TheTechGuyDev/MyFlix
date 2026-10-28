import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase project for this build. Passed at build time:
///   flutter build apk --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_KEY=...
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseKey = String.fromEnvironment('SUPABASE_KEY');

/// Public website (legal pages, payment return page).
const siteUrl = String.fromEnvironment('SITE_URL', defaultValue: 'https://thetechguydev.github.io/MyFlix');

bool get backendConfigured => supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty;

Future<void> initBackend() async {
  if (!backendConfigured) return;
  await Supabase.initialize(
    url: supabaseUrl,
    publishableKey: supabaseKey,
    authOptions: const FlutterAuthClientOptions(authFlowType: AuthFlowType.pkce),
    debug: false,
  );
}

SupabaseClient get sb => Supabase.instance.client;

/// Calls an edge function and returns its JSON. Throws a [BackendError] with a readable message.
Future<Map<String, dynamic>> fn(String name, Map<String, dynamic> body) async {
  try {
    final r = await sb.functions.invoke(name, body: body);
    final d = r.data;
    if (d is Map) return Map<String, dynamic>.from(d);
    if (d is String && d.isNotEmpty) return Map<String, dynamic>.from(jsonDecode(d) as Map);
    return {};
  } on FunctionException catch (e) {
    final d = e.details;
    String? msg;
    if (d is Map && d['error'] != null) msg = '${d['error']}';
    if (d is String) {
      try {
        msg = (jsonDecode(d) as Map)['error']?.toString();
      } catch (_) {}
    }
    throw BackendError(msg ?? 'Something went wrong. Please try again.');
  } catch (e) {
    if (e is BackendError) rethrow;
    throw BackendError(friendly(e));
  }
}

class BackendError implements Exception {
  final String message;
  BackendError(this.message);
  @override
  String toString() => message;
}

/// Turns Supabase and network errors into short, member-friendly messages.
String friendly(Object e) {
  var m = e is AuthException
      ? e.message
      : e is PostgrestException
          ? e.message
          : e is BackendError
              ? e.message
              : e.toString();
  if (RegExp('Invalid login credentials', caseSensitive: false).hasMatch(m)) return 'Incorrect email or password. Please try again or reset your password.';
  if (RegExp('Email not confirmed', caseSensitive: false).hasMatch(m)) return 'Please confirm your email first. We sent you a code.';
  if (RegExp('User already registered', caseSensitive: false).hasMatch(m)) return 'An account with this email already exists. Sign in instead.';
  if (RegExp('rate limit|too many', caseSensitive: false).hasMatch(m)) return 'Too many attempts. Please wait a minute and try again.';
  if (RegExp(r'Token has expired|otp_expired|invalid.*token', caseSensitive: false).hasMatch(m)) return 'That code is wrong or has expired. Request a new one.';
  if (RegExp('Signups not allowed for otp', caseSensitive: false).hasMatch(m)) return "We can't find an account with those details.";
  if (RegExp('SocketException|Failed host lookup|ClientException|XMLHttpRequest', caseSensitive: false).hasMatch(m)) return 'No internet connection. Check your data or Wi-Fi and try again.';
  if (kDebugMode) debugPrint('Backend error: $m');
  return m.replaceFirst(RegExp(r'^Exception: '), '');
}
