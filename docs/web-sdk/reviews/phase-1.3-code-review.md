# Code Review: Phase 1.3 — EodinEvent enum + cross-channel parity test

**Date**: 2026-05-03
**Reviewer**: Senior Code Review Agent
**Scope**:
- 신규 `packages/sdk-web/src/eodin-event.ts` (82 줄, 38+1=39 entries)
- 신규 `packages/sdk-web/src/__tests__/eodin-event.test.ts` (101 줄, 8 describe blocks)
- 수정 `packages/sdk-web/src/index.ts` (placeholder `export {}` → 실제 export 1줄)

**Commit(s)**: 미커밋 (untracked + index.ts 1 modified)
**관련 PRD**: `docs/web-sdk/PRD.md` §6 / `docs/web-sdk/CHECKLIST.md` Phase 1.3
**이전 phase 리뷰**:
- `docs/web-sdk/reviews/phase-1.0-code-review.md`
- `docs/web-sdk/reviews/phase-1.2-code-review.md` (Grade A, M2/L1 적용)
**Phase 1.1 보류 사항**: H1 dual-package hazard — Phase 3 진입 전 결정 (본 phase 에서도 미해결, 적용 시점 임박 — F2 참조)

---

## Summary

Phase 1.3 은 4채널 (Flutter / iOS / Android / Capacitor) 의 EodinEvent enum 38 entries 를 web 으로 옮기면서 PageView 1 entry 를 web 고유로 추가한, 작고 잘 격리된 변경이다. **5채널 wire string parity 는 100% 정확** — Flutter `eodin_event.dart`, iOS `EodinEvent.swift`, Android `EodinEvent.kt`, Capacitor `eodin-event.ts` 의 38 entries 가 web 의 38 entries 와 모두 일치 (PageView 1 entry 만 web 고유). PageView 추가는 PRD §5.1 asymmetry 표 + 결정 로그 B3/L8 에 정당화됨. AttPrompt/AttResponse 의 web 보존은 Android 의 `// no-op on Android, kept for cross-platform consistency` 패턴과 정합. **CRITICAL 0건 / HIGH 0건**, MEDIUM 2건 (M1 Test invariant coverage 가 Android 대비 약함 — snake_case / ≤40자 / 유일성 / forbidden v1 names 누락, M2 Phase 1.3 결정 로그에 PageView 의 wire string anchor 부재 — 미래 mobile 추가 시 drift 가드 없음), LOW 3건 (L1 cross-channel test 가 capacitor src/ 직접 require — capacitor refactor 시 path fragility, L2 Test sets `EodinEvent` 를 `Record<string, string>` 으로 캐스트해 type-narrow loss, L3 PageView 가 alphabetical 순서가 아닌 Lifecycle 직후 위치 — 카테고리 일관성), INFO 4건. 4채널 surface 영향 0, 회귀 위험 없음. Build pass 보고 + .d.ts 출력 검증.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🟢 Low | 3 |
| 💡 Info | 4 |

---

## Critical & High Priority Findings

**해당 없음.**

근거 (검증 항목):

### 1. 5채널 wire string parity — 100% 일치 (검증 완료)

리뷰어가 4채널 enum 파일을 모두 정밀 비교한 결과, **38개 공통 entry 의 wire string 이 byte-exact 동일**:

