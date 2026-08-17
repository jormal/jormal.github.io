# 커밋 컨벤션

이 저장소는 [Conventional Commits 1.0](https://www.conventionalcommits.org/)을 따른다.

## 커밋 주체

- 커밋은 사용자가 해당 턴에서 명시적으로 요청했을 때만 에이전트가 실행한다.
- 에이전트는 사용자 요청 없이 스테이징하지 않는다.
- 푸시, 강제 푸시, 리베이스, 기존 커밋 수정(amend)은 에이전트가 실행하지 않는다.

## 메시지 형식

```text
<type>(<scope>): <subject>

<body>

<footer>
```

- 제목·본문·푸터는 영어로 작성한다.
- 제목은 명령형 현재 시제, 소문자 시작, 마침표 없음으로 쓴다. 제목 전체는 72자 이내다.
- 한 커밋에는 한 가지 논리적 변경만 담는다.

## Type

| Type | 사용 시점 |
| --- | --- |
| `feat` | 사용자에게 보이는 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 동작 변화 없는 내부 구조 개선 |
| `perf` | 성능 개선 |
| `docs` | 문서만 변경 |
| `test` | 테스트나 검증 추가·수정 |
| `build` | 빌드·도구 설정 변경 |
| `ci` | CI 설정 변경 |
| `chore` | 그 외 저장소 관리 작업 |

## Scope

| 대상 | 스코프 |
| --- | --- |
| 사이트 HTML·CSS·JavaScript | `site` |
| `papa/` 도구 | `papa` |
| 검증 스크립트 | `tools` |
| 저장소 전반 설정 | `repo` |
| 위키 | `wiki` |
| 티켓·리뷰 | `tickets` |
| 그 외 문서와 루트 README | `docs` |
| 에이전트 지침 | `agents` |

## Footer와 PR

- 티켓 참조는 `Refs: ISSUE-001-01` 형식을 쓴다.
- 호환성 깨짐은 `BREAKING CHANGE: <설명>`으로 기록한다.
- PR 제목도 커밋 제목과 같은 규칙의 영어 문장으로 쓴다. PR 본문은 한국어로 작성한다.

예시:

```text
feat(site): add accessible homepage navigation
```
