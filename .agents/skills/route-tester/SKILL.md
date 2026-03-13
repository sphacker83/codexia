---
name: route-tester
description: 쿠키 기반 인증을 사용해 프로젝트의 인증된 라우트를 테스트합니다. API 엔드포인트 테스트, 변경 후 라우트 기능 검증, 인증 이슈 디버깅 시 이 스킬을 사용하세요. test-auth-route.js 사용 패턴과 mock 인증 패턴을 포함합니다.
---

# 프로젝트 라우트 테스터 스킬

## 목적
이 스킬은 쿠키 기반 JWT 인증을 사용해 프로젝트의 인증된 라우트를 테스트하는 패턴을 제공합니다.

## 이 스킬을 사용해야 하는 경우
- 새 API 엔드포인트를 테스트할 때
- 변경 후 라우트 기능을 검증할 때
- 인증 이슈를 디버깅할 때
- POST/PUT/DELETE 작업을 테스트할 때
- 요청/응답 데이터를 확인할 때

## 프로젝트 인증 개요

프로젝트는 다음을 사용합니다:
- SSO용 **Keycloak**(realm: yourRealm)
- **쿠키 기반 JWT** 토큰(Bearer 헤더가 아님)
- **쿠키 이름**: `refresh_token`
- **JWT 서명**: `config.ini`의 시크릿 사용

## 테스트 방법

### 방법 1: test-auth-route.js (권장)

`test-auth-route.js` 스크립트가 인증 관련 복잡도를 자동으로 처리합니다.

**위치**: `/root/git/your project_pre/scripts/test-auth-route.js`

#### 기본 GET 요청

```bash
node scripts/test-auth-route.js http://localhost:3000/blog-api/api/endpoint
```

#### JSON 데이터가 있는 POST 요청

```bash
node scripts/test-auth-route.js \
    http://localhost:3000/blog-api/777/submit \
    POST \
    '{"responses":{"4577":"13295"},"submissionID":5,"stepInstanceId":"11"}'
```

#### 스크립트 동작

1. Keycloak에서 refresh token을 가져옵니다
   - 사용자 이름: `testuser`
   - 비밀번호: `testpassword`
2. `config.ini`의 JWT 시크릿으로 토큰을 서명합니다
3. 쿠키 헤더를 생성합니다: `refresh_token=<signed-token>`
4. 인증된 요청을 보냅니다
5. 수동으로 재현할 수 있도록 정확한 curl 명령어를 출력합니다

#### 스크립트 출력

스크립트 출력:
- 요청 상세
- 응답 상태와 본문
- 수동 재현을 위한 curl 명령어

**참고**: 스크립트 출력이 장황합니다. 출력에서 실제 응답 부분을 찾아보세요.

### 방법 2: 토큰을 사용한 수동 curl

test-auth-route.js 출력에 나온 curl 명령어를 사용하세요:

```bash
# 스크립트 출력은 대략 아래와 같습니다:
# 💡 curl로 수동 테스트:
# curl -b "refresh_token=eyJhbGci..." http://localhost:3000/blog-api/api/endpoint

# 해당 curl 명령어를 복사해서 수정:
curl -X POST http://localhost:3000/blog-api/777/submit \
  -H "Content-Type: application/json" \
  -b "refresh_token=<COPY_TOKEN_FROM_SCRIPT_OUTPUT>" \
  -d '{"your": "data"}'
```

### 방법 3: mock 인증(개발 전용 - 가장 쉬움)

개발 환경에서는 mock 인증으로 Keycloak을 완전히 우회할 수 있습니다.

#### 설정

```bash
# 서비스의 .env 파일에 추가(예: blog-api/.env)
MOCK_AUTH=true
MOCK_USER_ID=test-user
MOCK_USER_ROLES=admin,operations
```

#### 사용법

```bash
curl -H "X-Mock-Auth: true" \
     -H "X-Mock-User: test-user" \
     -H "X-Mock-Roles: admin,operations" \
     http://localhost:3002/api/protected
```

#### Mock 인증 요구사항

mock 인증은 다음 조건에서만 동작합니다:
- `NODE_ENV`가 `development` 또는 `test`
- 라우트에 `mockAuth` 미들웨어가 추가됨
- 프로덕션에서는 **절대** 동작하지 않음(보안 기능)

## 자주 쓰는 테스트 패턴

