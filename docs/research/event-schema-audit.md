# 이벤트 스키마 정합성 점검 (Phase 0.4)

**작성일:** 2026-05-02
**기준:** `docs/logging/unified-event-reference.md` v1.0 (2026-04-04)
**대상:** fridgify / plori / tempy / arden / kidstopia
**참조:** PRD §6.2 S9 (이벤트 스키마 통일)

---

## 1. 결론

5개 앱 중 **kidstopia 와 tempy 가 unified reference 와 가장 정합** (각각 ~85% 일치). **fridgify 가 가장 많은 불일치** (정 reference 명명 규칙 위반 + 자체 작명).

총 **17건의 명명 충돌 / 규칙 위반** 식별 — Phase 1.6 의 `EodinEvent` enum 정의 시 한 번에 정리. v2 마이그 시점이 호환성 깨기 가장 적합한 시점.

---

## 2. 표준 funnel 이벤트 채택률

unified-event-reference §"Standard Funnel Events" 가 모든 앱에 의무화한 7개:

| 이벤트 | fridgify | plori | tempy | arden | kidstopia |
|---|---|---|---|---|---|
| `app_install` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `app_open` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `core_action` | ✅ (직접 호출) | ✅ | ✅ | ✅ | ✅ |
| `paywall_view` | ✅ | (없음) | ✅ | ✅ | ✅ |
| `subscribe_start` | ❌ `subscription_purchase_completed` | (없음) | ✅ | ✅ | ✅ |
| `trial_start` | ❌ `subscription_trial_started` | (없음) | ✅ | ✅ | (없음) |
| `subscribe_renew` | ❌ 미구현 | (없음) | ❌ 미구현 | ✅ | (없음) |

**즉시 조치 (Phase 5 마이그 시점)**:
- fridgify: `subscription_*` → `subscribe_*` 통일 (4개 이벤트)
- 모든 앱: `subscribe_renew` 누락 검토 — 구독 갱신 attribution 추적 못 하면 LTV 분석 불완전

---

## 3. 명명 규칙 위반 (unified reference §"Event Naming Rules")

### Rule 4 (action = present tense), Rule 5 (`_complete`), Rule 6 (`_start`) 위반

| 앱 | 현재 이벤트 | 규정 |
|---|---|---|
| fridgify | `paywall_dismissed` | `paywall_dismiss` (Rule 4) |
| fridgify | `subscription_purchase_completed` | `subscribe_start` (자체 명명 + Rule 5) |
| fridgify | `subscription_restored` | `subscription_restore` (Rule 4) |
| fridgify | `subscription_trial_started` | `trial_start` (자체 명명 + Rule 6) |
| fridgify | `recipe_cooking_started` | `recipe_cooking_start` (Rule 6) |
| fridgify | `infographic_generate_started` | `infographic_generate_start` (Rule 6) |
| fridgify | `infographic_generate_completed` | `infographic_generate_complete` (Rule 5) |
| fridgify | `ingredient_recognition_complete` | ✅ OK (이미 _complete) |
| arden | `onboarding_skipped` | `onboarding_skip` (Rule 4) |

### 이벤트명 자체 불일치 (reference 와 동일 의미인데 이름 다름)

| 의미 | reference | 위반 앱 |
|---|---|---|
| 광고 클릭 | `ad_click` | fridgify: `ad_clicked` |
| 광고 로드 실패 | `ad_load_failed` | fridgify: `ad_failed` |
| 보상형 광고 시청 | `ad_rewarded_view` | fridgify: `rewarded_ad_attempt`/`rewarded_ad_complete` |
| 전면 광고 노출 | `ad_interstitial_view` | arden: `interstitial_ad_shown` |
| 로그인 | `sign_in` | kidstopia: `login` |
| 로그아웃 | `sign_out` | arden: `auth_logout` |

→ 광고 이벤트는 **`ad_<action>` 또는 `ad_<format>_<action>` 으로 통일** (reference 패턴). 현재 fridgify 의 `rewarded_ad_*` / arden 의 `interstitial_ad_*` / `native_ad_*` 가 어순 뒤바뀜.

### 미정의 이벤트 (reference 추가 후보)

