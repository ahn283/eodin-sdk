# SDK 사용 패턴 매트릭스 (Phase 0.1)

**작성일:** 2026-05-02
**대상:** fridgify / plori / tempy / arden / kidstopia (5개 앱)
**참조:** PRD §2, §11.1

5개 앱이 호출하는 eodin SDK 메서드/이벤트 전수 조사. v2 마이그 계획 (Phase 1, Phase 5) 의 입력.

---

## 1. 의존성 선언 매트릭스

| 앱 | 패키지명 | 선언 방식 | 경로 / URL | 상태 |
|---|---|---|---|---|
| **fridgify** | `eodin_deeplink` | local path | `../libs/eodin-sdk/packages/sdk-flutter` | ✅ Phase 0.5 정합 (submodule URL 적용) |
| **plori** | `eodin_deeplink` | git ref:main | `https://github.com/ahn283/eodin.git` `packages/sdk-flutter` | 🔴 **회귀 리스크** — `ahn283/eodin` 의 `packages/sdk-flutter` 는 Phase 0.5 에서 제거됨. fresh fetch 시 깨짐 |
| **tempy** | `eodin_deeplink` | git ref:main | `https://github.com/ahn283/eodin.git` `packages/sdk-flutter` | 🔴 **회귀 리스크** — 동일 |
| **arden** | `eodin_deeplink` | local path | `../Github/eodin/packages/sdk-flutter` | 🔴 **회귀 리스크** — 디렉토리 삭제됨. submodule 로 옮겨서 `../Github/eodin/libs/eodin-sdk/packages/sdk-flutter` 로 변경 필요 |
| **kidstopia** | `@eodin/capacitor` | vendor tgz | `file:vendor/eodin-capacitor-1.0.0.tgz` | ⚠️ 정적 파일 — npm publish 필요 (Phase 0.5.6) |

### 1.1 즉시 조치 필요 (Phase 1 진입 전)

- [ ] **plori** `pubspec.yaml`: git URL 을 `ahn283/eodin-sdk` 로 변경 (path 는 `packages/sdk-flutter` 동일)
- [ ] **tempy** `pubspec.yaml`: 동일 변경
- [ ] **arden** `pubspec.yaml`: local path 를 `../Github/eodin/libs/eodin-sdk/packages/sdk-flutter` 로 변경 (또는 git URL)
- [ ] **kidstopia**: Phase 0.5.6 (5채널 publish) 완료 후 `@eodin/capacitor: ^1.x` 로 전환

위 조치를 취하지 않으면 5개 앱 중 3개가 SDK 변경 시점에 빌드 실패 가능.

---

## 2. SDK 메서드 호출 매트릭스

### 2.1 EodinAnalytics

| 메서드 | fridgify | plori | tempy | arden | kidstopia | 비고 |
|---|---|---|---|---|---|---|
| `configure()` | ✅ | ✅ | ✅ | ✅ | ✅ | 전 앱 사용. v2 에서 인스턴스 패턴 결정 영향 받음 (S7) |
| `track()` | ✅ (직접) | ✅ (wrapper) | ✅ (wrapper, `_sendEventDirect` 우회) | ✅ (wrapper) | ✅ (wrapper) | 호출 패턴 — 직접 vs 자체 service 클래스 wrapping |
| `identify()` | ✅ | ✅ | ✅ | ✅ | ✅ | 인증 직후 호출. v2 에서 `EodinAuth.signIn` 가 자동 호출하도록 |
| `clearIdentity()` | ✅ | ✅ | ✅ | ✅ | ✅ (런타임 cast 검사) | signOut 직후 |
| `setAttribution()` | ✅ | ❌ | ❌ | ❌ | ❌ | fridgify 전용 (deferred deeplink → attribution) |
| `flush()` | ✅ | ✅ | ✅ | ✅ | ✅ | 앱 background/foreground 전환 시 |
| `startSession()` / `endSession()` | ❌ | ❌ | ✅ | ✅ | ❌ | tempy, arden 만. lifecycle 처리 분리 |
| `setDeviceATT()` | ✅ | ❌ | ❌ | ❌ | ❌ | fridgify 만 명시 호출 (iOS ATT 결과 전달) |
| `requestTrackingAuthorization()` | ❌ | ❌ | ❌ | ❌ | ✅ | kidstopia 만 — Capacitor 에서 자체 ATT 요청 |
| `getATTStatus()` | ❌ | ❌ | ❌ | ❌ | ❌ | 사용처 없음 |
| `getStatus()` | ❌ | ❌ | ❌ | ❌ | ✅ | kidstopia 디버그 |
| `setEnabled()` (GDPR) | ❌ | ❌ | ❌ | ❌ | ❌ | 사용처 없음 — v2 에서 `EodinAuth.withdrawConsent` 와 연동 필요 |
| `requestDataDeletion()` | ❌ | ❌ | ❌ | ❌ | ❌ | 사용처 없음 — v2 에서 `EodinAuth.deleteAccount` 의 일부로 흡수 |
| `reset()` | ❌ | ❌ | ❌ | ❌ | ❌ | 사용처 없음 |

