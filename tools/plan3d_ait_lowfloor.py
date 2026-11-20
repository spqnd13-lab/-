"""AIT센터 1·2층 근린생활시설 3D 모형을 만든다.

입력: 작업 폴더의 rooms1.json / rooms2.json
      (파워포인트에서 뽑은 호실 번호·전용/공급 면적·위치 + 도면에서 따낸 호실 영역)
출력: shareal/3d/model-scripts/<도면번호>.js

계약현황(입점확정·편의점 등 영업 정보)은 넣지 않는다.
치수는 실측이 아니며, 공부 전용면적으로 맞춘 축척은 참고값이다.
사용: python3 tools/plan3d_ait_lowfloor.py <작업폴더>
"""
import json, os, re, sys

WORK = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'shareal', '3d', 'model-scripts')
COLOR = {'wall': '#e9e4da', 'floor': '#dfc9a7', 'tile': '#9dabae', 'fixture': '#f3f6f3'}

# 원본 평면도의 나침반 기호에서 읽은 북쪽 (화면 기준 오른쪽 위 약 40°) — 추정값
NORTH = {'label': '북동 약 40° (도면 나침반 기호)', 'verified': False,
         'northVector': [0.773, -0.635],
         'evidence': 'source_plan_north_symbol'}
WALL_T = 2.2          # 화면 표현용 벽 두께(픽셀)
WALL_H = 22.0         # 화면 표현용 벽 높이
FLOOR_H = 2.0

PLANS = {
    1: dict(id='P146', planLabel='1층', usageLabel='근린생활시설',
            image='AIT_1층_원본도면.png'),
    2: dict(id='P147', planLabel='2층', usageLabel='근린생활시설',
            image='AIT_2층_원본도면.png'),
}

