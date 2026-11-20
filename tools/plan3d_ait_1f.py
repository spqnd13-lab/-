"""AIT센터 1층 모형을 원본 CAD 도면에서 다시 만든다.

 1) 파워포인트에서 호실 번호·전용/공급면적·표기 위치를 읽는다
 2) 도면의 검은 선을 가로·세로 구간으로 모아 벽으로 세운다 (실제 도면 골격)
 3) 호실 표기 위치에서 방 안쪽을 채워 호실 바닥을 만들고, 공부 면적으로 고른다

계약현황(입점확정·편의점 등)은 가져오지 않는다.
사용: python3 tools/plan3d_ait_1f.py <작업폴더>
"""
import json, os, re, sys
from collections import deque
from xml.etree import ElementTree as ET

import numpy as np
from PIL import Image

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
WORK = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'shareal', '3d', 'model-scripts')
IMG = os.path.join(WORK, 'x', 'ppt', 'media', 'image1.png')

C = {'wall': '#e3e0da', 'floor': '#dfd9cd', 'tile': '#aeb4b7', 'glass': '#5f8f96',
     'mullion': '#2f3438', 'core': '#c9c6c0'}
WALL_H, FLOOR_H = 20.0, 1.6

# ── 1) 호실 표기 ────────────────────────────────────────────────────────
root = ET.parse(os.path.join(WORK, 'x', 'ppt', 'slides', 'slide1.xml')).getroot()


def plan_picture():
    best = None
    for p in root.iter(P + 'pic'):
        spPr = p.find(P + 'spPr')
        xf = spPr.find(A + 'xfrm') if spPr is not None else None
        if xf is None:
            continue
        o, e = xf.find(A + 'off'), xf.find(A + 'ext')
        a = int(e.get('cx')) * int(e.get('cy'))
        if best is None or a > best[-1]:
            best = (int(o.get('x')), int(o.get('y')), int(e.get('cx')), int(e.get('cy')), a)
    return best[:4]


im = Image.open(IMG).convert('RGB')
W, H = im.size
ox, oy, cx, cy = plan_picture()
sx, sy = cx / W, cy / H

units = []
# 호실 번호·면적은 파워포인트 표에서 읽는다. 표가 없는 판본이면
# 먼저 읽어 둔 결과(slide1.json)를 쓴다. 도면 이미지는 같은 파일이다.
for gf in root.iter(P + 'graphicFrame'):
    xf = gf.find(P + 'xfrm')
    if xf is None:
        continue
    o, e = xf.find(A + 'off'), xf.find(A + 'ext')
    cells = [' '.join((t.text or '') for t in tc.iter(A + 't')).strip() for tc in gf.iter(A + 'tc')]
    cells = [c for c in cells if c]
    if not cells:
        continue
    m = re.fullmatch(r'(1\d\d)', cells[0])
    if not m:
        continue
    nums = []
    for c in cells[1:]:
        try:
            nums.append(float(c))
        except ValueError:
            pass
    units.append({'label': m.group(1),
                  'x': (int(o.get('x')) - ox) / sx, 'y': (int(o.get('y')) - oy) / sy,
                  'w': int(e.get('cx')) / sx, 'h': int(e.get('cy')) / sy,
                  'exclusive': min(nums) if nums else None,
                  'supply': max(nums) if len(nums) > 1 else None})

if not units:
    fallback = os.path.join(WORK, 'slide1.json')
    if not os.path.exists(fallback) and len(sys.argv) > 2:
        fallback = sys.argv[2]
    if os.path.exists(fallback):
        prev = json.load(open(fallback, encoding='utf-8'))
        units = [dict(u) for u in prev.get('units', [])]
        print('표가 없어 먼저 읽어 둔 호실 표기를 씁니다: %s' % fallback)

units.sort(key=lambda u: u['label'])
print('호실 표기 %d개' % len(units))

# ── 2) 도면 선 → 벽 ────────────────────────────────────────────────────
a = np.asarray(im).astype(int)
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
red = (r > 120) & (g < 110) & (b < 110)
ink = (a.mean(2) < 150) & ~red          # 벽으로 세울 진한 선
ink_room = (a.mean(2) < 170) & ~red     # 방을 가르는 선 (얇은 칸막이까지)


def runs(mask, axis, minlen):
    """한 방향으로 이어진 선 구간을 모은다."""
    out = []
    n = mask.shape[0] if axis == 0 else mask.shape[1]
    for i in range(n):
        line = mask[i] if axis == 0 else mask[:, i]
        idx = np.nonzero(line)[0]
        if not len(idx):
            continue
        start = prev = idx[0]
        for j in list(idx[1:]) + [None]:
            if j is not None and j - prev <= 2:
                prev = j
                continue
            if prev - start + 1 >= minlen:
                out.append((i, int(start), int(prev)))
            if j is None:
                break
            start = prev = j
    return out


