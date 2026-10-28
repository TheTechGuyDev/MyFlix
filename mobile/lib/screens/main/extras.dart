import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/auth_store.dart';
import '../../data/backend.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/tv_link.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'account.dart' show fmtDate;

const _site = siteUrl;

/* ======================= Viewing activity ======================= */
class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});
  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  int _tab = 0;
  @override
  Widget build(BuildContext context) {
    final lib = context.watch<LibraryStore>();
    final p = context.watch<AuthStore>().activeProfile!;
    final rated = lib.ratings.entries.toList();
    return Scaffold(
      appBar: AppBar(
        title: Text('${p.name}: Activity', style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          if (_tab == 0 && lib.activity.isNotEmpty)
            TextButton(
              onPressed: () async {
                final yes = await showDialog<bool>(
                  context: context,
                  builder: (d) => AlertDialog(
                    backgroundColor: AppColors.ink2,
                    title: const Text('Hide all viewing history?'),
                    content: const Text('Titles will stop influencing your recommendations.'),
                    actions: [TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Hide all'))],
                  ),
                );
                if (yes == true) lib.clearActivity();
              },
              child: const Text('Hide all', style: TextStyle(color: AppColors.danger)),
            ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: SegmentedButton<int>(
            segments: const [ButtonSegment(value: 0, label: Text('Watched')), ButtonSegment(value: 1, label: Text('Rated'))],
            selected: {_tab},
            onSelectionChanged: (s) => setState(() => _tab = s.first),
            style: SegmentedButton.styleFrom(selectedBackgroundColor: AppColors.brand, selectedForegroundColor: Colors.white),
          ),
        ),
        Expanded(
          child: _tab == 0
              ? (lib.activity.isEmpty
                  ? const Center(child: Text('Nothing watched on this profile yet.', style: TextStyle(color: AppColors.muted)))
                  : ListView.separated(
                      itemCount: lib.activity.length,
                      separatorBuilder: (_, _) => const Divider(color: AppColors.line, height: 1),
                      itemBuilder: (_, i) {
                        final a = lib.activity[i];
                        final t = Catalog.byId(a['titleId']);
                        return ListTile(
                          title: Text(t?.title ?? 'Removed title', style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text('${a['season'] != null ? 'S${a['season']}:E${a['episode']}  •  ' : ''}${fmtDate(a['at'])}', style: const TextStyle(color: AppColors.muted)),
                          trailing: IconButton(tooltip: 'Hide', icon: const Icon(Icons.visibility_off_outlined), onPressed: () => lib.hideActivity(a['at'])),
                          onTap: t == null ? null : () => context.push('/title/${t.id}'),
                        );
                      },
                    ))
              : (rated.isEmpty
                  ? const Center(child: Text('No ratings yet.', style: TextStyle(color: AppColors.muted)))
                  : ListView(children: [
                      for (final r in rated)
                        ListTile(
                          title: Text(Catalog.byId(r.key)?.title ?? r.key),
                          trailing: Text(r.value == 2 ? 'Love this!' : r.value == 1 ? 'I like this' : 'Not for me', style: const TextStyle(color: AppColors.muted)),
                        ),
                    ])),
        ),
      ]),
    );
  }
}

/* ======================= Data & screen time ======================= */
class DataUsageCard extends StatelessWidget {
  const DataUsageCard({super.key});
  @override
  Widget build(BuildContext context) {
    final lib = context.watch<LibraryStore>();
    final s = context.watch<AuthStore>().activeProfile!.settings;
    final cap = s.monthlyDataCapGB;
    final limit = s.dailyLimitMinutes;
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.data_usage, color: AppColors.brandBright),
          const SizedBox(width: 8),
          const Text('Data used this month', style: TextStyle(fontWeight: FontWeight.w700)),
          const Spacer(),
          Text('${lib.monthGb.toStringAsFixed(2)} GB${cap != null ? ' / $cap GB' : ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: cap != null ? (lib.monthGb / cap).clamp(0, 1) : (lib.monthGb / 10).clamp(0.02, 1), minHeight: 6, color: AppColors.brandBright, backgroundColor: Colors.white12),
        ),
        const SizedBox(height: 8),
        Text(
          '${lib.monthHours.toStringAsFixed(1)} hours watched${limit != null ? '  •  ${lib.todayMinutes}/$limit min today' : ''}',
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
      ]),
    );
  }
}

