# Phase 1.7 — Logging Audit (GDPR surface — `setEnabled` / `isEnabled` / `requestDataDeletion`)

- **작성일**: 2026-05-02
- **검토 범위**: `setEnabled` / `isEnabled` / `requestDataDeletion` 4채널 (Flutter / iOS / Android / Capacitor) — logging / GDPR 정합성 관점
- **참조 PRD/이슈**: `docs/unified-id-and-sdk-v2/open-issues.md` §4.5, `docs/logging/unified-event-reference.md` v1.1, `docs/unified-id-and-sdk-v2/reviews/phase-1.9-logging-audit.md` §5
- **검토자**: logging-agent

---

## 0. Executive Summary

| Severity | Count | Headline |
|----------|-------|----------|
| CRITICAL | 2 | (1) `requestDataDeletion` → 잘못된 API 경로로 전송 (404 보장) (2) Flutter / Android 에서 `requestDataDeletion` 후 `track()` 호출 시 null-check 크래시 |
| HIGH | 3 | (1) `setEnabled(false)` 가 큐 잔여 이벤트를 drop 하지 않음 — GDPR consent 위반 가능 (2) API 서버 schema 가 `app_id` 무시 — multi-tenancy bypass (3) `requestDataDeletion` 후 `isEnabled` 가 강제로 true 재설정 — 사용자 opt-out 의도 파괴 |
| MEDIUM | 3 | (1) Storage key 비정합 (Android `enabled` vs 나머지 `eodin_enabled`) (2) Web 의 `clearLocalData()` 가 in-flight `flush()` batch 를 손실 처리하지 않음 (3) iOS reference / capacitor-bundled iOS 두 EodinAnalytics.swift 가 거의 1:1 복제 — drift 위험 |
| NIT | 4 | 문서 / 주석 / 테스트 커버리지 보강 |

**Verdict**: **Reject for fix-up** — Phase 1.7 가 추구한 "Flutter parity 4채널 통일" 의 의도 자체는 정확히 구현되었고 단위 테스트도 충실하지만, **`/user-data` 엔드포인트 경로가 서버 라우터와 mismatch (`/api/v1/user-data` ↔ 서버는 `/api/v1/events/user-data`)** 라는 회로 차단급 결함이 4채널 모두에 존재함. 이 결함은 4개 SDK 의 개별 단위 테스트 (mock client, mock fetch) 는 통과하지만 실제 서버에서는 **모든 GDPR 삭제 요청이 404 로 실패** 하고 SDK 는 `success=false` 와 함께 로컬 정리만 수행함 — Article 17 의 server-side erasure 가 실현되지 않음. 이 1건만 단독으로도 release 차단. 추가 CRITICAL 1건 + HIGH 3건 함께 수정 후 재검토 권장.

---

## 1. 검증 대상 매트릭스 (요청 §1~§6)

| 검증 항목 | 결과 | 참조 |
|-----------|------|------|
| §1 `setEnabled(false)` 후 이벤트 차단 | 4채널 통과 (Flutter `_isEnabled`, iOS `shared.isEnabled`, Android `isEnabledFlag`, Web `isEnabledSync()`) | §3 |
| §1 큐 잔여 이벤트 정책 | **HIGH-1** — drop 하지 않음, 자연스러운 flush 진행 (GDPR 위반 가능) | §3.1 |
| §1 `setEnabled(true)` 재활성 | 4채널 통과 (test pinned: capacitor `web.test.ts:374`) | §3 |
| §2 GDPR Article 17 정합 | **CRITICAL-1** — endpoint path mismatch (404 보장) | §4 |
| §2 네트워크 실패 시 로컬 정리 보장 | 4채널 통과 (try/finally / always-clear-after-callback 패턴) | §4.2 |
| §2 정리 후 `track()` 동작 | **CRITICAL-2** — Flutter / Android 크래시, iOS 무사 통과, Web 잘못된 페이로드 | §5 |
| §3 Phase 1.6 (S9) EodinEvent enum 회귀 | 영향 없음 — 새 이벤트 추가 없음, 기존 enum mapping 유지 | §6 |
| §3 Phase 1.9 web.ts queue mutex / quota / lifecycle 충돌 | 영향 없음 — `setEnabled` 는 queue R-M-W 미진입, `requestDataDeletion` 의 `clearLocalData` 는 mutex 미사용이지만 동시성 노출 작음 (단 §7.2 MEDIUM-2 참조) | §7 |
| §3 Phase 1.6 (S8) endpoint validation 충돌 | 영향 없음 — DELETE 는 동일 검증된 endpoint 사용 | §6 |
| §4 `account_delete` (v1.1) ↔ `requestDataDeletion` 관계 | 의도적으로 직교 (전자: 계정 인텐트 / 후자: device-level GDPR Article 17) — 자동 발화 X 가 정확한 결정. 단 **NIT-1** 문서 명시 권장 | §8 |
| §5 `eodin_enabled` cross-platform key 정합 | **MEDIUM-1** — Android 만 `enabled` (namespaced inside `eodin_analytics_prefs`) | §9 |
| §6 API server `/user-data` schema 정합 | **HIGH-2** — `app_id` schema 미수용, multi-tenant 데이터 cross-deletion 가능 | §10 |
| §6 apiKeyAuth 통과 | 통과 — `X-API-Key` 헤더 4채널 모두 송신, 서버 미들웨어 매칭 | §10.2 |

