# PRD: Eodin Unified Identity & SDK v2 Revamp

**작성일:** 2026-05-02
**작성자:** Woojin Ahn
**상태:** Draft (검토 단계)

---

## 1. 배경 및 문제 정의

Eodin 산하에는 6개 앱이 운영 중이며, 각자 별개의 회원 체계와 Firebase 프로젝트를 가지고 있다. eodin SDK 는 5개 앱에 통합되어 사용자 행동 로그·딥링크·attribution 데이터를 같은 백엔드(`api.eodin.app`)로 전송하지만, **앱별 user_id 가 서로 분리되어 있어 cross-app 분석·SSO·통합 멤버십이 불가능**하다.

또한 eodin SDK 자체가 5개 앱에서 5가지 다른 통합 방식(git submodule, git ref:main, local path, vendor tgz, capacitor)으로 사용되고 있고, 시맨틱 버저닝과 CHANGELOG 가 없어 breaking change 시 5개 앱이 동시에 영향을 받을 위험이 있다.

이 두 문제(SDK 정비 + 회원 통합)를 묶어서 한 번의 v2 마이너 마이그레이션으로 해결한다.

---

## 2. Eodin 산하 6개 앱 현황 (2026-05-02)

| 앱 | 위치 | DB | Firebase Project | Auth | eodin SDK 통합 |
|---|---|---|---|---|---|
| **fridgify** | `~/Github/fridgify` | Postgres + Prisma | `fridgify-3c6bf` | Firebase + 자체 OAuth(google/apple)/PW | git submodule (`libs/eodin`) |
| **plori** | `~/Github/plori` | Postgres + Prisma | `plori-eb1b1` | Firebase | `eodin_deeplink` Flutter pkg (git ref:main) |
| **tempy** | `~/Github/tempy` | Supabase Postgres | `tempy-9f095` | Firebase + Supabase RLS (JWT custom claim) | `eodin_deeplink` Flutter pkg (git ref:main) |
| **arden** | `~/arden` (Github 외부) | Firestore only | `arden-cbe4f` | Firebase | `eodin_deeplink` (local path: `../Github/eodin/...`) |
| **kidstopia (=play-cafe)** | `~/Github/kidstopia` | Firestore only | `kids-cafe-tycoon` | Firebase | `@eodin/capacitor` (vendor tgz) |
| **linkgo** | `~/Github/linkgo` | Postgres + Prisma | ❌ 없음 | **NextAuth.js (Google OAuth)** | ❌ 미통합 (Footer 회사링크만) |

### 도메인 다양성
- **DB**: Postgres+Prisma 4개 (fridgify, linkgo, plori, tempy=Supabase) + Firestore 2개 (arden, kidstopia)
- **회원 모델 무게**:
  - 가장 무거움: fridgify (credits, RevenueCat 구독, role/status, social stats, preferences/stats JSON)
  - 잘 정리됨: linkgo (약관·개인정보·마케팅·쿠키 동의 컬럼 풀 셋팅, soft delete) — **참고 가치 큼**
  - 가장 가벼움: plori (UserProfile: id + displayName + language + subscription)
  - 특수: tempy (firebase_uid 별도 컬럼, family/children 단위 도메인)
  - NoSQL: arden, kidstopia (Firestore `/users/{uid}` 패턴)

### 통합 우호 조건 (확인됨)
- **6개 앱 모두 같은 사업자 명의** → 약관/개인정보처리방침 통합 법적 가능
- **eodin SDK 가 사용자 행동 로그까지 보냄** → cross-app 분석 백엔드는 이미 통합 상태, user_id 통일만 남음
- **`fridgify/libs/eodin/apps/api/prisma/schema.prisma`** 에 이미 `Service / DeferredParam / ClickEvent / LegalDocument / AnalyticsEvent / DeviceAttribution` 등 인프라 모델 존재 (User 만 부재)

---

## 3. 검토 과정 및 결정

### 3.1 검토한 옵션

