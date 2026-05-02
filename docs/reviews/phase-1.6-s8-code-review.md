# Code Review: Phase 1.6 (S8) — SDK 4채널 HTTPS-only 검증

**Date**: 2026-05-02
**Scope**: `libs/eodin-sdk` submodule — Flutter / iOS / Android / Capacitor 4채널의 `configure()` 시 endpoint scheme 검증
**Commit(s)**: SDK submodule working tree (아직 커밋 전, Phase 1.6 S8 변경)

## Summary

4채널 모두 동일한 정책 (HTTPS only + `localhost / 127.0.0.1 / 10.0.2.2` loopback http 예외) 으로 startup 시점 검증을 추가했고, 8개 configure() 진입점 모두에 첫 줄로 validator 호출을 집어넣었음. 정책 정합성·구현 일관성은 매우 양호. 다만 (1) 4채널의 URL 파서 동작 차이로 동일 입력에 cross-platform behavior 가 미세하게 달라지는 지점 1건과 (2) PRD §6.4 의 "endpoint 화이트리스트" 요구사항이 아직 미충족인 점, (3) `10.0.2.2` 가 운영 prod 빌드에도 그대로 허용되는 위험을 짚어둠.

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 1 |
| MEDIUM   | 3 |
| LOW      | 3 |
| NIT      | 3 |

**Overall Grade**: A−  (정책 일관성 + 4채널 동일 set + 호출부 누락 0건. cross-platform parser 미세 차이와 dev-host whitelist 가드 부재로 만점은 보류)

---

## High Findings

### H1. 운영(release) 빌드에서 `http://10.0.2.2` 가 그대로 허용되어 plain-text 데이터 leak 가능
- **Severity**: HIGH
- **Category**: Security / Operational
- **File**:
  - `libs/eodin-sdk/packages/sdk-flutter/lib/src/internal/endpoint_validator.dart:13-33`
  - `libs/eodin-sdk/packages/sdk-ios/Sources/EodinAnalytics/EndpointValidator.swift:28-44`
  - `libs/eodin-sdk/packages/sdk-android/src/main/java/app/eodin/internal/EndpointValidator.kt:21-41`
  - `libs/eodin-sdk/packages/capacitor/src/web.ts:73-99`
- **Issue**: 4채널 모두 build flavor 와 무관하게 `http://localhost / 127.0.0.1 / 10.0.2.2` 를 허용함. `10.0.2.2` 는 Android emulator → host 전용 주소이지만 *실제 단말 (release APK)* 에서는 라우팅이 안 되는 단순 IPv4 — 즉 사용자가 실수로 `http://10.0.2.2:8080/api/v1` 를 prod 에서 박아두면 startup 검증은 통과하지만 모든 이벤트가 timeout 까지 plain HTTP 로 시도된다. 더 나아가 사내 망에 `10.0.2.2` IP 를 가진 서버가 있다면 (192.168.x.x 와 마찬가지로 사설망) **실제로 plain HTTP 데이터 전송이 일어남**. SDK 사용자 (외부 5개 앱) 가 dev/staging/prod build flavor 분기를 잊은 케이스를 막을 수단이 현재 구조에서 0.
- **Impact**: `apiKey` (publishable 이라 leak OK 라는 PRD 정책이지만), `userId`, `deviceId`, attribution, IDFA(allowed 시), event property — 모두 평문 노출. iOS 는 ATS 가 별도로 막지만 Android cleartextTrafficPermitted=true 인 호스트 앱에서는 그대로 나간다. PRD §6.4 의 "HTTPS only 강제, TLS 1.2+ 요구" 와 정면 충돌.
- **Current code** (Kotlin 예시):
  ```kotlin
  internal object EndpointValidator {
      private val LOOPBACK_HOSTS = setOf("localhost", "127.0.0.1", "10.0.2.2")
      fun validate(endpoint: String, paramName: String = "apiEndpoint") {
          // ...
          if (scheme == "https") return
          if (scheme == "http" && host in LOOPBACK_HOSTS) return  // ← release 에서도 동일
          throw IllegalArgumentException(...)
      }
  }
  ```
