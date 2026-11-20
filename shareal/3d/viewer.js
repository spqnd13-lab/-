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

  var current = null, angle = -0.30, tilt = 0.78, zoom = 1, panX = 0, panY = 0;
  // 손가락으로 끌면 무엇을 할지: 휴대폰은 '이동'이 기본, 마우스는 '회전'이 기본
  var touchMode = 'pan';
  var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var wantUnit = new URLSearchParams(location.search).get('u');
  var wantUsage = new URLSearchParams(location.search).get('g');   // 같은 번호가 두 동에 있을 때 구분
  var showFloor = new URLSearchParams(location.search).get('f');   // 대표 평면을 그 층 호수로 표시

  // 7층 기준 평면의 707 → 11층에서는 1107
  function unitNo(label) {
    var m = String(label == null ? '' : label).match(/^(\d+)$/);
    if (!showFloor || !m) return String(label == null ? '' : label);
    return String(Number(showFloor)) + m[1].slice(-2);
  }
  var hitFaces = [], labelHits = [], selected = null, focusRect = null;
  var points = new Map(), dragState = null, pinchDistance = null, pinchCenter = null;
  var lastView = null;   // 화면에 그린 범위 (확대·이동 한계 계산용)

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
    var rows = all.filter(function (r) { return r.building === $('building').value; })
      .sort(function (a, b) {
        var la = (a.levels || []).length ? a.levels[0] : 9999;
        var lb = (b.levels || []).length ? b.levels[0] : 9999;
        return la - lb || a.id.localeCompare(b.id);
      });
    rows.forEach(function (r) { sel.add(new Option(r.planLabel + ' · ' + r.usageLabel, r.id)); });
    buildRail(rows);
    pick();
  }

  // 층(또는 평면) 전환 레일 — 고르는 창을 열지 않고 바로 넘길 수 있게
  function buildRail(rows) {
    var rail = $('floorRail');
    if (!rail) return;
    rail.replaceChildren();
    rail.hidden = rows.length < 2;
    rows.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.id = r.id;
      var t = document.createElement('span');
      t.textContent = r.planLabel;
      b.appendChild(t);
      var n = (r.units || []).length;
      var sub = document.createElement('small');
      sub.textContent = n > 1 ? r.usageLabel.slice(0, 10) + ' · ' + n + '실' : r.usageLabel.slice(0, 14);
      b.appendChild(sub);
      b.addEventListener('click', function () {
        if ($('plan').value === r.id) return;
        $('plan').value = r.id;
        pick();
      });
      rail.appendChild(b);
    });
    markRail();
  }

  function markRail() {
    var rail = $('floorRail');
    if (!rail) return;
    var id = $('plan').value, on = null;
    Array.prototype.forEach.call(rail.children, function (b) {
      var sel = b.dataset.id === id;
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      if (sel) on = b;
    });
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
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
    angle = -0.30; tilt = 0.78; zoom = 1; panX = panY = 0; selected = null; focusRect = null;
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
      us.add(new Option(unitNo(u.label || u.id) + (u.tenant ? ' · ' + u.tenant : ''), String(i)));
    });

    markRail();
    var q = '?p=' + encodeURIComponent(id);
    // 주소에 호실이 함께 왔으면 그 호실을 바로 확대한다
    if (wantUnit) {
      // 용도(동)가 함께 왔으면 그 용도에서만 찾는다.
      // 다른 용도로 떨어지면 같은 호수의 다른 동을 잘못 강조하게 된다.
      var hit = units.filter(function (x) {
        return String(x.label || x.id) === wantUnit
          && (!wantUsage || (x.usage || '') === wantUsage);
      });
      if (!hit.length) {
        $('selection').replaceChildren();
        var nf = document.createElement('strong');
        nf.textContent = '해당 호실을 찾지 못했습니다';
        var nd = document.createElement('small');
        nd.textContent = wantUnit + (wantUsage ? ' · ' + wantUsage : '') +
          ' 은(는) 이 도면에 없습니다. 층 전체를 보여 드립니다.';
        $('selection').append(nf, nd);
        wantUnit = null; wantUsage = null;
        history.replaceState(null, '', '?p=' + encodeURIComponent(id));
        draw();
        return;
      }
      if (hit.length) {
        var at = units.indexOf(hit[0]);
        us.value = String(at);
        q += '&u=' + encodeURIComponent(wantUnit);
        if (wantUsage) q += '&g=' + encodeURIComponent(wantUsage);
        if (showFloor) q += '&f=' + encodeURIComponent(showFloor);
        focusUnit(hit[0]);
        wantUnit = null; wantUsage = null;
        history.replaceState(null, '', q);
        return;
      }
      wantUnit = null;
    }
    if (showFloor && q.indexOf('&f=') === -1) q += '&f=' + encodeURIComponent(showFloor);
    history.replaceState(null, '', q);
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

  function rgbOf(hex) {
    return hex.match(/\w\w/g).map(function (v) { return parseInt(v, 16); });
  }
  function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function shade(hex, m) {
    return 'rgb(' + rgbOf(hex).map(function (v) { return clamp255(v * m); }).join(',') + ')';
  }
  // 멀수록 배경색에 섞어 공기감을 준다
  var HAZE = [248, 247, 244];
  function shadeFar(hex, m, far) {
    var a = rgbOf(hex);
    return 'rgb(' + a.map(function (v, i) {
      return clamp255((v * m) * (1 - far) + HAZE[i] * far);
    }).join(',') + ')';
  }

  // 빛은 화면이 아니라 장면에 고정 — 돌리면 음영이 따라 바뀐다
  var LIGHT = [-0.55, -0.83];
  var FACE_NORMAL = { 1: [0, -1], 2: [1, 0], 3: [0, 1], 4: [-1, 0] };
  function faceLight(idx) {
    if (idx === 0) return 1.06;                       // 윗면
    var n = FACE_NORMAL[idx];
    var d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1]);
    return 0.70 + 0.36 * d;
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
      [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
        .forEach(function (inds, fi) {
          var v2 = inds.map(function (i) { return v[i]; });
          var cross = (v2[1][0] - v2[0][0]) * (v2[2][1] - v2[0][1]) - (v2[1][1] - v2[0][1]) * (v2[2][0] - v2[0][0]);
          if (cross <= 0) return;
          var flat = (o.material === 'floor' || o.material === 'tile') && z + rise <= 8;
          faces.push({
            v: v2,
            depth: (flat ? -1e9 : 0) + v2.reduce(function (acc, p) { return acc + p[2]; }, 0) / 4,
            m: faceLight(fi),
            side: fi > 0,
            rise: rise,
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
    // 너무 멀리 밀어 모형을 놓치지 않도록 이동 범위를 제한한다
    var spanX = (xmax - xmin) * scale, spanY = (ymax - ymin) * scale;
    var limX = Math.max(0, (spanX - W) / 2) + W * 0.35;
    var limY = Math.max(0, (spanY - H) / 2) + H * 0.35;
    panX = Math.max(-limX, Math.min(limX, panX));
    panY = Math.max(-limY, Math.min(limY, panY));
    lastView = { scale: scale, W: W, H: H };
    function screen(v) { return [ox + v[0] * scale + panX, oy + v[1] * scale + panY]; }

    hitFaces = []; labelHits = [];
    faces.sort(function (a, b) { return a.depth - b.depth; });
    var dMin = faces.length ? faces[0].depth : 0;
    var dMax = faces.length ? faces[faces.length - 1].depth : 1;
    var dRange = (dMax - dMin) || 1;

    faces.forEach(function (f) {
      var p = f.v.map(screen);
      // 멀리 있는 면일수록 옅게 (0 = 가까움)
      var far = Math.max(0, Math.min(0.30, (1 - (f.depth - dMin) / dRange) * 0.30));
      ctx.beginPath();
      p.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.closePath();

      var glass = f.o.material === 'glass';
      if (glass) {
        // 유리: 위가 밝고 아래가 어두운 반사 느낌
        var ys = p.map(function (q) { return q[1]; });
        var gy0 = Math.min.apply(null, ys), gy1 = Math.max.apply(null, ys);
        var g = ctx.createLinearGradient(0, gy0, 0, gy1);
        g.addColorStop(0, shadeFar(f.o.color, f.m * 1.30, far));
        g.addColorStop(0.45, shadeFar(f.o.color, f.m * 1.02, far));
        g.addColorStop(1, shadeFar(f.o.color, f.m * 0.82, far));
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.72;
      } else if (f.side && f.rise > 6) {
        // 벽면: 바닥에 가까울수록 살짝 어둡게 (음영이 고이는 느낌)
        var ys2 = p.map(function (q) { return q[1]; });
        var sy0 = Math.min.apply(null, ys2), sy1 = Math.max.apply(null, ys2);
        var g2 = ctx.createLinearGradient(0, sy0, 0, sy1);
        g2.addColorStop(0, shadeFar(f.o.color, f.m * 1.05, far));
        g2.addColorStop(1, shadeFar(f.o.color, f.m * 0.86, far));
        ctx.fillStyle = g2;
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = shadeFar(f.o.color, f.m, far);
        ctx.globalAlpha = 1;
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      var on = selected === f.o.id;
      if (on) { ctx.strokeStyle = '#AF1C2A'; ctx.lineWidth = 2; ctx.stroke(); }
      else if (glass) { ctx.strokeStyle = 'rgba(70,96,104,.55)'; ctx.lineWidth = 0.6; ctx.stroke(); }
      else if (f.rise > 3) { ctx.strokeStyle = 'rgba(92,88,78,.16)'; ctx.lineWidth = 0.5; ctx.stroke(); }
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
        var label = unitNo(u.label || u.id || '');
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
    zoom = 1; panX = panY = 0; selected = null;
    $('selection').replaceChildren();
    var h = document.createElement('strong');
    h.textContent = unitNo(u.label || u.id) + (u.usage ? ' · ' + u.usage : '') +
      (u.tenant ? ' · ' + u.tenant : '');
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
    if ($('unitSelect').value === '') { focusRect = null; zoom = 1; panX = panY = 0; clearPick(); draw(); }
    else focusUnit(units[Number($('unitSelect').value)]);
  };

  function centroid() {
    var v = Array.from(points.values());
    var sx = 0, sy = 0;
    v.forEach(function (p) { sx += p[0]; sy += p[1]; });
    return [sx / v.length, sy / v.length];
  }

  canvas.onpointerdown = function (e) {
    canvas.setPointerCapture(e.pointerId);
    points.set(e.pointerId, [e.clientX, e.clientY]);
    var byTouch = e.pointerType === 'touch' || (isTouch && e.pointerType !== 'mouse');
    dragState = { x: e.clientX, y: e.clientY, angle: angle, tilt: tilt,
                  panX: panX, panY: panY, moved: false,
                  // 손가락: 기본 이동(버튼으로 회전 전환) / 마우스: 기본 회전(Shift·오른쪽은 이동)
                  pan: byTouch ? (touchMode === 'pan')
                               : (e.shiftKey || e.button === 2 || e.button === 1) };
    if (points.size === 2) {
      var v = Array.from(points.values());
      pinchDistance = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]);
      pinchCenter = centroid();
    }
  };
  canvas.onpointermove = function (e) {
    if (!points.has(e.pointerId)) return;
    points.set(e.pointerId, [e.clientX, e.clientY]);
    if (points.size === 2) {
      // 두 손가락: 벌리면 확대, 같이 끌면 이동
      var v = Array.from(points.values());
      var d = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]);
      if (pinchDistance) zoom = Math.max(0.4, Math.min(6, zoom * d / pinchDistance));
      pinchDistance = d;
      var c = centroid();
      if (pinchCenter) { panX += c[0] - pinchCenter[0]; panY += c[1] - pinchCenter[1]; }
      pinchCenter = c;
      if (dragState) dragState.moved = true;
      draw();
    } else if (dragState) {
      var dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) dragState.moved = true;
      if (dragState.pan) {
        panX = dragState.panX + dx;
        panY = dragState.panY + dy;
      } else {
        angle = dragState.angle + dx * 0.009;
        tilt = Math.max(0.30, Math.min(Math.PI / 2, dragState.tilt + dy * 0.006));
      }
      draw();
    }
  };
  function finish(e) {
    if (dragState && !dragState.moved && points.size === 1) {
      var r = canvas.getBoundingClientRect();
      selectAt(e.clientX - r.left, e.clientY - r.top);
    }
    points.delete(e.pointerId);
    if (points.size < 2) { pinchDistance = null; pinchCenter = null; }
    dragState = null;
  }
  canvas.onpointerup = finish;
  canvas.onpointercancel = function (e) {
    points.delete(e.pointerId); dragState = null; pinchDistance = null; pinchCenter = null;
  };
  canvas.oncontextmenu = function (e) { e.preventDefault(); };
  canvas.onwheel = function (e) {
    e.preventDefault();
    var before = zoom;
    zoom = Math.max(0.4, Math.min(6, zoom * Math.exp(-e.deltaY * 0.001)));
    // 커서가 가리키던 지점이 그대로 있도록 이동량을 맞춘다
    var r = canvas.getBoundingClientRect();
    var cx = e.clientX - r.left - canvas.clientWidth / 2;
    var cy = e.clientY - r.top - canvas.clientHeight / 2;
    var k = zoom / before;
    panX = (panX - cx) * k + cx;
    panY = (panY - cy) * k + cy;
    draw();
  };

  $('building').onchange = fillPlans;
  $('plan').onchange = pick;
  $('reset').onclick = function () {
    focusRect = null; $('unitSelect').value = '';
    angle = -0.30; tilt = 0.78; zoom = 1; panX = panY = 0; clearPick(); draw();
  };
  $('top').onclick = function () { angle = 0; tilt = Math.PI / 2; zoom = 1; panX = panY = 0; draw(); };
  function zoomBy(k) {
    var before = zoom;
    zoom = Math.max(0.4, Math.min(6, zoom * k));
    panX *= zoom / before; panY *= zoom / before;
    draw();
  }
  $('zoomIn').onclick = function () { zoomBy(1.25); };
  $('zoomOut').onclick = function () { zoomBy(1 / 1.25); };
  var dm = $('dragMode');
  if (dm) {
    var paint = function () {
      var pan = touchMode === 'pan';
      dm.textContent = pan ? '✋ 이동' : '🔄 돌리기';
      dm.setAttribute('aria-pressed', pan ? 'false' : 'true');
      dm.style.background = pan ? '' : '#1c1917';
      dm.style.color = pan ? '' : '#fff';
      dm.style.borderColor = pan ? '' : '#1c1917';
    };
    dm.onclick = function () { touchMode = (touchMode === 'pan') ? 'rotate' : 'pan'; paint(); };
    paint();
  }
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
