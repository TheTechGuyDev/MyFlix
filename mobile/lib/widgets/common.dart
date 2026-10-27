import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../theme.dart';

class Logo extends StatelessWidget {
  final double size;
  const Logo({super.key, this.size = 34});
  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: TextStyle(fontFamily: kDisplay, fontSize: size, height: 1, letterSpacing: 1),
        children: [
          const TextSpan(text: 'MY', style: TextStyle(color: Colors.white)),
          TextSpan(
            text: 'FLIX',
            style: TextStyle(
              foreground: Paint()
                ..shader = const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppColors.brandBright, AppColors.brand],
                ).createShader(Rect.fromLTWH(0, 0, size * 2, size)),
            ),
          ),
        ],
      ),
    );
  }
}

class NetImage extends StatelessWidget {
  final String url;
  final BoxFit fit;
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover});
  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: url,
      fit: fit,
      fadeInDuration: const Duration(milliseconds: 250),
      placeholder: (_, _) => Container(color: AppColors.ink3),
      errorWidget: (_, _, _) => Container(
        color: AppColors.ink3,
        alignment: Alignment.center,
        child: const Icon(Icons.movie_outlined, color: AppColors.line, size: 32),
      ),
    );
  }
}

class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final Color color;
  final Color textColor;
  final double height;
  const PrimaryButton(
    this.label, {
    super.key,
    this.onPressed,
    this.loading = false,
    this.icon,
    this.color = AppColors.brand,
    this.textColor = Colors.white,
    this.height = 54,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          foregroundColor: textColor,
          disabledBackgroundColor: color.withValues(alpha: 0.6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w700),
        ),
        child: loading
            ? SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5, color: textColor))
            : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[Icon(icon, size: 22), const SizedBox(width: 8)],
                Text(label),
              ]),
      ),
    );
  }
}

class AppField extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final String? errorText;
  final bool password;
  final TextInputType? keyboard;
  final ValueChanged<String>? onChanged;
  final List<String>? autofill;
  final TextInputAction? action;
  final ValueChanged<String>? onSubmitted;
  const AppField({
    super.key,
    required this.label,
    required this.controller,
    this.errorText,
    this.password = false,
    this.keyboard,
    this.onChanged,
    this.autofill,
    this.action,
    this.onSubmitted,
  });
  @override
  State<AppField> createState() => _AppFieldState();
}

class _AppFieldState extends State<AppField> {
  bool _hidden = true;
  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: widget.password && _hidden,
      keyboardType: widget.keyboard,
      onChanged: widget.onChanged,
      autofillHints: widget.autofill,
      textInputAction: widget.action,
      onSubmitted: widget.onSubmitted,
      style: const TextStyle(fontSize: 16),
      decoration: InputDecoration(
        labelText: widget.label,
        errorText: widget.errorText,
        errorMaxLines: 3,
        suffixIcon: widget.password
            ? TextButton(
                onPressed: () => setState(() => _hidden = !_hidden),
                child: Text(_hidden ? 'SHOW' : 'HIDE', style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w700)),
              )
            : null,
      ),
    );
  }
}

class AlertBox extends StatelessWidget {
  final String text;
  const AlertBox(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFFE87C03), borderRadius: BorderRadius.circular(6)),
        child: Text(text, style: const TextStyle(fontSize: 14)),
      );
}

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');
String? validateEmail(String v) {
  if (v.trim().isEmpty) return 'Email is required.';
  if (!_emailRe.hasMatch(v.trim())) return 'Please enter a valid email address.';
  return null;
}

String? validatePassword(String v) {
  if (v.isEmpty) return 'Password is required.';
  if (v.length < 6) return 'Your password must contain at least 6 characters.';
  if (v.length > 60) return 'Your password must contain no more than 60 characters.';
  return null;
}

void toast(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg)));
}
