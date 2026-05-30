# CHECKLIST: 딥링크 / 디퍼드 딥링크 신뢰성 정비

PRD 참고: `./PRD.md` (2026-05-30)

본 CHECKLIST 는 **forward 딥링크 신뢰성 복구 + deferred 딥링크 결정론 재설계** 범위. 결함 ID(F-1~F-9)는 PRD §3 과 1:1 대응.

> 레포: **eodin**(`apps/web`·`apps/api`·`prisma`) + **eodin-sdk**(`packages/*`). 경로 접두사로 레포 구분.

---

## 진행 상태 (Last update: 2026-05-31)

| Phase | 상태 | 비고 |
|---|---|---|
| Phase 0 (조사) | ✅ 완료 | forward + deferred 전 경로 점검, 베스트 프랙티스 대비 (PRD §3·§4) |
| Phase 1 (Forward 긴급 패치) | ✅ **머지·배포(live)** — 실기기 QA만 대기 | F-1/F-2. eodin `7a67507` → eodin-web 배포 SUCCESS |
| Phase 1.5 (랜딩 디자인 정합성) | ✅ **머지·배포(live)** — 실기기 QA만 대기 | H-1/H-2/H-3 + M·L. i18n 은 1.6 이관 |
| Phase 1.6 (랜딩 i18n) | ✅ **머지·배포(live)** — curl 검증(ko/ja lang+문구, 캐시 no-store) 완료 | 13 locale + Accept-Language + 동적 lang/dir. feedback/legal 은 1.6.4 후속 |
| Phase 2 (Deferred 계약 통일) | ✅ 머지 완료 / **백엔드(2a) 배포(live, eodin-api `e7170dc`)** · SDK(2b) 릴리스-prep 대기 | F-4/F-6 additive. ⚠️ 매칭은 Phase 3/4 전까지 0% |
| Phase 3 (Deferred Android 결정론) | 🚧 3.1+3.2 **배포(live)** / 3.3 SDK 코드·리뷰 완료(CI·앱출시 대기) | F-3 — Play Install Referrer. clickId, Flutter 포함 |
| Phase 4 (Deferred iOS 서버 확률) | 🚧 4.1 백엔드 IP매칭 **배포(live)** | F-7/F-8 — clickIp+모호성가드+atomic claim. 기존 iOS SDK로 동작 |
| Phase 5 (Graceful 실패 + 정리) | 🚧 F-9 가이드/계약 + 문서 동기화 **완료** / F-8 dead code(eodin repo) 잔여 | F-9 + dead code 제거 |
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
> **설계 원칙**: 백엔드 **additive 하위호환** + SDK **public surface 불변**(내부 파싱/쿼리만) → 앱은 SDK 버전 bump 만으로 채택, 강제 동시 출시 없음.
> **SCHEMA-CHECK 결과 (로깅 점검)**: 네이티브 3채널(Android/iOS/Capacitor 브릿지)은 **이미 v2 최상위 필드 파싱** → 백엔드 배포만으로 파싱 정상. **Flutter 만** `json['data']` 래퍼라 파싱 깨짐(수정 필수). `service` 쿼리는 **Flutter 만 전송**(나머지 추가 필요).

### 2a. 백엔드 (eodin/apps/api) — ✅ 완료 (코드/리뷰/테스트)
- [x] 통일 v2 응답: canonical `deeplinkPath`/`resourceId`/`metadata` + legacy `path`/`params` **additive** (F-4) — `deferredParamsService.ts`
- [x] `service` 쿼리 매칭 스코핑(F-6, optional 하위호환) + non-string `service` 400 reject
- [x] 단위 테스트 6건(`deferredParamsContract.test.ts`: canonical+legacy / 스코핑 유무 / 빈문자 fallback / 배열 400 / 404) — api 전체 29 통과
- [x] 코드리뷰 PASS(A-) — M1 주석 톤다운(F-6=데이터정합 가드, IDOR 통제 아님), M2 검증 반영
- [x] 배포 완료 — Railway eodin-api `e7170dc` SUCCESS (main 머지 자동배포, live)
- [ ] api CHANGELOG additive 명시 (release-prep)

