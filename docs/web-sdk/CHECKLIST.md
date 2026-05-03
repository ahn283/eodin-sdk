# CHECKLIST: `@eodin/web` — Web Analytics SDK 신설

PRD 참고: `./PRD.md`
관련 메인 PRD: `../PRD.md` (Eodin SDK v2 정비, 4채널)

본 CHECKLIST 는 **`@eodin/web` 패키지 신설 한정** 범위. 채택자 식별 / 적용 계획 / 마이그 가이드는 본 CHECKLIST 의 범위 밖.

---

## 진행 상태 (Last update: 2026-05-03)

| Phase | 상태 | 비고 |
|---|---|---|
| Phase 0 (사전 정렬) | ✅ 완료 | 메인 PRD / `web-sdk-targets.md` / 메인 CHECKLIST 정합성 갱신 |
| Phase 1.0 (workspace 도입) | ✅ 완료 | root `package.json` 신설, capacitor 빌드/테스트 64/64 통과, code review Grade A |
| Phase 1 (패키지 신설) | ⏳ 시작 전 | `packages/sdk-web/` 디렉토리 + 빌드 toolchain + internal 모듈 추출 |
| Phase 2 (Capacitor 어댑터화) | ⏳ 시작 전 | `packages/capacitor/src/web.ts` 가 `@eodin/web` 을 import 하도록 전환 |
| Phase 3 (Public surface) | ⏳ 시작 전 | EodinAnalytics public API 확정 + 5채널 parity 검증 |
| Phase 4 (테스트 + 문서) | ⏳ 시작 전 | jest + TypeDoc + integration-guide.md 갱신 |
| Phase 5 (베타 publish) | ⏳ 시작 전 | `@eodin/web@1.0.0-beta.1` npm publish + git tag + kidstopia vendor tgz 사전 회귀 검증 (G1) |

### 산출 문서 (예정)

- `web-sdk/PRD.md` ✅
- `web-sdk/CHECKLIST.md` ✅
- `web-sdk/extraction-plan.md` (Phase 1 — `capacitor/src/web.ts` 의 어떤 코드를 어디로 옮기는지 매핑)
- `web-sdk/parity-matrix-5ch.md` (Phase 3 — 5채널 parity 검증 산출)

---

## Phase 0: 사전 정렬

### 0.1 메인 PRD 갱신
- [x] `docs/PRD.md` §6 의 Web 채널 가정 갱신 — Web 채널 (`@eodin/web`) 의 analytics 모듈은 `web-sdk/PRD.md` 별도 트랙으로 진행. EodinAuth 모듈만 Auth 트랙 의존
- [x] M1 행 갱신 — Web 별도 트랙 진행 표시
- [x] 변경 이력에 2026-05-03 항목 추가

### 0.2 `web-sdk-targets.md` 갱신
- [x] §1 결론 / §3 패키지 설계 영향 / §5 결론을 본 PRD 의 새 scope 와 정합되게 정리 — 채택자 / 1차 출시 대상 같은 다운스트림 결정은 본 트랙 범위 밖임을 명시. 패키지 surface 는 EodinAnalytics 만

### 0.3 메인 CHECKLIST 갱신
- [x] 진행 상태 표에 "Phase Web (`@eodin/web` 신설)" 행 추가 — 본 CHECKLIST 링크 (`web-sdk/CHECKLIST.md`)
- [x] §0.10 옆에 본 트랙으로 후속 진행 메모

---

## Phase 1.0: npm workspaces 도입 (D1 — publish 순서 의존성 해소) ✅

### 1.0.1 root `package.json` 신설
- [x] `package.json` (root) 신설 — `name: "eodin-sdk-monorepo"`, `private: true`, `workspaces: ["packages/capacitor"]` (sdk-flutter/ios/android 는 npm 무관이라 명시 list 사용. Phase 1.1 에서 sdk-web 추가)
- [x] **L9 — `engines: { "npm": ">=7" }` 명시** — `workspace:*` protocol 은 npm 7+ 부터. CI / dev 버전 회귀 가드
- [x] `.gitignore` root level 점검 — 각 패키지의 `node_modules` / `dist` 가 무시되는지 확인 (이미 root .gitignore 가 cover)