| Entry (web) | wire string | Flutter | iOS | Android | Capacitor |
|---|---|---|---|---|---|
| AppInstall | `app_install` | ✅ `appInstall` | ✅ `appInstall` | ✅ `APP_INSTALL` | ✅ `AppInstall` |
| AppOpen | `app_open` | ✅ | ✅ | ✅ | ✅ |
| SessionResume | `session_resume` | ✅ | ✅ | ✅ | ✅ |
| SessionStart | `session_start` | ✅ | ✅ | ✅ | ✅ |
| SessionEnd | `session_end` | ✅ | ✅ | ✅ | ✅ |
| SignUp | `sign_up` | ✅ | ✅ | ✅ | ✅ |
| SignIn | `sign_in` | ✅ | ✅ | ✅ | ✅ |
| SignOut | `sign_out` | ✅ | ✅ | ✅ | ✅ |
| AccountDelete | `account_delete` | ✅ | ✅ | ✅ | ✅ |
| OnboardingStart | `onboarding_start` | ✅ | ✅ | ✅ | ✅ |
| OnboardingStep | `onboarding_step` | ✅ | ✅ | ✅ | ✅ |
| OnboardingComplete | `onboarding_complete` | ✅ | ✅ | ✅ | ✅ |
| OnboardingSkip | `onboarding_skip` | ✅ | ✅ | ✅ | ✅ |
| CoreAction | `core_action` | ✅ | ✅ | ✅ | ✅ |
| PaywallView | `paywall_view` | ✅ | ✅ | ✅ | ✅ |
| PaywallDismiss | `paywall_dismiss` | ✅ | ✅ | ✅ | ✅ |
| SubscribeStart | `subscribe_start` | ✅ | ✅ | ✅ | ✅ |
| TrialStart | `trial_start` | ✅ | ✅ | ✅ | ✅ |
| SubscribeRenew | `subscribe_renew` | ✅ | ✅ | ✅ | ✅ |
| SubscriptionRestore | `subscription_restore` | ✅ | ✅ | ✅ | ✅ |
| IapPurchase | `iap_purchase` | ✅ | ✅ | ✅ | ✅ |
| DailyLimitReached | `daily_limit_reached` | ✅ | ✅ | ✅ | ✅ |
| DailyLimitDismiss | `daily_limit_dismiss` | ✅ | ✅ | ✅ | ✅ |
| DailyLimitUpgradeTap | `daily_limit_upgrade_tap` | ✅ | ✅ | ✅ | ✅ |
| PassView | `pass_view` | ✅ | ✅ | ✅ | ✅ |
| PassPurchase | `pass_purchase` | ✅ | ✅ | ✅ | ✅ |
| PassExpire | `pass_expire` | ✅ | ✅ | ✅ | ✅ |
| AdRewardedView | `ad_rewarded_view` | ✅ | ✅ | ✅ | ✅ |
| AdInterstitialView | `ad_interstitial_view` | ✅ | ✅ | ✅ | ✅ |
| AdNativeView | `ad_native_view` | ✅ | ✅ | ✅ | ✅ |
| AdClick | `ad_click` | ✅ | ✅ | ✅ | ✅ |
| AdLoadFailed | `ad_load_failed` | ✅ | ✅ | ✅ | ✅ |
| AdFreePass | `ad_free_pass` | ✅ | ✅ | ✅ | ✅ |
| Share | `share` | ✅ | ✅ | ✅ | ✅ |
| InviteShare | `invite_share` | ✅ | ✅ | ✅ | ✅ |
| InviteClaim | `invite_claim` | ✅ | ✅ | ✅ | ✅ |
| FriendAdd | `friend_add` | ✅ | ✅ | ✅ | ✅ |
| AttPrompt | `att_prompt` | ✅ | ✅ | ✅ | ✅ |
| AttResponse | `att_response` | ✅ | ✅ | ✅ | ✅ |
| **PageView** | `page_view` | — | — | — | — | (web 고유, PRD §5.1 / B3 / L8 정당화) |

**기존 4채널 wire string drift 점검** — 4채널 자기 간에도 drift 없음 (38/38 일치). 본 phase 책임 외이지만 발견 없음을 명시.

### 2. PageView 추가 정당성

- PRD §5.1 의 asymmetry 표 1줄: `autoTrackPageView: ❌/❌/❌/❌/✅`
- 결정 로그 B3 (2026-05-03): "`autoTrackPageView: false` (default) configure option 명시. true 시 internal page-view tracker 가 history API + popstate 구독"
- 결정 로그 L8 (2026-05-03): "`autoTrackPageView` configure 옵션은 web 고유 — §5.1 asymmetry 표에 행 추가"
- PRD §3 의 "순수 web 로깅 surface" 4개 surface (page_view / 임의 custom event / identify / GDPR consent) 중 첫 번째

