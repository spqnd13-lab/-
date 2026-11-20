"""AIT센터 1·2층 근린생활시설 3D 모형을 만든다.

도면에서 읽은 것      : 호실 번호·위치·구획, 공부 전용/공급면적, 공용시설 위치, 방위(나침반 기호)
공간을 알아보기 위한 표현 : 점포 전면 유리·출입문, 보행 통로, 휴게·조경, 벽 높이·두께
계약현황(입점확정·편의점 등 영업 정보)은 넣지 않는다.

사용: python3 tools/plan3d_ait_lowfloor.py <작업폴더>
"""
import json, os, re, sys

WORK = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'shareal', '3d', 'model-scripts')

C = {'wall': '#e9e4da', 'floor': '#dfc9a7', 'tile': '#9dabae', 'glass': '#9ec8d3',
     'door': '#aa8061', 'fixture': '#f3f6f3', 'plant': '#7f9e72', 'trunk': '#8a7257',
     'bench': '#c8b89a', 'path': '#cdc6b8', 'shaft': '#b8b5ad'}

WALL_T, WALL_H, FLOOR_H = 2.2, 22.0, 2.0
GLASS_SILL, GLASS_TOP = 2.0, 19.0

NORTH = {'label': '북동 약 40° (도면 나침반 기호)', 'verified': False,
         'northVector': [0.773, -0.635], 'evidence': 'source_plan_north_symbol'}

PLANS = {1: dict(id='P146', planLabel='1층', image='AIT_1층_원본도면.png'),
         2: dict(id='P147', planLabel='2층', image='AIT_2층_원본도면.png')}


def clusters(rects, gap=64):
    """가까이 붙어 있는 호실끼리 한 덩어리(동·구역)로 묶는다."""
    groups = []
    for i, r in enumerate(rects):
        hit = [g for g in groups
               if any(r[0] < rects[j][0] + rects[j][2] + gap and r[0] + r[2] + gap > rects[j][0] and
                      r[1] < rects[j][1] + rects[j][3] + gap and r[1] + r[3] + gap > rects[j][1]
                      for j in g)]
        if not hit:
            groups.append([i])
        else:
            merged = [i]
            for g in hit:
                merged += g
                groups.remove(g)
            groups.append(merged)
    return groups


def bbox(rs, pad=0):
    return [min(r[0] for r in rs) - pad, min(r[1] for r in rs) - pad,
            max(r[0] + r[2] for r in rs) - min(r[0] for r in rs) + 2 * pad,
            max(r[1] + r[3] for r in rs) - min(r[1] for r in rs) + 2 * pad]


