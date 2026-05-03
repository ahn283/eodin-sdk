# 5채널 Parity Matrix — EodinAnalytics

**작성일:** 2026-05-03 (Phase 3)
**관련 PRD**: `./PRD.md` §5 (public surface) / §5.1 (documented asymmetry) / §10 (M5 / M6 / M7 / L8)
**관련 review**: `./reviews/phase-1.3-code-review.md`, `./reviews/phase-2-code-review.md`, `./reviews/phase-3-code-review.md`

본 문서는 5채널 (Flutter / iOS / Android / Capacitor / Web) 의 EodinAnalytics public surface 를 비교한다. Parity 가 깨지는 항목은 의도된 비대칭 (documented asymmetry) 또는 미완 항목 (별도 ticket).

## 1. 메서드 시그니처

| 메서드 | Flutter | iOS | Android | Capacitor | Web | 비고 |
|---|---|---|---|---|---|---|
| `configure(options)` | `static Future<void>` | `static func` | `fun` | `Promise<void>` | `static async` | `apiEndpoint` / `apiKey` / `appId` 4채널 공통. web 만 `autoTrackPageView` 추가 |
| `track(event, properties?)` | `static Future<void>` (positional) | `static func` (positional) | `fun` (positional) | `Promise<void>` (object arg) | `static` (positional, 동기 fire-and-forget) | 4채널 SDK 가 positional, capacitor plugin 만 object arg (Plugin Bridge 관습) |
| `identify(userId)` | `static Future<void>` | `static func` | `fun` | `Promise<void>` | `static` | 5채널 동일 |
| `clearIdentity()` | `static Future<void>` | `static func` | `fun` | `Promise<void>` | `static` | 5채널 동일 |
| `setAttribution(attribution)` | `static Future<void>` | `static func` | `fun` | `Promise<void>` | `static` | 5채널 동일 |
| `flush()` | `static Future<void>` | `static func` | `fun` | `Promise<void>` | `static async` | 5채널 동일 |
| `startSession()` | `static Future<void>` | `static func` | `fun` | `Promise<void>` | `static async` | 5채널 동일 |
| `endSession()` | `static Future<void>` | `static func` | `fun` | `Promise<void>` | `static async` | 5채널 동일 — `duration_seconds` properties 자동 첨부 |

## 2. Status getter

| Getter | Flutter | iOS | Android | Capacitor | Web | 비고 |
|---|---|---|---|---|---|---|
| `deviceId` | `static String? get` | `public static var` | `fun getDeviceId()` (method) | ❌ 미노출 (`getStatus()` 내) | `static get` (property) | M6: TS property style. **Android = method form (Kotlin/Java interop)** documented asymmetry. **Capacitor 누락 = M5 별도 ticket** |
| `userId` | property | property | method | ❌ 미노출 | property | 동상 |
| `sessionId` | property | property | method | ❌ 미노출 | property | 동상 |
| `attribution` | property | property | method | ❌ 미노출 | property | 동상 |
| `isEnabled` | property | property | property | `isEnabled()` async (Promise) | property | Capacitor 만 async (Promise) — Plugin Bridge 관습 |
| `getStatus()` | ⚠️ 분산만 | ⚠️ 분산만 | ⚠️ 분산만 | ✅ aggregate | ✅ aggregate (분산 getter 와 병존) | M7: 본 SDK 는 양쪽 모두 노출 |

### M5 — Capacitor 분산 getter 누락

`packages/capacitor/src/definitions.ts` 의 `EodinAnalyticsPlugin` interface 에 `getDeviceId()` / `getUserId()` / `getSessionId()` / `getAttribution()` 미노출. 본 SDK 트랙 외 별도 ticket 으로 보강 예정.

## 3. GDPR (Phase 1.7 surface)

| 메서드 | Flutter | iOS | Android | Capacitor | Web | 비고 |
|---|---|---|---|---|---|---|
| `setEnabled(bool)` | `static Future<void>` | `static func` | `fun` | `Promise<void>` (object arg) | `static` | 5채널 의미 동일 |
| `isEnabled` (or `isEnabled()`) | property | property | property | `isEnabled()` Promise | property | 동상 |
| `requestDataDeletion()` | `static Future<bool>` | `static func` (callback) | `fun` (callback) | `Promise<{success}>` | `static async Promise<{success}>` | 5채널 의미 동일 — 큐 클리어 + deviceId 재발급 + opt-out 보존 |

## 4. iOS-only ATT (의도적 비대칭)

| 메서드 | Flutter | iOS | Android | Capacitor | Web | 비고 |
|---|---|---|---|---|---|---|
| `requestTrackingAuthorization` | ❌ | ✅ | ❌ | ✅ (iOS bridge / web no-op) | ❌ **의도적 미노출** | iOS-only OS 기능 |
| `getATTStatus` | ❌ | ✅ | ❌ | ✅ | ❌ **의도적 미노출** | 동상 |
| `setDeviceATT` | ✅ (Flutter 가 ATT 결과를 SDK 에 위임) | ❌ | ❌ | ❌ | ❌ **의도적 미노출** | Flutter 헬퍼 |