- **Recommended fix**: build flavor 별로 loopback 허용 여부를 분기. 채널별 idiom:
  - **Flutter**: `kReleaseMode` 일 때 loopback 도 reject. (또는 `--dart-define=EODIN_ALLOW_LOOPBACK=false` 옵션)
    ```dart
    void validateEndpoint(String apiEndpoint, {String paramName = 'apiEndpoint'}) {
      final uri = Uri.tryParse(apiEndpoint);
      if (uri == null || !uri.hasScheme || uri.host.isEmpty) { /* throw */ }
      if (uri.scheme == 'https') return;
      // Loopback http 는 dev/profile build 에서만 허용. release 에서는 reject.
      if (uri.scheme == 'http' && _isLoopback(uri.host) && !kReleaseMode) return;
      throw ArgumentError.value(apiEndpoint, paramName,
        'must use HTTPS in release builds'
        '${kReleaseMode ? "" : " (only http://localhost / 127.0.0.1 / 10.0.2.2 allowed in dev)"}');
    }
    ```
  - **iOS**: `#if DEBUG` 분기 — `EndpointValidator.swift` 에 `#if DEBUG` 로 loopback 허용.
  - **Android**: `BuildConfig.DEBUG` 분기. `sdk-android` 에는 `BuildConfig` 가 없을 수 있는데 `EodinDeeplink.kt:59` 가 이미 `BuildConfig.DEBUG` 를 쓰고 있어서 build infra 는 구비됨.
  - **Capacitor web**: `process.env.NODE_ENV !== 'production'` 또는 `import.meta.env.DEV` (Vite). 또는 그대로 (web 은 어차피 https 페이지에서 mixed-content 가 막음 — H2 로 별도 finding).

  대안 — flag 없이 host 만 더 빡세게: `10.0.2.2` 만 `kDebugMode/Debug/dev` 분기로 처리하고 `localhost` / `127.0.0.1` 은 항상 허용 (mixed-content / ATS 가 prod 에서 어차피 막아줌). 가장 적은 코드 변경으로 핵심 위험만 해소.

---

## Medium Findings

### M1. PRD §6.4 의 "API endpoint 화이트리스트" 미충족 — `https://attacker.example` 도 통과
- **Severity**: MEDIUM
- **Category**: Security / Spec compliance
- **File**: 4채널 validator 전체
- **Issue**: PRD §6.4 line 115:
  > API endpoint 화이트리스트 (개발자 임의 리다이렉트 방지)

  현재 구현은 scheme 만 검사하고 host 는 검사하지 않음. 즉 `https://attacker.com/collect` 같은 임의 host 도 통과. 호스트 앱이 봐서 staging endpoint 를 임의로 수정하다가 typo 로 잘못된 도메인을 박는 케이스, 또는 supply-chain attack 으로 endpoint 가 바뀌는 케이스를 startup 시점에 못 잡는다.
- **Impact**: 사용자가 `https://api.eodin.app.attacker.com/api/v1` 같은 confusable 호스트를 박아도 검증 통과 → 모든 이벤트/userId/attribution 데이터를 attacker 서버로 송출. PRD §6.4 가 요구한 "임의 리다이렉트 방지" 가 안 되어있는 상태.
- **Current code**:
  ```dart
  if (uri.scheme == 'https') return;  // host 검증 없음
  ```
- **Recommended fix**: 명시적 허용 호스트 목록을 두되, 운영 유연성을 위해 *suffix match* 정도로 완화:
  ```dart
  const _ALLOWED_HOST_SUFFIXES = ['eodin.app'];

  bool _isAllowedHost(String host) {
    if (_isLoopback(host)) return true;
    return _ALLOWED_HOST_SUFFIXES.any((suffix) =>
      host == suffix || host.endsWith('.$suffix'));
  }
  ```
  `api.eodin.app`, `api-staging.eodin.app`, `api.dev.eodin.app` 모두 통과. `api.eodin.app.attacker.com` 은 `.eodin.app` 로 끝나지 않으므로 reject (suffix 비교 시 도트 prefix 필수).

  대안 — host 를 환경변수로 주입받아 register: `EodinAnalytics.allowApiHost('api.eodin.app')` 식 명시 등록. SDK 사용자 친화적이지만 API 추가 비용.

  **만약 Phase 1.6 범위에서 빼고 별도 phase 로 미루겠다면** PRD §6.4 와 CHECKLIST 1.6 에 "host 화이트리스트는 v2.x" 라고 명시 보류 결정을 남길 것. 현재는 PRD 와 구현 사이 갭이 documented 가 안 되어있음.

