import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/backend.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../data/messages.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/models.dart';
import '../../theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/common.dart';
import 'extras.dart';

String fmtDate(String? iso) {
  if (iso == null) return '';
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  const m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return '${d.day} ${m[d.month - 1]} ${d.year}';
}

String methodLabel(Payment? p) => p == null
    ? 'None'
    : p.method == 'card'
        ? 'Card ending in ${p.last4 ?? '••••'}'
        : p.method == 'transfer'
            ? 'Bank transfer'
            : p.method == 'credit'
                ? 'Credit or promo'
                : p.method == 'ussd'
                    ? 'USSD'
                    : 'Bank account';

void _open(String page) => launchUrl(Uri.parse('$siteUrl/$page/'), mode: LaunchMode.externalApplication);

Future<void> _redeemGift(BuildContext context) async {
  final auth = context.read<AuthStore>();
  final c = TextEditingController();
  String? err;
  bool loading = false;
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.ink2,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) => Padding(
        padding: EdgeInsets.fromLTRB(18, 18, 18, MediaQuery.of(ctx).viewInsets.bottom + 18),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Redeem a gift card', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('The amount is added to your account credit and used for your next payments.', style: TextStyle(color: AppColors.muted)),
          const SizedBox(height: 14),
          if (err != null) ...[AlertBox(err!), const SizedBox(height: 10)],
          AppField(label: 'Gift code (MYF-XXXX)', controller: c),
          const SizedBox(height: 16),
          PrimaryButton('Redeem', loading: loading, onPressed: () async {
            set(() => loading = true);
            final (e, n) = await auth.redeemGift(c.text);
            if (e != null) {
              set(() {
                err = e;
                loading = false;
              });
              return;
            }
            if (ctx.mounted) Navigator.pop(ctx);
            if (context.mounted) toast(context, '${naira(n ?? 0)} added to your account credit.');
          }),
        ]),
      ),
    ),
  );
}

class _Section extends StatelessWidget {
  final String? title;
  final List<Widget> children;
  const _Section({this.title, required this.children});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (title != null) Padding(padding: const EdgeInsets.fromLTRB(4, 8, 4, 8), child: Text(title!, style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w700, fontSize: 13))),
          Container(
            decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const Divider(color: AppColors.line, height: 1, indent: 16),
                children[i],
              ],
            ]),
          ),
        ]),
      );
}

Widget _row(String title, {String? sub, VoidCallback? onTap, Color? color, IconData? icon}) => ListTile(
      onTap: onTap,
      leading: icon == null ? null : Icon(icon, color: color),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
      subtitle: sub == null ? null : Text(sub, style: const TextStyle(color: AppColors.muted)),
      trailing: onTap == null ? null : const Icon(Icons.chevron_right, color: AppColors.muted),
    );

