// EodinAnalytics — 5번째 채널 (web) 의 public surface. 4채널 mobile SDK 와
// 의미 parity. 모든 메서드는 static, state 는 globalThis 에 pin (dual-package
// hazard 차단 — Phase 1.1 review H1, Phase 3 결정).
//
// surface (PRD §5):
// - configure / track / identify / clearIdentity / setAttribution
// - flush / startSession / endSession
// - deviceId / userId / sessionId / attribution / isEnabled (property getters)
// - getStatus() (aggregate, async)
// - setEnabled / requestDataDeletion (GDPR — Phase 1.7 4채널 parity)
//
// 의도적 비대칭 (PRD §5.1):
// - ATT 메서드 (`requestTrackingAuthorization` / `getATTStatus`) 미노출
// - autoTrackPageView 옵션은 web 고유

import {
  type QueuedEvent,
  STORAGE_KEYS,
  fetchWithTimeout,
  readStorage,
  removeStorage,
  sendBeacon,
  uuid,
  validateEndpoint,
  writeStorage,
} from '../internal';

import { EodinEvent, type EodinEventName } from '../eodin-event';
import {
  attachPageViewTracker,
  detachPageViewTracker,
} from './page-view-tracker';
import {
  applyConfigureOptions,
  getQueue,
  getState,
  isConfigured,
} from './state';
import {
  type AnalyticsConfigureOptions,
  type AnalyticsStatus,
  type Attribution,
  attributionFromWire,
  attributionToWire,
} from './types';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const QUEUE_FLUSH_THRESHOLD = 20;
const QUEUE_FLUSH_INTERVAL_MS = 30 * 1000;
const MAX_QUEUE_SIZE = 1000;
const MAX_BATCH_SIZE = 50;
const FETCH_TIMEOUT_MS = 10 * 1000;

function log(message: string, isError = false): void {
  const state = getState();
  if (!state.debug) return;
  const prefix = '[EodinAnalytics]';
  if (isError) {
    // eslint-disable-next-line no-console
    console.warn(`${prefix} ${message}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${message}`);
  }
}

// Phase 3 review H1: queue 도 globalThis state 에 pin (`getQueue`). dual-
// package 시 module instance 분리 차단.
function queue() {
  return getQueue((msg) => log(msg, true));
}

function isEnabledSync(): boolean {
  const value = readStorage(STORAGE_KEYS.enabled);
  if (value === null) return true;
  return value === 'true';
}

function ensureSession(): void {
  const sessionId = readStorage(STORAGE_KEYS.sessionId);
  const sessionStart = readStorage(STORAGE_KEYS.sessionStart);
  if (sessionId !== null && sessionStart !== null) {
    const elapsed = Date.now() - Number(sessionStart);
    if (elapsed < SESSION_TIMEOUT_MS) {
      log(`Resumed session: ${sessionId}`);
      return;
    }
  }
  void EodinAnalytics.startSession();
}

function attachLifecycleListeners(): void {
  const state = getState();
  if (state.lifecycleAttached) return;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  state.lifecycleAttached = true;

  const onPageHide = () => flushOnExit();
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushOnExit();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
}

function flushOnExit(): void {
  const state = getState();
  if (!isConfigured(state)) return;
  const current = queue().read();
  if (current.length === 0) return;
  const batch = current.slice(0, MAX_BATCH_SIZE);
  const remaining = current.slice(batch.length);
  const ok = sendBeacon(`${state.apiEndpoint}/events/collect`, {
    events: batch,
    api_key: state.apiKey,
  });
  if (ok) {
    queue().write(remaining);
    log(`flushOnExit beaconed ${batch.length} events`);
  }
}

async function requeueBatch(batch: QueuedEvent[]): Promise<void> {
  if (batch.length === 0) return;
  // prepend (오래된 events 먼저 retry). EventQueue.withLock 의 universal trim
  // 은 제거된 상태 (Phase 2 review H1) — track 호출 시 자연 trim.
  await queue().withLock((current) => [...batch, ...current]);
}

/**
 * Eodin Analytics SDK — Web channel.
 *
 * @example
 * ```ts
 * import { EodinAnalytics, EodinEvent } from '@eodin/web';
 *
 * await EodinAnalytics.configure({
 *   apiEndpoint: 'https://api.eodin.app/api/v1',
 *   apiKey: '<your-api-key>',
 *   appId: 'your-app-id',
 * });
 * EodinAnalytics.track(EodinEvent.PageView, { path: '/pricing' });
 * ```
 */
