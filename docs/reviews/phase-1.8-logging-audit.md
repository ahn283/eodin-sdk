# Phase 1.8 — Logging Audit (4채널 API doc 자동 생성 도구 추가)

- **작성일**: 2026-05-02
- **검토 범위**: dartdoc / DocC / Dokka / TypeDoc 추가 (`packages/sdk-flutter/dartdoc_options.yaml`, `packages/sdk-ios/.gitignore`, `packages/sdk-android/build.gradle.kts`, `packages/capacitor/{package.json, typedoc.json, .gitignore}`, `libs/eodin-sdk/README.md`) — logging / runtime 영향 관점
- **참조 PRD/이슈**: `docs/unified-id-and-sdk-v2/CHECKLIST.md` Phase 1.8, `docs/logging/unified-event-reference.md` v1.1, `docs/unified-id-and-sdk-v2/reviews/phase-1.7-logging-audit.md`
- **검토자**: logging-agent

---

## 0. Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| NIT      | 0 |

**Verdict**: **이슈 없음 (Pass)**.

Phase 1.8 은 4채널 SDK 의 API reference 자동 생성 도구를 추가하는 build-time 변경 only — runtime 코드 / wire format / event 정의 / queue / GDPR / endpoint 검증 어디에도 영향 없음. 의도한 internal 차단 (Dokka `app.eodin.internal.*` suppress, TypeDoc `src/web.ts` exclude) 도 정확히 동작하도록 구성되어 있어, "외부 사용자가 internal API 를 통해 SDK 를 잘못 사용하여 향후 회귀가 발생" 하는 시나리오도 차단됨.

---

## 1. 검증 항목 매트릭스

| # | 검증 항목 | 결과 | 근거 |
|---|-----------|------|------|
| 1 | runtime 동작 영향 없음 (이벤트 / wire / queue / GDPR / endpoint) | Pass | §2 |
| 2 | internal 패키지 docs 노출 차단 (Dokka) | Pass | §3.1 |
| 3 | internal/web fallback 노출 차단 (TypeDoc) | Pass | §3.2 |
| 4 | unified-event-reference 영향 없음 | Pass | §4 |
| 5 | 기존 phase (1.6 / 1.7 / 1.9) 회귀 없음 | Pass | §5 |
| 6 | 산출물 .gitignore 처리 (커밋 오염 방지) | Pass | §6 |

---

## 2. Runtime 영향 분석

### 2.1 변경 파일 분류 (submodule diff stat)

```
README.md                             | 13 +++++++++++++   ← 문서
packages/capacitor/package.json       | 10 ++++++----      ← devDep + script
packages/sdk-android/build.gradle.kts | 25 +++++++++++++++++++++++++ ← Gradle plugin
packages/sdk-flutter/.gitignore       |  3 +++             ← gitignore
packages/sdk-ios/.gitignore           |  3 +++             ← gitignore

packages/capacitor/typedoc.json       (신규)               ← TypeDoc config
packages/capacitor/.gitignore         (신규)               ← gitignore
packages/sdk-flutter/dartdoc_options.yaml (신규)           ← dartdoc config
```

→ 어떤 파일도 `*.dart` / `*.swift` / `*.kt` / `src/*.ts` (런타임 소스) 를 수정하지 않음. `package.json` 변경은 `devDependencies` 섹션 + `scripts.docs` 엔트리 추가뿐이며, `dependencies` / `peerDependencies` / runtime entry (`main` / `module` / `types`) 는 무수정.

### 2.2 이벤트 / wire / queue / GDPR / endpoint 정합

- **이벤트 정의**: `EodinEvent` enum / `unified-event-reference.md` 변경 없음.
- **Wire format**: `/events/collect` payload 구조 (event_id, event_name, app_id, device_id, user_id, session_id, timestamp, attribution, properties) 변경 없음.
- **Queue**: web `withQueueLock` / `MAX_QUEUE_SIZE` / `MAX_BATCH_SIZE` / `QUEUE_FLUSH_THRESHOLD` 등 모든 큐 상수 / 알고리즘 변경 없음 (`src/web.ts:67-72` 그대로).
- **GDPR**: Phase 1.7 에서 도입한 `setEnabled` / `isEnabled` / `requestDataDeletion` 4채널 코드 변경 없음.
- **Endpoint validation**: Phase 1.6 (S8) 의 `validateEndpoint` (`src/web.ts:87-108`) 변경 없음.

