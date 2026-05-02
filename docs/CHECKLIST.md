# CHECKLIST: Eodin Unified Identity & SDK v2

PRD 참고: `./PRD.md`

---

## Phase 0: 사전 조사 (1주)

### 0.1 SDK 사용 패턴 매트릭스
- [ ] fridgify 가 호출하는 SDK 메서드/이벤트 전수 조사 (grep `EodinAnalytics\|EodinDeeplink`)
- [ ] plori 동일
- [ ] tempy 동일
- [ ] arden 동일
- [ ] kidstopia (Capacitor) 동일
- [ ] 매트릭스 문서화 → `docs/unified-id-and-sdk-v2/sdk-usage-matrix.md`

### 0.2 Capacitor web 빌드
- [ ] kidstopia 가 web 빌드를 빌드/배포하는지 확인 (`vite.config.ts`, vercel.json)
- [ ] 만약 사용한다면 N13 (web.ts 동작화) 우선순위 상향

### 0.3 linkgo 사용자 통계
- [ ] linkgo DB 에서 Google OAuth 가입자 vs 이메일 가입자 비율 쿼리
- [ ] 최근 90일 활성 사용자 기준
- [ ] Phase 7 마이그 옵션 확정 (a/b/c 중 1개)

### 0.4 이벤트 스키마 정합성
- [ ] logging-agent 의 unified event reference 와 5개 앱 실제 이벤트 비교
- [ ] 이벤트명/속성 충돌 식별
- [ ] 통일안 작성

### 0.5 미해결 오픈 이슈 점검
- [ ] fridgify RevenueCat 연동의 통합 프로젝트 마이그 영향 검토
- [ ] kidstopia Firestore → Postgres 마이그 여부 결정 (또는 비목표 유지)

---

## Phase 0.5: SDK 저장소 분리 (2~3일)

### 0.5.1 보안 사전 점검
- [ ] `docs/unified-id-and-sdk-v2/security-check.sh` 실행 — secret 패턴 / 의심 키워드 / git history 점검
- [ ] 발견 항목 정리 + 필요 시 `git filter-repo --replace-text` 로 history 정리
- [ ] sample app / test 의 placeholder API key 가 실제 키 아닌지 확인

### 0.5.2 새 저장소 신설
- [ ] `ahn283/eodin-sdk` Public 저장소 생성 (description, README 초안)
- [ ] LICENSE 결정 (MIT / Apache-2.0 등) — 외부 파트너 채택 가능 라이선스
- [ ] 저장소 토픽 / topics 설정 (deferred-deeplink, analytics, mobile-sdk 등)

### 0.5.3 코드 추출 (history 보존)
- [ ] `git filter-repo --path packages/sdk-flutter --path packages/sdk-ios --path packages/sdk-android --path packages/capacitor` 로 SDK history 추출
- [ ] 새 저장소 루트로 디렉토리 재구성 결정 (packages/ 그대로 vs 루트로 끌어올리기)
- [ ] 새 저장소에 push (force, 첫 push)
- [ ] tag 정리 (기존 v1.0.0 등이 있으면 새 저장소에도 반영)

### 0.5.4 기존 monorepo 정리
- [ ] `ahn283/eodin` 의 `packages/sdk-*` 디렉토리 제거
- [ ] 새 저장소를 git submodule 로 다시 add (`packages/sdk` 또는 `vendor/eodin-sdk`)
- [ ] turbo.json / package.json workspace 설정 갱신
- [ ] 기존 monorepo 의 SDK 빌드 / 테스트가 새 submodule 경로로 동작 확인

### 0.5.5 fridgify submodule URL 변경
- [ ] `~/Github/fridgify/.gitmodules` 의 `libs/eodin` URL 을 `eodin-sdk` 로 변경 (또는 SDK 만 필요하면 `libs/eodin-sdk` 로 rename)
- [ ] fridgify 가 사용하는 eodin 모듈이 SDK 만인지, api 도 사용하는지 확인 (api 사용 시 별도 strategy)
- [ ] fridgify 빌드 검증

### 0.5.6 CI/CD 셋업 (publish 인프라)
- [ ] 새 저장소에 GitHub Actions 워크플로우 (tag push 시 4채널 publish)
- [ ] pub.dev publishing token 설정 (Flutter)
- [ ] Maven Central sonatype 계정 + GPG 키 설정 (Android)
- [ ] SwiftPM 은 git tag 만 필요 (자동)
- [ ] npm publish token 설정 (Capacitor)
- [ ] dry-run 으로 4채널 publish 검증 (`2.0.0-rc.1` 등)

---

## Phase 1: SDK v2 정비 (4주)

