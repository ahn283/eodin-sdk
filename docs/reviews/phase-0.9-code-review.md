# Phase 0.9 Code Review — unified-id-and-sdk-v2

**Date**: 2026-05-02
**Scope**:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260502070000_add_service_type_and_legal_entity/migration.sql`
- `apps/api/prisma/seed.ts`
**Reference**: PRD §8.2.1

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH     | 3 |
| MEDIUM   | 4 |
| NITS     | 4 |

마이그레이션 SQL 자체는 `prisma migrate diff` 결과와 의미적으로 동일 (단일 ALTER → 4개 ALTER 분할만 차이, 트랜잭션 동등). seed 의 `upsert + update: {}` 패턴도 prod 안전. 단 `linkgo` 가 `services` 테이블에 등록되면서 deferred-deeplink 라우터가 web-only 서비스에도 매칭되어 **`null` scheme + downstream 타입 mismatch** 라는 실질적 회귀가 발생. PRD §8.2.1 의 핵심 가드(“`serviceType != 'web'` 인 5개 앱만 라우팅”)가 코드/타입 레벨에서 미구현.

---

## CRITICAL

### C1. linkgo 가 deferred-deeplink 라우터에 노출 — `null` scheme 으로 깨진 deeplink 생성

- **File**: `apps/web/src/app/[service]/page.tsx:88`, `apps/web/src/app/[service]/[...path]/page.tsx:112`, `apps/web/src/utils/api.ts:12`
- **What's wrong**: seed.ts:122-129 가 `linkgo` 를 `Service` 로 등록. 기존 라우터(`apps/web/src/app/[service]/...`) 는 `serviceType` 을 보지 않고 모든 `services` row 를 deeplink 대상으로 처리. 결과:
  - `apps/web/src/utils/api.ts:12` 의 `Service.scheme: string` 타입 거짓말 (DB 는 nullable). `link.eodin.app/linkgo` 또는 `link.eodin.app/linkgo/foo` 요청 시 `service.scheme === null` → `[service]/[...path]/page.tsx:112` 가 ``${null}${path}`` → `"nullfoo"` 라는 깨진 string 을 deeplink 로 사용.
  - 클라이언트로 `serialize(undefined)` 가 아닌 `null` 이 흘러 `<DeepLinkRedirect deeplink="nullfoo">` 로 렌더, intent URL/iOS scheme 시도 모두 실패.
  - PRD §8.2.1 “`serviceType != 'web'` 인 5개 앱만 라우팅” 가드가 빠져 있음.
- **Fix** (둘 중 하나 — 둘 다 권장):
  1. `apps/web/src/utils/api.ts:9-25` 의 `Service` 인터페이스에 `serviceType: 'mobile' | 'web' | 'mixed'` 추가, `scheme: string` → `scheme: string | null` 로 정정.
  2. `apps/web/src/app/[service]/page.tsx` 와 `[...path]/page.tsx` 진입점에서 `service.serviceType === 'web' || !service.scheme` 시 `notFound()` (또는 `service.webUrl` 로 redirect) 처리. seed 가 prod 에 적용되기 *전* 에 머지되어야 함.
- **Why CRITICAL**: 머지 + `npm run db:seed` 실행 즉시 `link.eodin.app/linkgo*` 트래픽이 깨짐. PRD 의 명시 가드 누락.

---

## HIGH

### H1. `Service.id == LegalService.id` 컨벤션이 schema 코멘트에만 존재 — DB 레벨 무결성 없음

- **File**: `apps/api/prisma/schema.prisma:13-16`, 122-135
- **What's wrong**: 1:1 컨벤션이 코드/스키마로 강제되지 않음. seed 가 매번 새 Service 를 추가할 때 LegalService 도 같이 만든다는 약속에만 의존. 누군가 admin UI 에서 Service 를 만들고 LegalService 만 빠뜨리면 동의 cascade (PRD §8.2.1 “`EodinConsentItem.appId` enum 과 1:1 매핑”) 에서 silent broken state.
- **Why not formalize as Prisma relation now (trade-offs)**:
  - Pro: PK = FK 로 묶으면 Service 생성 시 LegalService 없이는 INSERT 자체가 막힘 (실수 방지).
  - Con: Tier 1 `LegalService(id='eodin')` 은 Service 가 없는 “virtual” 레코드 — 양방향 1:1 FK 강제는 불가능 (Tier 1 깨짐).
  - 절충: `LegalService.serviceId` 를 별도 nullable FK 로 두고 `@@unique([serviceId])` — Service 와 1:1 보장하되 Tier 1 은 `serviceId=NULL` 로 표현. PRD 도 §8.2.1 에서 “`Service.id == LegalService.serviceId`” 라고 적었으므로 PRD 본문이 이미 이 모델을 가정.
- **Fix**: 현재 PR 에서는 schema 코멘트(13-16)에 다음을 추가하여 "왜 컨벤션-only 인지" 명시 + 후속 PR 로 미루는 것을 권장:
  ```prisma
  // NOTE: 1:1 관계는 Tier 1 'eodin' (Service 없음) 때문에 Prisma relation 으로 강제 불가.
  // 무결성은 seed.ts + admin service-creation 핸들러에서 보장 (별도 트랜잭션 필요).
  // TODO(unified-id Phase 1): LegalService.serviceId nullable FK + @@unique 로 형식화 검토.
  ```
  그리고 `apps/api/src/services/serviceService.ts:46` 의 `createService` 에서 `prisma.$transaction([service.create, legalService.upsert])` 로 atomic 생성 보장.
- **Why HIGH**: PRD §8.2.1 가 동의 cascade 의 기준으로 1:1 을 가정. 깨지면 사용자 동의 누락이 silent 하게 발생.

### H2. 'kidstopia' ↔ 'semag-kidscafe' 명칭 불일치 — PRD/타입 union 과 seed 가 다름

- **File**: `apps/api/prisma/seed.ts:110`, vs `docs/unified-id-and-sdk-v2/PRD.md:197,421` 등 다수
- **What's wrong**: seed 는 production 코드(`~/Github/kidstopia/src/services/analyticsService.ts:33` 의 `appId: 'semag-kidscafe'`) 와 일치하는 `'semag-kidscafe'` 사용. 그러나 PRD §6, §8.2.1, §10 등 전체에서 enum 멤버를 `'kidstopia'` 로 적음. EodinConsentItem.appId / EodinUserApp.appId 가 PRD 대로 구현되면 seed 와 불일치.
- **Verified**: kidstopia repo 의 `analyticsService.ts:33` 실제로 `appId: 'semag-kidscafe'` (확인 완료). 즉 seed 가 옳고 PRD 텍스트가 stale.
- **Fix**:
  1. seed 는 그대로 두고, **PRD §6, §8.2.1, §10, §13 의 모든 `'kidstopia'` 식별자 사용 부분을 `'semag-kidscafe'` 로 일괄 정정** (서술 텍스트는 “kidstopia(=semag-kidscafe)” 로 유지 가능하나 enum 리터럴/타입 union 은 통일 필수).
  2. CHECKLIST 에 “Phase 1.0 식별자 통일 — `kidstopia` → `semag-kidscafe`” 항목 추가.
  3. seed.ts:109 의 코멘트에 “PRD 본문은 `kidstopia` 라고 부르지만 production code 의 `appId` 는 `semag-kidscafe` — 후자가 source of truth” 추가.
- **Why HIGH**: enum/리터럴 mismatch 는 컴파일러가 잡을 수 없는 곳에서 (Firestore Rules, RLS, Custom Claims 매칭) silent 401/403 을 만들기 쉬움.

### H3. seed.ts `update: {}` 가 “신규 필드(`serviceType`/`legalEntity`/`webUrl`) 미전파” 를 의미 — 기존 prod 3개 row 는 `default` 에 의존

- **File**: `apps/api/prisma/seed.ts:9-55, 132-138`
- **What's wrong**: `upsert + update: {}` 는 의도적으로 안전하지만, 파급 효과 분석 필요:
  - 기존 3개 (shopping/food/video) → 이미 `services` 에 row 존재, `update: {}` 로 무변경. `service_type` 은 migration `DEFAULT 'mobile'` 로 자동 채워짐 (✓ 의도와 일치).
  - 신규 6개 (fridgify/plori/tempy/arden/semag-kidscafe/linkgo) 중 *일부가 prod 에 이미 다른 필드 값으로 존재* 하면? 예: 누군가 admin UI 로 `fridgify` 를 이미 만들어 `iosStoreUrl` 을 설정했다면, seed 는 기존 row 보존 — 신규 `webUrl: 'https://fridgify.eodin.app'` 은 적용 *안 됨*. PRD §8.2.1 의 service catalog 통합 목적이 부분 달성.
- **Fix**: 둘 중 선택:
  - (A) prod 가 이미 fridgify 등을 갖고 있다면 admin UI 에서 webUrl/serviceType 수동 입력 — CHECKLIST 에 명시.
  - (B) seed 에 `update: { webUrl: svc.webUrl, serviceType: svc.serviceType, legalEntity: svc.legalEntity }` 만 좁게 추가. 다른 admin-편집 가능 필드(`iosStoreUrl`, `pathMappings` 등) 는 절대 update 하지 않음 — 새 v2 카탈로그 필드만 backfill.
- **Why HIGH**: 사용자의 memory(“No direct writes to prod DB”) 를 정직하게 반영하면 (B) 가 안전함. update 범위를 좁히면 멱등성 + backfill 둘 다 달성.

---

## MEDIUM

### M1. Migration 이 단일 트랜잭션 / 단일 ALTER 가 아님 — Prisma 가 만들면 한 줄로 합쳐짐

- **File**: `apps/api/prisma/migrations/20260502070000_add_service_type_and_legal_entity/migration.sql:11-14`
- **What's wrong**: 4 개의 분리된 `ALTER TABLE "services"` 문. Prisma 가 `migrate dev` 로 만들면:
  ```sql
  ALTER TABLE "services" ADD COLUMN "legal_entity" VARCHAR(50) NOT NULL DEFAULT 'eodin',
  ADD COLUMN "service_type" "ServiceType" NOT NULL DEFAULT 'mobile',
  ADD COLUMN "web_url" TEXT,
  ALTER COLUMN "scheme" DROP NOT NULL;
  ```
  단일 statement. 의미적으로는 동일하나, 향후 누가 `prisma migrate diff` 로 재생성 시 diff drift 가 보고됨 (마이그 hash 자체는 다르지 않지만 누군가 “정렬” 차이로 의심).
- **Fix**: 내용을 위 스타일로 합칠 것. 동작 동등.

### M2. Migration 에 트랜잭션 / 가드 없음 — 부분 적용 위험

- **File**: `apps/api/prisma/migrations/20260502070000_add_service_type_and_legal_entity/migration.sql`
- **What's wrong**: PostgreSQL DDL 은 기본 implicit transaction 안에서 실행되지만, Prisma migrate 가 한 마이그 안의 여러 statement 를 어떻게 묶는지는 보장 명시 없음 (실제로는 묶음). Defensive 하게 `IF NOT EXISTS` 를 쓰면 partial state 복구 시 재실행 안전.
- **Fix**: 선택사항. Prisma 컨벤션은 IF NOT EXISTS 안 씀 (마이그 이력으로 idempotency 보장) — 기존 migration 들 도 안 씀. 일관성 위해 그대로 두는 것 권장. 단 *이미 prod 에 partial state* (예: 누군가 hand-fix 로 `legal_entity` 만 넣어둠) 가능성이 0% 가 아니라면 Phase 0.9 배포 직전 prod schema dump 한 번 떠서 확인 필요.

### M3. `webUrl` 이 path/legal mapping 기반 검증 없이 free-form `String?` `@db.Text`

- **File**: `apps/api/prisma/schema.prisma:32`
- **What's wrong**: seed 는 `https://...` 만 넣지만, admin UI 가 생기면 사용자 입력. URL validation 부재 시 javascript: scheme 등 주입 가능 (deep link 페이지에서 redirect 기준으로 쓰이면 open redirect).
- **Fix**: `serviceService.ts` Zod schema (line 17-41) 에 `webUrl: z.string().url().optional().or(z.literal(''))` 추가. 사용처에서는 protocol allowlist (`https:` only) 검증.

