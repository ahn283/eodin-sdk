# Code Review: Phase 4 — 테스트 보강 + TypeDoc + integration-guide (`@eodin/web`)

**Date**: 2026-05-03
**Reviewer**: Senior Code Review Agent
**Scope**:
- `packages/sdk-web/src/__tests__/page-view-tracker.test.ts` (신규, 6 cases)
- `docs/guide/integration-guide.md` §3.5 (Web 섹션 갱신, +88 / -2 lines)
- TypeDoc 산출물 (`packages/sdk-web/docs/api/`) 검증
- 본 phase 의 잔여 작업 식별 (CHECKLIST §Phase 4 + §Phase 5.1)
**Commit(s)**: 작업 트리 상태 (uncommitted) — `M docs/guide/integration-guide.md` + `?? packages/sdk-web/src/__tests__/page-view-tracker.test.ts`
**관련 PRD**: `docs/web-sdk/PRD.md` §5 (autoTrackPageView, GDPR surface) / `docs/web-sdk/CHECKLIST.md` §4.1-4.4
**이전 review**: `docs/web-sdk/reviews/phase-3-code-review.md` (Grade B+, C1 + H1-H4 적용)

---

## Summary

Phase 4 작업은 세 갈래 — (1) page-view-tracker 단위 테스트 6건 신규, (2) `npm run docs` TypeDoc 산출 검증, (3) integration-guide §3.5 Web 섹션 placeholder → 본문 80여 줄 — 모두 적합한 방향이고 outline 도 4채널 §3.1-3.4 와 일관된다. **다만 신규 테스트 파일이 TypeScript 컴파일 에러로 suite 자체가 실행 불가** (`page-view-tracker.test.ts:64` `original as never` cast). `npm -w @eodin/web test` 가 exit code 1 로 실패 — Phase 4.1 의 핵심 산출이 회귀 가드로 작동하지 않는다. 추가로 integration-guide §6.1 의 web `isEnabled()` 호출 형태가 §3.5.3 의 property getter (`EodinAnalytics.isEnabled`) 와 모순되어 채택자 첫 통합에서 즉시 type error / runtime undefined call. `packages/sdk-web/README.md` 는 Phase 1.1 placeholder 경고 그대로 (CHECKLIST §4.3 미완), 메인 `README.md` 의 Packages 표에 `@eodin/web` 행 누락. TypeDoc 자체는 깨끗 — internal 미노출 검증 통과. 본 phase 를 publish 진입 (Phase 5) 전에 closure 하려면 CRITICAL 1 + HIGH 3 처리 필요.

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 3 |
| Medium | 5 |
| Low | 4 |
| Info | 3 |

전체 코드 품질: **C+** — 산출물 outline 은 정확하나 핵심 회귀 가드 (page-view-tracker 테스트) 가 컴파일 단계에서 깨져 있어 가산점이 깎였다. C1 / H1-H3 적용 후 B+ 회복 가능.

---

## Critical & High Priority Findings

### C1. `page-view-tracker.test.ts:64` TS2339 — 신규 테스트 suite 가 컴파일 실패로 실행 불가

- **Severity**: 🔴 CRITICAL
- **Category**: 7. Testing / 6. Code Quality (TS strict)
- **File**: `packages/sdk-web/src/__tests__/page-view-tracker.test.ts:62-66`
- **Issue**:

  H3 verification 케이스에서 `history.pushState` 의 `original` 변수에 `as never` 캐스팅을 한 뒤 `.apply(this, args)` 를 호출. TypeScript 가 이를 `Property 'apply' does not exist on type 'never'` 로 거절한다.

  ```ts
  const original = history.pushState;
  const otherLib = jest.fn(function (this: History, ...args: unknown[]) {
    // call SDK's patched (which calls origPush + sdkCb)
    return (original as never).apply(this, args);   // ← TS2339
  });
  ```

  `as never` 는 `never` 타입을 *받는* 자리에 *넣을 때* 쓰는 narrowing 캐스트 — 거기서 `.apply` 를 호출할 수는 없다. `ts-jest` (preset, jest.config.js:2) 가 strict 모드 (tsconfig.json:16 `"strict": true`) 로 컴파일하므로 suite 자체가 실행되지 않는다.

  실제 실행 결과 (`npm -w @eodin/web test`):
  ```
  FAIL src/__tests__/page-view-tracker.test.ts
    ● Test suite failed to run

      src/__tests__/page-view-tracker.test.ts:64:34 - error TS2339:
      Property 'apply' does not exist on type 'never'.

  Test Suites: 1 failed, 7 passed, 8 total
  Tests:       80 passed, 80 total
  npm error code 1
  ```

  **80 통과 / 1 fail** — 80 tests 는 phase 3 까지의 산출이고, **phase 4 신규 6 tests 는 0건도 실행되지 않았다**. CHECKLIST §4.1 의 첫 마일스톤 (autoTrackPageView 동작 검증) 이 회귀 가드로 작동하지 않는 상태.

- **Impact**:
  - Phase 4 의 핵심 산출 (page-view-tracker test 보강) 이 무력화. SDK 가 history monkey-patch / detach 를 silently 깨도 CI 가 못 잡는다
  - 4채널 SDK 의 mobile 테스트 64/64 와 의미 parity 손상 — Phase 1.2 review 의 "test = exec" 원칙 위반
  - Phase 5 publish 진입 시점에서 `npm test` 가 exit 1 → publish 차단. `prepublishOnly: "npm run build"` 만으로는 못 막음 (test 는 publish hook 에 없음). 그러나 CI / 사람이 보면 즉시 빨간불
  - 본 review focus 1 (page-view-tracker test coverage 충분성) 에 대한 답: **현재는 0% — 컴파일조차 못함**

- **Recommendation**:

  `as never` 는 잘못된 의도 표현. 의도는 "SDK 가 patch 한 함수를 다른 라이브러리가 다시 wrap 한 시나리오 시뮬레이션". 가장 단순한 fix:

  ```ts
  it('SDK 의 patched 가 아닌 다른 함수가 history.pushState 에 있으면 원복하지 않음 (H3 — 라우터 충돌 방지)', () => {
    const sdkCb = jest.fn();
    attachPageViewTracker(sdkCb);

    // 다른 라이브러리가 위에 또 patch
    const sdkPatched = history.pushState;
    const otherLib = jest.fn(function (this: History, ...args: Parameters<typeof history.pushState>) {
      // call SDK's patched (which calls origPush + sdkCb)
      return sdkPatched.apply(this, args);
    });
    history.pushState = otherLib as typeof history.pushState;

    detachPageViewTracker();

    // detach 후에도 history.pushState 는 otherLib 그대로 — SDK 가 덮어쓰지 않음
    expect(history.pushState).toBe(otherLib);
  });
  ```

  변경:
  - `original` → `sdkPatched` 로 rename (의미 명확화 — "SDK 가 patch 한 함수")
  - `as never` 제거 — `sdkPatched` 의 타입이 이미 `typeof history.pushState`
  - jest.fn 의 `...args: unknown[]` → `...args: Parameters<typeof history.pushState>` (`apply` signature 와 일관)

  추가로 — 본 케이스가 H3 의 핵심 동작인 "patched ≠ history.pushState 면 detach 가 원복 안 함" 을 검증한다는 점에서, **otherLib 호출이 sdkCb 를 트리거하는지** 도 같이 assert 하면 더 견고:

  ```ts
  // detach 가 history.pushState 를 otherLib 에서 SDK pre-patch 상태로 덮어쓰지 않음 + otherLib 는 여전히 동작
  detachPageViewTracker();
  expect(history.pushState).toBe(otherLib);
  history.pushState({}, '', '/router-test');
  expect(otherLib).toHaveBeenCalled();
  // SDK 의 sdkCb 도 (otherLib → sdkPatched 로 위임 했으므로) 한 번 호출됨
  expect(sdkCb).toHaveBeenCalledTimes(1);
  ```

  단 이 강화 assertion 은 H3 의 *현재 의도* (silent breakage 방지 — 다른 라이브러리 patch 위에서 SDK 만 detach 하면 SDK 콜백이 끊기지만 otherLib 은 살아남음) 와 일관성 검토 필요. 의도가 "SDK detach = SDK 콜백 끊기" 라면 `sdkCb` 호출 0 회 assert 가 맞고, "SDK 가 다른 라이브러리 chain 을 깨지 않음" 만이라면 위 강화 assertion. **결정 후 반영**.

