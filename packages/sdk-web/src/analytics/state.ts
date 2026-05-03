// EodinAnalytics 의 module-level state 를 globalThis 에 pin 한다. 같은 패키지가
// dual export (cjs + esm) 로 두 번 evaluate 되어도 state 는 단일 instance —
// dual-package hazard 차단 (Phase 1.1 review H1, Phase 3 결정).
//
// **Phase 3 review H1 — pin 범위 확장**: 단순 state 외에 `queue` (EventQueue
// 인스턴스) / `pageViewDetach` (page-view-tracker 의 detach 클로저) 도 module
// instance 분리 시 영향. 모두 globalThis 에 pin.
//
// 패턴 참고: React 의 `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`,
// Apollo Client 의 globalThis singleton.

import { EventQueue } from '../internal/event-queue';
import type { Attribution, AnalyticsConfigureOptions } from './types';

const STATE_KEY = '__eodin_analytics_state__';

export interface AnalyticsState {
  apiEndpoint: string | null;
  apiKey: string | null;
  appId: string | null;
  debug: boolean;
  offlineMode: boolean;
  autoTrackPageView: boolean;
  flushTimer: ReturnType<typeof setInterval> | null;
  lifecycleAttached: boolean;
  /** 호스트가 setAttribution 으로 주입한 attribution (camelCase). */
  attributionInMemory: Attribution | null;
  /** Phase 3 review H1 — globalThis pin 으로 module instance 분리 차단. */
  queue: EventQueue | null;
  /** page-view-tracker detach 클로저. dispose 시 호출. */
  pageViewDetach: (() => void) | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __eodin_analytics_state__: AnalyticsState | undefined;
}

function defaultState(): AnalyticsState {
  return {
    apiEndpoint: null,
    apiKey: null,
    appId: null,
    debug: false,
    offlineMode: true,
    autoTrackPageView: false,
    flushTimer: null,
    lifecycleAttached: false,
    attributionInMemory: null,
    queue: null,
    pageViewDetach: null,
  };
}

/**
 * Lazily-initialised queue. State pin 은 dual-package 분리 차단. 호출자가
 * onQuotaExceeded 콜백을 주입할 수 있도록 첫 호출 시 callback 을 같이 받음.
 */
export function getQueue(onQuotaExceeded?: (msg: string) => void): EventQueue {
  const state = getState();
  if (state.queue === null) {
    state.queue = new EventQueue(undefined, onQuotaExceeded);
  }
  return state.queue;
}

export function getState(): AnalyticsState {
  const g = globalThis as { [STATE_KEY]?: AnalyticsState };
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = defaultState();
  }
  return g[STATE_KEY]!;
}

export function applyConfigureOptions(
  state: AnalyticsState,
  options: AnalyticsConfigureOptions,
): void {
  state.apiEndpoint = options.apiEndpoint.replace(/\/$/, '');
  state.apiKey = options.apiKey;
  state.appId = options.appId;
  state.debug = options.debug ?? false;
  state.offlineMode = options.offlineMode ?? true;
  state.autoTrackPageView = options.autoTrackPageView ?? false;
}

export function isConfigured(state: AnalyticsState): boolean {
  return state.apiEndpoint !== null && state.apiKey !== null && state.appId !== null;
}

/**
 * 테스트 전용 — state 를 default 로 리셋. 단위 테스트의 isolation 확보.
 * Production 코드는 호출하지 말 것.
 */
export function __resetStateForTest(): void {
  const g = globalThis as { [STATE_KEY]?: AnalyticsState };
  g[STATE_KEY] = defaultState();
}
