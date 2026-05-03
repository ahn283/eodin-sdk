// Public surface — Phase 1.3 시점은 EodinEvent enum 만 노출. EodinAnalytics
// 본체 surface 는 Phase 3 에서 추가 (configure / track / identify / GDPR /
// status getter 등). internal 모듈 (`src/internal/*`) 은 의도적 미노출.

export { EodinEvent, type EodinEventName } from './eodin-event';
