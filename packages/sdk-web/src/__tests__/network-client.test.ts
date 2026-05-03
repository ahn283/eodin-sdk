import { fetchWithTimeout, isOnline, sendBeacon } from '../internal/network-client';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('passes through input and init to fetch', async () => {
    const response = { ok: true, status: 200, json: async () => ({}) } as Response;
    (globalThis.fetch as jest.Mock).mockResolvedValue(response);

    const result = await fetchWithTimeout('https://example.com', { method: 'GET' }, 1000);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toBe(response);
  });

  it('attaches AbortSignal when AbortController is available', async () => {
    const response = { ok: true, status: 200, json: async () => ({}) } as Response;
    (globalThis.fetch as jest.Mock).mockResolvedValue(response);

    await fetchWithTimeout('https://example.com', {}, 1000);

    const call = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(call[1]).toHaveProperty('signal');
  });

  it('aborts when timeout elapses (using fake timers)', async () => {
    jest.useFakeTimers();
    (globalThis.fetch as jest.Mock).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    const promise = fetchWithTimeout('https://example.com', {}, 100);
    jest.advanceTimersByTime(150);

    await expect(promise).rejects.toThrow('aborted');
    jest.useRealTimers();
  });
});

describe('sendBeacon', () => {
  it('returns false when navigator.sendBeacon unavailable', () => {
    const original = navigator.sendBeacon;
    delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    try {
      expect(sendBeacon('https://example.com', { foo: 'bar' })).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'sendBeacon', {
        value: original,
        configurable: true,
      });
    }
  });

  it('returns navigator.sendBeacon return value', () => {
    const beaconMock = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconMock,
      configurable: true,
    });
    try {
      expect(sendBeacon('https://example.com', { foo: 'bar' })).toBe(true);
      expect(beaconMock).toHaveBeenCalledWith('https://example.com', expect.any(Blob));
    } finally {
      Object.defineProperty(navigator, 'sendBeacon', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('sendBeacon throw → false', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: () => {
        throw new Error('beacon failure');
      },
      configurable: true,
    });
    try {
      expect(sendBeacon('https://example.com', { foo: 'bar' })).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'sendBeacon', {
        value: undefined,
        configurable: true,
      });
    }
  });
});

describe('isOnline', () => {
  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    expect(isOnline()).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(isOnline()).toBe(false);
  });
});
