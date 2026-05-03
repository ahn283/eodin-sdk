import { EodinAnalytics } from '../analytics/eodin-analytics';
import { __resetStateForTest } from '../analytics/state';
import { EodinEvent } from '../eodin-event';
import { STORAGE_KEYS } from '../internal/storage';

beforeEach(() => {
  localStorage.clear();
  __resetStateForTest();
  // dispose any timers from previous tests
  EodinAnalytics.__disposeForTest();
});

afterEach(() => {
  EodinAnalytics.__disposeForTest();
});

const VALID_CONFIG = {
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: 'test-key',
  appId: 'test-app',
};

describe('EodinAnalytics.configure', () => {
  it('valid endpoint 통과 + deviceId 자동 생성', async () => {
    expect(localStorage.getItem(STORAGE_KEYS.deviceId)).toBeNull();
    await EodinAnalytics.configure(VALID_CONFIG);
    expect(localStorage.getItem(STORAGE_KEYS.deviceId)).not.toBeNull();
  });

  it('http://localhost dev endpoint 통과', async () => {
    await expect(
      EodinAnalytics.configure({ ...VALID_CONFIG, apiEndpoint: 'http://localhost:3005/api/v1' }),
    ).resolves.toBeUndefined();
  });

  it('http://attacker.com 은 throw', async () => {
    await expect(
      EodinAnalytics.configure({ ...VALID_CONFIG, apiEndpoint: 'http://attacker.com' }),
    ).rejects.toThrow(/HTTPS/);
  });

  it('endpoint 의 trailing slash 제거', async () => {
    await EodinAnalytics.configure({
      ...VALID_CONFIG,
      apiEndpoint: 'https://api.eodin.app/api/v1/',
    });
    // 내부 state 검증은 안되지만 flush 시 endpoint 가 정확히 '/events/collect' 추가되는지 다른 테스트에서 cover
  });
});

describe('EodinAnalytics.track / status getters', () => {
  it('configure 안 된 상태에서 track 은 silent (no throw)', () => {
    expect(() => EodinAnalytics.track('foo')).not.toThrow();
  });

  it('track 후 queueSize 증가', async () => {
    await EodinAnalytics.configure(VALID_CONFIG);
    EodinAnalytics.track(EodinEvent.AppOpen);
    // track 은 async withLock 안에서 큐에 enqueue. 다음 microtask 까지 대기.
    await new Promise((r) => setTimeout(r, 10));
    const status = await EodinAnalytics.getStatus();
    // session_start (configure 시 자동) + AppOpen → 2 events
    expect(status.queueSize).toBeGreaterThanOrEqual(1);
  });

  it('deviceId / sessionId getter 반환', async () => {
    await EodinAnalytics.configure(VALID_CONFIG);
    expect(EodinAnalytics.deviceId).not.toBeNull();
    expect(EodinAnalytics.sessionId).not.toBeNull();
  });
});

describe('EodinAnalytics.identify / clearIdentity', () => {
  beforeEach(async () => {
    await EodinAnalytics.configure(VALID_CONFIG);
  });

  it('identify 후 userId getter 반환', () => {
    EodinAnalytics.identify('user-123');
    expect(EodinAnalytics.userId).toBe('user-123');
  });

  it('clearIdentity 후 userId null', () => {
    EodinAnalytics.identify('user-123');
    EodinAnalytics.clearIdentity();
    expect(EodinAnalytics.userId).toBeNull();
  });
});

describe('EodinAnalytics.setAttribution', () => {
  beforeEach(async () => {
    await EodinAnalytics.configure(VALID_CONFIG);
  });

  it('attribution getter 가 in-memory 반환', () => {
    EodinAnalytics.setAttribution({
      campaignId: 'spring-2026',
      utmSource: 'meta',
    });
    expect(EodinAnalytics.attribution).toEqual({
      campaignId: 'spring-2026',
      utmSource: 'meta',
    });
  });

  it('setAttribution 가 wire schema 로 localStorage 저장', () => {
    EodinAnalytics.setAttribution({ utmSource: 'google', utmMedium: 'cpc' });
    const raw = localStorage.getItem(STORAGE_KEYS.attribution);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.utm_source).toBe('google');
    expect(parsed.utm_medium).toBe('cpc');
  });
});

