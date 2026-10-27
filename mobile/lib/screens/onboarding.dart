import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../data/auth_store.dart';
import '../data/models.dart';
import '../theme.dart';
import '../widgets/common.dart';

class _Slide {
  final String title, body;
  final List<String> images;
  const _Slide(this.title, this.body, this.images);
}

const _slides = [
  _Slide('Nollywood, Hollywood and everything in between', 'Watch anywhere. Cancel anytime. Plans from ₦1,500 a month.',
      ['1593717191400-84f38ee95485', '1530785602389-07594beb8b73', '1648023200201-8fcede127835', '1616805765352-beedbad46b2a', '1519699047748-de8e457a634e', '1765285353856-0d00e478f2c8']),
  _Slide('Download and go offline', 'Save your favourites and keep watching when the network drops or the light goes off.',
      ['1549383433-0d8ef3f38afa']),
  _Slide('Data that works for you', 'Choose Data Saver, HD or 4K so your bundle lasts as long as your binge.', ['1601042879364-f3947d3f9c16']),
  _Slide('Profiles for the whole family', 'Everyone gets their own space, and kids get a safe one with PIN locks you control.',
      ['1624272864537-8ecc72b67958']),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pc = PageController();
  int _page = 0;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  void _go(String path) {
    context.read<AuthStore>().finishOnboarding();
    context.go(path);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(children: [
        PageView.builder(
          controller: _pc,
          itemCount: _slides.length,
          onPageChanged: (i) => setState(() => _page = i),
          itemBuilder: (_, i) => _SlideView(_slides[i], first: i == 0),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(children: [
              const Logo(size: 32),
              const Spacer(),
              TextButton(onPressed: () => toast(context, 'Privacy policy coming soon.'), child: const Text('PRIVACY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13))),
              TextButton(onPressed: () => _go('/login'), child: const Text('SIGN IN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13))),
            ]),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Column(children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    _slides.length,
                    (i) => AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: i == _page ? 18 : 8,
                      height: 8,
                      decoration: BoxDecoration(color: i == _page ? AppColors.brandBright : Colors.white38, borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                PrimaryButton('GET STARTED', onPressed: () => _go('/signup')),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class _SlideView extends StatelessWidget {
  final _Slide s;
  final bool first;
  const _SlideView(this.s, {required this.first});

  @override
  Widget build(BuildContext context) {
    return Stack(fit: StackFit.expand, children: [
      if (first)
        Transform.rotate(
          angle: -0.18,
          child: OverflowBox(
            maxWidth: 900,
            maxHeight: 1400,
            child: GridView.count(
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              childAspectRatio: 2 / 3,
              mainAxisSpacing: 6,
              crossAxisSpacing: 6,
              children: [for (var i = 0; i < 18; i++) ClipRRect(borderRadius: BorderRadius.circular(6), child: NetImage(img(s.images[i % s.images.length], w: 300, h: 450)))],
            ),
          ),
        )
      else
        Align(
          alignment: const Alignment(0, -0.35),
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [BoxShadow(color: AppColors.brand.withValues(alpha: 0.35), blurRadius: 80, spreadRadius: 10)]),
            child: ClipOval(child: NetImage(img(s.images.first, w: 600, h: 600))),
          ),
        ),
      DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: first ? [Colors.black87, Colors.black54, Colors.black] : [Colors.transparent, Colors.transparent, AppColors.ink],
            stops: const [0, 0.45, 0.8],
          ),
        ),
      ),
      Align(
        alignment: first ? const Alignment(0, 0.45) : const Alignment(0, 0.5),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(s.title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, height: 1.15)),
            const SizedBox(height: 14),
            Text(s.body, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, color: Colors.white70, height: 1.4)),
          ]),
        ),
      ),
    ]);
  }
}
