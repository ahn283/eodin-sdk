# Changelog — @eodin/capacitor

## 2.0.0-beta.2

Deferred deep link reliability:
- Parse the v2 `deferred-params` response from top-level fields (no wrapper); accept legacy `path` / `params` (F-4).
- Android bridge: deterministic deferred matching via the Play **Install Referrer** (`eodin_cid` token) — adds `com.android.installreferrer:installreferrer` (F-3). Falls back to the device fingerprint otherwise.
- Scope deferred lookup to the configured `service` (F-6).
- iOS bridge: v2 parsing + `service` scoping (deferred matching is server-side probabilistic; no referrer).
- Web: deferred remains a no-op (mobile-install attribution only).
- **Public API unchanged** — no host-app code changes; bump the dependency and rebuild.

## 2.0.0-beta.1

- v2 SDK: unified Analytics + Deferred Deep Link surface; Capacitor `web.ts` activated.