---

## 2. 변경 파일 인벤토리 (Phase 1.7)

| 파일 | 라인 | GDPR 메서드 | 비고 |
|------|------|-------------|------|
| `packages/sdk-flutter/lib/src/analytics/eodin_analytics.dart` | 339 / 346 / 358 | reference (변경 없음) | v1.0 부터 보유 |
| `packages/sdk-ios/Sources/EodinAnalytics/EodinAnalytics.swift` | 283 / 294 / 310 | 신규 | reference 채널 |
| `packages/capacitor/ios/Sources/EodinCapacitorPlugin/EodinAnalytics.swift` | 270 / 275 / 282 | 신규 | bundled (reference 와 거의 1:1 복제) |
| `packages/capacitor/ios/Sources/EodinCapacitorPlugin/EodinCapacitorAnalyticsPlugin.swift` | 19~22, 124~141 | bridge | `pluginMethods` 배열 + 3개 `@objc` |
| `packages/sdk-android/src/main/java/app/eodin/analytics/EodinAnalytics.kt` | 361 / 374 / 396 | 신규 | reference 채널 |
| `packages/capacitor/android/src/main/java/app/eodin/analytics/EodinAnalytics.kt` | 359 / 370 / 386 | 신규 | bundled (reference 와 거의 1:1 복제) |
| `packages/capacitor/android/src/main/java/app/eodin/capacitor/EodinCapacitorAnalyticsPlugin.kt` | 138~159 | bridge | 3개 `@PluginMethod` |
| `packages/capacitor/src/definitions.ts` | 36~38 | interface | positional API 가 별도 wrapper 에 있음 |
| `packages/capacitor/src/index.ts` | 27~40, 80~90 | wrapper | bridge 객체 우회 wrapper (Object.create + Object.assign) |
| `packages/capacitor/src/web.ts` | 400~462 | Web 구현 | localStorage / fetch / clearLocalData |

테스트 파일:
- `packages/sdk-flutter/test/gdpr_test.dart` (신규, 5 tests)
- `packages/sdk-ios/Tests/EodinAnalyticsTests/GDPRTests.swift` (신규, 3 tests — 약함, §11 NIT-3 참조)
- `packages/sdk-android/src/test/java/app/eodin/analytics/GDPRTest.kt` (신규, 3 compile-time API surface tests — 약함, §11 NIT-3 참조)
- `packages/capacitor/src/__tests__/web.test.ts` lines 355~428 (6 tests — 가장 충실)
- `packages/capacitor/src/__tests__/definitions.test.ts` lines 109~155 (interface shape pinning)

---

## 3. §1 — `setEnabled(false)` 후 이벤트 차단 검증

### 3.1 Track guard — 4채널 모두 정합

| 채널 | guard 위치 | 동작 |
|------|-----------|------|
| Flutter | `eodin_analytics.dart:150` | `if (!_isEnabled) return;` — silent drop |
| iOS reference | `EodinAnalytics.swift:151` | `guard shared.isEnabled else { return }` |
| iOS bundled (Capacitor) | `EodinAnalytics.swift:138` | 동일 |
| Android reference | `EodinAnalytics.kt:198` | `if (!isEnabledFlag) return` |
| Android bundled (Capacitor) | `EodinAnalytics.kt:198` | 동일 |
| Web (Capacitor) | `web.ts:231` | `if (!this.isEnabledSync()) return;` |

4채널 모두 (1) 같은 위치 (eventName 들어온 직후 / event 객체 생성 전) 에 (2) silent drop (no-op return) 정책으로 (3) 동일하게 구현. ✓

### 3.2 Re-enable (`setEnabled(true)`) — 4채널 모두 정합

`setEnabled(true)` → `_isEnabled = true` → 다음 `track()` 부터 정상 enqueue. capacitor `web.test.ts:374~381` 에 검증.

### 3.3 큐 잔여 이벤트 정책 — **HIGH-1**

```
시나리오:
  T0: track('subscribe_start') → 큐에 enqueue (오프라인)
  T1: setEnabled(false)        → 사용자 GDPR opt-out
  T2: 네트워크 복구            → EventQueue.flush() 자동 발화
  T3: subscribe_start 가 서버에 도달 ❌ (사용자 의도 위반)
```

4채널 모두 `setEnabled(false)` 가:
- 신규 `track()` 호출 차단 ✓
- 큐의 잔여 이벤트는 **그대로 둠** — 다음 자동 flush 또는 lifecycle hook (web.ts 의 `flushOnExit`) 에서 송신됨

iOS `EodinAnalytics.swift:289~293` 도 docstring 에서 명시:
> Already-queued events stay in the queue until `requestDataDeletion()` is called or the queue naturally flushes

"queue naturally flushes" 가 곧 "서버로 송신" 을 의미하므로, 사용자가 `setEnabled(false)` 를 호출한 시점부터 송신되는 잔여 이벤트는 **사용자 동의 없이 송신** 되는 셈. GDPR Recital 32 ("freely given, specific, informed, unambiguous indication") 준수 모호.

