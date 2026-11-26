#!/usr/bin/env python3
"""매물 정보 카드 만들기 (채널·네이버·당근용).

매물장(shareal/data/properties.json)에서 공개 정보만 읽어 카드 이미지와 채널별 문구를 만든다.
사진이 없어도 쓸 수 있는 포맷이다. 호수·동 번호는 넣지 않고 **층까지만** 쓴다.

사용:
  python3 tools/content_card.py P-002 P-160 P-202            카드 HTML + 문구 출력
  python3 tools/content_card.py P-002 --out /경로/폴더        그 폴더에 카드 HTML 저장
  python3 tools/content_card.py P-002 --json                 문구를 JSON으로 (대시보드에 넣을 때)

이미지로 굽기 (카드 HTML을 PNG로):
  node <스크립트> file://<HTML 경로>      ← tools/content_card_shot.cjs 참고
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'shareal', 'data', 'properties.json')

PALETTE = [("#af1c2a", "#7d1420"), ("#1d6b4f", "#14503b"), ("#1f4f8f", "#163a6b"),
           ("#8a5a00", "#5f3d00"), ("#35506e", "#22364a")]


def load():
    return json.loads(open(DATA, encoding='utf-8').read())


def find(rows, pid):
    for r in rows:
        if str(r.get('id')) == pid:
            return r
    return None


def won(n):
    """17600 -> '1억 7,600만원'"""
    try:
        n = int(str(n).replace(',', '').strip())
    except Exception:
        return str(n)
    eok, man = divmod(n, 10000)
    if eok and man:
        return f'{eok}억 {man:,}만원'
    if eok:
        return f'{eok}억원'
    return f'{man:,}만원'


def price_line(p):
    if p.get('tradeType') == '매매':
        return won(p.get('deposit')), '매매'
    if p.get('tradeType') == '전세':
        return won(p.get('deposit')), '전세'
    return f"보 {p.get('deposit')}만 / 월 {p.get('monthlyRent')}만", '월세'


def building(p):
    """제목에서 **건물명만** 남긴다. 동·호수는 빼고, 층은 따로 쓴다.

    '로뎀 1차 704호' -> '로뎀 1차'
    '송도 BRC 스마트밸리 디동 411호' -> '송도 BRC 스마트밸리'   (디동 = 동 표기)
    '일산 젠틀맨타워 1~3층 통건물' -> '일산 젠틀맨타워'
    """
    t = str(p.get('title') or '')
    t = re.sub(r'\s*\(.*?\)\s*', ' ', t)                 # 괄호 설명 제거
    drop = (
        r'(지하\s*)?\d+\s*~\s*\d+\s*층',               # 1~3층
        r'(지하|반지하|옥탑)?\s*\d+\s*층',                 # 4층 / 지하1층
        r'[0-9A-Za-z가-힣]*\d+\s*호',                      # 704호 / B101호
        # 동 표기(A동·디동·102동)만 지우고 동네 이름(도화동·청학동)은 남긴다
        r'(?<![가-힣A-Za-z0-9])(?:[A-Za-z]|[가-힣]|\d{1,3})\s*동(?![가-힣])',
        r'통건물|전체|일부',
    )
    for rx in drop:
        t = re.sub(rx, ' ', t)
    t = re.sub(r'\s{2,}', ' ', t).strip(' ·-,')
    return t or '매물'


def area_pyeong(p):
    m = re.search(r'전용\s*([\d.]+)\s*평', str(p.get('area') or ''))
    return f'{m.group(1)}평' if m else (str(p.get('area') or '').split(',')[0].strip() or '-')


def year_built(p):
    for src in (p.get('area'), p.get('features'), p.get('publicMemo')):
        m = re.search(r'(\d{2,4})\s*년식', str(src or ''))
        if m:
            return m.group(1) + '년식'
        m = re.search(r'(\d{4})\s*년\s*\d{0,2}월?\s*사용승인', str(src or ''))
        if m:
            return m.group(1) + '년 준공'
    return ''


def feats(p, limit=4):
    raw = str(p.get('features') or '')
    raw = re.sub(r'[^,·]*\d+(만원|㎡|평)[^,·]*', '', raw)      # 금액·면적 문구는 뺀다
    out = [x.strip(' ·') for x in re.split(r'[,·]', raw) if 1 < len(x.strip(' ·')) <= 12]
    return out[:limit]


def region(p):
    return ' '.join(x for x in [p.get('regionGu'), p.get('regionDong')] if x) or '인천'


def card_html(items):
    """홈페이지(인천홈앤비즈) 톤의 카드. 흰 시트 · 가는 선 · 레드(주택)/블루(상가) 포인트."""
    css = open(os.path.join(ROOT, 'tools', 'content_card.css'), encoding='utf-8').read()
    css = css.replace('FONTS/', 'file://' + os.path.join(ROOT, 'shareal', 'vendor', 'fonts') + '/')
    body = []
    for p in items:
        price, trade = price_line(p)
        biz = ' biz' if str(p.get('category') or p.get('type') or '').find('상가') >= 0 else ''
        yb = year_built(p)
        floor = str(p.get('floor') or '-').split('/')[0].strip() or '-'
        cells = [('전용면적', area_pyeong(p)), ('층', floor),
                 ('방 / 욕실', str(p.get('roomCount') or '-').replace(' / ', '·')),
                 ('연식', yb) if yb else ('관리비', (str(p.get('maintenanceFee')) + '만') if p.get('maintenanceFee') else '-')]
        specs = ''.join(f'<div><b>{a}</b><span>{b}</span></div>' for a, b in cells)
        chips = ''.join(f'<li>{f}</li>' for f in feats(p))
        amt = 'amt sm' if len(price) > 12 else 'amt'
        visit_label = '현장 보러 가기' if (biz or str(p.get('type') or '') in ('사무실', '근린생활시설', '사옥·통건물')) else '집 보러 가기'
        feat_label = '이 물건의 특징' if biz or str(p.get('type') or '') in ('사무실', '근린생활시설', '사옥·통건물', '분양권') else '이 집의 특징'
        body.append(f"""