/* ======================= Invite friends ======================= */
class InviteScreen extends StatelessWidget {
  const InviteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final a = context.watch<AuthStore>().account!;
    final code = a.referralCode ?? '';
    final link = '$_site/signup?ref=$code';
    final msg = 'Join me on MyFlix: Nollywood, movies and series from ₦1,500. Use my code $code and we both get a free month: $link';
    return Scaffold(
      appBar: AppBar(title: const Text('Invite friends', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Icon(Icons.card_giftcard, size: 64, color: AppColors.brandBright),
        const SizedBox(height: 12),
        const Text('Give a month, get a month', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text('When a friend joins with your code and pays their first month, you both get one month free. Up to 12 free months a year.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70, height: 1.4)),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.brand)),
          child: Column(children: [
            const Text('Your code', style: TextStyle(color: AppColors.muted)),
            const SizedBox(height: 4),
            SelectableText(code, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: 4)),
          ]),
        ),
        const SizedBox(height: 18),
        PrimaryButton('Share invite', icon: Icons.share, onPressed: () => SharePlus.instance.share(ShareParams(text: msg))),
        const SizedBox(height: 10),
        PrimaryButton('Copy link', icon: Icons.copy, color: AppColors.ink3, onPressed: () {
          Clipboard.setData(ClipboardData(text: link));
          toast(context, 'Invite link copied.');
        }),
        if (a.referredBy != null) Padding(padding: const EdgeInsets.only(top: 16), child: Text('You joined with code ${a.referredBy}.', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.brandBright))),
      ]),
    );
  }
}

/* ======================= TV sign-in ======================= */
class TvSignInScreen extends StatefulWidget {
  const TvSignInScreen({super.key});
  @override
  State<TvSignInScreen> createState() => _TvSignInScreenState();
}

class _TvSignInScreenState extends State<TvSignInScreen> {
  final _code = TextEditingController();
  String? _err;
  bool _done = false, _loading = false;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in on TV', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Icon(Icons.tv, size: 64, color: AppColors.brandBright),
        const SizedBox(height: 12),
        Text(_done ? 'Your TV is signed in' : 'Enter the code on your TV', textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(
          _done ? 'Grab the remote and enjoy. The TV now appears under Account, Devices.' : 'Open MyFlix on your Smart TV (or the TV\'s web browser at thetechguydev.github.io/MyFlix/tv), and type the 8-digit code shown on screen.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white70, height: 1.4),
        ),
        if (!_done) ...[
          const SizedBox(height: 24),
          TextField(
            controller: _code,
            keyboardType: TextInputType.number,
            maxLength: 8,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 30, letterSpacing: 10, fontWeight: FontWeight.w700),
            decoration: InputDecoration(hintText: '00000000', counterText: '', errorText: _err),
          ),
          const SizedBox(height: 16),
          PrimaryButton('Sign in TV', loading: _loading, onPressed: () async {
            setState(() => _loading = true);
            final err = await TvLink.approve(_code.text);
            if (!mounted) return;
            setState(() {
              _loading = false;
              _err = err;
              _done = err == null;
            });
            if (err == null && context.mounted) context.read<AuthStore>().refresh();
          }),
        ],
      ]),
    );
  }
}

/* ======================= Help & contact ======================= */
Future<void> openLink(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) toast(context, "Couldn't open $url");
}

class ContactCard extends StatelessWidget {
  const ContactCard({super.key});
  @override
  Widget build(BuildContext context) {
    // Contact details come from admin Settings, so they're always current
    final st = Catalog.settings;
    final wa = '${st['supportWhatsapp'] ?? ''}'.replaceAll(RegExp(r'\D'), '');
    final phone = '${st['supportPhone'] ?? ''}'.trim();
    final email = '${st['supportEmail'] ?? ''}'.trim();
    return Container(
        margin: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppColors.ink2, borderRadius: BorderRadius.circular(12)),
        child: Column(children: [
          if (wa.isNotEmpty) ...[
            ListTile(leading: const Icon(Icons.chat, color: Color(0xFF25D366)), title: const Text('Chat on WhatsApp'), onTap: () => openLink(context, 'https://wa.me/$wa')),
            const Divider(color: AppColors.line, height: 1),
          ],
          if (phone.isNotEmpty) ...[
            ListTile(leading: const Icon(Icons.call_outlined), title: Text('Call $phone'), onTap: () => openLink(context, 'tel:${phone.replaceAll(' ', '')}')),
            const Divider(color: AppColors.line, height: 1),
          ],
          if (email.isNotEmpty) ...[
            ListTile(leading: const Icon(Icons.mail_outline), title: Text('Email $email'), onTap: () => openLink(context, 'mailto:$email')),
            const Divider(color: AppColors.line, height: 1),
          ],
          ListTile(leading: const Icon(Icons.support_agent), title: const Text('Send a message to support'), subtitle: const Text('Track replies in the Help Centre', style: TextStyle(color: AppColors.muted)), onTap: () => openLink(context, '$_site/help/')),
        ]),
      );
  }
}