### 폼 제출 테스트

```bash
node scripts/test-auth-route.js \
    http://localhost:3000/blog-api/777/submit \
    POST \
    '{"responses":{"4577":"13295"},"submissionID":5,"stepInstanceId":"11"}'
```

### 워크플로 시작 테스트

```bash
node scripts/test-auth-route.js \
    http://localhost:3002/api/workflow/start \
    POST \
    '{"workflowCode":"DHS_CLOSEOUT","entityType":"Submission","entityID":123}'
```

### 워크플로 스텝 완료 테스트

```bash
node scripts/test-auth-route.js \
    http://localhost:3002/api/workflow/step/complete \
    POST \
    '{"stepInstanceID":789,"answers":{"decision":"approved","comments":"Looks good"}}'
```

### 쿼리 파라미터가 있는 GET 테스트

```bash
node scripts/test-auth-route.js \
    "http://localhost:3002/api/workflows?status=active&limit=10"
```

### 파일 업로드 테스트

```bash
# 먼저 test-auth-route.js로 토큰을 얻은 뒤:
curl -X POST http://localhost:5000/upload \
  -H "Content-Type: multipart/form-data" \
  -b "refresh_token=<TOKEN>" \
  -F "file=@/path/to/file.pdf" \
  -F "metadata={\"description\":\"Test file\"}"
```

## 하드코딩된 테스트 계정 정보

`test-auth-route.js` 스크립트는 다음 계정 정보를 사용합니다:

- **사용자 이름**: `testuser`
- **비밀번호**: `testpassword`
- **Keycloak URL**: `config.ini`에서 가져옴(보통 `http://localhost:8081`)
- **Realm**: `yourRealm`
- **Client ID**: `config.ini`에서 가져옴

## 서비스 포트

| 서비스 | 포트 | 기본 URL |
|---------|------|----------|
| Users   | 3000 | http://localhost:3000 |
| Projects| 3001 | http://localhost:3001 |
| Form    | 3002 | http://localhost:3002 |
| Email   | 3003 | http://localhost:3003 |
| Uploads | 5000 | http://localhost:5000 |

## 라우트 프리픽스(접두사)

각 서비스의 `/src/app.ts`에서 라우트 프리픽스를 확인하세요:

```typescript
// blog-api/src/app.ts 예시
app.use('/blog-api/api', formRoutes);          // 프리픽스: /blog-api/api
app.use('/api/workflow', workflowRoutes);  // 프리픽스: /api/workflow
```

**전체 라우트(Full Route)** = 기본 URL + 프리픽스 + 라우트 경로

예시:
- 기본 URL: `http://localhost:3002`
- 프리픽스: `/form`
- 라우트: `/777/submit`
- **전체 URL**: `http://localhost:3000/blog-api/777/submit`

## 테스트 체크리스트

라우트를 테스트하기 전에:

- [ ] 서비스 식별(form, email, users 등)
- [ ] 올바른 포트 확인
- [ ] `app.ts`의 라우트 프리픽스 확인
- [ ] 전체 URL 구성
- [ ] 요청 바디 준비(POST/PUT인 경우)
- [ ] 인증 방식 결정
- [ ] 테스트 실행
- [ ] 응답 상태와 데이터 검증
- [ ] 해당되는 경우 DB 변경 확인

## DB 변경 확인

데이터를 변경하는 라우트를 테스트한 후:

```bash
# MySQL 접속
docker exec -i local-mysql mysql -u root -ppassword1 blog_dev

# 특정 테이블 확인
mysql> SELECT * FROM WorkflowInstance WHERE id = 123;
mysql> SELECT * FROM WorkflowStepInstance WHERE instanceId = 123;
mysql> SELECT * FROM WorkflowNotification WHERE recipientUserId = 'user-123';
```

## 실패한 테스트 디버깅

### 401 Unauthorized(인증 실패)

**가능한 원인**:
1. 토큰 만료( `test-auth-route.js`로 재발급)
2. 쿠키 포맷이 올바르지 않음
3. JWT 시크릿 불일치
4. Keycloak이 실행 중이 아님

**해결 방법**:
```bash
# Keycloak 실행 여부 확인
docker ps | grep keycloak

# 토큰 재생성
node scripts/test-auth-route.js http://localhost:3002/api/health

# config.ini의 jwtSecret이 올바른지 확인
```

### 403 Forbidden(권한 없음)

