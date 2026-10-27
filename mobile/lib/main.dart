import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'data/auth_store.dart';
import 'data/catalog.dart';
import 'data/library_store.dart';
import 'router.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light));
  await Catalog.load();
  final auth = AuthStore();
  await auth.init();
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

class _MyFlixAppState extends State<MyFlixApp> {
  late final _router = buildRouter(widget.auth);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: widget.auth),
        ChangeNotifierProvider.value(value: widget.lib),
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
