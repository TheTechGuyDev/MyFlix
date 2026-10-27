import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController();
  final _pw = TextEditingController();
  String? _eErr, _pErr, _form;
  bool _loading = false;

  Future<void> _submit() async {
    setState(() {
      _eErr = validateEmail(_email.text);
      _pErr = _pw.text.isEmpty ? 'Your password must contain at least 6 characters.' : null;
      _form = null;
    });
    if (_eErr != null || _pErr != null) return;
    setState(() => _loading = true);
    final auth = context.read<AuthStore>();
    final err = await auth.signIn(_email.text, _pw.text);
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) return setState(() => _form = err);
    context.go(auth.nextStep());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Logo(size: 30), leading: context.canPop() ? const BackButton() : null),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          children: [
            const Text('Sign In', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
            const SizedBox(height: 24),
            if (_form != null) ...[AlertBox(_form!), const SizedBox(height: 16)],
            AutofillGroup(
              child: Column(children: [
                AppField(label: 'Email address', controller: _email, errorText: _eErr, keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email], action: TextInputAction.next),
                const SizedBox(height: 14),
                AppField(label: 'Password', controller: _pw, errorText: _pErr, password: true, autofill: const [AutofillHints.password], action: TextInputAction.done, onSubmitted: (_) => _submit()),
              ]),
            ),
            const SizedBox(height: 24),
            PrimaryButton('Sign In', onPressed: _submit, loading: _loading),
            const SizedBox(height: 16),
            Center(child: TextButton(onPressed: () => context.push('/forgot'), child: const Text('Forgot password?', style: TextStyle(color: Colors.white, fontSize: 15)))),
            const SizedBox(height: 24),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Text('New to MyFlix? ', style: TextStyle(color: AppColors.muted, fontSize: 15)),
              GestureDetector(
                onTap: () => context.go('/signup'),
                child: const Text('Sign up now.', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ]),
            const SizedBox(height: 20),
            const Text(
              'Sign-in is protected to make sure you are not a bot. Your details are never shared.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class ForgotScreen extends StatefulWidget {
  const ForgotScreen({super.key});
  @override
  State<ForgotScreen> createState() => _ForgotScreenState();
}

class _ForgotScreenState extends State<ForgotScreen> {
  final _email = TextEditingController();
  String? _err;
  bool _loading = false, _sent = false;

  Future<void> _submit() async {
    setState(() => _err = validateEmail(_email.text));
    if (_err != null) return;
    setState(() => _loading = true);
    await context.read<AuthStore>().requestPasswordReset(_email.text);
    if (mounted) {
      setState(() {
        _loading = false;
        _sent = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Logo(size: 30)),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        Text(_sent ? 'Check your email' : 'Forgot your password?', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Text(
          _sent
              ? "If an account exists for ${_email.text}, we've sent a link to reset your password. It expires in 1 hour."
              : "Enter the email on your account and we'll send you a link to reset your password.",
          style: const TextStyle(color: AppColors.muted, fontSize: 15, height: 1.4),
        ),
        const SizedBox(height: 24),
        if (!_sent) ...[
          AppField(label: 'Email address', controller: _email, errorText: _err, keyboard: TextInputType.emailAddress),
          const SizedBox(height: 20),
          PrimaryButton('Email Me', onPressed: _submit, loading: _loading),
        ] else
          PrimaryButton('Back to Sign In', onPressed: () => context.go('/login')),
      ]),
    );
  }
}
