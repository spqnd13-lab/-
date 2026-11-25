#!/usr/bin/env python3
"""홈앤비즈 운영 점검 리포트 (읽기 전용).

매물장 공개 데이터를 훑어서 "지금 누가 무엇을 해야 하는지"를 담당별로 뽑아 줍니다.
파일을 고치지 않으며, 연락처·비번은 공개 파일에 없으므로 리포트에도 들어가지 않습니다.

사용:
  python3 tools/ops_report.py              전체 리포트 (마크다운)
  python3 tools/ops_report.py --json       같은 내용을 JSON으로
  python3 tools/ops_report.py --only 현아  담당 한 명 몫만
  python3 tools/ops_report.py --limit 20   목록에 보여 줄 건수 (기본 10)

담당 구분은 docs/ops/role-split.md 의 분업 지도를 따릅니다.
"""
import argparse
import datetime
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'shareal'
PROPS = SITE / 'data' / 'properties.json'
PLAN3D_JS = SITE / 'js' / 'plan3d.js'
CATALOG_JS = SITE / '3d' / 'viewer-data.js'

TODAY = datetime.date.today()
EXPIRY_SOON_DAYS = 45          # 만기 임박으로 볼 기간
RENT_TRADES = ('월세', '전세', '단기임대')
PLAN_MIN_UNITS = 3             # 3D 도면 후보로 볼 최소 매물 수 (한 건물에)


# ---------------------------------------------------------------- 공통 읽기

def load_properties():
    return json.loads(PROPS.read_text(encoding='utf-8'))


def run(cmd):
    """검사 스크립트를 돌려 (통과여부, 출력) 을 돌려준다."""
    try:
        p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=180)
    except Exception as e:                                  # 실행 자체가 안 되는 경우
        return False, f'실행 실패: {e}'
    out = (p.stdout + p.stderr).strip()
    return p.returncode == 0, out


def squash(s):
    return re.sub(r'[\s·()\-_,]', '', str(s or '')).upper()


def building_of(prop):
    """매물 제목에서 건물 이름만 남긴다. '송도 AIT센터 102동 1509호' → '송도 AIT센터'"""
    name = []
    for word in str(prop.get('title') or '').split():
        if word.startswith('(') or re.search(r'\d', word):
            break
        name.append(word)
    return ' '.join(name) or (prop.get('title') or '이름 없음')


def plan_match_table():
    """plan3d.js 의 건물 낱말표와 viewer-data.js 의 도면 보유 건물 목록."""
    words = {}
    try:
        src = PLAN3D_JS.read_text(encoding='utf-8')
        body = src.split('var MATCH = {', 1)[1].split('};', 1)[0]
        for name, arr in re.findall(r"'([^']+)'\s*:\s*\[([^\]]*)\]", body):
            words[name] = re.findall(r"'([^']+)'", arr)
    except Exception:
        pass
    have = set()
    try:
        cat = CATALOG_JS.read_text(encoding='utf-8')
        have = set(re.findall(r'"building"\s*:\s*"([^"]+)"', cat)) or \
               set(re.findall(r"building:\s*'([^']+)'", cat))
    except Exception:
        pass
    return words, have


def plan_for(prop, words, have):
    """이 매물이 연결될 도면 건물 이름 (없으면 None)."""
    text = squash((prop.get('title') or '') + ' ' + (prop.get('address') or '') + ' ' + (prop.get('dongHo') or ''))
    best = None
    for name, ws in words.items():
        if all(squash(w) in text for w in ws):
            if best is None or len(ws) > len(words[best]):
                best = name
    if best and best in have:
        return best
    return None


def parse_date(s):
    s = str(s or '').strip()
    if not s:
        return None
    s = s.replace('.', '-').replace('/', '-')
    m = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', s)
    if not m:
        return None
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def label(prop):
    return f"{prop.get('id')} {prop.get('title') or ''}".strip()


# ---------------------------------------------------------------- 점검 항목

