import {
  attachPageViewTracker,
  detachPageViewTracker,
} from '../analytics/page-view-tracker';
import { __resetStateForTest } from '../analytics/state';

beforeEach(() => {
  __resetStateForTest();
  detachPageViewTracker();
});

afterEach(() => {
  detachPageViewTracker();
});

describe('attachPageViewTracker', () => {
  it('history.pushState 호출 시 콜백 발생', () => {
    const cb = jest.fn();
    attachPageViewTracker(cb);
    history.pushState({}, '', '/foo');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toContain('/foo');
  });

  it('history.replaceState 호출 시 콜백 발생', () => {
    const cb = jest.fn();
    attachPageViewTracker(cb);
    history.replaceState({}, '', '/bar');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('popstate 이벤트 시 콜백 발생', () => {
    const cb = jest.fn();
    attachPageViewTracker(cb);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(cb).toHaveBeenCalled();
  });

  it('hashchange 이벤트 시 콜백 발생', () => {
    const cb = jest.fn();
    attachPageViewTracker(cb);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(cb).toHaveBeenCalled();
  });
});

describe('detachPageViewTracker', () => {
  it('detach 후 history.pushState 가 콜백 호출 안 함', () => {
    const cb = jest.fn();
    attachPageViewTracker(cb);
    detachPageViewTracker();
    history.pushState({}, '', '/baz');
    expect(cb).not.toHaveBeenCalled();
  });

  it('SDK 의 patched 가 아닌 다른 함수가 history.pushState 에 있으면 원복하지 않음 (H3 — 라우터 충돌 방지)', () => {
    const sdkCb = jest.fn();
    attachPageViewTracker(sdkCb);

    // 다른 라이브러리가 위에 또 patch
    const sdkPatched = history.pushState;
    const otherLib: typeof history.pushState = function (
      this: History,
      ...args: Parameters<typeof history.pushState>
    ) {
      // call SDK's patched (which calls origPush + sdkCb)
      return sdkPatched.apply(this, args);
    };
    history.pushState = otherLib;

    detachPageViewTracker();

    // detach 후에도 history.pushState 는 otherLib 그대로 — SDK 가 덮어쓰지 않음
    expect(history.pushState).toBe(otherLib);
  });

  it('detach 가 두 번 호출되어도 안전 (idempotent)', () => {
    const cb = jest.fn();
    attachPageViewTracker(cb);
    expect(() => {
      detachPageViewTracker();
      detachPageViewTracker();
    }).not.toThrow();
  });

  it('attach 두 번 호출되면 이전 detach 후 새로 attach', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    attachPageViewTracker(cb1);
    attachPageViewTracker(cb2);
    history.pushState({}, '', '/two');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });
});
