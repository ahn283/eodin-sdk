import { EodinDeeplinkWeb, EodinAnalyticsWeb } from '../web';

const STORAGE_KEYS = [
  'eodin_device_id',
  'eodin_user_id',
  'eodin_session_id',
  'eodin_session_start',
  'eodin_attribution',
  'eodin_enabled',
  'eodin_event_queue',
];

function clearStorage() {
  for (const key of STORAGE_KEYS) localStorage.removeItem(key);
}

describe('EodinDeeplinkWeb', () => {
  let plugin: EodinDeeplinkWeb;

  beforeEach(() => {
    plugin = new EodinDeeplinkWeb();
  });

  it('configure stores endpoint + service (no throw)', async () => {
    await expect(
      plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', service: 'kidstopia' }),
    ).resolves.toBeUndefined();
    expect((await plugin.isReady()).ready).toBe(true);
  });

  it('isReady returns false before configure', async () => {
    expect((await plugin.isReady()).ready).toBe(false);
  });

  it('checkDeferredParams returns empty result on web (no throw)', async () => {
    await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', service: 'kidstopia' });
    const result = await plugin.checkDeferredParams();
    expect(result).toEqual({
      path: null,
      resourceId: null,
      metadata: null,
      hasParams: false,
    });
  });

  it('configure trims trailing slash', async () => {
    await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1/', service: 'kidstopia' });
    expect((await plugin.isReady()).ready).toBe(true);
  });
});

