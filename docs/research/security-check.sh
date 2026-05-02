#!/usr/bin/env bash
# SDK 저장소 분리 (Phase 0.5) 전 보안 점검
# 발견 항목은 분리 전에 반드시 정리해야 함.
#
# Usage:
#   ./security-check.sh                        # 기본 (eodin 루트 자동 감지)
#   REPO_ROOT=/path/to/eodin ./security-check.sh

set -uo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SDK_DIRS=(
  "packages/sdk-flutter"
  "packages/sdk-ios"
  "packages/sdk-android"
  "packages/capacitor"
)

EXCLUDE_PATHS='\.git/|node_modules|\.dart_tool|build/|Pods/|dist/|\.next/'

# Secret 패턴
SECRET_PATTERNS=(
  'AIza[0-9A-Za-z_-]{35}'
  'sk-[A-Za-z0-9]{32,}'
  'sk-ant-[A-Za-z0-9_-]+'
  'ya29\.[A-Za-z0-9_-]+'
  'AKIA[0-9A-Z]{16}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'BEGIN RSA PRIVATE'
  'xox[bp]-[A-Za-z0-9-]+'
  'ghp_[A-Za-z0-9]{36}'
)

# SDK 안에 들어가면 안 되는 의심 키워드
SUSPICIOUS=(
  'localhost'
  '127\.0\.0\.1'
  'admin\.eodin'
  'internal\.eodin'
  'TODO.*(secret|password|key)'
  'FIXME.*(secret|password|key)'
  '/\*\*?\s*hardcoded'
)

found_issue=0

echo "=================================================="
echo " Eodin SDK 분리 전 보안 점검"
echo " 저장소: $REPO_ROOT"
echo "=================================================="
echo ""

# ---- 1. SDK 디렉토리 내 secret 패턴 ----
echo "[1/5] SDK 디렉토리 내 secret 패턴 스캔..."
for pattern in "${SECRET_PATTERNS[@]}"; do
  for sdk in "${SDK_DIRS[@]}"; do
    if [[ ! -d "$REPO_ROOT/$sdk" ]]; then continue; fi
    matches=$(grep -rEn "$pattern" "$REPO_ROOT/$sdk" 2>/dev/null \
      | grep -v -E "$EXCLUDE_PATHS" || true)
    if [[ -n "$matches" ]]; then
      echo "  🚨 [SECRET] pattern '$pattern' in $sdk:"
      echo "$matches" | sed 's/^/      /'
      found_issue=1
    fi
  done
done
[[ $found_issue -eq 0 ]] && echo "  ✓ no secrets in SDK directories"
echo ""

# ---- 2. SDK 디렉토리 내 secret 파일 ----
echo "[2/5] SDK 디렉토리 내 .env / 인증 파일..."
file_issue=0
for sdk in "${SDK_DIRS[@]}"; do
  if [[ ! -d "$REPO_ROOT/$sdk" ]]; then continue; fi
  matches=$(find "$REPO_ROOT/$sdk" -type f \
    \( -name '.env*' -o -name '*.pem' -o -name 'service-account*.json' \
       -o -name 'credentials*.json' -o -name '*.p12' -o -name '*.keystore' \) \
    2>/dev/null | grep -v -E "$EXCLUDE_PATHS" || true)
  if [[ -n "$matches" ]]; then
    echo "  🚨 [FILE] secret-like files in $sdk:"
    echo "$matches" | sed 's/^/      /'
    file_issue=1
    found_issue=1
  fi
done
[[ $file_issue -eq 0 ]] && echo "  ✓ no secret files in SDK directories"
echo ""

# ---- 3. 의심 키워드 ----
echo "[3/5] 의심 키워드 (SDK 에 들어가면 안 되는 internal/hardcoded 흔적)..."
suspicious_issue=0
for kw in "${SUSPICIOUS[@]}"; do
  for sdk in "${SDK_DIRS[@]}"; do
    if [[ ! -d "$REPO_ROOT/$sdk" ]]; then continue; fi
    matches=$(grep -rEn "$kw" "$REPO_ROOT/$sdk" \
      --include='*.dart' --include='*.swift' --include='*.kt' \
      --include='*.ts' --include='*.tsx' --include='*.js' \
      2>/dev/null | grep -v -E "$EXCLUDE_PATHS" | head -10 || true)
    if [[ -n "$matches" ]]; then
      echo "  ⚠ [SUSPICIOUS] '$kw' in $sdk:"
      echo "$matches" | sed 's/^/      /'
      suspicious_issue=1
    fi
  done
done
[[ $suspicious_issue -eq 0 ]] && echo "  ✓ no suspicious keywords"
echo ""

# ---- 4. git history 안의 secret (filter-repo 시점 정리 필요 여부 판단) ----
echo "[4/5] git history 안의 secret 패턴 (분리 시 history 도 함께 빠져나가므로 중요)..."
cd "$REPO_ROOT" || exit 1
history_issue=0
for pattern in "${SECRET_PATTERNS[@]}"; do
  # Use --pickaxe-regex for line-content match in any historical revision
  matches=$(git log --all --full-history -G"$pattern" --oneline -- "${SDK_DIRS[@]}" 2>/dev/null | head -5 || true)
  if [[ -n "$matches" ]]; then
    echo "  🚨 [HISTORY] pattern '$pattern' present in commits:"
    echo "$matches" | sed 's/^/      /'
    echo "      → 'git filter-repo --replace-text' 로 정리 필요"
    history_issue=1
    found_issue=1
  fi
done
[[ $history_issue -eq 0 ]] && echo "  ✓ no secret patterns in SDK history"
echo ""

# ---- 5. SDK 의 cross-package import (분리 가능성 검증) ----
echo "[5/5] SDK 가 monorepo 내부 다른 패키지를 참조하는지..."
cross_dep=0
# Flutter
if grep -E '^\s*(eodin_|@eodin/)' "$REPO_ROOT/packages/sdk-flutter/pubspec.yaml" 2>/dev/null \
   | grep -v "^\s*name:" | grep -q .; then
  echo "  🚨 sdk-flutter has internal pubspec dep"
  cross_dep=1
fi
# Capacitor
if grep -E '"@eodin/' "$REPO_ROOT/packages/capacitor/package.json" 2>/dev/null \
   | grep -v '"name"' | grep -q .; then
  echo "  🚨 capacitor has internal npm dep"
  cross_dep=1
fi
# Android
if grep -E 'project\(":' "$REPO_ROOT/packages/sdk-android/build.gradle.kts" 2>/dev/null | grep -q .; then
  echo "  🚨 sdk-android has internal gradle module dep"
  cross_dep=1
fi
[[ $cross_dep -eq 0 ]] && echo "  ✓ SDKs are self-contained (no internal monorepo deps)"
echo ""

echo "=================================================="
if [[ $found_issue -eq 0 ]]; then
  echo " ✅ 점검 통과 — SDK 분리 진행 OK"
else
  echo " ❌ 점검 실패 — 위 항목 정리 후 재실행 필요"
fi
echo "=================================================="

exit $found_issue
