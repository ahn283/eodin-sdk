# PRD: `@eodin/web` — Web Analytics SDK 신설

**작성일:** 2026-05-03
**작성자:** Woojin Ahn
**상태:** Draft
**관련 PRD**: `../PRD.md` (Eodin SDK v2 정비 — 4채널) — 본 PRD 가 5번째 채널 추가

---

## 1. 배경 및 문제 정의

Eodin SDK v2 (`../PRD.md`) 는 Flutter / iOS / Android / Capacitor **4채널** 을 정비했다. 모두 mobile / app 환경에서 사용자 행동 로그를 `api.eodin.app/api/v1` 로 전송한다.

**Web 환경에서 로그를 수집할 수 있는 SDK 가 없다.** 현재 `api.eodin.app` 백엔드는 mobile/app 채널 이벤트만 수신한다. Web 페이지 사용자 행동은 attribution 망에서 0건이다.

이 PRD 는 그 빈자리를 메우는 **`@eodin/web` 패키지 신설** 만 다룬다. **본 SDK 의 채택자 / 적용 범위 / 운영 결정은 본 PRD 의 범위 밖** — 별도 비즈니스 의사결정이며 본 PRD 는 그것에 의존하지 않는다.

---

## 2. 목표 (Goals)

1. **`@eodin/web` 패키지 신설** — npm 에 publish, 4채널과 형제 SDK 패키지로 자리매김 → 5채널 SDK
2. **순수 web 로깅 surface** — page_view / 임의 custom event / identify / GDPR consent 만. 다른 어떤 모듈도 포함 안 함
3. **4채널 parity 유지** — EodinEvent enum, GDPR surface, EndpointValidator, EventQueue invariant 를 web 채널에서도 의미적 동일성으로 보장
4. **Capacitor `web.ts` 와의 코드 중복 제거** — 공통 web 로직을 `@eodin/web` 으로 추출하고 `@eodin/capacitor` 의 web fallback 이 그것을 import

---

## 3. 비목표 (Non-Goals)

| 항목 | 사유 |
|---|---|
| **Click capture / Deeplink** | `link.eodin.app/{service}/{id}` 가 이미 마케팅 클릭 캡처를 처리. SDK 에 중복 surface 도입 X |
| **Deferred Resolution** | 본질적으로 앱 전용 (mobile 4채널의 책임) |
| **EodinAuth (signIn / signOut / linkApp / leaveApp / deleteAccount)** | Auth 트랙으로 분리된 별도 모듈 |
| **`@eodin/web/server` subpath** | Auth 트랙 의존 (Firebase Admin SDK 필요) |
| **채택자 식별 / 적용 계획 / 마이그 가이드** | 본 PRD 는 SDK 패키지 신설만 다룸. 어디에 어떻게 적용할지는 별도 비즈니스 결정 |
| **백엔드 변경** | `api.eodin.app/api/v1` 는 4채널 이벤트를 이미 수신 중. 동일 endpoint 사용. 백엔드 변경 없음 |

---

## 4. SDK 채널 위상 — 4채널 → 5채널

| 채널 | 패키지 | Registry | Surface |
|---|---|---|---|
| Flutter | `eodin_sdk` | pub.dev | EodinAnalytics + EodinDeeplink |
| iOS | `EodinSDK` | SwiftPM | EodinAnalytics + EodinDeeplink |
| Android | `app.eodin:sdk` | Maven Central | EodinAnalytics + EodinDeeplink |
| Capacitor | `@eodin/capacitor` | npm | EodinAnalytics + EodinDeeplink (native bridge / web fallback) |
| **Web (NEW)** | **`@eodin/web`** | **npm** | **EodinAnalytics 만** |

---

## 5. Public API Surface (1차 출시)

기존 4채널 EodinAnalytics 의 **실제 메서드 시그니처와 의미적 parity** 유지. 메서드 이름은 4채널의 실제 코드 (Flutter `lib/src/analytics/eodin_analytics.dart`, iOS `Sources/EodinAnalytics/EodinAnalytics.swift`, Android `analytics/EodinAnalytics.kt`, Capacitor `src/definitions.ts`) 와 동일.

