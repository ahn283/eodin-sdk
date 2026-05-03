# Eodin SDK v2 Integration Guide

**Version**: 2.0.0-beta.1 (Phase 1.10 릴리스 예정)
**Last Updated**: 2026-05-02
**Audience**: Eodin SDK 를 신규로 채택하는 호스트 앱 개발자

---

## 1. 무엇을 얻는가

Eodin SDK 는 **딥링크 + 분석 통합 SDK** 다. v2 는 5채널 (Flutter / iOS Swift / Android Kotlin / Capacitor / Web) 모두 동일한 API surface 를 제공하며, 다음을 자동 처리한다:

- **앱 설치 직전 클릭** → 설치 후 첫 실행 시 deep link 복원 (deferred deep link)
- **이벤트 분석** → 통합 분석 백엔드 + Conversion API (Meta CAPI / Google Ads / TikTok / LinkedIn) 자동 매핑
- **세션 / attribution / device fingerprint** → 자동
- **GDPR / iOS ATT / 오프라인 큐** → 자동

> Eodin Analytics 와 Firebase Analytics (GA4) 는 **dual-tracking** 패턴으로 함께 쓰는 것이 표준이다 (`docs/logging/unified-event-reference.md`). Eodin 은 마케팅 attribution 용, GA4 는 product analytics 용. 호스트 앱의 `AnalyticsService` 가 두 SDK 호출을 한 번에 처리한다.

---

## 2. Pre-flight checklist

서비스 등록 / API key 발급 / scheme 결정이 SDK 채택의 선결조건이다.

### 2.1 Service catalog 등록 (Admin)

`admin.eodin.app` 또는 `POST /api/v1/admin/services` 로 신규 서비스를 등록한다 (Phase 0.9 결과로 Service.id 가 production source of truth).

```jsonc
// Service catalog 필드 예시
{
  "id": "myapp",                     // 짧은 식별자 (kebab-case 가능)
  "name": "MyApp",                   // 표시명
  "scheme": "myapp",                 // mobile 인 경우만 (예: "myapp://product/123")
  "iosStoreUrl": "https://apps.apple.com/app/id...",
  "androidStoreUrl": "https://play.google.com/store/apps/details?id=...",
  "pathPattern": "product-{id}",
  "deeplinkPathTemplate": "product/{id}",
  "serviceType": "mobile",           // "mobile" | "web" | "mixed"
  "webUrl": null,                    // serviceType=web/mixed 일 때만 필수
  "legalEntity": "eodin",
  "isActive": true
}
```

`serviceType` 분기:
- **mobile**: 네이티브/Flutter/Capacitor 앱 — 기본 `link.eodin.app/{service}/{id}` deferred deeplink 라우팅
- **web**: 순수 웹 (예: linkgo) — `link.eodin.app/{service}/...` 가 `webUrl` 로 forwarding
- **mixed**: kidstopia 처럼 Capacitor + 웹 병행 — `webUrl` 등록되어 있으면 web fallback

### 2.2 API key 발급

서비스별로 SDK 가 사용할 API key 를 발급받는다. 권한은 자동으로 해당 `serviceId` 로 scope 된다 (다른 앱 데이터 접근 X).

### 2.3 Conversion API 매핑 (선택)

`unified-event-reference.md` §"Conversion API Mapping" 의 7개 funnel 이벤트 (`app_install` / `app_open` / `core_action` / `paywall_view` / `subscribe_start` / `trial_start` / `subscribe_renew`) 가 자동으로 Meta CAPI / Google Ads / TikTok / LinkedIn 으로 forwarded 된다. 호스트 앱은 이벤트만 발화하면 되고, 매핑은 백엔드 (`apps/api/src/services/conversionService.ts`) 에서 처리.

---

## 3. 채널별 통합

### 3.1 Flutter (`eodin_sdk`)

#### 3.1.1 의존성 추가

`pubspec.yaml`:

```yaml
dependencies:
  eodin_sdk:
    git:
      url: https://github.com/ahn283/eodin-sdk.git
      path: packages/sdk-flutter
      ref: v2.0.0-beta.1   # tag pin 권장 (main 추적은 회귀 위험)
```

> **태그 vs main 권장**: `ref: main` 은 SDK 가 v3 등으로 advance 할 때 자동으로 따라가서 회귀 가능. 항상 명시적 태그 또는 commit hash 로 pin 한다.

