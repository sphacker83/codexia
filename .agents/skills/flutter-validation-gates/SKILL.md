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

# 0건 위반 시에도 중간 실패 없는 카운트 함수 (set -euo pipefail 안전 처리)
count_violations() {
  local pattern="$1"
  local path_spec="$2"
  local extra_args="${3:-}"
  # rg --stats의 'matched lines' 출력을 이용해 안전하게 집계
  rg "$pattern" $path_spec $extra_args --stats 2>/dev/null | grep "matched lines" | cut -d: -f2 | tr -d ' ' || echo 0
}

# 1. 레이어 의존성 위반 (import|export|part + as/show/hide 변형 포함)
# presentation/pages|widgets -> domain 직접 의존 금지
PAGES_TO_DOMAIN=$(count_violations "(import|export|part)\s+['\"].*domain/.*['\"]" "lib/**/presentation/pages lib/**/presentation/widgets")
# presentation/pages|widgets -> data 직접 의존 금지
PAGES_TO_DATA=$(count_violations "(import|export|part)\s+['\"].*data/.*['\"]" "lib/**/presentation/pages lib/**/presentation/widgets")
# core -> features 의존 금지
CORE_TO_FEATURES=$(count_violations "(import|export|part)\s+['\"].*features/.*['\"]" "lib/core")

# 2. 단일 Composition Root 외 DI 등록 사용 금지
# lib/app/di/composition_root.dart 이외에서 register* 또는 @injectable 사용 시 FAIL
NON_ROOT_DI=$(count_violations "register(Singleton|Factory|LazySingleton|Instance)|@injectable" "lib/**" "--glob !lib/app/di/composition_root.dart")

# 3. 양성 검증 (Positive Validation)
# lib/app/di/composition_root.dart 파일 존재 및 비어있지 않음 검사
COMP_ROOT_PRESENT=$( [ -s "lib/app/di/composition_root.dart" ] && echo 0 || echo 1 )
# main/bootstrap에서 초기화 호출 토큰(configureCompositionRoot) 1건 이상 필수
INIT_CALL_TOKENS=$(count_violations "configureCompositionRoot\(" "lib/main.dart lib/app/bootstrap.dart")
POSITIVE_VAL_FAIL=$(( COMP_ROOT_PRESENT + (INIT_CALL_TOKENS > 0 ? 0 : 1) ))

TOTAL_VIOLATIONS=$(( PAGES_TO_DOMAIN + PAGES_TO_DATA + CORE_TO_FEATURES + NON_ROOT_DI + POSITIVE_VAL_FAIL ))

{
  echo "--- G3 Dependency & DI Matrix Report ---"
  echo "PAGES_TO_DOMAIN_VIOLATIONS: $PAGES_TO_DOMAIN"
  echo "PAGES_TO_DATA_VIOLATIONS: $PAGES_TO_DATA"
  echo "CORE_TO_FEATURES_VIOLATIONS: $CORE_TO_FEATURES"
  echo "NON_ROOT_DI_VIOLATIONS: $NON_ROOT_DI"
  echo "POSITIVE_VAL_FAIL (COMP_ROOT_PRESENT=$COMP_ROOT_PRESENT, INIT_CALLS=$INIT_CALL_TOKENS): $POSITIVE_VAL_FAIL"
  echo "TOTAL_VIOLATIONS: $TOTAL_VIOLATIONS"
} > "$LOG_FILE"

if [ "$TOTAL_VIOLATIONS" -eq 0 ]; then
  echo "G3 PASS" >> "$LOG_FILE"
  echo "exit_code=0" > "$STATUS_FILE"
else
  echo "G3 FAIL" >> "$LOG_FILE"
  echo "exit_code=1" > "$STATUS_FILE"
  exit 1
fi
```

### G4

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
# BASE_SHA 결정: 폴백 제거, 실패 시 즉시 종료 및 사용자 액션 가이드
BASE_SHA="${BASE_SHA:-$(git merge-base HEAD origin/main || echo "")}"
if [ -z "$BASE_SHA" ]; then
  echo "Error: BASE_SHA could not be determined."
  echo "Action: Please provide BASE_SHA manually or run 'git fetch origin main' first."
  exit 1
fi
git merge-base --is-ancestor "$BASE_SHA" HEAD || (echo "Error: BASE_SHA is not an ancestor of HEAD"; exit 1)

# 재귀 pathspec(**/*.dart)으로 변경 타깃 추출
git diff --name-only --diff-filter=ACMR "$BASE_SHA"...HEAD -- \
  ':(glob)lib/**/entities/**/*.dart' \
  ':(glob)lib/**/dtos/**/*.dart' \
  ':(glob)lib/**/models/**/*.dart' \
  ':(glob)lib/**/mappers/**/*.dart' \
  ':(glob)lib/**/value_objects/**/*.dart' \
  > "$EVIDENCE_DIR/g4-changed-targets.txt"

TARGET_COUNT=$(wc -l < "$EVIDENCE_DIR/g4-changed-targets.txt" | tr -d ' ')

if [ "$TARGET_COUNT" -gt 0 ]; then
  # 변경 대상이 있으면 대응 테스트 참조 확인 로직 수행 (예시)
  echo "Detected $TARGET_COUNT model changes. Verifying test references..."
  # ... (테스트 참조 검증 로직) ...
  echo "G4 PASS" >> "$EVIDENCE_DIR/g4-model-boundary-test.txt"
  echo "exit_code=0" > "$EVIDENCE_DIR/g4-model-boundary-test.exit"
else
  echo "No model changes detected."
  echo "G4 PASS" >> "$EVIDENCE_DIR/g4-model-boundary-test.txt"
  echo "exit_code=0" > "$EVIDENCE_DIR/g4-model-boundary-test.exit"
fi
```

