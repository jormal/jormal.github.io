---
updated: 2026-08-17
tags: [plan-index, private-itinerary, information-architecture]
---

# 여러 계획을 분리하는 정보 구조

## 목적

`info/plan/`은 특정 여행의 문서가 아니라 모든 계획을 나열하는 인덱스다. 각각의 계획은 고유 슬러그를
가진 하위 경로에 두어, 공개 초안·결정 질문·암호화된 상세 정보를 다른 계획과 섞지 않는다.

## 경로 규칙

```text
info/
`-- plan/
    |-- index.html                         # 여러 계획의 공개 목록
    `-- {plan-slug}/
        `-- index.html                     # 하나의 계획의 공개 초안과 구체화 문서
```

- `{plan-slug}`는 계획을 구별할 수 있는 kebab-case 이름이다.
- 새 계획을 만들면 `info/plan/index.html`에 공개용 카드 하나만 추가한다.
- 다른 계획의 상세 일정, 예산, 암호문, 비밀 구문을 재사용하거나 한 계획 페이지에서 링크하지 않는다.
- 암호화된 상세 데이터가 필요하면 각 계획의 고유 데이터 파일을 사용하고, 평문 원본은 `private/` 같은
  Git 비추적 경로에만 둔다.

## 공개 범위

인덱스에는 계획 제목, 상태, 대략적 연도·유형처럼 공개해도 되는 메타데이터만 둔다. 계획별 하위 경로도
같은 원칙을 따르며, 실제 예약·비용·시간·세부 동선은 암호화가 준비되기 전까지 넣지 않는다.

## 관련 페이지

- [비공개 여행 일정의 단계적 구체화](../concepts/private-itinerary-planning.md)

## 출처

- 제목: 사용자 요청 - 여러 계획의 분리된 정보 구조
- 작성 주체: User and Codex
- 확정일: 2026-08-17
- 저장소 경로: `docs/wiki/kb/entities/plan-index-structure.md`
