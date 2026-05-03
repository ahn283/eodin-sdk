// Public types — 4채널 SDK 의 Attribution / AnalyticsStatus 와 의미적 parity.

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

export interface AnalyticsStatus {
  configured: boolean;
  enabled: boolean;
  queueSize: number;
  isOnline: boolean;
}

export interface AnalyticsConfigureOptions {
  apiEndpoint: string;
  apiKey: string;
  appId: string;
  /** Default false. true 시 console.log / console.warn 으로 SDK 동작 surface. */
  debug?: boolean;
  /** Default true. localStorage queue + 자동 flush 모드. */
  offlineMode?: boolean;
  /**
   * Default false. true 시 internal page-view tracker 가 history API
   * (pushState / replaceState / popstate) 와 hashchange 를 구독해
   * EodinEvent.PageView 를 자동 발생.
   *
   * web 고유 옵션 — 4채널 mobile SDK 에는 없음 (PRD §5.1 documented asymmetry).
   */
  autoTrackPageView?: boolean;
}

/**
 * Wire schema (`AttributionSchema` on the API side) — camelCase 를 snake_case
 * 로 변환한 형태. EodinAnalytics 내부에서만 사용.
 *
 * @internal
 */
export function attributionToWire(
  attr: Attribution,
): Record<string, string | undefined> {
  return {
    source: attr.source,
    campaign_id: attr.campaignId,
    adset_id: attr.adsetId,
    ad_id: attr.adId,
    click_id: attr.clickId,
    click_id_type: attr.clickIdType,
    utm_source: attr.utmSource,
    utm_medium: attr.utmMedium,
    utm_campaign: attr.utmCampaign,
    utm_content: attr.utmContent,
    utm_term: attr.utmTerm,
  };
}

/**
 * Wire (snake_case JSON) → camelCase Attribution 객체. C1 (Phase 3 review):
 * configure() 시 localStorage 의 attribution 을 hydrate 해서 cold-reload 후에도
 * `EodinAnalytics.attribution` getter 가 일관된 값 반환.
 *
 * @internal
 */
export function attributionFromWire(
  wire: Record<string, string | undefined>,
): Attribution {
  return {
    source: wire.source,
    campaignId: wire.campaign_id,
    adsetId: wire.adset_id,
    adId: wire.ad_id,
    clickId: wire.click_id,
    clickIdType: wire.click_id_type,
    utmSource: wire.utm_source,
    utmMedium: wire.utm_medium,
    utmCampaign: wire.utm_campaign,
    utmContent: wire.utm_content,
    utmTerm: wire.utm_term,
  };
}