| 옵션 | 내용 | 평가 |
|---|---|---|
| **A. 풀 통합** | 단일 user table + 단일 Firebase 프로젝트, 5개 앱 모두 마이그 | ❌ wide table 위험, blast radius 큼, 마이그 비용 2-3개월 |
| **B. 부분 통합 (3-tier)** | 약관만 통합 + 신규 앱부터 Identity 사용 + 기존 앱 그대로 | △ 안전하지만 기존 자산(SDK 통합/같은 사업자)을 활용 못 함 |
| **C. 단계 분리 통합 (선택)** | Identity Hub + Per-App Profile, SDK 채널을 통한 점진 마이그 | ✅ 데이터 모델 차이 보존, 점진 가능, 롤백 용이 |

### 3.2 선택: 옵션 C — "Identity Hub + Per-App Profile" 분리형 통합

**핵심 원칙:**
- 중앙 Eodin Identity DB 는 **identity 만** (작게 유지)
- 각 앱 DB 의 user/profile 테이블은 그대로 유지하고 `eodin_user_id` FK 컬럼만 추가
- 앱별 도메인 데이터(credits, family, scripts, links 등)는 그 자리에 둠
- Firebase 통합 / linkgo NextAuth 전환은 **별도 페이즈로 분리**해서 위험 격리

### 3.3 SDK 정비와 묶는 이유
- 어차피 SDK 가 5가지 통합 방식으로 제각각이라 정비 필요
- Identity 모듈(`EodinAuth`)을 SDK 에 추가하면 5개 앱이 다음 SDK 릴리스로 자연스럽게 통합 ID 채택
- breaking change 가 많은 v2 를 한 번에 묶어서 5개 앱이 1주씩 마이그하면 끝

---

## 4. 목표 (Goals)

1. **통합 ID 인프라 구축**: 6개 앱이 단일 `eodin_user_id` 로 식별되어 cross-app 분석·SSO·통합 멤버십 가능
2. **SDK v2 정비**: 패키지 구조·버저닝·배포·테스트·문서를 일관되게 정리
3. **약관/개인정보처리방침 통합**: 2-tier 구조 (공통 계정 약관 + 서비스별 이용약관)
4. **신규 앱 출시 비용 절감**: 회원/약관/탈퇴/프로필 인프라를 SDK 채택만으로 즉시 사용 가능
5. **마이그레이션 안전성**: 단계 분리 + dual-write + 롤백 가능한 구조

---

## 5. 비목표 (Non-Goals)

- 통합 멤버십/구독 상품 출시 (인프라만 구축, 비즈니스 결정은 별도)
- 6개 앱의 도메인 데이터(credits/family/scripts 등) 통합 — 앱별 DB 그대로
- Firestore 두 앱(arden/kidstopia)의 데이터 모델 변경 — sync 만
- 기존 Firebase 프로젝트 즉시 폐기 — 통합 프로젝트는 신설, 기존 프로젝트는 유지하면서 점진 사용자 import

---

## 6. SDK v2 정비 — 13개 항목

진단으로 도출된 13개 항목을 v2.0.0 한 번에 처리한다.

### 6.1 Must (5개)

