# 미해결 오픈 이슈 (Phase 0.8)

**작성일:** 2026-05-02
**재정리:** 2026-05-02 — Auth 트랙 분리에 따라 항목별 트랙 명시
**참조:** PRD §11 (재정리 후 SDK 화 한정), Phase 0.1-0.7 후속 결정 사항

각 항목에 **[SDK 화]** / **[Auth 트랙]** 표시. Auth 트랙 항목은 본 SDK 화 프로젝트에서 결정 / 처리 안 함.

---

## 1. 제품 / 비즈니스 결정 (PM) — 모두 [Auth 트랙]

### 1.1 통합 멤버십 / 구독 상품 출시 의향 [Auth 트랙]
- **현재**: PRD §5 Non-Goals 에 "통합 멤버십/구독 상품 출시 (인프라만 구축)" 로 제외
- **결정 필요**: 6개월 / 12개월 후 통합 멤버십 출시 계획 있는지
- **영향**:
  - 출시 안 함 → §7.2 EodinUser 의 `apps[].visibility` 기본 `scoped` 유지, 통합 프로필 노출 X
  - 출시 함 → token scoping 정책 변경 필요 (cross-app entitlement 검증), `EodinUserApp.visibility` 기본 `cross_app` 변경 검토, RevenueCat entitlement 통합 설계 추가
- **결정자**: PM
- **기한**: Phase 1 시작 전 (Non-Goal 그대로 가도 무관, 단 출시 의향 있으면 §7.2 모델 미리 반영)

### 1.2 14세 미만 사용자 처리 [Auth 트랙]
- **현재**: PRD §10.4 "1차 스코프 제외, 후속 PRD" — 통합 약관에 "만 14세 이상만 가입 가능" 조항 명시로 임시 대응
- **결정 필요**: 후속 PRD 시작 시점 — kidstopia minor 사용자 PIPA 리스크 누적
- **영향**: 후속 PRD 가 늦어지면 kidstopia 의 minor 사용자 처리 위반 위험. 법무팀 의견 필요
- **결정자**: PM + 법무
- **기한**: Phase 8 (재동의 캠페인) 시작 전

### 1.3 kidstopia RevenueCat anonymous → identified 전환 [Auth 트랙]
- **현재**: anonymous mode (`Purchases.configure` 만, `logIn` 없음) — Phase 0.7 발견
- **결정 필요**: v2 에서 `Purchases.logIn(eodinUserId)` 채택 여부
- **권장**: 채택 — cross-device sync 가능, RC SDK 가 anon→identified 자동 alias
- **영향**:
  - 채택 안 함 → 기존 동작 유지, cross-device sync 영원히 불가, 통합 ID 가치 일부 상실
  - 채택 함 → 기존 anonymous entitlement 자동 alias (RC dashboard 검증 필요)
- **결정자**: PM (kidstopia)
- **기한**: Phase 1 시작 전

---

## 2. 운영 / 인프라 결정 (DevOps / Backend)

### 2.1 Identity API SPOF 정책 — fail-open vs fail-closed [Auth 트랙]
- **현재**: PRD §14.3 에 "fail-closed (인증 검증은 무조건 통과시키지 않음). 단 자체 토큰 검증으로 동작하므로 실제 영향 최소" 로 권고. 명시 결정 필요
- **결정 필요**:
  - **fail-closed**: Identity API 다운 시 신규 가입/profile 변경 불가, 기존 사용자도 일부 기능 차단
  - **fail-open**: Identity API 다운 시 토큰 검증만으로 통과 (각 앱 자체 검증 가능 영역만)
- **권장**: fail-closed 기본 + 각 앱 백엔드의 자체 Firebase Admin SDK 검증으로 critical path (결제/데이터 접근) 분리
- **영향**: SLA 정의, 모니터링 알람 정책, multi-region replica 설계
- **결정자**: DevOps + Backend lead
- **기한**: Phase 2 (Identity API 구현) 시작 전

### 2.2 통합 Firebase OAuth client ID 정책 [Auth 트랙]
- **현재**: PRD §12.3 / Phase 0.3 결과 — linkgo 의 기존 `GOOGLE_CLIENT_ID` 를 통합 Firebase 에 재등록하면 무손실
- **결정 필요**:
  - (a) linkgo 기존 client 재사용 → 무손실 (Google sub 동일)
  - (b) 신규 client 발급 → 다음 로그인 시 동의 화면 1회 더, sub 새로 발급
- **권장**: (a) 재사용
- **영향**: linkgo 사용자 마이그 retention 직접 영향 (PRD §15.3 ≥95%)
- **고려사항**: 5개 앱의 기존 Google OAuth client 도 동일 결정 필요 (재사용 vs 신규). Firebase 의 "Authorized OAuth client IDs" 화이트리스트로 다중 client 지원
- **결정자**: DevOps + 법무 (외부 client 재등록 가능성)
- **기한**: Phase 3 (통합 Firebase 신설) 시작 전

