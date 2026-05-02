# Phase 1.1 결정 — 패키지 구조 + S7 + Modular 통일

**작성일:** 2026-05-02
**참조:** PRD §6.1 M1, S6, S7 / Phase 0.1 sdk-usage-matrix.md

> **Note (2026-05-02 재정리)**: 본 문서는 PRD 가 SDK 화 + Auth (계정 통합) 합본이었던 시점의 결정 기록이다. 이후 Auth 트랙이 별도 프로젝트로 분리됨에 따라, 본 문서 안의 "Phase 1-Auth (계정 통합 트랙)" 멘션은 모두 **별도 Auth 트랙 (본 SDK 화 PRD 범위 밖)** 으로 이해해야 한다. EodinAuth 모듈 / Web SDK Auth 부분은 SDK 화 프로젝트에서 신설 / 구현하지 않으며, 향후 Auth 트랙 PRD 가 작성된 후 진행한다.

---

## 1. 결정 요약

| 항목 | 결정 | 근거 |
|---|---|---|
| **패키지 구조** | 모놀리식 단일 패키지 + 모듈별 import (iOS Package.swift 패턴 차용) | PRD M1, 운영 단순화. 5개 앱이 deeplink + analytics 같이 쓰는 패턴 (Phase 0.1 매트릭스) |
| **S7 (static→instance)** | **보류** — v1 의 static 패턴 유지 | Phase 0.1 결과 multi-init use case 0건. PRD H2 명시. v3 에서 재검토 |
| **5개 플랫폼 모듈 통일** | Auth/Analytics/Deeplink 3개 모듈 (Web 은 Auth+Analytics 2개) | iOS 만 이미 modular — 나머지 4개 통일 |
| **Flutter 패키지 rename** | `eodin_deeplink` → `eodin_sdk` | 패키지명/내용 mismatch 해소. `eodin_deeplink` 6주 deprecated alias 유지 (PRD H2) |
| **Android namespace 정정** | `app.eodin.deeplink` → `app.eodin` | analytics 도 안에 있는데 namespace 가 deeplink 만 — 이름/내용 mismatch |
| **이름 충돌 방지** | iOS `EodinSDK` / Flutter `eodin_sdk` / Android `app.eodin:eodin-sdk` / Capacitor `@eodin/capacitor` / Web `@eodin/web` — 모두 SDK 이름 명확 | - |

---

## 2. 5개 플랫폼별 v2 구조

### 2.1 Flutter (`eodin_sdk`)

**v1 (현재)**:
```yaml
name: eodin_deeplink   # 이름은 deeplink 인데 analytics 도 export
```
```dart
import 'package:eodin_deeplink/eodin_sdk.dart';   // entry 1: full
import 'package:eodin_deeplink/eodin_deeplink.dart';  // entry 2: same content
```

**v2 (목표)**:
```yaml
name: eodin_sdk
```
```dart
// 1차: full bundle (가장 흔한 사용)
import 'package:eodin_sdk/eodin_sdk.dart';

// 2차: 모듈별 import (Tree-shaking 친화)
import 'package:eodin_sdk/analytics.dart';   // EodinAnalytics 만
import 'package:eodin_sdk/deeplink.dart';    // EodinDeeplink 만
import 'package:eodin_sdk/auth.dart';        // EodinAuth 만 (Phase 1-Auth 트랙)
```

**v1 → v2 호환** (PRD H2):
- 별도 패키지 `eodin_deeplink: ^1.99.0` 를 publish — `dependencies: { eodin_sdk: ^2.0.0 }` 로 의존
- export-forwarding 으로 v1 import 경로 유지: `import 'package:eodin_deeplink/eodin_sdk.dart';` 그대로 동작
- 6주 후 deprecated 표시, v3 에서 폐기

### 2.2 iOS (`EodinSDK`)

**v1 = v2** (변경 거의 없음, 이미 modular):
```swift
// Package.swift products
.library(name: "EodinSDK", targets: ["EodinDeeplink", "EodinAnalytics"]),  // umbrella
.library(name: "EodinDeeplink", targets: ["EodinDeeplink"]),
.library(name: "EodinAnalytics", targets: ["EodinAnalytics"]),

// Phase 1-Auth (계정 통합 후) 추가될 target
.library(name: "EodinAuth", targets: ["EodinAuth"]),  // Phase 1-Auth
```

### 2.3 Android (`app.eodin:eodin-sdk:2.0.0`)

**v1 (현재)**:
- groupId: `app.eodin`
- namespace: `app.eodin.deeplink` (잘못 — analytics 도 안에 있음)
- artifact: `eodin-sdk` 1개 (모놀리식)

**v2 (목표)**:
- groupId: `app.eodin`
- namespace: `app.eodin` (올바름)
- artifact: `eodin-sdk` (단일 — Java/Kotlin 의 namespace 분리만, gradle module 분리 X)
- 사용자는 `import app.eodin.analytics.EodinAnalytics` / `import app.eodin.deeplink.EodinDeeplink` 로 모듈별 import

이미 `src/main/java/app/eodin/{analytics,deeplink}` 로 패키지 분리되어 있어 namespace 만 정정.

### 2.4 Capacitor (`@eodin/capacitor`)

**v1 = v2** (변경 거의 없음, 이미 적절):
- TypeScript export: `export { EodinAnalytics, EodinDeeplink } from './...'`
- v2 부터 web.ts 동작화 (Phase 1.9 Must)
- Phase 1-Auth 후 EodinAuth 추가

### 2.5 Web (`@eodin/web`) — 신설 (Phase 1.4-NEW)

**v2 신설**:
```typescript
// 1차: full bundle
import { EodinAnalytics } from '@eodin/web';
// EodinAuth 는 Phase 1-Auth (계정 통합 트랙) — 보류

// SSR (Next.js Server Components)
import { EodinAnalytics } from '@eodin/web/server';  // Firebase Admin SDK 활용
```

