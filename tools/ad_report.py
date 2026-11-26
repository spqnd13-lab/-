#!/usr/bin/env python3
"""광고 채널 수치판 만들기 — 인스타·유튜브·당근·텐컴즈(네이버).

콘텐츠 보드·콜 기록(가상 오피스에서 내려받은 JSON) + 채널 등록표 + 주간 수치 파일을
읽어 **비공개 저장소**에 수치판 한 장을 만든다.

숫자는 파일에 있는 값만 쓴다. 없는 칸은 `미수집`으로 두고 추측해서 채우지 않는다.
수치판은 업무 기록이므로 공개 저장소에 쓰지 않는다 (`--ops` 필수).

사용:
  python3 tools/ad_report.py --board <내려받은_폴더> --ops /home/user/homebiz-ops
  python3 tools/ad_report.py --board <내려받은_폴더> --ops <경로> --dry   미리보기

<내려받은_폴더> 는 ArtifactData out_dir 그대로: <폴더>/content/*.json, <폴더>/calls/*.json
읽는 것: <ops>/ads/channels.json, <ops>/ads/metrics/<날짜>.json (가장 최근)
쓰는 것: <ops>/ads/report-<오늘>.md
"""
import argparse
import datetime
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROPS = os.path.join(ROOT, 'shareal', 'data', 'properties.json')

PHONE = re.compile(r'01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}')
RRN = re.compile(r'\b\d{6}-[1-4]')
SECRET = re.compile(r'(비밀번호|비번|도어락|현관\s*번호|현종|현#)')

# 채널 이름을 네 가지로 모은다 (보드에 쓰인 이름이 조금씩 달라도 같은 칸으로)
CH_ORDER = ['인스타', '유튜브', '당근', '텐컴즈']
CH_ALIAS = {'인스타': '인스타', '인스타그램': '인스타', '릴스': '인스타',
            '유튜브': '유튜브', '쇼츠': '유튜브',
            '당근': '당근', '당근마켓': '당근',
            '텐컴즈': '텐컴즈', '네이버': '텐컴즈', '네이버부동산': '텐컴즈'}

# 주간 수치 양식 — 피클이 채우는 칸. 금액은 넣지 않는다(상태로만).
METRIC_FIELDS = {
    '인스타': ['도달', '조회', '저장', '공유', '프로필방문', 'DM문의'],
    '유튜브': ['노출', '조회', '평균시청지속(%)', '좋아요', '구독증가', '댓글문의'],
    '당근': ['조회', '관심', '채팅문의', '광고캐시상태'],
    '텐컴즈': ['등록건수', '노출중', '검수중', '만료', '클릭(유입)', '전화문의', '문자문의'],
}
CALL_SOURCES = ['인스타', '유튜브', '당근', '네이버', '홈페이지', '소개', '기타']

# 자동으로 만든 정보 카드는 '현장 사진'이 아니다 (진행중 매물 전체에 들어가 있다)
CARD_DIR = 'images/cards/'
# 광고가 내려간 상태
DOWN = ('노출종료', '내림', '네이버등록안됨')


def real_photos(p):
    return [x for x in (p.get('photos') or []) if CARD_DIR not in str(x)]


def risky(text):
    t = str(text or '')
    return bool(PHONE.search(t) or RRN.search(t) or SECRET.search(t))


def channel_of(name):
    n = str(name or '').strip()
    for key, val in CH_ALIAS.items():
        if key in n:
            return val
    return ''


def load_dir(folder, name):
    """ArtifactData out_dir 구조에서 한 컬렉션을 읽는다."""
    rows = []
    for f in sorted(glob.glob(os.path.join(folder, name, '*.json'))):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception as e:
            print(f'건너뜀 {f}: {e}', file=sys.stderr)
            continue
        body = d.get('data', d)
        body['id'] = d.get('id') or os.path.splitext(os.path.basename(f))[0]
        rows.append(body)
    return rows


