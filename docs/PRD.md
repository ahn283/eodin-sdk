# PRD: Eodin SDK v2 정비 (SDK 화)

**작성일:** 2026-05-02 (재정리: 2026-05-02 — Auth/Identity 트랙 분리)
**작성자:** Woojin Ahn
**상태:** Draft → 일부 phase 진행 중 (Phase 1.1 / 1.3 / 1.6 / 1.9 완료)
**디렉토리 명**: `unified-id-and-sdk-v2/` 는 이전 통합 ID + SDK 합본 시점의 명칭 그대로 유지. 현 프로젝트 범위는 SDK 화 한정.

---

## 1. 배경 및 문제 정의

Eodin 산하 5개 앱 (fridgify / plori / tempy / arden / kidstopia) 이 eodin SDK 를 통해 사용자 행동 로그·딥링크·attribution 을 같은 백엔드(`api.eodin.app`)로 보낸다. 그러나 **SDK 자체가 5개 앱에서 5가지 다른 통합 방식 (git submodule, git ref:main, local path, vendor tgz, Capacitor) 으로 사용**되고 있고, 시맨틱 버저닝과 CHANGELOG 가 없어 breaking change 시 5개 앱이 동시에 영향을 받을 위험이 있다.

또한 SDK 가 deeplink + analytics 를 같이 export 하는데도 패키지명은 `eodin_deeplink` 였고, Capacitor `web.ts` 는 모든 메서드가 `unavailable()` throw 라 PWA (kidstopia `semag.app`) 사용자의 분석 데이터가 0건이었다.

**이 PRD 는 SDK 정비 (v1 → v2) 만 다룬다.** 통합 회원 ID / EodinAuth 모듈 / 통합 Firebase / 통합 약관 / linkgo NextAuth 전환 등은 본 PRD 의 초안에 포함되어 있었으나 **별도 트랙으로 분리**되었다 — 본 프로젝트의 범위 밖.

---

## 2. Eodin 산하 5개 앱 SDK 통합 현황 (2026-05-02)

| 앱 | 위치 | eodin SDK 통합 |
|---|---|---|
| **fridgify** | `~/Github/fridgify` | git submodule (`libs/eodin-sdk`, path-based pubspec) |
| **plori** | `~/Github/plori` | `eodin_deeplink` Flutter pkg (git ref:main) |
| **tempy** | `~/Github/tempy` | `eodin_deeplink` Flutter pkg (git ref:main) |
| **arden** | `~/arden` (Github 외부) | `eodin_deeplink` Flutter pkg (git ref:main, Phase 0 회귀 수정) |
| **kidstopia** (prod appId=`semag-kidscafe`) | `~/Github/kidstopia` | `@eodin/capacitor` (vendor tgz) — Capacitor 4 plugin |

### 호출 패턴 매트릭스 (Phase 0.1 audit 결과)
- 5개 앱 모두 EodinAnalytics + EodinDeeplink **static 패턴 + single init** (multi-init use case 0건)
- `EodinAnalytics.track('event_name', properties: {...})` 자유 string 호출이 표준
- 호출부 수: fridgify 16 / plori 11 / tempy 71 (wrapper 안에 갇힘) / arden 16 / kidstopia 11

---

## 3. 검토한 옵션 / 선택

| 옵션 | 평가 |
|---|---|
| **A. 그대로 두기** | ❌ 5가지 통합 방식 유지 — 신규 앱 채택 비용 / 마이그 비용 매번 5배 |
| **B. v2.0 한 번 마이그 (선택)** | ✅ breaking change 묶어서 한 번에 정리 — 5개 앱이 v2 채택 후 Phase 5 마이그 1회 |

선택: **옵션 B** — `v2.0.0-beta.1` 한 번의 메이저 릴리스로 13개 정비 항목 (이번 PRD §6 — Auth 제외 12개) 일괄 처리.

---

## 4. 목표 (Goals)

1. **SDK v2 정비**: 패키지 구조·버저닝·배포·테스트·문서를 5채널 (Flutter / iOS / Android / Capacitor / Web) 일관되게 정리
2. **5개 앱 마이그 안전성**: dual-support / 가이드 / 회귀 매트릭스로 v1 → v2 이행 시 회귀 0
3. **신규 앱 채택 비용 절감**: 통합 가이드 (`integration-guide.md`) 만으로 새 앱이 5채널 어느 곳에서도 동일 API surface 채택
4. **Capacitor PWA 분석 정상화**: kidstopia `semag.app` 라이브 사용자 analytics 가 v1 의 silent throw 회로에서 정상 수집으로 전환

