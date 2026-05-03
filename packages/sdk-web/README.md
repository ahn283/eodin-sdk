# eodin-web

Eodin SDK for Web — pure analytics SDK (5번째 채널, 4채널 mobile SDK 와 의미 parity).

> 본 패키지는 Eodin SDK monorepo (`ahn283/eodin-sdk`) 의 5번째 채널입니다. 4채널 (Flutter / iOS / Android / Capacitor) 는 본 저장소의 다른 `packages/*` 디렉토리에서 관리됩니다.

## 설치

```bash
npm install eodin-web
```

## 빠른 시작

```typescript
import { EodinAnalytics, EodinEvent } from 'eodin-web';

await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: '<your-api-key>',
  appId: '<your-app-id>',
  autoTrackPageView: true,    // SPA 라우팅 자동 page_view (history API + popstate)
});

await EodinAnalytics.track(EodinEvent.AppOpen);
await EodinAnalytics.track('custom_event', { foo: 'bar' });
```

## Public surface

```typescript
// Lifecycle
await EodinAnalytics.configure(options);
await EodinAnalytics.track(eventName, properties?);
await EodinAnalytics.flush();
await EodinAnalytics.startSession();
await EodinAnalytics.endSession();

// Identity
EodinAnalytics.identify(userId);
EodinAnalytics.clearIdentity();
EodinAnalytics.setAttribution({ utmSource: 'google', utmMedium: 'cpc' });

// Status getters (TS property syntax — Flutter / iOS parity)
EodinAnalytics.deviceId;       // string | null
EodinAnalytics.userId;         // string | null
EodinAnalytics.sessionId;      // string | null
EodinAnalytics.attribution;    // Attribution | null
EodinAnalytics.isEnabled;      // boolean
await EodinAnalytics.getStatus();   // AnalyticsStatus { configured, enabled, queueSize, isOnline }

// GDPR (Phase 1.7 4채널 parity)
await EodinAnalytics.setEnabled(true | false);
await EodinAnalytics.requestDataDeletion();
```

## 의도적 비대칭 (5채널 documented asymmetry)

- **ATT 메서드 (`requestTrackingAuthorization` / `getATTStatus` / `setDeviceATT`)** — iOS-only OS 기능. web 에 미노출 (compile-time error 로 호스트 잘못된 호출 차단)
- **Deeplink** — 4채널 SDK 만 deeplink 모듈 보유. web 의 click capture 는 `link.eodin.app/{service}/{id}` redirect URL 사용 권장

자세한 5채널 비교: [`docs/web-sdk/parity-matrix-5ch.md`](../../docs/web-sdk/parity-matrix-5ch.md).
PRD: [`docs/web-sdk/PRD.md`](../../docs/web-sdk/PRD.md).

## 빌드 / 테스트

```bash
# monorepo root 에서
npm -w eodin-web run build
npm -w eodin-web test
npm -w eodin-web run docs   # TypeDoc API reference
```

## 라이선스

MIT
