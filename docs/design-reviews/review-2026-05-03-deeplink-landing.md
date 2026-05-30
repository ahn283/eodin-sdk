# Design Review: 딥링크 랜딩 페이지 (live vs `design/` 레퍼런스)

**Date**: 2026-05-03
**Scope**: `eodin/apps/web/src/components/DeepLinkRedirect.tsx`, `app/[service]/page.tsx`, `app/[service]/[...path]/page.tsx` (repo: eodin/apps/web)
**Reference**: `eodin-sdk/design/src/app/components/DeepLinkPage.tsx`, `design/src/styles/globals.css`, `design/system/{color,button,font}.png`
**Inputs**: git HEAD (eodin @ 2026-05-03), 정적 코드 분석. 이전 대화의 안드로이드 "Opening Plori..." 스피너 캡처 참고. 일부 항목은 렌더 확인 필요(아래 명시).

## Summary
라이브 페이지의 **메인(fallback) 화면 구조**는 레퍼런스 `DeepLinkPage.tsx`와 상당히 충실하게 일치한다(센터 컬럼, 앱아이콘 24×24 `rounded-[22px]`, 상태점, 타이포 스케일, QR 카드, 버튼 위계). 그러나 레퍼런스에는 **존재하지 않는 전체화면 블로킹 스피너**가 라이브에 추가되어 있고, 이 스피너가 Android 경로에서 `await` 분석 호출 + intent 분기 무타이머 때문에 **영구히 갇힐 수 있다** — deeplink-reliability F-1/F-2와 정확히 일치하는 CRITICAL 결함. 또한 per-service `primaryColor` 의 white-on-color 대비 가드가 없어 밝은 브랜드색에서 흰 텍스트가 읽히지 않는다.

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 3 |
| MEDIUM | 5 |
| LOW | 3 |
| INFO | 2 |

**Deeplink-Flow UX**: D · **Branding/Visual**: B · **Mobile/Responsive**: B · **A11y/i18n**: C

---

## Critical & High Findings

### C-1. Android intent 분기에 안전 타이머가 없어 스피너 dead-end (F-2)
- **Severity**: CRITICAL
- **Axis**: Deeplink-Flow
- **File**: `apps/web/src/components/DeepLinkRedirect.tsx:106-111`
- **Issue**: `androidPackageName` 이 있으면 `window.location.href = buildIntentUrl(...)` 후 `return` 한다. `isRedirecting` 은 `true` 인 채로 끝나고, intent 가 앱을 열지 못하거나(미설치인데 `S.browser_fallback_url` 도 안 먹는 OEM/임베디드 케이스) 사용자가 페이지에 남으면 **스피너에 영구히 갇힌다**. fallback 버튼은 `platform !== 'web' && showFallback` 조건이라 `showFallback` 이 `false` 인 이 경로에서는 절대 나타나지 않는다.
- **Impact**: 이전 캡처의 "Opening Plori..." 무한 스피너. 사용자가 빠져나갈 탭 가능한 출구가 없다. prod 노출 P1.
- **Current**:
  ```tsx
  if (androidPackageName) {
    const scheme = deeplink.split('://')[0];
    const path = deeplink.split('://')[1] || '';
    window.location.href = buildIntentUrl(scheme, path, androidPackageName, storeUrl || '');
    return;
  }
  ```
- **Recommended fix**: intent 직후 ~2000ms 안전 타이머. 앱 전환 시 `document.hidden` 이 되므로 그때는 아무것도 안 함.
  ```tsx
  if (androidPackageName) {
    const scheme = deeplink.split('://')[0];
    const path = deeplink.split('://')[1] || '';
    window.location.href = buildIntentUrl(scheme, path, androidPackageName, storeUrl || '');
    setTimeout(() => {
      if (!document.hidden) {
        setIsRedirecting(false);
        setShowFallback(true);
      }
    }, 2000);
    return;
  }
  ```
- **CHECKLIST 연계**: Phase 1 §1.2.

