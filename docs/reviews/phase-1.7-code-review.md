# Code Review: Phase 1.7 — Analytics SDK GDPR Surface (4-Channel Sync)

**Date**: 2026-05-02
**Scope**: `libs/eodin-sdk` Phase 1.7 — `setEnabled` / `isEnabled` / `requestDataDeletion` 추가 (iOS standalone + Android standalone + Capacitor iOS bundled + Capacitor Android bundled + Capacitor TS)
**Reference 채널**: Flutter (`packages/sdk-flutter/lib/src/analytics/eodin_analytics.dart:339-394, 489-519`)

---

## Summary

4채널 surface 정합 작업으로서의 골격은 정확함 — API signature, storage key (`eodin_enabled`), wire format (DELETE `/user-data` + `X-API-Key` / `X-Device-ID`), fail-silent track guard, "right to erasure honoured locally" 정책이 4채널에서 일관되게 구현됨. Capacitor wrapper의 positional 변환과 plugin method count test도 정확.

다만 **구조적으로 큰 결함 1건**이 있음 — `requestDataDeletion()` 호출 후 SDK가 사실상 사용 불능 상태로 남는다는 것 (iOS/Android/Capacitor 모두 EventQueue가 `isInitialized=false` 로 떨어지고 재초기화 경로가 없어 이후 `track()` 이 silently drop, Web은 더 위험하게 device_id=null 이벤트를 전송 시도). 이건 4채널 모두에 걸친 회귀이고 Flutter도 동일한 취약점을 가지고 있을 가능성이 높음.

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 4 |
| LOW | 4 |
| NIT | 3 |

**Overall Grade**: B-

---

## HIGH Findings

### H1. `requestDataDeletion()` 후 SDK 가 영구적 회복 불능 상태 — 4채널 공통

`clearLocalData()` 가 EventQueue 와 deviceId를 모두 wipe 하지만 host 가 다시 `configure()` 를 부르지 않는 한 SDK가 정상 상태로 복귀하지 않음.
- **iOS / Android / Capacitor bundled**: `EventQueue.shared.reset()` 가 `isInitialized = false` 로 만듦 → 이후 `track()` 호출은 GDPR guard 통과해도 `EventQueue.enqueue()` 의 init guard 에서 silently drop.
- **Web**: `clearLocalData()` 가 `STORAGE_KEYS.deviceId` 를 제거 → 이후 `track()` 이 `this.readStorage(STORAGE_KEYS.deviceId)!` non-null assertion 으로 `null` → wire 에 `device_id: null` 이벤트가 가서 server `EventCollectSchema` (UUID 검증) reject.

**Impact**: GDPR 측면에서 사용자가 "내 데이터 삭제" 후 앱 계속 쓰면 — iOS/Android/Capacitor 는 silently drop, Web 은 의도치 않은 400 errors 폭주. 4채널 동작 비대칭.

**Recommended fix** (옵션 1 — 권장): deletion 후 device_id 와 EventQueue 재생성:
```swift
private func clearLocalData() {
    [deviceIdKey, userIdKey, attributionKey, sessionIdKey, sessionStartKey, enabledKey].forEach {
        UserDefaults.standard.removeObject(forKey: $0)
    }
    EventQueue.shared.reset()
    userId = nil; attribution = nil; sessionId = nil; sessionStartTime = nil; isEnabled = true
    // Re-bootstrap so future track() calls work
    initDeviceId()
    initSession()
    if offlineMode, let endpoint = apiEndpoint, let key = apiKey {
        EventQueue.shared.initialize(apiEndpoint: endpoint, apiKey: key, debug: isDebug)
    }
    log("Cleared all local data; SDK re-bootstrapped with fresh identity")
}
```
Web 등가:
```ts
private clearLocalData(): void {
  for (const key of Object.values(STORAGE_KEYS)) this.removeStorage(key);
  // Re-bootstrap fresh identity
  this.writeStorage(STORAGE_KEYS.deviceId, uuid());
  this.ensureSession();
  this.log('Cleared all local data; re-bootstrapped fresh identity');
}
```

### H2. `clearLocalData()` 가 `@Deprecated("For testing only")` API 를 production code path 에서 호출

`EventQueue.reset()` 는 명시적으로 testing-only 인데 GDPR right-to-erasure 라는 production 핵심 경로에서 호출. Compile time deprecation warning + future contract drift 위험.

**Recommended fix**: EventQueue 에 production-grade `purgeForDataDeletion()` API 신설:
```swift
public func purgeForDataDeletion() {
    queue.async { [weak self] in
        self?.memoryQueue.removeAll()
        UserDefaults.standard.removeObject(forKey: self?.storageKey ?? "")
        self?.retryCount = 0
        // intentionally keep isInitialized=true so future enqueue() works
    }
}
```

### H3. API server `DeleteDataSchema` 가 `device_id` 만 검증 — `app_id` / `user_id` 무시 (multi-tenant 보안 의도 결함)