#### 3.1.2 초기화

```dart
import 'package:eodin_sdk/eodin_sdk.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await EodinAnalytics.configure(
    apiEndpoint: 'https://api.eodin.app/api/v1',
    apiKey: 'YOUR_API_KEY',
    appId: 'myapp',                    // Service catalog 의 id
    debug: kDebugMode,
  );

  EodinDeeplink.configure(
    apiEndpoint: 'https://api.eodin.app/api/v1',
    service: 'myapp',
  );

  runApp(MyApp());
}
```

#### 3.1.3 사용

```dart
// 첫 실행 시 deferred deep link 확인
try {
  final params = await EodinDeeplink.checkDeferredParams();
  if (params.hasParams && params.path != null) {
    Navigator.pushNamed(context, '/${params.path}');
  }
} on NoParamsFoundException {
  // 정상 — 사용자가 링크 안 거치고 직접 설치
}

// 이벤트 발화 (권장: enum)
EodinAnalytics.trackEvent(EodinEvent.appOpen);
EodinAnalytics.trackEvent(
  EodinEvent.subscribeStart,
  properties: {'plan': 'monthly', 'price': 9900, 'currency': 'KRW'},
);

// 자유 string 도 가능 (앱 도메인 이벤트)
EodinAnalytics.track('recipe_view', properties: {'recipe_id': 'abc'});

// 사용자 식별
EodinAnalytics.identify('user-123');
EodinAnalytics.clearIdentity();   // 로그아웃 시
```

#### 3.1.4 모듈별 import (tree-shaking)

```dart
import 'package:eodin_sdk/analytics.dart';   // Analytics 만
import 'package:eodin_sdk/deeplink.dart';    // Deeplink 만
```

---

### 3.2 iOS (`EodinSDK`)

#### 3.2.1 SwiftPM 의존성

`Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/ahn283/eodin-sdk.git", from: "2.0.0-beta.1"),
],
targets: [
    .target(
        name: "MyApp",
        dependencies: [
            .product(name: "EodinSDK", package: "eodin-sdk"),
        ]
    )
]
```

#### 3.2.2 초기화

```swift
import EodinAnalytics
import EodinDeeplink

EodinAnalytics.configure(
    apiEndpoint: "https://api.eodin.app/api/v1",
    apiKey: "YOUR_API_KEY",
    appId: "myapp"
)

EodinDeeplink.configure(
    apiEndpoint: "https://api.eodin.app/api/v1",
    service: "myapp"
)
```

#### 3.2.3 ATT (App Tracking Transparency)

iOS 14+ 에서 IDFA 사용을 위해 ATT 권한 요청:

```swift
ATTManager.shared.requestAuthorization { status in
    // SDK 가 자동으로 'att_response' 이벤트 발화
}
```

#### 3.2.4 사용

```swift
EodinAnalytics.track(.appOpen)
EodinAnalytics.track(.subscribeStart, properties: [
    "plan": "monthly",
    "price": 9900,
    "currency": "KRW"
])

// 자유 string
EodinAnalytics.track("recipe_view", properties: ["recipe_id": "abc"])
```

---

### 3.3 Android (`app.eodin:eodin-sdk`)

#### 3.3.1 의존성 (Maven Central, Phase 0.5.6 publish CI 완료 후)

`build.gradle.kts`:

```kotlin
dependencies {
    implementation("app.eodin:eodin-sdk:2.0.0-beta.1")
}
```

#### 3.3.2 초기화

```kotlin
import app.eodin.analytics.EodinAnalytics
import app.eodin.analytics.EodinEvent
import app.eodin.deeplink.EodinDeeplink

EodinAnalytics.configure(
    context = this,
    apiEndpoint = "https://api.eodin.app/api/v1",
    apiKey = "YOUR_API_KEY",
    appId = "myapp"
)

EodinDeeplink.configure(
    context = this,
    apiEndpoint = "https://api.eodin.app/api/v1",
    service = "myapp"
)
```

#### 3.3.3 사용

```kotlin
EodinAnalytics.track(EodinEvent.APP_OPEN)
EodinAnalytics.track(
    EodinEvent.SUBSCRIBE_START,
    mapOf("plan" to "monthly", "price" to 9900, "currency" to "KRW")
)

EodinAnalytics.track("recipe_view", mapOf("recipe_id" to "abc"))
```