def build(floor):
    src = json.load(open(os.path.join(WORK, 'rooms%d.json' % floor), encoding='utf-8'))
    meta = PLANS[floor]
    W, H = src['size']
    objects, units = [], []
    n = 0

    def add(name, box, material):
        nonlocal n
        n += 1
        objects.append({'id': '%s-%d' % (meta['id'], n), 'name': name,
                        'box': [round(v, 2) for v in box],
                        'material': material, 'color': COLOR[material],
                        'semantic': material})

    # 건물 바닥판 (호실 전체를 감싸는 범위) — 공간을 알아보기 쉽게 깔아 둔다
    rects = [u['rect'] for u in src['units'] if u.get('rect')]
    if rects:
        bx0 = min(r[0] for r in rects) - 14
        by0 = min(r[1] for r in rects) - 14
        bx1 = max(r[0] + r[2] for r in rects) + 14
        by1 = max(r[1] + r[3] for r in rects) + 14
        add('%d층 바닥' % floor, [bx0, by0, bx1 - bx0, by1 - by0, -1.2, 1.2], 'tile')

    # 공부 면적과 20% 넘게 어긋난 호실은 같은 줄 이웃의 깊이에 맞춰 다시 잡는다
    k = src.get('scaleM2PerPx2')
    good = [u for u in src['units']
            if u.get('rect') and u.get('fit') and 0.8 <= u['fit'] <= 1.2]
    for u in src['units']:
        if not (u.get('rect') and u.get('fit') and k) or 0.8 <= u['fit'] <= 1.2:
            continue
        x, y, w, h = u['rect']
        cy = y + h / 2
        # 세로 범위가 겹치는 이웃 = 같은 줄
        row = [g for g in good if g['rect'][1] <= cy <= g['rect'][1] + g['rect'][3]]
        if not u.get('exclusive'):
            continue
        lx = u['x'] + u['w'] / 2                 # 호실 표기 중심
        ly = u['y'] + u['h'] / 2
        if len(row) >= 2:
            # 가로로 늘어선 줄: 깊이를 이웃에 맞추고 너비를 면적으로 정한다
            depth = sorted(g['rect'][3] for g in row)[len(row) // 2]
            top = sorted(g['rect'][1] for g in row)[len(row) // 2]
            width = (u['exclusive'] / k) / depth
            u['rect'] = [round(lx - width / 2, 1), round(top, 1), round(width, 1), round(depth, 1)]
        else:
            # 세로로 쌓인 줄: 너비를 이웃에 맞추고 깊이를 면적으로 정한다
            col = [g for g in good if g['rect'][0] <= lx <= g['rect'][0] + g['rect'][2]]
            if len(col) < 2:
                continue
            width = sorted(g['rect'][2] for g in col)[len(col) // 2]
            left = sorted(g['rect'][0] for g in col)[len(col) // 2]
            depth = (u['exclusive'] / k) / width
            u['rect'] = [round(left, 1), round(ly - depth / 2, 1), round(width, 1), round(depth, 1)]
        u['fit'] = 1.0
        u['corrected'] = True

    for u in src['units']:
        if not u.get('rect'):
            continue
        x, y, w, h = u['rect']
        label = u['label']
        add('%s 바닥' % label, [x, y, w, h, 0.0, FLOOR_H], 'floor')
        # 호실 둘레 벽 (화면 표현용 두께·높이)
        add('%s 북측 벽' % label, [x, y, w, WALL_T, 0.0, WALL_H], 'wall')
        add('%s 남측 벽' % label, [x, y + h - WALL_T, w, WALL_T, 0.0, WALL_H], 'wall')
        add('%s 서측 벽' % label, [x, y, WALL_T, h, 0.0, WALL_H], 'wall')
        add('%s 동측 벽' % label, [x + w - WALL_T, y, WALL_T, h, 0.0, WALL_H], 'wall')
        unit = {'id': label, 'label': label, 'usage': '근린생활시설',
                'rect': [x, y, w, h], 'rectEncoding': 'xywh',
                'clickTarget': [x, y, w, h],
                'evidence': 'source_plan_label_position_and_region'}
        if u.get('exclusive'):
            unit['exclusiveAreaM2'] = u['exclusive']
        if u.get('supply'):
            unit['supplyAreaM2'] = u['supply']
        if u.get('corrected'):
            unit['boundaryCorrectedByArea'] = True
        if u.get('fit') is not None:
            unit['areaFit'] = u['fit']
            # 공부 면적과 20% 넘게 차이 나면 구획 경계가 의심스러움
            unit['needsReview'] = not (0.8 <= u['fit'] <= 1.2)
        units.append(unit)

    # 공용부 라벨 (계약현황 문구는 파싱 단계에서 이미 제외)
    facilities = [{'name': c['text'],
                   'rect': [c['x'], c['y'], c['w'], c['h']], 'rectEncoding': 'xywh',
                   'evidence': 'source_plan_label'}
                  for c in src.get('common', [])]

    # 건물 안 공용시설만 블록으로 그린다 (주변 건물 이름표·도면 제목은 제외)
    INSIDE = re.compile(r'출입구|로비|경비실|택배|회의실|주차장')
    for c in src.get('common', []):
        if not INSIDE.search(c['text']):
            continue
        if c['w'] < 6 or c['h'] < 6 or c['w'] > 160 or c['h'] > 90:
            continue
        if rects and not (bx0 <= c['x'] <= bx1 and by0 <= c['y'] <= by1):
            continue
        add(c['text'], [c['x'], c['y'], c['w'], c['h'], 0.0, 1.6], 'fixture')

    review = [u['label'] for u in units if u.get('needsReview')]
    fixed = [u['label'] for u in units if u.get('boundaryCorrectedByArea')]
    model = {
        'id': meta['id'], 'building': '송도 AIT센터',
        'usageLabel': meta['usageLabel'], 'planLabel': meta['planLabel'],
        'sourceReference': 'AIT근린상가 첨부 평면도 (파워포인트 원본 CAD)',
        'sourceImage': 'originals/%s' % meta['image'],
        'coordinateSystem': {'units': 'source_image_pixels', 'width': W, 'height': H,
                             'origin': 'top_left',
                             'physicalScale': None,
                             'areaFittedM2PerPx2': src.get('scaleM2PerPx2')},
        'direction': NORTH,
        'verification': {'status': 'source_interpreted_from_plan_and_area_table',
                         'dimensions': False, 'structure': False,
                         'direction': False, 'unitAssociation': False},
        'unknowns': ['실측 치수·층고·벽 두께',
                     '호실 경계는 도면에서 읽은 구획이며 실측이 아님',
                     '창호·출입문의 정확한 위치와 개폐방식',
                     '현행 합호·칸막이 변경 여부'] +
                    (['구획이 공부 면적과 20%% 넘게 차이 나는 호실: %s' % ', '.join(review)] if review else []) +
                    (['구획을 공부 면적에 맞춰 보정한 호실: %s' % ', '.join(fixed)] if fixed else []) +
                    ['방위는 도면 나침반 기호에서 읽은 추정값'],
        'walls': [], 'openings': [], 'columns': [],
        'units': units, 'facilities': facilities, 'objects': objects,
        'reconstruction': {'method': 'plan_region_segmentation_with_area_fit',
                           'geometryEvidence': 'source_plan',
                           'measured': False, 'heightIsMeasured': False,
                           'scope': 'floor_units_only',
                           'note': '호실 위치는 원본 도면의 호실 표기 좌표, 면적은 공부 전용/공급면적'},
        'dataVersion': '2.0-lowfloor-units',
        'description': '원본 1·2층 평면도에서 근린생활시설 호실 구획을 읽어 세웠습니다. '
                       '호실을 누르면 해당 구간을 확대합니다. 벽 높이와 두께는 화면 표현용입니다.'
                       if floor == 1 else
                       '원본 2층 평면도의 근린생활시설 호실 구획입니다. 호실을 누르면 확대합니다.',
    }
    model['description'] = model['description']
    path = os.path.join(OUT, '%s.js' % meta['id'])
    with open(path, 'w', encoding='utf-8') as f:
        f.write('PLAN_DATA["%s"]=' % meta['id'])
        json.dump(model, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('%s 생성: 호실 %d개, 객체 %d개, 공용부 %d개 | 보정 %s | 검수필요 %s' %
          (meta['id'], len(units), len(objects), len(facilities),
           ', '.join(fixed) or '없음', ', '.join(review) or '없음'))

for fl in (1, 2):
    build(fl)
