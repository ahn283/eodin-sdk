# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 MUST RULE — SDK 코드를 수정하면 README/가이드를 같은 변경 단위에서 확인·갱신한다

**타협 불가 규칙.** SDK 의 코드·동작·public API·버전·의존성·빌드 요건 중 **무엇이든** 바꾸면,
**커밋 전에 반드시** 관련 문서를 열어 **실제 코드와 대조**하고 일치하도록 업데이트한다.
코드와 문서가 어긋난 채로 커밋하지 않는다 — **문서가 코드와 다르면 그것도 버그다.**
(추정으로 문서를 믿지 말고 항상 코드로 검증한다. 실제로 코드 대조로 문서 버그 4건이 발견된 전례가 있다.)

- **갱신 대상**: `packages/<channel>/README.md` · `docs/guide/integration-guide.md` · `docs/guide/migration-guide.md` · `packages/<channel>/CHANGELOG.md` + 버전 문자열(`pubspec.yaml`/`build.gradle.kts`/`*.podspec`/`package.json`) · 루트 `README.md`
- **대조 항목**: public API 시그니처/필드 존재, 동작 계약(throw vs reject vs resolve, 서버 atomic claim), deferred 매칭 메커니즘, 새 의존성·최소 버전, 버전 문자열 일관성
- **절차**: 코드 변경과 문서 변경을 **같은 커밋/PR** 에 담는다. 아래 워크플로의 "코드리뷰" 단계에서 이 대조를 수행한다.

## 필수 작업 순서 (워크플로 게이트)

모든 변경은 이 순서를 지킨다: **개발 → 빌드 → 디자인리뷰 → 코드리뷰 → 로깅점검 → 단위테스트 → 체크리스트 → 커밋.**
(문서/인프라 변경 등 해당 없는 게이트는 N/A 로 명시하고 넘어간다.)

## 아키텍처 (big picture)

**단일 SDK, 5채널.** 모든 채널이 동일한 두 surface 를 제공한다:
- **`EodinDeeplink`** — deferred deep linking (설치 직전 클릭을 첫 실행 시 복원). 공개 API: `configure(...)` + `checkDeferredParams() → {path, resourceId, metadata, hasParams}`.
- **`EodinAnalytics`** — 이벤트/identity/세션/GDPR/ATT. `EodinEvent` enum + wire schema 는 **5채널이 동일**해야 하고 `eodin` 레포의 `unified-event-reference.md` 와 일치해야 한다.

| 채널 | 디렉토리 | 비고 |
|---|---|---|
| Flutter | `packages/sdk-flutter` (`eodin_sdk`) | `lib/src/{analytics,exceptions,internal,models}` + `eodin_deeplink.dart`. plori 가 사용하는 채널 |
| iOS/macOS | `packages/sdk-ios` (`EodinSDK`) | SwiftPM. `Sources/EodinDeeplink` + `Sources/EodinAnalytics` |
| Android | `packages/sdk-android` (`app.eodin:eodin-sdk`) | `src/main/java/app/eodin/{deeplink,analytics,internal}` |
| Capacitor | `packages/capacitor` (`@eodin/capacitor`) | TS 브릿지 + native(`android/`, `ios/`). web fallback 은 `eodin-web/internal` 위임 |
| Web | `packages/sdk-web` (`eodin-web`) | **analytics 전용** (deeplink export 없음 — 의도적) |

**크로스레포 클라이언트.** 이 repo 는 백엔드 `api.eodin.app/api/v1` 의 *클라이언트*다. 서버 계약·랜딩(`link.eodin.app`)·이벤트 레퍼런스는 별도 `eodin` 레포(`~/Github/eodin`: `apps/api`/`apps/web`/`prisma`)에 있다. deferred/click 계약을 바꿀 땐 양쪽을 함께 본다.