**결론**: PageView 추가는 정당화 완료. 단, **enum 자체에 PageView 가 들어간 시점 (Phase 1.3) 에 대한 결정 로그 entry 가 부재** — M2 참조.

### 3. AttPrompt / AttResponse 의 web 보존

- Android `EodinEvent.kt:74` 의 주석: `// iOS ATT (no-op on Android, kept for cross-platform consistency)`
- Web 의 주석 (eodin-event.ts:74-75): `// iOS ATT — web 에서 사용 안 하나 wire string 유지 (cross-app 분석에서 받을 수 있으므로 enum entry 보존)`

**결론**: Android 와 동일 패턴. cross-channel 분석 (예: 백엔드가 iOS / web 이벤트를 함께 집계) 시 wire string 일관성 보장. "개발자가 web 에서 호출 시 무의미한 이벤트 발생" 위험은 (i) free-form string 으로도 동일하게 발생 가능 (`track('att_prompt')`), (ii) backend dashboard 에서 platform 필터로 분리 가능, (iii) IDE 자동완성이 5채널 전역 지식을 일관되게 노출 — 위험 < 이득.

### 4. type-only export 적절성

`export type EodinEventName = (typeof EodinEvent)[keyof typeof EodinEvent]`:
- `as const` 가 readonly literal 화 → keyof 가 정확한 key union 도출 → indexed access 가 value union 도출
- TS 5.3 (`packages/sdk-web/devDependencies.typescript: ~5.3.0`) 에서 정상 동작
- `dist/esm/eodin-event.d.ts` 출력 검증: 39개 readonly entry + `EodinEventName` 정확히 export 됨
- `index.ts` 의 `export type` 키워드는 erasable — runtime entry 0 (tree-shake 친화)

**결론**: 의도대로 동작 + 빌드 산출 검증 완료.

### 5. Public surface 영향 (Phase 1.1 H1 dual-package hazard 와 관련)

- `src/index.ts` 가 처음으로 실제 export 를 가짐 (Phase 1.1 의 `export {}` placeholder 종료)
- **EodinEvent 는 `as const` const object → frozen literal → state 없음**. dual-package (esm/cjs 각각 인스턴스 분리) 위험 무관 — 두 인스턴스가 모두 `{ AppOpen: 'app_open', ... }` 동일 frozen object 를 들고 있어도 비교 / 사용에 영향 없음
- **단, Phase 3 의 `EodinAnalytics` 가 등장하면 H1 결정 (a/b/c) 즉시 적용 필요** — 본 phase 는 H1 의 적용 시점이 다음 phase 라는 사실을 결정 로그에 anchor 해야 회귀 가드. F2 참조.

**결론**: 본 phase 자체는 H1 영향 없음. 다음 phase 진입 전 H1 결정 강제하는 결정 로그 anchor 추가 권장.

---

## Medium & Low Priority Findings

### M1. Test invariant coverage 가 Android `EodinEventTest.kt` 대비 약함 — snake_case / 길이 / 유일성 / forbidden-v1 검증 누락

- **Severity**: 🟡 MEDIUM
- **Category**: Testing
- **File**: `packages/sdk-web/src/__tests__/eodin-event.test.ts:8-72` vs `packages/sdk-android/src/test/java/app/eodin/analytics/EodinEventTest.kt:8-58`
- **Issue**: Android 의 `EodinEventTest` 는 4가지 invariant 를 검증한다:
  1. `eventName is snake_case wire format` — hard-coded 8 examples 각각 비교 + (more importantly)
  2. `all enum values use snake_case and are within 40 chars` — 정규식 `^[a-z][a-z0-9]*(_[a-z0-9]+)*$` + 길이 ≤40 강제 (모든 entry 자동 검증)
  3. `all enum values are unique` — wire string 중복 없음 검증
  4. `does not contain forbidden v1 names` — Phase 0.4 audit 의 14개 forbidden v1 wire string 이 enum 에 들어가지 않음 검증

  Web 의 테스트는 hard-coded entry 비교 + capacitor parity 검증만 하고 있어 위 4가지 자동 검증이 모두 누락. 결과:
  - 누군가가 `OnboardingStart` 의 wire string 을 `'onboardingStart'` (camelCase) 로 바꾸면, hard-coded 비교 테스트는 떨어지지만 **다른 채널이 동일 실수를 동시에 저지르면** capacitor parity 테스트도 통과 (둘 다 같이 깨졌으므로 일치)
  - 새 entry 가 추가될 때 정규식 / 길이 가드 없음 — 길이 ≤40 invariant 가 web 에서 강제되지 않음 (`docs/research/event-schema-audit.md` 의 분석 가능성 invariant 가 client side 에서 하나 빠짐)
  - 누군가가 forbidden v1 name (`subscription_purchase_completed` 등) 을 web enum 에 추가해도 가드 없음