### 2b. SDK 채널 (eodin-sdk/packages) — ✅ 코드/리뷰 완료 (public surface 불변, SemVer minor)
- [x] **Flutter**: `eodin_deeplink.dart` `json['data']` 래퍼 제거 → 최상위 파싱(`found`/`deeplinkPath`/`path` 가드). `deferred_params_result.dart` `fromJson` = `deeplinkPath ?? path` / `metadata ?? params`. 테스트 mock v2 갱신 → 17 통과
- [x] **iOS / Capacitor-iOS**: configure 가드 `let serviceId` + URL `&service=` (F-6)
- [x] **Android / Capacitor-Android**: URL 2곳(콜백+suspend) `&service=$serviceId`
- [x] **C1 (code-review CRITICAL) 해소**: 네이티브 4파일에 legacy 폴백 추가(`deeplinkPath ?? path`, `metadata ?? params`) — 백엔드 2a 배포 전/캐시 구버전에서도 네이티브 deferred 무동작 방지, Flutter와 대칭
- [x] Capacitor web: no-op 유지(의도된 설계)
- [x] **빌드**: GitHub Actions CI 추가(`.github/workflows/ci.yml`) + **로컬 전채널 검증 통과** — Flutter analyze(clean)+test 40 / iOS xcodebuild(iOS Sim)+XCTest 26 / Capacitor TS build+jest 64 / Android `./gradlew testDebugUnitTest assembleRelease` 45+AAR. (capacitor/android 는 `:capacitor-android` 호스트 프레임워크 의존이라 standalone 빌드 제외 → 호스트앱 CI)

### 2b 후속 (릴리스-prep, code-review 잔여 — release 전 처리)
- [ ] (H2) 4채널 CHANGELOG + 버전 bump(beta.2): "deferred top-level v2 파싱 + legacy 폴백(F-4) / service 쿼리 스코핑(F-6)"
- [ ] (M3) 네이티브 파싱 테스트(XCTest/JUnit) — legacy-shape + v2-shape + service 쿼리 전송 (CI)
- [ ] (H1) Android `$serviceId` non-null 명시(`!!`/local) — 현재 configure 보장이라 latent
- [ ] (M2) Swift `URLComponents` / Kotlin `URLEncoder` 로 service 인코딩 — 슬러그라 latent (또는 configure 슬러그 정규식 검증)
- [ ] (M1) 네이티브 200 응답 `found`/path hit 가드 → Flutter 와 정렬 (현재 backend는 hit=200+path/miss=404라 latent)

### 2c. fingerprint 공식 정리 (F-5) — Phase 3/4 의존
- [ ] Phase 3(Install Referrer)/4(서버매칭) 결정 후 클라 fingerprint 제거/단일화 — 현재 4채널 상이
- [ ] ⚠️ **계약 완료 ≠ 동작**: 파싱/요청은 4채널 정합이나 **fingerprint 미통일로 실제 매칭은 Phase 3/4 전까지 0%**

---

## Phase 3: Deferred Android 결정론 — Play Install Referrer (P0)

> F-3 핵심. **설계 확정: `phase3-design.md`** (D1 서버발급 / D2 `eodin_cid=<token>` / D3 Flutter 포함 / D4 24h 유지 / D5 비-Play 는 Phase 4).
> Play 설치 = 결정론 100%, 그 외 = Phase 4 fallback.

### 3.1 백엔드 + DB (eodin) — ✅ 완료 + **배포(live, eodin-api `7070ab1`, 마이그레이션 자동적용 검증)**
- [x] Prisma `DeferredParam.clickId String? @unique` + 수동 마이그레이션(`20260530000000_add_deferred_clickid`)
- [x] `saveDeferredParams`: clickId 저장 + P2002 충돌 idempotent(200) (code-review H1)
- [x] `getDeferredParams`: `installReferrer`/`clickId` 토큰 결정론 조회 우선, deviceFingerprint fallback (additive)
- [x] `parseClickIdFromReferrer`(eodin_cid 추출 + URL 디코드, H2) + 단위테스트 (api 전체 38 통과)
- [x] 코드리뷰 PASS(B) — H1/H2 반영
- [x] **배포 완료** — eodin-api `7070ab1` SUCCESS. start command(`migrate deploy && node`)로 **마이그레이션 자동 적용**, 라이브 검증(installReferrer 조회 404 정상, 500 아님 → click_id 컬럼 존재)