**Deferred 매칭 메커니즘 (핵심 도메인 로직).** public API 는 동일하지만 내부 매칭은 플랫폼별로 다르다:
- **Android Play 설치** → 랜딩이 스토어 URL 에 `eodin_cid` 클릭 토큰을 심고, SDK 가 설치 후 **Play Install Referrer** 로 회수 → 서버 토큰 결정론 매칭(~100%).
- **iOS / 비-Play** → 서버가 클릭 IP 로 시간 윈도우 내 **확률 매칭**(best-effort, ATT 무관).
- **멱등성**: 서버가 매칭된 클릭을 atomic 하게 claim → 재호출 시 404. Flutter 는 추가로 클라이언트 `claimed` 플래그(SharedPreferences)로 단락.
- **no-match 표면이 채널마다 다름**: Flutter `NoParamsFound` throw / Capacitor native 브릿지 **Promise reject**·web `hasParams:false` resolve / iOS·Android `.noParamsFound`. → 호스트 앱은 항상 graceful 처리(에러 화면 금지).

**버전·호환.** 네이티브 4채널 = `2.0.0-beta.2`, `eodin-web` = `1.0.0-beta.1`(analytics-only). public surface 불변 = SemVer minor → 호스트 앱은 ref/버전 bump 만으로 채택(코드 변경 없음). 단 Android 결정론 매칭은 beta.2 빌드를 Play 로 **재출시**해야 동작.

## 빌드 / 테스트 / 린트

> macOS 로컬: `/usr/bin/java` 는 stub 이므로 Android 빌드엔 실제 JDK 가 필요하다 — `JAVA_HOME=/opt/homebrew/opt/openjdk@17`. iOS 는 Xcode + 시뮬레이터 필요.

**Flutter** (`packages/sdk-flutter`):
```bash
flutter pub get
flutter analyze            # warning 도 실패 처리(fatal) — 0 issues 유지
flutter test               # 전체
flutter test test/gdpr_test.dart                 # 단일 파일
flutter test --plain-name "track() works after"  # 이름으로 단일 테스트
```

**iOS** (`packages/sdk-ios`) — `swift build`/`swift test` 는 macOS 에서 ATT 가용성 때문에 실패한다. **iOS Simulator** 로 빌드:
```bash
SIM='platform=iOS Simulator,name=iPhone 16 Pro'
xcodebuild build -scheme EodinSDK         -destination "$SIM"   # 라이브러리 빌드
xcodebuild test  -scheme EodinSDK-Package -destination "$SIM"   # 테스트(테스트 가능 스킴)
# 단일: xcodebuild test -scheme EodinSDK-Package -destination "$SIM" -only-testing:EodinDeeplinkTests/EodinDeeplinkTests/testErrorDescriptions
```

**Android** (`packages/sdk-android`) — standalone gradle(settings.gradle.kts + Gradle 8.7 wrapper)이 커밋돼 있어 소비 앱 없이 빌드 가능:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk
./gradlew testDebugUnitTest assembleRelease       # 단위 테스트 + AAR
./gradlew testDebugUnitTest --tests "app.eodin.analytics.AttributionTest"   # 단일 클래스
```

**Capacitor + Web** (npm 워크스페이스 — **repo 루트에서** 실행). ⚠️ `@eodin/capacitor` 는 `eodin-web/internal`(빌드된 dist)을 import 하므로 **eodin-web 을 먼저 빌드**해야 한다(안 그러면 TS2307):
```bash
npm ci                                  # 루트(워크스페이스 링크)
npm run build -w eodin-web              # capacitor 보다 먼저
npm test  -w eodin-web                  # web 테스트
npm run build -w @eodin/capacitor
npm test  -w @eodin/capacitor
npm test  -w @eodin/capacitor -- -t "withLock"   # jest 단일 패턴
```

**Capacitor iOS** (`packages/capacitor`): `xcodebuild build -scheme EodinCapacitor -destination "$SIM"`.

## CI

`.github/workflows/ci.yml` — push(`main`) + PR 에서 5잡 실행: `sdk-flutter` / `sdk-android` / `web-capacitor-ts`(eodin-web → capacitor 순) / `sdk-ios` / `capacitor-ios`. 위 로컬 명령과 동일. **`packages/capacitor/android` 는 standalone 빌드 불가**(`implementation project(':capacitor-android')` = 호스트 Capacitor 프레임워크 필요) → 호스트 앱(kidstopia) CI 에서 검증.

## 문서 위치

`docs/guide/{integration-guide,migration-guide}.md` (호스트 앱 채택/마이그), `docs/deeplink-reliability/{PRD,CHECKLIST,phase3-design}.md` (deferred 신뢰성 프로젝트), 각 `packages/<channel>/README.md`.
