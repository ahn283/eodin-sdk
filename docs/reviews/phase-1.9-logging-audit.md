# Phase 1.9 Logging Audit — Capacitor `web.ts` 동작화 (PWA 분석 수집)

**Date**: 2026-05-02
**Auditor**: logging-agent
**Mode**: AUDIT (SDK + wire-format scope)
**Scope**:
- `libs/eodin-sdk/packages/capacitor/src/web.ts` (throw-only v1 → 전면 동작화 v2)
- `libs/eodin-sdk/packages/capacitor/src/__tests__/web.test.ts` (16 tests)
- `libs/eodin-sdk/packages/capacitor/src/__tests__/setup.ts` (localStorage shim)
- 정합 기준: `apps/api/src/services/analyticsService.ts` (변경 없음)
- 정합 기준: `docs/logging/unified-event-reference.md` v1.1 (변경 없음)

**Out of scope** (별도 phase 로 이관):
- 5개 호스트 앱 마이그 audit → Phase 5
- kidstopia PWA 호스트 측 트래킹 호출부 (Phase 1.9 는 SDK 단의 동작화만)
- mobile↔web cross-device tracking → Phase 1-Auth (Identity API)

**기준 문서**:
- `docs/logging/unified-event-reference.md` v1.1 §1 Lifecycle (Phase 1.6 신설)
- `docs/unified-id-and-sdk-v2/open-issues.md` §4.5 (GDPR surface)
- `docs/unified-id-and-sdk-v2/reviews/phase-1.6-logging-audit.md` (선행 audit)
- `apps/api/src/services/analyticsService.ts` L12-50 (Zod Schemas)

---

## Summary

| Severity | Count | 영역 |
|----------|-------|------|
| CRITICAL | 0 | — |
| HIGH | 1 | GDPR (4.5) — public `setEnabled` API 미구현 |
| MEDIUM | 2 | session_end 의 `duration_seconds` 누락 / `device.os` 생략으로 web 식별 불가 |
| NIT | 4 | 문서 / 마이그 가이드 / `STORAGE_KEYS` 외부 노출 / `app_open` 자동 발화 부재 |

**Verdict**: **Approve with follow-ups** — wire-format 정합성, 세션 자동 발화, `attributionToWire` 의 camelCase → snake_case 변환, fetch 페이로드 shape, queue/flush 안전성은 native 4채널 (Flutter/iOS/Android/Capacitor-native) 와 1:1 대응 검증 통과. 다만 (1) GDPR `setEnabled` public surface 부재로 §4.5 가 Phase 1.9 안에서 미해결 / (2) `session_end` 의 `duration_seconds` optional param 이 reference v1.1 에 명시되어 있지만 미발화 / (3) `device.os` 생략 시 분석 dashboard 에서 web traffic 을 구분할 메타데이터 없음 — 3건 후속 처리 필요. wire-format / breaking-change / 회귀 영역에는 결함 없음.

---

## 1. Wire-format 정합성 — `EventSchema` × `flush()` 페이로드 1:1 매핑

### 1.1 `EventSchema` (analyticsService.ts L35-46) vs `QueuedEvent` (web.ts L71-81)

| Schema field | Type / 제약 | `QueuedEvent` 대응 | web.ts 생성부 (track L192-201) | 결과 |
|---|---|---|---|---|
| `event_id` | `z.string().uuid()` | `event_id: string` | `uuid()` (v4 RFC4122) | ✅ |
| `event_name` | `z.string().min(1).max(100)` | `event_name: string` | `options.eventName` (호출부 책임) | ✅ |
| `app_id` | `z.string().min(1).max(50)` | `app_id: string` | `this.appId!` (configure 시 주입) | ✅ |
| `device_id` | `z.string().uuid()` | `device_id: string` | localStorage `eodin_device_id` (v4) | ✅ |
| `user_id` | `z.string().max(100).optional().nullable()` | `user_id: string \| null` | localStorage `eodin_user_id` | ✅ |
| `session_id` | `z.string().uuid().optional().nullable()` | `session_id: string \| null` | localStorage `eodin_session_id` (v4) | ✅ |
| `timestamp` | `z.string().datetime()` | `timestamp: string` | `new Date().toISOString()` (ISO 8601) | ✅ |
| `attribution` | `AttributionSchema.optional()` | `attribution?: Record<...>` | `JSON.parse(eodin_attribution)` | ✅ |
| `device` | `DeviceSchema.optional()` | — (필드 없음) | 생략 | ⚠️ M2 — 아래 §3 |
| `properties` | `z.record(z.unknown()).optional()` | `properties?: Record<string, unknown>` | `options.properties` | ✅ |

