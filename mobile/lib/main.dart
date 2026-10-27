import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'data/auth_store.dart';
import 'data/catalog.dart';
import 'router.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light));
  await Catalog.load();
  final auth = AuthStore();
  await auth.init();
  runApp(MyFlixApp(auth: auth));
}

class MyFlixApp extends StatefulWidget {
  final AuthStore auth;
  const MyFlixApp({super.key, required this.auth});
  @override
  State<MyFlixApp> createState() => _MyFlixAppState();
}

class _MyFlixAppState extends State<MyFlixApp> {
  late final _router = buildRouter(widget.auth);

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: widget.auth,
      child: MaterialApp.router(
        title: 'MyFlix',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        routerConfig: _router,
      ),
    );
  }
}
