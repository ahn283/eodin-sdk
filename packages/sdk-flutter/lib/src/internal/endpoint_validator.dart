import 'package:flutter/foundation.dart';

/// Internal endpoint validator shared between EodinAnalytics and EodinDeeplink.
///
/// S8 보안 정책 (Phase 1.6): SDK 의 모든 API endpoint 는 HTTPS 만 허용.
///
/// 단 dev / emulator 워크플로우 유지를 위해 다음 loopback 주소의 `http://` 는 허용:
/// - `localhost` / `127.0.0.1` — 모든 빌드 (release 포함). release 에서도
///   mixed-content / iOS ATS 가 보호하므로 위험 작음
/// - `10.0.2.2` — **debug build 만**. Android emulator → host machine 전용
///   주소이므로 release APK 에 들어가면 사용자 단말의 사설망 IP 와 충돌해
///   plain-text 데이터 leak 가능 (코드리뷰 H1)
///
/// 그 외 `http://` 주소는 [ArgumentError] 로 throw — 호출자
/// (`EodinAnalytics.configure` / `EodinDeeplink.configure`) 가 startup 시점에
/// 즉시 발견하도록 처리. cross-platform 정합 (M2): 입력은 `trim()` + scheme
/// lowercase 비교.
///
/// `lib/src/internal/` 경로 컨벤션 — public surface 가 아님.
void validateEndpoint(String apiEndpoint, {String paramName = 'apiEndpoint'}) {
  final trimmed = apiEndpoint.trim();
  if (trimmed.isEmpty) {
    throw ArgumentError.value(apiEndpoint, paramName, 'must not be empty');
  }
  final uri = Uri.tryParse(trimmed);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    throw ArgumentError.value(
      apiEndpoint,
      paramName,
      'must be a valid absolute URL',
    );
  }
  final scheme = uri.scheme.toLowerCase();
  if (scheme == 'https') return;
  if (scheme == 'http' && _isAllowedLoopback(uri.host.toLowerCase())) return;
  throw ArgumentError.value(
    apiEndpoint,
    paramName,
    'must use HTTPS (only http://localhost / 127.0.0.1 allowed in all builds; '
    'http://10.0.2.2 allowed in debug builds only)',
  );
}

bool _isAllowedLoopback(String host) {
  if (host == 'localhost' || host == '127.0.0.1') return true;
  // Android emulator → host. release APK 에 들어가면 사용자 단말의 사설망 IP
  // 와 충돌할 수 있으므로 debug build 만 허용 (코드리뷰 H1).
  if (host == '10.0.2.2' && kDebugMode) return true;
  return false;
}
