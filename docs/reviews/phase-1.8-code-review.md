# Code Review: Phase 1.8 — 4채널 API reference 자동 생성 인프라

**Date**: 2026-05-02
**Scope**: `libs/eodin-sdk` 의 build infra / config 변경 (Flutter dartdoc, iOS DocC, Android Dokka, Capacitor TypeDoc)
**Commit(s)**: 미커밋 (working tree). 비교 기준: `libs/eodin-sdk@da14f6b` (Phase 1.7) → 현재 working tree
**Phase**: 1.8 (Nice N12 — API reference 자동 생성)

## Summary

build infra 만 다루는 가벼운 변경이며, 4채널 모두 `internal` 패키지를 docs 에서 제외하고 public surface 만 노출하려는 의도가 일관되게 적용되었다. 빌드는 4채널 전부 통과 (130 unit tests 회귀 0). CRITICAL/HIGH 발견은 없고, MEDIUM 1건 (Dokka `models` per-package option 의 의도 모순) + LOW/NIT 5건 정도가 핵심이다.

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |
| NIT | 3 |
| INFO | 2 |

**Overall Grade**: A−

채널별 도구 선정과 default 동작 활용이 적절하고, 변경 면적이 작아 리스크가 낮다. 단 Android Dokka 설정의 정합성 점검과 향후 publish CI 자동화에서의 연결 고리만 다듬으면 된다.

---

## Critical & High Findings

해당 없음.

---

## Medium Findings

### M1. Dokka `models` per-package option 의 주석과 동작 불일치

- **Severity**: MEDIUM
- **Category**: Code Quality / Maintainability
- **File**: `libs/eodin-sdk/packages/sdk-android/build.gradle.kts:70-74`
- **Issue**: 주석은 “Models / network helpers 같은 internal 도 제외 (필요 시 별도 module)” 라고 적혀 있으나 실제 코드는 `suppress.set(false)` 로 오히려 노출 유지를 선언한다. 주석과 동작이 정확히 반대다. 게다가 `suppress` 의 default 값이 `false` 이므로 이 perPackageOption 블록은 실제로 아무 효과가 없다 (no-op).
  ```kotlin
  // Models / network helpers 같은 internal 도 제외 (필요 시 별도 module)
  perPackageOption {
      matchingRegex.set(".*\\.models")
      suppress.set(false) // models 는 public — 노출 유지
  }
  ```
- **Impact**: 향후 다른 컨트리뷰터가 주석만 보고 “models 는 docs 에서 빠진다” 라고 잘못 이해할 수 있다. 또 `network helpers` 는 `app.eodin.analytics.NetworkClient` 를 가리키는 듯한데, 이 클래스는 이미 Kotlin `internal class` 로 선언되어 있어 Dokka 가 기본적으로 docs 에서 제외한다 — perPackageOption 추가가 불필요.
- **Recommended fix**: no-op 블록을 제거하고 주석을 사실대로 정리한다.
  ```kotlin
  // Phase 1.8 — Dokka API docs configuration
  tasks.withType<org.jetbrains.dokka.gradle.DokkaTask>().configureEach {
      dokkaSourceSets.configureEach {
          moduleName.set("Eodin SDK Android")
          // 내부 helper (app.eodin.internal.*) 는 docs 에서 제외
          perPackageOption {
              matchingRegex.set("app\\.eodin\\.internal.*")
              suppress.set(true)
          }
          // BuildConfig stub (Gradle 이 자동 생성하는 build-time class) 제외
          perPackageOption {
              matchingRegex.set("app\\.eodin\\.deeplink\\.BuildConfig")
              suppress.set(true)
          }
          // NOTE: NetworkClient 등은 Kotlin `internal` 가시성으로 이미 제외됨.
          // models (AnalyticsEvent / Attribution / DeviceInfo) 는 public 이라 docs 에 노출.
      }
  }
  ```

---

## Low Findings

