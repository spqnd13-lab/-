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

# 현장 사진(2026-11-20 촬영) 기준 마감 색
# 외장 흰색 알루미늄 복합패널 / 청록 유리 + 검은 멀리언 / 회색 보도블록
C = {'wall': '#eceae5', 'floor': '#d8d4cc', 'tile': '#a7adb0', 'glass': '#5f8f96',
     'door': '#cfd3d4', 'fixture': '#f1f2f0', 'plant': '#5f7d58', 'trunk': '#7d6b57',
     'bench': '#b9b3a7', 'path': '#b6bbbd', 'shaft': '#dcdad5',
     'sign': '#e4e2dd', 'counter': '#c9c4b8', 'seat': '#d5d1c7', 'light': '#fbf7ec',
     'canopy': '#e8e6e1', 'stall': '#b0b6b8', 'curb': '#9ba1a3',
     'mullion': '#2f3438', 'panel': '#e6e3dd', 'column': '#e8e5e0',
     'hedge': '#557250', 'tactile': '#cfae4e', 'paving': '#9ea4a6'}

# 간판 띠는 실제로는 작고 차분함 — 패널 색에서 아주 조금만 변주
SIGN = ['#e4e2dd', '#dedbd4', '#e7e5e0', '#dcd9d2']

WALL_T, WALL_H, FLOOR_H = 2.2, 22.0, 2.0
GLASS_SILL, GLASS_TOP = 2.0, 19.0

NORTH = {'label': '북동 약 40° (도면 나침반 기호)', 'verified': False,
         'northVector': [0.773, -0.635], 'evidence': 'source_plan_north_symbol'}

