import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
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
  bool _agree = false, _offers = false, _loading = false;
  String? _eErr, _pErr, _aErr, _form;

  Future<void> _next() async {
    setState(() {
      _eErr = validateEmail(_email.text);
      _pErr = validatePassword(_pw.text);
      _aErr = _agree ? null : 'Please accept the Terms of Use to continue.';
      _form = null;
    });
    if (_eErr != null || _pErr != null || _aErr != null) return;
    setState(() => _loading = true);
    final auth = context.read<AuthStore>();
    final err = await auth.signUp(_email.text, _pw.text);
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) return setState(() => _form = err);
    context.go('/signup/plan');
  }

  @override
  Widget build(BuildContext context) {
    return _Shell(
      step: 1,
      bottom: PrimaryButton('Next', onPressed: _next, loading: _loading),
      children: [
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
          title: const Text('I agree to the Terms of Use and Privacy Statement, and confirm I am over 18.', style: TextStyle(fontSize: 14)),
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

/* ---------------- Step 2: plan ---------------- */
class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});
  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  late String _sel = context.read<AuthStore>().account?.planId ?? 'standard';
  bool _loading = false;
  bool _annual = false;

  @override
  Widget build(BuildContext context) {
    return _Shell(
      step: 2,
      bottom: PrimaryButton('Next', loading: _loading, onPressed: () async {
        setState(() => _loading = true);
        context.read<AuthStore>().pendingAnnual = _annual;
        await context.read<AuthStore>().choosePlan(_sel);
        if (context.mounted) context.go('/signup/payment');
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
          segments: const [ButtonSegment(value: false, label: Text('Monthly')), ButtonSegment(value: true, label: Text('Yearly · save 15%'))],
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
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});
  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  String? _method;
  bool _loading = false;
  final _num = TextEditingController(), _exp = TextEditingController(), _cvv = TextEditingController(), _name = TextEditingController();
  Map<String, String?> _err = {};
  String _bank = 'GTBank';
  final _promo = TextEditingController();
  Promo? _applied;
  String? _promoErr;
  static const _banks = {'GTBank': '*737*000*', 'Access Bank': '*901*000*', 'Zenith Bank': '*966*000*', 'First Bank': '*894*000*', 'UBA': '*919*000*'};

  Future<void> _pay() async {
    String? last4;
    if (_method == 'card') {
      final d = _num.text.replaceAll(RegExp(r'\D'), '');
      final parts = _exp.text.split('/');
      final mm = int.tryParse(parts.first) ?? 0;
      final yy = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
      final expired = mm < 1 || mm > 12 || DateTime(2000 + yy, mm + 1).isBefore(DateTime.now());
      setState(() => _err = {
            'num': d.length < 16 ? 'Please enter a valid card number.' : null,
            'exp': expired ? 'Please enter a valid expiry date.' : null,
            'cvv': RegExp(r'^\d{3,4}$').hasMatch(_cvv.text) ? null : 'Please enter a valid CVV.',
            'name': _name.text.trim().isEmpty ? 'Please enter the name on the card.' : null,
          });
      if (_err.values.any((e) => e != null)) return;
      last4 = d.substring(d.length - 4);
    }
    setState(() => _loading = true);
    final auth = context.read<AuthStore>();
    final plan = Catalog.plan(auth.account?.planId);
    final full = plan == null ? 0 : (auth.pendingAnnual ? annualPrice(plan) : plan.price);
    await auth.completePayment(_method!,
        last4: last4, annual: auth.pendingAnnual, amount: _applied?.apply(full) ?? full, freeMonths: _applied?.freeMonths ?? 0, promoLabel: _applied?.label);
    if (mounted) context.go('/signup/profiles');
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final plan = Catalog.plan(auth.account?.planId);
    final full = plan == null ? 0 : (auth.pendingAnnual ? annualPrice(plan) : plan.price);
    final price = _applied?.apply(full) ?? full;
    return _Shell(
      step: 3,
      bottom: _method == null
          ? null
          : PrimaryButton(_method == 'card' ? 'Start Membership' : _method == 'transfer' ? "I've sent the money" : "I've completed payment", onPressed: _pay, loading: _loading),
      children: [
        Text(_method == null ? 'Choose how to pay' : _method == 'card' ? 'Debit or credit card' : _method == 'transfer' ? 'Bank transfer' : 'USSD', style: _h1),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${naira(price)} today, then ${auth.pendingAnnual ? 'yearly' : 'monthly'}', style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('${plan?.name ?? ''} plan${_applied != null ? ' · ${_applied!.label}' : ''}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
              ]),
            ),
            TextButton(onPressed: () => context.go('/signup/plan'), child: const Text('Change', style: TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w700))),
          ]),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: TextField(controller: _promo, textCapitalization: TextCapitalization.characters, decoration: InputDecoration(hintText: 'Promo code', errorText: _promoErr, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12)))),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () {
              final (p, e) = Promo.check(_promo.text, plan?.id ?? '');
              setState(() {
                _applied = p;
                _promoErr = e;
              });
            },
            style: OutlinedButton.styleFrom(minimumSize: const Size(80, 50), side: const BorderSide(color: Colors.white54)),
            child: const Text('Apply', style: TextStyle(color: Colors.white)),
          ),
        ]),
        if (_applied != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Code ${_applied!.code} applied: ${_applied!.label}', style: const TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w600))),
        const SizedBox(height: 16),
        if (_method == null) ...[
          const Text('Your payment is encrypted and you can change how you pay anytime.', style: _p),
          const SizedBox(height: 8),
          const Row(children: [Icon(Icons.lock, size: 16, color: AppColors.muted), SizedBox(width: 6), Text('Secured by Paystack', style: TextStyle(color: AppColors.muted, fontSize: 13))]),
          const SizedBox(height: 14),
          for (final m in const [('card', 'Debit or credit card', 'Verve, Mastercard, Visa', Icons.credit_card), ('transfer', 'Bank transfer', 'Pay from any Nigerian bank app', Icons.account_balance), ('ussd', 'USSD', 'No internet banking needed', Icons.dialpad)])
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                onTap: () => setState(() => _method = m.$1),
                shape: RoundedRectangleBorder(side: const BorderSide(color: AppColors.line), borderRadius: BorderRadius.circular(10)),
                leading: Icon(m.$4),
                title: Text(m.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(m.$3, style: const TextStyle(color: AppColors.muted)),
                trailing: const Icon(Icons.chevron_right),
              ),
            ),
        ],
        if (_method == 'card') ...[
          AppField(label: 'Card number', controller: _num, errorText: _err['num'], keyboard: TextInputType.number, autofill: const [AutofillHints.creditCardNumber], onChanged: (v) {
            final d = v.replaceAll(RegExp(r'\D'), '');
            final f = d.substring(0, d.length.clamp(0, 19)).replaceAllMapped(RegExp(r'.{4}'), (m) => '${m[0]} ').trim();
            if (f != v) _num.value = TextEditingValue(text: f, selection: TextSelection.collapsed(offset: f.length));
          }),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: AppField(label: 'Expiry (MM/YY)', controller: _exp, errorText: _err['exp'], keyboard: TextInputType.number, onChanged: (v) {
              final d = v.replaceAll(RegExp(r'\D'), '');
              final c = d.substring(0, d.length.clamp(0, 4));
              final f = c.length > 2 ? '${c.substring(0, 2)}/${c.substring(2)}' : c;
              if (f != v) _exp.value = TextEditingValue(text: f, selection: TextSelection.collapsed(offset: f.length));
            })),
            const SizedBox(width: 12),
            Expanded(child: AppField(label: 'CVV', controller: _cvv, errorText: _err['cvv'], keyboard: TextInputType.number, password: true)),
          ]),
          const SizedBox(height: 12),
          AppField(label: 'Name on card', controller: _name, errorText: _err['name'], autofill: const [AutofillHints.creditCardName]),
        ],
        if (_method == 'transfer') ...[
          const Text('Transfer the exact amount to this account. It expires in 30 minutes.', style: _p),
          const SizedBox(height: 12),
          for (final r in [('Bank', 'Wema Bank (Demo)', false), ('Account number', '0123456789', true), ('Account name', 'MyFlix Checkout', false), ('Amount', naira(price), true)])
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(r.$1, style: const TextStyle(color: AppColors.muted)),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(r.$2, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                if (r.$3)
                  IconButton(
                    icon: const Icon(Icons.copy, size: 18, color: AppColors.brandBright),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: r.$2));
                      toast(context, 'Copied');
                    },
                  ),
              ]),
            ),
        ],
        if (_method == 'ussd') ...[
          DropdownButtonFormField<String>(
            initialValue: _bank,
            decoration: const InputDecoration(labelText: 'Select your bank'),
            items: [for (final b in _banks.keys) DropdownMenuItem(value: b, child: Text(b))],
            onChanged: (v) => setState(() => _bank = v!),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(10)),
            child: Column(children: [
              const Text('Dial this code on the phone linked to your account', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 8),
              SelectableText('${_banks[_bank]}$price#', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 1)),
            ]),
          ),
        ],
        if (_method != null) ...[
          const SizedBox(height: 16),
          Text('By continuing, you agree that your membership renews monthly at ${naira(price)} until you cancel.', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          TextButton(onPressed: () => setState(() => _method = null), child: const Text('← Choose a different payment method', style: TextStyle(color: Colors.white70))),
          const Text('Demo mode: no real charge is made.', style: TextStyle(color: AppColors.muted, fontSize: 12)),
        ],
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
    await auth.saveProfiles([
      for (var j = 0; j < filled.length; j++)
        Profile(id: AuthStore.newId(), name: _names[filled[j]].text.trim(), avatar: j, kids: _kids[filled[j]]),
    ]);
    if (mounted) context.go('/profiles');
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
