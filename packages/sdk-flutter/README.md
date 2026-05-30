# eodin_sdk (Flutter)

Eodin SDK for Flutter — **deferred deep linking** + analytics + identity.

This is the channel used by Flutter host apps (e.g. **plori**). It talks to the
live Eodin backend at `https://api.eodin.app/api/v1`.

- Package name: `eodin_sdk` (renamed from `eodin_deeplink` in v2.0.0)
- Current version: **2.0.0-beta.2**
- Min versions: Dart `>=3.0.0`, Flutter `>=3.10.0`

---

## 1. Add the dependency

The SDK lives in the `eodin-sdk` monorepo under `packages/sdk-flutter`. Pick
**one** of the following in your app's `pubspec.yaml`.

### a) Git dependency — recommended

```yaml
dependencies:
  eodin_sdk:
    git:
      url: https://github.com/ahn283/eodin-sdk.git
      path: packages/sdk-flutter
      ref: v2.0.0-beta.2   # tag (preferred) — or a branch / commit SHA
```

> Pin `ref` to a tag or commit that contains the **beta.2** code (the version
> with the Android Play Install Referrer). The deterministic Android match only
> works from beta.2 onward — an older `ref` silently falls back to probabilistic
> matching.

### b) Local path — when both repos are checked out side by side

```yaml
dependencies:
  eodin_sdk:
    path: ../../../eodin-sdk/packages/sdk-flutter   # from plori/apps/mobile
```

Then:

```bash
flutter pub get
```

---

## 2. Configure once at startup

Configure the surfaces you use early in `main()`, before `runApp()`. The two
`configure` calls are independent.

```dart
import 'package:flutter/widgets.dart';
import 'package:eodin_sdk/eodin_sdk.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Deferred deep linking
  EodinDeeplink.configure(
    apiEndpoint: 'https://api.eodin.app/api/v1',
    service: 'plori',        // app slug — scopes deferred matches (F-6)
  );

  // Analytics (optional)
  await EodinAnalytics.configure(
    apiEndpoint: 'https://api.eodin.app/api/v1',
    apiKey: 'YOUR_API_KEY',
    appId: 'plori',
  );

  runApp(const MyApp());
}
```

> Tree-shaking-friendly imports if you only need one surface:
> `import 'package:eodin_sdk/deeplink.dart';` or
> `import 'package:eodin_sdk/analytics.dart';`.

---

## 3. Deferred deep linking (the main feature)

When a user taps an Eodin link **before installing the app**, the click is saved
server-side. On the first launch after install, the SDK retrieves the original
destination so you can route the user straight there.

### Call once on first launch

`checkDeferredParams()` **throws** on the no-match / not-configured cases — it
does not return an empty result. Wrap it and treat every exception as "just go to
the normal home screen".

```dart
import 'package:eodin_sdk/eodin_sdk.dart';
import 'package:flutter/foundation.dart';

Future<void> handleDeferredDeepLink(BuildContext context) async {
  try {
    final params = await EodinDeeplink.checkDeferredParams();
    if (params.hasParams && params.path != null) {
      // e.g. params.path == 'recipe/123'
      Navigator.of(context).pushNamed('/${params.path}');
      // params.resourceId and params.metadata are also available
    }
  } on NoParamsFoundException {
    // Normal: organic install, no deferred link, or already claimed.
    // Fall through to your normal start screen.
  } on NotConfiguredException {
    debugPrint('Eodin SDK not configured — call EodinDeeplink.configure() first');
  } catch (e) {
    // NetworkException / ApiException — never block the user, just continue.
    debugPrint('Deferred check failed (non-fatal): $e');
  }
}
```

### `DeferredParamsResult`

| Field | Type | Meaning |
|---|---|---|
| `path` | `String?` | Destination path to navigate to (e.g. `recipe/123`) |
| `resourceId` | `String?` | Optional resource id parsed from the link |
| `metadata` | `Map<String, dynamic>?` | Optional extra params attached to the link |
| `hasParams` | `bool` | `true` when `path` or `resourceId` is present |

### Exceptions

