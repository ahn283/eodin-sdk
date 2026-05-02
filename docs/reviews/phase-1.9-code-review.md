# Code Review: Phase 1.9 — Capacitor `web.ts` 동작화

**Date**: 2026-05-02
**Scope**:
- `libs/eodin-sdk/packages/capacitor/src/web.ts` (전면 재작성)
- `libs/eodin-sdk/packages/capacitor/src/__tests__/web.test.ts` (16 테스트 신규)
- `libs/eodin-sdk/packages/capacitor/src/__tests__/setup.ts` (신규)
- `libs/eodin-sdk/packages/capacitor/jest.config.js` (`setupFiles` 추가)
**Reference**: `apps/api/src/services/analyticsService.ts` (서버측 EventSchema/wire-format 비교)
**Commit(s)**: 작업중 (커밋 전)

## Summary

v1 의 `throw this.unavailable(...)` 일변도였던 web 구현을 fully functional 로 전환하면서 native SDK (iOS/Android/Flutter) 와 동일한 wire-format · 동일한 세션 정책 (30분 idle resume) · 동일한 offline-queue 패턴을 도입한 좋은 작업이다. 서버 측 `EventSchema` (uuid event_id/device_id, snake_case attribution, ISO timestamp) 와 정합도 정확히 맞췄고 테스트 16개로 핵심 기능을 잘 가둬뒀다. 다만 **localStorage 기반 큐의 multi-tab race condition** 과 **setInterval 만 있고 리소스 해제 API (`destroy`/`stop`) 부재** 두 가지가 PWA 운영 환경에서 잠재적 위험이며, **quota exceeded 처리** · **session_start 자동 발화로 인한 은밀한 동작** 이 사용자가 명시한 관점 1·2 에 직접 대응되는 부분이다.

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 3 |
| MEDIUM   | 5 |
| LOW      | 4 |
| NIT      | 3 |

**Overall Grade**: **B+**

(CRITICAL 없음, HIGH 3건 — multi-tab race / quota handling / unclosable timer. MEDIUM 5건은 session_resume 의도 명확화, attribution undefined 직렬화, fetch timeout, isEnabled surface 부재, navigator.sendBeacon 활용 검토. 빌드/테스트 그린, 서버 정합 정확.)

---

## Critical & High Findings

### H1. Multi-tab localStorage queue race condition (lost update)

- **Severity**: HIGH
- **Category**: Data Flow / Concurrency
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:212-215`, `:250-251`, `:267-268`, `:276-277`
- **Issue**: 큐는 `read → modify → write` 패턴인데 localStorage 는 동기 API 일 뿐 **원자성 보장이 없다**. 같은 origin 의 두 탭이 동시에 `track()` 을 호출하면:
  1. Tab A: `readQueue()` → `[e1]`
  2. Tab B: `readQueue()` → `[e1]`
  3. Tab A: push e2 → `writeQueue([e1, e2])`
  4. Tab B: push e3 → `writeQueue([e1, e3])` ← e2 lost
  - `flush()` 의 re-queue 경로 (`[...batch, ...remaining]`) 도 동일 문제 — 다른 탭이 그 사이에 추가한 이벤트를 덮어쓸 수 있다.
- **Impact**: PWA `semag.app` 사용자가 두 탭을 동시에 열어 다른 화면을 사용할 경우 분석 이벤트가 무성하게 유실된다. Phase 1.9 의 원래 목적 (web 사용자 analytics 데이터 0건 → 정상 수집) 을 부분적으로 훼손한다. 활성 PWA 사용자의 multi-tab 비율이 5–10% 라고 가정하면 이벤트 손실율이 그만큼 발생한다.
- **Current code**:
  ```typescript
  // src/web.ts:212-215
  const queue = this.readQueue();
  queue.push(event);
  if (queue.length > MAX_QUEUE_SIZE) queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  this.writeQueue(queue);
  ```
- **Recommended fix**: `BroadcastChannel` 또는 `storage` 이벤트 + `Web Locks API` 로 직렬화하거나, **enqueue 단위로 별도 키를 쓴 뒤 flush 할 때 모아서 처리** 하는 패턴이 가장 견고하다. `Web Locks` 가 가장 깔끔:
  ```typescript
  private async withQueueLock<T>(fn: () => T): Promise<T> {
    if (typeof navigator === 'undefined' || !('locks' in navigator)) {
      // Locks API 미지원 환경 (Safari < 15.4 일부, 일부 webview): best-effort fallback
      return fn();
    }
    return navigator.locks.request('eodin_event_queue', () => fn());
  }

  async track(options: TrackOptions): Promise<void> {
    // ...
    await this.withQueueLock(() => {
      const queue = this.readQueue();
      queue.push(event);
      if (queue.length > MAX_QUEUE_SIZE) queue.splice(0, queue.length - MAX_QUEUE_SIZE);
      this.writeQueue(queue);
    });
    // ...
  }
  ```
  flush 의 re-queue 경로도 같은 lock 으로 감싸야 한다. 최소한 README 또는 `open-issues.md` 에 "Phase 1.9-known-limitation: multi-tab race" 로 ticket 화 해두는 것도 즉시 가능한 완화책.

---

### H2. localStorage quota exceeded 시 graceful 처리 부재

- **Severity**: HIGH
- **Category**: Reliability / Error Handling
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:347-355`, `:373-375`
- **Issue**: `writeStorage` / `writeQueue` 가 `localStorage.setItem` 호출을 try-catch 없이 직접 한다. 브라우저 quota 초과 (Safari 5MB, Chrome 10MB) 시 `QuotaExceededError` 가 throw 되어 **`track()` 호출 자체가 실패** 한다. 사용자가 명시한 관점 2 에 대응. 큐 사이즈 limit (`MAX_QUEUE_SIZE = 1000`) 이 있긴 하지만, 한 이벤트당 size 가 크면 (e.g. 큰 properties payload) 1000 도달 전에 quota 가 먼저 터질 수 있다. 또한 quota 는 SDK 큐 외 다른 origin 자원과 **공유** 되므로, 외부 코드가 storage 를 채워두면 SDK 가 영향을 받는다.
- **Impact**: 큐가 가득 찬 디바이스에서 모든 이후 `track()` 이 silent crash. fire-and-forget 호출은 `void this.flush()` 로 unhandled rejection. configure 자체도 `setItem` 을 호출하므로 SDK 초기화 자체가 실패할 수 있다.
- **Current code**:
  ```typescript
  // src/web.ts:352-355
  private writeStorage(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  }
  ```
