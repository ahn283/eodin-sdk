# CHECKLIST: 딥링크 / 디퍼드 딥링크 신뢰성 정비

PRD 참고: `./PRD.md` (2026-05-30)

본 CHECKLIST 는 **forward 딥링크 신뢰성 복구 + deferred 딥링크 결정론 재설계** 범위. 결함 ID(F-1~F-9)는 PRD §3 과 1:1 대응.

> 레포: **eodin**(`apps/web`·`apps/api`·`prisma`) + **eodin-sdk**(`packages/*`). 경로 접두사로 레포 구분.

---

## 진행 상태 (Last update: 2026-05-30)

| Phase | 상태 | 비고 |
|---|---|---|
| Phase 0 (조사) | ✅ 완료 | forward + deferred 전 경로 점검, 베스트 프랙티스 대비 (PRD §3·§4) |
| Phase 1 (Forward 긴급 패치) | ✅ 코드/리뷰/테스트 완료 (실기기 검증 대기) | F-1/F-2 — 빌드·디자인·코드·로깅·단위테스트 게이트 통과. branch `fix/deeplink-forward-redirect` |
| Phase 1.5 (랜딩 디자인 정합성) | ✅ 코드/리뷰/테스트 완료 (실기기 검증 대기) | H-1 대비 가드 / H-2 스피너 통합 / H-3 in-app 문구 / M·L. i18n 은 1.6 이관 |
| Phase 1.6 (랜딩 i18n) | ✅ 코어 완료 (실기기·배포검증 대기) | 13 locale 카탈로그 + Accept-Language 해석 + 동적 lang/dir. feedback/legal 은 1.6.4 후속 |
| Phase 2 (Deferred 계약 통일) | ⬜ 대기 | F-4 / F-5 / F-6 — 응답 스키마·요청 계약 단일화 |
| Phase 3 (Deferred Android 결정론) | ⬜ 대기 | F-3 — Play Install Referrer |
| Phase 4 (Deferred iOS 서버 확률) | ⬜ 대기 | F-3 / F-7 / F-8 — 서버사이드 fuzzy 매칭 |
| Phase 5 (Graceful 실패 + 정리) | ⬜ 대기 | F-9 + dead code 제거 |
| Phase 6 (검증 / 5앱 회귀) | ⬜ 대기 | 4채널 + fridgify/plori/tempy/arden/kidstopia |

심각도: **P0** 기능 비동작 / **P1** 신뢰성 결함 / **P2** 정확도·정합성·운영

---

## Phase 0: 조사 ✅ 완료

- [x] Forward 경로 점검 — `DeepLinkRedirect.tsx`, `platform.ts`, `[...path]/page.tsx`
- [x] Deferred 백엔드 점검 — `deferredParamsService.ts` (저장/조회/매칭)
- [x] 4채널 SDK 회수 로직 점검 — Flutter / Android / iOS (+ Capacitor 확인 대기)
- [x] fingerprint 저장/조회 알고리즘 대조 → **완전 불일치 확인 (F-3)**
- [x] 응답 스키마 vs SDK 파싱 대조 → **필드명 불일치 확인 (F-4)**
- [x] 베스트 프랙티스 웹 리서치 → 대비표 (PRD §4)
- [x] plori prod 설정 확인 (admin: `androidPackageName=app.eodin.plori` 등록됨 — 최초 가설 정정)
- [x] design-review (라이브 랜딩 vs `design/` 레퍼런스) → `docs/design-reviews/review-2026-05-03-deeplink-landing.md`. C-1/C-2 가 F-2/F-1 확정, H/M/L 격차는 Phase 1.5 로 분리

---

## Phase 1: Forward 긴급 패치 (P1) — `eodin/apps/web`

> 목표: 어떤 조건에서도 스피너에 갇히지 않는다.

### 1.1 redirect 를 분석 호출과 분리 (F-1 = design-review C-2) ✅
- [x] `DeepLinkRedirect.tsx` `logClickEvent()` `await` 제거 (fire-and-forget)
- [x] `saveDeferredParams()` `await` 제거 + `keepalive: true` (navigation 생존) — handleOpenApp 패턴과 일치
- [x] `api.ts` 두 fetch 에 `AbortController` timeout(1500ms) + `keepalive` 백업 (code-review MEDIUM-1)