---

## 5. 비목표 (Non-Goals — 별도 트랙으로 분리)

다음은 본 PRD 의 초안에는 포함되어 있었으나 **본 프로젝트 범위 밖** 으로 분리됐다:

| 항목 | 분리 트랙 | 노트 |
|---|---|---|
| 통합 회원 ID (Eodin Identity API) | Phase 2-4 별도 프로젝트 | DB 스키마 / Identity API / 통합 Firebase / 사용자 import |
| `EodinAuth` 모듈 (5채널) | 별도 프로젝트 | signIn / linkApp / leaveApp / deleteAccount 등 |
| 통합 약관 / 개인정보처리방침 | 별도 프로젝트 | LegalService Tier 1 / 2 — 단 Service catalog (Phase 0.9) 인프라는 SDK 화 시점에 이미 완료 |
| linkgo NextAuth → Firebase 전환 | 별도 프로젝트 | linkgo Web SDK 채택 포함 |
| 통합 멤버십 / 구독 상품 | 비즈니스 결정, 인프라/제품 모두 별도 |
| Phase 0.5 (5개 Firebase 프로젝트 uid 충돌 검증) | 별도 프로젝트 | Auth 마이그 시점에 필요 |
| kidstopia RevenueCat anonymous → identified 결정 | 별도 프로젝트 | `Purchases.logIn(eodinUserId)` 가능 시점 = Identity API 출시 후 |
| linkgo 도메인 (`linkgo.dev` vs `linkgo.kr`) prod 일치 | 별도 프로젝트 | linkgo 가 SDK 채택 시점에 점검 |
| 6개 앱 도메인 데이터 통합 (credits / family / scripts) | 영구 비목표 | 앱별 DB 그대로 |
| Firestore (arden / kidstopia) → Postgres 마이그 | 비목표 (Phase 8 회고 시점 재검토) |

---

## 6. SDK v2 정비 — 12개 항목 (5개 플랫폼)

진단으로 도출된 13개 항목 중 **M5 (EodinAuth 모듈 신설)** 은 Auth 트랙으로 분리. 본 PRD 는 12개를 다룬다.

**SDK 플랫폼**: Flutter / iOS / Android / Capacitor (Phase 1.9 web 분기 동작화 완료) / Web. Web 채널 (`@eodin/web`) 의 analytics 모듈은 **별도 트랙** (`web-sdk/PRD.md`) 으로 진행 — Auth 의존 없음. EodinAuth 모듈 추가만 Auth 트랙 가동 시점 의존.

### 6.1 Must (4개)

| # | 항목 | 정비 내용 | 상태 |
|---|---|---|---|
| M1 | **5채널 SDK 모놀리식 단일 패키지 통일** | iOS Package.swift modular product 패턴 차용. Flutter `eodin_sdk` (모듈별 import: `analytics.dart` / `deeplink.dart`), iOS `EodinSDK`, Android `app.eodin:eodin-sdk`, Capacitor `@eodin/capacitor`. Web (`@eodin/web`, analytics only) 은 별도 트랙 (`web-sdk/PRD.md`) 진행. EodinAuth 모듈은 Auth 트랙 의존 | ✅ Phase 1.1 (4채널) / 🚧 web 별도 트랙 |
| M2 | **API endpoint 단일화** | SDK 의 호출 endpoint 를 `api.eodin.app/api/v1` 로 통일. `link.eodin.app` 은 사용자 진입 URL 전용 (마케팅 `/{service}/{id}`). SDK 코드/문서/예제 일관 | ✅ Phase 1.3 |
| M3 | **시맨틱 버저닝 + CHANGELOG** | 4채널 모두 `1.0.0` 고정 → semver 도입. 패키지별 `CHANGELOG.md` 신설. breaking 시 major bump 강제 | 🚧 Phase 1.10 |
| M4 | **레지스트리 정식 배포 (4채널)** | Public 저장소 `ahn283/eodin-sdk` (Phase 0.5 신설) → pub.dev / SwiftPM tag / Maven Central / npm `@eodin/capacitor` 의 4채널 동시 배포. 단일 git tag `sdk-v2.0.0` push 시 GitHub Actions 가 4개 publish | ⏸️ Phase 1.2 / 0.5.6 (사용자 토큰 대기) |
| ~~M5~~ | ~~Identity 모듈 (`EodinAuth`) 신설~~ | **별도 트랙 분리** | — |

