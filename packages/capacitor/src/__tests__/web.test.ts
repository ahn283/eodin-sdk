import { EodinDeeplinkWeb, EodinAnalyticsWeb } from '../web';

describe('EodinDeeplinkWeb', () => {
  let plugin: EodinDeeplinkWeb;

  beforeEach(() => {
    plugin = new EodinDeeplinkWeb();
  });

  it('configure should throw unavailable', async () => {
    await expect(
      plugin.configure({ apiEndpoint: 'test', service: 'test' }),
    ).rejects.toThrow();
  });

  it('checkDeferredParams should throw unavailable', async () => {
    await expect(plugin.checkDeferredParams()).rejects.toThrow();
  });

  it('isReady should throw unavailable', async () => {
    await expect(plugin.isReady()).rejects.toThrow();
  });
});

describe('EodinAnalyticsWeb', () => {
  let plugin: EodinAnalyticsWeb;

  beforeEach(() => {
    plugin = new EodinAnalyticsWeb();
  });

  const methods = [
    ['configure', { apiEndpoint: 'a', apiKey: 'b', appId: 'c' }],
    ['track', { eventName: 'test' }],
    ['identify', { userId: 'u1' }],
    ['clearIdentity'],
    ['setAttribution', {}],
    ['flush'],
    ['startSession'],
    ['endSession'],
    ['requestTrackingAuthorization'],
    ['getATTStatus'],
    ['getStatus'],
  ] as const;

  it.each(methods)('%s should throw unavailable', async (method, ...args) => {
    await expect((plugin as any)[method](...args)).rejects.toThrow();
  });
});
