import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:flutter/gestures.dart';
import '../../data/auth_store.dart';
import '../../data/backend.dart';
import '../../data/catalog.dart';
import '../../data/models.dart';
import '../../theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/common.dart';

class _Shell extends StatelessWidget {
  final int step;
  final List<Widget> children;
  final Widget? bottom;
  const _Shell({required this.step, required this.children, this.bottom});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    return Scaffold(
      appBar: AppBar(
        title: const Logo(size: 30),
        actions: [
          TextButton(
            onPressed: () async {
              if (auth.account != null) {
                await auth.signOut();
                if (context.mounted) context.go('/login');
              } else {
                context.go('/login');
              }
            },
            child: Text(auth.account != null ? 'SIGN OUT' : 'SIGN IN', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(22, 12, 22, 24), children: [
          Text.rich(TextSpan(children: [
            const TextSpan(text: 'STEP '),
            TextSpan(text: '$step', style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
            const TextSpan(text: ' OF '),
            const TextSpan(text: '4', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
          ]), style: const TextStyle(color: AppColors.muted, fontSize: 13, letterSpacing: 0.5)),
          const SizedBox(height: 6),
          ...children,
        ]),
      ),
      bottomNavigationBar: bottom == null ? null : SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(22, 8, 22, 12), child: bottom)),
    );
  }
}

const _h1 = TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.2);
const _p = TextStyle(fontSize: 16, color: Colors.white70, height: 1.4);

/* ---------------- Step 1: account ---------------- */
class CreateAccountScreen extends StatefulWidget {
  const CreateAccountScreen({super.key});
  @override
  State<CreateAccountScreen> createState() => _CreateAccountScreenState();
}

class _CreateAccountScreenState extends State<CreateAccountScreen> {
  final _email = TextEditingController();
  final _pw = TextEditingController();
  final _code = TextEditingController();
  bool _agree = false, _offers = false, _loading = false, _needCode = false;
  String? _eErr, _pErr, _aErr, _form, _info;

  Future<void> _verify() async {
    if (!RegExp(r'^\d{6}$').hasMatch(_code.text.trim())) return setState(() => _form = 'Enter the 6-digit code from the email.');
    setState(() {
      _loading = true;
      _form = null;
    });
    final auth = context.read<AuthStore>();
    final err = await auth.verifySignupCode(_email.text, _code.text);
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) return setState(() => _form = err);
    if (_offers) await auth.updateNotifications({...?auth.account?.notifications, 'offers': true});
    if (mounted) context.go('/signup/plan');
  }

  Future<void> _next() async {
    if (_needCode) return _verify();
    setState(() {
      _eErr = validateEmail(_email.text);
      _pErr = validatePassword(_pw.text);
      _aErr = _agree ? null : 'Please accept the Terms of Use to continue.';
      _form = null;
    });
    if (_eErr != null || _pErr != null || _aErr != null) return;
    setState(() => _loading = true);
    final auth = context.read<AuthStore>();
    final (err, needCode) = await auth.signUp(_email.text, _pw.text);
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) return setState(() => _form = err);
    if (needCode) return setState(() => _needCode = true);
    if (_offers) await auth.updateNotifications({...?auth.account?.notifications, 'offers': true});
    if (mounted) context.go('/signup/plan');
  }

  @override
  Widget build(BuildContext context) {
    return _Shell(
      step: 1,
      bottom: PrimaryButton(_needCode ? 'Confirm' : 'Next', onPressed: _next, loading: _loading),
      children: _needCode
          ? [
              const Text('Confirm your email', style: _h1),
              const SizedBox(height: 8),
              Text('We sent a 6-digit code to ${_email.text.trim()}. Enter it below, or tap the link in the email.', style: _p),
              const SizedBox(height: 20),
              if (_form != null) ...[AlertBox(_form!), const SizedBox(height: 8)],
              if (_info != null) ...[Text(_info!, style: const TextStyle(color: AppColors.brandBright)), const SizedBox(height: 8)],
              AppField(label: '6-digit code', controller: _code, keyboard: TextInputType.number, autofill: const [AutofillHints.oneTimeCode], onSubmitted: (_) => _verify()),
              const SizedBox(height: 8),
              Row(children: [
                TextButton(
                  onPressed: () async {
                    final err = await context.read<AuthStore>().resendSignupCode(_email.text);
                    if (mounted) setState(() => err == null ? _info = 'New code sent.' : _form = err);
                  },
                  child: const Text('Resend code', style: TextStyle(color: Colors.white)),
                ),
                TextButton(onPressed: () => setState(() => _needCode = false), child: const Text('Change email', style: TextStyle(color: Colors.white70))),
              ]),
            ]
          : [
        const Text('Create your account', style: _h1),
        const SizedBox(height: 8),
        const Text("Just a few more steps and you're done! We hate paperwork, too.", style: _p),
        const SizedBox(height: 20),
        if (_form != null) ...[
          AlertBox(_form!),
          TextButton(onPressed: () => context.go('/login'), child: const Text('Go to Sign In')),
          const SizedBox(height: 8),
        ],
        AppField(label: 'Email address', controller: _email, errorText: _eErr, keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email]),
        const SizedBox(height: 14),
        AppField(label: 'Add a password', controller: _pw, errorText: _pErr, password: true, autofill: const [AutofillHints.newPassword]),
        const SizedBox(height: 12),
        CheckboxListTile(
          value: _agree,
          onChanged: (v) => setState(() => _agree = v ?? false),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: Text.rich(TextSpan(style: const TextStyle(fontSize: 14), children: [
            const TextSpan(text: 'I agree to the '),
            TextSpan(text: 'Terms of Use', style: const TextStyle(decoration: TextDecoration.underline), recognizer: _link('terms')),
            const TextSpan(text: ' and '),
            TextSpan(text: 'Privacy Policy', style: const TextStyle(decoration: TextDecoration.underline), recognizer: _link('privacy')),
            const TextSpan(text: ', and confirm I am 18 or older.'),
          ])),
          subtitle: _aErr == null ? null : Text(_aErr!, style: const TextStyle(color: AppColors.danger)),
        ),
        CheckboxListTile(
          value: _offers,
          onChanged: (v) => setState(() => _offers = v ?? false),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text('Yes, send me MyFlix news and special offers by email.', style: TextStyle(fontSize: 14)),
        ),
      ],
    );
  }
}