| # | 항목 | 정비 내용 |
|---|---|---|
| M1 | **Flutter 패키지명 + 모놀리식 단일 패키지 채택** | 단일 패키지 `eodin_sdk` 로 통일 (iOS Package.swift 의 `EodinSDK / EodinAuth / EodinAnalytics / EodinDeeplink` 라이브러리 product 패턴 차용). 모듈별 import 진입점 분리(`import 'package:eodin_sdk/auth.dart'`). Android `app.eodin:sdk`, Capacitor `@eodin/capacitor` 단일 패키지 유지 |
| M2 | **API endpoint 단일화** | `api.eodin.app/api/v1` 로 통일. `link.eodin.app` 은 마케팅 링크 전용. SDK 코드/문서/예제 모두 일관 |
| M3 | **시맨틱 버저닝 + CHANGELOG** | 4개 SDK 모두 `1.0.0` 고정 → semver 도입. 패키지별 `CHANGELOG.md` 신설. breaking 시 major bump 강제 |
| M4 | **레지스트리 정식 배포 (별도 공개 저장소)** | 새 Public 저장소 **`ahn283/eodin-sdk`** 신설 → pub.dev (Flutter), SwiftPM tag (iOS), Maven Central (Android), npm (Capacitor) 4채널 동시 배포. 기존 `ahn283/eodin` 은 Private 유지 (apps/api, ai, admin 비공개 필수). SDK 들이 monorepo internal dep 없어서 분리 깔끔 |
| M5 | **Identity 모듈 신설 (`EodinAuth`)** | signIn / signUp / signInWithGoogle / signInWithApple / signOut / acceptTerms / withdrawConsent / deleteAccount. 자동으로 `EodinAnalytics.identify()` 호출 |

### 6.2 Should (4개)

| # | 항목 | 정비 내용 |
|---|---|---|
| S6 | **4개 SDK 모두 modular 통일** | 현재 iOS 만 `EodinDeeplink` / `EodinAnalytics` 분리. 나머지 3개도 동일 구조. v2 부터 `EodinAuth` 추가하면 3개 모듈 |
| S7 | **static → 인스턴스 패턴** | `EodinAnalytics.track(...)` → `Eodin.shared.analytics.track(...)` 같은 인스턴스 기반. 멀티 init 가능. (breaking change, v2 에서만) |
| S8 | **에러 핸들링 정책 분화** | Analytics 는 fail-silent 유지(현재). **Auth 는 fail-throw 강제** — `signIn` 실패는 무조건 throw, 호출자가 인지 |
| S9 | **이벤트 스키마 통일** | 메모리에 logging-agent 의 unified event reference 있음 — SDK 가 권장 이벤트 타입 enum 제공, 자유 string 도 허용하되 권장 이벤트는 type-safe |

### 6.3 Nice (4개)

| # | 항목 | 정비 내용 |
|---|---|---|
| N10 | **Analytics SDK unit test 보강** | Flutter/iOS 는 deeplink 테스트만 있음. analytics 테스트 추가 (track/identify/queue/offline) |
| N11 | **E2E 통합 테스트** | 백엔드 + SDK round-trip 테스트. Docker compose 로 api 띄우고 4개 SDK 가 호출 |
| N12 | **API reference 자동 생성** | dartdoc (Flutter), DocC (iOS), Dokka (Android), TypeDoc (Capacitor) |
| N13 | **Capacitor web.ts 동작화** | 현재 모두 `unavailable()` throw. kidstopia 웹 빌드 사용 여부 확인 후, 필요 시 web 구현 추가 |

### 6.4 보안 정비 (Must 와 함께)

- `apiKey`: 클라이언트 SDK 에 평문 저장 OK (publishable key, Analytics 용). **Auth 모듈은 별도 토큰 체계** — Firebase ID token 을 `Authorization: Bearer` 로 보내고, 서버에서 Firebase Admin SDK 로 검증
- `userId`: SharedPreferences 평문 저장 (현재 그대로 유지, PII 등급 낮음)
- HTTPS only 강제 (현재 OK), TLS 1.2+ 요구
- API endpoint 화이트리스트 (개발자 임의 리다이렉트 방지)

---

## 7. Identity 모듈 (`EodinAuth`) 설계

### 7.1 API Surface

