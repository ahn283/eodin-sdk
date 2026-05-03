import {
  STORAGE_KEYS,
  isQuotaError,
  readStorage,
  removeStorage,
  writeStorage,
} from './storage';

// `events/collect` 백엔드 wire schema 와 정합. 4채널 SDK 와 동일 필드.
export interface QueuedEvent {
  event_id: string;
  event_name: string;
  app_id: string;
  device_id: string;
  user_id: string | null;
  session_id: string | null;
  timestamp: string;
  attribution?: Record<string, string | undefined>;
  properties?: Record<string, unknown>;
}

const QUEUE_LOCK_NAME = 'eodin_event_queue_lock';

/** Optional observability hook — quota drop / 큐 키 제거 시점에 호출. */
export type EventQueueLogger = (message: string) => void;

interface LockManagerLike {
  request(name: string, callback: () => Promise<void>): Promise<void>;
}

/**
 * localStorage 기반 offline-first 큐. 4채널 EventQueue (Hive / UserDefaults /
 * SharedPreferences / localStorage) 와 의미 parity.
 *
 * Multi-tab safety: Web Locks API (`navigator.locks`) 가 가용하면 read-modify-
 * write 를 직렬화. 미가용 환경 (older browsers / non-secure context / test env)
 * 에서는 fallback 으로 직접 read-modify-write — single-tab 에서는 정확,
 * multi-tab 에서는 lost-update 위험이 있고 README 에 명시.
 */
export class EventQueue {
  /**
   * @param storageKey localStorage key. 기본 `STORAGE_KEYS.queue`.
   * @param onQuotaExceeded quota drop / 큐 키 제거 시점에 호출 (관측성 콜백).
   */
  constructor(
    private readonly storageKey: string = STORAGE_KEYS.queue,
    private readonly onQuotaExceeded?: EventQueueLogger,
  ) {}

  read(): QueuedEvent[] {
    const raw = readStorage(this.storageKey);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
    } catch {
      return [];
    }
  }

  size(): number {
    return this.read().length;
  }

  /**
   * Quota-aware write. localStorage 에 들어가지 않는 양이면 oldest 부터 절반씩
   * drop 하며 재시도. 마지막 수단으로 큐 키 자체를 제거. 의도: newest events
   * 보존 (현재 사용자 액션과 가까울수록 가치 높음).
   */
  write(events: QueuedEvent[]): void {
    const serialised = JSON.stringify(events);
    try {
      writeStorage(this.storageKey, serialised);
    } catch (error) {
      if (isQuotaError(error)) {
        let trimmed = events;
        while (trimmed.length > 0) {
          const dropCount = Math.max(1, Math.floor(trimmed.length / 2));
          trimmed = trimmed.slice(dropCount);
          try {
            writeStorage(this.storageKey, JSON.stringify(trimmed));
            const dropped = events.length - trimmed.length;
            this.onQuotaExceeded?.(
              `Queue quota exceeded — dropped ${dropped} oldest events`,
            );
            return;
          } catch (retryError) {
            if (!isQuotaError(retryError)) throw retryError;
          }
        }
        // 빈 배열도 실패 → 큐 키 제거. storage 헬퍼 경유 (M2 — 같은 모듈 내
        // 일관성 유지). storage 미가용 환경에서는 removeStorage 가 no-op.
        try {
          removeStorage(this.storageKey);
        } catch {
          // storage 자체 미가용 — silent drop.
        }
        this.onQuotaExceeded?.('Queue dropped entirely — localStorage exhausted');
        return;
      }
      throw error;
    }
  }

  /**
   * read-modify-write 직렬화. mutator 가 반환한 새 큐 배열을 그대로 write.
   *
   * **트림 정책 — 호출자 책임**: 본 메서드는 maxSize trim 을 강제하지 않는다.
   * track() 처럼 일반 enqueue 경로는 mutator 안에서 명시적으로 oldest trim
   * 을 수행하고, requeueBatch() (flush 실패 retry) 같은 경로는 일시적으로
   * maxSize 를 초과해도 batch 보존이 우선 — 다음 track() 호출에서 자연
   * trim. (Phase 2 review H1 — universal trim 이 prepend-pattern requeue 와
   * 충돌해 batch 통째로 drop 되던 회귀 수정.)
   */
  async withLock(
    mutator: (queue: QueuedEvent[]) => QueuedEvent[],
  ): Promise<void> {
    const apply = (): void => {
      const next = mutator(this.read());
      this.write(next);
    };

    const locks = this.getLockManager();
    if (locks) {
      await locks.request(QUEUE_LOCK_NAME, async () => {
        apply();
      });
      return;
    }
    apply();
  }

  /** 테스트 용도 — Web Locks API 가용성 점검. */
  hasLockManager(): boolean {
    return this.getLockManager() !== null;
  }

  private getLockManager(): LockManagerLike | null {
    if (typeof navigator === 'undefined') return null;
    const nav = navigator as Navigator & { locks?: LockManagerLike };
    if (!nav.locks || typeof nav.locks.request !== 'function') return null;
    return nav.locks;
  }
}
