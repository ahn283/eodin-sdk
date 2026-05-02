# Web SDK 사용처 식별 (Phase 0.10)

**작성일:** 2026-05-02
**참조:** PRD §6 (5개 플랫폼 — `@eodin/web` 포함), §7.3 (Web SDK API surface)
**관련 Phase**: 0.2 (kidstopia web 빌드), 0.3 (linkgo NextAuth)

---

## 1. 결론

`@eodin/web` (npm) 의 1차 출시 (Phase 1) 채택자: **linkgo 1개 확정**. eodin 자체 monorepo 내 admin/landing 은 **현재 미적용 권장**. 향후 신규 web 서비스 출시 시 채택.

| 대상 | 결정 | 이유 |
|---|---|---|
| **linkgo** | ✅ Phase 7 채택 확정 | Phase 0.3 결과 — NextAuth → Firebase + `@eodin/web` 으로 전환 |
| **eodin/apps/admin** | ❌ 1차 미적용 | 단일 admin 사용자 (env BCRYPT) — 통합 ID 가치 낮음. 향후 multi-admin 화 결정 시 재검토 |
| **eodin/apps/landing** | ❌ 1차 미적용 (Analytics 부분) | 마케팅 페이지 — 사용자 가입 흐름 없음. GA4 (`gtag`) 이미 사용 중. EodinAnalytics 도입은 통합 attribution 위해 Phase 1.5 검토 |
| **eodin/apps/web** | ❌ 1차 미적용 | deferred-deeplink 라우터 — 사용자 인증 흐름 없음 |
| **kidstopia 의 web 빌드 (semag.app)** | ⚠️ `@eodin/capacitor` 의 web.ts 가 처리 (Phase 0.2 → N13 Must) | `@eodin/web` 별도 채택 X. capacitor SDK 의 web fallback 으로 동일 기능 제공 |
| **향후 신규 web 서비스** | 🔜 채택 의무 | PRD §4 (4번째 목표) 근거 — 회원/약관 인프라 즉시 사용 |

---

## 2. 조사 근거

### 2.1 eodin/apps/admin (admin.eodin.app)
- **인증 방식**: ENV 기반 username + BCRYPT password hash (`apps/api/src/routes/auth.ts:37`)
- **세션**: JWT in localStorage, 5분 expiry buffer, refresh token 패턴
- **사용자 모델**: 단일 admin (DB 에 User 모델 없음)
- **Web SDK 도입 시 가치**:
  - Pro: 향후 multi-admin 화 / per-admin audit log / EodinAuth 통합 시 자연스러운 채택
  - Con: 현재 1명 — over-engineering. JWT 자체 구현 충분
- **결정**: Phase 1 미적용. multi-admin 결정 (오픈 이슈 §2.3 의 후속 작업) 시 채택 검토

### 2.2 eodin/apps/landing (eodin.app)
- **사용자 가입 흐름**: 없음 (auth 관련 코드 0건)
- **Analytics**: GA4 (`gtag`) 직접 사용 — `apps/landing/lib/analytics.ts`, `app/layout.tsx`
- **EodinAnalytics 도입 시**:
  - landing 은 마케팅 attribution 의 출발점 (광고 클릭 → eodin.app 도착 → 6개 앱 다운로드 깔때기)
  - 현재 GA4 만 사용 → **eodin attribution 시스템에서 보이지 않음**
  - 도입 시 cross-channel attribution 일관성 향상 (PRD §6.3 conversion API 통합)
- **결정**: Phase 1.5 검토 — analytics-only 채택 (auth 모듈 미사용). 비용 낮음

### 2.3 kidstopia 의 web 빌드 (semag.app)
- Phase 0.2 결과 — Vercel 라이브 운영 (Capacitor build:native vs vite build 분기)
- **`@eodin/web` 별도 채택 X** — `@eodin/capacitor` 의 `src/web.ts` 가 web 환경에서 동일 API surface 제공
- 단 현재 web.ts 는 모든 메서드가 `unavailable()` throw → Phase 1.9 (N13 Must 격상) 에서 web 구현 추가 필요
- 결과: kidstopia 는 native + web 모두에서 동일하게 `@eodin/capacitor` import (별도 web SDK 없이 동작)

### 2.4 linkgo (linkgo.dev)
- Phase 0.3 결과 — 100% Google OAuth, NextAuth + PrismaAdapter
- Phase 7 (linkgo NextAuth → Firebase Auth + Web SDK) 에서 채택 확정
- API surface (PRD §7.3): `EodinAuth.signIn`, `signInWithGoogle`, `linkApp`, `acceptTerms`, `leaveApp`, `deleteAccount`
- SSR 환경 (Next.js Server Components) 위해 `@eodin/web/server` 별도 export 필요

---

## 3. `@eodin/web` 패키지 설계 영향

Phase 1.4 (EodinAuth 모듈 신설) 의 Web SDK 요구사항을 1차 사용자 (linkgo) 기준으로 정의:

| 모듈 | 1차 요구 | 후속 |
|---|---|---|
| **EodinAuth** | signIn / signInWithGoogle / signOut / currentUser / idToken / linkApp / acceptTerms / leaveApp / deleteAccount | landing 채택 시 미필요 |
| **EodinAnalytics** | track / identify / clearIdentity / flush | landing 채택 시 핵심 (page_view, conversion 추적) |
| **EodinDeeplink** | 미포함 (PRD §6.1 명시) | - |
| **`@eodin/web/server` subpath** | Next.js SSR 인증 검증 (Firebase Admin SDK) | - |

### 3.1 SSR 환경 고려 (linkgo 영향)
- Next.js App Router 의 server components / route handlers 에서 EodinAuth 사용 시:
  - Firebase Auth web SDK (`firebase/auth`) 는 client-only — server 에서 사용 불가
  - 별도 export `@eodin/web/server` 가 Firebase Admin SDK 활용
  - `getServerSession` 대체로 `EodinAuth.getServerUser(req)` 등 helper 제공 권장

### 3.2 SDK shape 통일 — Mobile SDK 와의 동질성
- PRD §7.3 의 "Mobile SDK 와 동일 API surface" 원칙
- TypeScript 타입은 mobile SDK 의 Dart/Swift/Kotlin 인터페이스와 의미적 호환 유지
- 이벤트 enum (Phase 1.6 EodinEvent) 는 5개 플랫폼 공유 — `@eodin/web` 도 동일 enum 노출

---

## 4. 위험 / 후속 작업

| ID | 항목 | 우선순위 |
|---|---|---|
| W1 | landing 의 EodinAnalytics 도입 — attribution 깔때기 일관성 (광고 → landing → 앱) | Phase 1.5 검토 |
| W2 | admin 다중 사용자화 결정 (오픈 이슈 §2.3) — 채택 시 EodinAuth 적용 | Phase 1 후 |
| W3 | `@eodin/web` 패키지의 SSR 지원 패턴 (Next.js App Router) — getServerSession 대체 helper 설계 | Phase 1.4 |
| W4 | `@eodin/web` 와 `@eodin/capacitor` web.ts 간 코드 중복 — 공통 코어 추출 가능성 | Phase 1.1 (M1) |

---

## 5. 결론 — Phase 1 입력

`@eodin/web` Phase 1 의 출시 대상은 **linkgo 1개**. PRD §6 의 "5채널 동시 publish" 는 그대로 유지하되, 사용처 측면에서는 1차 출시 후 점진 확대.

- **즉시 출시 필수 모듈**: EodinAuth (full surface) + EodinAnalytics (track / identify)
- **출시 후 검토**: landing analytics-only 채택, admin EodinAuth 채택, 신규 web 서비스 채택