### M4. `ServiceType` enum 의 'mixed' 가 routing/consent 결정에 어떻게 쓰일지 미정의

- **File**: `apps/api/prisma/schema.prisma:61-65`
- **What's wrong**: `mixed` (semag-kidscafe) 가 들어왔지만, 실제 사용 시점에서 “mobile + web 둘 다 라우팅 한다”인지 “mobile 우선이되 fallback 으로 web 가능”인지 행동 정의 없음. PRD §8.2.1 가드 “`serviceType != 'web'` 만 라우팅” 적용 시 mixed 는 라우팅 ON 으로 분기 — 이건 ok. 하지만 consent 측면에서 web-only 사용자(semag.app) 와 native 사용자가 동일 LegalService 를 공유하므로 동의 UX 가 약간 달라야 함 (Capacitor 내부 webview 와 Vercel public web 구분).
- **Fix**: 본 PR 에서는 enum 값만 두고, `mixed` 의 정확한 semantics 를 PRD §8.2.1 또는 Phase 1 CHECKLIST 에 1줄 정의 추가:
  > `mixed`: deferred deeplink routing ON (mobile path), 동의 cascade 시 web/native 양쪽에서 동일 Tier 2 약관 사용. SDK web fallback 은 `webUrl` 로.

---

## NITS

