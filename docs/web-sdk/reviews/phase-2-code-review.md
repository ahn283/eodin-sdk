# Code Review: Phase 2 — Capacitor `web.ts` 어댑터화 (`@eodin/web/internal` import)

**Date**: 2026-05-03
**Reviewer**: Senior Code Review Agent
**Scope**:
- `packages/capacitor/src/web.ts` (-204 lines, -28%)
- `packages/capacitor/package.json` (`dependencies: @eodin/web`)
- `packages/capacitor/tsconfig.json` (`moduleResolution: "bundler"`)
- `packages/sdk-web/src/internal/index.ts` (신규 internal barrel)
- `packages/sdk-web/package.json` (`exports./internal` 추가)
- `packages/sdk-web/rollup.config.mjs` (dual entry build)
**Commit(s)**: 작업 트리 상태 (uncommitted) — phase-2 작업 중

---

## Summary

Phase 2 의 코드 골격은 단정하다 — capacitor 의 web.ts 가 729 → 525 lines 로 줄고, 4채널 parity invariant 유지에 필요한 5개 helper (EventQueue / fetchWithTimeout / sendBeacon / uuid / validateEndpoint / STORAGE_KEYS / readStorage / writeStorage / removeStorage) 가 `@eodin/web/internal` 로 일관되게 옮겨졌다. Public surface (definitions / index / EodinAnalytics 클래스 메서드 시그니처) 무변경이라 host app SemVer 영향 0. 다만 **2건의 의미적 회귀** 가 식별됨 — (1) `requeueBatch` 의 트림 의미 변경 (`HIGH`), (2) capacitor 가 quota drop 관측성을 잃음 (`HIGH`). 추가로 capacitor 의 rollup 번들이 `@eodin/web/internal` 코드를 IIFE / cjs 출력에 통째로 inline 하면서 publish 시 의존성 정합 문제 (`HIGH`) 가 보인다. 4채널 parity 자체에는 영향 없음.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 3 |
| 🟡 Medium | 4 |
| 🟢 Low | 3 |
| 💡 Info | 3 |

전체적인 코드 품질은 견고. 단, HIGH 3건이 모두 publish 직전에 처리해야 할 성격이라 Phase 5 진입 전 closure 권장.

---

## Critical & High Priority Findings

### H1. `requeueBatch` — flush 실패 시 재큐 batch 가 maxSize 트림에 의해 통째로 사라질 수 있음 (의미적 회귀)

- **Severity**: 🟠 HIGH
- **Category**: Performance / Resilience / Behavioral Regression
- **File**: `packages/capacitor/src/web.ts:460-463`, `packages/sdk-web/src/internal/event-queue.ts:98-117`
- **Issue**: 

  Pre-refactor `webview.ts` 의 트림은 **track 시점에서만** `splice(0, length - MAX_QUEUE_SIZE)` 로 발생, `requeueBatch` 는 **트림 없이** 단순히 `[...batch, ...current]` 를 push 했다. 따라서 큐가 1000 (max) 인 상태에서 50개 batch flush → 큐 950 → 네트워크 실패 → requeueBatch → 1000 (no trim, requeueBatch 자체에 maxSize 검사 없었음). 다음 track 호출 때만 max 검사가 작동.

  Post-refactor `EventQueue.withLock` 는 모든 mutator 결과에 일괄적으로 maxSize 트림을 적용한다 (`event-queue.ts:103-105`):
  ```ts
  if (next.length > this.maxSize) {
    next = next.slice(next.length - this.maxSize);  // keeps LAST maxSize items
  }
  ```
  `requeueBatch` 는 batch 를 **앞에** prepend (`[...batch, ...current]`) 하므로, 큐가 max 인 상태에서 50개를 prepend → 1050 길이 → `slice(50)` 가 정확히 prepend 한 batch 50개를 통째로 떨어뜨린다. **즉 flush 실패 시 큐를 보존하려는 의도가 정확히 그 batch 만 잃는 것으로 reverse**.

  실 시나리오: 백그라운드 탭이 30분 깨어나 1000개 큐 도달, 마지막 50개 flush 시도 → 5xx → requeueBatch → 50개 batch 가 max 트림에 의해 제거. 다음 flush 까지 50개가 영구 손실.

- **Impact**: Flush 실패 = 큐 backlog 시점인데, 그 시점에 prepend 의 의미가 "트림 우선순위 1순위" 가 되어 events 손실. logging-audit M1 (실패 시 events 보존) 의 invariant 위반.

- **Recommendation**: 

  Option A (권장) — `requeueBatch` 가 batch 를 **뒤에** append:
  ```ts
  // packages/capacitor/src/web.ts:460
  private async requeueBatch(batch: QueuedEvent[]): Promise<void> {
    if (batch.length === 0) return;
    // 트림이 발생할 경우 newest events 가 보존되어야 하므로 batch 를
    // current 뒤에 붙인다. 단 trim 자체는 항상 oldest 부터 — newest 보존
    // (큐 invariant 와 동일).
    await this.queue.withLock((current) => [...current, ...batch]);
  }
  ```
  Pre-refactor 동작과 정확히 같지는 않지만 (pre 는 1050 까지 허용), 의미는 정합 — failed batch 와 그 사이에 enqueue 된 이벤트 모두 newest 에 위치, oldest 만 트림 대상.

  Option B — `EventQueue.withLock` 가 prepend / append 를 명시적으로 구분 (API 변경 필요. Phase 3 진입 전 한 번에 정리하는 방향).

  회귀 가드: capacitor `__tests__/web.test.ts:152-163` 의 transient flush 실패 케이스를 1000개 큐 시나리오로 강화 — `expect(queueSize).toBeLessThan(before)` 만 검증하므로 batch 통째 drop 도 통과.

