# 청라 아크원 푸르지오 관심고객 상담

송현아부동산공인중개사사무소 · 담당 이은숙 · 010-2285-1585

- 운영 중인 공개 사이트: https://arkone-songhyuna.spqnd13.chatgpt.site/
- GitHub Pages 배포 대상: https://spqnd13-lab.github.io/-/
- 모바일 미리보기: `mobile.html`

## 배포

`main`에 변경 사항을 저장하면 GitHub Actions에서 GitHub Pages 배포를 실행합니다. 최초 배포 시 저장소 Settings → Pages에서 Source를 GitHub Actions로 지정해야 할 수 있습니다.

## 상담 신청

서버에 고객 정보를 저장하지 않습니다. 방문자가 폼을 작성한 뒤 휴대폰 문자 앱에서 직접 전송하면 담당자에게 전달됩니다. PC에서는 신청 내용을 복사해 문자로 보낼 수 있습니다.

## 출처와 운영 정보

공식 사업개요 및 브랜드 이미지: https://arkone-prugio.com/

본 사이트는 송현아부동산의 중개 상담 안내 페이지이며 사업주체의 공식 홈페이지가 아닙니다. 로고·이미지 권리는 해당 권리자에게 있습니다.

## 인천홈앤비즈 (shareal/)

https://shareal1.netlify.app 을 옮겨 온 사이트입니다. GitHub Pages 주소: https://spqnd13-lab.github.io/-/shareal/

- `index.html` 메인 · `housing.html` 주택(인천홈) · `commercial.html` 상가·수익형(인천비즈)
- `ledger.html` 중개사 매물장 (`app.js`, `properties_data.js`)
- `imjang_*.html` 임장 시트(A4 인쇄용)

### 매물장 계정 권한 (`app.js`의 `USERS`)

| 계정 | 권한 |
| --- | --- |
| 유수정 (대표자, ADMIN) | 모든 매물·고객 연락처 열람, 등록/수정/삭제 전부 |
| 이은숙 (실장, STAFF) | 등록/수정, 본인 매물 연락처만 열람, 삭제 불가 |
| 황규문 (과장, STAFF) | 등록/수정, 본인 매물 연락처만 열람, 삭제 불가 |

로그인 비밀번호(PIN)는 `app.js` 상단 `USERS`의 `pin` 값에서 바꿀 수 있습니다.

> 주의: 정적 사이트라 PIN과 매물 데이터(연락처 포함)가 `app.js`/`properties_data.js`에 그대로 들어 있어, 파일을 직접 열면 누구나 볼 수 있습니다. 연락처 가리기는 화면에서만 동작합니다.

### 모바일 최적화

- Tailwind를 브라우저에서 매번 컴파일하던 CDN 대신 미리 빌드한 `css/site.css`, `css/ledger.css`를 씁니다. 휴대폰에서 더 빨리 뜹니다.
- `css/mobile.css`: 가로 스크롤 방지, iOS 입력칸 자동 확대 방지(16px), 아이폰 하단 홈 바 여백, 터치 버튼 크기, 팝업 내부 스크롤, 넓은 표 가로 스크롤.
- 매물장: 모바일 상단을 두 줄(로고+계정+접수 / 밀어서 보는 바로가기)로 정리, 일정 요약 3열, 검색창·필터 세로 배치.
- 매물장을 휴대폰 홈 화면에 추가하면 앱처럼 열립니다 (`manifest.json`).
- 아이콘(lucide)은 `vendor/`에 넣어 외부 CDN 의존을 줄였습니다. (지도 보기는 삭제함)

HTML이나 `app.js`에서 Tailwind 클래스를 바꿨다면 CSS를 다시 빌드하세요:

```
cd shareal
npx tailwindcss@3.4.17 -c tw/site.config.cjs -i tw/input.css -o css/site.css --minify
npx tailwindcss@3.4.17 -c tw/ledger.config.cjs -i tw/input.css -o css/ledger.css --minify
```

### 디자인

- 로고 이미지를 없애고 텍스트 워드마크(인천홈앤비즈 | 송현아부동산)로 바꿨습니다. 파비콘은 단순한 집 아이콘(`favicon.svg`)입니다.
- `css/design.css`: 공통 글꼴(Spoqa Han Sans Neo, `vendor/fonts/`에 포함)과 굵기 규칙, 바탕색, 카드·그림자·버튼·입력칸·팝업 질감.
- 메인·주택·상가 페이지 상단 메뉴를 하나로 통일했습니다(현재 페이지에 밑줄 표시).

### 입주 원스톱 서비스 (`shareal/services.html`)

이사 · 입주청소 · 블라인드 세 탭에서 안내, 진행 순서, 협력업체 목록, 견적 접수 폼을 제공합니다. 주소 뒤에 `#moving`, `#cleaning`, `#blind`를 붙이면 해당 탭이 바로 열립니다.

- **협력업체 추가**: `services.html` 안의 `PARTNERS`에 한 줄씩 넣습니다. 서비스마다 5칸이고 빈 칸은 "협력업체 모집 중"으로 나옵니다. 업체 카드와 폼의 희망 업체 선택지가 함께 바뀝니다.
  ```js
  { name:"○○익스프레스", desc:"송도 포장이사 전문", tags:["포장이사","사무실이사"], logo:"" },
  ```
- **접수 내용이 오는 곳 (문자)**: `services.html`의 `CONTACT.sms`에 견적 문자를 받을 휴대폰 번호를 넣습니다. 고객이 [견적 접수하기]를 누르면 작성 내용이 담긴 문자 앱이 열리고, 고객이 [보내기]를 누르면 그 번호로 옵니다. PC에서는 내용 복사 버튼과 번호 안내가 나옵니다.
- `CONTACT.sms`가 비어 있으면 Netlify Forms(`moving` / `cleaning` / `blind`)로 전송을 시도합니다. Netlify에 배포했을 때만 저장되며, GitHub Pages에서는 "아직 접수가 끝나지 않았습니다" 안내와 전화·복사 버튼이 나옵니다.