- **Impact**: 회귀 가드 강도가 4채널 중 약한 채널 1개로 떨어짐. cross-channel parity 테스트가 "다른 채널이 옳다" 가정 하에 동작하므로, 두 채널이 같이 잘못된 방향으로 drift 하면 못 잡음.

- **Recommendation**: Android 의 4가지 invariant 를 모두 web 에 추가. 추가 비용 낮음 (5분 작성).

  ```typescript
  // packages/sdk-web/src/__tests__/eodin-event.test.ts 에 추가

  describe('EodinEvent — invariant 가드 (4채널 EodinEventTest 와 동등 강도)', () => {
    const SNAKE_CASE_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

    it('모든 wire string 은 snake_case 이고 ≤40자', () => {
      for (const [key, value] of Object.entries(EodinEvent)) {
        expect(SNAKE_CASE_PATTERN.test(value)).toBe(true);
        expect(value.length).toBeLessThanOrEqual(40);
      }
    });

    it('모든 wire string 은 유일', () => {
      const values = Object.values(EodinEvent);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('Phase 0.4 audit 의 forbidden v1 wire string 은 enum 에 없음', () => {
      const FORBIDDEN_V1 = new Set([
        'subscription_purchase_completed',
        'subscription_trial_started',
        'subscription_restored',
        'paywall_dismissed',
        'ad_clicked',
        'ad_failed',
        'rewarded_ad_attempt',
        'rewarded_ad_complete',
        'interstitial_ad_shown',
        'native_ad_shown',
        'login',
        'auth_logout',
        'auth_account_deleted',
        'onboarding_skipped',
      ]);
      const used = new Set(Object.values(EodinEvent));
      for (const v1 of FORBIDDEN_V1) {
        expect(used.has(v1)).toBe(false);
      }
    });
  });
  ```

  **추가 권장** — Android `EodinEventTest` 를 source-of-truth 로 명시. Android 가 포멀한 4채널 invariant 의 표준 ("모든 채널이 따라야 할 4가지 무결성 가드") 이라면 PRD `docs/web-sdk/PRD.md` §7 의 invariant 표에 1줄 추가:

  | EodinEvent invariant 4종 (snake_case / ≤40 / unique / no-forbidden-v1) | Android `EodinEventTest` 가 reference. 5채널 모두 동등 강도 가드 |

---

### M2. Phase 1.3 결정 로그 anchor 부재 — PageView wire string `'page_view'` 가 미래 mobile 추가의 강제 reference 로 명시되지 않음

- **Severity**: 🟡 MEDIUM
- **Category**: Project-Specific Compliance / Documentation
- **File**: `docs/web-sdk/PRD.md` §10 결정 로그 + `docs/web-sdk/CHECKLIST.md` Phase 1.3
- **Issue**: PRD 의 결정 로그 B3 (autoTrackPageView 옵션) 와 L8 (asymmetry 표 행 추가) 는 **옵션 / surface 차원**의 결정이지 **wire string 차원**의 결정이 아님. Phase 1.3 의 변경은 "EodinEvent enum 에 PageView entry 를 wire string `'page_view'` 로 추가" 인데, 이 결정의 anchor 가 PRD 어디에도 없음. 결과:
  - 미래에 Flutter / iOS / Android / Capacitor 가 PageView 를 추가할 때 (예: in-app 화면 진입 추적 도입), wire string 을 `'page_view'` 로 통일해야 한다는 강제 reference 가 없음 → drift 가능 (`'screen_view'` 등이 들어올 수 있음)
  - 백엔드 / 분석 도구 (Mixpanel / Amplitude) 에서 web `page_view` 와 mobile `screen_view` 가 별도 funnel 로 잡혀 cross-channel funnel 깨짐
  - parity-matrix-5ch.md (PRD §7 / Phase 3.3 산출 예정) 에도 이 결정의 출처가 없음