**권장 수정**:
- (A) `setEnabled(false)` → `EventQueue.clear()` 로 큐 비우기 (가장 보수적, 권장)
- (B) `setEnabled(false)` → 큐 flush 자체를 차단 (`flush()` 진입 시 `if (!isEnabled) return`)
- (C) docstring 으로만 "host app 이 직접 `flush()` 또는 `clear()` 호출하라" 로 위임 (가장 약함)

→ (A) 채택 권장. Phase 1.7 의 의도가 "Flutter parity" 였으니 Flutter 부터 수정 후 4채널 동기화. Flutter 는 EventQueue 에 `clear()` API 가 이미 있으면 그걸 호출, 없으면 `EventQueue.instance.reset()` 으로 갈음 가능 (단 reset 은 enabled flag 도 리셋하므로 별도 메서드 필요).

**Severity**: HIGH — GDPR 컴플라이언스 직결, 단위 테스트가 잡지 못함 (테스트는 "신규 track() 차단" 만 검증).

---

## 4. §2 — `requestDataDeletion` Article 17 정합

### 4.1 — **CRITICAL-1**: API endpoint path mismatch (404 보장)

SDK 가 송신하는 URL:

| 채널 | URL 조립 | 결과 |
|------|---------|------|
| Flutter | `Uri.parse('$_apiEndpoint/user-data')` (`eodin_analytics.dart:369`) | `https://api.eodin.app/api/v1/user-data` |
| iOS reference | `URL(string: "\(endpoint)/user-data")` (`EodinAnalytics.swift:316`) | 동일 |
| iOS bundled | `EodinAnalytics.swift:288` | 동일 |
| Android reference | `URL("$endpoint/user-data")` (`EodinAnalytics.kt:410`) | 동일 |
| Android bundled | `EodinAnalytics.kt:400` | 동일 |
| Web | `fetch('${this.apiEndpoint}/user-data', …)` (`web.ts:433`) | 동일 |

서버 실제 라우팅 (`apps/api/src/index.ts:114`):
```ts
app.use('/api/v1/events', analyticsRoutes);
```
+ `apps/api/src/routes/analytics.ts:74~78`:
```ts
router.delete('/user-data', apiKeyAuth, analyticsApiController.deleteUserData);
```

→ 실제 서버 경로: **`DELETE /api/v1/events/user-data`**
→ SDK 가 호출하는 경로: **`DELETE /api/v1/user-data`**
→ **404 보장**. SDK 는 `httpResponse.statusCode == 200 || == 202` 가 아니므로 `success=false` 반환, 그러나 `clearLocalData()` 는 항상 실행 — **로컬은 정리되지만 서버의 `analytics_events` / `device_attributions` / `attr:${device_id}` Redis 캐시는 그대로 남음**.

**Article 17 위반 검증**:
- Article 17(1) 은 controller 가 "without undue delay" 데이터를 erase 할 의무 — 서버 데이터가 남으므로 위반.
- SDK 는 `success: false` 를 반환하지만 host 앱이 이를 사용자에게 명확히 표시하지 않으면 사용자는 "삭제 완료" 로 오인할 가능성 큼.

이 결함은 4채널 단위 테스트가 못 잡는 이유:
- Flutter `gdpr_test.dart:75~103`: MockClient 가 모든 URL 에 200 반환 → 경로 검증 없음 (`expect(capturedBody['device_id'], isNotNull)` 만 검증, URL 검증 누락)
- iOS `GDPRTests.swift:55~58`: 네트워크 호출 실제 발화하지만 테스트가 SKIP 조건 (`isConfigured` false) 임
- Android `GDPRTest.kt`: API surface compile-time 만 검증, 호출 자체가 없음
- Capacitor `web.test.ts:390~408`: `expect(fetchMock).toHaveBeenCalledWith('https://api.eodin.app/api/v1/user-data', …)` — **잘못된 경로를 잘못된 fixture 로 검증** (서버와 path 비교 안 함)

**권장 수정 (택1)**:

| 옵션 | 작업 | 영향 |
|------|------|------|
| A. SDK 4채널 모두 `${endpoint}/events/user-data` 로 변경 | 4채널 + capacitor wrapper 동시 수정 | 서버 코드 무변경 |
| B. 서버 라우팅을 `/api/v1` 직속으로 옮기기 (`app.use('/api/v1/privacy', privacyRoutes)` 등 신설) | 서버 1줄 + DRY 유지 | SDK 무변경, 다만 `/events` 외부에 새 router 분리 필요 |
| C. 서버 `/api/v1/events/user-data` + `/api/v1/user-data` 양쪽 마운트 (alias) | 6줄 정도 | 양쪽 호환, 그러나 향후 deprecate 비용 |

→ **A 채택 권장**. 이유:
- (1) `/events/user-data` 는 라우팅 의미상 정확 (event 도메인의 GDPR 삭제) — 서버 의도 그대로
- (2) SDK 가 아직 release 전 (Phase 1.7 진행 중) — 호환성 부담 없음
- (3) `requestDataDeletion` 에 단위 테스트 fixture 도 정확한 경로로 통일 가능
- (4) `analyticsApiService.ts:8~9` 의 docstring 이 `/api/v1/user-data` 로 잘못 작성되어 있음 — A 와 함께 docstring 도 `/api/v1/events/user-data` 로 수정 필요

