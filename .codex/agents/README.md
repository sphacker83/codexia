# 에이전트

복잡한 다단계 작업을 위한 전문화된 에이전트.

---

## 에이전트란?

에이전트는 특정한 복잡한 작업을 처리하는 자율적인 Codex 인스턴스입니다. 스킬(인라인 가이드 제공)과 달리 에이전트는:
- 별도의 서브 태스크로 실행됨
- 최소한의 감독으로 자율적으로 작업함
- 특화된 도구 접근 권한을 가짐
- 완료 시 종합 보고서를 반환함

**핵심 장점:** 에이전트는 **독립형**입니다 — `.md` 파일을 그대로 복사하면 즉시 사용할 수 있습니다!

---

## adhdtime 프로젝트 권장 사용

현재 저장소는 **Next.js App Router + React + TypeScript** 중심입니다.

- 바로 사용 권장: `frontend-error-fixer`, `frontend-architecture-designer`, `code-refactor-master`, `refactor-planner`, `plan-reviewer`, `documentation-architect`, `web-research-specialist`
- 조건부 사용: `auth-route-tester`, `auth-route-debugger` (JWT 쿠키 인증 API가 있을 때)
- 스택 불일치 가능: `flutter-developer` (Flutter 코드가 있을 때만)

---

## Dev Docs 조건부 강제 규칙

- 개발 에이전트는 복잡도 게이트를 먼저 판단합니다.
- 게이트 기준: 대략 2시간+, 다단계, 멀티세션 가능 작업
- 게이트 통과 시:
  - 구현 전에 `dev/active/[task]/`의 `plan/context/tasks` 3파일을 만들거나 갱신
  - 구현 중에는 자기 책임 범위 변경분만 `context/tasks`에 즉시 반영
  - 세션 종료/인수인계 시 `/dev-docs-update` 또는 동등 절차로 동기화
- 게이트 미통과(단순 버그/단일 파일/짧은 수정) 시 Dev Docs를 생략할 수 있습니다.

---

## 사용 가능한 에이전트 (12)

### code-architecture-reviewer
**목적:** 아키텍처 일관성과 베스트 프랙티스 관점에서 코드를 리뷰

**사용 시점:**
- 새 기능을 구현한 후
- 큰 변경을 병합하기 전
- 코드를 리팩터링할 때
- 아키텍처 결정을 검증할 때

**통합:** ✅ 그대로 복사

---

### code-refactor-master
**목적:** 포괄적인 리팩터링을 계획하고 실행

**사용 시점:**
- 파일 구조를 재구성할 때
- 큰 컴포넌트를 쪼갤 때
- 이동 후 import 경로를 업데이트할 때
- 코드 유지보수성을 개선할 때

**통합:** ✅ 그대로 복사

---

### documentation-architect
**목적:** 종합 문서 작성

**사용 시점:**
- 새 기능을 문서화할 때
- API 문서를 만들 때
- 개발자 가이드를 작성할 때
- 아키텍처 개요를 생성할 때

**통합:** ✅ 그대로 복사

---

### flutter-developer
**목적:** 최신 stable Flutter/Dart 기반의 Flutter 개발, MVVM + Clean Architecture 적용, 모델 설계/DI 완성도 확보, 네이티브 연동 및 상태 관리 문제 해결

**사용 시점:**
- 새로운 Flutter UI 화면과 컴포넌트를 구현할 때
- MVVM + Clean Architecture(`presentation/viewmodel/domain/data/core`)를 설계/적용할 때
- `repository`/`usecase`/`viewmodel` 경계를 정리할 때
- Entity/DTO/Model/Mapper/Value Object 경계를 설계할 때
- Composition Root 기반 DI(Constructor Injection, 인터페이스 바인딩, 테스트 교체 주입)를 구성할 때
- Provider, Riverpod, BLoC 등 상태 관리 로직을 구현하거나 디버깅할 때
- iOS/Android 네이티브 연동(MethodChannel) 관련 에러를 해결할 때
- Flutter 앱의 렌더링 성능을 최적화할 때
- 패키지 선정 시 Flutter Favorite 배지(pub.dev)와 유지보수 상태를 검증할 때
- 레이어/모델/DI/테스트 완료 게이트를 점검할 때

**통합:** ✅ 그대로 복사

---

