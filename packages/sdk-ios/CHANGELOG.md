# Changelog — EodinSDK (iOS)

## 2.0.0-beta.2

Deferred deep link reliability:
- Parse the v2 `deferred-params` response from top-level fields (no wrapper); accept legacy `path` / `params` (F-4).
- Scope deferred lookup to the configured `service` (F-6).
- iOS deferred matching is **server-side probabilistic** (client IP + service + short window) — no client referrer (Install Referrer is Android-only). Works against the deployed backend with no app-side matching logic.
- **Public API unchanged** (`checkDeferredParams` → `path` / `resourceId` / `metadata`) — no host-app code changes.
- podspec: version + repo URL corrected (`ahn283/eodin-sdk`); SwiftPM remains the primary distribution (git tag `v2.0.0-beta.2`).

## 2.0.0-beta.1

- v2 SDK: unified Analytics + Deferred Deep Link surface.
