# Eodin SDK

Mobile SDK for Eodin services — deferred deep linking, analytics, and identity (v2+).

## Packages

| Package | Platform | Registry |
|---|---|---|
| [`packages/sdk-flutter`](packages/sdk-flutter/) | Flutter | [`eodin_sdk`](https://pub.dev/packages/eodin_sdk) on pub.dev |
| [`packages/sdk-ios`](packages/sdk-ios/) | iOS / macOS | SwiftPM (this repo URL + tag) |
| [`packages/sdk-android`](packages/sdk-android/) | Android | [`app.eodin:sdk`](https://search.maven.org/) on Maven Central |
| [`packages/capacitor`](packages/capacitor/) | Capacitor (Web/iOS/Android) | [`@eodin/capacitor`](https://www.npmjs.com/package/@eodin/capacitor) on npm |

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

## Documentation

- See [`docs/`](docs/) for PRD, migration guide, and checklist.

## License

MIT — see [LICENSE](LICENSE).
