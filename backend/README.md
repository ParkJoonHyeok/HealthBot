# Spring 백엔드

현재 범위: Controller → Service → MyBatis → PostgreSQL 연결 기반, Flyway V001 적용, 회원 Mapper의 파라미터 바인딩. 웹앱의 증상/병원 검색 API와 회원 인증은 아직 이 서버로 이전하지 않았습니다.

## 고정된 도구

- Java 21, Maven 3.9.11 (Wrapper 3.3.4, 배포본 SHA-256 고정)
- Spring Boot 3.5.16, MyBatis Spring Boot Starter 3.0.5
- 테스트: Zonky Embedded Postgres 2.2.2, PostgreSQL 바이너리 BOM 17.11.0
- JDBC·Flyway 버전은 Spring Boot의 고정된 BOM에서 관리합니다.

## 빌드 및 통합 테스트

표준 JDK 21 환경에서:

```sh
cd backend
./mvnw -B -ntp verify
```

Linux 비관리자 계정에서 테스트합니다. 테스트가 별도 PostgreSQL 프로세스를 임시 디렉터리와 임의 포트로 시작하고 종료하므로 외부 DB와 Docker가 필요하지 않습니다. 테스트용 로컬 DB는 trust 인증을 사용하며 운영 설정으로 사용하면 안 됩니다. 처음 실행할 때 Maven Central에서 도구·의존성·플랫폼 바이너리를 받습니다.

통합 테스트는 V001 적용 및 재실행 시 중복 적용 방지, MyBatis 바인딩/중복 이메일, Spring 트랜잭션 롤백, 실제 HTTP health 응답을 확인합니다. 별도 MVC 테스트는 DB 오류에 대해 연결 정보 없는 503 응답을 검증합니다.

## 이 클라우드 환경

기본 Java 21 이미지에는 javac 실행 파일과 ct.sym이 없습니다. 런타임의 jdk.compiler 모듈은 사용할 수 있으므로 같은 Java 21에서만 source/target 21을 지정해 검증했습니다. 저장소 기본 빌드는 표준 --release 21을 유지합니다.

```sh
python backend/cloud_maven.py verify
```

도우미는 상속된 HTTPS 프록시·NO_PROXY를 임시 Maven 설정에 반영하고 TLS 검증을 유지합니다. 설정은 실행 후 삭제합니다. 도구/의존성 캐시는 backend/.cache에 둡니다. 선택적으로 HEALBOT_MAVEN_CACHE로 다른 쓰기 가능한 캐시 경로를 지정할 수 있습니다. 전체 JDK가 있으면 컴파일 옵션을 변경하지 않습니다. 프록시 URL 자체에 인증정보가 있다면 별도의 보안 Maven 설정을 준비해야 합니다.

## 독립 실행 — 개발용 DB 필요

빈 PostgreSQL 개발 DB와 접근 계정을 준비하고 아래 **이름의 환경변수**를 안전하게 설정합니다. 접속 비밀번호를 커밋하거나 채팅에 넣지 않습니다.

| 변수                | 의미                |
| ------------------- | ------------------- |
| HEALBOT_DB_URL      | PostgreSQL JDBC URL |
| HEALBOT_DB_USER     | 개발 DB 사용자      |
| HEALBOT_DB_PASSWORD | 개발 DB 비밀번호    |
| BACKEND_PORT        | 기본 8080           |

```sh
cd backend
./mvnw spring-boot:run
# 또는 verify로 생성한 실행 jar
java -jar target/healbot-backend-0.1.0-SNAPSHOT.jar
```

이 서버는 .env를 자동으로 읽지 않습니다. 시작 시 필수 DB 설정이 없거나 마이그레이션이 실패하면 시작에 실패합니다. 운영 DB에 자동으로 연결하지 마세요. /api/health는 DB 연결이 정상일 때 200 `{"status":"ok"}`, 시작 이후 DB 장애 시 503 `{"status":"unavailable"}`를 반환합니다. 별도의 단순 liveness 엔드포인트는 아직 없습니다.

db/migrations를 Maven 리소스로 복사하므로 SQL 원본은 하나입니다. Flyway clean은 비활성화했고 기존 스키마의 임의 baseline도 설정하지 않았습니다. 운영에서는 마이그레이션 계정과 앱 계정 분리, 백업/복구 및 장애 시 동작을 추가 검증해야 합니다.

## 남은 작업

- 기존 증상/병원 API와 입력 검증·요청 제한을 Spring으로 이전
- Spring Security, 회원 Service/Controller, BCrypt, 세션·CSRF·권한 검증
- React 이전, 운영 DB·배포·복구 검증

Node 프로토타입은 루트에서 npm start로 계속 실행됩니다. 이번 작업은 Spring 기반의 검증 가능한 출발점이며 전체 앱 이전이나 공개 서비스 배포가 아닙니다.