```dart
// Flutter 예시 (iOS/Android/Capacitor 도 동일 구조)
EodinAuth.configure(
  firebaseProject: 'eodin-id-prod',  // 통합 Firebase 프로젝트
  identityEndpoint: 'https://api.eodin.app/api/v1/identity',
);

// 인증
final user = await EodinAuth.signInWithEmail(email, password);
final user = await EodinAuth.signInWithGoogle();
final user = await EodinAuth.signInWithApple();
final user = await EodinAuth.signUp(email, password, displayName);
await EodinAuth.signOut();

// 세션 / 사용자
EodinAuth.currentUser  // EodinUser? — 통합 ID + 프로필
EodinAuth.idToken      // Firebase ID token (백엔드 호출용)
EodinAuth.onAuthStateChanged  // Stream<EodinUser?>

// 약관 / 개인정보
await EodinAuth.acceptTerms(version: '2026-05-01');
await EodinAuth.acceptPrivacy(version: '2026-05-01');
await EodinAuth.setMarketingOptIn(true);
final consents = await EodinAuth.getConsents();

// 계정 관리
await EodinAuth.updateProfile(displayName: '...', avatar: '...');
await EodinAuth.deleteAccount(reason: '...');  // soft delete + GDPR

// 자동 연동
// signIn 성공 시 EodinAnalytics.identify(eodinUserId) 자동 호출
// signOut 시 EodinAnalytics.clearIdentity() 자동 호출
```

### 7.2 EodinUser 모델

```typescript
interface EodinUser {
  id: string;              // eodin_user_id (UUID)
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  locale: string;
  createdAt: ISODateTime;
  // 앱별 가입 정보
  apps: Array<{
    appId: 'fridgify' | 'plori' | 'tempy' | 'arden' | 'kidstopia' | 'linkgo';
    appUserId: string;     // 해당 앱 내부 PK
    joinedAt: ISODateTime;
    lastActiveAt: ISODateTime;
  }>;
}
```

---

## 8. 백엔드 — Eodin Identity API

### 8.1 신규 DB 스키마 (`eodin/apps/api` 추가)

```prisma
model EodinUser {
  id              String   @id @default(uuid())
  firebaseUid     String   @unique @map("firebase_uid")
  primaryEmail    String   @unique @map("primary_email")
  displayName     String?  @map("display_name")
  avatarUrl       String?  @map("avatar_url")
  locale          String   @default("ko")
  status          UserStatus @default(active)
  deletedAt       DateTime? @map("deleted_at")
  deleteReason    String?   @map("delete_reason")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  emails          EodinUserEmail[]
  apps            EodinUserApp[]
  oauthLinks      EodinOauthLink[]
  consents        EodinConsent[]

  @@map("eodin_users")
}

model EodinUserEmail {
  // 보조 이메일 / 이전 이메일 매핑 (마이그 dedup 용)
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  email     String
  verified  Boolean  @default(false)
  source    String   // 'fridgify-import' | 'linkgo-import' | 'manual' | ...
  createdAt DateTime @default(now()) @map("created_at")

  user      EodinUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, email])
  @@index([email])
  @@map("eodin_user_emails")
}

model EodinUserApp {
  // 어느 앱에 가입했는지 + 각 앱 PK 매핑
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  appId        AppId
  appUserId    String   @map("app_user_id")
  joinedAt     DateTime @default(now()) @map("joined_at")
  lastActiveAt DateTime @default(now()) @map("last_active_at")
  status       String   @default("active")

  user         EodinUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([appId, appUserId])
  @@unique([userId, appId])
  @@map("eodin_user_apps")
}

model EodinOauthLink {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  provider    String   // 'google' | 'apple' | 'kakao' | ...
  providerId  String   @map("provider_id")
  createdAt   DateTime @default(now()) @map("created_at")

  user        EodinUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
  @@map("eodin_oauth_links")
}

model EodinConsent {
  id                 String   @id @default(uuid())
  userId             String   @map("user_id")
  termsVersion       String?  @map("terms_version")
  termsAcceptedAt    DateTime? @map("terms_accepted_at")
  privacyVersion     String?  @map("privacy_version")
  privacyAcceptedAt  DateTime? @map("privacy_accepted_at")
  marketingOptIn     Boolean  @default(false) @map("marketing_opt_in")
  marketingOptInAt   DateTime? @map("marketing_opt_in_at")
  perServiceConsents Json?    @map("per_service_consents")  // {"fridgify": {...}}
  updatedAt          DateTime @updatedAt @map("updated_at")

  user               EodinUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("eodin_consents")
}

enum AppId {
  fridgify
  plori
  tempy
  arden
  kidstopia
  linkgo
}

enum UserStatus {
  active
  suspended
  deleted
}
```