---

### H2. capacitor 가 localStorage quota drop 관측성을 잃음 — Phase 1.2 review M1 정신이 capacitor 로 전파되지 않음

- **Severity**: 🟠 HIGH
- **Category**: Observability / Logging
- **File**: `packages/sdk-web/src/internal/event-queue.ts:64-92`, `packages/capacitor/src/web.ts` (전체)
- **Issue**: 

  Pre-refactor `web.ts:563-599` 의 `writeQueue` 는 quota drop 시 `this.log(...)` 를 호출해 capacitor 의 `debug:true` 모드에서 drop 사실을 console 로 surface 했다:
  ```ts
  this.log(
    `Queue quota exceeded — dropped ${events.length - trimmed.length} oldest events`,
    true,
  );
  ```

  Post-refactor `sdk-web/internal/event-queue.ts:64-92` 의 `EventQueue.write` 는 **로거를 받지 않으므로 quota drop 을 silent drop** — capacitor 의 `this.log` 는 호출 경로에서 사라짐. capacitor 사용자가 `debug:true` 로 운영해도 quota 사고를 발견할 길이 없다 (Phase 1.2 review M1 의 정확히 반대 방향).

  Phase 1.2 review M1 은 sdk-web 에서 quota drop 관측성을 이미 보강했어야 할 부분 — 그 finding 이 sdk-web 트랙에서만 처리되어 capacitor 로 propagate 되지 않은 흔적.

- **Impact**: `debug:true` 모드에서도 quota exhaustion 진단 불가. 모바일 ↔ 웹 hybrid 앱 (kidstopia 등) 의 web fallback 에서 큐 손실이 발생해도 운영팀이 알 길 없음. Phase 5 publish 직전 G1 (kidstopia vendor tgz 회귀 검증) 의 진단 도구가 부족해짐.

- **Recommendation**: 

  Option A (권장) — `EventQueue` 생성자가 optional logger 콜백 받도록:
  ```ts
  // packages/sdk-web/src/internal/event-queue.ts
  export interface QueueLogger {
    onQuotaDrop(droppedCount: number, remaining: number): void;
    onTotalDrop(): void;
  }
  
  export class EventQueue {
    constructor(
      private readonly storageKey: string = STORAGE_KEYS.queue,
      private readonly maxSize: number = DEFAULT_MAX_QUEUE_SIZE,
      private readonly logger: QueueLogger | null = null,
    ) {}
    
    write(events: QueuedEvent[]): void {
      // ... 기존 로직 ...
      if (isQuotaError(error)) {
        let trimmed = events;
        while (trimmed.length > 0) {
          const dropCount = Math.max(1, Math.floor(trimmed.length / 2));
          trimmed = trimmed.slice(dropCount);
          try {
            writeStorage(this.storageKey, JSON.stringify(trimmed));
            this.logger?.onQuotaDrop(events.length - trimmed.length, trimmed.length);
            return;
          } catch (retryError) {
            if (!isQuotaError(retryError)) throw retryError;
          }
        }
        try {
          removeStorage(this.storageKey);
        } catch {
          // ...
        }
        this.logger?.onTotalDrop();
        return;
      }
      throw error;
    }
  }
  ```
  capacitor `web.ts:130` 에서:
  ```ts
  private readonly queue = new EventQueue(undefined, undefined, {
    onQuotaDrop: (dropped, remaining) =>
      this.log(`Queue quota exceeded — dropped ${dropped} oldest events (${remaining} remain)`, true),
    onTotalDrop: () =>
      this.log('Queue dropped entirely — localStorage exhausted', true),
  });
  ```
  Phase 3 의 sdk-web `EodinAnalytics` 도 동일 logger 주입 — observability invariant 가 5채널 모두에 일관.

  Option B — `EventQueue.write` 가 quota 시 `Error` 대신 `{ ok: false, dropped: N }` 같은 result 반환. caller (capacitor / sdk-web `EodinAnalytics`) 가 자기 로직으로 로그. API 설계 더 깨끗하지만 mutator return 시그니처 변경 폭 큼.

  본 finding 은 sdk-web 트랙의 후속 patch 가 필요 — capacitor 단독 수정으로는 close 불가.

---

### H3. capacitor publish artifact 가 `@eodin/web/internal` 코드를 통째로 inline — `dependencies` 와 publish artifact 사이 의미 mismatch