/* ======================= Account overview ======================= */
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final a = auth.account!;
    final plan = Catalog.plan(a.planId);
    final cancelled = a.cancelAt != null;
    return Scaffold(
      appBar: AppBar(title: const Text('Account', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(children: [
        Padding(padding: const EdgeInsets.fromLTRB(18, 4, 18, 14), child: Text('Member since ${fmtDate(a.createdAt)}', style: const TextStyle(color: AppColors.muted))),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
          child: Container(
            decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: const BoxDecoration(borderRadius: BorderRadius.vertical(top: Radius.circular(12)), gradient: LinearGradient(colors: [AppColors.brand, Color(0xFF0B4F33)])),
                child: Text(cancelled ? 'Membership ends ${fmtDate(a.cancelAt)}' : 'Membership details', style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${plan?.name ?? ''} plan', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(a.billingCycle == 'annual' && plan != null ? '${naira(annualPrice(plan))}/year  •  ${plan.resolution}' : '${naira(plan?.price ?? 0)}/month  •  ${plan?.resolution ?? ''}', style: const TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 8),
                  Text(!a.hasAccess ? 'No active membership' : cancelled ? "You won't be charged again." : a.cardReusable ? 'Next payment: ${fmtDate(a.paidUntil)}' : 'Paid until ${fmtDate(a.paidUntil)}. Renew before then to keep watching.', style: const TextStyle(color: AppColors.muted)),
                  Text(methodLabel(a.payment), style: const TextStyle(color: AppColors.muted)),
                  if (a.credit > 0) Text('Credit: ${naira(a.credit)}', style: const TextStyle(color: AppColors.brandBright)),
                  if (a.billingCycle == 'annual') const Text('Billed yearly', style: TextStyle(color: AppColors.muted)),
                  if (a.promoLabel != null) Text('Promo: ${a.promoLabel}', style: const TextStyle(color: AppColors.brandBright)),
                ]),
              ),
            ]),
          ),
        ),
        _Section(title: 'MEMBERSHIP', children: [
          _row('Change plan', onTap: () => context.push('/account/plan')),
          _row('Manage payment method', onTap: () => context.push('/account/payment')),
          _row('Billing history', sub: 'Receipts for every payment', onTap: () => context.push('/account/billing')),
          _row('Redeem gift card', sub: 'Add a MyFlix gift card to your credit', onTap: () => _redeemGift(context)),
          cancelled
              ? _row('Restart membership', color: AppColors.brandBright, onTap: () => context.push('/account/cancel'))
              : _row('Cancel membership', color: AppColors.danger, onTap: () => context.push('/account/cancel')),
        ]),
        _Section(title: 'SECURITY & PRIVACY', children: [
          _row('Email', sub: a.email, onTap: () => context.push('/account/security')),
          _row('Password & phone', sub: a.phone != null ? prettyPhone(a.phone!) : 'Add a phone number for SMS sign-in', onTap: () => context.push('/account/security')),
          _row('Devices', sub: '${auth.devices().length} signed in', onTap: () => context.push('/account/devices')),
          _row('Notification preferences', onTap: () => context.push('/account/notifications')),
        ]),
        _Section(title: 'YOUR DATA', children: [
          _row('Download your data', sub: 'A copy of your account, profiles and history', onTap: () => _export(context)),
          _row('Delete account', sub: 'Permanently remove your account', color: AppColors.danger, onTap: () => _delete(context)),
          _row('Privacy Policy', onTap: () => _open('privacy')),
          _row('Terms of Use', onTap: () => _open('terms')),
        ]),
        _Section(title: 'PROFILES & PARENTAL CONTROLS', children: [
          for (final p in a.profiles)
            ListTile(
              onTap: () => context.push('/profile-settings/${p.id}'),
              leading: Avatar(index: p.avatar, size: 40, kids: p.kids),
              title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${p.settings.language}  •  Maturity ${p.settings.maturity}${p.settings.pin != null ? '  •  PIN' : ''}', style: const TextStyle(color: AppColors.muted)),
              trailing: const Icon(Icons.chevron_right, color: AppColors.muted),
            ),
        ]),
        const SizedBox(height: 24),
      ]),
    );
  }
}

Future<void> _export(BuildContext context) async {
  toast(context, 'Preparing your data…');
  final (err, data) = await context.read<AuthStore>().exportData();
  if (!context.mounted) return;
  if (err != null) return toast(context, err);
  final text = const JsonEncoder.withIndent('  ').convert(data);
  await SharePlus.instance.share(ShareParams(text: text, subject: 'My MyFlix data'));
}

Future<void> _delete(BuildContext context) async {
  final auth = context.read<AuthStore>();
  final c = TextEditingController();
  String? err;
  bool loading = false;
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.ink2,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) => Padding(
        padding: EdgeInsets.fromLTRB(18, 18, 18, MediaQuery.of(ctx).viewInsets.bottom + 18),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Delete your account?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text(
            'This permanently deletes your account, profiles, My List, ratings and viewing history, and cancels your membership with no refund for the time left. Payment records are kept as tax law requires. This cannot be undone.',
            style: TextStyle(color: Colors.white70, height: 1.4),
          ),
          const SizedBox(height: 14),
          if (err != null) ...[AlertBox(err!), const SizedBox(height: 10)],
          AppField(label: 'Type your email to confirm', controller: c, keyboard: TextInputType.emailAddress),
          const SizedBox(height: 16),
          PrimaryButton('Delete my account', color: AppColors.danger, loading: loading, onPressed: () async {
            set(() => loading = true);
            final e = await auth.deleteAccount(c.text);
            if (e != null) {
              set(() {
                err = e;
                loading = false;
              });
              return;
            }
            if (ctx.mounted) Navigator.pop(ctx);
            if (context.mounted) context.go('/login');
          }),
        ]),
      ),
    ),
  );
}

/* ======================= Change plan ======================= */
class ChangePlanScreen extends StatefulWidget {
  const ChangePlanScreen({super.key});
  @override
  State<ChangePlanScreen> createState() => _ChangePlanScreenState();
}

