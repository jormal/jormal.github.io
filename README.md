# Jormal 홈페이지

Jormal의 GitHub Pages 정적 웹사이트 저장소입니다. 서버 런타임이나 데이터베이스 없이 HTML,
CSS, JavaScript와 정적 자산만으로 배포합니다.

## 로컬 확인

정적 파일은 다음 명령으로 로컬에서 제공할 수 있습니다.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다. 저장소 규칙과 HTML 기본 요건은 의존성 없이
다음 명령으로 확인합니다.

```bash
node scripts/verify-static-site.mjs
```

## 저장소 구성

- `index.html`: GitHub Pages의 기본 진입점
- `papa/`: 브라우저에서 제공하는 도구와 정적 자산
- `scripts/`: 정적 사이트 검증 유틸리티
- `docs/wiki/`: LLM이 유지하는 프로젝트 지식 베이스
- `docs/tickets/`: 이슈별 계획 스냅샷
- `docs/ticket-reviews/`: 티켓 계획의 압축 리뷰 기록

## 문서와 협업

- 저장소 작업 규칙은 [`AGENTS.md`](AGENTS.md)와 [`CLAUDE.md`](CLAUDE.md)에 있습니다.
- 위키 운영 규칙은 [`docs/wiki/README.md`](docs/wiki/README.md)에 있습니다.
- 티켓과 리뷰 기록의 규칙은 각각 [`docs/tickets/README.md`](docs/tickets/README.md)와
  [`docs/ticket-reviews/README.md`](docs/ticket-reviews/README.md)에 있습니다.
- 커밋과 PR 제목 규칙은 [`docs/commit-convention.md`](docs/commit-convention.md)에 있습니다.