- **Severity**: 🟠 HIGH
- **Category**: Build / Packaging / SemVer 위험
- **File**: `packages/capacitor/rollup.config.mjs`, `packages/capacitor/package.json:45-47`
- **Issue**: 

  capacitor `rollup.config.mjs` 의 `external: ['@capacitor/core']` 는 **`@eodin/web` 을 external 로 선언하지 않는다**. rollup 의 `nodeResolve` 가 작동하면서 `dist/plugin.cjs.js` (cjs main) 와 `dist/plugin.js` (IIFE) 에 `@eodin/web/internal` 의 모든 코드가 inline 된다 — 실제 빌드 산출 검증:
  ```
  $ grep -c "class EventQueue" dist/plugin.cjs.js dist/plugin.js
  dist/plugin.cjs.js:3   ← inlined
  dist/plugin.js:3       ← inlined
  $ grep -c "require('@eodin" dist/plugin.cjs.js
  0  ← no external require
  ```
  반면 `dist/esm/web.js` (ESM `module` 필드) 는 `import { EventQueue, ... } from '@eodin/web/internal'` bare specifier 그대로 — bundler 가 처리.

  결과: 동일 사용자가 동일 빌드 환경에서 cjs/esm 어느 entry 를 픽하느냐에 따라 `@eodin/web` 코드를 1번 또는 2번 (cjs inline + esm via 별도 import) 로드. 더 큰 문제는:

  1. **`dependencies: { "@eodin/web": "^1.0.0-beta.1" }` 가 거짓** — cjs 사용자는 npm install 시 받은 `node_modules/@eodin/web` 을 절대 사용하지 않으면서도 npm 이 dependency 로 실제 install 함 (불필요한 byte 부담)
  2. **버전 drift** — 사용자가 host app 에서 `@eodin/web@1.0.0-beta.2` 를 직접 install 해도 capacitor 의 cjs entry 는 publish 시점에 inline 한 1.0.0-beta.1 코드를 그대로 사용. `@eodin/web` 의 보안 patch 가 capacitor 에 propagate 되지 않음.
  3. **dual-package hazard 확장 (Phase 1.1 H1)** — esm path 는 host `@eodin/web` 인스턴스, cjs path 는 inline 인스턴스. EventQueue 가 stateful (in-memory locks 진행 promise) — host app 이 sdk-web 직접 사용 + capacitor 도 사용하면 인스턴스 2개. localStorage 동기화로 데이터 측면은 안전하나, 진행 중 lock promise / Web Locks API 의 lock holder 식별 기준에서 분리.

- **Impact**: 
  - capacitor publish artifact 의 cjs/esm 의미 inconsistency
  - 보안 patch propagation 실패 (security incident 발생 시 capacitor 만 별도 publish 필요)
  - dual-package hazard 가 Phase 1.1 의 sdk-web 단일 패키지 가정을 넘어 capacitor 까지 확장
  - npm `dependencies` 와 실제 artifact 동작 mismatch — `peerDependencies` 가 의미상 더 정확

- **Recommendation**: 

  Option A (권장 — Phase 5 publish 전 결정) — capacitor 가 `@eodin/web` 을 external 로 선언, host app 이 책임지고 install:
  ```js
  // packages/capacitor/rollup.config.mjs
  export default {
    input: 'dist/esm/index.js',
    output: [
      { file: 'dist/plugin.cjs.js', format: 'cjs', sourcemap: true, inlineDynamicImports: true },
      { file: 'dist/plugin.js', format: 'iife', name: 'capacitorEodin',
        globals: { '@capacitor/core': 'capacitorExports', '@eodin/web/internal': 'eodinWebInternal' },
        sourcemap: true, inlineDynamicImports: true },
    ],
    external: ['@capacitor/core', '@eodin/web/internal'],  // ← 추가
    plugins: [nodeResolve()],
  };
  ```
  ```json
  // packages/capacitor/package.json
  {
    "peerDependencies": {
      "@capacitor/core": ">=5.0.0",
      "@eodin/web": "^1.0.0-beta.1"
    }
  }
  ```
  IIFE 환경에서 `@eodin/web/internal` 을 글로벌로 노출하기 어려운 점은 알지만, IIFE 는 capacitor plugin SDK 사용 패턴 (browser bundler 환경) 에서 거의 안 쓰이므로 cjs/esm 만 외부화해도 실용 충분. IIFE 는 inline 유지하되 README 에서 "IIFE entry 는 self-contained, cjs/esm 은 host 가 `@eodin/web` install 필요" 라고 documented asymmetry 명시.

  Option B (일부 수용) — 현 상태 유지하되 `dependencies` → `peerDependencies` 변경 + IIFE 만 inline 명시. `@eodin/web` install 을 host 책임으로 강제, cjs 도 external 처리.

  Option C (최소) — 현 상태 그대로 가되 `@eodin/web` 을 capacitor 가 internal vendor 로 명시 inline 하고, `dependencies` 를 `devDependencies` 로 강등 (사용자 불필요 install 방지). 단, dual-package hazard 와 보안 patch propagation 문제는 그대로.

  본 결정은 PRD §10 결정 로그에 anchor 필요 — Phase 1.1 H1 결정 (a/b/c) 과 함께 묶어서 처리.

---

## Medium Priority Findings

### M1. `clearLocalData` 의 mutator 가 storage side-effect 와 return 값을 동시 사용 — 의미 중첩

