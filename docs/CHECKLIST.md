# CHECKLIST: Eodin SDK v2 정비 (SDK 화)

PRD 참고: `./PRD.md` (2026-05-02 재정리 — Auth 트랙 분리)

본 CHECKLIST 는 **SDK v2 정비 + 5개 앱 마이그 한정** 범위. 통합 ID / EodinAuth / Identity API / 통합 Firebase / 통합 약관 / linkgo NextAuth 전환 / Phase 0.5 firebase uid 충돌 검증 / kidstopia RevenueCat 결정 / linkgo 도메인 결정은 별도 Auth 트랙.

---

## 진행 상태 (Last update: 2026-05-03)

| Phase | 상태 | 비고 |
|---|---|---|
| Phase 0 (사전 조사) | ✅ 완료 | SDK 관련 sub-task 전수 완료. Phase 0.5 firebase uid 충돌 검증은 Auth 트랙으로 분리 |
| Phase 0.5 (SDK 저장소 분리) | ✅ 완료 | 0.5.7 / 0.5.8 검증 포함. 0.5.6 (publish CI/CD) 사용자 토큰 대기 |
| Phase 0.9 + 0.9.1 (Service catalog) | ✅ 완료 | schema/seed/web 라우터 가드 — LegalService 인프라는 Auth 트랙에서 활용 예정 |
| **Phase 1 (SDK 정비)** | 🚧 진행 중 (8/9) | 1.1 ✅ / 1.3 ✅ / 1.6 (S9) ✅ / 1.9 ✅ / 1.6 (S8) ✅ / 1.7 (GDPR) ✅ / 1.8 (문서) ✅ 완료. 다음: 1.10 (베타 릴리스) |
| Phase 5 (5개 앱 마이그) | 🚧 가이드 완료, 실제 마이그 대기 | `migration-guide.md` 산출. Phase 1.10 후 시작 |
| **Phase Web (`eodin-web` 신설)** | ✅ Phase 0~5 완료. publish 라이브 (2026-05-03) | `eodin-web@1.0.0-beta.1` npmjs.org 등록. `@eodin` 조직 미존재로 unscoped 이름 채택. Phase 5.4 (kidstopia 회귀) 만 capacitor publish 시점에 묶임. PRD: `web-sdk/PRD.md` / CHECKLIST: `web-sdk/CHECKLIST.md` |

### Phase 0 산출 문서

- `sdk-usage-matrix.md` (0.1) / `event-schema-audit.md` (0.4) / `revenuecat-impact.md` (0.7) / `open-issues.md` (0.8) / `web-sdk-targets.md` (0.10) / `sdk-distribution-checks.md` (0.5.7+0.5.8) / `reviews/phase-0.9-code-review.md` (0.9)
- `linkgo-auth-investigation.md` (0.3) / `firebase-uid-collision-check.md` (0.5) — **Auth 트랙 결과** (본 SDK 화 PRD 범위 밖이지만 산출 문서로 보존)

### Phase 1 진입 전 필수 작업

- [x] **plori `pubspec.yaml`** git URL 정정: `ahn283/eodin` → `ahn283/eodin-sdk` (commit `d0cbc8c`, 2026-05-02)
- [x] **tempy `pubspec.yaml`** 동일 (commit `4323140`, 2026-05-02)
- [x] **arden `pubspec.yaml`** local path → git URL `ahn283/eodin-sdk` (commit `44386a9`, 2026-05-02)
- [x] SDK 패키지 구조 결정 — 모놀리식 + 모듈별 import 채택 (`phase-1.1-package-structure.md`)
- [x] S7 (static→instance) 보류 확정 — Phase 0.1 결과 multi-init use case 0건

---

## Phase 0: 사전 조사 (1.5주) ✅ 완료

### 0.1 SDK 사용 패턴 매트릭스 ✅
- [x] 5개 앱이 호출하는 SDK 메서드/이벤트 전수 조사 → `sdk-usage-matrix.md`
- [x] 회귀 리스크 발견 (plori/tempy/arden git URL 정정) → Phase 1 진입 전 일괄 수정 완료

### 0.2 Capacitor web 빌드 ✅
- [x] kidstopia 의 `semag.app` Vercel 라이브 운영 확인 → N13 (web.ts 동작화) Must 격상

### 0.3 linkgo 인증 시스템 조사 — Auth 트랙
- [x] 산출 문서 `linkgo-auth-investigation.md` 보존
- 본 PRD 범위 밖 (Auth 트랙)

