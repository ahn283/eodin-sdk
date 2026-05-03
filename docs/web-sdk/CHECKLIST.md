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
| Phase 2 (Capacitor 어댑터화) | ✅ 완료 | web.ts 729→525 lines (-28%). sdk-web `/internal` subpath. capacitor rollup external + IIFE globals. H1/H2/H3 모두 closure |
| Phase 3 (Public surface) | ✅ 완료 | EodinAnalytics 본체 + GDPR + autoTrackPageView + globalThis pin (H1) + parity matrix 산출. 7 suites / 80 tests |
| Phase 4 (테스트 + 문서) | ✅ 완료 | page-view-tracker test 8개 추가 (총 88 tests). TypeDoc 검증 internal 미노출. integration-guide §3.5 + §6.1 분리. README 갱신 |
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

### 1.2 Internal 모듈 추출 (`packages/capacitor/src/web.ts` source) ✅
- [x] `src/internal/event-queue.ts` — `EventQueue` class (read/write/withLock/quota handling/maxSize trim)
- [x] `src/internal/network-client.ts` — `fetchWithTimeout` / `sendBeacon` / `isOnline`
- [x] `src/internal/endpoint-validator.ts` — `validateEndpoint` (메인 SDK Phase 1.6 S8 parity)
- [x] `src/internal/storage.ts` — `STORAGE_KEYS` / `readStorage` / `writeStorage` / `removeStorage` / `isQuotaError`
- [x] `src/internal/uuid.ts` — `crypto.randomUUID` + RFC4122 v4 fallback
- [x] 각 모듈 jest unit test (storage / uuid / endpoint-validator / event-queue / network-client) — **5 suites / 43 tests 통과**
- [x] 코드 리뷰: senior-code-reviewer Grade A. CRITICAL 0 / HIGH 0 / MEDIUM 3 / LOW 4 / INFO 5. 즉시 적용: M2 (storage 헬퍼 일관성) + L1 (quota halving 결정적 검증). 후속: M1 (quota drop 관측성) / M3 (runtime validation) / I1 / I2 는 Phase 3 에서 처리
- [x] 산출: `web-sdk/reviews/phase-1.2-code-review.md`

### 1.3 EodinEvent enum (web) ✅
- [x] `src/eodin-event.ts` — 4채널 38 entries 의 wire string 동일 + web 고유 `PageView: 'page_view'` 추가 (메인 PRD §10 의 P1 anchor 등록 — 향후 mobile 채널이 같은 이벤트 추가 시 동일 wire string 강제)
- [x] enum 값 hard-coded test (wire string 변경 silent 회귀 가드)
- [x] **invariant gates** (Android EodinEventTest 와 동등): snake_case 정규식 / ≤40자 길이 / 유일성 / Phase 0.4 forbidden v1 names 14건 회귀 가드
- [x] **cross-channel parity test**: capacitor `eodin-event.ts` 의 38 entries 와 wire string 동일성 require 동적 비교
- [x] iOS / Android grep cross-check — wire string drift 0건 확인
- [x] src/index.ts 에서 `EodinEvent` / `EodinEventName` re-export — 첫 public surface
- [x] 코드 리뷰: senior-code-reviewer Grade A. CRITICAL 0 / HIGH 0 / MEDIUM 2 / LOW 3 / INFO 4. 즉시 적용: M1 (invariant gates) + M2 (PRD §10 P1 anchor). 후속: L1 (require path → workspace symlink 권장) — Phase 3.3 parity-matrix-5ch.md 와 묶임
- [x] 산출: `web-sdk/reviews/phase-1.3-code-review.md`

### 1.4 빌드 검증
- [ ] `npm install`
- [ ] `npm run build` — dist 산출 정상 (cjs / esm / d.ts)
- [ ] `npm test` — Phase 1.2 / 1.3 의 unit test 모두 통과
- [ ] `npm run docs` — TypeDoc 생성, internal 모듈 미노출 확인

---

## Phase 2: Capacitor `web.ts` 어댑터화 ✅

### 2.1 의존성 추가 ✅
- [x] sdk-web 에 `./internal` subpath export 추가 (`packages/sdk-web/src/internal/index.ts` barrel + `package.json` exports + dual-entry rollup)
- [x] `packages/capacitor/package.json` 의 `dependencies` 에 `"@eodin/web": "^1.0.0-beta.1"` 추가 (npm 은 `workspace:*` 미지원 — explicit version range 사용. workspace symlink 으로 dev 시 자동 해결, publish 시 그대로 유지)
- [x] `packages/capacitor/tsconfig.json` 의 `moduleResolution` `"node"` → `"bundler"` (TS 가 `exports` field subpath 인식)
- [x] root `npm install` 재실행으로 `node_modules/@eodin/web` symlink 생성 확인

