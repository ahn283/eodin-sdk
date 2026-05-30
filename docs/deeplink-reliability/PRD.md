# PRD: 딥링크 / 디퍼드 딥링크 신뢰성 정비 (Deeplink Reliability)

**작성일:** 2026-05-30
**작성자:** Woojin Ahn
**상태:** Draft (조사 완료 → 설계/구현 대기)
**디렉토리 명:** `deeplink-reliability/`
**범위:** `link.eodin.app` forward 딥링크 + 4채널 SDK deferred 딥링크 + `api.eodin.app` deferred/click 백엔드

> ⚠️ 본 프로젝트는 **두 레포에 걸쳐** 있다.
> - **eodin** (`~/Github/eodin`) — `apps/web` (랜딩), `apps/api` (백엔드), `prisma` (seed)
> - **eodin-sdk** (`~/Github/eodin-sdk`) — `packages/sdk-flutter` / `sdk-android` / `sdk-ios` / `capacitor` (설치 후 deferred 회수)

---

## 1. 배경 및 트리거

2026-05-30, 안드로이드 Chrome 에서 앱 미설치 상태로 `link.eodin.app/plori/invite…` 를 열었을 때 **"Opening Plori…" 스피너에서 멈추고 Play 스토어로 이동하지 않는** 증상이 보고됐다.

이 증상을 시작점으로 forward 딥링크 → 백엔드 → 설치 후 SDK deferred 회수까지 전체 경로를 점검한 결과, **forward 경로의 신뢰성 결함**과 **deferred 경로의 구조적 비동작(매칭 불가)** 두 종류의 문제가 확인됐다. 업계 베스트 프랙티스(Branch / Adjust / Adapty / Google) 대비 격차도 함께 정리한다.

---

## 2. 현재 아키텍처 (As-Is)

### 2.1 Forward 딥링크 (클릭 → 앱 열기 / 스토어)

```
사용자가 link.eodin.app/{service}/{path} 클릭
  → (앱 설치됨) Android App Links / iOS Universal Links 로 앱 직접 열림
  → (미설치/링크 미검증) Next.js 랜딩 페이지 렌더
      → DeepLinkRedirect.tsx 가 platform 분기
        - web      : QR 코드 표시
        - in-app   : "외부 브라우저로 열기" 버튼
        - iOS      : 자동 redirect 생략, 버튼만 노출
        - Android  : intent:// URL 로 자동 redirect (스토어 fallback 내장)
```

- 랜딩: `eodin/apps/web/src/components/DeepLinkRedirect.tsx`
- intent URL 빌더: `eodin/apps/web/src/utils/platform.ts:32` — `intent://{path}#Intent;scheme={scheme};package={pkg};S.browser_fallback_url={store};end`
- service 설정 주입: `eodin/apps/web/src/app/[service]/[...path]/page.tsx:129`
- assetlinks.json / AASA 발행: `eodin/apps/api/src/services/serviceService.ts:345` / `:389`

### 2.2 Deferred 딥링크 (클릭 → 설치 → 첫 실행)

```
[클릭 시] 웹 랜딩이 클라이언트 fingerprint 생성 → POST /deferred-params 로 저장
[설치 후] SDK 가 디바이스 fingerprint 생성 → GET /deferred-params?deviceId=… 로 조회
[매칭]    백엔드가 deviceFingerprint == deviceId 완전일치로 검색
```

- 저장 fingerprint: `DeepLinkRedirect.tsx:371` `generateClientFingerprint()`
- 백엔드 저장/조회: `eodin/apps/api/src/services/deferredParamsService.ts` (`saveDeferredParams:42` / `getDeferredParams:78`)
- 설치 후 회수 SDK:
  - Flutter `eodin-sdk/packages/sdk-flutter/lib/src/eodin_deeplink.dart`
  - Android `eodin-sdk/packages/sdk-android/src/main/java/app/eodin/deeplink/EodinDeeplink.kt`
  - iOS `eodin-sdk/packages/sdk-ios/Sources/EodinDeeplink/EodinDeeplink.swift`
  - Capacitor `eodin-sdk/packages/capacitor/...`