### 0.4 이벤트 스키마 정합성 ✅
- [x] 5개 앱 17건 명명 충돌 식별 → `event-schema-audit.md` §6
- [x] EodinEvent enum + reference v1.1 발행 (Phase 1.6 시점)

### 0.5 5개 Firebase 프로젝트 uid 충돌 검증 — Auth 트랙으로 분리
- 본 PRD 범위 밖 (Auth 트랙). 실제 마이그 시점에 별도 phase 로 진행

### 0.7 RevenueCat 영향 ✅
- [x] fridgify Customer ID = Postgres UUID → SDK 마이그 무영향 확인
- [x] kidstopia anonymous → identified 결정은 Auth 트랙 의존

### 0.8 미해결 오픈 이슈 정리 ✅
- [x] `open-issues.md` 발행 — SDK 항목과 Auth 트랙 항목 구분

### 0.9 eodin Service catalog 확장 ✅
- [x] Prisma schema 확장 (`serviceType` / `webUrl` / `legalEntity`)
- [x] 6개 production service upsert (`linkgo`, `semag-kidscafe` 포함)
- [x] apps/web 라우터 web-only 가드 (`resolveWebOnlyRedirect`)
- [x] 단위 테스트 9건 + senior-code-review 완료

### 0.9.1 LegalService 확장 ✅
- [x] LegalService 인프라 등록 — Tier 1 (eodin) / Tier 2 (앱별)
- 본격 활용은 Auth 트랙

### 0.10 Web SDK 사용처 식별 ✅
- [x] linkgo Auth 트랙 의존 / admin·landing 1차 미적용 / kidstopia 는 `@eodin/capacitor` web 분기 사용
- [x] 결과 문서: `web-sdk-targets.md`
- **2026-05-03 후속**: `eodin-web` SDK 패키지 신설은 별도 트랙 (`web-sdk/PRD.md`) 으로 진행 — analytics 만, Auth 미포함. 본 §0.10 의 채택자 / 1차 출시 대상 같은 다운스트림 결정은 SDK 트랙의 입력 아님 (별도 비즈니스 의사결정)

---

## Phase 0.5: SDK 저장소 분리 ✅ 완료

### 0.5.1 보안 사전 점검 ✅
- [x] `security-check.sh` 5/5 통과

### 0.5.2 새 저장소 신설 ✅
- [x] `ahn283/eodin-sdk` Public + MIT LICENSE + README

### 0.5.3 코드 추출 ✅
- [x] `git filter-repo` 로 4채널 SDK history 추출 (266 → 14 commits)

### 0.5.4 기존 monorepo 정리 ✅
- [x] eodin monorepo 의 `packages/sdk-*` 4개 제거 + `libs/eodin-sdk` submodule 추가

### 0.5.5 fridgify submodule URL 변경 ✅
- [x] fridgify `.gitmodules` 업데이트
- 단 fridgify 의 submodule → git ref 전환은 Phase 5 마이그 시점

### 0.5.6 CI/CD 셋업 (publish 인프라) — Phase 1 진행 중 작업
- [ ] eodin-sdk 에 GitHub Actions 워크플로우 (`sdk-v*` tag push 시 4채널 publish)
- [ ] pub.dev publishing token (Flutter)
- [ ] Maven Central sonatype 계정 + GPG 키 (Android)
- [ ] npm publish token (`@eodin/capacitor`)
- [ ] SwiftPM tag 자동
- [ ] dry-run `2.0.0-rc.1` 으로 4채널 publish 검증
- 사용자 토큰 대기 — 본 PRD 잔여 작업 중 가장 외부 의존 큰 항목

### 0.5.7 Capacitor SPM submodule path 검증 ✅
- [x] iOS 표준 = npm 1차, SwiftPM git tag 2차. kidstopia vendor tgz → `npm i @eodin/capacitor@^2.0.0` 전환 (Phase 5)

### 0.5.8 submodule 인증 모델 검증 ✅
- [x] Public 저장소 → 인증 토큰 불필요. fridgify CI workflow 에 `submodules: recursive` 권장

---

## Phase 1: SDK v2 정비