---

### 3.4 Capacitor (`@eodin/capacitor`)

#### 3.4.1 의존성

```bash
npm i @eodin/capacitor@^2.0.0-beta.1
npx cap sync
```

#### 3.4.2 초기화

```ts
import { EodinAnalytics, EodinDeeplink, EodinEvent } from '@eodin/capacitor';

await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: 'YOUR_API_KEY',
  appId: 'myapp',
  debug: !import.meta.env.PROD,
});

await EodinDeeplink.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  service: 'myapp',
});
```

#### 3.4.3 사용 — positional API

```ts
// 권장 enum
await EodinAnalytics.track(EodinEvent.AppOpen);
await EodinAnalytics.track(EodinEvent.SubscribeStart, {
  plan: 'monthly',
  price: 9900,
  currency: 'KRW',
});

// 자유 string
await EodinAnalytics.track('recipe_view', { recipe_id: 'abc' });

// 식별
await EodinAnalytics.identify('user-123');
await EodinAnalytics.clearIdentity();
```

> **v1 과의 차이**: v2 는 positional 시그니처 (`track(name, properties?)`). v1 의 `track({ eventName, properties })` 는 더 이상 동작하지 않는다.

#### 3.4.4 Web 자동 지원

Capacitor 의 `@eodin/capacitor` 는 native (iOS/Android) + web 동일 API 를 노출한다. PWA / 웹 빌드에서:

- Analytics: localStorage 큐 + fetch + auto-flush + `pagehide` 시 sendBeacon (페이지 닫혀도 마지막 이벤트 안 잃음)
- Deeplink: web 환경 무관 → 모든 메서드 no-op (throw 안 함, cross-platform 코드 단순화)
- ATT: web 환경 무관 → `{ status: 'unknown' }` 반환

호스트 앱은 platform 분기 없이 동일 호출만 하면 됨.

---

### 3.5 Web (`@eodin/web`)

순수 web 환경 (Vite / webpack / rollup / Next.js / Remix 등 bundler 사용 web app) 에서 EodinAnalytics 만 사용. Capacitor app 의 web build 는 `@eodin/capacitor` 가 내부적으로 `@eodin/web` 을 import 하므로 web 호스트 측 통합은 capacitor 만 따르면 됨 (3.4 참조). EodinAuth / `@eodin/web/server` SSR helper 는 별도 Auth 트랙.

#### 3.5.1 의존성

```bash
npm install @eodin/web
```

#### 3.5.2 초기화

```typescript
// app entry (예: main.tsx, _app.tsx)
import { EodinAnalytics, EodinEvent } from '@eodin/web';

await EodinAnalytics.configure({
  apiEndpoint: 'https://api.eodin.app/api/v1',
  apiKey: '<your-api-key>',
  appId: '<your-app-id>',
  debug: process.env.NODE_ENV !== 'production',
  autoTrackPageView: true,    // SPA 라우팅 자동 page_view (history API + popstate 구독)
});
```

#### 3.5.3 사용 (positional API — 4채널 SDK parity)

```typescript
import { EodinAnalytics, EodinEvent } from '@eodin/web';

// 표준 이벤트
await EodinAnalytics.track(EodinEvent.PageView, { path: '/pricing' });
await EodinAnalytics.track(EodinEvent.SignUp, { method: 'google' });

// 자유 string custom event
await EodinAnalytics.track('hero_cta_click', { variant: 'A' });

// Identity
EodinAnalytics.identify('user-id-from-host');
EodinAnalytics.clearIdentity();

// Status getters (TypeScript property style — Flutter / iOS parity)
EodinAnalytics.deviceId;
EodinAnalytics.userId;
EodinAnalytics.sessionId;
EodinAnalytics.attribution;
EodinAnalytics.isEnabled;

// Aggregate status
const status = await EodinAnalytics.getStatus();
console.log(status.queueSize, status.isOnline);

// GDPR (4채널 setEnabled / requestDataDeletion 와 동일 의미)
await EodinAnalytics.setEnabled(false);   // 큐 클리어 + 신규 이벤트 drop
await EodinAnalytics.requestDataDeletion();

// 명시 flush (보통 자동 — pagehide / visibilitychange 시 sendBeacon)
await EodinAnalytics.flush();
```

#### 3.5.4 SSR / Next.js 주의

