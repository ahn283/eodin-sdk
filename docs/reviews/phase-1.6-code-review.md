# Phase 1.6 Code Review — EodinEvent enum + Capacitor positional helper (PRD §6.2 S9 / Phase 0.4 R5)

**Date**: 2026-05-02
**Scope**: `libs/eodin-sdk/packages/{sdk-flutter,sdk-ios,sdk-android,capacitor}` 4-platform enum 도입 + Capacitor wrapper API 정렬 + `docs/logging/unified-event-reference.md` v1.1
**Submodule HEAD**: `91ed7c3` (Phase 1.3) — 본 변경은 unstaged
**기준 문서**: `event-schema-audit.md` §6.3 / `phase-1.1-package-structure.md` §3.1, §4.4 / `unified-event-reference.md` v1.1

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 4 |
| LOW | 3 |
| NIT | 3 |

**Verdict**: **Approve with fixes** — 4 SDK 가 의도한 enum / wire-format / positional API 를 일관되게 노출하며 v1 backward-compat 도 보존됨. 다만 Phase 1.1 §3.1 "5개 공통 surface" 와 Capacitor wrapper 가 어긋나는 부분(GDPR `setEnabled`/`isEnabled`/`requestDataDeletion` 누락)이 1건 있어 Phase 1.6 마무리 전에 정렬을 권장. 나머지는 NIT/문서 정렬.

---

## Critical & High Findings

### H1. Capacitor wrapper 가 v1 surface 의 일부를 silently 누락 (회귀)

- **Severity**: HIGH
- **Category**: API Surface Regression / Cross-Platform 일관성
- **File**: `packages/capacitor/src/index.ts:45-100`
- **Issue**: 새로 도입된 `EodinAnalytics` wrapper 객체가 plugin 의 11개 메서드(`configure / track / identify / clearIdentity / setAttribution / flush / startSession / endSession / requestTrackingAuthorization / getATTStatus / getStatus`)만 forwarding 하면서, 기존 `_EodinAnalyticsBridge` 가 `EodinAnalyticsPlugin` interface 에서 노출하던 surface 와 정확히 일치한다. 그러나 Phase 1.1 §3.1 의 "5개 공통" 표는 `setEnabled (GDPR)` 을 5개 플랫폼 공통 의무로 명시하고 있고 Flutter SDK 는 이미 `setEnabled` / `isEnabled` getter / `requestDataDeletion` 을 구현해 둔 상태 (`packages/sdk-flutter/lib/src/analytics/eodin_analytics.dart:336-394`). v1 의 `EodinAnalytics` 가 plugin proxy 였기 때문에 consumer 는 plugin 의 모든 메서드 (현재 11개) 를 그대로 호출할 수 있었다. v2 wrapper 는 **앞으로 추가될 메서드를 자동으로 노출하지 않는** allowlist 구조이므로, Plugin interface 에 새 메서드가 추가될 때마다 wrapper 도 갱신해야 한다. 그리고 `definitions.test.ts:135` 의 `expect(Object.keys(EodinAnalytics).sort()).toEqual(expected.sort())` 가 그 누락을 회귀로 감지하지 않고 오히려 *고정*해 버린다.
- **Impact**:
  1. (현시점) Capacitor consumer 가 GDPR `setEnabled(false)` / data-deletion 호출 경로 없음 — kidstopia (PWA `semag.app`) 에서 PIPA / GDPR Art. 17 erasure 요청에 대응 불가. CHECKLIST §1.6 "Analytics SDK unit test (track / identify / queue / offline / **GDPR**)" 와도 어긋남.
  2. (구조적) Wrapper 가 explicit allowlist 라 1.9 `web.ts` 동작화 / 1-Auth 트랙에서 새 메서드 추가 시 4곳 (definitions / web / native bridge / wrapper) 동기화 필수. 한 곳만 빠지면 web/native fallback 차이 회귀.
- **Current code** (`packages/capacitor/src/index.ts`):
  ```ts
  export const EodinAnalytics = {
    configure(...) { return _EodinAnalyticsBridge.configure(options); },
    track(...) { return _EodinAnalyticsBridge.track({ eventName, properties }); },
    // ... 9 more explicit forwards
  };
  ```
