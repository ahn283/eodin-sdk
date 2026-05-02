import { registerPlugin } from '@capacitor/core';

import type {
  EodinDeeplinkPlugin,
  EodinAnalyticsPlugin,
} from './definitions';
import type { EodinEventName } from './eodin-event';

const EodinDeeplink = registerPlugin<EodinDeeplinkPlugin>('EodinDeeplink', {
  web: () => import('./web').then((m) => new m.EodinDeeplinkWeb()),
});

const _EodinAnalyticsBridge = registerPlugin<EodinAnalyticsPlugin>(
  'EodinAnalytics',
  {
    web: () => import('./web').then((m) => new m.EodinAnalyticsWeb()),
  },
);

/**
 * v2 public surface — same as `EodinAnalyticsPlugin` but with positional
 * `track(eventName, properties?)` and `identify(userId)`.
 *
 * Any future plugin method automatically flows through via the prototype
 * chain — no need to update this wrapper when the bridge gains new methods.
 */
export type EodinAnalyticsAPI = Omit<
  EodinAnalyticsPlugin,
  'track' | 'identify'
> & {
  track(
    eventName: EodinEventName | string,
    properties?: Record<string, unknown>,
  ): Promise<void>;
  identify(userId: string): Promise<void>;
};

/**
 * Eodin Analytics SDK (positional API).
 *
 * v2 changes vs v1:
 * - `track({ eventName, properties })` → `track(eventName, properties?)`
 * - `identify({ userId })` → `identify(userId)`
 * - Accepts `EodinEvent` enum values (recommended) or any free-form string
 *
 * All other plugin methods are forwarded transparently via the prototype
 * chain, so future bridge additions (e.g. `setEnabled`, `requestDataDeletion`)
 * become available without updating this file.
 *
 * @example
 * ```ts
 * import { EodinAnalytics, EodinEvent } from '@eodin/capacitor';
 *
 * await EodinAnalytics.configure({
 *   apiEndpoint: 'https://api.eodin.app/api/v1',
 *   apiKey: 'YOUR_KEY',
 *   appId: 'fridgify',
 * });
 *
 * await EodinAnalytics.track(EodinEvent.AppOpen);
 * await EodinAnalytics.track('recipe_view', { recipe_id: 'abc' });
 * ```
 */
export const EodinAnalytics: EodinAnalyticsAPI = Object.assign(
  Object.create(_EodinAnalyticsBridge),
  {
    track(
      eventName: EodinEventName | string,
      properties?: Record<string, unknown>,
    ): Promise<void> {
      return _EodinAnalyticsBridge.track({ eventName, properties });
    },
    identify(userId: string): Promise<void> {
      return _EodinAnalyticsBridge.identify({ userId });
    },
  },
);

export * from './definitions';
export { EodinEvent } from './eodin-event';
export type { EodinEventName } from './eodin-event';
export { EodinDeeplink };
