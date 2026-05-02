# linkgo 인증 시스템 조사 결과 (Phase 0.3)

**작성일:** 2026-05-02
**대상:** `~/Github/linkgo`
**참조:** PRD §12 (linkgo NextAuth → Firebase Auth), C3 (linkgo password hash)

---

## 1. 결론 — PRD 의 핵심 가정 정정 필요

| PRD 가정 | 실제 | 영향 |
|---|---|---|
| linkgo `User.passwordHash` 가 BCRYPT 일 가능성 | ❌ **passwordHash 컬럼 자체 없음** | §12.1 의 BCRYPT importUsers 옵션 (d) 무효 — 비밀번호 마이그 작업 자체 불필요 |
| 이메일 가입자 + Google OAuth 가입자 혼재 | ❌ **100% Google OAuth 전용** | §12.2 4개 옵션 중 사실상 (b) 만 가능 (이메일 가입자 0명) |
| linkgo 도메인 `linkgo.kr` (PRD §10.5, §16) | NextAuth cookie domain `.linkgo.dev` | Service 카탈로그 등록 시 webUrl 정정, 약관 페이지 URL 도 영향 |

---

## 2. 조사 근거

### 2.1 NextAuth providers 설정

`/app/api/auth/[...nextauth]/route.ts` —

```typescript
const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // ...
  session: {
    strategy: 'database',         // 서버 세션 (Prisma Session 테이블)
    maxAge: 30 * 24 * 60 * 60,    // 30일
    updateAge: 24 * 60 * 60,      // 24시간 단위 갱신
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        domain: process.env.NODE_ENV === 'production' ? '.linkgo.dev' : undefined,
        // ...
      }
    }
  },
}
```

- **providers**: `GoogleProvider` 1개. Credentials provider 없음, Email provider 없음
- **adapter**: `PrismaAdapter` — Account / Session / User / VerificationToken 표준 NextAuth 모델
- **session strategy**: `database` (JWT 아님) — Session 테이블 row 가 source of truth
- **cookie domain**: `.linkgo.dev` (production 만)

### 2.2 User 모델 (`prisma/schema.prisma:390-440`)

비밀번호 관련 컬럼 없음. 주요 컬럼:

```prisma
model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  name               String?
  nickname           String?
  image              String?      // Google OAuth profile image URL
  emailVerified      DateTime?    // NextAuth 표준
  role               UserRole  @default(USER)

  // 약관/개인정보처리방침/쿠키 동의 (PRD 가 "참고 가치 큼" 으로 평가한 부분)
  acceptedTermsAt    DateTime?
  acceptedPrivacyAt  DateTime?
  acceptedCookiesAt  DateTime?
  marketingOptIn     Boolean   @default(false)
  marketingOptInAt   DateTime?
  dataRetentionOptIn Boolean   @default(true)
  cookiePreferences  Json?

  // 계정 상태
  isActive           Boolean   @default(true)
  deletedAt          DateTime?  // soft delete
  deleteReason       String?

  // 관계
  accounts      Account[]    // OAuth provider 연결 (Google 만)
  sessions      Session[]
  consents      UserConsent[]
  // ...
}
```

### 2.3 Account 모델 (NextAuth 표준)

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String          // 'google'
  providerAccountId String          // Google sub
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  // ...
  @@unique([provider, providerAccountId])
}
```

→ 마이그 시 `Account.providerAccountId` 가 Google `sub` — 통합 Firebase 의 `firebase_user.providerData[].uid` 와 매핑.

### 2.4 신규 가입 자동 동의 처리

`events.signIn` 콜백 — `isNewUser && account?.provider === 'google'` 시:

```typescript
await prisma.user.update({
  data: {
    nickname,
    acceptedTermsAt: now,
    acceptedPrivacyAt: now,
    acceptedCookiesAt: now,
  },
})