### 8.2 신규 API 엔드포인트

```
# Identity
POST /api/v1/identity/register             # 신규 가입 (Firebase ID token 검증 후 EodinUser 생성)
POST /api/v1/identity/link-app             # 기존 EodinUser 에 앱 가입 추가
GET  /api/v1/identity/me                   # 현재 사용자 정보 (Bearer Firebase ID token)
PATCH /api/v1/identity/me                  # 프로필 수정
DELETE /api/v1/identity/me                 # 계정 탈퇴 (soft delete)

# Consents
GET  /api/v1/identity/me/consents          # 동의 현황
POST /api/v1/identity/me/consents          # 약관/개인정보 동의 기록
GET  /api/v1/legal/terms/latest?app={id}   # 최신 약관 버전
GET  /api/v1/legal/privacy/latest          # 최신 개인정보처리방침

# Migration helpers (admin only)
POST /api/v1/admin/identity/import         # CSV/JSON bulk import (마이그용)
POST /api/v1/admin/identity/merge          # 두 EodinUser 병합 (수동 dedup 용)
```

### 8.3 인증 방식

- 클라이언트 → 백엔드: `Authorization: Bearer <Firebase ID token>`
- 백엔드: Firebase Admin SDK 로 ID token 검증 → `firebase_uid` 추출 → `EodinUser` 조회
- API key (`X-API-Key`) 는 Analytics/Deeplink 같은 publishable 엔드포인트에만 유지

---

## 9. 통합 Firebase 프로젝트

### 9.1 신설

- 신규 Firebase 프로젝트: **`eodin-id-prod`** (스테이징은 `eodin-id-stg`)
- Authentication 활성화: Email/Password, Google, Apple
- 통합 멤버십 / 푸시 / Crashlytics 등 추후 사용

### 9.2 기존 5개 프로젝트와의 관계

| 단계 | 기존 프로젝트 | 신규 통합 프로젝트 |
|---|---|---|
| **Phase 4 (dual-write)** | 사용자 인증·푸시 그대로 | 신규 가입자만 통합 프로젝트로 |
| **Phase 5 (점진 마이그)** | 사용자 import 후 read-only | active 사용자 |
| **Phase 6 후** | deprecated, 푸시 토큰 마이그 완료 후 폐기 검토 | 단일 source of truth |

### 9.3 사용자 import 방식

- Firebase Admin SDK 의 `importUsers()` 사용 → uid 보존 가능 (앱별 RLS 정책 영향 없음)
- 비밀번호: Firebase 의 password hash 호환 (scrypt) — fridgify, plori, tempy, arden, kidstopia 는 모두 Firebase Auth 라 무손실 마이그
- **linkgo 만 예외** — NextAuth.js 의 password hash 와 비호환 → 마이그 후 재설정 강제 또는 OAuth-only

---

## 10. 통합 약관/개인정보처리방침

### 10.1 2-tier 구조

| Tier | 내용 | 대상 |
|---|---|---|
| **Tier 1: 공통 계정 약관 + 통합 개인정보처리방침** | 통합 계정 운영, 인증, 본인 확인, 공통 처리 항목 | Eodin ID 단위 |
| **Tier 2: 서비스별 이용약관** | 각 서비스의 기능, 콘텐츠, 결제, 환불 | 6개 앱 각자 |

업계 표준 (구글, 네이버, 카카오) 패턴.

### 10.2 개인정보처리방침에 명시할 항목

서비스별 처리 항목을 표 형태로 분리 명시 (수집 항목·이용 목적·보유 기간이 서비스마다 다름):

