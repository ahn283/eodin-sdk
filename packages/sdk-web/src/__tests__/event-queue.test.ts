import { EventQueue, type QueuedEvent } from '../internal/event-queue';
import { STORAGE_KEYS } from '../internal/storage';

beforeEach(() => {
  localStorage.clear();
});

function makeEvent(overrides: Partial<QueuedEvent> = {}): QueuedEvent {
  return {
    event_id: 'evt-' + Math.random().toString(36).slice(2),
    event_name: 'test_event',
    app_id: 'app-1',
    device_id: 'dev-1',
    user_id: null,
    session_id: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('EventQueue.read', () => {
  it('returns empty array when storage missing', () => {
    expect(new EventQueue().read()).toEqual([]);
  });

  it('returns parsed array when storage has valid JSON', () => {
    const events = [makeEvent(), makeEvent()];
    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(events));
    expect(new EventQueue().read()).toEqual(events);
  });

  it('returns empty array when storage has corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEYS.queue, '{not-valid-json}');
    expect(new EventQueue().read()).toEqual([]);
  });

  it('returns empty array when storage has non-array JSON', () => {
    localStorage.setItem(STORAGE_KEYS.queue, '"a string"');
    expect(new EventQueue().read()).toEqual([]);
  });
});

describe('EventQueue.write + size', () => {
  it('persists events to localStorage', () => {
    const queue = new EventQueue();
    const events = [makeEvent(), makeEvent()];
    queue.write(events);
    expect(queue.read()).toEqual(events);
    expect(queue.size()).toBe(2);
  });

  it('quota error → halving 으로 oldest drop, newest 보존', () => {
    const queue = new EventQueue();
    // halving 로직: 10 → drop 5 → trimmed=5 → 또 quota → drop 2 → trimmed=3 → 통과
    // capacitor 원본 web.ts:572-587 의 dropCount = max(1, floor(N/2)).
    const realSetItem = Storage.prototype.setItem;
    let attempts = 0;
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        attempts++;
        if (key === STORAGE_KEYS.queue && attempts < 3) {
          const err = new Error('quota');
          err.name = 'QuotaExceededError';
          throw err;
        }
        return realSetItem.call(this, key, value);
      });

    // event_name 으로 oldest/newest 식별이 가능하도록 부여.
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ event_name: `e${i}` }),
    );
    queue.write(events);
    setItemSpy.mockRestore();

    // 10 → halving 두 번 (10→5→3) 후 3 개 남음 — newest 3 보존 (e7/e8/e9)
    const remaining = queue.read();
    expect(remaining.length).toBe(3);
    expect(remaining.map((e) => e.event_name)).toEqual(['e7', 'e8', 'e9']);
  });

  it('quota error 가 모든 halving 시도에서 발생 → 큐 키 자체 제거 (마지막 수단)', () => {
    const queue = new EventQueue();
    queue.write([makeEvent()]); // pre-existing entry
    expect(queue.size()).toBe(1);

    // 모든 setItem 을 quota error 로 강제. removeItem 은 정상 동작.
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      });
    const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');

    const events = Array.from({ length: 10 }, () => makeEvent());
    queue.write(events);

    // removeItem 이 큐 키로 호출됐는지 확인 — storage 헬퍼 경유 (M2 fix).
    expect(removeSpy).toHaveBeenCalledWith(STORAGE_KEYS.queue);
    setItemSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('EventQueue.withLock', () => {
  it('mutator 가 반환한 큐를 저장', async () => {
    const queue = new EventQueue();
    await queue.withLock(() => [makeEvent({ event_name: 'a' }), makeEvent({ event_name: 'b' })]);
    const events = queue.read();
    expect(events.map((e) => e.event_name)).toEqual(['a', 'b']);
  });

  it('mutator 가 빈 배열 반환 시 큐 비움', async () => {
    const queue = new EventQueue();
    queue.write([makeEvent(), makeEvent(), makeEvent()]);
    await queue.withLock(() => []);
    expect(queue.size()).toBe(0);
  });

  it('maxSize trim 은 호출자 책임 (Phase 2 review H1) — withLock 자체는 mutator 결과 그대로 저장', async () => {
    const queue = new EventQueue();
    await queue.withLock(() =>
      Array.from({ length: 10 }, (_, i) => makeEvent({ event_name: `e${i}` })),
    );
    expect(queue.size()).toBe(10);
    // 호출자가 mutator 안에서 trim 해야 함 (track callsite 의 책임)
    await queue.withLock((current) => current.slice(current.length - 3));
    const events = queue.read();
    expect(events.map((e) => e.event_name)).toEqual(['e7', 'e8', 'e9']);
  });

  it('Web Locks API 미가용 환경에서도 정상 동작 (jsdom 은 navigator.locks 없음)', async () => {
    const queue = new EventQueue();
    expect(queue.hasLockManager()).toBe(false);
    await queue.withLock(() => [makeEvent()]);
    expect(queue.size()).toBe(1);
  });
});

describe('EventQueue.onQuotaExceeded callback (Phase 2 review H2)', () => {
  it('quota drop 시 콜백 호출 — dropped 개수 메시지', () => {
    const messages: string[] = [];
    const queue = new EventQueue(STORAGE_KEYS.queue, (msg) => messages.push(msg));

    const realSetItem = Storage.prototype.setItem;
    let attempts = 0;
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        attempts++;
        if (key === STORAGE_KEYS.queue && attempts < 3) {
          const err = new Error('quota');
          err.name = 'QuotaExceededError';
          throw err;
        }
        return realSetItem.call(this, key, value);
      });

    const events = Array.from({ length: 10 }, () => makeEvent());
    queue.write(events);
    setItemSpy.mockRestore();

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatch(/dropped \d+ oldest events/);
  });

  it('큐 키 자체 제거 시 별도 메시지', () => {
    const messages: string[] = [];
    const queue = new EventQueue(STORAGE_KEYS.queue, (msg) => messages.push(msg));

    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      });

    const events = Array.from({ length: 10 }, () => makeEvent());
    queue.write(events);
    setItemSpy.mockRestore();

    expect(messages.some((m) => m.includes('dropped entirely'))).toBe(true);
  });

  it('콜백 미지정 시에도 정상 동작 (silent drop)', () => {
    const queue = new EventQueue();
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, _value: string) {
        if (key === STORAGE_KEYS.queue) {
          const err = new Error('quota');
          err.name = 'QuotaExceededError';
          throw err;
        }
      });
    expect(() => queue.write([makeEvent(), makeEvent()])).not.toThrow();
    setItemSpy.mockRestore();
  });
});
