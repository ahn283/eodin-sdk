# RevenueCat 영향 조사 (Phase 0.7)

**작성일:** 2026-05-02
**대상:** 5개 앱 (fridgify / plori / tempy / arden / kidstopia)
**참조:** PRD §5.4 (RevenueCat alias 마이그), §11.1, H5

---

## 1. 결론

5개 앱 **모두** RevenueCat 사용 (`purchases_flutter` × 4 + `@revenuecat/purchases-capacitor` × 1). PRD §5.4 의 "fridgify 만 영향 + firebase_uid → eodin_user_id alias" 가정 정정 필요:

| 앱 | RevenueCat `appUserID` source | 마이그 영향 |
|---|---|---|
| **fridgify** | `User.id` (Postgres UUID, **firebase_uid 아님**) | ✅ **변경 없음** — UUID 가 `EodinUserApp.appUserId` 로 그대로 보존되면 RC 무관 |
| **plori** | Firebase `user.uid` | 🔴 통합 Firebase 로 import 시 uid 변경 가능 → **alias 필요** |
| **tempy** | Supabase `user.id` (**firebase_uid 아님**) | 🟡 Supabase user.id 가 변경되지 않으면 OK, 변경되면 alias 필요 |
| **arden** | Firebase `user.uid` | 🔴 plori 와 동일 — alias 필요 |
| **kidstopia** | **anonymous** (RC 자동 생성 `$RCAnonymousID`) — `logIn()` 없음 | 🟡 v2 에서 `Purchases.logIn(eodinUserId)` 채택 시 기존 anon entitlement alias 필요 |

→ 영향 받는 앱은 **plori + arden** (firebase_uid 변경 가능) + **kidstopia** (anonymous → identified 전환 시) 3개. fridgify 는 PRD 가정과 정반대로 **무영향**.

---

## 2. 앱별 상세

### 2.1 fridgify — PRD 가정 정정 (영향 없음)

**현재 코드** (`mobile/lib/services/subscription_service.dart`):
```dart
configuration.appUserID = userId;  // line 107
await Purchases.configure(configuration);
// ...
final result = await Purchases.logIn(userId);  // line 157
```

**`userId` 의 source** (`auth_provider.dart:104`):
```dart
await SubscriptionService.instance.login(_user!.id);
```

**`_user.id` 의 source** (backend/prisma/schema.prisma:251):
```prisma
model User {
  id String @id @default(uuid())   // Postgres UUID — NOT firebase_uid
  email String @unique
  googleId String?  @unique  // OAuth ID 별도 컬럼
  appleId String?   @unique
  passwordHash String?       // 자체 PW (firebase_uid 컬럼 없음)
  // ...
}
```

→ fridgify 는 자체 인증 시스템 (Postgres UUID) 사용. Firebase Auth 는 OAuth provider 로만 사용 (`googleId`/`appleId` 컬럼에 OAuth id 보관). RevenueCat appUserID = Postgres UUID.

**v2 마이그 영향**:
- `EodinUserApp(appId='fridgify', appUserId=<기존 fridgify User.id UUID>)` 로 매핑 → RC appUserID 변화 없음
- 단, 만약 v2 에서 RC appUserID 를 `eodin_user_id` (다른 UUID) 로 바꾸려 한다면 alias 필요 — **권장하지 않음** (불필요한 위험)
- **PRD §5.4 의 "RevenueCat customer alias 마이그" 항목 fridgify 에 대해 무관**

### 2.2 plori — Firebase uid 사용 (alias 필요)

**현재 코드** (`apps/mobile/lib/services/pass_service.dart:266`):
```dart
final config = PurchasesConfiguration(apiKey)..appUserID = userId;
await Purchases.configure(config);
// 또는
await Purchases.logIn(userId);  // line 258
```

**`userId` source** (`apps/mobile/lib/screens/auth/login_screen.dart:31`):
```dart
state.setUser(user.uid);  // user is FirebaseUser → user.uid is Firebase uid
```

→ plori 는 `RevenueCat appUserID = Firebase uid` (개별 프로젝트 `plori-eb1b1`).

**v2 마이그 영향**:
- 통합 Firebase 프로젝트(`eodin-id-prod`) 로 import 시 uid 가 보존되면 (Phase 0.5 결과 = 충돌 0건) 변경 없음
- uid 충돌이 있어 신규 uid 발급 시 → 기존 RC entitlement 잃음 → **alias 필요**
- **권장 절차**: `Purchases.logIn(new_eodin_uid)` 호출 시 RC SDK 가 자동으로 기존 anon/old uid 의 entitlement 를 새 user 로 이전 (`mergeAppUserID` 자동). 단 staging 검증 필수

### 2.3 tempy — Supabase user.id 사용 (정합 검증 필요)

**현재 코드** (`lib/services/subscription_service.dart:123`):
```dart
final result = await Purchases.logIn(userId);
```

**`userId` source** (`lib/features/auth/auth_provider.dart:128`):
```dart
await SubscriptionService.instance.login(_supabaseUser!.id);
```

→ tempy 는 `RevenueCat appUserID = Supabase user.id` (UUID, Supabase 가 발급).

**v2 마이그 영향**:
- Supabase user.id 자체는 v2 마이그 후에도 변경되지 않음 (PRD §5.3 의 RLS 마이그는 column 추가만)
- Supabase user.id == EodinUserApp(appId='tempy').appUserId 로 매핑하면 RC 무관
- **단**: PRD §5.3 의 "Firebase + Supabase RLS (JWT custom claim)" 부분 — 통합 Firebase 토큰의 custom claim 으로 RLS 검증 시 `auth.uid()` 가 변할 수 있음. 이 경우 Supabase user.id 와 별도로 RC 동기화 검증 필요

