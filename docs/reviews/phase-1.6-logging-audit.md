# Phase 1.6 Logging Audit — EodinEvent enum + unified-event-reference v1.1

**Date**: 2026-05-02
**Auditor**: logging-agent
**Mode**: AUDIT (SDK-scope only)
**Scope**:
- `docs/logging/unified-event-reference.md` v1.0 → v1.1
- `libs/eodin-sdk/packages/{sdk-flutter, sdk-ios, sdk-android, capacitor}/` 의 `EodinEvent` enum 신설
- `EodinAnalytics.{trackEvent|track(EodinEvent)}` overload (4 SDK)
- Capacitor `track(eventName, properties?)` positional wrapper (v1 → v2 breaking)
- 통합 event reference vs 4 SDK enum 정합 (39 × 4 = 156 항목)

**Out of scope** (Phase 5 마이그 audit 으로 이관):
- 5개 호스트 앱 (fridgify / plori / tempy / arden / kidstopia) 의 실제 호출부 17건 명명 충돌 정정

**기준 문서**:
- `docs/logging/unified-event-reference.md` v1.1
- `docs/unified-id-and-sdk-v2/event-schema-audit.md` §6.1 (forbidden v1 names 14건)
- `docs/unified-id-and-sdk-v2/reviews/phase-1.6-code-review.md` (선행 코드 리뷰)
- `docs/unified-id-and-sdk-v2/phase-1.1-package-structure.md` §3.1, §4.4

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| NIT | 4 |

**Verdict**: **Approve with documentation fixes** — SDK 단의 enum 정의, 4채널 wire-format 일관성, Capacitor positional wrapper, conversion API funnel coverage 는 모두 검증 통과. 다만 reference v1.1 문서 자체에서 enum 에 포함되어 있는 일부 이벤트 (`session_start` / `session_end` / `ad_native_view`) 가 표 본문에 누락되어 있어 reference 와 SDK 간 정합 가벼운 불일치가 있음. Phase 5 마이그 audit 전에 reference v1.1 의 보완 patch 권장. 모두 문서 갱신 수준이고 wire-format / breaking change / backward-compat 영역에는 회귀 없음.

---

## 1. Naming Convention 정합성 — 신규 family (v1.1 추가분)

### 1.1 검증 결과

reference v1.1 의 §"Event Naming Rules" (8개 규칙) 를 신규 추가 이벤트에 1:1 매핑 검증.

| Event | Rule 1 (snake_case) | Rule 2 (≤40 chars) | Rule 3 (no abbrev) | Rule 4-8 (시제/접미사) | 결과 |
|---|---|---|---|---|---|
| `account_delete` | ✅ | ✅ (14) | ✅ | ✅ Rule 4 (delete = 현재시제, ≠ deleted) | OK |
| `daily_limit_reached` | ✅ | ✅ (19) | ✅ | ⚠️ "reached" 는 과거분사형. (아래 M1) | 의문 |
| `daily_limit_dismiss` | ✅ | ✅ (19) | ✅ | ✅ Rule 4 (현재시제) | OK |
| `daily_limit_upgrade_tap` | ✅ | ✅ (23) | ✅ | ✅ Rule 4 (현재시제) | OK |
| `voice_select` | ✅ | ✅ (12) | ✅ | ✅ Rule 4 | OK |
| `voice_preview` | ✅ | ✅ (13) | ✅ | ✅ Rule 4 | OK |
| `voice_clone_start` | ✅ | ✅ (17) | ✅ | ✅ Rule 6 (`_start`) | OK |
| `voice_clone_complete` | ✅ | ✅ (20) | ✅ | ✅ Rule 5 (`_complete`) | OK |
| `voice_record_start` | ✅ | ✅ (18) | ✅ | ✅ Rule 6 | OK |
| `voice_record_complete` | ✅ | ✅ (21) | ✅ | ✅ Rule 5 | OK |
| `pass_view` | ✅ | ✅ (9) | ✅ | ✅ Rule 8 (`_view`) | OK |
| `pass_purchase` | ✅ | ✅ (13) | ✅ | ✅ Rule 4 | OK |
| `pass_expire` | ✅ | ✅ (11) | ✅ | ✅ Rule 4 | OK |

→ **13개 신규 이벤트 중 12개는 명명 규칙 완전 준수**. 1개 (`daily_limit_reached`) 는 약간 모호하지만 합리적 (M1 finding).

### 1.2 `account_delete.reason` enum 합리성

reference §2 (line 119) 명시 enum:
- `not_using` ✅ — 이탈 (가장 흔함)
- `privacy_concern` ✅ — GDPR/PIPA 동기
- `found_alternative` ✅ — 경쟁사 이동
- `too_expensive` ✅ — 가격 민감도 (premium 사용자에게만 해당)
- `other` ✅ — escape hatch (필수)