### L1. Dokka `BuildConfig` 정규식이 AGP 자동 생성 BuildConfig 를 놓침

- **Severity**: LOW
- **Category**: Build Config / Correctness
- **File**: `libs/eodin-sdk/packages/sdk-android/build.gradle.kts:66-69`
- **Issue**: 현재 수동 작성된 `app/eodin/deeplink/BuildConfig.kt` (개발용 stub, `internal object`) 는 정규식 `app\.eodin\.deeplink\.BuildConfig` 로 잡힌다. 그런데 `consumer-rules.pro` 와 `proguard-rules.pro` 가 이미 가리키는 AGP 자동 생성 `app.eodin.BuildConfig` (현재 `namespace = "app.eodin"` 기준) 는 정규식 패턴에 걸리지 않는다. 호스트 앱이 Dokka 를 release variant 로 돌리면 `app.eodin.BuildConfig` 가 docs 에 노출될 수 있다.
- **Impact**: 실제로 AGP 가 namespace 기준으로 `app.eodin.BuildConfig` 를 생성하는데 Dokka HTML 에 빌드 메타데이터 (BUILD_TYPE, VERSION_CODE 등) 가 public API 로 보이게 된다. 큰 보안 이슈는 아니지만 “public surface 만” 의도와 어긋난다. 또 수동 stub 의 패키지가 `app.eodin.deeplink` 인 것도 namespace v2.0.0 변경 (`app.eodin.deeplink` → `app.eodin`) 과 일관성이 깨진다.
- **Recommended fix**: 정규식을 namespace 변경에 맞춰 좁게 두 줄로 분리하거나, 더 안전하게 한 줄 광범위 패턴으로 통일.
  ```kotlin
  // 수동 stub + AGP 자동 생성 BuildConfig 모두 매칭
  perPackageOption {
      matchingRegex.set(".*\\.BuildConfig")
      suppress.set(true)
  }
  ```
  추가로 `BuildConfig.kt` 수동 stub 자체를 추후 제거하고 AGP 의 `buildFeatures { buildConfig = true }` 로 통일하는 ticket 도 검토할 것.

### L2. `dartdoc_options.yaml` 의 `unresolved-doc-reference` ignore 가 잠재 문서 회귀를 가린다

- **Severity**: LOW
- **Category**: Documentation Quality
- **File**: `libs/eodin-sdk/packages/sdk-flutter/dartdoc_options.yaml:8-9`
- **Issue**: 현재 `unresolved-doc-reference` 와 `broken-link` 두 가지를 ignore 한다. broken-link 는 외부 URL 단절이라 통제 외라 OK 지만, `unresolved-doc-reference` 는 dartdoc 의 `[ClassName]` 스타일 inline reference 가 컴파일 타임에 풀리지 않을 때 나오는 경고다. ignore 로 뭉개버리면 향후 클래스 rename 시 doc reference 오타가 silently 묻힌다.
- **Impact**: dartdoc 출력은 0 warning 으로 깨끗해 보이지만 실제로는 stale doc 링크가 누적될 수 있다. 사용자 경험 저하는 작으나 maintainability 비용이 늘어난다.
- **Recommended fix**: `unresolved-doc-reference` 는 ignore 가 아닌 `error` 로 두거나 (dartdoc 기본은 warning), 임시 우회였다면 “TODO: Phase 1.10 에 raw warning 들 정리 후 ignore 제거” 주석을 같이 두는 것이 정직하다.
  ```yaml
  dartdoc:
    showUndocumentedCategories: false
    ignore:
      # 외부 URL 만 — 외부 변동은 통제 불가
      - 'broken-link'
      # TODO(Phase 1.10): unresolved-doc-reference 정정 후 ignore 제거
      - 'unresolved-doc-reference'
  ```

### L3. TypeDoc `readme: "none"` 은 Phase 1.10 베타 직전에 README 추가 + 정정 필요