export class EodinAnalytics {
  static async configure(options: AnalyticsConfigureOptions): Promise<void> {
    validateEndpoint(options.apiEndpoint);
    const state = getState();
    applyConfigureOptions(state, options);

    if (readStorage(STORAGE_KEYS.deviceId) === null) {
      writeStorage(STORAGE_KEYS.deviceId, uuid());
    }

    // C1 (Phase 3 review): cold-reload 후에도 `EodinAnalytics.attribution`
    // getter 가 마지막 setAttribution 값을 반환하도록 in-memory hydrate.
    const attrJson = readStorage(STORAGE_KEYS.attribution);
    if (attrJson !== null) {
      try {
        const wire = JSON.parse(attrJson) as Record<string, string | undefined>;
        state.attributionInMemory = attributionFromWire(wire);
      } catch {
        // corrupted — drop silently
      }
    }

    ensureSession();

    if (
      state.offlineMode &&
      state.flushTimer === null &&
      typeof setInterval !== 'undefined'
    ) {
      state.flushTimer = setInterval(() => {
        void EodinAnalytics.flush();
      }, QUEUE_FLUSH_INTERVAL_MS);
      const t = state.flushTimer as { unref?: () => void };
      if (typeof t.unref === 'function') t.unref();
    }

    attachLifecycleListeners();

    if (state.autoTrackPageView) {
      attachPageViewTracker((path, title) => {
        EodinAnalytics.track(EodinEvent.PageView, { path, ...(title ? { title } : {}) });
      });
    }

    log(
      `Configured endpoint=${state.apiEndpoint} appId=${state.appId} ` +
        `offlineMode=${state.offlineMode} autoTrackPageView=${state.autoTrackPageView}`,
    );
  }

  /**
   * H2 (Phase 3 review): Promise<void> 반환 — 4채널 SDK (Flutter `Future<void>`,
   * iOS callback, Capacitor `Promise<void>`) 와 awaitable parity. 호출자는
   * `await EodinAnalytics.track(...)` 또는 fire-and-forget 모두 가능.
   */
  static async track(
    eventName: EodinEventName | string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    const state = getState();
    if (!isConfigured(state)) {
      log('SDK not configured. Call configure() first.', true);
      return;
    }
    if (!isEnabledSync()) {
      log(`Tracking disabled (GDPR). Skipping ${eventName}`);
      return;
    }

    const event: QueuedEvent = {
      event_id: uuid(),
      event_name: eventName,
      app_id: state.appId!,
      device_id: readStorage(STORAGE_KEYS.deviceId)!,
      user_id: readStorage(STORAGE_KEYS.userId),
      session_id: readStorage(STORAGE_KEYS.sessionId),
      timestamp: new Date().toISOString(),
      properties,
    };

    const attrJson = readStorage(STORAGE_KEYS.attribution);
    if (attrJson) {
      try {
        event.attribution = JSON.parse(attrJson) as Record<
          string,
          string | undefined
        >;
      } catch {
        // corrupted attribution → silent drop
      }
    }

    // track 경로에서 명시 trim — withLock 의 auto-trim 제거 후 (Phase 2 H1).
    await queue().withLock((current) => {
      const next = [...current, event];
      return next.length > MAX_QUEUE_SIZE
        ? next.slice(next.length - MAX_QUEUE_SIZE)
        : next;
    });
    const queueSize = queue().size();
    log(`Enqueued ${eventName} (queue=${queueSize})`);
    if (queueSize >= QUEUE_FLUSH_THRESHOLD) {
      void EodinAnalytics.flush();
    }
  }

  static identify(userId: string): void {
    writeStorage(STORAGE_KEYS.userId, userId);
    log(`Identified user: ${userId}`);
  }

  static clearIdentity(): void {
    removeStorage(STORAGE_KEYS.userId);
    log('Cleared user identity');
  }

  static setAttribution(attribution: Attribution): void {
    const state = getState();
    state.attributionInMemory = attribution;
    writeStorage(
      STORAGE_KEYS.attribution,
      JSON.stringify(attributionToWire(attribution)),
    );
    log('Set attribution');
  }