→ **9/10 fields 완전 정합**. `device` 만 web 환경에서 의도적 생략 (DeviceSchema 의 `os` enum 이 `'ios'|'android'` 만 허용 — web 으로 분류 불가). 분석 dashboard 영향은 §3 (M2) 참조.

### 1.2 `CollectEventsSchema` (analyticsService.ts L48-50) vs `flush()` body

```ts
// API expects:
CollectEventsSchema = z.object({
  events: z.array(EventSchema).min(1).max(100),
});

// web.ts L261:
body: JSON.stringify({ events: batch })
// where MAX_BATCH_SIZE = 50 (web.ts L69)
```

| 제약 | API 한도 | web.ts 한도 | 결과 |
|---|---|---|---|
| `events` array | min(1), max(100) | `MAX_BATCH_SIZE=50` | ✅ (API 한도의 절반) |
| 빈 배열 처리 | `.min(1)` 위반 시 400 | L246 `if (queue.length === 0) return` | ✅ (방어적 short-circuit) |

→ **정합 완료**. native 4채널 (Flutter `EventQueue.batchSize=20` / iOS `batchSize=50` / Android `batchSize=50`) 과도 동일 범위.

### 1.3 HTTP 헤더 정합

| 헤더 | API 측 expectation | web.ts L256-260 | 결과 |
|---|---|---|---|
| `Content-Type` | `application/json` (Express body-parser) | `'application/json'` | ✅ |
| `Accept` | (선택) | `'application/json'` | ✅ |
| `X-API-Key` | `req.apiKey?.appId` 매칭 (analyticsService.ts L332) | `this.apiKey!` | ✅ |

→ native SDK (Flutter `_dio.options.headers['X-API-Key']` / iOS URLRequest / Android OkHttp Interceptor) 와 동일 헤더 패턴.

---

## 2. `attributionToWire()` — camelCase → snake_case 변환 정합성

### 2.1 `AttributionSchema` (analyticsService.ts L12-24) vs `attributionToWire` (web.ts L106-122)

| API field | API 제약 | TS Attribution.* | web.ts L109-121 키 | 결과 |
|---|---|---|---|---|
| `source` | `z.enum(['meta','google','tiktok','linkedin','organic']).optional()` | `source?: string` | `source: attr.source` | ✅ |
| `campaign_id` | `z.string().max(100).optional()` | `campaignId?: string` | `campaign_id: attr.campaignId` | ✅ |
| `adset_id` | `z.string().max(100).optional()` | `adsetId?: string` | `adset_id: attr.adsetId` | ✅ |
| `ad_id` | `z.string().max(100).optional()` | `adId?: string` | `ad_id: attr.adId` | ✅ |
| `click_id` | `z.string().max(255).optional()` | `clickId?: string` | `click_id: attr.clickId` | ✅ |
| `click_id_type` | `z.enum(['fbclid','gclid','ttclid','li_fat_id']).optional()` | `clickIdType?: string` | `click_id_type: attr.clickIdType` | ✅ |
| `utm_source` | `z.string().max(100).optional()` | `utmSource?: string` | `utm_source: attr.utmSource` | ✅ |
| `utm_medium` | `z.string().max(100).optional()` | `utmMedium?: string` | `utm_medium: attr.utmMedium` | ✅ |
| `utm_campaign` | `z.string().max(100).optional()` | `utmCampaign?: string` | `utm_campaign: attr.utmCampaign` | ✅ |
| `utm_content` | `z.string().max(100).optional()` | `utmContent?: string` | `utm_content: attr.utmContent` | ✅ |
| `utm_term` | `z.string().max(100).optional()` | `utmTerm?: string` | `utm_term: attr.utmTerm` | ✅ |

→ **11/11 fields 완전 정합**. 테스트 (`web.test.ts` L200-217) 가 `utmSource→utm_source`, `clickId→click_id`, `clickIdType→click_id_type` 4건 어설션 cover.