- **Recommended fix** — 다음 중 하나:
  1. **선호**: `setEnabled` / `isEnabled` / `requestDataDeletion` 을 (a) `definitions.ts` 의 `EodinAnalyticsPlugin` 에 추가, (b) `web.ts` 에 unavailable stub, (c) wrapper 에 forwarding 추가, (d) Android/iOS native bridge plugin 에 메서드 추가. 이 4 곳 변경 — Phase 1.6 의 "Phase 1.1 §3.1 5개 공통 surface" 정합 완성. 이 작업이 1.6 범위 밖이라 판단되면 **`open-issues.md` 에 명시 등재** 후 Phase 1.7/1.9 로 ticket-track.
  2. **차선**: wrapper 를 `Proxy` 또는 `Object.assign({...positionalOverrides}, _EodinAnalyticsBridge)` 로 baseline-proxy + override 패턴으로 재구성 — `track` 만 positional 로 재정의하고 나머지는 자동 forward. 회귀가 안 일어남.
     ```ts
     export const EodinAnalytics = Object.assign(
       Object.create(_EodinAnalyticsBridge),
       {
         track(eventName: EodinEventName | string, properties?: Record<string, unknown>): Promise<void> {
           return _EodinAnalyticsBridge.track({ eventName, properties });
         },
         identify(userId: string): Promise<void> {
           return _EodinAnalyticsBridge.identify({ userId });
         },
       },
     );
     ```
     단점: TypeScript 타입 추론을 위해 별도 type alias 필요 (`type EodinAnalyticsAPI = Omit<EodinAnalyticsPlugin, 'track' | 'identify'> & { track(...): ...; identify(...): ... }`). 이 경우 `definitions.test.ts:135` 의 keys 검증도 `Omit` 기반으로 갱신.
- **참고**: 누락 메서드 자체는 **Phase 1.6 이전에도 부재**했지만, 본 PR 이 wrapper 를 explicit 객체로 바꾸면서 *향후* 누락이 silent 회귀로 굳어지는 회로를 만든 것이 본 finding 의 핵심.

---

## Medium Findings

### M1. Flutter 만 `trackEvent` 별도 메서드명, 다른 3 SDK 는 `track` overload — naming inconsistency

- **Severity**: MEDIUM
- **Category**: Cross-platform 일관성 (PRD §1.4)
- **Files**:
  - `packages/sdk-flutter/lib/src/analytics/eodin_analytics.dart:187` — `static Future<void> trackEvent(EodinEvent event, ...)`
  - `packages/sdk-ios/Sources/EodinAnalytics/EodinAnalytics.swift:125` — `public static func track(_ event: EodinEvent, ...)`
  - `packages/sdk-android/src/main/java/app/eodin/analytics/EodinAnalytics.kt:175` — `fun track(event: EodinEvent, ...)`
  - `packages/capacitor/src/index.ts:58` — `track(eventName: EodinEventName | string, ...)`
- **Issue**: Dart 는 메서드 overloading 미지원 → `track(String)` 과 `track(EodinEvent)` 동시 정의 불가. 합리적 회피책으로 `trackEvent` 라는 별도 이름을 사용했음. 그러나 PRD §1.4 의 "4개 SDK 동일 인터페이스" 와 Phase 1.1 §3.1 표 ("track | `EodinAnalytics.track(eventName, properties)` (5개 공통)") 와 어긋남. 5개 앱 (특히 Flutter/iOS 둘 다 쓰는 앱이 향후 늘 가능성) 에서 cross-platform onboarding 시 "왜 Flutter 만 trackEvent 인가?" 마찰 발생.
- **Impact**: 개발자 경험 (DX) 마찰. 마이그 가이드 / 예제 코드의 platform-specific divergence — 5개 앱 마이그 시 review effort 증가.
- **Recommended fix** — 다음 중 하나:
  1. **선호 (DX 우선)**: `EodinEvent` 를 받는 `track` 도 같은 이름으로 노출 — Dart 는 named param trick 으로 가능:
     ```dart
     static Future<void> track(
       Object eventOrName, {  // String | EodinEvent
       Map<String, dynamic>? properties,
     }) async {
       final name = eventOrName is EodinEvent
           ? eventOrName.eventName
           : eventOrName is String
               ? eventOrName
               : throw ArgumentError('eventOrName must be String or EodinEvent');
       // ... 기존 track 본문
     }
     ```
     단점: compile-time type safety 약화 (`Object`).
  2. **차선 (type-safety 우선)**: `trackEvent` 를 유지하되 docstring 과 마이그 가이드 (`phase-1.1-package-structure.md` §4.1) 에 "Flutter 만 별도 method, 이는 Dart 의 method-overload 부재 때문" 명시. Phase 1.6 결과 commit message 에도 한 줄 언급.
  3. (대안) iOS/Android/Capacitor 도 `trackEvent` 별칭 추가 → 5개 통일. 단 v1 호환 깨짐 (`track(String)` 은 유지하되 `trackEvent` 를 *권장*으로 안내).
