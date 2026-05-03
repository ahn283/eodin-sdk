// Internal subpath barrel — `@eodin/web/internal` 으로 import.
//
// **For first-party use only** (예: `@eodin/capacitor` 의 web fallback 어댑터).
// 외부 사용자는 본 subpath 를 import 하지 말 것 — 본 모듈의 시그니처는
// SemVer 의 minor / patch 에서도 변경될 수 있다 (public surface 가 아님).
//
// Public surface 는 `@eodin/web` (root entry, src/index.ts) 만.

export { STORAGE_KEYS, isQuotaError, readStorage, removeStorage, writeStorage } from './storage';
export type { StorageKey } from './storage';

export { uuid } from './uuid';

export { validateEndpoint } from './endpoint-validator';

export { EventQueue } from './event-queue';
export type { QueuedEvent } from './event-queue';

export { fetchWithTimeout, isOnline, sendBeacon } from './network-client';