def stage(c):
    """보드 한 건이 지금 어느 단계인가 — 발행 / 등록대기 / 보류.

    보드의 status 만으로는 알 수 없다(파일만 준비해 두고 status 를 '발행'으로 둔 건이 있다).
    그래서 세 가지를 같이 본다:
      보류  = status 가 보류이거나, 메모에 보류·⏸ 표시가 있다
      발행  = 피클에게 전달(handoffAt)됐고 보류가 아니다
      등록대기 = 그 밖 (문구·파일은 됐고 채널 등록이 아직)
    """
    note = str(c.get('note') or '')
    if str(c.get('status')) == '보류' or '⏸' in note or '보류' in note:
        return '보류'
    if c.get('handoffAt'):
        return '발행'
    return '등록대기'


def load_props():
    try:
        return json.loads(open(PROPS, encoding='utf-8').read())
    except Exception as e:
        print(f'매물 데이터를 읽지 못했습니다: {e}', file=sys.stderr)
        return []


def latest_metrics(ops):
    files = sorted(glob.glob(os.path.join(ops, 'ads', 'metrics', '*.json')))
    if not files:
        return None, {}
    f = files[-1]
    try:
        return os.path.basename(f)[:-5], json.loads(open(f, encoding='utf-8').read())
    except Exception as e:
        print(f'수치 파일을 읽지 못했습니다 {f}: {e}', file=sys.stderr)
        return os.path.basename(f)[:-5], {}


def load_channels(ops):
    f = os.path.join(ops, 'ads', 'channels.json')
    if not os.path.exists(f):
        return []
    try:
        return json.loads(open(f, encoding='utf-8').read()).get('items', [])
    except Exception as e:
        print(f'채널 등록표를 읽지 못했습니다 {f}: {e}', file=sys.stderr)
        return []


def num(v):
    """값이 비었으면 '미수집'. 0 은 0 으로 적는다."""
    if v is None or v == '' or v == '미수집':
        return '미수집'
    return str(v)


