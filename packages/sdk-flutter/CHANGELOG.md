## 2.0.0-beta.2

Deferred deep link reliability:
- Parse the v2 `deferred-params` response from top-level fields (no `data` wrapper); accept legacy `path` / `params` (F-4).
- Android: deterministic deferred matching via the Play **Install Referrer** (`eodin_cid` token) — adds `android_play_install_referrer` dependency (F-3).
- Scope deferred lookup to the configured `service` (F-6).
- **Public API unchanged** (`checkDeferredParams()` → `path` / `resourceId` / `metadata`) — no host-app code changes; bump the dependency and rebuild.

## 2.0.0-beta.1

- Renamed `eodin_deeplink` → `eodin_sdk` (v2): unified Analytics + Deferred Deep Link surface. See `docs/guide/migration-guide.md`.

## 1.0.0

- Initial release
- `EodinDeeplink.configure()` for SDK initialization
- `EodinDeeplink.checkDeferredParams()` for retrieving deferred parameters
- Support for iOS and Android platforms
- Automatic device fingerprint generation
- Deferred params claim tracking via SharedPreferences
