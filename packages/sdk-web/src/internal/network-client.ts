// Network 헬퍼 — fetch + sendBeacon. 환경별 typeof guard 로 Node/SSR 안전.

const DEFAULT_FETCH_TIMEOUT_MS = 10 * 1000;

/**
 * fetch with AbortController-based timeout. AbortController 미가용 환경
 * (very old browsers / Node 14 미만) 에서는 그대로 fetch 호출.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
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

/**
 * navigator.sendBeacon wrapper — page unload 시 비동기 fetch 가 cancel 되는
 * 문제를 회피. JSON payload + Blob 으로 전송. sendBeacon 미가용이거나 실패
 * 시 false.
 */
export function sendBeacon(url: string, payload: unknown): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