### 2.2 web.ts 코드 교체 ✅
- [x] `packages/capacitor/src/web.ts` 의 STORAGE_KEYS / validateEndpoint / uuid / EventQueue / fetchWithTimeout / sendBeacon / isQuotaError → `@eodin/web/internal` import 로 교체
- [x] capacitor 특유 로직 유지: WebPlugin extension / lifecycle listeners / GDPR 메서드 / attributionToWire / sendBeacon flushOnExit / capacitor-specific constants
- [x] 라인 수: 729 → 525 (-204 lines, **-28%**)

### 2.3 회귀 검증 ✅
- [x] capacitor 64/64 통과 (`web.test.ts` / `eodin-event.test.ts` / `endpoint-validator.test.ts` / `definitions.test.ts` — 무수정)
- [x] sdk-web 60/60 통과 (3 신규 `onQuotaExceeded` callback test 추가)
- [x] 코드 리뷰: senior-code-reviewer Grade B+. CRITICAL 0 / **HIGH 3** / MEDIUM 4 / LOW 3 / INFO 3.
  - **H1 즉시 적용**: requeueBatch prepend 와 EventQueue.withLock universal trim 의 충돌 해결 — withLock 의 auto-trim 제거, track callsite 명시 trim 복귀
  - **H2 즉시 적용**: EventQueue 에 `onQuotaExceeded` 콜백 추가 — capacitor 가 logger 주입해 quota drop 관측성 복원
  - **H3 즉시 적용**: capacitor rollup `external` 에 `'@eodin/web'` / `'@eodin/web/internal'` 추가 + IIFE globals 매핑. publish artifact 에 EventQueue 인라인 안 됨 (`grep -c "class EventQueue" dist/plugin.cjs.js` = 0). dependencies 와 artifact 동작 일치
  - 후속 (M1-M4 / L1-L3): Phase 3 또는 별도 ticket
- [x] 산출: `web-sdk/reviews/phase-2-code-review.md`

---

## Phase 3: Public Surface 확정

### 3.0 dual-package hazard 결정 (Phase 1.1 review H1) ✅
- [x] **택 (b) globalThis pin** — capacitor (CJS publish) 가 `@eodin/web/internal` 을 require 해야 해서 root entry 의 ESM-only 전환 무리. 대신 state / queue / pageViewDetach 를 모두 `globalThis.__eodin_analytics_state__` 에 pin (Phase 3 review H1 fix 포함)
- [x] `packages/sdk-web/src/analytics/state.ts` — `getState()` / `getQueue()` / `__resetStateForTest()` API

### 3.1 EodinAnalytics (PRD §5 의 모든 surface) ✅
- [x] `src/analytics/eodin-analytics.ts` — configure (Promise<void>) / track (Promise<void>, positional) / identify / clearIdentity / flush
- [x] **Attribution + Sessions**: setAttribution / startSession / endSession
- [x] **Status getters — TypeScript property style (M6)**: `EodinAnalytics.deviceId / userId / sessionId / attribution / isEnabled` 모두 `static get` 정의
- [x] **Aggregate `getStatus()`**: 유일하게 method form (Promise<AnalyticsStatus>) — capacitor 와 호환
- [x] **GDPR (4채널 실제 메서드명)**: setEnabled (Promise<void>) / isEnabled (getter) / requestDataDeletion (Phase 1.7 surface parity)
- [x] auto-flush — `pagehide` / `visibilitychange` 이벤트에서 sendBeacon
- [x] **autoTrackPageView (PRD §5 명시)**: `configure({ autoTrackPageView: true })` 시 page-view-tracker 가 history API + popstate 구독. default false. SPA 라우터 충돌 가드 (H3)
- [x] **iOS-only ATT 메서드 의도적 미노출**: requestTrackingAuthorization / getATTStatus / setDeviceATT 제외 (parity-matrix-5ch.md asymmetry 표 기록)
- [x] **C1 hydration fix**: configure 가 localStorage 의 attribution 을 in-memory hydrate (cold-reload 후 `EodinAnalytics.attribution` getter 정합)
- [x] **H2 awaitable parity**: track / setEnabled 가 `Promise<void>` 반환 — 4채널 SDK 와 awaitable parity
- [x] **H4 internal API 격리**: dispose → `__disposeForTest`, parity matrix 8.1 행 추가