### 2.2 `undefined` 직렬화 동작 검증

`attributionToWire()` 는 누락된 필드를 `undefined` 로 채워 11개 키를 항상 출력. `JSON.stringify(undefined-valued key)` 는 해당 키를 출력 결과에서 **드롭**하므로 (ECMA-262 §24.5.2 Step 11d), 페이로드에는 실제로 set 된 키만 포함됨. 즉:

```ts
attributionToWire({ utmSource: 'google' })
// → { source: undefined, campaign_id: undefined, ..., utm_source: 'google', ... }

JSON.stringify(...)
// → '{"utm_source":"google"}'   // undefined 키들 자동 드롭
```

이는 API의 `AttributionSchema` `optional()` 정합 — 누락 키는 검증 통과. ✅

**NIT N3** (아래 §6): `localStorage` 에 저장된 attribution 객체 (web.ts L237) 에는 `undefined` 가 직렬화 시 드롭된 11-N 개 키만 남음. 이후 `track()` L206 에서 `JSON.parse` 했을 때 누락된 키는 `undefined` 가 아닌 **존재하지 않음** 으로 복원되지만, API 측에서 이는 동일하게 처리 (Zod `optional()`) 되므로 회귀 없음.

---

## 3. Device 정보 — web 사용자 식별 가능 여부

### 3.1 현재 동작

`web.ts` 는 `QueuedEvent` 에 `device` 필드를 아예 포함하지 않음. `DeviceSchema.optional()` 이므로 API validation 은 통과. analyticsService.ts L386-391 의 `os: event.device?.os || null` 는 모두 `null` 로 저장됨.

### 3.2 분석 dashboard 영향

**MEDIUM M2**: web traffic 을 native 와 구분할 server-side 메타데이터가 부재.

- `os` 컬럼: web 이벤트는 `null`. native iOS (`'ios'`) / Android (`'android'`) 와 3-way 분리됨.
- 그러나 `os = null` 은 native SDK 가 `device` 객체를 보내지 않는 케이스 (configure 직후 짧은 윈도우 / 테스트 / 잘못된 통합) 와도 충돌 — **`null` ≠ web 의 의미적 등치성 깨짐**.
- 결과: dashboard 에서 "platform 별 DAU/funnel" 쿼리 시 `WHERE os IS NULL` 이 web traffic 을 정확히 분리한다는 보장 없음.

### 3.3 권장 follow-up

- (A) **`DeviceSchema.os` enum 에 `'web'` 추가** — `apps/api/src/services/analyticsService.ts:27` `z.enum(['ios','android'])` → `z.enum(['ios','android','web'])` + Prisma migration. 이후 `web.ts` 가 `device: { os: 'web', locale: navigator.language }` 를 채워 보냄.
- (B) **부가 device 필드** (web 한정):
  - `os_version`: `navigator.userAgent` 파싱 (또는 단순히 `'browser'`)
  - `model`: 생략 또는 `navigator.userAgentData.platform` (Chromium 한정)
  - `locale`: `navigator.language` (예: `'ko-KR'`)
  - `att_status` / `idfa`: 항상 생략 (web 부적용)
- (C) Phase 0.4 audit (`device.os enum`) 의 의사결정 일관성 — 당시 `'ios'|'android'` 만 정의한 사유가 native 한정이었음. Phase 1.9 의 web 동작화는 이를 갱신할 트리거.
- **티켓 분리 권장**: 단순 SDK 패치가 아닌 API 스키마 변경 → DB 스키마 영향 → `apps/web/admin` dashboard 쿼리 영향까지 retroactive. **Phase 2 또는 별도 mini-phase (1.10) 로 분리**.

> 참고: Phase 1.9 자체에는 결함이 없음 — API 가 `device.os` 미존재를 허용하므로 wire-format 회귀 없음. 단지 **분석 정합성 (§5 finding)** 이 후속 ticket 으로 이관됨.

---

## 4. Session 이벤트 자동 발화 — reference v1.1 §1 정합

### 4.1 reference v1.1 (unified-event-reference.md L106-114) 명세

| Event | Required | Optional | Trigger |
|---|---|---|---|
| `session_start` | — | — | New session begins (auto-fired by SDK on `startSession()`; first foreground or after 30min idle) |
| `session_resume` | — | — | Background → foreground within 30min |
| `session_end` | — | `duration_seconds` | Session ends (auto-fired by SDK on `endSession()`; app background after grace period) |