### 2.3 kidstopia Firestore → Postgres 마이그 여부 [Auth 트랙]
- **현재**: PRD §5 Non-Goals — 비목표 유지
- **결정 필요**: Phase 1 시작 후 12개월 시점에 재검토 여부 (현재는 sync 만)
- **영향**: 재검토 안 하면 kidstopia 만 NoSQL 로 cross-app 분석 join 비용 지속
- **권장**: 1차 출시 후 6개월 시점에 재검토 안건 등록
- **결정자**: PM
- **기한**: Phase 8 회고 시점

---

## 3. 데이터 / 도메인 결정

### 3.1 linkgo 실제 도메인 — `linkgo.dev` vs `linkgo.kr` [Auth 트랙]
- **현재**: Phase 0.3 발견 — NextAuth cookie domain 이 `.linkgo.dev`, PRD §10.5 / §16 는 `linkgo.kr` 로 명시
- **결정 필요**: Service.webUrl 등록 시 정확한 production 도메인
- **영향**: 약관 페이지 외부 링크, cookie 정책, Service catalog 매핑
- **결정자**: PM (linkgo)
- **기한**: Phase 0.9 (Service catalog 확장) 시작 전

### 3.2 EodinUser displayName / avatar 통합 프로필 정책 [Auth 트랙]
- **현재**: `EodinUserApp.visibility` 기본 `scoped` — 앱별 표시 정보 독립
- **결정 필요**: 1.1 (통합 멤버십) 결정과 연계
- **영향**: 사용자 동의 모달 UI / 통합 프로필 가시성 / privacy collapsing 회피
- **결정자**: PM
- **기한**: Phase 1.4 (EodinAuth `linkApp()` 모달 설계) 시작 전

---

## 4. SDK 마이그 결정 (개발자)

### 4.1 v2 패키지 모듈 구조 — 모놀리식 vs 멀티 패키지 [SDK 화]
- **현재**: PRD M1 — "5개 SDK 모놀리식 단일 패키지 통일 + iOS Package.swift modular 패턴 차용"
- **결정 필요**: Flutter 의 실제 import 경로 — `eodin_sdk` 단일 vs `eodin_analytics`/`eodin_deeplink`/`eodin_auth` 분리
- **권장**: 단일 패키지 + 모듈별 import (`import 'package:eodin_sdk/auth.dart';`)
- **영향**: 5개 앱의 import 변경 작업량, pub.dev 의 패키지 발견성
- **결정자**: SDK 개발자 (당분간 ahn283)
- **기한**: Phase 1.1 시작 시

### 4.2 S7 (static→instance) 도입 여부 [SDK 화]
- **현재**: PRD §1.5 / H2 권고 — multi-init use case 검증 후 보류 가능
- **Phase 0.1 결과**: 5개 앱 모두 multi-init use case **0건** — static 만 사용
- **결정 필요**: v2 에서도 static 유지 vs 인스턴스 패턴 도입
- **권장**: 보류 — gold-plating 회피
- **영향**: 보류 시 마이그 작업 단순화, 도입 시 모든 import 변경 필요
- **결정자**: SDK 개발자
- **기한**: Phase 1.1 시작 시

### 4.3 unified-event-reference v1.1 발행 시점 [SDK 화]
- **현재**: Phase 0.4 발견 — `account_delete` / `daily_limit` / `voice` / `pass` family 추가 필요
- **결정 필요**: Phase 1.6 (EodinEvent enum) 시작 전 vs 동시
- **권장**: 동시 — enum 정의와 reference 동기화
- **결정자**: SDK 개발자 + logging-agent 소유자
- **기한**: Phase 1.6 시작 시
- **상태**: ✅ 완료 (Phase 1.6, 2026-05-02) — reference v1.1 발행 + 4 SDK enum 동시 도입

### 4.4 `subscribe_renew` 5개 앱 채택 추적 (Phase 1.6 코드리뷰 M2) [SDK 화]
- **현재**: `EodinEvent` enum 에 `subscribeRenew` 정의 / reference v1.1 에 `subscribe_renew` 명세 존재. 그러나 5개 앱 중 arden 만 실제 구현 (Phase 0.4 audit §2)
- **결정 필요**: 마이그 시점에 fridgify / plori / tempy / kidstopia 4개 앱이 `subscribe_renew` 발화하도록 추적 — 누락 시 PRD §15.2 cross-app LTV 분석 / Conversion API mapping (`Meta CAPI Subscribe`, `Google subscription_renewal`) 데이터 leakage
- **권장**: Phase 5 각 앱 마이그 PR 의 Definition of Done 에 "subscribe_renew 발화 지점 검증 (RC `EVENT_RENEWED` listener 또는 store renewal callback)" 항목 추가
- **결정자**: 각 앱 owner (마이그 PR 작성자)
- **기한**: Phase 5 (각 앱 v2 마이그 PR) 머지 직전