## 5. Web 고유 옵션 / 이벤트

| 항목 | Flutter | iOS | Android | Capacitor | Web | 비고 |
|---|---|---|---|---|---|---|
| `autoTrackPageView` configure 옵션 | ❌ | ❌ | ❌ | ❌ | ✅ | web 환경에서만 의미 — history API + popstate 구독 |
| `EodinEvent.PageView = 'page_view'` | ❌ | ❌ | ❌ | ❌ | ✅ | 향후 4채널 추가 시 동일 wire string 강제 (PRD §10 P1) |

## 6. EodinEvent enum wire string parity

5채널 모두 `EodinEvent` enum 보유. 38 entries (lifecycle / auth / onboarding / monetization / advertising / social / ATT) 의 wire string 은 **5채널 byte-exact 일치**. Web 에 `PageView` 1개 추가 — 별도.

cross-channel 검증:
- `packages/sdk-web/src/__tests__/eodin-event.test.ts` — capacitor 와 require 동적 비교 + invariant gates (snake_case / ≤40자 / 유일성 / forbidden v1 14건)
- Flutter / iOS / Android grep cross-check: `grep "app_install\|app_open\|session_start" packages/sdk-{flutter,ios,android}/...` → drift 0

## 7. Wire schema (`events/collect`) parity

5채널 모두 동일 `QueuedEvent` shape POST:

```json
{
  "events": [
    {
      "event_id": "uuid-v4",
      "event_name": "app_open",
      "app_id": "host-app-id",
      "device_id": "uuid-v4",
      "user_id": "..." | null,
      "session_id": "..." | null,
      "timestamp": "ISO 8601",
      "attribution": { "utm_source": "...", ... } | undefined,
      "properties": { ... } | undefined
    }
  ]
}
```

백엔드 (`apps/api/src/routes/events/collect.ts`) 가 5채널 모두 받음 — 변경 없음.

## 8. 모듈 / 패키지 / Registry

| 채널 | 패키지 | Registry | Modular import |
|---|---|---|---|
| Flutter | `eodin_sdk` | pub.dev | `import 'package:eodin_sdk/analytics.dart'` (또는 root `eodin_sdk.dart`) |
| iOS | `EodinSDK` (products: `EodinAnalytics`, `EodinDeeplink`) | SwiftPM | `import EodinAnalytics` |
| Android | `app.eodin:sdk` | Maven Central | `import app.eodin.analytics.*` |
| Capacitor | `@eodin/capacitor` | npm | `import { EodinAnalytics } from '@eodin/capacitor'` |
| Web | `eodin-web` | npm | `import { EodinAnalytics } from 'eodin-web'` (root) / `eodin-web/internal` (first-party 전용) |

## 8.1 Test-only / internal API

| API | Flutter | iOS | Android | Capacitor | Web | 비고 |
|---|---|---|---|---|---|---|
| `__disposeForTest()` | ❌ | ❌ | `reset()` (test) | `dispose()` (private effective) | ✅ static | Phase 3 review H4: web 만 명시적 internal 메서드 노출 (`__` prefix). 4채널은 `Reset` 또는 처리 없음 |

## 9. 의도된 비대칭 요약

| 비대칭 | 사유 |
|---|---|
| ATT 메서드 — iOS / capacitor 만 | iOS OS 기능. Android / Flutter / Web 무관 |
| `autoTrackPageView` — web 만 | mobile 은 page_view 개념 없음 |
| `EodinEvent.PageView` — web 만 (현재) | web 고유 — 향후 mobile 추가 시 동일 wire string 강제 |
| Status getter property vs method — Android = method | Kotlin/Java interop 관습 (`fun getDeviceId()`) |
| `getStatus()` aggregate — capacitor 만 (5채널 중 capacitor + web) | Plugin Bridge 의 async aggregate 응답 관습 |
| 분산 getter — capacitor 미노출 | M5 별도 ticket — Phase 외 |
| dual export (cjs+esm) — web internal entry 만 | capacitor (CJS publish) 가 require 하기 위해. Public root entry 는 ESM-only 권장이었으나 capacitor 호환성 위해 dual 유지하고 globalThis pin 으로 dual-package hazard 차단 (Phase 3 H1 결정) |

## 10. 미완 / 후속 ticket

- **M5 (Capacitor 분산 getter)** — `packages/capacitor/src/definitions.ts` 의 `EodinAnalyticsPlugin` interface 에 `getDeviceId / getUserId / getSessionId / getAttribution` 추가. 별도 ticket
- **Phase 0.10 결정 — Capacitor 의 `isEnabled` / `getDeviceId` 등을 property 로 전환** — Plugin Bridge 의 async 모델과 충돌 가능 — 결정 보류