### 4.2 web.ts 구현 vs 명세

| Event | web.ts 발화 지점 | 정합 |
|---|---|---|
| `session_start` | `startSession()` L287 — `await this.track({ eventName: 'session_start' })` | ✅ |
| `session_end` | `endSession()` L292 — `await this.track({ eventName: 'session_end' })` | ⚠️ M1 — `duration_seconds` 누락 |
| `session_resume` | (구현 없음) | ⚠️ N4 — 아래 §6 |

### 4.3 native 4채널 parity 확인

| SDK | session_start 호출 | session_end 호출 | duration_seconds |
|---|---|---|---|
| Flutter | `eodin_analytics.dart:289` | `eodin_analytics.dart:295` | 미발화 (parity) |
| iOS | (configure 시 자동) | `EodinAnalytics.swift:255` | 미발화 |
| Android | (configure 시 자동) | `EodinAnalytics.kt:330` | 미발화 |
| Capacitor web | `web.ts:287` | `web.ts:292` | 미발화 |

→ **MEDIUM M1**: 4채널 모두 reference v1.1 의 `duration_seconds` optional param 을 미준수. **web 한정 결함이 아님 — Phase 1.6 audit 의 N3 후속**. Phase 1.9 안에서 web 만 추가하면 channel 간 parity 가 깨지므로, 4채널 동시 추가가 필요. **별도 ticket 권장 (Phase 2 또는 Phase 1.10)**.

산출 시 web.ts 측 패치 예시 (4채널 동시 적용 가정):

```ts
async endSession(): Promise<void> {
  const sessionId = this.readStorage(STORAGE_KEYS.sessionId);
  const sessionStart = this.readStorage(STORAGE_KEYS.sessionStart);
  if (sessionId !== null && sessionStart !== null) {
    const durationSec = Math.floor((Date.now() - Number(sessionStart)) / 1000);
    await this.track({
      eventName: 'session_end',
      properties: { duration_seconds: durationSec },
    });
  }
  this.removeStorage(STORAGE_KEYS.sessionId);
  this.removeStorage(STORAGE_KEYS.sessionStart);
}
```

### 4.4 `ensureSession()` 의 30분 idle TTL — `session_resume` 누락 (N4)

`ensureSession()` (L334-345) 은 30분 미만 elapsed 시 기존 session 재사용, 초과 시 `startSession()` 호출. 그러나 reference v1.1 의 `session_resume` (background→foreground 30분 미만) 은 어느 SDK 에서도 자동 발화되지 않음.

→ **NIT N4**: web 만 추가 시 4채널 비대칭. 4채널 동시 추가는 §4.3 의 `duration_seconds` ticket 과 묶어 처리 권장. 현재는 reference v1.1 에 정의만 있고 실제 발화는 호스트 앱 책임 (manual track) — 명세 vs 구현 gap 이 phase 1.6 부터 존재해 온 동등 결함.

---

## 5. GDPR `setEnabled` — public API 미구현 (HIGH)

### 5.1 현재 동작

`web.ts:328-332`:

```ts
private isEnabled(): boolean {
  const value = this.readStorage(STORAGE_KEYS.enabled);
  if (value === null) return true; // default-enabled
  return value === 'true';
}
```

- `track()` L187 에서 `if (!this.isEnabled()) return` — disabled 시 silent drop.
- 그러나 `setEnabled` / `isEnabled` / `requestDataDeletion` **public method 가 없음**.
- `STORAGE_KEYS` 는 `const` (L55, 비export) — 호스트 앱이 직접 localStorage 에 `'eodin_enabled'` 를 쓰려면 **literal 문자열 hardcode** 가 강제됨.

### 5.2 GDPR / ePrivacy 요구사항 준수 여부

GDPR Art. 7(3) ("right to withdraw consent") + ePrivacy Cookie Directive:
- 사용자 opt-out 이 **명시적 / 접근 가능 / SDK 제공자 책임** 이어야 함.
- 호스트 앱이 `localStorage.setItem('eodin_enabled', 'false')` 를 직접 호출하는 패턴은:
  - (a) SDK contract 위반 — internal storage key 의 backward-compat 보장 없음.
  - (b) `setEnabled(false)` 동시에 (i) 큐 flush 차단 + (ii) 잔여 큐 삭제 + (iii) 향후 새 이벤트 차단 의 3-stage 처리 없음 — 현재 web.ts 는 (i)+(iii) 만 보장, (ii) 없음.
  - (c) `requestDataDeletion()` 부재 — Art. 17 ("right to be forgotten") 미준수 위험.

