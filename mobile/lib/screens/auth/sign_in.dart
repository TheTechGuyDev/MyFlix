import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../data/messages.dart';
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
  final _code = TextEditingController();
  String? _eErr, _pErr, _form, _codeSentTo;
  bool _loading = false, _useCode = false;

  Future<void> _submit() async {
    final auth = context.read<AuthStore>();
    setState(() => _form = null);
    if (_useCode) {
      final id = _email.text.trim();
      if (_codeSentTo == null) {
        if (id.isEmpty || (!isPhoneLike(id) && validateEmail(id) != null)) return setState(() => _eErr = 'Enter your email or mobile number.');
        setState(() {
          _eErr = null;
          _loading = true;
        });
        final (err, to) = await auth.requestSignInCode(id);
        if (!mounted) return;
        setState(() {
          _loading = false;
          _form = err;
          _codeSentTo = to;
        });
        return;
      }
      if (!RegExp(r'^\d{6}$').hasMatch(_code.text.trim())) return setState(() => _form = 'Enter the 6-digit code.');
      setState(() => _loading = true);
      final err = await auth.verifySignInCode(id, _code.text);
      if (!mounted) return;
      setState(() => _loading = false);
      if (err != null) return setState(() => _form = err);
      context.go(auth.nextStep());
      return;
    }
    setState(() {
      _eErr = validateEmail(_email.text);
      _pErr = _pw.text.isEmpty ? 'Your password must contain at least 6 characters.' : null;
    });
    if (_eErr != null || _pErr != null) return;
    setState(() => _loading = true);
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
                AppField(
                  label: _useCode ? 'Email or mobile number' : 'Email address',
                  controller: _email,
                  errorText: _eErr,
                  keyboard: _useCode ? TextInputType.text : TextInputType.emailAddress,
                  autofill: const [AutofillHints.email],
                  action: TextInputAction.next,
                ),
                if (!_useCode) ...[
                  const SizedBox(height: 14),
                  AppField(label: 'Password', controller: _pw, errorText: _pErr, password: true, autofill: const [AutofillHints.password], action: TextInputAction.done, onSubmitted: (_) => _submit()),
                ],
                if (_useCode && _codeSentTo != null) ...[
                  const SizedBox(height: 12),
                  Text('We sent a 6-digit code to $_codeSentTo.', style: const TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 10),
                  AppField(label: 'Sign-in code', controller: _code, keyboard: TextInputType.number, autofill: const [AutofillHints.oneTimeCode], onSubmitted: (_) => _submit()),
                ],
              ]),
            ),
            const SizedBox(height: 24),
            PrimaryButton(_useCode ? (_codeSentTo == null ? 'Send Sign-In Code' : 'Sign In') : 'Sign In', onPressed: _submit, loading: _loading),
            const SizedBox(height: 12),
            const Center(child: Text('OR', style: TextStyle(color: AppColors.muted))),
            const SizedBox(height: 12),
            PrimaryButton(
              _useCode ? 'Use Password' : 'Use a Sign-In Code',
              color: Colors.white24,
              onPressed: () => setState(() {
                _useCode = !_useCode;
                _codeSentTo = null;
                _code.clear();
                _form = null;
                _eErr = null;
              }),
            ),
            const SizedBox(height: 12),
            Center(
              child: _useCode && _codeSentTo != null
                  ? TextButton(onPressed: () => setState(() => _codeSentTo = null), child: const Text('Resend code', style: TextStyle(color: Colors.white, fontSize: 15)))
                  : TextButton(onPressed: () => context.push('/forgot'), child: const Text('Forgot password?', style: TextStyle(color: Colors.white, fontSize: 15))),
            ),
            const SizedBox(height: 16),
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
  final _value = TextEditingController();
  String _via = 'email';
  String? _err;
  bool _loading = false, _sent = false;

  Future<void> _submit() async {
    final v = _value.text;
    setState(() => _err = _via == 'email' ? validateEmail(v) : (normalPhone(v).isEmpty ? 'Enter a valid Nigerian phone number.' : null));
    if (_err != null) return;
    setState(() => _loading = true);
    await context.read<AuthStore>().requestPasswordReset(v);
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
        Text(_sent ? (_via == 'email' ? 'Check your email' : 'Check your phone') : 'Forgot your password?', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        if (_sent)
          Text("If an account uses ${_value.text}, we've sent a link to reset your password. It expires in 1 hour.", style: const TextStyle(color: AppColors.muted, fontSize: 15, height: 1.4))
        else ...[
          const Text('How would you like to reset it?', style: TextStyle(color: AppColors.muted, fontSize: 15)),
          const SizedBox(height: 8),
          RadioGroup<String>(
            groupValue: _via,
            onChanged: (v) => setState(() {
              _via = v!;
              _value.clear();
              _err = null;
            }),
            child: const Column(children: [
              RadioListTile(value: 'email', title: Text('Email'), contentPadding: EdgeInsets.zero, activeColor: AppColors.brand),
              RadioListTile(value: 'sms', title: Text('Text message (SMS)'), contentPadding: EdgeInsets.zero, activeColor: AppColors.brand),
            ]),
          ),
          const SizedBox(height: 8),
          AppField(
            label: _via == 'email' ? 'Email address' : 'Phone number (e.g. 0803 123 4567)',
            controller: _value,
            errorText: _err,
            keyboard: _via == 'email' ? TextInputType.emailAddress : TextInputType.phone,
          ),
        ],
        const SizedBox(height: 24),
        if (!_sent)
          PrimaryButton(_via == 'email' ? 'Email Me' : 'Text Me', onPressed: _submit, loading: _loading)
        else ...[
          PrimaryButton('Back to Sign In', onPressed: () => context.go('/login')),
          TextButton(onPressed: () => setState(() => _sent = false), child: const Text("Didn't get it? Try again", style: TextStyle(color: Colors.white))),
        ],
      ]),
    );
  }
}

class ResetPasswordScreen extends StatefulWidget {
  final String token;
  const ResetPasswordScreen({super.key, required this.token});
  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _a = TextEditingController();
  final _b = TextEditingController();
  String? _err;
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthStore>();
    final email = auth.resetEmail(widget.token);
    return Scaffold(
      appBar: AppBar(title: const Logo(size: 30)),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        if (email == null) ...[
          const Text('Link expired', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          const Text('This password reset link has expired or was already used. Links work for 1 hour.', style: TextStyle(color: AppColors.muted, fontSize: 15)),
          const SizedBox(height: 24),
          PrimaryButton('Send a new link', onPressed: () => context.go('/forgot')),
        ] else ...[
          const Text('Create a new password', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text('For $email. Use 6 to 60 characters.', style: const TextStyle(color: AppColors.muted, fontSize: 15)),
          const SizedBox(height: 20),
          if (_err != null) ...[AlertBox(_err!), const SizedBox(height: 12)],
          AppField(label: 'New password', controller: _a, password: true),
          const SizedBox(height: 12),
          AppField(label: 'Confirm new password', controller: _b, password: true),
          const SizedBox(height: 20),
          PrimaryButton('Save and sign in', loading: _loading, onPressed: () async {
            final v = validatePassword(_a.text) ?? (_a.text != _b.text ? "Passwords don't match." : null);
            if (v != null) return setState(() => _err = v);
            setState(() => _loading = true);
            final err = await auth.resetPassword(widget.token, _a.text);
            if (!context.mounted) return;
            setState(() {
              _loading = false;
              _err = err;
            });
            if (err == null) context.go(auth.nextStep());
          }),
        ],
      ]),
    );
  }
}