### 1.2 intent 분기 안전 타이머 (F-2 = design-review C-1) ✅
- [x] intent 분기에 redirect 후 2000ms 타이머 추가
- [x] 타이머 콜백: `!didAppOpen() && !document.hidden` → `setIsRedirecting(false)` + `setShowFallback(true)` (intent/legacy `visibilitychange` 가드 통일 — code-review MEDIUM-2/LOW-1)
- [x] useEffect cleanup 추가 (timers 일괄 `clearTimeout` + 리스너 해제 — design/code-review LOW)
- [ ] 사용자 탭 → 제스처 컨텍스트로 intent/스토어 이동 확인 (**실기기 Android Chrome — 대기**)

### 1.3 검증 (워크플로 게이트)
- [x] 빌드: `next build` + `tsc --noEmit` 통과
- [x] 디자인 리뷰: 통과(조건부) — 스피너 dead-end 해소 확인, 회귀 없음
- [x] 코드 리뷰: senior-code-reviewer 통과 (MEDIUM-1/2·LOW-1 모두 반영)
- [x] 로깅 점검: click wire 계약 무변경·이벤트 손실 위험 무시가능 (PASS)
- [x] 단위 테스트: `api-transport.test.ts` 4건 (keepalive / signal / fire-and-forget / abort) — 전체 34 통과
- [x] API hang/지연: abort(1500ms) 단위테스트로 커버
- [ ] **실기기 수동 검증 대기**: Android Chrome 미설치(스피너 정지 0) · iOS Safari · 데스크탑 web 3종 캡처

---

## Phase 1.5: 랜딩 디자인 정합성 (P1/P2) — `eodin/apps/web`

> design-review 격차. 전체 리뷰: `docs/design-reviews/review-2026-05-03-deeplink-landing.md`.
> 점수: Deeplink-Flow **D** · Branding **B** · Mobile **B** · A11y/i18n **C**. 레퍼런스: `design/src/app/components/DeepLinkPage.tsx` + `design/system/*.png`.
> ※ CRITICAL C-1/C-2 는 Phase 1 (§1.2/§1.1) 에서 처리 — 여기서는 중복 제외.

> **상태**: ✅ 코드/리뷰/테스트 완료 (실기기 검증 1.5.6 대기). 워크플로 게이트(빌드/디자인리뷰 A-/코드리뷰 A-/단위테스트) 통과. 로깅 점검 = N/A(분석 변경 없음).

### 1.5.1 (HIGH) per-service `primaryColor` 대비 가드 (H-1) ✅
- [x] `utils/color.ts` `getReadableTextColor` (WCAG 상대휘도) 추출 + 단위 테스트 6건
- [x] 아바타/CTA/QR배지 전경색 동적화 (`onPrimaryColor`/`onGradientColor`), 하드코딩 `text-white` 제거 → AA

### 1.5.2 (HIGH) 스피너를 메인 레이아웃에 통합 (H-2) ✅
- [x] 로딩 상태를 메인 아이콘 디자인 언어로 통합 (`w-24 rounded-[22px]` + `to-[#FFF0E0]` + border), `w-20 rounded-2xl` 폐기

### 1.5.3 (HIGH) in-app 안내 문구 ↔ 동작 정합 (H-3) ✅
- [x] 문구를 동작과 정합: "Copy the link and open it in your browser"

### 1.5.4 (MEDIUM) 대비·이미지 폴백 ✅ (i18n 제외 → Phase 1.6)
- [x] caption `text-gray-400` → `text-gray-500` (2곳)
- [x] `<img>` onError 폴백: 로고→이니셜(`logoError`/`hasLogo`), QR→텍스트(`qrError`) + 고정 치수(`width`/`height`) + 서비스 변경 시 리셋 effect (code-review MEDIUM-1)
- [x] CTA/다운로드 버튼 `focus-visible:ring`
- [→] 영어 전용 문자열 i18n → **Phase 1.6 으로 이관**

### 1.5.5 (LOW) 브랜딩/스크롤 폴리시 ✅
- [x] 아이콘 배경 `to-gray-50` → `to-[#FFF0E0]`
- [x] `min-h-screen` → `min-h-dvh`
- [→] body `bg-gray-50` vs 컨테이너 `bg-white` (L-2) — 영향 경미, 1.5.6 렌더 확인으로 판단 (현 미변경)

### 1.5.6 렌더 확인 (스크린샷 필요)
- [ ] H-2(스피너 체감) / L-2(스크롤 하단) / QR 초기 페인트(design LOW-1) — Android Chrome 미설치 · iOS Safari · 데스크탑 web 3종 캡처로 확정