```typescript
import { EodinAnalytics, EodinEvent } from '@eodin/web';

// Configuration
await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: '<your-api-key>',
  appId: '<your-app-id>',
  debug: false,
  autoTrackPageView: false,     // default false — 호스트가 명시적으로 켜기. true 시 internal page-view tracker 가 history API + popstate 구독
});

// Event tracking (positional API — 4채널 parity)
EodinAnalytics.track(EodinEvent.PageView, { path: window.location.pathname });
EodinAnalytics.track('custom_event', { foo: 'bar' });

// Identity
EodinAnalytics.identify('user-id');
EodinAnalytics.clearIdentity();

// Attribution (광고 attribution 정보를 호스트가 외부에서 받아서 SDK 에 주입)
EodinAnalytics.setAttribution({ campaign: 'spring-2026', source: 'meta-ads', medium: 'cpc' });

// Sessions (web 환경에서는 page navigation / tab close 단위)
EodinAnalytics.startSession();
EodinAnalytics.endSession();

// Flush
await EodinAnalytics.flush();    // 명시 flush. pagehide / visibilitychange 시 sendBeacon 으로 자동 flush 도 수행

// Status getters — TypeScript static getter (property syntax). Flutter `static get deviceId` / iOS `public static var deviceId` 와 시각적 동일
EodinAnalytics.deviceId;       // string | null
EodinAnalytics.userId;         // string | null
EodinAnalytics.sessionId;      // string | null
EodinAnalytics.attribution;    // Attribution | null

// Aggregate status — 유일하게 method form (capacitor 와 동형, 비동기 가능성)
await EodinAnalytics.getStatus();   // AnalyticsStatus { configured, enabled, queueSize, isOnline }

// GDPR (4채널 실제 surface 와 동일 네이밍)
EodinAnalytics.setEnabled(true);              // false 시 신규 이벤트 drop. 큐 보존 — requestDataDeletion 호출까지
EodinAnalytics.isEnabled;                     // boolean — getter (property syntax)
await EodinAnalytics.requestDataDeletion();   // 로컬 큐 + 식별자 모두 제거. 서버 deletion 요청
```

### 5.1 의도적 비대칭 (5채널 parity 시 documented asymmetry)

| 메서드 / 옵션 | Flutter | iOS | Android | Capacitor | Web | 비고 |
|---|---|---|---|---|---|---|
| `requestTrackingAuthorization` (ATT) | ❌ | ✅ | ❌ | ✅ (iOS bridge / web no-op) | ❌ **의도적 미노출** | iOS-only OS 기능. web 에 import 시 not found compile error 로 호스트의 잘못된 호출 차단 |
| `getATTStatus` | ❌ | ✅ | ❌ | ✅ | ❌ **의도적 미노출** | 동상 |
| `setDeviceATT` | ✅ (위임 메서드) | ❌ | ❌ | ❌ | ❌ **의도적 미노출** | Flutter 가 ATT 결과를 SDK 에 위임으로 받는 헬퍼. web 무관 |
| `autoTrackPageView` configure 옵션 | ❌ | ❌ | ❌ | ❌ | ✅ | web 고유 — mobile 은 page_view 개념 없음. true 시 internal page-view tracker 가 history API + popstate 구독 |
| `deviceId / userId / sessionId / attribution` 분산 getter | ✅ property | ✅ property | ⚠️ method (`getDeviceId()` 등) | ❌ 미노출 (M5 — 별도 ticket) | ✅ property (TS getter) | Android 는 Kotlin/Java interop 관습으로 `fun getX()` 형태. Capacitor 는 `getStatus()` aggregate 만 노출 — 본 트랙 외 보강 ticket |
| `getStatus()` aggregate | ⚠️ 분산만 노출 | ⚠️ 분산만 노출 | ⚠️ 분산만 노출 | ✅ aggregate | ✅ aggregate (분산 getter 와 병존) | 본 트랙은 양쪽 모두 노출 — 디버그 / 호스트 편의. parity-matrix-5ch.md 에서 매핑만 명확화 |