**Severity**: **CRITICAL** — 모든 GDPR 삭제 요청이 server-side 에서 실패. 단위 테스트 통과는 fixture 자체 오류 (NIT-2 §11 참조).

### 4.2 네트워크 실패 시 로컬 정리 보장 — 4채널 통과

| 채널 | 패턴 | 검증 |
|------|------|------|
| Flutter | try/catch/finally + `clearLocalData` 항상 호출 (line 393~395) | `gdpr_test.dart:105~122` |
| iOS reference | `task` 콜백 안에서 `clearLocalData()` 항상 호출 (line 343~347) | 단위 테스트 부재 (네트워크 실패 path) |
| iOS bundled | 동일 (line 315~317) | 동일 |
| Android reference | `try/catch (Exception) { false }` 후 `clearLocalData()` (line 421~438) | 단위 테스트 부재 |
| Android bundled | 동일 (line 421~426) | 동일 |
| Web | `try/catch` 후 `clearLocalData()` 항상 호출 (line 432~453) | `web.test.ts:410~420` |

설계는 4채널 모두 동일. 단 iOS / Android 는 네트워크 실패 path 의 단위 테스트가 없음 (NIT-3 §11 참조).

### 4.3 정리 항목 일치성 — 4채널 거의 정합 (1건 비대칭)

| 채널 | clearLocalData 정리 항목 |
|------|--------------------------|
| Flutter | device_id, user_id, attribution, session_id, session_start, **enabled**, EventQueue (line 499~509) |
| iOS reference | device_id, user_id, attribution, session_id, session_start, **enabled**, EventQueue (line 364~371) |
| iOS bundled | 동일 (line 334~341) |
| Android reference | `prefs.edit().clear()` (line 449~454) — **prefs 파일 통째로 비움** (모든 키 일괄 삭제, EventQueue 별도 reset) |
| Android bundled | 동일 (line 437~442) |
| Web | `STORAGE_KEYS` 모든 값 + queue (line 457~462) |

Android 의 `clear()` 는 prefs 파일이 SDK 전용 namespace (`eodin_analytics_prefs`) 라 의미적으로 동등. ✓

**비대칭 1건**: 모든 채널이 `clearLocalData` 의 마지막에 `isEnabled = true` (메모리) 또는 `eodin_enabled` 키 삭제 (storage) 로 **GDPR opt-out 상태를 리셋**. → §5 HIGH-3 참조.

---

## 5. §2 — 정리 후 `track()` 동작 검증 — **CRITICAL-2**

```
시나리오:
  T0: configure(...)
  T1: track('app_open')          → enqueue OK
  T2: requestDataDeletion()      → device_id, user_id 등 null 처리; apiEndpoint/apiKey/appId 는 유지
  T3: track('app_open')          → 어떻게 되는가?
```

| 채널 | T3 동작 | 결과 |
|------|---------|------|
| Flutter | `isConfigured` true (apiEndpoint/apiKey/appId 살아있음) → `_isEnabled` true (clearLocalData 가 다시 true 로 셋) → `deviceId: _deviceId!` 에서 `_deviceId == null` → **NoSuchMethodError** | **CRASH** |
| iOS reference | `isConfigured` true → `guard let deviceId = shared.deviceId else { return }` 의 `let` 바인딩이 nil 매칭 실패 → silent return | OK (silent drop) |
| iOS bundled | 동일 | OK |
| Android reference | `isConfigured` true → `deviceId = deviceId!!` (line 206) → **NullPointerException** (KotlinNullPointerException via `!!`) | **CRASH** |
| Android bundled | 동일 | **CRASH** |
| Web | `isConfigured()` true → `device_id: this.readStorage(STORAGE_KEYS.deviceId)!` 가 `null` 반환 — TS non-null assertion 무시되므로 `device_id: null` 인 event 가 enqueue됨 | 잘못된 페이로드 송신, 서버에서 zod 검증 실패 |

**근본 원인**: `clearLocalData()` 가 `apiEndpoint / apiKey / appId` 를 정리하지 않아 `isConfigured` 가 여전히 true 인 상태인데, **state guard (`isConfigured`) 와 actual data guard (`deviceId != null`) 가 분리되어 있음**.

**4채널 일관 동작 명세 권장 (택1)**:
- (A) `clearLocalData()` 가 `apiEndpoint / apiKey / appId` 도 같이 nil 처리 → `isConfigured` 가 false 반환 → `track()` 진입부 가드에서 silent return. 다만 host 앱이 다시 `configure()` 를 호출해야 함 (호스트 리팩터 부담 — 기존 host 들이 `requestDataDeletion` 후 재configure 하지 않을 수도 있음).
- (B) `track()` 의 진입 가드를 강화 — `if (!isConfigured || _deviceId == null) return;`. 4채널 모두 동일 패턴 적용. 호스트 부담 0, 단 host 가 재configure 호출하지 않으면 track 이 silent 하게 무시됨 (디버그 로그 필요).
- (C) `requestDataDeletion()` 후 `_deviceId` 를 새 UUID 로 즉시 재발급 + storage 에 저장. 그러나 이는 GDPR "right to erasure" 와 충돌 — 새 device_id 로 재식별 가능. 부적절.