**진행 순서** (사용자 합의 기준):
1. ✅ 선행: plori/tempy/arden SDK 의존성 경로 회귀 수정
2. ✅ Phase 1.1: 5채널 패키지 구조 + S7 보류 + modular 통일
3. ✅ Phase 1.3: API endpoint `api.eodin.app` 통일
4. ✅ Phase 1.6 (S9 이벤트 스키마): EodinEvent enum 4채널 + reference v1.1
5. ✅ Phase 1.9: Capacitor web.ts 동작화 + HIGH 3 finding 처리
6. 🚧 Phase 1.6 (S8 보안): Analytics fail-silent + HTTPS only 강제
7. 🚧 Phase 1.7: 4채널 Analytics SDK 단위 테스트 보강 + GDPR surface (open-issues §4.5)
8. 🚧 Phase 1.8: 4채널 문서 자동 생성 (dartdoc / DocC / Dokka / TypeDoc)
9. 🚧 Phase 1.10: `v2.0.0-beta.1` git tag + origin push
10. ⏸️ Phase 1.5: dual-support — 마이그 가이드로 대체 가능 (보류 권장)
11. ⏸️ Phase 1.2 / 0.5.6: 4채널 publish CI/CD — 사용자 토큰 대기

**제외된 phase (Auth 트랙)**: Phase 1.4 (EodinAuth 신설) — Auth 트랙으로 분리

### 1.1 패키지 구조 ✅ 완료 (2026-05-02)
- [x] **결정 문서** `phase-1.1-package-structure.md` — 모놀리식 + 모듈별 import (iOS Package.swift 패턴) 채택. S7 보류 확정
- [x] Flutter rename `eodin_deeplink` → `eodin_sdk`, version 1.0.0 → 2.0.0-beta.1
- [x] Flutter 모듈별 entry — `lib/analytics.dart`, `lib/deeplink.dart`
- [x] Flutter v1 entry deprecated — `lib/eodin_deeplink.dart` 에 `@Deprecated`
- [x] Android namespace 정정 `app.eodin.deeplink` → `app.eodin`
- [x] Android artifactId rename `deeplink-sdk` → `eodin-sdk`, version 2.0.0-beta.1
- [x] Capacitor metadata 정합 (version + repo URL)
- [x] iOS — 변경 없음 (이미 modular pattern, M1 reference)
- [x] 빌드 검증: Flutter 17/17 + Capacitor 23/23 tests pass
- [ ] **Capacitor positional helper** — Phase 1.6 (이벤트 enum) 과 함께 진행 → ✅ Phase 1.6 에서 처리됨
- [ ] **v1 호환 alias 패키지** — Phase 1.5 dual-support 보류 (마이그 가이드로 대체)

### 1.2 배포 인프라 (Must M3, Must M4) — Phase 0.5.6 와 묶임
- [ ] 각 SDK 에 `CHANGELOG.md` 추가
- [ ] semver 도입 + git tag 정책 문서화
- [ ] pub.dev publishing 설정 (Flutter)
- [ ] SwiftPM tag 기반 release 워크플로우
- [ ] Maven Central publishing 설정 (Android)
- [ ] npm publishing 설정 (Capacitor)
- [ ] GitHub Actions: tag push 시 자동 publish
- ⏸️ 사용자 토큰 대기

### 1.3 API endpoint 통일 (Must M2) ✅ 완료 (2026-05-02)
- [x] 4개 SDK 코드/문서/예제에서 `link.eodin.app/api/v1` → `api.eodin.app/api/v1` (12개 파일)
- [x] 사용자 진입 URL `link.eodin.app/your-service/...` 보존
- [x] 부수 정정: `link.eodin.app/admin` → `admin.eodin.app`, `ahn283/eodin/issues` → `ahn283/eodin-sdk/issues`
- [x] senior-code-reviewer 처리 + 빌드 검증 (Flutter 17/17 + Capacitor 23/23)

### 1.5 SDK v1 → v2 dual-support — ⏸️ 보류 권장
- [ ] 백엔드는 6주간 v1 endpoints 유지, v2 채택 후 1개월 deprecation 기간 (운영 정책만)
- [ ] ~~`eodin_deeplink: ^1.99.0` 호환 alias 패키지 publish~~ — 보류. `migration-guide.md` 의 명시적 마이그 가이드로 대체
- [ ] migration codemod 스크립트 — 가이드의 sed 일괄 변경으로 대체
- 결정 사유: 5개 앱 모두 마이그 작업이 "pubspec 1줄 + import 일괄 sed" 수준이라 별도 호환 alias 패키지의 ROI 낮음. publish CI/CD 갖춰진 시점 (Phase 0.5.6 / 1.2) 후 v2.x 또는 v3 시점 재검토

