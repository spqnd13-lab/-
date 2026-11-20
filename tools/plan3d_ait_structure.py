"""AIT센터 1·2층 원본 CAD 도면에서 벽체와 기둥을 따낸다.

- 벽: 두껍게 그려진 선(3x3 안이 모두 선인 지점)을 이어 붙인 뒤 긴 가로·세로 구간만 취함
- 기둥: 속이 찬 작은 정사각형 덩어리
정확한 측량이 아니라 도면에 그려진 선을 읽은 것이다.
사용: python3 tools/plan3d_ait_structure.py <작업폴더> <층> <이미지>
"""
import json, sys
from collections import deque
import numpy as np
from PIL import Image

WORK, FLOOR, IMG = sys.argv[1], int(sys.argv[2]), sys.argv[3]
rgb = np.asarray(Image.open('%s/pptx/x/ppt/media/%s' % (WORK, IMG)).convert('RGB')).astype(np.int16)
gray = rgb.mean(2)
red = (rgb[:, :, 0] > 120) & (rgb[:, :, 1] < 110) & (rgb[:, :, 2] < 110)
ink = (gray < 170) & ~red
H, W = ink.shape


def erode(m, k):
    """k x k 안이 모두 참인 지점만 남긴다 (두꺼운 선 고르기)."""
    out = m.copy()
    for dy in range(-(k // 2), k // 2 + 1):
        for dx in range(-(k // 2), k // 2 + 1):
            out &= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def components(mask, lo, hi):
    lab = np.full(mask.shape, -1, np.int32)
    res = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0] >= 0:
            continue
        cid = len(res)
        q = deque([(y0, x0)])
        lab[y0, x0] = cid
        n = 0
        mnx = mxx = x0
        mny = mxy = y0
        while q:
            y, x = q.popleft()
            n += 1
            mnx = min(mnx, x); mxx = max(mxx, x)
            mny = min(mny, y); mxy = max(mxy, y)
            for ny, nx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1),
                           (y+1, x+1), (y-1, x-1), (y+1, x-1), (y-1, x+1)):
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and lab[ny, nx] < 0:
                    lab[ny, nx] = cid
                    q.append((ny, nx))
        if lo <= n <= hi:
            res.append((n, (mnx, mny, mxx, mxy)))
        else:
            res.append(None)
    return [r for r in res if r]


# 기둥: 속이 꽉 찬 작은 사각형 — 선에 붙어 있어도 찾도록 밀도 봉우리로 찾는다
K = 7
pad = np.pad(ink.astype(np.int32), 1)
S = pad.cumsum(0).cumsum(1)
def dens(k):
    a = S[:-k, :-k] + S[k:, k:] - S[:-k, k:] - S[k:, :-k]
    return a / float(k * k)
D = dens(K)                      # (H-K+1, W-K+1)
peak = D > 0.88
columns = []
taken = np.zeros_like(peak)
ys, xs = np.nonzero(peak)
for y, x in zip(ys, xs):
    if taken[y, x]:
        continue
    # 주변 봉우리를 한 덩어리로
    y0, y1 = max(0, y - 14), min(peak.shape[0], y + 15)
    x0, x1 = max(0, x - 14), min(peak.shape[1], x + 15)
    blk = peak[y0:y1, x0:x1]
    byy, bxx = np.nonzero(blk)
    taken[y0:y1, x0:x1] |= blk
    cy, cx = y0 + byy.mean() + K / 2, x0 + bxx.mean() + K / 2
    hh, ww = byy.max() - byy.min() + K, bxx.max() - bxx.min() + K
    if not (5 <= ww <= 30 and 5 <= hh <= 30):
        continue
    if not (0.55 <= ww / hh <= 1.8):
        continue
    columns.append([int(cx - ww / 2), int(cy - hh / 2), int(ww), int(hh)])

# 벽: 두꺼운 선을 이어 긴 가로·세로 구간만
wall_mask = erode(ink, 3)
walls = []
for n, (x0, y0, x1, y1) in components(wall_mask, 60, 10 ** 7):
    w, h = x1 - x0 + 1, y1 - y0 + 1
    if max(w, h) < 26:
        continue
    sub = wall_mask[y0:y1 + 1, x0:x1 + 1]
    # 가로줄·세로줄 단위로 쪼개 선 구간만 취함
    for axis in (0, 1):
        prof = sub.sum(axis=axis)
        thick = np.where(prof >= 3)[0]
        if not len(thick):
            continue
        start = thick[0]
        prev = thick[0]
        for t in list(thick[1:]) + [None]:
            if t is not None and t - prev <= 2:
                prev = t
                continue
            a, b = start, prev
            if b - a >= 24:
                if axis == 0:       # 세로 방향으로 합계 → 가로 구간
                    rows = np.where(sub[:, a:b + 1].sum(1) >= (b - a) * 0.6)[0]
                    if len(rows):
                        walls.append([int(x0 + a), int(y0 + rows.min()),
                                      int(b - a + 1), int(rows.max() - rows.min() + 1)])
                else:
                    cols = np.where(sub[a:b + 1, :].sum(0) >= (b - a) * 0.6)[0]
                    if len(cols):
                        walls.append([int(x0 + cols.min()), int(y0 + a),
                                      int(cols.max() - cols.min() + 1), int(b - a + 1)])
            if t is None:
                break
            start = prev = t

# 너무 두꺼운(면에 가까운) 것은 벽이 아님
walls = [w for w in walls if min(w[2], w[3]) <= 14 and max(w[2], w[3]) >= 24]
out = dict(floor=FLOOR, size=[W, H], columns=columns, walls=walls)
json.dump(out, open('%s/structure%d.json' % (WORK, FLOOR), 'w', encoding='utf-8'), ensure_ascii=False)
print('%d층: 기둥 %d개, 벽 %d개' % (FLOOR, len(columns), len(walls)))