→ **(B) 채택 권장**. 이유: host 앱이 deletion 후 어떤 흐름을 가질지 SDK 가 강제하지 않고, "configure 안 거치면 안 보내야 함" 요구를 4채널 모두 silent-no-op 으로 통일.

iOS 가 우연히 통과한 것은 Swift 의 `guard let` 때문으로 의도된 robustness 가 아님 — 명시적 가드 추가 필수.

**Severity**: **CRITICAL** — Flutter / Android 에서 production crash 가능 (host 앱이 deletion 후 즉시 다른 화면으로 navigate 하면서 track() 호출 시 발생), Web 에서 invalid payload, 채널 간 동작 비대칭.

---

## 6. §3 — 기존 Phase 회귀 영향 검증

### 6.1 Phase 1.6 (S9) EodinEvent enum / forbidden v1 names / wire-format

| 회귀 risk | 결과 |
|-----------|------|
| GDPR 메서드가 새 이벤트를 추가하는가? | No (track/trackEvent 호출 0건) |
| GDPR 메서드가 기존 EodinEvent enum 에 영향? | No |
| forbidden v1 names (`recipe_generated_legacy` 등) 회피 검증 | 무관 |
| wire-format mapping (camelCase ↔ snake_case) 변경? | No — `requestDataDeletion` 의 body 는 `device_id` / `user_id` / `app_id` 그대로 snake_case |

영향 없음. ✓

### 6.2 Phase 1.9 web.ts queue mutex / quota / lifecycle

| 회귀 risk | 결과 |
|-----------|------|
| `setEnabled` 가 queue lock 진입? | No — localStorage 단일 키 R/W 만 (`STORAGE_KEYS.enabled`) |
| `requestDataDeletion` 의 `clearLocalData()` 가 queue mutex 사용? | **No — §7.2 MEDIUM-2** |
| `flushOnExit` (lifecycle) 가 disabled 상태 무시 가능? | **Yes — §7.3 MEDIUM 후속** |
| Quota error 처리에 GDPR 영향? | No |

queue mutex 미사용은 §7.2 에서 MEDIUM 으로 별도 분석.

### 6.3 Phase 1.6 (S8) endpoint validation 충돌

`requestDataDeletion` 은 `configure()` 시점에 이미 검증된 `_apiEndpoint` / `apiEndpoint` 를 그대로 사용 → 신규 검증 불필요. ✓

### 6.4 `analyticsRateLimiter` 적용 여부

`apps/api/src/routes/analytics.ts`:
- `/collect` 는 `analyticsRateLimiter` 미들웨어 적용
- `/user-data` 는 미들웨어 미적용 (apiKeyAuth 만)

→ DELETE 가 rate-limit 우회 → 악의적 deletion 폭주 가능성. 다만 SDK 측에서는 한 번만 호출하는 흐름이라 직접적 risk 는 낮음. **NIT-4** 로 분류.

---

## 7. §3 — 동시성 / 큐 안전성

### 7.1 `setEnabled` 동시성

4채널 모두 단일 boolean flag write — atomic 으로 간주 가능. capacitor web 은 localStorage 동시 쓰기에서 lost-update 가능하지만 boolean 키 1개라 영향 무시 가능. ✓

### 7.2 — **MEDIUM-2**: `clearLocalData` 가 queue mutex 미사용 (Web)

```
시나리오 (multi-tab):
  Tab A: track('app_open')          → withQueueLock 으로 queue read-modify-write 진행 중
  Tab B: requestDataDeletion()      → clearLocalData() 가 STORAGE_KEYS.queue 직접 removeStorage

→ Tab A 의 write 가 Tab B 의 remove 와 race → A 의 신규 이벤트가 살아남을 수 있음
   (사용자가 deletion 직후 재방문할 때까지 localStorage 에 남음)
```

**위험도**: 낮음 (Tab A 가 deletion 직전에 track 발화하는 시간창 매우 좁음). 그러나 Article 17 의 엄격 해석 (server 도달 전 모든 사본 삭제) 을 위해 `clearLocalData()` 도 `withQueueLock` 으로 감싸는 것 권장.

**Severity**: MEDIUM — 실제 발생 빈도 낮으나 GDPR 보수적 해석 시 결함.

### 7.3 — `flushOnExit` 가 disabled 상태에서도 큐 송신

`web.ts:647~670` 의 `flushOnExit()` 은 `setEnabled(false)` 상태 검사 없음 — 사용자가 페이지 떠나면서 자동 flush 되어 disabled 상태에서도 잔여 이벤트가 sendBeacon 으로 송신됨. §3.3 HIGH-1 의 web 에서의 구체적 케이스. 수정 시 `flushOnExit` 에도 `isEnabledSync()` 체크 추가 (또는 §3.3 권장 (A) "큐 비우기" 적용 시 자동 해결).

→ HIGH-1 의 sub-case 로 묶어 함께 수정 권장.

---

## 8. §4 — `account_delete` ↔ `requestDataDeletion` 관계

| 이벤트/메서드 | 의미 | 트리거 |
|--------------|------|--------|
| `account_delete` (analytics event v1.1) | Eodin 계정 삭제 (cross-app cascade) | `EodinAuth.deleteAccount` (별도 Auth 트랙 — Phase 2.x) |
| `requestDataDeletion` (analytics SDK method) | device-level GDPR Article 17 삭제 | host 앱 settings 화면 |