class _ChangePlanScreenState extends State<ChangePlanScreen> {
  late String _sel = context.read<AuthStore>().account!.planId ?? (Catalog.plans.isEmpty ? '' : Catalog.plans.first.id);
  bool _loading = false;
  @override
  Widget build(BuildContext context) {
    final a = context.watch<AuthStore>().account!;
    final cur = Catalog.plan(a.planId);
    final chosen = Catalog.plan(_sel)!;
    return Scaffold(
      appBar: AppBar(title: const Text('Change plan', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(14), children: [
        for (final p in Catalog.plans)
          GestureDetector(
            onTap: () => setState(() => _sel = p.id),
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(12), border: Border.all(color: _sel == p.id ? AppColors.brandBright : AppColors.line, width: _sel == p.id ? 2 : 1)),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text(p.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      if (a.planId == p.id) ...[
                        const SizedBox(width: 8),
                        Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(10)), child: const Text('Current', style: TextStyle(fontSize: 11))),
                      ],
                    ]),
                    Text('${naira(p.price)}/month', style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('${p.resolution}  •  ${p.screens} screen${p.screens > 1 ? 's' : ''}  •  ${p.downloads} download device${p.downloads > 1 ? 's' : ''}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  ]),
                ),
                Icon(_sel == p.id ? Icons.check_circle : Icons.circle_outlined, color: _sel == p.id ? AppColors.brandBright : AppColors.muted),
              ]),
            ),
          ),
        if (_sel != a.planId) ...[
          const SizedBox(height: 8),
          Text(
            (cur != null && chosen.price > cur.price)
                ? "You'll get ${chosen.name} features right away. The difference is added to your next bill."
                : 'Your new price of ${naira(chosen.price)} starts on ${fmtDate(a.paidUntil)}.',
            style: const TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 14),
          PrimaryButton('Confirm change', loading: _loading, onPressed: () async {
            setState(() => _loading = true);
            final (err, msg) = await context.read<AuthStore>().changePlan(_sel);
            if (!context.mounted) return;
            setState(() => _loading = false);
            toast(context, err ?? msg ?? 'Done.');
            if (err == null) context.pop();
          }),
        ],
      ]),
    );
  }
}

/* ======================= Payment ======================= */
/// Card payments renew automatically. To change the card, Paystack checks the new one with a ₦50
/// charge that is refunded straight away.
class ManagePaymentScreen extends StatefulWidget {
  const ManagePaymentScreen({super.key});
  @override
  State<ManagePaymentScreen> createState() => _ManagePaymentScreenState();
}

class _ManagePaymentScreenState extends State<ManagePaymentScreen> with WidgetsBindingObserver {
  bool _loading = false, _waiting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _waiting) {
      _waiting = false;
      // The webhook saves the new card; give it a moment, then reload
      Future.delayed(const Duration(seconds: 2), () => mounted ? context.read<AuthStore>().refresh() : null);
    }
  }

  Future<void> _update() async {
    setState(() => _loading = true);
    final (err, url) = await context.read<AuthStore>().updatePaymentMethod();
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null || url == null) return toast(context, err ?? "Couldn't open Paystack. Try again.");
    _waiting = true;
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.watch<AuthStore>().account!;
    return Scaffold(
      appBar: AppBar(title: const Text('Payment method', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            const Icon(Icons.credit_card, size: 30),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(a.cardLast4 != null ? '${(a.cardType ?? 'Card').trim()} ending in ${a.cardLast4}' : 'No saved card', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                Text(a.cardReusable ? 'Used for automatic renewals' : 'You renew by paying before your membership ends', style: const TextStyle(color: AppColors.muted)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 18),
        PrimaryButton(a.cardLast4 != null ? 'Use a different card' : 'Add a card for automatic renewal', onPressed: _update, loading: _loading),
        const SizedBox(height: 14),
        const Text(
          "Paystack checks your card with a ₦50 charge that is refunded straight away. MyFlix never sees your card number. Paying by bank transfer or USSD? You'll pay for each period yourself; we'll remind you before it ends.",
          style: TextStyle(color: AppColors.muted, height: 1.4),
        ),
      ]),
    );
  }
}