---

## 3. 발견된 결함 (조사 결과)

심각도: **P0** = 기능이 동작하지 않음 / **P1** = 신뢰성 결함(일부 동작) / **P2** = 정확도·정합성·운영

### F-1 (P1) — Forward redirect 가 timeout 없는 분석 호출 뒤에 막힘
`handleRedirect`(`DeepLinkRedirect.tsx:57`)는 redirect 직전에 `await logClickEvent()`(`:59`)와 `await saveDeferredParams()`(`:97`)를 순차 실행한다. 두 호출(`api.ts:74` / `:133`)은 모두 **timeout 없는 `fetch`**. `try/catch` 가 있어도 fetch 는 *연결 후 무응답(hang)* 시 reject/catch 되지 않으므로, API 가 느리거나 hang 되면 `window.location.href = buildIntentUrl(...)`(`:109`)가 **영원히 실행되지 않는다** → "Opening Plori…" 영구 정지.

### F-2 (P1) — intent 자동 redirect 실패 시 탈출구 없음
intent 분기(`:106-111`)에는 레거시 분기(`:124-135`)와 달리 안전 타이머도, `setIsRedirecting(false)` 도 없다. 게다가 자동 redirect 는 `useEffect` 안에서 **사용자 제스처 없이** 실행되는데, Chrome 가이드는 *"don't redirect without a user gesture"* 라고 명시한다(자동 intent redirect 는 본질적으로 불안정). 자동 redirect 가 어떤 이유로든 안 먹으면 `isRedirecting=true` 가 유지되어 **버튼(Open App / Get it on Google Play)조차 노출되지 않는다.**

### F-3 (P0) — Deferred fingerprint 가 저장/조회 간 알고리즘 불일치 → 매칭 확률 0%
백엔드는 `deviceFingerprint == deviceId` **완전일치**(`deferredParamsService.ts:86`)로만 검색한다. 그런데 양쪽이 만드는 문자열이 전혀 다르다.

| 단계 | 생성 방식 | 결과 형태 |
|---|---|---|
| 저장(웹) | `btoa([userAgent, language, colorDepth, w, h, tzOffset, **Date.now()**].join('\|'))` | 브라우저 값 Base64 (ms 타임스탬프 포함) |
| 조회(Android SDK) | `sha256("android_id:..\|brand:..\|model:..\|screen:..\|locale:..\|package:..")` | SHA-256 hex |
| 조회(Flutter SDK) | `sha256("<androidId 또는 IDFV>-<service>")` | SHA-256 hex |
| 조회(iOS SDK) | 네이티브 `DeviceFingerprint.generate()` | SHA-256 hex |

→ 웹 저장값은 `btoa(브라우저문자열 + ms타임스탬프)`, 앱 조회값은 `sha256(네이티브ID)`. **포맷·입력·해시가 전부 달라 절대 일치할 수 없다.** deferred 는 **항상 404** 가 난다(확률 저하가 아니라 구조적 불가능). 게다가 저장값에 `Date.now()` 가 들어가 어떤 확률적 매칭으로도 재현 불가.

### F-4 (P0) — Deferred 응답 스키마가 SDK 기대값과 불일치
설령 F-3 이 해결돼 매칭이 된다 해도, 백엔드 응답(`deferredParamsService.ts:115`)은 `{ found, service, path, params, createdAt }` 인데:
- Android SDK 는 `deeplinkPath` / `resourceId` / `metadata` 를 읽음(`EodinDeeplink.kt:114`) → 전부 `null`
- iOS SDK 동일(`EodinDeeplink.swift:155`) → `path == nil` → `hasParams == false`
- Flutter SDK 는 `json['data']` 를 읽음(`eodin_deeplink.dart:128`) → `data == null` → 200 인데도 `ApiException(200)` throw

### F-5 (P2) — SDK 4채널이 서로 다른 fingerprint 공식 사용
Android 네이티브(다중 컴포넌트 sha256) ≠ Flutter(`sha256("id-service")`) ≠ iOS. **단일 표준 알고리즘이 없다.** F-3 재설계 시 4채널 + 백엔드가 동일 계약을 공유해야 한다.