---

### H1. integration-guide §6.1 의 web `await EodinAnalytics.isEnabled()` 가 §3.5.3 의 property getter 와 모순

- **Severity**: 🟠 HIGH
- **Category**: 8. Project-Specific Compliance (4채널 docs parity) / 6. Code Quality (docs)
- **File**: `docs/guide/integration-guide.md:503-507`, `docs/guide/integration-guide.md:355-359` (§3.5.3)
- **Issue**:

  §6.1 의 GDPR opt-out 예시 (Capacitor / web 묶음):

  ```ts
  // Capacitor / web
  await EodinAnalytics.setEnabled(false);
  const enabled = await EodinAnalytics.isEnabled();   // ← web 에서는 type error
  ```

  본 phase 에서 §3.5.3 가 `isEnabled` 를 property 로 명시:

  ```ts
  // Status getters (TypeScript property style — Flutter / iOS parity)
  EodinAnalytics.isEnabled;    // ← property
  ```

  실제 surface (`packages/sdk-web/src/analytics/eodin-analytics.ts:353-355`):
  ```ts
  static get isEnabled(): boolean {
    return isEnabledSync();
  }
  ```

  Web 에서는 getter 라 `EodinAnalytics.isEnabled()` 호출은:
  - 컴파일 타임: `boolean` 은 callable 아님 → TS error `This expression is not callable`
  - 런타임 (TS 무시 시): `TypeError: EodinAnalytics.isEnabled is not a function`

  Capacitor 는 plugin proxy method (async, `Promise<boolean>`) 라 `await ...isEnabled()` 가 정확. 두 채널을 한 코드 블록 (`// Capacitor / web`) 에 묶은 게 잘못. **parity-matrix-5ch.md:30** 도 web=property / capacitor=async method 비대칭을 명시.

- **Impact**:
  - 채택자가 §6.1 코드를 그대로 복붙 → web 빌드에서 즉시 TS / 런타임 에러
  - 본 phase 가 §3.5 를 갱신하면서 §6 의 다채널 묶음 예시는 손대지 않아 inconsistency 잔존
  - 4채널 SDK 와 web 의 parity 결정 (M6 — TS property style) 가 한 docs 안에서 자기모순
  - Phase 4.4 의 "integration-guide 갱신" 이 *추가* 만 했고 *기존 부정확 부분 정정* 을 누락

- **Recommendation**:

  §6.1 의 Capacitor / web 묶음을 분리:

  ```diff
   ```ts
  -// Capacitor / web
  +// Capacitor (plugin proxy — async method)
   await EodinAnalytics.setEnabled(false);
   const enabled = await EodinAnalytics.isEnabled();
   ```
  +
  +```ts
  +// Web (@eodin/web — TS property style)
  +await EodinAnalytics.setEnabled(false);
  +const enabled = EodinAnalytics.isEnabled;     // property — sync, no await
  +```
  ```

  추가 후속 — §6.1 의 4채널별 동작 보장 마지막 줄:
  > `setEnabled` 상태는 storage (SharedPreferences / UserDefaults / **localStorage**) 에 영속화

  이 줄은 web 에 맞게 이미 정확. 다만 `setEnabled(false)` 즉시 큐 클리어 동작이 `@eodin/web` 에서는 **storage 영속화 + 큐 클리어** 두 부분으로 분리됨을 §3.5 에 한 줄 추가하면 더 명확:

  ```ts
  // GDPR (4채널 setEnabled / requestDataDeletion 와 동일 의미)
  await EodinAnalytics.setEnabled(false);   // localStorage 영속 + 큐 즉시 클리어 + 신규 이벤트 drop
  ```

---

### H2. `packages/sdk-web/README.md` 가 Phase 1.1 placeholder 경고 그대로 — Phase 5 publish 차단

- **Severity**: 🟠 HIGH
- **Category**: 8. Project-Specific Compliance / 6. Code Quality (docs)
- **File**: `packages/sdk-web/README.md:5`
- **Issue**:

  README 첫 블록:
  ```markdown
  > ⚠️ **Status: Phase 1.1 (toolchain skeleton)**. Public surface (`EodinAnalytics`, `EodinEvent`) 는 Phase 3 에서 구현 예정. 아래 Quick Start 예시는 PRD §5 의 목표 surface 입니다.
  ```

  실제 상태: Phase 3 종료 — surface 100% 구현, 80 tests 통과 (page-view-tracker 6 제외 시), TypeDoc 정상. README 의 *vaporware 경고가 거짓* 이 된 상태. Quick Start 예시도 PRD §5 의 *목표* 가 아닌 *실제 구현* 을 그대로 반영하고 있어 본문은 정확하지만 윗쪽 경고만 stale.

  CHECKLIST §4.3 명시:
  > [ ] README.md 완성 — Quick Start, configure, track, GDPR, browser 호환성

  본 phase 작업 항목인데 미완 — placeholder 경고 제거 + GDPR / browser 호환성 / autoTrackPageView 섹션 추가 누락.

  추가 누락:
  - **GDPR 섹션 부재** — `setEnabled` / `requestDataDeletion` 사용법
  - **autoTrackPageView 섹션 부재** — Web 고유 기능
  - **browser 호환성 부재** — `Web Locks API` 의 `navigator.locks` fallback / sendBeacon 의 secure context 요구사항 등
  - **status getter 사용 예시 부재** — `EodinAnalytics.deviceId / userId / sessionId / attribution / isEnabled`

- **Impact**:
  - Phase 5.1 의 publish 사전 점검 시 README 가 stale → npm.com 의 package readme 가 사용자에게 "Phase 1.1 toolchain skeleton" 노출. 첫인상 신뢰 하락
  - 첫 채택자가 GDPR / autoTrackPageView 사용법을 직접 source 보고 추론해야 함
  - 4채널 SDK 의 README (capacitor, sdk-flutter 등) 가 publish-ready 인 것과 비대칭