- **Severity**: LOW
- **Category**: Documentation / Future Work
- **File**: `libs/eodin-sdk/packages/capacitor/typedoc.json:6`
- **Issue**: Capacitor 패키지에 README.md 가 없어 `readme: "none"` 으로 설정. SDK 루트의 `libs/eodin-sdk/README.md` 가 4채널 통합 README 라 패키지별 README 부재 자체는 자연스럽지만, npm 에 publish 하면 npmjs.com 에서 패키지 페이지 README 가 비게 된다.
- **Impact**: pre-publish 단계에서 영향 없음. publish 시점 (Phase 0.5.6 + 1.10) 에 npm 페이지 첫인상 저하.
- **Recommended fix**: 본 phase 에서는 OK. Phase 1.10 베타 릴리스 체크리스트에 “Capacitor 패키지에 README.md 추가 후 typedoc.json 의 `readme` 설정을 default (auto-detect) 로 되돌릴 것” 항목을 추가. 추적 ticket 발행 권장.

### L4. Capacitor `.gitignore` 가 모노레포 root .gitignore 와 일부 중복

- **Severity**: LOW
- **Category**: Build Infra / Hygiene
- **File**: `libs/eodin-sdk/packages/capacitor/.gitignore` (신규)
- **Issue**: `libs/eodin-sdk/.gitignore` 가 이미 `node_modules/`, `dist/` 를 무시 중. Capacitor 패키지 신규 `.gitignore` 가 이를 다시 선언한다. 또 main monorepo root `/Users/ahnwoojin/Github/eodin/.gitignore` 도 `node_modules` 를 무시한다.
  ```
  node_modules/        # 중복 — eodin-sdk root + monorepo root 양쪽에 이미 있음
  dist/                # 중복 — eodin-sdk root 에 이미 있음
  docs/api/            # 신규 — TypeDoc 산출물, 의도 OK
  .DS_Store            # 중복 — eodin-sdk root 에 있음
  .vscode/             # 중복 — monorepo root 에 있음
  .idea/               # 중복 — monorepo root 에 있음
  ```
- **Impact**: 무해하나 중복 라인이 이후 root .gitignore 정정 시 drift 를 만든다. 패키지별 .gitignore 는 “해당 패키지에서만 발생하는” 산출물에 한정하는 편이 깔끔.
- **Recommended fix**: 패키지 .gitignore 는 `docs/api/` 만 두고 나머지는 root 에 위임. 단 git submodule (`libs/eodin-sdk` 자체가 submodule) 인 점을 감안하면 SDK 가 외부 (ahn283/eodin-sdk public) 단독으로 clone 될 때도 동작해야 하므로 “node_modules/dist 도 같이 두는 편이 안전” 이라는 반론 가능. 그렇다면 정정하지 않아도 OK — 단 그 의도를 한 줄 주석으로 남길 것.
  ```
  # 본 .gitignore 는 SDK 가 standalone repo (ahn283/eodin-sdk) 로
  # clone 될 때도 동작하도록 root .gitignore 와 일부 항목을 중복 선언한다.
  node_modules/
  dist/
  docs/api/
  ```

---

## Nit Findings

### N1. `xcodebuild docbuild -scheme EodinSDK` README 명령은 Simulator 전용 destination 에 한정됨

- **Severity**: NIT
- **Category**: Documentation
- **File**: `libs/eodin-sdk/README.md` (Phase 1.8 추가 섹션)
- **Issue**: README 는 `-destination 'generic/platform=iOS Simulator'` 로 단일 destination 을 명시한다. SPM 의 `EodinSDK` 라이브러리는 `iOS(.v13)` + `macOS(.v10_15)` 양 platform 을 지원하는데 (Package.swift), 명령은 iOS Simulator 만 빌드한다. macOS 빌드 docs 가 필요하다면 `-destination 'platform=macOS'` 로 별도 실행 필요.
- **Impact**: 거의 없음 (모바일 SDK 라 macOS 사용 가능성 낮음). 단 README 가 “표준 명령” 처럼 읽히므로, macOS 도 빌드되는 점을 가볍게 언급하는 게 좋다.
- **Recommended fix**: README 표 아래에 한 줄 추가.
  > iOS / macOS 양 platform 빌드는 destination 만 바꿔 같은 scheme 으로 가능.

