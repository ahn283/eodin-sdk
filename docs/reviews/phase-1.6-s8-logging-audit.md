# Phase 1.6 (S8) Logging Audit — SDK 4채널 HTTPS-only 검증

**Date**: 2026-05-02
**Auditor**: logging-agent
**Mode**: AUDIT (logging consistency scope)
**Scope**:
- 신규: `EndpointValidator` 4채널 (Flutter / iOS / Android / Capacitor) + bundled native 2채널
- 수정: 8개 standalone `configure()` + 4개 bundled `configure()` + 2개 web `configure()` 진입점 (총 14개)
- 정합 기준: `docs/logging/unified-event-reference.md` v1.1 (변경 없음)
- 정합 기준: `apps/api/src/services/analyticsService.ts` (변경 없음)

**기준 문서**:
- `docs/unified-id-and-sdk-v2/reviews/phase-1.6-s8-code-review.md` (선행 코드리뷰)
- `docs/unified-id-and-sdk-v2/reviews/phase-1.9-logging-audit.md` (선행 logging audit — fail-silent 정책 정립)
- `docs/unified-id-and-sdk-v2/migration-guide.md` (호스트 앱 마이그 안내)
- `docs/unified-id-and-sdk-v2/PRD.md` §6.4 (보안 요구사항)

**Out of scope**:
- 코드리뷰 H1 / M2 의 정책·구현 정확성 (코드리뷰 책임 — 본 audit 은 logging 관점만)
- M1 의 host whitelist 검토 (PRD §6.4 분리 ticket)
- M3 의 `preconditionFailure` vs throw 정책 결정 (PRD §6.2 S8 명확화 ticket)
- 4채널 native SDK 의 `session_end duration_seconds` (Phase 1.9 audit 의 후속 ticket)

---

## Summary

| Severity | Count | 영역 |
|----------|-------|------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 1 | M1 — `migration-guide.md` 에 staging http endpoint launch crash 사전 가드 안내 누락 |
| LOW | 1 | L1 — Swift `EndpointValidationError.insecureScheme` 메시지에 endpoint 평문 (path/query) 포함 — token leak 잠재 |
| NIT | 2 | N1 — 4채널 throw 메시지 phrasing drift / N2 — Capacitor `validateEndpoint` named export |

**Verdict**: **Approve with one follow-up** — logging 관점에서의 정합성 OK. fail-silent 정책 회귀 0건, PII 노출 위험 최소, 표준 이벤트 정의 (unified-event-reference.md) 영향 없음, breaking-change 영향 없음 (5개 호스트 앱 모두 prod 에서 `https://api.eodin.app/api/v1` 사용 — grep 0건). 단 M1 의 마이그 가이드 보강이 phase 1.6 머지 전 권장 — staging 에 잘못된 http endpoint 가 박힌 호스트 앱이 있다면 SDK v2 채택 즉시 launch crash (iOS) / runtime throw (Android/Flutter) 가 발생하므로 사전 grep 단계가 마이그 워크플로우에 명시되어야 한다.

---

## 1. fail-silent 정책 회귀 검증 (audit 관점 1)

### 1.1 정책 baseline

Phase 1.9 audit (line 264) 에서 정립:

> `track()` / `identify()` / `flush()` 등 일반 호출은 4채널 모두 기존 fail-silent 유지 (configure 만 throw).

이번 변경은 `configure()` 만 throw / preconditionFailure 추가. 다른 모든 호출 경로는 fail-silent 유지가 정책.

### 1.2 검증 결과 — `validateEndpoint` 호출처 grep

```
sdk-flutter/lib/src/analytics/eodin_analytics.dart:79  → configure() 진입점
sdk-flutter/lib/src/eodin_deeplink.dart:63             → configure() 진입점
sdk-flutter/lib/src/internal/endpoint_validator.dart   → 정의
```

```
sdk-ios/.../EodinAnalytics.swift:64-68                 → configure() 진입점
sdk-ios/.../EodinDeeplink.swift:33-37                  → configure() 진입점
sdk-ios/.../EndpointValidator.swift                    → 정의
```

```
sdk-android/.../analytics/EodinAnalytics.kt:95         → configure() 진입점
sdk-android/.../deeplink/EodinDeeplink.kt:53           → configure() 진입점
sdk-android/.../internal/EndpointValidator.kt          → 정의
```