### 1.1 패키지 구조 (Must M1, Should S6, Should S7)
- [ ] `eodin/packages/sdk-flutter` 디렉토리 분리 결정 (모놀리식 rename `eodin_sdk` vs 멀티 패키지 `eodin_analytics` + `eodin_deeplink` + `eodin_auth`)
- [ ] iOS Package.swift modular 패턴을 Flutter / Android / Capacitor 에 동일 적용
- [ ] static → 인스턴스 패턴 재설계 (`Eodin.shared.analytics.track(...)`)
- [ ] 4개 SDK 동일 인터페이스로 통일 (configure / track / identify / signIn / etc)
- [ ] migration guide v1 → v2 작성

### 1.2 배포 인프라 (Must M3, Must M4)
- [ ] 각 SDK 에 `CHANGELOG.md` 추가
- [ ] semver 도입 + git tag 정책 문서화
- [ ] pub.dev publishing 설정 (Flutter)
- [ ] SwiftPM tag 기반 release 워크플로우
- [ ] Maven Central publishing 설정 (Android)
- [ ] npm publishing 설정 (Capacitor)
- [ ] GitHub Actions: tag push 시 자동 publish

### 1.3 API endpoint 통일 (Must M2)
- [ ] 4개 SDK 코드/문서/예제에서 `link.eodin.app/api/v1` → `api.eodin.app/api/v1` 변경
- [ ] 마이그 가이드에 endpoint 변경 명시
- [ ] 검증: 5개 앱이 v2 채택 시 endpoint 가 정확히 `api.eodin.app`

### 1.4 Identity 모듈 (`EodinAuth`) 신설 (Must M5)
- [ ] Flutter `eodin_auth` 패키지 (또는 모듈) 구현
  - [ ] configure
  - [ ] signInWithEmail / signUp
  - [ ] signInWithGoogle / signInWithApple
  - [ ] signOut
  - [ ] currentUser / idToken / onAuthStateChanged
  - [ ] acceptTerms / acceptPrivacy / setMarketingOptIn
  - [ ] updateProfile / deleteAccount
  - [ ] 자동 EodinAnalytics.identify() 연동
- [ ] iOS `EodinAuth` 모듈 동일 구현
- [ ] Android `EodinAuth` 모듈 동일 구현
- [ ] Capacitor `EodinAuth` 모듈 동일 구현 (web.ts 포함)

### 1.5 보안 / 에러 핸들링 (Should S8, 보안 정비)
- [ ] Auth 모듈은 fail-throw (signIn 실패 시 throw)
- [ ] Analytics 는 fail-silent 유지 (현재 동작)
- [ ] Firebase ID token 자동 갱신 + Authorization 헤더
- [ ] HTTPS only 강제 (개발 endpoint 도 https)

### 1.6 이벤트 스키마 (Should S9)
- [ ] 권장 이벤트 enum (`EodinEvent.appOpen` 등) 제공
- [ ] 자유 string 도 허용 (backward compat)
- [ ] type-safe properties 검증 (선택적)

### 1.7 테스트 (Nice N10, N11)
- [ ] Analytics SDK unit test (track / identify / queue / offline / GDPR)
- [ ] Auth SDK unit test (signIn / signOut / token refresh / acceptTerms)
- [ ] E2E 통합 테스트 (docker compose 로 api 띄우고 4개 SDK 호출)

### 1.8 문서 (Nice N12)
- [ ] dartdoc (Flutter)
- [ ] DocC (iOS)
- [ ] Dokka (Android)
- [ ] TypeDoc (Capacitor)
- [ ] 통합 README + 마이그 가이드 + 예제 앱

### 1.9 Capacitor web 처리 (Nice N13)
- [ ] Phase 0 결과 따라 진행 (kidstopia 가 web 사용하면 구현, 안 쓰면 throw 유지)

### 1.10 v2.0.0-beta 릴리스
- [ ] 4개 SDK 모두 `2.0.0-beta.1` 태그
- [ ] 내부 사용 (eodin 팀) 1주 검증
- [ ] 피드백 반영 후 `2.0.0` 정식 릴리스

---

## Phase 2: 백엔드 — Eodin Identity API (3주)

### 2.1 DB 스키마
- [ ] Prisma schema 추가 (eodin_users / eodin_user_emails / eodin_user_apps / eodin_oauth_links / eodin_consents)
- [ ] 마이그레이션 스크립트
- [ ] 인덱스 + 성능 검증

### 2.2 Identity API
- [ ] `POST /api/v1/identity/register`
- [ ] `POST /api/v1/identity/link-app`
- [ ] `GET /api/v1/identity/me` (Bearer Firebase ID token)
- [ ] `PATCH /api/v1/identity/me`
- [ ] `DELETE /api/v1/identity/me` (soft delete + GDPR)

### 2.3 Consent API
- [ ] `GET /api/v1/identity/me/consents`
- [ ] `POST /api/v1/identity/me/consents`
- [ ] `GET /api/v1/legal/terms/latest?app={id}`
- [ ] `GET /api/v1/legal/privacy/latest`