이 비대칭은 Phase 3.3 의 `parity-matrix-5ch.md` 에 명시.

### 5.2 환경

- **Browser**: full surface
- **Node.js / SSR**: 1차 출시는 **client-only**. SSR 지원은 미포함 (필요 시 후속 PRD)
- **Worker / Service Worker**: out of scope

### 5.3 Internal modules (API doc 제외)

- `src/internal/event-queue.ts` — localStorage queue
- `src/internal/network-client.ts` — fetch + sendBeacon (auto-flush)
- `src/internal/endpoint-validator.ts` — HTTPS only (Phase 1.6 S8 parity)
- `src/internal/storage.ts` — localStorage / sessionStorage 추상화
- `src/internal/page-view-tracker.ts` — `autoTrackPageView: true` 시 history API + popstate 구독

TypeDoc `entryPoints` 에서 internal 제외. `index.ts` 만 public.

---

## 6. 코드 추출 — `packages/capacitor/src/web.ts` → `packages/sdk-web/`

Phase 1.9 에서 동작화된 `packages/capacitor/src/web.ts` (729줄) 의 다음 모듈이 분리 가능한 구조: EventQueue / NetworkClient / `validateEndpoint` / `EodinAnalyticsWeb` / `EodinDeeplinkWeb` (web 미사용으로 제외) / EodinEvent enum.

| 모듈 | 현재 위치 | 이전 위치 |
|---|---|---|
| EventQueue (localStorage) | `packages/capacitor/src/web.ts` 내부 | `packages/sdk-web/src/internal/event-queue.ts` |
| NetworkClient (fetch + sendBeacon) | 동상 | `packages/sdk-web/src/internal/network-client.ts` |
| EndpointValidator (`validateEndpoint`) | 동상 | `packages/sdk-web/src/internal/endpoint-validator.ts` |
| EodinEvent enum (web) | 동상 | `packages/sdk-web/src/eodin-event.ts` (4채널과 동일 wire string) |
| EodinAnalytics (web 본체, GDPR surface 포함) | 동상 (`EodinAnalyticsWeb`) | `packages/sdk-web/src/analytics/eodin-analytics.ts` |

추출 후 `packages/capacitor/src/web.ts` 는 `@eodin/web` 을 import 하는 얇은 어댑터로 전환.

### 6.1 npm workspaces 도입 (D1)

eodin-sdk root 에 현재 `package.json` 이 없어 capacitor 가 `@eodin/web` 을 dev 시 참조할 수단이 없음 (Phase 2 publish 순서 의존성 발생). 해결: **npm workspaces 도입**.

```json
// /package.json (신규)
{
  "name": "eodin-sdk-monorepo",
  "private": true,
  "workspaces": ["packages/*"]
}
```

- `packages/capacitor/package.json` 의 `dependencies` 에 `"@eodin/web": "workspace:*"` 추가 (npm 7+ 의 protocol)
- 로컬 dev 시 npm 이 symlink 로 해결 → publish 없이도 capacitor 가 `@eodin/web` import 가능
- `@eodin/web` publish 시점에 `workspace:*` 가 자동으로 actual version range 로 치환 (npm publish 동작)
- `@eodin/capacitor` publish 는 `@eodin/web` publish 후 수행 (Phase 5 → 후속 capacitor patch publish)
- 본 변경은 4채널 모두에 영향 가능 — Phase 1.0 에서 기존 `packages/capacitor/package.json` 의 dependency 구조 / 빌드 영향 점검

---

## 7. 4채널 Parity 영향

`@eodin/web` 추가 = 5채널 parity 유지 비용. 영향 받는 invariant:

| Invariant (출처 phase) | 5채널 영향 |
|---|---|
| EodinEvent enum 동일 wire string (Phase 1.6) | `@eodin/web` 도 동일 enum + wire string. cross-channel test 권장 |
| HTTPS only EndpointValidator (Phase 1.6 S8) | `@eodin/web` 도 동일. web 에서는 dev/prod 모두 https 강제 (`http://` 의미 없음) |
| GDPR surface (Phase 1.7) | `setEnabled / isEnabled / requestDataDeletion` — 4채널 실제 메서드명과 동일 |
| API doc 자동 생성 (Phase 1.8) | TypeDoc 사용 — `@eodin/capacitor` 와 동일 도구. 새 entry 추가 |
| Capacitor web.ts (Phase 1.9) | 본 PRD Phase 2 에서 `@eodin/web` 을 import 하는 어댑터로 전환 |
| `events/collect` schema (백엔드) | 4채널 호환. web 동일 schema 사용 (백엔드 변경 없음) |

`docs/PRD.md` (메인) §6 의 Web 채널 보류 가정은 본 PRD 로 대체. EodinAuth 모듈만 Auth 트랙 의존.

---

## 8. 일정 (개략)

| Phase | 산출 | 기간 |
|---|---|---|
| Phase 0 (사전 정렬) | 메인 PRD / `web-sdk-targets.md` / 메인 CHECKLIST 갱신 | 1일 ✅ |
| Phase 1.0 (workspace 도입) | root `package.json` + npm workspaces. capacitor 의 `dependencies` 에 `@eodin/web: workspace:*` 추가. 4채널 빌드 회귀 점검 | 0.5일 |
| Phase 1 (패키지 신설) | `packages/sdk-web/` 디렉토리 + 빌드 toolchain + internal 모듈 추출 | 3~5일 |
| Phase 2 (Capacitor 어댑터화) | `packages/capacitor/src/web.ts` → `@eodin/web` import. 코드 중복 제거 | 1~2일 |
| Phase 3 (Public surface) | EodinAnalytics public API 확정 (PRD §5 surface) + 5채널 parity 검증 | 2~3일 |
| Phase 4 (테스트 + 문서) | jest unit + TypeDoc + integration-guide.md (web 섹션 추가) | 2~3일 |
| Phase 5 (`@eodin/web@1.0.0-beta.1` publish) | npm publish (manual) + git tag + kidstopia vendor tgz 사전 회귀 검증 (G1) | 1일 |

총 ~2주. CI/CD publish 자동화는 본 PRD 범위 밖 (메인 PRD `Phase 0.5.6 / Phase 1.2` 와 묶임).

---

## 9. 위험 / 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| Capacitor `web.ts` 어댑터화 시 회귀 (G1) | kidstopia `semag.app` 라이브 분석 끊김 | (i) Phase 2 에서 `__tests__/web.test.ts` 모두 그대로 통과, (ii) Phase 5 publish 후 vendor tgz 로 kidstopia 1회 사전 회귀 검증 (CHECKLIST 5 에 추가) |
| 4채널 parity 추가 부담 (이벤트 추가/수정 시 5채널 갱신) | 향후 변경 비용 +25% | senior-code-reviewer 의 parity matrix 를 4채널 → 5채널로 확장 |
| TypeScript 타입 export 가 mobile SDK 인터페이스와 의미 drift | 개발자 인지 비용 | Phase 3 에서 cross-channel 타입 비교 audit |
| **API key 클라이언트 노출 abuse (C3)** | browser view-source 즉시 추출 가능 → 외부 abuse 시 quota / cost 영향 | **본 트랙 외 별도 ticket** — backend 의 `apiKeyAuth` 가 origin allowlist 검증을 강화해야 함 (현재 미확인). 채택 시점 전까지 처리 필수. mobile SDK 는 binary 안에 묻혀 있어 동급 abuse risk 낮음 |

---

## 10. 결정 로그