### 4.6 SDK API endpoint host 화이트리스트 (Phase 1.6 S8 코드리뷰 M1 후속) [SDK 화 — 보류]
- **현재**: `configure()` 의 scheme 검증 (HTTPS only)만 도입. `https://attacker.example.com` 같은 임의 host 도 scheme 만 맞으면 통과
- **결정 필요**: SDK 단에서 host 화이트리스트 (예: `*.eodin.app` suffix match) 강제 도입 여부
- **권장**: 보류 — 호스트 앱이 빌드 시점에 endpoint 를 hardcode 하는 통제 (CI / code review) 가 우선. SDK 단의 host 화이트리스트는 v2.x 또는 v3 시점 별도 phase
- **결정자**: SDK 개발자 + DevOps
- **기한**: Phase 1.10 후 또는 v2.x

### 4.5 Capacitor / iOS / Android GDPR surface 보강 (Phase 1.6 코드리뷰 H1 + Phase 1.9 logging-audit HIGH 후속) [SDK 화] ✅ 완료 (Phase 1.7, 2026-05-03)
- **현재**: Phase 1.6 에서 wrapper 를 `Object.create(_EodinAnalyticsBridge)` 로 구성 — 향후 plugin 메서드 추가 시 prototype-chain 으로 자동 노출되어 silent 누락 회로는 차단됨
- **결정 필요**: Flutter 가 이미 구현한 `setEnabled` / `isEnabled` / `requestDataDeletion` 을 iOS / Android / Capacitor / Web SDK 4채널에도 추가 — Phase 1.1 §3.1 "5개 공통 surface" 정합 완성
- **권장**: Phase 1.7 (테스트 보강) 또는 Phase 1.9 (Capacitor web.ts 동작화) 와 묶어 진행. CHECKLIST §1.6 의 "Analytics SDK unit test (track / identify / queue / offline / **GDPR**)" 항목과도 정합
- **결정자**: SDK 개발자
- **기한**: Phase 1.7 또는 Phase 1.9 시작 시

---

## 5. Phase 0 잔여 작업 (외부 의존)

### 5.1 5개 Firebase 프로젝트 uid 충돌 검증 [Auth 트랙]
- **상태**: ⏸️ 사용자 실행 대기 — **본 SDK 화 PRD 범위 밖**. Auth 트랙 시작 시점에 진행
- **참조**: `firebase-uid-collision-check.md`
- **차단 항목**: Auth 트랙의 사용자 import 단계 dedup 정책

---

## 6. 의사결정 우선순위 / 일정

### 6.1 SDK 화 프로젝트 (본 PRD)

| ID | 결정 | 결정자 | 기한 | 상태 |
|---|---|---|---|---|
| 4.1 | SDK 패키지 구조 | SDK 개발자 | Phase 1.1 | ✅ 완료 (모놀리식 + 모듈별 import) |
| 4.2 | S7 (static→instance) 보류 | SDK 개발자 | Phase 1.1 | ✅ 완료 (보류 확정) |
| 4.3 | event reference v1.1 발행 | SDK 개발자 | Phase 1.6 | ✅ 완료 |
| 4.4 | subscribe_renew 5개 앱 채택 추적 | 각 앱 owner | Phase 5 마이그 | 🟡 진행 예정 |
| 4.5 | Capacitor / iOS / Android GDPR surface 보강 | SDK 개발자 | Phase 1.7 | ✅ 완료 |
| 4.6 | SDK API endpoint host 화이트리스트 | SDK 개발자 + DevOps | v2.x 또는 v3 | ⏸️ 보류 |

### 6.2 Auth 트랙 (별도 프로젝트 — 본 PRD 범위 밖)

| ID | 결정 | 결정자 |
|---|---|---|
| 1.1 | 통합 멤버십 / 구독 상품 출시 의향 | PM |
| 1.2 | 14세 미만 후속 PRD | PM + 법무 |
| 1.3 | kidstopia RevenueCat anonymous → identified | PM |
| 2.1 | Identity API SPOF (fail-open vs fail-closed) | DevOps |
| 2.2 | 통합 Firebase OAuth client ID 정책 | DevOps + 법무 |
| 2.3 | kidstopia Firestore → Postgres 재검토 시점 | PM |
| 3.1 | linkgo 실제 도메인 (`linkgo.dev` vs `linkgo.kr`) | PM |
| 3.2 | EodinUser displayName / avatar visibility 정책 | PM |
| 5.1 | 5개 Firebase 프로젝트 uid 충돌 검증 | 사용자 |
