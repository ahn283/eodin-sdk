import { WebPlugin } from '@capacitor/core';

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

const STORAGE_KEYS = {
  deviceId: 'eodin_device_id',
  userId: 'eodin_user_id',
  sessionId: 'eodin_session_id',
  sessionStart: 'eodin_session_start',
  attribution: 'eodin_attribution',
  enabled: 'eodin_enabled',
  queue: 'eodin_event_queue',
} as const;

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const QUEUE_FLUSH_THRESHOLD = 20;
const QUEUE_FLUSH_INTERVAL_MS = 30 * 1000;
const MAX_QUEUE_SIZE = 1000;
const MAX_BATCH_SIZE = 50;
const FETCH_TIMEOUT_MS = 10 * 1000; // 10s — flush requests should never hang the page
const QUEUE_LOCK_NAME = 'eodin_event_queue_lock';
// Web (browser) SDK 는 emulator-only 주소인 `10.0.2.2` 를 허용하지 않는다.
// Web 환경에서는 의미가 없을 뿐더러 mixed-content 정책이 release 에서 막아주지
// 않는 사설망 IP 라 reject (코드리뷰 H1).
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * S8 보안 정책 (Phase 1.6): SDK 의 모든 API endpoint 는 HTTPS 만 허용.
 *
 * dev 워크플로우 유지를 위해 loopback 주소의 `http://` 는 허용:
 * - `localhost`, `127.0.0.1`
 *
 * 그 외 `http://` 주소는 `Error` throw — `configure()` 시점에 즉시 발견.
 * cross-platform 정합 (M2): 입력은 `trim()` + scheme lowercase 비교.
 */
