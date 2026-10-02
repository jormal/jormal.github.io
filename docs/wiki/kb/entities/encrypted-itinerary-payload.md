---
updated: 2026-10-29
tags: [web-crypto, encrypted-itinerary, private-itinerary]
---

# 암호화된 일정 데이터 발행 방식

## 목적

공개 정적 웹사이트에는 상세 일정의 암호문만 배포하고, 평문과 비밀 구문은 저장소 밖에 남긴다. 브라우저는
사용자가 입력한 비밀 구문을 그 세션의 메모리에서만 사용해 암호문을 복호화한다.

## 데이터 흐름

```text
private/{plan}.html 또는 private/{plan}.md (Git 비추적 평문)
  → scripts/encrypt-itinerary.mjs (로컬 비밀 구문 입력 또는 환경 변수)
  → info/plan/{plan-slug}/data.enc.json (배포 가능한 암호문)
  → unlock.js (브라우저 메모리 복호화)

private/{plan}.principles.md (Git 비추적 계획 원칙 평문)
  → scripts/encrypt-itinerary.mjs (위 일정과 같은 비밀 구문)
  → info/plan/{plan-slug}/principles.enc.json (배포 가능한 암호문, 페이지 미사용)
```

암호문은 PBKDF2-SHA-256으로 비밀 구문에서 키를 파생하고, 매번 새 salt와 IV를 생성해 AES-GCM으로
만든다. 암호문에는 알고리즘 식별자, 반복 횟수, salt, IV, ciphertext만 들어간다. HTML 원본은 정해진
태그·속성만 브라우저에서 안전하게 렌더링하므로, 표의 `rowspan`과 `colspan`으로 일정의 공통 날짜·도시·숙박을
한 번만 표시할 수 있다. 기존 Markdown 원본은 호환용으로 계속 열 수 있다.

복호화 뒤 `unlock.js`가 읽기 보조 요소를 브라우저에서만 덧붙인다(평문에는 넣지 않는다).

- 평문의 class 속성은 렌더링 때 지워지므로 표 종류는 머리글로 판별한다.
- 세부 일정 아래의 `[Day N]`으로 시작하는 문단은 도시별 메모(현지 상황·날씨·비 올 때·주의)이며, 해당 Day 표 바로 아래로 옮겨 접두어를 지운다.
- 세부 일정 표는 Day별 표로 나뉘며, 제목과 겹치는 Day·날짜·도시 열을 빼고 `시간|항목|일정|링크·확인` 네 열의
  `day-schedule-table`로 보인다. 칸 안 줄바꿈을 허용하고, 700px 이하에서는 행이 카드형으로 바뀐다.
- 요약 일정은 하루 한 행 `일차|도시·숙소|일정|고정 시각` 표다. 머리글로 `summary-table`을 붙이고,
  도시·숙소 칸 첫 줄(`A → B`면 도착 도시, `기내`면 항공)로 행마다 도시 색 클래스를 단다. 숙소 줄이 없는 연박
  행은 도시 이름을 흐리게 한다. 일정 칸은 ` · `로 나눠 항목 단위로만 줄바꿈하고, 고정 시각 칸의 `HH:MM`은 고정
  폭으로 맞추며 `(후보)`는 기울여 흐리게 보인다. 700px 이하에서는 하루가 카드 한 장이 된다.
- 제목 아래 `h2` 기준 목차를 만들고, 각 `h2` 섹션은 `details`로 감싸 기본 접힘 상태로 둔다.
  목차 링크·해시 이동은 해당 섹션을 자동으로 펼치며, "모두 펼치기 / 모두 접기" 버튼을 둔다.
- 3번 이동 시간표에서 `예약 완료:` 문단이 있는 이동편은 그 아래 전체 시간표를 `details`로 접는다.
- 투어 목록 표의 행, 식당·볼거리 목록의 도시 블록은 여행 순서(Helsinki → Madrid → Porto → Lisbon
  → Sevilla → Granada → Barcelona)로 정렬한다. 새 도시가 생기면 `CITY_ORDER`에 추가해야 정렬·분리
  대상에 포함된다.

## 운영 규칙

- 평문 원본은 반드시 `private/` 아래에 두고 Git 상태에 나타나지 않는지 확인한다.
- `data.enc.json`은 기본적으로 같은 이름의 기존 파일을 덮어쓰지 않는다. 교체가 의도된 경우에만
  `--replace`를 명시한다.
- 자동화에서는 argv가 아니라 `ITINERARY_PASSPHRASE` 환경 변수로 비밀 구문을 전달할 수 있다.
  예: `ITINERARY_PASSPHRASE=... node scripts/encrypt-itinerary.mjs --input private/{plan}.html --output info/plan/{plan-slug}/data.enc.json --replace`.
  변수값도 셸 이력·로그에 남지 않도록 안전한 실행 환경에서만 쓴다.
- 평문을 고친 뒤에는 즉시 `--replace`로 암호문을 다시 발행하고 `git status --short --ignored`로
  평문은 무시되고 암호문만 변경됐는지 확인한다. 평문이 암호문보다 새로우면 발행 완료로 취급하지 않는다.
- `node scripts/verify-static-site.mjs`는 `private/<plan>.(html|md)`가 payload보다 새롭거나
  보조 평문이 해당 `*.enc.json`보다 새롭거나, 보조 Markdown 평문에 해당 암호문이 없거나,
  `private/` 아래 파일이 추적되면 실패한다. 계획 디렉터리의 모든 `*.enc.json`은 암호문 형상도
  검사한다.
- `private/<plan>.principles.md`는 일정 수정 전에 읽는 사용자 계획 원칙의 비공개 원본이다.
  `principles.enc.json`은 일정 payload와 같은 비밀 구문으로 암호화하지만 `unlock.js`가 가져오거나
  렌더링하지 않는다.
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