### 2.4 Migration helpers (admin)
- [ ] `POST /api/v1/admin/identity/import` (CSV/JSON bulk import)
- [ ] `POST /api/v1/admin/identity/merge` (수동 dedup)
- [ ] `GET /api/v1/admin/identity/users` (검색/필터링)

### 2.5 Firebase Admin SDK 통합
- [ ] Firebase Admin 초기화 (서비스 계정 키 secrets)
- [ ] ID token 검증 미들웨어
- [ ] Custom claims 설정 (eodin_user_id 를 token 에 포함)

### 2.6 테스트
- [ ] Identity API unit test
- [ ] Firebase Admin 통합 테스트
- [ ] 부하 테스트 (인증 1000 req/s 목표)

---

## Phase 3: 통합 Firebase 프로젝트 (1주)

### 3.1 프로젝트 신설
- [ ] `eodin-id-prod` Firebase 프로젝트 생성
- [ ] `eodin-id-stg` 스테이징 프로젝트 생성
- [ ] Authentication 활성화: Email/Password, Google, Apple
- [ ] Cloud Messaging 활성화 (푸시 통합)
- [ ] Crashlytics, Analytics 등은 추후

### 3.2 보안 설정
- [ ] Authorized domains 화이트리스트
- [ ] Reauthentication 정책
- [ ] OAuth provider client ID 설정 (Google/Apple)
- [ ] Service account 키 secrets 관리

### 3.3 모니터링
- [ ] 인증 실패율 알림
- [ ] 사용자 import 진행 대시보드

---

## Phase 4: 통합 약관/개인정보처리방침 (3주)

### 4.1 작성
- [ ] Tier 1: 공통 계정 약관 초안
- [ ] Tier 1: 통합 개인정보처리방침 초안 (서비스별 처리 항목 표 포함)
- [ ] Tier 2: 6개 앱 각자 서비스별 이용약관 (기존 약관 분리/재정리)

### 4.2 법무 검토
- [ ] 개인정보보호법 / GDPR 준수 검토
- [ ] 사업자 명의 통합 OK 확인
- [ ] 마케팅 동의 / 본인 확인 / 14세 미만 처리 (kidstopia 의 키즈 대상 고려)

### 4.3 배포
- [ ] eodin web 사이트에 약관/개인정보처리방침 페이지
- [ ] 6개 앱 in-app 링크 통일
- [ ] 버전 관리 (`/legal/terms/v1.md`, `v2.md`...)
- [ ] 변경 이력 / 비교 페이지

---

## Phase 5: 5개 앱 SDK v2 마이그 (6주)

순서: **fridgify → plori → tempy → arden → kidstopia** (영향도 큰 순)

### 5.1 fridgify (2주)
- [ ] submodule 제거 → pub.dev 의존성 (`eodin_sdk: ^2.0.0`)
- [ ] 자체 OAuth/PW 코드 → `EodinAuth` 로 교체
- [ ] credits 시스템은 그대로 유지
- [ ] DB 마이그: `users` 테이블에 `eodin_user_id` 컬럼 추가
- [ ] 백필 스크립트 (firebase_uid 매핑)
- [ ] 빌드 / 코드 리뷰 (senior-code-reviewer) / 로깅 점검 (logging-agent) / 단위 테스트 / 커밋

### 5.2 plori (1주)
- [ ] git ref:main → pub.dev `eodin_sdk: ^2.0.0`
- [ ] UserProfile.id 가 firebase uid 였으므로 `eodin_user_id` 컬럼 추가 + 백필
- [ ] 빌드 / 리뷰 / 로깅 / 테스트 / 커밋

### 5.3 tempy (1.5주)
- [ ] git ref:main → pub.dev
- [ ] Supabase RLS 정책 변경: `auth.firebase_uid` → `eodin_user_id`
- [ ] DB 마이그: `users.eodin_user_id` + 백필
- [ ] family/children 도메인 데이터는 그대로
- [ ] 빌드 / 리뷰 / 로깅 / 테스트 / 커밋

### 5.4 arden (1주)
- [ ] local path → pub.dev `eodin_sdk: ^2.0.0`
- [ ] Firestore `/users/{uid}` 문서에 `eodin_user_id` 필드 추가 (Cloud Function batch)
- [ ] firestore.rules 검증
- [ ] 빌드 / 리뷰 / 로깅 / 테스트 / 커밋

### 5.5 kidstopia (1주)
- [ ] vendor tgz → npm `@eodin/capacitor: ^2.0.0`
- [ ] Firestore 동일 처리
- [ ] firestore.rules 검증 (친구/방명록 권한)
- [ ] 빌드 / 리뷰 / 로깅 / 테스트 / 커밋

