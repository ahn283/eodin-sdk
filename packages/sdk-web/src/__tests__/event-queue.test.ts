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

  it('maxSize 초과 시 oldest 부터 trim', async () => {
    const queue = new EventQueue(STORAGE_KEYS.queue, /* maxSize */ 3);
    await queue.withLock(() =>
      Array.from({ length: 10 }, (_, i) => makeEvent({ event_name: `e${i}` })),
    );
    const events = queue.read();
    expect(events.length).toBe(3);
    // newest 3 은 e7, e8, e9 가 남아야 함 (oldest trim)
    expect(events.map((e) => e.event_name)).toEqual(['e7', 'e8', 'e9']);
  });

  it('Web Locks API 미가용 환경에서도 정상 동작 (jsdom 은 navigator.locks 없음)', async () => {
    const queue = new EventQueue();
    expect(queue.hasLockManager()).toBe(false);
    await queue.withLock(() => [makeEvent()]);
    expect(queue.size()).toBe(1);
  });
});
