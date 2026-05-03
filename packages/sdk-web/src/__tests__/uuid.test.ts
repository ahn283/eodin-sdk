import { uuid } from '../internal/uuid';

describe('uuid', () => {
  it('returns a string of length 36', () => {
    const id = uuid();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(36);
  });

  it('matches RFC4122 v4 pattern (jsdom + Node 14.17+ provide crypto.randomUUID)', () => {
    const id = uuid();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('produces unique values across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(uuid());
    expect(seen.size).toBe(1000);
  });
});
