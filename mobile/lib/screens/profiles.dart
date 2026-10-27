import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../data/auth_store.dart';
import '../data/models.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import '../widgets/common.dart';

class WhoIsWatchingScreen extends StatefulWidget {
  const WhoIsWatchingScreen({super.key});
  @override
  State<WhoIsWatchingScreen> createState() => _WhoIsWatchingScreenState();
}

class _WhoIsWatchingScreenState extends State<WhoIsWatchingScreen> {
  bool _manage = false;

  Future<void> _pick(Profile p) async {
    if (_manage) return _edit(p);
    if (p.settings.pin != null) {
      final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(fullscreenDialog: true, builder: (_) => PinScreen(profile: p)));
      if (ok != true) return;
    }
    if (!mounted) return;
    await context.read<AuthStore>().selectProfile(p.id);
    if (mounted) context.go('/home');
  }

  Future<void> _edit(Profile? p) async {
    final auth = context.read<AuthStore>();
    final profiles = auth.account!.profiles;
    await Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => ProfileEditor(
        profile: p,
        nextAvatar: profiles.length % avatarGradients.length,
        taken: profiles.where((x) => x.id != p?.id).map((x) => x.name.toLowerCase()).toList(),
        canDelete: p != null && profiles.length > 1,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final profiles = auth.account?.profiles ?? [];
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        leading: _manage ? null : const SizedBox(),
        title: _manage ? const Text('Manage Profiles', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)) : const Logo(size: 30),
        actions: [
          TextButton(
            onPressed: () => setState(() => _manage = !_manage),
            child: Text(_manage ? 'Done' : 'Edit', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(children: [
              Text(_manage ? 'Tap a profile to edit it' : "Who's watching?", style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
              const SizedBox(height: 32),
              Wrap(
                spacing: 24,
                runSpacing: 24,
                alignment: WrapAlignment.center,
                children: [
                  for (final p in profiles)
                    GestureDetector(
                      onTap: () => _pick(p),
                      child: SizedBox(
                        width: 110,
                        child: Column(children: [
                          Stack(alignment: Alignment.center, children: [
                            Opacity(opacity: _manage ? 0.45 : 1, child: Avatar(index: p.avatar, size: 110, kids: p.kids)),
                            if (_manage) Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)), child: const Icon(Icons.edit, size: 22)),
                            if (!_manage && p.settings.pin != null) const Positioned(right: 6, bottom: 6, child: Icon(Icons.lock, size: 18)),
                          ]),
                          const SizedBox(height: 10),
                          Text(p.name, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted, fontSize: 15)),
                        ]),
                      ),
                    ),
                  if (profiles.length < AuthStore.maxProfiles)
                    GestureDetector(
                      onTap: () => _edit(null),
                      child: SizedBox(
                        width: 110,
                        child: Column(children: [
                          Container(
                            width: 110,
                            height: 110,
                            decoration: BoxDecoration(borderRadius: BorderRadius.circular(6), border: Border.all(color: AppColors.line, width: 2)),
                            child: const Icon(Icons.add, size: 52, color: AppColors.muted),
                          ),
                          const SizedBox(height: 10),
                          const Text('Add Profile', style: TextStyle(color: AppColors.muted, fontSize: 15)),
                        ]),
                      ),
                    ),
                ],
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class PinScreen extends StatefulWidget {
  final Profile profile;
  const PinScreen({super.key, required this.profile});
  @override
  State<PinScreen> createState() => _PinScreenState();
}

class _PinScreenState extends State<PinScreen> {
  String _pin = '';
  bool _error = false;

  void _tap(String d) {
    if (_pin.length >= 4) return;
    setState(() {
      _pin += d;
      _error = false;
    });
    if (_pin.length == 4) {
      if (_pin == widget.profile.settings.pin) {
        Navigator.pop(context, true);
      } else {
        HapticFeedback.heavyImpact();
        setState(() {
          _error = true;
          _pin = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const CloseButton()),
      body: SafeArea(
        child: Column(children: [
          const SizedBox(height: 12),
          Avatar(index: widget.profile.avatar, size: 72, kids: widget.profile.kids),
          const SizedBox(height: 16),
          const Text('Profile Lock is on.', style: TextStyle(color: AppColors.muted)),
          const SizedBox(height: 6),
          Text('Enter your PIN to access ${widget.profile.name}.', textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
          const SizedBox(height: 28),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              4,
              (i) => Container(
                margin: const EdgeInsets.symmetric(horizontal: 8),
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i < _pin.length ? Colors.white : Colors.transparent,
                  border: Border.all(color: _error ? AppColors.danger : Colors.white70, width: 2),
                ),
              ),
            ),
          ),
          if (_error) const Padding(padding: EdgeInsets.only(top: 14), child: Text('Whoops, wrong PIN. Please try again.', style: TextStyle(color: AppColors.danger))),
          const Spacer(),
          for (final row in const [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '<']])
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (final k in row)
                  SizedBox(
                    width: 84,
                    height: 72,
                    child: k.isEmpty
                        ? null
                        : TextButton(
                            onPressed: () => k == '<' ? setState(() => _pin = _pin.isEmpty ? '' : _pin.substring(0, _pin.length - 1)) : _tap(k),
                            child: k == '<' ? const Icon(Icons.backspace_outlined, color: Colors.white) : Text(k, style: const TextStyle(fontSize: 28, color: Colors.white)),
                          ),
                  ),
              ],
            ),
          const SizedBox(height: 12),
          const Text('Forgot PIN? Change it from Account settings.', style: TextStyle(color: AppColors.muted, fontSize: 12)),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }
}

class ProfileEditor extends StatefulWidget {
  final Profile? profile;
  final int nextAvatar;
  final List<String> taken;
  final bool canDelete;
  const ProfileEditor({super.key, this.profile, required this.nextAvatar, required this.taken, required this.canDelete});
  @override
  State<ProfileEditor> createState() => _ProfileEditorState();
}

class _ProfileEditorState extends State<ProfileEditor> {
  late final _name = TextEditingController(text: widget.profile?.name ?? '');
  late int _avatar = widget.profile?.avatar ?? widget.nextAvatar;
  late bool _kids = widget.profile?.kids ?? false;
  String? _err;

  Future<void> _save() async {
    final n = _name.text.trim();
    if (n.isEmpty) return setState(() => _err = 'Please enter a name.');
    if (widget.taken.contains(n.toLowerCase())) return setState(() => _err = 'Another profile already uses this name.');
    final auth = context.read<AuthStore>();
    final list = [...auth.account!.profiles];
    if (widget.profile == null) {
      list.add(Profile(id: AuthStore.newId(), name: n, avatar: _avatar, kids: _kids));
    } else {
      final p = widget.profile!;
      p.name = n;
      p.avatar = _avatar;
      if (p.kids != _kids) p.settings.maturity = _kids ? '7+' : '18+';
      p.kids = _kids;
    }
    await auth.saveProfiles(list);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: AppColors.ink2,
        title: const Text('Delete profile?'),
        content: Text("${widget.profile!.name}'s history, ratings and My List will be gone forever."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Delete', style: TextStyle(color: AppColors.danger))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final auth = context.read<AuthStore>();
    await auth.saveProfiles(auth.account!.profiles.where((x) => x.id != widget.profile!.id).toList());
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const CloseButton(),
        title: Text(widget.profile == null ? 'Add Profile' : 'Edit Profile', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        actions: [TextButton(onPressed: _save, child: const Text('Save', style: TextStyle(color: AppColors.brandBright, fontWeight: FontWeight.w700, fontSize: 16)))],
      ),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        Center(child: Avatar(index: _avatar, size: 110, kids: _kids)),
        const SizedBox(height: 24),
        TextField(controller: _name, maxLength: 20, decoration: InputDecoration(labelText: 'Profile name', errorText: _err)),
        const SizedBox(height: 8),
        const Text('Choose an icon', style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 10),
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (var i = 0; i < avatarGradients.length; i++)
            GestureDetector(
              onTap: () => setState(() => _avatar = i),
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: _avatar == i ? Colors.white : Colors.transparent, width: 2)),
                child: Avatar(index: i, size: 52),
              ),
            ),
        ]),
        const SizedBox(height: 16),
        SwitchListTile(
          value: _kids,
          onChanged: (v) => setState(() => _kids = v),
          contentPadding: EdgeInsets.zero,
          activeThumbColor: AppColors.brandBright,
          title: const Text('Kids profile', style: TextStyle(fontWeight: FontWeight.w600)),
          subtitle: const Text('Only shows titles rated for 12 and under', style: TextStyle(color: AppColors.muted)),
        ),
        if (widget.canDelete) ...[
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: _delete,
            icon: const Icon(Icons.delete_outline, color: AppColors.danger),
            label: const Text('Delete Profile', style: TextStyle(color: AppColors.danger)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.danger), minimumSize: const Size.fromHeight(48)),
          ),
        ],
      ]),
    );
  }
}