/* ======================= Billing ======================= */
class BillingScreen extends StatelessWidget {
  const BillingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.watch<AuthStore>().account!;
    final rows = a.billing;
    return Scaffold(
      appBar: AppBar(title: const Text('Billing history', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(children: [
        if (a.payment != null && a.cancelAt == null)
          Padding(padding: const EdgeInsets.all(16), child: Text('${a.cardReusable ? 'Next payment' : 'Paid until'}: ${fmtDate(a.paidUntil)}', style: const TextStyle(color: AppColors.muted))),
        for (final r in rows)
          ListTile(
            title: Text('MyFlix ${Catalog.plan(r.planId)?.name ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('${fmtDate(r.date)}  •  ${methodLabel(Payment(method: r.method, last4: r.last4, paidAt: r.date, renewsAt: r.date))}  •  ${r.status}', style: const TextStyle(color: AppColors.muted)),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(naira(r.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
              GestureDetector(
                onTap: () => showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    backgroundColor: AppColors.ink2,
                    title: const Text('Receipt'),
                    content: Text(
                      'MyFlix ${Catalog.plan(r.planId)?.name ?? ''} plan\n${naira(r.amount)} · ${r.status}\n${fmtDate(r.date)}\nReference: ${r.id}\nBilled to: ${a.email}\n\nA copy was emailed to you when you paid.',
                      style: const TextStyle(height: 1.5),
                    ),
                    actions: [
                      TextButton(onPressed: () => SharePlus.instance.share(ShareParams(text: 'MyFlix receipt ${r.id}: ${naira(r.amount)} on ${fmtDate(r.date)} (${r.status})')), child: const Text('Share')),
                      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
                    ],
                  ),
                ),
                child: const Text('Receipt', style: TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w700, fontSize: 12)),
              ),
            ]),
          ),
        if (rows.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('No payments yet.', style: TextStyle(color: AppColors.muted))),
      ]),
    );
  }
}

/* ======================= Cancel / restart ======================= */
class CancelScreen extends StatefulWidget {
  const CancelScreen({super.key});
  @override
  State<CancelScreen> createState() => _CancelScreenState();
}

class _CancelScreenState extends State<CancelScreen> {
  bool _loading = false;
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final a = auth.account!;
    final cancelled = a.cancelAt != null;
    return Scaffold(
      appBar: AppBar(title: Text(cancelled ? 'Restart membership' : 'Cancel membership', style: const TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(18), children: [
        if (cancelled) ...[
          Text('Your membership ends on ${fmtDate(a.cancelAt)}.', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          const Text('Restart now to keep watching without interruption. Your profiles, My List and history are all still here.', style: TextStyle(color: Colors.white70, height: 1.4)),
          const SizedBox(height: 24),
          PrimaryButton('Restart Membership', loading: _loading, onPressed: () async {
            setState(() => _loading = true);
            final err = await auth.restartMembership();
            if (!context.mounted) return;
            setState(() => _loading = false);
            toast(context, err ?? 'Welcome back! Your membership has been restarted.');
            if (err == null) context.pop();
          }),
        ] else ...[
          for (final s in [
            'Your cancellation takes effect at the end of your billing period on ${fmtDate(a.paidUntil)}.',
            'You can keep watching until then.',
            'Restart anytime. Your profiles, My List and history are kept for 10 months.',
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('•  ', style: TextStyle(fontSize: 16)),
                Expanded(child: Text(s, style: const TextStyle(fontSize: 15, height: 1.4))),
              ]),
            ),
          const SizedBox(height: 18),
          PrimaryButton('Finish Cancellation', color: AppColors.danger, loading: _loading, onPressed: () async {
            setState(() => _loading = true);
            final err = await auth.cancelMembership();
            if (!context.mounted) return;
            setState(() => _loading = false);
            toast(context, err ?? 'Your membership has been cancelled.');
            if (err == null) context.pop();
          }),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => context.pop(),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: AppColors.line)),
            child: const Text('Go Back', style: TextStyle(color: Colors.white)),
          ),
        ],
      ]),
    );
  }
}

/* ======================= Security ======================= */
class SecurityScreen extends StatelessWidget {
  const SecurityScreen({super.key});