```
capacitor/src/web.ts:33  → EodinDeeplinkWeb.configure()
capacitor/src/web.ts:87  → 정의 (named export)
capacitor/src/web.ts:190 → EodinAnalyticsWeb.configure()
```

(+ Capacitor bundled native 4건 — standalone 과 byte-for-byte 동일)

### 1.3 다른 호출 경로의 fail-silent 보존 확인

| Method | Flutter | iOS | Android | Capacitor web | 결과 |
|---|---|---|---|---|---|
| `track()` | `if (!isConfigured) { _log(...); return }` (eodin_analytics.dart:144-147) | `guard isConfigured ... else { return }` (EodinAnalytics.swift:139-144) | `if (!isConfigured ...) { log(...); return }` (EodinAnalytics.kt:188-191) | `if (!this.isConfigured()) return` (web.ts:226-229) | ✅ |
| `identify()` | persist + log | `shared.userId = ...` (no guard, no throw) | private setter | localStorage write only | ✅ |
| `clearIdentity()` | remove pref + log | UserDefaults remove | private setter | localStorage remove | ✅ |
| `setAttribution()` | persist + log | UserDefaults write | private setter | localStorage write | ✅ |
| `flush()` | `if (!isConfigured) { _log(...); return }` (eodin_analytics.dart:264-267) | EventQueue.shared.flush (no guard) | EventQueue.flush (no guard) | `if (!this.isConfigured()) return` (web.ts:295) | ✅ |
| `startSession()` / `endSession()` | track 호출만, throw 없음 | 동일 | 동일 | 동일 (web.ts:334-361) | ✅ |
| `setEnabled()` / `requestDataDeletion()` | persist + log (Flutter only) | (구현 X — Phase 1.9 H1) | (구현 X — Phase 1.9 H1) | localStorage write only (web.ts) | ✅ |

→ **회귀 0건**. `validateEndpoint` / `EndpointValidator.validate` 호출은 14개 configure() 진입점에 한정. 다른 어떤 호출 경로에서도 새로 throw 가 발생하지 않음. fail-silent 정책 침식 없음.

### 1.4 Capacitor wrapper (`index.ts`) 영향

`index.ts` 의 `EodinAnalytics.track(eventName, properties)` 가 `_EodinAnalyticsBridge.track({eventName, properties})` 로 forward — bridge 의 throw 가 호스트 앱 호출부로 흘러들어갈 가능성? **없음**. bridge `track` 자체가 fail-silent (web.ts:225-274 가 throw 안 함), iOS/Android bundled `track` 도 마찬가지. wrapper 가 추가로 throw 를 발생시키는 코드 없음.

---

## 2. endpoint 검증 메시지의 PII 노출 검토 (audit 관점 2)

### 2.1 메시지에 포함되는 정보

4채널 모두 throw 메시지에 입력 받은 `apiEndpoint` **평문 전체**가 포함:

| 채널 | throw 클래스 | 메시지 형식 |
|---|---|---|
| Flutter | `ArgumentError.value(apiEndpoint, paramName, '...')` | Dart 표준 — `Invalid argument(s) (apiEndpoint): ...: "<value>"` (value 자동 인용) |
| iOS | `EndpointValidationError.insecureScheme(endpoint)` → `errorDescription` 에 `(got: \(value))` 직접 박음 | `EndpointValidator.swift:13` |
| Android | `IllegalArgumentException("...: $endpoint")` | `EndpointValidator.kt:40` 직접 박음 |
| Capacitor web | `new Error('...; got: ${endpoint}')` | `web.ts:106` 직접 박음 |

### 2.2 endpoint 평문 자체는 PII 가 아님

`https://api.eodin.app/api/v1` 같은 base URL 은:
- 도메인 — public
- path — `/api/v1` 고정
- 사용자 식별 정보 0

→ **그 자체는 PII / 보안 정보 아님. OK**.

### 2.3 query string 혹은 token 포함 시 위험 (코드리뷰 L1 의 후속)

호스트 앱이 endpoint 에 `?apikey=...` 형태로 인증 정보를 박는 경우:

```dart
// 안티패턴 — 이렇게 박을 일은 정상적으로는 없지만
EodinAnalytics.configure(
  apiEndpoint: 'https://api.eodin.app/api/v1?apikey=secret_xxx',
  apiKey: 'secret_xxx',
  ...
);
```

