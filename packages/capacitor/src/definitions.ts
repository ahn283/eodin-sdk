// --- Deeplink ---

export interface EodinDeeplinkPlugin {
  configure(options: DeeplinkConfigureOptions): Promise<void>;
  checkDeferredParams(): Promise<DeferredParamsResult>;
  isReady(): Promise<{ ready: boolean }>;
}

export interface DeeplinkConfigureOptions {
  apiEndpoint: string;
  service: string;
}

export interface DeferredParamsResult {
  path: string | null;
  resourceId: string | null;
  metadata: Record<string, any> | null;
  hasParams: boolean;
}

// --- Analytics ---

export interface EodinAnalyticsPlugin {
  configure(options: AnalyticsConfigureOptions): Promise<void>;
  track(options: TrackOptions): Promise<void>;
  identify(options: { userId: string }): Promise<void>;
  clearIdentity(): Promise<void>;
  setAttribution(attribution: Attribution): Promise<void>;
  flush(): Promise<void>;
  startSession(): Promise<void>;
  endSession(): Promise<void>;
  requestTrackingAuthorization(): Promise<{ status: ATTStatus }>;
  getATTStatus(): Promise<{ status: ATTStatus }>;
  getStatus(): Promise<AnalyticsStatus>;
}

export interface AnalyticsConfigureOptions {
  apiEndpoint: string;
  apiKey: string;
  appId: string;
  debug?: boolean;
  offlineMode?: boolean;
}

export interface TrackOptions {
  eventName: string;
  properties?: Record<string, any>;
}

export interface Attribution {
  source?: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  clickId?: string;
  clickIdType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export type ATTStatus =
  | 'authorized'
  | 'denied'
  | 'restricted'
  | 'not_determined'
  | 'unknown';

export interface AnalyticsStatus {
  isConfigured: boolean;
  deviceId: string | null;
  userId: string | null;
  sessionId: string | null;
  isOnline: boolean;
  queueSize: number;
  attStatus: ATTStatus;
}
