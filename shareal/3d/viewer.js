/* 건물 3D 도면 뷰어.
 * 데이터: 3d/viewer-data.js(목록) + 3d/model-scripts/<도면번호>.js(모형, 필요할 때만 불러옴)
 * 좌표는 원본 도면 이미지의 픽셀이며 실측 치수가 아닙니다.
 */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('canvas'), ctx = canvas.getContext('2d');
  var all = (window.PLAN_CATALOG || []).slice().sort(function (a, b) { return a.id.localeCompare(b.id); });
  window.PLAN_DATA = window.PLAN_DATA || {};

  var current = null, angle = -0.30, tilt = 0.78, zoom = 1;
  var hitFaces = [], labelHits = [], selected = null, focusRect = null;
  var points = new Map(), dragState = null, pinchDistance = null;

  if (!all.length) { $('modelCount').textContent = '도면 목록을 불러오지 못했습니다.'; return; }

  var seen = {};
  all.forEach(function (r) {
    if (seen[r.building]) return;
    seen[r.building] = 1;
    $('building').add(new Option(r.building, r.building));
  });

  function fillPlans() {
    var sel = $('plan');
    sel.replaceChildren();
    all.filter(function (r) { return r.building === $('building').value; })
      .forEach(function (r) { sel.add(new Option(r.planLabel + ' · ' + r.usageLabel, r.id)); });
    pick();
  }

  var pending = {};
  function loadPlan(id) {
    if (window.PLAN_DATA[id]) return Promise.resolve();
    if (pending[id]) return pending[id];
    pending[id] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = '3d/model-scripts/' + id + '.js';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('도면 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')); };
      document.head.append(script);
    });
    return pending[id];
  }

  function pick() {
    var id = $('plan').value;
    current = null;
    $('unitSelect').disabled = true;
    $('modelCount').textContent = '도면 불러오는 중…';
    loadPlan(id).then(function () {
      if (id !== $('plan').value) return;
      show(id);
    }, function (err) {
      $('modelCount').textContent = err.message;
    });
  }

  function show(id) {
    current = window.PLAN_DATA[id];
    if (!current) return;
    $('unitSelect').disabled = false;
    angle = -0.30; tilt = 0.78; zoom = 1; selected = null; focusRect = null;
    $('buildingTitle').textContent = current.building;
    $('planTitle').textContent = current.planLabel + ' · ' + current.usageLabel;
    var ops = current.openings || [];
    var doors = ops.filter(function (x) { return x.kind === 'door'; }).length;
    var windows = ops.filter(function (x) { return x.kind === 'window'; }).length;
    $('modelCount').textContent = current.id + ' · 벽 ' + (current.walls || []).length + ' · 문 ' + doors + ' · 창 ' + windows;
    $('description').textContent = current.description || '원본의 외곽·칸막이와 개구부를 구분하여 구성했습니다.';
    $('unknowns').textContent = (current.unknowns || []).join(' / ');
    var dir = current.direction;
    $('direction').textContent = dir && dir.label
      ? dir.label + (dir.verified || dir.label.indexOf('추정') !== -1 ? '' : ' · 추정')
      : '방위 확인 필요';
    clearPick();

    var units = (current.units || []).filter(function (u) { return u.rect || u.clickTarget || u.polygon; });
    var us = $('unitSelect');
    us.replaceChildren(new Option('층 전체 · 호실 선택', ''));
    us.hidden = units.length < 2;
    units.forEach(function (u, i) {
      us.add(new Option((u.label || u.id) + (u.tenant ? ' · ' + u.tenant : ''), String(i)));
    });

    history.replaceState(null, '', '?p=' + encodeURIComponent(id));
    draw();
  }

  function clearPick() {
    $('selection').replaceChildren();
    var t = document.createElement('strong');
    t.textContent = '벽·문·창·가구를 눌러 보세요';
    var s = document.createElement('small');
    s.textContent = '누른 곳이 무엇인지, 어디까지가 도면에서 읽은 내용인지 알려 드립니다.';
    $('selection').append(t, s);
  }

  function shade(hex, m) {
    var a = hex.match(/\w\w/g).map(function (v) {
      return Math.max(0, Math.min(255, Math.round(parseInt(v, 16) * m)));
    });
    return 'rgb(' + a.join(',') + ')';
  }

  function draw() {
    if (!current) return;
    var W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(devicePixelRatio, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var objects = current.objects || [];
    if (focusRect) {
      var fx = focusRect[0], fy = focusRect[1], fw = focusRect[2], fh = focusRect[3];
      objects = objects.filter(function (o) {
        var x = o.box[0], y = o.box[1], a = o.box[2], b = o.box[3];
        return x < fx + fw + 3 && x + a > fx - 3 && y < fy + fh + 3 && y + b > fy - 3;
      }).map(function (o) {
        if (o.rotation) return o;
        var x = o.box[0], y = o.box[1], a = o.box[2], b = o.box[3], z = o.box[4], r = o.box[5];
        var nx = Math.max(x, fx - 2), ny = Math.max(y, fy - 2);
        return Object.assign({}, o, { box: [nx, ny, Math.min(x + a, fx + fw + 2) - nx, Math.min(y + b, fy + fh + 2) - ny, z, r] });
      });
    }

    var w = current.coordinateSystem.width, h = current.coordinateSystem.height;
    var c = Math.cos(angle), s = Math.sin(angle), st = Math.sin(tilt), ct = Math.cos(tilt);
    var verts = [], faces = [];
    function projectRaw(x, y, z) { return [c * x - s * y, (s * x + c * y) * st - z * ct, (s * x + c * y) * ct + z * st]; }

    var cutaway = $('cutaway').checked;
    objects.forEach(function (o) {
      var x = o.box[0], y = o.box[1], a = o.box[2], b = o.box[3], z = o.box[4], rise = o.box[5];
      var iswall = o.material === 'wall' || o.material === 'shaft';
      if (cutaway && iswall && s * (x + a / 2 - w / 2) + c * (y + b / 2 - h / 2) > 0) {
        rise = Math.min(rise, Math.max(24, rise * 0.26));
      }
      var v = [[x, y, z], [x + a, y, z], [x + a, y + b, z], [x, y + b, z],
               [x, y, z + rise], [x + a, y, z + rise], [x + a, y + b, z + rise], [x, y + b, z + rise]]
        .map(function (p) {
          var vx = p[0], vy = p[1], vz = p[2];
          if (o.rotation) {
            var co = Math.cos(o.rotation), si = Math.sin(o.rotation);
            var dx = vx - x - a / 2, dy = vy - y - b / 2;
            vx = x + a / 2 + co * dx - si * dy;
            vy = y + b / 2 + si * dx + co * dy;
          }
          return projectRaw(vx - w / 2, vy - h / 2, vz);
        });
      verts.push.apply(verts, v);
      [[[4, 5, 6, 7], 1.02], [[0, 1, 5, 4], 0.76], [[1, 2, 6, 5], 0.88], [[2, 3, 7, 6], 0.76], [[3, 0, 4, 7], 0.88]]
        .forEach(function (pair) {
          var v2 = pair[0].map(function (i) { return v[i]; });
          var cross = (v2[1][0] - v2[0][0]) * (v2[2][1] - v2[0][1]) - (v2[1][1] - v2[0][1]) * (v2[2][0] - v2[0][0]);
          if (cross <= 0) return;
          var flat = (o.material === 'floor' || o.material === 'tile') && z + rise <= 8;
          faces.push({
            v: v2,
            depth: (flat ? -1e9 : 0) + v2.reduce(function (acc, p) { return acc + p[2]; }, 0) / 4,
            color: shade(o.color, pair[1]),
            o: o
          });
        });
    });
    if (!verts.length) return;

    var xs = verts.map(function (v) { return v[0]; }), ys = verts.map(function (v) { return v[1]; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    // 화면이 좁을수록 여백을 줄여 모형을 크게 본다
    var fit = W < 520 ? 0.96 : 0.88;
    var scale = fit * Math.min(W / (xmax - xmin), H / (ymax - ymin)) * zoom;
    var ox = W / 2 - (xmin + xmax) / 2 * scale, oy = H / 2 - (ymin + ymax) / 2 * scale;
    function screen(v) { return [ox + v[0] * scale, oy + v[1] * scale]; }

    hitFaces = []; labelHits = [];
    faces.sort(function (a, b) { return a.depth - b.depth; }).forEach(function (f) {
      var p = f.v.map(screen);
      ctx.beginPath();
      p.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.closePath();
      ctx.globalAlpha = f.o.material === 'glass' ? 0.43 : 1;
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = selected === f.o.id ? '#AF1C2A' : (f.o.material === 'glass' ? '#789ba3' : '#6e695222');
      ctx.lineWidth = selected === f.o.id ? 2 : 0.5;
      ctx.stroke();
      hitFaces.push({ p: p, o: f.o });
    });

    if ($('labels').checked && !focusRect) {
      var occupied = [];
      var small = W < 520;
      ctx.font = 'bold ' + (small ? 10 : 11) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      (current.units || []).forEach(function (u) {
        var rect = u.rect || u.clickTarget;
        if (!rect && u.polygon) rect = boundsOf(u.polygon);
        if (!rect) return;
        var label = String(u.label || u.id || '');
        var pt = screen(projectRaw(rect[0] + rect[2] / 2 - w / 2, rect[1] + rect[3] / 2 - h / 2, 0));
        var padX = small ? 5 : 10, hh = small ? 14 : 18;
        var tw = ctx.measureText(label).width + padX;
        var R = [pt[0] - tw / 2, pt[1] - hh / 2, tw, hh];
        var clash = occupied.some(function (q) {
          return R[0] < q[0] + q[2] + 3 && R[0] + R[2] > q[0] - 3 && R[1] < q[1] + q[3] + 3 && R[1] + R[3] > q[1] - 3;
        });
        if (clash) return;
        occupied.push(R);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fillRect(R[0], R[1], R[2], R[3]);
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1;
        ctx.strokeRect(R[0], R[1], R[2], R[3]);
        ctx.fillStyle = '#1c1917';
        ctx.fillText(label, pt[0], pt[1]);
        labelHits.push({ r: R, u: u });
      });
    }

    if (current.direction && current.direction.northVector) {
      drawCompass(ctx, W - 48, 48, angle, tilt, current.direction.northVector[0], current.direction.northVector[1]);
    }
  }

  function boundsOf(poly) {
    var xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
    return [Math.min.apply(null, xs), Math.min.apply(null, ys),
            Math.max.apply(null, xs) - Math.min.apply(null, xs),
            Math.max.apply(null, ys) - Math.min.apply(null, ys)];
  }
  function unitRect(u) { return u.rect || u.clickTarget || boundsOf(u.polygon); }

  function focusUnit(u) {
    focusRect = unitRect(u);
    zoom = 1; selected = null;
    $('selection').replaceChildren();
    var h = document.createElement('strong');
    h.textContent = (u.label || u.id) + (u.tenant ? ' · ' + u.tenant : ' · 호실 공간');
    var note = document.createElement('small');
    var bits = [];
    if (u.exclusiveAreaM2) bits.push('전용 ' + u.exclusiveAreaM2 + '㎡');
    if (u.supplyAreaM2) bits.push('공급 ' + u.supplyAreaM2 + '㎡');
    note.textContent = (bits.length ? bits.join(' / ') + ' · ' : '') +
      '원본 층 도면의 해당 구간입니다. 실내 상세와 변경 현황은 확인이 필요합니다.';
    $('selection').append(h, note);
    draw();
  }

  function selectAt(x, y) {
    var label = labelHits.find(function (l) {
      return x >= l.r[0] && x <= l.r[0] + l.r[2] && y >= l.r[1] && y <= l.r[1] + l.r[3];
    });
    if (label) { focusUnit(label.u); return; }
    var hit = hitFaces.slice().reverse().find(function (f) {
      var p = f.p, inside = false;
      for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
        if (((p[i][1] > y) !== (p[j][1] > y)) &&
            (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) inside = !inside;
      }
      return inside;
    });
    if (!hit) return;
    var unit = (current.units || []).find(function (u) {
      var n = (u.label || u.id);
      return hit.o.name === n + ' 바닥' || hit.o.name === n + '호 바닥';
    });
    if (unit && !focusRect) { focusUnit(unit); return; }
    selected = hit.o.id;
    $('selection').replaceChildren();
    var t = document.createElement('strong');
    t.textContent = hit.o.name;
    var a = document.createElement('small');
    a.textContent = '원본 도면 해석 · 높이와 세부 치수는 미검증';
    $('selection').append(t, a);
    draw();
  }

  $('unitSelect').onchange = function () {
    var units = (current.units || []).filter(function (u) { return u.rect || u.clickTarget || u.polygon; });
    if ($('unitSelect').value === '') { focusRect = null; zoom = 1; clearPick(); draw(); }
    else focusUnit(units[Number($('unitSelect').value)]);
  };

  canvas.onpointerdown = function (e) {
    canvas.setPointerCapture(e.pointerId);
    points.set(e.pointerId, [e.clientX, e.clientY]);
    dragState = { x: e.clientX, y: e.clientY, angle: angle, tilt: tilt, moved: false };
    if (points.size === 2) {
      var v = Array.from(points.values());
      pinchDistance = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]);
    }
  };
  canvas.onpointermove = function (e) {
    if (!points.has(e.pointerId)) return;
    points.set(e.pointerId, [e.clientX, e.clientY]);
    if (points.size === 2) {
      var v = Array.from(points.values());
      var d = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]);
      if (pinchDistance) zoom = Math.max(0.4, Math.min(5, zoom * d / pinchDistance));
      pinchDistance = d;
      if (dragState) dragState.moved = true;
      draw();
    } else if (dragState) {
      var dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) dragState.moved = true;
      angle = dragState.angle + dx * 0.009;
      tilt = Math.max(0.30, Math.min(Math.PI / 2, dragState.tilt + dy * 0.006));
      draw();
    }
  };
  function finish(e) {
    if (dragState && !dragState.moved && points.size === 1) {
      var r = canvas.getBoundingClientRect();
      selectAt(e.clientX - r.left, e.clientY - r.top);
    }
    points.delete(e.pointerId); pinchDistance = null; dragState = null;
  }
  canvas.onpointerup = finish;
  canvas.onpointercancel = function (e) { points.delete(e.pointerId); dragState = null; pinchDistance = null; };
  canvas.onwheel = function (e) {
    e.preventDefault();
    zoom = Math.max(0.4, Math.min(5, zoom * Math.exp(-e.deltaY * 0.001)));
    draw();
  };

  $('building').onchange = fillPlans;
  $('plan').onchange = pick;
  $('reset').onclick = function () { focusRect = null; $('unitSelect').value = ''; angle = -0.30; tilt = 0.78; zoom = 1; clearPick(); draw(); };
  $('top').onclick = function () { angle = 0; tilt = Math.PI / 2; zoom = 1; draw(); };
  $('zoomIn').onclick = function () { zoom = Math.min(5, zoom * 1.2); draw(); };
  $('zoomOut').onclick = function () { zoom = Math.max(0.4, zoom / 1.2); draw(); };
  $('cutaway').onchange = draw;
  $('labels').onchange = draw;
  new ResizeObserver(draw).observe(canvas);

  // 주소로 바로 열기: ?p=P004 (도면 번호) 또는 ?b=건물이름
  var params = new URLSearchParams(location.search);
  var wantPlan = params.get('p'), wantBuilding = params.get('b');
  var start = all.find(function (r) { return r.id === wantPlan; })
    || all.find(function (r) { return r.building === wantBuilding; })
    || all.find(function (r) { return r.building === '송도 AIT센터'; })
    || all[0];
  $('building').value = start.building;
  fillPlans();
  if (start.id !== $('plan').value) { $('plan').value = start.id; pick(); }
})();
