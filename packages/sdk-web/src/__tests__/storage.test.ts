import {
  STORAGE_KEYS,
  isQuotaError,
  readStorage,
  removeStorage,
  writeStorage,
} from '../internal/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('STORAGE_KEYS', () => {
  it('exposes all 4채널 SDK 와 동일한 wire keys', () => {
    expect(STORAGE_KEYS.deviceId).toBe('eodin_device_id');
    expect(STORAGE_KEYS.userId).toBe('eodin_user_id');
    expect(STORAGE_KEYS.sessionId).toBe('eodin_session_id');
    expect(STORAGE_KEYS.sessionStart).toBe('eodin_session_start');
    expect(STORAGE_KEYS.attribution).toBe('eodin_attribution');
    expect(STORAGE_KEYS.enabled).toBe('eodin_enabled');
    expect(STORAGE_KEYS.queue).toBe('eodin_event_queue');
  });
});

describe('readStorage / writeStorage / removeStorage', () => {
  it('write then read returns the same string', () => {
    writeStorage('foo', 'bar');
    expect(readStorage('foo')).toBe('bar');
  });

  it('read returns null when key missing', () => {
    expect(readStorage('missing')).toBeNull();
  });

  it('remove deletes the key', () => {
    writeStorage('foo', 'bar');
    removeStorage('foo');
    expect(readStorage('foo')).toBeNull();
  });

  it('overwrite replaces previous value', () => {
    writeStorage('foo', 'one');
    writeStorage('foo', 'two');
    expect(readStorage('foo')).toBe('two');
  });
});

describe('isQuotaError', () => {
  it('matches QuotaExceededError name', () => {
    const err = new Error('quota');
    err.name = 'QuotaExceededError';
    expect(isQuotaError(err)).toBe(true);
  });

  it('matches Firefox legacy NS_ERROR_DOM_QUOTA_REACHED', () => {
    const err = new Error('quota');
    err.name = 'NS_ERROR_DOM_QUOTA_REACHED';
    expect(isQuotaError(err)).toBe(true);
  });

  it('matches code 22 (older WebKit)', () => {
    const err = new Error('quota') as Error & { code?: number };
    err.code = 22;
    expect(isQuotaError(err)).toBe(true);
  });

  it('matches code 1014 (older Firefox)', () => {
    const err = new Error('quota') as Error & { code?: number };
    err.code = 1014;
    expect(isQuotaError(err)).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isQuotaError(new Error('other'))).toBe(false);
    expect(isQuotaError('string')).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});
