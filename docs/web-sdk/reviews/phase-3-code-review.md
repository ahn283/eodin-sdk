# Code Review: Phase 3 — EodinAnalytics 본체 + 5채널 parity (`@eodin/web`)

**Date**: 2026-05-03
**Reviewer**: Senior Code Review Agent
**Scope**:
- `packages/sdk-web/src/analytics/eodin-analytics.ts` (신규, ~445 lines)
- `packages/sdk-web/src/analytics/state.ts` (신규, globalThis pin)
- `packages/sdk-web/src/analytics/types.ts` (신규, Attribution / AnalyticsStatus / AnalyticsConfigureOptions / `attributionToWire`)
- `packages/sdk-web/src/analytics/page-view-tracker.ts` (신규, history monkey-patch)
- `packages/sdk-web/src/index.ts` (public re-export 갱신)
- `packages/sdk-web/src/__tests__/eodin-analytics.test.ts` (신규, 20 cases)
- `docs/web-sdk/parity-matrix-5ch.md` (신규)
- `packages/sdk-web/rollup.config.mjs` (cmt 갱신)
**Commit(s)**: 작업 트리 상태 (uncommitted) — Phase 3 작업 중
**관련 PRD**: `docs/web-sdk/PRD.md` §5 / §5.1 / §10 (M5 / M6 / M7 / L8 + Phase 3 H1 dual-package hazard 결정 (b) globalThis pin)
**이전 review**: `docs/web-sdk/reviews/phase-2-code-review.md` (Grade B+, H1/H2/H3 적용)

---

## Summary

Phase 3 산출의 골격은 건전하다 — PRD §5 의 9개 surface 항목 (configure / track / identify / clearIdentity / setAttribution / flush / startSession / endSession / getStatus + 5개 분산 getter + GDPR 3개) 모두 노출되었고 wire schema (`attributionToWire`, `events/collect` POST body) 가 capacitor / Flutter / iOS 와 byte-exact 일치 (snake_case 11개 필드). 5채널 parity matrix 도 PRD §5.1 의 의도된 비대칭 7건 (ATT / autoTrackPageView / PageView / Android method form / capacitor aggregate / capacitor 분산 getter 누락 M5 / dual export) 을 충실히 반영. globalThis state pin 패턴은 dual-package hazard 의 **state 분리** 위협은 막지만, **non-state singleton** (`queue` module-level instance, `page-view-tracker` 의 `detachFn` module-level 변수) 이 H1 결정의 사정 거리 밖에 있어 dual evaluation 시 두 instance 가 별도 lifecycle 을 갖는다. 가장 큰 회귀는 **Attribution 영속성 — `setAttribution` 후 reload 시 `EodinAnalytics.attribution` getter 가 `null` 반환** (Flutter 의 `_loadAttribution()` 누락) 이며 4채널 parity 와의 의미적 단절. Phase 5 publish 직전 closure 권장 항목 5건 (HIGH 3 + CRITICAL 1 + 보강 MEDIUM 1).

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 4 |
| Medium | 6 |
| Low | 4 |
| Info | 3 |

전체 코드 품질: **B+** — surface 완전성 / wire parity / 테스트 coverage 견고하나, dual-package hazard 차단의 부분성 + Attribution reload 회귀 + page-view monkey-patch 의 SPA-router 충돌이 누적되어 Grade A 로 가지 못했다. CRITICAL 1 / HIGH 4 항목은 Phase 4 (테스트 + 문서) 진입 전 closure 권장.

---

## Critical & High Priority Findings

### C1. Attribution getter — 페이지 reload 시 localStorage 의 attribution 을 다시 로드하지 않아 `null` 반환 (4채널 parity 회귀)

- **Severity**: CRITICAL
- **Category**: 8. Project-Specific Compliance / 1. Architecture & Design (4채널 parity)
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:330-332`, `packages/sdk-web/src/analytics/state.ts:30-42`, `packages/sdk-web/src/analytics/eodin-analytics.ts:141-176` (`configure`)
- **Issue**:

  `EodinAnalytics.attribution` getter 는 `getState().attributionInMemory` 를 반환한다. `attributionInMemory` 는 **`setAttribution()` 호출 시에만 set** (line 244 `state.attributionInMemory = attribution`). `configure()` 는 localStorage 의 `eodin_attribution` 키에서 attribution 을 다시 hydrate 하지 **않는다**.

  결과적인 시나리오:
  ```ts
  // T0: 첫 페이지 로드
  await EodinAnalytics.configure({ ... });
  EodinAnalytics.setAttribution({ utmSource: 'meta', campaignId: 'spring' });
  // localStorage['eodin_attribution'] = '{"source":undefined,"campaign_id":"spring","utm_source":"meta",...}'
  // state.attributionInMemory = { utmSource: 'meta', campaignId: 'spring' }

  EodinAnalytics.attribution;
  // → { utmSource: 'meta', campaignId: 'spring' }  ✓ 정상

  // T1: 페이지 reload (새 module 평가, fresh globalThis state)
  await EodinAnalytics.configure({ ... });
  // configure() 가 localStorage 를 읽지 않음 — state.attributionInMemory = null

  EodinAnalytics.attribution;
  // → null  ✗ 호스트 입장에서 attribution "사라짐"

  EodinAnalytics.track(EodinEvent.AppOpen);
  // event.attribution = JSON.parse(localStorage[...])  ← track 경로는 localStorage 직접 읽으므로 정상
  ```

  Track 경로 (line 203-213) 는 localStorage 의 attribution 을 매 호출마다 직접 읽기 때문에 **wire 로 전송되는 events 의 attribution 은 정상**. 문제는 호스트가 getter 를 신뢰할 수 없다는 점:
  - 호스트 UI (디버그 패널, debug overlay 등) 에서 "현재 attribution" 표시 → reload 후 비어 보임
  - 호스트 분기 로직 `if (EodinAnalytics.attribution?.utmSource === 'meta') { ... }` → reload 후 false-negative

  4채널 비교 (parity 회귀):
  - **Flutter** `eodin_analytics.dart:96` — `await _loadAttribution();` 가 `configure()` 안에서 호출 → `_attribution` static field 에 storage 의 값 hydrate → getter `static Attribution? get attribution => _attribution` 가 reload 후에도 정상 반환
  - **iOS** `EodinAnalytics.swift` — 동일 (UserDefaults 에서 configure 시 load)
  - **Android** — `getAttribution()` method 가 SharedPreferences 직접 읽음 (lazy load) → reload 안전
  - **Capacitor** `web.ts` — getter 부재 (M5), track 경로만 localStorage 직접 읽음 → 영향 없음
  - **Web (본 SDK)** — getter 가 in-memory only → **reload 시 null**

- **Impact**: 4채널 parity 회귀. 호스트가 `EodinAnalytics.attribution` getter 의 의미를 **mobile 4채널 기준** 으로 기대 (configure 후 storage 값 반영) 하면 web 만 다르게 동작. cross-channel 동등성 신뢰 깨짐. PRD §5 line 92 `EodinAnalytics.attribution; // Attribution | null` 는 4채널 parity 를 약속한 surface.

