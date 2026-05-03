import { validateEndpoint } from '../internal/endpoint-validator';

// 4채널 SDK Phase 1.6 S8 와 의미 parity. capacitor 의 endpoint-validator.test.ts
// 와 동일 케이스를 그대로 cover (web 환경 한정 — 10.0.2.2 emulator 주소 dev 도
// reject).

describe('validateEndpoint — accepted', () => {
  it('https:// passes', () => {
    expect(() => validateEndpoint('https://api.eodin.app/api/v1')).not.toThrow();
    expect(() =>
      validateEndpoint('https://api-staging.eodin.app/api/v1'),
    ).not.toThrow();
    expect(() =>
      validateEndpoint('https://api.eodin.app:443/api/v1'),
    ).not.toThrow();
  });

  it('http://localhost / 127.0.0.1 passes (dev only)', () => {
    expect(() =>
      validateEndpoint('http://localhost:3005/api/v1'),
    ).not.toThrow();
    expect(() =>
      validateEndpoint('http://127.0.0.1:3005/api/v1'),
    ).not.toThrow();
  });

  it('case-insensitive scheme', () => {
    expect(() => validateEndpoint('HTTPS://api.eodin.app/api/v1')).not.toThrow();
    expect(() =>
      validateEndpoint('Http://localhost:3005/api/v1'),
    ).not.toThrow();
  });

  it('whitespace trimmed', () => {
    expect(() =>
      validateEndpoint('  https://api.eodin.app/api/v1  '),
    ).not.toThrow();
  });
});

describe('validateEndpoint — rejected', () => {
  it('plain http on non-loopback throws', () => {
    expect(() => validateEndpoint('http://api.eodin.app/api/v1')).toThrow(/HTTPS/);
    expect(() =>
      validateEndpoint('http://attacker.example.com/collect'),
    ).toThrow();
  });

  it('http://10.0.2.2 always rejected on web (mobile-only emulator address)', () => {
    expect(() =>
      validateEndpoint('http://10.0.2.2:3005/api/v1'),
    ).toThrow();
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
    // 메인 SDK open-issues §4.6 — host 화이트리스트 미구현 (의도적 현상태)
    expect(() =>
      validateEndpoint('https://api.eodin.app.attacker.com'),
    ).not.toThrow();
  });

  it('paramName 인자가 메시지에 반영', () => {
    expect(() => validateEndpoint('http://attacker.com', 'apiUrl')).toThrow(
      /apiUrl/,
    );
  });
});