**평가**: 5개 분류는 합리적. 산업 표준 (Mixpanel, Amplitude churn analysis) 의 일반적 감원 이유 분류와 정합. PIPA Art. 17 / GDPR Art. 17 지원에 필요한 "행위 동기" 기록이라는 본래 목적 충족.

다만:
- `too_expensive` 는 free tier 사용자에게는 의미 없음 — 분석 시 `subscription_status` 와 join 필요
- "fridgify 광고 너무 많음" 같은 ad-fatigue 케이스를 명시적으로 분류하지 않음 (other 로 묶임). Phase 5 운영 후 segmentation 데이터에 따라 enum 확장 가능. v1.1 에서는 5개로 충분.

### 1.3 prefix 일관성

- `daily_limit_*` (3종): `_reached / _dismiss / _upgrade_tap` — 첫 단어가 동사가 아닌 점이 다른 family (`voice_*`) 와 다르지만, "daily limit 을 다루는 modal flow" 라는 단일 도메인을 잘 표현. ✅
- `voice_*` (6종): `_select / _preview / _clone_start / _clone_complete / _record_start / _record_complete` — 모두 동사로 시작. clone/record 는 sub-family (multi-step flow) 로 `_start/_complete` 페어. ✅
- `pass_*` (3종): `_view / _purchase / _expire` — view/purchase/expire 표준 lifecycle. ✅

→ 3 family 모두 prefix 일관성 OK.

---

## 2. 4 SDK Enum vs reference v1.1 정합

### 2.1 entries 수 검증