- **Impact**: 미래 회귀 위험. 1년 뒤 누군가가 mobile 에 PageView 를 추가할 때 web 의 `page_view` 를 reference 로 의식할 anchor 가 없어, 별도 wire string 으로 drift 가능.

- **Recommendation**: PRD §10 결정 로그에 1줄 추가:

  ```markdown
  | 2026-05-03 (P1, Phase 1.3) | `EodinEvent.PageView = 'page_view'` 로 web 채널 추가. 미래에 mobile 채널 (Flutter / iOS / Android / Capacitor) 이 in-app 화면 추적을 추가할 경우 **동일 wire string `'page_view'` 사용 강제** — cross-channel funnel 보장. 변형 (`screen_view` 등) 금지. |
  ```

  + Phase 3.3 산출 `parity-matrix-5ch.md` 의 EodinEvent 표에 PageView 행 추가 시 본 결정 로그 reference.

  **대안** (작은 비용): `eodin-event.ts:30` 의 PageView 주석 강화:

  ```typescript
  // Web 고유 — autoTrackPageView 옵션이 활성일 때 자동 발생.
  // 미래에 mobile 이 in-app 화면 추적을 추가할 경우 wire string='page_view'
  // 로 통일 (cross-channel funnel 보장 — PRD §10 P1).
  PageView: 'page_view',
  ```

---

### L1. Cross-channel parity test 가 capacitor src/ 직접 require — capacitor refactor 시 path fragility

- **Severity**: 🟢 LOW
- **Category**: Testing
- **File**: `packages/sdk-web/src/__tests__/eodin-event.test.ts:86, 97`
- **Issue**: 테스트가 `require('../../../capacitor/src/eodin-event')` 로 capacitor 의 src 를 직접 로드. 이 경로는 monorepo 위치 가정 (`packages/sdk-web/` 에서 위로 3단계 = 모노레포 root, 그 밑 capacitor) 에 직접 의존. 이슈:
  1. capacitor 패키지가 미래에 `packages/capacitor-plugin/` 등으로 이름 / 위치 변경 시 web 테스트 깨짐 — capacitor 패키지 내부 변경이 web 테스트로 spillover
  2. capacitor 가 `eodin-event.ts` 를 다른 파일로 분할 / re-export 하면 require path 깨짐
  3. `@eodin/capacitor` package symlink 가 npm workspaces 로 이미 활성 (Phase 1.0) 인데, 이 활용을 안 함. Symlink 경유 시 (`require('@eodin/capacitor/src/eodin-event')`) 패키지 이름 변경에만 약하고 위치 / 분할에는 강함
  4. ts-jest 가 capacitor src ts 를 컴파일하려면 sdk-web 의 `tsconfig.json` 의 `include: ["src"]` 밖이라 부담. 실제로는 ts-jest 의 default transform 이 `\\.ts$` 매칭 모든 파일을 sdk-web tsconfig 으로 컴파일 — 두 패키지 tsconfig 가 거의 동일하므로 동작은 하나, capacitor 가 미래에 strict 옵션 / target 변경 시 sdk-web 컴파일러로 컴파일된 결과가 capacitor 의 의도와 drift 가능
  5. Capacitor 의 `dist/esm/eodin-event.js` 가 Phase 1.2 / 1.9 산출로 이미 존재 — built artifact 사용이 더 안전

