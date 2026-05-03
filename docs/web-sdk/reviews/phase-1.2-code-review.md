# Code Review: Phase 1.2 — Internal 모듈 추출 (`packages/sdk-web/src/internal/`)

**Date**: 2026-05-03
**Reviewer**: Senior Code Review Agent
**Scope**:
- 신규 internal 모듈 5개: `packages/sdk-web/src/internal/{storage,uuid,endpoint-validator,event-queue,network-client}.ts`
- 신규 test 5개 + setup: `packages/sdk-web/src/__tests__/{storage,uuid,endpoint-validator,event-queue,network-client}.test.ts` + `setup.ts`
- jest config 수정: `packages/sdk-web/jest.config.js` (setupFiles 옵션 추가)
- Source-of-truth 비교: `packages/capacitor/src/web.ts` (729 줄, 무수정)

**Commit(s)**: 미커밋 (untracked + jest.config.js 1 modified)
**관련 PRD**: `docs/web-sdk/PRD.md` §6 (코드 추출) / `docs/web-sdk/CHECKLIST.md` Phase 1.2
**이전 phase 리뷰**: `docs/web-sdk/reviews/phase-1.1-code-review.md` (H1 dual-package hazard 만 Phase 3 결정 보류, 본 phase 무관)

---

## Summary

Phase 1.2 추출은 의미 parity 가 매우 높고, capacitor 원본의 7개 private 헬퍼 + 1개 export 함수 + 1개 type 정의를 5개 standalone 모듈로 깔끔하게 분리했다. 추출 과정에서 `EventQueue.withLock` 의 `maxSize` trim 위치 이동 1건이 의도적 동작 변경 (capacitor 의 `track()` 호출에서만 enforce 되던 invariant 가 모든 mutator 경로로 확장되어 안전성 향상) 이며, 그 외 동작 차이는 없거나 미미하다. **CRITICAL 0건 / HIGH 0건**, MEDIUM 3건 (M1 EventQueue 에서 quota / drop 관측성 손실, M2 EventQueue.write 의 `localStorage` 직접 호출 inconsistency, M3 `parsed as QueuedEvent[]` runtime validation 부재 — capacitor parity 보존), LOW 4건, INFO 5건. 4채널 surface 영향 0, 회귀 위험 없음. Test coverage 는 5개 모듈 모두 기능 분기 / 환경 fallback / 에러 경로를 cover 하며 누락 케이스는 LOW 수준으로만 관찰됨.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🟢 Low | 4 |
| 💡 Info | 5 |

---

## Critical & High Priority Findings

**해당 없음.**

근거:
- 5개 모듈 모두 capacitor 원본과 의미 parity (`uuid` / `validateEndpoint` / `STORAGE_KEYS` / `read|writeStorage` / `isQuotaError` / `fetchWithTimeout` 는 byte-exact 수준; `EventQueue` 1건만 의도적 동작 강화 — D1 참조).
- public surface 무변경: `src/index.ts` 는 `export {}` placeholder 그대로. `typedoc.json` 의 `exclude: ["src/internal/**"]` + `package.json` 의 `exports: { "." : ... }` 단일 엔트리로 internal subpath 호출 차단됨.
- 4채널 (Flutter / iOS / Android / Capacitor) 코드 무수정 — Phase 2.1 에서 capacitor 가 의존성을 추가하기 전까지 어떤 실행 경로 변화도 없음.
- `npm -w @eodin/web run build` 통과 (사용자 보고). `dist/esm/internal/*` 5개 모듈 + `.d.ts` + `.d.ts.map` 컴파일 확인 (`ls dist/esm/internal` 결과 5×4=20 파일).
- Phase 1.1 의 H1 (dual-package hazard) 은 stateful 모듈 등장 시점 (Phase 3) 에 결정될 사안으로, 본 phase 의 internal 모듈은 모두 **stateless export functions / class without singleton state** 라 dual-package 위험 노출 없음.

---

## Medium & Low Priority Findings

### M1. `EventQueue` 가 quota drop / 큐 전부 삭제 시 관측성 (logging) 손실

- **Severity**: 🟡 MEDIUM
- **Category**: Error Handling & Resilience / Observability
- **File**: `packages/sdk-web/src/internal/event-queue.ts:63-92` vs source `packages/capacitor/src/web.ts:563-599`
- **Issue**: capacitor 원본의 `writeQueue()` 는 quota error 회복 시 `this.log(...)` 두 줄로 (a) "Queue quota exceeded — dropped N oldest events" (b) "Queue dropped entirely — localStorage exhausted" 두 신호를 debug mode 에서 콘솔로 surface 했다. 추출본 `EventQueue.write()` 는 `EodinAnalytics` 의 `log()` 의존성이 없어진 결과 두 신호 모두 silent drop 으로 변경됨. Phase 3 에서 `EodinAnalytics` 가 `EventQueue.write()` 를 호출할 때 drop 사실을 알 수 없어 (i) 사용자에게 노출하는 debug log 회귀 + (ii) 운영자가 quota event 를 재현하기 어려워짐.
- **Impact**: 관측성 회귀 — production 에서 localStorage quota 가 발생해도 `debug=true` 로도 보이지 않는다. 테스트 작성 시 quota 회복 로직 검증을 size 비교만으로 해야 해 비결정적.
- **Recommendation**: `EventQueue` 에 logger 의존성을 주입하거나, drop 결과를 `write()` 의 반환값으로 노출. 후자가 단순.

  ```typescript
  // event-queue.ts
  export interface WriteResult {
    /** 실제로 저장된 events 개수. quota 발생 시 < events.length */
    written: number;
    /** quota 로 떨어진 이벤트 수 (quota 미발생 시 0) */
    droppedDueToQuota: number;
  }

  write(events: QueuedEvent[]): WriteResult {
    // ... 기존 로직 + 각 분기에서 droppedDueToQuota 계산
  }
  ```

  Phase 3 의 `EodinAnalytics` 는 `const { droppedDueToQuota } = queue.write(...); if (droppedDueToQuota > 0) this.log('Queue quota exceeded — dropped X oldest events', true);` 로 capacitor 동작 복원.

  **대안**: Phase 3 진입 시 `EventQueue` 에 `onQuotaExceeded?: (info: { dropped: number, exhausted: boolean }) => void` 콜백을 옵션으로 추가. v1 에서는 어느 쪽도 가능. 현 phase 에서 결정만 하고 Phase 3 진입 시 적용해도 충분.