### frontend-error-fixer
**목적:** 프론트엔드 에러를 디버그하고 수정

**사용 시점:**
- 브라우저 콘솔 에러
- 프론트엔드의 TypeScript 컴파일 에러
- React 에러
- 빌드 실패

**통합:** ⚠️ 스크린샷 경로를 참조할 수 있음 - 필요 시 업데이트

---

### plan-reviewer
**목적:** 구현 전에 개발 계획을 리뷰

**사용 시점:**
- 복잡한 기능을 시작하기 전
- 아키텍처 계획을 검증할 때
- 잠재적 이슈를 조기에 식별할 때
- 접근 방식에 대한 세컨드 오피니언이 필요할 때

**통합:** ✅ 그대로 복사

---

### refactor-planner
**목적:** 종합적인 리팩터링 전략 수립

**사용 시점:**
- 코드 재구성을 계획할 때
- 레거시 코드를 현대화할 때
- 큰 파일을 쪼갤 때
- 코드 구조를 개선할 때

**통합:** ✅ 그대로 복사

---

### frontend-architecture-designer
**목적:** 프론트엔드 아키텍처 재설계 + 리팩터링 문서화

**사용 시점:**
- 프론트 구조가 무너져 경계 재설계가 필요할 때
- 대형 컴포넌트를 기능 모듈로 분해할 때
- 아키텍처 블루프린트/로드맵/ADR가 동시에 필요할 때
- 장기 리팩터링을 `dev/active` 트랙으로 운영할 때

**통합:** ✅ 그대로 복사

---

### web-research-specialist
**목적:** 온라인에서 기술 이슈를 조사

**사용 시점:**
- 잘 알려지지 않은(난해한) 에러를 디버깅할 때
- 문제 해결책을 찾을 때
- 베스트 프랙티스를 조사할 때
- 구현 접근 방식을 비교할 때

**통합:** ✅ 그대로 복사

---

### auth-route-tester
**목적:** 인증이 필요한 API 엔드포인트 테스트

**사용 시점:**
- JWT 쿠키 인증이 필요한 라우트를 테스트할 때
- 엔드포인트 동작을 검증할 때
- 인증 이슈를 디버깅할 때

**통합:** ⚠️ JWT 쿠키 기반 인증 필요

---

### auth-route-debugger
**목적:** 인증 이슈 디버깅

**사용 시점:**
- 인증 실패
- 토큰 이슈
- 쿠키 문제
- 권한 에러

**통합:** ⚠️ JWT 쿠키 기반 인증 필요

---

### auto-error-resolver
**목적:** TypeScript 컴파일 에러를 자동으로 수정

**사용 시점:**
- TypeScript 에러로 빌드가 실패할 때
- 리팩터링 후 타입이 깨졌을 때
- 체계적인 에러 해결이 필요할 때

**통합:** ⚠️ 경로 업데이트가 필요할 수 있음

---

## 에이전트 통합 방법

### 표준 통합 (대부분의 에이전트)

**1단계: 파일 복사**
```bash
cp showcase/.codex/agents/agent-name.md \\
   your-project/.codex/agents/
```

**2단계: 검증 (선택)**
```bash
# 하드코딩된 경로 확인
grep -n "~/git/\\|/root/git/\\|/Users/" your-project/.codex/agents/agent-name.md
```

**3단계: 사용**
Codex에게 요청: "[agent-name] 에이전트를 사용해서 [task] 해줘"

끝입니다! 에이전트는 바로 동작합니다.

---

### 커스터마이징이 필요한 에이전트

**frontend-error-fixer:**
- 스크린샷 경로를 참조할 수 있음
- 사용자에게 질문: "스크린샷을 어디에 저장하면 될까요?"
- 에이전트 파일의 경로 업데이트

**auth-route-tester / auth-route-debugger:**
- JWT 쿠키 인증이 필요함
- 예시에 있는 서비스 URL 업데이트
- 사용자의 인증 구성에 맞게 커스터마이징

**auto-error-resolver:**
- 프로젝트 경로가 하드코딩되어 있을 수 있음
- `$CODEX_PROJECT_DIR` 또는 상대 경로를 사용하도록 업데이트

---

## 에이전트 vs 스킬: 언제 쓰나