TapGestureRecognizer _link(String page) => TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('$siteUrl/$page/'), mode: LaunchMode.externalApplication);

/* ---------------- Step 2: plan ---------------- */
class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});
  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  late String _sel = context.read<AuthStore>().account?.planId ?? (Catalog.plans.any((p) => p.id == 'standard') ? 'standard' : (Catalog.plans.isEmpty ? '' : Catalog.plans.first.id));
  bool _loading = false;
  bool _annual = false;

  @override
  Widget build(BuildContext context) {
    return _Shell(
      step: 2,
      bottom: PrimaryButton('Next', loading: _loading, onPressed: () async {
        setState(() => _loading = true);
        final auth = context.read<AuthStore>();
        auth.pendingAnnual = _annual;
        final err = await auth.choosePlan(_sel);
        if (!context.mounted) return;
        setState(() => _loading = false);
        if (err != null) return toast(context, err);
        context.go('/signup/payment');
      }),
      children: [
        const Text("Choose the plan that's right for you", style: _h1),
        const SizedBox(height: 12),
        for (final t in ['Watch all you want. No adverts.', 'Recommendations just for you.', 'Change or cancel your plan anytime.'])
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(children: [const Icon(Icons.check, color: AppColors.brandBright), const SizedBox(width: 8), Expanded(child: Text(t, style: _p))]),
          ),
        const SizedBox(height: 12),
        SegmentedButton<bool>(
          segments: [const ButtonSegment(value: false, label: Text('Monthly')), ButtonSegment(value: true, label: Text('Yearly · save ${Catalog.plans.isEmpty ? 15 : Catalog.plans.first.annualDiscount}%'))],
          selected: {_annual},
          onSelectionChanged: (s) => setState(() => _annual = s.first),
          style: SegmentedButton.styleFrom(selectedBackgroundColor: AppColors.brand, selectedForegroundColor: Colors.white),
        ),
        const SizedBox(height: 12),
        for (final p in Catalog.plans) _PlanCard(plan: p, selected: _sel == p.id, annual: _annual, onTap: () => setState(() => _sel = p.id)),
        const SizedBox(height: 8),
        const Text(
          'HD, Full HD and 4K availability depends on your internet service and device. Only people who live with you may use your account.',
          style: TextStyle(color: AppColors.muted, fontSize: 12),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  final Plan plan;
  final bool selected, annual;
  final VoidCallback onTap;
  const _PlanCard({required this.plan, required this.selected, required this.onTap, this.annual = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.ink2,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? AppColors.brandBright : AppColors.line, width: selected ? 2 : 1),
        ),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              gradient: LinearGradient(colors: selected ? [AppColors.brandBright, const Color(0xFF0B4F33)] : [const Color(0xFF3F3F46), AppColors.ink3]),
            ),
            child: Row(children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(plan.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                Text(plan.resolution, style: const TextStyle(color: Colors.white70, fontSize: 13)),
              ]),
              const Spacer(),
              if (plan.badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                  child: Text(plan.badge!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              const SizedBox(width: 8),
              Icon(selected ? Icons.check_circle : Icons.circle_outlined, color: Colors.white),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            child: Column(children: [
              annual ? _row('Yearly price', '${naira(annualPrice(plan))} (${naira((annualPrice(plan) / 12).round())}/mo)') : _row('Monthly price', naira(plan.price)),
              _row('Video and sound quality', plan.quality),
              _row('Watch at the same time', '${plan.screens}'),
              _row('Download devices', '${plan.downloads}'),
              _row('Supported devices', plan.devices),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Expanded(child: Text(k, style: const TextStyle(color: AppColors.muted, fontSize: 13))),
          Expanded(child: Text(v, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
        ]),
      );
}

/* ---------------- Step 3: payment ---------------- */
/// Payment happens on Paystack's secure page (card, bank transfer or USSD). When the member comes
/// back to the app we confirm it with Paystack before moving on.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});
  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> with WidgetsBindingObserver {
  final _promo = TextEditingController();
  String? _applied, _err;
  Quote? _q;
  bool _loading = false, _waiting = false, _checking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _waiting = context.read<AuthStore>().pendingPayment != null;
    _quote();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _waiting) _check();
  }

  Future<void> _quote() async {
    final auth = context.read<AuthStore>();
    final plan = auth.account?.planId;
    if (plan == null) return;
    final q = await auth.quote(plan, annual: auth.pendingAnnual, promo: _applied);
    if (!mounted) return;
    setState(() {
      _q = q;
      if (q?.promoError != null) {
        _err = q!.promoError;
        _applied = null;
      }
    });
  }

  Future<void> _pay() async {
    final auth = context.read<AuthStore>();
    setState(() {
      _loading = true;
      _err = null;
    });
    final (err, url) = await auth.startPayment(auth.account!.planId!, annual: auth.pendingAnnual, promo: _applied);
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) return setState(() => _err = err);
    if (url == null) {
      // Covered by credit or a promo
      if (mounted) context.go(auth.nextStep());
      return;
    }
    setState(() => _waiting = true);
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  Future<void> _check() async {
    if (_checking) return;
    setState(() {
      _checking = true;
      _err = null;
    });
    final auth = context.read<AuthStore>();
    final (paid, msg) = await auth.verifyPendingPayment();
    if (!mounted) return;
    setState(() => _checking = false);
    if (paid) {
      context.go(auth.nextStep());
    } else {
      setState(() {
        _err = msg ?? "We haven't received your payment yet. If you paid by bank transfer it can take a few minutes.";
        _waiting = auth.pendingPayment != null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final plan = Catalog.plan(auth.account?.planId);
    final q = _q;
    final cycle = auth.pendingAnnual ? 'year' : 'month';
    return _Shell(
      step: 3,
      bottom: _waiting
          ? Column(mainAxisSize: MainAxisSize.min, children: [
              PrimaryButton("I've paid, continue", onPressed: _check, loading: _checking),
              TextButton(onPressed: _pay, child: const Text('Open payment page again', style: TextStyle(color: Colors.white70))),
            ])
          : PrimaryButton(q == null ? 'Loading price…' : 'Pay ${naira(q.amount)} with Paystack', onPressed: q == null ? null : _pay, loading: _loading),
      children: [
        Text(_waiting ? 'Finish paying on Paystack' : 'Set up your payment', style: _h1),
        const SizedBox(height: 14),
        if (_err != null) ...[AlertBox(_err!), const SizedBox(height: 12)],
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(q == null ? '…' : '${naira(q.amount)} today${q.freeMonths > 0 ? ' + ${q.freeMonths} free month${q.freeMonths > 1 ? 's' : ''}' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('${plan?.name ?? ''} plan, renews every $cycle at ${naira(q?.base ?? plan?.price ?? 0)}${q?.promoLabel != null ? ' · ${q!.promoLabel}' : ''}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                if ((q?.creditUsed ?? 0) > 0) Text('Credit used: ${naira(q!.creditUsed)}', style: const TextStyle(color: AppColors.brandBright, fontSize: 13)),
              ]),
            ),
            if (!_waiting) TextButton(onPressed: () => context.go('/signup/plan'), child: const Text('Change', style: TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w700))),
          ]),
        ),
        if (!_waiting) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: TextField(controller: _promo, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'Promo code', contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)))),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () {
                setState(() {
                  _applied = _promo.text.trim().isEmpty ? null : _promo.text.trim().toUpperCase();
                  _err = null;
                });
                _quote();
              },
              style: OutlinedButton.styleFrom(minimumSize: const Size(80, 50), side: const BorderSide(color: Colors.white54)),
              child: const Text('Apply', style: TextStyle(color: Colors.white)),
            ),
          ]),
          if (_applied != null && q?.promoLabel != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Code $_applied applied: ${q!.promoLabel}', style: const TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w600))),
          const SizedBox(height: 18),
          const Text('Pay with your debit card, a bank transfer or USSD on Paystack\'s secure page. Card payments renew automatically; you can cancel anytime.', style: _p),
        ] else ...[
          const SizedBox(height: 16),
          const Text("Complete the payment in your browser, then come back here. We'll confirm it automatically.", style: _p),
        ],
        const SizedBox(height: 10),
        const Row(children: [Icon(Icons.lock, size: 16, color: AppColors.muted), SizedBox(width: 6), Text('Secured by Paystack. MyFlix never sees your card number.', style: TextStyle(color: AppColors.muted, fontSize: 13))]),
        const SizedBox(height: 12),
        Text('By paying, you agree that your membership renews every $cycle at ${naira(q?.base ?? plan?.price ?? 0)} until you cancel.', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
      ],
    );
  }
}