---

### M2. `EventQueue.write()` 의 마지막-수단 분기에서 `localStorage` 를 직접 호출 — `removeStorage()` 와 inconsistent

- **Severity**: 🟡 MEDIUM
- **Category**: Code Quality / Architecture (Layer Violation)
- **File**: `packages/sdk-web/src/internal/event-queue.ts:81-87`
- **Issue**: 본 모듈은 `storage.ts` 의 `readStorage` / `writeStorage` 헬퍼를 통해 `typeof localStorage === 'undefined'` guard 를 한 곳에서 처리한다는 설계 의도를 가진다 (`storage.ts:1-2` 주석 참조). 그런데 quota 회복 마지막 분기에서만 직접 `localStorage.removeItem(this.storageKey)` 호출 + 자체 `try/catch`. 같은 모듈 안에서 `removeStorage(this.storageKey)` 를 사용하면 타입 가드 + 일관성 둘 다 회복.

  ```typescript
  // 현재 (event-queue.ts:81-87)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  } catch {
    // storage 자체 미가용 — silent drop.
  }
  ```

  `storage.ts:26-29` 의 `removeStorage` 가 이미 `typeof localStorage === 'undefined'` 가드를 하므로 외부 if 가 중복.

- **Impact**: 1) 유지보수 hazard — 추후 storage 추상화에 SSR 모드 / sessionStorage / IndexedDB 백엔드 가 들어갈 때 본 라인은 누락 위험 (자체 호출이라 grep 으로만 찾음). 2) capacitor 원본의 동일 분기 (`web.ts:589`) 는 `this.removeStorage(...)` 를 사용했으므로 추출 과정의 작은 회귀.
- **Recommendation**:

  ```typescript
  // 권장
  import { ..., removeStorage } from './storage';
  // ...
  try {
    removeStorage(this.storageKey);
  } catch {
    // storage 자체 미가용 — silent drop.
  }
  ```

  `removeStorage` 자체가 throw 하지 않도록 이미 작성돼 있어 (`storage.ts:26-29`) 외부 `try` 도 사실상 dead-code 지만 future-proof 차원에서 유지해도 무방.

---

### M3. `EventQueue.read()` 의 `parsed as QueuedEvent[]` 는 runtime validation 없음

- **Severity**: 🟡 MEDIUM
- **Category**: Type Safety / Data Integrity
- **File**: `packages/sdk-web/src/internal/event-queue.ts:46-51`
- **Issue**: `JSON.parse(raw)` 후 `Array.isArray(parsed)` 만 통과하면 곧장 `as QueuedEvent[]` 로 단언. 만약 다른 SDK 버전 / 다른 도메인이 같은 `eodin_event_queue` 키를 사용해 schema 가 다른 데이터를 남겼다면 런타임에 들어와서 `flush()` 에서 wire schema 불일치로 백엔드 422/400 + requeue → 무한 루프 위험.
- **Impact**: 1) 잘못된 schema 의 큐 항목이 영구히 큐에 머무르며 매 flush 마다 백엔드에 거부됨. 2) 동일 키를 재사용한 외부 코드 (예: 테스트에서 `localStorage.setItem('eodin_event_queue', '[1,2,3]')` 같은 입력) 에 대해 type 시스템이 침묵.
- **Recommendation**: capacitor 원본 (`web.ts:552-561`) 도 동일 갭이 있으므로 본 phase 의 회귀는 아님 — **parity 보존**. 다만 Phase 4.1 의 EventQueue 테스트에 "cold-start (localStorage 직접 set 후 재시작 시뮬레이션)" 항목이 이미 등록되어 있으므로 그 시점에 minimum field validation (`event_id`, `event_name`, `app_id`, `device_id`, `timestamp` 5개 필드의 string 검사) 을 도입 권장.

  ```typescript
  // event-queue.ts (Phase 4 시점 적용 권장)
  function isQueuedEvent(x: unknown): x is QueuedEvent {
    if (typeof x !== 'object' || x === null) return false;
    const e = x as Record<string, unknown>;
    return (
      typeof e.event_id === 'string' &&
      typeof e.event_name === 'string' &&
      typeof e.app_id === 'string' &&
      typeof e.device_id === 'string' &&
      typeof e.timestamp === 'string'
    );
  }

  read(): QueuedEvent[] {
    // ...
    return Array.isArray(parsed) ? parsed.filter(isQueuedEvent) : [];
  }
  ```

  본 phase 에서는 ticket 으로 등록만 하고 미적용도 가능 — capacitor 와의 동시 적용을 권장 (4채널 parity 변경). 별도 Phase 4 ticket 으로 등록.

