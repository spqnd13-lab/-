#!/usr/bin/env python3
"""광고 채널 수치판 만들기 — 인스타·유튜브·당근·텐컴즈(네이버).

콘텐츠 보드·콜 기록(가상 오피스에서 내려받은 JSON) + 채널 등록표 + 주간 수치 파일을
읽어 **비공개 저장소**에 수치판 한 장을 만든다.

기간은 **월요일부터 다음 월요일까지**로 센다. 기간은 수치 파일의 `period` 에서 읽고,
`--period 2026-11-16..2026-11-23` 로 직접 줄 수도 있다.

숫자는 파일에 있는 값만 쓴다. 없는 칸은 `미수집` 으로 두고 추측해서 채우지 않는다.
수치판은 업무 기록이므로 공개 저장소에 쓰지 않는다 (`--ops` 필수).

사용:
  python3 tools/ad_report.py --board <내려받은_폴더> --ops /home/user/homebiz-ops
  python3 tools/ad_report.py --board <폴더> --ops <경로> --period 2026-11-16..2026-11-23
  python3 tools/ad_report.py --board <폴더> --dry

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

CH_ORDER = ['인스타', '유튜브', '당근', '텐컴즈']
CH_ALIAS = {'인스타': '인스타', '인스타그램': '인스타', '릴스': '인스타',
            '유튜브': '유튜브', '쇼츠': '유튜브',
            '당근': '당근', '당근마켓': '당근',
            '텐컴즈': '텐컴즈', '네이버': '텐컴즈', '네이버부동산': '텐컴즈'}
# 콜 기록의 채널 이름 → 수치판의 채널
CALL_TO_CH = {'인스타': '인스타', '유튜브': '유튜브', '당근': '당근', '네이버': '텐컴즈'}
CALL_SOURCES = ['인스타', '유튜브', '당근', '네이버', '홈페이지', '소개', '기타']

# 자동으로 만든 정보 카드는 '현장 사진'이 아니다 (진행중 매물 전체에 들어가 있다)
CARD_DIR = 'images/cards/'
DOWN = ('노출종료', '내림', '네이버등록안됨')

METRIC_FIELDS = {
    '인스타': ['도달', '조회', '저장', '공유', '프로필방문', 'DM문의'],
    '유튜브': ['노출', '조회', '평균시청지속(%)', '좋아요', '구독증가', '댓글문의'],
    '당근': ['조회', '관심', '채팅문의', '광고캐시상태'],
    '텐컴즈': ['등록건수', '노출중', '검수중', '만료', '클릭(유입)', '전화문의', '문자문의'],
}


def risky(text):
    t = str(text or '')
    return bool(PHONE.search(t) or RRN.search(t) or SECRET.search(t))


def real_photos(p):
    return [x for x in (p.get('photos') or []) if CARD_DIR not in str(x)]


def channel_of(name):
    n = str(name or '').strip()
    for key, val in CH_ALIAS.items():
        if key in n:
            return val
    return ''


def day(s):
    """날짜 문자열에서 YYYY-MM-DD 만 떼어 낸다. 없으면 빈 문자열."""
    m = re.match(r'(\d{4}-\d{2}-\d{2})', str(s or ''))
    return m.group(1) if m else ''


def up_day(c):
    """보드 한 건이 실제로 올라간 날 (없으면 전달일 → 작성일)."""
    return day(c.get('publishAt')) or day(c.get('doneAt')) or day(c.get('handoffAt')) or day(c.get('at'))


def load_dir(folder, name):
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
    """지금 어느 단계인가 — 발행 / 등록대기 / 보류.

    보드의 status 만으로는 알 수 없다(파일만 준비해 두고 status 를 '발행'으로 둔 건이 있다).
      보류  = status 가 보류이거나, 메모에 보류·⏸ 표시가 있다
      발행  = 피클에게 전달(handoffAt)됐고 보류가 아니다
      등록대기 = 그 밖
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


def pick_metrics(ops, period=None):
    """수치 파일을 고른다. --period 를 줬으면 그 기간의 파일, 없으면 가장 최근 파일."""
    files = sorted(glob.glob(os.path.join(ops, 'ads', 'metrics', '*.json')))
    if not files:
        return None, {}
    loaded = []
    for f in files:
        try:
            loaded.append((f, json.loads(open(f, encoding='utf-8').read())))
        except Exception as e:
            print(f'수치 파일을 읽지 못했습니다 {f}: {e}', file=sys.stderr)
    if not loaded:
        return os.path.basename(files[-1])[:-5], {}
    want = parse_period(period)
    if want[0]:
        for f, d in loaded:
            if parse_period(d.get('period')) == want:
                return os.path.basename(f)[:-5], d
        print(f'그 기간({want[0]}~{want[1]})의 수치 파일이 없습니다 — '
              f'가장 최근 파일을 씁니다.', file=sys.stderr)
    f, d = loaded[-1]
    return os.path.basename(f)[:-5], d


