---
updated: 2026-11-05
tags: [offline, service-worker, static-site, iberian-passage-2026]
---

# 오프라인 읽기 (서비스 워커와 HTML 사본)

## 왜 필요한가

여행 중 휴대폰에서 Chrome 읽기 목록에 저장한 계획 페이지가 오프라인에서 열리지 않았다. 계획 페이지는
`unlock.js`가 `fetch('./data.enc.json')`로 암호문을 받아 WebCrypto로 복호화해 그리는 구조이고, 읽기 목록은
페이지를 따로 불러온 정적 사본(iOS는 본문만 추린 reader 사본, Android는 MHTML 스냅샷)만 저장한다. 그래서
잠긴 첫 화면만 남고 암호문 요청과 복호화가 오프라인에서 일어날 수 없다(2026-11-05 조사).

## 구성

- `sw.js`(사이트 루트, scope `/`): `PRECACHE-START`~`PRECACHE-END` 사이 목록의 페이지·스크립트·CSS·
  `data.enc.json`과 `temp/lisbon-sevilla/`를 저장한다. 저장한 HTML에서 참조하는 이미지(와인 사진·썸네일)는
  자동으로 찾아 함께 저장한다. `principles.enc.json`은 페이지가 읽지 않으므로 저장하지 않는다.
- 전략: HTML·JS·CSS·`*.enc.json`은 network-first(6초 안에 응답이 없거나 오류면 저장본), 이미지는 cache-first.
  저장에 실패한 파일은 이전 저장본(이전 버전 캐시 포함)을 유지한다. `ESSENTIAL` 목록(계획 페이지·`unlock.js`·
  `crypto.js`·`data.enc.json`·`itinerary.css`·`offline.js`)을 저장하지 못하면 새 버전 설치가 실패하고 이전
  버전이 계속 동작한다.
- `assets/offline.js`: 각 공개 페이지가 `defer`로 불러 서비스 워커를 등록하고, 헤더 아래 상태 줄
  (`오프라인 저장됨 · 마지막 갱신 …`, `오프라인 저장 중…`, `갱신 실패 · 저장본 유지 …`)과 "지금 오프라인용으로 저장"
  버튼을 보여 준다. 마지막 갱신이 6시간보다 오래되면 온라인일 때 자동으로 다시 저장한다. 스크립트가 없어도
  페이지 내용은 그대로 읽힌다. `temp/lisbon-sevilla/`는 내용을 바꾸지 않고 캐시 목록에만 넣었다.
- 계획 페이지 `unlock.js`: 잠금을 연 뒤 비밀 구문 입력 칸 아래(복호화 본문 바깥)에 "이 기기에 파일로 저장(HTML)"
  버튼과 "기기에 평문 저장 — 공유 주의" 경고를 붙인다. 내려받는 파일은 CSS를 인라인한 스크립트 없는 HTML이며,
  본문 h2 섹션과 h3 도시·날짜 하위 섹션 구조를 그대로 복제한다. iOS에서는 공유 시트(파일에 저장)를 먼저 쓴다.
- 상태 UI와 내보내기 버튼은 복호화 본문의 h2/h3 구조 밖에 두고, 본문 안에 제목을 추가하지 않는다.

## 캐시 버전 올리는 법

- 목록에 있는 파일의 **내용만** 바뀐 경우(일정 재암호화, HTML·CSS 수정): 버전을 올리지 않아도 된다.
  network-first라 온라인에서 페이지를 열면 새 내용이 저장되고, 버튼을 누르면 전체를 다시 받는다.
- **파일을 추가·삭제·이동**했거나 `sw.js` 로직을 바꾼 경우: `sw.js`의 `PRECACHE` 목록을 고치고
  `CACHE_VERSION`(예: `v1-2026-11-05` → `v2-YYYY-MM-DD`)을 올린다. 새 페이지가 `offline.js`를 불러오면
  그 페이지도 목록에 넣는다.
- `node scripts/verify-static-site.mjs`가 목록의 모든 파일 존재, `ESSENTIAL`이 목록에 포함되는지,
  `offline.js`를 쓰는 페이지가 목록에 있는지, `private/`·principles가 목록에 없는지 검사한다.
- 브라우저는 페이지를 열 때 `sw.js`를 다시 확인한다. 버전이 바뀌면 새 캐시를 채운 뒤 바로 교체하고 이전
  `jormal-offline-*` 캐시를 지운다. 이미지는 이전 캐시에서 옮겨 다시 내려받지 않는다.

## 기기별 주의

- https(GitHub Pages)나 `localhost`에서만 서비스 워커와 WebCrypto가 동작한다.
- Android Chrome: 일반적인 서비스 워커 오프라인 동작. 저장 공간이 부족하면 지워질 수 있어
  `navigator.storage.persist()`를 요청한다.
- iOS Chrome(WKWebView): iOS 14 이후 서비스 워커를 지원하지만, WebKit 정책상 오래 쓰지 않으면 저장소가 지워질 수
  있다. 실기기 검증은 하지 못했으므로 HTML 사본을 함께 받아 두는 것을 권한다.

## 검증 기록 (2026-11-05)

headless Chromium 130과 `python3 -m http.server 8777`로 확인했다. 첫 방문에서 156개 항목(목록 15개, 이미지
140개, 메타 1개)이 저장되었고, 서버를 끈 뒤 모든 페이지가 열렸으며 계획 잠금 해제·HTML 내려받기가 동작했다.
버전 올림 시 이전 캐시 삭제와 오프라인 갱신 실패 시 저장본 유지도 확인했다.

## 관련 페이지

- [암호화된 일정 데이터 발행 방식](encrypted-itinerary-payload.md)
- [이베리아 여행 기록 페이지](iberian-travel-log.md)

## 출처

- 제목: 사용자 요청 - 오프라인에서도 일정 읽기
- 작성 주체: User and Claude
- 확정일: 2026-11-05
- 저장소 경로: `sw.js`, `assets/offline.js`, `info/plan/iberian-passage-2026/unlock.js`
- 외부: Chrome 도움말 "Read pages offline"(https://support.google.com/chrome/answer/7343019, 수집 2026-11-05),
  Chromium `ios/chrome/browser/reading_list`(https://chromium.googlesource.com/chromium/src/+/64.0.3273.2/ios/chrome/browser/reading_list/url_downloader.cc, 수집 2026-11-05),
  WebKit "Updates to Storage Policy"(https://webkit.org/blog/14403/updates-to-storage-policy/, 수집 2026-11-05),
  web.dev "Persistent storage"(https://web.dev/articles/persistent-storage, 수집 2026-11-05)