def collect(limit):
    props = load_properties()
    words, have = plan_match_table()
    live = [p for p in props if p.get('status') == '진행중']

    ids = Counter(str(p.get('id')) for p in props)
    dup_ids = sorted(i for i, n in ids.items() if n > 1)

    no_photo = [p for p in live if not p.get('photos')]
    no_memo = [p for p in live if not str(p.get('publicMemo') or '').strip()]
    no_feature = [p for p in live if not str(p.get('features') or '').strip()]

    soon, no_expiry = [], []
    for p in live:
        sch = p.get('schedules') or {}
        d = parse_date((sch.get('expiry') or {}).get('date'))
        if d:
            left = (d - TODAY).days
            if -7 <= left <= EXPIRY_SOON_DAYS:
                soon.append((left, p))
        elif p.get('tradeType') in RENT_TRADES:
            no_expiry.append(p)
    soon.sort(key=lambda x: x[0])

    upcoming = []
    for p in live:
        for key, name in (('contract', '계약'), ('signing', '중도금·서류'), ('balance', '잔금'), ('meeting', '미팅')):
            d = parse_date(((p.get('schedules') or {}).get(key) or {}).get('date'))
            if d and 0 <= (d - TODAY).days <= 30:
                upcoming.append(((d - TODAY).days, name, p))
    upcoming.sort(key=lambda x: x[0])

    missing_plan = Counter()
    for p in live:
        if not plan_for(p, words, have):
            missing_plan[building_of(p)] += 1
    # 매물이 여러 건 걸린 건물만 도면 후보로 본다 (빌라 1건짜리는 도면 작업 대상이 아님)
    plan_candidates = [(b, n) for b, n in missing_plan.most_common() if n >= PLAN_MIN_UNITS]
    plan_small = sum(1 for n in missing_plan.values() if n < PLAN_MIN_UNITS)

    ok_maemul, out_maemul = run([sys.executable, 'tools/maemul.py', 'check'])
    ok_public, out_public = run([sys.executable, '.github/scripts/check_public_data.py', '.'])

    return {
        'date': TODAY.isoformat(),
        'limit': limit,
        'checks': {
            'maemul': {'pass': ok_maemul, 'output': out_maemul},
            'public': {'pass': ok_public, 'output': out_public},
            'duplicate_ids': dup_ids,
        },
        'counts': {
            'total': len(props),
            'status': dict(Counter(p.get('status') or '' for p in props)),
            'trade': dict(Counter(p.get('tradeType') or '' for p in live)),
            'type': dict(Counter(p.get('type') or '' for p in live).most_common(6)),
            'gu': dict(Counter(p.get('regionGu') or '(미입력)' for p in live).most_common(6)),
            'staff': dict(Counter(p.get('createdByName') or '(미입력)' for p in live)),
            'photo_ratio': [len(live) - len(no_photo), len(live)],
        },
        'hyuna': {
            '사진 없는 진행중 매물 (관리부)': [label(p) for p in no_photo],
            '공개 소개글 비어 있음 (관리부)': [label(p) for p in no_memo],
            '특징 비어 있음 (관리부)': [label(p) for p in no_feature],
        },
        'pickle': {
            '만기 임박 (일정관리부)': [f'{d}일 뒤 · {label(p)}' if d >= 0 else f'{-d}일 지남 · {label(p)}' for d, p in soon],
            '만기일 없는 임대 매물 (일정관리부)': [label(p) for p in no_expiry],
            '30일 내 계약·잔금 일정 (계약관리부)': [f'{d}일 뒤 {name} · {label(p)}' for d, name, p in upcoming],
            '매물번호 중복 — 등록 시 덮어쓸 위험 (등록부)': dup_ids,
            '세 파일·저장키 검사': '통과' if ok_maemul else '실패',
            '민감정보 검사': '통과' if ok_public else '실패',
        },
        'claude': {
            f'도면 없는 건물 — 진행중 매물 {PLAN_MIN_UNITS}건 이상 (도면부)': [f'{n}건 · {b}' for b, n in plan_candidates],
            '매물 1~2건뿐이라 제외한 건물': f'{plan_small}곳',
            '매물번호 중복 정리 필요 (개발부)': dup_ids,
        },
    }


# ---------------------------------------------------------------- 출력

def section(title, items, limit):
    lines = [f'### {title} — {len(items)}건' if isinstance(items, list) else f'### {title}']
    if isinstance(items, list):
        if not items:
            lines.append('- 없음')
        else:
            for it in items[:limit]:
                lines.append(f'- {it}')
            if len(items) > limit:
                lines.append(f'- … 외 {len(items) - limit}건')
    else:
        lines.append(f'- {items}')
    return lines


def to_markdown(r, only=None):
    limit = r['limit']
    c, n = r['checks'], r['counts']
    out = [f"# 홈앤비즈 운영 점검 — {r['date']}", '']
    out += ['## 1. 배포 안전 검사', '']
    out.append(f"- 민감정보 검사: {'통과' if c['public']['pass'] else '**실패 — 배포 중단 상태**'}")
    out.append(f"- 세 파일·저장키 검사: {'통과' if c['maemul']['pass'] else '**실패**'}")
    if c['duplicate_ids']:
        out.append(f"- **매물번호 중복: {', '.join(c['duplicate_ids'])}** (수정·상태 변경이 첫 번째 매물에만 적용됩니다)")
    else:
        out.append('- 매물번호 중복: 없음')
    for key in ('public', 'maemul'):
        if not c[key]['pass'] and c[key]['output']:
            out += ['', '```', c[key]['output'][:2000], '```']
    done, total = n['photo_ratio']
    out += ['', '## 2. 매물 현황', '',
            f"- 전체 {n['total']}건 · " + ' · '.join(f'{k} {v}' for k, v in n['status'].items()),
            f"- 진행중 거래유형: " + ' · '.join(f'{k} {v}' for k, v in n['trade'].items()),
            f"- 진행중 지역: " + ' · '.join(f'{k} {v}' for k, v in n['gu'].items()),
            f"- 진행중 담당: " + ' · '.join(f'{k} {v}' for k, v in n['staff'].items()),
            f"- 사진 있는 진행중 매물: {done}/{total}건"]

    blocks = [('현아 (매물 관리·조사·기획)', 'hyuna'),
              ('피클 (등록·광고·일정·계약·공부)', 'pickle'),
              ('클로드 (개발·도면·점검·보안)', 'claude')]
    num = 3
    for title, key in blocks:
        if only and only not in title:
            continue
        out += ['', f'## {num}. {title} 몫', '']
        num += 1
        for name, items in r[key].items():
            out += section(name, items, limit) + ['']
    out += ['---', '',
            '담당 구분은 `docs/ops/role-split.md`, 규칙은 `AGENTS.md` 를 따릅니다.',
            '연락처·도어락 비번은 공개 파일에 없으므로 이 리포트에도 들어가지 않습니다.']
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser(description='홈앤비즈 운영 점검 리포트 (읽기 전용)')
    ap.add_argument('--json', action='store_true', help='JSON으로 출력')
    ap.add_argument('--only', help='담당 한 명 몫만 (현아 / 피클 / 클로드)')
    ap.add_argument('--limit', type=int, default=10, help='목록에 보여 줄 건수 (기본 10)')
    a = ap.parse_args()
    r = collect(a.limit)
    print(json.dumps(r, ensure_ascii=False, indent=2) if a.json else to_markdown(r, a.only))


if __name__ == '__main__':
    main()