### N2. iOS DocC 산출물 위치가 README 와 실제 build 디렉토리에서 모호하다

- **Severity**: NIT
- **Category**: Documentation
- **File**: `libs/eodin-sdk/README.md`
- **Issue**: README 는 `*.doccarchive (DerivedData 안)` 으로만 적혀 있어 어디서 찾는지 발견하려면 `find /tmp/eodin-sdk-build -name "*.doccarchive"` 같은 추가 명령이 필요하다.
- **Recommended fix**: 정확한 경로 한 줄 추가.
  > 산출물: `/tmp/eodin-sdk-build/Build/Products/Debug-iphonesimulator/EodinSDK.doccarchive`

### N3. Dokka HTML 명령이 README 와 실제 사용법에서 달라질 수 있음

- **Severity**: NIT
- **Category**: Documentation Accuracy
- **File**: `libs/eodin-sdk/README.md` (Android row)
- **Issue**: README 는 `gradle dokkaHtml` 이라 적었지만, `sdk-android` 자체에 standalone Gradle wrapper 가 없으므로 실제로는 host app (예: kidstopia) 의 wrapper 를 통해 `./gradlew :sdk-android:dokkaHtml` 을 실행해야 한다. build.gradle.kts 의 주석 (`./gradlew :sdk-android:dokkaHtml`) 과 README 가 다르다.
- **Recommended fix**: README 명령을 build.gradle.kts 주석과 일치시킨다.
  ```
  | Android | host app gradle 통해: `./gradlew :sdk-android:dokkaHtml` | `build/dokka/html/` |
  ```

---

## Data Flow / Cross-channel Issues

### Internal-package 제외 정합 (4채널 비교)

| Channel | 도구 | 제외 메커니즘 | 검증 결과 |
|---|---|---|---|
| Flutter | dartdoc | `lib/<lib>.dart` 의 `export` 가 `lib/src/internal/*` 를 export 하지 않음 → dartdoc 기본 동작으로 미문서화 | OK — 4개 library entry (`eodin_sdk.dart`, `deeplink.dart`, `analytics.dart`, `eodin_deeplink.dart`) 어디에도 `endpoint_validator.dart` 가 export 되지 않는 것을 확인. |
| iOS | DocC | Swift `internal` access modifier (Swift 의 default) → DocC 는 public symbol 만 문서화 | OK — `Sources/Eodin*` 의 internal 헬퍼는 `internal`/`fileprivate` 라 자동 제외. `EodinSDK` umbrella scheme 으로 두 target 모두 docbuild 통과 확인됨. |
| Android | Dokka | Kotlin `internal class/object` + perPackageOption suppress | 부분 OK — `internal` 가시성으로 `EndpointValidator`, `DeviceFingerprint`, `BuildConfig` (수동 stub), `NetworkClient` 모두 자동 제외. perPackageOption 의 `app.eodin.internal.*` suppress 는 안전망 역할. M1 / L1 항목 적용 권장. |
| Capacitor | TypeDoc | `excludePrivate / excludeProtected / excludeInternal` + `exclude: ['src/__tests__/**', 'src/web.ts']` | OK — `_EodinAnalyticsBridge` 가 `const` (non-export) 이므로 자연 제외. 산출물 검증: `interfaces/` 8개, `variables/` 3개, `types/` 3개 — public surface 와 정확히 일치. |

총평: 4채널 모두 “기본 가시성 시스템 (internal/private) + 도구별 추가 안전망” 이라는 동일한 패턴을 일관되게 적용했다.

### Bundled native (Capacitor) 의 의도적 docs 제외

