# Code Review: Phase 1.0 — npm workspaces 도입 (root package.json 신설)

**Date**: 2026-05-03
**Reviewer**: Senior Code Review Agent
**Scope**: 본 phase 의 단일 변경 — `/package.json` (root, 신규 12 줄) 만
**Commit(s)**: 미커밋 (untracked, `git status` 기준 `?? package.json`)
**관련 PRD**: `docs/web-sdk/PRD.md` §6.1 / `docs/web-sdk/CHECKLIST.md` Phase 1.0

---

## Summary

Phase 1.0 변경은 root `package.json` 12 줄 신설 단일 파일이며, 4채널 SDK 코드 / capacitor `package.json` 모두 무수정. workspace 스코프를 `packages/capacitor` 단일 명시로 좁힌 결정과 `engines.npm: ">=7"` 강제는 본 phase 의도와 정합. **CRITICAL / HIGH 발견 0건**, MEDIUM 1건 (Phase 1.1 진입 시 workspaces 배열 갱신 누락 위험), LOW 2건, INFO 2건. 빌드 / 테스트 회귀 가드 (`npm install` symlink 생성 / `npm -w` build·test 64/64) 가 이미 통과되어 4채널 통합 위험은 없음.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 1 |
| 🟢 Low | 2 |
| 💡 Info | 2 |

---

## Critical & High Priority Findings

**해당 없음.**

근거:
- 본 변경은 root `package.json` 12 줄 신설 단일 파일. 기존 4채널 SDK 코드 (Flutter / iOS / Android / Capacitor) 무수정.
- `packages/capacitor/package.json` 무수정 → 기존 capacitor publish 경로 (`prepublishOnly: "npm run build"` → npm registry) 의 동작 변화 없음.
- `packages/sdk-flutter` (pub.dev / pubspec.yaml 토큰) / `packages/sdk-ios` (SwiftPM) / `packages/sdk-android` (Maven / Gradle) 는 각자 toolchain 으로 빌드 → npm 영역 무관, 회귀 surface 0.
- root `npm install` → `node_modules/@eodin/capacitor` symlink 생성 / `npm -w @eodin/capacitor run build` / `test 64/64` 모두 사전 통과.

---

## Medium & Low Priority Findings

### M1. `workspaces: ["packages/capacitor"]` 명시 list — Phase 1.1 진입 시 갱신 누락 위험

- **Severity**: 🟡 MEDIUM
- **Category**: Project-Specific Compliance / Build Config
- **File**: `package.json:6-8`
- **Issue**: 본 phase 는 명시 list 로 `packages/capacitor` 단 하나만 선언. 이는 `packages/sdk-flutter` / `sdk-ios` / `sdk-android` 가 npm 패키지가 아니라서 `packages/*` glob 사용 시 npm 이 그쪽에서 `package.json` 부재 에러를 내는 것을 회피하는 의도로 합리적. 다만 PRD §6.1 / CHECKLIST Phase 1.1 ("`packages/sdk-web/` 디렉토리 + 빌드 toolchain") 진입 시 본 list 에 `"packages/sdk-web"` 를 **수동으로 추가해야 함**. 이 갱신을 잊으면 sdk-web 의 `package.json` 이 npm install 대상에서 누락되고 capacitor 가 Phase 2.1 에서 `"@eodin/web": "workspace:*"` 를 추가했을 때 npm 이 워크스페이스 내 `@eodin/web` 을 못 찾아 registry 로 fall through (혹은 ENOENT) 하는 silent regression 가능.
- **Impact**: Phase 1.1 PR 에서 `packages/sdk-web/package.json` 만 추가하고 root `workspaces` 배열 갱신을 누락하면 (i) 로컬 dev 시 symlink 가 만들어지지 않고 (ii) Phase 2.1 직후 capacitor 빌드가 `Cannot find module '@eodin/web'` 으로 깨질 수 있음.
- **Recommendation**: 두 가지 가드 중 하나 채택.

  (1) Phase 1.1 CHECKLIST 항목 1.1 의 첫 줄로 명시적 체크박스 추가:

  ```markdown
  ### 1.1 디렉토리 + toolchain
  - [ ] **root `package.json` 의 `workspaces` 배열에 `"packages/sdk-web"` 추가** (Phase 1.0 의 명시 list 정책)
  - [ ] `packages/sdk-web/` 디렉토리 생성
  ```

  (2) 혹은 본 phase 에서 미래 대비로 root `package.json` 에 한 줄 코멘트 보강 (단, JSON 은 코멘트 미지원 → `description` 필드 활용):

  ```json
  {
    "description": "Eodin SDK monorepo. npm packages are managed via workspaces (currently capacitor only; add sdk-web here when Phase 1.1 lands). Flutter/iOS/Android packages are managed by their own toolchains.",
  }
  ```

  추천: (1) — CHECKLIST 갱신이 더 강제력 있는 가드 (PR review 시 누락이 눈에 띔).