이 경우 endpoint 가 `http://invalid.com?apikey=secret_xxx` 이면 throw 메시지에 `secret_xxx` 가 그대로 포함 → crashlog / Sentry / Crashlytics 에 박힘.

**현실적 위험도**:
- SDK v2 의 `configure()` 시그니처는 `apiKey` 를 별도 파라미터로 받음. endpoint 에 박을 동기 약함.
- `EndpointValidator` 가 throw 하는 케이스는 (a) 빈 문자열, (b) URL 파싱 실패, (c) 비-https + 비-loopback. 정상 prod endpoint (`https://api.eodin.app/...`) 는 통과하므로 **valid endpoint 의 평문은 메시지에 절대 안 박힘**. throw 는 잘못된 endpoint 만 노출.
- 잘못된 endpoint 에 token 이 박힌 케이스 — 호스트 앱의 misuse + 호스트 앱의 misconfig 가 동시에 발생해야 함 (확률 낮음).

→ **logging audit 관점에서 PII 즉시 위험 없음**. 다만 코드리뷰 L1 의 권장 (path / query 잘라내고 scheme + host 만 노출) 은 logging hardening 으로도 valid. **LOW L1 으로 유지**.

### 2.4 권장 fix (LOW — 코드리뷰 L1 과 동등)

iOS / Android / Capacitor 의 throw 메시지에서 `endpoint` 평문 대신 `<scheme>://<host>` 만 노출:

```swift
// EndpointValidator.swift
case insecureScheme(scheme: String, host: String)

public var errorDescription: String? {
    case .insecureScheme(let scheme, let host):
        return "Endpoint must use HTTPS (got: \(scheme)://\(host))"
}
```

```ts
// web.ts
throw new Error(
  `${paramName} must use HTTPS (only http://localhost / 127.0.0.1 allowed; got: ${scheme}://${host})`,
);
```

Flutter 의 `ArgumentError.value` 는 Dart stdlib 이 자동으로 value 를 인용해 출력하므로 `paramName` + 메시지만 두고 첫 인자에 truncated value 를 넘기는 식.

→ 회귀 위험 없는 작은 hardening. phase 1.6 안에서 처리하지 않아도 OK (별도 ticket 권장).

---

## 3. 이벤트 발화 영향 — v1 silent vs v2 fail-fast 비교 (audit 관점 3)

### 3.1 v1 동작 (변경 전)

| 시나리오 | v1 동작 |
|---|---|
| `apiEndpoint = 'http://staging.example.com/api/v1'` (잘못된 plain http) | configure() 통과 → 모든 track() 호출이 NetworkClient 를 통해 실제 plain HTTP POST 시도 → timeout / connection refused 시 EventQueue 가 retry → 결국 drop. 사용자 모름. |
| `apiEndpoint = ''` (빈 문자열) | configure() 통과 → URL 파싱은 track() / flush() 시점에 실패 → silent drop (EventQueue 의 catch). |
| `apiEndpoint = 'not-a-url'` | configure() 통과 → 동일하게 track() 시점에 silent drop. |

→ v1 은 **잘못된 endpoint 를 startup 에서 못 잡고 runtime 에 silent drop**. 호스트 앱 개발자가 분석 dashboard 에서 "이벤트가 0건" 인 걸 발견하고 역추적해야 함. 빠른 발견 어려움.

### 3.2 v2 동작 (이번 변경)

| 시나리오 | v2 동작 |
|---|---|
| `apiEndpoint = 'http://staging.example.com/api/v1'` (잘못된 plain http) | **configure() 즉시 throw** (Flutter `ArgumentError`, Kotlin `IllegalArgumentException`, TS `Error`) / **preconditionFailure** (iOS — release crash). 호스트 앱이 startup 에서 즉시 발견. |
| `apiEndpoint = ''` (빈 문자열) | configure() 즉시 throw. |
| `apiEndpoint = 'not-a-url'` | configure() 즉시 throw. |
| `apiEndpoint = 'http://10.0.2.2:8080'` (debug build) | configure() 통과 — emulator 워크플로우 보존. |
| `apiEndpoint = 'http://10.0.2.2:8080'` (release build) | configure() throw — release APK 에서 사설망 IP 충돌 방지 (코드리뷰 H1 fix). |

### 3.3 트레이드오프 비교

| 영역 | v1 | v2 | 영향 |
|---|---|---|---|
| 잘못된 endpoint 의 발견 시점 | runtime / dashboard | startup | ✅ 더 빠른 발견 |
| 정상 endpoint (`https://api.eodin.app/api/v1`) 영향 | OK | OK | 회귀 없음 |
| staging 에서 plain http 박은 호스트 앱 | runtime drop | **startup crash** | ⚠️ M1 — migration-guide 에 사전 grep 필요 |
| 이벤트 보존율 | 잘못된 endpoint 시 100% drop, "이상 없음" 으로 보임 | startup 막혀서 이벤트 0건. 명백히 anomaly. | ✅ alert 이 더 잘 트리거 |
| 호스트 앱 SDK 통합 비용 | low (silent failure) | medium (config 즉시 검증) | 정공법 |