- **Impact**: 테스트 fragility. 본 phase 직후에는 동작하지만, capacitor refactor / tsconfig 변경 / 위치 이동 시 깨짐.

- **Recommendation**: built artifact 또는 workspace symlink 경유로 전환:

  ```typescript
  // 권장 (Option A — workspace symlink + built artifact):
  // package.json devDependencies 에 "@eodin/capacitor": "workspace:*" 추가 (이미 있을 수도)
  it('capacitor 와 공통 키는 wire string 동일', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EodinEvent: capacitorEvent } = require('@eodin/capacitor');
    // capacitor 는 dist/esm/index.js → eodin-event re-export. 안정.

    for (const [key, webValue] of Object.entries(EodinEvent)) {
      if (key === 'PageView') continue;
      expect((capacitorEvent as Record<string, string>)[key]).toBe(webValue);
    }
  });
  ```

  **단, 주의** — Phase 2 에서 capacitor 가 `@eodin/web` 을 import 하는 어댑터로 전환되면 `@eodin/capacitor → @eodin/web` 의존성 + `@eodin/web → @eodin/capacitor` (test-only) 의존성으로 cycle 발생. dev-only / test-only / circular detection 가능하나 깔끔하지 않음. **대안 (Option B)**: 4채널 wire string 을 단일 source-of-truth JSON / fixture 로 추출:

  ```typescript
  // packages/sdk-web/src/__tests__/fixtures/wire-strings-5ch.json
  {
    "AppInstall": "app_install",
    "AppOpen": "app_open",
    // ... 38 entries (PageView 제외)
  }
  ```

  5채널 (Flutter / iOS / Android / Capacitor / Web) 모두 이 fixture 를 reference 로 비교. CHECKLIST 의 `Phase 1.6 audit` (`docs/research/event-schema-audit.md` 의 v1.1 reference) 를 fixture 화하는 정도가 깔끔. 본 phase 결정 사항은 아니나, parity matrix Phase 3.3 산출에서 검토 권장.

  **본 phase 즉시 적용** — 최소한 Option A 의 workspace symlink 경유로 변경 (path fragility 1단계 해소).

---

### L2. Test 가 `EodinEvent` 를 `Record<string, string>` 으로 캐스트 — type-narrow loss

- **Severity**: 🟢 LOW
- **Category**: Code Quality (TypeScript)
- **File**: `packages/sdk-web/src/__tests__/eodin-event.test.ts:87, 97`
- **Issue**: `for (const [key, webValue] of Object.entries(EodinEvent))` 는 `[string, string]` tuple 로 의도 명확. `capacitorEvent: Record<string, string>` 캐스트는 capacitor 의 `as const` 정밀 타입을 string 으로 떨어뜨림. 결과:
  - `capacitorEvent[key]` 가 undefined 일 때 (capacitor 에서 entry 가 누락된 시나리오) `expect(undefined).toBe(webValue)` 가 정확하나, 만약 누군가가 키 비교 로직을 변경할 때 type-level 가드 손실
  - `capacitorEvent: typeof EodinEvent` (capacitor side) 또는 `Readonly<Record<string, string>>` 가 더 정확

- **Recommendation**:

  ```typescript
  it('capacitor 와 공통 키는 wire string 동일', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const capacitorModule = require('../../../capacitor/src/eodin-event');
    const capacitorEvent = capacitorModule.EodinEvent as Readonly<Record<string, string>>;

    const webKeys = Object.keys(EodinEvent).filter((k) => k !== 'PageView');
    expect(webKeys.length).toBe(38); // 4채널 entry 수 anchor

    for (const key of webKeys) {
      expect(capacitorEvent[key]).toBe(
        (EodinEvent as Readonly<Record<string, string>>)[key]
      );
    }
  });
  ```

  추가 이득: `expect(webKeys.length).toBe(38)` 가 Web 의 entry 수가 4채널과 같다는 명시적 anchor — 누군가가 web 에 새 entry 를 추가했는데 4채널에 안 추가하면 떨어짐.

---

### L3. PageView 가 alphabetical 순서 (또는 카테고리 순서) 가 아닌 Lifecycle 직후에 위치