→ **HIGH H1**: §4.5 (open-issues) 가 Phase 1.7 / 1.9 로 예정되어 있었으나 Phase 1.9 안에서 미해결. semag.app PWA 가 EU 사용자 노출 시 컴플라이언스 리스크.

### 5.3 임시 대응 가능 여부

- **단기 워크어라운드**: 호스트 앱 (kidstopia PWA) 가 consent banner 의 reject 핸들러에서 `localStorage.setItem('eodin_enabled', 'false')` 직접 set + `localStorage.removeItem('eodin_event_queue')` 로 잔여 큐 삭제. SDK 동작상 작동하긴 하나 contract 위반.
- **권장 정공법**: 4채널 (Flutter / iOS / Android / Capacitor) 동시에 `setEnabled` / `isEnabled` / `requestDataDeletion` public method 도입. Flutter 는 이미 보유 (eodin_analytics.dart:344) 이므로 **3채널 추가 + Capacitor wrapper 갱신** 분량.

### 5.4 권장 follow-up

- 즉시: kidstopia PWA 마이그 가이드에 임시 워크어라운드 명시 (`localStorage` literal key) — Phase 5 마이그 PR 의 DoD.
- 후속: `setEnabled` / `requestDataDeletion` 4채널 추가 (별도 phase 1.10 or Phase 2).

---

## 6. 분석 정합성 / 기타 NIT

### 6.1 N1 — 마이그 가이드: baseline reset 안내 필요

Capacitor 호스트 앱 (예: kidstopia) 이 v1 (모든 web 호출 throw) → v2 (실제 발화) 로 전환 시:
- 기존에 web 사용자는 **0 events/day** 였음.
- v2 채택 후 갑자기 ~수천 events/day 유입 (semag.app 트래픽 기반).
- 분석 dashboard 의 "전일 대비 증감률" / "anomaly detection" 알람 거짓 트리거 가능.

→ **권장**: Phase 5 의 Capacitor 호스트 앱 마이그 가이드 (`docs/unified-id-and-sdk-v2/migrations/kidstopia-v2.md` 신설 예정) 에 **"baseline reset day"** 섹션 추가:
- 마이그 배포 D-1 까지의 분석 baseline 을 dashboard 측 annotation 으로 마킹.
- D+7 까지는 anomaly alert 의 web sub-segment 일시 무음.

### 6.2 N2 — 같은 사용자의 mobile↔web cross-device tracking

`device_id` 는 localStorage 기반 (브라우저 세션 영속, incognito 시 재발급). 동일 사용자의 native iOS app + semag.app PWA 를 묶을 단일 키는 부재. 단, **Phase 1-Auth 의 Identity API (`EodinAuth.identify`)** 가 처리하기로 사전 결정됨 (PRD §15.2). Phase 1.9 범위 밖이며 web.ts 의 `identify({ userId })` 는 `eodin_user_id` 를 localStorage 에 저장 — 추후 Identity API 도입 시 device_id 와 user_id 의 cross-link 으로 통합 가능. **회귀 없음, OK**.

### 6.3 N3 — `STORAGE_KEYS` 외부 미노출

§5.3 의 워크어라운드를 위해 호스트 앱이 literal 문자열 (`'eodin_enabled'`) 을 hardcode 할 수밖에 없음. 향후 SDK 가 storage key 변경 (예: prefix 충돌) 시 silent breakage 위험. `setEnabled` public API 도입 시 자연스럽게 해소됨.

### 6.4 N4 — `session_resume` 미발화

§4.4 참조. 4채널 비대칭 + reference v1.1 vs 구현 gap. 별도 ticket.

### 6.5 추가 관찰 (참고)

