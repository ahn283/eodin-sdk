// Public surface — `@eodin/web` root entry. internal 모듈 (`src/internal/*`)
// 은 의도적 미노출 (TypeDoc + package.json `exports` 양쪽에서 제외).

export { EodinAnalytics } from './analytics/eodin-analytics';
export type {
  AnalyticsConfigureOptions,
  AnalyticsStatus,
  Attribution,
} from './analytics/types';

export { EodinEvent, type EodinEventName } from './eodin-event';