await prisma.userConsent.createMany({
  data: [
    { userId, documentType: 'TERMS_OF_SERVICE', documentVersion: '2.0.0', consentedAt: now },
    { userId, documentType: 'PRIVACY_POLICY',  documentVersion: '2.0.0', consentedAt: now },
    { userId, documentType: 'COOKIE_POLICY',   documentVersion: '1.0.0', consentedAt: now }
  ]
})
```

→ **EodinConsent / EodinConsentItem 매핑 직관적**. `documentType` enum 만 정렬하면 그대로 import.

---

## 3. 마이그레이션 단순화

### 3.1 PRD §12.1 ~ §12.4 의 변경

**기존 PRD 의 마이그 옵션 4개 → 실질 1개로 축소**:

| PRD 옵션 | 평가 변경 |
|---|---|
| (a) 모든 사용자 비밀번호 재설정 강제 | ❌ → 무관 (비밀번호 없음) |
| (b) Google OAuth 만 즉시 마이그, 이메일 가입자 reset | ❌ → ✅ **사실상 이것만** (이메일 가입자 0명이라 reset 대상 없음) |
| (c) NextAuth 비밀번호 검증 dual-auth | ❌ → 무관 |
| (d) Firebase importUsers + BCRYPT hash | ❌ → 무관 |

**새 마이그 절차** (단순):
1. 통합 Firebase 의 Google OAuth client ID 결정 (재사용 vs 신규)
2. linkgo `Account.providerAccountId` (Google sub) 를 통합 Firebase 사용자로 import
   - `firebase-admin.auth().importUsers()` — `providerData: [{ providerId: 'google.com', uid: <google_sub> }]`
   - 비밀번호 hash 옵션 미사용
3. linkgo `User` → `EodinUser` 1:1 매핑 + `EodinUserApp(appId='linkgo')` 생성
4. `User.acceptedTermsAt` / `marketingOptIn` 등 → `EodinConsentItem` 으로 backfill
5. linkgo `User.id` → linkgo `users` 테이블의 `eodin_user_id` 컬럼 백필
6. NextAuth → Firebase Auth Web SDK 코드 교체 + `@eodin/web` 채택

### 3.2 사용자 영향 (PRD §12.4 보다 우호적)

- 비밀번호 재설정 안내 불필요
- **OAuth client ID 재사용 시**: 사용자는 변화 인지 못 함 (다음 로그인 시 자동 매핑)
- **OAuth client ID 신규 발급 시**: 다음 Google 로그인 시 동의 화면 1회 더 — 계정은 매핑됨
- 14일 사전 고지 내용 단순화: "인증 시스템이 통합됩니다. 다음 로그인 시 Google 로 한 번 더 로그인이 필요할 수 있습니다." (재설정 X)
- **PRD §15.3 의 "linkgo 활성 사용자 retention ≥ 80%" 목표 → ≥ 95% 로 상향 가능**

### 3.3 Phase 0 에서 추가 결정 필요

- [ ] **OAuth client ID 정책**: linkgo 의 기존 Google client (`process.env.GOOGLE_CLIENT_ID`) 를 통합 Firebase 프로젝트(`eodin-id-prod`) 에 재등록 가능한지 확인
  - Firebase 는 외부 OAuth client 등록 가능 (Authorized OAuth client IDs)
  - 동일 client ID 재사용 시 사용자 sub 동일 → 무손실
- [ ] **도메인 정정**: PRD §10.5 의 linkgo URL 패턴 `link.eodin.app/legal/linkgo/...` 는 그대로 유지하되, Service.webUrl 등록 시 실제 도메인 확인 필요 (`linkgo.dev` vs `linkgo.kr`)

---

## 4. linkgo 가 통합 모델 참고로 가치 있는 이유 (PRD §3 평가 재확인)

| 컬럼 / 패턴 | EodinUser / EodinConsent 매핑 |
|---|---|
| `acceptedTermsAt`, `acceptedPrivacyAt`, `acceptedCookiesAt` | `EodinConsentItem(type='terms'/'privacy'/'cookies', acceptedAt=...)` |
| `marketingOptIn`, `marketingOptInAt` | `EodinConsentItem(type='marketing', acceptedAt=marketingOptInAt)` |
| `cookiePreferences` JSON | `EodinConsentItem` 의 `metadata` 또는 별도 `cookie_preferences` 컬럼 (PRD 미정의 — Phase 1.4 검토) |
| `dataRetentionOptIn` | EodinUser 추가 컬럼 또는 ConsentItem |
| `isActive`, `deletedAt`, `deleteReason` | `EodinUser.status`, `deletedAt`, `deleteReason` (PRD 정의 일치) |
| `UserConsent` 테이블 (별도 audit) | `EodinConsentItem` 자체가 audit 역할 |
| `events.signIn` 의 자동 동의 기록 | `EodinAuth.signUp` → `acceptTerms` 자동 호출 (PRD §7.1 의 자동 연동 패턴 일치) |

→ **EodinConsent 모델 설계 시 linkgo 패턴 그대로 차용 권장** (PRD §8.1 schema 가 이미 그렇게 됨).

---

## 5. 위험 / 후속 작업

| ID | 항목 | 우선순위 |
|---|---|---|
| L1 | OAuth client ID 재사용 가능 여부 검증 — 통합 Firebase + linkgo 의 GOOGLE_CLIENT_ID 호환성 | 🔴 Phase 0 (지금) |
| L2 | linkgo 도메인 정정 (`linkgo.dev` vs `linkgo.kr`) — Service.webUrl 등록 시 영향 | Phase 0.9 |
| L3 | PRD §12 전면 단순화 — BCRYPT 옵션 제거, OAuth-only 로 재작성 | 이 문서 commit 시 |
| L4 | PRD §15.3 retention 목표 ≥ 80% → ≥ 95% 상향 검토 | PRD 갱신 시 |
| L5 | 통합 시 linkgo `User.id` (cuid) 와 EodinUser.id (UUID) 형식 차이 — `EodinUserApp.appUserId` 가 cuid 보존하면 OK | Phase 6 |
