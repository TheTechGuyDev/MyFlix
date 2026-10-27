import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'data/auth_store.dart';
import 'data/catalog.dart';
import 'data/library_store.dart';
import 'data/cast.dart';
import 'data/messages.dart';
import 'data/native.dart';
import 'data/shared_store.dart';
import 'router.dart';
import 'widgets/demo_inbox.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light));
  await SharedStore.init();
  await Catalog.load();
  Native.requestNotifications();
  final auth = AuthStore();
  await auth.init();
  final lib = LibraryStore();
  await lib.init();
  // Keep the library in sync with the active profile
  String? pushedFor;
  void sync() {
    lib.loadProfile(auth.activeProfile?.id, kids: auth.activeProfile?.kids ?? false);
    final a = auth.account;
    if (a != null && auth.activeProfile != null && pushedFor != a.email) {
      pushedFor = a.email;
      deliverCampaignPush(a.email, enabled: a.notifications['push'] != false);
    }
  }
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

class _MyFlixAppState extends State<MyFlixApp> {
  late final _router = buildRouter(widget.auth);

  @override
  Widget build(BuildContext context) {
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
        builder: (context, child) => DemoInbox(router: _router, child: child ?? const SizedBox()),
      ),
    );
  }
}