→ **logging 관점에서 v2 가 명백히 우월**. 잘못된 설정의 silent drop 은 logging 의 worst case (사용자가 "이벤트 적게 들어옴" 을 발견 못함). v2 는 설정 오류를 즉시 가시화.

### 3.4 MEDIUM M1 — migration-guide 에 사전 grep 단계 명시 필요

**현재 `migration-guide.md` 상태**: §1 의 변경 매트릭스 (line 18) 가 endpoint 변경만 언급.

> 1.3 | API endpoint `link.eodin.app/api/v1` → `api.eodin.app/api/v1` | 5개 앱 모두 명시 `apiEndpoint` 설정 — 호출 코드만 갱신 (string 1줄)

§1 (line 22) 가 1.6 / 1.9 의 호출 변경만 언급. **HTTPS 검증 추가는 표에 없음**.

**문제**: 호스트 앱 마이그 담당자가 migration-guide 만 보면 endpoint 변경이 단순 string replace 로 끝난다고 생각. 그런데 staging 환경에 `http://staging.api.local/api/v1` 같은 plain http 가 박혀있으면 SDK v2 채택 즉시 launch crash (iOS preconditionFailure) / runtime throw (Android/Flutter ArgumentError). staging build 가 갑자기 못 뜸.

**권장 보강** (migration-guide.md 의 §1 또는 §2 에 추가):

```markdown
### 2.4 Phase 1.6 (S8) HTTPS-only 검증 — 사전 점검 필수

SDK v2 는 `configure()` 시점에 `apiEndpoint` scheme 을 검증한다. 다음 케이스는 **즉시 launch crash / runtime throw** 가 발생:
- `http://` (단, `localhost` / `127.0.0.1` 은 모든 빌드 / `10.0.2.2` 는 debug 전용)
- 빈 문자열 / URL 파싱 실패

**사전 grep**:
```bash
# 5개 호스트 앱 (kidstopia / fridgify / arden / plori / tempy) 의 환경변수에서 grep
rg -nP "apiEndpoint.*http(?!s)" \
  --type=dart --type=swift --type=kotlin --type=ts --type=tsx \
  /path/to/kidstopia /path/to/fridgify /path/to/arden /path/to/plori /path/to/tempy
```
0건이면 안전. 1건이라도 나오면 그 앱은 v2 채택 시 staging launch crash. 마이그 PR 머지 전에 endpoint 를 https 로 전환할 것.
```

이 단계 누락 시 staging 마이그 1주 검증 (§2.2 의 정책) 도중 launch crash 로 발견되어 마이그 일정 지연 위험. **phase 1.6 머지 전 migration-guide 보강 권장**.

→ **MEDIUM M1**. 코드 결함 아닌 docs gap. host app grep 본인은 코드리뷰 action items 의 마지막 줄 (line 314) 에 있으나 **migration-guide.md 에는 반영 안 됨**.

---

## 4. unified-event-reference 영향 (audit 관점 4)

### 4.1 표준 이벤트 정의 영향 검토

`docs/logging/unified-event-reference.md` v1.1 의 정의된 이벤트 (lifecycle / auth / monetization / advertising / social / iOS ATT) 모두 **이벤트 이름 / 파라미터 / 트리거 정의** 만 다룸. SDK 의 endpoint 검증은:
- 이벤트 이름 변경 없음
- 파라미터 schema 변경 없음
- wire-format (`EventSchema`) 변경 없음
- HTTP 헤더 변경 없음

→ **표준 이벤트 정의에 0 영향**. cross-check 만 하고 통과.

### 4.2 wire-format 회귀 검증

`apps/api/src/services/analyticsService.ts` 의 `EventSchema` / `AttributionSchema` / `CollectEventsSchema` 변경 없음. configure 단계의 검증 강화는 endpoint URL 만 영향, payload shape 무관.

→ **회귀 0건**.

### 4.3 endpoint 변경 (Phase 1.3) vs 검증 강화 (Phase 1.6 S8) 의 합산 영향

Phase 1.3 에서 `link.eodin.app/api/v1` → `api.eodin.app/api/v1` 로 SDK 기본 endpoint 가 통일됨. Phase 1.6 S8 가 그 위에 HTTPS-only 검증을 추가. 두 변경의 합산 영향:

- 정상 path (`https://api.eodin.app/api/v1`): Phase 1.3 endpoint 사용 + Phase 1.6 검증 통과 → ✅
- 잘못된 path: Phase 1.6 검증이 startup 에서 차단 → 이벤트 발화 0 (안전한 fail-fast)

