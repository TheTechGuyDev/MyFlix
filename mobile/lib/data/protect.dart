import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';

/// Downloads are stored encrypted with a per-install key, so the files can't be copied off the
/// phone and played elsewhere. They are decrypted to a temporary file only while playing.
/// (Production: Widevine offline licences via the DRM provider.)
class Protect {
  static Uint8List? _key;

  static Future<Uint8List> _deviceKey() async {
    if (_key != null) return _key!;
    final dir = await getApplicationSupportDirectory();
    final f = File('${dir.path}/.mfx_key');
    if (!f.existsSync()) {
      final seed = '${DateTime.now().microsecondsSinceEpoch}-${dir.path}-${Object().hashCode}';
      f.writeAsBytesSync(sha256.convert(seed.codeUnits).bytes, flush: true);
    }
    return _key = Uint8List.fromList(f.readAsBytesSync());
  }

  /// XOR with a 4 KB pad derived from the device key (SHA-256 blocks). Same call encrypts and decrypts.
  static Future<Uint8List Function(List<int> chunk, int offset)> cipher() async {
    final key = await _deviceKey();
    final pad = Uint8List(4096);
    for (var i = 0; i < 128; i++) {
      pad.setRange(i * 32, i * 32 + 32, sha256.convert([...key, i]).bytes);
    }
    return (List<int> chunk, int offset) {
      final out = Uint8List(chunk.length);
      for (var j = 0; j < chunk.length; j++) {
        out[j] = chunk[j] ^ pad[(offset + j) & 4095];
      }
      return out;
    };
  }

  static Future<File> decryptToTemp(String path) async {
    final x = await cipher();
    final tmp = await getTemporaryDirectory();
    final out = File('${tmp.path}/play_${DateTime.now().millisecondsSinceEpoch}.mp4');
    final sink = out.openWrite();
    var offset = 0;
    await for (final chunk in File(path).openRead()) {
      sink.add(x(chunk, offset));
      offset += chunk.length;
    }
    await sink.close();
    return out;
  }
}
