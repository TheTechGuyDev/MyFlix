import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../data/messages.dart';
import '../theme.dart';

/// Demo-only: shows the emails/SMS the app "sends" so codes and reset links can be used
/// before an email/SMS provider is connected.
class DemoInbox extends StatelessWidget {
  final Widget child;
  final GoRouter router;
  const DemoInbox({super.key, required this.child, required this.router});

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      child,
      Positioned(
        left: 12,
        right: 12,
        top: MediaQuery.of(context).padding.top + 8,
        child: ListenableBuilder(
          listenable: Messages.instance,
          builder: (context, _) => Column(
            children: [
              for (final m in Messages.instance.inbox)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Material(
                    color: const Color(0xF2141416),
                    elevation: 8,
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(m.channel == 'sms' ? Icons.sms_outlined : m.channel == 'push' ? Icons.notifications_outlined : Icons.mail_outline, color: AppColors.brandBright, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('DEMO ${m.channel.toUpperCase()} TO ${m.to}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.brandBright, letterSpacing: 0.5)),
                            const SizedBox(height: 2),
                            Text(m.subject, style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
                            Text(m.body, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                            if (m.link != null)
                              GestureDetector(
                                onTap: () {
                                  Messages.instance.dismiss(m.id);
                                  router.go(m.link!);
                                },
                                child: const Padding(padding: EdgeInsets.only(top: 6), child: Text('Open link', style: TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w700))),
                              ),
                          ]),
                        ),
                        IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.close, size: 18, color: Colors.white60), onPressed: () => Messages.instance.dismiss(m.id)),
                      ]),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    ]);
  }
}
