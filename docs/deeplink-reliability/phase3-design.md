# Phase 3 설계: Android 결정론적 deferred — Play Install Referrer

**작성일:** 2026-05-30
**상태:** ✅ 설계 확정 (2026-05-30 D1~D5 결정 반영) → 구현 대기
**관련:** PRD §7.2 (F-3), CHECKLIST Phase 3 · 선행 Phase 2(계약 통일) 완료
**범위(크로스레포):** eodin `apps/web`(링크 생성) + `apps/api`(토큰 저장/해소) + `prisma` / eodin-sdk `packages/sdk-android` + `capacitor`(회수)

---

## 1. 목표

현재 deferred 매칭은 **fingerprint 불일치로 0%**(F-3). Android(Play 설치)에 한해 **결정론적 100% 매칭**으로 전환한다. Play 외 스토어/사이드로드는 Phase 4(서버 확률 매칭)로 fallback.

> 핵심: fingerprint 추측을 버리고, **Play Store URL 에 실어 보낸 토큰을 설치 후 그대로 회수**한다.

---

## 2. As-Is (현재 동작 흐름)

```
클릭 → 랜딩(saveDeferredParams: deviceFingerprint 로 저장) → intent fallback_url = Play Store URL
→ (미설치) Play Store 설치 → 첫 실행: SDK 가 sha256(네이티브ID) 로 GET /deferred-params
→ 백엔드: deviceFingerprint == deviceId 완전일치 → 웹 fingerprint(btoa+Date.now) 와 절대 불일치 → 404
```

## 3. To-Be (결정론 흐름)

```
클릭 → 랜딩이 짧은 opaque clickId(token) 생성
        ├─ deferredParam row 를 clickId 키로 저장
        └─ Play Store URL 에 &referrer=<clickId> 부착 (intent fallback_url + Download 버튼)
→ (미설치) Play Store(referrer 보존) → 설치
→ 첫 실행: SDK 가 InstallReferrerClient.getInstallReferrer() → referrer 에서 clickId 추출
→ GET /deferred-params?installReferrer=<referrer>  (또는 clickId 직접)
→ 백엔드: clickId 로 row 결정론 조회 → deeplinkPath/metadata 반환 (100% 정확)
```

Play referrer 없음(사이드로드/OEM/직접설치) → clickId 없음 → 기존 fingerprint 경로 또는 Phase 4 서버 확률 매칭으로 fallback(graceful).

---

## 4. 토큰(clickId) 스킴

- **짧은 opaque 토큰** (예: 22자 base62 = 128bit, 또는 nanoid). referrer 길이 제한/인코딩 이슈를 회피하고 PII·파라미터를 노출하지 않음.
- 토큰 → 서버에서 full deferred params(deeplinkPath/resourceId/metadata/utm) 로 해소. **referrer 에 utm 등을 직접 싣지 않는다**(길이·노출·신뢰 문제 회피).
- referrer 부착 형식: `https://play.google.com/store/apps/details?id=<pkg>&referrer=<URL-encoded clickId>`.
  - 기존 utm 사용 도구와 공존하려면 `referrer=eodin_cid%3D<clickId>` 같은 구조화도 가능 — **결정 필요(D2)**.

---

## 5. 컴포넌트별 변경

### 5.1 링크 생성 — eodin `apps/web`
- `DeepLinkRedirect.tsx` / `saveDeferredParams`: 클릭당 `clickId` 생성(서버 또는 클라). row 에 clickId 저장.
- Android Play Store fallback URL 에 `&referrer=<clickId>` 부착:
  - `buildIntentUrl(...)` 의 `fallbackUrl`(= androidStoreUrl) 에 referrer append
  - `handleDownload`/`getStoreButtonText` 의 Android 스토어 링크에도 동일
- ⚠️ iOS 스토어 URL 엔 referrer 안 붙임(App Store 는 referrer 미지원 → Phase 4).

### 5.2 백엔드 — eodin `apps/api`
- `saveDeferredParams`: `clickId` 수신/생성 + 저장.
- `getDeferredParams`: `installReferrer`(또는 `clickId`) 쿼리 추가 → **clickId 결정론 조회 우선**, 없으면 기존 fingerprint(레거시) fallback. (additive 하위호환)
- referrer 문자열 파싱(`eodin_cid=<token>` 추출) 유틸.

### 5.3 DB — Prisma
- `DeferredParam` 에 `clickId String? @unique`(또는 인덱스) 추가 + 마이그레이션.
- (claim 정책은 기존 유지: claimed/expiresAt.)