def merge(segs, thick_max=9):
    """나란한 선들을 두께 있는 벽 하나로 합친다."""
    segs.sort()
    used = [False] * len(segs)
    out = []
    by = {}
    for k, (i, s, e) in enumerate(segs):
        by.setdefault(i, []).append(k)
    for k, (i, s, e) in enumerate(segs):
        if used[k]:
            continue
        used[k] = True
        lo = hi = i
        s2, e2 = s, e
        for d in range(1, thick_max):
            nxt = by.get(i + d, [])
            hit = [j for j in nxt if not used[j] and segs[j][1] <= e2 + 3 and segs[j][2] >= s2 - 3]
            if not hit:
                break
            for j in hit:
                used[j] = True
                s2 = min(s2, segs[j][1]); e2 = max(e2, segs[j][2])
            hi = i + d
        out.append((lo, hi, s2, e2))
    return out


hor = merge(runs(ink, 0, 14))
ver = merge(runs(ink, 1, 14))
print('가로 벽 %d, 세로 벽 %d' % (len(hor), len(ver)))

# ── 3) 호실 영역 ───────────────────────────────────────────────────────
Hh, Ww = ink_room.shape
lab = np.full(ink_room.shape, -1, np.int32)
comps = []
for y0 in range(Hh):
    row = np.nonzero(~ink_room[y0] & (lab[y0] < 0))[0]
    for x0 in row:
        if lab[y0, x0] >= 0:
            continue
        cid = len(comps)
        q = deque([(y0, x0)]); lab[y0, x0] = cid
        n = 0; mnx = mxx = x0; mny = mxy = y0
        while q:
            y, x = q.popleft(); n += 1
            mnx = min(mnx, x); mxx = max(mxx, x); mxy = max(mxy, y)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < Hh and 0 <= nx < Ww and not ink_room[ny, nx] and lab[ny, nx] < 0:
                    lab[ny, nx] = cid; q.append((ny, nx))
        comps.append((n, (mnx, mny, mxx, mxy)))


def near(u, reach=46):
    ids = {}
    cy_, cx_ = int(u['y'] + u['h'] / 2), int(u['x'] + u['w'] / 2)
    for dy in range(-reach, reach + 1, 3):
        for dx in range(-reach, reach + 1, 3):
            y, x = cy_ + dy, cx_ + dx
            if 0 <= y < Hh and 0 <= x < Ww and lab[y, x] >= 0:
                c = lab[y, x]; n = comps[c][0]
                if 150 <= n <= 120000:
                    ids[c] = n
    return ids


cand = {u['label']: near(u) for u in units}
withA = [u for u in units if u['exclusive'] and cand[u['label']]]
best = (None, -1)
for k in np.exp(np.linspace(np.log(1e-4), np.log(5e-2), 400)):
    hit = sum(1 for u in withA
              if any(abs(np.log(n / (u['exclusive'] / k))) < np.log(1.2) for n in cand[u['label']].values()))
    if hit > best[1]:
        best = (k, hit)
k, hit = best
print('축척 1px ≈ %.3f m — 면적 ±20%% 안 %d/%d' % (np.sqrt(k), hit, len(withA)))

for u in units:
    c = cand[u['label']]
    if not c:
        u['rect'] = None; continue
    want = (u['exclusive'] / k) if u['exclusive'] else max(c.values())
    cid = min(c, key=lambda i: abs(np.log(c[i] / want)))
    n, (x0, y0, x1, y1) = comps[cid]
    u['rect'] = [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]
    u['fit'] = round(float(n * k / u['exclusive']), 2) if u['exclusive'] else None

# 같은 칸으로 읽힌 호실은 면적 비율로 나눔
same = {}
for u in units:
    if u['rect']:
        same.setdefault(tuple(u['rect']), []).append(u)
for rect, mem in same.items():
    if len(mem) < 2:
        continue
    x, y, w, h = rect
    xs = [m['x'] + m['w'] / 2 for m in mem]; ys = [m['y'] + m['h'] / 2 for m in mem]
    along_x = (max(xs) - min(xs)) >= (max(ys) - min(ys)) if max(xs) - min(xs) != max(ys) - min(ys) else w >= h
    mem.sort(key=lambda m: (m['x'] if along_x else m['y']))
    ar = [m.get('exclusive') or 0 for m in mem]; tot = sum(ar)
    sh = [v / tot for v in ar] if tot else [1 / len(mem)] * len(mem)
    run = w if along_x else h; at = x if along_x else y
    for m, f in zip(mem, sh):
        size = run * f
        m['rect'] = [round(at, 1), y, round(size, 1), h] if along_x else [x, round(at, 1), w, round(size, 1)]
        m['split'] = True
        at += size