### 6.2 Should (3개)

| # | 항목 | 정비 내용 | 상태 |
|---|---|---|---|
| S6 | **5채널 modular 통일** | iOS 만 `EodinDeeplink` / `EodinAnalytics` 분리. 나머지 3채널 (Flutter / Android / Capacitor) 도 동일 구조. v2 부터 `EodinAuth` 추가는 Auth 트랙 시점 | ✅ Phase 1.1 |
| ~~S7~~ | ~~static → 인스턴스 패턴~~ | Phase 0.1 매트릭스 결과 multi-init use case 0건 → **보류 (gold-plating 회피)**. v3 에서 재검토 | ✅ 보류 결정 |
| S8 | **에러 핸들링 정책 분화** | Analytics 는 fail-silent 유지 (현재). HTTPS only 강제. 개발 endpoint 도 https. (Auth fail-throw 부분은 별도 트랙) | 🚧 Phase 1.6 (S8) |
| S9 | **이벤트 스키마 통일** | `EodinEvent` enum 39 entries (4채널) + 자유 string 병행. `unified-event-reference.md` v1.1 발행. forbidden v1 names 14건 회귀 가드 | ✅ Phase 1.6 |

### 6.3 Nice (4개)

| # | 항목 | 정비 내용 | 상태 |
|---|---|---|---|
| N10 | **Analytics SDK unit test 보강** | 4채널 SDK unit test 확대 (track / identify / queue / offline / GDPR) | 🚧 Phase 1.7 |
| N11 | **E2E 통합 테스트** | Docker compose 로 api 띄우고 4채널 SDK round-trip 테스트 | ⏸️ Phase 1.7 후 |
| N12 | **API reference 자동 생성** | dartdoc / DocC / Dokka / TypeDoc | 🚧 Phase 1.8 |
| N13 → **Must** | **Capacitor web.ts 동작화** (Phase 0.2 결과로 격상) | kidstopia `semag.app` 라이브 → web 구현 필수. EodinAnalytics web (localStorage queue + fetch + auto-flush + sendBeacon) / EodinDeeplink no-op / ATT no-op | ✅ Phase 1.9 |

### 6.4 보안 정비 (S8 와 함께)

- `apiKey`: 클라이언트 SDK 에 평문 저장 OK (publishable key, Analytics 용)
- `userId`: SharedPreferences / localStorage 평문 저장 (현재 그대로 유지 — PII 등급 낮음)
- **HTTPS only 강제, TLS 1.2+ 요구** (Phase 1.6 S8) — `configure()` 가 endpoint scheme 을 검사. 다음 loopback 주소만 dev 예외:
  - `localhost` / `127.0.0.1`: 모든 빌드에서 허용 (mixed-content / iOS ATS / Android cleartextTrafficPermitted 가 release 에서도 보호)
  - `10.0.2.2` (Android emulator → host): **debug build 만**. release 에서 reject (Flutter `kReleaseMode` / iOS `#if DEBUG` / Android `BuildConfig.DEBUG`). Web (TS) 에서는 항상 reject (의미 없음)
- **검증 실패 시 에러 정책 (cross-platform 일관)**:
  - Flutter: `ArgumentError` throw (Dart 표준)
  - iOS: `EndpointValidator.validate(...)` throws → `EodinAnalytics.configure` 가 `preconditionFailure` 로 변환 (Swift idiom — release 빌드에서도 abort 하여 misconfiguration 즉시 발견)
  - Android: `IllegalArgumentException` throw (Kotlin `require` / `throw`)
  - Capacitor (web): `Error` throw (TS 표준)
- **Host 화이트리스트는 본 SDK 화 PRD 범위 밖** — `https://attacker.example.com` 같은 임의 host 도 scheme 만 https 면 통과 (현행). PRD 초안의 "API endpoint 화이트리스트" 표현은 host whitelist 가 아닌 **scheme whitelist (HTTPS 강제)** 로 해석. 향후 host 화이트리스트 도입은 `open-issues.md` §4.6 ticket — 호스트 앱이 빌드 시점에 endpoint 를 hardcode 하는 통제가 우선이고, SDK 단의 startup validation 은 scheme 단계까지가 SDK v2 범위
- (Auth 모듈의 Firebase ID token / Custom Claims / X-App-Id 헤더는 별도 Auth 트랙)