### 3.2 링크 생성 측 (eodin apps/web) — ✅ 완료 + **배포(live, eodin-web `7070ab1`)**
- [x] `page.tsx` 서버에서 `crypto.randomUUID()` clickId 발급 → prop 전달 (D1)
- [x] `utils/referrer.ts` `withPlayReferrer`: Android Play URL 에 `referrer=eodin_cid=<clickId>` (기존 referrer 머지, M3) + 단위테스트(라운드트립·intent 이중인코딩)
- [x] 4개 Android 스토어 진입점(intent fallback / legacy / handleDownload / handleOpenApp) 일관 적용, iOS 미부착
- [x] `saveDeferredParams` 에 clickId 포함 → row 저장
- [x] 코드리뷰 PASS(B) — M3 머지 / L2 테스트 / M1·I1 신뢰경계 문서화 반영

### 3.3 SDK 회수 (eodin-sdk) — ✅ 코드/리뷰 완료 · **Android 빌드 CI·앱 출시 대기**
- [x] `com.android.installreferrer:installreferrer:2.2` — sdk-android + capacitor-android (`InstallReferrerReader.kt`, CountDownLatch 동기 회수 + 캐시)
- [x] **Flutter**: `android_play_install_referrer` 회수 (`_readInstallReferrer`, Platform.isAndroid 가드) — analyze + 17 테스트 통과
- [x] eodin_cid 있으면 `?service=&installReferrer=` 결정론, 없으면 deviceId fingerprint fallback. public surface 불변(SemVer minor)
- [x] iOS/Capacitor-iOS 미변경(Android 전용, iOS는 Phase 4)
- [x] 코드리뷰 PASS(B) — H1(메인스레드 가드)/H2(캐시 무한재시도)/M1(Uri.Builder 인코딩)/M2/L1/L2 반영. M3(CHANGELOG)·L3(버전)는 release-prep
- [x] **빌드**: CI(`.github/workflows/ci.yml`) + 로컬 검증 통과 — Android `sdk-android` 는 standalone gradle 스캐폴딩(settings/wrapper, AGP 8.2.1/Kotlin 1.9.10/Gradle 8.7) 추가 후 `testDebugUnitTest assembleRelease` 그린(45). capacitor-android 는 호스트앱 CI(별도)
- [ ] **앱 출시**(Phase 4와 묶음) 후 실제 동작

### 3.4 검증
- [ ] 단위(referrer 파싱 / 백엔드 결정론 조회+fallback) + Play 내부 테스트 트랙 E2E (클릭→설치→회수→딥링크)

---

## Phase 4: Deferred iOS 서버 확률 매칭 (P0/P2)

> F-3 / F-7 / F-8. 서버가 IP 신호로 fuzzy 매칭. **백엔드 IP 매칭은 기존 iOS SDK(req.ip 사용)로 동작 → 앱 출시 없이 배포만으로 iOS deferred 베이스라인.**

### 4.1 백엔드 IP 확률매칭 (eodin/apps/api) — ✅ 완료 (코드/리뷰/테스트) · 배포 대기
- [x] click 시 서버 IP 저장: `DeferredParam.clickIp` + 인덱스 + 마이그레이션. `saveDeferredParams` 가 `req.ip`(trust proxy=1) 저장
- [x] `getDeferredParams`: 결정론/정확fingerprint miss 시 `clickIp==req.ip` + service scope + **60분 윈도우** 최신순 확률 fallback. `matchType` 응답
- [x] **오매칭 방어(F-7)**: 공용 IP 모호성 가드 — 후보 ≥2면 미반환(code-review H1). atomic claim(updateMany where claimed:false → 더블 어트리뷰션 방지, H2)
- [x] 단위테스트 +5 (clickIp/IP fallback/모호성/clickId시 미실행/matchType) — api 43 통과. 코드리뷰 PASS(B)
- [x] 배포 완료 — eodin-api `800a99c` SUCCESS, 마이그 자동적용 + 확률경로 404 검증
- [→] (M1) 윈도우 60분 — PRD ≤5분 권장 대비 install 지연 고려한 절충. 추후 튜닝
- [→] F-8 dead code `generateFingerprint` 제거 → Phase 5

### 4.2 (선택, 후속) iOS SDK 신호 보강 — 앱 출시 필요
- [ ] iOS SDK 가 device 신호(OS/locale/screen) 전송 → 서버 가중치 매칭 정확도↑ (IP-only 베이스라인 위 enhancement)