- **Severity**: 🟡 MEDIUM
- **Category**: Code Quality / Correctness
- **File**: `packages/capacitor/src/web.ts:410-430`
- **Issue**: 

  ```ts
  await this.queue.withLock(() => {
    for (const key of Object.values(STORAGE_KEYS)) {
      if (key === STORAGE_KEYS.enabled) continue;
      removeStorage(key);  // ← 이미 STORAGE_KEYS.queue 도 제거함
    }
    writeStorage(STORAGE_KEYS.deviceId, uuid());
    if (preservedEnabled !== null) {
      writeStorage(STORAGE_KEYS.enabled, preservedEnabled);
    }
    return [];  // ← withLock 이 이걸로 다시 queue 키에 [] 를 write
  });
  ```
  `EventQueue.withLock` 의 흐름:
  1. `mutator(this.read())` 호출 → `this.read()` 가 queue 키 read (mutator 가 곧 지울 키)
  2. mutator 내부에서 `removeStorage(STORAGE_KEYS.queue)` 가 실행됨
  3. mutator return `[]` 후 `this.write([])` 가 다시 queue 키에 `'[]'` 를 write

  결과: 정확하지만 의미 중첩 — queue 키가 `removeStorage` → `writeStorage('[]')` 순으로 변경. 의도는 정합하지만 (queue 빈 상태) "queue 를 위해 lock 잡고, 다른 키도 함께 wipe 하고, queue 자체는 빈 큐로 reseed" 같은 의도가 코드만 봐서는 잘 안 보인다.

  추가로 mutator 안에서 **enabled 와 deviceId 같이 큐와 무관한 키도 write/remove** — `EventQueue.withLock` 의 의미상 그 lock 은 queue 의 read-modify-write 직렬화용이지 다른 key 에 대한 보호가 아니다 (Web Locks API 는 named lock, queue 키 1개만 보호). 즉 `clearLocalData` 가 lock 의 의미를 확장 사용 중 — 다른 탭의 `setEnabled` / `identify` 호출과 race 가능.

- **Recommendation**: 

  ```ts
  private async clearLocalData(): Promise<void> {
    const preservedEnabled = readStorage(STORAGE_KEYS.enabled);
  
    // queue 만 락으로 보호 — return [] 가 queue 비우기.
    await this.queue.withLock(() => []);
  
    // 나머지 키 wipe + 식별자 reseed 는 lock 외부 (각 키는 자체 race 가
    // documented: localStorage 동기 API + multi-tab 'storage' 이벤트로 자연
    // 처리). 의도가 분명해짐.
    for (const key of Object.values(STORAGE_KEYS)) {
      if (key === STORAGE_KEYS.enabled || key === STORAGE_KEYS.queue) continue;
      removeStorage(key);
    }
    writeStorage(STORAGE_KEYS.deviceId, uuid());
    if (preservedEnabled !== null) {
      writeStorage(STORAGE_KEYS.enabled, preservedEnabled);
    }
  
    this.ensureSession();
    this.log('Cleared all local data; re-bootstrapped fresh identity');
  }
  ```

  현행 코드도 회귀 테스트 (web.test.ts:410-425) 통과는 하지만, lock 의미 확장이 의도되지 않은 거라면 명시 분리.

---

### M2. capacitor `dependencies` 가 `^1.0.0-beta.1` 인데 PRD §6.1 은 `workspace:*` 명시 — workflow drift

- **Severity**: 🟡 MEDIUM
- **Category**: Project Compliance / Documentation
- **File**: `packages/capacitor/package.json:45-47`, `docs/web-sdk/PRD.md:161-163`
- **Issue**: 

  PRD §6.1 명시: `"@eodin/web": "workspace:*"` (npm 7+ workspace protocol). 실제 코드는 `"^1.0.0-beta.1"`. 사용자 메시지에 "npm 은 `workspace:*` 미지원이라 explicit version range 사용" 이라고 적혀 있는데 — npm 7+ 부터 `workspace:*` protocol 을 지원하며, root `package.json` 의 `"engines": { "npm": ">=7" }` 도 명시되어 있다 (Phase 1.0 결정 로그 L9). 즉 **PRD 가 옳고 실제 코드가 vary** — workspace protocol 을 쓸 수 있는 환경인데 explicit version 으로 갔다.

  실용적 차이는 publish 시점에 명백:
  - `workspace:*` → npm publish 가 자동으로 actual version (1.0.0-beta.1) 로 substitute (publish artifact 의 dependency 값으로 들어감)
  - `^1.0.0-beta.1` → 그대로 publish artifact 에 들어가지만, dev 시 npm 이 symlink 로 해결하는 건 동일 (현재도 잘 작동)

  문제: **`@eodin/web` 의 다음 publish (예: `1.0.0-beta.2`) 시 capacitor 의 explicit range `^1.0.0-beta.1` 가 자동 갱신되지 않음**. workspace protocol 은 항상 현재 workspace 버전으로 substitute 되므로 drift 없음.

- **Impact**: 
  - PRD §6.1 의도 어긋남 (governance issue)
  - Phase 5 publish workflow 시 sdk-web 버전 bump 후 capacitor 의 dependency range 도 매번 수동 갱신 필요. 자동화 누락 시 capacitor 가 옛 sdk-web 을 의존하는 publish 발생 가능.

- **Recommendation**: 

  ```json
  // packages/capacitor/package.json
  "dependencies": {
    "@eodin/web": "workspace:*"
  }
  ```
  publish 시 npm 이 자동으로 `^1.0.0-beta.1` (현재 workspace 버전) 으로 치환 — PRD §6.1 의 의도. 단, **H3 결정 (peerDependencies vs dependencies vs vendor inline)** 과 묶어서 처리해야 의미가 산다. H3 가 `peerDependencies` 로 가면 본 issue 도 자동 해결 (peerDeps 는 workspace protocol 안 쓰는 게 일반적).

  대안 — PRD §6.1 을 현실에 맞춰 갱신 (explicit version 결정 로그에 추가). 이때도 sdk-web bump 시 capacitor dep range bump 자동화 필요 (CI).

  사용자 메시지의 "npm 은 `workspace:*` 미지원" 은 사실과 다름 — npm 7+ 부터 지원. 사용자의 mental model 갱신 권장 (또는 본 finding 의 근거가 다른 데 있다면 PRD anchor 필요).

