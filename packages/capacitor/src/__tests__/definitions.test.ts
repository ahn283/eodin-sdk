import type {
  EodinDeeplinkPlugin,
  DeeplinkConfigureOptions,
  DeferredParamsResult,
  EodinAnalyticsPlugin,
  AnalyticsConfigureOptions,
  TrackOptions,
  Attribution,
  ATTStatus,
  AnalyticsStatus,
} from '../definitions';

describe('Deeplink type definitions', () => {
  it('should define DeeplinkConfigureOptions', () => {
    const options: DeeplinkConfigureOptions = {
      apiEndpoint: 'https://api.eodin.app/api/v1',
      service: 'test-service',
    };
    expect(options.apiEndpoint).toBeDefined();
    expect(options.service).toBeDefined();
  });

  it('should define DeferredParamsResult', () => {
    const result: DeferredParamsResult = {
      path: 'product/123',
      resourceId: 'product-123',
      metadata: { utm_source: 'google' },
      hasParams: true,
    };
    expect(result.hasParams).toBe(true);
  });

  it('should define EodinDeeplinkPlugin interface', () => {
    const plugin: EodinDeeplinkPlugin = {
      configure: jest.fn(),
      checkDeferredParams: jest.fn(),
      isReady: jest.fn(),
    };
    expect(plugin.configure).toBeDefined();
    expect(plugin.checkDeferredParams).toBeDefined();
    expect(plugin.isReady).toBeDefined();
  });
});

describe('Analytics type definitions', () => {
  it('should define AnalyticsConfigureOptions', () => {
    const options: AnalyticsConfigureOptions = {
      apiEndpoint: 'https://api.eodin.app/api/v1',
      apiKey: 'test-key',
      appId: 'test-app',
      debug: true,
      offlineMode: false,
    };
    expect(options.apiEndpoint).toBeDefined();
    expect(options.apiKey).toBeDefined();
    expect(options.appId).toBeDefined();
  });

  it('should define TrackOptions', () => {
    const options: TrackOptions = {
      eventName: 'purchase',
      properties: { price: 9900 },
    };
    expect(options.eventName).toBe('purchase');
  });

  it('should define Attribution', () => {
    const attr: Attribution = {
      utmSource: 'google',
      utmMedium: 'cpc',
      clickId: 'abc123',
    };
    expect(attr.utmSource).toBe('google');
  });

  it('should define ATTStatus type', () => {
    const statuses: ATTStatus[] = [
      'authorized', 'denied', 'restricted', 'not_determined', 'unknown',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('should define AnalyticsStatus', () => {
    const status: AnalyticsStatus = {
      isConfigured: true,
      deviceId: 'dev-123',
      userId: 'user-456',
      sessionId: 'sess-789',
      isOnline: true,
      queueSize: 0,
      attStatus: 'authorized',
    };
    expect(status.isConfigured).toBe(true);
  });

  it('should define EodinAnalyticsPlugin interface', () => {
    const plugin: EodinAnalyticsPlugin = {
      configure: jest.fn(),
      track: jest.fn(),
      identify: jest.fn(),
      clearIdentity: jest.fn(),
      setAttribution: jest.fn(),
      flush: jest.fn(),
      startSession: jest.fn(),
      endSession: jest.fn(),
      requestTrackingAuthorization: jest.fn(),
      getATTStatus: jest.fn(),
      getStatus: jest.fn(),
      // Phase 1.7 GDPR
      setEnabled: jest.fn(),
      isEnabled: jest.fn(),
      requestDataDeletion: jest.fn(),
    };
    expect(Object.keys(plugin)).toHaveLength(14);
  });
});

describe('EodinAnalytics public wrapper (positional API)', () => {
  it('overrides positional methods; other methods flow through prototype chain', () => {
    // Lazy import so the test does not bootstrap the Capacitor bridge prematurely.
    const { EodinAnalytics } = require('../index');

    // The wrapper itself owns the positional / unwrapped overrides only.
    // This protects against H1 regression: any future plugin method becomes
    // available via the prototype chain instead of requiring a manual
    // forwarder update here.
    expect(Object.keys(EodinAnalytics).sort()).toEqual([
      'identify',
      'isEnabled',
      'requestDataDeletion',
      'setEnabled',
      'track',
    ]);

    // Existing v1 surface still resolves through the prototype.
    const inheritedMethods = [
      'configure',
      'clearIdentity',
      'setAttribution',
      'flush',
      'startSession',
      'endSession',
      'requestTrackingAuthorization',
      'getATTStatus',
      'getStatus',
    ];
    for (const method of inheritedMethods) {
      expect(typeof EodinAnalytics[method]).toBe('function');
    }
    // And the overridden ones are present too.
    expect(typeof EodinAnalytics.track).toBe('function');
    expect(typeof EodinAnalytics.identify).toBe('function');
    expect(typeof EodinAnalytics.setEnabled).toBe('function');
    expect(typeof EodinAnalytics.isEnabled).toBe('function');
    expect(typeof EodinAnalytics.requestDataDeletion).toBe('function');
  });
});
