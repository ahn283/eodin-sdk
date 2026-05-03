// S8 보안 정책 (메인 SDK Phase 1.6): SDK 의 모든 API endpoint 는 HTTPS 만 허용.
//
// dev 워크플로우 유지를 위해 loopback 주소의 `http://` 는 허용:
// - `localhost`, `127.0.0.1`
//
// 그 외 `http://` 주소는 `Error` throw — `configure()` 시점에 즉시 발견.
// cross-platform 정합 (메인 SDK M2): 입력은 `trim()` + scheme lowercase 비교.

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

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
