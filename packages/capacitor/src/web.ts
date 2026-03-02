import { WebPlugin } from '@capacitor/core';

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
} from './definitions';

export class EodinDeeplinkWeb extends WebPlugin implements EodinDeeplinkPlugin {
  async configure(_options: DeeplinkConfigureOptions): Promise<void> {
    throw this.unavailable('EodinDeeplink is not available on web platform.');
  }

  async checkDeferredParams(): Promise<DeferredParamsResult> {
    throw this.unavailable('EodinDeeplink is not available on web platform.');
  }

  async isReady(): Promise<{ ready: boolean }> {
    throw this.unavailable('EodinDeeplink is not available on web platform.');
  }
}

export class EodinAnalyticsWeb
  extends WebPlugin
  implements EodinAnalyticsPlugin
{
  async configure(_options: AnalyticsConfigureOptions): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async track(_options: TrackOptions): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async identify(_options: { userId: string }): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async clearIdentity(): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async setAttribution(_attribution: Attribution): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async flush(): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async startSession(): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async endSession(): Promise<void> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async requestTrackingAuthorization(): Promise<{ status: ATTStatus }> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async getATTStatus(): Promise<{ status: ATTStatus }> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }

  async getStatus(): Promise<AnalyticsStatus> {
    throw this.unavailable('EodinAnalytics is not available on web platform.');
  }
}
