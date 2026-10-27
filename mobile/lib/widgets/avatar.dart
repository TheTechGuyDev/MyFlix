import 'package:flutter/material.dart';

const avatarGradients = [
  [Color(0xFF34D399), Color(0xFF047857)],
  [Color(0xFF38BDF8), Color(0xFF1D4ED8)],
  [Color(0xFFFCD34D), Color(0xFFEA580C)],
  [Color(0xFFFB7185), Color(0xFFB91C1C)],
  [Color(0xFFA78BFA), Color(0xFF7E22CE)],
  [Color(0xFFBEF264), Color(0xFF15803D)],
  [Color(0xFFF472B6), Color(0xFFA21CAF)],
  [Color(0xFF67E8F9), Color(0xFF0F766E)],
];

class Avatar extends StatelessWidget {
  final int index;
  final double size;
  final bool kids;
  final double radius;
  const Avatar({super.key, required this.index, this.size = 96, this.kids = false, this.radius = 6});

  @override
  Widget build(BuildContext context) {
    final g = avatarGradients[index % avatarGradients.length];
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: g)),
        child: Stack(children: [
          Positioned.fill(child: CustomPaint(painter: _Face(index % 4))),
          if (kids)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                color: Colors.black38,
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text('KIDS',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: size * 0.11, fontWeight: FontWeight.w800, letterSpacing: 1)),
              ),
            ),
        ]),
      ),
    );
  }
}

class _Face extends CustomPainter {
  final int v;
  _Face(this.v);
  @override
  void paint(Canvas c, Size s) {
    final k = s.width / 100;
    final fill = Paint()..color = Colors.white.withValues(alpha: 0.95);
    final stroke = Paint()
      ..color = Colors.white.withValues(alpha: 0.95)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6 * k
      ..strokeCap = StrokeCap.round;
    switch (v) {
      case 0:
        c.drawCircle(Offset(35 * k, 42 * k), 5 * k, fill);
        c.drawCircle(Offset(65 * k, 42 * k), 5 * k, fill);
        c.drawPath(Path()..moveTo(30 * k, 62 * k)..quadraticBezierTo(50 * k, 80 * k, 70 * k, 62 * k), stroke);
      case 1:
        c.drawRRect(RRect.fromLTRBR(28 * k, 38 * k, 40 * k, 46 * k, Radius.circular(3 * k)), fill);
        c.drawRRect(RRect.fromLTRBR(60 * k, 38 * k, 72 * k, 46 * k, Radius.circular(3 * k)), fill);
        c.drawLine(Offset(36 * k, 66 * k), Offset(64 * k, 66 * k), stroke);
      case 2:
        c.drawCircle(Offset(35 * k, 42 * k), 6 * k, fill);
        c.drawCircle(Offset(65 * k, 42 * k), 6 * k, fill);
        c.drawOval(Rect.fromCenter(center: Offset(50 * k, 66 * k), width: 18 * k, height: 14 * k), fill);
      default:
        final s2 = Paint()
          ..color = Colors.white
          ..style = PaintingStyle.stroke
          ..strokeWidth = 5 * k
          ..strokeCap = StrokeCap.round;
        c.drawPath(Path()..moveTo(28 * k, 44 * k)..quadraticBezierTo(35 * k, 36 * k, 42 * k, 44 * k), s2);
        c.drawPath(Path()..moveTo(58 * k, 44 * k)..quadraticBezierTo(65 * k, 36 * k, 72 * k, 44 * k), s2);
        c.drawPath(Path()..moveTo(32 * k, 60 * k)..quadraticBezierTo(50 * k, 82 * k, 68 * k, 60 * k)..close(), fill);
    }
  }

  @override
  bool shouldRepaint(covariant _Face old) => old.v != v;
}