| Exception | When | What to do |
|---|---|---|
| `NoParamsFoundException` | no match / 404 / already claimed | normal — go to home |
| `NotConfiguredException` | `configure()` not called | fix init order |
| `NetworkException` | transport error | ignore, go to home |
| `ApiException` | non-200/404 server status | ignore, go to home |

### Call-once semantics

- The SDK persists a `claimed` flag in `SharedPreferences`, so after the **first
  successful match** later calls throw `NoParamsFoundException` instead of
  re-claiming. You can safely call it on every launch.
- Best practice: still gate the call behind your own "first launch" flag and run
  it after the splash / onboarding.

---

## 4. How matching works

| Platform | Mechanism | Reliability |
|---|---|---|
| **Android — Play install** | Google Play **Install Referrer** carries an `eodin_cid` click token → exact server lookup | Deterministic (100%) |
| **Android — sideload / non-Play** | hashed device signal → server probabilistic match | Best-effort |
| **iOS** | server-side probabilistic match on click IP within a time window | Best-effort |

The SDK handles this automatically: on Android it reads the Play Install
Referrer (via the bundled `android_play_install_referrer` plugin), extracts
`eodin_cid`, and sends `service` + `installReferrer`. When no token is present it
sends `service` + a hashed `deviceId` fallback instead. You configure none of
this.

See [`docs/deeplink-reliability/phase3-design.md`](https://github.com/ahn283/eodin-sdk/blob/main/docs/deeplink-reliability/phase3-design.md)
for the full flow.

---

## 5. Platform setup

### Android
- No `AndroidManifest.xml` changes required — the Install Referrer is read
  through the bundled plugin.
- The Install Referrer only returns data for **Play Store installs**. `flutter
  run` / sideloaded builds fall back to probabilistic matching, which is expected
  in development.

### iOS
- Deferred deep linking needs **no ATT prompt** — matching is server-side.
- ATT is only relevant to analytics attribution. The Flutter SDK does not show
  the ATT dialog itself — request it with your own plugin
  (e.g. `app_tracking_transparency`), then pass the result to
  `EodinAnalytics.setDeviceATT(attStatus: ..., idfa: ...)`. If you request ATT,
  add `NSUserTrackingUsageDescription` to `Info.plist`.

---

## 6. Analytics

```dart
// Track — free-form string or the typed EodinEvent enum (recommended)
await EodinAnalytics.track('recipe_view', properties: {'id': 'abc'});
await EodinAnalytics.trackEvent(EodinEvent.appOpen);

// Identity
await EodinAnalytics.identify('user-123');
await EodinAnalytics.clearIdentity();   // on logout

// Flush the offline queue manually (also auto-flushed)
await EodinAnalytics.flush();

// Privacy / opt-out (GDPR)
await EodinAnalytics.setEnabled(false);
final ok = await EodinAnalytics.requestDataDeletion();
```

> `EodinAnalytics` is a static API — call methods directly on the class. It
> stores attribution automatically when a deferred link carries campaign
> metadata.

---

## 7. Quick checklist for plori

- [ ] Add `eodin_sdk` to `pubspec.yaml` pinned to a **beta.2** `ref` + `flutter pub get`
- [ ] `EodinDeeplink.configure(service: 'plori')` in `main()`
- [ ] Call `EodinDeeplink.checkDeferredParams()` once on first launch, route on `hasParams`
- [ ] Verify the Android Play install path end-to-end (click link → install from Play → land on deep link)
- [ ] (Optional) `EodinAnalytics.configure(...)` + `track` / `identify`

---

## Documentation

- [Integration guide (all channels)](https://github.com/ahn283/eodin-sdk/blob/main/docs/guide/integration-guide.md)
- [Migration guide (v1 → v2)](https://github.com/ahn283/eodin-sdk/blob/main/docs/guide/migration-guide.md)
- [Deeplink reliability design](https://github.com/ahn283/eodin-sdk/blob/main/docs/deeplink-reliability/phase3-design.md)
- [Changelog](./CHANGELOG.md)

## Support

- Admin Dashboard: https://admin.eodin.app
- GitHub Issues: https://github.com/ahn283/eodin-sdk/issues

## License

MIT