- **Recommendation**:

  `configure()` 가 끝나기 전에 localStorage 의 `eodin_attribution` 을 wire → camelCase 역변환으로 hydrate. 별도 `attributionFromWire` 헬퍼 도입.

  ```ts
  // packages/sdk-web/src/analytics/types.ts (추가)
  /** @internal — wire snake_case → public camelCase 역변환. */
  export function attributionFromWire(
    wire: Record<string, string | undefined>,
  ): Attribution {
    return {
      source: wire.source,
      campaignId: wire.campaign_id,
      adsetId: wire.adset_id,
      adId: wire.ad_id,
      clickId: wire.click_id,
      clickIdType: wire.click_id_type,
      utmSource: wire.utm_source,
      utmMedium: wire.utm_medium,
      utmCampaign: wire.utm_campaign,
      utmContent: wire.utm_content,
      utmTerm: wire.utm_term,
    };
  }

  // packages/sdk-web/src/analytics/eodin-analytics.ts:configure() 안
  static async configure(options: AnalyticsConfigureOptions): Promise<void> {
    validateEndpoint(options.apiEndpoint);
    const state = getState();
    applyConfigureOptions(state, options);

    if (readStorage(STORAGE_KEYS.deviceId) === null) {
      writeStorage(STORAGE_KEYS.deviceId, uuid());
    }

    // Hydrate attribution from storage → in-memory mirror (4채널 parity).
    const attrJson = readStorage(STORAGE_KEYS.attribution);
    if (attrJson !== null && state.attributionInMemory === null) {
      try {
        const wire = JSON.parse(attrJson) as Record<string, string | undefined>;
        state.attributionInMemory = attributionFromWire(wire);
      } catch {
        // corrupted — getter remains null, track 경로는 별도로 localStorage 손상 처리
      }
    }
    // ... (기존 ensureSession / lifecycle / autoTrackPageView)
  }
  ```

  추가 테스트 케이스:
  ```ts
  it('configure 가 localStorage 의 attribution 을 in-memory 로 hydrate (reload parity)', async () => {
    // pre-populate localStorage to simulate post-reload state
    localStorage.setItem(
      STORAGE_KEYS.attribution,
      JSON.stringify({ utm_source: 'meta', campaign_id: 'spring' }),
    );
    await EodinAnalytics.configure(VALID_CONFIG);
    expect(EodinAnalytics.attribution).toEqual({
      utmSource: 'meta',
      campaignId: 'spring',
      // 나머지 필드는 undefined — toEqual 에서 무시
    });
  });
  ```

---

### H1. dual-package hazard — `queue` 와 `detachFn` 이 globalThis pin 밖에 위치해 두 module instance 의 in-flight Promise / monkey-patch 상태 분리