# 대표님이 현장에서 확인해 알려 주신 입점 업체 (손님이 위치를 가늠하는 기준점)
TENANTS = {'101': 'CU 편의점'}

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

    # ── 두 점포가 한 구획으로 합쳐진 경우 갈라 준다 ─────────────────
    # (칸막이 선이 얇아 영역 분할이 하나로 묶은 경우. 그대로 두면 뒤 호실이
    #  앞 호실에 완전히 가려 화면에서 사라진다.)
    groups_same = {}
    for u in src['units']:
        if u.get('rect'):
            groups_same.setdefault(tuple(u['rect']), []).append(u)
    for rect, members in groups_same.items():
        if len(members) < 2:
            continue
        x, y, w, h = rect
        xs = [m['x'] + m['w'] / 2 for m in members]
        ys = [m['y'] + m['h'] / 2 for m in members]
        # 호실 표기가 더 넓게 퍼진 쪽으로 가른다. 구분이 안 되면 긴 변 기준.
        along_x = (max(xs) - min(xs)) >= (max(ys) - min(ys)) if max(xs) - min(xs) != max(ys) - min(ys) else w >= h
        members.sort(key=lambda m: (m['x'] if along_x else m['y']))
        areas = [m.get('exclusive') or 0 for m in members]
        total = sum(areas)
        shares = [a / total for a in areas] if total else [1 / len(members)] * len(members)
        run = w if along_x else h
        at = x if along_x else y
        for m, sh in zip(members, shares):
            size = run * sh
            m['rect'] = [round(at, 1), y, round(size, 1), h] if along_x else [x, round(at, 1), w, round(size, 1)]
            m['splitFromMerged'] = True
            at += size

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
        # 전면: 청록 유리 커튼월 + 검은 멀리언 격자 (현장 사진 기준)
        fb = sides[front]
        add('%s 전면 하부 (참고용)' % label, fb + [0.0, GLASS_SILL], 'panel')
        add('%s 전면 유리 (참고용)' % label, fb + [GLASS_SILL, GLASS_TOP - GLASS_SILL], 'glass')
        add('%s 전면 상부 패널 (참고용)' % label, fb + [GLASS_TOP, WALL_H - GLASS_TOP], 'panel')
        run = fb[2] if front in 'NS' else fb[3]
        bays = max(2, int(run // 13))
        for bi in range(bays + 1):
            f = bi / bays
            if front in 'NS':
                add('%s 창틀 (참고용)' % label,
                    [fb[0] + f * fb[2] - 0.7, fb[1] - 0.35, 1.4, fb[3] + 0.7, GLASS_SILL, GLASS_TOP - GLASS_SILL], 'mullion')
            else:
                add('%s 창틀 (참고용)' % label,
                    [fb[0] - 0.35, fb[1] + f * fb[3] - 0.7, fb[2] + 0.7, 1.4, GLASS_SILL, GLASS_TOP - GLASS_SILL], 'mullion')
        # 유리 상·하 가로 프레임
        for zz in (GLASS_SILL - 0.6, GLASS_TOP - 0.6):
            add('%s 창틀 (참고용)' % label,
                [fb[0] - 0.35, fb[1] - 0.35, fb[2] + 0.7, fb[3] + 0.7, zz, 1.2], 'mullion')
        # 2층 바닥 캔틸레버 띠 (현장 사진의 수평 돌출)
        if front in 'NS':
            add('%s 상부 캔틸레버 (참고용)' % label,
                [fb[0] - 1, fb[1] - 4.5, fb[2] + 2, fb[3] + 6, WALL_H, 3.2], 'panel')
        else:
            add('%s 상부 캔틸레버 (참고용)' % label,
                [fb[0] - 4.5, fb[1] - 1, fb[2] + 6, fb[3] + 2, WALL_H, 3.2], 'panel')
        dw = min(11.0, (w if front in 'NS' else h) * 0.42)
        if front in 'NS':
            add('%s 출입문 (표현용)' % label, [cx - dw / 2, fb[1] - 0.6, dw, WALL_T + 1.2, 0.0, 15.0], 'door')
        else:
            add('%s 출입문 (표현용)' % label, [fb[0] - 0.6, cy - dw / 2, WALL_T + 1.2, dw, 0.0, 15.0], 'door')

        # 간판 — 현장은 크지 않아 출입문 옆 작은 사인으로
        sgw = min(14.0, (fb[2] if front in 'NS' else fb[3]) * 0.3)
        if front in 'NS':
            add('%s 간판 (참고용)' % label,
                [cx + (6 if front == 'S' else -6) - sgw / 2, fb[1] - 0.5, sgw, fb[3] + 1.0,
                 GLASS_TOP - 3.4, 2.8], 'sign')
        else:
            add('%s 간판 (참고용)' % label,
                [fb[0] - 0.5, cy + 6 - sgw / 2, fb[2] + 1.0, sgw, GLASS_TOP - 3.4, 2.8], 'sign')
        objects[-1]['color'] = SIGN[len(units) % len(SIGN)]

        # 전면 모서리 필로티 기둥 (현장 사진의 흰 패널 각기둥)
        for f in (0.0, 1.0):
            if front in 'NS':
                px_ = x + f * w - 3.2
                py_ = fb[1] + (3.0 if front == 'S' else -6.2)
            else:
                px_ = fb[0] + (3.0 if front == 'E' else -6.2)
                py_ = y + f * h - 3.2
            add('기둥 (참고용)', [px_, py_, 6.4, 6.4, 0.0, WALL_H + 3.2], 'column')

        # 실내 집기 — 참고용 표현
        inset = WALL_T + 2.5
        if w > 34 and h > 22:
            if w >= h:
                add('%s 카운터 (참고용)' % label, [x + inset, y + inset, min(26, w * 0.3), 7, 0.0, 9.0], 'counter')
                for si in range(max(1, int((w - 2 * inset) // 30))):
                    add('%s 좌석 (참고용)' % label,
                        [x + inset + 32 + si * 30, y + h / 2 - 6, 16, 12, 0.0, 6.0], 'seat')
            else:
                add('%s 카운터 (참고용)' % label, [x + inset, y + inset, 7, min(26, h * 0.3), 0.0, 9.0], 'counter')
                for si in range(max(1, int((h - 2 * inset) // 30))):
                    add('%s 좌석 (참고용)' % label,
                        [x + w / 2 - 6, y + inset + 32 + si * 30, 12, 16, 0.0, 6.0], 'seat')

        tenant = TENANTS.get(label)
        if tenant:
            # 입점 업체 간판은 조금 크게 (길 찾는 기준점)
            objects[-1]['name'] = '%s %s 간판' % (label, tenant)

        unit = {'id': label, 'label': label, 'usage': '근린생활시설',
                'rect': [x, y, w, h], 'rectEncoding': 'xywh', 'clickTarget': [x, y, w, h],
                'evidence': 'source_plan_label_position_and_region'}
        if u.get('exclusive'):
            unit['exclusiveAreaM2'] = u['exclusive']
        if u.get('supply'):
            unit['supplyAreaM2'] = u['supply']
        if u.get('corrected'):
            unit['boundaryCorrectedByArea'] = True
        if u.get('splitFromMerged'):
            unit['boundarySplitByArea'] = True
        if tenant:
            unit['tenant'] = tenant
            unit['tenantEvidence'] = 'confirmed_on_site'
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

    # ── 복도·조경·가로시설 (참고용 표현) ───────────────────────────────
    rest = 0
    for pi, pb in enumerate(plates):
        px0, py0, pw, ph = pb
        wide = pw >= ph

        # 바닥 포장 띠 (복도 느낌)
        if wide and pw > 120:
            add('보도 포장 (참고용)', [px0 + 6, py0 + ph / 2 - 11, pw - 12, 22, -1.1, 0.5], 'path', 'floor')
        elif not wide and ph > 120:
            add('보도 포장 (참고용)', [px0 + pw / 2 - 11, py0 + 6, 22, ph - 12, -1.1, 0.5], 'path', 'floor')

        # 천장 조명 라인
        if wide and pw > 140:
            add('조명 (참고용)', [px0 + 14, py0 + ph / 2 - 1.6, pw - 28, 3.2, 26.0, 1.4], 'light')
        elif not wide and ph > 140:
            add('조명 (참고용)', [px0 + pw / 2 - 1.6, py0 + 14, 3.2, ph - 28, 26.0, 1.4], 'light')

        # 바깥 둘레 조경 띠 + 가로수 + 벤치
        for side in ('N', 'S') if wide else ('W', 'E'):
            if side == 'N':
                sx, sy, sw, sh = px0 + 8, py0 - 34, pw - 16, 26
            elif side == 'S':
                sx, sy, sw, sh = px0 + 8, py0 + ph + 8, pw - 16, 26
            elif side == 'W':
                sx, sy, sw, sh = px0 - 34, py0 + 8, 26, ph - 16
            else:
                sx, sy, sw, sh = px0 + pw + 8, py0 + 8, 26, ph - 16
            if sw < 46 or sh < 16:
                continue
            rest += 1
            add('보행·조경 (참고용)', [sx, sy, sw, sh, -1.1, 1.1], 'path', 'floor')
            # 낮은 생울타리 띠 (현장 사진의 관목)
            add('생울타리 (참고용)',
                [sx, sy, sw, 5.0, 0.0, 4.2] if sw > sh else [sx, sy, 5.0, sh, 0.0, 4.2], 'hedge')
            # 보도 점자블록 띠
            add('점자블록 (참고용)',
                [sx, sy + sh - 3.0, sw, 3.0, -1.0, 0.6] if sw > sh
                else [sx + sw - 3.0, sy, 3.0, sh, -1.0, 0.6], 'tactile')
            run = max(sw, sh)
            count = max(2, int(run // 52))
            for t in range(count):
                f = (t + 0.5) / count
                tx = sx + (sw * f if sw > sh else sw / 2)
                ty = sy + (sh / 2 if sw > sh else sh * f)
                add('수목 (참고용)', [tx - 1.4, ty - 1.4, 2.8, 2.8, 0.0, 13.0], 'trunk')
                add('수목 (참고용)', [tx - 6, ty - 6, 12, 12, 13.0, 6.5], 'plant')
                add('수목 (참고용)', [tx - 3.5, ty - 3.5, 7, 7, 19.5, 4.0], 'plant')
                if t % 2 == 0:
                    if sw > sh:
                        add('벤치 (참고용)', [tx - 13, ty + 9, 26, 5, 0.0, 4.4], 'bench')
                    else:
                        add('벤치 (참고용)', [tx + 9, ty - 13, 5, 26, 0.0, 4.4], 'bench')

    # 주출입구·부출입구에 캐노피
    for c in src.get('common', []):
        if '출입구' not in c['text'] or '주차장' in c['text']:
            continue
        if not any(p[0] - 40 <= c['x'] <= p[0] + p[2] + 40 and p[1] - 40 <= c['y'] <= p[1] + p[3] + 40
                   for p in plates):
            continue
        add('%s 캐노피 (참고용)' % c['text'],
            [c['x'] - 8, c['y'] - 8, max(c['w'], 40) + 16, max(c['h'], 26) + 16, 24.0, 2.2], 'canopy')

    review = [u['label'] for u in units if u.get('boundaryCorrectedByArea')]
    split = [u['label'] for u in units if u.get('boundarySplitByArea')]
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
                     '공용부(복도·로비·조경·가로시설)와 점포 전면·간판·실내 집기는 참고용 표현이며 현장과 다를 수 있음',
                     '기둥·내부 칸막이는 아직 넣지 않음',
                     '현행 합호·칸막이 변경 여부'] +
                    (['구획을 공부 면적에 맞춰 보정한 호실: %s' % ', '.join(review)] if review else []) +
                    (['도면에서 한 칸으로 읽혀 면적 비율로 나눈 호실: %s' % ', '.join(split)] if split else []) +
                    ['방위는 도면 나침반 기호에서 읽은 추정값'],
        'walls': [], 'openings': [], 'columns': [],
        'units': units, 'facilities': facilities, 'objects': objects,
        'reconstruction': {'method': 'plan_region_segmentation_with_area_fit',
                           'geometryEvidence': 'source_plan', 'measured': False,
                           'heightIsMeasured': False, 'scope': 'floor_units_and_display_context'},
        'dataVersion': '2.1-lowfloor-context',
        'description': '원본 %s 평면도에서 근린생활시설 호실 구획을 읽어 세웠습니다. '
                       '호실을 누르면 해당 구간을 확대합니다. 점포 전면 유리·출입문과 '
                       '복도·조경·간판·집기는 공간을 그려 보기 위한 참고용 표현이라 '
                       '현장과 다를 수 있습니다.' % meta['planLabel'],
    }
    with open(os.path.join(OUT, '%s.js' % meta['id']), 'w', encoding='utf-8') as f:
        f.write('PLAN_DATA["%s"]=' % meta['id'])
        json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('%s: 호실 %d · 구역 %d · 객체 %d · 보정 %s · 분할 %s'
          % (meta['id'], len(units), len(plates), len(objects),
             ', '.join(review) or '없음', ', '.join(split) or '없음'))


for fl in (1, 2):
    build(fl)