### C-2. redirect 가 `await` 분석 호출 뒤에 직렬화되어 스피너 지연/갇힘 (F-1)
- **Severity**: CRITICAL
- **Axis**: Deeplink-Flow
- **File**: `apps/web/src/components/DeepLinkRedirect.tsx:59`, `:97-103`
- **Issue**: Android 경로는 `await logClickEvent()` (`:59`) → `await saveDeferredParams()` (`:97`) 를 모두 끝낸 뒤에야 intent 로 이동한다. API 가 느리거나 hang 이면 그동안 계속 `isRedirecting=true` 스피너만 표시되고, fetch 가 실패/타임아웃 없이 매달리면 redirect 자체가 발생하지 않는다. `handleOpenApp` (`:166`) 은 이미 fire-and-forget 패턴인데 자동 경로만 `await` 라 일관성도 깨진다.
- **Impact**: 네트워크 열악(모바일 데이터)에서 체감 지연 또는 무한 스피너. F-1 그 자체.
- **Recommended fix**: 분석 호출은 fire-and-forget(또는 `navigator.sendBeacon`)로 분리하고, redirect 를 블로킹하지 않게 한다. `api.ts` fetch 에 `AbortController` 1500ms 백업 타임아웃 추가(CHECKLIST §1.1).
  ```tsx
  // await 제거: 분석은 redirect 를 막지 않는다
  logClickEvent({ serviceId, resourceId, platform, ...utmParams, ...clickIdParams });
  // ...
  saveDeferredParams({ serviceId, resourceId, deeplinkPath, deviceFingerprint, additionalParams });
  // 이후 곧바로 intent/redirect
  ```
- **CHECKLIST 연계**: Phase 1 §1.1.

### H-1. per-service `primaryColor` 의 white-on-color 대비 가드 없음
- **Severity**: HIGH
- **Axis**: Branding / A11y
- **File**: `apps/web/src/components/DeepLinkRedirect.tsx:327-338` (primary CTA), `:264-269` (이니셜 아바타)
- **Issue**: primary CTA 와 이니셜 아바타는 `primaryColor` 위에 흰 텍스트를 고정으로 올린다. 레퍼런스의 `#fc8d42` 는 흰 텍스트 대비 약 2.6:1 로 이미 WCAG AA(4.5:1) 미달이지만 큰 글씨/볼드라 경계선이다. 임의 서비스가 밝은 노랑/연두/하늘색(`primaryColor`)을 쓰면 흰 텍스트가 사실상 안 보인다. 기본값 `#6366f1`(indigo)은 안전하나 admin 입력값은 임의다.
- **Impact**: 밝은 브랜드색 서비스에서 CTA 라벨/아바타 이니셜이 판독 불가. A11y + 브랜딩 결함.
- **Recommended fix**: 상대휘도로 전경색을 결정하는 헬퍼 추가, CTA/아바타 텍스트색에 적용.
  ```tsx
  const readableOn = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.45 ? '#363739' : '#ffffff';
  };
  // CTA: style={{ ..., color: readableOn(primaryColor) }} 그리고 className 의 text-white 제거
  ```
  근본적으로는 admin 측에서 대비 검증을 강제하는 게 이상적이지만, 페이지단 가드가 즉효.

### H-2. 레퍼런스에 없는 전체화면 스피너가 기본 진입 화면 (구조 격차 + dead-end 표면)
- **Severity**: HIGH
- **Axis**: Deeplink-Flow / Branding
- **File**: `apps/web/src/components/DeepLinkRedirect.tsx:214-246`
- **Issue**: 레퍼런스 `DeepLinkPage.tsx` 에는 블로킹 스피너 화면이 **전혀 없다** — 곧바로 앱아이콘 + 타이틀 + (QR 또는 버튼)을 보여준다. 라이브는 `isRedirecting` 동안 별도 미니멀 스피너 화면(`w-20 h-20 rounded-2xl` 아이콘, `rounded-full` 스피너)을 띄우는데, 이는 (a) 레퍼런스와 시각적으로 다른 두 번째 디자인 언어를 도입하고(아이콘 radius `rounded-2xl` vs 메인의 `rounded-[22px]`, 사이즈 `w-20` vs `w-24`), (b) C-1/C-2 의 dead-end 표면이 된다.
- **Impact**: Android/iOS 사용자가 보는 첫 화면이 레퍼런스 의도와 다르고, 갇히면 영구 노출. iOS/web/in-app 은 즉시 `setIsRedirecting(false)` 라 스피너가 거의 안 보이지만 Android 자동경로는 길게 노출.
- **Recommended fix**: 스피너를 별도 전체화면 대신 메인 레이아웃 안의 인라인 상태로 통합하거나(아이콘/타이틀은 그대로 두고 버튼 자리에 스피너), C-1/C-2 수정으로 노출시간을 ~2s 로 제한. 스피너 아이콘을 메인과 동일한 `w-24 h-24 rounded-[22px]` + 상태점으로 맞춰 디자인 언어 단일화. 렌더 확인 권장.