### 2.2 EodinDeeplink

| 메서드 | fridgify | plori | tempy | arden | kidstopia | 비고 |
|---|---|---|---|---|---|---|
| `configure()` | ✅ | ✅ | ✅ (조건부) | ❌ (auth 만) | ✅ | arden 은 deeplink 미사용 — analytics 만 |
| `checkDeferredParams()` | ✅ | ✅ | ✅ | ❌ | ✅ | 첫 진입 시 1회 |
| `isReady` (getter) | ✅ | ❌ | ❌ | ❌ | ❌ | fridgify 만 가드 체크 |
| `reset()` | ❌ | ❌ | ❌ | ❌ | ❌ | 사용처 없음 |

### 2.3 EodinAuth (v2 신설 — 현재 0개)

5개 앱 모두 `EodinAuth` 미사용 (자체 Firebase Auth/NextAuth/Supabase Auth 사용). v2 에서 신규 도입.

---

## 3. Track 이벤트 매트릭스

각 앱이 `EodinAnalytics.track(eventName, properties)` 로 보내는 이벤트 목록.

### 3.1 fridgify
- 분석 wrapper (`AnalyticsService`) 가 Firebase Analytics 와 EodinAnalytics 양쪽으로 동시 send. 이벤트는 wrapper 의 메서드명에 의해 결정 — `track()` 직접 호출은 거의 없음.
- 주요 이벤트 (wrapper 시그니처에서 추론): 일반 user-action → `eventName` 자유 string. (정확한 이름은 logging-agent 의 unified event reference 와 비교 필요 — Phase 0.4)

### 3.2 plori
- `lib/main.dart:55` — 단일 wrapper `analytics_service.dart` 의 `track(eventName, properties)` 만 호출. 이벤트명은 호출처에서 결정 (자유 string).

### 3.3 tempy (가장 많은 이벤트 — 통합 이벤트 카탈로그의 기준이 될 가능성 큼)

`lib/services/eodin_analytics_service.dart` 에서 명시적으로 보내는 이벤트:

| 이벤트명 | 호출 wrapper |
|---|---|
| `app_install` | trackAppInstall |
| `app_open` | trackAppOpen |
| `core_action` | trackCoreAction (actionType 속성) |
| `paywall_view` | trackPaywallView |
| `paywall_dismiss` | trackPaywallDismiss |
| `subscribe_start` | trackSubscribeStart |
| `trial_start` | trackTrialStart |
| `child_create` | trackChildCreate |
| `temperature_log` | trackTemperatureLog |
| `medication_log` | trackMedicationLog |
| `family_join` | trackFamilyJoin |
| `family_invite` | trackFamilyInvite |
| `onboarding_complete` | trackOnboardingComplete |
| `sign_up` | trackSignUp |
| `sign_in` | trackSignIn |
| `settings_change` | trackSettingsChange |
| `content_view` | trackContentView |
| `att_response` | trackATTResponse |
| (자유 string) | trackCustomEvent |
| (광고) `ad_load_failed`, `ad_click`, `ad_impression` | (ad_service.dart 직접 호출) |
| (온보딩) `onboarding_start`, `onboarding_step`, `onboarding_skip` | (onboarding_screen.dart 직접 호출) |

### 3.4 arden
- `analytics_service.dart` 의 wrapper. 이벤트명은 caller 가 자유 string 으로 결정. tempy 와 같은 명시적 카탈로그 없음.

### 3.5 kidstopia
- `src/services/analyticsService.ts` 단일 wrapper `trackEvent(name, params)` — 자유 string. Capacitor SDK 의 track signature 가 `{ eventName, properties }` 라 약간 다름.

