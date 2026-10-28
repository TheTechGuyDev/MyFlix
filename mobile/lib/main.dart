import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'data/auth_store.dart';
import 'data/backend.dart';
import 'data/catalog.dart';
import 'data/library_store.dart';
import 'data/cast.dart';
import 'data/messages.dart';
import 'data/native.dart';
import 'router.dart';
import 'theme.dart';
import 'widgets/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light));
  await initBackend();
  final auth = AuthStore();
  await Future.wait([Catalog.load(), auth.init()]);
  Native.requestNotifications();
  final lib = LibraryStore();
  await lib.init();
  // Keep the library in sync with the active profile
  void sync() => lib.loadProfile(auth.activeProfile?.id, kids: auth.activeProfile?.kids ?? false);
  sync();
  auth.addListener(sync);
  runApp(MyFlixApp(auth: auth, lib: lib));
}

class MyFlixApp extends StatefulWidget {
  final AuthStore auth;
  final LibraryStore lib;
  const MyFlixApp({super.key, required this.auth, required this.lib});
  @override
  State<MyFlixApp> createState() => _MyFlixAppState();
}

class _MyFlixAppState extends State<MyFlixApp> with WidgetsBindingObserver {
  late final _router = buildRouter(widget.auth);
  DateTime _lastSync = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _onResume(first: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _onResume();
    if (state == AppLifecycleState.paused) widget.lib.flushUsage();
  }

  /// Coming back to the app: confirm a Paystack payment, check this device wasn't signed out
  /// remotely, and pick up new titles and notifications.
  Future<void> _onResume({bool first = false}) async {
    final auth = widget.auth;
    if (!backendConfigured || auth.account == null) return;
    if (auth.pendingPayment != null) await auth.verifyPendingPayment();
    if (!await auth.touchDevice()) return;
    if (!first && DateTime.now().difference(_lastSync).inMinutes >= 5) {
      _lastSync = DateTime.now();
      await Catalog.load();
      await auth.refresh();
      await widget.lib.reload();
    }
    await Notices.deliverNew(enabled: auth.account?.notifications['push'] != false);
  }

  @override
  Widget build(BuildContext context) {
    if (Catalog.error != null && !Catalog.loaded) {
      return MaterialApp(debugShowCheckedModeBanner: false, theme: buildTheme(), home: _StartError(onRetry: () async {
        await Catalog.load();
        await widget.auth.refresh();
        setState(() {});
      }));
    }
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: widget.auth),
        ChangeNotifierProvider.value(value: widget.lib),
        ChangeNotifierProvider.value(value: CastStore.instance),
      ],
      child: MaterialApp.router(
        title: 'MyFlix',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        routerConfig: _router,
      ),
    );
  }
}

/// Shown when the app can't reach MyFlix at start-up (no internet, or a build without a backend).
class _StartError extends StatefulWidget {
  final Future<void> Function() onRetry;
  const _StartError({required this.onRetry});
  @override
  State<_StartError> createState() => _StartErrorState();
}

class _StartErrorState extends State<_StartError> {
  bool _busy = false;
  @override
  Widget build(BuildContext context) {
    final notConfigured = Catalog.error == 'not-configured';
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Logo(size: 48),
            const SizedBox(height: 28),
            Text(notConfigured ? "We're getting ready" : "Can't reach MyFlix", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Text(
              notConfigured ? 'MyFlix is finishing setup. Please check back shortly.' : 'Check your data or Wi-Fi connection and try again.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 24),
            if (!notConfigured)
              FilledButton(
                onPressed: _busy
                    ? null
                    : () async {
                        setState(() => _busy = true);
                        await widget.onRetry();
                        if (mounted) setState(() => _busy = false);
                      },
                child: Text(_busy ? 'Trying…' : 'Try again'),
              ),
          ]),
        ),
      ),
    );
  }
}