- **권장**: 2번 (문서화). 1번은 type-safety 손실이 enum 도입 동기와 충돌. 다만 `phase-1.1-package-structure.md:106` 표의 "track" 행에 footnote 추가는 필수.

### M2. `subscribe_renew` 가 enum 에는 있지만 audit §2 "5개 앱 중 arden 만 구현" — Phase 5 마이그 누락 위험

- **Severity**: MEDIUM
- **Category**: 이벤트 스키마 Coverage / 마이그 추적
- **Files**: `*/EodinEvent.{dart,kt,swift,ts}` — 모두 `subscribe_renew` 포함
- **Issue**: `event-schema-audit.md` §2 표 에 따르면 `subscribe_renew` 는 fridgify/plori/tempy/kidstopia 에서 미구현 (arden 만 ✅). enum 자체에 포함된 건 옳음 (Phase 5 마이그 시 채택 강제용). 다만 enum 도입과 동시에 `audit.md` §7 E4 ("LTV 분석 위해 5개 앱 모두 추가") 에 대한 후속 ticket 이 `open-issues.md` 등에 별도 등재되어 있지 않으면 Phase 5 마이그 시 "enum 에 있으니 지원되는 것" 으로 오인되어 5개 앱 모두 누락된 채 진행될 가능성.
- **Impact**: Conversion API mapping 표 (`unified-event-reference.md:97`) 의 `subscribe_renew → Meta CAPI Subscribe / Google subscription_renewal` 매핑이 데이터 없이 leakage. PRD §15.2 "cross-app LTV 분석" 의 예측 정확도 하락.
- **Recommended fix**:
  - `docs/unified-id-and-sdk-v2/open-issues.md` 또는 `CHECKLIST.md` Phase 5 항목에 "subscribe_renew 5개 앱 채택 추적" 별도 행 추가.
  - 본 review 의 Action Items 에도 포함.
- **참고**: enum 자체 변경은 불필요. 본 finding 은 *프로세스* 갭에 대한 지적.

### M3. `unified-event-reference.md` v1.1 표와 enum 사이 누락 — `subscription_restore` 명명 위반 잔존, 그리고 `_dismiss` vs `_dismissed` 분기

- **Severity**: MEDIUM
- **Category**: 명명 규칙 (Rule 4)
- **Files**:
  - `EodinEvent.swift:50` / `EodinEvent.dart:47` / `EodinEvent.kt:51` / `eodin-event.ts:51` — `subscriptionRestore` = `'subscription_restore'`
  - `unified-event-reference.md:156` — `subscription_restore | success`
- **Issue**: 다른 모든 monetization 이벤트는 `subscribe_*` prefix 로 통일 (`subscribe_start`, `subscribe_renew`) — Conversion API 표 (Meta `Subscribe`, Google `subscription_renewal`) 와도 그 prefix. 그런데 `subscription_restore` 만 `subscription_*` 형태로 남아 있음. 이것은 v1 `subscription_restored` 의 *시제만* 정정한 형태 (audit.md §6.1) 인데, prefix 통일 관점에서는 `subscribe_restore` 가 더 일관됨.
  - 또한 `daily_limit_dismiss` (audit.md §6.2 "daily_limit_dismissed" → 정정) 는 enum 에서 `dailyLimitDismiss` = `'daily_limit_dismiss'` 로 올바르게 시제 처리됨. 그러나 `paywallDismiss` 와 더불어 `daily_limit_*` family 는 `_upgrade_tap` 같이 `tap` (현재시제) 로 이동했고, `dismissed` → `dismiss` 정합도 잘 됨. `restore` 만 prefix 가 어긋남.
- **Impact**: 데이터 분석 시 `event_name LIKE 'subscribe_%'` 쿼리에서 restore 가 누락. Phase 5 마이그 시점에 한 번에 정리 안 하면 v3 까지 끌고 감.
- **Recommended fix** — 옵션:
  1. **권장**: enum 과 reference v1.1 모두 `subscriptionRestore = 'subscribe_restore'` 로 통일. audit.md §6.1 의 fridgify rename 행도 동일하게 갱신:
     | fridgify | `subscription_restored` → ~~`subscription_restore`~~ `subscribe_restore` |
  2. (보류) 현재 그대로 유지 — restore 는 conversion-funnel 외 (`unified-event-reference.md:96-99` mapping 표에 없음) 이라 분석 영향 작음. 다만 명명 규칙 일관성은 손실.