| 서비스 | 수집 항목 | 이용 목적 | 보유 기간 |
|---|---|---|---|
| fridgify | 이메일, 식자재 사진, 레시피 데이터 | 레시피 추천, 구독 관리 | 회원 탈퇴 시까지 |
| plori | 이메일, 위치, 청취 이력 | 장소 추천, 도슨트 제공 | ... |
| tempy | 이메일, 가족 정보, 자녀 데이터 | 육아 지원 | ... |
| arden | 이메일, 음성 사용량 | AI 음성 서비스 | ... |
| kidstopia | 이메일, 친구 관계, 게임 진행 | 게임 운영 | ... |
| linkgo | 이메일, 링크 데이터 | 링크 서비스 | ... |

### 10.3 기존 회원 재동의

- 통합 시점에 모든 사용자에게 **재동의 요구** (약관·개인정보처리방침 변경)
- **14일 사전 고지** (이메일 + 앱 푸시)
- 미동의자: 일정 기간(예: 30일) 유예 후 서비스 이용 제한 / 자동 탈퇴 처리
- 마케팅 동의는 별도 opt-in (기존 동의 그대로 이전)

---

## 11. 5개 앱 마이그레이션 상세

### 11.1 SDK v2 채택

각 앱이 SDK v2 로 업데이트 + `EodinAuth` 모듈 사용 시작.

| 앱 | 변경 내용 | 예상 공수 |
|---|---|---|
| fridgify | submodule 제거 → pub.dev/Maven/SwiftPM 의존성으로. 자체 OAuth/PW → `EodinAuth`. credits 시스템은 그대로 | 2주 |
| plori | git ref:main → pub.dev. UserProfile.id 가 firebase uid 였으므로 `eodin_user_id` 컬럼 추가 + 백필 | 1주 |
| tempy | git ref:main → pub.dev. RLS 정책의 firebase_uid → eodin_user_id 변경 (마이그 SQL) | 1.5주 |
| arden | local path → pub.dev. Firestore `/users/{uid}` 에 `eodin_user_id` 필드 추가 | 1주 |
| kidstopia | vendor tgz → npm. Firestore 동일 처리. Capacitor 통합 SDK 업데이트 | 1주 |

### 11.2 dual-write 단계

각 앱이 SDK v2 채택 후, 일정 기간 동안:
- 신규 사용자: `EodinAuth.signUp` → 통합 Firebase + EodinUser 생성 + 앱 user table 생성
- 기존 사용자: 다음 로그인 시 통합 Firebase 로 import + `eodin_user_id` 백필

### 11.3 각 앱 DB 마이그

```sql
-- Postgres (fridgify, plori, tempy, linkgo)
ALTER TABLE users ADD COLUMN eodin_user_id UUID;
CREATE UNIQUE INDEX idx_users_eodin_user_id ON users(eodin_user_id);
-- 백필은 마이그 스크립트로 (Firebase uid → eodin_user_id 매핑)
```

```typescript
// Firestore (arden, kidstopia)
// /users/{uid} 문서에 eodin_user_id 필드 추가 (Cloud Function batch)
```

---

## 12. linkgo NextAuth → Firebase Auth 전환

### 12.1 가장 큰 위험

- linkgo 는 NextAuth.js 사용 — password hash 가 Firebase 와 비호환
- 비밀번호 재설정 강제 시 **이탈률 20~30% 추정**

### 12.2 마이그 옵션

| 옵션 | 내용 | 위험도 |
|---|---|---|
| (a) 모든 사용자 비밀번호 재설정 강제 | 다음 로그인 시 reset 메일 | 이탈률 높음 |
| (b) Google OAuth 만 즉시 마이그, 이메일 가입자는 reset | OAuth 사용자(다수)는 무손실 | 중간 |
| (c) NextAuth 비밀번호 검증 로직을 백엔드 어댑터로 유지하면서 Firebase 와 dual-auth | 점진적, 그러나 복잡 | 낮음 (구현 복잡) |

