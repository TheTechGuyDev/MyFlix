import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/auth_store.dart';
import '../../data/catalog.dart';
import '../../data/library_store.dart';
import '../../data/models.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/titles.dart';

const genres = ['Nollywood', 'Drama', 'Comedy', 'Thriller', 'Crime', 'Romance', 'Action', 'Horror', 'Family', 'Kids', 'Documentary', 'Mystery', 'Adventure', 'Business'];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _filter = 'all';
  final _scroll = ScrollController();
  double _offset = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() => setState(() => _offset = _scroll.offset));
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _categories() {
    showGeneralDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.92),
      barrierDismissible: true,
      barrierLabel: 'Categories',
      pageBuilder: (c, _, _) => SafeArea(
        child: Material(
          color: Colors.transparent,
          child: Stack(children: [
            ListView(padding: const EdgeInsets.symmetric(vertical: 60), children: [
              for (final g in ['Home', 'My List', ...genres])
                TextButton(
                  onPressed: () {
                    Navigator.pop(c);
                    if (g == 'Home') return setState(() => _filter = 'all');
                    if (g == 'My List') {
                      context.push('/mylist');
                      return;
                    }
                    context.push('/category/${Uri.encodeComponent(g)}');
                  },
                  child: Text(g, style: const TextStyle(color: Colors.white70, fontSize: 19)),
                ),
            ]),
            Positioned(
              left: 0,
              right: 0,
              bottom: 16,
              child: Center(
                child: FloatingActionButton(backgroundColor: Colors.white, foregroundColor: AppColors.ink, onPressed: () => Navigator.pop(c), child: const Icon(Icons.close)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final lib = context.watch<LibraryStore>();
    final p = auth.activeProfile!;
    final kids = p.kids;
    final max = p.settings.maturity;
    final hero = Catalog.featured(filter: _filter, kids: kids, max: max);
    final rows = Catalog.rows(filter: _filter, kids: kids, max: max);
    final cont = (lib.progress.entries.toList()..sort((a, b) => b.value.updatedAt.compareTo(a.value.updatedAt)))
        .map((e) => Catalog.byId(e.key))
        .whereType<MediaTitle>()
        .where((t) => (!kids || t.kids) && Catalog.allowed(t, max))
        .where((t) => _filter == 'all' || (_filter == 'series') == t.isSeries)
        .toList();
    final myList = lib.list.map(Catalog.byId).whereType<MediaTitle>().where((t) => Catalog.allowed(t, max) && (!kids || t.kids)).toList();
    final topBg = Color.lerp(Colors.transparent, AppColors.ink.withValues(alpha: 0.95), (_offset / 200).clamp(0, 1))!;

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(children: [
        ListView(
          controller: _scroll,
          padding: EdgeInsets.zero,
          children: [
            _Hero(t: hero, topPadding: MediaQuery.of(context).padding.top + 108),
            if (cont.isNotEmpty)
              RowSection(title: 'Continue Watching for ${p.name}', height: 228, children: [for (final t in cont) ContinueCard(t)]),
            for (var i = 0; i < rows.length; i++) ...[
              if (i == 1 && myList.isNotEmpty && _filter == 'all')
                RowSection(title: 'My List', onTitleTap: () => context.push('/mylist'), children: [for (final t in myList) PosterCard(t)]),
              rows[i].ranked
                  ? RowSection(title: rows[i].title, children: [for (var j = 0; j < rows[i].items.length; j++) RankedCard(rows[i].items[j], j + 1)])
                  : RowSection(
                      title: rows[i].title,
                      height: rows[i].tall ? 270 : 168,
                      children: [for (final t in rows[i].items) PosterCard(t, width: rows[i].tall ? 180 : 112)],
                    ),
            ],
            const SizedBox(height: 24),
          ],
        ),
        // Top bar + chips
        Container(
          color: topBg,
          child: SafeArea(
            bottom: false,
            child: Column(children: [
              SizedBox(
                height: 52,
                child: Row(children: [
                  const SizedBox(width: 14),
                  if (_filter == 'all')
                    kids
                        ? Row(children: [
                            const Logo(size: 30),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(4)),
                              child: const Text('KIDS', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                            ),
                          ])
                        : Text('For ${p.name}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800))
                  else
                    IconButton(onPressed: () => setState(() => _filter = 'all'), icon: const Icon(Icons.close)),
                  const Spacer(),
                  IconButton(onPressed: () => context.push('/downloads'), icon: const Icon(Icons.download_outlined)),
                  IconButton(onPressed: () => context.push('/search'), icon: const Icon(Icons.search)),
                  const SizedBox(width: 4),
                ]),
              ),
              SizedBox(
                height: 44,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 14), children: [
                  if (_filter != 'movies') _Chip(label: 'Series', on: _filter == 'series', onTap: () => setState(() => _filter = _filter == 'series' ? 'all' : 'series')),
                  if (_filter != 'series') _Chip(label: 'Movies', on: _filter == 'movies', onTap: () => setState(() => _filter = _filter == 'movies' ? 'all' : 'movies')),
                  _Chip(label: 'Categories', trailing: Icons.keyboard_arrow_down, onTap: _categories),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool on;
  final IconData? trailing;
  final VoidCallback onTap;
  const _Chip({required this.label, this.on = false, this.trailing, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 8, top: 4, bottom: 6),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: on ? Colors.white24 : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: on ? Colors.white : Colors.white54),
            ),
            child: Row(children: [
              Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              if (trailing != null) Icon(trailing, size: 18),
            ]),
          ),
        ),
      );
}

class _Hero extends StatelessWidget {
  final MediaTitle t;
  final double topPadding;
  const _Hero({required this.t, required this.topPadding});

  @override
  Widget build(BuildContext context) {
    final lib = context.watch<LibraryStore>();
    final inList = lib.inList(t.id);
    return Container(
      padding: EdgeInsets.fromLTRB(22, topPadding, 22, 26),
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [AppColors.brand.withValues(alpha: 0.35), AppColors.ink]),
      ),
      child: GestureDetector(
        onTap: () => openTitle(context, t),
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 30, offset: Offset(0, 12))]),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: 0.72,
              child: Stack(fit: StackFit.expand, children: [
                NetImage(img(t.image, w: 800, h: 1100)),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.transparent, Colors.black87], stops: [0, 0.45, 1]),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Column(children: [
                    if (t.original)
                      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Text('M', style: TextStyle(fontFamily: kDisplay, fontSize: 22, color: AppColors.brandBright)),
                        const SizedBox(width: 6),
                        Text(t.isSeries ? 'S E R I E S' : 'F I L M', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                      ]),
                    Text(t.title.toUpperCase(), textAlign: TextAlign.center, style: const TextStyle(fontFamily: kDisplay, fontSize: 52, height: 0.95)),
                    const SizedBox(height: 6),
                    Text(t.tags.followedBy(t.genres.take(2)).join('  •  '), style: const TextStyle(fontSize: 12, color: Colors.white)),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => playTitle(context, t),
                          icon: const Icon(Icons.play_arrow, size: 26),
                          label: const Text('Play', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.ink, minimumSize: const Size.fromHeight(44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5))),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => lib.toggleList(t.id),
                          icon: Icon(inList ? Icons.check : Icons.add, size: 24),
                          label: const Text('My List', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          style: FilledButton.styleFrom(backgroundColor: Colors.white24, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5))),
                        ),
                      ),
                    ]),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Genre grid opened from Categories.
class CategoryScreen extends StatelessWidget {
  final String genre;
  const CategoryScreen({super.key, required this.genre});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<AuthStore>().activeProfile!;
    final items = Catalog.visible(kids: p.kids, max: p.settings.maturity).where((t) => t.genres.contains(genre)).toList();
    return Scaffold(
      appBar: AppBar(title: Text(genre, style: const TextStyle(fontWeight: FontWeight.w800))),
      body: items.isEmpty
          ? Center(child: Text('No $genre titles for this profile.', style: const TextStyle(color: AppColors.muted)))
          : GridView.builder(
              padding: const EdgeInsets.all(14),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, childAspectRatio: 2 / 3, mainAxisSpacing: 8, crossAxisSpacing: 8),
              itemCount: items.length,
              itemBuilder: (_, i) => PosterCard(items[i], width: double.infinity),
            ),
    );
  }
}
