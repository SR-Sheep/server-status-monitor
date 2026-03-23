# 서버 상태 모니터링 대시보드

폐쇄망(인트라넷) 환경에서 작동하는 순수 JavaScript 기반 서버 상태 모니터링 도구입니다.

## 특징

- **순수 HTML/CSS/JavaScript**: 외부 라이브러리 및 npm 없이 작동
- **폐쇄망 지원**: 인터넷 연결 없이 내부망에서 실행 가능
- **실시간 모니터링**: 설정된 간격마다 자동으로 서버 상태 확인
- **반응형 디자인**: 데스크톱, 태블릿, 모바일 모두 지원
- **CORS 문제 해결**: no-cors 모드 및 Image ping 방식으로 폐쇄망 서버 확인
- **경량**: 전체 프로젝트 약 13.5KB (의존성 없음)

## 주요 기능

### 실시간 대시보드
- 서버별 상태 카드 (온라인/오프라인)
- 응답 시간 측정 (밀리초)
- 마지막 확인 시간 표시
- 전체 통계 (총 서버, 온라인, 오프라인, 가동률)

### 자동 모니터링
- 각 서버마다 개별 확인 간격 설정 가능
- 백그라운드에서 자동으로 주기적 확인
- 수동 새로고침 버튼 제공

### 설정 관리
- JSON 파일로 간단한 서버 설정
- 코드 수정 없이 모니터링 대상 변경

## 시스템 요구사항

- 웹 브라우저 (Chrome, Firefox, Edge 등)
- 로컬 웹 서버 (권장) 또는 파일 시스템 접근 권한

## 설치 및 실행

### 방법 1: 로컬 웹 서버 사용 (권장)

Python이 설치되어 있는 경우:

```bash
cd C:\home\server-status-monitor

# Python 2
python -m SimpleHTTPServer 8080

# Python 3
python -m http.server 8080
```

그 다음 브라우저에서 접속:
```
http://localhost:8080
```

### 방법 2: 직접 HTML 파일 열기

Windows 탐색기에서:
```
C:\home\server-status-monitor\index.html
```
파일을 더블클릭하여 기본 브라우저에서 열기

**주의**: 일부 브라우저에서 로컬 파일 프로토콜(`file://`)의 보안 제한으로 fetch API가 작동하지 않을 수 있습니다.

### 방법 3: 인트라넷 웹 서버에 배포

회사 내부 웹 서버 (IIS, Apache, Nginx 등)에 파일들을 업로드하여 사용:

```
\\intranet-server\www\server-monitor\
```

## 설정 방법

### servers.json 파일 수정

모니터링할 서버를 추가하거나 수정하려면 `servers.json` 파일을 편집하세요:

```json
{
  "servers": [
    {
      "id": "unique-server-id",
      "name": "서버 이름",
      "url": "http://서버주소:포트",
      "checkInterval": 30000,
      "description": "서버 설명 (선택사항)"
    }
  ]
}
```

#### 설정 항목 설명

| 항목 | 설명 | 예시 |
|------|------|------|
| `id` | 고유 식별자 (영문, 숫자, 하이픈) | `"erp-server"` |
| `name` | 화면에 표시될 서버 이름 | `"ERP 서버"` |
| `url` | 확인할 서버 URL | `"http://192.168.1.100:8080"` |
| `checkInterval` | 확인 간격 (밀리초) | `30000` (30초) |
| `description` | 서버 설명 (선택사항) | `"전사 ERP 시스템"` |

#### 확인 간격 예시

- 10초: `10000`
- 30초: `30000`
- 1분: `60000`
- 5분: `300000`

### 예시 설정

```json
{
  "servers": [
    {
      "id": "erp-server",
      "name": "ERP 서버",
      "url": "http://192.168.1.100:8080/health",
      "checkInterval": 30000,
      "description": "전사 ERP 시스템"
    },
    {
      "id": "db-server",
      "name": "데이터베이스 서버",
      "url": "http://192.168.1.50:3306/ping",
      "checkInterval": 60000,
      "description": "메인 데이터베이스 서버"
    },
    {
      "id": "file-server",
      "name": "파일 서버",
      "url": "http://fileserver.company.local",
      "checkInterval": 120000,
      "description": "문서 저장 서버"
    }
  ]
}
```

## 폐쇄망 환경 고려사항

### CORS 문제

폐쇄망 내부 서버는 CORS 정책이 설정되어 있지 않을 수 있습니다. 이 도구는 다음 방법으로 해결합니다:

1. **no-cors 모드**: fetch 요청 시 `mode: 'no-cors'` 사용
   - 응답 내용은 확인할 수 없지만 요청 성공 여부 판단 가능

2. **Image Ping 방식**: img 태그를 이용한 대체 방법
   - 서버의 favicon.ico 파일 접근을 시도
   - 이미지 로드 성공/실패로 서버 상태 판단

### 로컬 파일 제약

브라우저의 보안 정책으로 `file://` 프로토콜에서는 fetch API가 제한됩니다.

**해결 방법**:
1. 로컬 웹 서버 사용 (위 실행 방법 참조)
2. 인트라넷 웹 서버에 배포
3. 브라우저 보안 설정 조정 (개발 환경만)

## 트러블슈팅

### 문제: servers.json을 불러올 수 없습니다

**원인**: 파일 경로 문제 또는 브라우저 보안 정책

**해결**:
- servers.json 파일이 index.html과 같은 폴더에 있는지 확인
- 로컬 웹 서버를 통해 실행 (`python -m http.server`)

### 문제: 모든 서버가 오프라인으로 표시됨

**원인**: CORS 정책 또는 네트워크 접근 권한

**해결**:
1. 서버 URL이 올바른지 확인
2. 브라우저 개발자 도구(F12) 콘솔에서 오류 메시지 확인
3. 서버가 실제로 작동 중인지 확인 (직접 브라우저에서 URL 접속)
4. 방화벽 설정 확인

### 문제: 응답 시간이 매우 느림

**원인**: 네트워크 지연 또는 서버 성능 문제

**해결**:
- 서버 관리자에게 문의
- checkInterval을 더 길게 설정하여 부하 감소

## 프로젝트 구조

```
C:\home\server-status-monitor\
├── .gitignore           # Git 제외 파일
├── README.md            # 이 문서
├── servers.json         # 서버 설정 파일
├── index.html           # 메인 HTML 파일
├── style.css            # 스타일시트
└── app.js               # JavaScript 로직
```

## 기술 스택

- **HTML5**: 웹 구조
- **CSS3**: 반응형 디자인 및 애니메이션
- **JavaScript (ES6+)**:
  - Fetch API (HTTP 요청)
  - Promises/Async-Await (비동기 처리)
  - setInterval (주기적 실행)
  - AbortController (타임아웃 처리)

## 브라우저 호환성

- Chrome 60+
- Firefox 55+
- Edge 79+
- Safari 11+

## 라이선스

MIT License

## 버전 정보

- **v1.0.0** (2026-03-23)
  - 최초 릴리스
  - 기본 서버 상태 모니터링 기능
  - 폐쇄망 환경 지원
  - 순수 JavaScript 구현

## 지원

문제가 발생하거나 기능 요청이 있으면 GitHub Issues를 통해 보고해 주세요.

## 기여

기여를 환영합니다! Pull Request를 제출해 주세요.
