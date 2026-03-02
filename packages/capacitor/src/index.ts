import { registerPlugin } from '@capacitor/core';

import type { EodinDeeplinkPlugin, EodinAnalyticsPlugin } from './definitions';

const EodinDeeplink = registerPlugin<EodinDeeplinkPlugin>('EodinDeeplink', {
  web: () => import('./web').then((m) => new m.EodinDeeplinkWeb()),
});

const EodinAnalytics = registerPlugin<EodinAnalyticsPlugin>('EodinAnalytics', {
  web: () => import('./web').then((m) => new m.EodinAnalyticsWeb()),
});

export * from './definitions';
export { EodinDeeplink, EodinAnalytics };