<section class="card{biz}">
 <div class="sheet">
  <div class="head">
    <span class="wordmark"><b>인천홈앤비즈</b><small>송현아부동산</small></span>
    <span class="pid">{p.get("id")}</span>
  </div>
  <div class="main">
    <span class="tag">{region(p)} · {p.get("type","")}</span>
    <h1 class="bld">{building(p)}</h1>
    <p class="loc">{region(p)} · {floor} · 전용 {area_pyeong(p)}</p>
    <div class="price"><span class="kind">{trade}</span><span class="{amt}">{price}</span></div>
    <div class="specs">{specs}</div>
    <div class="feat"><h3>{feat_label}</h3><ul>{chips}</ul></div>
  </div>
  <p class="note">면적·연식은 건축물대장에서 확인한 값입니다. 사진·영상과 실제가 다를 수 있으니 방문 확인을 권합니다.<br>중개등록 제281885-2024-00070호 · 공인중개사 유수정</p>
  <div class="bar">
    <div class="l">{visit_label} · 매물 문의<em>전화 주시면 바로 안내해 드립니다</em></div>
    <div class="r"><b>010-9125-2285</b><small>송현아부동산공인중개사사무소</small></div>
  </div>
 </div>
</section>""")
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>'
            + css + '</style></head><body>' + ''.join(body) + '</body></html>')


def danggeun(p):
    price, trade = price_line(p)
    title = f'{p.get("regionGu","")} {p.get("regionDong","")} {p.get("type","")} {trade} {price.replace("원","")} 전용{area_pyeong(p)} {str(p.get("roomCount") or "").split("/")[0].strip()} {str(p.get("floor") or "").split("/")[0].strip()}'
    title = re.sub(r'\s+', ' ', title).strip()[:36]
    body = [f'{region(p)} · {building(p)} · {str(p.get("floor") or "").split("/")[0].strip()}',
            f'{trade} {price}', '',
            f'전용 {area_pyeong(p)} / {str(p.get("roomCount") or "")}' + (f' / {year_built(p)}' if year_built(p) else ''),
            ' · '.join(feats(p)), '',
            '면적은 건축물대장에서 확인한 값입니다.', '집 보러 가실 분 편하게 연락 주세요.', '',
            '송현아부동산공인중개사사무소 | 010-9125-2285']
    return title, '\n'.join(x for x in body if x is not None)


def naver(p):
    """텐컴즈 표준폼 순서. 상용구는 사무소 표준 문구를 그대로 붙인다."""
    price, trade = price_line(p)
    return '\n'.join([
        '🏠해 당 매 물 특 징🏠', ' · '.join(feats(p, 6)) or '-', '',
        f'📍위치 : {region(p)} {building(p)}',
        f'🛤️해당층 : {str(p.get("floor") or "").split("/")[0].strip()}',
        f'📐면적 : 전용 {area_pyeong(p)}' + (f' / {p.get("area")}' if p.get('area') else ''),
        f'💰{trade} : {price}',
        f'🔥특징 : {" · ".join(feats(p, 6))}' + (f' / {year_built(p)}' if year_built(p) else ''),
        '', '📣금융권 협업 원스톱 · 연중무휴 상담', '🌟송현아부동산🌟',
        '💙허위광고 없는 현장광고 · 카드결제 가능',
        '✔️송현아부동산공인중개사사무소 | 대표 유수정 | 등록번호 제281885-2024-00070호',
        '✔️인천광역시 연수구 송도과학로 80, 141호 | 010-9125-2285',
    ])


def main():
    ap = argparse.ArgumentParser(description='매물 정보 카드와 채널 문구 만들기')
    ap.add_argument('ids', nargs='+', help='매물번호 (예: P-002)')
    ap.add_argument('--out', help='카드 HTML을 저장할 폴더')
    ap.add_argument('--json', action='store_true', help='문구를 JSON으로 출력')
    a = ap.parse_args()

    rows = load()
    items = []
    for pid in a.ids:
        p = find(rows, pid)
        if not p:
            print(f'없는 매물번호: {pid}', file=sys.stderr)
            continue
        if p.get('status') != '진행중':
            print(f'진행중이 아닙니다 ({p.get("status")}): {pid}', file=sys.stderr)
        items.append(p)
    if not items:
        sys.exit(1)

    html = card_html(items)
    if a.out:
        os.makedirs(a.out, exist_ok=True)
        path = os.path.join(a.out, 'cards.html')
        open(path, 'w', encoding='utf-8').write(html)
        print(f'카드 HTML: {path}')

    out = []
    for p in items:
        t, b = danggeun(p)
        out.append({'id': p.get('id'), 'building': building(p), 'danggeunTitle': t,
                    'danggeun': b, 'naver': naver(p)})
    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        for o in out:
            print('=' * 60)
            print(f'[{o["id"]}] {o["building"]}')
            print('--- 당근 제목 (36자) ---'); print(o['danggeunTitle'])
            print('--- 당근 본문 ---'); print(o['danggeun'])
            print('--- 네이버(텐컴즈) 상세설명 ---'); print(o['naver'])


if __name__ == '__main__':
    main()
