import { EodinEvent } from '../eodin-event';

// Mock the Capacitor bridge so we can assert wire-format passed to the plugin.
jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(() => ({
    track: jest.fn().mockResolvedValue(undefined),
    identify: jest.fn().mockResolvedValue(undefined),
    configure: jest.fn().mockResolvedValue(undefined),
    clearIdentity: jest.fn().mockResolvedValue(undefined),
    setAttribution: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined),
    startSession: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
    requestTrackingAuthorization: jest.fn().mockResolvedValue({ status: 'authorized' }),
    getATTStatus: jest.fn().mockResolvedValue({ status: 'authorized' }),
    getStatus: jest.fn().mockResolvedValue({}),
  })),
}));

describe('EodinEvent', () => {
  it('event values are snake_case wire format', () => {
    expect(EodinEvent.AppOpen).toBe('app_open');
    expect(EodinEvent.SubscribeStart).toBe('subscribe_start');
    expect(EodinEvent.AccountDelete).toBe('account_delete');
    expect(EodinEvent.AdRewardedView).toBe('ad_rewarded_view');
    expect(EodinEvent.AdInterstitialView).toBe('ad_interstitial_view');
    expect(EodinEvent.DailyLimitReached).toBe('daily_limit_reached');
    expect(EodinEvent.DailyLimitUpgradeTap).toBe('daily_limit_upgrade_tap');
    expect(EodinEvent.PassPurchase).toBe('pass_purchase');
  });

  it('all values use snake_case and are within 40 chars', () => {
    const pattern = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
    for (const [key, value] of Object.entries(EodinEvent)) {
      expect(pattern.test(value)).toBe(true);
      expect(value.length).toBeLessThanOrEqual(40);
      expect(typeof value).toBe('string');
      // sanity: key is PascalCase
      expect(/^[A-Z][a-zA-Z0-9]*$/.test(key)).toBe(true);
    }
  });

  it('all values are unique', () => {
    const values = Object.values(EodinEvent);
    expect(new Set(values).size).toBe(values.length);
  });

  it('does not contain forbidden v1 names', () => {
    // Phase 0.4 audit: these v1 names violate naming rules.
    // EodinEvent should NOT include them; v2 migration replaces.
    const forbidden = new Set([
      'subscription_purchase_completed',
      'subscription_trial_started',
      'subscription_restored',
      'paywall_dismissed',
      'ad_clicked',
      'ad_failed',
      'rewarded_ad_attempt',
      'rewarded_ad_complete',
      'interstitial_ad_shown',
      'native_ad_shown',
      'login',
      'auth_logout',
      'auth_account_deleted',
      'onboarding_skipped',
    ]);
    const used = new Set<string>(Object.values(EodinEvent));
    for (const name of forbidden) {
      expect(used.has(name)).toBe(false);
    }
  });
});

describe('EodinAnalytics.track wire-format integration', () => {
  // M4 guard: ensures the positional wrapper passes the snake_case wire-format
  // (not the PascalCase symbol name) to the underlying bridge. Catches the
  // common regression where a developer passes `event.name` (Dart-builtin
  // getter equivalent in TS would be `Object.keys(EodinEvent).find(...)`) or
  // changes the field name on the enum.
  let bridge: { track: jest.Mock };
  let EodinAnalytics: { track: (e: string, p?: Record<string, unknown>) => Promise<void> };

  beforeEach(() => {
    jest.resetModules();
    const core = require('@capacitor/core') as {
      registerPlugin: jest.Mock;
    };
    EodinAnalytics = require('../index').EodinAnalytics;
    // Last registerPlugin call is for EodinAnalytics (after EodinDeeplink),
    // and its return value is the bridge proxy our wrapper delegates to.
    const calls = core.registerPlugin.mock.results;
    bridge = calls[calls.length - 1].value as { track: jest.Mock };
  });

  it('forwards EodinEvent.AppOpen as wire-format "app_open"', async () => {
    await EodinAnalytics.track(EodinEvent.AppOpen);
    expect(bridge.track).toHaveBeenCalledWith({
      eventName: 'app_open',
      properties: undefined,
    });
  });

  it('forwards EodinEvent.SubscribeStart with properties intact', async () => {
    await EodinAnalytics.track(EodinEvent.SubscribeStart, {
      plan: 'monthly',
      price: 9900,
      currency: 'KRW',
    });
    expect(bridge.track).toHaveBeenCalledWith({
      eventName: 'subscribe_start',
      properties: { plan: 'monthly', price: 9900, currency: 'KRW' },
    });
  });

  it('forwards free-form string events unchanged', async () => {
    await EodinAnalytics.track('recipe_view', { recipe_id: 'abc' });
    expect(bridge.track).toHaveBeenCalledWith({
      eventName: 'recipe_view',
      properties: { recipe_id: 'abc' },
    });
  });
});
