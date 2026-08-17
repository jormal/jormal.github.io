# 위키 로그

이 파일은 위키 작업 이력을 시간순으로 기록하는 추가 전용 로그다.

- 엔트리 형식: `## [YYYY-MM-DD] {ingest|query|lint} | {title}`
- 정렬: 오래된 엔트리가 위에 오고, 최신 엔트리가 아래에 온다.
- 추가 위치: 새 엔트리는 항상 파일 끝에 추가한다.
- 상세 규칙: [`docs/wiki/README.md`](README.md)를 따른다.

## [2026-05-22] query | 정적 웹 도구 프로젝트 방향성 기록

- 사용자 요청에 따라 이 저장소의 구현 방향을 현재 지식으로 기록했다.
- `docs/wiki/kb/concepts/static-web-tools-project.md`를 생성했다.
- `docs/wiki/index.md`를 생성하고 개념 항목을 추가했다.

## [2026-08-17] ingest | 정적 사이트 저장소·문서 운영 체계 이관

- 원본 저장소의 LLM 위키 운영 규칙을 정적 사이트에 맞춰 `docs/wiki/README.md`로 이관했다.
- 티켓·리뷰·커밋 문서와 GitHub 이슈/PR/CI 구성을 정적 사이트 검증 흐름에 맞게 추가했다.
- 기존 정적 웹 프로젝트 페이지에 필수 frontmatter와 내부 출처 형식을 적용했다.
