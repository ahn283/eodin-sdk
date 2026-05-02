import { validateEndpoint } from '../web';

describe('validateEndpoint — accepted', () => {
  it('https:// passes', () => {
    expect(() => validateEndpoint('https://api.eodin.app/api/v1')).not.toThrow();
    expect(() => validateEndpoint('https://api-staging.eodin.app/api/v1')).not.toThrow();
    expect(() => validateEndpoint('https://api.eodin.app:443/api/v1')).not.toThrow();
  });

  it('http://localhost / 127.0.0.1 passes', () => {
    expect(() => validateEndpoint('http://localhost:3005/api/v1')).not.toThrow();
    expect(() => validateEndpoint('http://127.0.0.1:3005/api/v1')).not.toThrow();
  });

  it('case-insensitive scheme', () => {
    expect(() => validateEndpoint('HTTPS://api.eodin.app/api/v1')).not.toThrow();
    expect(() => validateEndpoint('Http://localhost:3005/api/v1')).not.toThrow();
  });

  it('whitespace trimmed', () => {
    expect(() => validateEndpoint('  https://api.eodin.app/api/v1  ')).not.toThrow();
  });
});

describe('validateEndpoint — rejected', () => {
  it('plain http on non-loopback throws', () => {
    expect(() => validateEndpoint('http://api.eodin.app/api/v1')).toThrow(/HTTPS/);
    expect(() => validateEndpoint('http://attacker.example.com/collect')).toThrow();
  });

  it('http://10.0.2.2 always rejected on web (mobile-only address)', () => {
    expect(() => validateEndpoint('http://10.0.2.2:3005/api/v1')).toThrow();
  });

  it('empty / whitespace-only throws', () => {
    expect(() => validateEndpoint('')).toThrow(/empty/);
    expect(() => validateEndpoint('   ')).toThrow(/empty/);
  });

  it('non-URL string throws', () => {
    expect(() => validateEndpoint('not-a-url')).toThrow();
    expect(() => validateEndpoint('https://')).toThrow();
  });

  it('unsupported scheme (ftp, ws, file) throws', () => {
    expect(() => validateEndpoint('ftp://api.eodin.app')).toThrow();
    expect(() => validateEndpoint('ws://api.eodin.app')).toThrow();
    expect(() => validateEndpoint('file:///etc/passwd')).toThrow();
  });

  it('confusable host like api.eodin.app.attacker.com is HTTPS so passes (host whitelist 보류)', () => {
    // 현재 동작 — host 화이트리스트는 open-issues §4.6 으로 보류
    expect(() => validateEndpoint('https://api.eodin.app.attacker.com')).not.toThrow();
  });
});

describe('configure() integration — fail-silent for tracking calls', () => {
  // Phase 1.6 (S8) 회귀 가드: configure 만 throw, 다른 호출 (track 등)
  // 은 fail-silent 정책 유지. 자세한 fail-silent 검증은 web.test.ts 의
  // configure 가 안 된 상태에서 track 호출 케이스가 이미 cover.

  it('validateEndpoint is the same function imported from web.ts', () => {
    expect(typeof validateEndpoint).toBe('function');
  });
});
