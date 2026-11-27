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

## 5. 매물장 작업 스킬과 도구
매물장 작업은 아래 스킬 문서를 먼저 읽고 그대로 따릅니다 (`.claude/skills/<이름>/SKILL.md`).

| 사용자가 하려는 일 | 스킬 |
| --- | --- |
| 새 매물 등록 (세움터 건축물대장 반영) | `maemul-register` |
| 매물 가격·상태·내용 수정 | `maemul-update` |
| 조건에 맞는 매물 찾기, 손님 매칭 | `maemul-find` |
| 매매 손님 / 임대 손님 등록 | `sonnim-register` |
| 매물장 구조·사용법 안내 | `maemuljang-guide` |
| 건물 골격 도면 추가·수정 (입체 도면) | `domyeon-register` |
| 데이터·배포 점검, 담당별 할 일 뽑기 | `ops-check` |
| 채널 콘텐츠 제작 (카드·릴스·당근/네이버 문구) | `channel-content` |
| 발행한 콘텐츠를 피클에게 전달 | `content-publish` |
| 가상 오피스 대시보드 읽고 쓰기 | `office-dashboard` |

- 매물 데이터 파일(`shareal/data/properties.json`, `shareal/properties_data.js`, `shareal/data/properties_data.js`)과
  저장 키·캐시 번호는 손으로 고치지 않고 **`python3 tools/maemul.py`** 로만 바꿉니다. 세 파일과 번호를 한 번에 맞추고,
  연락처·비번이 섞여 있으면 등록을 거부합니다.
- 커밋 전 `python3 tools/maemul.py check` 가 통과해야 합니다.
- 손님 정보는 파일에 쓰지 않습니다. 정해진 양식으로 정리해 사용자에게 돌려주면, 사용자가 매물장의 **붙여넣기 등록**에 넣습니다.

## 6. 건물 3D 도면 (shareal/3d/)
- 도면 페이지는 `shareal/floorplan.html`, 뷰어 코드는 `shareal/3d/viewer.js`·`compass.js`입니다.
- 건물·도면 목록 `shareal/3d/viewer-data.js`는 **자동 생성 파일**입니다.
  모형(`shareal/3d/model-scripts/P###.js`)을 추가·교체한 뒤 `python3 tools/plan3d_catalog.py` 로 다시 만듭니다.
- 모형 파일을 새로 넣으면 `python3 tools/plan3d_round.py` 로 좌표 소수점을 줄입니다.
  (긴 소수가 민감정보 검사의 전화번호 패턴에 잘못 걸립니다)
- 매물 ↔ 도면 연결은 `shareal/js/plan3d.js`의 건물 이름 낱말표(MATCH)로 합니다. 새 건물은 여기에 추가합니다.
- AIT센터 1·2층 근린생활시설 모형(P146·P147)은 `python3 tools/plan3d_ait_lowfloor.py <작업폴더>` 로 만듭니다.
  호실 위치·면적은 원본 평면도(파워포인트)의 호실 표기에서 읽습니다.
- **계약현황(입점확정·편의점 등 영업 정보)은 도면 자료에서 빼고 넣지 않습니다.** 근거 없는 내용입니다.
- 이 도면은 **공간 이해용이며 실측이 아닙니다.** 화면의 "치수 미검증" 문구를 지우지 마세요.

## 7. 분업 — 누가 무엇을 하나
담당(대표·현아·피클·클로드)과 자동으로 도는 일은 `docs/ops/role-split.md` 에 있습니다. 담당이나 자동 일정이 바뀌면 그 파일을 먼저 고칩니다.

- 점검은 `python3 tools/ops_report.py` (읽기 전용). 담당별 할 일과 배포 안전 검사 결과가 한 번에 나옵니다.
- 현아(ChatGPT)의 업무 개선·매물장 기획은 `docs/plan/` 에 양식대로 올리고, 구현 결과를 같은 파일에 적습니다.
- 정기작업은 읽고 보고만 합니다. 커밋·푸시·배포·광고 등록은 사람이 확인한 뒤에 합니다.
- **업무 기록(보고·회의 안건·인수인계·기획서)은 이 공개 저장소에 두지 않습니다.**
  비공개 저장소 `spqnd13-lab/homebiz-ops` 에 둡니다. 연결 방법은 `docs/ops/gpt-bridge.md`.
- 가상 오피스 내보내기: `python3 tools/office_sync.py <폴더> --out <homebiz-ops 경로>`.
  `--out` 없이 돌리면 공개 저장소에 쓰이므로 반드시 지정합니다.
- 채널 콘텐츠는 매물장 자료로 **클로드가 만들고**, 등록·발행은 **피클**이 합니다.
  제작 `python3 tools/content_card.py <매물번호…>`, 전달 `python3 tools/publish_handoff.py <폴더> --out <homebiz-ops 경로>`.
- 공개 문구에는 호수뿐 아니라 **동 번호도 넣지 않습니다** (층까지만).
- 채널에 올릴 **사진·영상 원본은 대표님이** 비공개 저장소 `assets/<매물번호>/` 에 올립니다.
  클로드는 촬영·영상 편집을 하지 않고, 파일을 확인하지 않은 채 "준비됨"으로 적지 않습니다.
- 지역 시세 통계 콘텐츠는 만들지 않습니다. 비교는 보유 매물끼리만 합니다.

## 8. 고칠 때 — 추측 금지
원인을 못 찾았으면 추측으로 고치지 말고, 재현부터 하거나 사용자에게 필요한 정보를 요청합니다.