- **결정 권한**: Phase 1.6 owner. 1번을 선택 시 enum 4개 + audit + reference v1.1 모두 같은 PR 에서 정리.
- **결정 (Phase 1.6 owner, 2026-05-02)**: **보류 — 옵션 2 채택**. 사유: (a) `subscription_restore` 는 reference v1.0 (2026-04-04) 발행 시점부터 정해진 wire-format 이며 enum 도입의 1차 목표는 *기존 reference 와의 정합* — restore 만 이름 바꾸면 reference v1.1 도 breaking. (b) restore 이벤트는 Conversion API mapping 외 (LTV 분석 영향 작음). (c) 향후 v3 또는 reference v2.0 메이저 발행 시점에 monetization 전체 prefix 통일 (`subscribe_*`, `pass_*`, `iap_*`) 으로 한 번에 정리하는 것이 비용 효율적. 본 결정은 `audit.md` §6.1 의 변경 매핑 (fridgify `subscription_restored` → `subscription_restore`) 과 정합.

### M4. `EodinEvent` 의 `track`/`trackEvent` overload 자체에 단위 테스트 부재 — wire-format 보존 회귀 미감지

- **Severity**: MEDIUM
- **Category**: 테스트 커버리지
- **Files**:
  - `packages/sdk-flutter/test/eodin_event_test.dart` — enum 정의만 검증
  - `packages/sdk-ios/Tests/EodinAnalyticsTests/EodinEventTests.swift` — 동일
  - `packages/sdk-android/src/test/java/app/eodin/analytics/EodinEventTest.kt` — 동일
  - `packages/capacitor/src/__tests__/eodin-event.test.ts` — 동일
- **Issue**: 4개 플랫폼 모두 enum 의 wire-format / snake_case / 중복 / forbidden v1 names 만 검증. 그러나 본 PR 의 핵심 *동작* 인 `track(EodinEvent.X)` 가 `_sendEventDirect` / `EventQueue.enqueue` 에서 정확한 wire-format string ("app_open" 등) 을 사용하는지 검증하는 테스트가 없음. 향후 누군가 `eventName` field 이름을 `value` 로 바꾸거나 `track(event.name)` (Dart enum 의 builtin `name` getter, "appOpen" 반환) 으로 잘못 호출해도 enum 단위 테스트는 통과.
- **Impact**: Phase 5 마이그 후 운영 환경에서만 "왜 모든 이벤트가 PascalCase 로 도착하는가" 인시던트 발생 가능. enum 이름 vs wire-format 의 mapping 회귀가 가장 흔한 실수 영역.
- **Recommended fix**: 4 SDK 각각 1개씩의 통합 테스트 추가 (모킹된 HTTP/Queue 사용):
  - **Capacitor (가장 쉬움)**: `_EodinAnalyticsBridge.track` 을 jest spy 로 가로채고 `EodinAnalytics.track(EodinEvent.AppOpen)` 호출 → spy.mock.calls[0][0].eventName === 'app_open' 검증.
  - **Flutter**: 기존 `eodin_analytics_test.dart` 패턴(있다면) 활용 — `EodinAnalytics.trackEvent(EodinEvent.appOpen)` 호출 후 `EventQueue.instance` 를 모킹해 enqueue 된 event 의 `eventName === 'app_open'` 확인.
  - **iOS**: `XCTestCase` 에서 URLSession 모킹 또는 EventQueue mock — `track(.appOpen)` 의 결과가 wire-format `"app_open"` 인지 검증.
  - **Android**: Robolectric 또는 EventQueue mock 으로 동일.
- **Effort**: 4 platform × ~30 LoC = 합계 ~120 LoC. 회귀 방지 가치 대비 합리적.
- **Compromise**: 시간 부족 시 적어도 Capacitor + Flutter 2 개만 추가해도 wire-format mapping 회귀의 80% 는 잡힘 (Dart enum 의 built-in `name` getter 함정이 가장 위험).

---

## Low Findings

### L1. Flutter 의 `trackEvent` doc 예시가 reference §"Standard Funnel Events" 와 살짝 어긋남 — `subscribe_start` 의 필수 param 누락 검증 없음