---

## 3. 일관된 인터페이스 (5개 플랫폼)

PRD §1.4 의 "4개 SDK 동일 인터페이스" 를 5개로 확장 + S7 보류 결정으로 static 유지:

### 3.1 EodinAnalytics (5개 플랫폼 공통, S7 보류로 static)

| 메서드 | Flutter / Android / iOS / Capacitor / Web |
|---|---|
| configure | `EodinAnalytics.configure(apiEndpoint, apiKey, appId, ...)` |
| track | `EodinAnalytics.track(eventName, properties)` (¹) |
| identify | `EodinAnalytics.identify(userId)` |
| clearIdentity | `EodinAnalytics.clearIdentity()` |
| setAttribution | `EodinAnalytics.setAttribution(attribution)` |
| flush | `EodinAnalytics.flush()` |
| startSession / endSession | (lifecycle) |
| setDeviceATT | iOS / Capacitor 만 |
| setEnabled (GDPR) | (5개 공통) (²) |
| reset | (5개 공통) |

→ Capacitor 의 `track({ eventName, properties })` 객체 인자 → positional 로 정렬 (Phase 0.1 R5)

(¹) `EodinEvent` enum 도 같은 메서드로 받을 수 있다 (Phase 1.6). 단 **Flutter 만 별도 메서드명** `EodinAnalytics.trackEvent(EodinEvent event, ...)` 사용 — Dart 가 method-overloading 을 지원하지 않아 `track(String)` 과 `track(EodinEvent)` 의 동시 정의가 불가능하기 때문. iOS / Android / Capacitor 는 모두 `track` 한 이름으로 overload. 자유 string 호출 (`track('recipe_view', ...)`) 은 5채널 모두 동일.

(²) Phase 1.6 시점에서는 Flutter SDK 만 `setEnabled` / `isEnabled` / `requestDataDeletion` 구현. 나머지 4채널 (iOS / Android / Capacitor / Web) 은 `open-issues.md` §4.5 로 ticket-track — Phase 1.7 또는 1.9 에서 동등 surface 보강 예정. Capacitor wrapper 는 prototype-chain forwarding 이라 bridge 추가 시 자동 노출.

### 3.2 EodinDeeplink (Web 제외 4개 플랫폼)

| 메서드 | Flutter / Android / iOS / Capacitor |
|---|---|
| configure | `EodinDeeplink.configure(apiEndpoint, service)` |
| checkDeferredParams | `await EodinDeeplink.checkDeferredParams()` |
| isReady | (getter) |
| reset | (5개 공통) |

### 3.3 EodinAuth — Phase 1-Auth 트랙으로 분리 (계정 통합 후)

이 Phase 1.1 에서는 정의만 — 구현은 Phase 2/3 완료 후.

---

## 4. v1 → v2 Migration Guide 요지

### 4.1 Flutter

| v1 | v2 |
|---|---|
| `eodin_deeplink: ^1.0.0` | `eodin_sdk: ^2.0.0` |
| `import 'package:eodin_deeplink/eodin_sdk.dart';` | `import 'package:eodin_sdk/eodin_sdk.dart';` |
| `EodinAnalytics.track(...)` | `EodinAnalytics.track(...)` (변경 X) |
| (호환) `eodin_deeplink: ^1.99.0` (re-export) | (auto-redirect) `eodin_sdk` 사용 |

### 4.2 Android

| v1 | v2 |
|---|---|
| `implementation("app.eodin:eodin-sdk:1.0.0")` | `implementation("app.eodin:eodin-sdk:2.0.0")` |
| (Java import 변경 없음) | (Java import 변경 없음 — package 같음) |
| (build.gradle.kts namespace 변경 X — consumer 무관) | - |

### 4.3 iOS

| v1 | v2 |
|---|---|
| `.package(url: ...eodin.git, ...)` | `.package(url: ...eodin-sdk.git, from: "2.0.0")` |
| `import EodinSDK` / `EodinDeeplink` / `EodinAnalytics` | (변경 없음) |

### 4.4 Capacitor

| v1 | v2 |
|---|---|
| `npm i @eodin/capacitor@^1.0.0` (vendor tgz) | `npm i @eodin/capacitor@^2.0.0` |
| `EodinAnalytics.track({ eventName, properties })` | `EodinAnalytics.track('event_name', { ... })` (positional 정렬) |
| (없음) | `EodinAnalytics.track(EodinEvent.AppOpen)` — 권장 enum (Phase 1.6) |
| `EodinAnalytics.identify({ userId })` | `EodinAnalytics.identify(userId)` (positional) |

### 4.5 Web (신설)

| v1 | v2 |
|---|---|
| (없음) | `npm i @eodin/web@^2.0.0` |
| (없음) | `import { EodinAnalytics } from '@eodin/web';` |

---

## 5. 진행 순서 (이 결정 후)

1. 결정 문서 commit (이 파일)
2. Flutter SDK 작업:
   - 새 entry 추가: `lib/analytics.dart`, `lib/deeplink.dart` (모듈별)
   - pubspec.yaml: name `eodin_deeplink` → `eodin_sdk`, version `2.0.0-beta.1`
   - 기존 `lib/eodin_deeplink.dart` 는 deprecated 표시 + 호환 export
3. Android namespace 정정 (`app.eodin.deeplink` → `app.eodin`)
4. iOS / Capacitor: API surface 검토만 (수정 거의 없음)
5. Web SDK 신설 (Phase 1.4-NEW task) — Phase 1.6 (이벤트 enum) 완료 후 진행
6. v1 호환 패키지 publish 전략 (Phase 1.5 dual-support 와 함께)