**가능한 원인**:
1. 사용자에게 필요한 역할(role)이 없음
2. 리소스 권한 설정이 올바르지 않음
3. 라우트가 특정 권한을 요구함

**해결 방법**:
```bash
# admin 역할로 mock 인증 사용
curl -H "X-Mock-Auth: true" \
     -H "X-Mock-User: test-admin" \
     -H "X-Mock-Roles: admin" \
     http://localhost:3002/api/protected
```

### 404 Not Found(찾을 수 없음)

**가능한 원인**:
1. URL이 올바르지 않음
2. 라우트 프리픽스가 누락됨
3. 라우트가 등록되지 않음

**해결 방법**:
1. `app.ts`에서 라우트 프리픽스를 확인
2. 라우트 등록 여부 확인
3. 서비스 실행 여부 확인(`pm2 list`)

### 500 Internal Server Error(서버 내부 오류)

**가능한 원인**:
1. DB 연결 이슈
2. 필수 필드 누락
3. 검증(Validation) 에러
4. 애플리케이션 에러

**해결 방법**:
1. 서비스 로그 확인(`pm2 logs <service>`)
2. Sentry에서 에러 상세 확인
3. 요청 바디가 기대 스키마와 일치하는지 확인
4. DB 연결 상태 확인

## auth-route-tester 에이전트 사용

변경 후 라우트를 포괄적으로 테스트하려면:

1. **영향받는 라우트 식별**
2. **라우트 정보 수집**:
   - 전체 라우트 경로(프리픽스 포함)
   - 기대하는 POST 데이터
   - 확인할 테이블
3. **auth-route-tester 에이전트 호출**

에이전트는 다음을 수행합니다:
- 올바른 인증으로 라우트를 테스트
- DB 변경 검증
- 응답 포맷 확인
- 이슈 보고

## 테스트 시나리오 예시

### 새 라우트를 만든 후

```bash
# 1. 정상 데이터로 테스트
node scripts/test-auth-route.js \
    http://localhost:3002/api/my-new-route \
    POST \
    '{"field1":"value1","field2":"value2"}'

# 2. DB 확인
docker exec -i local-mysql mysql -u root -ppassword1 blog_dev \
    -e "SELECT * FROM MyTable ORDER BY createdAt DESC LIMIT 1;"

# 3. 잘못된 데이터로 테스트
node scripts/test-auth-route.js \
    http://localhost:3002/api/my-new-route \
    POST \
    '{"field1":"invalid"}'

# 4. 인증 없이 테스트
curl http://localhost:3002/api/my-new-route
# 401을 반환해야 함
```

### 라우트를 수정한 후

```bash
# 1. 기존 기능이 여전히 동작하는지 테스트
node scripts/test-auth-route.js \
    http://localhost:3002/api/existing-route \
    POST \
    '{"existing":"data"}'

# 2. 새 기능 테스트
node scripts/test-auth-route.js \
    http://localhost:3002/api/existing-route \
    POST \
    '{"new":"field","existing":"data"}'

# 3. 하위 호환성(backward compatibility) 확인
# 이전 요청 포맷으로 테스트(해당되는 경우)
```

## 설정 파일

### config.ini (서비스별)

```ini
[keycloak]
url = http://localhost:8081
realm = yourRealm
clientId = app-client

[jwt]
jwtSecret = your-jwt-secret-here
```

### .env (서비스별)

```bash
NODE_ENV=development
MOCK_AUTH=true           # 선택: mock 인증 활성화
MOCK_USER_ID=test-user   # 선택: 기본 mock 사용자
MOCK_USER_ROLES=admin    # 선택: 기본 mock 역할(role)
```

## 핵심 파일

- `/root/git/your project_pre/scripts/test-auth-route.js` - 메인 테스트 스크립트
- `/blog-api/src/app.ts` - Form 서비스 라우트
- `/notifications/src/app.ts` - Email 서비스 라우트
- `/auth/src/app.ts` - Users 서비스 라우트
- `/config.ini` - 서비스 설정
- `/.env` - 환경 변수

## 관련 스킬

- **database-verification**으로 DB 변경을 검증하세요
- **error-tracking**으로 캡처된 에러를 확인하세요
- 워크플로 라우트 테스트는 **workflow-builder**를 사용하세요
- 알림 발송 검증은 **notification-sender**를 사용하세요
