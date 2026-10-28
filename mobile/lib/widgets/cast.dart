import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../data/cast.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../theme.dart';
import 'common.dart';

/// Cast icon for app bars. Opens the device picker.
class CastButton extends StatelessWidget {
  final void Function(String device)? onConnected;
  const CastButton({super.key, this.onConnected});

  @override
  Widget build(BuildContext context) {
    final cast = context.watch<CastStore>();
    return IconButton(
      tooltip: 'Cast',
      icon: Icon(cast.connected ? Icons.cast_connected : Icons.cast, color: cast.connected ? AppColors.brandBright : null),
      onPressed: () => showCastSheet(context, onConnected: onConnected),
    );
  }
}

Future<void> showCastSheet(BuildContext context, {void Function(String device)? onConnected}) {
  final cast = context.read<CastStore>();
  if (!cast.connected) cast.scan();
  return showModalBottomSheet(
    context: context,
    backgroundColor: AppColors.ink2,
    builder: (ctx) => ListenableBuilder(
      listenable: cast,
      builder: (ctx, _) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(cast.connected ? 'Connected to ${cast.device}' : 'Cast to', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(cast.connected ? 'Control playback from the bar at the bottom of the app.' : 'Devices on your Wi-Fi network', style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 8),
            if (cast.scanning) const Padding(padding: EdgeInsets.all(16), child: Row(children: [SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)), SizedBox(width: 12), Text('Looking for devices…')])),
            if (!CastStore.supported)
              const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Cast from the MyFlix app on your phone, or use the Cast button in your browser\'s player.', style: TextStyle(color: Colors.white70))),
            if (cast.error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(cast.error!, style: const TextStyle(color: AppColors.danger))),
            if (CastStore.supported && !cast.scanning && !cast.connected && cast.found.isEmpty)
              Row(children: [
                const Expanded(child: Text('No TVs found on this Wi-Fi.', style: TextStyle(color: Colors.white70))),
                TextButton(onPressed: cast.scan, child: const Text('Search again')),
              ]),
            if (!cast.scanning && !cast.connected)
              for (final d in cast.found)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(d.name.toLowerCase().contains('chromecast') ? Icons.cast : Icons.tv),
                  title: Text(d.name),
                  onTap: () async {
                    Navigator.pop(ctx);
                    toast(context, 'Connecting to ${d.name}…');
                    if (await cast.connect(d)) {
                      onConnected?.call(d.name);
                      if (context.mounted) toast(context, 'Connected to ${d.name}.');
                    } else if (context.mounted) {
                      toast(context, cast.error ?? "Couldn't connect.");
                    }
                  },
                ),
            if (cast.connected)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.cast_connected, color: AppColors.danger),
                title: const Text('Stop casting'),
                onTap: () {
                  cast.disconnect();
                  Navigator.pop(ctx);
                },
              ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text("Don't see your TV? Check it's on the same Wi-Fi, or open MyFlix on the TV and sign in with a code.", style: TextStyle(color: AppColors.muted, fontSize: 12)),
            ),
            TextButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                context.push('/tv');
              },
              icon: const Icon(Icons.tv, size: 18),
              label: const Text('Sign in on a Smart TV with a code'),
            ),
          ]),
        ),
      ),
    ),
  );
}

/// Mini controller shown above the bottom navigation while casting.
class CastMiniBar extends StatelessWidget {
  const CastMiniBar({super.key});

  @override
  Widget build(BuildContext context) {
    final cast = context.watch<CastStore>();
    if (!cast.connected || cast.titleId == null) return const SizedBox.shrink();
    final MediaTitle? t = Catalog.byId(cast.titleId!);
    final p = cast.position;
    final time = '${p.inMinutes}:${(p.inSeconds % 60).toString().padLeft(2, '0')}';
    return Material(
      color: AppColors.ink3,
      child: InkWell(
        onTap: () => t == null ? null : context.push('/title/${t.id}'),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
          child: Row(children: [
            const Icon(Icons.cast_connected, color: AppColors.brandBright, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(cast.label ?? t?.title ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('Playing on ${cast.device} · $time', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              ]),
            ),
            IconButton(icon: Icon(cast.playing ? Icons.pause : Icons.play_arrow), onPressed: cast.toggle),
            IconButton(icon: const Icon(Icons.close), onPressed: cast.disconnect),
          ]),
        ),
      ),
    );
  }
}