두 개념은 **의도적으로 직교**:
- `account_delete` 는 인텐트 시그널 — `reason` (`not_using` / `privacy_concern` / 등) 을 기록하기 위한 마지막 분석 이벤트
- `requestDataDeletion` 은 데이터 삭제 행위 자체 — analytics 데이터 자체를 지우므로 자기-참조 이벤트를 발화할 수 없음 (paradox)

**현재 동작 (자동 발화 X) 이 정확함**. 단:

- (1) `EodinAuth.deleteAccount` 가 도입되면 그 안에서 (a) `track('account_delete', {reason})` 발화 → flush (b) `requestDataDeletion()` 호출 의 2단계가 권장 흐름이 됨. 이 cascade 는 Auth 트랙이 정의해야 함.
- (2) **NIT-1**: `unified-event-reference.md` 에 "`requestDataDeletion` 은 `account_delete` 를 자동 발화하지 않음 — host 앱이 명시적으로 호출 후 삭제할 것" 명시 권장.

`docs/unified-id-and-sdk-v2/PRD.md` 의 Identity 섹션이 별도 Auth 트랙으로 분리된 것과 정합. ✓

---

## 9. §5 — Cross-platform storage key 정합 — **MEDIUM-1**

| 채널 | storage backend | full key | namespaced? |
|------|----------------|----------|-------------|
| Flutter | SharedPreferences (iOS UserDefaults / Android SharedPreferences default file) | `eodin_enabled` | flat |
| iOS reference | UserDefaults.standard | `eodin_enabled` | flat |
| iOS bundled | UserDefaults.standard | `eodin_enabled` | flat |
| Android reference | SharedPreferences("eodin_analytics_prefs") | **`enabled`** (namespaced) | namespaced |
| Android bundled | SharedPreferences("eodin_analytics_prefs") | **`enabled`** (namespaced) | namespaced |
| Web (Capacitor) | localStorage | `eodin_enabled` | flat |

요청 §5 에서 "`eodin_enabled` 가 4채널 동일 키" 라고 했지만 **Android 만 비대칭**:
- Android 는 `KEY_ENABLED = "enabled"` 를 prefs 파일 `"eodin_analytics_prefs"` 안에 저장
- 다른 채널은 모두 `eodin_enabled` flat 키

**실제 host-app 영향**:
- 호스트 앱이 native iOS + Capacitor 동시 사용 시: 둘 다 `UserDefaults.standard` 의 `eodin_enabled` 를 공유 → 동기화 OK
- 호스트 앱이 native Android + Capacitor 동시 사용 시: 둘 다 `eodin_analytics_prefs` 파일의 `enabled` 키를 공유 → 동기화 OK (Android 는 비대칭이지만 자기 안에서는 정합)
- Flutter 와 native iOS 동시 사용 시: Flutter `shared_preferences` 의 iOS 구현은 `NSUserDefaults` 의 키 prefix `flutter.` 자동 추가 — Flutter 에서 `eodin_enabled` 는 실제로 `flutter.eodin_enabled` 로 저장됨 → native iOS 와 **불일치**. 단, host 앱이 Flutter+native 혼용은 매우 드문 시나리오.

**현실적 영향**: 호스트 앱은 1채널만 쓰는 게 일반적이므로 cross-platform 동기화는 비기능 요구. 그러나 코드 일관성 / 향후 share extension / app group 등 advanced 시나리오에서 brittleness.

**권장 수정**:
- Android 의 KEY_ENABLED 를 `"eodin_enabled"` 로 변경 (마이그레이션 필요 — 기존 사용자 데이터 손실)
- 또는 docstring 으로 "platform 별 storage 가 다름 — host 앱이 cross-platform sync 가 필요한 경우 자체 sync layer 구현 필요" 명시

→ Phase 1.7 시점에서는 **NIT 로 분류, 명시 + 마이그레이션 가이드만 추가** 권장. 진짜 cross-platform sync 가 필요해지면 Phase 2.x 에서 재검토.

**Severity**: MEDIUM (이론) / NIT (현실 영향).

---

## 10. §6 — API server `/user-data` schema 정합

### 10.1 — **HIGH-2**: `app_id` schema 미수용 → multi-tenant cross-deletion

`apps/api/src/services/analyticsApiService.ts:814`:
```ts
const DeleteDataSchema = z.object({
  device_id: z.string().uuid(),
});
```

zod 의 default 는 `z.object` 가 unknown keys 를 strip 하므로 SDK 가 보내는 `app_id` / `user_id` 는 **silently 무시됨**.

`deleteUserData` 의 실제 동작 (line 826~874):
```ts
const deletedEvents = await prisma.analyticsEvent.deleteMany({
  where: { deviceId: device_id },  // ← appId 필터 없음
});
await prisma.deviceAttribution.deleteMany({
  where: { deviceId: device_id },  // ← appId 필터 없음
});
await redis.del(`attr:${device_id}`);
```