def build(floor):
    src = json.load(open(os.path.join(WORK, 'rooms%d.json' % floor), encoding='utf-8'))
    meta = PLANS[floor]
    W, H = src['size']
    k = src.get('scaleM2PerPx2')
    objects, units, n = [], [], 0

    def add(name, box, material, semantic=None):
        nonlocal n
        n += 1
        objects.append({'id': '%s-%d' % (meta['id'], n), 'name': name,
                        'box': [round(float(v), 2) for v in box],
                        'material': material, 'color': C[material],
                        'semantic': semantic or material})

    # ── 호실 구획 보정 (공부 면적과 20% 넘게 어긋난 것) ─────────────────
    good = [u for u in src['units'] if u.get('rect') and u.get('fit') and 0.8 <= u['fit'] <= 1.2]
    for u in src['units']:
        if not (u.get('rect') and u.get('fit') and k and u.get('exclusive')) or 0.8 <= u['fit'] <= 1.2:
            continue
        x, y, w, h = u['rect']
        lx, ly = u['x'] + u['w'] / 2, u['y'] + u['h'] / 2
        row = [g for g in good if g['rect'][1] <= y + h / 2 <= g['rect'][1] + g['rect'][3]]
        if len(row) >= 2:
            depth = sorted(g['rect'][3] for g in row)[len(row) // 2]
            top = sorted(g['rect'][1] for g in row)[len(row) // 2]
            width = (u['exclusive'] / k) / depth
            u['rect'] = [round(lx - width / 2, 1), round(top, 1), round(width, 1), round(depth, 1)]
        else:
            col = [g for g in good if g['rect'][0] <= lx <= g['rect'][0] + g['rect'][2]]
            if len(col) < 2:
                continue
            width = sorted(g['rect'][2] for g in col)[len(col) // 2]
            left = sorted(g['rect'][0] for g in col)[len(col) // 2]
            depth = (u['exclusive'] / k) / width
            u['rect'] = [round(left, 1), round(ly - depth / 2, 1), round(width, 1), round(depth, 1)]
        u['fit'] = 1.0
        u['corrected'] = True

    placed = [u for u in src['units'] if u.get('rect')]
    rects = [u['rect'] for u in placed]
    groups = clusters(rects)
    groups.sort(key=lambda g: -len(g))

    # ── 구역별 바닥판 + 둘레 보행 통로 ──────────────────────────────────
    plates = []
    for gi, g in enumerate(groups):
        pb = bbox([rects[i] for i in g], pad=13)
        plates.append(pb)
        add('%d층 바닥' % floor, [pb[0], pb[1], pb[2], pb[3], -1.4, 1.4], 'tile', 'floor')

    # 구역 사이를 잇는 보행 통로 (표현용)
    for a in range(len(plates)):
        for b in range(a + 1, len(plates)):
            pa, pb = plates[a], plates[b]
            ax, ay = pa[0] + pa[2] / 2, pa[1] + pa[3] / 2
            bx, by = pb[0] + pb[2] / 2, pb[1] + pb[3] / 2
            if abs(ax - bx) > abs(ay - by):
                x0, x1 = sorted((pa[0] + pa[2], pb[0])) if ax < bx else sorted((pb[0] + pb[2], pa[0]))
                if x1 - x0 < 6 or x1 - x0 > 420:
                    continue
                add('보행 통로 (표현용)', [x0, (ay + by) / 2 - 17, x1 - x0, 34, -1.2, 1.2], 'path', 'floor')
            else:
                y0, y1 = sorted((pa[1] + pa[3], pb[1])) if ay < by else sorted((pb[1] + pb[3], pa[1]))
                if y1 - y0 < 6 or y1 - y0 > 420:
                    continue
                add('보행 통로 (표현용)', [(ax + bx) / 2 - 17, y0, 34, y1 - y0, -1.2, 1.2], 'path', 'floor')

    # ── 호실: 바닥·벽·전면 유리·출입문 ──────────────────────────────────
    for u in placed:
        x, y, w, h = u['rect']
        label = u['label']
        gi = next(i for i, g in enumerate(groups) if rects.index(u['rect']) in g) \
            if u['rect'] in rects else 0
        pb = plates[gi]
        cx, cy = x + w / 2, y + h / 2
        px, py = pb[0] + pb[2] / 2, pb[1] + pb[3] / 2
        # 구역 중심에서 먼 쪽 = 바깥(전면)
        front = ('S' if cy >= py else 'N') if abs(cy - py) * 1.25 > abs(cx - px) else ('E' if cx >= px else 'W')

        add('%s 바닥' % label, [x, y, w, h, 0.0, FLOOR_H], 'floor')
        sides = {'N': [x, y, w, WALL_T], 'S': [x, y + h - WALL_T, w, WALL_T],
                 'W': [x, y, WALL_T, h], 'E': [x + w - WALL_T, y, WALL_T, h]}
        names = {'N': '북측', 'S': '남측', 'W': '서측', 'E': '동측'}
        for s, box in sides.items():
            if s == front:
                continue
            add('%s %s 벽' % (label, names[s]), box + [0.0, WALL_H], 'wall')
        # 전면: 아래 허리벽 + 유리 + 출입문 (표현용)
        fb = sides[front]
        add('%s 전면 하부 (표현용)' % label, fb + [0.0, GLASS_SILL], 'wall')
        add('%s 전면 유리 (표현용)' % label, fb + [GLASS_SILL, GLASS_TOP - GLASS_SILL], 'glass')
        add('%s 전면 상부 (표현용)' % label, fb + [GLASS_TOP, WALL_H - GLASS_TOP], 'wall')
        dw = min(11.0, (w if front in 'NS' else h) * 0.42)
        if front in 'NS':
            add('%s 출입문 (표현용)' % label, [cx - dw / 2, fb[1] - 0.6, dw, WALL_T + 1.2, 0.0, 15.0], 'door')
        else:
            add('%s 출입문 (표현용)' % label, [fb[0] - 0.6, cy - dw / 2, WALL_T + 1.2, dw, 0.0, 15.0], 'door')

        unit = {'id': label, 'label': label, 'usage': '근린생활시설',
                'rect': [x, y, w, h], 'rectEncoding': 'xywh', 'clickTarget': [x, y, w, h],
                'evidence': 'source_plan_label_position_and_region'}
        if u.get('exclusive'):
            unit['exclusiveAreaM2'] = u['exclusive']
        if u.get('supply'):
            unit['supplyAreaM2'] = u['supply']
        if u.get('corrected'):
            unit['boundaryCorrectedByArea'] = True
        units.append(unit)

    # ── 공용시설 (도면 표기 위치) ───────────────────────────────────────
    INSIDE = re.compile(r'출입구|로비|경비실|택배|회의실|주차장')
    facilities = []
    for c in src.get('common', []):
        facilities.append({'name': c['text'], 'rect': [c['x'], c['y'], c['w'], c['h']],
                           'rectEncoding': 'xywh', 'evidence': 'source_plan_label'})
        if not INSIDE.search(c['text']) or not (6 <= c['w'] <= 170 and 6 <= c['h'] <= 95):
            continue
        if not any(p[0] - 30 <= c['x'] <= p[0] + p[2] + 30 and p[1] - 30 <= c['y'] <= p[1] + p[3] + 30
                   for p in plates):
            continue
        tall = 16.0 if '출입구' in c['text'] else 5.0
        add(c['text'], [c['x'], c['y'], c['w'], c['h'], 0.0, tall],
            'shaft' if '출입구' in c['text'] else 'fixture')

    # ── 휴게·조경 (표현용) — 구역 바깥 여백에 놓는다 ────────────────────
    rest = 0
    for pb in plates:
        if pb[2] < 150 or pb[3] < 60:
            continue
        for sx, sy, sw, sh in ((pb[0] + 10, pb[1] + pb[3] + 8, min(150, pb[2] * 0.4), 42),
                               (pb[0] + pb[2] - min(150, pb[2] * 0.4) - 10, pb[1] - 50,
                                min(150, pb[2] * 0.4), 42)):
            if sw < 70:
                continue
            rest += 1
            add('휴게·조경 공간 (표현용)', [sx, sy, sw, sh, -1.2, 1.2], 'path', 'floor')
            # 식재 화단 + 나무 + 벤치
            for t in range(3):
                tx = sx + 14 + t * (sw - 28) / 2
                add('화단 (표현용)', [tx - 9, sy + 6, 18, 18, 0.0, 3.0], 'plant')
                add('수목 (표현용)', [tx - 1.6, sy + 13, 3.2, 3.2, 3.0, 13.0], 'trunk')
                add('수목 (표현용)', [tx - 8, sy + 7, 16, 16, 16.0, 9.0], 'plant')
            add('벤치 (표현용)', [sx + 12, sy + sh - 13, sw - 24, 6, 0.0, 5.0], 'bench')

    review = [u['label'] for u in units if u.get('boundaryCorrectedByArea')]
    model = {
        'id': meta['id'], 'building': '송도 AIT센터',
        'usageLabel': '근린생활시설', 'planLabel': meta['planLabel'],
        'sourceReference': 'AIT근린상가 첨부 평면도 (파워포인트 원본 CAD)',
        'sourceImage': 'originals/%s' % meta['image'],
        'coordinateSystem': {'units': 'source_image_pixels', 'width': W, 'height': H,
                             'origin': 'top_left', 'physicalScale': None,
                             'areaFittedM2PerPx2': k},
        'direction': NORTH,
        'verification': {'status': 'source_interpreted_from_plan_and_area_table',
                         'dimensions': False, 'structure': False,
                         'direction': False, 'unitAssociation': False},
        'unknowns': ['실측 치수·층고·벽 두께',
                     '점포 전면 유리·출입문·보행 통로·휴게·조경은 공간을 알아보기 위한 표현이며 도면에서 읽은 위치가 아님',
                     '기둥·내부 칸막이는 아직 넣지 않음',
                     '현행 합호·칸막이 변경 여부'] +
                    (['구획을 공부 면적에 맞춰 보정한 호실: %s' % ', '.join(review)] if review else []) +
                    ['방위는 도면 나침반 기호에서 읽은 추정값'],
        'walls': [], 'openings': [], 'columns': [],
        'units': units, 'facilities': facilities, 'objects': objects,
        'reconstruction': {'method': 'plan_region_segmentation_with_area_fit',
                           'geometryEvidence': 'source_plan', 'measured': False,
                           'heightIsMeasured': False, 'scope': 'floor_units_and_display_context'},
        'dataVersion': '2.1-lowfloor-context',
        'description': '원본 %s 평면도에서 근린생활시설 호실 구획을 읽어 세웠습니다. '
                       '호실을 누르면 해당 구간을 확대합니다. 점포 전면 유리·출입문과 '
                       '보행 통로·휴게·조경은 공간을 알아보기 쉽도록 넣은 표현입니다.' % meta['planLabel'],
    }
    with open(os.path.join(OUT, '%s.js' % meta['id']), 'w', encoding='utf-8') as f:
        f.write('PLAN_DATA["%s"]=' % meta['id'])
        json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('%s: 호실 %d · 구역 %d · 객체 %d · 휴게조경 %d · 보정 %s'
          % (meta['id'], len(units), len(plates), len(objects), rest, ', '.join(review) or '없음'))


for fl in (1, 2):
    build(fl)