- **Severity**: 🟢 LOW
- **Category**: Code Quality / Readability
- **File**: `packages/sdk-web/src/eodin-event.ts:29-30`
- **Issue**: 4채널 enum 은 카테고리별 그룹 (Lifecycle / Auth / Onboarding / Core / Advertising / Social / ATT). PageView 는 어느 카테고리에도 정확히 안 맞으나 (web 고유), 현재는 Lifecycle 직후에 들어가 있음. PRD §3 의 surface 정의에서는 `page_view` 가 첫 번째 surface 로 명시되어 있어 importance order 라면 자연스러우나, 다른 entry 들이 모두 카테고리 그룹화이므로 한 entry 만 다른 정렬 기준은 일관성 손실.

- **Recommendation**: 두 가지 선택:

  **Option A (권장, 작은 비용)**: 카테고리 그룹의 끝에 별도 "Web-specific" 섹션:

  ```typescript
  // ... iOS ATT entries 뒤
  AttPrompt: 'att_prompt',
  AttResponse: 'att_response',

  // Web-specific — autoTrackPageView 옵션이 활성일 때 자동 발생.
  // mobile 채널이 in-app 화면 추적을 추가할 경우 wire string='page_view' 통일.
  PageView: 'page_view',
  ```

  **Option B**: 현재 위치 유지 + 코멘트 강화. Lifecycle 과 의미 인접 (앱 / 페이지 진입) 이라는 논거 — 본 PR 의 의도였을 가능성. 어느 쪽도 수용 가능 — 의도 명시만 충분.

---

## Positive Observations 👍

1. **5채널 parity 100% 정확** — 38개 wire string 이 4채널 모두와 byte-exact 일치. 손으로 옮긴 결과로는 매우 깔끔. drift 0건.

2. **`as const` + `[keyof typeof X]` 패턴 적절** — 4채널 (Dart enum / Swift enum / Kotlin enum / Capacitor const object) 의 type-safe 의도를 TS 5.x idiomatic 으로 정확히 재현. .d.ts 출력에 readonly literal 39개 정확히 노출됨.

3. **AttPrompt / AttResponse 보존 결정** — Android 의 `// no-op on Android, kept for cross-platform consistency` 패턴과 정합. cross-channel 분석 funnel 일관성 우선 + 호스트 자유 string 호출 가드 (IDE 자동완성) 라는 두 이득 명확.

4. **Public surface 의 절제** — `index.ts` 에 EodinEvent / EodinEventName 만 노출. `internal/*` (Phase 1.2 산출 5개 모듈) 모두 미노출. `package.json` 의 `exports: { "." : ... }` 단일 엔트리로 internal subpath 호출 차단 → Phase 3 surface 결정 전 lockdown.

5. **테스트의 카테고리 구조** — describe block 이 카테고리 (Lifecycle / Auth / Onboarding / Core / Advertising / Social / ATT / PageView) 와 정확히 일치 → enum 의 카테고리 invariant 와 테스트가 1:1.

6. **PageView 의 cross-channel 전망 의식** — PRD §5.1 / B3 / L8 에 surface 결정 + asymmetry 표 행 추가까지 명시. Phase 1.3 review (M2) 가 wire string anchor 만 보완하면 미래 mobile 추가 drift 가드 완성.

7. **Phase 1.1 의 `export {}` placeholder 종료** — index.ts 가 처음으로 실제 export. EodinEvent 가 stateless const 이므로 H1 dual-package hazard 영향 무관. 다음 phase (EodinAnalytics 등장) 진입 전 H1 결정 필요라는 자각만 있으면 깔끔한 점진 도입.

8. **Build 검증** — `dist/esm/eodin-event.{js,d.ts,d.ts.map}` + `dist/esm/index.{js,d.ts,d.ts.map}` 모두 정상 생성. Phase 1.1 의 empty chunk 경고가 사라짐 (사용자 보고).

---

## Action Items Checklist