# ── 4) 모형 ────────────────────────────────────────────────────────────
objects = []
n = 0


def add(name, box, material):
    global n
    n += 1
    objects.append({'id': 'P146-%d' % n, 'name': name,
                    'box': [round(float(v), 2) for v in box],
                    'material': material, 'color': C[material], 'semantic': material})


rects = [u['rect'] for u in units if u['rect']]
bx0 = min(r[0] for r in rects) - 18; by0 = min(r[1] for r in rects) - 18
bx1 = max(r[0] + r[2] for r in rects) + 18; by1 = max(r[1] + r[3] for r in rects) + 18
add('1층 바닥', [bx0, by0, bx1 - bx0, by1 - by0, -1.4, 1.4], 'tile')

for u in units:
    if not u['rect']:
        continue
    x, y, w, h = u['rect']
    add('%s 바닥' % u['label'], [x, y, w, h, 0.0, FLOOR_H], 'floor')

# 도면에서 읽은 벽을 그대로 세운다 (건물 범위 안쪽만)
wall_list = []
kept = 0
for lo, hi, s, e in hor:
    if not (by0 - 30 <= lo <= by1 + 30 and e - s >= 14):
        continue
    add('벽', [s, lo, e - s + 1, max(1.4, hi - lo + 1), 0.0, WALL_H], 'wall'); kept += 1
    wall_list.append({'id': 'w%d' % kept, 'start': [s, lo], 'end': [e, lo],
                      'thickness': max(1.4, hi - lo + 1), 'heightDisplay': WALL_H,
                      'openings': [], 'evidence': 'source_plan_line'})
for lo, hi, s, e in ver:
    if not (bx0 - 30 <= lo <= bx1 + 30 and e - s >= 14):
        continue
    add('벽', [lo, s, max(1.4, hi - lo + 1), e - s + 1, 0.0, WALL_H], 'wall'); kept += 1
    wall_list.append({'id': 'w%d' % kept, 'start': [lo, s], 'end': [lo, e],
                      'thickness': max(1.4, hi - lo + 1), 'heightDisplay': WALL_H,
                      'openings': [], 'evidence': 'source_plan_line'})
print('세운 벽 %d개, 객체 %d개' % (kept, len(objects)))

model = {
    'id': 'P146', 'building': '송도 AIT센터', 'usageLabel': '근린생활시설', 'planLabel': '1층',
    'sourceReference': 'AIT근린상가 첨부 평면도 (파워포인트 원본 CAD)',
    'sourceImage': 'originals/AIT_1층_원본도면.png',
    'coordinateSystem': {'units': 'source_image_pixels', 'width': W, 'height': H,
                         'origin': 'top_left', 'physicalScale': None,
                         'areaFittedM2PerPx2': float(k)},
    'direction': {'label': '북동 약 40° (도면 나침반 기호)', 'verified': False,
                  'northVector': [0.773, -0.635], 'evidence': 'source_plan_north_symbol'},
    'verification': {'status': 'source_interpreted_from_plan_and_area_table',
                     'dimensions': False, 'structure': False, 'direction': False,
                     'unitAssociation': False},
    'unknowns': ['실측 치수·층고·벽 두께',
                 '벽은 도면의 선을 모아 세운 것이며 구조 부재를 구분하지 않았음',
                 '창호·출입문 위치는 아직 구분하지 않음',
                 '현행 합호·칸막이 변경 여부',
                 '방위는 도면 나침반 기호에서 읽은 추정값'],
    'walls': wall_list, 'openings': [], 'columns': [],
    'units': [{'id': u['label'], 'label': u['label'], 'usage': '근린생활시설',
               'rect': u['rect'], 'rectEncoding': 'xywh', 'clickTarget': u['rect'],
               'exclusiveAreaM2': u.get('exclusive'), 'supplyAreaM2': u.get('supply'),
               'boundarySplitByArea': bool(u.get('split')),
               'evidence': 'source_plan_label_position_and_region'}
              for u in units if u['rect']],
    'facilities': [], 'objects': objects,
    'reconstruction': {'method': 'plan_line_vectorization_with_area_fit',
                       'geometryEvidence': 'source_plan', 'measured': False,
                       'heightIsMeasured': False},
    'dataVersion': '3.0-1f-from-plan-lines',
    'description': '원본 1층 평면도의 선을 모아 벽을 세우고, 호실 표기 위치와 공부 면적으로 '
                   '호실 구획을 얹었습니다. 벽 높이와 두께는 화면 표현용입니다.',
}
with open(os.path.join(OUT, 'P146.js'), 'w', encoding='utf-8') as f:
    f.write('PLAN_DATA["P146"]=')
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('P146 생성: 호실 %d, 객체 %d' % (len(model['units']), len(objects)))