SDK 는 body 에 `app_id` 를 포함시키지만 server `DeleteDataSchema` 는 strip 후 `prisma.analyticsEvent.deleteMany({ where: { deviceId } })` — 한 device_id 가 여러 app 에서 쓰일 때 SDK 호출 한 번으로 모든 앱 analytics 삭제됨.

**Recommended fix**:
```ts
const DeleteDataSchema = z.object({
  device_id: z.string().uuid(),
  app_id: z.string().min(1).max(50),
  user_id: z.string().optional(),
});
// ...
if (req.apiKey?.appId && req.apiKey.appId !== app_id) {
  res.status(403).json({ success: false, error: 'API key not scoped to this app' });
  return;
}
const deletedEvents = await prisma.analyticsEvent.deleteMany({
  where: { deviceId: device_id, appId: app_id, ...(user_id ? { userId: user_id } : {}) },
});
```

---

## MEDIUM Findings

### M1. Capacitor iOS bundled 에 Phase 1.6 `EodinEvent` enum sync 누락 — drift 잔존
Android 만 Phase 1.7 에서 sync 됐고 iOS 는 누락. `track(_ event: EodinEvent, ...)` overload 와 `EodinEvent.swift` 둘 다 standalone 에만 있음.

**Fix**: `packages/capacitor/ios/Sources/EodinCapacitorPlugin/EodinEvent.swift` 신설 + `track(_ event: EodinEvent, ...)` overload 추가.

### M2. Thread safety — `isEnabled` / `isEnabledFlag` 가 atomicity / visibility 보장 없음
- **Android**: `var Boolean` → `@Volatile private var isEnabledFlag` 또는 `AtomicBoolean`
- **iOS**: 기존 `private let queue = DispatchQueue(...)` 에서 `queue.sync` 로 보호

### M3. Native callback thread 일관성 결여 — iOS background queue, Android main thread
iOS `URLSession` callback 은 delegate queue (background), Android 는 `mainHandler.post` (main). 4채널 surface 정합 모순.

**Fix**: iOS `DispatchQueue.main.async { completion(success) }` 로 통일.

### M4. `setEnabled(false)` 가 in-flight queue 를 일시정지 하지 않음 — GDPR 약점
disable 직후 큐의 in-flight 이벤트가 30s 후 flush 됨. regulator 관점에서 "disable 이후 wire 통신" 들킬 수 있음.

**Fix**: setEnabled(false) 시 큐 비우고 flush timer 정지. 또는 PRD 에 명시.

---

## LOW Findings

- **L1**: `reset()` (testing-only) 가 `isEnabled` / `isEnabledFlag` 필드 reset 누락 — test cross-pollution
- **L2**: Wire body 의 `user_id` 가 4채널에서 미묘하게 다름 (Flutter 는 null 도 보냄, 다른 3채널은 omit) — 통일 권장
- **L3**: Web `requestDataDeletion()` 가 `deviceId` null 인 경우 invalid request — defensive coding 필요
- **L4**: Capacitor iOS bundled `clearLocalData()` 끝 빈 줄 cosmetic

---

## NIT Findings

- **N1**: Korean / English 주석 혼재 정도
- **N2**: `setEnabled` / `requestDataDeletion` 자체는 disabled 상태에서도 동작함을 PRD 에 명시
- **N3**: H2 fix 적용 시 자연 해소 (EventQueue.reset() deprecation warning)

---

## Positive Observations

1. 4채널 storage key 통일 (`eodin_enabled`)
2. fail-silent track guard 정확
3. right-to-erasure 의 "local always" 정책 4채널 일관
4. Capacitor wrapper 의 positional API 변환 깔끔
5. `definitions.test.ts` 의 `Object.keys(plugin)).toHaveLength(14)` 회귀 가드
6. Capacitor TS plugin method `@objc` / `@PluginMethod` 누락 없음
7. HTTP wire format 정합

---

## Action Items

### HIGH (Phase 1.7 머지 전 처리 권장)
- [ ] **H1**: `clearLocalData()` 후 device_id + EventQueue 재초기화 — 4채널 + Flutter
- [ ] **H2**: `EventQueue.purgeForDataDeletion()` production-grade API 신설 — 4채널
- [ ] **H3**: API server `DeleteDataSchema` 에 `app_id` / `user_id` 추가 + apiKey scope check + `where` 절 scope

### MEDIUM (Phase 1.7 안에서 함께 처리 권장)
- [ ] **M1**: Capacitor iOS bundled 에 `EodinEvent.swift` + `track(_ event: EodinEvent, ...)` overload
- [ ] **M2**: Android `@Volatile` + iOS queue.sync — 4채널 + Flutter
- [ ] **M3**: iOS `requestDataDeletion` callback `DispatchQueue.main` — Capacitor iOS bundled 도
- [ ] **M4**: `setEnabled(false)` 시 큐 정지 — 결정 후 4채널

### LOW
- [ ] L1: `reset()` 에 `isEnabled` 추가 — 4채널
- [ ] L2: Flutter `user_id` null omission 통일
- [ ] L3: Web `deviceId null` 시 wire skip
- [ ] L4: cosmetic

### NIT
- [ ] N1-N3
