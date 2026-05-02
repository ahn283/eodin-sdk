# Phase 1.3 Code Review — API Endpoint 통일 (PRD §6.1 M2)

**Date**: 2026-05-02
**Scope**: `libs/eodin-sdk/packages/` — 12 unstaged files (SDK 4종 README/docstring/test fixture)
**Substitution**: `https://link.eodin.app/api/v1` → `https://api.eodin.app/api/v1`

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 0 |
| INFO | 2 |

전수 grep 으로 확인한 결과 누락/오변환 0건. 의도된 보존 항목 (`link.eodin.app/your-service/resource-id` user URL 예시 2건)도 정상. 다만 `sdk-flutter/README.md` 의 Admin Dashboard URL 한 건이 stale 이라 같은 커밋에서 정리 권장.

---

## Findings

### 1. Stale Admin Dashboard URL in sdk-flutter README
- **Severity**: MEDIUM
- **Category**: Documentation / Endpoint Consistency
- **File**: `packages/sdk-flutter/README.md:149`
- **Issue**: `- Admin Dashboard: https://link.eodin.app/admin` — CLAUDE.md 엔드포인트 표에 따르면 admin 은 `admin.eodin.app` 가 정답. `link.eodin.app/admin` 은 어떤 라우팅 규칙으로도 매핑되지 않음 (link 도메인은 `/{service}/{id}` 와 `/legal/{service}/{type}` 만 처리).
- **Impact**: Flutter 통합 개발자가 링크 클릭 시 404. PRD §6.1 의 도메인 분리 원칙(link= user entry, admin= dashboard, api= SDK)과 정면 충돌.
- **Fix**: 같은 커밋에 포함 권장.
  ```diff
  - - Admin Dashboard: https://link.eodin.app/admin
  + - Admin Dashboard: https://admin.eodin.app
  ```
- **참고**: `sdk-ios/README.md:180` 와 `sdk-android/README.md:191` 도 "admin dashboard" 를 언급하지만 URL 은 안 박혀 있어 안전. Flutter 만 URL 이 들어가 있음.

---

### 2. Substitution Completeness — Verified
- **Severity**: INFO
- **확인 방법**: `grep -rn "link\.eodin\.app" --include="*.{md,kt,swift,dart,ts,tsx,js,json,yaml,yml}" packages/`
- **결과**: 잔존 3건 모두 의도된 보존:
  - `sdk-android/README.md:158` — `link.eodin.app/your-service/resource-id` (user URL 예시) ✅
  - `sdk-ios/README.md:160` — 동일 패턴 ✅
  - `sdk-flutter/README.md:149` — Admin URL (위 finding #1)
- **`api.eodin.app` 신규 점유**: 28건, 모두 `apiEndpoint = "https://api.eodin.app/api/v1"` 패턴. 오변환 0건.

---

### 3. SDK Runtime 코드는 하드코딩 없음
- **Severity**: INFO
- **확인**: 4개 SDK 모두 `apiEndpoint` 를 consumer 로부터 주입받는 구조 — Kotlin `EodinDeeplink.configure(apiEndpoint=...)`, Swift `static func configure(apiEndpoint:)`, Dart `configure({required apiEndpoint})`, TS plugin `configure({apiEndpoint})`. 변경된 12개 파일 어느 곳에도 production URL 이 default value 로 박혀 있지 않음. PRD §6.1 의 "5개 앱이 자기 config 로 주입" 전제와 정합.
- **Phase 5 마이그레이션 영향**: 5개 앱 config 파일 (per-app `EodinSDK.configure(...)` 호출부) 만 갱신하면 됨. SDK 자체에 fallback default 가 없어 config 누락 시 런타임 실패가 명시적으로 드러나는 것도 좋은 설계.

---

## Positive Observations

- Test fixture (`sdk-flutter/test/eodin_deeplink_test.dart`) 6건도 빠짐없이 동기화됨 — trailing-slash 케이스(`/api/v1/`) 까지 일관 처리.
- Capacitor 플러그인의 native 양면 (Android Kotlin + iOS Swift) 둘 다 갱신 — 한쪽만 바뀌는 흔한 실수 없음.
- Docstring 예시와 README 의 코드 블록이 100% 같은 문자열 — copy-paste 시 일관성 보장.
- Diff 가 순수 문자열 치환 (`s/link/api/`) 으로 surface area 최소. 런타임 동작 영향 0.

---

## Action Items

- [ ] (MEDIUM) `packages/sdk-flutter/README.md:149` 의 Admin Dashboard URL 을 `https://admin.eodin.app` 로 같은 커밋에서 수정.
- [ ] (확인) Phase 5 마이그레이션 시 5개 consumer 앱의 `apiEndpoint` 주입부를 `api.eodin.app` 로 갱신했는지 PR 단위 체크.

---

## Verdict

**Approve with fixes** — finding #1 (Flutter README admin URL) 만 같은 커밋에 squash 하면 머지 가능. 본 substitution 자체는 정확하고 누락 없음.