### 2.3 빌드 산출물 영향

- `npm run build` (`tsc && rollup`) 에는 `typedoc` 추가 영향 없음 — `npm run docs` 는 별도 스크립트로 build pipeline 에 포함되지 않음.
- `dart pub get` / `flutter pub get` 은 `dartdoc_options.yaml` 을 자동 인식하지만 `dart doc .` 명령어를 명시적으로 실행할 때만 동작.
- DocC 는 Xcode `xcodebuild docbuild` 시 활성. SwiftPM `swift build` / Cocoapods `pod install` 에 영향 없음.
- Dokka plugin 은 `dokkaHtml` task 호출 시에만 실행. AAR `release` 빌드 / `assembleRelease` / `publish` 에 영향 없음 — `tasks.withType<DokkaTask>().configureEach` 는 lazy configuration 이라 task 가 호출되지 않으면 작업 그래프에 들어가지 않음.

→ 결과적으로 4채널 SDK consumer (5개 앱) 는 binary / wire 어떤 것도 다르게 받지 않음.

---

## 3. Internal 노출 차단 검증

### 3.1 Dokka — Android (`build.gradle.kts:57-76`)

`perPackageOption` 3건이 정확히 의도대로 매칭됨:

| 정규식 | 대상 | suppress | 의도 |
|--------|------|----------|------|
| `app\.eodin\.internal.*` | `app.eodin.internal.EndpointValidator` (실재 확인됨, `src/main/java/app/eodin/internal/EndpointValidator.kt`) | true | Phase 1.6 (S8) HTTPS 검증 helper — 외부 노출 시 직접 호출 후 회귀 위험 |
| `app\.eodin\.deeplink\.BuildConfig` | Gradle 자동 생성 stub | true | 빌드 산출물이라 docs 노이즈 |
| `.*\.models` | DTO 패키지들 | **false** (명시적 노출 유지) | public type 이라 노출되어야 정합 |

- **확인 결과**: `app.eodin.internal` 패키지가 실제로 존재하며 (`EndpointValidator.kt` 1건), Dokka 정규식이 정확히 이 디렉토리를 매칭. 향후 internal helper 가 추가되어도 `app.eodin.internal.*` 하위에 있는 한 자동으로 docs 에서 제외됨.
- **logging 관점 의의**: SDK consumer 가 `EndpointValidator` 같은 internal helper 를 직접 호출하기 시작하면, 향후 endpoint 검증 정책 (loopback 허용 범위, scheme 추가 등) 이 바뀔 때마다 5개 앱 전체에 회귀가 발생할 수 있음. 차단은 적절한 결정.

### 3.2 TypeDoc — Capacitor (`typedoc.json:10-13`)

```json
"exclude": [
  "src/__tests__/**",
  "src/web.ts"
]
```

- `src/web.ts` 는 `EodinDeeplinkWeb` / `EodinAnalyticsWeb` web fallback 구현체로 `registerPlugin` 의 `web: () => import('./web')` 동적 import 로만 사용됨 (`src/index.ts:9-18`). public surface 가 아님.
- `excludePrivate: true`, `excludeProtected: true`, `excludeInternal: true` 도 함께 활성화 → `@internal` JSDoc 태그가 붙은 멤버는 자동 제외.
- **logging 관점 의의**: web fallback 구현체가 docs 에 노출되면 사용자가 `EodinAnalyticsWeb` 클래스를 직접 instantiate 하려는 시도를 유도할 수 있고, 이 경우 `STORAGE_KEYS` / `withQueueLock` 같은 internal 큐 메커니즘이 깨지면서 이벤트 소실 / 중복 발생 위험. 차단은 적절.

---

## 4. unified-event-reference 정합

`docs/logging/unified-event-reference.md` v1.1 (Phase 1.6 S9) 에 정의된 이벤트 카탈로그와 Phase 1.8 변경의 교차 검증:

- 새 이벤트 추가: 없음.
- 이벤트 파라미터 변경: 없음.
- `EodinEvent` enum 4채널 (Flutter / iOS / Android / Capacitor) 변경: 없음 — Phase 1.6 S9 정의 그대로 유지.
- 추가 검토 필요: **없음**.

→ Phase 1.8 은 unified-event-reference 의 어떤 항목과도 충돌하지 않음.

---

## 5. 기존 Phase 회귀 점검

| Phase | 도입 항목 | 1.8 영향 | 비고 |
|-------|-----------|----------|------|
| 1.1   | 패키지 구조 정비 (artifactId / namespace 통일) | 없음 | Dokka `moduleName.set("Eodin SDK Android")` 는 docs 표시명이라 publish artifactId (`eodin-sdk`) 와 충돌하지 않음 |
| 1.3   | API endpoint 통일 (`api.eodin.app/api/v1`) | 없음 | endpoint 값 변경 X |
| 1.6 (S8) | HTTPS only 강제 + `validateEndpoint` | 없음 | `EndpointValidator` 는 internal 로 docs 제외 의도 정합 (§3.1) |
| 1.6 (S9) | `EodinEvent` enum 4채널 | 없음 | enum 자체는 public 이라 docs 에 노출되어야 함 — Dokka / TypeDoc 모두 enum 을 자동으로 capture |
| 1.7    | GDPR surface (4채널 `setEnabled` / `requestDataDeletion`) | 없음 | 4채널 메서드 모두 public 이라 docs 노출. 서명 변경 X |
| 1.9    | Capacitor `web.ts` 동작화 (queue mutex / quota / lifecycle) | 없음 | `web.ts` 는 TypeDoc exclude 됨 — 의도적 차단 (§3.2) |

---

## 6. 산출물 커밋 오염 방지

생성될 docs 산출물이 git 에 커밋되지 않도록 `.gitignore` 처리 검증:

| 채널 | 산출물 경로 | gitignore 처리 |
|------|-------------|----------------|
| Flutter (dartdoc) | `doc/api/` | `packages/sdk-flutter/.gitignore:23` (`# Generated API docs (Phase 1.8 — \`dart doc .\`)`) |
| iOS (DocC) | `*.doccarchive` | `packages/sdk-ios/.gitignore:11` (`# Generated DocC archives (Phase 1.8 — \`xcodebuild docbuild\`)`) |
| Android (Dokka) | `build/dokka/html/` | 기존 `.gitignore` 의 `build/` 패턴이 이미 처리 (별도 추가 불필요) |
| Capacitor (TypeDoc) | `docs/api/` | `packages/capacitor/.gitignore:5` (신규) |

→ 산출물이 우발적으로 커밋되어 repo 가 비대해지는 시나리오 차단됨.

---

## 7. Recommendations

별도 권장 사항 없음. Phase 1.8 변경은 의도대로 build-tooling 한정으로 격리되어 있으며 logging / runtime / GDPR / wire 어디에도 영향 없음.

다만 (선택) 후속 phase 에서 다음을 고려할 수 있음 — **Phase 1.8 차단 항목 아님**:

1. CI 에 `npm run docs` (Capacitor) / `dart doc .` (Flutter) / `dokkaHtml` (Android) / `xcodebuild docbuild` (iOS) 4채널 dry-run 을 추가하여 docs 빌드가 깨지지 않는지 PR 단계에서 자동 확인 — 추후 internal API 를 추가했을 때 docs 빌드 실패로 알림 받기.
2. TypeDoc / dartdoc 의 출력에 unified-event-reference 의 `EodinEvent` enum 항목이 모두 노출되었는지 docs build 후 1회 수동 검증 (Phase 1.8 자체 검증 아님 — release 직전 1회).

---

## 8. Conclusion

Phase 1.8 은 build-time 도구 추가 only — analytics 이벤트 / wire format / queue / GDPR 어떤 surface 에도 영향 없음. Internal API 차단 (Dokka `app.eodin.internal.*` suppress + TypeDoc `src/web.ts` exclude) 은 5개 consumer 앱이 향후 SDK 변경 시 회귀를 겪을 위험을 사전에 차단하는 적절한 설계. **이슈 없음, Pass.**