### M2. cross-platform URL 파서 동작 차이 — 공백/대소문자 입력에 채널별 다른 결과
- **Severity**: MEDIUM
- **Category**: Cross-platform consistency
- **File**: 4채널 validator
- **Issue**: 동일 입력에 4채널이 다른 결과를 낸다 (실측):

  | 입력 | Flutter (`Uri.tryParse`) | iOS (`URL(string:)`) | Android (`java.net.URI`) | Capacitor (`new URL`) |
  |---|---|---|---|---|
  | `"  https://api.eodin.app  "` (앞뒤 공백) | (Dart 는 RFC 따라 일부 trim — host 비면 reject) | `nil` → reject | `URISyntaxException` → reject | trim 후 통과 ✅ |
  | `"HTTPS://api.eodin.app"` | scheme `"https"` 로 normalize → 통과 | scheme `"HTTPS"` 그대로 → reject | scheme `"HTTPS"` 그대로 → reject | scheme `"https:"` lowercase → 통과 |
  | `"https://[::1]/api"` | host `"[::1]"` (IPv6 loopback) → reject | host `"::1"` → reject | (구현마다 다르지만 host 비울 가능) → reject | host `"[::1]"` → reject |
  | `"https://"` (host 없음) | reject ✅ | reject (host nil) ✅ | reject (URISyntaxException) ✅ | reject (Invalid URL) ✅ |
  | `"https://attacker.com#@api.eodin.app"` | host `"attacker.com"` ✅ (정확) | host `"attacker.com"` ✅ | host `"attacker.com"` ✅ | host `"attacker.com"` ✅ |
- **Impact**: 사용자가 호스트 앱에서 환경변수로 `'  https://api.eodin.app  '` 를 박아두면 (yaml/json 트림 누락 흔한 실수) Capacitor + Flutter 는 통과, iOS + Android 는 startup crash. cross-platform 빌드를 한 번에 push 할 때 platform 일부에서만 터지는 고통스러운 부분.
- **Recommended fix**: 모든 채널의 validator 가장 앞에 `endpoint = endpoint.trim()` 처리. 그리고 scheme 비교를 lowercase 로 통일:
  ```typescript
  // Capacitor
  export function validateEndpoint(endpoint: string, paramName = 'apiEndpoint'): void {
    const trimmed = endpoint.trim();
    if (!trimmed) throw new Error(`${paramName} must not be empty`);
    let url: URL;
    try { url = new URL(trimmed); } catch { /* throw invalid */ }
    const scheme = url.protocol.replace(/:$/, '').toLowerCase();
    // ...
  }
  ```
  ```swift
  // Swift
  let trimmed = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
  guard let url = URL(string: trimmed),
        let scheme = url.scheme?.lowercased(),
        let host = url.host,
        !host.isEmpty else {
      throw EndpointValidationError.invalidUrl(endpoint)
  }
  if scheme == "https" { return }
  ```
  Dart / Kotlin 동일 패턴.

### M3. Swift `preconditionFailure` 는 release 빌드에서도 abort — 의도적이지만 회복 불가 fatal
- **Severity**: MEDIUM
- **Category**: Error handling policy
- **File**:
  - `libs/eodin-sdk/packages/sdk-ios/Sources/EodinAnalytics/EodinAnalytics.swift:64-68`
  - `libs/eodin-sdk/packages/sdk-ios/Sources/EodinDeeplink/EodinDeeplink.swift:33-37`
  - Capacitor bundled iOS 의 동일 파일 2개