---

## Phase 1.6: 랜딩 i18n (P2) — `eodin/apps/web`

> **결정 (2026-05-30)**: ① 단일 공통 카탈로그를 **eodin 이 보유** (`apps/web/src/messages/{locale}.json`) — 서비스별로 안 바뀌는 공통 문구. ② locale = **5앱 합집합**.
> **점검 결과**: 랜딩 문구는 서비스 공통(✅ 단일 카탈로그 적합) 이나 앱 ARB 에는 거의 없음(overlap ~0, tempy `copyLink` 1건만 일치) → **신규 작성**. plori/tempy 만 localize, fridgify·kidstopia·arden 은 영어 전용 → en 만 기여.
> **locale 합집합 (13)**: `ar de en es fr hi it ja ko pt ru vi zh` — en fallback, **ar = RTL** `dir`. (plori 고유 ar·it / tempy 고유 hi·vi)
> **번역 소스 (결정 2026-05-30)**: Claude 가 13 locale MT 초안 작성 + 각 비-en 키에 검수 플래그(`// TODO: native review`). 표준 스토어 문구("Download on the App Store" 등)는 Apple/Google 공식 로컬라이즈 차용.

> **상태**: ✅ 코어(딥링크 랜딩 + 404/expired) 완료. feedback/legal 은 1.6.4 후속. 워크플로 게이트(빌드/tsc/디자인리뷰/코드리뷰/단위테스트 47) 통과. 로깅 점검 = N/A.

### 1.6.1 인프라 ✅
- [x] `apps/web/src/messages/{locale}.json` 13개 + `utils/i18n.ts`(`getDictionary`/`getMessages`/`resolveLocale`/`isRtl`) + `messages/README.md`
- [x] `Accept-Language` 해석기 (q-value 정렬 + 강건 파싱, en fallback) — **URL prefix 안 씀**
- [x] `layout.tsx` `<html lang/dir>` 동적화 (`ko` 하드코딩 버그 수정, ar=RTL)
- [x] `getDictionary` 를 `Record<Locale, Messages>` 타입주석으로 키 누락 빌드검사 (code-review M2: `as` 캐스트 제거)

### 1.6.2 문자열 추출 + 번역 ✅ (코어)
- [x] 키 추출 ~20개: `DeepLinkRedirect.tsx` + `404`/`expired`
- [x] 13 locale MT 초안 + `_meta` 검수 플래그 + 스토어 문구 공식 로컬라이즈 차용
- [x] 컴포넌트/페이지 배선 — 서버에서 `messages.deeplink` 주입 (client 번들에 JSON 미포함, type-only import)

### 1.6.3 검증 ✅(코드) / 대기(실기기·배포)
- [x] 워크플로 게이트: 빌드/tsc clean · 디자인리뷰(A-) · 코드리뷰(PASS) · 단위테스트 `i18n.test.ts` 9건
- [x] 리뷰 반영: resolveLocale 강건화(M1) · RTL 상태점 논리속성(design M1) · 404/expired 브랜드 오렌지(design M3) · interpolate dead code 제거
- [ ] **실기기**: locale별 렌더 + RTL(ar) + 360dp 최장번역(de/fr) CTA 한 줄 (design L3)
- [ ] **배포 검증 (design M2)**: Accept-Language SSR 의 CDN 캐시 `Vary: Accept-Language` — 언어 오노출 방지 (현재 pages dynamic·standalone SSR 이라 Next 자체 캐시는 없음, 앞단 CDN 설정 확인)

### 1.6.4 후속 (분리)
- [ ] `feedback/[service]/[formId]` (632줄 폼) + `legal/[service]/[type]` i18n + "Powered by Eodin" — 별도 작업

---

## Phase 2: Deferred 계약 통일 (P0) — `eodin/apps/api` + `eodin-sdk/packages/*`

> 목표: 요청/응답 스키마를 4채널 + 백엔드 단일 계약으로. (F-4 / F-5 / F-6)

### 2.1 응답 스키마 단일화 (F-4)
- [ ] 계약 확정: `{ found: bool, service, deeplinkPath, resourceId, metadata }`
- [ ] `deferredParamsService.ts:115` 응답을 계약에 맞게 수정 (`path`→`deeplinkPath`, `params`→`metadata`)
- [ ] Flutter `eodin_deeplink.dart:128` — `json['data']` 의존 제거, 계약 필드 직접 파싱
- [ ] Android `EodinDeeplink.kt:114,207` — 계약 필드 확인
- [ ] iOS `EodinDeeplink.swift:155` — 계약 필드 확인
- [ ] Capacitor 동일 정렬