### 1.6 보안 / 에러 핸들링 (Should S8) ✅ 완료 (2026-05-02)
- [x] **Analytics fail-silent 유지** — `track()` / `identify()` / `flush()` 등 호출 경로는 모두 fail-silent. configure 만 throw / preconditionFailure (회귀 가드 wire-format integration test 가 검증)
- [x] **HTTPS only 강제 (Phase 1.6 S8)** — 4채널 + Capacitor bundled native (5 곳) `configure()` 가 endpoint scheme 검사
  - `https://`: 모든 빌드 허용
  - `http://localhost` / `http://127.0.0.1`: 모든 빌드 허용 (mixed-content / iOS ATS / cleartextTrafficPermitted 가 release 보호)
  - `http://10.0.2.2`: **debug build 만** (Flutter `kDebugMode` / iOS `#if DEBUG` / Android `BuildConfig.DEBUG`). Web (TS) 에서는 항상 reject (의미 없음 + 코드리뷰 H1)
  - 그 외: throw / preconditionFailure
- [x] **cross-platform 정합 (M2)** — 입력 `trim()` + scheme `lowercase` 비교. 4채널 동일 동작
- [x] **에러 정책 cross-platform 일관**: Dart `ArgumentError` / Swift `EndpointValidationError` → `preconditionFailure` 변환 / Kotlin `IllegalArgumentException` / TS `Error`
- [x] **공유 validator helper** — Flutter `lib/src/internal/endpoint_validator.dart`, iOS `Sources/EodinAnalytics/EndpointValidator.swift`, Android `app/eodin/internal/EndpointValidator.kt`, Capacitor `web.ts` `validateEndpoint()`. EodinAnalytics + EodinDeeplink 양쪽 configure 가 호출 (4채널 × 2 = 8 진입점, Capacitor bundled native 4 추가 → 총 12 진입점 cover)
- [x] **단위 테스트 4채널** — Flutter 10 / iOS 10 / Android 10 / Capacitor 11 = **41 tests pass**. accept (https / loopback / 10.0.2.2 debug / case / trim) + reject (plain http / empty / non-URL / unsupported scheme / confusable host 명시 통과 — host 화이트리스트 보류)
- [x] **빌드 검증** — Flutter 32/32 + iOS 23/23 + Capacitor 53/53 + main monorepo 회귀 0
- [x] **PRD §6.4 갱신** — HTTPS 정책 / loopback 예외 / 에러 정책 / host 화이트리스트 보류 명시
- [x] **`migration-guide.md` §4.1.3b + §5.2b** 추가 — staging http endpoint 사전 grep 안내 (logging-audit M1 후속)
- [x] **open-issues §4.6** 신설 — host 화이트리스트는 v2.x 보류 (코드리뷰 M1)
- [x] senior-code-reviewer 리뷰 (`reviews/phase-1.6-s8-code-review.md`) — A−. HIGH 1 (H1) 처리, MEDIUM 3 중 M2 처리, M1 보류 ticket, M3 PRD 명시
- [x] logging-agent audit (`reviews/phase-1.6-s8-logging-audit.md`) — Approve with one follow-up. M1 (migration-guide grep 단계) 처리, L1/N1/N2 별도 cleanup
- [ ] (Auth 모듈의 fail-throw / Firebase ID token / `X-App-Id` 헤더 / Custom Claims 부분은 별도 Auth 트랙)

### 1.6 이벤트 스키마 (Should S9) ✅ 완료 (2026-05-02)
- [x] **`unified-event-reference.md` v1.0 → v1.1 발행** — `account_delete`, `daily_limit_*`, `voice_*` family, `pass_*` family 추가 + Migration Notes 표 + Rule 4 state-reached footnote + `session_start/end`, `ad_native_view` 표 등재
- [x] **권장 이벤트 enum 4채널 도입** — `EodinEvent` (Flutter / iOS / Android / Capacitor) 39 entries × 4 = 156 항목 wire-format 1:1
- [x] **자유 string 도 허용 (backward compat)** — Capacitor 만 v2 의도된 breaking (객체 → positional)
- [x] **Capacitor positional helper** — `track({eventName, properties})` → `track(eventName, properties?)`. wrapper 는 `Object.create(_EodinAnalyticsBridge)` prototype-chain (코드리뷰 H1 가드)
- [x] **forbidden v1 names 14건 차단 회귀 가드**
- [x] **wire-format integration test** — Capacitor (jest mock) + Flutter (MockClient)
- [x] senior-code-reviewer / logging-agent 리뷰 완료
- [ ] type-safe properties 검증 (선택적) — Phase 1.6 보류, v2.x 후속