- **Issue**: Swift 의 `preconditionFailure` 는 **release 빌드에서도 항상 trap → app crash**. `assertionFailure` 와 다름 (assertion 은 release 에서 noop). 의도된 정책이라 noted 했지만, 다른 채널들은 throw 로 try/catch 가능 (Flutter `ArgumentError` 는 zonedGuarded 로 catch 가능, Kotlin `IllegalArgumentException` 도 try/catch, TS `Error` 도 try/catch). iOS 만 catch 불가능한 fatal — 의도된 cross-platform 차이지만 호스트 앱 입장에서 *iOS 만* 회복 불가.
- **Impact**: 호스트 앱의 환경변수 typo 가 iOS 에서만 launch 즉시 crash, Android/Flutter 에서는 try/catch 후 fallback 가능. 실제로 5개 앱 중 prod 출시된 게 있을 때 iOS 만 crashlytics 에 fatal 이 찍히고 Android/Flutter 는 잡아채서 graceful degrade 하는 식의 비대칭이 생긴다.
- **Current code**:
  ```swift
  do {
      try EndpointValidator.validate(apiEndpoint)
  } catch {
      preconditionFailure("EodinAnalytics.configure: \(error.localizedDescription)")
  }
  ```
- **Recommended fix**: 두 가지 선택지 — 정책 결정 필요.
  1. **현재 정책 유지** (startup misconfig 는 fatal 이 맞다는 입장): cross-platform 정합을 위해 다른 채널도 fatal 화 (Flutter `assert(false)`, Kotlin `error()` 가 더 강한 fatal). 의도 분명.
  2. **catch 가능하게 정렬**: iOS 도 throw 로 변경. `configure` 시그니처가 `throws` 가 되는 breaking 이지만, 호스트 앱이 launch 가드 가능. Swift 5.5+ 에서 `static func configure(...) throws` 자연스러움.

  CHECKLIST 1.6 의 "Analytics 는 fail-silent 유지" 정책과 묘하게 충돌 — *runtime track 은 fail-silent, configure 만 fail-fast* 가 의도라면 그 갭을 PRD/CHECKLIST 에 명시 추가. 현재 PRD §6.2 S8 의 한 줄로는 "configure 는 fatal" 이라는 의도가 명확하지 않다.

---

## Low Findings

### L1. iOS `preconditionFailure` 메시지에 `apiEndpoint` 평문이 그대로 들어감 — 로그 PII risk 0 이지만 노출 가능
- **Severity**: LOW
- **Category**: Logging / Privacy
- **File**: `EndpointValidator.swift:8-15`, 동일 Capacitor bundled
- **Issue**: `EndpointValidationError.errorDescription` 이 `apiEndpoint` 평문을 그대로 포함하여 `preconditionFailure` 메시지에 출력. iOS crashlogger / Crashlytics 에 endpoint URL 이 그대로 박힌다.
- **Impact**: endpoint 자체는 PII 가 아니지만, 만약 사용자가 실수로 endpoint 에 query string 으로 token 을 박는 경우 (예: `https://api.eodin.app/api/v1?token=abc`) crash log 에 token 이 흘러들어간다. 일반적인 misuse 시나리오는 아님.
- **Recommended fix**: validator error 에서 path / query 를 잘라내고 scheme + host 만 노출.
  ```swift
  case insecureScheme(host: String, scheme: String)
  // errorDescription: "got: \(scheme)://\(host)" — query/path 제거
  ```

