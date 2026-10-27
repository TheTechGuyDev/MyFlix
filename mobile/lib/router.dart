import 'package:go_router/go_router.dart';
import 'data/auth_store.dart';
import 'screens/auth/sign_in.dart';
import 'screens/auth/signup.dart';
import 'screens/home_placeholder.dart';
import 'screens/onboarding.dart';
import 'screens/profiles.dart';
import 'screens/splash.dart';

GoRouter buildRouter(AuthStore auth) {
  const public = {'/', '/welcome', '/login', '/forgot', '/signup'};
  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final signedIn = auth.account != null;
      if (!signedIn) return public.contains(loc) ? null : '/login';
      if (loc == '/') return null;
      final next = auth.nextStep();
      // Signed-in users can't revisit sign-in pages; unfinished signups are sent to the right step
      if (loc == '/login' || loc == '/welcome' || loc == '/signup') return next;
      if (loc.startsWith('/signup/')) {
        const order = ['/signup/plan', '/signup/payment', '/signup/profiles'];
        final want = order.indexOf(next);
        final at = order.indexOf(loc);
        if (want == -1) return next; // setup finished
        if (at > want) return next; // skipping ahead
        return null;
      }
      if (next.startsWith('/signup')) return next;
      if (loc == '/home' && auth.activeProfile == null) return '/profiles';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/login', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/forgot', builder: (_, _) => const ForgotScreen()),
      GoRoute(path: '/signup', builder: (_, _) => const CreateAccountScreen()),
      GoRoute(path: '/signup/plan', builder: (_, _) => const PlanScreen()),
      GoRoute(path: '/signup/payment', builder: (_, _) => const PaymentScreen()),
      GoRoute(path: '/signup/profiles', builder: (_, _) => const ProfileSetupScreen()),
      GoRoute(path: '/profiles', builder: (_, _) => const WhoIsWatchingScreen()),
      GoRoute(path: '/home', builder: (_, _) => const HomePlaceholder()),
    ],
  );
}