### 1.7 테스트 + GDPR surface 보강 (Nice N10, N11) ✅ 완료 (2026-05-03)
- [x] **GDPR surface 4채널 정합** (`open-issues §4.5` 처리) — `setEnabled` / `isEnabled` / `requestDataDeletion` 4채널 (Flutter 기존 + iOS / Android / Capacitor 신규). Capacitor bundled native 2 곳 (iOS / Android) 도 동기화. 총 12 진입점 cover
- [x] **C1 endpoint path 정정 (CRITICAL)** — SDK 4채널 + Flutter 모두 `${apiEndpoint}/user-data` → `${apiEndpoint}/events/user-data` (server route mount path 와 정합). v1 부터의 잠재 결함이라 SDK 화 트랙에서 같이 정리
- [x] **C2/H1 clearLocalData 후 SDK 재초기화** — 4채널 + Flutter 가 deletion 후 fresh device id + session 재생성 → post-deletion `track()` crash 차단 (Flutter/Android NPE 제거, Web invalid payload 제거)
- [x] **H2 EventQueue.purgeForDataDeletion()** — 4채널 production-grade purge API 신설. `clearLocalData` 가 testing-only `reset()` 대신 호출. 큐 lifecycle 보존
- [x] **H3 / HIGH-2 API server scope** — `apps/api/src/services/analyticsApiService.ts` `DeleteDataSchema` 에 `app_id` (required) + `user_id` (optional) 추가. `apiKey` scope check + `where 절` `appId` scope. multi-tenant 보안. Redis 캐시 키도 `attr:${app_id}:${device_id}` 로 namespaced
- [x] **HIGH-1/M4 setEnabled(false) 시 큐 정리** — 4채널 모두 opt-out 즉시 in-flight 큐 비움. `EventQueue.purgeForDataDeletion()` 호출. GDPR Article 21 (object to processing) 정합
- [x] **HIGH-3 isEnabled 보존** — `clearLocalData` 가 사용자 disable 상태 보존. opt-out + delete 한 사용자가 deletion 후 다시 enabled 되는 회로 차단
- [x] **M1 Capacitor iOS bundled EodinEvent sync** — `EodinEvent.swift` 신규 + `track(_ event:)` overload. Phase 1.6 drift 해소
- [x] **M2 Thread safety** — Android `@Volatile isEnabledFlag` + iOS `queue.sync` 보호 (cross-thread visibility). 4채널 + Capacitor bundled
- [x] **M3 iOS callback DispatchQueue.main 통일** — `requestDataDeletion` callback 이 main thread 보장 (Android `mainHandler.post` 와 parity)
- [x] **MEDIUM-1 storage key prefix 통일** — Android `KEY_ENABLED = "eodin_enabled"` (이전 `"enabled"` 에서 `eodin_` prefix 추가)
- [x] **MEDIUM-2 Web clearLocalData multi-tab race** — Web Locks API (`navigator.locks`) 로 wipe + re-bootstrap 보호
- [x] **L1-L4 + N1-N3** — `reset()` 에 isEnabled 추가 (4채널) / Flutter user_id null omit / Web deviceId null defensive / cosmetic 정리
- [x] **단위 테스트 4채널** — Flutter 40 / iOS 26 / Capacitor 64 = **130 tests pass**. 회귀 가드: post-deletion track 동작 / opt-out 보존 / queue purge / endpoint path / X-API-Key 헤더 / app_id scope
- [x] **빌드 검증** — Flutter analyze clean / iOS xcodebuild + tests SUCCEEDED / Capacitor build + tests / main monorepo (api 384 + ai 11) 회귀 0
- [x] **senior-code-reviewer 리뷰** (`reviews/phase-1.7-code-review.md`) — Grade B-. HIGH 3 / MEDIUM 4 / LOW 4 / NIT 3 모두 처리
- [x] **logging-agent audit** (`reviews/phase-1.7-logging-audit.md`) — Reject for fix-up → Approved. CRITICAL 2 / HIGH 3 / MEDIUM 3 / NIT 4 모두 처리
- [ ] **E2E 통합 테스트** (docker compose 로 api 띄우고 4채널 SDK 호출) — Phase 1.7 보류, 별도 phase