→ 두 phase 가 **상호 강화**. 정합성 OK.

---

## 5. throw 메시지의 cross-platform 일관성 / 로그 포맷 (audit 관점 5)

### 5.1 throw class / errorType 비교

| 채널 | throw class | catchable | release 동작 |
|---|---|---|---|
| Flutter | `ArgumentError.value(value, name, message)` | ✅ try/catch / `runZonedGuarded` | release 에서도 throw |
| iOS | `EndpointValidationError` (custom enum) → `preconditionFailure` 으로 wrap | ❌ catch 불가 (preconditionFailure 는 trap) | **release 에서도 abort** |
| Android | `IllegalArgumentException` (`require()` / `throw`) | ✅ try/catch | release 에서도 throw |
| Capacitor web | `new Error(...)` (plain) | ✅ try/catch | 동일 |

→ **iOS 만 비대칭** — 코드리뷰 M3 의 finding. logging 관점에서는:
- iOS: Crashlytics 에 fatal 로 박힘. stack trace 명확.
- Flutter / Android / Capacitor: 호스트 앱이 catch 안 하면 uncaught exception → Sentry / Crashlytics 에 박힘. catch 하면 graceful degrade.

### 5.2 메시지 phrasing 비교

| 채널 | scheme 위반 메시지 |
|---|---|
| Flutter | `must use HTTPS (only http://localhost / 127.0.0.1 allowed in all builds; http://10.0.2.2 allowed in debug builds only)` |
| iOS | `Endpoint must use HTTPS — only http://localhost / 127.0.0.1 allowed in all builds; http://10.0.2.2 allowed in DEBUG builds only (got: ...)` |
| Android | `apiEndpoint must use HTTPS — only http://localhost / 127.0.0.1 allowed in all builds; http://10.0.2.2 allowed in debug builds only (got: ...)` |
| Capacitor web | `apiEndpoint must use HTTPS (only http://localhost / 127.0.0.1 allowed; got: ...)` |

→ phrasing 이 **80% 일치하나 100% 일치 아님**:
- iOS 만 첫 글자 대문자 ("Endpoint")
- iOS 만 dash (`—`) 사용, Flutter / Android 도 동일하지만 Flutter 는 "in all builds" 까지 친절히 명시
- Capacitor 만 `10.0.2.2` 언급 자체가 없음 (web 은 emulator 무관 — 의도된 차이, OK)
- 구분자가 다름: Flutter = `(...)` / iOS = `—` + `(got: ...)` / Android = `—` + `(got: ...)` / web = `(...)`

→ **NIT N1**. 메시지 phrasing 표준화는 logging hygiene. 호스트 앱 개발자가 same root cause 를 4채널에서 동일 phrase 로 검색 가능해야 함 (Sentry "Search by message" 시).

### 5.3 권장 표준 phrasing (NIT)

```
"<paramName> must use HTTPS. Only http://localhost / 127.0.0.1 are allowed in all builds. http://10.0.2.2 is allowed in debug builds only. (Got: <scheme>://<host>)"
```

(web 은 `10.0.2.2` 문장 제거)

phase 1.6 이후 minor cleanup 으로 처리 가능. critical 영향 없음.

### 5.4 Sentry / Crashlytics 검색 가능성