**권장**: **(b)** — linkgo 는 이미 Google OAuth 위주로 사용된다고 가정하면 영향 최소화. 사용자 비율 확인 후 최종 결정.

### 12.3 시점

- **Phase 6 (마지막)** — 다른 5개 앱이 안정화된 후 진행
- 사전에 linkgo 사용자 통계 분석: Google OAuth vs 이메일 가입 비율
- 14일 사전 고지 + reset 메일 + 푸시

---

## 13. 보안 / 개인정보 / 컴플라이언스

### 13.1 인증

- Firebase ID token 으로 서버 인증 (TTL 1시간, refresh token 으로 갱신)
- 서버는 Firebase Admin SDK 로 매 요청 검증
- API key 는 Analytics/Deeplink 의 publishable 용도로만 유지

### 13.2 데이터 보호

- HTTPS only (TLS 1.2+)
- 비밀번호: Firebase Auth 가 처리 (scrypt)
- 이메일/displayName: 평문 저장 OK (PII 등급 낮음, 운영상 필요)
- 탈퇴 사용자: soft delete (90일 후 hard delete, GDPR 준수)

### 13.3 GDPR / 개인정보보호법

- 사용자 데이터 export API (`GET /identity/me/export`)
- 계정 삭제 API (soft → hard delete, 30~90일 grace period)
- 마케팅 동의는 명시적 opt-in
- ATT (iOS) 상태 SDK 가 처리 (현재 sdk-ios 의 ATTManager 활용)

### 13.4 감사

- 동의 이벤트 (terms accept, marketing opt-in, withdraw) → AnalyticsEvent 로 기록 + EodinConsent 테이블에 timestamp
- 관리자 작업 (merge, import, force delete) → AdminAction 테이블에 audit log

---

## 14. 위험 / 롤백 전략

### 14.1 주요 위험

| 위험 | 영향 | 완화 |
|---|---|---|
| **Firebase 통합 프로젝트 import 실패** | 5개 앱 사용자 인증 다운 | Phase 별로 1개 앱씩 마이그, dual-write 기간 4주 이상 |
| **eodin_user_id 백필 누락** | 일부 사용자가 cross-app 분석에서 빠짐 | 각 앱 마이그 후 검증 쿼리 + 누락 사용자 알림 |
| **linkgo 사용자 이탈** | linkgo 활성 사용자 감소 | (b) 옵션 채택, 14일 사전 고지, reset 메일 + 푸시 다중 채널 |
| **약관 재동의 미동의자** | 서비스 이용 제한 사용자 발생 | 30일 유예 + 다중 채널 알림 + 1:1 문의 대응 |
| **SDK v2 breaking change 누락** | 5개 앱 동시 빌드 깨짐 | E2E 테스트 + staged rollout (개발용 v2.0.0-beta → 안정화 후 정식) |

### 14.2 롤백 전략

- 각 페이즈별 feature flag 로 차단 가능 (예: `FEATURE_EODIN_AUTH=false` 시 기존 인증 사용)
- 통합 Firebase 프로젝트는 **신설**이라 기존 프로젝트는 무손실 (롤백 = 신규 사용자만 다시 기존 프로젝트로)
- DB 변경은 additive (`eodin_user_id` 컬럼 추가) → drop 으로 즉시 롤백
- linkgo 마이그는 dual-auth 기간 유지 → 문제 시 NextAuth 로 폴백

---

## 15. 측정 지표 (Success Metrics)

### 15.1 인프라 지표

- ✅ 6개 앱 모두 SDK v2 채택 완료
- ✅ 통합 Firebase 프로젝트 사용자 수 = 6개 앱 unique 사용자 합 (dedup 후)
- ✅ `eodin_user_id` 백필률 ≥ 98% (active 사용자 기준)

### 15.2 통합 가치 지표