| 일자 | 결정 |
|---|---|
| 2026-05-03 | `@eodin/web` 신설 결정 — 순수 web 로깅 SDK (analytics only). 클릭 캡처 / Deeplink / Auth / SSR / 채택자 식별 모두 본 PRD 범위 밖 |
| 2026-05-03 | 코드 추출 source = `packages/capacitor/src/web.ts` (Phase 1.9 산출). Phase 2 에서 capacitor 의 web fallback 을 `@eodin/web` import 어댑터로 전환 |
| 2026-05-03 (D1) | **npm workspaces 도입** 으로 publish 순서 의존성 해결. Phase 1.0 신설 — root `package.json` + `workspaces: ["packages/*"]`. capacitor 가 `workspace:*` protocol 로 `@eodin/web` 참조. publish 시 npm 이 actual version 으로 치환 |
| 2026-05-03 (B1/B2) | PRD §5 surface 4채널 실제 코드와 정합되게 갱신: GDPR 은 `setEnabled / isEnabled / requestDataDeletion`, 그 외 `setAttribution / startSession / endSession / getDeviceId / getUserId / getSessionId / getAttribution / getStatus` 모두 노출. ATT 메서드는 web 의도적 미노출 (5채널 documented asymmetry) |
| 2026-05-03 (B3) | `autoTrackPageView: false` (default) configure option 명시. true 시 internal page-view tracker 가 history API + popstate 구독 |
| 2026-05-03 (G1) | kidstopia vendor tgz 사전 회귀 검증을 Phase 5 publish 후 sub-step 으로 명시 |
| 2026-05-03 (C3) | API key 클라이언트 노출 abuse 위험 — 본 트랙 외 별도 ticket 으로 등록. backend `apiKeyAuth` origin allowlist 강화 필요 |
| 2026-05-03 (M5) | Capacitor 의 분산 getter 누락 (`getDeviceId/UserId/SessionId/Attribution` 미노출, `getStatus()` aggregate 만) — **본 트랙 외 별도 ticket** 으로 보강. 본 PRD 의 `@eodin/web` surface 는 5개 분산 getter 모두 노출. parity-matrix-5ch.md 에 capacitor gap 명시 |
| 2026-05-03 (M6) | TypeScript public surface 의 status getter 는 **property style (static getter)** — `EodinAnalytics.deviceId` 등. Flutter / iOS 와 시각적 정합. Android 의 `fun getDeviceId()` method form 은 Kotlin/Java interop 관습으로 documented asymmetry. `getStatus()` 만 method form (aggregate + 비동기 가능성) |
| 2026-05-03 (M7) | 분산 getter ↔ aggregate `getStatus()` 둘 다 web surface 에 유지. 4채널은 분산 위주, capacitor 는 aggregate 만 — parity matrix 에서 매핑만 명확화 |
| 2026-05-03 (L8) | `autoTrackPageView` configure 옵션은 web 고유 — §5.1 asymmetry 표에 행 추가 |
| 2026-05-03 (L9) | npm workspace protocol (`workspace:*`) 의 npm 7+ 의존을 명시 — Phase 1.0.1 root `package.json` 에 `engines: {"npm": ">=7"}` 강제. CI / dev 머신 버전 차이 회귀 가드 |
| 2026-05-03 (Phase 1.1 review H1 — **결정 필요**) | dual-package hazard (cjs/esm 분기 시 EodinAnalytics singleton 인스턴스 분리) 정책 — Phase 3 진입 전 택1: (a) ESM-only 전환 (`"type": "module"` + cjs export 제거), (b) state 를 `globalThis` 에 pin, (c) stateless façade + global store. 추천: (a) — 5번째 채널 신생이라 cjs 사용자 부담 적음 |

---

## 11. 참조

- `../PRD.md` — Eodin SDK v2 정비 (4채널) — 본 PRD 의 5번째 채널 추가
- `../research/event-schema-audit.md` — EodinEvent enum 출처 (5채널 동일 wire string 원칙)
- `packages/capacitor/src/web.ts` — Phase 1.9 산출, 본 PRD Phase 1 의 코드 추출 source
