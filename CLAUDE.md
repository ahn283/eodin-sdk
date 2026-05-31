# CLAUDE.md — eodin-sdk

## 🔴 MUST RULE — SDK 코드를 수정하면 README/가이드를 같은 변경 단위에서 확인·갱신한다

**이것은 타협 불가 규칙이다.** SDK 의 코드·동작·public API·버전·의존성·빌드 요건 중
**무엇이든** 바꾸면, **커밋 전에 반드시** 관련 문서를 열어 **실제 코드와 대조**하고
일치하도록 업데이트한다. 코드와 문서가 어긋난 채로 커밋하지 않는다 —
**문서가 코드와 다르면 그것도 버그다.** (추정으로 문서를 믿지 말고, 항상 코드로 검증한다.)

### 점검·갱신 대상 (영향받으면 전부)
- `packages/<channel>/README.md` — 수정한 채널 (sdk-flutter / sdk-ios / sdk-android / capacitor / sdk-web)
- `docs/guide/integration-guide.md` — public API·사용 예제·채널별 통합·deferred 매칭 동작
- `docs/guide/migration-guide.md` — public surface 변경 / SemVer / 동작 변경 시
- `packages/<channel>/CHANGELOG.md` + 버전 문자열(`pubspec.yaml` / `build.gradle.kts` / `*.podspec` / `package.json`) — 버전 bump / 릴리스 시
- 루트 `README.md` — 개요에 영향 줄 때

### 무엇을 대조하나 (문서가 코드를 정확히 반영하는지)
- public API 시그니처 / 메서드·필드 존재 여부 (예: `checkDeferredParams()`, `setDeviceATT(...)`)
- 동작 계약 — 예외 vs 반환, 채널별 차이 (예: Flutter throw / Capacitor native reject·web resolve / 서버 atomic claim)
- deferred 매칭 메커니즘 (Install Referrer / 서버 IP 확률 / ATT 무관 등)
- 새 의존성·최소 버전·빌드 요건, 버전 문자열 일관성

### 절차 (워크플로에 편입)
1. SDK 코드를 건드리는 순간, 위 대상 중 영향받는 문서를 **즉시 함께 연다.**
2. 문서의 모든 주장(claim)을 **해당 채널 코드 + 백엔드 계약과 대조**해 검증한다.
3. **코드 변경과 문서 변경을 같은 커밋/PR** 에 담는다 (문서 동기화는 "나중"이 아니다).
4. 필수 워크플로 순서를 지킨다: **개발 → 빌드 → 디자인리뷰 → 코드리뷰 → 로깅점검 → 단위테스트 → 체크리스트 → 커밋.**
   이 "코드리뷰" 단계에서 위 문서 대조를 **반드시** 수행한다.

> 근거: 실제로 5채널 문서에서 코드와 어긋난 주장 4건(claimed 플래그/서버 atomic claim,
> Capacitor native reject 등)이 코드 대조로 발견·수정된 적이 있다. 문서는 추정으로 쓰지 않는다.
