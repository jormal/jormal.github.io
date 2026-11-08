# 위키 색인

## 개념

- [정적 웹 도구 프로젝트](kb/concepts/static-web-tools-project.md) - GitHub Pages 배포와 비공개 원본 제외 원칙을 포함한 정적 웹 프로젝트 방향성을 정리한다.
- [비공개 여행 일정의 단계적 구체화](kb/concepts/private-itinerary-planning.md) - 공개 가능한 여정 초안과 암호화된 상세 일정을 분리하고, 취향 질문과 숙소 조사·동선 원칙으로 여행을 구체화하는 방법을 정의한다.

## 엔티티

- [여러 계획을 분리하는 정보 구조](kb/entities/plan-index-structure.md) - `info/plan/` 인덱스와 계획별 하위 경로를 분리해 공개 초안과 비공개 상세 정보가 섞이지 않게 하는 규칙이다.
- [암호화된 일정 데이터 발행 방식](kb/entities/encrypted-itinerary-payload.md) - 일정과 미렌더링 계획 원칙의 비추적 원본을 AES-GCM 암호문으로 발행하는 흐름을 정의한다.
- [이베리아 여행 도시별 와인 노트](kb/entities/iberian-wine-guide.md) - 공개 계획 페이지의 도시별 와인 섹션 구성, 취향 기준, 후보 기록·사진 규칙을 정리한다.
- [이베리아 여행 기록 페이지](kb/entities/iberian-travel-log.md) - 암호화하지 않는 날짜별 여행 기록·지출 페이지의 구조, 정적 합계 검증 규칙, 수정마다 받는 디자인 피드백 절차를 정리한다.
- [오프라인 읽기 (서비스 워커와 HTML 사본)](kb/entities/offline-service-worker.md) - 루트 `sw.js`·`assets/offline.js`로 계획·기록 페이지를 오프라인 저장하고, 평문 HTML 사본을 내려받는 방식과 캐시 버전 올리는 법을 정리한다.

## 결정