`packages/capacitor/ios/Sources/EodinCapacitorPlugin/` 와 `packages/capacitor/android/src/main/java/` 는 별도 docs 생성 설정이 없다. 이는 의도적 — Capacitor 플러그인의 native bridge 코드는 host app 빌드 의존성이며 SDK 사용자는 TypeScript API (`@eodin/capacitor`) 만 본다. `EodinSDK.doccarchive` (sdk-ios) 와 Dokka HTML (sdk-android) 가 native API 의 단일 진실원이고, 번들된 사본을 별도 문서화하면 오히려 중복 정보 + drift 위험이 생긴다. 결정 OK.

---

## Versioning & Stability

### TypeDoc `^0.26.11` (caret) — OK

TypeDoc 0.x 는 minor bump 에서 breaking change 가 종종 있는 ecosystem 이지만, 본 프로젝트의 출력 포맷 의존도가 낮고 (HTML 산출물만 사용) Phase 1.10 베타 릴리스 직전에 한 번 더 정정할 수 있는 짧은 시점이라 caret pin 으로 충분하다. 0.27 / 0.28 로 자동 bump 되더라도 본 phase 의 4채널 일관성 회귀 위험은 낮다.

### Dokka `1.9.20` (exact) — OK

Gradle plugin block 의 `id("...") version "..."` 은 이미 exact pin 이라 변동성 없음. 단 호스트 앱이 Kotlin 1.8 를 쓴다면 Dokka 1.9.20 (Kotlin 1.9 / 1.9.10 호환) 이 충돌할 수 있다. 본 monorepo 의 host app 들 (kidstopia, semag.app 등) 은 일반적으로 Kotlin 1.9+ 를 쓰므로 실무상 문제 없으나, 추후 새 host app 통합 시 “Kotlin ≥ 1.9 + AGP ≥ 8.0” 을 README 에 명시하는 게 안전하다.

### dartdoc / DocC — SDK 내장

도구 버전이 `dart` / Swift toolchain 에 종속. CI 가 Flutter / Xcode 버전을 명시 (Phase 0.5.6 publish workflow 시점) 하면 자동 안정화. 본 phase 에서 추가 작업 불필요.

---

## CI Automation (Phase 0.5.6 와의 연결 고리)

본 phase 는 “local 에서 명령으로 docs 생성” 까지만 책임지고 GitHub Actions / publish workflow 추가는 의도적으로 보류했다. 보류 결정 자체는 OK — Phase 0.5.6 (publish CI/CD, 사용자 토큰 대기 중) 와 묶이는 게 자연스럽다.

다만 본 phase 마무리 시점에 다음 두 가지를 별도 ticket 으로 발행해두는 것을 권장한다.

- **Ticket A (Phase 0.5.6 / 1.10 준비)**: 4채널 docs 자동 생성 GitHub Actions workflow 작성. 산출물을 `gh-pages` 브랜치 또는 GitHub Pages 로 publish. 채널별 명령은 본 phase 의 README 표를 그대로 따른다.
- **Ticket B (M1, L1, L3 묶음)**: Dokka models perPackageOption 정정 + BuildConfig 광범위 정규식 + Capacitor README 추가. 본 phase 결과를 검수 후 별도 fixup 커밋으로 처리해도 된다.

---

## Build & Test Verification

빌드 컨텍스트에서 보고된 결과는 직접 재실행 없이 다음을 확인했다.

- TypeDoc 산출물 실제 생성됨: `packages/capacitor/docs/api/` (interfaces 8 + variables 3 + types 3 + index.html). 내용이 `definitions.ts` 의 public export 와 정확히 매칭.
- TypeDoc 0.26.11 이 실제 `node_modules/typedoc/package.json` 에 설치된 버전 — `^0.26.0` caret 이지만 lock 시 0.26.11 로 고정.
- 4채널 unit tests (Flutter 40 + iOS 26 + Capacitor 64 = 130) 회귀 0 — 본 phase 가 source 변경 없이 build infra 만 추가했으므로 정합.