---

### L1. `package-lock.json` 이 `.gitignore` 에 있어 workspace dependency 결정성 이슈

- **Severity**: 🟢 LOW
- **Category**: Build Config / Reproducibility
- **File**: `.gitignore:19` (`package-lock.json`), `package.json` (root, 신규)
- **Issue**: 현재 root `.gitignore` 가 `package-lock.json` 을 무시. workspace 도입 전에는 `packages/capacitor/package.json` 의 dev/peer deps 만 잠그면 됐고 capacitor 자체 `.npmignore` / `files` 가 lock 을 패키지에서 제외하므로 (npm publish 시 lockfile 비포함) 영향이 작았음. 그러나 root workspace 가 도입되면서 root `npm install` 결과의 재현성이 lockfile 에 의존하게 됨. CI / 다른 dev 머신에서 root `npm install` 을 돌릴 때 transitive dep 의 minor / patch 가 floating 으로 해석될 수 있음 (특히 caret range `^6.0.0`, `^15.0.0`, `^29.7.0` 등). Phase 1.1 에서 sdk-web 이 추가되면 dep tree 가 더 커져 영향이 비례.
- **Impact**: 같은 코드인데 dev / CI 머신마다 transitive dep 버전이 달라져 silent regression 발생 가능. 단, 본 phase 는 capacitor `package.json` 무변경이라 즉시 위험은 낮음.
- **Recommendation**: 본 phase 에서는 결정 보류 가능 (변경 surface 가 작음). Phase 1.1 진입 시 결정 필요. 두 옵션:

  (a) `package-lock.json` 을 commit (npm 권장 — 라이브러리 monorepo 도 root lock 은 commit, 개별 published package 는 `files` 로 제외)
  - `.gitignore` 에서 root `package-lock.json` 만 제외 (각 패키지 lock 은 무시 유지):
    ```gitignore
    # was: package-lock.json (전체 무시)
    # now: 패키지 내 lock 만 무시, root lock 은 commit
    /packages/*/package-lock.json
    ```

  (b) 현재 정책 유지 + CI 에서 `npm ci --workspace-update` 같은 결정성 명령으로 강제 (현재 GitHub Actions 부재 — `.github/workflows/` 디렉토리 없음 확인됨, 부재가 본 변경 자체와는 무관)

  추천: (a) — npm 공식 권장. CHECKLIST Phase 1.1 의 0.3 항목 ("`.gitignore` root level 점검 — 각 패키지의 `node_modules` / `dist` 가 무시되는지 확인") 을 확장하여 lockfile 정책 결정을 명시 항목으로 추가.

  단, 본 phase scope 내에서는 변경 불필요 — 결정 시점만 미리 못 박아 두면 충분.

---

### L2. `name: "eodin-sdk-monorepo"` 가 npm 명명 관습 (`@scope/...` or `kebab-case` plain) 과 부분 정합

- **Severity**: 🟢 LOW
- **Category**: Code Quality / Convention
- **File**: `package.json:2`
- **Issue**: `private: true` 라서 npm registry publish 가 차단되어 충돌 risk 자체는 0. 다만 `eodin-sdk-monorepo` 는 이미 사용된 `@eodin/capacitor` (org scope) 와 시각적으로 격리되어 있어, 정적 분석 도구 (Renovate / Dependabot / npm audit) 가 root 를 별도 패키지로 인식할 때 `@eodin/...` scope 와 grouping 이 분리되는 사이드이펙트 가능. 또한 GitHub repository slug (`eodin-sdk`) 와도 미묘하게 다름 (`-monorepo` suffix).
- **Impact**: 기능적 영향 없음. 대부분의 도구가 `private: true` 를 보고 publish 후보에서 제외. Renovate / Dependabot 의 grouping rule 작성 시 약간의 인지 비용.
- **Recommendation**: 두 옵션 모두 허용 가능.

  (a) 그대로 유지 — `private: true` 가 명확히 표시되어 있고 description 에 "monorepo" 라고 적혀 있어 의도가 충분히 전달됨.

  (b) repo slug 와 정합되게 단순화:
  ```json
  { "name": "eodin-sdk", "private": true, ... }
  ```

  추천: (a) 유지. `eodin-sdk` 는 향후 root 자체를 어떤 형태로 publish 할 일이 생기면 (예: docs 사이트) `@eodin/sdk` 같은 scope 로 갈 가능성이 있어 root 이름은 충돌을 피하는 게 안전.

---

## Info / 향후 고려

### I1. `engines.npm: ">=7"` 의 `prepublishOnly` / npm publish 시점 영향