### 5.4 SDK — eodin-sdk `sdk-android` + `capacitor`(android)
- 의존성 `com.android.installreferrer:installreferrer:2.2`.
- `checkDeferredParams` 진입 시: 첫 실행 1회 `InstallReferrerClient.startConnection()` → `getInstallReferrer()` → referrer 파싱 → clickId 추출.
- clickId 있으면 `GET /deferred-params?installReferrer=<referrer>&service=<id>` (결정론). 없으면 기존 fingerprint 경로 유지(fallback).
- **public surface 불변**: `checkDeferredParams()` 시그니처 그대로. 내부 회수 방식만 변경.
- iOS/Flutter(iOS)/Capacitor-web: 변경 없음(Android 전용). **Flutter Android**? — Flutter 앱의 Android 설치도 Install Referrer 대상 → **결정 필요(D3)**: Flutter SDK 에도 `android_play_install_referrer` 플러그인으로 동일 회수 추가할지(권장) vs 네이티브 채널만.

### 5.5 fingerprint 정리 (F-5)
- Android 결정론 도입 후 Android fingerprint 경로는 fallback 으로 격하. iOS 는 Phase 4 까지 유지.

---

## 6. 결정 (Decisions) — ✅ 확정 (2026-05-30)

- **D1 ✅ 서버 발급**: clickId 는 landing SSR 시점에 서버가 발급(추측불가·중앙관리).
- **D2 ✅ 구조화**: `referrer=eodin_cid=<clickId>` (URL-encoded). 타 utm/MMP 와 네임스페이스 분리·공존.
- **D3 ✅ Flutter 포함**: 네이티브(sdk-android/capacitor) + **Flutter SDK 에도** Install Referrer 회수 추가(`android_play_install_referrer`). 주력 4개 Flutter 앱(plori/tempy/arden/fridgify)이 결정론 혜택을 받도록.
- **D4 ✅ 기존 유지**: 만료 24h / claimed 정책 그대로.
- **D5 ✅ Phase 4 일원화**: clickId 없는 비-Play 설치(사이드로드/OEM/iOS)는 Phase 4 서버 확률매칭으로 처리. fingerprint 완전 폐기.

---

## 7. 하위호환 / 릴리스 영향

- 백엔드: clickId 경로 **additive**(없으면 기존 동작) → 안전 단독 배포.
- SDK: public surface 불변(SemVer minor). 단 **신규 의존성 + 동작 변경**이라 앱 SDK bump + **앱 출시 필요**(Phase 4 와 묶어 1회 권장).
- referrer 부착은 랜딩(web) 변경 → 배포만으로 즉시(앱 무관).

## 8. 리스크

- Install Referrer 는 **Play 설치에만** 유효(OEM/사이드로드 제외) → D5 fallback 필수.
- referrer 는 **첫 설치 1회·앱 생애 1회성** → 회수 타이밍/실패 재시도 설계 필요(연결 실패 시 backoff).
- 이미 referrer 를 쓰는 MMP/utm 도구와 충돌 가능 → D2 포맷으로 네임스페이스 분리.
- Play referrer 전파 지연(설치~첫실행) 고려.

## 9. 검증 계획

- 단위: referrer 파싱(clickId 추출), 백엔드 clickId 결정론 조회 + fallback.
- E2E: Play 내부 테스트 트랙 — 클릭(referrer 부착) → 설치 → 첫 실행 회수 → 딥링크 도달.
- 회귀: clickId 없는 기존 경로(fingerprint/404) 정상.

## 10. 산출물 / 순서(구현 시)

1. Prisma 마이그레이션(clickId) + 백엔드 clickId 저장/조회 (additive) — 단독 배포 가능
2. 랜딩 referrer 부착 + clickId 발급 — web 배포
3. SDK(sdk-android + capacitor-android [+ Flutter Android]) Install Referrer 회수
4. E2E(Play 내부 트랙) + Phase 4(iOS) 와 묶어 앱 출시

---

## 부록: 출처
- [Play Install Referrer API — Android Developers](https://developer.android.com/google/play/installreferrer)
- [Technical Guide to Google Play Referrer — Branch](https://www.branch.io/resources/blog/technical-guide-to-google-play-referrer/)
- [Measure installs with Google Play install referrer — Adjust](https://help.adjust.com/en/article/measure-installs-with-google-play-install-referrer)
</content>