---

## 7. SDK v2 호환성 / Breaking Change 매트릭스

| 변경 | Breaking? | 호스트 앱 영향 | 해소 방안 |
|---|---|---|---|
| Flutter 패키지명 `eodin_deeplink` → `eodin_sdk` | ✅ Breaking | pubspec dep 이름 1줄 + import sed | `migration-guide.md` §4.1 |
| Android namespace `app.eodin.deeplink` → `app.eodin` | X | 5개 앱 모두 native Android 직접 사용 X | 영향 0 |
| Android artifactId `deeplink-sdk` → `eodin-sdk` | X | 동일하게 영향 0 | 영향 0 |
| API endpoint `link.eodin.app/api/v1` → `api.eodin.app/api/v1` | △ | 5개 앱 모두 명시 configure | 호출부 1줄 갱신 |
| `EodinEvent` enum 추가 | X (additive) | 자유 string 보존 | 점진 마이그 |
| Capacitor `track({eventName, properties})` → `track(eventName, properties?)` | ✅ Breaking | kidstopia 호출부 1곳 | `migration-guide.md` §5.2 |
| Capacitor `identify({userId})` → `identify(userId)` | ✅ Breaking | kidstopia 호출부 1곳 | 동일 |
| Capacitor web.ts throw → 동작 | △ (의도) | kidstopia PWA 분석 첫 수집 | baseline reset 안내 |

**총 호스트 앱 작업량**:
- Flutter 4개 (plori / arden / fridgify / tempy): pubspec 1줄 + import sed (평균 3-4 곳) + endpoint 1줄
- fridgify 추가: submodule 제거 + git ref 전환
- Capacitor 1개 (kidstopia): vendor tgz 교체 + positional API 2 곳 + web 첫 수집 baseline 안내

---

## 8. 위험 / 롤백 전략

### 8.1 회귀 위험 영역

| 영역 | 회귀 가능성 | 완화 |
|---|---|---|
| Flutter 4개 import 마이그 | 낮음 | sed 일괄 + `flutter analyze` + 테스트 + smoke test |
| Capacitor positional API | 중간 | grep + 변경 + staging 검증 1주 |
| Web 첫 수집 baseline 점프 | 의도된 변화 | 분석 팀에 baseline reset 안내 |
| RevenueCat alias (Auth 트랙) | — | 본 PRD 범위 밖 |

### 8.2 Rollback

`migration-guide.md` §7 — Flutter 는 ref pin 을 v1 stable commit (`ed009f4`) 로 되돌리고 import sed 역방향. Capacitor 는 v1 vendor tgz 백업 복귀. 마이그 시작 전 v1 안정 commit / tgz 백업 권장.

### 8.3 SDK origin push 정책

- 로컬 v2 commit 은 origin push 보류
- `v2.0.0-beta.1` git tag 만 origin 에 push (main 은 v1 그대로) → 호스트 앱 ref pin 으로 안전
- 모든 호스트 앱이 tag pin 으로 옮긴 후 main 도 v2 advance 가능

---

## 9. 측정 지표 (Success Metrics)

| 영역 | 지표 | 목표 |
|---|---|---|
| 마이그 안전성 | v2 채택 후 회귀 incident 수 | 0 |
| 분석 정상화 | kidstopia `semag.app` web 사용자 이벤트 수신율 | v2 채택 후 1주 내 안정 |
| 마이그 시간 | 앱당 마이그 + staging 검증 | 1주 |
| 채택 완료 | 5개 앱 모두 v2 채택 | 6주 (Phase 5 일정) |
| 신규 앱 onboarding | 가이드 (`integration-guide.md`) 만으로 신규 앱 통합 가능 | ✅ |

---

## 10. Phase / 일정

본 PRD 의 phase 는 SDK 정비 + 5개 앱 마이그만 다룬다.