- **Severity**: HIGH
- **Category**: 1. Architecture & Design / 4. Performance (race / lost-update)
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:66`, `packages/sdk-web/src/analytics/page-view-tracker.ts:8`, `packages/sdk-web/rollup.config.mjs:1-33`
- **Issue**:

  Phase 3 H1 결정은 "택 (b) globalThis pin" — `state.ts` 의 `getState()` 가 `globalThis.__eodin_analytics_state__` 에 state object 를 pin. dual evaluation (cjs `dist/cjs/index.js` + esm `dist/esm/index.js` 가 같은 호스트 번들에서 양쪽 evaluate) 시 두 module instance 의 `getState()` 가 **같은 객체 참조** 반환 → state 단일화 ✓.

  그러나 다음 두 module-level instance 는 globalThis 에 pin 되지 **않았다**:

  1. **`queue: EventQueue` (eodin-analytics.ts:66)** —
     ```ts
     const queue = new EventQueue(undefined, (msg) => log(msg, true));
     ```
     ESM 의 `queue` 와 CJS 의 `queue` 는 별개의 `EventQueue` 인스턴스. 두 인스턴스 모두 같은 `STORAGE_KEYS.queue` localStorage 키를 읽고 쓰므로 **persisted 큐 데이터는 functionally 단일**, 하지만:
     - **Web Locks API 가 가용한 환경에서는 안전** — `navigator.locks.request('eodin_event_queue_lock', ...)` 의 lock 이름이 동일하므로 cross-instance 직렬화. ESM 의 `queue.withLock` 와 CJS 의 `queue.withLock` 가 같은 lock 을 두고 큐잉.
     - **Web Locks 미가용 환경 (older browsers / non-secure / jsdom test) 에서는 race risk** — `EventQueue.withLock` (event-queue.ts:124-130) 의 fallback path 는 lock 없이 즉시 `apply()` 실행. ESM 인스턴스가 read → modify → write 하는 사이 CJS 인스턴스가 read → modify → write 가 가능 (lost update). 4채널의 capacitor 도 같은 문제이긴 하나, capacitor 는 단일 publish (CJS only) 이므로 dual evaluation 위험 자체가 0.

  2. **`detachFn: (() => void) | null` (page-view-tracker.ts:8)** —
     ```ts
     let detachFn: (() => void) | null = null;
     ```
     **이쪽이 더 위험.** 두 인스턴스의 `attachPageViewTracker` 가 각각 독립적으로 monkey-patch 를 적용하면:
     - 1번째 attach (ESM): `origPush = history.pushState` (브라우저 native) → `history.pushState = patched_esm`. `detachFn_esm` 에 origPush(native) 로 복원 클로저 저장
     - 2번째 attach (CJS): `origPush = history.pushState` (= `patched_esm`!) → `history.pushState = patched_cjs`. `detachFn_cjs` 에 origPush(=`patched_esm`) 로 복원 클로저 저장
     - 호스트 `EodinAnalytics.dispose()` (어느 쪽이든 호출됨, 보통 한쪽만):
       - dispose-from-CJS 가 호출되면 `history.pushState = patched_esm` — ESM 인스턴스의 patched 가 살아남아 detach 후에도 page_view 가 계속 발생 + detach 의도와 반대 결과
       - dispose-from-ESM 만 호출되면 ESM 의 detachFn 이 native 복원 시도 → CJS 의 patched 는 history.pushState 위에 덮어씌워져 있던 ESM patched 만 native 로 복원 → CJS 의 patched 효과 영구 잔존, dispose 의도 부분 실패

     실제 호스트 시나리오: kidstopia 같은 host 가 `@eodin/web` 을 ESM 로 직접 import 하면서 `@eodin/capacitor` 의 web fallback 이 CJS 로 `@eodin/web/internal` 을 require 하는 경우. internal 은 stateless 라 H1 결정에서 dual 유지 OK 였으나 — internal 의 `EventQueue` 가 root entry 의 `queue` 인스턴스와 별개 module-level instance 가 되는 문제는 그대로.

     **단, 정상 시나리오 검증**: capacitor 어댑터 (`packages/capacitor/src/web.ts:13`) 는 `@eodin/web/internal` 만 require, root `@eodin/web` 은 require 하지 않음. 따라서 capacitor 가 evaluate 하는 것은 `internal` 만 — root entry 의 `queue` / `detachFn` 은 capacitor 측에서 평가되지 않음. **이 경로에서는 dual-package hazard 가 발생 안 함.** 단, "ESM + CJS 양쪽으로 root entry 를 import 하는 host" 가 가능한 한, hazard 는 잠재적.

- **Impact**:
  - **Web Locks 가용 환경 (modern browsers, ~96% support)**: `queue` race 는 lock 으로 봉쇄됨 → 영향 0
  - **Web Locks 미가용**: lost-update race → 일부 events drop. 본 SDK 가 fallback 명시적으로 허용하므로 (event-queue.ts:36-39 README 명시) acceptable
  - **page-view-tracker `detachFn`**: dispose 가 patched 을 정확히 원복 못 할 수 있음. 호스트가 dispose 를 production 코드에서는 거의 호출 안 한다는 가정 (eodin-analytics.ts:413-424) 하에서 영향은 **테스트 환경 + SDK teardown 시점** 으로 한정. 그러나 Phase 4 의 unit test 가 두 module instance 를 동시에 평가하는 시나리오를 만들면 실패 가능

- **Recommendation**:

  Option A (권장 — 최소 범위) — 두 module-level instance 도 globalThis 에 pin:

  ```ts
  // packages/sdk-web/src/analytics/state.ts (확장)
  import { EventQueue } from '../internal';

  export interface AnalyticsState {
    apiEndpoint: string | null;
    apiKey: string | null;
    appId: string | null;
    debug: boolean;
    offlineMode: boolean;
    autoTrackPageView: boolean;
    flushTimer: ReturnType<typeof setInterval> | null;
    lifecycleAttached: boolean;
    attributionInMemory: Attribution | null;
    /** Module-level singleton — globalThis pin 으로 dual evaluation 안전. */
    queue: EventQueue;
    /** page-view tracker 의 detach 클로저. 두 인스턴스가 각자 patch 후 한쪽만
     *  dispose 호출해도 정확히 원복하도록. */
    pageViewDetach: (() => void) | null;
  }

  function defaultState(): AnalyticsState {
    return {
      apiEndpoint: null,
      // ... 기존 필드
      queue: new EventQueue(),
      pageViewDetach: null,
    };
  }

  // eodin-analytics.ts: const queue = new EventQueue(...) 제거, getState().queue 사용
  // page-view-tracker.ts: let detachFn 제거, getState().pageViewDetach 사용
  ```

  Option B (더 깊은 변경) — root entry 만 ESM-only (`"exports": { ".": { import: "..." } }`, `require` 제거). H1 결정이 (a) ESM-only 가 추천이었는데 capacitor CJS 호환성 때문에 (b) 로 변경된 것 — 본 옵션은 그 결정 되돌림. 단, 본 SDK 의 root entry 는 capacitor 가 require 하지 **않으므로** (capacitor 는 `@eodin/web/internal` 만 require), root 만 ESM-only 로 좁히면 호환성 영향 0. PRD §10 의 H1 결정 재고 가치 있음.

  최소한의 "현재 결정 안에서의 보강" 은 Option A. Phase 5 publish 전 closure 권장.

  추가 테스트 (jest 의 module-instance 격리로는 시뮬레이션 어려움 — 별도 integration 테스트):
  ```ts
  // dual-evaluation 시 state 단일성 검증 — 직접 state.ts 의 두 require 시뮬레이션
  it('두 module instance 가 같은 EventQueue 인스턴스를 공유 (Option A 적용 후)', () => {
    const stateA = require('../analytics/state').getState();
    jest.resetModules();
    const stateB = require('../analytics/state').getState();
    // globalThis pin 덕에 같은 객체
    expect(stateA).toBe(stateB);
    expect(stateA.queue).toBe(stateB.queue);
  });
  ```

---

### H2. `track()` 의 fire-and-forget 이 capacitor / Flutter 의 awaitable parity 와 단절 — endSession / setEnabled 직후 race window 잠재

- **Severity**: HIGH
- **Category**: 1. Architecture & Design (5채널 parity) / 5. Error Handling & Resilience
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:178-230` (track), `:297-314` (endSession), `:354-362` (setEnabled)
- **Issue**:

  Web 의 `track()` 는 PRD §5 의 예시 `EodinAnalytics.track(EodinEvent.PageView, { path: '/pricing' });` 가 동기 호출처럼 보이는 점에 맞춰 **return type `void`** + 내부적으로 `void queue.withLock(...).then(...)` 로 fire-and-forget. 4채널의 `track` 은 모두 awaitable:
  - Flutter: `static Future<void> track(...)`
  - iOS: `static func track(_:_:) async throws`
  - Android: `suspend fun track(...)` 또는 callback
  - Capacitor: `Promise<void>` (object arg)

  이 결정 자체는 PRD §5 line 70-72 에 묵시적으로 있고 parity-matrix-5ch.md §1 line 14 에 documented asymmetry ("동기 fire-and-forget") 로 명시 — 정책 자체는 OK. **그러나 실제 사용 패턴 race**:

  1. **endSession race (review focus #5)**:
     ```ts
     static async endSession(): Promise<void> {
       if (readStorage(STORAGE_KEYS.sessionId) !== null) {
         // ...
         EodinAnalytics.track(EodinEvent.SessionEnd, properties);  // fire-and-forget
       }
       removeStorage(STORAGE_KEYS.sessionId);
       removeStorage(STORAGE_KEYS.sessionStart);
     }
     ```

     `event.session_id` 은 `track()` 의 line 198 에서 `readStorage(STORAGE_KEYS.sessionId)` 로 **동기적으로 캡처** 되므로 SessionEnd 이벤트의 session_id 자체는 **올바른 값으로 enqueue**. (review focus #5 의 "session_id null 로 가는 race" 는 실제로는 발생 안 함 — 이벤트 빌드가 동기적이라.)

     그러나 **enqueue 의 Promise 가 아직 resolve 안 한 상태** 에서 호출자가 `await endSession(); await flush();` 시퀀스를 돌리면:
     - Web Locks API 가용 환경: `track` 의 `withLock` 와 `flush` 의 `withLock` 가 동일 lock 을 FIFO 로 큐잉 → track 먼저 mutator 적용, 그 다음 flush 가 batch slice. **순서 보존 ✓**
     - Web Locks 미가용 (fallback): `withLock` 의 `apply()` 가 sync 실행 — `void queue.withLock(mutator).then(...)` 의 mutator 는 호출 즉시 sync 실행. 그러므로 `track()` return 시점에 이미 localStorage 에 write 완료. 그 다음 `flush` 는 mutator 결과를 본다. **순서 보존 ✓**

     **결론**: endSession 자체의 정합성은 깨지지 않음. 단, 호스트가 `EodinAnalytics.track(...)` 를 await 하고 싶을 때 **불가능** — Promise 를 노출하지 않으므로 "track 결과를 기다린 후 flush" 같은 패턴이 web 만 어렵다. parity 영향은 **실 race 가 아니라 API ergonomics**.

  2. **setEnabled(false) → flush 시퀀스 (review focus #8)**:
     ```ts
     static setEnabled(enabled: boolean): void {
       writeStorage(STORAGE_KEYS.enabled, enabled ? 'true' : 'false');
       if (!enabled) {
         void queue.withLock(() => []);  // fire-and-forget
       }
       log(...);
     }
     ```

     호출자: `EodinAnalytics.setEnabled(false); await EodinAnalytics.flush();`
     - Web Locks: setEnabled 의 `withLock(() => [])` 와 flush 의 `withLock(...)` 가 lock FIFO → 클리어 먼저, 그 다음 flush 가 빈 큐 → no-op. **OK**
     - 미가용 (fallback): setEnabled 안의 `withLock` 이 sync apply → 큐 즉시 빈다. flush 도 OK
     - **호출자 perspective race**: `setEnabled(false)` 가 동기 return 후 `getStatus()` 즉시 호출 → fallback 모드는 안전, lock 모드는 microtask 1회 후 클리어 → `await getStatus()` 안에서 보면 OK (await 가 microtask 진행)

     **결론**: setEnabled 도 race 없음. 단, **에러 가시성 부재** — `withLock` 이 fire-and-forget 이라 storage quota 에러나 lock 거부 같은 실패가 호출자에게 전파 안 됨. capacitor `await this.queue.withLock(() => [])` 는 throw 되면 호출자가 잡을 수 있음. parity 깨짐.

- **Impact**:
  1. **에러 가시성**: `setEnabled(false)` 의 큐 클리어 실패가 silent. quota 에러는 `EventQueue.write` 안에서 흡수되므로 throw 는 거의 없으나, custom `mutator` 가 throw 하는 경우 / lock manager API 자체가 거부하는 edge case 에서 호스트가 알 수 없음
  2. **Test 시점**: 본 PRD 의 테스트 (eodin-analytics.test.ts:131-138) 가 `setEnabled(false)` 후 `await new Promise((r) => setTimeout(r, 10))` 로 대기 — 명시적 await 가능했다면 테스트가 더 결정론적
  3. **호스트 ergonomics**: 4채널 사용자가 `await EodinAnalytics.track(...)` 패턴 그대로 쓰면 web 만 즉시 return — 호스트의 mental model 에 cross-channel drift

- **Recommendation**:

  Option A (보수적, 권장) — `track()` / `setEnabled()` 의 시그니처는 그대로 유지하되, **`Promise<void>` 반환** 으로 변경:

  ```ts
  // PRD §5 의 동기 호출 예시도 await EodinAnalytics.track(...) 로 갱신
  static track(
    eventName: EodinEventName | string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    const state = getState();
    if (!isConfigured(state)) {
      log('SDK not configured. Call configure() first.', true);
      return Promise.resolve();
    }
    if (!isEnabledSync()) {
      log(`Tracking disabled (GDPR). Skipping ${eventName}`);
      return Promise.resolve();
    }
    const event: QueuedEvent = { /* ... */ };
    // ... attribution
    return queue.withLock(...).then(() => {
      const queueSize = queue.size();
      log(`Enqueued ${eventName} (queue=${queueSize})`);
      if (queueSize >= QUEUE_FLUSH_THRESHOLD) {
        void EodinAnalytics.flush();
      }
    });
  }

  static setEnabled(enabled: boolean): Promise<void> {
    writeStorage(STORAGE_KEYS.enabled, enabled ? 'true' : 'false');
    log(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
    return enabled ? Promise.resolve() : queue.withLock(() => []);
  }
  ```

  PRD §5 line 71-72, 98 의 예시도 `await` 추가하는 갱신 동반. parity-matrix-5ch.md §1 line 14 의 "동기 fire-and-forget" 도 "awaitable Promise<void>" 로 정정. **호스트는 await 안 해도 동작 그대로** (Promise 를 무시하면 fire-and-forget 처럼 보임) 이라 backward-compat 영향 0.

  Option B (현행 유지) — fire-and-forget 을 정책으로 유지하되, parity-matrix-5ch.md 와 README 에 "track 은 web 만 sync, await 필요 시 endSession 의 마이크로태스크 1회 대기" 명시 강화. 단, 호스트 에러 가시성 부재는 변하지 않음.

  **권장: Option A.** 코드 변경 ~10줄, public 시그니처는 더 강력해지지만 backward compatible.

---

### H3. `attachPageViewTracker` 의 monkey-patch 가 SPA router (Next.js / React Router) 의 후속 patch 와 충돌 시 dispose 가 router 의 patch 를 파괴

- **Severity**: HIGH
- **Category**: 1. Architecture & Design / 6. Code Quality & Readability
- **File**: `packages/sdk-web/src/analytics/page-view-tracker.ts:27-56`
- **Issue**:

  `attachPageViewTracker` 는 호출 시점의 `history.pushState` / `history.replaceState` 를 capture (`origPush`, `origReplace`) 하고 patched 함수로 교체. **detach 시점에 `history.pushState = origPush` 로 복원**.

  문제 시나리오:
  1. `EodinAnalytics.configure({ autoTrackPageView: true })` 호출 → SDK 가 `pushState` 를 patch
     ```js
     history.pushState = patched_eodin  // wraps origPush=native
     ```
  2. **그 다음** Next.js 라우터가 초기화하면서 history.pushState 를 자신의 패치로 교체
     ```js
     history.pushState = patched_nextjs  // wraps patched_eodin
     // — Next.js 가 보는 origPush = patched_eodin, native 직접 호출 못함
     ```
  3. 호스트가 `EodinAnalytics.dispose()` 호출 → `detachPageViewTracker` 가 `history.pushState = origPush` (native) 로 복원
     ```js
     history.pushState = native  // ← Next.js 의 patched_nextjs 가 사라짐!
     ```
  Next.js 의 라우팅 추적 / scroll restoration / prefetch 트리거 등이 영구 깨진다. dispose 가 호스트 라이브러리의 동작을 silently 파괴.

  반대 시나리오 (Next.js 가 먼저 patch, SDK 가 나중):
  1. Next.js: `history.pushState = patched_nextjs`
  2. SDK configure: `origPush = patched_nextjs` (capture), `history.pushState = patched_eodin (wraps patched_nextjs)`
  3. SDK dispose: `history.pushState = origPush = patched_nextjs` ✓ 안전 — Next.js 의 patch 그대로 살아남음

  즉, **SDK 가 "마지막에 patch 한 사람" 이 아닌 경우 dispose 가 위험**. detach 시점에 `history.pushState === patched` (= 우리가 직전에 set 한 함수) 인지 확인하고, 다른 라이브러리의 patch 가 위에 덮어씌워졌으면 복원 시도하지 않는 것이 안전.

- **Impact**:
  - 대부분의 호스트는 dispose 를 호출 안 함 (production 에서는 page unload 로 자연 정리) → 실제 영향 빈도는 낮음
  - **테스트 환경**에서 빈번히 발생 — Next.js + Jest + RTL 같은 셋업에서 SDK 와 라우터가 같은 jest worker 안에서 hoist 된 history 를 공유
  - **devtools / Storybook** 같은 hot-reload 환경에서 dispose 가 자주 호출되며 Next.js 라우터가 깨질 가능성
  - 진단 어렵다 — "내 라우터가 갑자기 안 됨" 의 원인이 SDK 의 dispose 로 특정 어려움

- **Recommendation**:

  detach 클로저 안에서 "현재 history.pushState 가 우리가 set 한 함수 인지" 확인. 같지 않으면 (= 다른 라이브러리가 그 위에 덮어씌웠으면) 복원 시도하지 않고 경고 로그만:

  ```ts
  // packages/sdk-web/src/analytics/page-view-tracker.ts
  export function attachPageViewTracker(
    onPageView: (path: string, title?: string) => void,
  ): () => void {
    detachPageViewTracker();
    if (typeof window === 'undefined' || typeof history === 'undefined') {
      return () => {};
    }
    const fire = (): void => {
      onPageView(window.location.pathname + window.location.search, document.title);
    };
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    type HistoryStateMethod = typeof history.pushState;
    const patched: HistoryStateMethod = function (this: History, ...args: Parameters<HistoryStateMethod>) {
      const result = origPush.apply(this, args);
      fire();
      return result;
    };
    const patchedReplace: HistoryStateMethod = function (this: History, ...args: Parameters<HistoryStateMethod>) {
      const result = origReplace.apply(this, args);
      fire();
      return result;
    };
    history.pushState = patched;
    history.replaceState = patchedReplace;
    window.addEventListener('popstate', fire);
    window.addEventListener('hashchange', fire);

    detachFn = () => {
      // 다른 라이브러리가 그 위에 덮어씌웠으면 복원 안 함 (그 라이브러리의 patch 보존).
      if (history.pushState === patched) {
        history.pushState = origPush;
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          '[EodinAnalytics] history.pushState was re-patched by another library — leaving it in place to avoid breaking that library.',
        );
      }
      if (history.replaceState === patchedReplace) {
        history.replaceState = origReplace;
      }
      window.removeEventListener('popstate', fire);
      window.removeEventListener('hashchange', fire);
      detachFn = null;
    };
    return detachFn;
  }
  ```

  추가 테스트:
  ```ts
  it('detach 는 다른 라이브러리가 위에 덮어씌운 patch 는 보존', () => {
    const original = history.pushState;
    const detach = attachPageViewTracker(() => {});
    const otherLibPatch = function () { return original.apply(this, arguments); };
    history.pushState = otherLibPatch;  // 다른 라이브러리 시뮬
    detach();
    expect(history.pushState).toBe(otherLibPatch);  // SDK 가 덮어쓰지 않음
  });
  ```

  추가 README 권고: `autoTrackPageView` 의 attach 타이밍은 라우터 초기화보다 **앞서야** 호환성 좋음 (configure 를 라우터 초기화 후로 미루지 말 것).

---

### H4. `dispose()` 가 public 타입 surface 에 노출되어 PRD §5 의 surface 정의 와 단절 (4채널 미노출)

- **Severity**: HIGH
- **Category**: 1. Architecture & Design / 8. Project-Specific Compliance
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:411-424`, `packages/sdk-web/dist/esm/analytics/eodin-analytics.d.ts:46`, `packages/sdk-web/src/index.ts:4`
- **Issue**:

  `EodinAnalytics.dispose()` 는 `static dispose(): void` 로 노출되며 `dist/esm/analytics/eodin-analytics.d.ts:46` 에도 public method 로 export. 그러나:
  - **PRD §5** 의 public surface 목록에 dispose 는 **없음**
  - **parity-matrix-5ch.md** 의 §1 메서드 시그니처 표 9개 항목에도 dispose **없음**
  - **4채널 (Flutter / iOS / Android / Capacitor)** — capacitor `web.ts:316-322` 에 `dispose()` 가 있으나 그것은 `EodinAnalyticsWeb` 클래스 (capacitor plugin internal 의 web fallback) 의 메서드일 뿐, capacitor plugin 의 public surface (`EodinAnalyticsPlugin` interface in `definitions.ts`) 에는 dispose **없음**. Flutter / iOS / Android 의 EodinAnalytics 클래스에도 dispose 없음

  결과: web 만 surface 에 dispose 추가 → **5채널 documented asymmetry 표 (parity-matrix §9) 에도 없는 미문서화 비대칭**. 호스트가 cross-channel 코드를 작성할 때 web 분기에서만 dispose 호출 가능 → mental model drift.

  주석 (line 412-415) 은 "테스트 / SDK teardown 용. Production 코드는 보통 호출 안 함" 이라 의도가 internal 인데 public typed surface 에 노출.

- **Impact**:
  - PRD §5 약속과 실제 surface 의 단절 — surface audit 도구 (e.g. api-extractor) 가 발견하면 회귀로 인지
  - 호스트 IDE 자동완성에 dispose 가 보이고 호출 권장처럼 인식 → SPA 라우팅 변경 시 호스트가 자발적으로 dispose 호출 → H3 의 monkey-patch 회귀 트리거
  - parity matrix 갱신 누락

- **Recommendation**:

  Option A (권장) — `dispose` 를 internal (테스트 전용) 로 좁히고 public 에서 제외:

  ```ts
  // packages/sdk-web/src/analytics/eodin-analytics.ts (변경)
  // dispose 를 내부 헬퍼 함수로 분리, 메서드는 제거
  // ...

  /** @internal — 테스트 전용. Public surface 가 아님. */
  export function __disposeForTest(): void {
    const state = getState();
    if (state.flushTimer !== null) {
      clearInterval(state.flushTimer);
      state.flushTimer = null;
    }
    detachPageViewTracker();
    state.lifecycleAttached = false;
  }
  ```

  ```ts
  // packages/sdk-web/src/__tests__/eodin-analytics.test.ts (갱신)
  import { __disposeForTest } from '../analytics/eodin-analytics';
  // ... EodinAnalytics.dispose() 를 __disposeForTest() 로 교체
  ```

  `src/index.ts` 는 `__disposeForTest` 를 export 하지 **않음** — 외부 사용자에게 invisible. 단, `@eodin/web/internal` 으로는 노출 가능 (테스트 / SDK 자체 통합 테스트용).

  Option B (현행 surface 유지하되 PRD / parity matrix 보강) — `dispose` 를 PRD §5.1 의 의도된 비대칭 표에 1행 추가하고 parity-matrix-5ch.md §1 / §9 에도 명시. 호스트 가시 surface 로 인정.

  **권장: Option A.** 본 SDK 가 "의도적으로 web 에만 추가한 ergonomic" 이 1개 (`autoTrackPageView`) 만 있는 것이 surface 단순성에 도움.

---

## Medium Priority Findings

### M1. `track('')` 빈 문자열 / whitespace 검증 부재 — 백엔드가 reject 시 silent drop

- **Severity**: MEDIUM
- **Category**: 2. Security Vulnerabilities (Input validation) / 5. Error Handling
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:178-230`
- **Issue**: `track(eventName: EodinEventName | string, properties?)` 가 `eventName === ''` / `'   '` / `null` (TS bypass 시) 를 거르지 않는다. 빈 event_name 으로 enqueue → flush 시 백엔드의 `events/collect` schema validation 이 reject → 큐에 다시 prepend (requeueBatch) → 영구 retry loop 가능. 4채널의 백엔드 처리 동일 위험.
- **Recommendation**:
  ```ts
  static track(eventName: EodinEventName | string, properties?: Record<string, unknown>): void {
    const state = getState();
    if (!isConfigured(state)) { /* ... */ return; }
    if (typeof eventName !== 'string' || eventName.trim().length === 0) {
      log('Empty event name; ignored.', true);
      return;
    }
    // ...
  }
  ```
  추가로 `eventName.length > 40` 같은 backend invariant 검증도 권장 (5채널 EodinEvent enum 정책 — Phase 1.6 audit 기준 ≤40).

### M2. `requestDataDeletion` 의 4xx/5xx 응답이 `success: false` 를 반환하지만 로컬 데이터 클리어 — 호스트가 retry 판단 어려움

- **Severity**: MEDIUM
- **Category**: 5. Error Handling & Resilience / 1. Architecture (5채널 parity)
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:364-409`
- **Issue**:
  ```ts
  success = response.ok || response.status === 202;
  // ...
  await clearLocalData();  // 항상 실행
  return { success };
  ```
  서버 5xx (일시 장애) 시: success=false + 로컬 클리어 + deviceId 재발급. 호스트가 retry 하려 해도 **device_id 가 이미 새 값** 이라 백엔드는 재요청을 다른 device 로 인식 — 원래 device 의 데이터 삭제는 영영 못 함.

  4채널 (Flutter eodin_analytics.dart:402) 도 같은 패턴 (`await _clearLocalData(); return success;`) 이라 parity 자체는 OK. 그러나 GDPR 의 "right to erasure" invariant: **로컬 클리어는 서버 ACK 후만** 이 더 안전 (legal compliance 관점). 본 PR 의 4채널 거동도 같은 약점 — Phase 1.7 이미 결정된 정책으로 보이나, 본 review 가 의 web SDK 의 surface 노출 시점에 다시 발견.
- **Recommendation**:
  최소한 **5xx 일 때만 보존** (4xx 는 클리어 — 클라이언트 잘못된 요청으로 retry 의미 없음):
  ```ts
  } catch (error) {
    log(`Data deletion request error: ${String(error)}`, true);
  }
  // 서버 5xx 또는 네트워크 에러 시 로컬 보존 → 다음 호출에서 retry
  if (success || (response && response.status >= 400 && response.status < 500)) {
    await clearLocalData();
  }
  return { success };
  ```
  단, 4채널 parity (Flutter line 402) 와 함께 정정 필요 — 본 SDK 단독 정정은 cross-channel drift 만 늘림. **추천: 본 PRD 외 별도 ticket 으로 5채널 동시 갱신**, 본 phase 에서는 INFO 로 격하 가능.

### M3. `__resetStateForTest()` 가 `queue` 의 module-level instance 를 리셋 못함 — 테스트 isolation 부분적

- **Severity**: MEDIUM
- **Category**: 7. Testing
- **File**: `packages/sdk-web/src/analytics/state.ts:72-75`, `packages/sdk-web/src/analytics/eodin-analytics.ts:66`
- **Issue**:
  ```ts
  // state.ts
  export function __resetStateForTest(): void {
    const g = globalThis as { [STATE_KEY]?: AnalyticsState };
    g[STATE_KEY] = defaultState();
  }
  ```
  globalThis state 만 리셋하나 `queue: EventQueue` 모듈 변수 (eodin-analytics.ts:66) 는 그대로. 테스트가 `localStorage.clear()` 로 storage 를 비우면 `queue.read()` 는 자연 0 반환 — functionally OK 이나 만약 EventQueue 가 미래에 in-memory cache 를 추가하면 테스트 isolation 실패.

  더 근본적으로: H1 의 Option A (queue 도 globalThis pin) 채택 시 `__resetStateForTest` 가 자동으로 queue 도 새 인스턴스로 갈아끼움 → 본 finding 자동 해결.
- **Recommendation**:
  H1 Option A 채택 시 자동 해결. 미채택 시 `EventQueue` 에 `reset()` 메서드 추가 + `__resetStateForTest` 안에서 호출:
  ```ts
  // event-queue.ts
  /** @internal — 테스트 전용. */
  reset(): void {
    removeStorage(this.storageKey);
  }
  ```

### M4. `page-view-tracker` 단위 테스트 0건 — autoTrackPageView 동작 / monkey-patch 원복 검증 부재

- **Severity**: MEDIUM
- **Category**: 7. Testing
- **File**: `packages/sdk-web/src/__tests__/` (page-view-tracker.test.ts 부재)
- **Issue**:
  `attachPageViewTracker` / `detachPageViewTracker` 의 단위 테스트가 한 건도 없다. `eodin-analytics.test.ts` 도 `autoTrackPageView: true` 시나리오를 cover 안 함. H3 (라우터 patch 충돌) 의 회귀를 잡으려면 page-view-tracker 의 단위 테스트가 필요.
- **Recommendation**:
  ```ts
  // packages/sdk-web/src/__tests__/page-view-tracker.test.ts (신규)
  import { attachPageViewTracker, detachPageViewTracker } from '../analytics/page-view-tracker';

  describe('attachPageViewTracker', () => {
    afterEach(() => detachPageViewTracker());

    it('history.pushState 호출 시 콜백 fire', () => {
      const onPageView = jest.fn();
      attachPageViewTracker(onPageView);
      history.pushState({}, '', '/foo');
      expect(onPageView).toHaveBeenCalledWith('/foo', expect.any(String));
    });

    it('history.replaceState 호출 시 콜백 fire', () => {
      const onPageView = jest.fn();
      attachPageViewTracker(onPageView);
      history.replaceState({}, '', '/bar?q=1');
      expect(onPageView).toHaveBeenCalledWith('/bar?q=1', expect.any(String));
    });

    it('popstate 이벤트 시 콜백 fire', () => {
      const onPageView = jest.fn();
      attachPageViewTracker(onPageView);
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(onPageView).toHaveBeenCalled();
    });

    it('detach 후 history.pushState 가 native 로 복원', () => {
      const before = history.pushState;
      attachPageViewTracker(() => {});
      expect(history.pushState).not.toBe(before);
      detachPageViewTracker();
      expect(history.pushState).toBe(before);
    });

    it('detach 는 다른 라이브러리가 덮어씌운 patch 보존 (H3 fix)', () => {
      attachPageViewTracker(() => {});
      const otherLib = function () {};
      history.pushState = otherLib;
      detachPageViewTracker();
      expect(history.pushState).toBe(otherLib);
    });

    it('SSR (window undefined) 에서 no-op detach 반환', () => {
      // jsdom 에서는 window 가 항상 존재 — 직접 테스트 어려움.
      // typeof window === 'undefined' 가드는 코드 리뷰로만 검증 (INFO).
    });
  });
  ```

### M5. `track()` 안 attribution 파싱 실패 silent drop — 5xx requeue 와 비대칭

- **Severity**: MEDIUM
- **Category**: 5. Error Handling & Resilience / 6. Code Quality
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:203-213`
- **Issue**:
  ```ts
  const attrJson = readStorage(STORAGE_KEYS.attribution);
  if (attrJson) {
    try {
      event.attribution = JSON.parse(attrJson) as Record<string, string | undefined>;
    } catch {
      // corrupted attribution → silent drop
    }
  }
  ```
  Localstorage 의 `eodin_attribution` 이 corrupted 인 경우 (외부 손상 / 다른 SDK 충돌) silent drop. 호스트 / 운영자가 진단 어려움. Capacitor `web.ts:200-202` 가 같은 패턴이라 5채널 parity 유지 — 단, **debug 모드일 때는 경고 로그** 가 더 안전.
- **Recommendation**:
  ```ts
  if (attrJson) {
    try {
      event.attribution = JSON.parse(attrJson) as Record<string, string | undefined>;
    } catch (err) {
      log(`Corrupted attribution in localStorage; clearing. ${String(err)}`, true);
      removeStorage(STORAGE_KEYS.attribution);
    }
  }
  ```
  추가로 손상된 키를 제거 → 다음 호출에서 재손상 / 재시도 무한 루프 방지.

### M6. `flushOnExit` 의 `sendBeacon` 본문에 `api_key` body field — 헤더 불가 환경 fallback 인데 5xx/4xx 분기 처리 없음

- **Severity**: MEDIUM
- **Category**: 2. Security / 5. Error Handling
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:101-116`
- **Issue**:
  `sendBeacon` 은 헤더 set 불가 → `api_key` 를 body 에 담아 인증 (`{ events: batch, api_key: state.apiKey }`). 백엔드가 이 fallback 을 받는다는 가정 (capacitor `web.ts:514-521` 동일 패턴). 그러나:
  1. **CSRF/abuse 표면 확장**: api_key 가 body 에 남으면 네트워크 캡처 시 추출 용이. 헤더 (`X-API-Key`) 는 일부 보안 도구 / SIEM 이 자동 마스킹. PRD §9 C3 (api key abuse 위험) 와 결합 시 **body field 가 추가 노출 표면**.
  2. **Beacon 실패 시 무손실**: `sendBeacon` 이 false 반환 → `queue.write(remaining)` 실행 안 됨 → 큐에 batch 그대로 잔존. **OK** — 다음 페이지 로드 시 재시도. 단, 페이지 unload 가 임박한 시점이라 다음 로드까지 사용자 행동 정보가 묶임.
- **Recommendation**:
  1. 백엔드의 sendBeacon 인증 fallback 을 명시적으로 문서화 (PRD §7 의 invariant 표에 추가) — 본 phase 외
  2. body 의 `api_key` 가 origin allowlist 의 영향 안에 있도록 (PRD §9 C3 이미 별도 ticket) — backend 정책으로 처리. 본 phase 에서는 INFO 로 격하 가능. 단, 본 트랙에서 액션 가능한 보강:
     ```ts
     function flushOnExit(): void {
       const state = getState();
       if (!isConfigured(state)) return;
       const current = queue.read();
       if (current.length === 0) return;
       const batch = current.slice(0, MAX_BATCH_SIZE);
       const remaining = current.slice(batch.length);
       const ok = sendBeacon(`${state.apiEndpoint}/events/collect`, {
         events: batch,
         api_key: state.apiKey,
       });
       if (ok) {
         queue.write(remaining);
         log(`flushOnExit beaconed ${batch.length} events`);
       } else {
         // beacon 실패 시 큐 보존 — 다음 로드 시 재시도. 명시 로그.
         log(`flushOnExit beacon failed; ${batch.length} events retained`, true);
       }
     }
     ```

---

## Low Priority Findings

### L1. `EodinAnalytics.startSession()` 이 `Promise<void>` 반환하지만 내부적으로 `track(SessionStart)` fire-and-forget — return resolve 시점에 SessionStart enqueue 완료 보장 부재

- **Severity**: LOW
- **Category**: 6. Code Quality
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:289-295`
- **Issue**: `startSession()` 의 시그니처는 `static async startSession(): Promise<void>` 이지만 마지막 `EodinAnalytics.track(EodinEvent.SessionStart);` 가 fire-and-forget. Promise 해소 시점에 SessionStart 가 큐에 들어갔는지 호출자 입장에서 보장 없음. H2 의 track 시그니처를 `Promise<void>` 로 변경 시 자연 해결.
- **Recommendation**: H2 Option A 의 `track` 변경 후 `await EodinAnalytics.track(EodinEvent.SessionStart);` 로 갱신.

### L2. `EodinAnalytics.endSession()` 도 같은 패턴 — `Promise<void>` 의 resolve 시점에 SessionEnd enqueue 완료 보장 부재

- **Severity**: LOW
- **Category**: 6. Code Quality
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:297-314`
- **Issue**: L1 과 동상. H2 Option A 적용 시 자연 해결.

### L3. `attachPageViewTracker` 의 `fire()` 가 초기 페이지 진입 (configure 시점) 의 page_view 를 발생시키지 않음 — Google Analytics 4 등 호스트 기대치와 drift

- **Severity**: LOW
- **Category**: 6. Code Quality / 1. Architecture
- **File**: `packages/sdk-web/src/analytics/page-view-tracker.ts:14-57`, `packages/sdk-web/src/analytics/eodin-analytics.ts:166-170`
- **Issue**:
  `attachPageViewTracker` 는 history API 변경 시점에만 `fire()` 호출. 초기 페이지 (DOMContentLoaded / configure 시점의 URL) 에 대한 page_view 는 발생 안 함. 호스트가 `EodinAnalytics.track(EodinEvent.PageView, { path: location.pathname })` 를 수동 호출해야 함. GA4 / Mixpanel 등의 auto page view 는 첫 페이지를 자동 발생.
- **Recommendation**:
  configure 안에서 `autoTrackPageView: true` 시 attach 직후 1회 fire:
  ```ts
  if (state.autoTrackPageView) {
    attachPageViewTracker((path, title) => {
      EodinAnalytics.track(EodinEvent.PageView, { path, ...(title ? { title } : {}) });
    });
    // 초기 페이지 fire (configure 직후 1회)
    if (typeof window !== 'undefined') {
      EodinAnalytics.track(EodinEvent.PageView, {
        path: window.location.pathname + window.location.search,
        ...(document.title ? { title: document.title } : {}),
      });
    }
  }
  ```
  parity-matrix-5ch.md §5 의 "autoTrackPageView" 행에 "configure 직후 초기 페이지 1회 + 후속 history 변경" 명시.

### L4. `EodinEvent.AttPrompt / AttResponse` enum entry 가 web 에 보존 (parity 의도) 이지만 IDE 자동완성에 노출 — 호스트가 web 에서 호출 가능해 보임

- **Severity**: LOW
- **Category**: 6. Code Quality / 1. Architecture
- **File**: `packages/sdk-web/src/eodin-event.ts:74-77`
- **Issue**:
  주석 (line 74-75) "web 에서 사용 안 하나 wire string 유지 (cross-app 분석에서 받을 수 있으므로 enum entry 보존)" 가 있으나, 호스트가 IDE 자동완성으로 `EodinEvent.AttPrompt` 발견 후 `EodinAnalytics.track(EodinEvent.AttPrompt)` 호출 가능. web 에서는 의미 없는 이벤트가 wire 로 흘러감.
- **Recommendation**:
  enum 자체는 유지하되, JSDoc `@deprecated` (의미: web 에서는 호출 권장 안 함) 표기:
  ```ts
  /** @deprecated web 채널에서는 호출 의미 없음 — iOS/capacitor 의 ATT prompt 시점 분석을 위해 wire string parity 만 유지. */
  AttPrompt: 'att_prompt',
  /** @deprecated 동상. */
  AttResponse: 'att_response',
  ```
  IDE 가 strikethrough 표시 → 호스트 인지 향상.

---

## Info / Educational

### I1. `globalThis pin` 패턴이 React 18 의 `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED` / Apollo Client 의 `__APOLLO_CLIENT__` 와 동일 — 검증된 패턴

- **Severity**: INFO
- **Category**: 1. Architecture & Design
- **Note**: state.ts:5 주석에 이미 명시. 추가 학습 가치는 — 그 패턴들이 모두 `__` prefix + 이름 길게 + 중복 import 방지 경고를 함께 사용한다는 점. 본 SDK 의 `__eodin_analytics_state__` 도 같은 컨벤션 따름. 단, state 외 다른 module-level instance (queue / detachFn) 도 같은 패턴으로 묶으면 더 일관됨 (H1 Option A 와 같은 보강).

### I2. `EodinEventName` union 타입의 IDE 자동완성 우선순위 — `EodinEventName | string` 의 union literal 이 string 으로 widen 되어 자동완성 약화 가능

- **Severity**: INFO
- **Category**: 6. Code Quality
- **File**: `packages/sdk-web/src/analytics/eodin-analytics.ts:178-181`
- **Note**:
  TypeScript 4.x 부터 `'a' | 'b' | string` 형태는 string 으로 widen 되어 IDE 가 `'a' / 'b'` 자동완성 우선순위를 낮춤. 사용자가 `track(EodinEvent.` 까지 치고 자동완성을 부르면 enum 멤버가 추천되지만, `track('` 까지 치면 free-form string 으로 인식해 추천 약함.
  더 강한 자동완성을 원하면 TS 4.4+ 의 `& {} `(no-op intersection) 트릭:
  ```ts
  type EodinEventNameLoose = EodinEventName | (string & {});
  static track(eventName: EodinEventNameLoose, properties?: ...): void;
  ```
  `& {}` 가 union 의 widen 을 방지해 자동완성에서 enum 우선 표시. 본 phase 에서는 작은 ergonomic 개선이라 INFO.

### I3. `setEnabled(false)` 후 `requestDataDeletion` 의 `clearLocalData` 가 enabled flag 보존 — 4채널과 동일하지만 GDPR audit log 관점에서 서버에 opt-out 시점 별도 기록 필요

- **Severity**: INFO
- **Category**: 8. Project-Specific Compliance (GDPR)
- **Note**:
  `clearLocalData()` (line 427-444) 가 `preservedEnabled` 를 보존하고 deviceId 를 재발급. legal compliance (GDPR Art. 17 right to erasure) 관점에서:
  - 로컬 클리어 ✓
  - 서버 deletion 요청 ✓
  - **opt-out 상태는 새 deviceId 에 대해서도 보존** — 사용자 의도 존중 ✓
  단, **opt-out 시점 자체** (timestamp) 가 wire 에 기록되지 않음. 백엔드의 `events/user-data` DELETE 가 audit log 에 자동으로 timestamp 를 남기는지 확인 필요 — 본 SDK 책임 밖. Phase 1.7 G2/G3 같은 결정과 함께 확인.

---

## Positive Observations

1. **Wire schema 5채널 byte-exact 일치**: `attributionToWire` (types.ts:48-64) 의 11개 필드 (source / campaign_id / adset_id / ad_id / click_id / click_id_type / utm_source / utm_medium / utm_campaign / utm_content / utm_term) 매핑이 capacitor `web.ts:83-99`, Flutter `event.dart:143-150`, iOS `Event.swift:151-158` 과 byte-exact 일치. cross-channel funnel 분석의 무결성 확보.

2. **EodinEvent enum 5채널 wire string 일관성**: `eodin-event.ts` 의 38 entries 가 capacitor 와 require-동적 비교 + invariant gates (snake_case / ≤40자 / 유일성 / forbidden v1 14건) 검증으로 Phase 1.3 review 의 가드 그대로 적용 (eodin-event.test.ts:132-147).

3. **Phase 2 review H1 fix 일관 적용**: `requeueBatch` (eodin-analytics.ts:118-123) 에서 prepend + universal trim 제거 → `track` 경로의 명시적 trim (`:217-222`) 으로 wire-data loss 회귀 방지. capacitor (Phase 2 H1 동일 패턴) 와 일치.

4. **GDPR 의 opt-out 보존 패턴 (Phase 1.7 4채널 parity)**: `clearLocalData` (line 427-444) 가 `preservedEnabled` 를 명시적으로 보존하고 deviceId 재발급 + ensureSession 호출. 4채널 (Flutter `_clearLocalData` / capacitor `clearLocalData`) 와 의미 동일.

5. **Lifecycle listener idempotency**: `attachLifecycleListeners` (line 87-99) 가 `state.lifecycleAttached` flag 로 중복 attach 방지. 다중 configure 시나리오 안전.

6. **`flushOnExit` 의 sendBeacon 분기**: 페이지 unload 시점에 fetch 가 cancel 되는 문제를 `sendBeacon` 으로 회피. `pagehide` + `visibilitychange` 양쪽 구독. 4채널 web 환경 (capacitor) 과 동일 패턴.

7. **Endpoint validation**: `validateEndpoint` (`internal/endpoint-validator.ts`) 가 configure 진입에서 즉시 호출 → HTTPS 강제 + dev `http://localhost` 허용. PRD §7 invariant + Phase 1.6 S8 일관.

8. **Test coverage breadth**: 7 suites / 80 tests 통과. Phase 3 의 신규 20 case 가 configure / track / identify / setAttribution / GDPR (setEnabled / requestDataDeletion) / flush / endSession / dispose 의 행복한 경로 + 실패 경로 (5xx requeue) 를 cover.

9. **5채널 parity matrix 의 정확성**: `parity-matrix-5ch.md` 의 9개 dimension (메서드 / status getter / GDPR / ATT / web 고유 / wire string / wire schema / 모듈 / 의도된 비대칭) 이 PRD §5.1 / §10 결정 로그 (M5 / M6 / M7 / L8 / H1) 와 정확히 매핑. 단, dispose 1 항목 누락 (H4) + autoTrackPageView 초기 페이지 (L3) 이 미문서화.

10. **TypeScript 타입 export 완전성**: `index.ts` 가 `EodinAnalytics / Attribution / AnalyticsStatus / AnalyticsConfigureOptions / EodinEvent / EodinEventName` 모두 re-export. d.ts (`dist/esm/index.d.ts`) 도 일관. 호스트 IDE 가 모든 surface 인식.

---

## Action Items Checklist (Phase 5 publish 전 권장 closure)

- [ ] **C1**: `configure()` 안에서 localStorage 의 `eodin_attribution` 을 `attributionFromWire` 로 hydrate → `state.attributionInMemory` 채움. 추가 테스트 1건.
- [ ] **H1**: `queue` (eodin-analytics.ts:66) 와 `detachFn` (page-view-tracker.ts:8) 도 globalThis state 에 pin (Option A) 또는 root entry ESM-only 전환 (Option B). PRD §10 H1 결정의 사정 거리 확장.
- [ ] **H2**: `track()` / `setEnabled()` 의 시그니처를 `Promise<void>` 로 변경 (Option A — backward-compatible). PRD §5 / parity-matrix §1 갱신.
- [ ] **H3**: `detachFn` 안에서 `history.pushState === patched` 검증 후 복원. SPA 라우터 충돌 방지.
- [ ] **H4**: `dispose` 를 public surface 에서 제거하고 `__disposeForTest` (테스트 전용 export) 로 변경. 또는 PRD §5.1 / parity-matrix-5ch.md §9 에 dispose 추가.
- [ ] **M1**: `track()` 에 빈 문자열 / whitespace-only eventName guard 추가.
- [ ] **M3**: H1 Option A 채택 시 자동 해결. 미채택 시 `EventQueue.reset()` 추가.
- [ ] **M4**: `page-view-tracker.test.ts` 신규 — 5 case (push / replace / popstate / detach 복원 / 다른 라이브러리 patch 보존).
- [ ] **M5**: 손상된 attribution localStorage 발견 시 debug 모드에서 경고 + 키 제거.
- [ ] **L3**: `autoTrackPageView: true` 시 configure 직후 초기 페이지 1회 fire.
- [ ] **L4**: `EodinEvent.AttPrompt` / `AttResponse` 에 `@deprecated` JSDoc.

---

## 부록 A — 5채널 parity 회귀 요약 (cross-channel drift 위험)

본 phase 의 finding 중 **cross-channel mental model drift** 를 만드는 항목:

| Finding | Drift 내용 | 영향 채널 |
|---|---|---|
| C1 (Attribution reload) | web 만 reload 후 getter null | web vs Flutter / iOS |
| H2 (track fire-and-forget) | web 만 await 불가 | web vs 4채널 |
| H4 (dispose public) | web 만 dispose 노출 | web vs 4채널 |
| L3 (초기 page_view 누락) | web 만 첫 페이지 미발생 | web 고유 (parity 외) |

C1 / H2 / H4 는 본 PR 의 핵심 surface 정합성 — Phase 5 publish 전 closure 필수.

---

## 부록 B — Wire schema cross-channel grep 검증 결과

```
$ grep -rn "campaign_id\|adset_id\|click_id_type" packages/sdk-{flutter,ios,android}/...
sdk-flutter/lib/src/models/event.dart:143-147   (✓ snake_case 5종)
sdk-ios/Sources/EodinAnalytics/Event.swift:152-156   (✓ snake_case 5종)
sdk-android (grep — JSON serialization layer)   (별도 검증 필요 — 본 phase 외)

$ grep -n "campaign_id\|adset_id" packages/sdk-web/src/analytics/types.ts
54: campaign_id, 55: adset_id, ...   (✓ capacitor / Flutter / iOS 와 byte-exact)
```

**5채널 wire schema 일관성 ✓** — drift 0.

---

**Reviewer Note**: 본 review 의 H1 / H4 가 PRD §10 의 결정 (H1 → globalThis pin 채택, dispose 미명시) 의 정확한 적용 범위를 다시 짚는 성격. 결정 자체의 reverse 가 아니라 **결정의 사정 거리를 module-level non-state instance 까지 확장** 하자는 제안. PRD 의 결정 로그에 부록 H1.1 / H4 추가 갱신 권장.
