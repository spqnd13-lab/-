/**
 * 입체 도면 (건물별 골격 도면)
 *
 * 정확한 측량 도면이 아니라, 벽·기둥·출입문·창 같은 큰 골격만 격자에 찍어 입체로 보여 줍니다.
 * 도면 데이터는 shareal/data/floorplans.js 에 있습니다. 격자 한 칸 = 글자 하나:
 *
 *   #  벽        W  창        D  출입문      C  기둥
 *   .  바닥      (빈칸) 건물 바깥
 *
 * 사용:
 *   Floorplan.findFor(property)            이 매물의 건물 도면 키 (없으면 null)
 *   Floorplan.open(key)                    도면 보기 창 열기
 *   Floorplan.mount(element, key)          페이지 안에 도면 뷰어 넣기
 */
(function () {
  var PLANS = window.FLOORPLANS || {};
  var TW = 44, TH = 22, UNIT = 34;                 // 타일 가로·세로(화면), 높이 1.0 의 화면 길이
  var H = { wall: 0.62, column: 0.9, sill: 0.2, glassTop: 0.52, door: 0.05 };
  var COLOR = {
    floor: ['#f7f0e4', '#f2e9da'],
    wall: { top: '#fffdf9', left: '#e6dac6', right: '#d3c4ab' },
    column: { top: '#5b4d3c', left: '#43382b', right: '#342b21' },
    sill: { top: '#f6eedf', left: '#e6dac6', right: '#d3c4ab' },
    glass: { top: '#bfe0f5', left: '#9fcdec', right: '#86bde3' },
    door: { top: '#f0a93b', left: '#d78f25', right: '#c17d1c' },
    stroke: 'rgba(90,70,40,.22)'
  };
  var SVG = 'http://www.w3.org/2000/svg';

  function parse(grid) {
    var rows = grid.map(function (r) { return r.split(''); });
    var h = rows.length, w = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    var cells = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y][x] || ' ';
      if (ch !== ' ') cells.push({ x: x, y: y, ch: ch });
    }
    return { w: w, h: h, cells: cells, image: null };
  }

  // 90도씩 돌리기 (rot: 0~3)
  function rotate(x, y, w, h, rot) {
    if (rot === 1) return [h - 1 - y, x];
    if (rot === 2) return [w - 1 - x, h - 1 - y];
    if (rot === 3) return [y, w - 1 - x];
    return [x, y];
  }

  function el(name, attrs) {
    var n = document.createElementNS(SVG, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function poly(points, fill, extra) {
    var a = { points: points.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), fill: fill, stroke: fill, 'stroke-width': 0.7, 'stroke-linejoin': 'round' };
    for (var k in (extra || {})) a[k] = extra[k];
    return el('polygon', a);
  }

  // 격자 좌표(gx, gy, 높이 z) → 화면 좌표
  function iso(gx, gy, z) { return [(gx - gy) * TW / 2, (gx + gy) * TH / 2 - z * UNIT]; }

  // 회전한 격자를 2차원 배열로
  function rotated(plan, rot) {
    var W = rot % 2 ? plan.h : plan.w, Hh = rot % 2 ? plan.w : plan.h, g = [];
    for (var y = 0; y < Hh; y++) { g.push(new Array(W).fill(' ')); }
    plan.cells.forEach(function (c) { var r = rotate(c.x, c.y, plan.w, plan.h, rot); g[r[1]][r[0]] = c.ch; });
    return { g: g, W: W, H: Hh };
  }
  // 한 줄에서 같은 종류가 이어진 구간 [x0, x1) 들
  function spans(row, test) {
    var out = [], x = 0;
    while (x < row.length) {
      if (test(row[x])) { var s = x; while (x < row.length && test(row[x])) x++; out.push([s, x]); } else x++;
    }
    return out;
  }
  // 여러 칸에 걸친 긴 상자 (x0~x1, 한 줄)
  function slab(g, x0, x1, gy, z0, z1, c, inset) {
    var a = inset || 0, xa = x0 + a, xb = x1 - a, ya = gy + a, yb = gy + 1 - a;
    g.appendChild(poly([iso(xa, yb, z1), iso(xb, yb, z1), iso(xb, yb, z0), iso(xa, yb, z0)], c.left));
    g.appendChild(poly([iso(xb, ya, z1), iso(xb, yb, z1), iso(xb, yb, z0), iso(xb, ya, z0)], c.right));
    g.appendChild(poly([iso(xa, ya, z1), iso(xb, ya, z1), iso(xb, yb, z1), iso(xa, yb, z1)], c.top));
  }
  function isWallish(ch) { return ch === '#' || ch === 'W' || ch === 'D'; }

  function drawIso(svg, plan, rot) {
    var R = rotated(plan, rot), W = R.W, Hh = R.H, G = R.g;
    var g = el('g', {});
    var notOut = function (ch) { return ch !== ' '; };
    // 바닥 그림자 + 바닥 (줄마다 이어진 구간을 한 장으로)
    var sh = el('g', { opacity: 0.16, transform: 'translate(0,14)', filter: 'url(#fpBlur)' });
    for (var y = 0; y < Hh; y++) spans(G[y], notOut).forEach(function (s) {
      sh.appendChild(poly([iso(s[0], y, 0), iso(s[1], y, 0), iso(s[1], y + 1, 0), iso(s[0], y + 1, 0)], '#5a4628'));
      g.appendChild(poly([iso(s[0], y, 0), iso(s[1], y, 0), iso(s[1], y + 1, 0), iso(s[0], y + 1, 0)], COLOR.floor[y % 2]));
    });
    g.insertBefore(sh, g.firstChild);
    if (plan.image) {
      var under = underlay(plan, function (gx, gy) { var r = rotateXY(gx, gy, plan.w, plan.h, rot); return iso(r[0], r[1], 0); });
      if (plan.image.clip) {          // 건물 바닥 안쪽만 보이게 (바깥의 격자선·글자를 가림)
        var cp = el('clipPath', { id: 'fpClip' });
        for (var cy2 = 0; cy2 < Hh; cy2++) spans(G[cy2], notOut).forEach(function (s) { cp.appendChild(poly([iso(s[0], cy2, 0), iso(s[1], cy2, 0), iso(s[1], cy2 + 1, 0), iso(s[0], cy2 + 1, 0)], '#000')); });
        g.appendChild(cp);
        var wrapG = el('g', { 'clip-path': 'url(#fpClip)' }); wrapG.style.mixBlendMode = 'multiply'; wrapG.appendChild(under); under = wrapG;   // 눕힌 그림이 아니라 바깥 묶음에 오려내기를 걸어야 좌표가 맞음
      }
      g.appendChild(under);
    }
    // 벽·기둥·창·문: 뒷줄부터, 줄 안에서는 왼쪽부터 (이 순서면 앞의 것이 뒤의 것을 가림)
    for (var yy = 0; yy < Hh; yy++) {
      var row = G[yy], x = 0;
      while (x < W) {
        var ch = row[x];
        if (ch === '#') { var s0 = x; while (x < W && row[x] === '#') x++; slab(g, s0, x, yy, 0, H.wall, COLOR.wall); continue; }
        if (ch === 'D') { var d0 = x; while (x < W && row[x] === 'D') x++; slab(g, d0, x, yy, 0, H.door, COLOR.door); continue; }
        if (ch === 'W') {
          var w0 = x; while (x < W && row[x] === 'W') x++;
          slab(g, w0, x, yy, 0, H.sill, COLOR.sill); slab(g, w0, x, yy, H.sill, H.glassTop, COLOR.glass, 0.06); slab(g, w0, x, yy, H.glassTop, H.wall, COLOR.wall);
          continue;
        }
        if (ch === 'C') {
          // 벽 속 기둥이면 벽을 먼저 잇고, 그 위로 기둥이 솟게
          var inWall = isWallish(row[x - 1]) || isWallish(row[x + 1]) || (G[yy - 1] && isWallish(G[yy - 1][x])) || (G[yy + 1] && isWallish(G[yy + 1][x]));
          if (inWall) slab(g, x, x + 1, yy, 0, H.wall, COLOR.wall);
          slab(g, x, x + 1, yy, 0, H.column, COLOR.column, inWall ? 0.08 : 0.14);
        }
        x++;
      }
    }
    svg.appendChild(g);
    return { minX: -Hh * TW / 2, maxX: W * TW / 2, minY: -H.column * UNIT, maxY: (W + Hh) * TH / 2 + 22, rotCell: function (x, y) { return rotate(x, y, plan.w, plan.h, rot); }, point: function (x, y) { return iso(x + 0.5, y + 0.5, 0); } };
  }

  // 원본 도면 그림을 바닥면에 맞춰 눕힘. toScreen(격자x, 격자y) → 화면 좌표
  function underlay(plan, toScreen) {
    var im = plan.image, c = im.cell;
    var o = toScreen(-im.x0 / c, -im.y0 / c), px = toScreen((1 - im.x0) / c, -im.y0 / c), py = toScreen(-im.x0 / c, (1 - im.y0) / c);
    var m = [px[0] - o[0], px[1] - o[1], py[0] - o[0], py[1] - o[1], o[0], o[1]].map(function (v) { return v.toFixed(4); }).join(' ');
    var node = el('image', { href: im.src, width: im.w, height: im.h, transform: 'matrix(' + m + ')', preserveAspectRatio: 'none', opacity: im.opacity || 0.9 });
    node.style.mixBlendMode = 'multiply';
    return node;
  }
  // 회전 (연속 좌표용)
  function rotateXY(x, y, w, h, rot) {
    if (rot === 1) return [h - y, x];
    if (rot === 2) return [w - x, h - y];
    if (rot === 3) return [y, w - x];
    return [x, y];
  }

  function drawFlat(svg, plan) {
    var S = 30, g = el('g', {}), R = rotated(plan, 0), G = R.g;
    var fill = { '#': '#d9ccb6', 'D': COLOR.door.top, 'W': '#a9d0ec' };
    for (var y = 0; y < R.H; y++) {
      spans(G[y], function (ch) { return ch !== ' '; }).forEach(function (s) { g.appendChild(el('rect', { x: s[0] * S, y: y * S, width: (s[1] - s[0]) * S, height: S, fill: COLOR.floor[y % 2] })); });
      if (y === R.H - 1 && plan.image) {
        var under = underlay(plan, function (gx, gy) { return [gx * S, gy * S]; });
        if (plan.image.clip) {
          var cp = el('clipPath', { id: 'fpClipFlat' });
          for (var yy2 = 0; yy2 < R.H; yy2++) spans(G[yy2], function (ch) { return ch !== ' '; }).forEach(function (s) { cp.appendChild(el('rect', { x: s[0] * S, y: yy2 * S, width: (s[1] - s[0]) * S, height: S })); });
          g.appendChild(cp);
          var wrapF = el('g', { 'clip-path': 'url(#fpClipFlat)' }); wrapF.style.mixBlendMode = 'multiply'; wrapF.appendChild(under); under = wrapF;
        }
        g.appendChild(under);
      }
    }
    for (y = 0; y < R.H; y++) {
      ['#', 'D', 'W'].forEach(function (k) { spans(G[y], function (ch) { return ch === k; }).forEach(function (s) { g.appendChild(el('rect', { x: s[0] * S, y: y * S, width: (s[1] - s[0]) * S, height: S, fill: fill[k] })); }); });
      for (var x = 0; x < R.W; x++) if (G[y][x] === 'C') {
        if (isWallish(G[y][x - 1]) || isWallish(G[y][x + 1]) || (G[y - 1] && isWallish(G[y - 1][x])) || (G[y + 1] && isWallish(G[y + 1][x]))) g.appendChild(el('rect', { x: x * S, y: y * S, width: S, height: S, fill: fill['#'] }));
        g.appendChild(el('rect', { x: x * S + 3, y: y * S + 3, width: S - 6, height: S - 6, fill: COLOR.column.top, rx: 3 }));
      }
    }
    svg.appendChild(g);
    return { minX: 0, maxX: plan.w * S, minY: 0, maxY: plan.h * S, rotCell: function (x, y) { return [x, y]; }, point: function (x, y) { return [(x + 0.5) * S, (y + 0.5) * S]; } };
  }

  // k: 화면에서 글자가 늘 12px 안팎으로 보이도록 하는 배율
  function drawLabels(svg, labels, view, k) {
    (labels || []).forEach(function (l) {
      var rc = view.rotCell(l.x, l.y), p = view.point(rc[0], rc[1]);
      var fs = 12 * k, w = l.text.length * fs + 16 * k, hh = 22 * k;
      var g = el('g', { transform: 'translate(' + p[0].toFixed(1) + ',' + (p[1] - 6 * k).toFixed(1) + ')' });
      g.appendChild(el('rect', { x: -w / 2, y: -hh / 2, width: w, height: hh, rx: hh / 2, fill: l.hot ? '#D4202F' : 'rgba(255,255,255,.94)', stroke: l.hot ? '#D4202F' : 'rgba(90,70,40,.2)', 'stroke-width': 0.6 * k }));
      var t = el('text', { x: 0, y: fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700, fill: l.hot ? '#fff' : '#3b3226' });
      t.textContent = l.text;
      g.appendChild(t);
      svg.appendChild(g);
    });
  }

  // opts: { labels: 이름표 보이기, unit: 강조할 호실 번호 }
  function render(holder, floor, mode, rot, opts) {
    opts = opts || {};
    holder.textContent = '';
    var plan = parse(floor.grid);
    plan.image = floor.image || null;
    var svg = el('svg', { role: 'img', 'aria-label': '건물 골격 도면' });
    var defs = el('defs', {}); var f = el('filter', { id: 'fpBlur', x: '-20%', y: '-20%', width: '140%', height: '160%' });
    f.appendChild(el('feGaussianBlur', { stdDeviation: 9 })); defs.appendChild(f); svg.appendChild(defs);
    var view = mode === 'flat' ? drawFlat(svg, plan) : drawIso(svg, plan, rot);
    var pad = 18, vw = view.maxX - view.minX + pad * 2, vh = view.maxY - view.minY + pad * 2;
    var k = Math.max(1, vw / Math.max(260, (holder.clientWidth || 600) * (opts.zoom || 1)));
    var list = opts.labels ? (floor.labels || []).concat(floor.units || []) : [];
    if (opts.unit) {
      // 기준층 도면(unitSuffix)은 호실 번호의 끝 두 자리로 맞춤 (708호 → '08')
      var want = floor.unitSuffix ? String(opts.unit).slice(-2) : String(opts.unit);
      var mine = (floor.units || []).filter(function (u) { return u.text === want; });
      list = (opts.labels ? list.filter(function (l) { return l.text !== want; }) : []).concat(mine.map(function (u) { return { x: u.x, y: u.y, text: opts.unit + '호', hot: true }; }));
    }
    drawLabels(svg, list, view, k);
    svg.setAttribute('viewBox', [view.minX - pad, view.minY - pad, vw, vh].join(' '));
    var zoom = opts.zoom || 1;
    svg.style.width = (zoom * 100) + '%'; svg.style.height = 'auto'; svg.style.maxHeight = zoom > 1 ? 'none' : '62vh'; svg.style.display = 'block'; svg.style.flex = 'none';
    holder.appendChild(svg);
  }

  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // 뷰어(층 선택, 회전, 입체/평면, 범례)를 element 안에 만든다
  // opts: { level: 처음 보여 줄 층(숫자), unit: 강조할 호실 }
  function mount(root, key, opts) {
    opts = opts || {};
    var b = PLANS[key];
    root.textContent = '';
    root.classList.add('fp-viewer');
    if (!b) { root.appendChild(h('p', 'fp-empty', '등록된 도면이 없습니다.')); return; }
    var state = { floor: 0, mode: 'iso', rot: 0, zoom: 1, labels: false, unit: opts.unit || null };
    if (opts.level != null) b.floors.forEach(function (fl, i) { if ((fl.levels || []).indexOf(opts.level) !== -1) state.floor = i; });

    var head = h('div', 'fp-head');
    var titleBox = h('div', '');
    titleBox.appendChild(h('p', 'fp-eyebrow', b.sample ? '예시 도면 · 실제 건물 아님' : '건물 골격 도면'));
    titleBox.appendChild(h('h3', 'fp-title', b.name));
    head.appendChild(titleBox);
    root.appendChild(head);

    var floors = h('div', 'fp-floors');
    b.floors.forEach(function (fl, i) {
      var btn = h('button', 'fp-pill', fl.label); btn.type = 'button';
      btn.addEventListener('click', function () { state.floor = i; draw(); });
      floors.appendChild(btn);
    });
    if (b.floors.length > 1) root.appendChild(floors);

    var stage = h('div', 'fp-stage');
    var holder = h('div', 'fp-canvas');
    stage.appendChild(holder);
    var tools = h('div', 'fp-tools');
    var rotBtn = h('button', 'fp-round', '↻'); rotBtn.type = 'button'; rotBtn.title = '돌려 보기'; rotBtn.setAttribute('aria-label', '도면 돌려 보기');
    rotBtn.addEventListener('click', function () { state.rot = (state.rot + 1) % 4; draw(); });
    var modeBtn = h('button', 'fp-pill fp-mode', '평면으로 보기'); modeBtn.type = 'button';
    modeBtn.addEventListener('click', function () { state.mode = state.mode === 'iso' ? 'flat' : 'iso'; draw(); });
    var nameBtn = h('button', 'fp-pill fp-names', '이름 보기'); nameBtn.type = 'button';
    nameBtn.addEventListener('click', function () { state.labels = !state.labels; draw(); });
    var zin = h('button', 'fp-round', '+'); zin.type = 'button'; zin.setAttribute('aria-label', '확대');
    var zout = h('button', 'fp-round', '−'); zout.type = 'button'; zout.setAttribute('aria-label', '축소');
    zin.addEventListener('click', function () { state.zoom = Math.min(4, state.zoom * 1.6); draw(); });
    zout.addEventListener('click', function () { state.zoom = Math.max(1, state.zoom / 1.6); draw(); });
    tools.appendChild(nameBtn); tools.appendChild(modeBtn); tools.appendChild(zout); tools.appendChild(zin); tools.appendChild(rotBtn);
    stage.appendChild(tools);
    root.appendChild(stage);

    var legend = h('ul', 'fp-legend');
    [['fp-k-wall', '벽'], ['fp-k-col', '기둥'], ['fp-k-door', '출입문'], ['fp-k-win', '창']].forEach(function (k) {
      var li = h('li', ''); li.appendChild(h('span', 'fp-key ' + k[0])); li.appendChild(document.createTextNode(k[1])); legend.appendChild(li);
    });
    root.appendChild(legend);
    root.appendChild(h('p', 'fp-note', (b.note ? b.note + ' ' : '') + '벽·기둥·출입문·창의 위치만 표시한 참고용 도면입니다. 실제 치수·구조와 다를 수 있으니 현장에서 확인해 주세요.'));

    function draw() {
      var fl = b.floors[state.floor];
      // 넓은 층은 처음에 이름표를 숨김 (겹쳐서 도면을 가리므로)
      var many = ((fl.labels || []).length + (fl.units || []).length) > 8;
      var cx = holder.scrollWidth ? (holder.scrollLeft + holder.clientWidth / 2) / holder.scrollWidth : 0.5;
      render(holder, fl, state.mode, state.rot, { labels: many ? state.labels : true, unit: state.unit, zoom: state.zoom });
      holder.classList.toggle('is-zoomed', state.zoom > 1);
      holder.scrollLeft = cx * holder.scrollWidth - holder.clientWidth / 2;
      nameBtn.style.display = many ? '' : 'none';
      nameBtn.textContent = state.labels ? '이름 숨기기' : '이름 보기';
      zout.disabled = state.zoom <= 1; zin.disabled = state.zoom >= 4;
      Array.prototype.forEach.call(floors.children, function (c, i) { c.classList.toggle('is-on', i === state.floor); });
      modeBtn.textContent = state.mode === 'iso' ? '평면으로 보기' : '입체로 보기';
      rotBtn.style.visibility = state.mode === 'iso' ? 'visible' : 'hidden';
    }
    draw();
  }

  function levelOf(p) {
    var m = String(p.floor || '').match(/(-?\d+)\s*층/) || String(p.dongHo || '').match(/(\d+)\s*층/);
    return m ? parseInt(m[1], 10) : null;
  }
  function unitOf(p) {
    var m = String(p.dongHo || '').match(/(\d+)\s*호/);
    return m ? m[1] : null;
  }
  // 이 매물에 맞는 도면: { key, level, unit } (없으면 null)
  // 건물 이름이 맞고, 층마다 levels 가 적혀 있으면 그 층이 들어 있어야 연결됩니다.
  function findFor(p) {
    if (!p) return null;
    var text = (p.title || '') + ' ' + (p.address || '') + ' ' + (p.dongHo || '');
    var level = levelOf(p), found = null;
    Object.keys(PLANS).forEach(function (key) {
      var b = PLANS[key];
      if (found || b.sample) return;
      var hit = (b.match || []).some(function (m) { return m && text.indexOf(m) !== -1; });
      var miss = (b.exclude || []).some(function (m) { return m && text.indexOf(m) !== -1; });
      if (!hit || miss) return;
      var hasLevels = b.floors.some(function (fl) { return fl.levels; });
      if (hasLevels && !b.floors.some(function (fl) { return (fl.levels || []).indexOf(level) !== -1; })) return;
      found = { key: key, level: level, unit: unitOf(p) };
    });
    return found;
  }

  function open(key, opts) {
    var old = document.getElementById('floorplanModal'); if (old) old.remove();
    var wrap = h('div', 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4'); wrap.id = 'floorplanModal';
    wrap.style.zIndex = 60;
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', '건물 도면');
    var box = h('div', 'fp-modal');
    var close = h('button', 'fp-round fp-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', '도면 닫기');
    var body = h('div', '');
    box.appendChild(close); box.appendChild(body); wrap.appendChild(box); document.body.appendChild(wrap);
    mount(body, key, opts);
    function shut() { wrap.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); shut(); } }
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) shut(); });
    close.focus();
  }

  window.Floorplan = { plans: PLANS, findFor: findFor, open: open, mount: mount };
})();