### 2.4 arden — Firebase uid 사용 (alias 필요)

**현재 코드** (`lib/presentation/providers/subscription_provider.dart:87`):
```dart
await _service.login(nextUser.uid);  // nextUser is User (Firebase Auth user)
```

→ arden 은 `RevenueCat appUserID = Firebase uid` (개별 프로젝트 `arden-cbe4f`). plori 와 동일 패턴.

**v2 마이그 영향**: plori 와 동일 — 통합 Firebase 로 import 시 uid 보존 여부에 따라 alias 필요.

### 2.5 kidstopia — anonymous (전환 결정 필요)

**현재 코드** (`src/services/iapService.ts:130`):
```typescript
await Purchases.configure({ apiKey: REVENUECAT_API_KEY })
// Purchases.logIn() 호출 없음 — 항상 anonymous
```

→ kidstopia 는 RC anonymous mode 사용 — `$RCAnonymousID:<random>` 로 entitlement 추적. 앱 재설치 / 디바이스 변경 시 `restorePurchases` 로만 복원.

**v2 마이그 영향 / 결정 필요**:
- (a) **그대로 anonymous 유지** — entitlement 마이그 없음, 단 cross-device sync 영원히 불가
- (b) **v2 에서 `Purchases.logIn(eodinUserId)` 채택** — 신규 사용자는 cross-device sync 가능. 기존 anonymous entitlement 는 자동 alias (RC SDK 가 첫 logIn 시 anon → identified merge 처리)
- **권장 (b)**: 통합 ID 도입 가치 살리려면 cross-device sync 필요. 마이그 위험 낮음 (RC 가 자동 처리)

---

## 3. 통합 마이그 전략 (PRD §5.4 / §11.1 정정안)

### 3.1 fridgify
- ✅ RevenueCat 마이그 작업 **불필요** — Postgres UUID 보존
- PRD §11.1 의 "RevenueCat customer alias 마이그 (기존 firebase_uid → 새 eodin_user_id)" 문구 정정 필요

### 3.2 plori / arden — alias 필요 시점
- Phase 5 (SDK v2 마이그) 시점에 `EodinAuth.signIn` 후 `Purchases.logIn(eodinUserId)` 호출
- RC SDK 가 자동으로 기존 firebase_uid → new uid alias 처리
- 검증: staging 에서 실 결제 사용자 sample → 마이그 후 entitlement 확인
- **fail-safe**: 마이그 실패 시 사용자가 `restorePurchases` 로 복구 가능 (App Store / Play Store receipt 기반)

### 3.3 tempy
- Supabase user.id 가 보존되면 마이그 작업 불필요
- 추가 검증: 통합 Firebase 토큰 → Supabase JWT exchange 시 auth.uid() 일관성 (Phase 5.3 RLS 단계별 마이그 시 검증)

### 3.4 kidstopia
- 결정: anonymous 유지 vs `Purchases.logIn` 도입
- **권장**: 도입. v2 의 cross-app/cross-device 가치 살림
- 마이그: 첫 logIn 시 RC SDK 자동 alias

---

## 4. PRD 수정 필요 항목

| 위치 | 현재 | 정정 |
|---|---|---|
| §5.4 (Phase 5.4 fridgify) | "RevenueCat customer alias 마이그" 작업 항목 | fridgify 는 무관 — 항목 삭제 또는 plori/arden/kidstopia 로 이동 |
| §11.1 fridgify 행 | "RevenueCat customer alias 마이그 (기존 firebase_uid → eodin_user_id)" | "RevenueCat 변경 없음 (User.id UUID 보존)" |
| §14.1 위험 매트릭스 | RevenueCat 위험 = fridgify 만 | plori, arden 추가. fridgify 제거 |
| §11.1 plori 행 | 변경 사항 없음 | "RevenueCat appUserID = Firebase uid → 통합 Firebase 마이그 시 uid 변경 위험. Purchases.logIn(eodin_uid) 호출로 자동 alias" 추가 |
| §11.1 arden 행 | 변경 사항 없음 | plori 와 동일 추가 |
| §11.1 kidstopia 행 | 변경 사항 없음 | "anonymous → identified 전환 결정 필요. v2 채택 권장" 추가 |
| §14.1 H5 행 | "fridgify RevenueCat 영향" | "plori/arden Firebase uid 변경 → RC alias 필요. kidstopia 결정 필요" |

---

## 5. 위험 / 후속 작업

| ID | 항목 | 우선순위 |
|---|---|---|
| RC1 | PRD §5.4 / §11.1 / §14.1 수정 — 영향 받는 앱 재정의 | 즉시 (이 commit) |
| RC2 | plori / arden — staging 환경에서 RC SDK 자동 alias 동작 검증 (sample 5명 사용자) | Phase 5 시작 전 |
| RC3 | tempy — 통합 Firebase 토큰 → Supabase JWT exchange 시 auth.uid() 일관성 검증 | Phase 5.3 |
| RC4 | kidstopia — anonymous 유지 vs identified 전환 결정 (PM/사용자) | Phase 1 시작 전 |
| RC5 | 5개 앱 모두 — `Purchases.setLogLevel(LogLevel.debug)` 활성화 + 마이그 1주간 entitlement 누락 모니터링 | Phase 5/6 |
| RC6 | RC dashboard 의 "Customer Identifier History" 활용 — 마이그 전후 alias chain 검토 | Phase 5/6 |
