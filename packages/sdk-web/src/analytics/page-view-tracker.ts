// Web 고유 — autoTrackPageView 옵션이 활성일 때 history API + popstate +
// hashchange 를 구독해 page_view 이벤트 자동 발생. 4채널 mobile SDK 에는
// 없는 web only 기능 (PRD §5.1 documented asymmetry).
//
// SPA 라우팅 (Next.js / React Router 등) 이 history.pushState / replaceState
// 를 호출하는 시점을 monkey-patch 로 가로채 page_view 발생.
//
// **Phase 3 review H1**: detach 클로저는 module-level 이 아니라 globalThis
// state 의 `pageViewDetach` 슬롯에 pin (dual-package 시 두 instance 가 각자
// detach 를 갖고 충돌하는 위험 차단).
//
// **Phase 3 review H3**: detach 시 patched 함수가 SDK 의 patched 와 동일한지
// 검증 후 원복. 다른 라이브러리 (Next.js / Vue Router 등) 가 위에 또 patch 한
// 경우 SDK detach 가 그것을 덮어쓰는 silent breakage 방지.

import { getState } from './state';

/**
 * Subscribe history navigation + return detach 함수. 이미 attached 상태면 기존
 * detach 를 먼저 호출 (idempotent).
 */
export function attachPageViewTracker(
  onPageView: (path: string, title?: string) => void,
): () => void {
  detachPageViewTracker();
  if (typeof window === 'undefined' || typeof history === 'undefined') {
    return () => {};
  }

  const state = getState();
  const fire = (): void => {
    onPageView(window.location.pathname + window.location.search, document.title);
  };

  // Patch pushState / replaceState — `history.*` 를 호출한 시점에 dispatch.
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  type HistoryStateMethod = typeof history.pushState;
  const patched: HistoryStateMethod = function (this: History, ...args: Parameters<HistoryStateMethod>) {
    const result = origPush.apply(this, args);
    fire();
    return result;
  };
  const patchedReplace: HistoryStateMethod = function (this: History, ...args: Parameters<HistoryStateMethod>) {
    const result = origReplace.apply(this, args);
    fire();
    return result;
  };

  history.pushState = patched;
  history.replaceState = patchedReplace;

  window.addEventListener('popstate', fire);
  window.addEventListener('hashchange', fire);

  state.pageViewDetach = () => {
    // H3: 다른 라이브러리가 위에 또 patch 했다면 우리의 patched 함수가 아닌
    // 다른 함수가 history.pushState 에 있을 수 있음. 우리의 patched 와 같을
    // 때만 원복 — 그렇지 않으면 silent breakage.
    if (history.pushState === patched) {
      history.pushState = origPush;
    }
    if (history.replaceState === patchedReplace) {
      history.replaceState = origReplace;
    }
    window.removeEventListener('popstate', fire);
    window.removeEventListener('hashchange', fire);
    state.pageViewDetach = null;
  };

  return state.pageViewDetach;
}

export function detachPageViewTracker(): void {
  const state = getState();
  if (state.pageViewDetach) state.pageViewDetach();
}