### 1.0.2 capacitor 의존성 protocol 변경 사전 점검
- [x] `packages/capacitor/package.json` 의 dependencies / peerDependencies 구조 확인 (`peerDependencies: @capacitor/core`, `dependencies` 블록 부재)
- [x] root `npm install` 정상 — `node_modules/@eodin/capacitor` symlink 생성 확인
- [x] capacitor 의 기존 `npm run build` / `npm test` workspace 모드에서 정상 동작 확인

### 1.0.3 4채널 회귀 가드
- [x] capacitor 빌드: `npm -w @eodin/capacitor run build` 정상
- [x] capacitor 테스트: `npm -w @eodin/capacitor test` 64/64 통과
- [x] sdk-flutter / sdk-ios / sdk-android 는 npm 무관 — 점검 불필요

### 1.0.4 코드 리뷰
- [x] senior-code-reviewer 실행 — Grade A. CRITICAL 0 / HIGH 0 / MEDIUM 1 (M1: Phase 1.1 진입 시 workspaces 배열 갱신 가드) / LOW 2 (L1: package-lock.json 정책 / L2: minor) / INFO 2. M1 / L1 후속을 Phase 1.1 첫 항목으로 반영
- [x] 산출: `web-sdk/reviews/phase-1.0-code-review.md`

---

## Phase 1: 패키지 신설 (`packages/sdk-web/`)