### 1.8 문서 (Nice N12) ✅ 완료 (2026-05-03)
- [x] **dartdoc (Flutter)** — `dartdoc_options.yaml` 신설 + `dart doc .` 명령으로 4 라이브러리 (eodin_sdk / deeplink / eodin_deeplink / analytics) 0 warnings 0 errors. 산출물 `doc/api/`. `lib/src/internal/` 는 lib entry export 그래프에서 자동 제외
- [x] **DocC (iOS)** — Swift 5.5+ 내장. `xcodebuild docbuild -scheme EodinSDK ...` 로 `BUILD DOCUMENTATION SUCCEEDED`. `*.doccarchive` 산출. `internal` access modifier 로 internal 자동 제외
- [x] **Dokka 1.9.20 (Android)** — `build.gradle.kts` 에 plugin + `perPackageOption` 으로 `app.eodin.internal.*` + `.*\.BuildConfig` suppress. 산출물 `build/dokka/html/`. host app 의 gradle wrapper 통해 빌드 (sdk-android 자체에 wrapper 없음)
- [x] **TypeDoc 0.26 (Capacitor)** — `package.json` 에 devDep + `npm run docs` script + `typedoc.json` (excludePrivate / excludeProtected / excludeInternal, exclude `src/__tests__` + `src/web.ts`). 산출물 `docs/api/`. Capacitor README 신설 (`packages/capacitor/README.md`) — TypeDoc landing page
- [x] **통합 README (SDK 저장소)** — `libs/eodin-sdk/README.md` 에 "API reference (Phase 1.8)" 섹션 추가. 채널별 명령 / 산출물 / 도구 호환성 노트
- [x] **`.gitignore` 4채널 정합** — `doc/api/` (Flutter), `*.doccarchive` (iOS), `build/` (Android — 기존), `docs/api/` + `node_modules/` + `dist/` (Capacitor 신규)
- [x] **bundled native (Capacitor) 별도 docs 미생성** — drift 회피 + 단일 진실원 (sdk-ios / sdk-android) 유지. 의도된 결정
- [x] **빌드 검증** — Flutter 40 + iOS 26 + Capacitor 64 = **130 tests pass 회귀 0** + main monorepo 회귀 0
- [x] **senior-code-reviewer 리뷰** (`reviews/phase-1.8-code-review.md`) — Grade A−. CRITICAL 0 / HIGH 0 / MEDIUM 1 / LOW 4 / NIT 3. M1 (Dokka models block 제거) + L1 (BuildConfig 정규식 광범위화) + L3 (Capacitor README) + L4 (gitignore 주석) + N1-N3 (README 정정) 모두 처리. L2 (dartdoc unresolved-doc-reference unsuppress) 만 Phase 1.10 직전 처리로 보류
- [x] **logging-agent audit** (`reviews/phase-1.8-logging-audit.md`) — 이슈 없음 (Pass). runtime 영향 0, internal 차단 정확, unified-event-reference 영향 없음
- [ ] **publish CI/CD 자동화** — Phase 0.5.6 + Phase 1.10 베타 릴리스 시점에 GitHub Actions workflow 추가 (사용자 토큰 대기 — 본 phase 보류)
- 통합 가이드 산출물:
  - [x] 마이그 가이드 (`migration-guide.md`)
  - [x] 신규 앱 연동 가이드 (`integration-guide.md`)

### 1.9 Capacitor web 처리 ✅ 완료 (2026-05-02 — **Must, Phase 0.2 결과로 격상**)
- [x] kidstopia `semag.app` 라이브 운영 확인 (Phase 0.2)
- [x] `@eodin/capacitor` `src/web.ts` 14개 메서드 동작화 (v1 의 `unavailable()` throw 일괄 해소)
- [x] EodinAnalytics web: `fetch` POST `${apiEndpoint}/events/collect` (native 와 동일 endpoint, EventSchema 1:1)
- [x] EodinDeeplink web: 모든 메서드 no-op (deferred deeplink 무관)
- [x] **회귀 가드 (코드리뷰 HIGH 3 처리)**:
  - **H1 multi-tab race**: Web Locks API 로 queue mutex
  - **H2 localStorage quota**: `setItem` try-catch + oldest-drop
  - **H3 lifecycle cleanup**: `dispose()` + `pagehide` / `visibilitychange` listener + `navigator.sendBeacon`