### 5.6 검증
- [ ] 5개 앱 모두 v2 채택 후 백필률 ≥ 98% 확인
- [ ] cross-app 분석 쿼리 동작 확인 (예: fridgify + plori 사용자 비율)

---

## Phase 6: Firebase 사용자 import + dual-write (4주)

### 6.1 import
- [ ] 5개 앱의 Firebase 사용자 export (Firebase Admin SDK)
- [ ] dedup 로직 (같은 이메일 → 한 EodinUser 로 merge)
- [ ] dedup 충돌 케이스 수동 처리 (admin merge API)
- [ ] 통합 프로젝트로 import (uid 보존)
- [ ] 백엔드 EodinUser 레코드 생성

### 6.2 dual-write
- [ ] 4주간 dual-write 기간 운영
- [ ] 모든 신규 가입은 통합 프로젝트로
- [ ] 기존 사용자는 다음 로그인 시 통합 프로젝트로 이동
- [ ] 모니터링 대시보드 (마이그 진행률 / 인증 실패율 / 이탈률)

### 6.3 푸시 토큰 마이그
- [ ] FCM 토큰 재발급 가이드 (앱 업데이트 시)
- [ ] 기존 프로젝트 토큰 → 통합 프로젝트 토큰 매핑
- [ ] RevenueCat (fridgify) 연동 재셋업

### 6.4 정리
- [ ] dual-write 종료 시점 결정 (활성 사용자 99% 마이그 시)
- [ ] 기존 프로젝트는 read-only 로 deprecated

---

## Phase 7: linkgo NextAuth → Firebase (3주)

### 7.1 사전 결정 (Phase 0 결과 기반)
- [ ] 마이그 옵션 확정 (a/b/c)
- [ ] 영향 사용자 수 / 예상 이탈 추정

### 7.2 사전 고지
- [ ] 14일 사전 고지 (이메일 + 푸시 + 인앱 배너)
- [ ] FAQ / 고객 지원 채널 준비

### 7.3 마이그 실행
- [ ] linkgo Firebase Auth 통합 프로젝트로 연결
- [ ] NextAuth 어댑터를 Firebase Auth 로 교체
- [ ] 사용자 import (Google OAuth 자동, 이메일은 reset 메일)
- [ ] linkgo `users` 테이블에 `eodin_user_id` 추가 + 백필
- [ ] 빌드 / 리뷰 / 로깅 / 테스트 / 커밋

### 7.4 사후 모니터링
- [ ] 1주차 활성 사용자 retention 확인
- [ ] 비밀번호 재설정 완료율
- [ ] 고객 문의 추적

---

## Phase 8: 약관 재동의 캠페인 (6주: 14일 고지 + 30일 유예 + 정리 2주)

### 8.1 사전 고지 (14일)
- [ ] 이메일 발송 (전체 사용자)
- [ ] 앱 푸시 (6개 앱)
- [ ] 인앱 배너 / 모달
- [ ] 변경 사항 비교 페이지 (구 약관 vs 신 약관)

### 8.2 재동의 (30일 유예)
- [ ] 앱 진입 시 동의 모달 (skip 가능 30일)
- [ ] 마케팅 동의는 별도 opt-in (기존 동의 그대로 이전 + 재확인)
- [ ] 동의 완료율 일일 모니터링

### 8.3 미동의자 처리
- [ ] 30일 후 미동의자: 서비스 이용 제한
- [ ] 추가 14일 후: 자동 탈퇴 (soft delete)
- [ ] 90일 후: hard delete (GDPR)

### 8.4 사후
- [ ] 재동의율 ≥ 90% 확인
- [ ] 이탈자 분석 (왜 미동의했는지)
- [ ] 회고 / 다음 약관 변경 시 개선점

---

## 전체 검증 (Phase 8 종료 후)

- [ ] 6개 앱 모두 SDK v2 + EodinAuth 사용
- [ ] `eodin_user_id` 백필률 ≥ 98%
- [ ] 통합 Firebase 프로젝트 = single source of truth
- [ ] linkgo 활성 사용자 retention ≥ 80%
- [ ] 약관 재동의율 ≥ 90%
- [ ] cross-app 분석 대시보드 동작
- [ ] 신규 앱 출시 시뮬레이션 (테스트 앱) — SDK 채택만으로 회원/약관/탈퇴 인프라 즉시 사용 확인
- [ ] PRD 의 측정 지표 달성 여부 평가
- [ ] 회고 문서 작성

---

## 산출물

- [ ] PRD (`./PRD.md`) — 이 문서가 가리킴
- [ ] 사용자 가이드 (관리자 / 개발자 / 사용자 각각)
- [ ] SDK v1 → v2 마이그 가이드
- [ ] linkgo 사용자 마이그 안내문
- [ ] 약관/개인정보처리방침 (Tier 1, Tier 2)
- [ ] 회고 문서
