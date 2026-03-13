---
name: flutter-validation-gates
description: Flutter 검증 게이트 전용 스킬입니다. G1~G5(+G4b) 판정 기준, 증빙 규칙, 게이트별 판정 명령을 제공합니다.
---

# Flutter 검증 게이트

## 목적

Flutter 작업 완료 여부를 정량 기준으로 판정하고, 재현 가능한 증빙을 남깁니다.

## 이 스킬을 사용해야 하는 경우

- PR/머지 전 품질 게이트를 통과시켜야 할 때
- CI에서 `analyze/test/architecture/model/viewmodel` 검증을 표준화할 때
- 작업 완료 보고에 증빙 로그와 판정 근거가 필요할 때

---

## 게이트 요약 (G1~G5 + G4b)

증빙 기본 경로: `dev/evidence/flutter/<task-name>/`

| Gate | 통과 기준 | 필수 증빙 |
| --- | --- | --- |
| G1 정적 분석 | `flutter analyze` exit=0 + `No issues found!` | `g1-analyze.txt`, `g1-analyze.exit` |
| G2 단위 테스트 | `flutter test` exit=0 + 실행 테스트 1건 이상 | `g2-unit-test.txt`, `g2-unit-test.exit` |
| G2b 통합 테스트 | `flutter test integration_test` exit=0 + 실행 테스트 1건 이상 | `g2b-integration-test.txt`, `g2b-integration-test.exit` |
| G3 의존성 매트릭스 | 레이어/DI 위반 0건 + `composition_root.dart` 유효 + `G3 PASS` | `g3-import-export-part-matrix.txt`, `g3-import-export-part-matrix.exit` |
| G4 모델 경계 테스트 | `BASE_SHA...HEAD` 모델 변경분 100% 추적 + 대응 테스트 참조 + `G4 PASS` | `g4-model-boundary-test.txt`, `g4-model-boundary-test.exit`, `g4-changed-targets.txt` |
| G4b ViewModel 매핑 | 변경 ViewModel 100% 추적 + 대응 Unit Test + 상태 전이 토큰 + `G4b PASS` | `g4b-viewmodel-mapping-test.txt`, `g4b-viewmodel-mapping-test.exit`, `g4b-changed-viewmodels.txt` |
| G5 증빙 완결성 | G1~G4b 파일 비어있지 않음 + 모든 `.exit`가 `exit_code=0` | `g5-summary.md` |

---

## 증빙 규칙

- 각 Gate는 `로그(.txt) + 상태(.exit) + 성공 토큰` 3종을 남깁니다.
- `.exit` 파일은 `exit_code=<n>` 단일 라인을 유지합니다.
- 테스트 성공 시에도 실행 테스트 수 `0`이면 실패로 판정합니다.
- G4/G4b는 `BASE_SHA`가 없거나 조상 커밋 검증 실패 시 즉시 실패합니다.

---

## 판정 명령

### G1

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
flutter analyze --no-pub | tee "$EVIDENCE_DIR/g1-analyze.txt"
echo "exit_code=$?" > "$EVIDENCE_DIR/g1-analyze.exit"
rg -q "No issues found!" "$EVIDENCE_DIR/g1-analyze.txt"
```

### G2

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
flutter test --reporter expanded | tee "$EVIDENCE_DIR/g2-unit-test.txt"
echo "exit_code=$?" > "$EVIDENCE_DIR/g2-unit-test.exit"
rg -q "\+[1-9][0-9]*: All tests passed!" "$EVIDENCE_DIR/g2-unit-test.txt"
! rg -q "(\+0: All tests passed!|No tests ran|No tests were found|No tests found)" "$EVIDENCE_DIR/g2-unit-test.txt"
```

### G2b

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
flutter test integration_test --reporter expanded | tee "$EVIDENCE_DIR/g2b-integration-test.txt"
echo "exit_code=$?" > "$EVIDENCE_DIR/g2b-integration-test.exit"
rg -q "\+[1-9][0-9]*: All tests passed!" "$EVIDENCE_DIR/g2b-integration-test.txt"
! rg -q "(\+0: All tests passed!|No tests ran|No tests were found|No tests found)" "$EVIDENCE_DIR/g2b-integration-test.txt"
```

### G3

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
LOG_FILE="$EVIDENCE_DIR/g3-import-export-part-matrix.txt"
STATUS_FILE="$EVIDENCE_DIR/g3-import-export-part-matrix.exit"

# 팀 표준 스크립트/명령으로 의존성 매트릭스 위반 수를 계산한다.
# 결과 로그에 total_violations=<n>과 G3 PASS/FAIL 토큰을 남긴다.

if rg -q "total_violations: 0" "$LOG_FILE" && rg -q "G3 PASS" "$LOG_FILE"; then
  echo "exit_code=0" > "$STATUS_FILE"
else
  echo "exit_code=1" > "$STATUS_FILE"
  exit 1
fi
```

### G4

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
BASE_SHA="${BASE_SHA:-$(git merge-base HEAD origin/main || true)}"
[ -n "$BASE_SHA" ]
git merge-base --is-ancestor "$BASE_SHA" HEAD

git diff --name-only --diff-filter=ACMR "$BASE_SHA"...HEAD -- \
  ':(glob)lib/**/entities/**/*.dart' \
  ':(glob)lib/**/dtos/**/*.dart' \
  ':(glob)lib/**/models/**/*.dart' \
  ':(glob)lib/**/mappers/**/*.dart' \
  ':(glob)lib/**/value_objects/**/*.dart' \
  > "$EVIDENCE_DIR/g4-changed-targets.txt"

# 변경 타깃별 테스트 참조를 확인하고 로그에 G4 PASS/FAIL 토큰을 기록한다.
```

### G4b

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
BASE_SHA="${BASE_SHA:-$(git merge-base HEAD origin/main || true)}"
[ -n "$BASE_SHA" ]
git merge-base --is-ancestor "$BASE_SHA" HEAD

git diff --name-only --diff-filter=ACMR "$BASE_SHA"...HEAD -- \
  ':(glob)lib/**/presentation/viewmodel/**/*.dart' \
  > "$EVIDENCE_DIR/g4b-changed-viewmodels.txt"

# 각 ViewModel에 대응 Unit Test 존재 여부와
# loading -> data|error 상태 전이 토큰을 확인하고 G4b PASS/FAIL 기록.
```

### G5

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"

for status in \
  g1-analyze.exit g2-unit-test.exit g2b-integration-test.exit \
  g3-import-export-part-matrix.exit g4-model-boundary-test.exit g4b-viewmodel-mapping-test.exit; do
  test -s "$EVIDENCE_DIR/$status"
  rg -q "^exit_code=0$" "$EVIDENCE_DIR/$status"
done

cat > "$EVIDENCE_DIR/g5-summary.md" <<'EOT'
# G5 PASS
- all evidence files are non-empty
- all gate exit codes are zero
- all required success tokens are verified
EOT
```

---

## 권장 실행 순서

1. G1 -> G2 -> G2b
2. G3 (구조/DI 검증)
3. G4 -> G4b (변경분 매핑 검증)
4. G5 (증빙 완결성 확인)

---

## 관련 스킬

- 아키텍처/모델/DI 기준: [flutter-architecture-guidelines](../flutter-architecture-guidelines/SKILL.md)
- 테스트 설계: [flutter-testing-guidelines](../flutter-testing-guidelines/SKILL.md)
- 디버깅/성능 분석: [flutter-debugging-guidelines](../flutter-debugging-guidelines/SKILL.md)
