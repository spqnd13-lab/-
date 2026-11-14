"""extract.py 의 결과를 격자 도면(shareal/data/floorplans.js 의 grid)으로 바꿉니다.

  python3 tools/domyeon/mkgrid.py 결과.json 글자.json 칸크기 x0,y0,x1,y1 왼쪽잘림비율 출력.json

  칸크기        한 칸이 몇 픽셀인지 (11 정도)
  x0,y0,x1,y1   도면에서 건물이 있는 범위(픽셀). (x0, y0)이 격자의 (0, 0)이 됩니다.
  글자.json     {"pic": [x, y, w, h], "shapes": [...], "frames": [...]} — PPT에서 뽑은 그림 위치와 글상자.
                없으면 {"pic": [0, 0, 1, 1], "shapes": [], "frames": []}
출력의 grid·labels·units 를 floorplans.js 에 옮기고, image 에 { src, w, h, x0, y0, cell } 을 적습니다.
"""
import json, sys, re
import numpy as np

def build(ex, shapes, cell, box, skip_text=()):
    W, H = ex['size']; x0, y0, x1, y1 = box
    gw, gh = (x1 - x0) // cell + 1, (y1 - y0) // cell + 1
    g = np.full((gh, gw), ' ', dtype='<U1')
    def cx(x): return int((x - x0) // cell)
    def cy(y): return int((y - y0) // cell)
    def inside(x, y): return x0 <= x <= x1 and y0 <= y <= y1
    wall = np.zeros((gh, gw), bool)
    for y, xa, xb in ex['hs']:
        if y0 <= y <= y1:
            for x in range(max(xa, x0), min(xb, x1) + 1): wall[cy(y), cx(x)] = True
    for x, ya, yb in ex['vs']:
        if x0 <= x <= x1:
            for y in range(max(ya, y0), min(yb, y1) + 1): wall[cy(y), cx(x)] = True
    # 바닥: 위·아래·왼쪽·오른쪽 네 방향 모두에 벽이 있는 칸 (건물 사이 마당도 바닥판으로 채워짐)
    left = np.maximum.accumulate(wall, axis=1); right = np.maximum.accumulate(wall[:, ::-1], axis=1)[:, ::-1]
    up = np.maximum.accumulate(wall, axis=0); down = np.maximum.accumulate(wall[::-1], axis=0)[::-1]
    g[left & right & up & down] = '.'
    g[wall] = '#'
    # 화장실 칸막이처럼 문 표시가 3개 이상 몰린 곳은 문으로 보지 않음
    D = ex['doors']
    lonely = [d for d in D if sum(1 for e in D if abs(e[0] - d[0]) <= 30 and abs(e[1] - d[1]) <= 30) <= 2]
    for y, x in lonely:
        if not inside(x, y): continue
        r, c = cy(y), cx(x)
        best = None
        for dr in (0, -1, 1):
            for dc in (0, -1, 1):
                rr, cc = r + dr, c + dc
                if 0 <= rr < gh and 0 <= cc < gw and g[rr, cc] == '#' and best is None: best = (rr, cc)
        if best: g[best] = 'D'
    for y, x, h in ex['cols']:
        if inside(x, y) and h >= 4: g[cy(y), cx(x)] = 'C'
    # 글자 표시
    px, py, pw, ph = shapes['pic']; crop_l = shapes.get('crop_l', 0.0)
    def to_cell(ex_, ey_, ew, eh):
        mx, my = ex_ + ew / 2, ey_ + eh / 2
        X = ((mx - px) / pw) * (W * (1 - crop_l)) + W * crop_l; Y = ((my - py) / ph) * H
        return cx(X), cy(Y), inside(X, Y)
    units, labels = [], []
    for ts, a, b, c_, d in shapes.get('frames', []):
        if ts and re.fullmatch(r'\d{3,4}', ts[0]):
            x, y, ok = to_cell(a, b, c_, d)
            if ok: units.append({'x': x, 'y': y, 'text': ts[0]})
    for t, a, b, c_, d in shapes['shapes']:
        t = re.sub(r'\s+', ' ', t.replace('&amp;', '&')).strip()
        if any(s in t for s in skip_text): continue
        x, y, ok = to_cell(a, b, c_, d)
        if ok: labels.append({'x': x, 'y': y, 'text': t})
    return [''.join(row) for row in g], labels, units

if __name__ == '__main__':
    ex = json.load(open(sys.argv[1])); sh = json.load(open(sys.argv[2]))
    cell = int(sys.argv[3]); box = tuple(map(int, sys.argv[4].split(',')))
    sh['crop_l'] = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    grid, labels, units = build(ex, sh, cell, box, skip_text=('평면도', 'AT 센터', '포스코', '글로벌대학', '트리플', '편의점', 'PC', '입점'))
    json.dump({'grid': grid, 'labels': labels, 'units': units}, open(sys.argv[6], 'w'), ensure_ascii=False)
    print(len(grid[0]), 'x', len(grid), '칸 | 벽', sum(r.count('#') for r in grid), '기둥', sum(r.count('C') for r in grid), '문', sum(r.count('D') for r in grid), '| 호실', len(units), '이름표', [l['text'] for l in labels])
    for r in grid: print(r)