현재 phrasing 은 4채널 공통 substring `"must use HTTPS"` 가 있어 cross-platform 검색 가능. 즉 NIT N1 은 **검색 가능성 자체에는 영향 없음**, 오직 cosmetic.

---

## 6. Capacitor `validateEndpoint` named export 검토 (audit 관점 6)

### 6.1 현재 노출 상태

`web.ts:87`:
```ts
export function validateEndpoint(endpoint: string, paramName = 'apiEndpoint'): void
```

`index.ts` 에서 re-export 되는지 확인:
```
export * from './definitions';
export { EodinEvent } from './eodin-event';
export type { EodinEventName } from './eodin-event';
export { EodinDeeplink };
```

→ `web.ts` 자체의 named export 는 `index.ts` 가 re-export 안 함. 즉 npm consumer 가 `import { validateEndpoint } from '@eodin/capacitor'` 하면 **resolve 안 됨**.

다만 `import { validateEndpoint } from '@eodin/capacitor/dist/web'` 처럼 deep import 는 가능 (TypeScript bundler 설정에 따라). 의도된 노출은 **테스트 전용**.

→ **NIT N2** — public API surface 오염 위험은 낮음 (deep import 안 하는 게 normal). 단 JSDoc `@internal` 마킹 또는 테스트 전용 export 패턴으로 명시 권장. logging 관점 영향 0.

---

## 7. fail-fast 정책의 PRD 명시 누락 (audit 관점 7)

코드리뷰 M3 line 160 에서 짚은 "configure throw + track silent 비대칭" 이 PRD §6.2 S8 에 명시 안 됨. logging audit 관점에서 동일 finding 재확인:

- Phase 1.9 audit (line 264) 에서 정책이 실증적으로 정립됨 — *"track 등 일반 호출은 fail-silent 유지"*
- Phase 1.6 S8 의 새 정책 — *"configure 만 fail-fast"* — PRD 에 한 줄 추가 필요

→ **NIT 수준** (logging audit 자체에는 결함 없음 — 코드 동작은 정합). PRD §6.2 S8 에 다음 한 줄 추가 권장:

> SDK 의 `configure()` 진입점은 endpoint 검증 실패 시 startup 에서 즉시 throw / fatal (fail-fast). `track()` / `identify()` / `flush()` 등 일반 호출은 misconfig 시 silent drop (fail-silent). 이 비대칭은 의도된 것 — 설정 오류는 빠른 발견이 우선이고, runtime tracking 은 분석 신뢰도보다 호스트 앱 안정성이 우선이다.

phase 1.6 S8 머지 후 별도 docs PR 로 추가 가능. critical 영향 없음.

---

## 8. Findings 요약

### MEDIUM

**M1. `migration-guide.md` 에 staging http endpoint 사전 grep 단계 누락**
- 위치: `docs/unified-id-and-sdk-v2/migration-guide.md` §1 / §2
- 영향: 5개 호스트 앱 마이그 시 staging 에 plain http 가 박혀 있으면 SDK v2 채택 즉시 launch crash (iOS) / runtime throw (Android/Flutter). staging 1주 검증 일정 지연 위험.
- 권장: §2.4 신설 또는 §2.2 (Staging API key) 옆에 "사전 grep 단계" 추가. 코드리뷰 action items 의 line 314 와 동일 grep 명령 — 하지만 마이그 가이드에 명시 안 됨이 gap.
- 머지 차단? — **권장**. phase 1.6 S8 머지 전 docs PR 한 줄 추가가 마이그 안전성에 큰 차이.

### LOW

**L1. throw 메시지에 endpoint 평문 (path/query) 포함 — token leak 잠재**
- 위치: 4채널 validator 모두 (Flutter `ArgumentError.value`, iOS `errorDescription`, Android `IllegalArgumentException` 메시지, web `Error` 메시지)
- 영향: 호스트 앱이 endpoint 에 query string 으로 token 박는 미사용 안티패턴 시 token 이 crashlog 에 흘러들어감. SDK v2 의 `configure()` 시그니처가 `apiKey` 를 별도 파라미터로 받으므로 정상 use case 위험 0. 잘못된 endpoint + token 안티패턴 동시 발생 시만 위험.
- 권장: throw 메시지에서 path / query 잘라내고 `<scheme>://<host>` 만 노출 (코드리뷰 L1 과 동등). 별도 ticket 권장.