### L2. Capacitor `validateEndpoint` 가 named export — 외부에서 import 가능
- **Severity**: LOW
- **Category**: API surface
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:83`
- **Issue**: `export function validateEndpoint(...)` 로 public 노출. 다른 채널 (Dart, Swift, Kotlin) 은 internal 한정 (Dart 는 `lib/src/internal/`, Swift `EndpointValidator` 도 module-public 이지만 iOS 는 SwiftPM target 외부에서 보임). Capacitor 의 경우 npm consumer 가 `import { validateEndpoint } from '@eodin/capacitor'` 가 되는지 확인 필요. 의도가 *test 용* 이라면 명시 마킹.
- **Recommended fix**: web.ts 의 export 가 plugin entry 에서 re-export 되는지 grep 확인. 만약 외부 노출되면 `index.ts` 에서 `validateEndpoint` 를 빼거나, test 전용임을 JSDoc 에 명시:
  ```typescript
  /** @internal — exported only for unit tests. Not part of the public API. */
  export function validateEndpoint(...)
  ```

### L3. `configure` 가 validator 호출 *이후* state 를 mutate 해서 partial-write 위험은 없으나, Flutter `EodinAnalytics.configure` 는 async — concurrent call 시 race
- **Severity**: LOW
- **Category**: Concurrency
- **File**: `libs/eodin-sdk/packages/sdk-flutter/lib/src/analytics/eodin_analytics.dart:71-118`
- **Issue**: `configure` 가 `Future<void>` 라서 두 번 동시 호출되면 `_apiEndpoint` 는 같은 값으로 덮어쓰지만 그 사이 `_initSession` / `EventQueue.initialize` 가 두 번 호출. validator 자체는 sync 라 OK 지만 configure 전체의 idempotency 가 분명하지 않음. 호스트 앱이 `main()` 에서 한 번만 호출하는 게 정상 use case — 회귀 가드 차원의 noted.
- **Recommended fix**: validator finding 의 직접 범위는 아님 — Phase 1.7 unit test 에서 "두 번 configure" 회귀 테스트를 추가하는 것으로 갈음.

---

## NIT (style / cleanup)

### N1. `EndpointValidator` (iOS, Capacitor bundled) 가 `public` 이지만 internal 로 충분
- **File**: Capacitor bundled `EndpointValidator.swift:21`
- 같은 module 에서만 호출되는데 `public enum EndpointValidator` 로 노출. `internal` 로 좁히기. (standalone iOS 의 EodinAnalytics 모듈은 EodinDeeplink 에서 import 되어야 해서 public 필요 — OK)

### N2. `EndpointValidationError` Equatable 채택은 좋으나 unused
- **File**: `EndpointValidator.swift:4`
- Equatable 채택했지만 4채널 어디에서도 동등성 비교 안 함. unit test 에서 `XCTAssertEqual(error, .insecureScheme(...))` 패턴 의도라면 OK. 그렇지 않다면 제거.

### N3. Dart 의 `_isLoopback` 은 file-level private 함수 — `EndpointValidator` enum/class 로 묶으면 다른 채널과 모양이 더 정합
- **File**: `endpoint_validator.dart:31-33`
- 다른 3채널은 모두 `EndpointValidator` 객체 (Swift enum, Kotlin object, TS는 함수만이지만 LOOPBACK_HOSTS 는 module-level set). Dart 도 `class EndpointValidator { static void validate(...) }` 패턴이면 4채널 mental model 정합. 현재는 top-level 함수 `validateEndpoint`. style 차이로 critical 영향 0. 향후 v3 에서 정리 권장.

---

## Data Flow / Coverage 검증

호출부 누락 0건 — 4채널 8개 configure() 진입점 모두 첫 줄에 validator 호출:

| 채널 | 파일 | line | 호출 |
|---|---|---|---|
| Flutter Analytics | `sdk-flutter/lib/src/analytics/eodin_analytics.dart` | 79 | `validateEndpoint(apiEndpoint);` |
| Flutter Deeplink | `sdk-flutter/lib/src/eodin_deeplink.dart` | 63 | `validateEndpoint(apiEndpoint);` |
| iOS Analytics | `sdk-ios/.../EodinAnalytics.swift` | 64-68 | `try EndpointValidator.validate(...)` + `preconditionFailure` |
| iOS Deeplink | `sdk-ios/.../EodinDeeplink.swift` | 33-37 | 동일 |
| Android Analytics | `sdk-android/.../EodinAnalytics.kt` | 95 | `EndpointValidator.validate(apiEndpoint)` |
| Android Deeplink | `sdk-android/.../EodinDeeplink.kt` | 53 | 동일 |
| Capacitor web Deeplink | `capacitor/src/web.ts` | 33 | `validateEndpoint(options.apiEndpoint);` |
| Capacitor web Analytics | `capacitor/src/web.ts` | 181 | 동일 |
| Capacitor bundled iOS Analytics | `capacitor/ios/.../EodinAnalytics.swift` | 64-68 | iOS 와 동일 |
| Capacitor bundled iOS Deeplink | `capacitor/ios/.../EodinDeeplink.swift` | 33-37 | 동일 |
| Capacitor bundled Android Analytics | `capacitor/android/.../EodinAnalytics.kt` | 95 | Android 와 동일 |
| Capacitor bundled Android Deeplink | `capacitor/android/.../EodinDeeplink.kt` | 53 | 동일 |

12개 진입점 = 검증 누락 없음. 좋은 hygiene.

Loopback set 정합:
- Flutter: `{localhost, 127.0.0.1, 10.0.2.2}` ✅
- iOS standalone: `{localhost, 127.0.0.1, 10.0.2.2}` ✅
- iOS Capacitor bundled: `{localhost, 127.0.0.1, 10.0.2.2}` ✅ (standalone 과 byte-for-byte 동일)
- Android standalone: `{localhost, 127.0.0.1, 10.0.2.2}` ✅
- Android Capacitor bundled: `{localhost, 127.0.0.1, 10.0.2.2}` ✅ (byte-for-byte)
- Capacitor web: `{localhost, 127.0.0.1, 10.0.2.2}` ✅

→ 4채널 6개 구현체가 동일 set. cross-platform 정합 매우 양호.

---

## Capacitor bundled vs standalone 동기화 (리뷰 관점 4)

`diff` 결과 — code identical, 주석만 다름. Phase 5.4b 이후 standalone 통합 시점에 자동으로 정리될 것. 단 두 가지 권장:

1. **drift 가드**: `scripts/check-bundled-sdk-sync.sh` 같은 CI 스크립트를 추가해 standalone vs bundled 코드 부분만 diff (주석은 무시) 자동 검증. 향후 누군가 standalone 만 수정하고 bundled 깜빡하면 즉시 fail.
2. **단일 source 후보**: Capacitor iOS 는 `Package.swift` 에서 standalone 의 `EodinAnalytics` 를 dependency 로 끌어올 수 있음 (이미 `Package.swift` 가 capacitor 에 존재). Phase 5.4b 로 가기 전에 임시로 SwiftPM dependency 만 정리해도 됨. Android 는 Maven publish 후 `implementation("app.eodin:sdk-android:...")` 형태로 가능.

---

## fail-silent 정책 회귀 검증 (리뷰 관점 5)

`track()` / `identify()` / `flush()` 등 일반 호출은 4채널 모두 기존 fail-silent 유지 (configure 만 throw):
- Flutter `track`: `if (!isConfigured) { _log(...); return; }` (eodin_analytics.dart:144-147)
- iOS `track`: `guard isConfigured ... else { return }` (EodinAnalytics.swift:139-144)
- Android `track`: `if (!isConfigured ...) { log(...); return }` (EodinAnalytics.kt:188-191)
- Capacitor `track`: `if (!this.isConfigured()) { return; }` (web.ts:217-220)

→ 정책 일관됨. configure throw + track silent 의 비대칭은 의도된 것 (CHECKLIST 1.6 line 165 "Analytics 는 fail-silent 유지"). M3 에서 짚은 대로 *그 비대칭이 PRD 에 명시 안 됨* 이 유일한 갭.

---

## 운영 보안 추가 검증 (리뷰 관점 6)

attacker 의 `http://attacker.example` injection 가능성:
- attacker 가 SDK consumer (5개 앱) 에 임의 endpoint 박는 supply-chain 시나리오 — `apiEndpoint` 는 호스트 앱이 직접 전달하는 값이라 SDK 외부 위협. 현재 validator 는 scheme 만 보고 host 는 안 보므로 `https://attacker.example` 통과. M1 finding 의 root cause.
- `*.test`, `*.local`, `192.168.*` — 모두 reject ✅ (validator 가 "loopback 3개 외 http" 모두 reject).