---

### L1. `event-queue.test.ts` 의 quota 테스트가 정확한 잔존 개수를 검증하지 않음

- **Severity**: 🟢 LOW
- **Category**: Testing
- **File**: `packages/sdk-web/src/__tests__/event-queue.test.ts:52-77`
- **Issue**: `attempts < 3` 조건에서 첫 두 호출은 quota throw, 세 번째 호출은 통과. 10 events → halving (drop 5) → 5 events → halving (drop 2) → 3 events → 통과. 결과 큐 길이는 결정적으로 3 이어야 함. 테스트는 `>0 && <10` 만 확인하므로 halving 로직의 off-by-one (e.g. `Math.ceil` vs `Math.floor`) 회귀를 잡아내지 못함.
- **Recommendation**:

  ```typescript
  // 권장
  expect(queue.size()).toBe(3);
  // 추가: newest 가 보존되는지 확인 (드롭은 oldest 부터)
  const persisted = queue.read();
  expect(persisted[0].event_name).toBe(events[7].event_name); // index 7..9 만 남음
  ```

  newest-preservation 단언을 추가하면 M1 의 quota drop semantics ("oldest drop, newest preserve") 도 고정됨. `event-queue.ts:62` 주석이 약속하는 "newest events 보존" 계약을 테스트로 잠금.

---

### L2. `network-client.test.ts` 의 `navigator.onLine` 테스트가 케이스 간 state leak

- **Severity**: 🟢 LOW
- **Category**: Testing / Test Isolation
- **File**: `packages/sdk-web/src/__tests__/network-client.test.ts:103-112`
- **Issue**: 첫 it 가 `navigator.onLine = true` 로 정의, 두 번째 it 가 `false` 로 덮어씀. 다른 describe (예: `sendBeacon`) 가 `navigator.onLine` 을 참조하는 일이 발생하면 마지막 값 (`false`) 이 누수. 테스트 순서 의존성 위험.
- **Recommendation**: `afterEach` 에서 원복.

  ```typescript
  describe('isOnline', () => {
    let original: boolean;
    beforeEach(() => {
      original = navigator.onLine;
    });
    afterEach(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: original,
        configurable: true,
      });
    });

    it('returns true when navigator.onLine is true', () => { ... });
    it('returns false when navigator.onLine is false', () => { ... });
  });
  ```

---

### L3. `network-client.ts` 의 `isOnline()` semantic 미세 차이 — capacitor 는 `navigator.onLine` 을 그대로 반환

- **Severity**: 🟢 LOW
- **Category**: Behavior Parity
- **File**: `packages/sdk-web/src/internal/network-client.ts:43-46` vs `packages/capacitor/src/web.ts:392`
- **Issue**: 추출본은 `return navigator.onLine !== false`. capacitor 원본 `getStatus()` 는 `isOnline: typeof navigator === 'undefined' ? true : navigator.onLine` (즉, `navigator.onLine` 의 값을 그대로 반환). MDN 표준 상 `navigator.onLine` 은 `boolean` 만 반환하므로 실질적으로 결과 동일하지만, 비표준 환경 (예: 테스트 mock 이 `navigator.onLine = undefined`) 에서 갈림: 추출본 `true`, capacitor `undefined`.
- **Impact**: Phase 2 에서 capacitor adapter 가 `getStatus()` 의 `isOnline` 을 본 헬퍼로 대체하면 `undefined` 대신 `true` 가 반환되어 미세한 회귀. 다만 capacitor 의 `getStatus()` return 타입이 `AnalyticsStatus` (`boolean` 강제) 라 type-safe 하게는 추출본이 더 정확.
- **Recommendation**: 의도된 정합으로 보이며 추출본 동작이 더 strict. 다만 주석 한 줄 추가 권장.

  ```typescript
  // network-client.ts:43-46
  /**
   * MDN 표준상 navigator.onLine 은 boolean 만 반환하지만, 일부 mock 환경
   * (jsdom 의 옛 버전 / 테스트 stub) 은 undefined 를 반환한다. 그 경우
   * "online 으로 가정" — 4채널 SDK 의 default-online 정책과 정합.
   */
  export function isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  }
  ```

---

### L4. `event-queue.ts` 의 `LockManagerLike` 가 DOM lib 의 `LockManager` 와 중복 정의

- **Severity**: 🟢 LOW
- **Category**: Code Quality / Type Hygiene
- **File**: `packages/sdk-web/src/internal/event-queue.ts:24-26`
- **Issue**: `tsconfig.json` 의 `lib: ["dom", "es2020"]` 에 `LockManager` 가 이미 들어있는데, 본 파일이 `interface LockManagerLike { request(...): ... }` 를 별도 정의. capacitor 원본 (`web.ts:495, 629`) 은 `(navigator as Navigator & { locks?: LockManager }).locks` 로 DOM lib 의 `LockManager` 사용.
- **Impact**: lib 의 `LockManager` 와 의미 동일하나 type identity 가 다름 → 미래에 본 모듈을 호출하는 곳에서 lib 의 `LockManager` 와 함께 쓸 때 type assertion 이 필요할 수 있음. 또한 lib 가 update 되어 `LockManager.request` 시그니처가 바뀌면 본 alias 가 stale 됨 (이론적).
- **Recommendation**: DOM lib 타입 직접 사용.

  ```typescript
  // 권장
  // interface LockManagerLike 제거.
  private getLockManager(): LockManager | null {
    if (typeof navigator === 'undefined') return null;
    const nav = navigator as Navigator & { locks?: LockManager };
    if (!nav.locks || typeof nav.locks.request !== 'function') return null;
    return nav.locks;
  }
  ```

  `LockManager` 가 dom lib 에 이미 있으므로 추가 import 불필요. capacitor 와 type identity 일치 → Phase 2.2 에서 capacitor 가 본 모듈을 import 할 때 cast 줄어듦.