`@eodin/web` 는 client-only — `localStorage` / `navigator` / `document` / `history` 의존. SSR 환경에서 server-side 코드는 `typeof window` 가드:

```typescript
// app/layout.tsx (Next.js)
'use client';

import { useEffect } from 'react';
import { EodinAnalytics } from '@eodin/web';

export default function ClientInit() {
  useEffect(() => {
    void EodinAnalytics.configure({
      apiEndpoint: 'https://api.eodin.app/api/v1',
      apiKey: process.env.NEXT_PUBLIC_EODIN_API_KEY!,
      appId: 'your-app-id',
      autoTrackPageView: true,
    });
  }, []);
  return null;
}
```

#### 3.5.5 의도적 미노출 (5채널 documented asymmetry)

- ATT 메서드 (`requestTrackingAuthorization` / `getATTStatus` / `setDeviceATT`) — iOS-only OS 기능. web 에서 import 불가 (compile error)
- Capacitor 의 `EodinDeeplink` — deferred deeplink 는 앱 전용. 웹 클릭 캡처는 `link.eodin.app/{service}/{id}` redirect URL 로 처리

자세한 5채널 비교: `docs/web-sdk/parity-matrix-5ch.md`

---

## 4. 표준 이벤트 패턴

### 4.1 Standard Funnel (5채널 공통, ALL APPS REQUIRED)

`unified-event-reference.md` §"Standard Funnel Events" 의 7개 이벤트는 모든 앱이 의무적으로 발화해야 한다 (Conversion API 매핑 / cross-app analytics):

```dart
// 첫 실행
EodinAnalytics.trackEvent(EodinEvent.appInstall, properties: {'platform': 'ios'});

// 매 foreground
EodinAnalytics.trackEvent(EodinEvent.appOpen);

// 핵심 가치 액션 (앱마다 정의)
EodinAnalytics.trackEvent(EodinEvent.coreAction, properties: {'action_type': 'recipe_generated'});

// 페이월 / 결제 깔때기
EodinAnalytics.trackEvent(EodinEvent.paywallView, properties: {'paywall_type': 'monthly'});
EodinAnalytics.trackEvent(EodinEvent.subscribeStart, properties: {
  'plan': 'monthly', 'price': 9900, 'currency': 'KRW',
});
EodinAnalytics.trackEvent(EodinEvent.trialStart);
EodinAnalytics.trackEvent(EodinEvent.subscribeRenew, properties: {'plan': 'monthly', 'price': 9900});
```

### 4.2 EodinEvent enum

5채널 공통 39 entries — IDE autocomplete + cross-app 일관성 확보. 앱 도메인 이벤트는 자유 string 으로 발화 (`track('recipe_view', ...)`). 자세한 이벤트 정의는 `docs/logging/unified-event-reference.md` v1.1 참조.

### 4.3 Naming rules (자유 string 사용 시)

- snake_case
- 최대 40자
- 시제: action = present (`photo_upload`), state-reached = past (`daily_limit_reached`)
- 완료 = `_complete`, 시작 = `_start`, 실패 = `_failed`, 노출 = `_view`
- 광고: `ad_<format>_<action>` (예: `ad_rewarded_view`, `ad_interstitial_view`)
- 파라미터는 flat (nested object 금지), max 25개 / 이벤트, PII 금지

---

## 5. 보안 정책 (Phase 1.6 S8)

### 5.1 HTTPS only — `configure()` 가 endpoint scheme 검증

`apiEndpoint` 가 다음 패턴 중 하나가 아니면 `configure()` 즉시 실패:
- `https://...` ✅
- `http://localhost` / `http://127.0.0.1` — 모든 빌드 허용 (dev / staging)
- `http://10.0.2.2` — **debug build 만** (Android emulator → host 주소). release 에서 reject

이는 plain HTTP 로 events 가 새는 것을 startup 시점에 즉시 발견하기 위한 가드다. release 빌드의 staging endpoint 를 실수로 `http://` 로 박아두면 즉시 fatal:
- Flutter: `ArgumentError`
- iOS: `preconditionFailure` (release 에서도 abort)
- Android: `IllegalArgumentException`
- Capacitor / web: `Error` throw

### 5.2 호스트 앱 build flavor 별 endpoint 분리 (권장)