def build(board, ops):
    today = datetime.date.today().isoformat()
    content = load_dir(board, 'content')
    calls = load_dir(board, 'calls')
    props = load_props()
    channels = load_channels(ops)
    mdate, metrics = latest_metrics(ops)
    mch = (metrics or {}).get('channels', {})

    # --- 보드 집계: 채널 × 단계
    tally = {c: {'발행': [], '등록대기': [], '보류': []} for c in CH_ORDER}
    other = []
    for c in content:
        ch = channel_of(c.get('channel'))
        if not ch:
            other.append(c)
            continue
        tally[ch][stage(c)].append(c)

    # --- 콜 기록: 채널별 문의 건수
    call_n = {s: 0 for s in CALL_SOURCES}
    for c in calls:
        s = str(c.get('source') or '기타')
        call_n[s if s in call_n else '기타'] += 1

    # --- 매물 커버리지
    live = [p for p in props if str(p.get('status')) == '진행중']
    with_photo = [p for p in live if real_photos(p)]
    card_only = [p for p in live if not real_photos(p) and (p.get('photos') or [])]
    reg = {c: set() for c in CH_ORDER}
    down = {c: set() for c in CH_ORDER}
    for it in channels:
        who = str(it.get('propId') or '') or str(it.get('building') or '?')
        for key, ch in (('tencoms', '텐컴즈'), ('danggeun', '당근'),
                        ('insta', '인스타'), ('youtube', '유튜브')):
            v = it.get(key) or {}
            if not isinstance(v, dict):
                v = {'status': str(v)}
            st = str(v.get('status') or '')
            if not (v.get('no') or v.get('url') or v.get('postedAt') or v.get('listedAt') or st):
                continue
            (down if st in DOWN else reg)[ch].add(who)

    L = [f'# 광고 채널 수치판 — {today}', '',
         '인스타·유튜브·당근·텐컴즈(네이버) 광고가 **어디까지 나갔고 숫자가 얼마인지** 한 장으로 봅니다.',
         f'자동 생성: `tools/ad_report.py` · 콘텐츠 보드 {len(content)}건 · 콜 기록 {len(calls)}건'
         + (f' · 수치 파일 `ads/metrics/{mdate}.json`' if mdate else ' · 수치 파일 없음'), '',
         '숫자는 **파일에 있는 값만** 적습니다. 빈 칸은 `미수집` 이고 추측해서 채우지 않습니다.', '',
         '## 1. 한눈에', '',
         '| 채널 | 발행 | 등록대기 | 보류 | 노출·도달 | 조회 | 문의(플랫폼) | 문의(콜기록) |',
         '| --- | --- | --- | --- | --- | --- | --- | --- |']

    call_map = {'인스타': '인스타', '유튜브': '유튜브', '당근': '당근', '텐컴즈': '네이버'}
    for ch in CH_ORDER:
        m = mch.get(ch, {})
        reach = num(m.get('도달') if ch == '인스타' else m.get('노출'))
        views = num(m.get('조회'))
        if ch == '인스타':
            ask = num(m.get('DM문의'))
        elif ch == '유튜브':
            ask = num(m.get('댓글문의'))
        elif ch == '당근':
            ask = num(m.get('채팅문의'))
        else:
            tel, txt = m.get('전화문의'), m.get('문자문의')
            ask = '미수집' if tel in (None, '') and txt in (None, '') else f'{num(tel)}/{num(txt)}'
        t = tally[ch]
        L.append(f"| {ch} | {len(t['발행'])} | {len(t['등록대기'])} | {len(t['보류'])} | "
                 f"{reach} | {views} | {ask} | {call_n.get(call_map[ch], 0)} |")
    L += ['', f"합계 — 발행 {sum(len(tally[c]['발행']) for c in CH_ORDER)}건 · "
          f"등록대기 {sum(len(tally[c]['등록대기']) for c in CH_ORDER)}건 · "
          f"보류 {sum(len(tally[c]['보류']) for c in CH_ORDER)}건 · "
          f"콜 기록 {sum(call_n.values())}건", '']
    if sum(call_n.values()) == 0:
        L += ['> 콜 기록이 0건입니다. 어느 채널이 전화를 만드는지 아직 셀 수 없습니다.',
              '> 문의가 오면 가상 오피스 **콜 기록**에 채널을 남겨야 다음 수치판에 들어갑니다.', '']

    # --- 채널별 내용
    L += ['## 2. 채널별로 올라간 내용', '']
    for ch in CH_ORDER:
        t = tally[ch]
        L += [f'### {ch}', '']
        if not any(t.values()):
            L += ['올라간 내용이 없습니다.', '']
            continue
        for key in ('발행', '등록대기', '보류'):
            if not t[key]:
                continue
            L.append(f'**{key} {len(t[key])}건**')
            L.append('')
            L.append('| 제목 | 매물번호 | 날짜 | 자료 |')
            L.append('| --- | --- | --- | --- |')
            for c in sorted(t[key], key=lambda x: str(x.get('at') or '')):
                when = str(c.get('publishAt') or c.get('handoffAt') or c.get('at') or '')[:10] or '-'
                title = str(c.get('title') or '').replace('|', '/')
                assets = str(c.get('assets') or '-').replace('|', '/')
                if risky(title) or risky(assets):
                    title, assets = '[민감정보 포함 — 저장소에는 올리지 않음]', '-'
                L.append(f"| {title} | {c.get('propId') or '-'} | {when} | {assets} |")
            L.append('')
        m = mch.get(ch, {})
        have = [f'{k} {m[k]}' for k in METRIC_FIELDS[ch] if m.get(k) not in (None, '', '미수집')]
        miss = [k for k in METRIC_FIELDS[ch] if m.get(k) in (None, '', '미수집')]
        L.append('수치: ' + (' · '.join(have) if have else '미수집'))
        if miss:
            L.append('')
            L.append('아직 못 센 칸: ' + ' · '.join(miss))
        L.append('')
    if other:
        L += [f'### 채널 이름을 못 읽은 {len(other)}건', '',
              '보드의 `channel` 값이 인스타·유튜브·당근·텐컴즈(네이버) 가운데 하나가 아닙니다.', '']
        for c in other:
            L.append(f"- {c.get('title')} (channel: `{c.get('channel')}`)")
        L.append('')

    # --- 커버리지
    L += ['## 3. 매물 몇 건이 광고에 나가 있나', '',
          '| 구분 | 건수 |', '| --- | --- |',
          f'| 진행중 매물 | {len(live)} |',
          f'| 그중 현장 사진 있는 매물 (등록 1순위) | {len(with_photo)} |',
          f'| 정보 카드만 있는 매물 | {len(card_only)} |']
    for ch in CH_ORDER:
        n, d = len(reg[ch]), len(down[ch])
        pct = f' ({n * 100 // len(live)}%)' if live else ''
        L.append(f'| {ch} 올라가 있는 매물 | {n}{pct} |')
        if d:
            L.append(f'| {ch} 내려감·만료 | {d} |')
    L += ['', '`ads/channels.json` 에 번호·상태가 적힌 매물만 셉니다.',
          '채널에는 올렸지만 번호를 적어 두지 않은 건은 여기서 0으로 보입니다 —',
          '그래서 이 표의 숫자는 "광고에 나간 건수"가 아니라 **기록이 남은 건수**입니다.',
          '정보 카드는 자동으로 전체에 들어가 있어 현장 사진과 따로 셉니다.', '']

    # --- 빈 칸 모음
    L += ['## 4. 피클이 채울 칸 (출처 화면)', '']
    blanks = 0
    for ch in CH_ORDER:
        m = mch.get(ch, {})
        miss = [k for k in METRIC_FIELDS[ch] if m.get(k) in (None, '', '미수집')]
        blanks += len(miss)
        if miss:
            L.append(f'- **{ch}** — {" · ".join(miss)}')
    L += ['', f'빈 칸 {blanks}개. 채우는 곳: '
          + (f'`ads/metrics/{mdate}.json`' if mdate else '`ads/metrics/<날짜>.json` (새로 만들기)')
          + ' · 수치를 어디서 보는지는 `ads/README.md`.', '']

    L += ['## 5. 이대로 두면 못 세는 것', '',
          '- **콜 기록** — 문의가 올 때 채널을 남기지 않으면 광고비가 어디서 전화를 만드는지 끝까지 알 수 없습니다.',
          '- **채널 번호** — 당근·텐컴즈 매물번호를 `ads/channels.json` 에 적지 않으면 거래완료 때 내릴 목록이 안 만들어집니다.',
          '- **만료일** — 텐컴즈 만료일이 없으면 만료 임박(30일 내) 경고를 띄울 수 없습니다.', '',
          '---', '', '광고 등록·내리기는 사람이 확인한 뒤 피클이 합니다. 이 문서는 읽고 보고만 합니다.']
    return today, '\n'.join(L) + '\n'


def main():
    ap = argparse.ArgumentParser(description='광고 채널 수치판 만들기')
    ap.add_argument('--board', required=True, help='가상 오피스에서 내려받은 폴더 (content/, calls/)')
    ap.add_argument('--ops', help='homebiz-ops 경로 (비공개 저장소) — 쓸 때 필수')
    ap.add_argument('--dry', action='store_true', help='파일을 쓰지 않고 내용만 보기')
    a = ap.parse_args()

    if not a.dry and not a.ops:
        print('--ops 가 없으면 쓰지 않습니다. 수치판은 비공개 저장소에만 둡니다.', file=sys.stderr)
        return 2
    ops = a.ops or ''
    if ops and os.path.abspath(ops) == ROOT:
        print('공개 저장소에는 쓰지 않습니다. --ops 에 homebiz-ops 경로를 주세요.', file=sys.stderr)
        return 2

    today, text = build(a.board, ops)
    if a.dry or not ops:
        print(text)
        return 0
    dest = os.path.join(ops, 'ads')
    os.makedirs(dest, exist_ok=True)
    path = os.path.join(dest, f'report-{today}.md')
    open(path, 'w', encoding='utf-8').write(text)
    print(f'썼습니다: {path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
