# @eodin/web

Eodin SDK for Web — pure analytics SDK (5번째 채널, 4채널 mobile SDK 와 의미 parity).

> ⚠️ **Status: Phase 1.1 (toolchain skeleton)**. Public surface (`EodinAnalytics`, `EodinEvent`) 는 Phase 3 에서 구현 예정. 아래 Quick Start 예시는 PRD §5 의 목표 surface 입니다.
>
> 본 패키지는 Eodin SDK monorepo (`ahn283/eodin-sdk`) 의 5번째 채널입니다. 4채널 (Flutter / iOS / Android / Capacitor) 는 본 저장소의 다른 `packages/*` 디렉토리에서 관리됩니다.

## 설치

```bash
npm install @eodin/web
```

## 빠른 시작

```typescript
import { EodinAnalytics, EodinEvent } from '@eodin/web';

await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: '<your-api-key>',
  appId: '<your-app-id>',
});

EodinAnalytics.track(EodinEvent.PageView, { path: window.location.pathname });
EodinAnalytics.track('custom_event', { foo: 'bar' });
```

자세한 surface 정의는 `docs/web-sdk/PRD.md` §5 참조.

## 빌드 / 테스트

```bash
# monorepo root 에서
npm -w @eodin/web run build
npm -w @eodin/web test
npm -w @eodin/web run docs   # TypeDoc API reference
```

## 라이선스

MIT
