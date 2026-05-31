# Eodin SDK

Mobile SDK for Eodin services — deferred deep linking, analytics, and identity (v2+).

## Packages

| Package | Platform | Registry |
|---|---|---|
| [`packages/sdk-flutter`](packages/sdk-flutter/) | Flutter | [`eodin_sdk`](https://pub.dev/packages/eodin_sdk) on pub.dev |
| [`packages/sdk-ios`](packages/sdk-ios/) | iOS / macOS | SwiftPM (this repo URL + tag) |
| [`packages/sdk-android`](packages/sdk-android/) | Android | [`app.eodin:sdk`](https://search.maven.org/) on Maven Central |
| [`packages/capacitor`](packages/capacitor/) | Capacitor (Web/iOS/Android) | [`@eodin/capacitor`](https://www.npmjs.com/package/@eodin/capacitor) on npm |
| [`packages/sdk-web`](packages/sdk-web/) | Web (browser) | [`eodin-web`](https://www.npmjs.com/package/eodin-web) on npm |

## Quick Start

### Flutter

```yaml
# pubspec.yaml
dependencies:
  eodin_sdk: ^2.0.0
```

```dart
import 'package:eodin_sdk/eodin_sdk.dart';

await EodinAnalytics.configure(
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: '<your-api-key>',
  appId: '<your-app-id>',
);
EodinAnalytics.track('app_open');
```

### iOS (SwiftPM)

```swift
.package(url: "https://github.com/ahn283/eodin-sdk", from: "2.0.0")
```

### Android (Gradle)

```kotlin
implementation("app.eodin:sdk:2.0.0")
```

### Capacitor

```bash
npm install @eodin/capacitor
```

### Web

```bash
npm install eodin-web
```

```typescript
import { EodinAnalytics, EodinEvent } from 'eodin-web';

await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: '<your-api-key>',
  appId: '<your-app-id>',
  autoTrackPageView: true,
});
EodinAnalytics.track(EodinEvent.AppOpen);
```

## Deferred Deep Linking

A link tapped *before* the app is installed is restored on first launch — your app
just calls `checkDeferredParams()`. Matching is automatic per platform:

- **Android (Play installs)** — deterministic via the Play **Install Referrer**: the
  landing embeds a click token (`eodin_cid`) in the store URL and the SDK reads it
  back after install (~100% on Play). Requires SDK ≥ `2.0.0-beta.2`.
- **iOS / non-Play installs** — **server-side probabilistic** match (client IP +
  service + short time window). Best-effort; no app release needed for the baseline.

```dart
final params = await EodinDeeplink.checkDeferredParams();
if (params.hasParams) navigate(params.path); // e.g. "product/123"
```

The API is identical across all 4 channels and stable across SDK versions
(`checkDeferredParams()` → `path` / `resourceId` / `metadata`). Always handle the
"no params" case gracefully (organic install) — route to home, never an error screen.

→ Full per-channel setup: **[Integration Guide](docs/guide/integration-guide.md)**.

## Documentation

- **[Integration Guide](docs/guide/integration-guide.md)** — per-channel setup (configure, events, ATT, GDPR, deferred deep link)
- **[Migration Guide](docs/guide/migration-guide.md)** — v1 → v2 breaking changes
- [`docs/`](docs/) — PRD, checklists, reviews

### API reference (Phase 1.8 auto-generated)

각 채널이 자체 doc generator 를 사용한다. 모두 로컬 빌드만 하고 CI publish 는 Phase 0.5.6 (publish CI/CD) 와 묶임:

| Channel | 명령 | 산출물 |
|---|---|---|
| Flutter | `cd packages/sdk-flutter && dart doc .` | `doc/api/` |
| iOS | `cd packages/sdk-ios && xcodebuild docbuild -scheme EodinSDK -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/eodin-sdk-build` (또는 `generic/platform=macOS`) | `/tmp/eodin-sdk-build/Build/Products/Debug-iphonesimulator/EodinSDK.doccarchive` (또는 `Debug` for macOS) |
| Android | host app 의 gradle wrapper 통해 `./gradlew :sdk-android:dokkaHtml` (sdk-android 자체에 standalone wrapper 없음) | `packages/sdk-android/build/dokka/html/` |
| Capacitor | `cd packages/capacitor && npm run docs` | `docs/api/` |

Dokka / TypeDoc 의 internal 패키지 (`app.eodin.internal.*` / `src/web.ts` 등) 는 의도적으로 docs 에서 제외 — public surface 만 노출. dartdoc / DocC 도 각각 lib entry export 그래프 / Swift access modifier 로 internal 자동 제외.

**도구 호환성 노트**:
- Dokka 1.9.20 — Kotlin ≥ 1.9 / AGP ≥ 8.0 호환. host app 이 그 이전 버전이면 Dokka 버전 정합 필요
- TypeDoc ^0.26 — TypeScript ≥ 5.x 권장
- DocC — Swift 5.5+ 내장 (Xcode 13+)
- dartdoc — Dart SDK 내장 (Flutter 3.10+)

## License

MIT — see [LICENSE](LICENSE).