**보안 / multi-tenancy 위협**:
- API 키는 `apiKeyAuth` 미들웨어를 통과 (`req.apiKey.appId` 필드 존재) 하지만, **deleteUserData 가 이 필드를 무시**.
- 시나리오: app A 의 API 키를 가진 클라이언트가 device_id `xyz` 의 deletion 을 요청 → device_id `xyz` 가 다른 app B 에서도 사용 중이면 **app B 의 데이터까지 삭제됨**.
- device_id 는 SDK가 매 앱마다 독립 생성 (UUID v4) 하므로 collision 확률 극히 낮음 — 그러나 **악의적 host 가 다른 앱의 device_id 를 어떤 경로로 입수했다면 cross-app deletion 이 가능** (예: shared device fingerprint, 같은 사용자의 multi-app 사용 흔적).
- `checkAppPermission(appId)` 미들웨어 (`apiKeyAuth.ts:138`) 가 정의되어 있지만 `/user-data` 라우트에 적용 안 됨.

**권장 수정** (3건 동시 적용):
1. `DeleteDataSchema` 에 `app_id: z.string().min(1)` 추가 (required).
2. `prisma.analyticsEvent.deleteMany` / `deviceAttribution.deleteMany` 의 where 절에 `appId: app_id` 추가.
3. `apiKey.appId` 가 null 이 아닌 경우 (= 특정 앱 전용 키) `app_id` 입력값과 일치 검증 — `checkAppPermission(req.body.app_id)` 적용.

**Severity**: HIGH — multi-tenancy bypass 의 실질 위협 + `app_id` 검증 자체가 schema 단계에서 강제되지 않으면 SDK 가 누락해도 서버가 받아들이는 형태로 silent failure.

### 10.2 apiKeyAuth 통과 검증

| 항목 | 결과 |
|------|------|
| SDK 가 `X-API-Key` 헤더 송신 | 4채널 모두 ✓ (Flutter line 373, iOS line 326, Android line 416, Web line 439) |
| `apiKeyAuth` 미들웨어가 `x-api-key` 헤더 매칭 | ✓ (line 34, lowercase 매칭) |
| `apiKey.expiresAt` / `isActive` 검증 | ✓ (line 71, 103) |
| Bearer token 전혀 미사용 | ✓ (이전 admin auth 와 무관, 분리 정합) |

apiKey 인증은 정합 통과.

### 10.3 body 스키마 vs SDK payload 비교

| 필드 | SDK 송신 | 서버 schema | 영향 |
|------|---------|-------------|------|
| `device_id` (UUID) | 필수, 4채널 송신 | `z.string().uuid()` 필수 | ✓ |
| `app_id` | 필수, 4채널 송신 | **schema 누락** | HIGH-2 |
| `user_id` | optional, 식별된 경우 송신 | schema 누락 | 무시되어도 무관 (DELETE 는 device 단위) |

SDK 가 `device_id` 를 UUID 로 생성하므로 `z.string().uuid()` 검증 통과. 단 만약 host 앱이 외부 device_id (FCM token 등) 를 SDK 외부에서 강제 주입했다면 fail — Phase 1.7 범위에서는 신경 쓸 필요 없음.

---

## 11. NIT 항목

### NIT-1: `unified-event-reference.md` 에 GDPR 메서드 ↔ `account_delete` 관계 명시
- 현재 `account_delete` 는 reference v1.1 에 있지만 `requestDataDeletion` 과의 분리가 문서로 명시되지 않음.
- 권장 추가 (§2 Authentication / Identity 표 아래 또는 별도 §"GDPR / Privacy Methods" 섹션):
  ```
  > **Note**: `EodinAnalytics.requestDataDeletion()` (device-level GDPR Article 17)
  > does NOT auto-fire `account_delete`. Host apps that want both effects must
  > call `track('account_delete', {reason})` → `flush()` → `requestDataDeletion()`
  > in sequence. The reverse order would lose the `account_delete` event.
  ```

### NIT-2: 단위 테스트 fixture 의 URL 검증 강화
- Flutter `gdpr_test.dart`: MockClient 가 모든 URL 을 200 으로 받아주므로 §4.1 CRITICAL-1 (path mismatch) 를 잡지 못함. `request.url.toString()` 검증 추가.
  ```dart
  expect(request.url.path, '/api/v1/events/user-data');
  ```
- Capacitor `web.test.ts:395`: `'https://api.eodin.app/api/v1/user-data'` 로 fixture 가 잘못된 경로를 정답으로 간주. CRITICAL-1 수정 후 fixture 도 `/events/user-data` 로 동기화 필요.

### NIT-3: iOS / Android 단위 테스트 보강
- `GDPRTests.swift` 는 conditional skip (line 51) 으로 실효성 약함. `URLProtocol` mocking 또는 `URLSession` 주입으로 네트워크 path 검증 권장.
- `GDPRTest.kt` 는 compile-time API surface check 만 — Robolectric 또는 androidTest/ 로 actual SharedPreferences / `HttpURLConnection` mocking 보강 권장. 최소한 host-app CI 에 instrumentation 테스트 추가.

### NIT-4: `/user-data` 에 `analyticsRateLimiter` 적용
- `/collect` 는 적용되어 있지만 `/user-data` 는 미적용. 악의적 deletion 폭주 방지를 위해 동일 (또는 더 보수적) limiter 적용 권장.
- 영향 작음 — host 앱이 정상 흐름으로 보내는 deletion 은 sparse.

---