| 에이전트를 사용할 때... | 스킬을 사용할 때... |
|-------------------|-------------------|
| 작업에 여러 단계가 필요 | 인라인 가이드가 필요 |
| 복잡한 분석이 필요 | 베스트 프랙티스 점검 |
| 자율 작업을 선호 | 통제권을 유지하고 싶음 |
| 작업의 종료 목표가 명확 | 진행 중인 개발 작업 |
| 예: "모든 컨트롤러 리뷰" | 예: "새 라우트 만들기" |

**둘은 함께 사용할 수도 있습니다:**
- 스킬은 개발 중 패턴을 제공
- 에이전트는 완료 후 결과를 리뷰

---

## 에이전트 빠른 참조

| 에이전트 | 복잡도 | 커스터마이징 | 인증 필요 |
|-------|-----------|---------------|---------------|
| code-architecture-reviewer | 중간 | ✅ 없음 | 아니오 |
| code-refactor-master | 높음 | ✅ 없음 | 아니오 |
| documentation-architect | 중간 | ✅ 없음 | 아니오 |
| flutter-developer | 높음 | ✅ 없음 | 아니오 |
| frontend-error-fixer | 중간 | ⚠️ 스크린샷 경로 | 아니오 |
| frontend-architecture-designer | 높음 | ✅ 없음 | 아니오 |
| plan-reviewer | 낮음 | ✅ 없음 | 아니오 |
| refactor-planner | 중간 | ✅ 없음 | 아니오 |
| web-research-specialist | 낮음 | ✅ 없음 | 아니오 |
| auth-route-tester | 중간 | ⚠️ 인증 설정 | JWT 쿠키 |
| auth-route-debugger | 중간 | ⚠️ 인증 설정 | JWT 쿠키 |
| auto-error-resolver | 낮음 | ⚠️ 경로 | 아니오 |

---

## Roo Codex용

**사용자에게 에이전트를 통합해 줄 때:**

1. **[CODEX_INTEGRATION_GUIDE.md](../../CODEX_INTEGRATION_GUIDE.md)을 읽기**
2. **.md 파일을 그대로 복사** - 에이전트는 독립형
3. **하드코딩된 경로 확인:**
   ```bash
   grep "~/git/\\|/root/" agent-name.md
   ```
4. **발견되면 경로를** `$CODEX_PROJECT_DIR` **또는** `.` **로 업데이트**
5. **인증 에이전트의 경우:** 먼저 JWT 쿠키 인증을 사용하는지 질문

**끝!** 에이전트는 통합하기 가장 쉬운 구성요소입니다.

---

## 나만의 에이전트 만들기

에이전트는 선택적으로 YAML 프런트매터를 포함하는 마크다운 파일입니다:

```markdown
# 에이전트 이름

## 목적
이 에이전트가 하는 일

## 지시사항
자율 실행을 위한 단계별 지시

## 사용 가능한 도구
이 에이전트가 사용할 수 있는 도구 목록

## 기대 출력
어떤 형식으로 결과를 반환할지
```

**팁:**
- 지시사항을 매우 구체적으로 작성
- 복잡한 작업은 번호가 매겨진 단계로 분해
- 무엇을 반환해야 하는지 정확히 명시
- 좋은 출력 예시를 포함
- 사용 가능한 도구를 명시적으로 나열

---

## 문제 해결

### 에이전트를 찾을 수 없음

**확인:**
```bash
# 에이전트 파일이 존재하나요?
ls -la .codex/agents/[agent-name].md
```

### 에이전트가 경로 에러로 실패함

**하드코딩된 경로 확인:**
```bash
grep "~/\\|/root/\\|/Users/" .codex/agents/[agent-name].md
```

**수정:**
```bash
sed -i 's|~/git/.*project|$CODEX_PROJECT_DIR|g' .codex/agents/[agent-name].md
```

---

## 다음 단계

1. **위 에이전트를 둘러보기** - 작업에 유용한 것 찾기
2. **필요한 것만 복사하기** - .md 파일만
3. **Codex에게 사용 요청하기** - "[agent] 를 사용해서 [task] 해줘"
4. **직접 만들기** - 내 요구에 맞는 패턴을 따라가기

**질문이 있나요?** [CODEX_INTEGRATION_GUIDE.md](../../CODEX_INTEGRATION_GUIDE.md)를 참고하세요