/* ---------------- Step 4: profiles ---------------- */
class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({super.key});
  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final _names = List.generate(AuthStore.maxProfiles, (_) => TextEditingController());
  final _kids = List.filled(AuthStore.maxProfiles, false);
  String? _err;
  bool _loading = false;

  Future<void> _next() async {
    final filled = <int>[for (var i = 0; i < _names.length; i++) if (_names[i].text.trim().isNotEmpty) i];
    if (_names[0].text.trim().isEmpty) return setState(() => _err = 'Please enter your name to create your profile.');
    final lower = filled.map((i) => _names[i].text.trim().toLowerCase()).toList();
    if (lower.toSet().length != lower.length) return setState(() => _err = 'Each profile needs a different name.');
    setState(() {
      _err = null;
      _loading = true;
    });
    final auth = context.read<AuthStore>();
    final err = await auth.saveProfiles([
      ...?auth.account?.profiles,
      for (var j = 0; j < filled.length; j++)
        Profile(id: 'new-${AuthStore.newId()}', name: _names[filled[j]].text.trim(), avatar: j, kids: _kids[filled[j]]),
    ]);
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) return setState(() => _err = err);
    context.go('/profiles');
  }

  @override
  Widget build(BuildContext context) {
    return _Shell(
      step: 4,
      bottom: PrimaryButton('Next', onPressed: _next, loading: _loading),
      children: [
        const Text('Who will be watching MyFlix?', style: _h1),
        const SizedBox(height: 8),
        const Text('People who live with you can each have a profile with their own recommendations and My List. Add up to 5.', style: _p),
        const SizedBox(height: 18),
        for (var i = 0; i < _names.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Avatar(index: i, size: 54, kids: _kids[i]),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  TextField(
                    controller: _names[i],
                    maxLength: 20,
                    decoration: InputDecoration(hintText: i == 0 ? 'Your name' : 'Add profile', counterText: '', contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14)),
                  ),
                  if (i > 0)
                    Row(children: [
                      SizedBox(height: 32, child: Checkbox(value: _kids[i], onChanged: (v) => setState(() => _kids[i] = v ?? false))),
                      const Text('Kids profile', style: TextStyle(color: AppColors.muted, fontSize: 13)),
                    ]),
                ]),
              ),
            ]),
          ),
        if (_err != null) Text(_err!, style: const TextStyle(color: AppColors.danger)),
      ],
    );
  }
}