### F-6 (P2) — service 스코핑 무시
Flutter 만 `service` 쿼리를 전송(`eodin_deeplink.dart:114`)하고 백엔드는 이를 무시, fingerprint 만으로 매칭한다. 매칭이 성립한다면 앱 A 링크 클릭 → 앱 B 설치 시 교차 오염 가능(latent).

### F-7 (P2) — 매칭 윈도우 24h + 최신순, 신호 가중치 없음
`saveDeferredParams` 는 24h 만료(`:47`), `getDeferredParams` 는 `createdAt desc` 최신 1건(`:94`). 베스트 프랙티스는 **≤5분 윈도우 + IP/신호 유사도 가중치**.

### F-8 (P2) — 미사용(dead) 서버사이드 fingerprint
`generateFingerprint(req)`(IP+UA+ts sha256, `:31`)가 정의돼 있으나 어디서도 호출되지 않음. 원래 서버사이드 fingerprint 설계였다가 클라 토큰 방식으로 바뀌며 방치된 흔적 — F-3 재설계의 출발점으로 활용 가능.

### F-9 (P2) — 매칭 실패 UX 부재
404 시 SDK 는 `NoParamsFound` 만 던지고, 앱이 graceful 진입(홈/온보딩) 하도록 강제하는 계약이 없다. 베스트 프랙티스: *신규 사용자에게 절대 에러 화면을 보이지 말 것.*

---

## 4. 베스트 프랙티스 대비표

| 영역 | 업계 표준 (Branch/Adjust/Adapty/Google) | Eodin 현재 | Gap |
|---|---|---|---|
| **Android deferred 매칭** | **Google Play Install Referrer API (결정론적)** | 미사용 — device fingerprint 만 | ❌ 최대 누락 |
| iOS deferred 매칭 | 확률적(IP+fingerprint) ≤5분 윈도우 (+ clipboard 보조) | 클라 토큰 완전일치, 24h | ❌ |
| fingerprint 위치 | **서버**가 click/install 양쪽 신호로 fuzzy 매칭 | 클라가 self-report 한 토큰 완전일치 | ❌ 설계 어긋남 |
| 매칭 윈도우 | 최대 5분 (오매칭 방지) | 24시간, 가중치 없음 | ❌ |
| Forward intent | intent + `S.browser_fallback_url` | 동일 방식 채택 | ✅ |
| Forward redirect 트리거 | 사용자 제스처 권장 / 자동 redirect 비권장 | `useEffect` 자동 | ⚠️ |
| 매칭 실패 UX | 항상 가치 제공(홈/카테고리), 에러 금지 | 404 → 앱 무동작 | ❌ |
| Android 링크 표준 | Firebase Dynamic Links 종료(2025-08-25) → native App Links + Install Referrer | intent + App Links 부분 채택 | △ |

---

## 5. 목표 (Goals)

1. **Forward 신뢰성 복구**: 어떤 네트워크/Chrome 조건에서도 사용자가 스피너에 갇히지 않고, 앱 열기 또는 스토어 이동 또는 탭 가능한 버튼에 도달한다.
2. **Deferred 결정론적 재설계**: Android 는 Play Install Referrer 기반 결정론적 매칭, iOS 는 서버사이드 확률 매칭(≤5분~1h 윈도우)으로 전환. 클라 self-report 토큰 완전일치 방식 폐기.
3. **단일 계약 통일**: deferred 요청/응답 스키마와 매칭 키를 4채널 SDK + 백엔드가 공유하는 단일 계약으로 정의.
4. **Graceful 실패**: 매칭 실패 시에도 앱이 정상 진입하도록 SDK 계약/가이드로 강제.

## 6. 비목표 (Non-Goals)

- 자체 attribution/MMP 제품화 (Branch/Adjust 대체) — 본 프로젝트는 deeplink 신뢰성에 한정.
- iOS clipboard 기반 결정론 매칭 — 프라이버시 리스크로 1차 범위 밖(추후 검토).
- Firebase Dynamic Links 마이그 (이미 native 채택).
- 신규 링크 단축/QR 도메인 기능 추가.

