import { EodinEvent } from '../eodin-event';

// ----------------------------------------------------------------------------
// 1. Hard-coded wire string 검증 — 누가 enum 키를 바꿨을 때 wire string 도
//    silent 하게 바뀌면 cross-channel 호환성이 깨짐. 본 테스트가 회귀 가드.
// ----------------------------------------------------------------------------

describe('EodinEvent — wire string 정합성 (5채널 동일)', () => {
  it('Lifecycle 이벤트 wire string', () => {
    expect(EodinEvent.AppInstall).toBe('app_install');
    expect(EodinEvent.AppOpen).toBe('app_open');
    expect(EodinEvent.SessionResume).toBe('session_resume');
    expect(EodinEvent.SessionStart).toBe('session_start');
    expect(EodinEvent.SessionEnd).toBe('session_end');
  });

  it('Auth / Identity 이벤트 wire string', () => {
    expect(EodinEvent.SignUp).toBe('sign_up');
    expect(EodinEvent.SignIn).toBe('sign_in');
    expect(EodinEvent.SignOut).toBe('sign_out');
    expect(EodinEvent.AccountDelete).toBe('account_delete');
  });

  it('Onboarding 이벤트 wire string', () => {
    expect(EodinEvent.OnboardingStart).toBe('onboarding_start');
    expect(EodinEvent.OnboardingStep).toBe('onboarding_step');
    expect(EodinEvent.OnboardingComplete).toBe('onboarding_complete');
    expect(EodinEvent.OnboardingSkip).toBe('onboarding_skip');
  });

  it('Core / Monetization 이벤트 wire string', () => {
    expect(EodinEvent.CoreAction).toBe('core_action');
    expect(EodinEvent.PaywallView).toBe('paywall_view');
    expect(EodinEvent.PaywallDismiss).toBe('paywall_dismiss');
    expect(EodinEvent.SubscribeStart).toBe('subscribe_start');
    expect(EodinEvent.TrialStart).toBe('trial_start');
    expect(EodinEvent.SubscribeRenew).toBe('subscribe_renew');
    expect(EodinEvent.SubscriptionRestore).toBe('subscription_restore');
    expect(EodinEvent.IapPurchase).toBe('iap_purchase');
    expect(EodinEvent.DailyLimitReached).toBe('daily_limit_reached');
    expect(EodinEvent.DailyLimitDismiss).toBe('daily_limit_dismiss');
    expect(EodinEvent.DailyLimitUpgradeTap).toBe('daily_limit_upgrade_tap');
    expect(EodinEvent.PassView).toBe('pass_view');
    expect(EodinEvent.PassPurchase).toBe('pass_purchase');
    expect(EodinEvent.PassExpire).toBe('pass_expire');
  });

  it('Advertising 이벤트 wire string', () => {
    expect(EodinEvent.AdRewardedView).toBe('ad_rewarded_view');
    expect(EodinEvent.AdInterstitialView).toBe('ad_interstitial_view');
    expect(EodinEvent.AdNativeView).toBe('ad_native_view');
    expect(EodinEvent.AdClick).toBe('ad_click');
    expect(EodinEvent.AdLoadFailed).toBe('ad_load_failed');
    expect(EodinEvent.AdFreePass).toBe('ad_free_pass');
  });

  it('Social / Viral 이벤트 wire string', () => {
    expect(EodinEvent.Share).toBe('share');
    expect(EodinEvent.InviteShare).toBe('invite_share');
    expect(EodinEvent.InviteClaim).toBe('invite_claim');
    expect(EodinEvent.FriendAdd).toBe('friend_add');
  });

  it('iOS ATT 이벤트 wire string (web 에서 미사용이나 cross-channel 수신 대비 보존)', () => {
    expect(EodinEvent.AttPrompt).toBe('att_prompt');
    expect(EodinEvent.AttResponse).toBe('att_response');
  });

  it('Web 고유 — PageView (autoTrackPageView 시 자동 발생)', () => {
    expect(EodinEvent.PageView).toBe('page_view');
  });
});

// ----------------------------------------------------------------------------
// 2. Invariant gates (Android EodinEventTest.kt 와 동등 — M1 권고)
// ----------------------------------------------------------------------------

describe('EodinEvent — invariants', () => {
  const allValues = Object.values(EodinEvent);

  it('모든 wire string 은 snake_case', () => {
    const snakeCase = /^[a-z][a-z0-9_]*$/;
    for (const v of allValues) {
      expect(v).toMatch(snakeCase);
    }
  });

  it('모든 wire string 은 ≤40 자', () => {
    for (const v of allValues) {
      expect(v.length).toBeLessThanOrEqual(40);
    }
  });

  it('모든 wire string 은 유일 (중복 없음)', () => {
    const set = new Set(allValues);
    expect(set.size).toBe(allValues.length);
  });

  it('Phase 0.4 forbidden v1 event names 미포함', () => {
    // 메인 SDK Phase 0.4 event-schema-audit 에서 deprecate 된 이름 14건.
    // Wire string 으로 절대 나오면 안 됨 (회귀 가드).
    const forbidden = new Set([
      'app_install_event',
      'app_open_event',
      'session_resume_event',
      'session_start_event',
      'session_end_event',
      'sign_up_event',
      'sign_in_event',
      'sign_out_event',
      'paywall_event',
      'subscribe_event',
      'iap_event',
      'ad_event',
      'invite_event',
      'att_event',
    ]);
    for (const v of allValues) {
      expect(forbidden.has(v)).toBe(false);
    }
  });
});

// ----------------------------------------------------------------------------
// 3. Cross-channel parity — capacitor 의 EodinEvent 와 sdk-web 의 EodinEvent 가
//    공통 키에 대해 동일 wire string 인지 직접 비교.
// ----------------------------------------------------------------------------

describe('EodinEvent — capacitor 와 cross-channel parity', () => {
  // capacitor 패키지의 EodinEvent 를 직접 import. workspace symlink 경유.
  // capacitor 가 'capacitor' alias 로 노출되지 않으므로 상대 경로 사용 X —
  // require 로 동적 로드 (capacitor src 가 ts 라 ts-jest 컴파일).

  it('capacitor 와 공통 키는 wire string 동일', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const capacitorModule = require('../../../capacitor/src/eodin-event');
    const capacitorEvent: Record<string, string> = capacitorModule.EodinEvent;

    for (const [key, webValue] of Object.entries(EodinEvent)) {
      if (key === 'PageView') continue; // web 고유 — capacitor 에 없음
      expect(capacitorEvent[key]).toBe(webValue);
    }
  });

  it('web 고유 키는 capacitor 에 없음 (의도 — autoTrackPageView 의 web 한정)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const capacitorEvent: Record<string, string> = require('../../../capacitor/src/eodin-event').EodinEvent;
    expect(capacitorEvent.PageView).toBeUndefined();
  });
});
