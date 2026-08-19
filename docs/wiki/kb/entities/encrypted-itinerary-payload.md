---
updated: 2026-08-20
tags: [web-crypto, encrypted-itinerary, private-itinerary]
---

# 암호화된 일정 데이터 발행 방식

## 목적

공개 정적 웹사이트에는 상세 일정의 암호문만 배포하고, 평문과 비밀 구문은 저장소 밖에 남긴다. 브라우저는
사용자가 입력한 비밀 구문을 그 세션의 메모리에서만 사용해 암호문을 복호화한다.

## 데이터 흐름

```text
private/{plan}.html 또는 private/{plan}.md (Git 비추적 평문)
  → scripts/encrypt-itinerary.mjs (로컬 비밀 구문 입력)
  → info/plan/{plan-slug}/data.enc.json (배포 가능한 암호문)
  → unlock.js (브라우저 메모리 복호화)
```

암호문은 PBKDF2-SHA-256으로 비밀 구문에서 키를 파생하고, 매번 새 salt와 IV를 생성해 AES-GCM으로
만든다. 암호문에는 알고리즘 식별자, 반복 횟수, salt, IV, ciphertext만 들어간다. HTML 원본은 정해진
태그·속성만 브라우저에서 안전하게 렌더링하므로, 표의 `rowspan`과 `colspan`으로 일정의 공통 날짜·도시·숙박을
한 번만 표시할 수 있다. 기존 Markdown 원본은 호환용으로 계속 열 수 있다.

## 운영 규칙

- 평문 원본은 반드시 `private/` 아래에 두고 Git 상태에 나타나지 않는지 확인한다.
- `data.enc.json`은 같은 이름의 기존 파일을 덮어쓰지 않는다. 갱신할 때는 기존 암호문을 의도적으로
  교체했는지 확인한 뒤 새 파일을 발행한다.
- 비밀 구문은 최소 4자로 입력할 수 있다. 다만 12자 미만은 추측·대입에 약하므로, 민감도가 낮은 공유에만
  사용하고 가능하면 긴 문장형 구문을 쓴다. 구문은 저장소·이슈·URL·커밋 메시지·브라우저 영구 저장소에 넣지 않는다.
- 비밀 구문 분실 시 암호문을 복구할 수 없다. 새 비밀 구문으로 평문 원본을 다시 암호화해야 한다.
- 이 방식은 암호화된 내용의 기밀성과 변경 감지를 제공하지만, 열람 권한 철회·열람 감사·화면 캡처 방지는
  제공하지 않는다.

## 검증

`node scripts/test-itinerary-crypto.mjs`는 민감하지 않은 fixture로 암호화·복호화 왕복과 잘못된 비밀
구문 실패를 검사한다. 실제 일정의 평문을 테스트 fixture에 넣지 않는다.

## 관련 페이지

- [비공개 여행 일정의 단계적 구체화](../concepts/private-itinerary-planning.md)
- [여러 계획을 분리하는 정보 구조](plan-index-structure.md)

## 출처

- 제목: 사용자 요청 - 정적 사이트에서 비공개 일정 암호화
- 작성 주체: User and Codex
- 확정일: 2026-08-17
- 저장소 경로: `docs/wiki/kb/entities/encrypted-itinerary-payload.md`