---

## Phase 5: Graceful 실패 + 정리 (P2)

- [x] (F-9) 매칭 실패(404) 시 앱이 홈/온보딩으로 graceful 진입하도록 SDK 가이드/계약 명문화 — 에러 화면 금지. **5채널 README + integration-guide §3 + migration-guide 에 "에러 화면 금지, 일반 홈 graceful 진입" 명문화**. no-match 표면 채널차(Flutter throw / Capacitor native reject·web hasParams:false / iOS·Android noParamsFound) 문서화 (브랜치 `feat/deeplink-allchannel-docs`)
- [ ] (F-8) 미사용 클라 fingerprint 경로 제거 확인 — **eodin repo `generateFingerprint` (apps/api). 본 SDK repo 외**
- [x] integration-guide 에 deferred 채택 패턴 갱신 (4채널) — §3 공통 매칭 메커니즘 표(결정론/best-effort) + ATT 무관 + call-once(서버 atomic claim) 명문화

---

## Phase 6: 검증 / 5앱 회귀

- [x] 4채널 단위 테스트 (계약 파싱 / 매칭) — CI 에서 자동 실행: Flutter 40 / iOS 26 / Capacitor 64 / Android 45 (총 175). ※ 매칭 E2E(설치→회수)는 아래 Play 트랙/TestFlight 항목에서 별도
- [ ] Android Play 내부 테스트 트랙으로 Install Referrer end-to-end (클릭→설치→회수)
- [ ] iOS TestFlight 확률 매칭 end-to-end
- [ ] 5개 앱(fridgify/plori/tempy/arden/kidstopia) deferred 회수 회귀
- [ ] SemVer/CHANGELOG (breaking — deferred 계약 변경)
- [ ] senior-code-review (4채널 parity + public surface)

---

## 문서 동기화 (README / 가이드) — 잊지 말 것

- [x] eodin `README.md`: API endpoint 버그 수정(`link.eodin.app/api/v1` → `api.eodin.app/api/v1`, 코드 예제 전부) + `/api/v1/deferred-params` v2 문서(installReferrer/clickId + 응답 필드) + "api vs link 도메인" 주의
- [x] eodin-sdk `docs/guide/integration-guide.md` deferred 섹션 — Install Referrer(Android) + 서버 확률매칭(iOS) 동작 + v2 응답 필드. (현재 public API `checkDeferredParams()`/`params.path` 불변이라 사용 예제는 유효). 5채널 README(Flutter/iOS/Android/Capacitor) deferred 매칭 메커니즘·신뢰도·call-once·F-9 동기화 포함
- [x] `migration-guide.md`(beta.2 deferred 동작 변경: public surface 불변·Android Play 재출시 필요·iOS ATT 무관·no-match graceful) + 4채널 CHANGELOG(d165cae). root `README.md` 는 개요 한 줄(상세는 채널 README) — 별도 갱신 불요
- [ ] eodin `README.md:231` `docs/deferred-deeplink-architecture-comparison.md` 최신화 여부 점검(fingerprint→Install Referrer 전환 반영)
- 원칙: **각 Phase 완료 = 관련 README/가이드 동시 갱신** (배포/릴리스 전 동기화)

## 메모 / 의사결정 대기

- [ ] Phase 1 을 deferred 재설계보다 먼저 단독 릴리스할지(권장) 결정
- [ ] iOS clipboard 결정론 매칭 도입 여부(프라이버시) — 현재 비목표
- [ ] Play Install Referrer 토큰 길이 제한 / referrer 포맷 확정
- [ ] plori seed(`eodin/apps/api/prisma/seed.ts:78`)에 `androidPackageName` 누락 — prod 는 admin 입력값 존재. dev seed 보강 여부
- [ ] (logging-agent 발견, Phase 1 외) `ClickEvent` 가 `clickId`/`clickIdType` 미수용 — web 은 보내지만 `clickEventSchema`(`deferredParamsService.ts:16`)가 silently strip, Prisma `ClickEvent` 모델에 컬럼 없음. web 랜딩 click 단위 광고 어트리뷰션 누락. 별도 티켓 (CAPI 경로는 `AnalyticsEvent`라 무영향)
</content>