| Phase | 내용 | 상태 |
|---|---|---|
| 0 (사전 조사) | SDK 사용 매트릭스 / Capacitor web 라이브 / 이벤트 스키마 audit / Service catalog 확장 (LegalService 인프라 포함) | ✅ 완료 |
| 0.5 (SDK 저장소 분리) | `ahn283/eodin-sdk` Public 저장소 신설 + 4채널 코드 추출 | ✅ 완료 |
| 1.1 (패키지 구조) | 5채널 모놀리식 + 모듈별 import + S7 보류 결정 | ✅ |
| 1.3 (API endpoint 통일) | `api.eodin.app/api/v1` | ✅ |
| 1.6 (이벤트 스키마 S9) | EodinEvent enum 4채널 + reference v1.1 | ✅ |
| 1.9 (Capacitor web 처리) | `web.ts` 동작화 + HIGH 3 finding 처리 | ✅ |
| **1.6 (보안 S8)** | Analytics fail-silent 강제 + HTTPS only | 🚧 다음 |
| **1.7 (테스트 보강)** | 4채널 unit test 확대 | 🚧 |
| **1.8 (문서)** | dartdoc / DocC / Dokka / TypeDoc | 🚧 |
| **1.10 (`v2.0.0-beta.1` 릴리스)** | git tag + origin push | 🚧 |
| 1.2 / 0.5.6 (publish CI-CD) | pub.dev / Maven Central / npm / SwiftPM 자동 publish | ⏸️ 사용자 토큰 대기 |
| 1.5 (dual-support) | `eodin_deeplink: ^1.99.0` 호환 alias publish | ⏸️ 보류 (마이그 가이드로 대체) |
| 5 (5개 앱 마이그) | plori → arden → fridgify (submodule 제거) → tempy → kidstopia | 🚧 가이드 완료, 실제 마이그 대기 |

**제외된 phase**:
- Phase 1.4 (EodinAuth 모듈) — Auth 트랙
- Phase 2-4 (Identity API / 통합 Firebase / 백엔드 연결) — Auth 트랙
- Phase 6-8 (점진 출시 / linkgo 연동 / 회고) — Auth 트랙

---

## 11. 오픈 이슈 (SDK 화 범위)

`open-issues.md` 의 SDK 관련 항목만 본 PRD 와 정합:

| ID | 항목 | 상태 |
|---|---|---|
| §4.4 | `subscribe_renew` 5개 앱 채택 추적 (Phase 5 마이그 시) | 🟡 Phase 5 |
| §4.5 | Capacitor / iOS / Android GDPR surface 보강 (`setEnabled` / `requestDataDeletion`) — Flutter 만 구현됨 | 🟡 Phase 1.7 또는 1.9 후속 |
| logging M2 | `DeviceSchema.os` enum 에 `'web'` 추가 (백엔드 schema 변경 → web.ts 가 `device.os = 'web'` 첨부) | 🟢 별도 phase |

**Auth 트랙으로 분리된 항목** (본 PRD 에서 제외):
- Identity API SPOF 정책 (fail-open vs fail-closed)
- 통합 Firebase OAuth client ID 정책
- linkgo 도메인 prod 일치 (Service catalog webUrl)
- kidstopia RevenueCat anonymous → identified
- 14세 미만 사용자 처리 후속 PRD
- kidstopia Firestore → Postgres 재검토 시점

---