- [x] **logging M1 처리**: `session_end.duration_seconds` 자동 첨부
- [x] jest 동작 검증 — 42/42 tests pass
- [x] senior-code-reviewer + logging-agent 리뷰 완료
- [ ] **EodinAuth web** — 별도 Auth 트랙 (본 SDK 화 PRD 범위 밖)
- [ ] **logging M2 (DeviceSchema 'web')** — 백엔드 schema 변경 의존, 별도 phase

### 1.10 v2.0.0-beta 릴리스 🚧 다음 단계
- [ ] 4채널 모두 `2.0.0-beta.1` 태그 — eodin-sdk 저장소에 git tag + origin push
- [ ] origin push 정책: tag 만 push (main 은 v1 그대로 → 호스트 앱 ref pin 으로 안전)
- [ ] 내부 사용 (eodin 팀) 1주 검증
- [ ] 피드백 반영 후 `2.0.0` 정식 릴리스

---

## Phase 5: 5개 앱 SDK v2 마이그

**가이드**: `migration-guide.md` (canary 순서 / Rollback / FAQ / 일정)
**선결조건**: Phase 1.10 (`v2.0.0-beta.1` git tag origin push) 완료

### 5.1 plori (1주) — canary 🟢 코드 마이그 완료 (2026-05-03), staging 검증 진행 중
- [x] `pubspec.yaml`: `eodin_deeplink:` → `eodin_sdk:` + ref `main` → `v2.0.0-beta.1` (tag pin)
- [x] import 일괄 변경: `package:eodin_deeplink/...` → `package:eodin_sdk/...` (3 곳 — main.dart / splash_screen.dart / analytics_service.dart)
- [x] endpoint 점검: `apiEndpoint: 'https://api.eodin.app/api/v1'` 이미 v2 정합 (lib/main.dart:56,64) / `link.eodin.app/plori/...` 사용자 진입 URL 만 (Service catalog 정합)
- [x] `flutter pub get` (eodin_sdk 2.0.0-beta.1 신규) → `flutter analyze` (clean — 기존 7 issues v2 무관) → `flutter test` (521/521 pass) → `flutter build apk --debug` SUCCEEDED
- [x] commit + push: `ahn283/plori` `3c02c1d feat(mobile): migrate to eodin_sdk v2.0.0-beta.1 (Phase 5.1 canary)` → origin/main `175c5a5..3c02c1d`
- [ ] **staging 환경 1주 검증** (analytics 이벤트 발화 / deferred deeplink 동작 / smoke test) — 진행 중
- [ ] (선택) EodinEvent enum 점진 도입 — 호출 코드 자유 string `track('event', ...)` 그대로 동작하므로 점진 마이그 가능
- [ ] iOS release 빌드 검증 (`pod install --repo-update && flutter build ios --release`) — staging 검증 단계에서 함께
- 변경 통계: **5 파일 / 9 lines** (pubspec.yaml + pubspec.lock + lib 3 파일). 호출부 코드 무수정.

### 5.2 arden (1주)
- [ ] 5.1 과 동일 단계 (호출부 16, import 3 곳)
- [ ] arden 의 `auth_logout` → `sign_out`, `auth_account_deleted` → `account_delete`, `interstitial_ad_shown` → `ad_interstitial_view`, `native_ad_shown` → `ad_native_view`, `onboarding_skipped` → `onboarding_skip` 정정 (audit §6.1)

### 5.3 fridgify (1.5주) — submodule 제거 추가
- [ ] **submodule 제거**: `git submodule deinit -f libs/eodin-sdk` + `git rm -f libs/eodin-sdk` + `.git/modules/libs/eodin-sdk` 정리
- [ ] `mobile/pubspec.yaml`: `path:` → `git: url + ref: v2.0.0-beta.1`
- [ ] 5.1 과 동일 단계 (호출부 16, import 3 곳)
- [ ] fridgify 의 17건 명명 충돌 정정: `subscription_purchase_completed` → `subscribe_start`, `subscription_trial_started` → `trial_start`, `subscription_restored` → `subscription_restore`, `paywall_dismissed` → `paywall_dismiss`, `ad_clicked` → `ad_click`, `ad_failed` → `ad_load_failed`, `rewarded_ad_*` → `ad_rewarded_*`, `infographic_generate_*` 시제 정정
- [ ] **RevenueCat alias 검증** — staging 결제 1건으로 dashboard entitlement 매핑 정상 확인 (Phase 0.7 결과 — fridgify 무영향 재확인)