| 이벤트 | 사용 앱 | 검토 |
|---|---|---|
| `account_delete` | plori, arden (`auth_account_deleted`) | v2 의 `EodinAuth.deleteAccount` 와 연동 — reference 추가 필요 |
| `share` | arden | reference 에 있음 ✅ — 다른 앱은 미구현 (fridgify `recipe_share` 만 partial) |
| `force_update_*` | plori | 도메인 이벤트로 분류 가능. reference 미추가 |
| `daily_limit_*` | plori, arden (`daily_limit_reached`/`dismissed`/`upgrade_tapped`) | 두 앱이 동일 의미로 사용 중 — reference 추가 + 이름 통일 필요 |
| `voice_*` (clone/select/preview/record) | arden | arden 도메인 — `voice_*` 표준 prefix 로 reference §9 에 추가 |
| `language_change` | plori | reference §"User Properties" 의 user property 와 별도 이벤트로 trace 필요 시 추가 |

---

## 4. 카테고리별 채택 패턴

### 4.1 ATT (iOS App Tracking Transparency)

| 이벤트 | fridgify | plori | tempy | arden | kidstopia |
|---|---|---|---|---|---|
| `att_prompt` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `att_response` | ✅ | ❌ | ✅ | ✅ | ✅ |

→ fridgify, plori 가 `att_prompt` 누락. 사용자 동의 깔때기 분석 시 prompt 노출률 모름.

### 4.2 Onboarding

| 이벤트 | fridgify | plori | tempy | arden | kidstopia |
|---|---|---|---|---|---|
| `onboarding_start` | ✅ | (없음) | ✅ | ❌ | ❌ |
| `onboarding_step` | ❌ `onboarding_slide_view` | (없음) | ✅ | ✅ | ❌ |
| `onboarding_complete` | ✅ | (없음) | ✅ | ✅ | ❌ |
| `onboarding_skip` | ✅ | (없음) | ✅ | ❌ `onboarding_skipped` | ❌ |

→ fridgify 의 `onboarding_slide_view` 는 reference 의 `onboarding_step` 으로 정렬 필요 (param `step_index`/`step_name`).

### 4.3 광고 이벤트 분류

reference 는 `ad_<action>` 또는 `ad_<format>_<action>` 으로 통일. 현재 분포:

| 앱 | 패턴 | 예시 |
|---|---|---|
| fridgify | mixed (`ad_clicked`, `rewarded_ad_*`) | 정합 X |
| arden | `<format>_ad_*` (`interstitial_ad_*`, `native_ad_*`) | 어순 반대 |
| kidstopia | `ad_<format>_view`, `ad_load_failed` | ✅ reference 정합 |
| tempy | `ad_load_failed`, `ad_click`, `ad_impression` | ✅ 부분 정합 (`ad_impression` 은 reference 미정의) |

→ kidstopia 패턴이 reference 표준. fridgify/arden 통일 필요.

---

## 5. 파라미터 정합성 (sample 점검)

전수 조사는 v2 마이그 시점에 수행. Phase 0 에서는 high-impact 이벤트만 spot-check:

| 이벤트 | reference 필수 param | tempy 사용 | 정합 |
|---|---|---|---|
| `subscribe_start` | `plan`, `price`, `currency` | wrapper 가 properties dict 받음 — caller 의존 | △ caller 측 검증 필요 |
| `core_action` | `action_type` | ✅ wrapper 가 명시적으로 받음 | ✅ |
| `att_response` | `status`, `authorized` | ✅ | ✅ |
| `paywall_view` | `paywall_type` | ❌ tempy 는 `source` 만, `paywall_type` 누락 | ❌ |

→ `paywall_type` 누락이 5개 앱 모두 의심. Phase 1.6 에서 enum 도입 시 type-safe properties 강제.

---

## 6. v2 통일안 (Phase 1.6 입력)

### 6.1 즉시 정정 (Phase 5 마이그 시점)

| App | 변경 | 영향 |
|---|---|---|
| fridgify | `subscription_purchase_completed` → `subscribe_start` | RevenueCat → eodin 매핑 재확인 (Phase 0.7) |
| fridgify | `subscription_trial_started` → `trial_start` | 동일 |
| fridgify | `subscription_restored` → `subscription_restore` | 단순 rename |
| fridgify | `paywall_dismissed` → `paywall_dismiss` | 단순 rename |
| fridgify | `ad_clicked` → `ad_click`, `ad_failed` → `ad_load_failed` | 광고 깔때기 영향 |
| fridgify | `rewarded_ad_*` → `ad_rewarded_*` | 어순 통일 |
| fridgify | `infographic_generate_*` 시제 정정 | 단순 rename |
| arden | `interstitial_ad_*` → `ad_interstitial_*`, `native_ad_*` → `ad_native_*` | 어순 통일 |
| arden | `onboarding_skipped` → `onboarding_skip` | 단순 rename |
| arden | `auth_logout` → `sign_out` | 단순 rename |
| kidstopia | `login` → `sign_in` | 단순 rename |

