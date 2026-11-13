"""도면 그림(호실 표시를 지운 것)에서 벽·기둥·출입문을 읽어 냅니다. numpy 와 PIL 만 씁니다.

  python3 tools/domyeon/extract.py 도면.png 결과이름 [격자선기준=0.4] [기둥최소크기=4]

  결과이름.json        벽선·기둥·문·출입구 위치 (픽셀)
  결과이름_debug.png   읽은 결과를 원본 위에 겹친 그림. 반드시 눈으로 확인합니다.

읽는 규칙 (분양 도면에서 흔한 표기):
  굵은 선 = 벽 / 구조 격자선이 만나는 곳의 작은 네모 = 기둥 / 벽에 걸친 반원 = 문 / 빨간 삼각형 = 건물 출입구
격자선이 굵게 그려졌거나 창을 해치로 그린 도면은 잘 맞지 않습니다. 그럴 때는 벽선을 직접 찍습니다.
"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw

def load(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    ink = 255 - (r + g + b) // 3                 # 먹의 양 (0 = 흰색)
    red = (r > 150) & (g < 110) & (b < 110)
    return im, ink, red

def runs(mask1d, minlen, gap=3):
    out = []; n = len(mask1d); i = 0
    while i < n:
        if mask1d[i]:
            j = i; last = i
            while j < n and (mask1d[j] or j - last <= gap):
                if mask1d[j]: last = j
                j += 1
            if last - i + 1 >= minlen: out.append((i, last))
            i = last + 1
        else: i += 1
    return out

def walls(ink, minlen=24, thresh=350):
    """선에 수직인 4px 안의 먹 합이 thresh 이상 = 벽 (가구선 ~280, 격자선 ~130 은 걸러짐)."""
    H, W = ink.shape
    p = np.pad(ink, 2)
    sh = p[1:H + 1, 2:W + 2] + p[2:H + 2, 2:W + 2] + p[3:H + 3, 2:W + 2] + p[4:H + 4, 2:W + 2]   # y-1..y+2
    sv = p[2:H + 2, 1:W + 1] + p[2:H + 2, 2:W + 2] + p[2:H + 2, 3:W + 3] + p[2:H + 2, 4:W + 4]
    mh = (sh >= thresh) & (sh >= np.roll(sh, 1, 0)) & (sh > np.roll(sh, -1, 0))                 # 세로 방향 봉우리
    mv = (sv >= thresh) & (sv >= np.roll(sv, 1, 1)) & (sv > np.roll(sv, -1, 1))
    hs, vs = [], []
    for y in range(H):
        for x0, x1 in runs(mh[y], minlen): hs.append((y, x0, x1))
    for x in range(W):
        for y0, y1 in runs(mv[:, x], minlen): vs.append((x, y0, y1))
    return hs, vs

def dilate(m):
    p = np.pad(m, 1)
    return p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[1:-1, 1:-1]

def line_peaks(v, th):
    out = []; i = 0
    while i < len(v):
        if v[i] >= th:
            j = i
            while j < len(v) and v[j] >= th: j += 1
            out.append(i + int(np.argmax(v[i:j]))); i = j
        else: i += 1
    return out

def columns(ink, th=0.4, minh=4):
    """기둥은 구조 격자선(가늘고 긴 선)이 만나는 곳의 작은 네모. 교차점마다 네모 테두리가 있는지 본다."""
    H, W = ink.shape
    m = ink >= 45
    fx = m.mean(0); fy = m.mean(1)
    xs = line_peaks(fx, th); ys = line_peaks(fy, th)
    strong = 0.4            # 격자선이 확실한 교차점이면 작은 네모도 기둥으로 인정
    d = dilate(ink >= 100)
    def ring(cy, cx, h):
        if cy - h < 0 or cx - h < 0 or cy + h >= H or cx + h >= W: return 0
        t = d[cy - h, cx - h:cx + h + 1].mean(); bo = d[cy + h, cx - h:cx + h + 1].mean()
        l = d[cy - h:cy + h + 1, cx - h].mean(); r = d[cy - h:cy + h + 1, cx + h].mean()
        return min(t, bo, l, r)
    def hollow(cy, cx, h):          # 속이 꽉 찬 덩어리(해치·문 표시)는 제외
        q = ink[cy - h + 2:cy + h - 1, cx - h + 2:cx + h - 1]
        return q.size == 0 or (q >= 100).mean() < 0.45
    raw = ink >= 100
    def outside(cy, cx, h):         # 네모 바로 바깥은 대부분 비어 있어야 함 (벽·격자선이 지나는 몇 점만 어두움)
        k = h + 3
        if cy - k < 0 or cx - k < 0 or cy + k >= H or cx + k >= W: return False
        o = np.concatenate([raw[cy - k, cx - k:cx + k + 1], raw[cy + k, cx - k:cx + k + 1], raw[cy - k:cy + k + 1, cx - k], raw[cy - k:cy + k + 1, cx + k]])
        return o.mean() < 0.3
    keep = []
    for y in ys:
        for x in xs:
            best = None
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    for h in range(4 if (fx[x] >= strong and fy[y] >= strong) else minh, 10):
                        if ring(y + dy, x + dx, h) >= 0.97 and hollow(y + dy, x + dx, h) and outside(y + dy, x + dx, h):
                            if best is None or h > best[2]: best = (y + dy, x + dx, h)
            if best and all(abs(best[0] - k[0]) > 8 or abs(best[1] - k[1]) > 8 for k in keep): keep.append(best)
    return keep

def doors(ink, hs, vs, radii=range(9, 14)):
    """벽에 걸친 반원(문 표시): 벽 위 점을 중심으로, 벽을 따라 한쪽으로 부푼 반원 둘레 + 벽에 수직인 지름."""
    H, W = ink.shape
    d = dilate(ink >= 85)
    ang = np.linspace(0, np.pi, 21)[2:-2]
    tt = np.linspace(-1, 1, 11)
    def at(py, px): return d[np.clip(np.round(py).astype(int), 0, H - 1), np.clip(np.round(px).astype(int), 0, W - 1)]
    def test(cy, cx, horizontal):
        bestv = 0
        for r in radii:
            for sign in (1, -1):
                if horizontal:      # 가로벽: 반원이 왼쪽/오른쪽으로 부풂, 지름은 세로
                    arc = at(cy + r * np.cos(ang), cx + sign * r * np.sin(ang)).mean(); dia = at(cy + r * tt, cx + 0 * tt).mean()
                else:
                    arc = at(cy + sign * r * np.sin(ang), cx + r * np.cos(ang)).mean(); dia = at(cy + 0 * tt, cx + r * tt).mean()
                if dia >= .8: bestv = max(bestv, arc)
        return bestv
    found = []
    for y, x0, x1 in hs:
        for x in range(x0, x1 + 1):
            v = test(y, x, True)
            if v >= .94: found.append((v, y, x))
    for x, y0, y1 in vs:
        for y in range(y0, y1 + 1):
            v = test(y, x, False)
            if v >= .94: found.append((v, y, x))
    found.sort(reverse=True); keep = []
    for v, y, x in found:
        if all(abs(y - ky) > 9 or abs(x - kx) > 9 for ky, kx in keep): keep.append((y, x))
    return keep

def entrances(red):
    H, W = red.shape; out = []
    B = 16
    for y in range(0, H - B, 4):
        for x in range(0, W - B, 4):
            v = red[y:y + B, x:x + B].mean()
            if v > .3: out.append((v, y + B // 2, x + B // 2))
    out.sort(reverse=True); keep = []
    for v, y, x in out:
        if all(abs(y - ky) > 26 or abs(x - kx) > 26 for ky, kx in keep): keep.append((y, x))
    return keep

if __name__ == '__main__':
    src, outprefix = sys.argv[1], sys.argv[2]
    im, ink, red = load(src)
    hs, vs = walls(ink)
    cols = columns(ink, float(sys.argv[3]) if len(sys.argv) > 3 else 0.4, int(sys.argv[4]) if len(sys.argv) > 4 else 4)
    drs = doors(ink, hs, vs)
    ents = entrances(red)
    print('가로벽', len(hs), '세로벽', len(vs), '기둥', len(cols), '문', len(drs), '출입구', len(ents))
    dbg = Image.blend(im, Image.new('RGB', im.size, 'white'), .65); d = ImageDraw.Draw(dbg)
    for y, x0, x1 in hs: d.line([(x0, y), (x1, y)], fill=(0, 90, 255), width=2)
    for x, y0, y1 in vs: d.line([(x, y0), (x, y1)], fill=(0, 90, 255), width=2)
    for y, x, h in cols: d.rectangle([x - h, y - h, x + h, y + h], fill=(60, 40, 20))
    for y, x in drs: d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(255, 150, 0))
    for y, x in ents: d.ellipse([x - 10, y - 10, x + 10, y + 10], outline=(230, 0, 0), width=4)
    dbg.save(outprefix + '_debug.png')
    json.dump({'size': im.size, 'hs': [list(map(int, t)) for t in hs], 'vs': [list(map(int, t)) for t in vs], 'cols': [list(map(int, t)) for t in cols], 'doors': [list(map(int, t)) for t in drs], 'ents': [list(map(int, t)) for t in ents]}, open(outprefix + '.json', 'w'))
