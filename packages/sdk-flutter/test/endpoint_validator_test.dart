import 'package:eodin_sdk/src/internal/endpoint_validator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('validateEndpoint — accepted', () {
    test('https://... passes', () {
      expect(() => validateEndpoint('https://api.eodin.app/api/v1'), returnsNormally);
      expect(() => validateEndpoint('https://api-staging.eodin.app/api/v1'), returnsNormally);
      expect(() => validateEndpoint('https://api.eodin.app:443/api/v1'), returnsNormally);
    });

    test('http://localhost / 127.0.0.1 passes', () {
      expect(() => validateEndpoint('http://localhost:3005/api/v1'), returnsNormally);
      expect(() => validateEndpoint('http://127.0.0.1:3005/api/v1'), returnsNormally);
    });

    test('http://10.0.2.2 passes in debug build (test runner = debug)', () {
      // flutter_test runs in debug mode (kDebugMode = true).
      expect(() => validateEndpoint('http://10.0.2.2:3005/api/v1'), returnsNormally);
    });

    test('case-insensitive scheme: HTTPS, HtTp localhost', () {
      expect(() => validateEndpoint('HTTPS://api.eodin.app/api/v1'), returnsNormally);
      expect(() => validateEndpoint('Http://localhost:3005/api/v1'), returnsNormally);
    });

    test('whitespace trimmed', () {
      expect(() => validateEndpoint('  https://api.eodin.app/api/v1  '), returnsNormally);
    });
  });

  group('validateEndpoint — rejected', () {
    test('plain http on non-loopback throws ArgumentError', () {
      expect(() => validateEndpoint('http://api.eodin.app/api/v1'),
          throwsA(isA<ArgumentError>()));
      expect(() => validateEndpoint('http://attacker.example.com/collect'),
          throwsA(isA<ArgumentError>()));
    });

    test('empty / whitespace-only throws ArgumentError', () {
      expect(() => validateEndpoint(''), throwsA(isA<ArgumentError>()));
      expect(() => validateEndpoint('   '), throwsA(isA<ArgumentError>()));
    });

    test('non-URL string throws ArgumentError', () {
      expect(() => validateEndpoint('not-a-url'), throwsA(isA<ArgumentError>()));
      expect(() => validateEndpoint('://no-scheme'), throwsA(isA<ArgumentError>()));
      expect(() => validateEndpoint('https://'), throwsA(isA<ArgumentError>()));
    });

    test('unsupported scheme (ftp, ws, file) throws ArgumentError', () {
      expect(() => validateEndpoint('ftp://api.eodin.app'), throwsA(isA<ArgumentError>()));
      expect(() => validateEndpoint('ws://api.eodin.app'), throwsA(isA<ArgumentError>()));
      expect(() => validateEndpoint('file:///etc/passwd'), throwsA(isA<ArgumentError>()));
    });

    test('confusable host like api.eodin.app.attacker.com is HTTPS so passes (host whitelist 보류 — open-issues §4.6)', () {
      // 본 테스트는 *현재 동작* 을 명시적으로 표현 — host 화이트리스트는 v2.x 보류 결정
      expect(() => validateEndpoint('https://api.eodin.app.attacker.com'),
          returnsNormally);
    });
  });
}