export function validateEndpoint(endpoint: string, paramName = 'apiEndpoint'): void {
  const trimmed = endpoint.trim();
  if (trimmed.length === 0) {
    throw new Error(`${paramName} must not be empty`);
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${paramName} must be a valid absolute URL: ${endpoint}`);
  }
  if (!url.protocol || !url.hostname) {
    throw new Error(`${paramName} must be a valid absolute URL: ${endpoint}`);
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  const host = url.hostname.toLowerCase();
  if (scheme === 'https') return;
  if (scheme === 'http' && LOOPBACK_HOSTS.has(host)) return;
  throw new Error(
    `${paramName} must use HTTPS (only http://localhost / 127.0.0.1 allowed; got: ${endpoint})`,
  );
}

interface QueuedEvent {
  event_id: string;
  event_name: string;
  app_id: string;
  device_id: string;
  user_id: string | null;
  session_id: string | null;
  timestamp: string;
  attribution?: Record<string, string | undefined>;
  properties?: Record<string, unknown>;
}

function uuid(): string {
  // crypto.randomUUID is widely available since 2022 in browsers + jsdom.
  // Fall back to a v4-shaped string if unavailable (edge-case test envs).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

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

  async configure(options: AnalyticsConfigureOptions): Promise<void> {
    validateEndpoint(options.apiEndpoint);
    this.apiEndpoint = options.apiEndpoint.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.appId = options.appId;
    this.debug = options.debug ?? false;
    this.offlineMode = options.offlineMode ?? true;

    // Initialise device id once per browser
    if (this.readStorage(STORAGE_KEYS.deviceId) === null) {
      this.writeStorage(STORAGE_KEYS.deviceId, uuid());
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

    if (!this.isEnabled()) {
      this.log(`Tracking disabled (GDPR). Skipping ${options.eventName}`);
      return;
    }

    const event: QueuedEvent = {
      event_id: uuid(),
      event_name: options.eventName,
      app_id: this.appId!,
      device_id: this.readStorage(STORAGE_KEYS.deviceId)!,
      user_id: this.readStorage(STORAGE_KEYS.userId),
      session_id: this.readStorage(STORAGE_KEYS.sessionId),
      timestamp: new Date().toISOString(),
      properties: options.properties,
    };

    const attrJson = this.readStorage(STORAGE_KEYS.attribution);
    if (attrJson) {
      try {
        event.attribution = JSON.parse(attrJson) as Record<string, string | undefined>;
      } catch {
        // Corrupted attribution — drop silently and continue.
      }
    }

    // H1: Web Locks API serialises queue read-modify-write across tabs.
    // Falls back to direct write when the API is unavailable (single-tab
    // usage stays correct; multi-tab without locks degrades to the v1 risk
    // and is documented in the SDK README).
    await this.withQueueLock((queue) => {
      queue.push(event);
      if (queue.length > MAX_QUEUE_SIZE) {
        queue.splice(0, queue.length - MAX_QUEUE_SIZE);
      }
      return queue;
    });

    const status = await this.getStatus();
    this.log(`Enqueued ${options.eventName} (queue=${status.queueSize})`);

    if (status.queueSize >= QUEUE_FLUSH_THRESHOLD) {
      void this.flush();
    }
  }

  async identify(options: { userId: string }): Promise<void> {
    this.writeStorage(STORAGE_KEYS.userId, options.userId);
    this.log(`Identified user: ${options.userId}`);
  }

  async clearIdentity(): Promise<void> {
    this.removeStorage(STORAGE_KEYS.userId);
    this.log('Cleared user identity');
  }

  async setAttribution(attribution: Attribution): Promise<void> {
    this.writeStorage(
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
    await this.withQueueLock((queue) => {
      batch = queue.splice(0, MAX_BATCH_SIZE);
      return queue;
    });
    if (batch.length === 0) return;

    try {
      const response = await this.fetchWithTimeout(
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
    this.writeStorage(STORAGE_KEYS.sessionId, sessionId);
    this.writeStorage(STORAGE_KEYS.sessionStart, String(Date.now()));
    this.log(`Started session: ${sessionId}`);
    await this.track({ eventName: 'session_start' });
  }

  async endSession(): Promise<void> {
    if (this.readStorage(STORAGE_KEYS.sessionId) !== null) {
      // logging-audit M1: include duration_seconds so cross-app session
      // length analysis (PRD §15.2) doesn't lose web data.
      const startRaw = this.readStorage(STORAGE_KEYS.sessionStart);
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
    this.removeStorage(STORAGE_KEYS.sessionId);
    this.removeStorage(STORAGE_KEYS.sessionStart);
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
      deviceId: this.readStorage(STORAGE_KEYS.deviceId),
      userId: this.readStorage(STORAGE_KEYS.userId),
      sessionId: this.readStorage(STORAGE_KEYS.sessionId),
      isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
      queueSize: this.readQueue().length,
      attStatus: 'unknown',
    };
  }

  // -- internal helpers ----------------------------------------------------

  private isConfigured(): boolean {
    return (
      this.apiEndpoint !== null && this.apiKey !== null && this.appId !== null
    );
  }

  private isEnabled(): boolean {
    const value = this.readStorage(STORAGE_KEYS.enabled);
    if (value === null) return true; // default-enabled
    return value === 'true';
  }

  private ensureSession(): void {
    const sessionId = this.readStorage(STORAGE_KEYS.sessionId);
    const sessionStart = this.readStorage(STORAGE_KEYS.sessionStart);
    if (sessionId !== null && sessionStart !== null) {
      const elapsed = Date.now() - Number(sessionStart);
      if (elapsed < SESSION_TIMEOUT_MS) {
        this.log(`Resumed session: ${sessionId}`);
        return;
      }
    }
    void this.startSession();
  }

  private readStorage(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  private writeStorage(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  }

  private removeStorage(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  }

  private readQueue(): QueuedEvent[] {
    const raw = this.readStorage(STORAGE_KEYS.queue);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
    } catch {
      return [];
    }
  }

  private writeQueue(events: QueuedEvent[]): void {
    const serialised = JSON.stringify(events);
    try {
      this.writeStorage(STORAGE_KEYS.queue, serialised);
    } catch (error) {
      // H2: localStorage quota exceeded. Drop the oldest events until the
      // payload fits. This favours newest events (most likely tied to the
      // current user action) over historical backlog.
      if (this.isQuotaError(error)) {
        let trimmed = events;
        while (trimmed.length > 0) {
          const dropCount = Math.max(1, Math.floor(trimmed.length / 2));
          trimmed = trimmed.slice(dropCount);
          try {
            this.writeStorage(STORAGE_KEYS.queue, JSON.stringify(trimmed));
            this.log(
              `Queue quota exceeded — dropped ${events.length - trimmed.length} oldest events`,
              true,
            );
            return;
          } catch (retryError) {
            if (!this.isQuotaError(retryError)) throw retryError;
          }
        }
        // Even an empty array failed — last resort: clear the queue key.
        try {
          this.removeStorage(STORAGE_KEYS.queue);
        } catch {
          // Storage entirely unavailable. Lose the batch silently rather
          // than throw out of track() / flush().
        }
        this.log('Queue dropped entirely — localStorage exhausted', true);
        return;
      }
      throw error;
    }
  }

  private isQuotaError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    // Names vary across browsers: "QuotaExceededError" (modern), legacy
    // "NS_ERROR_DOM_QUOTA_REACHED" (Firefox), code 22 / 1014 (older WebKit).
    if (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ) {
      return true;
    }
    const code = (error as { code?: number }).code;
    return code === 22 || code === 1014;
  }

  /**
   * H1: Serialises a queue read-modify-write through the Web Locks API so
   * concurrent tabs don't drop events via lost-update.
   *
   * Falls back to a non-locked read-modify-write when the API is missing
   * (older browsers, non-secure contexts, test envs) — single-tab usage
   * stays correct, multi-tab behaves like the v1 risk and is documented
   * in the SDK README.
   */
  private async withQueueLock(
    mutator: (queue: QueuedEvent[]) => QueuedEvent[],
  ): Promise<void> {
    const locks =
      typeof navigator !== 'undefined' &&
      (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks && typeof locks.request === 'function') {
      await locks.request(QUEUE_LOCK_NAME, async () => {
        const next = mutator(this.readQueue());
        this.writeQueue(next);
      });
      return;
    }
    const next = mutator(this.readQueue());
    this.writeQueue(next);
  }

  private async requeueBatch(batch: QueuedEvent[]): Promise<void> {
    if (batch.length === 0) return;
    await this.withQueueLock((current) => [...batch, ...current]);
  }

  private async fetchWithTimeout(
    input: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    if (typeof AbortController === 'undefined') {
      return fetch(input, init);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
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
   * `navigator.sendBeacon` so the request survives unload (regular fetch
   * is cancelled). Synchronous read of the queue is fine here because
   * unload races with visibilitychange and we just need to drain.
   */
  private flushOnExit(): void {
    if (!this.isConfigured()) return;
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
    const queue = this.readQueue();
    if (queue.length === 0) return;
    const batch = queue.splice(0, MAX_BATCH_SIZE);
    try {
      const blob = new Blob(
        [JSON.stringify({ events: batch, api_key: this.apiKey })],
        { type: 'application/json' },
      );
      const ok = navigator.sendBeacon(`${this.apiEndpoint}/events/collect`, blob);
      if (ok) {
        // sendBeacon does not let us authenticate via header; the server
        // accepts the api_key body field as a fallback for unload contexts.
        // The remaining queue (after splicing the batch) is persisted so
        // the next session can resume any leftover events.
        this.writeQueue(queue);
        this.log(`flushOnExit beaconed ${batch.length} events`);
      }
    } catch (error) {
      this.log(`flushOnExit failed: ${String(error)}`, true);
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
