---
updated: 2026-11-05
tags: [travel-log, iberian-passage-2026, spending, static-site, design-review]
---

# 이베리아 여행 기록 페이지

## 위치와 구성

- 페이지: `info/log/iberian-passage-2026/index.html` (목록: `info/log/index.html`)
- 스타일: `assets/itinerary.css` 위에 `assets/travel-log.css`를 덧씌운다. 도시 색 토큰(`.city-*`)은 계획
  요약표와 같은 값을 쓴다.
- 링크: `info/index.html`, `info/plan/index.html`에서 기록 페이지로 이어진다.
- 순서: 16일 요약표(11/2–11/17, 도시 방문 순서) → 날짜별 `<details class="log-day">` 타임라인 →
  지출 정리(분류별·도시별·전체 내역).

## 공개 범위

암호화하지 않는 공개 페이지다. 사용자가 기록으로 적어 준 내용을 바탕으로 한다. 이미 지난 날은 암호화된 계획에서
숙소명(Google 지도 링크 포함)과 항공편 번호·구간을 가져와 적을 수 있다(2026-11-05 사용자 확인). 예약번호,
결제·연락처 같은 그 밖의 비공개 세부 정보는 계속 넣지 않는다. 아직 오지 않은 날의 숙소·항공편은 적지 않는다. 계획 원칙의 "공개 페이지에는 정확한 시각을 넣지
않는다"는 계획 페이지 기준이며, 기록 페이지는 사용자가 시각과 지출을 공개 기록으로 요청했다(2026-11-04).

## 데이터 규칙

- JavaScript 없이 읽히도록 모든 내용과 합계를 정적 HTML에 쓴다.
- 지출 항목은 `li.log-entry`에 `data-amount`(EUR), `data-category`(`food`·`transport`·`activity`·
  `shopping`·`souvenir`), `data-city`를 달고, 택스리펀 대상은 `data-refund="pending"`을 단다.
  지출 내역 표의 행은 `data-ledger-amount`를 단다.
- 합계 칸은 `data-total="all|refund|day:N|category:X|city:Y"`로 표시한다.
  `node scripts/verify-static-site.mjs`가 항목을 다시 더해 표시값·내역 합과 다르면 실패한다.
- 금액은 사용자가 적은 그대로 적는다. 인원 표시가 없으면 낸 총액이고, 금액을 모르면 "금액 미기록"으로 두고
  합계에서 빼며, 금액을 받으면 항목과 모든 합계를 함께 고친다. 택스리펀 구매는 환급 전 금액으로 적고 환급액이 확정되면 따로 적는다.
- 시각은 그날 도시의 현지 시각이며 `~`는 대략, `—`는 시각 미기록이다.

## 수정 절차

기록 페이지를 고칠 때마다 디자인 피드백을 한 번 받는다. 로컬 서버로 390px·1280px 화면을 캡처해
(이 Mac에서는 Chrome 대신 WKWebView 스냅샷 도구를 썼다) Codex나 서브에이전트에 위계, 가독성, 모바일 여백,
가로 스크롤, 계획 페이지와의 일관성을 검토받고 타당한 수정을 반영한다.

## 관련 페이지

- [오프라인 읽기 (서비스 워커와 HTML 사본)](offline-service-worker.md)
- [여러 계획을 분리하는 정보 구조](plan-index-structure.md)
- [비공개 여행 일정의 단계적 구체화](../concepts/private-itinerary-planning.md)

## 출처

- 제목: 사용자 요청 - 여행 계획에 맞춘 여행 기록·지출 정리 페이지
- 작성 주체: User and Claude
- 확정일: 2026-11-04
- 저장소 경로: `info/log/iberian-passage-2026/index.html`, `assets/travel-log.css`