---

### M3. `tsconfig.json` `moduleResolution: "bundler"` 변경 — capacitor SDK 사용자 환경 영향 검토 누락

- **Severity**: 🟡 MEDIUM
- **Category**: Build / Compatibility
- **File**: `packages/capacitor/tsconfig.json:9`
- **Issue**: 

  `moduleResolution: "node"` → `"bundler"` 는 TS 5.0+ 신기능. capacitor 의 `package.json` `devDependencies: typescript: "~5.3.0"` 로 toolchain 자체는 호환. 사용자 메시지가 "publish artifact 는 dist/ 이미 컴파일된 JS + d.ts 이므로 호스트 앱 TS 는 capacitor 의 d.ts 만 보고, 본 변경은 capacitor 빌드 시점 한정 영향" 라고 지적 — 일반론은 맞다. 단:

  1. **`dist/esm/web.d.ts` 가 `import ... from '@eodin/web/internal'` 의 type 을 그대로 노출** — 호스트 앱 TS 가 이 d.ts 를 읽을 때 `@eodin/web/internal` 의 d.ts 를 함께 resolve 해야 함. 호스트 TS 가 `moduleResolution: "node"` (TS 4.x 또는 default) 면 `exports./internal` subpath 를 인식 못 해서 type resolution 실패 가능.
  2. **TS docs** 명시: `moduleResolution: "node"` (Node 12 이전 호환) 은 `exports` field subpath 를 인식 못 함. 호스트 TS 가 `"node"` 인 환경에서는 `import { X } from '@eodin/capacitor'` 의 type 검사 시 capacitor d.ts 가 import 한 `@eodin/web/internal` 을 못 찾아 emit error 가능.

  검증 필요: capacitor 의 d.ts 가 internal type 을 실제로 외부 노출하는지.

- **Recommendation**: 

  Step 1 — verify:
  ```bash
  $ grep -l "@eodin/web/internal" packages/capacitor/dist/esm/*.d.ts
  ```
  만약 d.ts 에 `@eodin/web/internal` import 가 있으면, 호스트 TS 의 `moduleResolution` 강제. 없으면 publish 시 사용자 영향 0.

  현재 web.ts 가 import 하는 type 은 `QueuedEvent` 1개 (event-queue.ts) — `EodinAnalyticsWeb` 의 private 메서드 시그니처 (예: `requeueBatch(batch: QueuedEvent[])`) 에 등장한다면 d.ts 에도 노출됨.

  대안: `web.ts:4` 의 `type QueuedEvent` 를 capacitor 내부 type alias 로 바꾸면 d.ts 에서 internal subpath 의존 끊을 수 있음:
  ```ts
  // capacitor/src/web.ts 상단
  import { EventQueue, ... } from '@eodin/web/internal';
  // QueuedEvent 는 capacitor 의 d.ts 가 노출하지 않도록 인라인:
  type QueuedEvent = {
    event_id: string;
    event_name: string;
    // ... wire schema 와 정합 ...
  };
  ```
  단 이 경우 sdk-web 의 `QueuedEvent` 와 capacitor 의 `QueuedEvent` 가 dual definition — drift 위험. 따라서 더 깨끗한 해법은 H3 의 external + peerDependency 화 (그러면 사용자 TS 가 어차피 `@eodin/web` 을 install 해서 internal type resolution 정상).

  Step 2 — README / integration-guide 에 capacitor SDK 사용자의 호스트 tsconfig 권장값 명시 (`"moduleResolution": "bundler"` 또는 `"node16"+`).

---

### M4. `packages/sdk-web/rollup.config.mjs` — internal entry 가 root 와 별도 build 라 `nodeResolve` plugin 이 두 entry 사이에 코드 중복

- **Severity**: 🟡 MEDIUM
- **Category**: Build / Performance
- **File**: `packages/sdk-web/rollup.config.mjs`
- **Issue**: 

  현 config 는 array 로 두 별도 build:
  ```js
  export default [
    { input: 'dist/esm/index.js', output: 'dist/cjs/index.js', ... },
    { input: 'dist/esm/internal/index.js', output: 'dist/cjs/internal/index.js', ... },
  ];
  ```
  Phase 1.3 시점은 root entry 가 `EodinEvent` 만 export 라 internal 과 코드 중복 0. **Phase 3 에서 root entry 가 `EodinAnalytics` 등 stateful module 추가 시**, EodinAnalytics 가 EventQueue / fetchWithTimeout / sendBeacon 등을 import. rollup `inlineDynamicImports: true` 이므로 root cjs 와 internal cjs 양쪽에 EventQueue 코드가 중복 inline.

  사용자가 root + internal 둘 다 import 하는 시나리오 = capacitor (internal 만) + host app (root 만) 인데, host 가 양쪽 모두 import 하면 EventQueue 클래스가 cjs context 에서도 2번 evaluate. **dual-package hazard 의 한 형태가 sdk-web 패키지 내부에 발생** — Phase 1.1 H1 미해결의 부작용.

  현재 Phase 2 단독으로는 root entry 가 EodinEvent (stateless const) 만 노출이라 영향 0. 단 Phase 3 진입 시 즉시 발현.