### H-3. in-app 브라우저: 복사만 제공, "외부 브라우저로 열기" 실행 경로 없음
- **Severity**: HIGH
- **Axis**: Deeplink-Flow
- **File**: `apps/web/src/components/DeepLinkRedirect.tsx:289-295`, `:325-338`
- **Issue**: in-app(KakaoTalk/Instagram 등)에서 안내 문구는 "Open in an external browser" 인데, primary 버튼 동작은 `handleCopyUrl` (링크 복사)뿐이다. 사용자는 복사 후 직접 브라우저를 열고 붙여넣어야 한다 — 안내와 동작이 어긋난다(문구는 "열라"는데 버튼은 "복사"). 안드로이드는 `intent:...package=com.android.chrome` 로 크롬 강제 오픈이 가능하다.
- **Impact**: in-app 사용자의 이탈/혼란. 딥링크 신뢰성의 흔한 실패 지점.
- **Recommended fix**: 문구를 동작에 맞게("탭하면 링크가 복사됩니다 — 브라우저에 붙여넣어 여세요") 정렬하거나, Android in-app 에서는 크롬 intent 버튼을 우선 제공. 최소한 복사 성공 토스트가 명확해야 함(현재 `copied` 라벨 토글은 OK).

---

## Medium & Low Findings

### M-1. 앱아이콘 배경 그라데이션이 레퍼런스의 오렌지 틴트를 잃음
- **Severity**: MEDIUM · **Axis**: Branding
- **File**: `DeepLinkRedirect.tsx:256` vs 레퍼런스 `DeepLinkPage.tsx:36-37`
- **Issue**: 레퍼런스 아이콘 배경은 `from-white to-[#FFF0E0]` + `from-[#fc8d42]/10` 오버레이(따뜻한 틴트). 라이브는 `from-white to-gray-50` (차가운 회색). 멀티테넌트라 정확한 오렌지는 못 쓰더라도, `primaryColor` 기반 연한 틴트로 맞추면 레퍼런스 의도에 근접.
- **Fix**: `style={{ background: \`linear-gradient(to bottom right, #fff, ${getLighterColor(primaryColor, 45)}22)\` }}` 같은 동적 연틴트, 또는 최소 `to-gray-50` 유지 시 의도된 선택임을 문서화.

### M-2. 메인 화면에 description 길이/2줄 안내가 레퍼런스와 다름
- **Severity**: MEDIUM · **Axis**: Branding
- **File**: `DeepLinkRedirect.tsx:284-295` vs 레퍼런스 `:79-83`
- **Issue**: 레퍼런스는 subtitle(`max-w-[280px]`) + 작은 "Opening in ... App..." 보조줄을 한 블록으로 둔다. 라이브는 description(`text-gray-600`) + 별도 `text-gray-400 text-xs` 안내줄로 분리. 구조는 합리적이나 caption 색이 `text-gray-400` 으로 레퍼런스의 `text-[#363739]/50`(QR 라벨)·`/70`(subtitle)보다 옅어 대비가 더 낮다.
- **Fix**: caption 을 `text-gray-500` 이상으로(흰 배경 `gray-400` ≈ 2.8:1, AA 미달). subtitle 은 `text-gray-600` 유지 가능.