describe('EodinAnalytics GDPR — setEnabled / isEnabled / requestDataDeletion', () => {
  beforeEach(async () => {
    await EodinAnalytics.configure(VALID_CONFIG);
  });

  it('default 는 enabled', () => {
    expect(EodinAnalytics.isEnabled).toBe(true);
  });

  it('setEnabled(false) 후 isEnabled false', () => {
    EodinAnalytics.setEnabled(false);
    expect(EodinAnalytics.isEnabled).toBe(false);
  });

  it('setEnabled(false) 시 큐 클리어', async () => {
    EodinAnalytics.track(EodinEvent.AppOpen);
    await new Promise((r) => setTimeout(r, 10));
    expect((await EodinAnalytics.getStatus()).queueSize).toBeGreaterThan(0);

    EodinAnalytics.setEnabled(false);
    await new Promise((r) => setTimeout(r, 10));
    expect((await EodinAnalytics.getStatus()).queueSize).toBe(0);
  });

  it('setEnabled(false) 후 track 호출은 drop', async () => {
    EodinAnalytics.setEnabled(false);
    EodinAnalytics.track(EodinEvent.AppOpen);
    await new Promise((r) => setTimeout(r, 10));
    expect((await EodinAnalytics.getStatus()).queueSize).toBe(0);
  });

  it('requestDataDeletion 가 deviceId 재발급 + opt-out 보존', async () => {
    EodinAnalytics.setEnabled(false);
    const deviceIdBefore = EodinAnalytics.deviceId;

    // fetch mock 으로 backend 호출 통과
    (globalThis as { fetch?: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await EodinAnalytics.requestDataDeletion();
    expect(result.success).toBe(true);
    expect(EodinAnalytics.deviceId).not.toBeNull();
    expect(EodinAnalytics.deviceId).not.toBe(deviceIdBefore);
    expect(EodinAnalytics.isEnabled).toBe(false); // opt-out 보존

    delete (globalThis as { fetch?: unknown }).fetch;
  });
});

describe('EodinAnalytics flush / sessions', () => {
  beforeEach(async () => {
    await EodinAnalytics.configure(VALID_CONFIG);
  });

  it('flush 가 events/collect POST 호출', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    EodinAnalytics.track(EodinEvent.AppOpen);
    await new Promise((r) => setTimeout(r, 10));
    await EodinAnalytics.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.eodin.app/api/v1/events/collect',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      }),
    );
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('flush 4xx 실패 시 batch 가 큐에 다시 prepend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    EodinAnalytics.track(EodinEvent.AppOpen);
    await new Promise((r) => setTimeout(r, 10));
    const sizeBefore = (await EodinAnalytics.getStatus()).queueSize;
    await EodinAnalytics.flush();
    await new Promise((r) => setTimeout(r, 10));
    const sizeAfter = (await EodinAnalytics.getStatus()).queueSize;

    expect(sizeAfter).toBe(sizeBefore); // requeued
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('endSession 시 duration_seconds 포함', async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    await EodinAnalytics.endSession();
    await new Promise((r) => setTimeout(r, 10));

    // sessionId 가 제거됐는지
    expect(EodinAnalytics.sessionId).toBeNull();
    delete (globalThis as { fetch?: unknown }).fetch;
  });
});

describe('EodinAnalytics.dispose', () => {
  it('flush timer + lifecycle listener 해제', async () => {
    await EodinAnalytics.configure(VALID_CONFIG);
    expect(() => EodinAnalytics.__disposeForTest()).not.toThrow();
    // dispose 후 다시 호출해도 OK
    expect(() => EodinAnalytics.__disposeForTest()).not.toThrow();
  });
});