### NIT

**N1. 4채널 throw 메시지 phrasing 80% 일치 / 100% 일치 아님**
- 위치: 4채널 throw 메시지
- 영향: cross-platform Sentry 검색 시 cosmetic. substring `"must use HTTPS"` 는 공통 — 검색 가능성 자체에는 영향 없음.
- 권장: 표준 phrasing 으로 통일 (§5.3). 별도 minor cleanup ticket.

**N2. Capacitor `validateEndpoint` named export — 테스트 전용 의도 명시 부재**
- 위치: `web.ts:87`
- 영향: `index.ts` 가 re-export 안 함 — npm consumer 의 정상 import 경로로는 노출 안 됨. deep import (`@eodin/capacitor/dist/web`) 는 가능하나 normal usage 아님.
- 권장: JSDoc `@internal` 마킹 추가. logging 영향 0.

---

## 9. 회귀 / breaking change 영향 (logging 관점)

| 영역 | 회귀 위험 | 결과 |
|---|---|---|
| 표준 이벤트 정의 (`unified-event-reference.md`) | endpoint 변경 / 검증 강화 | ✅ 영향 없음 |
| wire-format (`EventSchema` / `AttributionSchema` / `CollectEventsSchema`) | 페이로드 shape | ✅ 영향 없음 |
| HTTP 헤더 (`X-API-Key` / `Content-Type`) | header 변경 | ✅ 영향 없음 |
| fail-silent 정책 (`track` / `identify` / `flush` 등) | 새 throw 발생 가능성 | ✅ 영향 없음 (configure 만 throw) |
| 5개 호스트 앱의 prod endpoint | `https://api.eodin.app/api/v1` 사용 | ✅ 회귀 0건 (grep 0건 확인) |
| 5개 호스트 앱의 staging endpoint | plain http 박혀있을 수 있음 | ⚠️ M1 — 사전 grep 단계 docs 보강 필요 |
| 분석 dashboard | 이벤트 수 / shape 변화 | ✅ 영향 없음 (정상 endpoint 통과) |

→ **logging 관점 회귀 없음**. M1 만 마이그 워크플로우 docs gap.

---

## 10. Phase 1.6 (S8) 통과 / 후속 ticket 정리

**통과** (이번 phase DoD 충족):
- ✅ fail-silent 정책 회귀 0건 (§1)
- ✅ PII 즉시 위험 없음 (§2)
- ✅ 이벤트 발화 영향 — v2 가 v1 대비 명백히 우월 (§3)
- ✅ unified-event-reference 영향 없음 (§4)
- ✅ wire-format 회귀 없음 (§9)
- ✅ 4채널 cross-platform 메시지 검색 가능성 OK (§5)

**후속 ticket 분리 권장**:

| # | Severity | Ticket 후보명 | 의존 phase |
|---|---|---|---|
| 1 | MEDIUM | `migration-guide.md §2.4 — staging http endpoint 사전 grep 단계 추가` | Phase 1.6 머지 전 권장 (docs only PR) |
| 2 | LOW | `EndpointValidationError 메시지에서 path/query 제거 — token leak 가드` | 코드리뷰 L1 과 묶어 별도 ticket |
| 3 | NIT | `4채널 throw 메시지 phrasing 표준화` | minor cleanup ticket |
| 4 | NIT | `Capacitor validateEndpoint @internal 마킹` | minor cleanup ticket |
| 5 | NIT | `PRD §6.2 S8 에 fail-fast vs fail-silent 비대칭 명시` | docs PR (코드리뷰 M3 와 동일) |

---

## 11. Verdict

**Phase 1.6 (S8) — Approve with one follow-up.**

logging audit 관점에서 fail-silent 정책 회귀 없음, PII 노출 위험 최소, 표준 이벤트 정의 / wire-format 영향 없음, breaking-change 영향 없음. configure() fail-fast 도입은 v1 의 silent drop 문제를 정공으로 해결 — logging 관측성 측면에서 **명백히 우월**. 단 M1 의 migration-guide 보강이 phase 1.6 머지 전 권장 — staging http endpoint grep 단계가 5개 호스트 앱 마이그 워크플로우의 안전성에 직결됨. 그 외 발견된 LOW / NIT 4건은 회귀 차단 수준 아니며 별도 cleanup ticket 으로 분리 가능.