```dart
// Flutter 예시
final endpoint = kReleaseMode
    ? 'https://api.eodin.app/api/v1'
    : (Platform.isAndroid ? 'http://10.0.2.2:3005/api/v1' : 'http://localhost:3005/api/v1');

await EodinAnalytics.configure(
  apiEndpoint: endpoint,
  apiKey: kReleaseMode ? prodApiKey : devApiKey,
  appId: 'myapp',
);
```

---

## 6. GDPR / Right to Erasure (Phase 1.7)

5채널 모두 4개 GDPR API 제공. 호스트 앱이 사용자 동의 / 옵트아웃 / 데이터 삭제 흐름 구현 시 직접 호출.

### 6.1 Opt-out toggle

```dart
// Flutter
await EodinAnalytics.setEnabled(false);  // 추적 중지
final enabled = EodinAnalytics.isEnabled; // 현재 상태 조회
await EodinAnalytics.setEnabled(true);   // 재개
```

```swift
// iOS
EodinAnalytics.setEnabled(false)
let enabled = EodinAnalytics.isEnabled
```

```kotlin
// Android
EodinAnalytics.setEnabled(false)
val enabled = EodinAnalytics.isEnabled
```

```ts
// Capacitor (Plugin Bridge — async)
await EodinAnalytics.setEnabled({ enabled: false });
const { enabled } = await EodinAnalytics.isEnabled();
```

```ts
// Web (@eodin/web — Promise<void> + property getter)
await EodinAnalytics.setEnabled(false);
const enabled = EodinAnalytics.isEnabled;
```

**동작 보장**:
- `setEnabled(false)` 호출 즉시 (a) 신규 `track()` silent drop + (b) in-flight 큐 즉시 비움 + (c) flush timer 정지
- `setEnabled` 상태는 storage (SharedPreferences / UserDefaults / localStorage) 에 영속화 — 앱 재시작 후에도 유지
- `requestDataDeletion()` 후에도 opt-out 의도는 보존 (HIGH-3 정책)

### 6.2 Right to Erasure — `requestDataDeletion()`

GDPR Article 17 (Right to Erasure) 대응. SDK 가 DELETE `${apiEndpoint}/events/user-data` 를 보내고 + 로컬 데이터 (device_id / user_id / session / attribution / queued events) 정리. 네트워크 실패해도 로컬 정리는 무조건 실행:

```dart
// Flutter — Future<bool>
final ok = await EodinAnalytics.requestDataDeletion();
```

```swift
// iOS — completion callback (main thread 보장)
EodinAnalytics.requestDataDeletion { success in
    // UI 업데이트 가능
}
```

```kotlin
// Android — callback (main thread 보장)
EodinAnalytics.requestDataDeletion { success ->
    // UI 업데이트 가능
}
```

```ts
// Capacitor — Promise<{ success: boolean }>
const { success } = await EodinAnalytics.requestDataDeletion();
```

```ts
// Web (@eodin/web) — Promise<{ success: boolean }>
const { success } = await EodinAnalytics.requestDataDeletion();
```

**중요**:
- 호출 후 SDK 는 fresh device id + session 으로 자동 재초기화 (post-deletion `track()` crash 방지). 호스트 앱이 별도 `configure()` 재호출 불필요
- 사용자의 GDPR opt-out 상태 (`isEnabled == false`) 는 보존 — 사용자가 disable + delete 한 의도가 무력화되지 않음
- 서버 응답 (200 / 202) 받으면 success=true, 실패 / 네트워크 끊김 / 미설정 시 success=false. 단 로컬 정리는 항상 실행됨 (right to erasure 는 네트워크와 무관)

---

## 7. 검증 체크리스트

### 7.1 Smoke test

- [ ] `EodinAnalytics.configure` / `EodinDeeplink.configure` 가 한 번 호출 (HTTPS endpoint 검증 통과)
- [ ] `app_install` (첫 실행 가드 — SharedPreferences / UserDefaults / localStorage)
- [ ] `app_open` (foreground 마다)
- [ ] `core_action` 발화 (앱 핵심 가치 모먼트)
- [ ] iOS: ATT 다이얼로그 → `att_response` 이벤트 발화
- [ ] 로그인 → `EodinAnalytics.identify(userId)` + `sign_in` 이벤트
- [ ] 로그아웃 → `EodinAnalytics.clearIdentity()` + `sign_out` 이벤트
- [ ] 페이월 노출 → `paywall_view` (`paywall_type` 필수)
- [ ] 구독 → `subscribe_start` (`plan` / `price` / `currency` 필수)
- [ ] (GDPR) 설정 화면의 "데이터 수집 끄기" → `EodinAnalytics.setEnabled(false)` → 후속 이벤트 차단 검증
- [ ] (GDPR) "내 데이터 삭제" → `EodinAnalytics.requestDataDeletion()` → 서버 응답 + 로컬 정리 + 이후 `track()` 정상 동작 (fresh device id)