---

## INFO — 추가 관찰

### I1. `EventQueue.withLock` 의 `maxSize` trim 위치 이동은 의도된 안전성 강화

- **Category**: Architecture / Behavior
- **File**: `packages/sdk-web/src/internal/event-queue.ts:98-117` vs capacitor `web.ts:260-266, 624-639`
- **관찰**: capacitor 의 `withQueueLock` 은 mutator 결과를 그대로 write 하며 `MAX_QUEUE_SIZE` trim 은 `track()` mutator 안에서만 호출되었다. 다른 mutator 경로 (`requeueBatch` (`web.ts:641-644`) 의 `[...batch, ...current]`) 는 이론적으로 `MAX_QUEUE_SIZE` 를 일시 초과 가능. 추출본은 `withLock` 자체에서 모든 mutator 결과에 대해 `next.slice(next.length - this.maxSize)` 를 적용. **결과적으로 invariant 가 강화**되어 `MAX_QUEUE_SIZE` 가 모든 경로에서 enforcement.
- **영향**: positive. capacitor 원본의 잠재적 over-fill (requeue + 매우 큰 in-flight batch 시) 도 방지. capacitor 가 Phase 2.2 에서 본 모듈을 사용하면 자동으로 동일 강화 효과를 얻음 — 4채널 parity 측 worry 없음 (4채널 SDK 도 모두 큐 trim 을 어떤 형태로든 enforce 함).
- **권장 액션**: Phase 2.2 capacitor adapter 작업 시 `web.ts:262-264` (track 안의 splice) 가 redundant 가 되므로 제거. 기능 동일.

---

### I2. `sendBeacon()` 의 payload 모양은 caller 책임 — capacitor `flushOnExit` 의 auth 필드 자동 첨부 없음

- **Category**: API Contract
- **File**: `packages/sdk-web/src/internal/network-client.ts:31-41` vs capacitor `web.ts:692-715`
- **관찰**: capacitor 의 `flushOnExit` 은 `{ events: batch, api_key: this.apiKey }` payload 를 직접 build (auth header 를 sendBeacon 으로 넘길 수 없으니 body 에 포함하는 fallback). 추출본 `sendBeacon(url, payload)` 은 `payload` 를 그대로 stringify — caller 가 `api_key` 를 넣어야 함. 의도된 분리 (network-client 는 auth-agnostic; auth 는 EodinAnalytics 가 담당) 이며, 본 phase 에서 적절한 추상화.
- **권장 액션**: Phase 3 에서 `EodinAnalytics` 의 `flushOnExit` 구현 시 payload 에 `api_key` 를 명시적으로 포함 — 누락 시 백엔드가 unload 요청을 401 처리. 본 contract 를 PRD §5 또는 별도 design note 에 한 줄 기록 권장.

---

### I3. `setupFiles` vs jest globals 제약 — 현재 패턴 (각 test 파일이 직접 `beforeEach`) 은 타당

- **Category**: Testing / Build Config
- **File**: `packages/sdk-web/jest.config.js:7-10`, `packages/sdk-web/src/__tests__/setup.ts:1-8`
- **관찰**: `setupFiles` 옵션은 jest 프레임워크 로딩 **전** 실행 — `beforeEach` / `afterEach` 등 jest globals 미가용 (주석 명시). 현재 `setup.ts` 는 `export {}` 로 사실상 빈 파일이며 globals 셋업 없음. `localStorage.clear()` 는 `storage.test.ts` / `event-queue.test.ts` 가 각자 `beforeEach` 호출. 이 패턴은 정확하다. jest 의 다른 옵션 (`setupFilesAfterEach` 가 아니라 `setupFilesAfterEach` 류 — 정확 옵션명은 jest docs 참조) 으로 옮기면 globals 사용 가능하지만 현 phase 에서는 설정 단순성 우선이라 미적용 OK.
- **권장 액션**: 향후 4 / 5개 테스트가 모두 `localStorage.clear()` 를 반복 호출하는 시점에 jest config 의 alternative setup option 을 검토. 현 phase 변경 불필요.

  단, `setup.ts` 가 `export {}` 만으로 빈 파일인데 굳이 setupFiles 등록되어 있다 — 의도가 (a) future shim/mock 추가 hook 의 자리잡기 인지 (b) 단순 leftover 인지 주석 한 줄로 명시 권장. 현 주석은 후자처럼 읽힘.

---

### I4. `dist/esm/internal/*` 가 publish artifact 로 들어감 — `package.json.exports` 의 single entry 가 기본 차단

