---
name: office-dashboard
description: 가상 오피스(대시보드) 구조와 데이터를 다룹니다. "대시보드에 올려줘", "보고 읽어줘", "안건 올려줘", "콜 기록 봐줘", "콘텐츠 보드에 추가" 같은 요청에 사용합니다. 업무 기록은 비공개 저장소로만 내보냅니다.
---

# 가상 오피스 대시보드

주소: `https://claude.ai/artifact/3zRyFbwPedw5vWU8pY9Fv2` (비공개 — 대표님만)
읽고 쓰기는 `ArtifactData` 도구로 합니다. 이 주소는 **어느 저장소에도 적지 않습니다.**

## 화면 구성

타일 6개(컨펌 대기·전달 대기 보고·만기 임박·사진 없는 매물·발행 대기·이번 주 콜) →
**콜 기록** → **콘텐츠 보드** → 픽셀 사무실(5팀 10명 + 대표 + 하준이) →
**팀 회의실**(안건 컨펌) → 업무 보고.

## 저장되는 것 (컬렉션)

| 컬렉션 | 내용 | 주요 필드 |
| --- | --- | --- |
| `reports` | 업무 보고 | dept, team, text, at, status(대기/확인) |
| `agenda` | 팀 회의 안건 | team, by, title, goal, plan[], edit[], reviews[], status(검토중/컨펌/보류) |
| `content` | 콘텐츠 보드 | title, channel, propId, status(기획/제작/편집/발행요청/발행/보류), note, requestAt, publishAt, handoffAt |
| `calls` | 콜 기록 | source(인스타/당근/네이버/홈페이지/소개/기타), contentId, propId, memo, at |

## 자주 하는 일

- **보고 읽기**: `calls`·`reports` 를 `list` → 급한 것부터 정리해 답하고, 처리한 보고는 `status: "확인"` 으로.
- **안건 올리기**: `agenda` 에 `set`. 팀(`team`)을 반드시 넣습니다. 제안자(`by`)는 현아/클로드.
  대표 의견은 `reviews` 에 `{by:"대표", text, at}` 로 들어옵니다 — **의견이 달리면 안을 고치고
  무엇을 어떻게 바꿨는지 `reviews` 에 답을 남깁니다.**
- **콘텐츠 올리기**: `content` 에 `set` (status `편집` = 발행 대기). 제작은 `channel-content` 스킬.
- **발행 전달**: `content-publish` 스킬.

## 쓸 때 주의

- 문서를 고칠 때는 현재 `version` 을 읽어 `if_version` 에 넣습니다. 안 넣으면 거부됩니다.
- 배열(`plan`, `reviews`)은 `update` 가 통째로 바꿉니다. 기존 값을 읽어 합친 뒤 `set` 합니다.
- 연락처·주민번호·도어락 비번은 대시보드에도 적지 않습니다.

## 저장소로 내보내기

업무 기록은 **비공개 저장소 `spqnd13-lab/homebiz-ops`** 에만 씁니다.

```
python3 tools/office_sync.py <내려받은_폴더> --out <homebiz-ops 경로>
```

`--out` 없이 돌리면 공개 저장소에 쓰이므로 반드시 지정합니다.
매주 화요일 08:41 정기작업이 같은 일을 합니다. 연결 설명은 `docs/ops/gpt-bridge.md`.
