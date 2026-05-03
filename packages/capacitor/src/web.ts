import { WebPlugin } from '@capacitor/core';
import {
  EventQueue,
  type QueuedEvent,
  STORAGE_KEYS,
  fetchWithTimeout,
  readStorage,
  removeStorage,
  sendBeacon,
  uuid,
  validateEndpoint,
  writeStorage,
} from 'eodin-web/internal';

import type {
  EodinDeeplinkPlugin,
  DeeplinkConfigureOptions,
  DeferredParamsResult,
  EodinAnalyticsPlugin,
  AnalyticsConfigureOptions,
  TrackOptions,
  Attribution,
  ATTStatus,
  AnalyticsStatus,
} from './definitions';

// `validateEndpoint` 는 capacitor 의 외부 import 점이기도 했으므로 재export 유지
// (back-compat). Phase 2 어댑터화로 본체는 `eodin-web/internal` 에 있음.
export { validateEndpoint };

// ---------------------------------------------------------------------------
// EodinDeeplinkWeb
// ---------------------------------------------------------------------------

/**
 * Web implementation of `EodinDeeplinkPlugin`.
 *
 * Deferred deep linking is a mobile-install-attribution flow — on the web
 * the user is already at the destination URL, so there are no deferred
 * params to retrieve. We treat all calls as safe no-ops (instead of
 * throwing `unavailable()`) so that cross-platform code paths in apps
 * like kidstopia / semag.app stay simple.
 */
export class EodinDeeplinkWeb extends WebPlugin implements EodinDeeplinkPlugin {
  private apiEndpoint: string | null = null;
  private service: string | null = null;

  async configure(options: DeeplinkConfigureOptions): Promise<void> {
    validateEndpoint(options.apiEndpoint);
    this.apiEndpoint = options.apiEndpoint.replace(/\/$/, '');
    this.service = options.service;
  }

  async checkDeferredParams(): Promise<DeferredParamsResult> {
    return {
      path: null,
      resourceId: null,
      metadata: null,
      hasParams: false,
    };
  }

  async isReady(): Promise<{ ready: boolean }> {
    return { ready: this.apiEndpoint !== null && this.service !== null };
  }
}

// ---------------------------------------------------------------------------
// EodinAnalyticsWeb
// ---------------------------------------------------------------------------

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const QUEUE_FLUSH_THRESHOLD = 20;
const QUEUE_FLUSH_INTERVAL_MS = 30 * 1000;
const MAX_QUEUE_SIZE = 1000;
const MAX_BATCH_SIZE = 50;
const FETCH_TIMEOUT_MS = 10 * 1000; // 10s — flush requests should never hang the page

/**
 * Camel → snake helper for Attribution keys (matches `AttributionSchema` on
 * the API side: `utm_source`, `click_id`, etc.).
 */
function attributionToWire(
  attr: Attribution,
): Record<string, string | undefined> {
  return {
    source: attr.source,
    campaign_id: attr.campaignId,
    adset_id: attr.adsetId,
    ad_id: attr.adId,
    click_id: attr.clickId,
    click_id_type: attr.clickIdType,
    utm_source: attr.utmSource,
    utm_medium: attr.utmMedium,
    utm_campaign: attr.utmCampaign,
    utm_content: attr.utmContent,
    utm_term: attr.utmTerm,
  };
}

/**
 * Web implementation of `EodinAnalyticsPlugin`.
 *
 * Persists state in `localStorage` and flushes events to
 * `${apiEndpoint}/events/collect` via `fetch`. Mirrors the offline-queue
 * + auto-flush behaviour of the native SDKs (Flutter / iOS / Android).
 *
 * GDPR: when `setEnabled(false)` is called, all subsequent `track` calls
 * are dropped silently. The queue is also cleared on `requestDataDeletion`.
 *
 * ATT: web has no equivalent of iOS App Tracking Transparency — the ATT
 * methods return `{ status: 'unknown' }` instead of throwing, so
 * cross-platform code paths stay simple.
 *
 * Phase 2 (web-sdk track): EventQueue / NetworkClient / EndpointValidator /
 * uuid / STORAGE_KEYS 는 `eodin-web/internal` 에서 import. 본 클래스는
 * Capacitor plugin surface (positional API + native bridge 연동) + lifecycle
 * listener + sendBeacon flushOnExit + GDPR 본체 만 담당.
 */
