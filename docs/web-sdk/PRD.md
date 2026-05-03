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

기존 4채널의 EodinAnalytics 와 **semantic parity** 유지.

```typescript
import { EodinAnalytics, EodinEvent } from '@eodin/web';

await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: '<your-api-key>',
  appId: '<your-app-id>',
  debug: false,
});

// Event tracking
EodinAnalytics.track(EodinEvent.PageView, { path: window.location.pathname });
EodinAnalytics.track('custom_event', { foo: 'bar' });

// Identity
EodinAnalytics.identify('user-id');
EodinAnalytics.clearIdentity();

// Flush
await EodinAnalytics.flush();   // 명시 flush. pagehide / visibilitychange 시 sendBeacon 으로 자동 flush 도 수행

// GDPR (Phase 1.7 4채널 surface 와 parity)
EodinAnalytics.setHasUserConsent(true);    // false 시 큐 클리어 + 신규 이벤트 drop
EodinAnalytics.deleteAllData();            // 로컬 큐 + 식별자 모두 제거
```

### 5.1 환경

- **Browser**: full surface
- **Node.js / SSR**: 1차 출시는 **client-only**. SSR 지원은 미포함 (필요 시 후속 PRD)
- **Worker / Service Worker**: out of scope

### 5.2 Internal modules (API doc 제외)

- `src/internal/event-queue.ts` — localStorage queue
- `src/internal/network-client.ts` — fetch + sendBeacon (auto-flush)
- `src/internal/endpoint-validator.ts` — HTTPS only (Phase 1.6 S8 parity)
- `src/internal/storage.ts` — localStorage / sessionStorage 추상화

TypeDoc `entryPoints` 에서 internal 제외. `index.ts` 만 public.

---

## 6. 코드 추출 — `packages/capacitor/src/web.ts` → `packages/sdk-web/`

Phase 1.9 에서 동작화된 `packages/capacitor/src/web.ts` 의 EventQueue / NetworkClient / EndpointValidator 가 사실상 `@eodin/web` 의 prototype. 다음 추출 + capacitor 의 web fallback 을 어댑터로 전환.

| 모듈 | 현재 위치 | 이전 위치 |
|---|---|---|
| EventQueue (localStorage) | `packages/capacitor/src/web.ts` 내부 | `packages/sdk-web/src/internal/event-queue.ts` |
| NetworkClient (fetch + sendBeacon) | 동상 | `packages/sdk-web/src/internal/network-client.ts` |
| EndpointValidator | 동상 | `packages/sdk-web/src/internal/endpoint-validator.ts` |
| EodinEvent enum (web) | 동상 | `packages/sdk-web/src/eodin-event.ts` (4채널과 동일 wire string) |
| GDPR surface | 동상 | `packages/sdk-web/src/analytics/gdpr.ts` |
| EodinAnalytics (web 본체) | 동상 | `packages/sdk-web/src/analytics/eodin-analytics.ts` |

추출 후 `packages/capacitor/src/web.ts` 는 `@eodin/web` 을 import 하는 얇은 어댑터로 전환 (capacitor 의 `dependencies` 에 `@eodin/web` 추가). 코드 중복 제거.

---

## 7. 4채널 Parity 영향

`@eodin/web` 추가 = 5채널 parity 유지 비용. 영향 받는 invariant:

| Invariant (출처 phase) | 5채널 영향 |
|---|---|
| EodinEvent enum 동일 wire string (Phase 1.6) | `@eodin/web` 도 동일 enum + wire string. cross-channel test 권장 |
| HTTPS only EndpointValidator (Phase 1.6 S8) | `@eodin/web` 도 동일. web 에서는 dev/prod 모두 https 강제 (`http://` 의미 없음) |
| GDPR surface (Phase 1.7) | setHasUserConsent / deleteAllData 등 4채널 surface 와 의미적 동일 |
| API doc 자동 생성 (Phase 1.8) | TypeDoc 사용 — `@eodin/capacitor` 와 동일 도구. 새 entry 추가 |
| Capacitor web.ts (Phase 1.9) | 본 PRD Phase 2 에서 `@eodin/web` 을 import 하는 어댑터로 전환 |

`docs/PRD.md` (메인) §6 의 Web 채널 보류 가정은 본 PRD 로 대체. EodinAuth 모듈만 Auth 트랙 의존.

---

## 8. 일정 (개략)

| Phase | 산출 | 기간 |
|---|---|---|
| Phase 0 (사전 정렬) | 메인 PRD / `web-sdk-targets.md` / 메인 CHECKLIST 갱신 | 1일 |
| Phase 1 (패키지 신설) | `packages/sdk-web/` 디렉토리 + 빌드 toolchain + internal 모듈 추출 | 3~5일 |
| Phase 2 (Capacitor 어댑터화) | `packages/capacitor/src/web.ts` → `@eodin/web` import. 코드 중복 제거 | 1~2일 |
| Phase 3 (Public surface) | EodinAnalytics public API 확정 + 5채널 parity 검증 | 2~3일 |
| Phase 4 (테스트 + 문서) | jest unit + TypeDoc + integration-guide.md (web 섹션 추가) | 2~3일 |
| Phase 5 (`@eodin/web@1.0.0-beta.1` publish) | npm publish (manual) + git tag | 1일 |

총 ~2주. CI/CD publish 자동화는 본 PRD 범위 밖 (메인 PRD `Phase 0.5.6 / Phase 1.2` 와 묶임).

---

## 9. 위험 / 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| Capacitor `web.ts` 어댑터화 시 회귀 | kidstopia `semag.app` 분석 끊김 | Phase 2 에서 `__tests__/web.test.ts` 모두 그대로 통과 + 추가 integration test |
| 4채널 parity 추가 부담 (이벤트 추가/수정 시 5채널 갱신) | 향후 변경 비용 +25% | senior-code-reviewer 의 parity matrix 를 4채널 → 5채널로 확장 |
| TypeScript 타입 export 가 mobile SDK 인터페이스와 의미 drift | 개발자 인지 비용 | Phase 3 에서 cross-channel 타입 비교 audit |

---

## 10. 결정 로그

| 일자 | 결정 |
|---|---|
| 2026-05-03 | `@eodin/web` 신설 결정 — 순수 web 로깅 SDK (analytics only). 클릭 캡처 / Deeplink / Auth / SSR / 채택자 식별 모두 본 PRD 범위 밖 |
| 2026-05-03 | 코드 추출 source = `packages/capacitor/src/web.ts` (Phase 1.9 산출). Phase 2 에서 capacitor 의 web fallback 을 `@eodin/web` import 어댑터로 전환 |

---

## 11. 참조

- `../PRD.md` — Eodin SDK v2 정비 (4채널) — 본 PRD 의 5번째 채널 추가
- `../research/event-schema-audit.md` — EodinEvent enum 출처 (5채널 동일 wire string 원칙)
- `packages/capacitor/src/web.ts` — Phase 1.9 산출, 본 PRD Phase 1 의 코드 추출 source