빌드 검증의 “0 warning / 0 error” 보고는 dartdoc 의 `unresolved-doc-reference` ignore 영향이 있을 수 있으므로 (L2 참조), Phase 1.10 정합 점검 시 ignore 를 잠시 풀고 raw 결과를 한 번 확인하는 것을 권장한다.

---

## Positive Observations

- **채널별 default 동작 활용**: dartdoc 은 lib entry 의 export 그래프를, DocC 는 Swift access modifier 를, TypeDoc 은 `excludeInternal` 을 활용해 “언어 표준 가시성 + 도구 추가 안전망” 의 깨끗한 2단 방어를 구성. 별도의 복잡한 exclude rule 을 만들지 않아 향후 유지보수가 쉽다.
- **bundled native 의 docs 미생성 결정**: Capacitor 패키지의 ios/Sources, android/src 가 sdk-ios / sdk-android 사본임을 알고 의도적으로 제외 — drift 위험을 줄이는 좋은 판단.
- **README 의 “endpoint 분리” 일관성**: 4채널 명령 표 아래 internal 패키지 제외 정책을 한 줄로 명시한 부분이 reviewer 가 의도를 빠르게 파악하게 해준다.
- **Phase 1.8 / 0.5.6 분리**: docs 생성 (build infra) 과 publish CI (deploy infra) 를 분리한 phase 설계가 정확하다. 도구 검증과 자동화 정책을 한 phase 에 묶었다면 본 phase 가 비대해졌을 것.
- **신규 dependencies 가 모두 dev-only**: TypeDoc / Dokka / dartdoc 모두 dev-only 라 SDK 사용자의 transitive dependency 에 영향 없음.

---

## Action Items

### 본 phase 에서 정정 권장 (선택)

- [ ] **M1**: `build.gradle.kts` 의 `models` perPackageOption 블록 제거 + 주석을 “internal NetworkClient 등은 Kotlin internal 가시성으로 자동 제외” 로 정정.
- [ ] **L1**: BuildConfig 정규식을 `.*\\.BuildConfig` 로 광범위화하여 AGP 자동 생성본까지 커버.
- [ ] **N3**: README Android 행 명령을 `./gradlew :sdk-android:dokkaHtml` 로 정정.

### Phase 1.10 (베타 릴리스 준비) 직전에 처리

- [ ] **L2**: `unresolved-doc-reference` ignore 일시 해제 후 raw 경고 정리.
- [ ] **L3**: Capacitor 패키지 README.md 추가 + `typedoc.json` 의 `readme: "none"` 정정.
- [ ] **L4**: SDK standalone repo clone 시나리오 의도라면 Capacitor `.gitignore` 에 한 줄 주석 추가, 아니라면 중복 라인 제거.
- [ ] **N1, N2**: README 에 destination / 산출물 정확한 경로 한 줄 추가.

### Phase 0.5.6 (publish CI/CD, 사용자 토큰 대기) 와 묶기

- [ ] **Ticket A**: 4채널 docs 자동 생성 GitHub Actions workflow + GitHub Pages publish.
- [ ] Host app 통합 가이드에 “Kotlin ≥ 1.9, AGP ≥ 8.0” 명시 (Dokka 1.9.20 호환성).

---

## INFO

- Dokka `1.9.20` 은 Dokka 2.0 (현재 GA, 2025-09 출시) 으로의 마이그레이션 path 가 있다. 다만 1.9.x 도 LTS 성격으로 한동안 유지되므로 본 phase 시점에 2.0 로 점프할 필요는 없다. Phase 2 (post-GA) 시점에 검토.
- TypeDoc 0.27 (2025-12 출시) 부터 ESM-only 변경이 있으나 본 프로젝트의 build script 가 Node 자체 ESM 호환이라 caret 에 의한 자동 bump 시 위험이 낮다.