---

## 7. 제안 설계 (To-Be 요약)

### 7.1 Forward (P1) — 즉시 적용 가능
- `logClickEvent` / `saveDeferredParams` 를 redirect 경로에서 분리: `await` 제거(fire-and-forget) 또는 `navigator.sendBeacon`(navigation 에도 생존, 서버는 이미 sendBeacon body fallback 지원 — eodin 커밋 `19dfa68`).
- intent 분기에 **~2초 안전 타이머**: 페이지가 그대로면 `setIsRedirecting(false)` + `setShowFallback(true)` 로 버튼 노출. 사용자가 탭하면 그 제스처로 intent/스토어 이동이 확실히 동작.

### 7.2 Deferred Android (P0) — 결정론
- **Play Install Referrer API** 도입. 링크 생성 시 우리 click 토큰(`linkId`/`clickId`)을 스토어 referrer 에 실어 보내고, 설치 후 `InstallReferrerClient` 로 회수 → click 레코드와 1:1 결정론 매칭. fingerprint 제거.
- Play 외 스토어(OEM)는 referrer 미제공 → iOS 와 동일한 서버 확률 매칭으로 fallback.

### 7.3 Deferred iOS (P0) — 서버 확률 매칭
- click 시점에 **서버가** IP + UA + Accept-Language + 타임스탬프 저장(`generateFingerprint` 재활용).
- 설치 후 앱이 동일 네트워크 컨텍스트로 조회 → 서버가 **≤5분~1h 윈도우 + 신호 유사도** 로 best-match. 클라가 토큰을 만들어 보내는 현재 방식 폐기.

### 7.4 단일 계약 (P0)
- 요청: `GET /v2/deferred-params` — Android `{ installReferrer }`, iOS `{ }`(서버 IP/UA 사용).
- 응답: `{ found: bool, service, deeplinkPath, resourceId, metadata }` — 필드명을 4채널 SDK 와 일치.
- 4채널 SDK fingerprint 공식 제거(Android/iOS) 또는 통일.

---

## 8. 성공 지표

- Forward: 안드로이드 미설치 클릭 → 스토어 도달률, "스피너 정지" 0건 (수동 + 합성 모니터).
- Deferred: 매칭 성공률 — Android(Play) ≥ 95% 결정론, iOS 윈도우 내 ≥ 70~90%.
- 회귀: 4채널 SDK + 5개 앱(fridgify/plori/tempy/arden/kidstopia) deferred 회수 정상 동작.

## 9. 리스크

- Play Install Referrer 는 Play 설치에만 유효(OEM 스토어 제외) → fallback 필수.
- 서버 확률 매칭은 공용 IP(회사 WiFi 등)에서 오매칭 가능 → 윈도우 좁히고 신호 가중치 필요.
- 4채널 + 2레포 + 5앱 동시 계약 변경 → SemVer breaking, 마이그 순서 관리 필요.

---

## 부록: 참고 출처

- [Deferred Deep Linking in iOS and Android: Guide for 2026 — Adapty](https://adapty.io/blog/deferred-deep-linking/)
- [Deferred Deep Linking in 2025: Why is it So Complicated? — DeepLinkNow](https://deeplinknow.com/blog/deferred-deep-linking-2025)
- [How deferred deep linking impacts attribution accuracy — Linkrunner](https://linkrunner.io/blog/how-deferred-deep-linking-can-impact-attribution-accuracy-(and-best-practices))
- [How To Setup Deferred Deep Linking on Android (Install Referrer) — Branch](https://www.branch.io/resources/blog/how-to-setup-deferred-deep-linking-on-android/)
- [Deferred Deep Linking with Device Snapshotting — Branch](https://www.branch.io/resources/blog/deferred-deep-linking-with-device-snapshotting/)
- [Deep App linking and changes to Chrome on Android — Paul Kinlan (Google)](https://paul.kinlan.me/deep-app-linking-on-android-and-chrome/)
- [Technical Guide to Android Chrome Intents — Branch](https://www.branch.io/resources/blog/technical-guide-to-android-chrome-intents/)
</content>
</invoke>