  static async flush(): Promise<void> {
    const state = getState();
    if (!isConfigured(state)) return;

    let batch: QueuedEvent[] = [];
    await queue().withLock((current) => {
      batch = current.slice(0, MAX_BATCH_SIZE);
      return current.slice(batch.length);
    });
    if (batch.length === 0) return;

    try {
      const response = await fetchWithTimeout(
        `${state.apiEndpoint}/events/collect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-Key': state.apiKey!,
          },
          body: JSON.stringify({ events: batch }),
        },
        FETCH_TIMEOUT_MS,
      );
      if (!response.ok) {
        await requeueBatch(batch);
        log(`Flush failed: HTTP ${response.status}`, true);
        return;
      }
      log(`Flushed ${batch.length} events`);
    } catch (error) {
      await requeueBatch(batch);
      log(`Flush error: ${String(error)}`, true);
    }
  }

  static async startSession(): Promise<void> {
    const sessionId = uuid();
    writeStorage(STORAGE_KEYS.sessionId, sessionId);
    writeStorage(STORAGE_KEYS.sessionStart, String(Date.now()));
    log(`Started session: ${sessionId}`);
    EodinAnalytics.track(EodinEvent.SessionStart);
  }

  static async endSession(): Promise<void> {
    if (readStorage(STORAGE_KEYS.sessionId) !== null) {
      const startRaw = readStorage(STORAGE_KEYS.sessionStart);
      const properties: Record<string, unknown> = {};
      if (startRaw !== null) {
        const elapsed = Date.now() - Number(startRaw);
        if (Number.isFinite(elapsed) && elapsed >= 0) {
          properties.duration_seconds = Math.round(elapsed / 1000);
        }
      }
      EodinAnalytics.track(
        EodinEvent.SessionEnd,
        Object.keys(properties).length > 0 ? properties : undefined,
      );
    }
    removeStorage(STORAGE_KEYS.sessionId);
    removeStorage(STORAGE_KEYS.sessionStart);
  }

  // -- Status getters (M6: TS property style — Flutter / iOS 와 시각적 정합) ---

  static get deviceId(): string | null {
    return readStorage(STORAGE_KEYS.deviceId);
  }

  static get userId(): string | null {
    return readStorage(STORAGE_KEYS.userId);
  }

  static get sessionId(): string | null {
    return readStorage(STORAGE_KEYS.sessionId);
  }

  static get attribution(): Attribution | null {
    return getState().attributionInMemory;
  }

  static get isEnabled(): boolean {
    return isEnabledSync();
  }

  static async getStatus(): Promise<AnalyticsStatus> {
    const state = getState();
    return {
      configured: isConfigured(state),
      enabled: isEnabledSync(),
      queueSize: queue().size(),
      isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    };
  }

  // -- GDPR (Phase 1.7 4채널 parity) ---------------------------------------

  /**
   * @param enabled false 시 신규 이벤트 drop. 큐 보존 — `requestDataDeletion`
   *   호출까지. 4채널 setEnabled 와 동일 의미.
   *
   * H2 (Phase 3 review): `Promise<void>` 반환 — 큐 클리어 await 가능.
   */
  static async setEnabled(enabled: boolean): Promise<void> {
    writeStorage(STORAGE_KEYS.enabled, enabled ? 'true' : 'false');
    if (!enabled) {
      // opt-out 즉시 — 큐 클리어 (post-disable flush 가 pre-disable events 를
      // 운반하지 않도록).
      await queue().withLock(() => []);
    }
    log(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
  }

  static async requestDataDeletion(): Promise<{ success: boolean }> {
    const state = getState();
    if (!isConfigured(state)) {
      log('SDK not configured. Cannot request data deletion.', true);
      return { success: false };
    }
    const deviceId = readStorage(STORAGE_KEYS.deviceId);
    const userId = readStorage(STORAGE_KEYS.userId);

    if (deviceId === null) {
      log('No device id; clearing local data only.');
      await clearLocalData();
      return { success: true };
    }

    let success = false;
    try {
      const body: Record<string, unknown> = {
        device_id: deviceId,
        app_id: state.appId,
      };
      if (userId !== null) body.user_id = userId;
      const response = await fetchWithTimeout(
        `${state.apiEndpoint}/events/user-data`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-Key': state.apiKey!,
            'X-Device-ID': deviceId,
          },
          body: JSON.stringify(body),
        },
        FETCH_TIMEOUT_MS,
      );
      success = response.ok || response.status === 202;
      log(
        `Data deletion request: ${success ? 'successful' : `failed (${response.status})`}`,
      );
    } catch (error) {
      log(`Data deletion request error: ${String(error)}`, true);
    }
    await clearLocalData();
    return { success };
  }

  /**
   * 테스트 / SDK teardown 전용. flush timer + page-view tracker detach.
   * **본 메서드는 4채널 SDK 의 public surface 에 없음** — `__` 접두사로 internal
   * 의도 표시. host app 은 정상 라이프사이클 (페이지 unload) 에 의존.
   *
   * @internal
   */
  static __disposeForTest(): void {
    const state = getState();
    if (state.flushTimer !== null) {
      clearInterval(state.flushTimer);
      state.flushTimer = null;
    }
    detachPageViewTracker();
    state.lifecycleAttached = false;
  }
}

async function clearLocalData(): Promise<void> {
  const preservedEnabled = readStorage(STORAGE_KEYS.enabled);

  await queue().withLock(() => {
    for (const key of Object.values(STORAGE_KEYS)) {
      if (key === STORAGE_KEYS.enabled) continue;
      removeStorage(key);
    }
    writeStorage(STORAGE_KEYS.deviceId, uuid());
    if (preservedEnabled !== null) {
      writeStorage(STORAGE_KEYS.enabled, preservedEnabled);
    }
    return [];
  });

  ensureSession();
  log('Cleared all local data; re-bootstrapped fresh identity');
}