### 3.2 Public exports
- [ ] `src/index.ts` 에서 EodinAnalytics, EodinEvent, 관련 type 만 re-export
- [ ] internal/* 절대 미노출 확인 (TypeDoc + grep)
- [ ] `package.json` `exports` 필드 정리

### 3.2 Public exports ✅
- [x] `src/index.ts` 에서 EodinAnalytics / Attribution / AnalyticsStatus / AnalyticsConfigureOptions / EodinEvent / EodinEventName re-export
- [x] internal/* 미노출 — typedoc + package.json `exports` 양쪽에서 차단

### 3.3 5채널 parity 검증 ✅
- [x] EodinAnalytics 메서드 시그니처 — Flutter / iOS / Android / Capacitor / Web 5개 비교 (parity-matrix-5ch §1)
- [x] Status getter property vs method (parity-matrix-5ch §2) — Android method form (Kotlin interop) / capacitor 분산 getter 누락 (M5 별도 ticket)
- [x] GDPR surface (Phase 1.7 4채널 parity) — parity-matrix-5ch §3
- [x] iOS-only ATT 의도적 비대칭 — parity-matrix-5ch §4
- [x] Web 고유 (autoTrackPageView / PageView) — parity-matrix-5ch §5
- [x] EodinEvent wire string parity — 38 entries 5채널 byte-exact + invariant gates (Phase 1.3)
- [x] Wire schema (`events/collect`) parity — parity-matrix-5ch §7. attributionToWire byte-exact (web ↔ capacitor grep 검증)
- [x] dispose / `__disposeForTest` 명시 (H4) — parity-matrix-5ch §8.1
- [x] 산출: `web-sdk/parity-matrix-5ch.md`

### 3.4 코드 리뷰 ✅
- [x] senior-code-reviewer Grade B+. CRITICAL 1 / HIGH 4 / MEDIUM 6 / LOW 4 / INFO 3
  - **C1 즉시 적용**: configure 가 attribution localStorage hydrate — cold-reload 후 getter 정합
  - **H1 즉시 적용**: globalThis pin 범위 확장 — queue / pageViewDetach 도 state 슬롯에 pin
  - **H2 즉시 적용**: track / setEnabled 가 Promise<void> 반환 — 4채널 awaitable parity
  - **H3 즉시 적용**: page-view-tracker 의 detach 가 patched 함수 검증 후 원복 — SPA 라우터 충돌 차단
  - **H4 즉시 적용**: dispose → `__disposeForTest` (internal 의도 표시), parity matrix 8.1 행 추가
  - 후속 (M1-M6, L1-L4): Phase 4 / 별도 ticket
- [x] 산출: `web-sdk/reviews/phase-3-code-review.md`

---

## Phase 4: 테스트 + 문서

### 4.1 Unit test 보강 ✅
- [x] EodinAnalytics: configure / track / identify / clearIdentity / flush 시나리오 (Phase 3 신규)
- [x] Attribution / Session: setAttribution / startSession / endSession (Phase 3)
- [x] Status getters (M6 property): deviceId / userId / sessionId / attribution / isEnabled + aggregate getStatus (Phase 3)
- [x] **GDPR**: setEnabled(false) 큐 클리어 / 신규 drop / requestDataDeletion deviceId 재발급 + opt-out 보존 (Phase 3)
- [x] **autoTrackPageView**: history.pushState / replaceState / popstate / hashchange 4트리거 + detach 후 미발생 + H3 SPA 라우터 충돌 가드 + idempotent / 두 번 attach (Phase 4 신규 8 cases)
- [x] EndpointValidator: HTTPS only (Phase 1.2)
- [x] EventQueue: idempotent / at-least-once / bounded growth / quota halving (Phase 1.2 + Phase 2 H2 보강)

### 4.2 Integration test (선택)
- [ ] `api.eodin.app` mock server 띄우고 e2e — 메인 PRD `Phase 1.7` 의 E2E 보류 정책과 동일하게 본 phase 도 보류 가능

### 4.3 API 문서 ✅
- [x] `npm -w @eodin/web run docs` (TypeDoc) — 산출 `packages/sdk-web/docs/api/`
- [x] internal/* 미노출 확인 — `EventQueue / validateEndpoint / fetchWithTimeout / sendBeacon` 모두 docs/api 0 hit
- [x] `packages/sdk-web/README.md` 갱신 — Phase 1.1 placeholder 제거, full surface 예시 + 의도적 비대칭 (ATT / Deeplink) 명시
- [x] root `README.md` 의 Packages 표에 `@eodin/web` 행 추가 + Quick Start Web 섹션 추가

### 4.4 Integration guide 갱신 ✅
- [x] `docs/guide/integration-guide.md` §3.5 Web 섹션 갱신 — 의존성 / 초기화 / positional API 사용 / SSR Next.js / 의도적 미노출
- [x] §6.1 GDPR opt-out — Capacitor (object arg / async) 와 Web (positional arg / property getter) 분리 (Phase 4 review H1)
- [x] §6.2 requestDataDeletion — Capacitor 와 Web 분리

### 4.5 코드 리뷰 ✅
- [x] senior-code-reviewer Grade C+ (C1+H1-H3 적용 후 B+ 회복)
  - **C1 즉시 적용**: page-view-tracker.test.ts:64 의 `as never` 캐스팅 → `typeof history.pushState` 정합. 신규 8 tests 실제 실행 (TS2339 컴파일 에러 해소)
  - **H1 즉시 적용**: integration-guide §6.1 / §6.2 의 Capacitor / Web 묶음 분리 (async vs property getter 모순 해소)
  - **H2 즉시 적용**: `packages/sdk-web/README.md` Phase 1.1 placeholder 제거 + full surface 명시
  - **H3 즉시 적용**: root `README.md` 5채널 표에 `@eodin/web` 행 추가 + Quick Start
- [x] 산출: `web-sdk/reviews/phase-4-code-review.md`

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