def load_channels(ops):
    f = os.path.join(ops, 'ads', 'channels.json')
    if not os.path.exists(f):
        return []
    try:
        return json.loads(open(f, encoding='utf-8').read()).get('items', [])
    except Exception as e:
        print(f'채널 등록표를 읽지 못했습니다 {f}: {e}', file=sys.stderr)
        return []


def ch_metrics(mch, ch):
    """채널 수치. accounts 가 있으면 (합계, 계정별) 로 돌려준다.

    계정이 여럿이면(인스타 빌라당·송도평당 처럼) 숫자 칸만 더하고,
    평균·비율 칸은 더하지 않고 계정별로만 보여 준다.
    """
    m = mch.get(ch) or {}
    accts = m.get('accounts') or {}
    if not accts:
        return m, {}
    total = {}
    for f in METRIC_FIELDS[ch]:
        if '%' in f or '평균' in f:
            total[f] = None
            continue
        vals = [a.get(f) for a in accts.values() if isinstance(a.get(f), (int, float))]
        total[f] = sum(vals) if vals else None
    return total, accts


def num(v):
    """값이 비었으면 '미수집'. 0 은 0 으로 적는다."""
    if v is None or v == '' or v == '미수집':
        return '미수집'
    return str(v)


def parse_period(s):
    m = re.findall(r'\d{4}-\d{2}-\d{2}', str(s or ''))
    return (m[0], m[1]) if len(m) >= 2 else ('', '')


def table(rows, head):
    L = ['| ' + ' | '.join(head) + ' |', '| ' + ' | '.join('---' for _ in head) + ' |']
    for r in rows:
        L.append('| ' + ' | '.join(str(x).replace('|', '/') for x in r) + ' |')
    return L