- **Recommendation**: 

  Phase 3 진입 직전에 결정. Option A — internal 을 root 가 re-export 하지 않게 하고 (현재 그러함), 사용자가 둘을 동시 import 하지 않도록 README 명시 (capacitor 만 internal). Option B — rollup config 를 multi-input single-build 로 통합 (chunk splitting):
  ```js
  // 단일 build, output.dir + manualChunks
  export default {
    input: { 'index': 'dist/esm/index.js', 'internal/index': 'dist/esm/internal/index.js' },
    output: { dir: 'dist/cjs', format: 'cjs', sourcemap: true },
    plugins: [nodeResolve()],
  };
  ```
  EventQueue 등 공통 모듈이 자동으로 shared chunk 로 추출 — 중복 0. 단 cjs 의 chunk splitting 은 dynamic import 문제 등으로 까다로움. Phase 1.1 H1 결정 (ESM-only?) 과 묶어서 한 번에 처리 권장.

---

## Low Priority Findings

### L1. `EventQueue.withLock` 의 mutator 시그니처가 immutable 반환 — `[].slice` 의 의미상 잠재 비용

- **Severity**: 🟢 LOW
- **Category**: Performance
- **File**: `packages/sdk-web/src/internal/event-queue.ts:98-117`, `packages/capacitor/src/web.ts:233-236`
- **Issue**: 

  Pre-refactor: `mutator(queue) → queue.splice(0, MAX_BATCH_SIZE); return queue` (in-place push + splice). Post-refactor: immutable 반환 (`(current) => [...current, event]`, `(current) => { batch = current.slice(0, MAX_BATCH_SIZE); return current.slice(batch.length); }`).

  큐가 1000 max 일 때 push 1번 = `[...current, event]` 가 1001 length 새 배열 allocation (O(n)). pre-refactor 는 `queue.push` (amortized O(1)). track 호출 빈도가 높은 (예: scroll event tracking) 케이스에서 GC 압력 + CPU.

- **Impact**: 1000 events × 8 bytes/ref = ~8KB 의 새 배열 / track 호출. 모바일 web view 에서 burst event 발생 시 누적 비용. 일반 사용은 무시 가능.

- **Recommendation**: 

  EventQueue 의 mutator 시그니처를 in-place 허용으로 (return 무시):
  ```ts
  async withLock(mutator: (queue: QueuedEvent[]) => QueuedEvent[] | void): Promise<void> {
    const apply = (): void => {
      const current = this.read();
      const result = mutator(current);
      let next = result === undefined ? current : result;
      if (next.length > this.maxSize) {
        next = next.slice(next.length - this.maxSize);
      }
      this.write(next);
    };
    // ...
  }
  ```
  capacitor 사용 패턴:
  ```ts
  await this.queue.withLock((queue) => {
    queue.push(event);
    // return 생략 — in-place 변경 사용
  });
  ```
  성능 이점 + pre-refactor 패턴과 시각적 정합. 단, mutator 시그니처가 immutable + mutable 둘 다 허용이 되면서 reasoning 비용 +α. 현 immutable-only 시그니처가 type-clean 하다는 reasoning 도 있다 — 본 finding 을 적용할 가치는 burst event 빈도가 실측 발견될 때.

---

### L2. `validateEndpoint` 재export — back-compat 명시 없으면 6개월 후 누군가 제거 가능

- **Severity**: 🟢 LOW
- **Category**: Documentation
- **File**: `packages/capacitor/src/web.ts:29`
- **Issue**: 

  ```ts
  // `validateEndpoint` 는 capacitor 의 외부 import 점이기도 했으므로 재export 유지
  // (back-compat). Phase 2 어댑터화로 본체는 `@eodin/web/internal` 에 있음.
  export { validateEndpoint };
  ```
  주석 자체는 명확. 단 capacitor `index.ts` 가 `web.ts` 의 `validateEndpoint` 를 re-export 하는지가 capacitor 의 public surface 여부를 결정 — index.ts 확인 필요. 만약 index.ts 에서 안 빠져나가면 (re-export 없음), 본 export 는 `__tests__/endpoint-validator.test.ts` 한정 사용으로 의미가 좁아짐 (test-only export).

- **Recommendation**: 

  ```bash
  grep "validateEndpoint" packages/capacitor/src/index.ts
  ```
  결과:
  - re-export 있음 → public surface, JSDoc 으로 deprecated / `@eodin/web` 직접 import 권장 명시
  - 없음 → test-only export. 주석을 `// test-only re-export. 외부에서 import 하려면 @eodin/web 의 validateEndpoint 사용` 으로 명시화

---

### L3. `EventQueue` 의 `LockManagerLike` 인터페이스 — `LockManager` 정식 type 미사용

- **Severity**: 🟢 LOW
- **Category**: Type Safety
- **File**: `packages/sdk-web/src/internal/event-queue.ts:25-27`
- **Issue**: 

  ```ts
  interface LockManagerLike {
    request(name: string, callback: () => Promise<void>): Promise<void>;
  }
  ```
  TS 의 `lib: dom` 에 포함된 `LockManager` 정식 type 이 있다 (browser API). 사용 시:
  ```ts
  const nav = navigator as Navigator & { locks?: LockManager };
  ```
  pre-refactor `web.ts:629` 가 정확히 그 패턴. 본 LockManagerLike 는 의도적 축소 (signature subset) — 단, `lib: dom` 환경에서 type 중복.

