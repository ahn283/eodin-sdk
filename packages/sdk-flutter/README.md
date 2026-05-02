# Eodin Deeplink SDK for Flutter

Eodin Deferred Deep Link SDK for Flutter. Enable deferred deep linking to direct users to specific content after app installation.

## Installation (팀 내부 배포)

### Git 서브모듈 방식 (권장)

> ⚠️ **비공개 저장소**: SSH 키 설정이 필요합니다.

**1. 프로젝트에 서브모듈 추가:**

```bash
git submodule add git@github.com:ahn283/eodin.git libs/eodin
git submodule update --init --recursive
```

**2. pubspec.yaml에 의존성 추가:**

```yaml
dependencies:
  eodin_deeplink:
    path: libs/eodin/packages/sdk-flutter
```

**3. 의존성 설치:**

```bash
flutter pub get
```

**업데이트 방법:**

```bash
git submodule update --remote libs/eodin
flutter pub get
```

## Usage

### 1. Configure SDK

Configure the SDK at app startup, before using `checkDeferredParams`.

```dart
import 'package:eodin_deeplink/eodin_deeplink.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Configure SDK
  EodinDeeplink.configure(
    apiEndpoint: 'https://api.eodin.app/api/v1',
    service: 'your-service-id',  // e.g., 'shopping'
  );

  runApp(MyApp());
}
```

### 2. Check for Deferred Parameters

Call this after splash screen or when user completes onboarding:

```dart
Future<void> checkDeferredDeeplink() async {
  try {
    final params = await EodinDeeplink.checkDeferredParams();

    if (params.hasParams && params.path != null) {
      // Navigate to deep link destination
      handleDeeplink(params.path!);
    }
  } on NoParamsFoundException {
    // Normal - user installed without clicking a link
    debugPrint('Fresh install, no deferred params');
  } on NotConfiguredException {
    debugPrint('SDK not configured');
  } catch (e) {
    debugPrint('Error checking deferred params: $e');
  }
}
```

### 3. Handle Deep Links

```dart
void handleDeeplink(String path) {
  final segments = path.split('/');

  if (segments.length >= 2) {
    switch (segments[0]) {
      case 'product':
        Navigator.pushNamed(context, '/product', arguments: segments[1]);
        break;
      case 'category':
        Navigator.pushNamed(context, '/category', arguments: segments[1]);
        break;
      case 'user':
        Navigator.pushNamed(context, '/user', arguments: segments[1]);
        break;
    }
  }
}
```

## API Reference

### EodinDeeplink

```dart
// Configure the SDK
static void configure({
  required String apiEndpoint,
  required String service,
});

// Check if SDK is configured
static bool get isReady;

// Check for deferred parameters
static Future<DeferredParamsResult> checkDeferredParams();
```

### DeferredParamsResult

```dart
class DeferredParamsResult {
  final String? path;
  final String? resourceId;
  final Map<String, dynamic>? metadata;
  bool get hasParams;
}
```

### Exceptions

- `NotConfiguredException` - SDK not configured
- `NoParamsFoundException` - No deferred params found (normal for organic installs)
- `NetworkException` - Network error occurred
- `ApiException` - API returned an error

## Debugging

In debug mode, the SDK logs to the console. Look for `[EodinDeeplink]` messages.

## Support

- Admin Dashboard: https://admin.eodin.app
- GitHub Issues: https://github.com/ahn283/eodin-sdk/issues