  Future<void> _form(BuildContext context, String mode) async {
    final auth = context.read<AuthStore>();
    final a = TextEditingController(text: mode == 'phone' ? auth.account?.phone ?? '' : '');
    final b = TextEditingController();
    final c = TextEditingController();
    String? err, sentTo;
    bool loading = false;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.ink2,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(18, 18, 18, MediaQuery.of(ctx).viewInsets.bottom + 18),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(mode == 'email' ? 'Change email' : mode == 'password' ? 'Change password' : 'Mobile phone', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            if (err != null) ...[AlertBox(err!), const SizedBox(height: 10)],
            if (mode == 'email') ...[
              AppField(label: 'New email', controller: a, keyboard: TextInputType.emailAddress),
              const SizedBox(height: 10),
              AppField(label: 'Current password', controller: b, password: true),
            ],
            if (mode == 'password') ...[
              AppField(label: 'Current password', controller: a, password: true),
              const SizedBox(height: 10),
              AppField(label: 'New password (6-60 characters)', controller: b, password: true),
              const SizedBox(height: 10),
              AppField(label: 'Re-enter new password', controller: c, password: true),
            ],
            if (mode == 'phone') ...[
              AppField(label: 'Phone number (e.g. 0803 123 4567)', controller: a, keyboard: TextInputType.phone),
              if (sentTo != null) ...[
                const SizedBox(height: 10),
                Text('We texted a 6-digit code to $sentTo.', style: const TextStyle(color: AppColors.muted)),
                const SizedBox(height: 8),
                AppField(label: '6-digit code', controller: b, keyboard: TextInputType.number),
              ],
            ],
            const SizedBox(height: 16),
            PrimaryButton(mode == 'phone' ? (sentTo == null ? 'Send code' : 'Verify') : 'Save', loading: loading, onPressed: () async {
              String? e;
              if (mode == 'email') {
                e = validateEmail(a.text) ?? (b.text.isEmpty ? 'Enter your password to confirm.' : null);
                if (e == null) {
                  set(() => loading = true);
                  e = await auth.changeEmail(a.text, b.text);
                }
              } else if (mode == 'password') {
                e = a.text.isEmpty ? 'Enter your current password.' : validatePassword(b.text) ?? (b.text != c.text ? "New passwords don't match." : null);
                if (e == null) {
                  set(() => loading = true);
                  e = await auth.changePassword(a.text, b.text);
                }
              } else {
                set(() => loading = true);
                if (sentTo == null) {
                  final (er, to) = await auth.requestPhoneCode(a.text);
                  set(() {
                    loading = false;
                    err = er;
                    sentTo = to;
                  });
                  return;
                }
                e = await auth.confirmPhone(a.text, b.text);
              }
              if (e != null) {
                set(() {
                  err = e;
                  loading = false;
                });
                return;
              }
              if (ctx.mounted) Navigator.pop(ctx);
              if (context.mounted) toast(context, mode == 'email' ? 'Check ${a.text.trim()} to confirm your new email.' : 'Saved.');
            }),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final a = auth.account!;
    return Scaffold(
      appBar: AppBar(title: const Text('Security', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(children: [
        const SizedBox(height: 8),
        _Section(children: [
          _row('Email', sub: a.email, onTap: () => _form(context, 'email')),
          _row('Password', sub: '••••••••', onTap: () => _form(context, 'password')),
          _row('Mobile phone', sub: a.phone != null ? '${prettyPhone(a.phone!)} · Verified' : 'Add to sign in with SMS codes and recover your account', onTap: () => _form(context, 'phone')),
        ]),
        _Section(title: 'SIGN OUT EVERYWHERE', children: [
          ListTile(
            title: const Text('Sign out of all devices', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: const Text('Signs MyFlix out on every TV, phone, tablet and computer, including this one.', style: TextStyle(color: AppColors.muted)),
            onTap: () async {
              final err = await auth.signOutEverywhere();
              if (err != null && context.mounted) return toast(context, err);
              if (context.mounted) context.go('/login');
            },
          ),
        ]),
      ]),
    );
  }
}

/* ======================= Devices ======================= */
class DevicesScreen extends StatelessWidget {
  const DevicesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    return Scaffold(
      appBar: AppBar(title: const Text('Devices', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(children: [
        const Padding(padding: EdgeInsets.all(16), child: Text('Devices that recently used your account.', style: TextStyle(color: AppColors.muted))),
        if (auth.devices().isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No devices yet.', style: TextStyle(color: AppColors.muted))),
        for (final d in auth.devices())
          ListTile(
            leading: Icon(d.kind == 'tv' ? Icons.tv : d.kind == 'web' ? Icons.laptop : Icons.phone_android),
            title: Row(children: [
              Flexible(child: Text(d.name, style: const TextStyle(fontWeight: FontWeight.w600))),
              if (d.current) ...[
                const SizedBox(width: 6),
                Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: AppColors.brand.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(4)), child: const Text('This device', style: TextStyle(fontSize: 11, color: AppColors.brandBright))),
              ],
            ]),
            subtitle: Text('${d.location ?? 'Nigeria'}  •  Last used ${fmtDate(d.lastSeen)}', style: const TextStyle(color: AppColors.muted)),
            trailing: d.current
                ? null
                : TextButton(
                    onPressed: () async {
                      final err = await auth.removeDevice(d.id);
                      if (context.mounted) toast(context, err ?? '${d.name} will be signed out.');
                    },
                    child: const Text('Sign out', style: TextStyle(color: AppColors.danger)),
                  ),
          ),
      ]),
    );
  }
}

/* ======================= Notification preferences ======================= */
class NotificationPrefsScreen extends StatelessWidget {
  const NotificationPrefsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final n = auth.account!.notifications;
    Widget sw(String k, String title, String sub) => SwitchListTile(
          value: n[k] ?? false,
          activeThumbColor: AppColors.brandBright,
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(sub, style: const TextStyle(color: AppColors.muted)),
          onChanged: (v) async {
            final err = await auth.updateNotifications({...n, k: v});
            if (err != null && context.mounted) toast(context, err);
          },
        );
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(children: [
        _Section(title: 'EMAIL', children: [
          sw('newArrivals', 'New arrivals', 'New titles and seasons'),
          sw('reminders', 'Reminders', 'When titles you asked about arrive'),
          sw('recommendations', 'Recommendations', 'Picks based on what you watch'),
          sw('offers', 'Special offers', 'Promotions and MyFlix news'),
          sw('billing', 'Billing and account', 'Receipts, payment issues and security alerts'),
        ]),
        _Section(title: 'PUSH', children: [sw('push', 'Allow push notifications', 'On this device')]),
      ]),
    );
  }
}

/* ======================= Profile settings ======================= */
class ProfileSettingsScreen extends StatefulWidget {
  final String id;
  const ProfileSettingsScreen({super.key, required this.id});
  @override
  State<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends State<ProfileSettingsScreen> {
  late final Profile? _p = context.read<AuthStore>().account?.profiles.where((x) => x.id == widget.id).firstOrNull;
  late final ProfileSettings _s = ProfileSettings.fromJson(_p?.settings.toJson(), _p?.kids ?? false);
  late bool _pinOn = _s.pin != null;
  late final _pin = TextEditingController();
  late final bool _hadPin = _s.pin != null;
  String? _err;

  Future<void> _save() async {
    final keep = _pinOn && _hadPin && _pin.text.isEmpty;
    if (_pinOn && !keep && !RegExp(r'^\d{4}$').hasMatch(_pin.text)) return setState(() => _err = 'Your PIN must be 4 digits.');
    _s.pin = !_pinOn ? null : keep ? pinSet : _pin.text;
    _p!.settings = _s;
    final err = await context.read<AuthStore>().updateProfile(_p);
    if (!mounted) return;
    if (err != null) return setState(() => _err = err);
    toast(context, "${_p.name}'s settings saved.");
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final p = _p;
    if (p == null) return const Scaffold(body: Center(child: Text('Profile not found')));
    const mats = [('All', 'All ages'), ('7+', '7+ Older kids'), ('13+', '13+ Teens'), ('16+', '16+ Young adults'), ('18+', '18+ Adults (all titles)')];
    const data = [('auto', 'Automatic', 'Best quality for your connection'), ('saver', 'Save Data', 'About 0.3 GB per hour'), ('hd', 'HD', 'Up to 3 GB per hour'), ('4k', 'Maximum', 'Up to 7 GB per hour (Premium)')];
    return Scaffold(
      appBar: AppBar(
        title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [TextButton(onPressed: _save, child: const Text('Save', style: TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w800, fontSize: 16)))],
      ),
      body: ListView(children: [
        Center(child: Padding(padding: const EdgeInsets.all(12), child: Avatar(index: p.avatar, size: 72, kids: p.kids))),
        _Section(title: 'LANGUAGE', children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: DropdownButtonFormField<String>(
              initialValue: _s.language,
              items: [for (final l in const ['English', 'Yorùbá', 'Hausa', 'Igbo', 'Pidgin']) DropdownMenuItem(value: l, child: Text(l))],
              onChanged: (v) => setState(() => _s.language = v!),
            ),
          ),
        ]),
        _Section(title: 'SCREEN TIME & DATA LIMITS', children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: DropdownButtonFormField<int>(
              initialValue: _s.dailyLimitMinutes ?? 0,
              decoration: const InputDecoration(labelText: 'Daily viewing limit'),
              items: [
                const DropdownMenuItem(value: 0, child: Text('No limit')),
                for (final m in const [30, 60, 90, 120, 180, 240]) DropdownMenuItem(value: m, child: Text(m >= 60 ? '${m ~/ 60} hour${m > 60 ? 's' : ''} a day${m % 60 != 0 ? ' 30 min' : ''}' : '$m minutes a day')),
              ],
              onChanged: (v) => setState(() => _s.dailyLimitMinutes = v == 0 ? null : v),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: DropdownButtonFormField<int>(
              initialValue: _s.monthlyDataCapGB ?? 0,
              decoration: const InputDecoration(labelText: 'Monthly data cap'),
              items: [
                const DropdownMenuItem(value: 0, child: Text('No cap')),
                for (final g in const [2, 5, 10, 20, 50]) DropdownMenuItem(value: g, child: Text('$g GB a month')),
              ],
              onChanged: (v) => setState(() => _s.monthlyDataCapGB = v == 0 ? null : v),
            ),
          ),
        ]),
        _Section(title: 'VIEWING RESTRICTIONS', children: [
          for (final m in mats.where((m) => !p.kids || m.$1 == 'All' || m.$1 == '7+'))
            ListTile(
              onTap: () => setState(() => _s.maturity = m.$1),
              leading: Icon(_s.maturity == m.$1 ? Icons.radio_button_checked : Icons.radio_button_off, color: _s.maturity == m.$1 ? AppColors.brandBright : AppColors.muted),
              title: Text(m.$2),
            ),
        ]),
        _Section(title: 'PROFILE LOCK', children: [
          SwitchListTile(
            value: _pinOn,
            activeThumbColor: AppColors.brandBright,
            onChanged: (v) => setState(() => _pinOn = v),
            title: const Text('Require a PIN', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: const Text('Stops others in your home using this profile', style: TextStyle(color: AppColors.muted)),
          ),
          if (_pinOn)
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _pin,
                keyboardType: TextInputType.number,
                maxLength: 4,
                obscureText: true,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 26, letterSpacing: 16),
                decoration: InputDecoration(hintText: '••••', helperText: _hadPin ? 'Leave blank to keep the current PIN' : 'Choose 4 digits', errorText: _err, counterText: ''),
              ),
            ),
        ]),
        _Section(title: 'PLAYBACK', children: [
          SwitchListTile(value: _s.autoplayNext, activeThumbColor: AppColors.brandBright, onChanged: (v) => setState(() => _s.autoplayNext = v), title: const Text('Autoplay next episode')),
          SwitchListTile(value: _s.autoplayPreviews, activeThumbColor: AppColors.brandBright, onChanged: (v) => setState(() => _s.autoplayPreviews = v), title: const Text('Autoplay previews')),
          for (final d in data)
            ListTile(
              onTap: () => setState(() => _s.dataUsage = d.$1),
              leading: Icon(_s.dataUsage == d.$1 ? Icons.radio_button_checked : Icons.radio_button_off, color: _s.dataUsage == d.$1 ? AppColors.brandBright : AppColors.muted),
              title: Text(d.$2),
              subtitle: Text(d.$3, style: const TextStyle(color: AppColors.muted)),
            ),
        ]),
        _Section(title: 'SUBTITLE APPEARANCE', children: [
          Container(
            height: 90,
            margin: const EdgeInsets.all(12),
            alignment: Alignment.bottomCenter,
            padding: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), gradient: const LinearGradient(colors: [Color(0xFF3F3F46), Color(0xFF18181B)])),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              color: _s.subtitleBg == 'box' ? Colors.black87 : Colors.transparent,
              child: Text(
                'This is how subtitles will look.',
                style: TextStyle(fontSize: _s.subtitleSize == 'small' ? 13 : _s.subtitleSize == 'large' ? 21 : 16, shadows: _s.subtitleBg == 'shadow' ? const [Shadow(blurRadius: 4), Shadow(blurRadius: 4)] : null),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _s.subtitleSize,
                  decoration: const InputDecoration(labelText: 'Size'),
                  items: const [DropdownMenuItem(value: 'small', child: Text('Small')), DropdownMenuItem(value: 'medium', child: Text('Medium')), DropdownMenuItem(value: 'large', child: Text('Large'))],
                  onChanged: (v) => setState(() => _s.subtitleSize = v!),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _s.subtitleBg,
                  decoration: const InputDecoration(labelText: 'Background'),
                  items: const [DropdownMenuItem(value: 'none', child: Text('None')), DropdownMenuItem(value: 'shadow', child: Text('Shadow')), DropdownMenuItem(value: 'box', child: Text('Box'))],
                  onChanged: (v) => setState(() => _s.subtitleBg = v!),
                ),
              ),
            ]),
          ),
        ]),
        Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 30), child: PrimaryButton('Save', onPressed: _save)),
      ]),
    );
  }
}