- **Severity**: LOW
- **Category**: Documentation / Type-safe properties (CHECKLIST §1.6 S9 "type-safe properties (선택적)")
- **Files**: `packages/sdk-flutter/lib/src/analytics/eodin_analytics.dart:181-186` 의 `trackEvent` doc, 4 SDK enum 도 동일
- **Issue**: 모든 plat enum 의 docstring 이 `subscribeStart` 예시에서 `{plan, price, currency}` 를 보여주지만, 실제 `properties` 는 `Map<String, dynamic>` / `[String: Any]?` / `Map<String, Any>` / `Record<string, unknown>` 로 자유 형태. `unified-event-reference.md:153` 에 따른 필수 param (`plan, price, currency`) 누락 시 SDK 가 경고하지 않음. CHECKLIST §1.6 의 "type-safe properties (선택적)" 항목은 본 PR 에서 의도적으로 보류된 것으로 보임 (선택적 표시).
- **Impact**: enum 만으로는 `paywall_view` 의 `paywall_type` 누락 (audit.md §5 — 5개 앱 모두 의심) 같은 issue 를 막지 못함. 본 PR 이 audit.md §6.4 "Type-safe properties (선택)" 의 1단계 (event name 통일) 만 처리하고 2단계는 *명시적으로 보류* 됐음을 docstring/checklist 에 반영하는 것이 정확함.
- **Recommended fix**:
  - 4 SDK enum docstring 에 한 줄 추가: "Properties 는 자유 형태이며 필수 param 검증은 v2.x 에서 별도 도입 예정 (CHECKLIST §1.6 S9 type-safe properties)"
  - `CHECKLIST.md` Phase 1.6 의 "type-safe properties 검증 (선택적)" 항목을 명시적으로 `[ ]` 미체크 + "Phase 1.6 에서는 보류, v2.x deferred" 메모.
- **결정 권한**: 본 review 에서 *코드 변경 강제* 안 함. CHECKLIST 1줄 update 만 권장.

### L2. Capacitor `EodinEvent` 가 `as const` 객체 — 자동 d.ts 출력에서 union 타입 보존 검증

- **Severity**: LOW
- **Category**: TypeScript Idiom / Tree-shaking
- **File**: `packages/capacitor/src/eodin-event.ts:24-77`
- **Issue**: `as const` + `keyof typeof` 패턴은 modern TS 에서 권장. 다만 일부 consumer 가 `import { EodinEvent } from '@eodin/capacitor'` 후 `EodinEvent.AppOpen` 에 hover 했을 때 `'app_open'` literal 로 좁혀지는지 (vs `string` widening) 가 d.ts 빌드 결과에 의존. `dist/esm/eodin-event.d.ts` 가 없으면 type 만 `any` 로 떨어짐. 본 review 에서는 `dist/esm/index.d.ts:51` 의 `export { EodinEvent }` 만 확인했고 `eodin-event.d.ts` 자체는 미확인.
- **Verification**:
  ```bash
  cat libs/eodin-sdk/packages/capacitor/dist/esm/eodin-event.d.ts
  # 기대: export declare const EodinEvent: { readonly AppInstall: "app_install"; ... } as const;
  ```
- **Impact**: literal 타입 보존이 안 되면 enum 도입의 type-safety 가치가 절반 손실 (enum 값을 자유 string 으로 좁히지 못해 `track('app_opn')` 오타 검증 X).
- **Recommended fix**: build 결과 (`dist/esm/eodin-event.d.ts`) 가 `as const` literal types 를 유지하는지 1회 spot-check. `tsconfig.json` 의 `declaration: true` + `declarationMap` 만 켜져 있으면 자동 생성됨. 만약 없으면 typescript 컴파일러 옵션 점검.
- **Effort**: <5 분 검증.

### L3. iOS `EodinEvent` 의 `eventName` 은 `rawValue` 의 single-line wrapper — Swift idiom 으로는 직접 노출이 더 자연스러움

- **Severity**: LOW
- **Category**: Swift Idiom
- **File**: `packages/sdk-ios/Sources/EodinAnalytics/EodinEvent.swift:78`
- **Issue**: `public var eventName: String { rawValue }` 가 single-line forwarding. Swift 의 `RawRepresentable` (`String` raw type) enum 은 이미 `rawValue: String` 을 public 으로 노출하므로 별도 `eventName` 은 cross-platform naming 통일 (Dart/Kotlin/TS 가 모두 `eventName` 사용) 목적의 *aliasing* 이고, 사용자는 `EodinEvent.appOpen.rawValue` 도 사용 가능. iOS 호출부는 `EodinAnalytics.swift:126` 에서 `event.rawValue` 를 쓰고 있어 *`eventName` 을 안 쓰고 있음* — alias 가 있어도 무방하지만 dead-ish.
- **Impact**: 매우 작음. iOS 사용자에게 두 가지 호출법 (`event.rawValue`, `event.eventName`) 이 혼재해 학습 비용. `EodinEvent.allCases.map { $0.eventName }` 가 테스트에서 사용되어 의미는 있음.
- **Recommended fix** — 옵션:
  1. (현 상태 유지) cross-platform naming 통일을 위해 `eventName` 유지. `EodinAnalytics.swift:126` 도 `event.eventName` 로 변경하면 일관 (sub-finding).
  2. `eventName` 제거하고 4 platform 통일을 docs 에서 "iOS 만 `rawValue`, Dart/Kotlin/TS 는 `eventName`" 로 명시.