- **Recommended fix**: try-catch 로 quota error 를 명시적으로 처리. 큐 write 실패 시 **앞쪽 (오래된) 이벤트를 drop 하고 retry**:
  ```typescript
  private writeStorage(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      // QuotaExceededError or SecurityError (e.g. Safari private mode)
      this.log(`Storage write failed for ${key}: ${String(err)}`, true);
    }
  }

  private writeQueue(events: QueuedEvent[]): void {
    if (typeof localStorage === 'undefined') return;
    let toWrite = events;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(toWrite));
        return;
      } catch (err) {
        // Drop oldest 25% on quota errors and retry
        const dropCount = Math.max(1, Math.floor(toWrite.length * 0.25));
        toWrite = toWrite.slice(dropCount);
        this.log(`Queue write quota error, dropped ${dropCount} oldest events`, true);
      }
    }
  }
  ```
  추가로 `MAX_QUEUE_SIZE` 외에 **payload byte 기준 limit** (예: 256KB) 을 두는 것도 좋다. 한 properties 가 비정상적으로 클 때 큐 전체를 마비시키지 않도록.

---

### H3. flushTimer 가 종료 메서드 없이 무한 동작

- **Severity**: HIGH
- **Category**: Resource Management / Lifecycle
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:147`, `:167-174`
- **Issue**: `configure()` 가 `setInterval` 로 30초마다 flush 타이머를 등록하지만, **타이머를 정리하는 public API 가 없다**. 또한 `configure` 가 여러 번 호출되어도 (e.g. 앱이 재초기화하는 경우) 기존 타이머를 정리하지 않는다 — 매번 새 타이머가 추가되며 **중복 flush** 가 발생할 수 있다. `unref()` 처리는 Node 테스트 환경 teardown 에는 도움이 되지만 production browser 환경에서는 무관하고, **SPA 페이지 전환 / re-configure 시 누수**.
- **Impact**:
  1. Re-configure 시 타이머 누수 → flush 호출이 N 배로 늘어나 서버에 불필요한 RPS.
  2. PWA 가 백그라운드로 갈 때 Page Visibility API 와 연동 안 된 채로 30초 타이머가 계속 돌면 모바일 배터리 영향.
  3. 테스트가 `unref()` 에 의존해서 process 종료를 보장하지만, 일반 호출자가 lifecycle 을 통제할 수 없어 **테스트 외 환경에서 SDK instance 를 재생성하는 use case 를 막는다**.
- **Current code**:
  ```typescript
  // src/web.ts:167-174
  if (this.offlineMode && this.flushTimer === null && typeof setInterval !== 'undefined') {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, QUEUE_FLUSH_INTERVAL_MS);
    const t = this.flushTimer as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }
  ```
- **Recommended fix**: ① re-configure 시 기존 타이머 정리, ② `pagehide` / `visibilitychange` 에서 sendBeacon 으로 flush, ③ 가능하면 plugin interface 에 `destroy()` 추가:
  ```typescript
  async configure(options: AnalyticsConfigureOptions): Promise<void> {
    this.apiEndpoint = options.apiEndpoint.replace(/\/$/, '');
    // ... existing setup ...

    // Re-configure cleans up prior timer to avoid leaks/duplication
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.offlineMode && typeof setInterval !== 'undefined') {
      this.flushTimer = setInterval(() => void this.flush(), QUEUE_FLUSH_INTERVAL_MS);
      const t = this.flushTimer as { unref?: () => void };
      if (typeof t.unref === 'function') t.unref();
    }

    // Best-effort flush before page unload (sendBeacon survives navigation)
    if (typeof window !== 'undefined' && !this.unloadHandlerRegistered) {
      this.unloadHandlerRegistered = true;
      window.addEventListener('pagehide', () => this.flushBeacon());
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flushBeacon();
      });
    }
  }

  private flushBeacon(): void {
    if (!this.isConfigured() || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    const queue = this.readQueue();
    if (queue.length === 0) return;
    const batch = queue.splice(0, MAX_BATCH_SIZE);
    this.writeQueue(queue);
    const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
    // sendBeacon does not support custom headers — server must accept
    // requests where API key is provided via URL query (or another channel).
    // If that is not yet supported, keep this as a Phase 1.9.x follow-up.
    navigator.sendBeacon(`${this.apiEndpoint}/events/collect?key=${encodeURIComponent(this.apiKey!)}`, blob);
  }
  ```
  `sendBeacon` 은 `X-API-Key` 같은 custom header 를 지원하지 않으므로 서버가 query param 또는 cookie 기반 API key 를 허용해야 한다. 서버 변경이 곤란하면 최소한 ① 타이머 cleanup ② `destroy()` API 만이라도 즉시 도입.

---

## Medium Findings

### M1. session_start 가 `configure` 중 silent 발화 — 의도와 documentation 불일치

- **Severity**: MEDIUM
- **Category**: API Design / Behavior Surprise
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:162`, `:282-288`, `:334-345`
- **Issue**: `configure()` 가 내부적으로 `ensureSession()` → `startSession()` → `track('session_start')` 을 호출한다. 호출자 입장에서는 `configure` 가 이벤트를 enqueue 하는 줄 모를 수 있다. iOS/Android native SDK 도 같은 패턴이긴 하지만 (`initSession` 의 fall-through 가 `startSession` 호출), web 만 특별히 documentation 에 명시되지 않았고 unit test 에서도 이 부수효과를 명시적으로 검증하지 않는다. 더 큰 문제는 `startSession()` 이 `track()` 을 부르는데 `track()` 은 **`isConfigured()` 가 true 여야 enqueue 한다** — `configure` 의 코드 순서상 `apiEndpoint`/`apiKey`/`appId` 가 먼저 set 된 뒤 `ensureSession` 이 호출되므로 다행히 동작은 하지만, **순서 의존성이 미묘** 하다. Refactor 로 구조 바뀔 때 회귀 위험.
- **Impact**: 사용자가 `await EodinAnalytics.configure({...})` 호출 직후 `getStatus()` 를 보면 `queueSize >= 1` 인 이유를 모를 수 있다. setAttribution 을 configure 후에 호출하면 첫 session_start 에는 attribution 이 빠진다 (이건 native SDK 도 같으므로 정합성은 OK 지만 documentation 가치 있음).
- **Current code**:
  ```typescript
  // src/web.ts:162
  this.ensureSession();  // implicit track('session_start')
  ```
- **Recommended fix**: ① 코드 주석으로 의도 명시, ② `configure` 가 발화하는 자동 이벤트를 doc-comment 로 노출, ③ test 에 명시적 assertion 추가:
  ```typescript
  // configure 에서:
  // Resume valid session within 30-min window, otherwise auto-fire session_start.
  // (Matches iOS/Android native behavior for cross-platform consistency.)
  this.ensureSession();
  ```
  그리고 `web.test.ts` 에:
  ```typescript
  it('configure auto-fires session_start when no valid session exists', async () => {
    await plugin.configure({ apiEndpoint: '...', apiKey: 'k', appId: 'a' });
    await plugin.flush();
    const events = JSON.parse(fetchMock.mock.calls[0][1].body).events;
    expect(events.some((e: any) => e.event_name === 'session_start')).toBe(true);
  });
  ```

---

### M2. `attribution` 직렬화에 `undefined` 값 포함 → JSON 에서 누락되어 OK 지만 wire-format 노이즈

- **Severity**: MEDIUM
- **Category**: Wire Format / Data Quality
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:106-122`, `:234-240`
- **Issue**: `attributionToWire()` 는 모든 11개 키를 항상 포함한 객체를 반환한다 (`undefined` 포함). `JSON.stringify` 가 `undefined` value 를 자동으로 drop 하므로 wire 에서는 정상이지만:
  1. localStorage 에 직렬화하여 다시 읽을 때, 한 번 stringify 되어 키가 사라진 객체가 저장된다 — 이건 의도된 결과일 수 있다.
  2. 그런데 `event.attribution = JSON.parse(attrJson)` 로 다시 읽어서 event 객체에 통째로 박는데, 모든 키가 모두 `undefined` 일 경우 (즉 `setAttribution({})` 같은 케이스) `JSON.stringify` 한 결과가 `"{}"` 이 되고, event.attribution = `{}` 로 wire 에 빈 객체가 들어간다. 서버 zod 는 optional 이라 통과하지만 **노이즈**.
  3. 더 큰 문제: `Attribution.source` 에 undefined 가 들어가면 wire 에서는 빠지는데, 서버 `AttributionSchema.source` 는 `z.enum(['meta', ...])` 라 **잘못된 값을 거부** 한다. e.g. 호출자가 `setAttribution({ source: 'manual' })` 같이 enum 외 값을 보내면 서버가 collect 단에서 reject — 그런데 현재 SDK 쪽에선 `source?: string` (free string) 으로 정의되어 있어 컴파일 타임에 잡히지 않는다.
- **Impact**: ② 노이즈는 minor. ③ 클라이언트가 enum 외 source 값을 쓸 때 디버깅 난해 (서버 400 만 보고 원인 파악 어려움). 또 `AttributionSchema` 는 `click_id_type` 도 enum 인데 SDK 쪽은 free string.
- **Current code**:
  ```typescript
  // src/web.ts:106-122
  function attributionToWire(attr: Attribution): Record<string, string | undefined> {
    return {
      source: attr.source,
      // ... all 11 keys, including undefined ones
    };
  }
  ```
- **Recommended fix**: ① undefined 키 제거, ② SDK Attribution 타입을 서버 enum 과 정확히 맞추거나 최소한 README 에 valid value 명시:
  ```typescript
  function attributionToWire(attr: Attribution): Record<string, string> {
    const out: Record<string, string> = {};
    if (attr.source !== undefined) out.source = attr.source;
    if (attr.campaignId !== undefined) out.campaign_id = attr.campaignId;
    if (attr.adsetId !== undefined) out.adset_id = attr.adsetId;
    if (attr.adId !== undefined) out.ad_id = attr.adId;
    if (attr.clickId !== undefined) out.click_id = attr.clickId;
    if (attr.clickIdType !== undefined) out.click_id_type = attr.clickIdType;
    if (attr.utmSource !== undefined) out.utm_source = attr.utmSource;
    if (attr.utmMedium !== undefined) out.utm_medium = attr.utmMedium;
    if (attr.utmCampaign !== undefined) out.utm_campaign = attr.utmCampaign;
    if (attr.utmContent !== undefined) out.utm_content = attr.utmContent;
    if (attr.utmTerm !== undefined) out.utm_term = attr.utmTerm;
    return out;
  }
  ```
  그리고 `definitions.ts` 의 `Attribution.source` / `clickIdType` 은 서버 enum 과 정렬:
  ```typescript
  source?: 'meta' | 'google' | 'tiktok' | 'linkedin' | 'organic';
  clickIdType?: 'fbclid' | 'gclid' | 'ttclid' | 'li_fat_id';
  ```
  (이건 SDK 의 cross-platform definitions 변경이라 별도 ticket 으로 관리해도 됨.)

---

### M3. fetch timeout 부재 — flush 가 영원히 hang 가능

- **Severity**: MEDIUM
- **Category**: Reliability / Performance
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:254-262`
- **Issue**: `fetch(...)` 호출에 `signal: AbortController` timeout 이 없다. 서버가 응답을 보내지 않으면 (e.g. 네트워크가 부분적으로 죽거나 proxy 가 hang) flush promise 가 영영 안 끝나고, 30초 setInterval 이 다음 flush 를 또 시도하면서 큐 처리가 막힌다.
- **Impact**: 약한 네트워크 환경 (모바일 셀룰러) 에서 flush pile-up. queue 쌓이면서 `MAX_QUEUE_SIZE = 1000` 도달 시 oldest event drop. 최악의 경우 사용자 세션 끝날 때까지 모든 이벤트 손실.
- **Recommended fix**:
  ```typescript
  async flush(): Promise<void> {
    if (!this.isConfigured()) return;
    // ... existing batch extraction ...

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${this.apiEndpoint}/events/collect`, {
        method: 'POST',
        signal: controller.signal,
        // ... rest
      });
      // ... existing handling
    } catch (error) {
      // Treat aborts and network errors uniformly — re-queue
      const remaining = this.readQueue();
      this.writeQueue([...batch, ...remaining]);
      this.log(`Flush error: ${String(error)}`, true);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  ```

---

### M4. setEnabled / requestDataDeletion surface 미구현 (정책상 GDPR opt-out 결정 필요)

- **Severity**: MEDIUM
- **Category**: Compliance / API Surface
- **File**: `libs/eodin-sdk/packages/capacitor/src/definitions.ts:23-35`, `web.ts:328-332`
- **Issue**: `isEnabled()` 라는 private helper 와 `STORAGE_KEYS.enabled` 키는 이미 web.ts 에 존재하지만, **public API 가 없다**. 즉 호출자가 `enabled = 'false'` 로 설정할 방법이 없다. 사용자가 명시한 관점 4 의 결정 ("Phase 1.9 범위 밖, open-issues §4.5 ticket") 자체는 합리적이지만, `private isEnabled()` 코드는 dead-code 에 가깝다 — 활성화될 trigger 가 없으므로 항상 default-true.
- **Impact**: 현재 web 사용자는 GDPR opt-out 을 SDK 레벨에서 할 수 없다. kidstopia 의 PWA 가 EU 사용자를 받으면 cookie banner 결과를 SDK 에 반영할 surface 가 없어 외부 (호스트 앱) 가 직접 `localStorage.setItem('eodin_enabled', 'false')` 같은 더러운 방식을 쓸 수밖에 없다.
- **Recommended fix**: ① 즉시: dead-code (`isEnabled` 를 일단 제거하거나 유지하는 이유를 주석으로 명시) — 코드 깔끔성 위함. ② 단기: `open-issues.md §4.5` 에 ticket 추가 + 마감일 명시. ③ 중기: definitions 에 `setEnabled(enabled: boolean)` 와 `requestDataDeletion()` 추가:
  ```typescript
  // definitions.ts
  export interface EodinAnalyticsPlugin {
    // ... existing
    setEnabled(options: { enabled: boolean }): Promise<void>;
    requestDataDeletion(): Promise<void>;
  }
  ```
  ```typescript
  // web.ts
  async setEnabled(options: { enabled: boolean }): Promise<void> {
    this.writeStorage(STORAGE_KEYS.enabled, String(options.enabled));
    if (!options.enabled) this.writeQueue([]);  // drop pending events
    this.log(`Tracking ${options.enabled ? 'enabled' : 'disabled'}`);
  }

  async requestDataDeletion(): Promise<void> {
    // Web-side: clear all storage and queue. Server-side deletion uses
    // DELETE /events/user-data with the userId — caller responsibility.
    this.writeQueue([]);
    Object.values(STORAGE_KEYS).forEach((k) => this.removeStorage(k));
    this.log('Cleared all local analytics state');
  }
  ```
  최소한 dead-code 정리하고 ticket 만 만들어두는 게 Phase 1.9 정책에 부합.

---

### M5. session UUID 형식 검증 없음 — 서버 `session_id: z.string().uuid().optional().nullable()` 와 충돌 가능

- **Severity**: MEDIUM
- **Category**: Wire Format / Validation
- **File**: `libs/eodin-sdk/packages/capacitor/src/web.ts:282-288`, `:198`
- **Issue**: `startSession()` 은 `uuid()` 로 session_id 를 생성해서 OK. 하지만 `track()` 의 `session_id: this.readStorage(STORAGE_KEYS.sessionId)` 는 **이전 버전이 저장한 값을 그대로 읽는다**. 만약 이전 SDK 버전이 ULID 또는 timestamp 기반 ID 를 저장했다면, 새 v2 SDK 가 그 값을 그대로 wire 에 보내고 서버가 zod uuid validation 으로 거부 → 전체 batch fail. 현재는 v1 → v2 마이그레이션 path 가 신규이므로 실제 위험은 낮지만, 향후 session_id 포맷 변경 시 재발 가능.
- **Impact**: 회귀 위험. 한 번 깨진 session_id 가 localStorage 에 남으면 그 디바이스의 모든 이벤트가 30분간 (또는 사용자가 클리어할 때까지) 서버에서 reject.
- **Recommended fix**: `ensureSession` 에서 stored session_id 가 uuid 패턴인지 검증, 아니면 폐기:
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private ensureSession(): void {
    const sessionId = this.readStorage(STORAGE_KEYS.sessionId);
    const sessionStart = this.readStorage(STORAGE_KEYS.sessionStart);
    if (sessionId !== null && sessionStart !== null && UUID_RE.test(sessionId)) {
      const elapsed = Date.now() - Number(sessionStart);
      if (elapsed < SESSION_TIMEOUT_MS) {
        this.log(`Resumed session: ${sessionId}`);
        return;
      }
    }
    void this.startSession();
  }
  ```
  device_id 도 동일 검증 필요 (`configure` 에서 stored deviceId 가 uuid 가 아니면 새로 발급).

---

## Low Findings

### L1. `(globalThis as any).fetch` 등 test setup 의 `any` cast 분산

- **Severity**: LOW
- **Category**: Type Safety / Test Quality
- **File**: `web.test.ts:60`, `:64`, `setup.ts:35`, `:41`
- **Issue**: `(globalThis as any).fetch` 가 여러 곳에 흩어져 있다. helper 로 추출하면 깔끔.
- **Recommended fix**: `setup.ts` 에 typed helper:
  ```typescript
  declare global {
    var localStorage: Storage;
    var navigator: { onLine: boolean };
  }
  // ...
  ```
  또는 `web.test.ts` 에 mockFetch helper:
  ```typescript
  function installFetchMock(impl: jest.Mock): void {
    Object.defineProperty(globalThis, 'fetch', {
      value: impl, writable: true, configurable: true,
    });
  }
  ```

---

### L2. `setInterval` 기반 auto-flush 가 unit test 에서 검증 안 됨

- **Severity**: LOW
- **Category**: Test Coverage
- **File**: `web.test.ts` 전반
- **Issue**: 사용자가 명시한 관점 7. `jest.useFakeTimers()` + `jest.advanceTimersByTime(QUEUE_FLUSH_INTERVAL_MS)` 패턴이면 시간 의존성 없이 검증 가능. 현재 timer 가 진짜로 동작하는지를 보증하지 못해 회귀 시 발견 어려움.
- **Recommended fix**:
  ```typescript
  it('auto-flushes after QUEUE_FLUSH_INTERVAL_MS', async () => {
    jest.useFakeTimers();
    const plugin = new EodinAnalyticsWeb();
    await plugin.configure({ apiEndpoint: '...', apiKey: 'k', appId: 'a' });
    await plugin.track({ eventName: 'app_open' });
    jest.advanceTimersByTime(30_000);
    await Promise.resolve(); // let microtasks settle
    expect(fetchMock).toHaveBeenCalled();
    jest.useRealTimers();
  });
  ```
  의도적으로 생략한 것이 합리적이긴 하지만 (시간 의존 fragile), `useFakeTimers` 는 그 fragility 를 제거하므로 추가 가치 있음.

---

### L3. `getStatus().attStatus` 가 항상 `'unknown'` hardcoded

- **Severity**: LOW
- **Category**: Code Quality / Consistency
- **File**: `web.ts:316`
- **Issue**: `getATTStatus()` 도 unknown 을 반환하지만 별개 함수로 hardcoded. 일관성을 위해 `getATTStatus()` 결과를 `getStatus()` 에서 재사용:
  ```typescript
  async getStatus(): Promise<AnalyticsStatus> {
    const att = await this.getATTStatus();
    return {
      // ...
      attStatus: att.status,
    };
  }
  ```

---

### L4. `endSession` 이 `track('session_end')` 을 호출한 뒤 sessionId 를 지우지만, **session_end 의 session_id 가 이미 지워질 수도 있다**

- **Severity**: LOW
- **Category**: Logical Ordering
- **File**: `web.ts:290-296`
- **Issue**: 현재 코드는 `await this.track(...)` 으로 enqueue 가 끝난 뒤 removeStorage 하므로 안전하다 — 하지만 `track()` 내부가 `readStorage(STORAGE_KEYS.sessionId)` 를 동기적으로 읽으므로, await 에 의해 동기 readStorage 가 enqueue 직전에 실행되어 OK. 다만 `track()` 의 흐름이 변경되어 readStorage 가 microtask 이후로 미뤄지면 회귀 가능. 방어적으로 session_end 발화 시 명시적으로 session_id 를 capture 해서 전달하는 게 안전.
- **Recommended fix**: 현재 `TrackOptions` 에 sessionId override 가 없으므로 즉시 fix 는 어렵다. 주석으로 의도 명시 정도가 합리:
  ```typescript
  async endSession(): Promise<void> {
    if (this.readStorage(STORAGE_KEYS.sessionId) !== null) {
      // session_id 는 track() 내부에서 동기적으로 readStorage 되므로
      // 이 await 가 끝나는 시점에 이미 큐에 enqueue 되어 있다.
      await this.track({ eventName: 'session_end' });
    }
    this.removeStorage(STORAGE_KEYS.sessionId);
    this.removeStorage(STORAGE_KEYS.sessionStart);
  }
  ```

---

## NIT Findings

### N1. 매직 상수가 파일 상단에 있지만 export 안 됨

- **Severity**: NIT
- **File**: `web.ts:65-69`
- **Issue**: `SESSION_TIMEOUT_MS`, `QUEUE_FLUSH_INTERVAL_MS` 등이 모듈 private. 테스트에서 시간 의존 검증을 하려면 hardcoded 30000 을 다시 써야 한다.
- **Recommended fix**: `export const SESSION_TIMEOUT_MS = ...` 로 빼거나 별도 `constants.ts` 분리.

### N2. `log()` 의 prefix `[EodinAnalyticsWeb]` 가 `console.log`/`console.warn` 호출마다 반복

- **Severity**: NIT
- **File**: `web.ts:377-386`
- **Issue**: prefix 만 다른 두 분기. 한 줄로 줄일 수 있음:
  ```typescript
  private log(message: string, isError = false): void {
    if (!this.debug) return;
    const fn = isError ? console.warn : console.log;
    // eslint-disable-next-line no-console
    fn(`[EodinAnalyticsWeb] ${message}`);
  }
  ```

### N3. 테스트에서 `(await plugin.getStatus()).queueSize` 패턴이 반복 — helper 로 추출 가능

- **Severity**: NIT
- **File**: `web.test.ts` 전반
- **Issue**: 가독성 개선:
  ```typescript
  const queueSize = async () => (await plugin.getStatus()).queueSize;
  ```

---

## Data Flow 검증 (cross-service)

사용자가 명시한 관점 1·9 에 대한 검증.

### Wire-format 정합 — PASS

`web.ts` 의 `QueuedEvent` 가 서버 `EventSchema` 와 1:1 매핑:

| Field | SDK | Server (`analyticsService.ts:35-46`) |
|---|---|---|
| `event_id` | `uuid()` (v4) | `z.string().uuid()` ✓ |
| `event_name` | `options.eventName` (free string) | `z.string().min(1).max(100)` ✓ |
| `app_id` | configure 의 appId | `z.string().min(1).max(50)` ✓ |
| `device_id` | localStorage `eodin_device_id` (uuid) | `z.string().uuid()` ✓ |
| `user_id` | nullable | `optional().nullable()` ✓ |
| `session_id` | nullable | `optional().nullable()` (uuid 검증, M5 참조) |
| `timestamp` | `new Date().toISOString()` | `z.string().datetime()` ✓ |
| `attribution.*` | snake_case (utmSource → utm_source) | `AttributionSchema` snake_case ✓ |
| `properties` | passthrough | `z.record(z.unknown()).optional()` ✓ |

`device` 객체 (os/os_version/model 등) 는 web 에서 미전송 — server schema 에서 optional 이므로 OK. ATT idfa 는 web 무관.

### Endpoint 정합 — PASS

- 코드: `${apiEndpoint}/events/collect` (`web.ts:254`)
- 라우트: `apps/api/src/routes/analytics.ts:18` `router.post('/collect', apiKeyAuth, analyticsRateLimiter, ...)`
- CHECKLIST §1.9 표기 (`/events/track`) 가 오타. 실제 코드는 정확하므로 별도 doc 수정 ticket 만 있으면 됨.

### Auth 정합 — PASS

- 코드: `headers: { 'X-API-Key': this.apiKey }` (`web.ts:259`)
- 미들웨어: `apiKeyAuth` 가 `req.headers['x-api-key']` 검사 → cache → permission check (`apiKeyAuth.ts:34-43`)
- API key 가 `appId` 에 묶여있어 cross-app 이벤트 전송이 서버에서 거부됨 (`analyticsService.ts:341-348`) — **추가 보안 layer 정상 동작**

### CORS 검토 — PASS (조건부)

- `apps/api/src/index.ts:54-58` CORS `origin` 만 명시, `allowedHeaders` 미명시. `cors` package 기본동작상 preflight 시 request 의 `Access-Control-Request-Headers` 를 echo back 하므로 `X-API-Key` 가 통과. 명시적으로 `allowedHeaders: ['Content-Type', 'X-API-Key']` 를 추가하면 더 안전 (다만 이건 web.ts 변경범위 밖이므로 별도 ticket).

---

## Positive Observations

1. **Native SDK 와의 정합성**: 30분 idle session resume, session_resume 미발화 (iOS `initSession`/Android `initSession` 동일 패턴), uuid v4 device_id, snake_case attribution wire-format — cross-platform consistency 가 단단하게 유지됨.
2. **No-throw 정책**: ATT 메서드, deeplink 메서드 모두 `unavailable()` 대신 graceful default (`{status: 'unknown'}`, `{hasParams: false}`) 반환 — cross-platform 코드 simplification 가치 큼. 사용자 지적사항 6 에 대한 대응 정확.
3. **`crypto.randomUUID` fallback**: edge-case test env 를 위한 fallback (`web.ts:90-99`) 이 RFC4122 v4 spec 정확. `bytes[6]/bytes[8]` 비트 마스킹 정확.
4. **테스트 커버리지**: 16 tests 가 핵심 시나리오 (트림된 endpoint, 큐 persistence, X-API-Key 헤더, attribution snake_case 변환, 503/network failure re-queue, identity 흐름, session 흐름, ATT no-throw) 를 잘 커버. setup.ts 의 `MemoryStorage` impl 도 깔끔.
5. **`unref()` 처리**: 테스트 hang 방지를 위한 `setInterval` unref — 작은 디테일이지만 CI/jest teardown 에서 의미 있음. `t.unref` 가 browser 에서 undefined 인 경우도 안전 처리.
6. **MAX_QUEUE_SIZE 와 MAX_BATCH_SIZE**: 메모리 폭주 방지. batch 50 이 서버 `CollectEventsSchema.max(100)` 보다 작아서 server-side limit 도달 안 함 — 좋다.
7. **재큐잉 시 batch 가 앞으로**: `[...batch, ...remaining]` 으로 ordering 보존 — 단일 탭 시나리오에서는 정확 (multi-tab 은 H1 참조).
8. **deviceId persistence test**: `plugin2 = new EodinAnalyticsWeb()` 로 리로드 시뮬레이션 후 deviceId 가 보존되는지 검증 (`web.test.ts:80-87`) — 좋은 테스트.
9. **JSDoc**: 클래스 docstring 에 GDPR / ATT 정책 명시 — 호출자에게 expectations 전달 잘 됨.
10. **Endpoint trim**: `apiEndpoint.replace(/\/$/, '')` 로 trailing slash 정리 — 가벼운 robustness.

---

## Action Items

### 즉시 (HIGH)
- [ ] **H1**: localStorage queue 에 Web Locks API (또는 BroadcastChannel polyfill) 적용 — multi-tab race condition 차단
- [ ] **H2**: `writeStorage` / `writeQueue` 에 quota error try-catch + oldest-drop retry
- [ ] **H3**: `configure` 에 timer cleanup 로직 추가 + `pagehide`/`visibilitychange` 시 sendBeacon flush

### 단기 (MEDIUM)
- [ ] **M1**: configure 가 자동 발화하는 이벤트를 doc-comment 에 명시 + 테스트로 잠금
- [ ] **M2**: `attributionToWire` 에서 undefined 키 제거 + `Attribution` 타입을 서버 enum 과 정렬
- [ ] **M3**: `flush` 에 AbortController timeout (10초) 추가
- [ ] **M4**: dead-code `isEnabled` 처리 결정 — 즉시 `setEnabled` 추가하거나 ticket 화하고 주석 보강
- [ ] **M5**: `ensureSession` 에 stored session_id uuid 패턴 검증 추가 (device_id 도)

### 중기 (LOW / NIT)
- [ ] **L1**: test setup 의 `any` cast 정리 (typed helper)
- [ ] **L2**: `jest.useFakeTimers` 로 auto-flush 시간 검증 테스트 추가
- [ ] **L3**: `getStatus().attStatus` 를 `getATTStatus()` 결과 재사용
- [ ] **L4**: `endSession` 의 ordering 의도 주석 명시
- [ ] **N1/N2/N3**: 매직 상수 export, log helper 한 줄, queueSize helper

### 별도 ticket (out of scope)
- [ ] CHECKLIST §1.9 의 `/events/track` → `/events/collect` 표기 수정
- [ ] CORS 에 `allowedHeaders: ['Content-Type', 'X-API-Key']` 명시
- [ ] sendBeacon 사용 시 서버가 query-param API key 를 허용할지 결정 (security review)