## 12. Funnel Coverage (이번 audit 범위 외 — 정보용)

이 audit 은 GDPR surface 단독 이라 funnel coverage 점수는 산정하지 않음. 단 Phase 1.9 logging audit 에서 산정한 "EodinEvent enum 22건 = unified-event-reference v1.1 의 핵심 funnel 100% 커버" 는 Phase 1.7 변경으로 영향 받지 않음.

---

## 13. 종합 권장 액션 (우선순위)

| # | Severity | 작업 | 위치 | 예상 분량 |
|---|----------|------|------|-----------|
| 1 | CRITICAL-1 | SDK 4채널 모두 `${endpoint}/user-data` → `${endpoint}/events/user-data` 로 수정 | 6 파일 (4 native + capacitor wrapper x2 in dist 재빌드 시 자동) | 6줄 |
| 2 | CRITICAL-1 | 단위 테스트 fixture URL 정정 | flutter `gdpr_test.dart`, capacitor `web.test.ts` | 4줄 |
| 3 | CRITICAL-1 | `analyticsApiService.ts:8~9` docstring 의 `/api/v1/user-data` 를 `/api/v1/events/user-data` 로 수정 | 1 파일 | 2줄 |
| 4 | CRITICAL-2 | 4채널 `track()` 진입 가드에 device_id null check 추가 (§5 권장 (B)) | 4 파일 | 8줄 (각 채널 1조건) |
| 5 | HIGH-1 | `setEnabled(false)` → 큐 잔여 이벤트 비우기 (§3.3 권장 (A)) | 4 파일 + EventQueue clear API | 20줄 |
| 6 | HIGH-2 | API `DeleteDataSchema` 에 `app_id` 추가 + `deleteMany` where 절에 appId 필터 + `checkAppPermission` 적용 | `analyticsApiService.ts` | 10줄 |
| 7 | HIGH-3 | `clearLocalData()` 가 `isEnabled = true` 로 강제 리셋하는 부분 제거 — 사용자 opt-out 의도 보존 | 4 파일 | 4줄 |
| 8 | MEDIUM-1 | Android `KEY_ENABLED = "eodin_enabled"` 통일 + `unified-event-reference.md` 에 storage key 표 추가 | 2 파일 + docs | 6줄 |
| 9 | MEDIUM-2 | Web `clearLocalData()` 를 `withQueueLock` 안에서 실행 | `web.ts` | 4줄 |
| 10 | MEDIUM-3 | iOS reference / capacitor-bundled `EodinAnalytics.swift` 중복 → shared source 또는 generator | infra | 별도 phase |
| 11 | NIT-1 | `unified-event-reference.md` 에 `account_delete` ↔ `requestDataDeletion` 관계 명시 | docs | 6줄 |
| 12 | NIT-2 | 단위 테스트 URL 검증 강화 (CRITICAL-1 수정과 함께) | 2 테스트 파일 | 4줄 |
| 13 | NIT-3 | iOS / Android 단위 테스트 mocking 강화 | 2 테스트 파일 | 별도 phase |
| 14 | NIT-4 | `/user-data` 에 rate limiter 적용 | `analytics.ts` | 1줄 |

---

## 14. 결론

Phase 1.7 의 **API 표면 통일 의도는 정확히 구현** 되었음 — Flutter 가 보유한 `setEnabled` / `isEnabled` / `requestDataDeletion` 3종 surface 가 iOS / Android / Capacitor (TS bridge + Web) 4채널에 1:1 정합으로 추가됨. 시그니처, callback semantics (`(Bool) -> Unit` / `(Bool) -> Void` / `Promise<boolean>`), storage key 명명 (1건 비대칭 제외), header / body schema 모두 일관됨.

그러나:

- **CRITICAL-1** (API path mismatch) 는 단위 테스트가 통과해도 production 에서 server-side erasure 가 실패하는 release-blocking 결함. 단위 테스트 fixture 자체에 잘못된 URL 이 hardcode 되어 self-confirming bias 가 발생.
- **CRITICAL-2** (post-deletion track crash) 는 host 앱의 production crash 를 유발할 수 있는 결함. iOS 만 우연히 robust 하게 통과하는 비대칭이 추가 위험.
- **HIGH-1** (queued events 가 disabled 상태에서도 송신) 은 GDPR Recital 32 의 "freely given consent" 해석 모호성을 만듦.
- **HIGH-2** (서버 `app_id` schema 누락) 는 multi-tenant cross-deletion 가능성.
- **HIGH-3** (`clearLocalData` 의 `isEnabled = true` 강제) 는 사용자 opt-out 의도를 silent 하게 파괴.

위 5건 fix 후 Phase 1.7 통과 인정 권장. MEDIUM / NIT 는 Phase 2.x 또는 별도 chore commit 으로 분리 가능.

**다음 단계**:
1. CRITICAL-1, CRITICAL-2, HIGH-1, HIGH-2, HIGH-3 5건 fix
2. 단위 테스트 fixture URL 정정 (CRITICAL-1 의 회귀 가드)
3. `unified-event-reference.md` 에 GDPR 메서드 섹션 추가 (NIT-1)
4. 재검토 (logging-agent) 및 senior-code-reviewer 통과 후 Phase 1.7 종결

---

_End of audit._