---

## API surface breaking change (리뷰 관점 7)

기존 호스트 앱은 모두 `https://api.eodin.app/api/v1` 사용 → throw 0건. 회귀 영향 없음. **단**:

- staging endpoint 에서 `http://internal-staging.eodin.app` 같은 plain HTTP 를 박은 곳이 있다면 즉시 launch crash (iOS) / runtime throw (Android/Flutter). 회귀 사전 점검 필요:

```bash
# 5개 호스트 앱 (kidstopia / fridgify / arden / plori / tempy) 의 환경변수에서 grep
rg -nP "apiEndpoint.*http(?!s)" --type=dart --type=swift --type=kotlin --type=ts \
  /path/to/kidstopia /path/to/fridgify /path/to/arden /path/to/plori /path/to/tempy
```

이 명령을 호스트 앱 5곳에 돌려서 0건이면 안전 release. 1건이라도 나오면 그 앱은 staging 에서 launch crash.

---

## Positive Observations

1. **4채널 정책 / loopback set 100% 일치** — 6개 구현체 모두 `{localhost, 127.0.0.1, 10.0.2.2}` 로 정확히 동일. cross-platform spec compliance 가 매우 양호.
2. **호출부 누락 0** — 12개 configure 진입점 (standalone 6 + bundled 4 + web 2) 모두 첫 줄에 validator 호출. PR description 의 "8개" 보다 더 많이 (bundled 까지) 정확히 cover.
3. **bundled native 의 byte-level 일치** — Capacitor bundled `EndpointValidator.{swift,kt}` 는 standalone 과 코드 부분이 byte-for-byte 동일. drift 안 남.
4. **각 언어 idiom 존중** — Dart `ArgumentError`, Swift `preconditionFailure`, Kotlin `IllegalArgumentException` (`require()` 와 `throw`), TS `Error` — 각 언어의 stdlib 관용. forced uniformity 안 함.
5. **에러 메시지 명확** — "must use HTTPS — only http://localhost / 127.0.0.1 / 10.0.2.2 allowed for development" 가 4채널 모두 동일 phrasing. SDK 사용자 디버깅 친화.
6. **internal scope 마킹** — Dart `lib/src/internal/`, Kotlin `app.eodin.internal` package + `internal object` — public API surface 오염 없음.
7. **JVM fallback 의 명시적 주석** — Android 가 `android.net.Uri` 대신 `java.net.URI` 쓰는 이유를 주석에 박아둠 ("unit test JVM 에서 동작 X"). 향후 누가 "왜 android.net 안 써?" 라고 묻지 않게 함.

