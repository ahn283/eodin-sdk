# Firebase uid 충돌 검증 절차 (Phase 0.5)

**작성일:** 2026-05-02
**상태:** 🔴 **사용자 실행 필요** (Claude 자격증명 만료)
**참조:** PRD §9.4 (uid 충돌 사전 검증 H1), C2 / H1

---

## 1. 왜 필요한가

Firebase uid 는 **프로젝트 단위 unique** — 5개 프로젝트의 uid 가 합집합에서 충돌 가능. 통합 Firebase 프로젝트로 import 시:

- **충돌 0건** → uid 보존, 마이그 단순
- **충돌 ≥1건** → 신규 uid 발급 정책 적용 (`EodinUserApp.appUserId` 에 기존 firebase_uid 보관, PRD §9.4)

기본 28자 random uid 라면 충돌 확률 낮지만, OAuth `sub` 또는 email 을 명시 uid 로 사용한 경우 충돌 가능.

---

## 2. 사전 조건

- [ ] `firebase login --reauth` 로 재인증 (Claude 환경에서 자격증명 만료 확인됨)
- [ ] 5개 프로젝트 모두에 Owner / Editor 권한 (export 권한 필요)
- [ ] 작업 디렉토리: `~/eodin-uid-audit/` (PII 포함 — 작업 후 안전하게 삭제)

```bash
mkdir -p ~/eodin-uid-audit && cd ~/eodin-uid-audit
firebase login --reauth
firebase projects:list   # 5개 모두 접근 확인
```

---

## 3. 실행 스크립트

```bash
#!/usr/bin/env bash
# ~/eodin-uid-audit/run.sh
set -euo pipefail

PROJECTS=(
  "fridgify-3c6bf"
  "plori-eb1b1"
  "tempy-9f095"
  "arden-cbe4f"
  "kids-cafe-tycoon"
)

cd ~/eodin-uid-audit

echo "=== 1. Export users from each project ==="
for proj in "${PROJECTS[@]}"; do
  echo "Exporting $proj..."
  firebase auth:export "${proj}.json" --project "$proj" --format json
  echo "  -> $(jq '.users | length' "${proj}.json") users"
done

echo ""
echo "=== 2. Per-project uid count ==="
for proj in "${PROJECTS[@]}"; do
  count=$(jq -r '.users[].localId' "${proj}.json" | wc -l | tr -d ' ')
  unique=$(jq -r '.users[].localId' "${proj}.json" | sort -u | wc -l | tr -d ' ')
  echo "  $proj: total=$count unique=$unique  $([ "$count" = "$unique" ] && echo OK || echo INTERNAL_DUP)"
done

echo ""
echo "=== 3. Cross-project uid collision check ==="
# Combine all uids, find duplicates
all_uids=$(mktemp)
for proj in "${PROJECTS[@]}"; do
  jq -r --arg proj "$proj" '.users[] | "\(.localId)\t\($proj)"' "${proj}.json"
done > "$all_uids"

total=$(wc -l < "$all_uids" | tr -d ' ')
unique_uids=$(awk '{print $1}' "$all_uids" | sort -u | wc -l | tr -d ' ')
echo "Total uids across 5 projects: $total"
echo "Unique uids: $unique_uids"
echo "Collisions: $((total - unique_uids))"

if [ "$total" != "$unique_uids" ]; then
  echo ""
  echo "=== Collision details ==="
  awk '{print $1}' "$all_uids" | sort | uniq -d | while read -r dup_uid; do
    echo "uid=$dup_uid in projects:"
    grep -F "$dup_uid" "$all_uids" | awk '{print "  - " $2}'
  done > collisions.txt
  cat collisions.txt
fi

echo ""
echo "=== 4. Email collision check (different uid, same email) ==="
all_emails=$(mktemp)
for proj in "${PROJECTS[@]}"; do
  jq -r --arg proj "$proj" '.users[] | select(.email != null) | "\(.email|ascii_downcase)\t\(.localId)\t\($proj)"' "${proj}.json"
done > "$all_emails"

email_count=$(wc -l < "$all_emails" | tr -d ' ')
unique_emails=$(awk '{print $1}' "$all_emails" | sort -u | wc -l | tr -d ' ')
echo "Total email-bearing users: $email_count"
echo "Unique emails: $unique_emails"
echo "Same-email-cross-project: $((email_count - unique_emails))"

if [ "$email_count" != "$unique_emails" ]; then
  awk '{print $1}' "$all_emails" | sort | uniq -d | head -50 > duplicate-emails.txt
  echo "(top 50 duplicate emails saved to duplicate-emails.txt)"
fi

rm -f "$all_uids" "$all_emails"
echo ""
echo "Done. Review collisions.txt and duplicate-emails.txt"
```