- **Category**: API Surface / Distribution
- **File**: `packages/sdk-web/package.json:14-19`, `packages/sdk-web/dist/esm/internal/*` (5개 모듈 + d.ts)
- **관찰**: `files: ["dist/", ...]` + `tsc` 가 `src/internal/**` 를 그대로 dist 에 복제 → tarball 에 internal JS / d.ts 포함. 그러나 `exports` 필드가 `{ ".": ... }` 단일 엔트리만 노출하므로 Node 16+ 의 ES modules / package exports 시멘틱 상 `import '@eodin/web/internal/uuid'` 류 직접 호출은 차단됨 (`ERR_PACKAGE_PATH_NOT_EXPORTED`). 의도된 strict-encapsulation 으로 적절.
- **권장 액션**: Phase 4.3 / 5.1 의 `npm pack --dry-run` 으로 tarball 내용 확인 시 internal/* 가 실제 들어가는지 확인 + README 의 "internal 미노출" 문구 와 일관성 확인. 추가로, Phase 5.1 publish 사전 검증에 `node -e "require('@eodin/web/dist/esm/internal/uuid')"` 같은 strict 검증을 권장 (직접 파일 path import 가 가능한지 — `exports` 가 막아준다는 가정의 회귀 가드).

---

### I5. `endpoint-validator.ts` 의 `paramName` 인자 추가는 메인 SDK Phase 1.6 capacitor 와 동일 시그니처 — 4채널 parity 보존

- **Category**: Cross-platform Parity
- **File**: `packages/sdk-web/src/internal/endpoint-validator.ts:11`
- **관찰**: capacitor 원본 `web.ts:87` 도 동일하게 `paramName = 'apiEndpoint'` default. test 도 메인 SDK Phase 1.6 capacitor `endpoint-validator.test.ts` 의 핵심 케이스 그대로 + paramName arg 케이스 1건 추가 (`endpoint-validator.test.ts:78-82`).
- **권장 액션**: 액션 없음. Phase 2.3 에서 capacitor 의 `endpoint-validator.test.ts` 를 본 모듈로 옮기는 옵션 결정 시 (`CHECKLIST` Phase 2.3 line 120), `paramName` 케이스 1건 forward-port 만 확인.

---

## 상세: 추출 의미 정합성 (요청 1번 — focus area)

| 추출 함수 / 클래스 | source 위치 (capacitor/src/web.ts) | 추출본 (sdk-web/src/internal/) | 의미 일치? | 비고 |
|---|---|---|---|---|
| `STORAGE_KEYS` | `:56-64` | `storage.ts:4-12` | ✅ byte-exact | wire key 7개 동일 |
| `readStorage / writeStorage / removeStorage` | `:537-550` (private method) | `storage.ts:16-29` (free function) | ✅ logic 동일 | private→exported 형태만 변환. typeof guard 동일 |
| `isQuotaError` | `:601-613` (private method) | `storage.ts:32-42` (free function) | ✅ 동일 | name + code 분기 동일 |
| `uuid` | `:122-139` (private function) | `uuid.ts:4-18` | ✅ byte-exact | crypto.randomUUID + RFC4122 v4 fallback 동일 |
| `validateEndpoint` | `:87-108` | `endpoint-validator.ts:11-32` | ✅ byte-exact | LOOPBACK_HOSTS 동일, error message 동일 |
| `QueuedEvent` interface | `:110-120` | `event-queue.ts:9-19` | ✅ 동일 | 9개 필드 동일 |
| `readQueue / writeQueue` | `:552-599` (private method) | `event-queue.ts:43-92` (instance method) | ⚠️ M1 / M2 1건 (logging 손실 / removeStorage 미사용) | quota 회복 로직은 동일 (halving) |
| `withQueueLock` | `:624-639` (private method) | `event-queue.ts:98-117` (instance method) | ⚠️ I1 (maxSize trim 위치 강화) | 안전성 향상 — capacitor 의 `track()` 안 trim 은 redundant 가 됨 |
| `fetchWithTimeout` | `:646-661` (private method) | `network-client.ts:9-24` (free function) | ✅ byte-exact | AbortController guard 동일 |
| `sendBeacon` | `:692-714` (인라인 in flushOnExit) | `network-client.ts:31-41` (분리 free function) | ✅ logic 동일 | I2: payload 책임 caller 로 이동 (의도) |
| `isOnline` | `:392` (인라인 in getStatus) | `network-client.ts:43-46` (분리 free function) | ⚠️ L3 (`!== false` 추가 strictness) | 표준 환경에서 결과 동일 |
| ATT 관련 | `:376-384` | (미추출 — Phase 3 에서 EodinAnalytics 가 직접 처리, web 에서는 `'unknown'` 반환) | — | 본 phase 에서 추출 대상 아님 |
| `attributionToWire` | `:145-161` | (미추출 — Phase 3 EodinAnalytics 의존 항목) | — | 본 phase 에서 추출 대상 아님 |
| Lifecycle listeners (`attachLifecycleListeners` / `flushOnExit`) | `:663-715` | (미추출 — Phase 3 EodinAnalytics 의존) | — | stateful, 본 phase scope 밖 |

종합: **6개 함수 / 1개 인터페이스 / 1개 상수 객체 — byte/logic-exact 추출**. 1개 동작 강화 (`withLock` maxSize trim, I1, 안전성 향상). 1개 미세 strictness 개선 (`isOnline`, L3, type-safety 향상). 2개 issue (M1 logging / M2 inconsistency).

---

## 상세: Multi-tab 동시성 (요청 5번 — focus area)

`EventQueue.withLock` 의 fallback (locks 미가용 시 직접 read-modify-write):

```typescript
// event-queue.ts:101-117
const apply = (): void => {
  let next = mutator(this.read());
  if (next.length > this.maxSize) {
    next = next.slice(next.length - this.maxSize);
  }
  this.write(next);
};

const locks = this.getLockManager();
if (locks) {
  await locks.request(QUEUE_LOCK_NAME, async () => {
    apply();
  });
  return;
}
apply();
```

**Single-tab 정확성**: ✅ 보장. `apply()` 는 동기 함수이며 JS 의 single-threaded event loop 가 read-modify-write 의 원자성을 보장. `mutator` 가 sync 한 한 race 없음.

**Multi-tab race 위험** (locks 미가용 환경, 예: Safari < 15.4 / 비-secure context): tab A 가 `read()` 한 시점과 `write()` 한 시점 사이에 tab B 가 같은 작업을 하면 lost-update. 본 phase 의 fallback 은 **의도적으로 v1 risk 그대로** (`event-queue.ts:33-35` 주석 명시) 이며, 실제 위험 노출은 capacitor 가 Phase 2 에서 본 모듈을 import 한 뒤로도 동일 — 4채널 SDK 의 web 채널 외에는 multi-tab 자체가 없으므로 (mobile / native) 새 위험 surface 추가 없음.

**Phase 3 진입 시 검증 권장**:
- 두 jsdom context 를 띄우는 multi-tab simulation test (jest 단독으로는 어려움) — 또는 README 에 "Web Locks API 미가용 환경에서 multi-tab 동시 사용 시 lost-update 가능" 명시 (이미 주석에는 있음, README 보강 필요).
- 본 phase 변경 불필요.

**기타 race**: `apply()` 안의 `this.read()` → `mutator` → `this.write()` 사이에 Promise resolution boundary 없음 (모두 sync). `withLock` 자체는 `async` 지만 lock-fail path 에서 `await` 가 없어 microtask boundary 도 없음. ✅

---

## 상세: 메모리 / 리소스 leak (요청 4번 — focus area)

본 phase 의 5개 모듈 검토:
- `storage.ts`: 함수 5개, state 없음. ✅
- `uuid.ts`: 함수 1개, state 없음. ✅
- `endpoint-validator.ts`: 함수 1개 + module-scope `LOOPBACK_HOSTS` `Set` 1개 (불변). ✅
- `event-queue.ts`: class 1개 with `storageKey` / `maxSize` 두 readonly 필드. setInterval / addEventListener 없음. ✅
- `network-client.ts`: 함수 3개, state 없음. `fetchWithTimeout` 의 `setTimeout` + `clearTimeout` 페어는 finally 보장. ✅ AbortController 는 fetch 에 부착된 후 try/finally 의 clearTimeout 으로 timer cleanup 확인.

**setInterval / addEventListener 가 본 phase 에 없음을 확인** — capacitor 의 lifecycle listener 는 Phase 3 의 `EodinAnalytics` 본체로 이동 예정. 현 phase 의 모든 모듈이 stateless 또는 short-lived 라 leak surface 없음. ✅

**fetchWithTimeout 의 AbortController leak 가능성**: Promise 가 hang 하더라도 finally 의 `clearTimeout(timer)` 가 호출됨 (fetch reject / resolve / await throw 모두 finally 실행). ✅

---

## 상세: 타입 안정성 / strict mode (요청 6번 — focus area)

`tsconfig.json` 의 `strict: true` + `noUnusedLocals` + `noUnusedParameters` + `allowUnreachableCode: false` 모두 활성화. 빌드 통과 (사용자 확인). 본 phase 의 unsafe cast 점검:

| 파일:라인 | 캐스트 | 안전성 평가 |
|---|---|---|
| `event-queue.ts:48` | `parsed as QueuedEvent[]` | ⚠️ M3. capacitor parity 보존이라 이번 phase 에서는 의도. 별도 ticket. |
| `event-queue.ts:126` | `navigator as Navigator & { locks?: LockManagerLike }` | ✅ DOM lib 미포함 표준 (Web Locks API) 의 type 추가. 안전. |
| `storage.ts:40` | `(error as { code?: number }).code` | ✅ 본 캐스트 직전 `error instanceof Error` guard 후 추가 필드 추출. browser-specific 이라 Error 표준에 없는 code 필드를 옵션으로 읽는 패턴 — 안전. |
| `network-client.ts:32` | `typeof navigator.sendBeacon !== 'function'` | ✅ 캐스트 아님 (typeof check). |
| `event-queue.test.ts:60-67` | `function (this: Storage, ...)` + `Storage.prototype.setItem` spy | ✅ 테스트 내부 한정. 안전. |
| `network-client.test.ts:5,9` | `(globalThis as { fetch?: unknown }).fetch` | ✅ 테스트 내부 한정. fetch override 의 표준적 패턴. |

종합: M3 1건만 의식적으로 보류. 그 외 cast 는 모두 정당. ✅

---

## 상세: 4채널 parity 영향 (요청 8번 — focus area)

본 phase 의 변경:
- `packages/sdk-web/**/*.ts` 신규 추가 only.
- `packages/sdk-web/jest.config.js` 1 line 추가 (setupFiles).
- 4채널 (`packages/sdk-flutter/**`, `packages/sdk-ios/**`, `packages/sdk-android/**`, `packages/capacitor/**`) **0 byte 변경**.

검증:
```bash
git status
# Changes not staged for commit:
#   modified:   packages/sdk-web/jest.config.js
# Untracked files:
#   packages/sdk-web/src/__tests__/
#   packages/sdk-web/src/internal/
```
→ 4채널 회귀 surface 0. capacitor 의 `web.ts:60-715` 코드는 그대로 작동. Phase 2.1 에서 capacitor 가 dependency 를 추가할 때까지 본 모듈은 dead-code. ✅

**capacitor 의 dual-package hazard (Phase 1.1 H1)** 와의 관계: 본 phase 의 internal 모듈은 모두 stateless (또는 caller-instantiated class) 라 dual-package singleton 위험 노출 없음. Phase 3 의 EodinAnalytics 가 등장하는 시점에만 H1 결정이 load-bearing. ✅

---

## 상세: Test coverage 적절성 (요청 3번 — focus area)

| 모듈 | 테스트 파일 | 분기 커버리지 | 누락 가능성 |
|---|---|---|---|
| `storage.ts` | `storage.test.ts` (5 describe / 13 it) | STORAGE_KEYS / read / write / remove / overwrite / isQuotaError 4분기 + 부정 케이스 4개 | ✅ 충분. 단 `localStorage` 미가용 환경 (`typeof localStorage === 'undefined'`) 분기 명시 cover 안 됨 — 단 jsdom 에서는 재현 어려움. INFO 수준. |
| `uuid.ts` | `uuid.test.ts` (1 describe / 3 it) | length / pattern / 1000 unique | ⚠️ fallback 분기 (crypto 미가용) 미 cover — jsdom 에 crypto 가 항상 있어 자연스럽게 short-circuit. fallback path 는 `delete (globalThis as any).crypto` 로 명시 테스트 가능하지만 LOW. |
| `endpoint-validator.ts` | `endpoint-validator.test.ts` (2 describe / 12 it) | accepted (https / loopback / case / trim) + rejected (plain http / 10.0.2.2 / empty / non-URL / unsupported scheme / confusable host pass-through / paramName) | ✅ 메인 SDK Phase 1.6 capacitor 와 동등 + paramName 케이스 추가. |
| `event-queue.ts` | `event-queue.test.ts` (3 describe / 10 it) | read (4 케이스: missing / valid / corrupted / non-array) + write + size + quota halving + withLock (mutator / 비움 / maxSize trim / locks 미가용 fallback) | ✅ 분기 cover. ⚠️ L1 (quota 잔존 개수 정확 검증), 추가 가능 — `requeueBatch` 류 prepend mutator 의 maxSize 동작 케이스 (Phase 3 시점에 가치). |
| `network-client.ts` | `network-client.test.ts` (3 describe / 7 it) | fetchWithTimeout (passthrough / signal / abort) + sendBeacon (unavailable / success / throw) + isOnline (true / false) | ✅ 분기 cover. ⚠️ L2 (isOnline state leak). `AbortController` 미가용 분기 (typeof AbortController === 'undefined') 미 cover — 단 jsdom 에 AbortController 있어 재현 어려움. INFO. |

**누락 위험 추가 점검**:
- ❌ Cross-module integration test 없음 — 의도. Phase 4.1 에서 EodinAnalytics 가 등장한 뒤 추가.
- ❌ `EventQueue` 의 `read()` / `write()` race (concurrent withLock 두 개) — single jest test 환경에서는 promise sequencing 으로만 simulate 가능. Phase 3 / Phase 4 시점에 가치. 본 phase scope 밖.
- ❌ `validateEndpoint` 의 IDN host (한글 도메인 등) — 4채널 SDK 의 본 케이스도 cover 안 함. parity 보존.

종합: **본 phase 단독 단위에서 coverage 충분**. M / H 누락 없음. L 1건 (L1).

---

## 상세: jest 설정 / setupFiles (요청 7번 — focus area)

I3 에서 다룬 패턴은 타당. 추가 검증:

`jest.config.js`:
```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
}
```

**걱정 없음**:
- `ts-jest` + `jsdom` 조합 — 표준 web SDK 테스트 환경.
- `testMatch` 가 `__tests__` 안 `.test.ts` 만 매칭 — `setup.ts` 자체는 테스트로 잡히지 않음 (.test.ts 가 아님). ✅
- `tsconfig.json` 의 `exclude: ["src/__tests__"]` 와 `testMatch` 가 정합 — 빌드는 테스트 미포함, 테스트는 jest 가 ts-jest 로 in-memory transpile. ✅

**미세 개선**: `setup.ts` 가 현재 `export {};` 만 — 미래 확장 hook 으로만 존재. 빈 파일에 주석으로 의도 명시는 잘 되어 있음 (`setup.ts:1-7`). 유지 OK.

---

## Positive Observations 👍

1. **추출 fidelity 매우 높음** — 6개 함수 / 1개 interface / 1개 상수 객체 byte/logic-exact. 추출 과정의 우발적 회귀 0. 의도된 동작 강화 (I1) 1건은 안전성 향상 방향.

2. **stateless-first 분리** — 5개 모듈 중 4개가 free function module, 1개 (`EventQueue`) 만 instance. Phase 1.1 H1 (dual-package hazard) 위험 surface 추가 없음.

3. **Public surface 의도 보존** — `index.ts` placeholder 유지, `typedoc.json` exclude, `package.json.exports` 단일 entry 3중 가드. internal 노출 0 (I4 의 publish artifact 도 `exports` 가 차단).

4. **타입 안전성** — `parsed as QueuedEvent[]` 1건 (M3, capacitor parity 보존) 외에는 unsafe cast 없음. `LockManagerLike` 도 narrow interface 로 안전. strict mode 통과.

5. **테스트 isolation** — 각 test 파일이 명시적 `beforeEach(() => localStorage.clear())` (storage / event-queue) 호출. setup.ts 의 jest globals 제약을 정확히 인식한 주석. test file 간 cross-talk 없음 (L2 의 navigator.onLine 빼고).

6. **환경 fallback 견고** — `typeof localStorage` / `typeof navigator` / `typeof crypto` / `typeof AbortController` 4개 환경 가드 일관성 유지. SSR / Node / 옛 브라우저 안전.

7. **endpoint validator paramName 인자** — 4채널 메인 SDK Phase 1.6 capacitor 의 시그니처를 정확히 forward-port. 향후 Phase 3 의 EodinAnalytics / future deeplink-web 모듈이 동일 validator 를 다른 paramName 으로 재사용 가능. parity + reusability 양립.

8. **EventQueue.write 의 quota halving + 마지막 수단 (큐 키 제거)** — capacitor 원본의 견고한 회복 로직을 그대로 유지. M1 의 logging 만 추가하면 production-ready 수준.

9. **maxSize 강화 (I1)** — capacitor 원본의 `track()`-only trim 을 모든 mutator 경로로 확장. 의도된 안전성 강화이며 Phase 2.2 에서 capacitor 의 redundant trim 이 자연스럽게 제거됨.

10. **TypeDoc / build 모두 internal 미노출** — `dist/esm/internal/*` 가 tarball 에 들어가지만 (I4) `exports.` 단일 entry 가 path 노출 차단. README / 향후 publish 검증으로 더블체크 필요하지만 현 설계는 올바른 방향.

---

## Action Items Checklist

### 본 phase 즉시 / Phase 2 진입 전
- [ ] **(M2)** `event-queue.ts:81-87` 의 `localStorage.removeItem` 직접 호출을 `removeStorage(this.storageKey)` 로 교체 (storage.ts import 추가). capacitor 원본과 일관성 회복.
- [ ] **(L1)** `event-queue.test.ts:75-76` 에 정확한 잔존 개수 (`expect(queue.size()).toBe(3)`) + newest preservation 단언 추가. halving 로직 회귀 가드.
- [ ] **(L2)** `network-client.test.ts:103-112` 의 `navigator.onLine` 테스트에 `beforeEach`/`afterEach` 로 원복 로직 추가. 케이스 간 state leak 차단.
- [ ] **(L3)** `network-client.ts:43-46` 의 `isOnline` 에 capacitor 와의 미세 차이 (`!== false` strict) 주석 한 줄 추가.
- [ ] **(L4)** `event-queue.ts:24-26` 의 `LockManagerLike` 제거 → DOM lib 의 `LockManager` 직접 사용. capacitor 와 type identity 일치.

### Phase 3 진입 시 (EodinAnalytics 본체 작성 시점)
- [ ] **(M1)** `EventQueue.write()` 의 quota drop / 큐 전체 삭제 시그널을 `EodinAnalytics` 가 surface 할 수 있도록 (a) WriteResult 반환 또는 (b) onQuotaExceeded 콜백 옵션 도입. capacitor 의 debug log 동작 복원.
- [ ] **(I1 후속)** capacitor 의 `web.ts:262-264` (track 안 splice) 를 redundant 로 제거 — Phase 2.2 작업 시.
- [ ] **(I2)** Phase 3 의 `flushOnExit` 에서 sendBeacon payload 에 `api_key` 명시적 포함. 누락 시 백엔드 401 위험. PRD §5 또는 design note 에 contract 한 줄 기록.

### Phase 4 진입 시 (테스트 보강)
- [ ] **(M3 / Phase 4.1)** `EventQueue.read()` 의 `parsed as QueuedEvent[]` 에 minimum field validation 도입 (5개 필드 string 체크). 4채널 capacitor 와 동시 적용 권장 (cross-platform parity 변경).
- [ ] **(I4 / Phase 5.1)** `npm pack --dry-run` 으로 internal/* 가 tarball 에 들어가는지 확인 + `node -e "require('@eodin/web/dist/esm/internal/uuid')"` 같은 strict subpath 차단 검증 추가.

### INFO / 후속 ticket (현 phase 무관)
- [ ] **(I3)** `setup.ts` 가 현재 빈 파일 — 미래 확장 시 jest 의 alternative setup option 검토. 현 phase 변경 불필요.
- [ ] **(I5)** Phase 2.3 에서 capacitor 의 `endpoint-validator.test.ts` 를 본 모듈로 옮길지 결정 시 `paramName` 케이스 forward-port 확인.

---

## Overall Code Health

**Grade: A**

추출 fidelity, 타입 안전성, 테스트 isolation, 환경 fallback 모두 우수. CRITICAL / HIGH 0건이며 MEDIUM 3건 모두 (i) Phase 3 진입 시 자연스럽게 정리되거나 (M1) (ii) capacitor parity 보존 차원의 의식적 보류 (M3) 또는 (iii) one-line fix (M2). LOW 4건 / INFO 5건은 모두 nice-to-have 수준. 본 phase 만으로는 Grade A; M2 / L1 / L2 / L3 / L4 5건이 적용되면 A+ 권장.

다음 단계 (Phase 1.3 EodinEvent enum) 진입에 blocker 없음. M1 / I2 는 Phase 3 진입 전까지 ticket 으로만 추적해도 충분.