- **Recommendation**: 

  ```ts
  // packages/sdk-web/src/internal/event-queue.ts
  // LockManagerLike 제거, LockManager (dom lib) 직접 사용:
  private getLockManager(): LockManager | null {
    if (typeof navigator === 'undefined') return null;
    const nav = navigator as Navigator & { locks?: LockManager };
    if (!nav.locks || typeof nav.locks.request !== 'function') return null;
    return nav.locks;
  }
  ```
  단 `request` overload signature 가 dom lib 와 정확히 정합하는지 확인 필요. 본 finding 은 type-aesthetic 차원 — 동작 영향 0.

---

## Info / Future Improvements

### F1. PRD §10 결정 로그 entry 추가 권장 — Phase 2 의 `internal subpath 도입` + `H3 dependency 정책` anchor

- **Severity**: 💡 INFO
- **File**: `docs/web-sdk/PRD.md:213-230`
- **Issue**: PRD §10 결정 로그에 Phase 2 시점의 결정이 anchor 되지 않음:
  1. `@eodin/web/internal` subpath 의 first-party-only 정책 (외부 사용자에게 SemVer 보장 안 함)
  2. capacitor 가 internal subpath 를 사용하는 패턴이 5채널 parity invariant 의 한 형태로 standardize
  3. H3 의 결정 (external vs inline vs peerDep)

- **Recommendation**: 본 review 에서 H3 결정 후 PRD entry 추가:
  ```
  | 2026-05-03 (Phase 2) | `@eodin/web/internal` subpath 신설 — first-party 만 (capacitor / 향후 @eodin/auth-web 등). 외부 사용자는 root entry 만. internal 시그니처는 SemVer minor / patch 에서도 변경 가능 |
  | 2026-05-03 (Phase 2 — H3) | capacitor 가 `@eodin/web` 을 [external + peerDependency / inline + dependency / vendor] 중 [선택안] 으로 처리 |
  ```

---

### F2. `parity-matrix-5ch.md` 갱신 권장 — internal helper 의 5채널 parity table 안에 위치

- **Severity**: 💡 INFO
- **File**: `docs/web-sdk/parity-matrix-5ch.md` (아직 미작성, Phase 3 산출 예정)
- **Issue**: Phase 2 가 capacitor ↔ sdk-web 의 internal 코드 1:1 매핑을 만들었으므로, parity matrix 작성 시:
  - EventQueue ↔ Hive (Flutter) ↔ UserDefaults (iOS) ↔ SharedPreferences (Android) ↔ localStorage (sdk-web 본체)
  - capacitor 는 sdk-web 의 EventQueue 를 그대로 사용 — 즉 5채널 중 capacitor row 는 "uses sdk-web's EventQueue" 가 명시 reference

- **Recommendation**: Phase 3 의 parity-matrix-5ch.md 작성 시 EventQueue / fetchWithTimeout / sendBeacon / uuid / validateEndpoint / STORAGE_KEYS row 모두 capacitor 셀에 "via @eodin/web/internal" footnote.

---

### F3. capacitor `__tests__` 가 4개 suite 64 tests — internal subpath 회귀 가드로 sufficient. 다만 1개 추가 권장

- **Severity**: 💡 INFO
- **File**: `packages/capacitor/src/__tests__/`
- **Issue**: 현 64 tests 가 H1 (requeue 의미 회귀) 과 H2 (quota log) 둘 다 cover 안 함:
  - H1: `web.test.ts:152-163` 가 1000 max 시나리오 미테스트
  - H2: 어떤 test 도 quota drop 시 `console.warn` 호출 검증 안 함

- **Recommendation**: H1/H2 fix 와 함께 다음 2개 회귀 가드 추가:
  ```ts
  describe('H1 regression — requeue preserves batch when queue at max', () => {
    it('does not drop the requeued batch when current queue is at maxSize', async () => {
      // 1000 events 채운 후 50개 batch flush 실패 → requeue → 큐가 950 + 50 = 1000 유지
      // (50개가 통째 trim 되지 않음을 검증)
    });
  });
  
  describe('H2 regression — quota drop is logged in debug mode', () => {
    it('warns to console when localStorage quota exhausted', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await plugin.configure({ ..., debug: true });
      // localStorage.setItem 가 QuotaExceededError throw 하도록 mock
      await plugin.track({ eventName: 'app_open' });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('quota'));
    });
  });
  ```

---

## Positive Observations 👍

1. **공개 surface 보존** — `definitions.ts` 무변경, `index.ts` 무변경, `validateEndpoint` 재export 유지. host app 측 SemVer 영향 0 — Phase 1.7 GDPR surface anchor 가 잘 지켜진 패턴 재현.

2. **테스트 무수정 정책** — capacitor `__tests__/web.test.ts` 의 64 tests 가 그대로 통과한다는 사실 자체가 어댑터화의 의미 invariance 가 거의 정확하다는 의미 (단 H1 / H2 가 누락 cover 라는 점은 finding F3 참조).