### M-3. caption/QR 라벨 `text-gray-400` 대비 AA 미달
- **Severity**: MEDIUM · **Axis**: A11y
- **File**: `DeepLinkRedirect.tsx:289` (`text-gray-400 text-xs`), `:315` (`text-gray-400`)
- **Issue**: `gray-400`(#9ca3af) on white ≈ 2.8:1, WCAG AA(4.5:1, 일반 텍스트) 미달. 레퍼런스는 `#363739/50`(≈ #9b9b9c, 유사하게 낮음)이라 레퍼런스도 동일 문제지만, 라이브에서 개선 가능.
- **Fix**: `text-gray-500`(#6b7280 ≈ 4.6:1) 로 상향.

### M-4. 영어 전용 문자열 (i18n 미적용) — 글로벌 서비스 대상
- **Severity**: MEDIUM · **Axis**: i18n
- **File**: `DeepLinkRedirect.tsx:242,291-294,311,319,336-337`, `:195-197`
- **Issue**: "Opening ...", "Open App", "Copy Link", "Scan to Open", "Get it on Google Play" 등 전부 하드코딩 영어. Plori 등 16개 언어 서비스가 있는데 랜딩은 영어 고정. `apps/web` 에 i18n 프레임워크가 현재 배선돼 있지 않음(확인됨).
- **Fix**: 단기적으로 `Accept-Language` 헤더 기반 간단 사전(라우트에서 `lang` prop 주입) 또는 서비스 설정의 locale 사용. 프레임워크(next-intl 등) 도입은 별도 과제로 분리.

### M-5. raw `<img>` 사용 — `next/image` 미사용 + 로고 onError fallback 없음
- **Severity**: MEDIUM · **Axis**: Mobile / Engineering
- **File**: `DeepLinkRedirect.tsx:221-225`, `:258-262`, `:301-305`
- **Issue**: `logoUrl` / QR 모두 raw `<img>`. (a) `logoUrl` 로드 실패 시 깨진 이미지 아이콘 노출(이니셜 fallback 으로 전환 안 됨), (b) QR 외부 서비스(`api.qrserver.com`) 다운 시 빈 박스만 남음, (c) width/height 미지정으로 로드 중 레이아웃 시프트 가능. 레퍼런스도 raw `<img>`+QR 동일하나 라이브는 동적 `logoUrl` 이라 실패 가능성이 더 큼.
- **Fix**: `<img onError>` 로 이니셜 아바타 전환, QR 은 `onError` 시 "Open this link on your phone" 텍스트 fallback. `next/image` 는 외부 도메인 설정 필요하니 최소 `onError`+고정 치수부터.

### L-1. QR 카드 hover 라벨이 모바일/터치에서 무용
- **Severity**: LOW · **Axis**: Mobile
- **File**: `DeepLinkRedirect.tsx:306-313` (레퍼런스 `:93-97` 동일)
- **Issue**: `group-hover` 로만 "Scan to Open" 오버레이가 뜸. QR 은 `platform==='web'`(데스크탑)에서만 보이므로 큰 문제는 아니나, 터치 데스크탑/태블릿에선 영영 안 보임. 레퍼런스 답습이라 INFO 에 가깝지만 동작 일관성 위해 기록.

### L-2. `bg-gray-50` body 와 `bg-white` 컨테이너 — 풀블리드 흰 배경 의도 확인 필요
- **Severity**: LOW · **Axis**: Branding
- **File**: `apps/web/src/app/globals.css` (`body { bg-gray-50 }`) vs `DeepLinkRedirect.tsx:250,216` (`bg-white`, `min-h-screen`)
- **Issue**: 컨테이너가 `min-h-screen bg-white` 라 정상 높이에선 흰색이 body 회색을 덮지만, 콘텐츠가 화면보다 길어 스크롤되면 하단에 `gray-50` 이 비칠 수 있음. 레퍼런스는 전면 white 의도. 렌더 확인 권장.
- **Fix**: 랜딩 라우트 레이아웃에서 body 배경을 white 로 두거나 컨테이너에 `min-h-dvh`.

### L-3. 고정 `min-h-screen` — 모바일 동적 툴바 대응
- **Severity**: LOW · **Axis**: Mobile
- **File**: `DeepLinkRedirect.tsx:216,250,251`
- **Issue**: `min-h-screen`(100vh)은 iOS Safari/Chrome 동적 툴바에서 실제보다 큰 높이를 잡아 하단 버튼이 툴바에 가릴 수 있음. 콘텐츠가 센터링이라 치명적이진 않으나 작은 폰에서 버튼 하단이 잘릴 여지.
- **Fix**: `min-h-dvh`(또는 `min-h-[100dvh]`) 사용.

---

## A11y / Tap-target 점검
- 버튼 `py-4`(≈16px*2 + 텍스트) → 높이 ≥48px, 폭 `w-full` → 탭타깃 충분(✓).
- icon-only 버튼 없음(✓). 단 QR `<img alt="Scan to open">`(✓), 로고 `alt={serviceInfo.name}`(✓), 이니셜 아바타는 텍스트라 OK.
- **focus 상태 없음**: CTA/다운로드 버튼에 `focus-visible:ring` 부재 — 키보드 포커스 표시 추가 권장(MEDIUM 급이나 데스크탑 web 경로 한정이라 묶음). `focus-visible:ring-2 focus-visible:ring-offset-2` + ring 색 `primaryColor`.
- 상태점(`#10B981`)은 `title="Service Active"` 만 — 장식이면 `aria-hidden` 권장(INFO).

## Positive Observations
- 메인 fallback 레이아웃이 레퍼런스에 충실: `max-w-sm md:max-w-md`, `gap-8`, `px-4 py-12`, 앱아이콘 `w-24 h-24 rounded-[22px] shadow-xl`, 상태점 `w-6 h-6 border-[3px]`, 타이틀 `text-2xl md:text-3xl font-bold tracking-tight`, QR 180px qrserver, CTA `rounded-xl py-4` 그라데이션 + `0 8px 20px -6px ...66` 그림자 — 레퍼런스와 거의 1:1 (INFO, 잘함).
- `getLighterColor` 가 채널별 `Math.min(255, ...)` 클램프라 그라데이션 끝색이 invalid 가 안 됨(✓). 다만 입력이 3자리 hex(`#abc`)면 `parseInt` 오해석 — admin 이 6자리 강제하는지 확인 권장(INFO).
- iOS 경로에서 자동 custom-scheme 시도를 안 하고 버튼을 바로 노출하는 판단(`:85-89`)이 Safari 제스처 정책에 맞아 적절(✓).
- `handleOpenApp` 의 fire-and-forget `saveDeferredParams`(`:166`)는 iOS 제스처 컨텍스트 보존 의도가 명확 — 이 패턴을 C-2 자동경로에도 확장하면 됨.

## Action Items (우선순위)
- [ ] **CRITICAL** C-1: Android intent 분기에 ~2000ms 안전 타이머 → `setShowFallback(true)` (`DeepLinkRedirect.tsx:106-111`) — CHECKLIST Phase 1 §1.2
- [ ] **CRITICAL** C-2: `logClickEvent`/`saveDeferredParams` 의 `await` 제거(fire-and-forget) + `api.ts` AbortController 백업 (`:59,:97`) — CHECKLIST Phase 1 §1.1
- [ ] **HIGH** H-1: `primaryColor` 상대휘도 기반 전경색 가드(CTA/아바타 white→동적) (`:264-269,:327-338`)
- [ ] **HIGH** H-2: 블로킹 스피너를 메인 레이아웃에 인라인 통합 + 디자인 언어 단일화(아이콘 radius/사이즈) (`:214-246`)
- [ ] **HIGH** H-3: in-app 안내문구 ↔ 복사 동작 정렬 또는 Android 크롬 intent 버튼 (`:289-295,:328`)
- [ ] **MEDIUM** M-3/M-2: caption `text-gray-400`→`gray-500` 대비 상향
- [ ] **MEDIUM** M-4: 영어전용 문자열 i18n 경로 마련(서비스 locale / Accept-Language)
- [ ] **MEDIUM** M-5: `<img onError>` fallback(로고→이니셜, QR→텍스트) + 고정 치수
- [ ] **MEDIUM(a11y)**: 버튼 `focus-visible:ring` 추가
- [ ] **LOW** M-1/L-2/L-3: 아이콘 틴트 동적화, body 배경 white, `min-h-dvh`

> 렌더 확인 필요 항목: H-2(스피너 노출 체감), L-1(터치 데스크탑), L-2(긴 콘텐츠 스크롤 시 하단 회색). 가능하면 Android Chrome 미설치 + iOS Safari + 데스크탑 web 3종 스크린샷을 주면 확정 가능.