- **Category**: Build / Publish Compatibility
- **Note**: PRD §6.1 / 결정 로그 L9 에 따라 `workspace:*` protocol 의 npm 7+ 의존성을 강제. 본 phase 시점의 capacitor `prepublishOnly: "npm run build"` 는 root 가 아니라 `packages/capacitor` 디렉토리에서 실행되므로 root engines 영향을 직접 받지 않음 (npm 은 publish 대상 패키지의 engines 만 강제). 다만 향후 root 에서 `npm publish -w @eodin/capacitor` 형태로 publish 한다면 root engines 가 즉시 적용됨. 현재 정의는 ">=7" 이라 npm 8/9/10 모두 통과 → 일반 dev / CI 환경에서 문제 없음.
- **No action required** — 의도와 정합. CHECKLIST Phase 5.2 publish 시점에 `workspace:*` → actual version 치환 동작 확인 1회 정도면 충분.

### I2. `packages/capacitor/.gitignore` 와 root `.gitignore` 중복은 의도된 정책

- **Category**: Project Convention
- **Note**: `packages/capacitor/.gitignore` 가 standalone clone 시나리오 ("SDK 사용자가 `git clone ... && cd packages/capacitor && npm install`") 를 위한 self-contained 정책으로 root `.gitignore` 와 일부 중복 유지된다는 코멘트가 있음. workspace 도입 후에도 이 정책은 정합 — root `npm install` 사용자와 standalone clone 사용자 양쪽 모두 `node_modules/` / `dist/` 가 무시됨. **현재 변경에서 추가 조치 불필요**.

---

## Positive Observations 👍

1. **Workspace 스코프 명시 (`packages/capacitor` 단일)** — `packages/*` glob 의 함정 (sdk-flutter / sdk-ios / sdk-android 의 `package.json` 부재로 npm install 이 ENOENT) 을 사전에 회피한 결정. PRD §6.1 의 명시적 의도와 정합.
2. **`engines.npm: ">=7"` 강제** — PRD 결정 로그 L9 / CHECKLIST Phase 1.0.1 의 명시 항목 그대로 반영. dev / CI 머신 npm 버전 차이로 인한 `workspace:*` protocol 미지원 silent fail 을 사전 차단.
3. **`description` 필드에 패키지 매니저 정책을 적시** — Flutter / iOS / Android 가 npm 무관하다는 사실이 명시되어 있어 future maintainer 가 `packages/*` glob 으로 "고치려" 시도하는 것을 사전에 차단.
4. **회귀 가드 사전 수행** — root `npm install` symlink 생성 / `npm -w @eodin/capacitor run build` / `test 64/64` 모두 사전 통과 후 리뷰 요청. CHECKLIST Phase 1.0.3 의 의도와 정합.
5. **`packages/capacitor/package.json` 무수정** — Phase 2.1 에서 `dependencies.@eodin/web: "workspace:*"` 를 별도 phase 로 분리한 결정. 단일 변경의 회귀 surface 를 최소화.
6. **`private: true` 명시** — root 가 실수로 npm registry 에 publish 되는 것 방지.

---

## Action Items Checklist

- [ ] **(M1)** Phase 1.1 CHECKLIST 의 1.1 항목 첫 줄에 "root `package.json` 의 `workspaces` 배열에 `\"packages/sdk-web\"` 추가" 체크박스 추가 (본 phase 외 작업, Phase 1.1 PR 에 포함)
- [ ] **(L1)** Phase 1.1 진입 시점에 root `package-lock.json` commit 정책 결정 (현재 `.gitignore:19` 가 무시 중) — 본 phase 에서는 결정 불필요, CHECKLIST Phase 1.1 의 toolchain 항목에 결정 sub-task 추가만 하면 충분
- [ ] (선택, L2) `name` 유지 결정 명시 — 결정 로그에 한 줄 추가 정도

---

## 본 phase 회귀 위험 종합

| 채널 | 본 변경의 회귀 surface | 검증 결과 |
|---|---|---|
| Flutter (`sdk-flutter`) | npm 무관 (pubspec.yaml + flutter pub) | 변경 영향 0 |
| iOS (`sdk-ios`) | npm 무관 (SwiftPM Package.swift) | 변경 영향 0 |
| Android (`sdk-android`) | npm 무관 (Gradle build.gradle) | 변경 영향 0 |
| Capacitor (`@eodin/capacitor`) | root workspace 도입으로 `node_modules` 가 root 로 호이스트 가능 | `npm -w @eodin/capacitor run build / test` 통과 (사전 검증) |
| Capacitor publish | `prepublishOnly: "npm run build"` 가 패키지 cwd 에서 실행되어 root engines 영향 받지 않음 | 변경 영향 0 (publish 시점 별도 검증 권장 — Phase 5) |

**결론: 본 phase 변경은 4채널 SDK 어디에도 회귀 risk 를 가져오지 않음.** Critical / High 발견 0건은 변경 surface 가 작고 의도가 PRD 와 정합하기 때문이며, 부재가 정상.