## 12. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-03 (web-sdk 분리) | `@eodin/web` analytics 모듈을 별도 트랙으로 분리 (`web-sdk/PRD.md`). 본 PRD §6 의 "Web (Auth 의존이라 본 트랙에서는 신설 보류)" 가정을 무효화 — Auth 의존은 EodinAuth 모듈에만 적용. M1 행 갱신 |
| 2026-05-02 (재정리) | **본 PRD 의 범위를 SDK 화 한정으로 축소.** 통합 ID / EodinAuth / Identity API / 통합 Firebase / 통합 약관 / linkgo NextAuth 전환 / Phase 0.5 firebase uid 충돌 검증 / kidstopia RevenueCat 결정 / linkgo 도메인 결정은 모두 별도 Auth 트랙으로 분리. PRD §7 (EodinAuth 설계) / §8 (Identity API DB+REST) / §9 (통합 Firebase) / §10 (통합 약관) / §11 (6개 앱 마이그 — Auth 의존 부분) / §12 (linkgo NextAuth 전환) / §13 (Auth 보안) 모두 제거 |
| 2026-05-02 (Phase 1.9 완료) | Capacitor web.ts 동작화 + HIGH 3 finding 처리 + 가이드 2개 (integration / migration) 작성 |
| 2026-05-02 (Phase 1.6 완료) | EodinEvent enum 4채널 + reference v1.1 발행 + forbidden v1 names 14건 회귀 가드 |
| 2026-05-02 (Phase 1.3 완료) | API endpoint `api.eodin.app/api/v1` 통일 |
| 2026-05-02 (Phase 1.1 완료) | 5채널 패키지 구조 정비 + S7 보류 결정 |
| 2026-05-02 (Phase 0.9 완료) | Service catalog 확장 (`serviceType` / `webUrl` / `legalEntity`) + LegalService 인프라 |
| 2026-05-02 (Phase 0.5 완료) | `ahn283/eodin-sdk` Public 저장소 신설 + 4채널 코드 추출 |
| 2026-05-02 (Phase 0 완료) | SDK 사용 매트릭스 / Capacitor web 라이브 확인 / 이벤트 스키마 audit / RevenueCat 영향 검토 |
| 2026-05-02 (초안) | 13개 SDK 정비 항목 + 통합 ID + 통합 약관 + 6개 앱 마이그 합본 PRD 작성 |

---

## 13. 참고 자료

- `CHECKLIST.md` — 본 PRD 의 phase 별 작업 항목
- `integration-guide.md` — 신규 호스트 앱 채택
- `migration-guide.md` — 기존 5개 앱 v1 → v2 마이그 (canary 순서 / Rollback / FAQ)
- `event-schema-audit.md` — 5개 앱 이벤트 17건 명명 충돌 매핑
- `phase-1.1-package-structure.md` — 5채널 패키지 구조 결정
- `revenuecat-impact.md` — RevenueCat 영향 검토 (Auth 트랙으로 분리됐으나 SDK 마이그 영향 없음을 본 PRD 에서도 인용)
- `sdk-distribution-checks.md` — Phase 0.5.7 / 0.5.8 (Capacitor SPM submodule path / submodule 인증 모델 검증)
- `sdk-usage-matrix.md` — Phase 0.1 5개 앱 SDK 호출 매트릭스
- `web-sdk-targets.md` — Phase 0.10 Web SDK 채택 후보 (linkgo 는 Auth 트랙 의존)
- `reviews/phase-0.9-code-review.md` / `phase-1.3-code-review.md` / `phase-1.6-code-review.md` / `phase-1.6-logging-audit.md` / `phase-1.9-code-review.md` / `phase-1.9-logging-audit.md` — phase 별 senior-code-reviewer + logging-agent 결과
- `open-issues.md` — phase 진행 중 식별된 후속 ticket 모음 (Auth 트랙 항목 포함)
- `docs/logging/unified-event-reference.md` v1.1 — 표준 이벤트 reference (Phase 1.6 산출)
- SDK 저장소: <https://github.com/ahn283/eodin-sdk>

---

## 부록 A: Auth 트랙 (별도 프로젝트)

본 PRD 의 초안에 포함되어 있던 다음 범위는 별도 Auth 트랙으로 분리되었다. 향후 Auth 트랙 PRD 가 작성되면 본 부록은 삭제 가능.

- **EodinAuth SDK 모듈 (5채널)** — signIn / linkApp / leaveApp / deleteAccount 등
- **Eodin Identity API** — DB 스키마 (eodin_users / eodin_user_emails / eodin_user_apps / eodin_oauth_links / eodin_consents) + REST + Consent API
- **통합 Firebase 프로젝트 신설 + 5개 Firebase 사용자 import** — Phase 0.5 (uid 충돌 검증) 의존
- **통합 약관 / 개인정보처리방침** — Tier 1 (Eodin 통합 계정) + Tier 2 (앱별 이용약관). Service catalog 의 LegalService 인프라는 SDK 화 시점에 이미 완료 (Phase 0.9.1)
- **linkgo NextAuth → Firebase Auth 전환** — Web SDK (`@eodin/web`) 채택 포함
- **kidstopia RevenueCat anonymous → identified 전환**
- **14세 미만 처리 / kidstopia Firestore→Postgres 재검토** — 후속 PRD 시점

이들 항목은 SDK 가 v2 안정 채택 후 (Phase 5 완료 후) 별도 트랙으로 진행하는 것이 자연스럽다.