- **Recommendation**:

  README.md 전면 갱신 — placeholder 경고 제거 + 다음 섹션 추가:

  ```markdown
  # @eodin/web

  Eodin SDK for Web — pure analytics SDK (5번째 채널, 4채널 mobile SDK 와 의미 parity).

  > 본 패키지는 Eodin SDK monorepo (`ahn283/eodin-sdk`) 의 5번째 채널입니다. 4채널 (Flutter / iOS / Android / Capacitor) 는 본 저장소의 다른 `packages/*` 디렉토리에서 관리됩니다.

  ## 설치

  ```bash
  npm install @eodin/web
  ```

  ## 빠른 시작

  ```typescript
  import { EodinAnalytics, EodinEvent } from '@eodin/web';

  await EodinAnalytics.configure({
    apiEndpoint: 'https://api.eodin.app/api/v1',
    apiKey: '<your-api-key>',
    appId: '<your-app-id>',
    autoTrackPageView: true,           // SPA 라우팅 자동 page_view
  });

  await EodinAnalytics.track(EodinEvent.SignUp, { method: 'google' });
  EodinAnalytics.identify('user-123');
  ```

  ## 주요 API

  - `configure(options)` — apiEndpoint / apiKey / appId / autoTrackPageView
  - `track(eventName, properties?)` — `Promise<void>`, awaitable
  - `identify(userId)` / `clearIdentity()`
  - `setAttribution(attribution)`
  - `flush()` / `startSession()` / `endSession()`
  - Status getters (property): `deviceId` / `userId` / `sessionId` / `attribution` / `isEnabled`
  - GDPR: `setEnabled(boolean)` / `requestDataDeletion()`

  4채널 비교: [`docs/web-sdk/parity-matrix-5ch.md`](../../docs/web-sdk/parity-matrix-5ch.md)

  ## SSR / Next.js

  Client-only — `localStorage` / `navigator` / `document` 의존. Next.js App Router 는 `'use client'` 파일에서 `useEffect` 안에 `configure()` 호출. 자세한 가이드: [`docs/guide/integration-guide.md`](../../docs/guide/integration-guide.md) §3.5.4.

  ## Browser 호환성

  - Modern evergreen (Chrome / Edge / Firefox / Safari 14+)
  - sendBeacon, history API, localStorage 필수
  - Web Locks API (`navigator.locks`) — secure context (HTTPS) 에서 multi-tab 큐 mutex. fallback: single-tab 정합 보존

  ## 빌드 / 테스트

  ```bash
  # monorepo root 에서
  npm -w @eodin/web run build
  npm -w @eodin/web test
  npm -w @eodin/web run docs   # TypeDoc API reference
  ```

  ## 라이선스

  MIT
  ```

  추가로 메인 `README.md:7` 의 Packages 표 갱신 — H3 참조.

---

### H3. 메인 `README.md` Packages 표에 `@eodin/web` 누락 + Quick Start 섹션 부재

- **Severity**: 🟠 HIGH
- **Category**: 8. Project-Specific Compliance / 6. Code Quality (docs)
- **File**: `README.md:7-12`, `README.md:14-52`
- **Issue**:

  메인 README 의 Packages 표:

  ```markdown
  | Package | Platform | Registry |
  |---|---|---|
  | [`packages/sdk-flutter`](packages/sdk-flutter/) | Flutter | ... |
  | [`packages/sdk-ios`](packages/sdk-ios/) | iOS / macOS | ... |
  | [`packages/sdk-android`](packages/sdk-android/) | Android | ... |
  | [`packages/capacitor`](packages/capacitor/) | Capacitor (Web/iOS/Android) | ... |
  ```

  4행만 — `packages/sdk-web` 행 없음. Phase 0 ~ Phase 3 작업이 끝났음에도 메인 README 가 4채널 SDK 로 자기소개. CHECKLIST §0.3 의 "메인 CHECKLIST 갱신 / Phase Web 행 추가" 는 진행 상태 표는 갱신했지만 메인 **README** 의 Packages 표는 갱신 누락.

  Quick Start 섹션 (`README.md:14-52`) 도 Flutter / iOS / Android / Capacitor 4 sub-section. Web 채널 부재.

  API reference 표 (`README.md:60-66`) 도 4채널 — sdk-web 의 TypeDoc (`packages/sdk-web/docs/api/`) 미언급.

- **Impact**:
  - GitHub 첫 방문자가 `@eodin/web` 의 존재를 PRD / web-sdk 디렉토리 직접 탐색해야 발견
  - "5채널 SDK" 라는 본 트랙의 핵심 메시지가 외부에 노출되지 않음 — Phase 5 publish 후 npm.com 검색 → GitHub 도착 → 5번째 채널 누락 인식
  - 메인 README 가 product surface 의 single source of truth 인데 stale → 채택자 혼란

- **Recommendation**:

  Packages 표 + Quick Start + API reference 표 3 곳 갱신:

  ```diff
   | Package | Platform | Registry |
   |---|---|---|
   | [`packages/sdk-flutter`](packages/sdk-flutter/) | Flutter | [`eodin_sdk`](https://pub.dev/packages/eodin_sdk) on pub.dev |
   | [`packages/sdk-ios`](packages/sdk-ios/) | iOS / macOS | SwiftPM (this repo URL + tag) |
   | [`packages/sdk-android`](packages/sdk-android/) | Android | [`app.eodin:sdk`](https://search.maven.org/) on Maven Central |
   | [`packages/capacitor`](packages/capacitor/) | Capacitor (Web/iOS/Android) | [`@eodin/capacitor`](https://www.npmjs.com/package/@eodin/capacitor) on npm |
  +| [`packages/sdk-web`](packages/sdk-web/) | Web (browser, SPA, Next.js) | [`@eodin/web`](https://www.npmjs.com/package/@eodin/web) on npm |
  ```

  Quick Start 에 Web 추가:

  ```markdown
  ### Web

  ```bash
  npm install @eodin/web
  ```

  ```ts
  import { EodinAnalytics } from '@eodin/web';

  await EodinAnalytics.configure({
    apiEndpoint: 'https://api.eodin.app/api/v1',
    apiKey: '<your-api-key>',
    appId: '<your-app-id>',
    autoTrackPageView: true,
  });
  await EodinAnalytics.track('app_open');
  ```
  ```

  API reference 표에 Web 행:

  ```diff
   | Capacitor | `cd packages/capacitor && npm run docs` | `docs/api/` |
  +| Web | `cd packages/sdk-web && npm run docs` | `docs/api/` |
  ```

---

## Medium & Low Priority Findings

### M1. autoTrackPageView 의 통합 동작 (configure → page-view-tracker → EodinEvent.PageView track) 검증 부재

- **Severity**: 🟡 MEDIUM
- **Category**: 7. Testing
- **File**: `packages/sdk-web/src/__tests__/eodin-analytics.test.ts` (전체), `packages/sdk-web/src/__tests__/page-view-tracker.test.ts` (전체)
- **Issue**:

  본 phase 가 신규로 추가한 page-view-tracker.test.ts 는 **tracker 단위 동작** (콜백 발생 / detach 후 미발생 / H3 verification / idempotent / re-attach) 만 검증. 하지만 PRD §5 의 surface 약속은 **`configure({ autoTrackPageView: true })` 하면 history.pushState 시 자동으로 `EodinEvent.PageView` 이벤트가 큐에 enqueue 되어야 함**. 즉 다음 통합 동작:

  ```ts
  configure({ autoTrackPageView: true })
  → attachPageViewTracker(cb)   // cb = (path, title) => track(EodinEvent.PageView, { path, title })
  → history.pushState(...)
  → cb 발생
  → track('page_view', { path: '/foo', title: '...' })
  → queueSize 증가
  ```

  현재 `eodin-analytics.test.ts` 는 `configure` 의 다른 동작 (deviceId 자동생성 / endpoint 검증 / sessionId 자동생성 / setEnabled / requestDataDeletion 등) 은 cover 하지만 `autoTrackPageView: true` 옵션 path 는 **단 한 케이스도 없음**. `page-view-tracker.test.ts` 도 tracker 단위 — `EodinAnalytics` 와 결합된 끝-끝 동작 검증 부재.

  결과적으로:
  - tracker 가 callback 호출 ✓ (page-view-tracker.test.ts 가 cover — 단 C1 fix 필요)
  - configure 가 callback 안에서 `EodinEvent.PageView` 로 `track` 호출 ✗ (검증 안 됨)
  - 큐에 `event_name: 'page_view'` 가 enqueue ✗ (검증 안 됨)

  PRD §5 / parity-matrix-5ch §5 의 web 고유 기능이 회귀로 깨져도 CI 가 못 잡는다.

- **Recommendation**:

  `eodin-analytics.test.ts` 에 통합 케이스 추가:

  ```ts
  describe('EodinAnalytics autoTrackPageView 통합', () => {
    it('autoTrackPageView=true 시 history.pushState 가 page_view 이벤트 enqueue', async () => {
      await EodinAnalytics.configure({ ...VALID_CONFIG, autoTrackPageView: true });
      const sizeBefore = (await EodinAnalytics.getStatus()).queueSize;

      history.pushState({}, '', '/pricing');
      await new Promise((r) => setTimeout(r, 10));

      const sizeAfter = (await EodinAnalytics.getStatus()).queueSize;
      expect(sizeAfter).toBe(sizeBefore + 1);
      // 추가로 마지막 enqueue 된 event 의 event_name 검증 — internal queue read 필요
    });

    it('autoTrackPageView 미지정 시 history.pushState 가 enqueue 안 함', async () => {
      await EodinAnalytics.configure(VALID_CONFIG);   // default false
      const sizeBefore = (await EodinAnalytics.getStatus()).queueSize;
      history.pushState({}, '', '/no-track');
      await new Promise((r) => setTimeout(r, 10));
      expect((await EodinAnalytics.getStatus()).queueSize).toBe(sizeBefore);
    });

    it('__disposeForTest 후 history.pushState 가 enqueue 안 함', async () => {
      await EodinAnalytics.configure({ ...VALID_CONFIG, autoTrackPageView: true });
      EodinAnalytics.__disposeForTest();
      const sizeBefore = (await EodinAnalytics.getStatus()).queueSize;
      history.pushState({}, '', '/disposed');
      await new Promise((r) => setTimeout(r, 10));
      expect((await EodinAnalytics.getStatus()).queueSize).toBe(sizeBefore);
    });
  });
  ```

  이 3 케이스가 추가되면 PRD §5 의 autoTrackPageView 약속이 회귀 가드 됨.

---

### M2. CHECKLIST §4.1 의 6 시나리오 중 4 시나리오 미진 — 본 phase 가 §4.1 의 일부만 cover

- **Severity**: 🟡 MEDIUM
- **Category**: 8. Project-Specific Compliance
- **File**: `docs/web-sdk/CHECKLIST.md:194-200`
- **Issue**:

  CHECKLIST §4.1 의 6 항목:

  | # | 항목 | 본 phase cover 여부 |
  |---|---|---|
  | 1 | EodinAnalytics: configure / track / identify / clearIdentity / flush | ✓ Phase 3 의 `eodin-analytics.test.ts` 에서 cover |
  | 2 | Attribution / Session: setAttribution / startSession / endSession | △ 부분 — endSession 의 duration_seconds 자동 계산은 Phase 3 cover, startSession 직접 검증 부재 |
  | 3 | Status getters (M6 property style) — deviceId / userId / sessionId / attribution / isEnabled getter | ✓ Phase 3 cover |
  | 4 | GDPR (PRD §5 surface): setEnabled(false) / isEnabled / requestDataDeletion | ✓ Phase 3 cover |
  | 5 | autoTrackPageView 통합 (history / popstate / hashchange → 자동 page_view 발생) | ✗ M1 finding — tracker 단위만 cover, 통합 미진 |
  | 6 | EndpointValidator: HTTPS only enforcement (4채널 동일 케이스) | ✓ Phase 1.2 cover |
  | 7 | EventQueue: idempotent enqueue / at-least-once / bounded growth / cold-start (localStorage 직접 set 후 재시작 시뮬레이션) | △ 부분 — Phase 1.2 cover, cold-start 시뮬레이션 (`__resetStateForTest()` + localStorage 사전 주입) 부재 |

  본 phase 가 §4.1 의 5 번 항목 (autoTrackPageView) 만 부분적으로 다뤘고 — 그것마저 C1 으로 깨져 있고 M1 로 통합 미진. 7 번 cold-start 도 미진. 다만 §4.1 는 "Phase 4 의 작업 목록" 이므로 본 phase 안에서 **모든** 항목을 의무적으로 cover 해야 한다는 해석.

- **Recommendation**:

  CHECKLIST §4.1 항목별 현재 상태 표기를 명확히 하고 본 phase 안에서 끝낼 항목 / Phase 5 으로 넘길 항목을 결정:

  ```diff
   ### 4.1 Unit test 보강
  -- [ ] EodinAnalytics: configure / track / identify / clearIdentity / flush 시나리오
  +- [x] EodinAnalytics: configure / track / identify / clearIdentity / flush 시나리오 (Phase 3)
  -- [ ] Attribution / Session: setAttribution / startSession / endSession 시나리오
  +- [x] Attribution / setAttribution / endSession 시나리오 (Phase 3) — startSession 직접 검증 추가 필요
  -- [ ] Status getters (M6 property style): ... + aggregate `await getStatus()`
  +- [x] Status getters / getStatus (Phase 3)
  -- [ ] **GDPR (PRD §5 surface)**: ...
  +- [x] GDPR (Phase 3)
  -- [ ] autoTrackPageView: history API navigation / popstate / hashchange 시 자동 page_view 발생 검증
  +- [ ] autoTrackPageView: tracker 단위 ✓ (Phase 4) / 통합 (configure → enqueue) ✗ (M1)
  -- [ ] EndpointValidator: HTTPS only enforcement (4채널과 동일 케이스)
  +- [x] EndpointValidator (Phase 1.2)
  -- [ ] EventQueue: idempotent enqueue / at-least-once / bounded growth / cold-start (localStorage 직접 set 후 재시작 시뮬레이션)
  +- [x] EventQueue: idempotent / at-least-once / bounded (Phase 1.2) — cold-start 시뮬레이션 추가 필요
  ```

  보강 후 Phase 4 closure — M1 (autoTrackPageView 통합) + startSession 직접 검증 + cold-start 시뮬레이션 3건 추가 권장.

---

### M3. `packages/sdk-web/package.json` 의 `engines` 필드 부재 — root 와 일관성 단절

- **Severity**: 🟡 MEDIUM
- **Category**: 8. Project-Specific Compliance / 4. Performance (CI 회귀 가드)
- **File**: `packages/sdk-web/package.json:1-56`
- **Issue**:

  Root `package.json` 은 `engines: { "npm": ">=7" }` (workspaces protocol 가드, Phase 1.0 L9). 그러나 `packages/sdk-web/package.json` 자체에는 `engines` 필드 없음. `@eodin/web` 이 npm 에 publish 될 때 root engines 는 따라가지 않음 (npm publish 는 *해당 패키지의* package.json 만 사용).

  결과:
  - 채택자가 npm 5 / yarn classic 등 Node.js 12 시절 도구로 install 시도 → 즉시 실패 안 하고 silently node_modules/@eodin/web 설치 → SDK 가 modern Web Locks API / sendBeacon 등 의존하므로 런타임에 실패 (어차피 못 동작) — 하지만 install 단계 가드 부재로 디버깅 어려움
  - PRD `web-sdk/PRD.md` 의 browser 호환성 가정 (Modern evergreen) 과 정합 안 됨

  4채널 비교:
  - `packages/capacitor/package.json` 의 `engines` 도 점검 필요 (별도 chore 일 수 있음)
  - `engines` 의 권장: Node.js + npm 둘 다. Web SDK 는 빌드 도구 (rollup) 가 Node 14+ 요구, 실제 실행은 browser 라 engines 가 install-time 가드만

- **Recommendation**:

  ```diff
   "scripts": {
     "build": "npm run clean && tsc && rollup -c rollup.config.mjs",
     ...
   },
  +"engines": {
  +  "node": ">=18"
  +},
   "devDependencies": {
  ```

  Phase 5.1 의 publish 사전 점검 항목 ("`package.json` version = `1.0.0-beta.1`") 옆에 `engines` 점검 추가 권장.

---

### M4. SSR Next.js 예시의 디렉토리 / 파일명 불일치 — App Router vs Pages Router 혼재

- **Severity**: 🟡 MEDIUM
- **Category**: 6. Code Quality (docs)
- **File**: `docs/guide/integration-guide.md:326`, `docs/guide/integration-guide.md:378-394`
- **Issue**:

  §3.5.2 의 초기화 예시 코멘트:
  ```ts
  // app entry (예: main.tsx, _app.tsx)
  ```

  `_app.tsx` 는 Next.js **Pages Router** (≤12, 13 의 `pages/` 디렉토리 모드). `main.tsx` 는 Vite / React-bare. **App Router** (Next.js 13+, `app/` 디렉토리) 는 `_app.tsx` 가 없고 `app/layout.tsx` 사용.

  §3.5.4 의 SSR 예시:
  ```ts
  // app/layout.tsx (Next.js)
  'use client';
  ...
  export default function ClientInit() { ... return null; }
  ```

  `app/layout.tsx` 는 App Router 의 root layout — RSC (React Server Component) 가 default 라 `'use client'` directive 가 있는 파일을 layout 으로 직접 쓰면 anti-pattern (전체 트리가 client). 일반적으로:
  - `app/layout.tsx` 는 server component 유지
  - 별도 `app/_components/EodinClientInit.tsx` 가 `'use client'` + `useEffect`
  - `app/layout.tsx` 가 그것을 import

  그리고 export 명도 `ClientInit` 인데 파일명은 `app/layout.tsx` — Next.js 의 reserved file name 규칙 (layout.tsx 의 default export 는 layout) 과 충돌. Next.js 가 이 파일을 보면 `<ClientInit />` 컴포넌트가 root layout 으로 등록되어 화면에 `null` 만 렌더 → 앱 전체 페이지 빈 화면.

- **Impact**:
  - 채택자가 §3.5.4 의 코드를 그대로 `app/layout.tsx` 에 복붙 → 앱 화면 깨짐
  - Next.js 채택자가 가장 많은 web 채택 케이스 — first-impression 회귀
  - 4채널 §3.1-3.4 의 코드 예시는 그대로 동작 가능한 수준이고 web 만 비대칭

- **Recommendation**:

  §3.5.2 + §3.5.4 둘 다 정정. App Router / Pages Router / Vite 3가지를 분기:

  ```diff
   #### 3.5.2 초기화

  -```typescript
  -// app entry (예: main.tsx, _app.tsx)
  -import { EodinAnalytics, EodinEvent } from '@eodin/web';
  -
  -await EodinAnalytics.configure({ ... });
  -```
  +**Vite / React (single-page)** — `src/main.tsx`:
  +```typescript
  +import { EodinAnalytics, EodinEvent } from '@eodin/web';
  +
  +await EodinAnalytics.configure({
  +  apiEndpoint: 'https://api.eodin.app/api/v1',
  +  apiKey: import.meta.env.VITE_EODIN_API_KEY,
  +  appId: '<your-app-id>',
  +  autoTrackPageView: true,
  +});
  +```
  +
  +**Next.js Pages Router** (≤12 또는 `pages/` 디렉토리) — `pages/_app.tsx`:
  +```typescript
  +import { useEffect } from 'react';
  +import { EodinAnalytics } from '@eodin/web';
  +
  +export default function MyApp({ Component, pageProps }) {
  +  useEffect(() => {
  +    void EodinAnalytics.configure({
  +      apiEndpoint: 'https://api.eodin.app/api/v1',
  +      apiKey: process.env.NEXT_PUBLIC_EODIN_API_KEY!,
  +      appId: '<your-app-id>',
  +      autoTrackPageView: true,
  +    });
  +  }, []);
  +  return <Component {...pageProps} />;
  +}
  +```
  +
  +**Next.js App Router** (13+, `app/` 디렉토리) — Server Component 안전. App Router 는 `app/layout.tsx` 가 server-only 유지 권장. 별도 client init 컴포넌트:
  +```typescript
  +// app/_components/EodinClientInit.tsx
  +'use client';
  +import { useEffect } from 'react';
  +import { EodinAnalytics } from '@eodin/web';
  +
  +export default function EodinClientInit() {
  +  useEffect(() => {
  +    void EodinAnalytics.configure({
  +      apiEndpoint: 'https://api.eodin.app/api/v1',
  +      apiKey: process.env.NEXT_PUBLIC_EODIN_API_KEY!,
  +      appId: '<your-app-id>',
  +      autoTrackPageView: true,
  +    });
  +  }, []);
  +  return null;
  +}
  +```
  +
  +```typescript
  +// app/layout.tsx — server component 유지
  +import EodinClientInit from './_components/EodinClientInit';
  +
  +export default function RootLayout({ children }: { children: React.ReactNode }) {
  +  return (
  +    <html lang="ko">
  +      <body>
  +        <EodinClientInit />
  +        {children}
  +      </body>
  +    </html>
  +  );
  +}
  +```

  §3.5.4 의 SSR / Next.js 주의 섹션은 위 3 분기를 가리키도록 단순화.

---

### M5. integration-guide §3.5 의 4채널 톤 / 깊이 일관성 — Pre-flight (apiKey / appId) 가이드 부재

- **Severity**: 🟡 MEDIUM
- **Category**: 6. Code Quality (docs)
- **File**: `docs/guide/integration-guide.md:313-403`
- **Issue**:

  4채널 §3.1-3.4 vs §3.5 비교:

  | 항목 | Flutter | iOS | Android | Capacitor | **Web** |
  |---|---|---|---|---|---|
  | 의존성 추가 | ✓ tag pin 권장 노트 | ✓ from version | ✓ implementation | ✓ npm install + cap sync | ✓ npm install only |
  | 초기화 (configure) | ✓ | ✓ | ✓ context 인자 | ✓ debug 옵션 | ✓ debug + autoTrackPageView |
  | EodinDeeplink.configure | ✓ | ✓ | ✓ | ✓ | ✗ (의도) |
  | 사용 (track / identify) | ✓ | ✓ | ✓ | ✓ + positional 변경 노트 | ✓ |
  | Status getters 예시 | ✗ | ✗ | ✗ | ✗ | ✓ |
  | GDPR | §6 일괄 | §6 일괄 | §6 일괄 | §6 일괄 | ✓ §3.5 + §6 |
  | Pre-flight (apiKey 발급 / Service catalog) | §2.1-2.2 일괄 | §2.1-2.2 일괄 | §2.1-2.2 일괄 | §2.1-2.2 일괄 | §2.1-2.2 일괄 (web 동일) |
  | 의도적 미노출 | (ATT 만 iOS 명시 §3.2.3) | ATT 명시 | (Android 추가 미노출 없음) | Web 자동 지원 §3.4.4 | ✓ §3.5.5 명시 |
  | tree-shaking / 모듈별 import | ✓ §3.1.4 | ✗ | ✗ | ✗ | ✗ |
  | parity-matrix 링크 | ✗ | ✗ | ✗ | ✗ | ✓ §3.5.5 |

  Web 섹션 강점: status getter 예시 / parity-matrix 링크 / SSR 가이드 (web 고유). 약점:
  - **autoTrackPageView 옵션의 default behavior 명시 부재** — `autoTrackPageView: true` 활성을 권장처럼 보여주지만 default 는 false (PRD §5). 채택자가 옵션 누락 시 silent disable
  - **첫 통합 시 Service catalog 의 `serviceType: 'web'` 분기** 언급 부재 — §2.1 의 `serviceType` 가 mobile / web / mixed 인데 web SDK 는 그 중 어느 것이어야 하는지 불명. PRD `web-sdk/PRD.md` 와 정합성 점검 필요
  - **debug log prefix 검증** 가이드 부재 — 4채널 §7.3 ("`[EodinAnalytics]` prefix") 가 있으나 web 만 별도 console 동작 검증 가이드 부재

- **Recommendation**:

  §3.5.2 끝에 default 동작 한 줄:

  ```diff
   await EodinAnalytics.configure({
     apiEndpoint: 'https://api.eodin.app/api/v1',
     apiKey: '<your-api-key>',
     appId: '<your-app-id>',
     debug: process.env.NODE_ENV !== 'production',
     autoTrackPageView: true,    // SPA 라우팅 자동 page_view (history API + popstate 구독)
   });
  +
  +> `autoTrackPageView` 미지정 시 default `false`. 호스트 앱이 라우터 인지하는 경우 `false` 유지 + 명시적 `track(EodinEvent.PageView, ...)` 권장. 단, SPA 의 default route lib 사용 시 `true` 가 가장 단순.
  ```

  §3.5.5 끝 또는 §3.5.6 신설로 Service catalog 정합:

  ```markdown
  #### 3.5.6 Service catalog 분기

  Web 호스트는 §2.1 의 `serviceType` 을 `'web'` 또는 `'mixed'` (Capacitor + 웹 병행) 로 등록. 같은 `apiKey` / `appId` 를 4채널과 공유 — host app 이 `@eodin/capacitor` + `@eodin/web` 둘 다 채택해도 events/collect 의 `app_id` 가 동일하므로 cross-channel join 정상.
  ```

---

### L1. page-view-tracker 테스트의 jsdom 환경 의미성 — `history.pushState` 구독이 SPA 라우터 환경에서 실제 동작하는지 검증 부재

- **Severity**: 🟢 LOW
- **Category**: 7. Testing
- **File**: `packages/sdk-web/src/__tests__/page-view-tracker.test.ts` (전체)
- **Issue**:

  jsdom (jest.config.js:3 testEnvironment: jsdom) 의 `history.pushState` 는 native browser 와 미묘한 차이:
  - jsdom 은 `pushState` 를 실제 URL 변경 (location.pathname 갱신) 동작으로 흉내냄 — 본 phase 테스트는 이 부분을 잘 활용 ✓
  - 그러나 jsdom 의 `popstate` event 는 `dispatchEvent(new PopStateEvent(...))` 로 강제 발생만 가능 — *back button* 의미가 없음 (브라우저 내장 nav 동작 부재)
  - `hashchange` 도 동일

  본 phase 의 popstate / hashchange 테스트는 `dispatchEvent` 로 강제 발생 — *콜백이 매핑되어 있는지* 만 검증, *브라우저가 실제로 popstate 발생 시 매핑이 동작하는지* 는 검증 못 함. 이는 jsdom 한계 — 받아들일 수밖에 없는 trade-off지만 **테스트 주석에 "jsdom 환경 한계 — back button 시뮬레이션 부재" 한 줄 추가** 권장.

  추가로 SPA 라우터 충돌 시나리오 — H3 verification 케이스가 "다른 라이브러리가 위에 또 patch" 를 시뮬레이션 하지만 실제 React Router (history v5 / v6) / Next.js navigation 은 패치 시점이 SDK 보다 *먼저* 일 수도, *나중* 일 수도, *교차* 일 수도 있음. 본 케이스는 SDK attach 후 다른 라이브러리 wrap (가장 단순 시나리오) 만 cover. 더 정교한 시뮬레이션:
  - case A: 다른 라이브러리가 먼저 patch → SDK attach → SDK detach → 다른 라이브러리의 patch 가 살아있는지
  - case B: SDK attach → 다른 라이브러리 patch → 다른 라이브러리 unpatch (없는 라이브러리도 있음) → SDK detach → 어떻게 되는지
  - case C: SDK attach → SDK detach → 다른 라이브러리 patch → 다시 SDK attach → 다른 라이브러리 wrap 안에 SDK 가 들어감

- **Recommendation**:

  M1 권장 통합 테스트와 함께 SPA case A 만 추가 cover (가장 흔한 시나리오):

  ```ts
  it('다른 라이브러리가 먼저 patch 한 상태에서 SDK attach → SDK detach 시 다른 라이브러리 patch 보존', () => {
    const otherLibPatched = jest.fn(history.pushState);
    history.pushState = otherLibPatched as typeof history.pushState;

    const sdkCb = jest.fn();
    attachPageViewTracker(sdkCb);    // SDK 가 위에 wrap

    history.pushState({}, '', '/test');
    expect(sdkCb).toHaveBeenCalledTimes(1);
    expect(otherLibPatched).toHaveBeenCalledTimes(1);

    detachPageViewTracker();
    // SDK 가 detach 후 history.pushState 는 otherLibPatched 로 복원
    expect(history.pushState).toBe(otherLibPatched);
  });
  ```

  jsdom 한계 주석은 파일 상단:

  ```ts
  // jsdom 한계: popstate / hashchange 는 dispatchEvent 로 강제 발생만 가능 —
  // 실제 브라우저의 back button / hash 변경 동작은 시뮬레이션 못함. 콜백 매핑
  // 자체가 정확한지만 검증.
  ```

---

### L2. CHECKLIST §4.2 (Integration test) 의 명시적 closure 부재

- **Severity**: 🟢 LOW
- **Category**: 8. Project-Specific Compliance
- **File**: `docs/web-sdk/CHECKLIST.md:202-203`
- **Issue**:

  CHECKLIST §4.2:
  ```markdown
  ### 4.2 Integration test (선택)
  - [ ] `api.eodin.app` mock server 띄우고 e2e — 메인 PRD `Phase 1.7` 의 E2E 보류 정책과 동일하게 본 phase 도 보류 가능
  ```

  "(선택)" 으로 표기 + "보류 가능" — 이 phase 가 closure 되려면 **명시적 결정** ("보류로 결정 — 이유: ...") 이 CHECKLIST 에 반영되어야. 본 phase 작업 후 미결인 상태로 남겨두면 Phase 5 진입 시 다시 점검 부담.

- **Recommendation**:

  ```diff
   ### 4.2 Integration test (선택)
  -- [ ] `api.eodin.app` mock server 띄우고 e2e — 메인 PRD `Phase 1.7` 의 E2E 보류 정책과 동일하게 본 phase 도 보류 가능
  +- [x] **결정: 보류** — 메인 PRD `Phase 1.7` 의 E2E 보류 정책과 동일. unit test 의 fetch mock 으로 events/collect POST 형태 / X-API-Key header 검증은 cover (eodin-analytics.test.ts:172-188). 실제 backend 연동 검증은 Phase 5.4 (kidstopia vendor tgz) 으로 위임
  ```

---

### L3. integration-guide §3.5.3 의 status getter 예시 — 값 활용 패턴 부재

- **Severity**: 🟢 LOW
- **Category**: 6. Code Quality (docs)
- **File**: `docs/guide/integration-guide.md:354-359`
- **Issue**:

  ```ts
  // Status getters (TypeScript property style — Flutter / iOS parity)
  EodinAnalytics.deviceId;
  EodinAnalytics.userId;
  EodinAnalytics.sessionId;
  EodinAnalytics.attribution;
  EodinAnalytics.isEnabled;
  ```

  bare expression 만 — 변수에 binding 안 함. `noUnusedExpressions` lint rule 켜진 곳에서 채택자가 그대로 복붙 시 lint warning. 의도는 "이 getter 들이 존재" 만 보여주는 것이지만 실용 예시 부재.

- **Recommendation**:

  ```diff
   // Status getters (TypeScript property style — Flutter / iOS parity)
  -EodinAnalytics.deviceId;
  -EodinAnalytics.userId;
  -EodinAnalytics.sessionId;
  -EodinAnalytics.attribution;
  -EodinAnalytics.isEnabled;
  +const deviceId = EodinAnalytics.deviceId;       // string | null — configure 후 자동 생성
  +const userId = EodinAnalytics.userId;           // string | null — identify(...) 호출 시 set
  +const sessionId = EodinAnalytics.sessionId;     // string | null — 30분 idle 시 자동 회전
  +const attribution = EodinAnalytics.attribution; // Attribution | null — setAttribution 또는 storage hydrate
  +const isEnabled = EodinAnalytics.isEnabled;     // boolean — GDPR opt-out 상태
  ```

---

### L4. Phase 5.1 publish 사전 점검 항목의 보강 필요

- **Severity**: 🟢 LOW
- **Category**: 8. Project-Specific Compliance
- **File**: `docs/web-sdk/CHECKLIST.md:217-222`
- **Issue**:

  CHECKLIST §5.1:
  ```markdown
  ### 5.1 publish 사전 점검
  - [ ] `package.json` version = `1.0.0-beta.1`
  - [ ] `files` 필드 — dist/, README.md, LICENSE 만 포함
  - [ ] `.npmignore` 또는 `files` 화이트리스트로 src/ 미포함 확인
  - [ ] `npm pack --dry-run` 으로 tarball 내용 검증
  - [ ] `docs/research/security-check.sh` 패턴이 신규 파일에서 모두 통과
  ```

  본 review 가 실측한 내용:
  - `npm pack --dry-run` 결과: `total files: 55`, `package size: 54.8 kB`, `unpacked size: 204.6 kB`. `LICENSE` / `README.md` / `dist/` 만 포함 — src/ 미포함 ✓
  - `security-check.sh` 결과: SDK 전체 통과 (sdk-web 신규 파일 단독 점검은 별도 invoke 필요하나 현재 패턴 hit 없음)

  본 phase 가 publish 점검을 하나도 해보지 않은 상태인데 위 list 에 없는 추가 점검 권장:
  - `engines` 필드 (M3)
  - `repository.directory` 필드 — 이미 ok (`packages/sdk-web`)
  - dual export verifying — `require('@eodin/web')` / `import '@eodin/web'` 둘 다 root index 만 노출
  - `peerDependencies` 부재 확인 (web SDK 는 React 같은 peer 없음)
  - `sideEffects: false` 검토 — tree-shaking 최적화 (현재 부재 — 이 항목은 추후 ticket)

- **Recommendation**:

  CHECKLIST §5.1 에 추가 점검 항목 보강:

  ```diff
   ### 5.1 publish 사전 점검
   - [ ] `package.json` version = `1.0.0-beta.1`
   - [ ] `files` 필드 — dist/, README.md, LICENSE 만 포함
   - [ ] `.npmignore` 또는 `files` 화이트리스트로 src/ 미포함 확인
   - [ ] `npm pack --dry-run` 으로 tarball 내용 검증
   - [ ] `docs/research/security-check.sh` 패턴이 신규 파일에서 모두 통과
  +- [ ] `engines.node` 필드 명시 (>=18 권장 — Phase 4 review M3)
  +- [ ] dual entry resolve 검증 — `require('@eodin/web')` 와 `import '@eodin/web'` 양쪽이 root surface 만 노출 (internal 누락)
  +- [ ] `peerDependencies` 부재 확인 (web SDK 는 framework agnostic)
  +- [ ] **`npm test` 가 exit 0 이어야 함** — Phase 4 review C1 수정 후 8 suites 통과 재확인
  +- [ ] `prepublishOnly` 가 build 호출하므로 dist/ 가 publish 시점 latest 인지 — clean install 후 `npm publish --dry-run`
  ```

---

### I1. Phase 4 의 산출물 위치 — `packages/sdk-web/docs/api/` (TypeDoc) 의 git tracking 정책 결정 부재

- **Severity**: 💡 INFO
- **Category**: 8. Project-Specific Compliance
- **File**: `packages/sdk-web/docs/api/` (untracked? gitignore?), `packages/sdk-web/.gitignore`
- **Issue**:

  TypeDoc 산출 (`docs/api/`) 이 `git status` 상 untracked 도 modified 도 아닌 것으로 보아 .gitignore 에 cover 됐거나 첫 generate 가 본 review 환경. 4채널 SDK 의 동일 패턴 (Phase 1.8) 도 `docs/api/` 는 git untracked 정책 — 도구 출력은 commit 안 함.

  본 정책이 명시적이면 좋음. CHECKLIST §4.3 / §5.1 어디에서도 docs/api/ commit 정책 미언급.

- **Recommendation**:

  CHECKLIST §4.3 또는 결정 로그에 한 줄:
  > TypeDoc 산출 `docs/api/` 는 git untracked — 4채널 SDK Phase 1.8 정책 동일 (Dokka / DocC / dartdoc / TypeDoc 모두 도구 출력은 source-of-truth 가 아니므로 commit 안 함). publish 시점에 `npm run docs` 로 즉석 생성 → npm tarball 에는 미포함 (`files` 가 dist/만 화이트리스트).

---

### I2. 본 phase 의 변경 범위 — git workflow 제안

- **Severity**: 💡 INFO
- **Category**: 8. Project-Specific Compliance
- **File**: `git status` 결과 `M docs/guide/integration-guide.md` + `?? packages/sdk-web/src/__tests__/page-view-tracker.test.ts`
- **Issue**:

  본 phase 작업이 두 파일 — 하나는 modified (integration-guide.md), 하나는 신규 (page-view-tracker.test.ts). 다른 phase (Phase 1.x, 2, 3) 는 commit 단위가 비교적 작게 분리되어 있는데 본 phase 는 모두 한 commit 으로 묶을지 / test+docs 로 분리할지 명시적 결정 부재.

  추가로 `docs/guide/integration-guide.md` 의 변경은 web-sdk 트랙 외 (4채널 통합 가이드) 라 commit message scope 가 `feat(web-sdk):` 인지 `docs(guide):` 인지 모호.

- **Recommendation**:

  C1 / H1-H3 수정 후 commit 분할 제안:
  - `feat(sdk-web): Phase 4.1 — page-view-tracker test (6 cases) + autoTrackPageView 통합 test (3 cases)`
  - `docs(sdk-web): Phase 4.3 — README 갱신 (Quick Start / GDPR / autoTrackPageView / browser 호환성)`
  - `docs(guide): Phase 4.4 — integration-guide §3.5 Web 섹션 + §6.1 isEnabled getter 분리`
  - `docs: Phase 4 메인 README — sdk-web 행 추가 + Quick Start / API reference 표 갱신`

---

### I3. parity-matrix-5ch.md §6 의 isEnabled 행과 integration-guide §6.1 의 일관성 — 본 review 의 H1 fix 후 자기검증 패턴 제안

- **Severity**: 💡 INFO
- **Category**: 6. Code Quality (docs cross-ref)
- **File**: `docs/web-sdk/parity-matrix-5ch.md:30-42`, `docs/guide/integration-guide.md:503-507`
- **Issue**:

  H1 의 근본 원인은 두 docs 간 cross-ref 부재. parity-matrix 가 `isEnabled` 의 5채널 형태 (web=property / capacitor=async method) 를 명시했지만 integration-guide 는 그것을 *참조하지 않고 독립적으로* 코드 예시 작성. 한 곳을 갱신하면 다른 곳이 stale 되는 패턴이 반복될 가능성.

  4채널 SDK 트랙은 `unified-event-reference.md` (단일 source of truth) + `event-schema-audit.md` (cross-channel drift 감지) 패턴으로 이를 해결. web-sdk 트랙도 parity-matrix-5ch.md 가 source of truth 면 integration-guide §6 의 묶음 예시들도 parity-matrix 의 행과 1:1 매핑되도록 갱신 권장.

- **Recommendation**:

  Phase 5 / 후속 ticket 으로 등록 권장:
  > integration-guide §6 (GDPR) 의 4채널 / web 묶음 코드 블록을 parity-matrix-5ch §3 (GDPR) 의 행 단위로 1:1 매핑. parity-matrix 갱신 시 자동 drift 발견. cross-ref 형식 (예: integration-guide §6.1 가 parity-matrix-5ch §3 의 `setEnabled` 행을 인용).

---

## Positive Observations 👍

1. **page-view-tracker.test.ts 의 outline 은 정확** — H3 verification (라우터 충돌) / idempotent detach / re-attach 시나리오를 포함했고 테스트명이 한국어로 의도 명확. C1 (TS error) 만 fix 하면 즉시 회귀 가드로 동작.

2. **TypeDoc 산출 검증 완벽** — `docs/api/classes/` 에 `EodinAnalytics.html` 하나, `docs/api/variables/` 에 `EodinEvent.html` 하나, `docs/api/types/` 에 `EodinEventName.html` 하나, `docs/api/interfaces/` 에 `Attribution.html` / `AnalyticsConfigureOptions.html` / `AnalyticsStatus.html` 만 노출. 모든 internal symbol (`EventQueue`, `validateEndpoint`, `fetchWithTimeout`, `sendBeacon`, `readStorage`, `writeStorage`) 은 TypeDoc 출력 0건 — `excludeInternal` + `exclude: ["src/internal/**"]` 가 정상 동작. `internal` 키워드도 docs/api 안에 0 hit. **internal 격리 (Phase 3 결정 H4) 의 도구 차원 회귀 가드가 작동**.

3. **integration-guide §3.5 의 outline 일관성** — 4채널 §3.1-3.4 의 패턴 (의존성 → 초기화 → 사용 → 의도적 미노출) 을 정확히 따름. SSR / Next.js 가이드는 web 고유 추가 가치 — 4채널에 없는 항목을 적절히 보강. parity-matrix 링크 (마지막 줄) 도 5채널 비교 진입점으로 좋음.

4. **`npm pack --dry-run` 결과 깨끗** — total 55 files, 54.8 kB, unpacked 204.6 kB. `dist/cjs/` + `dist/esm/` (dual export) + `LICENSE` + `README.md` + `package.json` 만 포함. **src/ / __tests__/ / docs/ / typedoc.json / rollup.config.mjs 모두 미포함** — `files` 화이트리스트 정확. 채택자가 받는 패키지 surface 가 의도한 dist 만.

5. **security-check.sh 통과** — SDK 전체 점검에서 신규 파일이 secret 패턴 hit 0건. `127.0.0.1` 의 SUSPICIOUS hit 은 모두 endpoint validator 의 정당한 사용 (4채널 + sdk-web 모두 동일 패턴).

6. **parity-matrix 가 cross-channel 일관성 source of truth 로 작동** — integration-guide §3.5 가 parity-matrix 를 명시 참조하는 패턴이 좋음 (line 402 `자세한 5채널 비교: ...`). 본 review 의 I3 제안은 이 패턴을 더 강화하는 방향.

---

## Action Items Checklist

### Phase 4 closure 전 (CRITICAL + HIGH)

- [ ] **C1**: `page-view-tracker.test.ts:64` 의 `original as never` → `sdkPatched: typeof history.pushState` 로 fix. `npm -w @eodin/web test` exit 0 회복 (8 suites / 86 tests)
- [ ] **H1**: `integration-guide.md:506` 의 web `isEnabled()` async 호출을 property getter 형식으로 정정 (Capacitor / web 묶음 분리)
- [ ] **H2**: `packages/sdk-web/README.md` 의 Phase 1.1 placeholder 경고 제거 + GDPR / autoTrackPageView / Browser 호환성 / Status getter 섹션 추가
- [ ] **H3**: 메인 `README.md` 의 Packages 표에 `@eodin/web` 행 추가 + Quick Start §Web 추가 + API reference 표에 Web 행 추가

### Phase 4 closure 권장 (MEDIUM)

- [ ] **M1**: `eodin-analytics.test.ts` 에 autoTrackPageView 통합 케이스 3건 추가 (configure → history.pushState → queue enqueue, default false 미발생, dispose 후 미발생)
- [ ] **M2**: CHECKLIST §4.1 의 6 항목별 현재 상태 (cover phase) 를 명시. 미진 항목 (autoTrackPageView 통합 / startSession 직접 / cold-start 시뮬레이션) 본 phase 안에서 closure
- [ ] **M3**: `packages/sdk-web/package.json` 에 `engines.node: ">=18"` 추가
- [ ] **M4**: `integration-guide.md` §3.5.2 / §3.5.4 를 Vite / Pages Router / App Router 3분기로 정정. App Router 의 `app/layout.tsx` server component 유지 패턴 명시
- [ ] **M5**: §3.5.2 끝에 `autoTrackPageView` default false 노트 추가. §3.5.6 (또는 §3.5.5 끝) 에 Service catalog `serviceType: 'web'` / `'mixed'` 분기 한 단락

### Phase 5 진입 전 (LOW)

- [ ] **L1**: page-view-tracker.test.ts 에 jsdom 한계 주석 + SPA case A (다른 라이브러리 먼저 patch) 케이스 추가
- [ ] **L2**: CHECKLIST §4.2 (Integration test) 보류 결정 명시 — `[x]` 마킹 + 사유 한 줄
- [ ] **L3**: integration-guide §3.5.3 status getter 예시를 변수 binding 형태로 변경 (`const deviceId = ...`)
- [ ] **L4**: CHECKLIST §5.1 publish 사전 점검 항목 보강 — engines / dual entry resolve / peerDependencies / `npm test` exit 0 / clean install dry-run 5건 추가

### 후속 ticket (INFO — 별도 작업)

- [ ] **I1**: TypeDoc 산출 `docs/api/` git untracked 정책 한 줄 명시 (CHECKLIST §4.3 또는 결정 로그)
- [ ] **I2**: 본 phase commit 분할 (test / sdk-web README / integration-guide / 메인 README 4건)
- [ ] **I3**: integration-guide §6 의 GDPR 묶음 코드 블록을 parity-matrix-5ch §3 의 행과 1:1 매핑 패턴으로 리팩 (drift 자동 감지)

### 참고 — Phase 5 진입 준비도

본 phase closure 후:

| 항목 | 상태 |
|---|---|
| §5.1 version = 1.0.0-beta.1 | ✓ (이미 ok) |
| §5.1 files allowlist | ✓ (npm pack --dry-run 검증) |
| §5.1 src/ 미포함 | ✓ |
| §5.1 npm pack --dry-run 검증 | ✓ |
| §5.1 security-check 통과 | ✓ |
| §5.1 (보강) engines | ✗ M3 |
| §5.1 (보강) `npm test` exit 0 | ✗ C1 |
| README publish-ready | ✗ H2 |
| integration-guide 정확성 | ✗ H1 / M4 |
| 메인 README 5채널 표 | ✗ H3 |
| autoTrackPageView 회귀 가드 | ✗ M1 |
| CHECKLIST §4.1 closure | ✗ M2 |

C1 + H1 + H2 + H3 + M1 + M2 + M3 + M4 + M5 + L1-L4 적용 후 Phase 5 진입 권장.