/* ======================= App settings ======================= */
class AppSettingsScreen extends StatelessWidget {
  const AppSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final lib = context.watch<LibraryStore>();
    final mb = lib.downloadedBytes / (1 << 20);
    return Scaffold(
      appBar: AppBar(title: const Text('App Settings', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(children: [
        _Section(title: 'VIDEO PLAYBACK', children: [
          ListTile(
            title: const Text('Mobile data usage', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text({'auto': 'Automatic', 'wifi': 'Wi-Fi only', 'saver': 'Save data', 'max': 'Maximum data'}[lib.cellularData]!, style: const TextStyle(color: AppColors.muted)),
            trailing: const Icon(Icons.chevron_right, color: AppColors.muted),
            onTap: () => showModalBottomSheet(
              context: context,
              backgroundColor: AppColors.ink2,
              builder: (c) => SafeArea(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  for (final o in const [('auto', 'Automatic', 'Balance quality and data'), ('wifi', 'Wi-Fi only', 'Never stream on mobile data'), ('saver', 'Save data', 'About 0.3 GB per hour'), ('max', 'Maximum data', 'Best quality, uses more data')])
                    ListTile(
                      leading: Icon(lib.cellularData == o.$1 ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.brandBright),
                      title: Text(o.$2),
                      subtitle: Text(o.$3, style: const TextStyle(color: AppColors.muted)),
                      onTap: () {
                        lib.setCellular(o.$1);
                        Navigator.pop(c);
                      },
                    ),
                ]),
              ),
            ),
          ),
        ]),
        _Section(title: 'DOWNLOADS', children: [
          SwitchListTile(
            value: lib.wifiOnly,
            activeThumbColor: AppColors.brandBright,
            onChanged: lib.setWifiOnly,
            title: const Text('Wi-Fi only', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: const Text('Only download when connected to Wi-Fi', style: TextStyle(color: AppColors.muted)),
          ),
          ListTile(
            title: const Text('Download video quality', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(lib.downloadQuality == 'higher' ? 'Higher (uses more storage)' : 'Standard (downloads faster, uses less storage)', style: const TextStyle(color: AppColors.muted)),
            onTap: () => lib.setDownloadQuality(lib.downloadQuality == 'higher' ? 'standard' : 'higher'),
            trailing: const Icon(Icons.swap_horiz, color: AppColors.muted),
          ),
          ListTile(
            title: const Text('Delete all downloads', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.danger)),
            subtitle: Text('Frees ${mb.toStringAsFixed(1)} MB on this device', style: const TextStyle(color: AppColors.muted)),
            onTap: () async {
              final yes = await showDialog<bool>(
                context: context,
                builder: (d) => AlertDialog(
                  backgroundColor: AppColors.ink2,
                  title: const Text('Delete all downloads?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
                    TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Delete', style: TextStyle(color: AppColors.danger))),
                  ],
                ),
              );
              if (yes == true) await lib.deleteAllDownloads();
            },
          ),
        ]),
        _Section(title: 'STORAGE', children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(value: (mb / 2048).clamp(0.01, 1), minHeight: 8, color: AppColors.brandBright, backgroundColor: Colors.white12),
              ),
              const SizedBox(height: 8),
              Text('MyFlix: ${mb.toStringAsFixed(1)} MB used', style: const TextStyle(color: AppColors.muted)),
            ]),
          ),
        ]),
        _Section(title: 'ABOUT', children: [
          _row('Account', onTap: () => context.push('/account')),
          _row('Help Centre', onTap: () => context.push('/help')),
          const ListTile(title: Text('App version'), trailing: Text('1.0.0', style: TextStyle(color: AppColors.muted))),
        ]),
      ]),
    );
  }
}

/* ======================= Help ======================= */
class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});
  @override
  Widget build(BuildContext context) {
    const faqs = [
      ('How do I pay?', 'Pay with your debit card, bank transfer or USSD. Change your payment method anytime under Account.'),
      ('How much data does MyFlix use?', 'Save Data uses about 0.3 GB per hour, HD about 3 GB per hour and 4K about 7 GB per hour. Set it per profile in Profile Settings.'),
      ('How do downloads work?', 'Tap Download on any title or episode. Downloads play without internet from the Downloads screen.'),
      ('How do I cancel?', 'Go to Account, then Cancel membership. You keep watching until the end of your billing period.'),
      ('How do I lock a profile?', 'Open Profile Settings, turn on Profile Lock and set a 4-digit PIN.'),
      ('Why does a title look different on my plan?', 'Your plan sets the highest quality: Mobile 480p, Basic 720p, Standard 1080p, Premium 4K.'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Help Centre', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(children: [
        for (final f in faqs)
          ExpansionTile(
            title: Text(f.$1, style: const TextStyle(fontWeight: FontWeight.w600)),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            children: [Text(f.$2, style: const TextStyle(color: Colors.white70, height: 1.4))],
          ),
        const ContactCard(),
      ]),
    );
  }
}