| 항목 | Flutter | iOS | Android | Capacitor | 일관 |
|---|---|---|---|---|---|
| Lifecycle 5종 (`app_install`, `app_open`, `session_resume`, `session_start`, `session_end`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth 4종 (`sign_up`, `sign_in`, `sign_out`, `account_delete`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Onboarding 4종 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Monetization 14종 (`paywall_*` 2, `subscribe_*` 2, `trial_start`, `subscription_restore`, `iap_purchase`, `daily_limit_*` 3, `pass_*` 3, `core_action`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Advertising 6종 (`ad_rewarded_view`, `ad_interstitial_view`, `ad_native_view`, `ad_click`, `ad_load_failed`, `ad_free_pass`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Social 4종 | ✅ | ✅ | ✅ | ✅ | ✅ |
| ATT 2종 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **합계 enum entries** | **39** | **39** | **39** | **39** | ✅ |
| Wire-format snake_case (regex `^[a-z][a-z0-9]*(_[a-z0-9]+)*$`) | ✅ | ✅ | ✅ | ✅ | ✅ |

→ **39 × 4 = 156 entries 1:1 일치** 직접 검증. 식별자 (Dart camelCase / Swift camelCase / Kotlin SCREAMING_SNAKE / TS PascalCase) 는 각 언어 idiom, wire-format 은 단일 진실 (snake_case).

### 2.2 Conversion API funnel 7종 enum 포함 검증

reference v1.1 §"Conversion API Mapping" (lines 90-99) 의 7개 funnel 이벤트가 4 SDK enum 에 모두 포함되는지:

| Funnel Event | Flutter | iOS | Android | Capacitor |
|---|---|---|---|---|
| `app_install` | ✅ `appInstall` | ✅ `appInstall` | ✅ `APP_INSTALL` | ✅ `AppInstall` |
| `app_open` | ✅ `appOpen` | ✅ `appOpen` | ✅ `APP_OPEN` | ✅ `AppOpen` |
| `core_action` | ✅ `coreAction` | ✅ `coreAction` | ✅ `CORE_ACTION` | ✅ `CoreAction` |
| `paywall_view` | ✅ `paywallView` | ✅ `paywallView` | ✅ `PAYWALL_VIEW` | ✅ `PaywallView` |
| `subscribe_start` | ✅ `subscribeStart` | ✅ `subscribeStart` | ✅ `SUBSCRIBE_START` | ✅ `SubscribeStart` |
| `trial_start` | ✅ `trialStart` | ✅ `trialStart` | ✅ `TRIAL_START` | ✅ `TrialStart` |
| `subscribe_renew` | ✅ `subscribeRenew` | ✅ `subscribeRenew` | ✅ `SUBSCRIBE_RENEW` | ✅ `SubscribeRenew` |

→ **7/7 × 4 = 28 항목 모두 통과**. 광고 플랫폼 Conversion API 매핑에 필요한 모든 funnel 이벤트가 enum 에 등재됨.

### 2.3 Forbidden v1 names absent 검증

`event-schema-audit.md` §6.1 의 14개 forbidden v1 names 가 4 SDK enum 어디에도 없음을 확인 — 4 SDK 의 forbidden test (`subscription_purchase_completed`, `subscription_trial_started`, `subscription_restored`, `paywall_dismissed`, `ad_clicked`, `ad_failed`, `rewarded_ad_attempt`, `rewarded_ad_complete`, `interstitial_ad_shown`, `native_ad_shown`, `login`, `auth_logout`, `auth_account_deleted`, `onboarding_skipped`) 가 동일 14개 set 으로 검증 중. ✅

### 2.4 reference v1.1 표 vs enum 사이 누락 (M2)

**enum 에는 있지만 reference 표 본문에는 없는 이벤트 3개**:

| Event | enum 위치 | reference §본문 | reference §"Migration Notes" |
|---|---|---|---|
| `session_start` | ✅ (4 SDK 모두) | ❌ §1 Lifecycle 표 (line 108-110) 에 없음 | — |
| `session_end` | ✅ (4 SDK 모두) | ❌ §1 Lifecycle 표 에 없음 | — |
| `ad_native_view` | ✅ (4 SDK 모두) | ❌ §6 Advertising 표 (line 169-173) 에 없음 | ⚠️ Migration Notes (line 260) `native_ad_*` → `ad_native_*` 에서만 언급 |

**원인**:
- `session_start` / `session_end` 는 SDK 의 `startSession()` / `endSession()` 이 자동 발화 (`EodinAnalytics.{dart,kt,swift}` 의 `track('session_start')` / `track('session_end')` 호출). 즉 *SDK internal* 이벤트라 호스트 앱이 직접 호출하지 않지만, enum 에 노출되면 사용자가 호출 가능 — reference 표에도 등재 필요.
- `ad_native_view` 는 Migration Notes 에서 "rename 결과" 로만 등장. reference §6 표에 본문 행 누락.

**영향**:
- (낮음) wire-format 은 enum 에 정확히 명시되어 있어 *데이터 정합* 측면 회귀 없음
- (중간) reference 가 "single source of truth" 역할인데 enum 과 mismatch 가 있어 logging-agent 가 audit 시 "reference 에 없는 이벤트가 enum 에 있다" 라는 false positive 발생 가능
- (중간) `session_start` / `session_end` 의 trigger 조건 / 페이로드 (reference 표의 4번째 컬럼) 가 문서화되지 않아 호스트 앱 개발자가 "이걸 직접 발화해야 하나?" 헷갈림. SDK 가 자동 발화한다는 사실이 docstring 에만 있음.

**Recommended fix** (Phase 5 마이그 audit 전, MEDIUM):
1. `unified-event-reference.md` §1 Lifecycle 표에 2행 추가:
   ```markdown
   | `session_start` | — | — | SDK 의 `startSession()` 자동 발화 (앱 직접 호출 불필요) | — |
   | `session_end` | — | — | SDK 의 `endSession()` 자동 발화 | — |
   ```
2. `unified-event-reference.md` §6 Advertising 표에 1행 추가:
   ```markdown
   | `ad_native_view` | `placement` | `source` | Native ad 노출 (Arden / 향후 Plori) |
   ```

---

## 3. Capacitor wire-format 보존 검증

### 3.1 jest 모킹 기반 통합 테스트 검증

`packages/capacitor/src/__tests__/eodin-event.test.ts:74-122` 의 `EodinAnalytics.track wire-format integration` describe block:

| Scenario | 입력 | 기대 wire-format | 검증 |
|---|---|---|---|
| `EodinEvent.AppOpen` 단독 호출 | `track(EodinEvent.AppOpen)` | `bridge.track({eventName:'app_open', properties:undefined})` | ✅ line 96-101 |
| `EodinEvent.SubscribeStart` + properties | `track(EodinEvent.SubscribeStart, {plan,price,currency})` | `bridge.track({eventName:'subscribe_start', properties:{...}})` | ✅ line 103-113 |
| 자유 string 호환 (backward compat) | `track('recipe_view', {recipe_id})` | `bridge.track({eventName:'recipe_view', properties:{...}})` | ✅ line 115-121 |

→ **3개 시나리오 모두 native bridge 까지 wire-format snake_case 가 보존됨**을 jest mock 레벨에서 검증. M4 (wire-format 보존 회귀 미감지) 의 Capacitor 측 권장사항이 충족됨.

### 3.2 Flutter wire-format 보존 검증

`packages/sdk-flutter/test/eodin_event_test.dart:70-108` 의 `EodinAnalytics.trackEvent wire-format integration` group:

- `MockClient` 가 HTTP body 의 `event_name` field 를 capture
- `trackEvent(EodinEvent.appOpen)` / `trackEvent(EodinEvent.subscribeStart, ...)` 호출 후 captured list 가 `'app_open'` / `'subscribe_start'` 를 포함하는지 검증
- **Critical**: Dart enum 의 builtin `name` getter 함정 검증 — `'appOpen'` / `'subscribeStart'` (PascalCase) 가 wire format 에 *나타나지 않아야* 함을 명시 검증 (line 105-106)

→ Flutter 도 wire-format 보존 회귀를 직접 막는 통합 테스트 존재. M4 권장사항 충족.

### 3.3 iOS / Android wire-format 보존

iOS `EodinEventTests.swift` 와 Android `EodinEventTest.kt` 는 enum 정의 검증만 (snake_case regex / forbidden / unique). `EodinAnalytics.track(.appOpen)` 호출 → wire-format 보존을 검증하는 *통합* 테스트 부재.

다만 다음 이유로 회귀 위험은 Capacitor / Flutter 보다 낮음:
- Swift `case appOpen = "app_open"` + `event.rawValue` 사용 — 컴파일러가 raw type `String` 을 강제, 런타임 misuse 불가
- Kotlin `APP_OPEN("app_open")` + `event.eventName` 사용 — Dart 의 `name` builtin 함정 같은 misuse 경로 없음 (Kotlin enum 의 `name` 은 `"APP_OPEN"`, `eventName` 명시 호출 필요)

**Recommended fix**: Phase 1.6 코드리뷰 M4 권장에 따라 iOS / Android 통합 테스트는 Phase 1.7 후속에서 보강 가능. 본 audit 에서 *블로킹 아님*. NIT N1 으로 등재.

---

## 4. 마이그 영향 평가

### 4.1 Backward Compatibility — free-form string

| SDK | v2 후 v1 호출 동작 | 검증 |
|---|---|---|
| Flutter | `EodinAnalytics.track('recipe_view', properties: {...})` 동작 | ✅ `eodin_analytics.dart:138` 의 string-based `track` 변경 없음. `trackEvent(EodinEvent)` 는 *추가* 메서드 |
| iOS | `EodinAnalytics.track("recipe_view", properties: [...])` 동작 | ✅ `EodinAnalytics.swift:133` static `track(_ eventName: String, ...)` 그대로. enum overload 가 *추가*되며 internally `track(event.rawValue, properties:)` 호출 (무한 재귀 없음 — Swift overload resolution 이 String 우선) |
| Android | `EodinAnalytics.track("recipe_view", mapOf(...))` 동작 | ✅ `EodinAnalytics.kt:186` 그대로. enum overload `fun track(event: EodinEvent, ...)` 추가, JVM signature 충돌 없음 |
| Capacitor | `EodinAnalytics.track('recipe_view', {recipe_id: 'abc'})` 동작 | ✅ wrapper 의 positional `track(eventName, properties?)` 가 free-form string 을 그대로 forward (`__tests__/eodin-event.test.ts:115-121` 검증) |

→ **Flutter / iOS / Android 는 100% backward compat**. Capacitor 만 v1 객체 인자 (`track({eventName, properties})`) 가 v2 에서 *깨짐* — 의도된 breaking.

### 4.2 Capacitor v1 → v2 breaking 의 마이그 가이드 충분성

`phase-1.1-package-structure.md:170-176` 표:

| v1 | v2 |
|---|---|
| `EodinAnalytics.track({ eventName, properties })` | `EodinAnalytics.track('event_name', { ... })` (positional 정렬) |
| (없음) | `EodinAnalytics.track(EodinEvent.AppOpen)` — 권장 enum (Phase 1.6) |
| `EodinAnalytics.identify({ userId })` | `EodinAnalytics.identify(userId)` (positional) |

**평가**:
- ✅ before/after 명확히 표시
- ✅ `identify` 도 같이 positional 화 표시
- ✅ EodinEvent enum 권장 추가 표시
- ⚠️ npm package 페이지에 노출되는 `packages/capacitor/README.md` 부재 (선행 코드리뷰 N5) — 마이그 가이드가 docs/ 안에만 있어 npm 사용자 진입 어려움. Phase 1.10 release 전 README 추가 권장.

**평가 결과**: 마이그 가이드 자체는 명확. 다만 *접근성* (npm 페이지) 관점에서 N5 후속 필요.

### 4.3 host app 채택 영향 (logging 관점)

5개 호스트 앱이 v2 SDK 로 업그레이드 시:

| App | Platform | 영향 |
|---|---|---|
| Fridgify | Flutter | 무영향 (string-based track 그대로 동작). enum 채택은 Phase 5 마이그에서 점진 |
| Plori | Flutter | 동일 |
| Tempy | Flutter | 동일 |
| Arden | Flutter | 동일 |
| Kidstopia | Capacitor (Ionic) | ⚠️ track `({eventName, properties})` → `(eventName, properties)` 호출 변경 필요. 단순 mechanical refactor 이지만 5개 앱 중 유일하게 코드 변경 필수 |

→ Kidstopia 는 v2 채택 시 1회 일괄 정정 필요. `phase-1.1-package-structure.md` §4.4 의 마이그 가이드만으로 충분히 자체 수행 가능 — 추가 audit 산출물 불필요.

---

## 5. Findings

### M1. `daily_limit_reached` 의 시제 모호성 (Rule 4 회색지대)

- **Severity**: MEDIUM
- **Category**: 명명 규칙 일관성
- **File**: `unified-event-reference.md:158`, 4 SDK enum (`dailyLimitReached` / `DAILY_LIMIT_REACHED`)
- **Issue**: reference 의 Rule 4 ("Action = present tense, e.g. `photo_upload` not `photo_uploaded`") 와 Rule 5 ("Completion = `_complete`") 가 직접 적용되면 `daily_limit_reached` 는 다음 둘 중 하나로 해석 가능:
  - (a) `daily_limit_hit` 또는 `daily_limit_trigger` (Rule 4 — 현재 동사)
  - (b) `daily_limit_reach_complete` (Rule 5 — 명시적 _complete 접미사)
  - (c) (현 상태) `daily_limit_reached` — 과거분사가 형용사처럼 쓰임 ("limit-was-reached" 조건 감지)

  현재 `_reached` 는 *상태 도달 이벤트* 로서 일반적으로 통용되는 명명 (`level_reached`, `target_reached` 등) 이고 Firebase 의 권장 이벤트에도 `level_end` (도달 시점) 이 있어 합리적이지만, reference 의 Rule 4 에 직접 위배된다고 보면 위반. `_dismiss` / `_upgrade_tap` 같이 같은 family 의 다른 이벤트는 Rule 4 정확 준수 (현재시제) — 일관성 측면 약점.
- **Impact**: 낮음 — wire-format 변경 없이 재해석 가능. 단 신규 family 추가 시 (`feature_limit_reached`?) 같은 회색 패턴 반복 위험.
- **Recommended fix**:
  - **권장**: 현 상태 유지 + reference 의 Rule 4 에 한 줄 footnote 추가 — *"State-reached events (e.g. `daily_limit_reached`, `level_reached`) are an exception — past participle used adjectively to describe the triggering condition."* 이러면 Rule 4 와 충돌 해소 + 신규 추가 시 일관 패턴.
  - (대안) `daily_limit_hit` 로 rename — 그러나 SDK 4채널 enum 이미 release 후라 추가 cost. **권장 안 함**.
- **결정 권한**: SDK 개발자 + logging-agent 소유자.

### M2. reference v1.1 표 본문에 enum 항목 일부 누락 (`session_start`, `session_end`, `ad_native_view`)

- **Severity**: MEDIUM
- **Category**: 문서 정합 / single source of truth
- **Files**: `docs/logging/unified-event-reference.md`
- **Issue**: 위 §2.4 에 상세 — enum 의 39 entries 중 3개가 reference 표 본문에 부재. SDK 가 자동 발화하는 `session_start`/`session_end` 와 v2 새 표준 `ad_native_view` 가 표에서 빠져 있음.
- **Impact**:
  - logging-agent 가 호스트 앱 audit 시 "reference 에 없는 이벤트가 enum 에 있음" 감지 → false positive 보고 가능
  - 호스트 앱 개발자가 reference 만 보고 작업하면 `ad_native_view` 사용 가능성 누락
  - `session_start` / `session_end` 의 *발화 주체* (SDK 자동 vs 호스트 앱) 가 문서화되지 않아 중복 발화 위험 (호스트 앱이 별도로 호출)
- **Recommended fix**: §2.4 의 fix 적용 — 3행 reference v1.1 표에 추가. v1.1.1 patch 발행.
- **Effort**: <10 분. 문서 변경만, SDK 변경 무.

### M3. 선행 코드리뷰 M3 (`subscribe_restore` prefix 통일) 미적용 — 의도된 보류인지 명시 필요

- **Severity**: MEDIUM
- **Category**: prefix 일관성 / 결정 추적
- **Files**:
  - `unified-event-reference.md:156` — `subscription_restore`
  - 4 SDK enum — `subscriptionRestore = "subscription_restore"`
  - `event-schema-audit.md:46, 140` — `subscription_restore`
- **Issue**: 선행 코드리뷰 (`phase-1.6-code-review.md` §M3) 에서 다른 monetization 이벤트 (`subscribe_start`, `subscribe_renew`) 가 `subscribe_*` prefix 인데 `subscription_restore` 만 `subscription_*` 로 남아 있어 통일 권장 (`subscribe_restore` 로 rename) 한 바 있음. 현재 SDK 코드 / reference / audit 모두 *그대로 유지*. Phase 1.6 closing 시 결정한 결과인지, 단순 미반영인지 문서로 추적 안 됨.
- **Impact**:
  - 데이터 분석 시 `event_name LIKE 'subscribe_%'` 쿼리에서 restore 누락
  - PRD §15.2 cross-app LTV / Conversion API mapping 영향은 작음 (restore 는 funnel 이벤트 아님)
  - 다만 한 번 release 된 wire-format string 은 v3 까지 끌고 가게 됨 — Phase 5 마이그 시점 *전* 이 마지막 정정 기회
- **Recommended fix** (택 1):
  1. **유지 결정**: `open-issues.md` 또는 `unified-event-reference.md` Migration Notes 에 한 줄 명시 — *"`subscription_restore` 는 prefix 통일에서 의도적 예외로 유지. 사유: 1) v1 fridgify 의 `subscription_restored` 와의 단순 시제 정정만 수행, 2) restore 는 conversion-funnel 외 이벤트라 통일 우선순위 낮음, 3) Phase 5 마이그 추가 cost 회피"*
  2. **정정**: enum 4개 + reference + audit §6.1 `subscription_restore` → `subscribe_restore` 일괄 변경 (Phase 5 마이그 *전* 에만 가능). Phase 1.6 closing 결정 필요.
- **결정 권한**: SDK 개발자 + Phase 1.6 owner. 본 audit 은 결정 자체에 권고 안 함 — 추적성만 요구.

### N1. iOS / Android wire-format 보존 통합 테스트 부재 (코드리뷰 M4 후속)

- **Severity**: NIT
- **Category**: 테스트 커버리지
- **Files**:
  - `packages/sdk-ios/Tests/EodinAnalyticsTests/EodinEventTests.swift` — enum 정의만
  - `packages/sdk-android/src/test/java/app/eodin/analytics/EodinEventTest.kt` — enum 정의만
- **Issue**: Capacitor / Flutter 는 wire-format 보존 통합 테스트가 추가됐지만 (jest mock / MockClient), iOS / Android 는 미보강. 선행 코드리뷰 M4 의 권장 4채널 모두 적용 중 2채널 완료.
- **Impact**: 낮음 (§3.3 에 분석) — Swift / Kotlin 의 enum + `eventName` 사용 패턴이 Dart `name` 함정 같은 misuse 경로 없음. 다만 Phase 1.6 의 cross-platform 일관성 원칙에 비춰 4채널 동등 보강이 이상적.
- **Recommended fix**: Phase 1.7 (테스트 보강) 또는 Phase 1.9 ticket 으로 등재. 본 audit 결과 블로킹 아님.

### N2. `voice_*` family enum 미포함이 의도적임을 enum docstring 에 명시 안 됨 (코드리뷰 N4 미반영)

- **Severity**: NIT
- **Category**: 문서 / docstring
- **Files**: 4 SDK enum 의 헤더 docstring
- **Issue**: reference v1.1 §"voice_* family (Arden 도메인 표준)" (line 215-227) 의 6개 `voice_*` 이벤트는 4 SDK enum 에 0개 포함됨 — 이는 "domain-specific events 는 free-form string 으로 호출, enum 에는 cross-app universal 만 등재" 라는 합리적 설계 결정. 그러나 enum 헤더 docstring 에 그 정책이 명시되어 있지 않아 향후 "왜 voice_select 만 enum 에 없는가" 질문 발생 가능.
- **Recommended fix**: 4 SDK enum 헤더 docstring 에 1-3줄 추가 — *"Domain-specific events (e.g., `recipe_*`, `voice_*`, `zone_*`, `temperature_*`) are intentionally excluded — use free-form `track('event_name')` for those. Only cross-app universal events that map to ad-platform Conversion APIs or appear in 3+ apps are included here."*
- **Effort**: 4 SDK × 3 lines = 12 LoC.

### N3. `account_delete.reason` 의 enum 값이 reference 표 셀 내부에만 존재 — 별도 §"Standard Parameter Values" 섹션 부재

- **Severity**: NIT
- **Category**: 문서 구조
- **Files**: `unified-event-reference.md:119`
- **Issue**: `reason` enum 5개 값 (`not_using` / `privacy_concern` / `found_alternative` / `too_expensive` / `other`) 이 §2 Authentication 표의 "Trigger" 셀 안에 inline 으로만 명시. 다른 enum 값 정의 (예: ATT `status` 의 5개 값) 는 §8 표 *아래* 별도 한 줄 (`unified-event-reference.md:191`) 로 분리되어 있음 — 일관성 약점.
- **Impact**: 낮음 — 표 폭 좁아져 가독성 저하. enum 값 추가 시 (예: `feature_request`) 셀 내부 inline 부담.
- **Recommended fix**: §2 표 아래 한 줄 추가 (§8 ATT 형식 따름):
  ```markdown
  `reason` values: `not_using`, `privacy_concern`, `found_alternative`, `too_expensive`, `other`
  ```
- **Effort**: 30초.

### N4. `pass_*` family 의 `pass_type` 값 enum 미정의

- **Severity**: NIT
- **Category**: 문서 — parameter values
- **Files**: `unified-event-reference.md:161-163`
- **Issue**: `pass_view` / `pass_purchase` / `pass_expire` 의 required param `pass_type` 의 가능한 값 (예: `day`, `week`, `month`, `unlimited`?) 이 reference 에 명시 안 됨. 5개 앱 중 어떤 앱이 어떤 값을 쓸지 미정 (Phase 5 마이그 시 결정).
- **Impact**: 낮음 — 호스트 앱마다 `pass_type` 값이 달라 cross-app 분석 시 join 실패 가능. 단 v1.1 시점에는 어느 호스트 앱도 `pass_*` 미구현이라 허용 가능.
- **Recommended fix**: Phase 5 마이그 audit 시 5개 앱 중 첫 번째 `pass_*` 채택 앱이 결정한 enum 을 reference v1.2 에 등재.
- **Effort**: Phase 5 시점. 본 audit 에서 변경 불필요.

---

## 6. Positive Observations

- **39 × 4 = 156 entries 100% 일치** — wire-format 단일 진실 보존. 4채널 동시 갱신을 강제하는 forbidden v1 names 테스트가 회귀 가드 역할 정확.
- **Capacitor 통합 테스트 (`__tests__/eodin-event.test.ts:74-122`)** — jest mock 으로 native bridge 까지의 wire-format 보존을 직접 검증하는 가장 valuable 한 가드. Dart `name` getter 함정 같은 cross-language misuse 회귀를 막는 정확한 위치.
- **Flutter `MockClient` 통합 테스트** — HTTP body 의 `event_name` 을 capture 해 enum builtin `name` getter 의 함정 (PascalCase `'appOpen'` 누출) 을 명시 검증. enum 도입의 가장 흔한 회귀 패턴 정확 차단.
- **`account_delete.reason` 5개 분류** — PIPA / GDPR Art. 17 erasure 요청에 필요한 churn 동기 기록 표준화. industry-standard segmentation 과 정합.
- **Capacitor wrapper `Object.create(_EodinAnalyticsBridge)` 패턴 채택** — 선행 코드리뷰 H1 의 prototype-chain forwarding 권장 (차선책) 이 적용됨. 향후 plugin 메서드 추가 시 silent 누락 회로 차단.
- **Migration Notes (v1 → v2)** — reference v1.1 의 §"Migration Notes" 표가 5개 앱 17건 명명 충돌을 명시 매핑. Phase 5 마이그 시 audit 산출물로 직접 사용 가능. v1.1 changelog 에서 변경 추적 가능.
- **Backward compat 보존 (Flutter / iOS / Android)** — string-based `track()` 호출이 변경 없이 동작. v2 SDK 채택 만으로는 호스트 앱 코드 변경 불필요 (Capacitor 만 예외, 의도된 v2 breaking).
- **Conversion API funnel 7종 모두 enum 등재** — Meta CAPI / Google Ads / TikTok Events / LinkedIn Conversion API 매핑에 필요한 모든 funnel 이벤트가 4채널 enum 에 typo 없이 정확히 포함.

---

## 7. Funnel Coverage (SDK 단)

reference v1.1 §"Standard Funnel Events" 의 7개 이벤트 vs 4 SDK enum:

```
app_install ──→ app_open ──→ core_action ──→ paywall_view ──→ subscribe_start
                                                            ──→ trial_start
                                                            ──→ subscribe_renew
```

| 이벤트 | enum 등재 | reference 표 등재 | Conversion API 매핑 |
|---|---|---|---|
| `app_install` | ✅ 4/4 | ✅ | ✅ Meta Install / TikTok InstallApp |
| `app_open` | ✅ 4/4 | ✅ | ✅ Meta AppOpen / TikTok LaunchAPP |
| `core_action` | ✅ 4/4 | ✅ | ✅ Meta ViewContent / TikTok ViewContent |
| `paywall_view` | ✅ 4/4 | ✅ | ✅ Meta InitiateCheckout |
| `subscribe_start` | ✅ 4/4 | ✅ | ✅ Meta Purchase / Google purchase |
| `trial_start` | ✅ 4/4 | ✅ | ✅ Meta StartTrial |
| `subscribe_renew` | ✅ 4/4 | ✅ | ✅ Meta Subscribe / Google subscription_renewal |

→ **SDK 단 funnel coverage 100%** (7/7). 호스트 앱의 실제 발화는 Phase 5 마이그 audit 에서 별도 검증.

---

## 8. Coverage Score

| 항목 | 점수 | 가중치 | 환산 |
|---|---|---|---|
| Naming convention 정합성 (신규 13 family) | 12/13 | 25% | 23.1 |
| 4 SDK enum 일관성 (156 entries) | 156/156 | 25% | 25.0 |
| Conversion API funnel coverage | 7/7 | 20% | 20.0 |
| Wire-format 보존 테스트 (4채널 중 2채널) | 2/4 | 10% | 5.0 |
| Backward compat (Flutter/iOS/Android string-based) | 3/3 | 10% | 10.0 |
| 문서 ↔ 코드 정합 (reference v1.1 ↔ enum) | 36/39 | 10% | 9.2 |
| **합계** | | 100% | **92.3 / 100** |

**점수 해석**:
- 90 점대 = release-quality. SDK 단 enum 도입과 reference v1.1 발행은 Phase 1.6 의 의도된 산출물을 정확히 달성.
- 감점 요인:
  - M2 (3개 이벤트 reference 표 누락) — 9.2/10 차이의 0.8점
  - N1 (iOS/Android wire-format 통합 테스트 미보강) — 5.0/10 차이의 5.0점 (가중치 작아 영향 제한)
  - M1 (`_reached` 시제 footnote 부재) — 23.1/25 차이의 1.9점
- 가산 (보너스 — 점수에 미반영, 정성 평가):
  - Capacitor + Flutter 의 wire-format 통합 테스트 *추가* 자체가 회귀 방지 가치 큼
  - prototype-chain wrapper 채택 (선행 코드리뷰 H1 후속) — 향후 surface 누락 회로 차단

---

## 9. Action Items (logging audit 관점)

### Must (Phase 5 마이그 audit 전 — reference 정합)
- [ ] **M2**: `unified-event-reference.md` §1 Lifecycle 표에 `session_start` / `session_end` 2행 추가, §6 Advertising 표에 `ad_native_view` 1행 추가. v1.1.1 patch 발행.

### Should (Phase 1.6 closing 결정)
- [ ] **M3**: `subscription_restore` 의 prefix 유지/정정 결정 — 결정 결과를 `unified-event-reference.md` §"Migration Notes" 또는 `open-issues.md` 에 명시. 본 audit 은 결정 자체에 권고 안 함.
- [ ] **M1**: `unified-event-reference.md` §"Event Naming Rules" Rule 4 에 state-reached event footnote 1줄 추가.

### Nice (Phase 1.7 / 1.10 release 전)
- [ ] **N1**: iOS / Android wire-format 보존 통합 테스트 보강 (Phase 1.7 ticket).
- [ ] **N2**: 4 SDK enum 헤더 docstring 에 "domain-specific events excluded" 정책 명시 (12 LoC).
- [ ] **N3**: `unified-event-reference.md` §2 Authentication 표 아래 `reason` enum 값 한 줄 추가 (§8 ATT `status` 형식 따름).

### 후속 (Phase 5 마이그 시점)
- [ ] **N4**: 첫 `pass_*` 채택 앱이 결정한 `pass_type` enum 값을 reference v1.2 에 등재.
- [ ] (외부 — 코드리뷰 N5) `packages/capacitor/README.md` 신설 — npm 페이지용 마이그 가이드 stub.

---

## 10. Verdict

**Approve with documentation fixes** — Phase 1.6 의 SDK 단 enum 도입은 *데이터 정합* 영역에서 회귀 위험 0. 4채널 wire-format 일관, conversion API funnel 100%, backward compat (Flutter/iOS/Android 100%, Capacitor v2 의도 breaking + 마이그 가이드 충분). 다만 reference v1.1 문서가 enum 의 일부 항목 (3개) 을 표 본문에서 누락한 mismatch 가 있어 Phase 5 마이그 audit 전에 v1.1.1 patch 권장. 모두 문서 갱신 수준이며 wire-format / breaking change 영역의 회귀 없음.

5개 호스트 앱의 17건 명명 충돌 정정은 Phase 5 마이그 audit 에서 별도 수행 — 본 audit 범위 밖 (요청 제약 준수).