---

## Action Items (priority order)

- [ ] **HIGH** H1: release 빌드에서 loopback 허용 차단 (4채널 모두). 가장 가벼운 수정 — `10.0.2.2` 만 release 에서 reject (ATS / mixed-content 가 `localhost` 는 어차피 막음).
- [ ] **MEDIUM** M1: PRD §6.4 의 "host 화이트리스트" 결정 — Phase 1.6 에 포함 vs 별도 phase 명시 보류 결정. PRD/CHECKLIST 에 결정 사유 기록.
- [ ] **MEDIUM** M2: 4채널 validator 모두 `endpoint.trim()` + scheme `.toLowerCase()` 정규화. cross-platform behavior 정합.
- [ ] **MEDIUM** M3: iOS `preconditionFailure` vs 다른 채널 catch 가능 차이 — 정책 결정 후 PRD §6.2 S8 에 명시. (현재 PRD 한 줄로는 의도 불명)
- [ ] **LOW** L1: `EndpointValidationError` 메시지에서 query string 제거 (token leak 가드).
- [ ] **LOW** L2: Capacitor `validateEndpoint` export — 외부 노출 의도 확인 후 `@internal` JSDoc 마킹 또는 export 제거.
- [ ] **NIT** N1: Capacitor bundled `EndpointValidator.swift` 의 `public` → `internal`.
- [ ] **NIT** Phase 5.4b 전 임시 가드: `scripts/check-bundled-sdk-sync.sh` 로 standalone vs bundled drift CI 가드.
- [ ] **호스트 앱 사전 점검**: 5개 앱의 `apiEndpoint` 정의에서 `http://` 사용처 grep — 0건이어야 release 직전.
- [ ] **단위 테스트** (Phase 1.6 의 다음 워크플로우): 4채널 각각 validator 단위 테스트 — 다음 케이스 cover:
  - `https://api.eodin.app/api/v1` → OK
  - `http://localhost:3005/api/v1` → OK
  - `http://attacker.com` → throw
  - `https://` → throw (host empty)
  - `""` → throw
  - `"not a url"` → throw
  - `"  https://api.eodin.app  "` → trim 후 OK (M2 적용 후)
  - `"HTTPS://api.eodin.app"` → lowercase 후 OK (M2 적용 후)
  - `"javascript:alert(1)"` → throw (scheme 검증)
  - release 빌드 가드 시 `http://10.0.2.2:8080` → throw (H1 적용 후)