### N1. `[`apps/api/prisma/schema.prisma:14`] 코멘트가 PRD 와 미세하게 다름

- PRD §8.2.1 line 441: “`Service.id == LegalService.serviceId`” (`.serviceId`)
- Schema 코멘트: “`Service.id == LegalService.id`” (`.id`)
- 둘 중 schema 가 옳음 (실제 모델에 `serviceId` 필드 없음). PRD 본문을 schema 표현에 맞춰 정정 필요 (또는 H1 에서 제안한 `serviceId` 필드 도입). 둘 중 하나로 통일.

### N2. seed.ts:124-127 — `scheme: null, iosStoreUrl: null, androidStoreUrl: null` 가 명시적

- 가독성 좋음. 단 Prisma 는 `undefined` 와 `null` 을 다르게 취급 — 현재 `null` 은 “명시적으로 null 저장” 의도. ✓ 의도와 일치. Comment 에 “명시적 null = web-only 마킹” 한 줄 추가 권장.

### N3. seed.ts 의 production 등록부와 기존 test 등록부가 한 함수 안에 섞여 있음

- 향후 production seed 와 test seed 를 분리할 가능성 있음 (`seed.production.ts` / `seed.test.ts`). 지금은 OK 이나 Phase 1 에 분리 검토 항목 추가 권장.