### 6.2 reference 추가 (unified-event-reference.md v1.1)

- `account_delete` (Identity 카테고리) — v2 `EodinAuth.deleteAccount` 와 1:1 자동 발화
- `daily_limit_reached`, `daily_limit_dismissed`, `daily_limit_upgrade_tapped` (Monetization)
- `voice_*` family (Content Engagement, arden 도메인 표준)
- `pass_*` family (Monetization, plori 도메인 표준)

### 6.3 SDK v2 의 EodinEvent enum (Phase 1.6 S9)

```dart
// 권장 enum — 자유 string 도 허용 (backward compat)
enum EodinEvent {
  // Lifecycle
  appInstall('app_install'),
  appOpen('app_open'),
  sessionResume('session_resume'),
  // Auth
  signUp('sign_up'),
  signIn('sign_in'),
  signOut('sign_out'),
  accountDelete('account_delete'),
  // Onboarding
  onboardingStart('onboarding_start'),
  onboardingStep('onboarding_step'),
  onboardingComplete('onboarding_complete'),
  onboardingSkip('onboarding_skip'),
  // Core / Monetization
  coreAction('core_action'),
  paywallView('paywall_view'),
  paywallDismiss('paywall_dismiss'),
  subscribeStart('subscribe_start'),
  trialStart('trial_start'),
  subscribeRenew('subscribe_renew'),
  subscriptionRestore('subscription_restore'),
  iapPurchase('iap_purchase'),
  // Ads
  adRewardedView('ad_rewarded_view'),
  adInterstitialView('ad_interstitial_view'),
  adClick('ad_click'),
  adLoadFailed('ad_load_failed'),
  adFreePass('ad_free_pass'),
  // Social
  share('share'),
  inviteShare('invite_share'),
  inviteClaim('invite_claim'),
  friendAdd('friend_add'),
  // ATT
  attPrompt('att_prompt'),
  attResponse('att_response'),
}
```

### 6.4 Type-safe properties (선택)

```dart
// Compile-time 검증 — paywall_type 같은 필수 param 누락 방지
EodinAnalytics.track(EodinEvent.paywallView,
  properties: PaywallViewProps(paywallType: 'monthly', source: 'settings'));
```

자유 string properties 도 backward compat 으로 허용. 권장 enum 만 type-safe 강제.

---

## 7. 위험 / 후속 작업

| ID | 항목 | 우선순위 |
|---|---|---|
| E1 | fridgify 의 `subscription_*` rename — RevenueCat → eodin → 광고 플랫폼 CAPI 매핑 깨짐 가능. 스테이징 검증 필수 | 🔴 Phase 5.4 |
| E2 | Phase 1.6 enum 도입 시 5개 앱 동시 마이그 (단순 string 매핑) — wrapper 가 enum 받도록 | Phase 1.6 |
| E3 | `paywall_type` param 누락 5개 앱 모두 의심 — Phase 1 enum 으로 강제 | Phase 1.6 |
| E4 | `subscribe_renew` 가 5개 앱 중 arden 만 구현 — LTV 분석 위해 5개 앱 모두 추가 | Phase 5 마이그 시점 |
| E5 | unified-event-reference v1.1 업데이트 (account_delete, daily_limit, voice, pass family) | Phase 1.6 시작 시점 |
| E6 | logging-agent 의 audit 모드로 마이그 후 회귀 검증 | Phase 5 각 앱 마이그 후 |

---

## 8. 참고

- 통일안의 ROI: 통일된 이벤트명이 cross-app 분석 (PRD §15.2 "Cross-app 사용률") 의 전제. 현재 같은 의미의 이벤트가 앱별 다른 이름으로 와서 join 불가
- v2 breaking change 시점이 통일 비용 가장 적음 — Phase 1.6 의 enum 정의 + Phase 5 의 마이그 시 한 번에 정리
- backward compat: SDK v2 도 자유 string 허용 (legacy 이벤트 동작), enum 은 권장만