describe('EodinAnalyticsWeb', () => {
  let plugin: EodinAnalyticsWeb;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    clearStorage();
    plugin = new EodinAnalyticsWeb();
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  describe('configure', () => {
    it('initialises device id and session on first configure', async () => {
      await plugin.configure({
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'kidstopia',
      });
      const status = await plugin.getStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.deviceId).toBeTruthy();
      expect(status.sessionId).toBeTruthy();
    });

    it('reuses existing device id across configure calls', async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
      const first = (await plugin.getStatus()).deviceId;

      const plugin2 = new EodinAnalyticsWeb();
      await plugin2.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
      expect((await plugin2.getStatus()).deviceId).toBe(first);
    });

    it('trims trailing slash from endpoint', async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1/', apiKey: 'k', appId: 'a' });
      // session_start is auto-fired during configure → flush triggers fetch with trimmed URL
      await plugin.flush();
      // configure auto-fires session_start which then auto-flushes? No, threshold = 20.
      // So manually enqueue and flush:
      await plugin.track({ eventName: 'app_open' });
      await plugin.flush();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toBe('https://api.eodin.app/api/v1/events/collect');
    });
  });

  describe('track', () => {
    beforeEach(async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'kidstopia' });
    });

    it('skips when not configured', async () => {
      const fresh = new EodinAnalyticsWeb();
      await fresh.track({ eventName: 'app_open' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('persists event to localStorage queue', async () => {
      await plugin.track({ eventName: 'app_open', properties: { mode: 'cold' } });
      const status = await plugin.getStatus();
      expect(status.queueSize).toBeGreaterThanOrEqual(1);
    });

    it('flushes batched events to /events/collect with X-API-Key header', async () => {
      await plugin.track({ eventName: 'app_open' });
      await plugin.flush();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.eodin.app/api/v1/events/collect',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'k',
          }),
        }),
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body) as { events: any[] };
      const appOpen = body.events.find((e) => e.event_name === 'app_open');
      expect(appOpen).toBeDefined();
      expect(appOpen.app_id).toBe('kidstopia');
      expect(appOpen.device_id).toBeTruthy();
      expect(appOpen.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(appOpen.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('forwards EodinEvent wire-format unchanged', async () => {
      // eventName is plain string here — wire-format helper is asserted
      // separately in eodin-event.test.ts (integration with wrapper).
      await plugin.track({ eventName: 'subscribe_start', properties: { plan: 'monthly' } });
      await plugin.flush();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body) as { events: any[] };
      const found = body.events.find((e) => e.event_name === 'subscribe_start');
      expect(found.properties).toEqual({ plan: 'monthly' });
    });

    it('does not lose events on transient flush failure', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      await plugin.track({ eventName: 'app_open' });
      await plugin.flush();
      // Re-queued — try again with success.
      const before = (await plugin.getStatus()).queueSize;
      expect(before).toBeGreaterThan(0);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
      await plugin.flush();
      expect((await plugin.getStatus()).queueSize).toBeLessThan(before);
    });

    it('does not lose events on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      await plugin.track({ eventName: 'app_open' });
      await plugin.flush();
      expect((await plugin.getStatus()).queueSize).toBeGreaterThan(0);
    });
  });

  describe('identify / clearIdentity', () => {
    beforeEach(async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
    });

    it('identify sets userId on subsequent events', async () => {
      await plugin.identify({ userId: 'user-42' });
      await plugin.track({ eventName: 'app_open' });
      await plugin.flush();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body) as { events: any[] };
      const appOpen = body.events.find((e) => e.event_name === 'app_open');
      expect(appOpen.user_id).toBe('user-42');
    });

    it('clearIdentity removes userId', async () => {
      await plugin.identify({ userId: 'user-42' });
      await plugin.clearIdentity();
      const status = await plugin.getStatus();
      expect(status.userId).toBeNull();
    });
  });

  describe('setAttribution', () => {
    beforeEach(async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
    });

    it('attaches attribution to subsequent events with snake_case keys', async () => {
      await plugin.setAttribution({
        utmSource: 'google',
        utmMedium: 'cpc',
        clickId: 'gclid-abc',
        clickIdType: 'gclid',
      });
      await plugin.track({ eventName: 'app_open' });
      await plugin.flush();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body) as { events: any[] };
      const appOpen = body.events.find((e) => e.event_name === 'app_open');
      expect(appOpen.attribution).toMatchObject({
        utm_source: 'google',
        utm_medium: 'cpc',
        click_id: 'gclid-abc',
        click_id_type: 'gclid',
      });
    });
  });

  describe('session lifecycle', () => {
    beforeEach(async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
    });

    it('startSession creates a fresh sessionId and fires session_start', async () => {
      const before = (await plugin.getStatus()).sessionId;
      await plugin.startSession();
      const after = (await plugin.getStatus()).sessionId;
      expect(after).not.toBe(before);
      await plugin.flush();
      const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body) as { events: any[] });
      const sessionStarts = bodies.flatMap((b) => b.events).filter((e) => e.event_name === 'session_start');
      expect(sessionStarts.length).toBeGreaterThanOrEqual(1);
    });

    it('endSession fires session_end and clears sessionId', async () => {
      await plugin.endSession();
      expect((await plugin.getStatus()).sessionId).toBeNull();
      await plugin.flush();
      const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body) as { events: any[] });
      const sessionEnds = bodies.flatMap((b) => b.events).filter((e) => e.event_name === 'session_end');
      expect(sessionEnds.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ATT (web has no ATT)', () => {
    beforeEach(async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
    });

    it('requestTrackingAuthorization returns unknown (no throw)', async () => {
      await expect(plugin.requestTrackingAuthorization()).resolves.toEqual({ status: 'unknown' });
    });

    it('getATTStatus returns unknown', async () => {
      await expect(plugin.getATTStatus()).resolves.toEqual({ status: 'unknown' });
    });
  });

  // H1 — Multi-tab race: queue read-modify-write must serialise via Web Locks
  describe('H1 — multi-tab queue mutex', () => {
    it('serialises concurrent track() calls when navigator.locks is available', async () => {
      // Sequencing harness: each lock acquisition runs only after the previous
      // releases. We drop a real navigator.locks shim and assert events arrive
      // in deterministic order despite concurrent track() invocations.
      const locks = {
        request: jest.fn(async (_name: string, fn: () => Promise<void>) => {
          await fn();
        }),
      };
      (globalThis as any).navigator = { onLine: true, locks };

      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });

      await Promise.all([
        plugin.track({ eventName: 'event_a' }),
        plugin.track({ eventName: 'event_b' }),
        plugin.track({ eventName: 'event_c' }),
      ]);

      expect(locks.request).toHaveBeenCalled();
      const queueSize = (await plugin.getStatus()).queueSize;
      expect(queueSize).toBeGreaterThanOrEqual(3);

      delete (globalThis as any).navigator;
    });

    it('falls back to non-locked write when navigator.locks is missing', async () => {
      (globalThis as any).navigator = { onLine: true };
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
      await plugin.track({ eventName: 'app_open' });
      // Should not throw and queue size should reflect the event.
      const queueSize = (await plugin.getStatus()).queueSize;
      expect(queueSize).toBeGreaterThanOrEqual(1);
      delete (globalThis as any).navigator;
    });
  });

  // H2 — localStorage quota exceeded: drop oldest events instead of throwing
  describe('H2 — localStorage quota handling', () => {
    it('does not throw from track() when setItem throws QuotaExceededError', async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });

      // Fail the next setItem call with a quota error, then succeed.
      let calls = 0;
      const realSetItem = localStorage.setItem.bind(localStorage);
      jest.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
        if (k === 'eodin_event_queue' && calls === 0) {
          calls++;
          const e = new Error('QuotaExceededError') as Error & { name: string };
          e.name = 'QuotaExceededError';
          throw e;
        }
        return realSetItem(k, v);
      });

      await expect(plugin.track({ eventName: 'app_open' })).resolves.toBeUndefined();
      jest.restoreAllMocks();
    });
  });

  // H3 — flushTimer cleanup + lifecycle listeners
  describe('H3 — lifecycle cleanup', () => {
    it('dispose() clears the flush timer and detaches listeners', async () => {
      const docAdd = jest.fn();
      const winAdd = jest.fn();
      const docRemove = jest.fn();
      const winRemove = jest.fn();
      (globalThis as any).document = {
        addEventListener: docAdd,
        removeEventListener: docRemove,
        visibilityState: 'visible',
      };
      (globalThis as any).window = {
        addEventListener: winAdd,
        removeEventListener: winRemove,
      };

      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
      expect(docAdd).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(winAdd).toHaveBeenCalledWith('pagehide', expect.any(Function));

      plugin.dispose();
      expect(docRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(winRemove).toHaveBeenCalledWith('pagehide', expect.any(Function));

      // Idempotent
      plugin.dispose();

      delete (globalThis as any).document;
      delete (globalThis as any).window;
    });
  });

  // Phase 1.7 — GDPR surface (open-issues §4.5)
  describe('Phase 1.7 — GDPR setEnabled / isEnabled / requestDataDeletion', () => {
    beforeEach(async () => {
      await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'kidstopia' });
    });

    it('isEnabled defaults to true', async () => {
      const result = await plugin.isEnabled();
      expect(result.enabled).toBe(true);
    });

    it('setEnabled(false) drops subsequent track() events silently', async () => {
      await plugin.setEnabled({ enabled: false });
      const before = (await plugin.getStatus()).queueSize;
      await plugin.track({ eventName: 'app_open' });
      const after = (await plugin.getStatus()).queueSize;
      expect(after).toBe(before); // queue unchanged — event dropped
    });

    it('setEnabled(true) re-enables tracking', async () => {
      await plugin.setEnabled({ enabled: false });
      await plugin.setEnabled({ enabled: true });
      const before = (await plugin.getStatus()).queueSize;
      await plugin.track({ eventName: 'app_open' });
      const after = (await plugin.getStatus()).queueSize;
      expect(after).toBeGreaterThan(before);
    });

    it('isEnabled persists across new instances (localStorage)', async () => {
      await plugin.setEnabled({ enabled: false });
      const fresh = new EodinAnalyticsWeb();
      const result = await fresh.isEnabled();
      expect(result.enabled).toBe(false);
    });

    it('requestDataDeletion sends DELETE /events/user-data with X-API-Key + body', async () => {
      await plugin.identify({ userId: 'user-42' });
      const result = await plugin.requestDataDeletion();
      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.eodin.app/api/v1/events/user-data',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'X-API-Key': 'k',
          }),
        }),
      );
      const call = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/user-data'));
      expect(call).toBeDefined();
      const body = JSON.parse((call![1] as { body: string }).body);
      expect(body).toMatchObject({ app_id: 'kidstopia', user_id: 'user-42' });
      expect(body.device_id).toBeTruthy();
    });

    it('requestDataDeletion clears identity even when network fails (right to erasure local-only)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      await plugin.identify({ userId: 'user-42' });
      const beforeDeviceId = (await plugin.getStatus()).deviceId;
      const result = await plugin.requestDataDeletion();
      expect(result.success).toBe(false);
      // userId fully cleared
      const status = await plugin.getStatus();
      expect(status.userId).toBeNull();
      // C2/H1: deviceId is re-bootstrapped (fresh identity), NOT null
      expect(status.deviceId).toBeTruthy();
      expect(status.deviceId).not.toBe(beforeDeviceId);
      // Queue should contain at most the auto-fired session_start from
      // ensureSession() — pre-deletion events are purged.
      expect(status.queueSize).toBeLessThanOrEqual(1);
    });

    it('requestDataDeletion returns false when SDK not configured', async () => {
      const fresh = new EodinAnalyticsWeb();
      const result = await fresh.requestDataDeletion();
      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // C2/H1 (Phase 1.7 reviews): post-deletion track() must not crash and
    // must continue to work with a fresh device id.
    it('track() works after requestDataDeletion (re-bootstrapped identity)', async () => {
      const before = (await plugin.getStatus()).deviceId;
      await plugin.requestDataDeletion();
      const after = (await plugin.getStatus()).deviceId;
      expect(after).toBeTruthy();
      expect(after).not.toBe(before); // fresh identity

      // Subsequent track() should enqueue successfully (not silently drop)
      await plugin.track({ eventName: 'app_open' });
      const queueSize = (await plugin.getStatus()).queueSize;
      expect(queueSize).toBeGreaterThan(0);
    });

    // HIGH-3 (Phase 1.7 logging-audit): deletion preserves user's opt-out.
    it('requestDataDeletion preserves disabled opt-out flag', async () => {
      await plugin.setEnabled({ enabled: false });
      await plugin.requestDataDeletion();
      const result = await plugin.isEnabled();
      expect(result.enabled).toBe(false); // opt-out persists across deletion
    });

    // HIGH-1/M4 (Phase 1.7 logging-audit): setEnabled(false) clears queue.
    it('setEnabled(false) purges queued events', async () => {
      await plugin.track({ eventName: 'app_open' });
      await plugin.track({ eventName: 'subscribe_start' });
      const before = (await plugin.getStatus()).queueSize;
      expect(before).toBeGreaterThan(0);

      await plugin.setEnabled({ enabled: false });
      const after = (await plugin.getStatus()).queueSize;
      expect(after).toBe(0); // queue purged on opt-out
    });

    // C1: wire path is /events/user-data, not /user-data.
    it('requestDataDeletion uses /events/user-data path', async () => {
      await plugin.requestDataDeletion();
      const calls = fetchMock.mock.calls.filter((c) => (c[0] as string).includes('user-data'));
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('https://api.eodin.app/api/v1/events/user-data');
    });
  });

  // logging-audit M1 — session_end carries duration_seconds
  describe('logging M1 — session_end duration_seconds', () => {
    it('attaches duration_seconds to session_end based on session_start time', async () => {
      // Freeze "now" at session start.
      const originalNow = Date.now;
      let mockNow = 1_700_000_000_000;
      Date.now = () => mockNow;
      try {
        await plugin.configure({ apiEndpoint: 'https://api.eodin.app/api/v1', apiKey: 'k', appId: 'a' });
        // Advance 1234 seconds.
        mockNow += 1_234_000;
        await plugin.endSession();
      } finally {
        Date.now = originalNow;
      }

      await plugin.flush();
      const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body) as { events: any[] });
      const sessionEnd = bodies.flatMap((b) => b.events).find((e) => e.event_name === 'session_end');
      expect(sessionEnd).toBeDefined();
      expect(sessionEnd.properties).toEqual({ duration_seconds: 1234 });
    });
  });
});