def build(board, ops, period=None):
    today = datetime.date.today().isoformat()
    content = load_dir(board, 'content')
    calls = load_dir(board, 'calls')
    props = load_props()
    channels = load_channels(ops)
    mdate, metrics = pick_metrics(ops, period)
    mch = (metrics or {}).get('channels', {})
    f_day, t_day = parse_period(period or (metrics or {}).get('period'))
    has_period = bool(f_day and t_day)

    def inside(d):
        return bool(d) and f_day <= d <= t_day if has_period else True

    # --- 보드 집계
    tally = {c: {'발행': [], '등록대기': [], '보류': []} for c in CH_ORDER}
    other = []
    for c in content:
        ch = channel_of(c.get('channel'))
        if not ch:
            other.append(c)
            continue
        tally[ch][stage(c)].append(c)

    # 기간 안에 올라간 것 (발행된 건만, 올라간 날이 기간 안)
    in_up = {c: [x for x in tally[c]['발행'] if inside(up_day(x))] for c in CH_ORDER}

    # --- 콜 기록
    call_all = {s: 0 for s in CALL_SOURCES}
    call_in = {s: 0 for s in CALL_SOURCES}
    by_week = {}
    kinds = {}
    for c in calls:
        s = str(c.get('source') or '기타')
        s = s if s in call_all else '기타'
        call_all[s] += 1
        d = day(c.get('at'))
        wk = str(c.get('week') or '') or (d[:7] if d else '기간 미확인')
        by_week.setdefault(wk, {k: 0 for k in CALL_SOURCES})[s] += 1
        if inside(d):
            call_in[s] += 1
        k = str(c.get('kind') or '미확인')
        kinds[k] = kinds.get(k, 0) + 1

    # --- 커버리지
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

    L = [f'# 광고 채널 수치판 — {today}', '']
    if has_period:
        L += [f'**기간: {f_day} (월) ~ {t_day} (월)**  — 월요일부터 다음 월요일까지로 셉니다.', '']
    L += ['인스타·유튜브·당근·텐컴즈(네이버) 광고가 **어디까지 나갔고 숫자가 얼마인지** 한 장으로 봅니다.',
          f'자동 생성: `tools/ad_report.py` · 콘텐츠 보드 {len(content)}건 · 콜 기록 {len(calls)}건'
          + (f' · 수치 파일 `ads/metrics/{mdate}.json`' if mdate else ' · 수치 파일 없음'), '',
          '숫자는 **파일에 있는 값만** 적습니다. 빈 칸은 `미수집` 이고 추측해서 채우지 않습니다.', '']

    # --- 1. 기간 수치
    L += ['## 1. 기간 수치 (올린 날짜 · 콜)', '']
    rows = []
    for ch in CH_ORDER:
        m, _ = ch_metrics(mch, ch)
        days = sorted({up_day(x) for x in in_up[ch] if up_day(x)})
        reach = num(m.get('도달') if ch == '인스타' else m.get('노출'))
        src = [k for k, v in CALL_TO_CH.items() if v == ch]
        rows.append([ch, len(in_up[ch]), ' · '.join(days) if days else '없음',
                     sum(call_in[s] for s in src), reach, num(m.get('조회'))])
    L += table(rows, ['채널', '기간 내 올림', '올린 날짜', '기간 내 콜', '노출·도달', '조회'])
    L += ['', f'기간 내 올린 것 {sum(len(in_up[c]) for c in CH_ORDER)}건 · '
          f'기간 내 콜 {sum(call_in.values())}건'
          + (f' · 전체 콜 {sum(call_all.values())}건' if sum(call_all.values()) != sum(call_in.values()) else ''), '']
    if has_period and sum(len(in_up[c]) for c in CH_ORDER) == 0 and sum(call_in.values()) > 0:
        L += ['> 이 기간에 **새로 올린 것은 없고 콜만 들어왔습니다.** 들어온 콜은 그 전에 올려 둔 것에서 온 것입니다.',
              '> (보드에 기록된 발행은 모두 기간 뒤인 11-25·11-26입니다.)', '']

    # --- 2. 콜 기록
    L += ['## 2. 콜 기록 — 어디 보고 연락이 왔나', '']
    if not calls:
        L += ['콜 기록이 0건입니다. 문의가 오면 가상 오피스 **콜 기록**에 채널을 남겨야 들어옵니다.', '']
    else:
        rows = [[s, call_in[s], call_all[s]] for s in CALL_SOURCES if call_all[s]]
        L += table(rows, ['채널', '기간 내', '전체'])
        L += ['', '**주별**', '']
        L += table([[w] + [v[s] for s in CALL_SOURCES if sum(x[s] for x in by_week.values())]
                    for w, v in sorted(by_week.items())],
                   ['주'] + [s for s in CALL_SOURCES if sum(x[s] for x in by_week.values())])
        L += ['', '**문의 종류**', '']
        L += table([[k, v] for k, v in sorted(kinds.items(), key=lambda x: -x[1])], ['종류', '건수'])
        L.append('')
        for c in sorted(calls, key=lambda x: str(x.get('at') or '')):
            memo = str(c.get('memo') or '')
            if risky(memo):
                memo = '[민감정보 포함 — 저장소에는 올리지 않음]'
            L.append(f"- {day(c.get('at')) or '날짜 미확인'} · {c.get('source')} · "
                     f"{c.get('kind') or '미확인'} — {memo}")
        L.append('')

    # --- 3. 채널별 전체
    L += ['## 3. 채널별로 올라간 내용 (전체)', '']
    for ch in CH_ORDER:
        t = tally[ch]
        L += [f'### {ch}', '']
        if not any(t.values()):
            L += ['올라간 내용이 없습니다.', '']
        else:
            for key in ('발행', '등록대기', '보류'):
                if not t[key]:
                    continue
                L += [f'**{key} {len(t[key])}건**', '']
                rows = []
                for c in sorted(t[key], key=lambda x: up_day(x) or ''):
                    title = str(c.get('title') or '')
                    assets = str(c.get('assets') or '-')
                    if risky(title) or risky(assets):
                        title, assets = '[민감정보 포함 — 저장소에는 올리지 않음]', '-'
                    mark = ' ✅' if (key == '발행' and inside(up_day(c))) else ''
                    rows.append([title + mark, c.get('propId') or '-', up_day(c) or '-', assets])
                L += table(rows, ['제목', '매물번호', '날짜', '자료'])
                L.append('')
        m, accts = ch_metrics(mch, ch)
        have = [f'{k} {m[k]}' for k in METRIC_FIELDS[ch] if m.get(k) not in (None, '', '미수집')]
        L.append('수치: ' + (' · '.join(have) if have else '미수집'))
        for name, a in accts.items():
            got = [f'{k} {a[k]}' for k in METRIC_FIELDS[ch] if a.get(k) not in (None, '', '미수집')]
            L += ['', f'- 계정 `{name}`: ' + (' · '.join(got) if got else '미수집')]
        miss = [k for k in METRIC_FIELDS[ch] if m.get(k) in (None, '', '미수집')]
        if miss:
            L += ['', '아직 못 센 칸: ' + ' · '.join(miss)]
        L.append('')
    if other:
        L += [f'### 채널 이름을 못 읽은 {len(other)}건', '']
        for c in other:
            L.append(f"- {c.get('title')} (channel: `{c.get('channel')}`)")
        L.append('')

    # --- 4. 커버리지
    L += ['## 4. 매물 몇 건이 광고에 나가 있나', '']
    rows = [['진행중 매물', len(live)],
            ['그중 현장 사진 있는 매물 (등록 1순위)', len(with_photo)],
            ['정보 카드만 있는 매물', len(card_only)]]
    for ch in CH_ORDER:
        n, d = len(reg[ch]), len(down[ch])
        pct = f' ({n * 100 // len(live)}%)' if live else ''
        rows.append([f'{ch} 올라가 있는 매물', f'{n}{pct}'])
        if d:
            rows.append([f'{ch} 내려감·만료', d])
    L += table(rows, ['구분', '건수'])
    L += ['', '`ads/channels.json` 에 번호·상태가 적힌 매물만 셉니다.',
          '채널에는 올렸지만 번호를 적어 두지 않은 건은 여기서 0으로 보입니다 —',
          '그래서 이 표의 숫자는 "광고에 나간 건수"가 아니라 **기록이 남은 건수**입니다.',
          '정보 카드는 자동으로 전체에 들어가 있어 현장 사진과 따로 셉니다.', '']

    # --- 5. 빈 칸
    L += ['## 5. 피클이 채울 칸 (출처 화면)', '']
    blanks = 0
    for ch in CH_ORDER:
        m, accts = ch_metrics(mch, ch)
        miss = [k for k in METRIC_FIELDS[ch] if m.get(k) in (None, '', '미수집')]
        blanks += len(miss) * (len(accts) or 1)
        if miss:
            L.append(f'- **{ch}** — {" · ".join(miss)}'
                     + (f' (계정 {len(accts)}개 각각)' if accts else ''))
    L += ['', f'빈 칸 {blanks}개. 채우는 곳: '
          + (f'`ads/metrics/{mdate}.json`' if mdate else '`ads/metrics/<날짜>.json` (새로 만들기)')
          + ' · 수치를 어디서 보는지는 `ads/README.md`.', '']

    L += ['## 6. 이대로 두면 못 세는 것', '',
          '- **콜 기록 날짜** — 주 단위로만 받으면 어느 게시물에서 온 콜인지 이을 수 없습니다. 전화 받은 날 바로 남기면 이어집니다.',
          '- **채널 번호** — 당근·텐컴즈 매물번호를 `ads/channels.json` 에 적지 않으면 거래완료 때 내릴 목록이 안 만들어집니다.',
          '- **만료일** — 텐컴즈 만료일이 없으면 만료 임박(30일 내) 경고를 띄울 수 없습니다.', '',
          '---', '', '광고 등록·내리기는 사람이 확인한 뒤 피클이 합니다. 이 문서는 읽고 보고만 합니다.']
    return today, '\n'.join(L) + '\n'


def main():
    ap = argparse.ArgumentParser(description='광고 채널 수치판 만들기')
    ap.add_argument('--board', required=True, help='가상 오피스에서 내려받은 폴더 (content/, calls/)')
    ap.add_argument('--ops', help='homebiz-ops 경로 (비공개 저장소) — 쓸 때 필수')
    ap.add_argument('--period', help='기간 (예: 2026-11-16..2026-11-23). 없으면 수치 파일의 period')
    ap.add_argument('--dry', action='store_true', help='파일을 쓰지 않고 내용만 보기')
    a = ap.parse_args()

    if not a.dry and not a.ops:
        print('--ops 가 없으면 쓰지 않습니다. 수치판은 비공개 저장소에만 둡니다.', file=sys.stderr)
        return 2
    ops = a.ops or ''
    if ops and os.path.abspath(ops) == ROOT:
        print('공개 저장소에는 쓰지 않습니다. --ops 에 homebiz-ops 경로를 주세요.', file=sys.stderr)
        return 2

    today, text = build(a.board, ops, a.period)
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
