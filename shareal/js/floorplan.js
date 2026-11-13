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
    return { w: w, h: h, cells: cells };
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

  // 한 칸 위에 상자 그리기. inset: 칸보다 작게 (기둥)
  function box(g, gx, gy, z0, z1, c, inset) {
    var a = inset || 0, x0 = gx + a, y0 = gy + a, x1 = gx + 1 - a, y1 = gy + 1 - a;
    g.appendChild(poly([iso(x0, y1, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x0, y1, z0)], c.left));
    g.appendChild(poly([iso(x1, y0, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x1, y0, z0)], c.right));
    g.appendChild(poly([iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)], c.top));
  }

  function drawIso(svg, plan, rot) {
    var W = rot % 2 ? plan.h : plan.w, Hh = rot % 2 ? plan.w : plan.h;
    var cells = plan.cells.map(function (c) { var r = rotate(c.x, c.y, plan.w, plan.h, rot); return { x: r[0], y: r[1], ch: c.ch }; });
    var g = el('g', {});
    // 바닥 그림자
    var sh = el('g', { opacity: 0.16, transform: 'translate(0,14)', filter: 'url(#fpBlur)' });
    cells.forEach(function (c) { sh.appendChild(poly([iso(c.x, c.y, 0), iso(c.x + 1, c.y, 0), iso(c.x + 1, c.y + 1, 0), iso(c.x, c.y + 1, 0)], '#5a4628', { stroke: 'none' })); });
    g.appendChild(sh);
    // 바닥 (모든 칸)
    cells.forEach(function (c) {
      g.appendChild(poly([iso(c.x, c.y, 0), iso(c.x + 1, c.y, 0), iso(c.x + 1, c.y + 1, 0), iso(c.x, c.y + 1, 0)], COLOR.floor[(c.x + c.y) % 2]));
    });
    // 벽·기둥·창·문: 뒤에서 앞으로
    cells.filter(function (c) { return c.ch !== '.'; })
      .sort(function (a, b) { return (a.x + a.y) - (b.x + b.y) || a.x - b.x; })
      .forEach(function (c) {
        if (c.ch === '#') box(g, c.x, c.y, 0, H.wall, COLOR.wall);
        else if (c.ch === 'C') box(g, c.x, c.y, 0, H.column, COLOR.column, 0.14);
        else if (c.ch === 'D') box(g, c.x, c.y, 0, H.door, COLOR.door);
        else if (c.ch === 'W') {
          box(g, c.x, c.y, 0, H.sill, COLOR.sill);
          box(g, c.x, c.y, H.sill, H.glassTop, COLOR.glass, 0.06);
          box(g, c.x, c.y, H.glassTop, H.wall, COLOR.wall);
        }
      });
    svg.appendChild(g);
    return { minX: -Hh * TW / 2, maxX: W * TW / 2, minY: -H.column * UNIT, maxY: (W + Hh) * TH / 2 + 22, rotCell: function (x, y) { return rotate(x, y, plan.w, plan.h, rot); }, point: function (x, y) { return iso(x + 0.5, y + 0.5, 0); } };
  }

  function drawFlat(svg, plan) {
    var S = 30, g = el('g', {});
    plan.cells.forEach(function (c) {
      var fill = c.ch === '#' ? '#d9ccb6' : c.ch === 'C' ? COLOR.column.top : c.ch === 'D' ? COLOR.door.top : c.ch === 'W' ? '#a9d0ec' : COLOR.floor[(c.x + c.y) % 2];
      var inset = c.ch === 'C' ? 4 : 0;
      g.appendChild(el('rect', { x: c.x * S + inset, y: c.y * S + inset, width: S - inset * 2, height: S - inset * 2, fill: fill, stroke: 'rgba(90,70,40,.14)', 'stroke-width': 0.6, rx: c.ch === 'C' ? 3 : 0 }));
    });
    svg.appendChild(g);
    return { minX: 0, maxX: plan.w * S, minY: 0, maxY: plan.h * S, rotCell: function (x, y) { return [x, y]; }, point: function (x, y) { return [(x + 0.5) * S, (y + 0.5) * S]; } };
  }

  // k: 화면에서 글자가 늘 12px 안팎으로 보이도록 하는 배율
  function drawLabels(svg, labels, view, k) {
    (labels || []).forEach(function (l) {
      var rc = view.rotCell(l.x, l.y), p = view.point(rc[0], rc[1]);
      var fs = 12 * k, w = l.text.length * fs + 16 * k, hh = 22 * k;
      var g = el('g', { transform: 'translate(' + p[0].toFixed(1) + ',' + (p[1] - 6 * k).toFixed(1) + ')' });
      g.appendChild(el('rect', { x: -w / 2, y: -hh / 2, width: w, height: hh, rx: hh / 2, fill: 'rgba(255,255,255,.94)', stroke: 'rgba(90,70,40,.2)', 'stroke-width': 0.6 * k }));
      var t = el('text', { x: 0, y: fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700, fill: '#3b3226' });
      t.textContent = l.text;
      g.appendChild(t);
      svg.appendChild(g);
    });
  }

  function render(holder, floor, mode, rot) {
    holder.textContent = '';
    var plan = parse(floor.grid);
    var svg = el('svg', { role: 'img', 'aria-label': '건물 골격 도면' });
    var defs = el('defs', {}); var f = el('filter', { id: 'fpBlur', x: '-20%', y: '-20%', width: '140%', height: '160%' });
    f.appendChild(el('feGaussianBlur', { stdDeviation: 9 })); defs.appendChild(f); svg.appendChild(defs);
    var view = mode === 'flat' ? drawFlat(svg, plan) : drawIso(svg, plan, rot);
    var pad = 18, vw = view.maxX - view.minX + pad * 2, vh = view.maxY - view.minY + pad * 2;
    var k = Math.max(1, vw / Math.max(260, holder.clientWidth || 600));
    drawLabels(svg, floor.labels, view, k);
    svg.setAttribute('viewBox', [view.minX - pad, view.minY - pad, vw, vh].join(' '));
    svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.maxHeight = '62vh'; svg.style.display = 'block';
    holder.appendChild(svg);
  }

  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // 뷰어(층 선택, 회전, 입체/평면, 범례)를 element 안에 만든다
  function mount(root, key) {
    var b = PLANS[key];
    root.textContent = '';
    root.classList.add('fp-viewer');
    if (!b) { root.appendChild(h('p', 'fp-empty', '등록된 도면이 없습니다.')); return; }
    var state = { floor: 0, mode: 'iso', rot: 0 };

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
    tools.appendChild(modeBtn); tools.appendChild(rotBtn);
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
      render(holder, fl, state.mode, state.rot);
      Array.prototype.forEach.call(floors.children, function (c, i) { c.classList.toggle('is-on', i === state.floor); });
      modeBtn.textContent = state.mode === 'iso' ? '평면으로 보기' : '입체로 보기';
      rotBtn.style.visibility = state.mode === 'iso' ? 'visible' : 'hidden';
    }
    draw();
  }

  function findFor(p) {
    if (!p) return null;
    var text = (p.title || '') + ' ' + (p.address || '');
    var found = null;
    Object.keys(PLANS).forEach(function (key) {
      var b = PLANS[key];
      if (found || b.sample) return;
      var hit = (b.match || []).some(function (m) { return m && text.indexOf(m) !== -1; });
      var miss = (b.exclude || []).some(function (m) { return m && text.indexOf(m) !== -1; });
      if (hit && !miss) found = key;
    });
    return found;
  }

  function open(key) {
    var old = document.getElementById('floorplanModal'); if (old) old.remove();
    var wrap = h('div', 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4'); wrap.id = 'floorplanModal';
    wrap.style.zIndex = 60;
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', '건물 도면');
    var box = h('div', 'fp-modal');
    var close = h('button', 'fp-round fp-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', '도면 닫기');
    var body = h('div', '');
    box.appendChild(close); box.appendChild(body); wrap.appendChild(box); document.body.appendChild(wrap);
    mount(body, key);
    function shut() { wrap.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); shut(); } }
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) shut(); });
    close.focus();
  }

  window.Floorplan = { plans: PLANS, findFor: findFor, open: open, mount: mount };
})();
