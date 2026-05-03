// Storage 추상화 — localStorage 직접 호출 대신 본 모듈 경유. 테스트 isolation
// 과 SSR/Node 환경에서 typeof guard 처리를 한 곳에서 담당.

export const STORAGE_KEYS = {
  deviceId: 'eodin_device_id',
  userId: 'eodin_user_id',
  sessionId: 'eodin_session_id',
  sessionStart: 'eodin_session_start',
  attribution: 'eodin_attribution',
  enabled: 'eodin_enabled',
  queue: 'eodin_event_queue',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readStorage(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

export function writeStorage(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}

export function removeStorage(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

// QuotaExceededError 식별 — 브라우저별 명칭 / code 차이 흡수.
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  ) {
    return true;
  }
  const code = (error as { code?: number }).code;
  return code === 22 || code === 1014;
}