**MEDIUM (강력 권장)**:
- [ ] **M1**: Web 의 EodinEvent 테스트에 4가지 invariant (snake_case 정규식 / ≤40자 / 유일성 / forbidden v1 names) 추가 — Android `EodinEventTest.kt` 와 동등 강도. 5분 작성. 본 phase 의 Phase 1.3 closure 전에 처리 권장.
- [ ] **M2**: PRD `docs/web-sdk/PRD.md` §10 결정 로그에 P1 entry 추가 — `EodinEvent.PageView = 'page_view'` 의 wire string anchor + 미래 mobile 추가 시 강제 reference 명시. 또는 (대안) `eodin-event.ts:30` 의 PageView 주석에 같은 내용 anchor.

**LOW (옵션)**:
- [ ] **L1**: Cross-channel parity test 의 require path 를 `@eodin/capacitor` symlink 경유로 전환 — path fragility 해소. 또는 5채널 wire string fixture 도입 검토 (Phase 3.3 parity-matrix-5ch.md 와 연계).
- [ ] **L2**: Test 의 type 캐스트를 `Readonly<Record<string, string>>` 로 정확화 + `webKeys.length === 38` anchor 추가 — entry 수 cross-channel 가드.
- [ ] **L3**: PageView 위치를 카테고리 그룹 끝의 "Web-specific" 섹션으로 이동, 또는 현재 위치 유지 시 의도 코멘트 추가.

**INFO (Phase 3 진입 전 검토)**:
- [ ] **F1 (INFO)**: H1 dual-package hazard — 본 phase 에서는 EodinEvent 가 stateless 라 무관. **다음 phase (EodinAnalytics) 가 stateful module 의 첫 등장이므로 Phase 3.0 의 첫 task 로 H1 결정 (a) ESM-only 전환, (b) `globalThis` pin, (c) stateless façade + global store 중 택1 강제**. 권장: (a) ESM-only — 5번째 채널 신생이라 cjs 사용자 부담 적음. PRD 결정 로그에 anchor.
- [ ] **F2 (INFO)**: Phase 1.3 의 `index.ts` 가 처음 실제 export 를 가짐 → `package.json` 의 `exports.types` 가 `dist/esm/index.d.ts` 로 단일. 미래 cjs 사용자가 esm types 를 통해 동일 entry 인지 — TypeScript 4.7+ 의 conditional types export 는 잘 동작. 본 phase 무관, 모니터링 항목.
- [ ] **F3 (INFO)**: 4채널 (Flutter / iOS / Android / Capacitor) 의 enum 도 alphabetical 순서가 아닌 카테고리 순서 — 4채널 자기 간 entry 순서가 Phase 1.6 시점 동일했는지는 본 review 대상 외이나, 5채널 parity 의 일부로 명시적으로 선언될 가치 있음 (categoty + intra-category alphabetical) — Phase 3.3 parity-matrix-5ch.md 에서 검토 권장.
- [ ] **F4 (INFO)**: 4채널 자기 간 wire string drift 점검 — 본 phase 에서 추가로 발견 0건. Android `EodinEventTest` 의 4가지 invariant 가 Android 측 가드 역할이고 Capacitor 는 별도 invariant 테스트 없음 (확인 필요 — `packages/capacitor/src/__tests__/` 검토 권장). Capacitor 도 web 과 동일 invariant 4종 보유하면 5채널 모두 Android 와 동등 강도.

---

## 종합 등급

**Grade A** — Phase 1.3 변경은 작고 깔끔하며 5채널 parity 가 byte-exact 정확. CRITICAL / HIGH 0건. M1 (test invariant 강도) 과 M2 (결정 로그 anchor) 는 미래 회귀 가드 보강 차원으로, 본 phase closure 직전에 5분 분량으로 처리 가능. 코드 자체에는 손댈 곳이 없고, 보강은 모두 테스트 / 문서 차원 — 새 코드 / 새 surface 추가 없이 강도 1 단계 상승. Phase 3 진입 전 H1 dual-package hazard 결정만 anchor 하면 다음 phase 의 EodinAnalytics 가 안전하게 stateful module 로 들어올 수 있다.
