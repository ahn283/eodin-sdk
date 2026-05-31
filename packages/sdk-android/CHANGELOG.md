# Changelog — eodin-sdk (Android)

## 2.0.0-beta.2

Deferred deep link reliability:
- Parse the v2 `deferred-params` response from top-level fields (no wrapper); accept legacy `path` / `params` (F-4).
- Deterministic deferred matching via the Play **Install Referrer** (`eodin_cid` token) — adds `com.android.installreferrer:installreferrer` dependency (F-3). Falls back to the device fingerprint for non-Play installs.
- Scope deferred lookup to the configured `service` (F-6).
- **Public API unchanged** (`checkDeferredParams()` → `path` / `resourceId` / `metadata`) — no host-app code changes; bump the dependency and rebuild.
- Note: the Install Referrer library merges the install-referrer service binding into the host app manifest.

## 2.0.0-beta.1

- v2 SDK: unified Analytics + Deferred Deep Link surface.
