# Telegram Menu Commands Plan

Last Updated: 2026-04-11

## Summary

텔레그램 봇 입력창 왼쪽 메뉴에 노출되는 명령 목록을 현재 봇이 실제 지원하는 커맨드 기준으로 코드에서 직접 등록한다.

## Current State Analysis

- `app/api/telegram/route.ts`에는 명령 파서와 도움말 텍스트가 있다.
- 하지만 Telegram Bot API `setMyCommands` 호출은 없어, 입력창 왼쪽 메뉴는 코드와 분리되어 수동 관리되는 상태다.
- 사용자는 `/status`, `/jobs`, `/session`, `/resume`, `/recent`, `/cancel`, `/new`, `/model`, `/effort`, `/help` 목록으로 메뉴를 맞추길 원한다.

## Target State

- 텔레그램 webhook 처리 경로에서 메뉴 명령 목록을 코드로 선언한다.
- 런타임 중복 호출은 피하고, 현재 등록 상태와 다를 때만 `setMyCommands`를 호출한다.
- 도움말과 실제 메뉴가 크게 어긋나지 않도록 최소한의 일관성을 유지한다.

## Execution Map

### Phase 1: Command registration helper

- 메뉴에 노출할 명령/설명 배열 정의
- `getMyCommands`와 `setMyCommands` 래퍼 추가
- 현재 상태와 비교 후 변경 시에만 등록

### Phase 2: Route integration

- webhook 진입 시 안전하게 동기화 호출
- 실패 시 메시지 처리를 막지 않도록 비치명 처리

### Phase 3: Verification

- 타입체크 또는 관련 검증 실행
- diff/self review 확인

## Acceptance Criteria

- 텔레그램 메뉴 등록용 명령 배열이 코드에 존재한다.
- 메뉴 항목이 사용자 요청 10개와 일치한다.
- webhook 요청 처리 흐름이 메뉴 동기화 실패 때문에 중단되지 않는다.

## Validation Gate

- `app/api/telegram/route.ts` 타입 오류가 없어야 한다.
- 변경 파일 diff가 메뉴 등록 목적에만 국한되어야 한다.

## Risks And Mitigations

- Telegram API 추가 호출로 지연이 생길 수 있다.
  - 현재 명령과 비교 후 다를 때만 `setMyCommands` 호출한다.
- 메뉴와 도움말이 장기적으로 다시 어긋날 수 있다.
  - 등록 배열을 명시적으로 중앙 선언하고, 이번 수정은 최소 범위로 유지한다.