### 2.2 요청 계약 + service 스코핑 (F-6)
- [ ] `GET /deferred-params` 매칭 조건에 `service` 포함 (cross-service 오염 차단)
- [ ] 4채널 모두 `service` 쿼리 전송 통일 (현재 Flutter 만 전송)

### 2.3 fingerprint 공식 정리 (F-5)
- [ ] Phase 3/4 결정에 따라 클라 fingerprint 공식 제거 또는 단일화 — 4채널 동일

---

## Phase 3: Deferred Android 결정론 — Play Install Referrer (P0)

> F-3 핵심. Play 설치는 결정론, 그 외는 Phase 4 로 fallback.

### 3.1 링크 생성 측 (eodin)
- [ ] 스토어 URL/referrer 에 click 토큰(`clickId`/`linkId`) 주입 설계
- [ ] click 레코드에 토큰 저장 (조회 시 1:1 매칭용)

### 3.2 SDK 회수 (eodin-sdk)
- [ ] `com.android.installreferrer` 의존성 추가 (Android / Flutter plugin / Capacitor)
- [ ] `InstallReferrerClient` 로 referrer 회수 → 토큰 추출
- [ ] `GET /deferred-params` 에 `installReferrer`/토큰 전달, 결정론 매칭
- [ ] referrer 없음(OEM 스토어) → Phase 4 확률 매칭 fallback

### 3.3 백엔드
- [ ] 토큰 기반 결정론 lookup 추가 (`deferredParamsService`)
- [ ] fingerprint 완전일치 경로 제거(또는 fallback 으로 격하)

---

## Phase 4: Deferred iOS 서버 확률 매칭 (P0/P2)

> F-3 / F-7 / F-8. 클라 토큰 폐기, 서버가 신호로 fuzzy 매칭.

- [ ] click 시점 서버 저장: IP + UA + Accept-Language + timestamp (`generateFingerprint:31` 재활용, F-8 dead code 정상화)
- [ ] 설치 후 조회 시 서버가 동일 신호로 best-match
- [ ] **매칭 윈도우 ≤5분~1h** + 신호 유사도 가중치 (F-7) — 24h/최신순 폐기
- [ ] 만료/claimed 정리 정책 재정의
- [ ] 오매칭(공용 IP) 방어 테스트

---

## Phase 5: Graceful 실패 + 정리 (P2)

- [ ] (F-9) 매칭 실패(404) 시 앱이 홈/온보딩으로 graceful 진입하도록 SDK 가이드/계약 명문화 — 에러 화면 금지
- [ ] (F-8) 미사용 클라 fingerprint 경로 제거 확인
- [ ] integration-guide 에 deferred 채택 패턴 갱신 (4채널)

---

## Phase 6: 검증 / 5앱 회귀

- [ ] 4채널 단위 테스트 (계약 파싱 / 매칭)
- [ ] Android Play 내부 테스트 트랙으로 Install Referrer end-to-end (클릭→설치→회수)
- [ ] iOS TestFlight 확률 매칭 end-to-end
- [ ] 5개 앱(fridgify/plori/tempy/arden/kidstopia) deferred 회수 회귀
- [ ] SemVer/CHANGELOG (breaking — deferred 계약 변경)
- [ ] senior-code-review (4채널 parity + public surface)

---

## 메모 / 의사결정 대기

- [ ] Phase 1 을 deferred 재설계보다 먼저 단독 릴리스할지(권장) 결정
- [ ] iOS clipboard 결정론 매칭 도입 여부(프라이버시) — 현재 비목표
- [ ] Play Install Referrer 토큰 길이 제한 / referrer 포맷 확정
- [ ] plori seed(`eodin/apps/api/prisma/seed.ts:78`)에 `androidPackageName` 누락 — prod 는 admin 입력값 존재. dev seed 보강 여부
- [ ] (logging-agent 발견, Phase 1 외) `ClickEvent` 가 `clickId`/`clickIdType` 미수용 — web 은 보내지만 `clickEventSchema`(`deferredParamsService.ts:16`)가 silently strip, Prisma `ClickEvent` 모델에 컬럼 없음. web 랜딩 click 단위 광고 어트리뷰션 누락. 별도 티켓 (CAPI 경로는 `AnalyticsEvent`라 무영향)
</content>