---

## 4. v2 마이그 영향 분석 (5개 앱 공통)

### 4.1 패키지 rename (M1, S6)

현재 패키지명 `eodin_deeplink` 가 deeplink-only 처럼 보이지만 실제로는 Analytics + Deeplink 모듈 모두 export. v2 에서 `eodin_sdk` 로 rename + 모듈별 import 제공:

```dart
// v1 (현재)
import 'package:eodin_deeplink/eodin_sdk.dart';
// v2 (제안)
import 'package:eodin_sdk/analytics.dart';
import 'package:eodin_sdk/deeplink.dart';
import 'package:eodin_sdk/auth.dart';
```

**호환성 정책 (PRD H2)**: `eodin_deeplink` 를 deprecated alias 로 6주 유지, v3 에서 폐기.

### 4.2 static → instance 패턴 (S7)

5개 앱 모두 `EodinAnalytics.track(...)` static 직접 호출. multi-init use case **0건** — Phase 1 의 H2 권고대로 v2 에서 보류 (gold-plating 회피).

### 4.3 EodinAuth 도입 영향

| 앱 | 현재 인증 | v2 EodinAuth 통합 위치 |
|---|---|---|
| fridgify | Firebase + 자체 OAuth/PW | `lib/features/auth/` 자체 코드 → `EodinAuth` 로 교체 (RevenueCat alias 영향, Phase 0.7) |
| plori | Firebase | `auth_provider.dart` 에 `EodinAuth.signIn` 자동 호출 추가 |
| tempy | Firebase + Supabase RLS | `auth_provider.dart` 에 `EodinAuth.signIn` + RLS JWT 매핑 |
| arden | Firebase | 신규 wrapper (`auth_provider` 미존재로 보임 — 확인 필요) |
| kidstopia | Firebase (Capacitor) | `analyticsService.ts` 와 동일 위치에 `EodinAuth` web/native 추가 |

### 4.4 endpoint 통일 (M2)

현재 5개 앱 모두 `link.eodin.app/api/v1` 또는 명시 안 하면 SDK 기본값 사용. v2 부터 `api.eodin.app/api/v1` 강제.

조사 필요 (Phase 1 진행 중):
- 각 앱의 `configure(apiEndpoint: ...)` 인자 hardcode 여부
- 환경변수 / config 파일 여부

---

## 5. 위험 / 후속 작업

| ID | 항목 | 우선순위 |
|---|---|---|
| R1 | plori/tempy/arden 의 SDK 의존성 경로가 구 monorepo 참조 — Phase 1 진입 전 일괄 update | 🔴 높음 |
| R2 | `track()` 이벤트명이 자유 string — logging-agent unified event reference 와 정합성 별도 검증 필요 | Phase 0.4 |
| R3 | tempy 가 가장 많은 이벤트 카탈로그 보유 — v2 의 `EodinEvent` enum 기준선이 될 가능성 (S9) | Phase 1.6 |
| R4 | arden 은 deeplink 미사용 — `EodinDeeplink.configure` 호출도 없음. v2 도 Auth + Analytics 만 사용 | Phase 5.2 영향 |
| R5 | kidstopia 의 Capacitor SDK 만 method signature 가 `{ eventName, properties }` 객체 — 다른 4개 (positional) 와 불일치 | Phase 1.1 (M1) |
| R6 | `setEnabled` (GDPR) / `requestDataDeletion` 는 5개 앱 모두 미사용 — v2 의 `EodinAuth.withdrawConsent` / `deleteAccount` 가 흡수 | Phase 1.4 |

---

## 6. 결론

- **5개 앱 모두 EodinAnalytics + EodinDeeplink 를 사용**하지만 wrapping 방식·이벤트 카탈로그·라이프사이클 처리가 제각각.
- **arden 만 deeplink 미사용** — analytics-only 채택.
- **tempy 가 이벤트 카탈로그 가장 풍부** — v2 권장 이벤트 enum 기준.
- **plori/tempy/arden 의존성 경로가 구 monorepo 참조** — Phase 1 진입 전 즉시 update 필요 (회귀 리스크).
- **EodinAuth 는 5개 앱 모두 v2 신규 채택** — 현재 사용 0건이라 breaking 없음.
