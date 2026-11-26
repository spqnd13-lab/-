#!/usr/bin/env python3
"""진행중 매물을 당근에 올리기 위한 작업 파일을 만든다 (피클 전달용).

공개 문구 규칙: **건물명과 층까지만** 쓰고 동·호수·연락처·비번은 넣지 않는다.
카드 이미지는 홈페이지에 올라간 주소를 그대로 쓴다.

사용:
  python3 tools/danggeun_bulk.py --out /path/to/homebiz-ops
  python3 tools/danggeun_bulk.py --out ... --limit 30     앞에서 30건만
"""
import argparse
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content_card as CC   # noqa: E402

SITE = 'https://spqnd13-lab.github.io/-/shareal/'


def card_url(p):
    for rel in (p.get('photos') or []):
        if 'images/cards/' in rel:
            return SITE + rel
    return ''


def main():
    ap = argparse.ArgumentParser(description='당근 일괄 등록 작업 파일 만들기')
    ap.add_argument('--out', required=True, help='homebiz-ops 경로 (비공개 저장소)')
    ap.add_argument('--limit', type=int)
    a = ap.parse_args()

    rows = [p for p in CC.load() if str(p.get('status')) == '진행중']
    rows.sort(key=lambda p: (str(p.get('regionGu') or ''), str(p.get('regionDong') or '')))
    if a.limit:
        rows = rows[:a.limit]
    today = datetime.date.today().isoformat()
    dest = os.path.join(a.out, 'handoff', 'danggeun')
    os.makedirs(dest, exist_ok=True)

    L = [f'# 당근 일괄 등록 — {today}', '',
         f'진행중 매물 **{len(rows)}건**입니다. 한 건씩 `handoff/danggeun/<매물번호>.md` 에 제목·본문이 있습니다.', '',
         '## 올릴 때 지키는 것', '',
         '- 제목·본문에 **건물명과 층까지만** 씁니다. 동 번호·호수는 쓰지 않습니다.',
         '- 사진은 매물마다 카드 이미지 1장이 기본입니다. 현장 사진이 생기면 카드 앞에 넣습니다.',
         '- 올린 뒤 당근 매물번호를 매물장에 적어 주세요.',
         '- 거래완료된 물건은 올리지 않습니다. 올린 뒤 거래되면 **내려** 주세요.', '',
         '## 목록', '',
         '| 매물번호 | 지역 | 건물명 | 층 | 가격 | 카드 이미지 |',
         '| --- | --- | --- | --- | --- | --- |']
    made = 0
    for p in rows:
        price, trade = CC.price_line(p)
        floor = str(p.get('floor') or '-').split('/')[0].strip() or '-'
        url = card_url(p)
        L.append(f'| {p["id"]} | {CC.region(p)} | {CC.building(p)} | {floor} | {trade} {price} | '
                 + (f'[카드]({url})' if url else '현장 사진 있음') + ' |')
        t, body = CC.danggeun(p)
        one = [f'# {p["id"]} · {CC.building(p)} {floor}', '',
               f'- 지역: {CC.region(p)} · {p.get("type","")}',
               f'- 가격: {trade} {price} · 전용 {CC.area_pyeong(p)} · {p.get("roomCount","")}',
               f'- 사진: ' + (url or '현장 사진(매물장)'),
               f'- 담당: {p.get("createdByName","")}', '',
               '## 당근 제목 (36자)', '', '```', t, '```', '',
               '## 당근 본문', '', '```', body, '```', '',
               '## 네이버(텐컴즈) 상세설명', '', '```', CC.naver(p), '```', '']
        open(os.path.join(dest, f'{p["id"]}.md'), 'w', encoding='utf-8').write('\n'.join(one))
        made += 1
    L += ['', f'한 건씩 파일: `handoff/danggeun/` ({made}개)']
    path = os.path.join(a.out, 'handoff', f'{today}-danggeun-bulk.md')
    open(path, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print(f'작업 파일: {path}')
    print(f'매물별 문구: {dest} ({made}건)')


if __name__ == '__main__':
    main()