- **권장**: 1번 + sub-finding (`EodinAnalytics.swift:126` 의 `event.rawValue` → `event.eventName`).

---

## NIT

### N1. Forbidden v1 names 테스트의 입력 set 이 4 SDK 에 중복 — 단일 데이터 소스로 추출 가치
- **File**: 4 platform test files (각각 14 names hardcoded)
- **Issue**: 14개 forbidden names 가 4 곳 (`*test.dart:42-55`, `EodinEventTests.swift:39-52`, `EodinEventTest.kt:40-53`, `eodin-event.test.ts:35-48`) 에 동일하게 hardcoded. 새 forbidden 추가 시 4 곳 동기화 필요.
- **Recommended fix**: `docs/unified-id-and-sdk-v2/event-schema-audit.md` §6.1 표 (또는 별도 `forbidden-events.json`) 가 정 (canonical) 이면, generator script 를 두는 것이 ideal. 다만 14 entries × 4 platform = 56 LoC 수준이라 *현재* 정렬은 manual 으로도 OK. 본 PR 에서 수정 불필요. Phase 1.7 테스트 정리에 별도 ticket.

### N2. Capacitor `EodinEvent` 의 PascalCase 키 vs 다른 SDK 의 naming
- **File**: `packages/capacitor/src/eodin-event.ts`
- **Issue**: TS 는 `AppOpen` (PascalCase, TS enum 관례), Dart `appOpen` (camelCase, Dart 관례), Kotlin `APP_OPEN` (SCREAMING_SNAKE, Kotlin 관례), Swift `appOpen` (camelCase, Swift 관례). 모두 각 언어 idiom 에 맞춤 — **이건 옳음**. 다만 cross-platform 마이그 가이드 작성 시 4 가지 표기를 한 표에 모아 보여주는 것이 도움됨.
- **Recommended fix**: 본 PR 변경 없음. `phase-1.1-package-structure.md` §4 마이그 가이드에 4 platform 키 표기 표 1개 추가하면 DX 개선.

### N3. Capacitor `EodinAnalytics` wrapper 의 `track` JSDoc 이 "snake_case" 만 강조하고 max-40-char / no-PII 같은 다른 reference rule 미언급
- **File**: `packages/capacitor/src/index.ts:50-57`
- **Issue**: JSDoc 의 `Free-form strings should follow snake_case naming conventions in docs/logging/unified-event-reference.md` 는 1줄이라 reference 의 "Parameter Rules" (max 40 char, no PII, type consistency) 까지 안내 못 함. 단순 1-liner 라 무방.
- **Recommended fix**: docstring 에 reference URL 만 가리키면 충분 — 현재 그렇게 되어 있어 사실상 OK. NIT 만 표시.

---

## Cross-Platform 일관성 매트릭스 (직접 검증)

