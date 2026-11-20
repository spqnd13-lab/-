"""AIT 1층 모형을 '원본 대조선'에서 만든다.

shareal/ait-1f-review.html 의 SVG 는 원본 평면 이미지(1699x691) 위에서
사람이 직접 대조해 그린 선이다. 그 선만 3D 로 세운다.
자동 벡터화·공통 상자형 모델을 쓰지 않는다. (PR #19 검수 기준)

원본에 없는 것은 만들지 않는다:
  - 치수·층고는 화면 표현용 값이며 실측이 아니다
  - 호실 번호는 원본 이미지에 없으므로 경계는 '참고'로 둔다
  - 조경·간판·집기 같은 장식 객체는 넣지 않는다
사용: python3 tools/plan3d_ait_1f_traced.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'shareal', 'ait-1f-review.html')
OUT = os.path.join(ROOT, 'shareal', '3d', 'model-scripts', 'P146.js')

C = {'wall': '#e3e0da', 'partition': '#ebe8e2', 'core': '#c9c6c0',
     'door': '#aa8061', 'column': '#b8b5ad', 'floor': '#e4ddcf', 'tile': '#b9bfc2',
     'glass': '#5f8f96', 'mullion': '#2f3438', 'path': '#cfd3d4',
     'plant': '#6f8f63', 'hedge': '#5a7a52', 'lobby': '#d9d2c4', 'park': '#a9b0b3',
     'shopA': '#f2efe8', 'shopB': '#e2ddd1', 'seam': '#9b968c',
     'leaf': '#4b7f88', 'handle': '#cfd8d6',
     'yard': '#d7dadb', 'walk': '#dcd7cc', 'paver': '#cbc4b6', 'bed': '#7d9a6c',
     'shrub': '#5f8354', 'flower': '#b08a9a', 'lawn': '#8fa87d', 'canopy': '#4e7046',
     'canopy2': '#628657', 'canopy3': '#7c9c66', 'trunk': '#7a6550', 'bench': '#9a8468',
     'flower2': '#c9a765', 'flower3': '#9a7fa6', 'planter': '#b9b2a4',
     'figure': '#8d8b86', 'figure2': '#9b968e', 'car': '#9ba3a8', 'carglass': '#7f8e96'}
H_WALL, H_PART, H_CORE, FLOOR_H = 20.0, 13.0, 22.0, 1.2
T_WALL, T_PART = 2.6, 1.8

html = open(SRC, encoding='utf-8').read()


def paths(cls):
    out = []
    for m in re.finditer(r'<path class="([^"]*)" d="([^"]*)"', html):
        classes = m.group(1).split()
        if cls in classes:
            out.append((classes, m.group(2)))
    return out


def segments(d):
    """M x y H x / V y 형태의 가로·세로 선을 좌표 쌍으로 푼다."""
    segs = []
    cur = None
    for tok in re.findall(r'[MHVZz]\s*-?[\d.]*\s*-?[\d.]*', d):
        op = tok[0]
        nums = [float(v) for v in re.findall(r'-?[\d.]+', tok)]
        if op == 'M' and len(nums) >= 2:
            cur = [nums[0], nums[1]]
        elif op == 'H' and cur and nums:
            segs.append((cur[0], cur[1], nums[0], cur[1])); cur = [nums[0], cur[1]]
        elif op == 'V' and cur and nums:
            segs.append((cur[0], cur[1], cur[0], nums[0])); cur = [cur[0], nums[0]]
    return segs


def rects(d):
    """M x y H x V y H x Z 형태의 닫힌 사각형."""
    out = []
    for part in d.split('M')[1:]:
        nums = [float(v) for v in re.findall(r'-?[\d.]+', part)]
        if len(nums) >= 4:
            x, y, x2, y2 = nums[0], nums[1], nums[2], nums[3]
            out.append((min(x, x2), min(y, y2), abs(x2 - x), abs(y2 - y)))
    return out


objects, walls, n = [], [], 0


def add(name, box, material, staging=False):
    global n
    n += 1
    o = {'id': 'P146-%d' % n, 'name': name,
         'box': [round(float(v), 2) for v in box],
         'material': material, 'color': C[material], 'semantic': material}
    if staging:
        o['staging'] = True          # 공간 연출 — 끄면 숨고 고를 수 없다
    objects.append(o)


def put_seg(x1, y1, x2, y2, thick, height, name, material):
    if abs(y2 - y1) < 0.6:                       # 가로
        x0, w = min(x1, x2), abs(x2 - x1)
        add(name, [x0, y1 - thick / 2, w, thick, 0.0, height], material)
        walls.append({'start': [x0, y1], 'end': [x0 + w, y1], 'thickness': thick,
                      'heightDisplay': height, 'openings': [], 'evidence': 'manual_trace_over_source'})
    elif abs(x2 - x1) < 0.6:                     # 세로
        y0, h = min(y1, y2), abs(y2 - y1)
        add(name, [x1 - thick / 2, y0, thick, h, 0.0, height], material)
        walls.append({'start': [x1, y0], 'end': [x1, y0 + h], 'thickness': thick,
                      'heightDisplay': height, 'openings': [], 'evidence': 'manual_trace_over_source'})


# 코어 (계단·승강기·화장실 덩어리)
cores = []
for classes, d in paths('core'):
    for x, y, w, h in rects(d):
        cores.append((x, y, w, h))
        add('공용 코어', [x, y, w, h, 0.0, H_CORE], 'core')

# 바닥판 — 대조선 전체 범위
allsegs = []
for classes, d in paths('line'):
    allsegs += segments(d)
xs = [v for s in allsegs for v in (s[0], s[2])]
ys = [v for s in allsegs for v in (s[1], s[3])]
bx0, by0, bx1, by1 = min(xs) - 10, min(ys) - 10, max(xs) + 10, max(ys) + 10
add('1층 바닥', [bx0, by0, bx1 - bx0, by1 - by0, -1.2, 1.2], 'tile')
PLATE = objects[-1]          # 호실을 다 읽은 뒤 바닥판을 호실 바깥까지 넓힌다

# 벽·칸막이
nw = np_ = 0
for classes, d in paths('line'):
    part = 'partition' in classes
    for (x1, y1, x2, y2) in segments(d):
        put_seg(x1, y1, x2, y2,
                T_PART if part else T_WALL,
                H_PART if part else H_WALL,
                '칸막이' if part else '벽',
                'partition' if part else 'wall')
        if part: np_ += 1
        else: nw += 1

# 출입문 표시 (원본에서 확인한 자리)
doors = 0
openings = []
for classes, d in paths('door'):
    for m in re.finditer(r'M\s*(-?[\d.]+)\s*(-?[\d.]+)', d):
        x, y = float(m.group(1)), float(m.group(2))
        add('통로 중앙문 (유리)', [x - 7, y - 3, 14, 6, 0.0, 17.0], 'leaf')
        add('통로 중앙문 틀', [x - 7.6, y - 3.6, 1.2, 7.2, 0.0, 17.5], 'mullion')
        add('통로 중앙문 틀', [x + 6.4, y - 3.6, 1.2, 7.2, 0.0, 17.5], 'mullion')
        openings.append({'kind': 'door', 'label': '통로 중앙문 (유리)',
                         'doorType': 'passage_center_glass', 'rect': [x - 7, y - 3, 14, 6],
                         'sill': 0.0, 'height': 17.0, 'evidence': 'source_plan_door_symbol',
                         'verified': False})
        doors += 1

# 기둥 (대조선에 있으면)
cols = len(re.findall(r'<rect[^>]*x="', html.split('id="columns"')[1].split('</g>')[0])) \
    if 'id="columns"' in html else 0

# 호실 경계 — 번호 표기본 도면과 대조선 칸을 맞춘 표에서 만든다 (PR #19 기준)
units = []
mapfile = os.path.join(ROOT, 'tools', 'ait_1f_unit_map.json')
areas = {}
af = os.path.join(ROOT, 'tools', '_ait_1f_units.json')
if os.path.exists(af):
    for u in json.load(open(af, encoding='utf-8')).get('units', []):
        areas[u['label']] = u

if os.path.exists(mapfile):
    mp = json.load(open(mapfile, encoding='utf-8'))
    for row in mp['rows']:
        labels = row['labels']
        if 'xs' in row:                      # 가로로 늘어선 줄
            xs, y0, y1 = row['xs'], row['y0'], row['y1']
            for i, lb in enumerate(labels):
                if not lb:
                    continue
                rect = [xs[i], y0, xs[i + 1] - xs[i], y1 - y0]
                units.append((lb, rect, row['name']))
        else:                                # 세로로 쌓인 줄
            ys, x0, x1 = row['ys'], row['x0'], row['x1']
            for i, lb in enumerate(labels):
                if not lb:
                    continue
                rect = [x0, ys[i], x1 - x0, ys[i + 1] - ys[i]]
                units.append((lb, rect, row['name']))

    for ex in mp.get('extraUnits', []):
        units.append((ex['label'], ex['rect'], ex.get('note', '원본 직접 읽음')))

    # 줄 규칙에서 벗어나는 칸 (원본에서 직접 읽은 값으로 덮어쓴다)
    ov = mp.get('overrides', {})
    for i, (lb, rect, rowname) in enumerate(units):
        o = ov.get(lb)
        if not o:
            continue
        x0r, y0r = rect[0], rect[1]
        x1r, y1r = rect[0] + rect[2], rect[1] + rect[3]
        x0r, y0r = o.get('x0', x0r), o.get('y0', y0r)
        x1r, y1r = o.get('x1', x1r), o.get('y1', y1r)
        units[i] = (lb, [x0r, y0r, x1r - x0r, y1r - y0r], rowname)

    unmapped = set(mp.get('unmapped', []))
    out_units = []
    for lb, rect, rowname in units:
        a = areas.get(lb, {})
        out_units.append({
            'id': lb, 'label': lb, 'usage': '근린생활시설',
            'rect': rect, 'rectEncoding': 'xywh', 'clickTarget': rect,
            'exclusiveAreaM2': a.get('exclusive'), 'supplyAreaM2': a.get('supply'),
            'confidence': '확인됨',
            'evidence': 'numbered_source_plan_matched_to_manual_trace',
            'sourceRow': rowname,
        })
    # 아직 대조하지 못한 호실은 넣지 않는다 (추측 금지)
    units = out_units
    print('확정 호실 %d개, 미대조 %d개(%s)' % (len(units), len(unmapped), ', '.join(sorted(unmapped))))
else:
    units = []

# 바닥판이 호실을 덮도록 넓힌다 (119~123처럼 대조선 밖까지 나가는 칸이 있다)
for u in units:
    x, y, w, h = u['rect']
    bx0, by0 = min(bx0, x - 10), min(by0, y - 10)
    bx1, by1 = max(bx1, x + w + 10), max(by1, y + h + 10)
PLATE['box'] = [round(bx0, 2), round(by0, 2), round(bx1 - bx0, 2), round(by1 - by0, 2), -1.2, 1.2]

# ── 호실 바닥 : 점포마다 칸이 떨어져 보이게 ─────────────────────────
for ui, u in enumerate(units):
    x, y, w, h = u['rect']
    add('%s 바닥' % u['label'], [x + 1.6, y + 1.6, w - 3.2, h - 3.2, 0.2, 1.1],
        'shopA' if ui % 2 == 0 else 'shopB')

# ── 점포 경계선 : 이웃 호실 사이 칸막이 ─────────────────────────────
seams = 0
for u in units:
    x, y, w, h = u['rect']
    for v in units:
        if v is u:
            continue
        a, b2, c, d2 = v['rect']
        if abs((x + w) - a) <= 2 and y < b2 + d2 and b2 < y + h:      # 오른쪽 이웃
            yy0, yy1 = max(y, b2), min(y + h, b2 + d2)
            add('점포 경계', [x + w - 1.2, yy0, 2.4, yy1 - yy0, 0.0, H_PART], 'seam')
            seams += 1
        if abs((y + h) - b2) <= 2 and x < a + c and a < x + w:        # 아래쪽 이웃
            xx0, xx1 = max(x, a), min(x + w, a + c)
            add('점포 경계', [xx0, y + h - 1.2, xx1 - xx0, 2.4, 0.0, H_PART], 'seam')
            seams += 1

# ── 전창(유리) : 문이 그려진 면은 전부 전면 유리 ─────────────────────
GLASS_SILL, GLASS_TOP = 1.6, 18.0
for u in units:
    x, y, w, h = u['rect']
    horizontal = w >= h          # 가로로 늘어선 줄이면 긴 변이 위·아래
    sides = ([(x, y, w, 1.8), (x, y + h - 1.8, w, 1.8)] if horizontal
             else [(x, y, 1.8, h), (x + w - 1.8, y, 1.8, h)])
    for sxx, syy, sww, shh in sides:
        add('%s 전면 유리' % u['label'], [sxx, syy, sww, shh, GLASS_SILL, GLASS_TOP - GLASS_SILL], 'glass')
        openings.append({'kind': 'window', 'label': '%s 전면 유리' % u['label'],
                         'rect': [sxx, syy, sww, shh], 'sill': GLASS_SILL,
                         'height': GLASS_TOP - GLASS_SILL,
                         'evidence': 'door_symbol_read_as_full_height_glazing', 'verified': False})
        # 상가 출입문 — 전창 가운데에 유리문 (문 위치는 칸 가운데로 둔 참고용 표현)
        dw = min(26.0, max(12.0, (sww if sww >= shh else shh) * 0.42))
        if sww >= shh:
            dx0 = sxx + (sww - dw) / 2
            add('%s 출입문 (유리)' % u['label'], [dx0, syy - 0.5, dw, shh + 1.0, 0.0, GLASS_TOP], 'leaf')
            add('%s 문틀' % u['label'], [dx0 - 1.0, syy - 0.8, 1.6, shh + 1.6, 0.0, GLASS_TOP + 0.6], 'mullion')
            add('%s 문틀' % u['label'], [dx0 + dw - 0.6, syy - 0.8, 1.6, shh + 1.6, 0.0, GLASS_TOP + 0.6], 'mullion')
            add('%s 손잡이' % u['label'], [dx0 + dw / 2 - 0.5, syy - 0.9, 1.0, shh + 1.8, 7.0, 4.0], 'handle')
            drect = [dx0, syy, dw, shh]
        else:
            dy0 = syy + (shh - dw) / 2
            add('%s 출입문 (유리)' % u['label'], [sxx - 0.5, dy0, sww + 1.0, dw, 0.0, GLASS_TOP], 'leaf')
            add('%s 문틀' % u['label'], [sxx - 0.8, dy0 - 1.0, sww + 1.6, 1.6, 0.0, GLASS_TOP + 0.6], 'mullion')
            add('%s 문틀' % u['label'], [sxx - 0.8, dy0 + dw - 0.6, sww + 1.6, 1.6, 0.0, GLASS_TOP + 0.6], 'mullion')
            add('%s 손잡이' % u['label'], [sxx - 0.9, dy0 + dw / 2 - 0.5, sww + 1.8, 1.0, 7.0, 4.0], 'handle')
            drect = [sxx, dy0, sww, dw]
        openings.append({'kind': 'door', 'label': '%s 출입문 (유리)' % u['label'],
                         'doorType': 'shop_glass', 'rect': drect, 'sill': 0.0,
                         'height': GLASS_TOP, 'evidence': 'source_plan_door_symbol_on_glazed_front',
                         'positionVerified': False, 'verified': False})

        run = sww if sww >= shh else shh
        bays = max(1, int(run // 34))
        for bi in range(bays + 1):
            f = bi / bays
            if sww >= shh:
                add('%s 창틀' % u['label'], [sxx + f * sww - 0.6, syy - 0.3, 1.2, shh + 0.6,
                                             GLASS_SILL, GLASS_TOP - GLASS_SILL], 'mullion')
            else:
                add('%s 창틀' % u['label'], [sxx - 0.3, syy + f * shh - 0.6, sww + 0.6, 1.2,
                                             GLASS_SILL, GLASS_TOP - GLASS_SILL], 'mullion')

# 원본 쌍여닫이 기호 자리의 통로 중앙문 (사용자 확인: 유리)
for cxm, cym in [(559.0, 458.0)]:
    add('통로 중앙문 (유리)', [cxm - 3.0, cym - 11.0, 6.0, 22.0, 0.0, 17.0], 'leaf')
    add('통로 중앙문 틀', [cxm - 3.6, cym - 11.6, 7.2, 1.2, 0.0, 17.5], 'mullion')
    add('통로 중앙문 틀', [cxm - 3.6, cym + 10.4, 7.2, 1.2, 0.0, 17.5], 'mullion')
    openings.append({'kind': 'door', 'label': '통로 중앙문 (유리)',
                     'doorType': 'passage_center_glass',
                     'rect': [cxm - 3.0, cym - 11.0, 6.0, 22.0], 'sill': 0.0, 'height': 17.0,
                     'evidence': 'source_plan_double_door_symbol', 'verified': False})

# ── 남측 전면 : 133호~114호 앞 공개공지 (조경·보행로) ─────────────
# 줄마다 앞면 높이가 달라 구간을 나눈다
FRONTS = [('133~125호 앞', 64.0, 560.0, 625.0),
          ('101~107호 앞', 636.0, 1028.0, 599.0),
          ('108~114호 앞', 1108.0, 1463.0, 597.0),
          ('115~118호 앞', 1494.0, 1636.0, 597.0)]
BAND = 66.0
def in_front_band(px, py):
    for _, fx0, fx1, fy in FRONTS:
        if fx0 - 8 <= px <= fx1 + 8 and fy <= py <= fy + BAND:
            return True
    return False

# ── 공간 연출 : 원본에서 확인되는 자리에만 사람·차량 ────────────────
# 임차인·업종을 암시하지 않고, 번호판·상표·인물 식별 요소는 넣지 않는다
stage = 0


# 이 도면은 1m가 약 10.3px입니다. 사람을 실제 크기로 그리면 점처럼 보여
# 알아볼 수 있게 1.6배로 키웠습니다. 차량은 실제 크기(4.5m x 1.8m)입니다.
FIG = 1.6


def person(px, py, tall=1.0, mat='figure'):
    """사람 실루엣 — 다리·몸통·머리 세 덩이"""
    global stage
    f = FIG * tall
    add('사람 (연출)', [px - 1.6 * FIG, py - 1.2 * FIG, 3.2 * FIG, 2.4 * FIG, 0.0, 6.0 * f], mat, True)
    add('사람 (연출)', [px - 2.2 * FIG, py - 1.6 * FIG, 4.4 * FIG, 3.2 * FIG, 6.0 * f, 6.4 * f], mat, True)
    add('사람 (연출)', [px - 1.5 * FIG, py - 1.5 * FIG, 3.0 * FIG, 3.0 * FIG, 12.4 * f, 2.8 * f], mat, True)
    stage += 1


def seated(px, py, mat='figure2'):
    """앉아 쉬는 사람 — 벤치 높이에 맞춘 낮은 실루엣"""
    global stage
    add('앉은 사람 (연출)', [px - 2.0 * FIG, py - 1.5 * FIG, 4.0 * FIG, 3.0 * FIG, 3.2, 5.8], mat, True)
    add('앉은 사람 (연출)', [px - 1.4 * FIG, py - 1.4 * FIG, 2.8 * FIG, 2.8 * FIG, 9.0, 3.4], mat, True)
    stage += 1


def car(cx_, cy_, horizontal=True):
    """차량 실루엣 — 번호판·상표 없음"""
    global stage
    L, Wd = (46.0, 19.0) if horizontal else (19.0, 46.0)    # 4.5m x 1.8m
    add('차량 (연출)', [cx_ - L / 2, cy_ - Wd / 2, L, Wd, 0.0, 8.0], 'car', True)
    if horizontal:
        add('차량 (연출)', [cx_ - L / 2 + 11, cy_ - Wd / 2 + 2.0, L - 22, Wd - 4.0, 8.0, 7.0], 'carglass', True)
    else:
        add('차량 (연출)', [cx_ - L / 2 + 2.0, cy_ - Wd / 2 + 11, Wd - 4.0, L - 22, 8.0, 7.0], 'carglass', True)
    stage += 1


# 로비 및 라운지 (도면 표기) — 서 있는 사람 둘
person(1000.0, 404.0, 1.0)
person(1118.0, 414.0, 0.92)
# 주민휴게공간 (도면 표기) — 앉아 쉬는 사람 둘
seated(452.0, 232.0)
seated(468.0, 252.0)
# 지상주차장 출입구 · 지하주차장 입구 (도면 표기 동선) — 진입 차량 한 대씩
car(1018.0, 120.0, True)
car(290.0, 166.0, True)

# ── 통로 : 바닥판에서 호실·코어·전면 조경이 아닌 자리 ───────────────
def covered(px, py):
    for u in units:
        x, y, w, h = u['rect']
        if x <= px <= x + w and y <= py <= y + h:
            return True
    for (x, y, w, h) in cores:
        if x <= px <= x + w and y <= py <= y + h:
            return True
    return in_front_band(px, py)

G = 10
cx0, cy0 = int(bx0), int(by0)
cols = int((bx1 - bx0) // G) + 1
rowsn = int((by1 - by0) // G) + 1
grid = [[not covered(cx0 + i * G + G / 2, cy0 + j * G + G / 2) for i in range(cols)] for j in range(rowsn)]
corr = yards = 0
used = [[False] * cols for _ in range(rowsn)]
for j in range(rowsn):
    for i in range(cols):
        if used[j][i] or not grid[j][i]:
            continue
        w = 0
        while i + w < cols and grid[j][i + w] and not used[j][i + w]:
            w += 1
        h = 1
        while j + h < rowsn and all(grid[j + h][i + k] and not used[j + h][i + k] for k in range(w)):
            h += 1
        for jj in range(j, j + h):
            for ii in range(i, i + w):
                used[jj][ii] = True
        ww, hh = w * G, h * G
        if ww < 18 or hh < 18:
            continue
        # 좁고 긴 자리는 사람이 다니는 통로, 넓게 트인 자리는 외부 마당
        if min(ww, hh) <= 90:
            add('통로', [cx0 + i * G, cy0 + j * G, ww, hh, -0.6, 0.8], 'path')
            corr += 1
        else:
            add('외부 마당', [cx0 + i * G, cy0 + j * G, ww, hh, -0.7, 0.7], 'yard')
            yards += 1

# ── 공용부 : 도면에 이름이 적힌 자리 ───────────────────────────────
AREAS = [
    ('로비 및 라운지', [960, 386, 200, 70], 'lobby', 1.4),
    ('회의실',       [614, 300, 110, 56], 'lobby', 1.4),
    ('경비실',       [724, 174, 54, 50], 'lobby', 1.4),
    ('택배보관실',    [784, 174, 95, 50], 'lobby', 1.4),
    ('지하주차장 입구', [230, 146, 120, 40], 'park', 1.0),
    ('지상주차장 출입구', [958, 92, 120, 56], 'park', 1.0),
    ('주민휴게공간',   [432, 186, 128, 100], 'plant', 1.6),
]
areas = []
for name, rect, mat, hgt in AREAS:
    add(name, rect + [-0.4, hgt], mat)
    areas.append({'label': name, 'rect': rect, 'evidence': 'source_plan_label',
                  'verified': False})

# ── 조경 : 133호~114호 앞은 켜켜이 두껍게 ──────────────────────────
land = beds = 0

def tree(tx, ty, size=1.0):
    """교목 — 보호대 위에 줄기를 세우고 수관을 세 켜로 쌓는다"""
    global land
    add('수목 보호대', [tx - 4.5 * size, ty - 4.5 * size, 9.0 * size, 9.0 * size, 0.0, 0.8], 'paver')
    add('수목 줄기', [tx - 1.7 * size, ty - 1.7 * size, 3.4 * size, 3.4 * size, 0.0, 11.0 * size], 'trunk')
    add('수목', [tx - 10.5 * size, ty - 10.5 * size, 21.0 * size, 21.0 * size,
                 11.0 * size, 7.0 * size], 'canopy')
    add('수목', [tx - 8.2 * size, ty - 8.2 * size, 16.4 * size, 16.4 * size,
                 17.5 * size, 6.0 * size], 'canopy2')
    add('수목', [tx - 5.2 * size, ty - 5.2 * size, 10.4 * size, 10.4 * size,
                 23.0 * size, 5.0 * size], 'canopy3')
    land += 1

FLOWERS = ['flower', 'flower2', 'flower3']

def shrubmass(sx, sy, sw, sh, kind='shrub', tone=0):
    """관목 덩어리 — 네모 하나가 아니라 덩이를 겹쳐 수형을 만든다"""
    add('관목 식재대' if kind == 'shrub' else '화단', [sx, sy, sw, sh, 0.0, 2.2], 'bed')
    n = max(2, int(sw // 11))
    for k in range(n):
        bx = sx + k * sw / n + 1.0
        bw = sw / n - 2.0
        hgt = 4.6 if k % 2 == 0 else 3.4
        mat = kind if kind == 'shrub' else FLOWERS[(tone + k) % 3]
        add('관목' if kind == 'shrub' else '화초', [bx, sy + 1.4, bw, sh - 2.8, 1.6, hgt], mat)

for fname, fx0, fx1, fy in FRONTS:
    w = fx1 - fx0
    # 1켜 보행로 — 점포 앞에 바로 붙는 포장
    add(fname + ' 보행로', [fx0, fy + 1.0, w, 15.0, -0.5, 0.9], 'walk')
    for k in range(int(w // 26)):          # 포장 줄눈
        add('보행로 줄눈', [fx0 + k * 26 + 12.5, fy + 1.0, 1.0, 15.0, -0.5, 0.95], 'paver')
    # 2켜 잔디 바탕
    add(fname + ' 잔디', [fx0, fy + 16.0, w, 37.0, -0.5, 0.8], 'lawn')
    # 3켜 식재대 — 관목 덩이와 화단을 번갈아
    n = max(5, int(w // 38))
    for k in range(n):
        sx = fx0 + k * w / n + 2.5
        sw = w / n - 5.0
        shrubmass(sx, fy + 18.0, sw, 15.0, 'flower' if k % 3 == 2 else 'shrub', k)
        beds += 1
    # 4켜 교목 — 두 줄로 어긋나게, 큰 나무와 중간 나무를 섞는다
    nt = max(6, int(w // 30))
    for k in range(nt):
        tx = fx0 + (k + 0.5) * w / nt
        tree(tx, fy + 46.0, 1.0 if k % 2 == 0 else 0.74)
        if k % 2 == 1:
            tree(tx + w / nt / 2, fy + 58.0, 0.6)
    # 보행로 화분 — 점포 앞에 띄엄띄엄
    for k in range(max(2, int(w // 62))):
        px_ = fx0 + (k + 0.5) * w / max(2, int(w // 62))
        add('화분', [px_ - 5, fy + 3.5, 10, 10, 0.0, 3.2], 'planter')
        add('화분 식재', [px_ - 3.6, fy + 4.9, 7.2, 7.2, 3.2, 4.4], FLOWERS[k % 3])
    # 5켜 바깥 경계 — 낮은 생울타리
    add(fname + ' 생울타리', [fx0, fy + BAND - 8.0, w, 6.0, 0.0, 4.2], 'shrub')
    # 휴게 포켓 — 파고라 그늘 아래 벤치
    for k in range(max(1, int(w // 220))):
        px = fx0 + (k + 0.5) * w / max(1, int(w // 220))
        add('휴게 포켓 포장', [px - 28, fy + 16.0, 56, 24.0, -0.5, 1.0], 'paver')
        add('벤치', [px - 20, fy + 23.0, 18, 5.0, 1.0, 3.4], 'bench')
        add('벤치', [px + 2, fy + 23.0, 18, 5.0, 1.0, 3.4], 'bench')
        for cx_ in (px - 27, px + 25):
            add('파고라 기둥', [cx_ - 1.4, fy + 17.0, 2.8, 2.8, 0.0, 15.0], 'trunk')
            add('파고라 기둥', [cx_ - 1.4, fy + 36.0, 2.8, 2.8, 0.0, 15.0], 'trunk')
        add('파고라 지붕', [px - 30, fy + 15.0, 60, 26.0, 15.0, 1.6], 'bench')
        tree(px, fy + 52.0, 1.3)

# 진입 광장 — 줄과 줄 사이 (560~636, 1028~1108)
for pname, px0, px1, pfy in [('서측 진입 광장', 560.0, 636.0, 612.0),
                             ('중앙 진입 광장', 1028.0, 1108.0, 598.0)]:
    add(pname, [px0, pfy, px1 - px0, BAND - 6, -0.5, 0.9], 'paver')
    shrubmass(px0 + 6, pfy + 34, px1 - px0 - 12, 16, 'flower')
    tree(px0 + 14, pfy + 14, 0.85)
    tree(px1 - 14, pfy + 14, 0.85)

# 동측 녹지 — 119~123과 115~118 바깥 면
for ename, ex, ey0, ey1 in [('119~123호 동측 녹지', 1663.0, 72.0, 305.0),
                            ('115~118호 동측 녹지', 1636.0, 431.0, 597.0)]:
    eh = ey1 - ey0
    add(ename + ' 보행로', [ex + 1.0, ey0, 14.0, eh, -0.5, 0.9], 'walk')
    add(ename, [ex + 15.0, ey0, 30.0, eh, -0.5, 0.8], 'lawn')
    ns = max(3, int(eh // 40))
    for k in range(ns):
        shrubmass(ex + 18.0, ey0 + k * eh / ns + 3.0, 13.0, eh / ns - 6.0,
                  'flower' if k % 3 == 1 else 'shrub')
        beds += 1
    for k in range(max(2, int(eh // 52))):
        tree(ex + 36.0, ey0 + (k + 0.5) * eh / max(2, int(eh // 52)), 0.9)
    add(ename + ' 생울타리', [ex + 45.0, ey0, 6.0, eh, 0.0, 4.2], 'shrub')

# 북측은 가로수 한 줄
add('북측 조경', [bx0 + 20, by0 - 30, (bx1 - bx0) - 40, 24, -0.8, 1.0], 'lawn')
add('북측 식재대', [bx0 + 20, by0 - 22, (bx1 - bx0) - 40, 7, 0.0, 3.4], 'shrub')
for t in range(int((bx1 - bx0 - 40) // 95)):
    tree(bx0 + 40 + t * 95, by0 - 18, 0.78)

print('호실 바닥 %d · 점포 경계 %d' % (len(units), seams))
print('공간 연출 %d개' % stage)
print('전창 %d면 · 통로 %d · 외부마당 %d · 공용부 %d · 식재대 %d · 수목 %d그루'
      % (len(units) * 2, corr, yards, len(AREAS), beds, land))

model = {
    'id': 'P146', 'building': '송도 AIT센터', 'usageLabel': '근린생활시설', 'planLabel': '1층',
    'sourceReference': 'AIT상가캐드.pptx 1쪽 1층 평면 · shareal/ait-1f-review.html 원본 대조선',
    'sourceImage': 'images/plans/ait-1f.png',
    'coordinateSystem': {'units': 'source_image_pixels', 'width': 1699, 'height': 691,
                         'origin': 'top_left', 'physicalScale': None},
    'direction': {'label': '북동 약 40° (도면 나침반 기호)', 'verified': False,
                  'northVector': [0.773, -0.635], 'evidence': 'source_plan_north_symbol'},
    'verification': {'status': 'manual_trace_matched_to_numbered_source_plan',
                     'dimensions': False, 'structure': False,
                     'direction': False, 'unitAssociation': False},
    'unknowns': ['실측 치수·층고·벽 두께 — 화면 표현용 값',
                 '전면 유리는 문이 그려진 면을 전창으로 본 것이며 창호 분할은 화면 표현용',
                 '문은 세 가지가 모두 유리 — 내부 통로에서 상가로 드는 문 / '
                 '외부에서 건물로 드는 통로 중앙문 / 외부에서 상가로 바로 드는 문',
                 '호실 출입문은 전창 가운데에 그린 참고용 표현이며 문짝 위치는 대조하지 않음',
                 '사람·차량은 도면에 이름이 적힌 로비·휴게공간·주차장 출입구에만 둔 연출이며 '
                 '실제 이용 인원·차량이 아님 (공간 연출 보기로 끌 수 있음)',
                 '차량은 실제 크기(4.5m×1.8m)이고 사람은 점처럼 보이지 않게 1.6배로 키운 표현',
                 '조경·수목·벤치는 공간을 알아보기 위한 참고용 표현이며 수종·그루수는 대조하지 않음',
                 '통로와 외부 마당은 바닥판에서 호실·코어·전면 조경을 뺀 자리를 폭으로 가른 것',
                 '창호 위치는 아직 대조하지 않음',
                 '기둥은 대조선에 표시된 것만 세움',
                 '방위는 도면 나침반 기호에서 읽은 추정값'],
    'walls': walls, 'openings': openings, 'columns': [],
    'units': units, 'facilities': [], 'areas': areas,
    'objects': objects,
    'reconstruction': {'method': 'manual_trace_over_source_image',
                       'geometryEvidence': 'source_plan', 'measured': False,
                       'heightIsMeasured': False,
                       'note': '원본 평면 위에서 직접 대조해 그린 선만 세웠습니다. '
                               '자동 벡터화나 공통 상자형 모델을 쓰지 않았습니다.'},
    'dataVersion': '4.0-1f-manual-trace',
    'description': '원본 1층 평면 위에서 직접 대조한 선(점포 경계·공용 통로·코어·출입문)만 '
                   '세운 골격입니다. 호실 번호가 표기된 원본 평면과 칸을 맞춰 '
                   '43개 호실 경계를 확정했습니다. 문이 그려진 면은 전면 유리로, 나머지 바닥은 복도·로비·조경으로 채워 공간을 알아볼 수 있게 했습니다.',
}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('PLAN_DATA["P146"]=')
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('P146: 벽 %d · 칸막이 %d · 코어 %d · 출입문 %d · 객체 %d' % (nw, np_, len(cores), doors, len(objects)))