### 1.1 디렉토리 + toolchain ✅
- [x] **(M1 — Phase 1.0 review 권고) root `package.json` 의 `workspaces` 배열에 `packages/sdk-web` 추가**
- [x] **(L1 — Phase 1.0 review 권고) root `package-lock.json` commit 정책 결정** — root .gitignore 의 `package-lock.json` 줄을 `packages/*/package-lock.json` 으로 교체. root lock 은 commit 함
- [x] `packages/sdk-web/` 디렉토리 생성 + `src/index.ts` placeholder
- [x] `package.json` — name `@eodin/web`, version `1.0.0-beta.1`, dual export (cjs+esm), files allowlist
- [x] `tsconfig.json` — strict, lib: dom/es2020, target es2017
- [x] `rollup.config.mjs` — esm input → cjs output (capacitor 와 달리 IIFE / external peer 없음)
- [x] `jest.config.js` — testEnvironment: jsdom
- [x] `typedoc.json` — entryPoints: src/index.ts only, exclude src/internal/**
- [x] `.gitignore` (standalone clone 시나리오 self-contained)
- [x] `README.md` 초안 + Phase 1.1 placeholder 경고
- [x] **(Phase 1.1 review M1) `packages/sdk-web/LICENSE` 추가** — root LICENSE 복사
- [x] 코드 리뷰: senior-code-reviewer Grade A−. CRITICAL 0 / HIGH 1 (H1: dual-package hazard — Phase 3 진입 전 결정) / MEDIUM 3 / LOW 4 / INFO 3. 즉시 적용: M1 LICENSE / L4 README placeholder 경고. H1 은 Phase 3.0 결정 항목으로 등록. 후속 ticket: M2 / L1 / L2 / L3 / I1 / I3 / capacitor LICENSE
- [x] 산출: `web-sdk/reviews/phase-1.1-code-review.md`

### 1.2 Internal 모듈 추출 (`packages/capacitor/src/web.ts` source)
- [ ] `src/internal/event-queue.ts` — localStorage queue (capacitor web.ts 에서 추출)
- [ ] `src/internal/network-client.ts` — fetch + sendBeacon (capacitor web.ts 에서 추출)
- [ ] `src/internal/endpoint-validator.ts` — HTTPS only (capacitor web.ts 에서 추출, Phase 1.6 S8 parity)
- [ ] `src/internal/storage.ts` — localStorage / sessionStorage 추상화 (테스트 용이성)
- [ ] 각 모듈 jest unit test (capacitor 의 `__tests__/web.test.ts` 에서 분리해 가져옴)

### 1.3 EodinEvent enum (web)
- [ ] `src/eodin-event.ts` — 4채널과 동일 wire string (Flutter `eodin_event.dart` / iOS `EodinEvent.swift` / Android `EodinEvent.kt` / Capacitor `eodin-event.ts` 와 cross-check)
- [ ] enum 값 hard-coded test (wire string 변경이 silent 회귀 되지 않도록)

### 1.4 빌드 검증
- [ ] `npm install`
- [ ] `npm run build` — dist 산출 정상 (cjs / esm / d.ts)
- [ ] `npm test` — Phase 1.2 / 1.3 의 unit test 모두 통과
- [ ] `npm run docs` — TypeDoc 생성, internal 모듈 미노출 확인

---

## Phase 2: Capacitor `web.ts` 어댑터화

### 2.1 의존성 추가 (workspace protocol)
- [ ] `packages/capacitor/package.json` 의 `dependencies` 에 `"@eodin/web": "workspace:*"` 추가 (Phase 1.0 의 workspace 활용 — publish 시 npm 이 actual version 으로 치환)
- [ ] root `npm install` 재실행으로 symlink 생성 확인

### 2.2 web.ts 코드 교체
- [ ] `packages/capacitor/src/web.ts` 의 EventQueue / NetworkClient / EndpointValidator / EodinEvent 직접 구현 → `@eodin/web` 의 export 사용으로 교체
- [ ] capacitor 특유 로직 (positional API, native bridge 분기) 만 남기고 web 로직 제거
- [ ] 라인 수 비교 — 추출 전 vs 후 (목표: -50% 이상)

### 2.3 회귀 검증
- [ ] `packages/capacitor/src/__tests__/web.test.ts` 모두 통과 (수정 없이)
- [ ] `packages/capacitor/src/__tests__/eodin-event.test.ts` 통과
- [ ] `packages/capacitor/src/__tests__/endpoint-validator.test.ts` — 이 파일이 capacitor 에 남아 있을지 `@eodin/web` 으로 옮길지 결정 (권장: `@eodin/web` 으로 이전, capacitor 에서는 import test 만 유지)

---

## Phase 3: Public Surface 확정

### 3.0 dual-package hazard 결정 (Phase 1.1 review H1) — Phase 3 코드 작성 전 필수
- [ ] EodinAnalytics 가 stateful singleton 일 예정 → 현 dual `exports` (cjs/esm) 가 모듈 인스턴스 분리 위험. 다음 중 택1 결정 + 결정 로그 기록:
  - (a) ESM-only 전환 — `package.json` 에 `"type": "module"`, `exports.require` 제거, `main` 제거 (추천)
  - (b) state 를 `globalThis.__eodinAnalytics__` 에 pin
  - (c) stateless façade + global store 분리 설계
- [ ] 결정 후 `package.json` 적용 + 본 CHECKLIST 갱신

### 3.1 EodinAnalytics (PRD §5 의 모든 surface)
- [ ] `src/analytics/eodin-analytics.ts` — configure / track (positional) / identify / clearIdentity / flush
- [ ] **Attribution + Sessions**: setAttribution / startSession / endSession
- [ ] **Status getters — TypeScript property style (M6)**: `EodinAnalytics.deviceId / userId / sessionId / attribution / isEnabled` 모두 `static get` 정의. caller 측 `EodinAnalytics.deviceId` 형태로 access. Flutter / iOS property 와 시각적 정합
- [ ] **Aggregate `getStatus()`**: 유일하게 method form. Promise / 동기 반환은 Phase 3 에서 결정 (capacitor 와의 호환성 고려)
- [ ] **GDPR (4채널 실제 메서드명)**: setEnabled / isEnabled / requestDataDeletion (Phase 1.7 surface 와 동일)
- [ ] auto-flush — `pagehide` / `visibilitychange` 이벤트에서 sendBeacon
- [ ] **autoTrackPageView (PRD §5 명시)**: `EodinAnalytics.configure({ autoTrackPageView: true })` 시 internal page-view tracker 가 history API + popstate 구독. default false
- [ ] **iOS-only ATT 메서드 의도적 미노출**: requestTrackingAuthorization / getATTStatus / setDeviceATT 는 web surface 에서 제외 (5채널 documented asymmetry — `parity-matrix-5ch.md` 에 기록)

### 3.2 Public exports
- [ ] `src/index.ts` 에서 EodinAnalytics, EodinEvent, 관련 type 만 re-export
- [ ] internal/* 절대 미노출 확인 (TypeDoc + grep)
- [ ] `package.json` `exports` 필드 정리

### 3.3 5채널 parity 검증
- [ ] EodinAnalytics 메서드 시그니처 — Flutter / iOS / Android / Capacitor / Web 5개 비교 표 작성
- [ ] EodinEvent enum 값 wire string 동일성 — 5채널 모두 grep 으로 비교
- [ ] GDPR surface — Phase 1.7 4채널 surface 와 parity (web 환경에서 의미 없는 항목은 명시적 no-op + 문서화)
- [ ] **Documented asymmetry 명시** (PRD §5.1 표 + 본 트랙 결정):
  - ATT 메서드 (iOS-only) — web 의도적 미노출
  - autoTrackPageView (web 고유)
  - status getter property vs method (Flutter/iOS/Web property — Android method form, Kotlin/Java interop 관습)
  - Capacitor 의 분산 getter 누락 (M5 — 별도 ticket)
  - aggregate `getStatus()` vs 분산 getter 매핑 (M7 — 양쪽 모두 의미 있어 본 SDK 는 둘 다 노출, 4채널은 분산만 / capacitor 는 aggregate 만)
- [ ] 산출: `web-sdk/parity-matrix-5ch.md`

---

## Phase 4: 테스트 + 문서

### 4.1 Unit test 보강
- [ ] EodinAnalytics: configure / track / identify / clearIdentity / flush 시나리오
- [ ] Attribution / Session: setAttribution / startSession / endSession 시나리오
- [ ] Status getters (M6 property style): `EodinAnalytics.deviceId / userId / sessionId / attribution / isEnabled` getter 반환값 검증 + aggregate `await getStatus()` 검증
- [ ] **GDPR (PRD §5 surface)**: setEnabled(false) → 신규 이벤트 drop / 큐 보존, isEnabled getter, requestDataDeletion → 로컬 큐 + 식별자 클리어 검증
- [ ] autoTrackPageView: history API navigation / popstate / hashchange 시 자동 page_view 발생 검증
- [ ] EndpointValidator: HTTPS only enforcement (4채널과 동일 케이스)
- [ ] EventQueue: idempotent enqueue / at-least-once / bounded growth / cold-start (localStorage 직접 set 후 재시작 시뮬레이션)

### 4.2 Integration test (선택)
- [ ] `api.eodin.app` mock server 띄우고 e2e — 메인 PRD `Phase 1.7` 의 E2E 보류 정책과 동일하게 본 phase 도 보류 가능

### 4.3 API 문서
- [ ] `npm run docs` (TypeDoc) — 산출 `docs/api/`
- [ ] internal/* 미노출 재확인
- [ ] README.md 완성 — Quick Start, configure, track, GDPR, browser 호환성

### 4.4 Integration guide 갱신
- [ ] `docs/guide/integration-guide.md` 에 "Web (`@eodin/web`)" 섹션 추가 — 일반 채택 절차만 (특정 호스트 명시 X)

---

## Phase 5: 베타 publish

### 5.1 publish 사전 점검
- [ ] `package.json` version = `1.0.0-beta.1`
- [ ] `files` 필드 — dist/, README.md, LICENSE 만 포함
- [ ] `.npmignore` 또는 `files` 화이트리스트로 src/ 미포함 확인
- [ ] `npm pack --dry-run` 으로 tarball 내용 검증
- [ ] `docs/research/security-check.sh` 패턴이 신규 파일에서 모두 통과

### 5.2 publish 실행
- [ ] `npm publish --access public --tag beta` (사용자 토큰 필요 — manual)
- [ ] git tag `web-sdk-v1.0.0-beta.1`
- [ ] origin push

### 5.3 publish 후 검증
- [ ] `npm view @eodin/web@beta` 로 버전 확인
- [ ] 별도 sandbox 프로젝트에서 `npm install @eodin/web@beta` → import → configure → track 1회 e2e 확인

### 5.4 kidstopia vendor tgz 사전 회귀 검증 (G1 — 라이브 회귀 가드)
- [ ] `@eodin/web` publish 완료 후 `@eodin/capacitor` 도 patch 빌드 (workspace:* → actual version range 자동 치환 확인)
- [ ] `npm pack @eodin/capacitor` → vendor tgz 산출
- [ ] kidstopia 로컬 환경에서 기존 vendor tgz 를 신규 tgz 로 교체
- [ ] kidstopia 로컬 빌드 (`npx cap sync` + `npm run build`) 정상
- [ ] 로컬 device / browser 에서 EodinAnalytics 호출 → `api.eodin.app` 도달 1회 확인
- [ ] 회귀 없음 확인 후 메인 PRD §5 (5개 앱 마이그) 의 kidstopia 마이그 입력으로 활용

---

## 후속 (본 CHECKLIST 범위 밖)

- 채택 / 적용 계획 / 마이그 가이드 — 별도 비즈니스 의사결정
- EodinAuth 모듈 추가 — Auth 트랙
- `@eodin/web/server` subpath (Next.js SSR) — Auth 트랙
- publish CI/CD 자동화 — 메인 PRD `Phase 0.5.6 / Phase 1.2` 와 묶임 (사용자 토큰 대기)
- **C3 — backend `apiKeyAuth` origin allowlist 강화** — `@eodin/web` 채택 시점 전까지 `apps/api/src/...` 의 apiKeyAuth 미들웨어가 `Origin` / `Referer` 검증을 추가해야 함. 별도 ticket 으로 등록 (본 SDK 트랙 외)
- **M5 — Capacitor 분산 getter 보강** — `packages/capacitor/src/definitions.ts` 에 `getDeviceId / getUserId / getSessionId / getAttribution` 추가 + native bridge 구현. 4채널 status getter parity 회복. 본 SDK 트랙 외 별도 ticket
- F1 — `apps/web` (link.eodin.app) 이 `@eodin/web` 채택 시 server-side `/events/click` + client-side `/events/collect` 이중 logging 정의 필요. 채택 트랙에서 다룸
- **(Phase 1.1 review M2) Phase 5 publish 시점에 `prepublishOnly` 제거 + CI artifact publish 패턴 검토** — `changesets` / `release-please` 도입 시점과 묶임
- **(Phase 1.1 review L3) Phase 5 publish 시점에 keywords 보강** — `event-tracking`, `telemetry`, `browser`, `typescript` 추가 검토
- **(Phase 1.1 review I3) IIFE / unpkg use-case 가 생기면 rollup output 추가** — 현재는 npm install 경유 사용만 가정
- **(Phase 1.1 review L2) PRD §6 또는 결정 로그에 internal 정책 차이 한 줄 추가** — capacitor=single file (`web.ts`) vs sdk-web=folder (`internal/**`)
- **(Phase 1.1 review I1) 결정 로그에 5채널 independent versioning 정책 한 줄** — web 1.x 신생 / mobile 2.x 마이그
- **(Phase 1.1 review M1 후속) `packages/capacitor/LICENSE` 추가** — sdk-web 과 동일하게 root LICENSE 복사. 본 SDK 트랙 외 별도 chore commit