| 항목 | Flutter | iOS | Android | Capacitor | 일관 |
|---|---|---|---|---|---|
| Lifecycle 5종 (`app_install/open`, `session_resume/start/end`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth 4종 (`sign_up/in/out`, `account_delete`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Onboarding 4종 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Monetization 14종 (`paywall_*`, `subscribe_*`, `trial_start`, `subscription_restore`, `iap_purchase`, `daily_limit_*`, `pass_*`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Advertising 6종 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Social 4종 (`share`, `invite_share/claim`, `friend_add`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ATT 2종 (`att_prompt/response`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **합계 enum entries** | **39** | **39** | **39** | **39** | ✅ |
| Wire-format snake_case (regex `^[a-z][a-z0-9]*(_[a-z0-9]+)*$`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forbidden v1 names absent | ✅ | ✅ | ✅ | ✅ | ✅ |
| `voice_*` family | ❌ | ❌ | ❌ | ❌ | (아래 참고) |

→ **39 entries × 4 platform = 156 항목 1:1 일치**. enum 정의 자체는 cross-platform 무결.

**`voice_*` family 미포함 (의도적)**: `event-schema-audit.md` §6.2 / `unified-event-reference.md:215-227` 에서 `voice_*` 6종 (select/preview/clone_start/clone_complete/record_start/record_complete) 을 v1.1 에 추가했지만 enum 4 SDK 에는 0개 포함됨. 이는 "Content Engagement (App-Specific) — domain-specific events" 분류 (`reference.md:194-227`) 라 `EodinEvent` 권장 enum 의 *standard funnel + cross-app universal* 범주 외부로 둔 것으로 추정. 합리적 설계 결정 — `voice_*` 는 arden 도메인 전용이고 `pass_*`/`daily_limit_*` 처럼 5개 앱 횡단 사용 패턴이 아님.

다만 문서/주석에 그 결정 명시가 없어 향후 "왜 voice_* 만 enum 에 없는가" 질문 발생 가능. **fix 권장** (NIT 등급으로 추가):

### N4. enum 의 "domain-specific 제외" 정책 docstring 부재
- **File**: 4 SDK enum 의 헤더 docstring
- **Issue**: 헤더가 "Aligns with unified-event-reference v1.1" 만 명시. v1.1 의 §9 "Content Engagement (App-Specific)" 와 §"voice_* family" 를 의도적으로 제외했음을 docstring 에 추가:
  > Domain-specific events (e.g., `recipe_*`, `voice_*`, `zone_*`, `temperature_*`) are intentionally excluded from this enum — use free-form `track('event_name')` for those. Only cross-app universal events that map to ad-platform Conversion APIs or appear in 3+ apps are included here.
- **Effort**: 4 SDK × 3 lines = 12 LoC.

---

## Backward Compatibility 검증

| 항목 | 결과 | 검증 |
|---|---|---|
| Flutter `EodinAnalytics.track('any_string', properties: {...})` 동작 | ✅ | `eodin_analytics.dart:138-172` 변경 없음. `trackEvent` 는 별도 *추가* 메서드. |
| iOS `EodinAnalytics.track("any_string", properties: [...])` 동작 | ✅ | `EodinAnalytics.swift:133` static func `track(_ eventName: String, properties:)` 그대로. enum overload 가 `track(_ event: EodinEvent, ...)` 로 *추가*되며 internally `track(event.rawValue, properties:)` 호출 — 무한 재귀 없음 (Swift overload resolution 이 String 파라미터를 우선 선택). |
| Android `EodinAnalytics.track("any_string", mapOf(...))` 동작 | ✅ | `EodinAnalytics.kt:186` 그대로. enum overload 는 `fun track(event: EodinEvent, ...)` 로 추가. JVM signature 충돌 없음 (enum vs String). |
| Capacitor v1 호출 `EodinAnalytics.track({eventName, properties})` | ❌ **Breaking** | wrapper 가 positional `track(eventName, properties)` 만 노출. v1 의 객체 인자 호출은 TS compile error / runtime 에서 `_EodinAnalyticsBridge.track({eventName: undefined, properties: undefined})` 로 wrong dispatch. |
| Capacitor v2 마이그 가이드 일치 | ✅ | `phase-1.1-package-structure.md:169` `EodinAnalytics.track('event_name', { ... })` 와 정합. |

→ Capacitor 의 breaking 은 **v2 마이그 가이드와 정합** 이고 의도된 변경. Phase 0.4 R5 / `audit.md` §6.1 / `phase-1.1-package-structure.md` §4.4 에 모두 명시됨. `2.0.0-beta.1` semver 에서 허용. **단** 다음 항목이 review 에서 확인되어야 함:

- [✅] semver: `package.json` `version: "2.0.0-beta.1"` (major bump) — 확인됨
- [✅] 마이그 가이드: `phase-1.1-package-structure.md` §4.4 — 확인됨
- [⚠️] Capacitor README/CHANGELOG: 없음 (`packages/capacitor/README.md` 부재, CHANGELOG 부재). **NIT N5 추가**.

### N5. Capacitor 패키지에 README / CHANGELOG 부재 — npm 페이지 stub
- **File**: `packages/capacitor/` 디렉토리
- **Issue**: `package.json:5` `description: "Eodin SDK for Capacitor - Deferred Deep Link & Analytics"` 만 있고 npm 검색 시 노출되는 README 없음. v2 의 breaking change (track positional) 가 npm 사용자에게 *최초 업그레이드 시점에* 마이그 가이드 없이 보일 수 있음.
- **Recommended fix**: 최소한의 README.md 1개 추가 — `phase-1.1-package-structure.md` §4.4 의 마이그 표 + EodinEvent 사용 예시 50-70 LoC. Phase 1.10 `2.0.0-beta.1` 릴리스 전 필수.

---

## Positive Observations

- **enum entries 4 platform 156 항목 100% 일치** — 한 곳에 typo 가 있으면 분석 join 실패. Tests (`forbidden v1 names`) 가 그것까지 잡아주는 설계는 견고함.
- **wire-format ↔ identifier 분리** — Dart `appOpen('app_open')`, Swift `case appOpen = "app_open"`, Kotlin `APP_OPEN("app_open")`, TS `AppOpen: 'app_open'`. 각 언어 idiom 을 정확히 따르면서 wire-format 은 통일된 단일 진실. 100점 짜리 cross-platform enum.
- **forbidden v1 names 테스트가 audit §6.1 와 1:1 매핑** — 회귀 방지의 정확한 위치에 가드 배치. fridgify 의 `subscription_purchase_completed` 같은 v1 string 을 누가 enum 에 다시 추가하면 즉시 fail.
- **iOS Package.swift 의 EodinDeeplink → EodinAnalytics dependency 명시** — `EodinDeeplink.swift:5 import EodinAnalytics` 가 이미 있었는데 Package.swift 에는 빠져 있던 것을 정정. 잠재 SPM 빌드 깨짐 방지. 그리고 EodinAnalyticsTests target 신설로 unit test 가능해짐 (이전엔 iOS analytics 0% test).
- **`docs/logging/unified-event-reference.md` v1.1 changelog 포함** — 변경 추적 가능. `docs/unified-id-and-sdk-v2/event-schema-audit.md` 와 cross-link 도 정합.
- **Dart `Object.values(EodinEvent)` 와 enum `name` 함정 회피** — Dart enum 의 builtin `name` getter 는 "appOpen" 을 반환하는데, 본 enum 은 별도 `eventName` field 를 둬 wire-format 충돌을 피함. enum 도입의 가장 흔한 함정 인지하고 정확한 우회.
- **Capacitor `_EodinAnalyticsBridge` 네이밍** — underscore prefix 로 internal 의도 명시. 향후 `Proxy` 기반 fallback 으로 재구성할 때 wrapper 객체 surface 와 plugin proxy surface 분리도 자연스러움.

---

## Action Items

### Must (Phase 1.6 마무리 전)
- [ ] **(HIGH H1)** Capacitor wrapper 의 GDPR (`setEnabled`/`isEnabled`/`requestDataDeletion`) 누락에 대한 결정: (a) Phase 1.6 에서 4 SDK 정합 정리하거나 (b) `open-issues.md` 에 ticket 등재. 둘 중 하나 *반드시*.

### Should (Phase 1.6 commit 권장)
- [ ] **(MEDIUM M3)** `subscription_restore` → `subscribe_restore` prefix 통일 결정 후 4 enum + reference v1.1 + audit §6.1 일괄 갱신 (또는 명시적 보류 결정 기록).
- [ ] **(MEDIUM M4)** `track(EodinEvent.X)` overload 의 wire-format 보존 통합 테스트 4 platform 중 최소 2개 (Capacitor + Flutter) 추가.
- [ ] **(MEDIUM M2)** `subscribe_renew` 5개 앱 채택 추적을 `open-issues.md` 또는 `CHECKLIST.md` Phase 5 에 명시 등재.
- [ ] **(MEDIUM M1)** `phase-1.1-package-structure.md` §3.1 표의 `track` 행에 footnote 추가: "Flutter 만 별도 method `trackEvent(EodinEvent)` — Dart method-overload 부재".

### Nice (Phase 1.10 release 전)
- [ ] **(LOW L1)** 4 SDK enum docstring 에 "type-safe properties 검증은 v2.x 별도 도입" 한 줄 추가.
- [ ] **(LOW L2)** `dist/esm/eodin-event.d.ts` 가 literal types 보존하는지 spot-check.
- [ ] **(LOW L3)** iOS `EodinAnalytics.swift:126` 의 `event.rawValue` → `event.eventName` (`eventName` alias 일관성).
- [ ] **(NIT N4)** 4 SDK enum docstring 에 "domain-specific events excluded" 정책 1-3 줄 추가.
- [ ] **(NIT N5)** `packages/capacitor/README.md` 신규 작성 — `2.0.0-beta.1` 릴리스 전 npm 페이지용.

### 후속 (별도 PR)
- [ ] (NIT N1) forbidden v1 names 4 platform 중복 → 단일 source 추출.
- [ ] (NIT N2) `phase-1.1-package-structure.md` §4 에 4 platform enum 키 표기 (PascalCase / camelCase / SCREAMING_SNAKE / camelCase) 비교 표 추가.

---

## Verdict

**Approve with fixes** — Phase 1.6 의 핵심 산출물 (4 SDK 39 entries × wire-format 일관 + Capacitor positional API + reference v1.1) 는 정확하고 회귀 위험 낮음. 본 review 의 H1 (GDPR 메서드 누락 회로 굳어지는 wrapper 구조) 만 명시적 결정/티켓화 후 commit 가능. 나머지는 release-quality polish.
