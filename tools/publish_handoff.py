#!/usr/bin/env python3
"""대시보드에서 발행(또는 발행요청)된 콘텐츠를 피클에게 넘길 파일로 만든다.

클로드가 ArtifactData 로 내려받은 content/ 폴더를 읽어, 아직 전달되지 않은 건을
비공개 저장소(homebiz-ops)의 handoff/ 에 하나의 파일로 쓴다.
매물번호가 있으면 매물장에서 채널 문구(당근·네이버)까지 뽑아 함께 넣는다.

사용:
  python3 tools/publish_handoff.py <내려받은_폴더> --out /home/user/homebiz-ops
  python3 tools/publish_handoff.py <내려받은_폴더> --dry      파일을 쓰지 않고 보기

전달한 건의 id 목록을 마지막 줄에 출력한다. 클로드는 그 id의 handoffAt 을 채워
대시보드에 "피클에 전달됨"으로 표시한다.
"""
import argparse
import datetime
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import content_card as CC   # noqa: E402

READY = ('발행요청', '발행')


def load(folder):
    rows = []
    for f in sorted(glob.glob(os.path.join(folder, 'content', '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        b = d.get('data', d)
        b['id'] = b.get('id') or d.get('id')
        rows.append(b)
    return rows


def main():
    ap = argparse.ArgumentParser(description='발행 콘텐츠를 피클에게 넘길 파일 만들기')
    ap.add_argument('folder', help='ArtifactData 로 내려받은 폴더 (content/ 포함)')
    ap.add_argument('--out', help='homebiz-ops 경로')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--all', action='store_true', help='이미 전달한 건도 다시 넣는다')
    a = ap.parse_args()

    rows = [r for r in load(a.folder)
            if (r.get('status') in READY) and (a.all or not r.get('handoffAt'))]
    if not rows:
        print('전달할 콘텐츠가 없습니다.')
        return

    props = CC.load()
    today = datetime.date.today().isoformat()
    L = [f'# 발행 요청 — {today}', '',
         '대시보드에서 발행으로 넘긴 콘텐츠입니다. **피클이 각 채널에 올려 주세요.**',
         '호수·동 번호는 빼고 층까지만 공개합니다. 올린 뒤 매물번호와 채널 매물번호를 매물장에 적어 주세요.', '']
    for r in rows:
        L.append(f'## {r.get("title","(제목 없음)")}')
        L.append('')
        L.append(f'- 채널: **{r.get("channel","")}**')
        if r.get('propId'):
            L.append(f'- 매물번호: `{r["propId"]}`')
        if r.get('note'):
            L.append(f'- 메모: {r["note"]}')
        L.append(f'- 발행 누른 시각: {str(r.get("publishAt") or r.get("requestAt") or "")[:16].replace("T", " ")}')
        p = CC.find(props, str(r.get('propId') or '')) if r.get('propId') else None
        if p:
            price, trade = CC.price_line(p)
            L += ['', '### 매물장 확인값', '',
                  f'- {CC.region(p)} · {CC.building(p)} · {str(p.get("floor") or "").split("/")[0].strip()}',
                  f'- {trade} {price} · 전용 {CC.area_pyeong(p)} · {p.get("roomCount","")}'
                  + (f' · {CC.year_built(p)}' if CC.year_built(p) else ''),
                  f'- 특징: {" · ".join(CC.feats(p, 6))}',
                  f'- 관리비: {p.get("maintenanceFee","-")}만원 · 담당: {p.get("createdByName","")}',
                  f'- 사진: {len(p.get("photos") or [])}장 (매물장 기준)']
            t, body = CC.danggeun(p)
            L += ['', '### 당근 — 제목(36자)', '', '```', t, '```',
                  '', '### 당근 — 본문', '', '```', body, '```',
                  '', '### 네이버(텐컴즈) — 상세설명', '', '```', CC.naver(p), '```']
        else:
            L += ['', '_매물번호가 없는 콘텐츠입니다. 채널 글은 제작한 쪽 자료를 그대로 쓰세요._']
        L.append('')
        L.append('---')
        L.append('')
    L += ['올린 뒤 대시보드에서 상태를 확인해 주세요. 문의가 오면 대시보드 **콜 기록**에 어느 채널인지 남깁니다.']
    text = '\n'.join(L) + '\n'

    if a.dry or not a.out:
        print(text)
    else:
        d = os.path.join(os.path.abspath(a.out), 'handoff')
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f'{today}-publish.md')
        open(path, 'w', encoding='utf-8').write(text)
        print(f'전달 파일: {path}')
    print('전달한 콘텐츠 id: ' + ','.join(r['id'] for r in rows))


if __name__ == '__main__':
    main()