export class EodinAnalyticsWeb
  extends WebPlugin
  implements EodinAnalyticsPlugin
{
  private apiEndpoint: string | null = null;
  private apiKey: string | null = null;
  private appId: string | null = null;
  private debug = false;
  private offlineMode = true;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private lifecycleAttached = false;
  // EventQueue 가 quota drop / 큐 키 제거 시 호출하는 관측성 콜백 — debug 모드
  // 에서 console.log 로 surface (Phase 2 review H2 — capacitor 가 quota drop
  // 관측성을 잃지 않도록 logger 콜백 주입).
  private readonly queue = new EventQueue(undefined, (msg: string) =>
    this.log(msg, true),
  );

  async configure(options: AnalyticsConfigureOptions): Promise<void> {
    validateEndpoint(options.apiEndpoint);
    this.apiEndpoint = options.apiEndpoint.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.appId = options.appId;
    this.debug = options.debug ?? false;
    this.offlineMode = options.offlineMode ?? true;

    // Initialise device id once per browser
    if (readStorage(STORAGE_KEYS.deviceId) === null) {
      writeStorage(STORAGE_KEYS.deviceId, uuid());
    }

    // Resume or start session
    this.ensureSession();

    // Start periodic flush. `unref()` (when available, e.g. Node test envs)
    // ensures the timer does not keep the process alive at teardown — in
    // browsers `unref` is a no-op and the GC handles disposal naturally.
    if (this.offlineMode && this.flushTimer === null && typeof setInterval !== 'undefined') {
      this.flushTimer = setInterval(() => {
        // Fire-and-forget; errors are surfaced to console in debug mode.
        void this.flush();
      }, QUEUE_FLUSH_INTERVAL_MS);
      const t = this.flushTimer as { unref?: () => void };
      if (typeof t.unref === 'function') t.unref();
    }

    // H3: drain queue on tab hide / page unload via sendBeacon.
    this.attachLifecycleListeners();

    this.log(
      `Configured endpoint=${this.apiEndpoint} appId=${this.appId} offlineMode=${this.offlineMode}`,
    );
  }

  async track(options: TrackOptions): Promise<void> {
    if (!this.isConfigured()) {
      this.log('SDK not configured. Call configure() first.', true);
      return;
    }

    if (!this.isEnabledSync()) {
      this.log(`Tracking disabled (GDPR). Skipping ${options.eventName}`);
      return;
    }

    const event: QueuedEvent = {
      event_id: uuid(),
      event_name: options.eventName,
      app_id: this.appId!,
      device_id: readStorage(STORAGE_KEYS.deviceId)!,
      user_id: readStorage(STORAGE_KEYS.userId),
      session_id: readStorage(STORAGE_KEYS.sessionId),
      timestamp: new Date().toISOString(),
      properties: options.properties,
    };

    const attrJson = readStorage(STORAGE_KEYS.attribution);
    if (attrJson) {
      try {
        event.attribution = JSON.parse(attrJson) as Record<string, string | undefined>;
      } catch {
        // Corrupted attribution — drop silently and continue.
      }
    }

    // track 경로에서 명시적으로 oldest trim — Phase 2 review H1: EventQueue.
    // withLock 의 universal trim 제거 → 호출자 책임. requeueBatch (flush
    // 실패 retry) 경로는 일시적 maxSize 초과를 허용하고 다음 track 에서
    // 자연 trim.
    await this.queue.withLock((current) => {
      const next = [...current, event];
      return next.length > MAX_QUEUE_SIZE
        ? next.slice(next.length - MAX_QUEUE_SIZE)
        : next;
    });

    const queueSize = this.queue.size();
    this.log(`Enqueued ${options.eventName} (queue=${queueSize})`);

    if (queueSize >= QUEUE_FLUSH_THRESHOLD) {
      void this.flush();
    }
  }

  async identify(options: { userId: string }): Promise<void> {
    writeStorage(STORAGE_KEYS.userId, options.userId);
    this.log(`Identified user: ${options.userId}`);
  }

  async clearIdentity(): Promise<void> {
    removeStorage(STORAGE_KEYS.userId);
    this.log('Cleared user identity');
  }

  async setAttribution(attribution: Attribution): Promise<void> {
    writeStorage(
      STORAGE_KEYS.attribution,
      JSON.stringify(attributionToWire(attribution)),
    );
    this.log('Set attribution');
  }

  async flush(): Promise<void> {
    if (!this.isConfigured()) return;

    // Atomically take a batch under the queue lock so concurrent track()
    // and flush() calls in different tabs cannot duplicate or drop events.
    let batch: QueuedEvent[] = [];
    await this.queue.withLock((current) => {
      batch = current.slice(0, MAX_BATCH_SIZE);
      return current.slice(batch.length);
    });
    if (batch.length === 0) return;

    try {
      const response = await fetchWithTimeout(
        `${this.apiEndpoint}/events/collect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-Key': this.apiKey!,
          },
          body: JSON.stringify({ events: batch }),
        },
        FETCH_TIMEOUT_MS,
      );

      if (!response.ok) {
        await this.requeueBatch(batch);
        this.log(`Flush failed: HTTP ${response.status}`, true);
        return;
      }

      this.log(`Flushed ${batch.length} events`);
    } catch (error) {
      await this.requeueBatch(batch);
      this.log(`Flush error: ${String(error)}`, true);
    }
  }

  async startSession(): Promise<void> {
    const sessionId = uuid();
    writeStorage(STORAGE_KEYS.sessionId, sessionId);
    writeStorage(STORAGE_KEYS.sessionStart, String(Date.now()));
    this.log(`Started session: ${sessionId}`);
    await this.track({ eventName: 'session_start' });
  }

  async endSession(): Promise<void> {
    if (readStorage(STORAGE_KEYS.sessionId) !== null) {
      // logging-audit M1: include duration_seconds so cross-app session
      // length analysis (PRD §15.2) doesn't lose web data.
      const startRaw = readStorage(STORAGE_KEYS.sessionStart);
      const properties: Record<string, unknown> = {};
      if (startRaw !== null) {
        const elapsed = Date.now() - Number(startRaw);
        if (Number.isFinite(elapsed) && elapsed >= 0) {
          properties.duration_seconds = Math.round(elapsed / 1000);
        }
      }
      await this.track({
        eventName: 'session_end',
        properties: Object.keys(properties).length > 0 ? properties : undefined,
      });
    }
    removeStorage(STORAGE_KEYS.sessionId);
    removeStorage(STORAGE_KEYS.sessionStart);
  }

  /**
   * Stop the periodic flush timer and detach lifecycle listeners. Safe to
   * call multiple times. Useful in tests and when the host app explicitly
   * tears down the SDK (rare in production — pages normally unload).
   */
  dispose(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.detachLifecycleListeners();
  }

  async requestTrackingAuthorization(): Promise<{ status: ATTStatus }> {
    // Web has no ATT equivalent. Return 'unknown' so cross-platform callers
    // can branch on `status === 'authorized'` without special-casing web.
    return { status: 'unknown' };
  }

  async getATTStatus(): Promise<{ status: ATTStatus }> {
    return { status: 'unknown' };
  }

  async getStatus(): Promise<AnalyticsStatus> {
    return {
      isConfigured: this.isConfigured(),
      deviceId: readStorage(STORAGE_KEYS.deviceId),
      userId: readStorage(STORAGE_KEYS.userId),
      sessionId: readStorage(STORAGE_KEYS.sessionId),
      isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
      queueSize: this.queue.size(),
      attStatus: 'unknown',
    };
  }

  // -- GDPR / Right to Erasure (Phase 1.7 — open-issues §4.5) -----------

  async setEnabled(options: { enabled: boolean }): Promise<void> {
    writeStorage(STORAGE_KEYS.enabled, options.enabled ? 'true' : 'false');
    // HIGH-1/M4 (Phase 1.7 logging-audit): opt-out is immediate. Discard
    // pending events in the queue (under the queue lock to be safe under
    // multi-tab) so post-disable flush does not carry pre-disable events.
    if (!options.enabled) {
      await this.queue.withLock(() => []);
    }
    this.log(`Analytics ${options.enabled ? 'enabled' : 'disabled'}`);
  }

  async isEnabled(): Promise<{ enabled: boolean }> {
    const value = readStorage(STORAGE_KEYS.enabled);
    return { enabled: value === null ? true : value === 'true' };
  }

  /**
   * Sends DELETE `${apiEndpoint}/events/user-data` and clears local storage
   * regardless of network outcome (right to erasure honoured locally even
   * when the server is unreachable).
   */
  async requestDataDeletion(): Promise<{ success: boolean }> {
    if (!this.isConfigured()) {
      this.log('SDK not configured. Cannot request data deletion.', true);
      return { success: false };
    }

    const deviceId = readStorage(STORAGE_KEYS.deviceId);
    const userId = readStorage(STORAGE_KEYS.userId);

    // L3: defensive — if device id is somehow missing, skip wire call but
    // still honour the local-erasure contract.
    if (deviceId === null) {
      this.log('No device id; clearing local data only.');
      await this.clearLocalData();
      return { success: true };
    }

    let success = false;
    try {
      const body: Record<string, unknown> = {
        device_id: deviceId,
        app_id: this.appId,
      };
      if (userId !== null) body.user_id = userId;

      const response = await fetchWithTimeout(
        `${this.apiEndpoint}/events/user-data`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-Key': this.apiKey!,
            'X-Device-ID': deviceId,
          },
          body: JSON.stringify(body),
        },
        FETCH_TIMEOUT_MS,
      );
      success = response.ok || response.status === 202;
      this.log(`Data deletion request: ${success ? 'successful' : `failed (${response.status})`}`);
    } catch (error) {
      this.log(`Data deletion request error: ${String(error)}`, true);
    }

    // Always clear local data — right to erasure honoured locally.
    await this.clearLocalData();
    return { success };
  }

  /**
   * MEDIUM-2 (Phase 1.7 logging-audit): Web Locks API protects the wipe +
   * re-bootstrap from interleaving with concurrent track() calls in other
   * tabs. HIGH-3: opt-out flag preserved across deletion. C2/H1: fresh
   * device id + session immediately created so subsequent track() works.
   */
  private async clearLocalData(): Promise<void> {
    const preservedEnabled = readStorage(STORAGE_KEYS.enabled);

    // Clear all keys EXCEPT the preserved enabled flag, then reseed device id.
    // Use queue.withLock to serialise with concurrent track() across tabs.
    await this.queue.withLock(() => {
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

    // Restart session under the new device id (does not depend on the lock).
    this.ensureSession();
    this.log('Cleared all local data; re-bootstrapped fresh identity');
  }

  // -- internal helpers ----------------------------------------------------

  private isConfigured(): boolean {
    return (
      this.apiEndpoint !== null && this.apiKey !== null && this.appId !== null
    );
  }

  /** Synchronous internal — public async `isEnabled()` returns the same. */
  private isEnabledSync(): boolean {
    const value = readStorage(STORAGE_KEYS.enabled);
    if (value === null) return true; // default-enabled
    return value === 'true';
  }

  private ensureSession(): void {
    const sessionId = readStorage(STORAGE_KEYS.sessionId);
    const sessionStart = readStorage(STORAGE_KEYS.sessionStart);
    if (sessionId !== null && sessionStart !== null) {
      const elapsed = Date.now() - Number(sessionStart);
      if (elapsed < SESSION_TIMEOUT_MS) {
        this.log(`Resumed session: ${sessionId}`);
        return;
      }
    }
    void this.startSession();
  }

  private async requeueBatch(batch: QueuedEvent[]): Promise<void> {
    if (batch.length === 0) return;
    await this.queue.withLock((current) => [...batch, ...current]);
  }

  private attachLifecycleListeners(): void {
    if (this.lifecycleAttached) return;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    this.lifecycleAttached = true;

    const onPageHide = () => {
      this.flushOnExit();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') this.flushOnExit();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    this.detachLifecycleListeners = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      this.lifecycleAttached = false;
      this.detachLifecycleListeners = () => {};
    };
  }

  /**
   * H3: best-effort flush as the page is hidden / unloading. Uses
   * `navigator.sendBeacon` (via `eodin-web/internal`) so the request
   * survives unload (regular fetch is cancelled).
   */
  private flushOnExit(): void {
    if (!this.isConfigured()) return;
    const queue = this.queue.read();
    if (queue.length === 0) return;
    const batch = queue.slice(0, MAX_BATCH_SIZE);
    const remaining = queue.slice(batch.length);
    const ok = sendBeacon(`${this.apiEndpoint}/events/collect`, {
      events: batch,
      api_key: this.apiKey,
    });
    if (ok) {
      // sendBeacon does not let us authenticate via header; the server
      // accepts the api_key body field as a fallback for unload contexts.
      // The remaining queue is persisted so the next session can resume any
      // leftover events.
      this.queue.write(remaining);
      this.log(`flushOnExit beaconed ${batch.length} events`);
    }
  }

  private detachLifecycleListeners: () => void = () => {};

  private log(message: string, isError = false): void {
    if (!this.debug) return;
    if (isError) {
      // eslint-disable-next-line no-console
      console.warn(`[EodinAnalyticsWeb] ${message}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[EodinAnalyticsWeb] ${message}`);
    }
  }
}