- **`app_open` 자동 발화 부재**: native SDK 도 `app_open` 자동 발화는 호스트 앱 책임 (Flutter `WidgetsBindingObserver` / iOS `UIApplication.didBecomeActiveNotification` / Android `Activity.onResume`). web 도 동일하게 호스트 앱이 `track('app_open')` 호출 책임 — parity OK.
- **`flush()` 의 batch 순서 보존**: L267-268 의 re-queue 패턴 (`[...batch, ...remaining]`) 이 ordering 보존을 명시 — analytics dashboard 의 funnel 분석에 유리. ✅
- **`unref()` 호출** (L172-173): jest 테스트 환경에서 timer 가 process 를 keep-alive 하지 않도록 방어 — 테스트 안정성 양호. ✅
- **빈 응답 페이로드**: API 가 `{success: true, received: N, duplicates: M}` 응답하나 web.ts 는 응답 body 를 확인하지 않음 (`response.ok` 만 체크). 단순 ok/fail 만 신경 쓰는 fire-and-forget 패턴 — ✅ (회귀 없음).

---

## 7. 테스트 coverage — `web.test.ts` (16 tests)

| 영역 | 테스트 | 검증 항목 |
|---|---|---|
| `EodinDeeplinkWeb` (4) | configure / isReady / checkDeferredParams / trim slash | no-throw, empty result 보장 |
| `configure` (3) | 초기 device id, reuse, trim slash | localStorage 영속성 |
| `track` (5) | not-configured skip / queue persist / wire-format / property forward / 503 retry / network error retry | API 페이로드 shape, 큐 보존 |
| `identify / clearIdentity` (2) | userId attach / clear | 식별 라이프사이클 |
| `setAttribution` (1) | snake_case 매핑 | `attributionToWire` 회귀 방어 |
| `session lifecycle` (2) | startSession / endSession | session_start / session_end 발화 |
| `ATT (web)` (2) | requestTrackingAuthorization / getATTStatus | `'unknown'` 반환 |

→ **빠진 영역** (NIT, 후속 보강 권장):
- `MAX_QUEUE_SIZE=1000` overflow 시 FIFO 삭제 (L214) 검증 케이스 부재.
- `MAX_BATCH_SIZE=50` 초과 큐의 다중 flush iteration 시 순서 보존 케이스 부재.
- `isEnabled()=false` 시 silent drop 검증 케이스 부재 (§5 의 GDPR public surface 도입 시 함께 추가).
- 30분 session timeout (`SESSION_TIMEOUT_MS`) 의 idle resume 케이스 부재 — Date mock 필요.
- `attributionToWire` 의 `undefined` 키 JSON 직렬화 후 누락 검증 (§2.2) — 방어적 회귀 가드 가치.

→ 16 tests 는 wire-format / 핵심 lifecycle 정합 검증으로 **충분**. 위 5건은 hardening 권장이지 머지 차단 아님.

---

## 8. Findings 요약

### HIGH

**H1. GDPR `setEnabled` public surface 미구현 — open-issues §4.5 미해결**
- 위치: `web.ts` 전체 (public method 부재)
- 영향: ePrivacy / GDPR Art. 7(3) / Art. 17 컴플라이언스 리스크. semag.app EU 사용자 노출 시 직접적 법적 위험.
- 권장: §4.5 ticket 을 phase 1.10 (또는 phase 2) 로 즉시 분리. 단기로 kidstopia 마이그 가이드에 localStorage literal 워크어라운드 명시.

### MEDIUM

**M1. `session_end` 의 `duration_seconds` 미발화 — reference v1.1 §1 vs 구현 gap**
- 위치: `web.ts:290-296` `endSession()`. native 4채널 모두 동일 결함.
- 영향: session length 분석 / "engaged session" 정의 불가. Phase 1.6 audit 의 N3 동등 finding.
- 권장: 4채널 동시 패치 ticket. web.ts 패치 예시는 §4.3 참조.

**M2. `device.os` 생략으로 web traffic 의 server-side 식별 불가**
- 위치: `web.ts` `track()` L192-201 — `QueuedEvent` 에 `device` 필드 자체가 없음.
- 영향: dashboard 에서 web 사용자의 platform-segmented 쿼리 정확도 저하. Phase 0.4 의 `device.os enum` 결정과 retroactive 충돌.
- 권장: `DeviceSchema.os` enum 에 `'web'` 추가 + Prisma migration + web.ts 가 `device: { os: 'web', locale: navigator.language }` 첨부. **별도 mini-phase (1.10) 권장** — DB 스키마 변경이 phase 1.9 범위 초과.