```bash
chmod +x ~/eodin-uid-audit/run.sh
~/eodin-uid-audit/run.sh
```

---

## 4. 결과 해석 가이드

### 4.1 uid 충돌 0건 (예상 — 기본 random uid 사용 시)
- **결정**: PRD §9.4 의 "uid 보존" 채택
- 통합 import 시 `firebase-admin.auth().importUsers([{ uid: <기존_uid>, ... }])` 그대로 사용
- `EodinUserApp.appUserId = <기존_firebase_uid>` 로 backfill
- 추가 작업 없음

### 4.2 uid 충돌 1건 이상 (드문 케이스 — OAuth sub 또는 email 을 uid 로 명시 사용 시)
- **결정**: PRD §9.4 의 "신규 uid 발급" 채택
- `firebase-admin.auth().createUser()` 로 새 uid 발급 + `EodinUserApp.appUserId` 에 기존 firebase_uid 보관
- 충돌이 OAuth sub 인 경우 — 두 사용자가 실제로 동일인일 수 있음 → admin 검토 큐 (PRD §11.2 outbox + reconcile dashboard)

### 4.3 email 동일, uid 다른 케이스 (예상 다수)
- 같은 사용자가 5개 앱에 각자 가입 → 정상 (Phase 6 dedup 로직 처리)
- **자동 머지 금지** (PRD C4) — admin 검토 큐 SLA 24시간
- Phase 0.5 에서는 통계 수집만 (예상 dedup 후보 수)

---

## 5. 작업 후 처리 (PII 보호)

```bash
# 결과 요약만 추출 후 raw export 파일 삭제
cd ~/eodin-uid-audit
echo "Summary $(date)" > SUMMARY.txt
for proj in fridgify-3c6bf plori-eb1b1 tempy-9f095 arden-cbe4f kids-cafe-tycoon; do
  echo "$proj: $(jq '.users | length' ${proj}.json) users" >> SUMMARY.txt
done
cat collisions.txt 2>/dev/null >> SUMMARY.txt
echo "Duplicate emails count: $(wc -l < duplicate-emails.txt 2>/dev/null || echo 0)" >> SUMMARY.txt

# raw export 삭제 — PII 보유 최소화
rm -f *.json duplicate-emails.txt collisions.txt
ls -la
```

`SUMMARY.txt` 만 보관 + 결과를 본 문서 §6 에 기록.

---

## 6. 결과 기록 (사용자 실행 후 채워주세요)

| 항목 | 값 | 결정 |
|---|---|---|
| 5개 프로젝트 사용자 수 합 | _____ | - |
| Unique uid 수 | _____ | - |
| **uid 충돌 건수** | _____ | 0건: uid 보존 / ≥1건: 신규 발급 |
| Email 중복 건수 (cross-project) | _____ | dedup 후보 — Phase 6 admin 검토 큐 SLA 산정 입력 |
| 작업 일자 | _____ | - |

---

## 7. 위임 사유

Claude 환경의 firebase CLI 자격증명이 만료됨 (`firebase login:list` 결과: `official@eodin.app`, `projects:list` 호출 시 "credentials are no longer valid"). 또한 사용자 export 는 PII 를 포함하므로 사용자 본인이 통제된 환경에서 실행하는 것이 안전.

사용자가 위 §3 스크립트 실행 후 §6 결과를 채워주시면 Phase 6 (Firebase 사용자 import) 의 dedup 정책 확정 가능.