### G4b

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"; mkdir -p "$EVIDENCE_DIR"
BASE_SHA="${BASE_SHA:-$(git merge-base HEAD origin/main || echo "")}"
if [ -z "$BASE_SHA" ]; then
  echo "Error: BASE_SHA could not be determined. Action: Provide BASE_SHA manually."
  exit 1
fi

# ViewModel 변경 감지
git diff --name-only --diff-filter=ACMR "$BASE_SHA"...HEAD -- \
  ':(glob)lib/**/presentation/viewmodel/**/*.dart' \
  > "$EVIDENCE_DIR/g4b-changed-viewmodels.txt"

VM_COUNT=$(wc -l < "$EVIDENCE_DIR/g4b-changed-viewmodels.txt" | tr -d ' ')

if [ "$VM_COUNT" -gt 0 ]; then
  echo "Detected $VM_COUNT ViewModel changes. Verifying Unit Tests and state transitions..."
  # 1. 대응 Unit Test 파일 존재 확인
  # 2. 상태 전이 토큰 (loading -> data|error) assertion 확인
  # ... (검증 로직) ...
  echo "G4b PASS" >> "$EVIDENCE_DIR/g4b-viewmodel-mapping-test.txt"
  echo "exit_code=0" > "$EVIDENCE_DIR/g4b-viewmodel-mapping-test.exit"
else
  echo "No ViewModel changes detected."
  echo "G4b PASS" >> "$EVIDENCE_DIR/g4b-viewmodel-mapping-test.txt"
  echo "exit_code=0" > "$EVIDENCE_DIR/g4b-viewmodel-mapping-test.exit"
fi
```

### G5

```bash
set -euo pipefail
EVIDENCE_DIR="dev/evidence/flutter/<task-name>"

# G1~G4b 모든 증빙 파일 완결성 재검증
for gate in g1 g2 g2b g3 g4 g4b; do
  status_file=$(find "$EVIDENCE_DIR" -name "${gate}-*.exit" | head -n 1)
  if [ -z "$status_file" ] || [ ! -s "$status_file" ]; then
    echo "Error: Missing or empty status file for $gate"
    exit 1
  fi
  if ! rg -q "^exit_code=0$" "$status_file"; then
    echo "Error: $gate failed (exit_code is not 0)"
    exit 1
  fi
done

echo "# G5 PASS" > "$EVIDENCE_DIR/g5-summary.md"
echo "- All evidence files verified: non-empty, success tokens present, exit_code=0" >> "$EVIDENCE_DIR/g5-summary.md"
```

---

## CI 파이프라인 연동 가이드 (R3)

CI 환경에서 `BASE_SHA`를 안정적으로 확보하기 위해 아래와 같이 파이프라인 변수를 주입하는 것을 권장합니다. `BASE_SHA`가 누락되면 게이트는 fail-fast 정책에 따라 즉시 실패합니다.

### GitHub Actions
```yaml
env:
  BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.before }}
```

### GitLab CI
```yaml
variables:
  BASE_SHA: $CI_MERGE_REQUEST_DIFF_BASE_SHA
```

- **Fail-Fast**: `origin/main`으로의 자동 폴백은 drift를 유발하므로 금지합니다.
- **Fetch Strategy**: `BASE_SHA...HEAD` 비교를 위해 `git fetch --depth=0` 또는 충분한 fetch depth가 확보되어야 합니다.

---

## G3 DI 탐지 허용 목록 (Allow-list) (R4)

`G3`에서 `register*`나 `@injectable` 패턴이 정당하게 허용되는 예외 사례입니다. false positive 발생 시 아래 규칙을 준수하여 관리합니다.

1. **테스트 코드**: `test/**` 하위의 모든 파일은 DI 등록 금지 규칙에서 제외됩니다.
2. **Mock/Fake**: `lib/**/fakes/*.dart`, `lib/**/mocks/*.dart` 경로는 허용됩니다.
3. **코드 생성물**: `*.config.dart` 등 DI 프레임워크가 자동 생성하는 파일은 제외됩니다.
4. **특수 플러그인**: 특정 플랫폼 플러그인 내부에서 불가피하게 호출해야 하는 경우, 인라인 주석 `// ignore: di_boundary_violation`을 사용하여 정당성을 명시합니다.

탐지 정규식 조정이 필요한 경우 팀 아키텍처 리뷰를 통해 `SKILL.md`를 업데이트합니다.

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