### NIT

- **N1. 마이그 가이드 baseline reset 안내**: Phase 5 의 kidstopia 마이그 PR 에 dashboard annotation + 7-day 알람 무음 안내.
- **N2. cross-device tracking**: Phase 1-Auth (Identity API) 가 처리. 현재 phase 회귀 없음.
- **N3. `STORAGE_KEYS` 외부 미노출**: §5.3 워크어라운드의 brittleness. `setEnabled` public API 도입 시 자연 해소.
- **N4. `session_resume` 미발화**: 4채널 비대칭. M1 ticket 과 묶어 처리.

---

## 9. wire-format 회귀 / breaking change 영향

| 영역 | 회귀 위험 | 결과 |
|---|---|---|
| `EventSchema` 정합 | 신규 필드 추가 / 키 이름 변경 / 타입 변경 | ✅ 없음 (9/10 fields 1:1 매핑, `device` 의도적 생략) |
| `AttributionSchema` 정합 | 11 키 매핑 | ✅ 없음 |
| `CollectEventsSchema` shape | `{events: [...]}` | ✅ 없음 |
| HTTP 헤더 | `X-API-Key` / `Content-Type` | ✅ 없음 |
| 큐 직렬화 호환성 | v1 (throw-only) → v2 의 `eodin_event_queue` 키 | ✅ 없음 (v1 에는 큐 자체가 없었으므로 마이그 충돌 부재) |
| 호스트 앱 호출부 | `track(eventName, properties?)` positional | ✅ 없음 (Phase 1.6 wrapper 와 동일 시그니처) |

→ **wire-format 회귀 없음**. v1 에서 모든 호출이 `unavailable()` throw → v2 에서 정상 동작. 호스트 앱이 try-catch 로 방어하던 코드는 그대로 작동 (catch 블록이 더 이상 진입하지 않을 뿐).

---

## 10. Phase 1.9 통과 / 후속 ticket 정리

**통과** (이번 phase DoD 충족):
- ✅ wire-format 정합 (§1, §2)
- ✅ 세션 자동 발화 native parity (§4.2-4.3)
- ✅ 큐 / flush / 재시도 (§7)
- ✅ ATT 비대칭 처리 (`'unknown'` 반환)
- ✅ breaking change / 회귀 없음 (§9)
- ✅ 16 tests pass (테스트 시나리오 적정)

**후속 ticket 분리 권장**:

| # | Severity | Ticket 후보명 | 채널 | 의존 phase |
|---|---|---|---|---|
| 1 | HIGH | `Capacitor + 3-channel: setEnabled / requestDataDeletion public surface` | Capacitor + iOS + Android (Flutter 보유) | Phase 1.10 또는 Phase 2 |
| 2 | MEDIUM | `4-channel: session_end duration_seconds + session_resume 자동 발화` | Flutter / iOS / Android / Capacitor 동시 | Phase 1.10 |
| 3 | MEDIUM | `DeviceSchema.os enum 에 'web' 추가 + Prisma migration + web.ts device 첨부` | API + Prisma + Capacitor web | Phase 1.10 / 별도 mini-phase |
| 4 | NIT | `kidstopia 마이그 가이드 baseline reset 섹션` | docs only | Phase 5 |
| 5 | NIT | `web.ts 추가 hardening tests (queue overflow / batch iteration / Date mock)` | Capacitor only | Phase 1.10 |

---

## 11. Verdict

**Phase 1.9 — Approve with follow-ups.**

Capacitor `web.ts` 의 동작화는 wire-format / breaking-change / 회귀 영역에서 결함 없이 native 4채널 parity 를 확보. 16 tests 가 핵심 라이프사이클을 cover. 식별된 H1 (GDPR public surface) 은 open-issues §4.5 가 phase 1.7 또는 1.9 로 예정되어 있었으나 미해결 — phase 1.10 또는 별도 ticket 으로 즉시 분리 권장. M1 / M2 는 4채널 동시 처리 또는 API 스키마 갱신이 필요한 수준이라 phase 1.9 단독 패치 부적절. semag.app PWA 는 H1 워크어라운드 (host-side localStorage literal) 와 함께 v2 채택 가능하나 EU 사용자 컴플라이언스 리스크는 phase 1.10 종료 전까지 잔존.
