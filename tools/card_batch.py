#!/usr/bin/env python3
"""사진 없는 매물에 정보 카드를 만들어 대표 사진으로 넣는다.

카드에는 **건물명과 층까지만** 쓴다 (동·호수는 넣지 않는다).
만든 그림은 shareal/images/cards/card_<매물번호>.webp 로 저장하고,
매물 데이터는 tools/maemul.py photos 로만 고친다.

사용:
  python3 tools/card_batch.py --missing              사진 없는 진행중 매물 전부
  python3 tools/card_batch.py --missing --limit 20   앞에서 20건만
  python3 tools/card_batch.py P-202 P-002            지정한 매물만
  python3 tools/card_batch.py --missing --dry        만들지 않고 대상만 본다
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content_card as CC   # noqa: E402

ROOT = CC.ROOT
CARD_DIR = os.path.join(ROOT, 'shareal', 'images', 'cards')
WIDE_DIR = os.path.join(CARD_DIR, 'wide')
REL = 'images/cards/card_{id}.webp'
REL_WIDE = 'images/cards/wide/card_{id}.webp'
SHOT = os.path.join(ROOT, 'tools', 'content_card_shot.cjs')
WIDE_SHOT = os.path.join(ROOT, 'tools', 'wide_card_shot.cjs')


def targets(a, rows):
    if a.ids:
        out = []
        for pid in a.ids:
            p = CC.find(rows, pid)
            if not p:
                print(f'건너뜀 — 없는 매물번호 {pid}')
                continue
            out.append(p)
        return out
    out = [p for p in rows
           if str(p.get('status')) == '진행중' and not (p.get('photos') or [])]
    return out[:a.limit] if a.limit else out


def render(items, chunk):
    """카드를 그린다.

    - 세로 4:5 카드 → 당근·인스타·네이버용 (images/cards/)
    - 가로 16:10 카드 → 홈페이지 목록 썸네일용 (images/cards/wide/)
    매물의 대표 사진으로는 **가로 카드**를 쓴다. 목록이 가로 틀이라 세로 카드는 작게 들어간다.
    """
    from PIL import Image
    os.makedirs(CARD_DIR, exist_ok=True)
    os.makedirs(WIDE_DIR, exist_ok=True)
    made = {}
    with tempfile.TemporaryDirectory() as tmp:
        for i in range(0, len(items), chunk):
            part = items[i:i + chunk]
            html = os.path.join(tmp, f'part{i}.html')
            open(html, 'w', encoding='utf-8').write(CC.card_html(part))
            subprocess.run(['node', SHOT, html, tmp], check=True,
                           stdout=subprocess.DEVNULL)
            for p in part:
                png = os.path.join(tmp, f'card_{p["id"]}.png')
                if not os.path.exists(png):
                    print(f'  ! {p["id"]} 카드가 그려지지 않았습니다')
                    continue
                out = os.path.join(CARD_DIR, f'card_{p["id"]}.webp')
                Image.open(png).save(out, 'WEBP', quality=82, method=5)
                os.remove(png)
            # 가로 카드 (홈페이지 썸네일)
            whtml = os.path.join(tmp, f'wide{i}.html')
            open(whtml, 'w', encoding='utf-8').write(CC.wide_card_html(part))
            subprocess.run(['node', WIDE_SHOT, whtml, tmp], check=True,
                           stdout=subprocess.DEVNULL)
            for p in part:
                wpng = os.path.join(tmp, f'wide_{p["id"]}.png')
                if not os.path.exists(wpng):
                    print(f'  ! {p["id"]} 가로 카드가 그려지지 않았습니다')
                    continue
                Image.open(wpng).save(os.path.join(WIDE_DIR, f'card_{p["id"]}.webp'),
                                      'WEBP', quality=82, method=5)
                os.remove(wpng)
                made[p['id']] = [REL_WIDE.format(id=p['id'])]
            print(f'  {min(i + chunk, len(items))}/{len(items)}건')
    return made


def main():
    ap = argparse.ArgumentParser(description='매물 정보 카드 일괄 제작')
    ap.add_argument('ids', nargs='*', help='매물번호 (없으면 --missing 필요)')
    ap.add_argument('--missing', action='store_true', help='사진 없는 진행중 매물 전부')
    ap.add_argument('--limit', type=int, help='앞에서 N건만')
    ap.add_argument('--chunk', type=int, default=25, help='한 번에 그릴 장수 (기본 25)')
    ap.add_argument('--replace', action='store_true', help='이미 사진이 있어도 카드로 바꾼다')
    ap.add_argument('--dry', action='store_true', help='대상만 보고 끝낸다')
    a = ap.parse_args()
    if not a.ids and not a.missing:
        ap.error('매물번호를 적거나 --missing 을 주세요.')

    rows = CC.load()
    items = targets(a, rows)
    print(f'대상 {len(items)}건')
    if a.dry or not items:
        for p in items[:30]:
            print(' ', p['id'], CC.building(p), str(p.get('floor') or '').split('/')[0].strip())
        return

    made = render(items, a.chunk)
    if not made:
        print('만든 카드가 없습니다.')
        return
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False,
                                     encoding='utf-8') as f:
        json.dump(made, f, ensure_ascii=False)
        path = f.name
    cmd = [sys.executable, os.path.join(ROOT, 'tools', 'maemul.py'), 'photos', path]
    if a.replace:
        cmd.append('--replace')
    subprocess.run(cmd, check=True)
    os.unlink(path)
    print(f'카드 {len(made)}장 — shareal/images/cards/')


if __name__ == '__main__':
    main()
