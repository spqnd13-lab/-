# GPT(현아·피클) ↔ 클로드 연결

링크를 주고받기 어려우니 **저장소 파일을 공용 게시판**으로 씁니다.
클로드는 가상 오피스의 내용을 파일로 내보내고, 현아는 그 파일을 읽습니다.
반대로 현아가 쓴 것은 `docs/plan/` 에 올리면 클로드가 읽어 오피스에 반영합니다.

```
대표님이 가상 오피스에 보고·컨펌
        ↓  (클로드가 내보냄)
docs/ops/office-log.md  ← 현아(GPT)가 읽는 곳
        ↓
현아가 기획·요청을 docs/plan/ 에 파일로 올림
        ↓  (클로드가 읽음)
오피스 회의실 안건 / 코드 작업
```

## 1. 현아(GPT)가 읽을 주소

지금은 작업 브랜치에 있습니다. `main` 에 병합되면 `main` 주소도 같이 씁니다.

| 내용 | 주소 |
| --- | --- |
| 오피스 기록 (사람이 읽는 요약) | `https://raw.githubusercontent.com/spqnd13-lab/-/claude/magical-gauss-wmmys2/docs/ops/office-log.md` |
| 오피스 기록 (기계용 JSON) | `https://raw.githubusercontent.com/spqnd13-lab/-/claude/magical-gauss-wmmys2/docs/ops/office-log.json` |
| 분업 지도 | `https://raw.githubusercontent.com/spqnd13-lab/-/claude/magical-gauss-wmmys2/docs/ops/role-split.md` |
| 작업 규칙 | `https://raw.githubusercontent.com/spqnd13-lab/-/claude/magical-gauss-wmmys2/AGENTS.md` |

병합 뒤에는 주소에서 `claude/magical-gauss-wmmys2` 를 `main` 으로 바꾸면 됩니다.

`office-log.md` 에 들어가는 것: 업무 보고 목록(팀·업무·시각·상태·내용), 채널 안건 전체
(제목·목표·콘텐츠 구성·편집 디테일·검수 의견·컨펌 상태).

## 2. 현아(GPT)가 쓰는 방법

GitHub 커밋 권한이 있는 쪽(피클)이 `docs/plan/` 에 파일 하나를 올립니다.

- 파일 이름: `YYYY-MM-DD-제목.md`
- 양식: `docs/plan/README.md` 에 있는 그대로 (지금 불편한 점 → 이렇게 되면 좋겠다 → 화면/파일 → 지켜야 할 것 → 급한 정도)
- 클로드가 읽고 구현한 뒤 같은 파일 맨 아래 "처리 결과"를 채웁니다.

커밋 권한이 없을 때는 내용을 대표님께 전달하면 대표님이 올리거나 클로드에게 붙여 넣습니다.

## 3. 갱신 주기

- **자동**: 매주 화요일 08:41 운영 점검 때 클로드가 오피스를 읽어 `office-log` 를 갱신하고 작업 브랜치에 커밋합니다.
- **수동**: "오피스 기록 갱신해줘" 하면 그 자리에서 다시 내보냅니다.

## 4. 공개 저장소라 지키는 것

- `office-log.md` 와 `.json` 은 **공개 파일**입니다. 보고 본문에 전화번호·주민번호·도어락 비번으로 보이는
  값이 있으면 `tools/office_sync.py` 가 그 본문을 `[민감정보 포함 — 저장소에는 올리지 않음]` 으로 바꿔서 내보냅니다.
  원문은 가상 오피스 화면에서만 볼 수 있습니다.
- 그러니 **손님 연락처는 애초에 오피스 보고에 적지 않습니다.** 연락처는 매물장(또는 보안 매물장)에만 둡니다.
- 가상 오피스 주소 자체는 비공개입니다. 이 파일에 적지 않습니다.

## 5. 도구

```
python3 tools/office_sync.py <내려받은_폴더>        office-log.md / .json 생성
python3 tools/office_sync.py <내려받은_폴더> --dry  파일을 쓰지 않고 결과만 보기
```

`<내려받은_폴더>` 는 클로드가 아티팩트에서 내려받은 `reports/`, `agenda/` JSON 폴더입니다.
