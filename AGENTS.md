# 송현아부동산 홈페이지 저장소 — 작업 규칙 (AI·사람 공통)

이 저장소(spqnd13-lab/-)와 홈페이지(GitHub Pages)는 **누구나 볼 수 있는 공개 사이트**입니다.
`shareal/properties_data.js`, `shareal/data/` 폴더, 모든 `.html` 파일은 인터넷에 그대로 공개됩니다.

## 1. 공개 파일에 절대 넣지 않는 정보
- 소유자·임대인·임차인·고객의 **이름, 전화번호, 주소, 주민번호(앞자리 포함)**
- **세대 도어락 비번, 공동현관 비번** (현종 / 현# / 1층 비번 / 열쇠 번호 등)
- 매물의 `contacts` 항목은 항상 빈 값:
  `{"clientName":"","clientPhone":"","ownerName":"","ownerPhone":"","privateMemo":""}`
- `features`, `publicMemo`, `title`, 일정 메모에도 위 정보를 쓰지 않습니다.
- `shareal/data/clients.json`(고객장)은 항상 `[]` 입니다.

## 2. 비공개 정보는 어디에 두나
- 매물장 화면(브라우저 저장소)에서만 입력합니다.
- 직원 간 공유는 매물장 → 데이터 관리 → **보안자료 암호화 파일 만들기 (대표)** 로 만든
  `shareal/secure/private.enc.json`(AES-256-GCM 암호화 파일)으로만 합니다.
- 암호화 비밀번호는 묻지도, 저장하지도, 어떤 파일에도 쓰지 않습니다.
- 암호화되지 않은 백업(`*매물백업*.json`)이나 연락처가 담긴 파일은 커밋하지 않습니다.

## 3. 매물 추가·배포
- 새 매물은 `shareal/properties_data.js`와 `shareal/data/properties.json`에 **공개 정보만** 넣어 추가합니다.
  (매물명, 주소, 동호수, 가격, 면적, 층, 방, 특징, 사진, 담당자)
- `app.js`의 `STORAGE_KEY`(SMART_BROKER_PROPERTIES_V숫자)는 올려도 됩니다.
  새 버전은 이전 버전 데이터를 이어받으므로 `migrateLegacyPropertyStorage`,
  `addMissingDefaultProperties` 함수를 지우거나 바꾸지 않습니다.
- 커밋 전 확인: 공개 파일에 `010-` 전화번호, `000000-0` 주민번호 형식, `비번/비밀번호/현종/현#` 이 없어야 합니다.

## 4. 자동 검사
배포 워크플로(`.github/workflows/pages.yml`)가 `.github/scripts/check_public_data.py`로 공개 파일을 검사합니다.
민감정보가 발견되면 **배포가 중단**되고 GitHub Actions에 이유가 표시됩니다.
검사를 끄거나 우회하지 말고, 해당 정보를 공개 파일에서 빼세요.
사무소 대표번호처럼 공개해도 되는 번호는 스크립트의 `ALLOWED_PHONES`에 추가합니다.
