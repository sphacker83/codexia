# Telegram Menu Commands Tasks

Last Updated: 2026-04-17

## Phase Status

- Phase 1: Complete
- Phase 2: Complete
- Phase 3: Complete

## Checklist

- [x] `app/api/telegram/route.ts`에 메뉴 명령 선언 추가
- [x] 현재 메뉴 조회/비교 후 등록 helper 추가
- [x] webhook 흐름에 메뉴 동기화 연결
- [x] `workspace` 명령을 메뉴에 추가하고, help/route 동작을 새 command semantics에 맞게 정리
- [x] 관련 검증 실행
- [x] 문서/프로세스 정리

## 작업 전 필독

- 메뉴 등록 실패로 webhook 처리가 중단되면 안 된다.
- 사용자 요청 10개 명령만 메뉴에 노출한다.

## 원본 코드 참조

- `app/api/telegram/route.ts`

## 구현 대상

- Telegram Bot API `getMyCommands` / `setMyCommands`
- 명령 배열 비교 및 캐시

## 검증 참조

- 타입체크 또는 프로젝트 검증 명령
- `git diff --stat`

## 문서 반영

- context/tasks 상태를 완료 기준으로 갱신함
