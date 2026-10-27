import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'data/auth_store.dart';
import 'screens/auth/sign_in.dart';
import 'screens/auth/signup.dart';
import 'screens/main/account.dart';
import 'screens/main/browse_more.dart';
import 'screens/main/details.dart';
import 'screens/main/extras.dart';
import 'screens/main/home.dart';
import 'screens/main/my_myflix.dart';
import 'screens/main/player.dart';
import 'screens/main/shell.dart';
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
      if (loc == '/login' || loc == '/welcome' || loc == '/signup' || loc == '/forgot') return next;
      if (loc.startsWith('/signup/')) {
        const order = ['/signup/plan', '/signup/payment', '/signup/profiles'];
        final want = order.indexOf(next);
        final at = order.indexOf(loc);
        if (want == -1) return next; // setup finished
        if (at > want) return next; // skipping ahead
        return null;
      }
      if (next.startsWith('/signup')) return next;
      if (loc == '/profiles') return null;
      if (auth.activeProfile == null) return '/profiles';
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
      StatefulShellRoute.indexedStack(
        builder: (_, _, nav) => MainShell(nav: nav),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/new', builder: (_, _) => const NewHotScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/me', builder: (_, _) => const MyMyFlixScreen())]),
        ],
      ),
      GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
      GoRoute(path: '/title/:id', builder: (_, s) => DetailsScreen(id: s.pathParameters['id']!)),
      GoRoute(
        path: '/watch/:id',
        pageBuilder: (_, s) => MaterialPage(
          fullscreenDialog: true,
          child: PlayerScreen(
            id: s.pathParameters['id']!,
            season: int.tryParse(s.uri.queryParameters['s'] ?? ''),
            episode: int.tryParse(s.uri.queryParameters['e'] ?? ''),
          ),
        ),
      ),
      GoRoute(path: '/category/:genre', builder: (_, s) => CategoryScreen(genre: Uri.decodeComponent(s.pathParameters['genre']!))),
      GoRoute(path: '/mylist', builder: (_, _) => const MyListScreen()),
      GoRoute(path: '/downloads', builder: (_, _) => const DownloadsScreen()),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/account', builder: (_, _) => const AccountScreen()),
      GoRoute(path: '/account/plan', builder: (_, _) => const ChangePlanScreen()),
      GoRoute(path: '/account/payment', builder: (_, _) => const ManagePaymentScreen()),
      GoRoute(path: '/account/billing', builder: (_, _) => const BillingScreen()),
      GoRoute(path: '/account/cancel', builder: (_, _) => const CancelScreen()),
      GoRoute(path: '/account/security', builder: (_, _) => const SecurityScreen()),
      GoRoute(path: '/account/devices', builder: (_, _) => const DevicesScreen()),
      GoRoute(path: '/account/notifications', builder: (_, _) => const NotificationPrefsScreen()),
      GoRoute(path: '/profile-settings/:id', builder: (_, s) => ProfileSettingsScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/app-settings', builder: (_, _) => const AppSettingsScreen()),
      GoRoute(path: '/help', builder: (_, _) => const HelpScreen()),
      GoRoute(path: '/activity', builder: (_, _) => const ActivityScreen()),
      GoRoute(path: '/invite', builder: (_, _) => const InviteScreen()),
      GoRoute(path: '/tv', builder: (_, _) => const TvSignInScreen()),
    ],
  );
}