3. **`exports./internal` 의 first-party-only 정책 명시** — `internal/index.ts:1-7` 의 주석에서 "외부 사용자는 본 subpath 를 import 하지 말 것" 강제. SemVer 의 minor / patch 변경 가능성 명시 — 향후 internal API 변경의 정당화 anchor 확보.

4. **Phase 1.2 review M2 (storage 헬퍼 일관성) 정신이 sdk-web 으로 옮겨짐** — `event-queue.ts:84` 의 quota 마지막 fallback 이 `removeStorage(this.storageKey)` 를 호출, 직접 localStorage 접근 안 함. 일관성 유지.

5. **logging-audit M1 (session_end duration_seconds)** 이 capacitor 어댑터화 후에도 그대로 동작 — `web.ts:275-294` 의 endSession 로직이 internal helper 도입과 무관하게 보존. test (`web.test.ts:479-500`) 가 이 invariant 를 명시 가드.

6. **Capacitor lifecycle listener (visibilitychange / pagehide)** 와 `flushOnExit` 가 capacitor 한정 코드로 유지 — sdk-web 으로 추출하지 않음. capacitor plugin 의 host plugin lifecycle 와 web 의 page lifecycle 는 의미가 다르므로 정확한 분리.

7. **`attributionToWire` 의 capacitor 한정 유지** — 4채널의 Attribution camelCase ↔ wire snake_case 변환은 채널마다 시점이 다르고 (Flutter / iOS / Android 는 native 코드, capacitor 는 web fallback 에서) capacitor 는 setAttribution 시점에 변환. sdk-web 으로 옮길 동기 없음을 정확히 판단.

8. **`requeueBatch` 가 별도 메서드 유지** — flush 의 catch / non-ok 양쪽에서 호출되는 helper 라 inline 안 함. DRY.

---

## Action Items Checklist

### HIGH (Phase 5 publish 전 closure 권장)
- [ ] **H1**: `requeueBatch` 의 prepend → append 전환. 1000-max 회귀 테스트 추가 (F3 의 첫 케이스). `web.ts:460-463` 1줄 변경 + test 30 lines.
- [ ] **H2**: `EventQueue` 에 logger 콜백 주입 채널 추가 (sdk-web 트랙). capacitor `web.ts:130` 에서 logger 주입. `console.warn` 호출 회귀 테스트 추가 (F3 의 두 번째 케이스). sdk-web 단독 patch 필요.
- [ ] **H3**: capacitor rollup config + package.json 의 `@eodin/web` 처리 정책 결정 — external + peerDependency 권장. PRD §10 anchor.

### MEDIUM
- [ ] **M1**: `clearLocalData` 의 mutator 분리 — queue lock 의미 좁히고, 다른 키 wipe 는 lock 외부.
- [ ] **M2**: capacitor `dependencies` 를 `workspace:*` 로 (PRD §6.1 정합) 또는 PRD 갱신. H3 와 묶어서 처리.
- [ ] **M3**: `dist/esm/web.d.ts` 가 `@eodin/web/internal` type 노출하는지 검증. 노출하면 호스트 TS 영향 분석 → README 권장값 또는 internal type 인라인.
- [ ] **M4**: rollup config dual entry 의 미래 코드 중복 — Phase 3 진입 직전에 chunk-split 또는 ESM-only 결정.

### LOW / INFO
- [ ] **L1**: `EventQueue.withLock` mutator 시그니처에 in-place 옵션 추가 (burst-tracking 환경 GC 압력). 실측 후 결정.
- [ ] **L2**: `web.ts:29` 의 `validateEndpoint` 재export 가 public 인지 test-only 인지 명시.
- [ ] **L3**: `LockManagerLike` → `LockManager` (dom lib) 직접 사용.
- [ ] **F1**: PRD §10 결정 로그에 Phase 2 entry 2개 추가 (internal subpath 정책 / H3 결정).
- [ ] **F2**: Phase 3 의 parity-matrix-5ch.md 작성 시 internal helper row 마다 capacitor 셀에 footnote.
- [ ] **F3**: H1 / H2 회귀 가드 테스트 2개 추가.

---

## Grade

**Grade: B+** — Phase 2 의 어댑터화 자체는 깔끔하고 기존 64 tests 통과 = 사용자 가시 회귀 0. **단 publish artifact 의미와 의존성 정책 (H3)**, **flush 실패 시 batch 보존 (H1)**, **quota 관측성 (H2)** 3 건 모두 publish 직전에 closure 필요한 수준. M1-M4 는 코드 품질 / 문서 차원으로 본 phase 안에서 처리 가능.

회귀 위험 평가: H1 만이 사용자 가시 영향 (실패 시 batch 손실). 단 발현 조건이 "큐 1000 max + 5xx" 라는 edge — 일반 사용에서는 드물지만 attribution invariant (events 절대 손실 금지) 위반.

Phase 1.0 / 1.1 / 1.2 / 1.3 의 Grade A 기조에서 본 phase 가 한 단계 내려간 이유: capacitor 를 건드리는 첫 phase 로 publish artifact / dependency / 의미 회귀의 3축이 동시 발현했고, 그중 H3 는 Phase 1.1 H1 (dual-package hazard) 와 묶이는 미해결 architectural 결정의 가시화. **H3 결정이 Phase 1.1 H1 결정의 강제 도화선** — 본 finding 처리 시점이 web-sdk 트랙 전체의 결정 deadline 이 됨.
