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

// Deferred deep link — wrap in try/catch: the native bridge REJECTS on a no-match
try {
  const params = await EodinDeeplink.checkDeferredParams();
  if (params.hasParams && params.path) {
    // Navigate to params.path
  }
} catch {
  // No deferred link (or a transport error) — fall through to the home screen.
}
```

## Deferred deep linking

`checkDeferredParams()` resolves to a `DeferredParamsResult`
(`{ path, resourceId, metadata, hasParams }`) on a match. **Behavior on a
no-match differs by platform**, so always both `try/catch` the call **and** check
`hasParams`:

- **Native (iOS / Android)** — the plugin **rejects** the Promise on a no-match
  (the underlying SDK throws `NoParamsFound`) and on transport errors. An
  unhandled rejection here is exactly the "show an error to a brand-new user"
  failure we must avoid (F-9).
- **Web** — never rejects; resolves with `hasParams: false` (the user is already
  at the destination URL).

Call it once on first launch and, whether the call resolves with `hasParams:
false` or rejects, **fall through to the normal home screen — never show an
error**.

### How matching works

| Platform | Mechanism | Reliability |
|---|---|---|
| **Android — Play install** | native Play **Install Referrer** (`eodin_cid` token) → exact server lookup | Deterministic |
| **Android — non-Play / iOS** | hashed device signal → server probabilistic IP match | Best-effort |
| **Web** | no-op (`hasParams: false`) — the user is already at the destination URL | — |

The Android native side of this plugin reads the Play Install Referrer (the same
implementation as `app.eodin:eodin-sdk`); the iOS native side relies on
server-side IP matching. See
[`phase3-design.md`](https://github.com/ahn283/eodin-sdk/blob/main/docs/deeplink-reliability/phase3-design.md).

## Web platform

The plugin works in browser builds (PWA / Capacitor web target) — see
[`integration-guide.md`](https://github.com/ahn283/eodin-sdk/blob/main/docs/guide/integration-guide.md)
for full surface details.

- Analytics: localStorage queue + `fetch` POST + auto-flush + `pagehide`
  / `visibilitychange` listener with `navigator.sendBeacon` for last-chance
  flush
- Deeplink: no-op on web (deferred deep linking is mobile-install-only)
- ATT: `{ status: 'unknown' }` on web (no equivalent of iOS ATT)

## Documentation

- [SDK v2 PRD](https://github.com/ahn283/eodin-sdk/blob/main/docs/PRD.md)
- [Integration guide](https://github.com/ahn283/eodin-sdk/blob/main/docs/guide/integration-guide.md)
- [Migration guide (v1 → v2)](https://github.com/ahn283/eodin-sdk/blob/main/docs/guide/migration-guide.md)
- [Unified event reference](https://github.com/ahn283/eodin/blob/main/docs/logging/unified-event-reference.md)

## API reference

```bash
npm run docs
# Output: docs/api/
```

## License

MIT.