- **Cross-app 사용률**: 2개 이상 앱을 사용하는 사용자 비율 (baseline 측정 → 6개월 후)
- **신규 앱 출시 시 회원 인프라 작업 시간**: 기존 1주 → 0일 (SDK 채택만)
- **약관 재동의율**: ≥ 90% (14일 고지 + 30일 유예 후)

### 15.3 안정성 지표

- 인증 API SLA ≥ 99.9%
- 마이그 후 인증 실패율 < 0.1%
- linkgo 마이그 시 활성 사용자 retention ≥ 80% (이탈률 ≤ 20%)

---

## 16. 페이즈 / 일정

| Phase | 내용 | 예상 기간 | 의존성 |
|---|---|---|---|
| **Phase 0** | 사전 조사 (Capacitor web 사용 여부, 앱별 SDK 사용 패턴 매트릭스, linkgo OAuth/이메일 가입 비율, 이벤트 스키마 정합성) | 1주 | - |
| **Phase 0.5** | **SDK 저장소 분리** (`ahn283/eodin-sdk` Public 신설 + git filter-repo 로 packages/sdk-* extraction + 기존 monorepo 에 submodule 로 재참조 + fridgify submodule URL 변경) | 2~3일 | Phase 0 |
| **Phase 1** | SDK v2 정비 (13개 항목 + EodinAuth 모듈) | 4주 | Phase 0.5 |
| **Phase 2** | 백엔드 — Eodin Identity API + 약관 API | 3주 | Phase 1 (병렬 가능) |
| **Phase 3** | 통합 Firebase 프로젝트 신설 + 스테이징 환경 | 1주 | - |
| **Phase 4** | 통합 약관/개인정보처리방침 작성 + 법무 검토 + 배포 | 3주 | - (병렬) |
| **Phase 5** | 5개 앱 SDK v2 마이그 (fridgify → plori → tempy → arden → kidstopia 순) | 6주 | Phase 1, 2, 3 |
| **Phase 6** | Firebase 사용자 import + dual-write 기간 (4주) | 4주 | Phase 5 |
| **Phase 7** | linkgo NextAuth → Firebase 마이그 | 3주 | Phase 6 |
| **Phase 8** | 약관 재동의 캠페인 + 미동의자 처리 | 6주 (사전 고지 14일 + 유예 30일 + 정리 2주) | Phase 4 완료 |

**총 예상 기간:** 약 5~6개월 (페이즈 병렬 고려)

상세 작업은 `CHECKLIST.md` 참조.

---

## 17. 오픈 이슈

- [ ] Capacitor SDK 의 web 빌드를 kidstopia 가 실제로 사용하는지 확인 → N13 진행 여부 결정
- [ ] linkgo 사용자의 Google OAuth vs 이메일 가입 비율 확인 → 12.2 마이그 옵션 결정
- [ ] 통합 멤버십/구독 상품을 향후 출시할 계획이 있는지 → 9.1 Firebase 프로젝트 설정 영향 (구독 상품 통합 여부)
- [ ] fridgify 의 RevenueCat 연동을 통합 프로젝트로 이전 시 entitlement 매핑 → 별도 PRD 필요할 수 있음
- [ ] kidstopia 의 Firestore 데이터를 Postgres 로 마이그할지, sync 만 할지 → 도메인 데이터 통합 여부 (현재 비목표지만 향후 결정)

---

## 부록 A: 참고 자료

- 기존 PRD: `/Users/ahnwoojin/Github/eodin/docs/PRD.md`
- 기존 CHECKLIST: `/Users/ahnwoojin/Github/eodin/docs/CHECKLIST.md`
- linkgo User 모델 (약관 동의 컬럼 풀 셋팅 — 참고 가치): `~/Github/linkgo/prisma/schema.prisma`
- fridgify User 모델 (가장 무거운 케이스): `~/Github/fridgify/backend/prisma/schema.prisma`
- 메모리: `/Users/ahnwoojin/.claude/projects/-Users-ahnwoojin-Github-eodin/memory/project_eodin_unified_id_review.md`
