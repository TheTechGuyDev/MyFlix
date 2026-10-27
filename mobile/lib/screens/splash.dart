import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../data/auth_store.dart';
import '../widgets/common.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..forward();

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1700), () {
      if (!mounted) return;
      final auth = context.read<AuthStore>();
      if (auth.account != null) {
        context.go(auth.nextStep());
      } else {
        context.go(auth.onboarded ? '/login' : '/welcome');
      }
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, child) {
            final t = Curves.easeOutBack.transform(_c.value.clamp(0, 1));
            return Opacity(opacity: _c.value.clamp(0, 1), child: Transform.scale(scale: 0.6 + 0.6 * t, child: child));
          },
          child: const Logo(size: 64),
        ),
      ),
    );
  }
}