### 5.4 tempy (1.5주)
- [ ] 5.1 과 동일 단계 (호출부 71 — wrapper 안에 갇혀있어 import 4 곳만 변경)
- [ ] (선택) wrapper 안 호출 점진적으로 EodinEvent enum 으로 전환

### 5.5 kidstopia (1주) — Capacitor + Web (마지막 canary)
- [ ] **vendor tgz 교체**: `vendor/eodin-capacitor-1.0.0.tgz` → `vendor/eodin-capacitor-2.0.0-beta.1.tgz`
- [ ] `package.json`: `"@eodin/capacitor": "file:vendor/eodin-capacitor-2.0.0-beta.1.tgz"`
- [ ] **positional API 호출 변경 (BREAKING)** — `EodinAnalytics.track({eventName, properties})` → `EodinAnalytics.track(name, props)` + `EodinAnalytics.identify({userId})` → `EodinAnalytics.identify(uid)` (호출부 2곳)
- [ ] kidstopia 의 `login` → `sign_in` 정정
- [ ] `npm install` → `npx cap sync` → 빌드 (web + native iOS + native Android)
- [ ] **Web 첫 수집 baseline 영향**: `semag.app` 사용자 analytics 가 v1 의 silent throw 회로 → v2 에서 정상 수집 시작. 분석 팀에 baseline reset 안내
- [ ] staging 1주 검증 (web Network 탭 / native DebugView)
- [ ] (참고) RevenueCat anonymous → identified 결정은 **Auth 트랙** 의존 — 본 마이그에서는 anonymous 유지

### 5.6 검증 (5개 앱)
- [ ] 모든 앱이 v2.0.0-beta.1 채택 + production 배포
- [ ] 분석 dashboard 의 17건 명명 충돌 정정 후 cross-app join 정합 확인
- [ ] 1주 모니터링 — 회귀 incident 0 확인 후 `v2.0.0` 정식 태그
- [ ] origin/main 도 v2 advance (모든 앱이 tag pin 으로 옮긴 후)

---

## 산출물

### 신규
- `PRD.md` (재정리, 2026-05-02) — SDK 화 한정 PRD
- `CHECKLIST.md` (재정리, 2026-05-02) — 본 파일
- `integration-guide.md` — 신규 호스트 앱 채택 가이드
- `migration-guide.md` — 기존 5개 앱 v1 → v2 마이그 가이드
- `phase-1.1-package-structure.md` — 5채널 패키지 구조 결정
- `event-schema-audit.md` — 5개 앱 17건 명명 충돌 매핑
- `revenuecat-impact.md` — RevenueCat 영향 검토 (SDK 마이그 무영향 결론)
- `open-issues.md` — phase 진행 중 식별된 후속 ticket
- `sdk-distribution-checks.md` — Phase 0.5.7 / 0.5.8
- `sdk-usage-matrix.md` — Phase 0.1
- `web-sdk-targets.md` — Phase 0.10

### Auth 트랙 산출 (본 PRD 범위 밖, 보존)
- `linkgo-auth-investigation.md`
- `firebase-uid-collision-check.md`

### 리뷰 산출
- `reviews/phase-0.9-code-review.md`
- `reviews/phase-1.3-code-review.md`
- `reviews/phase-1.6-code-review.md`
- `reviews/phase-1.6-logging-audit.md`
- `reviews/phase-1.9-code-review.md`
- `reviews/phase-1.9-logging-audit.md`

### Logging 표준
- `docs/logging/unified-event-reference.md` v1.1 (2026-05-02)

---

## 다음 단계 (권장 진행 순서)

1. **Phase 1.6 (S8 보안)** — Analytics fail-silent + HTTPS only 강제 + 회귀 가드
2. **Phase 1.7 (테스트 보강)** — 4채널 unit test + GDPR surface 보강 (`open-issues §4.5`)
3. **Phase 1.8 (문서 자동 생성)** — dartdoc / DocC / Dokka / TypeDoc
4. **Phase 1.10 (`v2.0.0-beta.1` 릴리스)** — git tag + origin push
5. **Phase 5 (5개 앱 마이그)** — plori → arden → fridgify (submodule 제거) → tempy → kidstopia
6. (선택) **Phase 1.2 / 0.5.6 publish CI-CD** — 사용자 토큰 확보 후

본 SDK 화 프로젝트가 Phase 5 까지 완료되면 **이 PRD 의 범위 종료**. Auth 트랙은 별도 PRD 에서 진행.
