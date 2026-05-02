# SDK 배포/통합 검증 (Phase 0.5.7 + 0.5.8)

**작성일:** 2026-05-02
**참조:** CHECKLIST 0.5.7 / 0.5.8, PRD M3/M4

---

## 1. Phase 0.5.7 — Capacitor SPM submodule path

**질문**: Capacitor iOS plugin 의 `Package.swift` 가 submodule path 로 빌드 가능한가?

**확인된 패키지 구조** (`libs/eodin-sdk/packages/capacitor/`):
- `package.json` — npm 배포 entry
- `Package.swift` — SwiftPM consumers 용
- `EodinCapacitor.podspec` — CocoaPods consumers 용
- `ios/Sources/EodinCapacitorPlugin/` — iOS native code

**결론**: Capacitor 의 표준 배포 채널은 **npm** — iOS native 부분은 `pod install` 또는 SPM 으로 link 됨 (npm 패키지 안의 ios/ 폴더에서). **submodule path 직접 빌드는 비표준** — Capacitor 자체 문서가 권장하지 않음.

권장 패턴:
- 1차 (표준): `npm i @eodin/capacitor@^2.0.0` → `npx cap sync` → CocoaPods/SPM 가 자동 link
- 2차 (대안): SwiftPM git tag 의존성 — `.package(url: "https://github.com/ahn283/eodin-sdk.git", from: "2.0.0")` + path 로 packages/capacitor/Package.swift 지정 가능. 단 Capacitor 컨벤션 어긋남

**기존 vendor tgz 패턴 (kidstopia)** 의 정정:
- 현재 `package.json: "@eodin/capacitor": "file:vendor/eodin-capacitor-1.0.0.tgz"` — Phase 0.5.6 npm 배포 후 `^2.0.0` 으로 전환 (Phase 5.4b)

---

## 2. Phase 0.5.8 — submodule 인증 모델

**질문**: CI 봇이 private monorepo clone 시 public submodule 도 자동 clone 되는가?

**fridgify 의 .gitmodules 상태** (확인됨):
```
[submodule "libs/eodin-sdk"]
    path = libs/eodin-sdk
    url = https://github.com/ahn283/eodin-sdk.git
```
- HTTPS URL — **public 저장소** (`ahn283/eodin-sdk` 가 Public 으로 신설됨, Phase 0.5.2 결과)
- 인증 토큰 불필요로 clone 가능

**시나리오별 동작**:

| 시나리오 | 동작 | 비고 |
|---|---|---|
| 로컬 개발자 (HTTPS) | `git clone fridgify && git submodule update --init --recursive` 정상 동작 | 인증 X |
| 로컬 개발자 (SSH 환경) | submodule URL 이 HTTPS 라 별도 인증 X | OK |
| GitHub Actions (private fridgify) | `actions/checkout@v4` + `submodules: recursive` 옵션. main repo 는 GITHUB_TOKEN 으로 인증, submodule 은 public 이라 인증 X | 권장: `with: { submodules: recursive }` |
| Railway / Vercel CI (private fridgify) | git clone 시 GITHUB_TOKEN 만으로 main + public submodule 동시 clone | OK |
| 다른 private repo 가 eodin-sdk 추가 시 | 동일 — public submodule URL 만 정상 | OK |

**액션**:
- fridgify (그리고 향후 5개 앱 모두) 의 CI workflow 에 `submodules: recursive` 명시 추가 — Phase 5 마이그 시 검증
- 기존 deploy 가 Railway 라면 Railway 의 `GIT_CLONE_DEPTH` 와 `GIT_CLONE_RECURSIVE` 옵션 확인

**검증 명령** (현재 환경에서 가능):
```bash
cd /tmp && git clone https://github.com/ahn283/eodin-sdk.git eodin-sdk-test
cd eodin-sdk-test && ls packages/  # capacitor sdk-android sdk-flutter sdk-ios
```

---

## 3. 위험 / 후속 작업

| ID | 항목 | 우선순위 |
|---|---|---|
| D1 | fridgify CI workflow 에 `submodules: recursive` 명시 — Phase 0.5 submodule URL 변경 후 회귀 방지 | Phase 5.4 시작 전 |
| D2 | Phase 5 의 다른 4개 앱이 SDK 를 npm/pub.dev 로 전환 후 submodule 의존 제거 — fridgify 만 submodule 유지 검토 | Phase 5 |
| D3 | Capacitor SPM 패턴 통일 — npm 표준 외에 git tag SPM 도 지원할지 결정 (kidstopia 1개 사용처라 필요 낮음) | Phase 1.1 (M1) |
