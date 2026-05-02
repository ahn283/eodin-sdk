# @eodin/capacitor

Eodin SDK Capacitor plugin — deferred deep linking, analytics, and GDPR controls.

[![SDK repo](https://img.shields.io/badge/repo-ahn283%2Feodin--sdk-blue)](https://github.com/ahn283/eodin-sdk)

## Install

```bash
npm install @eodin/capacitor
npx cap sync
```

## Configure

```ts
import { EodinAnalytics, EodinDeeplink, EodinEvent } from '@eodin/capacitor';

await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: 'YOUR_API_KEY',
  appId: 'your-app-id',
  debug: !import.meta.env?.PROD,
});

await EodinDeeplink.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  service: 'your-app-id',
});
```

## Usage

```ts
// Track an event — positional API (v2)
await EodinAnalytics.track(EodinEvent.AppOpen);
await EodinAnalytics.track('recipe_view', { recipe_id: 'abc' });

// Identify
await EodinAnalytics.identify('user-123');
await EodinAnalytics.clearIdentity();

// GDPR — opt-out / right to erasure
await EodinAnalytics.setEnabled(false);
const enabled = await EodinAnalytics.isEnabled();
const ok = await EodinAnalytics.requestDataDeletion();

// Deferred deep link
const params = await EodinDeeplink.checkDeferredParams();
if (params.hasParams && params.path) {
  // Navigate to params.path
}
```

## Web platform

The plugin works in browser builds (PWA / Capacitor web target) — see
[`integration-guide.md`](https://github.com/ahn283/eodin-sdk/blob/main/docs/unified-id-and-sdk-v2/integration-guide.md)
for full surface details.

- Analytics: localStorage queue + `fetch` POST + auto-flush + `pagehide`
  / `visibilitychange` listener with `navigator.sendBeacon` for last-chance
  flush
- Deeplink: no-op on web (deferred deep linking is mobile-install-only)
- ATT: `{ status: 'unknown' }` on web (no equivalent of iOS ATT)

## Documentation

- [SDK v2 PRD](https://github.com/ahn283/eodin-sdk/blob/main/docs/unified-id-and-sdk-v2/PRD.md)
- [Integration guide](https://github.com/ahn283/eodin-sdk/blob/main/docs/unified-id-and-sdk-v2/integration-guide.md)
- [Migration guide (v1 → v2)](https://github.com/ahn283/eodin-sdk/blob/main/docs/unified-id-and-sdk-v2/migration-guide.md)
- [Unified event reference](https://github.com/ahn283/eodin/blob/main/docs/logging/unified-event-reference.md)

## API reference

```bash
npm run docs
# Output: docs/api/
```

## License

MIT.