### N4. `legalEntity: 'eodin'` 이 magic string

- `apps/api/prisma/schema.prisma:47` 의 default + seed 6 곳에서 반복. `const DEFAULT_LEGAL_ENTITY = 'eodin'` 로 추출하거나 `LegalEntity` enum (현재 사업자 1개뿐이라 over-engineering 일 수 있음). 사업자가 늘어날 가능성이 거의 없으면 nit 레벨 그대로 OK.

---

## Migration SQL 동등성 검증

`prisma migrate diff` 결과 (base = pre-Phase-0.9 schema, target = current schema):
```sql
ALTER TABLE "services" ADD COLUMN "legal_entity" VARCHAR(50) NOT NULL DEFAULT 'eodin',
ADD COLUMN "service_type" "ServiceType" NOT NULL DEFAULT 'mobile',
ADD COLUMN "web_url" TEXT,
ALTER COLUMN "scheme" DROP NOT NULL;
```

Hand-written migration 의 4 개 분리된 statement 는 위와 의미적으로 100% 동등 (PostgreSQL DDL 은 같은 마이그 트랜잭션 안에서 실행, 컬럼 default 평가 시점/순서 동일). `CREATE TYPE "ServiceType"` 도 동일. **Hand-written migration 은 SQL 레벨에서 안전.**

데이터-loss 위험: 0 (모두 widening — NOT NULL → nullable, 신규 컬럼 only).
제약 위반 위험: 0 (DEFAULT 가 NOT NULL backfill).
재실행 위험: prisma migrate 는 _migrations 테이블로 멱등 — 동일 hash 로 한번만 적용.

---

## Verdict

**Approve with fixes** — C1 은 머지 *전* 에 반드시 수정 (apps/web 라우터 가드 + Service 타입 정정). H1/H2/H3 는 동일 PR 또는 즉시 follow-up PR. M/N 은 Phase 1 진입 전까지 정리.

배포 순서 권장:
1. apps/web 라우터/타입 가드 추가 (C1) → build/test 통과
2. PRD `kidstopia` → `semag-kidscafe` 정정 (H2)
3. seed `update: {}` → `update: { webUrl, serviceType, legalEntity }` (H3)
4. migration apply + seed 실행
5. (별도 PR) LegalService 1:1 형식화 검토 (H1)
