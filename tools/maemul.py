#!/usr/bin/env python3
"""매물장 공개 데이터 도구 (AI·사람 공통)

매물 하나를 추가·수정할 때 맞춰야 하는 파일을 한 번에 처리합니다.

  shareal/data/properties.json       원본 (이 파일이 기준)
  shareal/properties_data.js         const INITIAL_PROPERTY_DATA = [...]
  shareal/data/properties_data.js    window.PROPERTIES_DATA = [...]
  app.js / *.html 의 SMART_BROKER_PROPERTIES_V숫자, properties_data.js?v=숫자

사용법 (저장소 맨 위 폴더에서 실행):

  python3 tools/maemul.py add 매물.json          새 매물 추가 (여러 건이면 JSON 배열)
  python3 tools/maemul.py update P-YSJ-28 수정.json   기존 매물의 일부 항목 수정
  python3 tools/maemul.py status P-YSJ-28 거래완료    상태만 변경 (진행중/거래완료/보류)
  python3 tools/maemul.py find --trade 월세 --gu 연수구 --max-deposit 1000 --max-rent 80
  python3 tools/maemul.py show P-YSJ-28
  python3 tools/maemul.py check                 세 파일이 서로 같은지, 민감정보가 없는지 검사

공개 정보만 넣습니다. 이름·전화번호·주민번호·비번이 들어 있으면 거부합니다 (AGENTS.md 참고).
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'shareal'
JSON_PATH = SITE / 'data' / 'properties.json'
JS_PATH = SITE / 'properties_data.js'
MINI_PATH = SITE / 'data' / 'properties_data.js'
VERSIONED = [SITE / 'app.js', SITE / 'index.html', SITE / 'housing.html', SITE / 'commercial.html', SITE / 'ledger.html']

TYPES = ['아파트', '오피스텔', '빌라/다세대', '단독/다가구', '상가', '사무실', '상가/사무실',
         '지식산업센터', '근린생활시설', '사옥·통건물', '분양권', '토지/건물', '공장/창고']
TRADES = ['매매', '전세', '월세', '단기임대']
STATUSES = ['진행중', '거래완료', '보류']
STAFF = {
    '유수정': ('user_admin', '유수정 (대표자)', 'P-YSJ-'),
    '이은숙': ('user_staff1', '이은숙 (실장)', 'P-ES-'),
    '황규문': ('user_staff2', '황규문 (과장)', 'P-'),
}
EMPTY_CONTACTS = {'clientName': '', 'clientPhone': '', 'ownerName': '', 'ownerPhone': '', 'privateMemo': ''}
SCHEDULE_KEYS = ['meeting', 'contract', 'signing', 'balance', 'expiry', 'reminder']
KEY_ORDER = ['id', 'regionCity', 'regionGu', 'regionDong', 'type', 'tradeType', 'title', 'address', 'dongHo',
             'deposit', 'monthlyRent', 'maintenanceFee', 'area', 'floor', 'roomCount', 'features', 'publicMemo',
             'contacts', 'status', 'createdById', 'createdByName', 'createdAt', 'photos', 'schedules']
REQUIRED = ['regionCity', 'type', 'tradeType', 'title', 'address', 'deposit']
EDITABLE = [k for k in KEY_ORDER if k not in ('id', 'contacts', 'createdById', 'createdByName')]

# 공개 파일에 있으면 안 되는 것 (.github/scripts/check_public_data.py 와 같은 기준)
ALLOWED_PHONES = {'01022851585', '01091252285'}   # 공개해도 되는 사무소 번호
PHONE = re.compile(r'01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}')
RRN = re.compile(r'\b\d{6}\s*-\s*[1-4](?:\d{6}|\*)')
SECRET = re.compile(r'(현종\s*\d|현#\s*\d|현\s+#?\d{3,}|현경키\s*\d|현경열\s*\d|현열\s*\d|\d+층\s*비번\s*\d'
                    r'|도어락\s*비밀번호\s*[:：]\s*\d|비번\s*[:：]?\s*\d{3,}|비밀번호\s*[:：]?\s*\d{3,}|열쇠\s*번호)')


def fail(msg):
    print('❌ ' + msg, file=sys.stderr)
    sys.exit(1)


def load():
    return json.loads(JSON_PATH.read_text(encoding='utf-8'))


def text_values(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, dict):
        for x in v.values():
            yield from text_values(x)
    elif isinstance(v, list):
        for x in v:
            yield from text_values(x)


def sensitive_problems(p):
    """매물 한 건에 공개하면 안 되는 내용이 있는지 검사."""
    out = []
    c = p.get('contacts') or {}
    if any(str(c.get(k, '')).strip() for k in EMPTY_CONTACTS):
        out.append('contacts(연락처·비공개 메모)는 공개 파일에서 항상 비워 둡니다')
    for s in text_values({k: v for k, v in p.items() if k != 'contacts'}):
        if any(re.sub(r'\D', '', m.group()) not in ALLOWED_PHONES for m in PHONE.finditer(s)):
            out.append(f'전화번호 형식이 들어 있습니다: "{s[:40]}"')
        if RRN.search(s):
            out.append(f'주민번호 형식이 들어 있습니다: "{s[:40]}"')
        if SECRET.search(s):
            out.append(f'비번·열쇠 관련 표현이 들어 있습니다: "{s[:40]}"')
    return out


def normalize(p):
    """빠진 항목을 기본값으로 채우고 항목 순서를 맞춤."""
    p = dict(p)
    p['contacts'] = dict(EMPTY_CONTACTS)
    p.setdefault('regionGu', '')
    p.setdefault('regionDong', '')
    p.setdefault('dongHo', '')
    p.setdefault('monthlyRent', 0)
    p.setdefault('maintenanceFee', 0)
    for k in ('area', 'floor', 'roomCount', 'features', 'publicMemo'):
        p.setdefault(k, '')
    p.setdefault('status', '진행중')
    p.setdefault('createdAt', datetime.date.today().isoformat())
    p.setdefault('photos', [])
    sched = p.get('schedules') or {}
    p['schedules'] = {k: {'date': (sched.get(k) or {}).get('date', ''), 'memo': (sched.get(k) or {}).get('memo', '')}
                      for k in SCHEDULE_KEYS}
    return {k: p[k] for k in KEY_ORDER if k in p}


def validate(p):
    problems = []
    for k in REQUIRED:
        if p.get(k) in (None, ''):
            problems.append(f'필수 항목 "{k}"가 비어 있습니다')
    if p.get('type') and p['type'] not in TYPES:
        problems.append(f'type "{p["type"]}"은 쓸 수 없습니다. 가능한 값: {", ".join(TYPES)}')
    if p.get('tradeType') and p['tradeType'] not in TRADES:
        problems.append(f'tradeType "{p["tradeType"]}"은 쓸 수 없습니다. 가능한 값: {", ".join(TRADES)}')
    if p.get('status') and p['status'] not in STATUSES:
        problems.append(f'status "{p["status"]}"은 쓸 수 없습니다. 가능한 값: {", ".join(STATUSES)}')
    for k in ('deposit', 'monthlyRent', 'maintenanceFee'):
        if k in p and (isinstance(p[k], bool) or not isinstance(p[k], (int, float))):
            problems.append(f'"{k}"는 만원 단위 숫자여야 합니다 (예: 1억 8천만 → 18000)')
    if p.get('tradeType') == '월세' and not p.get('monthlyRent'):
        problems.append('월세 매물인데 monthlyRent(월세, 만원)가 없습니다')
    if p.get('tradeType') in ('매매', '전세') and p.get('monthlyRent'):
        problems.append('매매·전세 매물은 monthlyRent가 0이어야 합니다')
    for ph in p.get('photos') or []:
        if not isinstance(ph, str):
            problems.append('photos는 "images/파일명.jpg" 같은 문자열 목록이어야 합니다')
        elif not ph.startswith('http') and not (SITE / ph).exists():
            problems.append(f'사진 파일이 없습니다: shareal/{ph}')
    return problems + sensitive_problems(p)


def next_id(items, prefix):
    nums = []
    for p in items:
        m = re.fullmatch(re.escape(prefix) + r'(\d+)', p['id'])
        if m:
            nums.append(int(m.group(1)))
    n = (max(nums) if nums else 0) + 1
    return f'{prefix}{n:02d}' if prefix != 'P-' else f'P-{n}'


def bump_versions():
    """방문자·직원 브라우저가 새 데이터를 받도록 저장 키와 캐시 번호를 1씩 올림."""
    app = (SITE / 'app.js').read_text(encoding='utf-8')
    cur = int(re.search(r"const STORAGE_KEY = 'SMART_BROKER_PROPERTIES_V(\d+)'", app).group(1))
    qcur = max(int(m) for f in VERSIONED for m in re.findall(r'properties_data\.js\?v=(\d+)', f.read_text(encoding='utf-8')))
    for f in VERSIONED:
        s = f.read_text(encoding='utf-8')
        new = re.sub(r"(?<![A-Za-z0-9_])SMART_BROKER_PROPERTIES_V%d(?=')" % cur, f'SMART_BROKER_PROPERTIES_V{cur + 1}', s)
        new = re.sub(r'properties_data\.js\?v=\d+', f'properties_data.js?v={qcur + 1}', new)
        if new != s:
            f.write_text(new, encoding='utf-8')
    return cur + 1, qcur + 1


def write_all(items):
    JSON_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
    JS_PATH.write_text('const INITIAL_PROPERTY_DATA = ' + json.dumps(items, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    MINI_PATH.write_text('window.PROPERTIES_DATA = ' + json.dumps(items, ensure_ascii=False) + ';\n', encoding='utf-8')
    return bump_versions()


def price(p):
    def amt(n):
        n = int(n or 0)
        eok, man = divmod(n, 10000)
        return (f'{eok}억' if eok else '') + (f' {man:,}만' if man else '') or '0'
    if p['tradeType'] in ('월세', '단기임대'):
        return f"{p['tradeType']} {amt(p['deposit']).strip()} / {p.get('monthlyRent', 0)}만"
    return f"{p['tradeType']} {amt(p['deposit']).strip()}"


def line(p):
    return f"{p['id']:<10} [{p.get('status', '')}] {price(p):<22} {p.get('regionGu', '')} {p.get('regionDong', '')} · {p['type']} · {p['title']} · {p.get('area', '')}"


# ------------------------------------------------------------------ 명령
def cmd_add(a):
    raw = json.loads(Path(a.file).read_text(encoding='utf-8'))
    new_items = raw if isinstance(raw, list) else [raw]
    items = load()
    staff = STAFF.get(a.staff)
    if not staff:
        fail(f'담당자 "{a.staff}"를 알 수 없습니다. 가능한 값: {", ".join(STAFF)}')
    added, problems = [], []
    for src in new_items:
        unknown = [k for k in src if k not in KEY_ORDER]
        if unknown:
            problems.append(f'{src.get("title", "?")}: 모르는 항목 {unknown}')
        if any(str((src.get('contacts') or {}).get(k, '')).strip() for k in EMPTY_CONTACTS):
            problems.append(f'{src.get("title", "?")}: contacts에 값이 있습니다. 연락처는 매물장 화면에서만 입력합니다')
        p = dict(src)
        p.pop('id', None)
        p['createdById'], p['createdByName'] = staff[0], staff[1]
        p = normalize(p)
        errs = validate(p)
        dup = [x['id'] for x in items + added if x['title'] == p.get('title') and x['tradeType'] == p.get('tradeType')
               and x.get('dongHo') == p.get('dongHo')]
        if dup and not a.allow_duplicate:
            errs.append(f'같은 매물명·동호수·거래형태가 이미 있습니다: {dup} (정말 따로 등록하려면 --allow-duplicate)')
        if errs:
            problems += [f'{p.get("title", "?")}: {e}' for e in errs]
            continue
        p = {'id': next_id(items + added, staff[2]), **p}
        added.append({k: p[k] for k in KEY_ORDER if k in p})
    if problems:
        fail('등록하지 않았습니다.\n  - ' + '\n  - '.join(problems))
    if a.dry_run:
        print('(미리보기) 아래 매물이 등록됩니다. 파일은 바꾸지 않았습니다.')
        for p in added:
            print('  ' + line(p))
        return
    ver, q = write_all(added + items)
    print(f'✅ {len(added)}건 등록, 전체 {len(added) + len(items)}건 (저장 키 V{ver}, 캐시 v={q})')
    for p in added:
        print('  ' + line(p))


def apply_update(pid, patch, dry_run=False):
    items = load()
    idx = next((i for i, p in enumerate(items) if p['id'] == pid), None)
    if idx is None:
        fail(f'매물 {pid}을 찾을 수 없습니다. find 명령으로 번호를 확인하세요.')
    bad = [k for k in patch if k not in EDITABLE]
    if bad:
        fail(f'수정할 수 없는 항목: {bad}. 수정 가능: {", ".join(EDITABLE)}')
    before = items[idx]
    after = normalize({**before, **patch})
    after['createdById'], after['createdByName'] = before['createdById'], before['createdByName']
    after = {k: after[k] for k in KEY_ORDER if k in after}
    errs = validate(after)
    if errs:
        fail('수정하지 않았습니다.\n  - ' + '\n  - '.join(errs))
    changed = {k: (before.get(k), after.get(k)) for k in patch if before.get(k) != after.get(k)}
    if not changed:
        print('바뀐 내용이 없습니다.')
        return
    for k, (b, n) in changed.items():
        print(f'  {k}: {json.dumps(b, ensure_ascii=False)} → {json.dumps(n, ensure_ascii=False)}')
    if dry_run:
        print('(미리보기) 파일은 바꾸지 않았습니다.')
        return
    items[idx] = after
    ver, q = write_all(items)
    print(f'✅ {pid} 수정 (저장 키 V{ver}, 캐시 v={q})')
    print('⚠️  이미 매물장을 써 온 PC·휴대폰에는 예전 가격·상태가 남아 있습니다. 그 기기의 매물장 화면에서도 같은 내용으로 수정해 달라고 안내하세요.')


def cmd_update(a):
    apply_update(a.id, json.loads(Path(a.file).read_text(encoding='utf-8')), a.dry_run)


def cmd_status(a):
    if a.status not in STATUSES:
        fail(f'상태는 {", ".join(STATUSES)} 중 하나여야 합니다.')
    apply_update(a.id, {'status': a.status}, a.dry_run)


def cmd_find(a):
    out = []
    for p in load():
        blob = ' '.join(str(p.get(k, '')) for k in ('title', 'address', 'dongHo', 'features', 'publicMemo', 'regionGu', 'regionDong', 'area', 'roomCount'))
        if a.trade:
            want = {'임대': ('월세', '전세', '단기임대')}.get(a.trade, (a.trade,))
            if p['tradeType'] not in want:
                continue
        if a.type and a.type not in p['type']:
            continue
        if a.gu and a.gu not in (p.get('regionGu') or ''):
            continue
        if a.dong and a.dong not in (p.get('regionDong') or ''):
            continue
        if a.status != '전체' and p.get('status') != a.status:
            continue
        if a.max_deposit is not None and p['deposit'] > a.max_deposit:
            continue
        if a.min_deposit is not None and p['deposit'] < a.min_deposit:
            continue
        if a.max_rent is not None and (p.get('monthlyRent') or 0) > a.max_rent:
            continue
        if a.q and not all(w.lower() in blob.lower() for w in a.q):
            continue
        out.append(p)
    out.sort(key=lambda p: (p['deposit'], p.get('monthlyRent') or 0))
    print(f'{len(out)}건')
    for p in out[:a.limit]:
        print(line(p))
    if len(out) > a.limit:
        print(f'… 외 {len(out) - a.limit}건 (--limit 으로 더 보기)')


def cmd_show(a):
    p = next((p for p in load() if p['id'] == a.id), None)
    if not p:
        fail(f'매물 {a.id}을 찾을 수 없습니다.')
    print(json.dumps(p, ensure_ascii=False, indent=2))


def cmd_check(_):
    items = load()
    problems = []
    js = JS_PATH.read_text(encoding='utf-8')
    if js != 'const INITIAL_PROPERTY_DATA = ' + json.dumps(items, ensure_ascii=False, indent=2) + ';\n':
        problems.append('shareal/properties_data.js 가 data/properties.json 과 다릅니다')
    if MINI_PATH.read_text(encoding='utf-8') != 'window.PROPERTIES_DATA = ' + json.dumps(items, ensure_ascii=False) + ';\n':
        problems.append('shareal/data/properties_data.js 가 data/properties.json 과 다릅니다')
    ids = [p['id'] for p in items]
    dups = sorted({i for i in ids if ids.count(i) > 1})
    if dups:   # 번호를 바꾸면 각 기기에 저장된 연락처와 어긋나므로 자동으로 고치지 않고 알리기만 함
        print(f'⚠️  매물 번호가 겹칩니다: {dups} (수정·상태 변경 시 첫 번째 매물에 적용됩니다)')
    for p in items:
        problems += [f'{p["id"]}: {e}' for e in sensitive_problems(p)]
    keys = {m for f in VERSIONED for m in re.findall(r'SMART_BROKER_PROPERTIES_V\d+(?=\')', f.read_text(encoding='utf-8'))}
    if len(keys) != 1:
        problems.append(f'저장 키 버전이 파일마다 다릅니다: {sorted(keys)}')
    qs = {m for f in VERSIONED for m in re.findall(r'properties_data\.js\?v=\d+', f.read_text(encoding='utf-8'))}
    if len(qs) > 1:
        problems.append(f'캐시 번호가 파일마다 다릅니다: {sorted(qs)}')
    clients = json.loads((SITE / 'data' / 'clients.json').read_text(encoding='utf-8'))
    if clients != []:
        problems.append('shareal/data/clients.json 은 항상 [] 이어야 합니다 (손님 정보는 공개 파일에 넣지 않음)')
    if problems:
        fail('문제가 있습니다.\n  - ' + '\n  - '.join(problems[:30]))
    print(f'✅ 이상 없음: 매물 {len(items)}건, 세 파일 일치, 민감정보 없음, {sorted(keys)[0]}')


def main():
    ap = argparse.ArgumentParser(description='매물장 공개 데이터 도구')
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('add', help='새 매물 추가')
    s.add_argument('file')
    s.add_argument('--staff', default='유수정', help='담당자: 유수정(기본) / 이은숙 / 황규문')
    s.add_argument('--dry-run', action='store_true', help='파일을 바꾸지 않고 미리보기')
    s.add_argument('--allow-duplicate', action='store_true')
    s.set_defaults(fn=cmd_add)
    s = sub.add_parser('update', help='기존 매물 수정')
    s.add_argument('id')
    s.add_argument('file')
    s.add_argument('--dry-run', action='store_true')
    s.set_defaults(fn=cmd_update)
    s = sub.add_parser('status', help='상태 변경')
    s.add_argument('id')
    s.add_argument('status')
    s.add_argument('--dry-run', action='store_true')
    s.set_defaults(fn=cmd_status)
    s = sub.add_parser('find', help='매물 찾기')
    s.add_argument('--trade', help='매매 / 전세 / 월세 / 임대(월세+전세)')
    s.add_argument('--type', help='아파트, 오피스텔, 상가 …')
    s.add_argument('--gu')
    s.add_argument('--dong')
    s.add_argument('--status', default='진행중', help='진행중(기본) / 거래완료 / 보류 / 전체')
    s.add_argument('--max-deposit', type=int, help='보증금·매매가 상한 (만원)')
    s.add_argument('--min-deposit', type=int)
    s.add_argument('--max-rent', type=int, help='월세 상한 (만원)')
    s.add_argument('--q', nargs='*', help='검색어 (모두 포함)')
    s.add_argument('--limit', type=int, default=20)
    s.set_defaults(fn=cmd_find)
    s = sub.add_parser('show', help='매물 한 건 전체 보기')
    s.add_argument('id')
    s.set_defaults(fn=cmd_show)
    s = sub.add_parser('check', help='파일 일치·민감정보 검사')
    s.set_defaults(fn=cmd_check)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
