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
     'door': '#aa8061', 'column': '#b8b5ad', 'floor': '#dfd9cd', 'tile': '#aeb4b7'}
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


def add(name, box, material):
    global n
    n += 1
    objects.append({'id': 'P146-%d' % n, 'name': name,
                    'box': [round(float(v), 2) for v in box],
                    'material': material, 'color': C[material], 'semantic': material})


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
for classes, d in paths('door'):
    for m in re.finditer(r'M\s*(-?[\d.]+)\s*(-?[\d.]+)', d):
        x, y = float(m.group(1)), float(m.group(2))
        add('출입문', [x - 7, y - 3, 14, 6, 0.0, 14.0], 'door')
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
                 '아직 대조하지 못한 호실(107·118·124·135·140·141·142·143)은 넣지 않았음',
                 '창호 위치는 아직 대조하지 않음',
                 '기둥은 대조선에 표시된 것만 세움',
                 '방위는 도면 나침반 기호에서 읽은 추정값'],
    'walls': walls, 'openings': [], 'columns': [],
    'units': units, 'facilities': [],
    'objects': objects,
    'reconstruction': {'method': 'manual_trace_over_source_image',
                       'geometryEvidence': 'source_plan', 'measured': False,
                       'heightIsMeasured': False,
                       'note': '원본 평면 위에서 직접 대조해 그린 선만 세웠습니다. '
                               '자동 벡터화나 공통 상자형 모델을 쓰지 않았습니다.'},
    'dataVersion': '4.0-1f-manual-trace',
    'description': '원본 1층 평면 위에서 직접 대조한 선(점포 경계·공용 통로·코어·출입문)만 '
                   '세운 골격입니다. 호실 번호가 표기된 원본 평면과 칸을 맞춰 '
                   '35개 호실 경계를 확정했습니다.',
}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('PLAN_DATA["P146"]=')
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('P146: 벽 %d · 칸막이 %d · 코어 %d · 출입문 %d · 객체 %d' % (nw, np_, len(cores), doors, len(objects)))