### 7.2 Deferred deep link (4채널 — Web 제외)

- [ ] 미설치 상태에서 `https://link.eodin.app/myapp/product-123` 클릭 → 스토어로 이동
- [ ] 설치 후 첫 실행 → `EodinDeeplink.checkDeferredParams()` 호출 → `params.path = 'product/123'`
- [ ] 이미 설치된 상태에서 같은 링크 클릭 → 앱 직접 실행 (Universal Links / App Links)

### 7.3 Debug verification

- **Eodin debug logs**: `configure(debug: true)` 후 콘솔에서 `[EodinAnalytics]` prefix 확인
- **Eodin staging API**: `apiEndpoint: 'https://api-staging.eodin.app/api/v1'` 로 staging 검증 후 production 전환
- **Firebase DebugView** (dual-tracking 시): 별도 GA4 검증 매트릭스

---

## 8. 자주 발생하는 이슈

### 8.1 "iOS ATT denied 인데 attribution 안 잡힘"

ATT denied 시 IDFA 사용 불가 → SDK 는 자동으로 device fingerprint (IP + UA + locale) 기반 매칭으로 fallback. 정확도가 IDFA 보다 낮을 뿐 동작은 한다. `unified-event-reference.md` §"User Identification" 참조.

### 8.2 "Capacitor PWA 에서 multi-tab 사용 시 일부 이벤트 유실"

v2.0.0-beta.1+ 는 Web Locks API (`navigator.locks`) 로 queue mutex 처리됨. 단 secure context (HTTPS) 가 아니거나 older browser (~2022 이전) 에서는 fallback (single-tab 정합 보존, multi-tab 은 v1 risk 와 동일). 운영 환경은 거의 영향 없음.

### 8.3 "이벤트는 발화하는데 분석 dashboard 에 안 보임"

- `apiKey` 가 해당 `appId` 와 권한 매칭되는지 확인 (Service catalog 의 `appId` 와 발화 시 `appId` 가 일치해야 함)
- `event_name` 이 snake_case + 40자 이하인지 (서버에서 reject 됨)
- 오프라인 큐에 대기 중일 수 있음 — `EodinAnalytics.flush()` 강제 호출

### 8.4 "Capacitor v1 → v2 마이그 시 `track({eventName, properties})` 로 호출하는 코드"

v2 는 positional API (`track(eventName, properties?)`). v1 의 객체 인자는 더 이상 동작 안 한다. 자세한 마이그 단계는 `migration-guide.md` 참조.

---

## 9. 다음 단계

- **Conversion API forward** — 위 funnel 이벤트만 발화하면 자동 (호스트 앱 추가 작업 없음)
- **Eodin Identity (계정 통합)** — 별도 Auth 트랙으로 분리됨 (본 SDK 화 프로젝트 범위 밖). 향후 출시 시 SDK 채택 호스트 앱은 별도 마이그 비용 없이 자동 적용 가능 — 단 그 트랙 PRD 가 별도로 작성된 후 진행

---

## 10. 참고 문서

- `docs/PRD.md` — 제품 사양 (eodin 인프라 전체)
- `docs/unified-id-and-sdk-v2/PRD.md` — SDK v2 정비 PRD (2026-05-02 재정리, SDK 화 한정)
- `docs/unified-id-and-sdk-v2/CHECKLIST.md` — Phase 별 작업 항목
- `docs/logging/unified-event-reference.md` — 표준 이벤트 reference v1.1
- `docs/unified-id-and-sdk-v2/event-schema-audit.md` — 5개 앱 이벤트 정합 점검
- `docs/unified-id-and-sdk-v2/migration-guide.md` — 기존 v1 → v2 마이그 (5개 앱 대상)
- SDK 저장소: <https://github.com/ahn283/eodin-sdk>
