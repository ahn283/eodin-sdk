# Eodin SDK v1 → v2 Migration Guide

**Target SDK**: `2.0.0-beta.1`
**Last Updated**: 2026-05-02
**Audience**: 5개 기존 호스트 앱 (fridgify / plori / tempy / arden / kidstopia) 마이그 담당자

> 신규 앱 채택 가이드는 `integration-guide.md` 참조.

---

## 0. 본 가이드의 범위

본 가이드는 **기존 4채널 SDK (Flutter / iOS / Android / Capacitor) 의 v1 → v2 마이그**를 다룬다. 5번째 채널 **`@eodin/web`** 은 v2 시점에 **신생 패키지**라 마이그 대상 아님 (이전 버전이 없음). 새로운 web 호스트가 채택할 때는 [`integration-guide.md` §3.5](./integration-guide.md#35-web-eodinweb) 참조.

---

## 1. 마이그가 필요한 이유

| Phase | 변경 | 호스트 앱 영향 |
|---|---|---|
| 1.1 | Flutter 패키지명 `eodin_deeplink` → **`eodin_sdk`** | pubspec dep 이름 + import 경로 변경 (Flutter 4개) |
| 1.1 | Android namespace `app.eodin.deeplink` → `app.eodin` | 5개 앱 모두 native Android 직접 사용 X → 영향 없음 |
| 1.1 | Android artifactId `deeplink-sdk` → `eodin-sdk` | 동일하게 영향 없음 |
| 1.3 | API endpoint `link.eodin.app/api/v1` → `api.eodin.app/api/v1` | 5개 앱 모두 명시 `apiEndpoint` 설정 — 호출 코드만 갱신 (string 1줄) |
| 1.6 | `EodinEvent` enum 추가 (additive — 자유 string 보존) | 점진 마이그 — 17건 명명 충돌 정정만 필수 |
| 1.6 | Capacitor `track({eventName, properties})` → **`track(eventName, properties)`** positional | kidstopia 호출부 2곳 변경 (BREAKING) |
| 1.6 | Capacitor `identify({userId})` → **`identify(userId)`** positional | kidstopia 호출부 1곳 변경 (BREAKING) |
| 1.9 | Capacitor web.ts throw → 동작 | kidstopia PWA 사용자 분석 첫 수집 (의도된 동작 변경) |

**시점**: SDK `v2.0.0-beta.1` git tag 가 `ahn283/eodin-sdk` 에 push 된 후 시작. main branch 에 v2 가 push 돼도 ref tag pin 으로 호스트 앱은 안전.

**리스크 평가** (코드리뷰 + Phase 0 audit 결과):
- Flutter 4개: import 일괄 변경 (sed) — 회귀 리스크 **낮음**
- Capacitor 1개 (kidstopia): track / identify 호출 변경 + tgz 교체 — 회귀 리스크 **중간**
- Endpoint: 5개 앱 모두 명시 configure — 영향 0

---

## 2. 사전 준비

### 2.1 SDK v2 태그 확인

```bash
# eodin-sdk 저장소
git ls-remote --tags https://github.com/ahn283/eodin-sdk.git | grep v2.0.0
# → refs/tags/v2.0.0-beta.1 가 존재해야 함
```

태그가 없으면 SDK 팀이 Phase 1.10 릴리스 작업을 먼저 완료해야 한다.

### 2.2 Staging API key 발급

각 앱별로 production / staging 분리 API key 가 있어야 한다. Phase 5 마이그는 staging 에서 1주 검증 후 production 전환을 권장.

### 2.3 회귀 매트릭스 준비

각 앱마다 다음 검증 항목을 사전에 정의:

| 항목 | 방법 |
|---|---|
| 빌드 (debug + release) | `flutter build apk --debug` / `flutter build ios --debug` 등 |
| 단위 테스트 | `flutter test` / `npm test` |
| 이벤트 발화 검증 | Eodin debug logs + staging API logs |
| Deferred deep link | 테스트 링크 클릭 → 미설치 상태 → 설치 → 첫 실행 |
| 기존 화면 smoke test | 핵심 사용자 흐름 (로그인 / 핵심 액션 / 결제) |
| Firebase Analytics 정합 | DebugView 에서 dual-tracking 동작 확인 |

---

## 3. 권장 진행 순서 (canary)

마이그 리스크 최소화를 위해 **호출부 적은 앱부터 진행** + **앱당 staging 1주 검증 후 다음 앱**:

1. **plori** (호출부 11) — Flutter, git ref → 1차 canary 🟢 **2026-05-03 코드 마이그 완료**, staging 검증 진행 중
2. **arden** (호출부 16) — Flutter, git ref
3. **fridgify** (호출부 16) — Flutter, **submodule → git ref 전환 추가**
4. **tempy** (호출부 71, wrapper 안에 갇혀있어 import 만 변경) — Flutter, git ref
5. **kidstopia** (호출부 11) — Capacitor + Web — 마지막 (positional API 변경 + web 첫 수집)

### Phase 5.1 plori canary 실측 결과 (2026-05-03)

마이그 가이드 §4.1 따라 진행한 첫 canary. 실제 작업량 + 검증 결과:

| 항목 | 결과 |
|---|---|
| 변경 파일 | **5 파일 / 총 9 줄** (pubspec.yaml + pubspec.lock + lib 3 파일) |
| 변경 패턴 | pubspec dep 이름 + ref `main` → `v2.0.0-beta.1` (tag pin) + import sed (3 곳) |
| 호출부 코드 변경 | **0** — `EodinAnalytics.track('event', ...)` / `EodinDeeplink.checkDeferredParams()` 등 모든 호출이 v2 자유 string API 그대로 동작 |
| `flutter pub get` | OK (`eodin_deeplink 1.0.0` 제거 / `eodin_sdk 2.0.0-beta.1` 신규) |
| `flutter analyze` | clean (기존 7 issues 모두 v2 무관 — Share deprecated 등) |
| `flutter test` | **521/521 pass** |
| `flutter build apk --debug` | SUCCEEDED |
| commit | `ahn283/plori` `3c02c1d feat(mobile): migrate to eodin_sdk v2.0.0-beta.1 (Phase 5.1 canary)` |
| 작업 시간 | ~10분 (단순 sed + pub get + 검증) |

**결론**: 가이드 §4.1 의 "단순 sed + pub get" 워크플로우가 정확히 작동 — 호출부 코드 무수정으로 v2 채택 가능. 다른 3개 Flutter 앱 (arden / tempy / fridgify) 도 동일 패턴으로 진행 가능.

남은 검증 (staging 1주):
- iOS release 빌드 (`pod install --repo-update && flutter build ios --release`)
- 실기기 deferred deep link 동작
- Eodin staging API 의 이벤트 수신 확인
- 핵심 사용자 흐름 smoke test

---

## 4. Flutter 4개 앱 마이그 (plori / arden / tempy / fridgify)

### 4.1 plori / arden / tempy 공통 (git ref 형태 유지)

#### 4.1.1 `pubspec.yaml` 변경

```yaml
# before
dependencies:
  eodin_deeplink:
    git:
      url: https://github.com/ahn283/eodin-sdk.git
      path: packages/sdk-flutter
      ref: main

# after
dependencies:
  eodin_sdk:
    git:
      url: https://github.com/ahn283/eodin-sdk.git
      path: packages/sdk-flutter
      ref: v2.0.0-beta.1     # tag pin 권장
```

#### 4.1.2 import 일괄 변경 (sed)

```bash
# Repo 루트에서
find lib -name '*.dart' -exec sed -i.bak \
    -e 's/package:eodin_deeplink/package:eodin_sdk/g' {} \;

# 백업 .bak 파일 검토 후 삭제
find lib -name '*.dart.bak' -delete
```

**확인**: `git diff` 로 변경 파일 목록 확인 → 호출부 wrapper 안에 갇혀있으면 import 1-3 곳만 영향.

#### 4.1.3 Endpoint 변경 (Phase 1.3)

```dart
// before
EodinAnalytics.configure(
  apiEndpoint: 'https://link.eodin.app/api/v1',  // 또는 link.eodin.app
  ...
);

// after
EodinAnalytics.configure(
  apiEndpoint: 'https://api.eodin.app/api/v1',
  ...
);
```

> **검증**: `grep -rn 'link.eodin.app' lib/` 로 모든 endpoint 잔존 확인. SDK 코드에서는 default 가 이미 변경됐지만 호스트 앱이 명시 override 했을 수 있음.

#### 4.1.3b ⚠️ Plain HTTP endpoint 사전 검사 (Phase 1.6 S8 — launch crash 방지)

v2 부터 SDK 의 `configure()` 가 HTTPS 만 허용한다 (`localhost` / `127.0.0.1` 예외, debug build 에서만 `10.0.2.2` 추가 허용). staging / dev 환경에서 `http://` endpoint 박아둔 곳이 있다면 v2 채택 즉시 launch crash:

```bash
# Flutter / Dart 코드 + 환경설정
grep -rEn "http://(?!localhost|127\.0\.0\.1)" lib/ assets/ .env*

# release 빌드에서 10.0.2.2 박혀있으면 별도 점검 (debug 만 허용)
grep -rn "10\.0\.2\.2" lib/

# 검색 결과를 staging endpoint (예: https://api-staging.eodin.app/api/v1) 로 일괄 변경
```

호스트 앱 환경별 endpoint 가 .env / Dart `--dart-define` / build flavor 에 분산돼 있으면 빠짐없이 점검. **staging/dev 의 `http://` 가 prod 빌드에 섞여 들어가면 release crash → app store 리젝트 가능**.

#### 4.1.4 빌드 + 테스트

```bash
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --debug
```

회귀 0 확인.

#### 4.1.5 (선택) EodinEvent enum 도입

자유 string `track('app_open')` 도 그대로 동작하지만, 점진적으로 enum 으로 전환 권장:

```dart
// before
EodinAnalytics.track('app_open');
EodinAnalytics.track('subscribe_start', properties: {...});

// after
EodinAnalytics.trackEvent(EodinEvent.appOpen);
EodinAnalytics.trackEvent(EodinEvent.subscribeStart, properties: {...});
```

**중요 — Phase 5 정정 대상** (`event-schema-audit.md` §6.1):

| 앱 | v1 이벤트명 | v2 정정 |
|---|---|---|
| fridgify | `subscription_purchase_completed` | `subscribe_start` |
| fridgify | `subscription_trial_started` | `trial_start` |
| fridgify | `subscription_restored` | `subscription_restore` |
| fridgify | `paywall_dismissed` | `paywall_dismiss` |
| fridgify | `ad_clicked` | `ad_click` |
| fridgify | `ad_failed` | `ad_load_failed` |
| fridgify | `rewarded_ad_attempt` / `rewarded_ad_complete` | `ad_rewarded_view` |
| fridgify | `infographic_generate_started` / `_completed` | `_start` / `_complete` |
| arden | `interstitial_ad_shown` | `ad_interstitial_view` |
| arden | `native_ad_shown` | `ad_native_view` |
| arden | `onboarding_skipped` | `onboarding_skip` |
| arden | `auth_logout` | `sign_out` |
| arden | `auth_account_deleted` | `account_delete` |
| kidstopia | `login` | `sign_in` |

> 정정 시 분석 dashboard 에서 baseline 이 한 번 점프할 수 있음 (이름 다른 두 이벤트로 보임). Phase 5 마이그 직후 baseline reset 안내 필요.

#### 4.1.6 (선택) GDPR API 도입 (Phase 1.7)

v2 부터 5채널 모두 GDPR 표면 (`setEnabled` / `isEnabled` / `requestDataDeletion`) 제공. 마이그 자체와 무관하지만 호스트 앱이 사용자 동의/옵트아웃/데이터 삭제 흐름을 구현 시 활용:

```dart
// Flutter
await EodinAnalytics.setEnabled(false);  // 옵트아웃 (즉시 큐 비우고 신규 이벤트 차단)
final ok = await EodinAnalytics.requestDataDeletion();  // GDPR Article 17
```

자세한 사용법은 `integration-guide.md` §6 (GDPR / Right to Erasure) 참조.

---

### 4.2 fridgify 추가 작업 (submodule → git ref 전환)

fridgify 만 SDK 를 git submodule (`libs/eodin-sdk/`) 로 두고 path-based dep 으로 사용 중이다. 다른 3개 앱과 일관성 위해 git ref 로 전환:

#### 4.2.1 Submodule 제거

```bash
# fridgify repo 루트에서
git submodule deinit -f libs/eodin-sdk
git rm -f libs/eodin-sdk
rm -rf .git/modules/libs/eodin-sdk
git add .gitmodules

# 변경 확인 — .gitmodules 에서 [submodule "libs/eodin-sdk"] 블록이 사라졌는지
```

#### 4.2.2 `mobile/pubspec.yaml` 변경

```yaml
# before
dependencies:
  eodin_deeplink:
    path: ../libs/eodin-sdk/packages/sdk-flutter

# after
dependencies:
  eodin_sdk:
    git:
      url: https://github.com/ahn283/eodin-sdk.git
      path: packages/sdk-flutter
      ref: v2.0.0-beta.1
```

#### 4.2.3 4.1 의 import / endpoint / 빌드 단계 동일 적용

#### 4.2.4 (선택) RevenueCat alias 설정 점검

`revenuecat-impact.md` 결과 — fridgify 의 RevenueCat customer ID 가 Postgres UUID (`User.id`) 라 SDK 마이그에 무영향. 단 Phase 5 베타 단계에서 staging 결제 1건 테스트로 RC dashboard 의 entitlement 정상 매핑 재확인 권장.

---

## 5. kidstopia 마이그 (Capacitor + Web)

### 5.1 vendor tgz 교체

`@eodin/capacitor` 가 vendor tgz 로 들어와 있다 (`vendor/eodin-capacitor-1.0.0.tgz`). 새 tgz 로 교체:

```bash
# eodin-sdk 저장소에서 v2 tgz 빌드 (또는 Phase 0.5.6 publish CI 가 갖춰지면 npm install)
cd /path/to/eodin-sdk/packages/capacitor
npm run build
npm pack
# → eodin-capacitor-2.0.0-beta.1.tgz 생성

# kidstopia 로 복사
cp eodin-capacitor-2.0.0-beta.1.tgz /path/to/kidstopia/vendor/
rm /path/to/kidstopia/vendor/eodin-capacitor-1.0.0.tgz
```

`package.json` 갱신:

```json
{
  "dependencies": {
    "@eodin/capacitor": "file:vendor/eodin-capacitor-2.0.0-beta.1.tgz"
  }
}
```

### 5.1.1 ⚠️ `@eodin/web` 동시 설치 (Phase 2 어댑터화 후 필수)

Phase 2 (web-sdk 트랙) 부터 `@eodin/capacitor` 의 web fallback 이 `@eodin/web/internal` 을 import 한다. capacitor `package.json` 의 `dependencies` 에 `"@eodin/web": "^1.0.0-beta.1"` 가 등록되어 있어 **`@eodin/web` 이 npm 에 publish 된 상태에서는 자동 설치**.

**publish 전 (현재 시점) — vendor tgz 사용**: `@eodin/web` 도 별도 vendor 필요:

```bash
cd /path/to/eodin-sdk/packages/sdk-web
npm run build
npm pack
# → eodin-web-1.0.0-beta.1.tgz 생성

cp eodin-web-1.0.0-beta.1.tgz /path/to/kidstopia/vendor/
```

`package.json` 의 `dependencies` 에 둘 다 명시:

```json
{
  "dependencies": {
    "@eodin/capacitor": "file:vendor/eodin-capacitor-2.0.0-beta.1.tgz",
    "@eodin/web": "file:vendor/eodin-web-1.0.0-beta.1.tgz"
  }
}
```

**publish 후**: `@eodin/web` 이 npm 에 있으면 capacitor 의 `^1.0.0-beta.1` 가 자동 해결 → kidstopia 측 `package.json` 에 `@eodin/web` 명시 불필요 (`@eodin/capacitor` 만 있으면 transitive dep 으로 따라옴).

### 5.2 Positional API 호출 변경 (BREAKING)

```typescript
// before (v1 — 객체 인자)
EodinAnalytics.track({ eventName: name, properties: params ?? {} });
EodinAnalytics.identify({ userId: uid });

// after (v2 — positional)
EodinAnalytics.track(name, params ?? undefined);
EodinAnalytics.identify(uid);
```

> 변경 위치는 보통 host 앱의 `analyticsService.ts` wrapper 1곳. 다음 grep 으로 모든 호출 확인:

```bash
grep -rn "EodinAnalytics\.\(track\|identify\)" src/
```

### 5.2b ⚠️ Plain HTTP endpoint 사전 검사 (Phase 1.6 S8 — launch crash 방지)

Capacitor (kidstopia) 도 v2 부터 `configure()` 가 HTTPS 강제. Web 빌드에서는 `10.0.2.2` 도 reject (loopback 만 허용). 사전 grep:

```bash
grep -rEn "http://(?!localhost|127\.0\.0\.1)" src/ .env*
```

staging / dev endpoint 가 `http://` 면 일괄 https 로 변경. 누락 시 web 사용자 launch error.

### 5.3 EodinEvent enum 점진 도입 (선택)

```typescript
import { EodinEvent } from '@eodin/capacitor';

// before
EodinAnalytics.track('app_open');

// after
EodinAnalytics.track(EodinEvent.AppOpen);
```

Phase 5 정정 대상: `login` → `sign_in` (호출부 grep 후 한 번에 변경).

### 5.4 Web 첫 수집 영향 (의도된 동작 변경)

v1 의 `web.ts` 는 모든 SDK 호출을 silent throw 했지만 v2 는 실제 발화한다 (Phase 1.9). 이로 인해:

- kidstopia `semag.app` 사용자의 analytics 이벤트가 v2 채택 시점부터 신규 유입
- 분석 dashboard 의 DAU / event count baseline 이 한 번 점프 (이전엔 0 이었음)
- Conversion API 매핑 (Meta CAPI / Google Ads 등) 도 web 사용자분 신규 forwarding 시작

**대응**:
- 분석 팀에 baseline reset 안내 (`semag.app` 의 v2 채택 일자 기록)
- staging 환경에서 1주 모니터링 후 production 전환

### 5.5 빌드 + sync + 검증

```bash
npm install                       # vendor tgz 갱신 반영
npx cap sync                       # native 프로젝트에 plugin 재반영
npm run build                      # web 빌드
npx cap build ios                  # native iOS 빌드
npx cap build android              # native Android 빌드
```

**Web 검증**:
- `localStorage.getItem('eodin_event_queue')` 가 사용자 액션 후 채워지는지
- 30s 후 또는 임계 20개 후 staging API 에 fetch 요청 → 200 OK 확인
- 페이지 닫을 때 (`pagehide`) `navigator.sendBeacon` 으로 마지막 batch 도 전송되는지 (Network 탭의 keepalive 요청)

**Native 검증**:
- 5.1 ~ 5.3 마이그 후 기존 native 호출 회귀 0
- 핵심 화면 smoke test (zone 구매 / 게임 / paywall)

---

## 6. 마이그 후 전체 회귀 매트릭스

각 앱 별로 다음 5개 항목 모두 통과 후 production 전환:

| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 빌드 (debug + release) | CI 또는 로컬 빌드 |
| 2 | 단위 테스트 | `flutter test` / `npm test` |
| 3 | Eodin 이벤트 발화 | staging API logs (5분 내 도달) |
| 4 | Firebase Analytics dual-tracking | DebugView |
| 5 | Deferred deeplink | 테스트 링크 → 미설치 → 설치 → 첫 실행 (deeplink 복원) |

---

## 7. Rollback 전략

문제 발견 시 즉시 v1 으로 되돌리기 위해:

### Flutter 앱

```yaml
# pubspec.yaml — ref 만 v1 시점으로 되돌림
dependencies:
  eodin_deeplink:           # 이름도 원복
    git:
      url: https://github.com/ahn283/eodin-sdk.git
      path: packages/sdk-flutter
      ref: ed009f4         # Phase 0.5 직후 (v1 마지막 안정 commit)
```

`flutter pub get` 후 import 일괄 sed 역방향 (`s/eodin_sdk/eodin_deeplink/g`).

### Capacitor (kidstopia)

```bash
# vendor 디렉토리에 v1 tgz 백업해둔 것으로 복귀
cp vendor/eodin-capacitor-1.0.0.tgz.backup vendor/eodin-capacitor-1.0.0.tgz
# package.json 도 file:vendor/eodin-capacitor-1.0.0.tgz 로 되돌림
npm install
npx cap sync
```

호출부도 v1 형태 (객체 인자) 로 역방향 변경.

> 마이그 시작 전 v1 tgz 와 git commit hash 를 별도 저장해두는 것이 rollback 비용을 최소화한다.

---

## 8. FAQ

### "마이그 도중 일부 사용자만 v2 로 가는 게 가능한가?"

Flutter / Capacitor 의 SDK 는 빌드 시점 의존성이라 빌드 단위로만 분기 가능 — 런타임 분기 X. 즉:
- **App store 배포 단계로 canary** 가능 (예: 5% staged rollout via App Store Connect / Play Console)
- 사용자별 A/B 분기는 불가능

### "v1 사용자와 v2 사용자가 혼재할 때 분석은?"

`event_name` 수준에서는 정합 (대부분 같은 이름). 단 fridgify 의 `subscription_purchase_completed` (v1) 와 `subscribe_start` (v2 정정 후) 는 다른 이름으로 보임 → 분석 쿼리에서 OR 조건으로 통합 필요.

### "Capacitor v2 채택 후 web 사용자 baseline 이 갑자기 늘어남"

정상. v1 에서는 web 사용자 이벤트가 silent throw 되어 0건이었는데 v2 부터 정상 수집. `semag.app` 의 v2 배포 일자를 baseline 시작점으로 기록하고 분석 팀에 안내.

### "fridgify 의 submodule 제거가 누락되면?"

Hidden 한 v1 SDK 코드가 그대로 남아 있어도 빌드는 동작 (path dep 이 git dep 으로 바뀌었으므로). 단 `libs/eodin-sdk/` 디렉토리가 stale 한 v1 코드로 남아 혼란 — submodule 제거 + 디렉토리 삭제 권장.

---

## 9. 일정 가이드 (제안)

```
Week 1: SDK v2.0.0-beta.1 태그 push (Phase 1.10) + 마이그 가이드 검토
Week 2: plori canary 마이그 + staging 검증
Week 3: arden 마이그 + staging 검증
Week 4: fridgify 마이그 (submodule 제거 포함) + staging 검증
Week 5: tempy 마이그 + staging 검증
Week 6: kidstopia 마이그 (Capacitor + Web) + staging 검증
Week 7-8: 전체 production 순차 배포 (App Store / Play Store / Vercel)
Week 9: 분석 baseline 확인 + 17건 명명 충돌 정정 dashboard 통합
```

> 각 단계의 staging 1주 검증은 회귀 발견 / 인시던트 대응 시간 확보용. 자신 있다면 압축 가능.

---

## 10. 참고

- `docs/unified-id-and-sdk-v2/integration-guide.md` — 신규 앱 채택
- `docs/unified-id-and-sdk-v2/CHECKLIST.md` Phase 5 — 마이그 단계
- `docs/unified-id-and-sdk-v2/event-schema-audit.md` §6.1 — 17건 명명 충돌 매핑
- `docs/unified-id-and-sdk-v2/revenuecat-impact.md` — RevenueCat alias 정책
- `docs/unified-id-and-sdk-v2/open-issues.md` §4.4 / §4.5 — 후속 ticket
- `docs/logging/unified-event-reference.md` v1.1 — 표준 이벤트 reference
