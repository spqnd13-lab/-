/**
 * 건물 → 층 → 호실 → 매물 탐색.
 *
 * 읽기만 합니다. 매물 데이터(INITIAL_PROPERTY_DATA), 도면 목록(PLAN_CATALOG),
 * 연결표(BUILDING_LINKS)를 참조해 화면을 만듭니다.
 * 연결표에 없는 호실은 매물을 추측해 잇지 않고 '도면 준비 중'으로 둡니다.
 * 공개 데이터만 다루므로 연락처·비공개 메모는 어디에도 쓰지 않습니다.
 */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var LINKS = window.BUILDING_LINKS || { buildings: [], units: [] };
  var PLANS = window.PLAN_CATALOG || [];
  var PROPS = (typeof INITIAL_PROPERTY_DATA !== 'undefined' && INITIAL_PROPERTY_DATA) || [];

  var state = { buildingId: null, floorId: null, unitKey: null };

  function building(id) {
    return LINKS.buildings.filter(function (b) { return b.buildingId === id; })[0] || null;
  }
  function planOf(id) { return PLANS.filter(function (p) { return p.id === id; })[0] || null; }
  function listing(id) { return PROPS.filter(function (p) { return p.id === id; })[0] || null; }

  function linkFor(b, floorId, label, wingId) {
    return (LINKS.units || []).filter(function (u) {
      return u.buildingId === b && u.floorId === floorId && u.planUnitLabel === label
        && (!wingId || !u.wingId || u.wingId === wingId);
    })[0] || null;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function badge(kind) {
    var cls = kind === '확인됨' ? 'xp-badge ok' : (kind === '참고' ? 'xp-badge ref' : 'xp-badge');
    return el('span', cls, kind);
  }
  function won(v) { return (v || v === 0) ? Number(v).toLocaleString('ko-KR') + '만원' : '-'; }

  // ── 건물 ────────────────────────────────────────────────────────────
  function renderBuilding(b) {
    var hero = $('buildingHero');
    hero.replaceChildren();
    if (b.image) {
      var img = el('img');
      img.src = b.image;
      img.alt = b.name + ' 외관';
      img.loading = 'lazy';
      img.onerror = function () { img.remove(); };
      hero.appendChild(img);
    }
    var cap = el('figcaption');
    cap.appendChild(el('b', null, b.name));
    cap.appendChild(el('small', null, b.address + ' · 지상 ' + b.floorsAboveGround + '층'));
    hero.appendChild(cap);
  }

  function renderFloors(b) {
    var host = $('floorList');
    host.replaceChildren();
    var have = {};
    (b.floors || []).forEach(function (f) { have[f.floorId] = f; });
    for (var n = b.floorsAboveGround; n >= 1; n--) {
      var f = have[String(n)];
      var btn = el('button');
      btn.type = 'button';
      btn.appendChild(el('span', null, n + '층'));
      if (f) {
        var units = countUnits(f);
        btn.appendChild(el('small', null, units ? units + '실' : '도면'));
        btn.setAttribute('aria-pressed', state.floorId === f.floorId ? 'true' : 'false');
        btn.dataset.floor = f.floorId;
        btn.addEventListener('click', go.bind(null, { floorId: f.floorId, unitKey: null }));
      } else {
        btn.appendChild(el('small', null, '준비 중'));
        btn.disabled = true;
        btn.title = '이 층은 도면 자료가 없습니다';
      }
      host.appendChild(btn);
    }
  }

  function countUnits(f) {
    var n = 0;
    (f.plans || []).forEach(function (pl) {
      var p = planOf(pl.planId);
      if (p) n += (p.units || []).length;
    });
    return n;
  }

  // ── 호실 ────────────────────────────────────────────────────────────
  function renderUnits(b) {
    var host = $('unitWrap');
    host.replaceChildren();
    var f = (b.floors || []).filter(function (x) { return x.floorId === state.floorId; })[0];
    if (!f) {
      host.appendChild(el('div', 'xp-empty', '왼쪽에서 층을 먼저 골라 주세요.'));
      return;
    }
    (f.plans || []).forEach(function (pl) {
      var p = planOf(pl.planId);
      var head = el('div');
      head.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 10px';
      head.appendChild(el('b', null, pl.usage));
      head.appendChild(badge(f.confidence || '참고'));
      if (pl.note) {
        var note = el('small', null, pl.note);
        note.style.cssText = 'font-size:11px;color:var(--muted);font-weight:700';
        head.appendChild(note);
      }
      host.appendChild(head);

      var list = (p && p.unitsDetail && p.unitsDetail.length)
        ? p.unitsDetail
        : ((p && p.units) || []).map(function (l) { return { label: l, usage: '' }; });
      if (!list.length) {
        host.appendChild(el('div', 'xp-empty', '이 평면에는 호실 구획 자료가 없습니다. 도면 준비 중입니다.'));
        return;
      }

      // 용도 → 동 (연결표의 wings 기준). 모르면 한 묶음으로 둔다.
      var wingOf = {};
      (b.wings || []).forEach(function (w) {
        (w.usage || '').split('·').forEach(function (t) {
          t = t.trim();
          if (t) wingOf[t] = w;
        });
      });

      var groups = [];
      list.forEach(function (u) {
        var w = wingOf[u.usage] || null;
        var key = w ? w.wingId : (u.usage || '기타');
        var g = groups.filter(function (x) { return x.key === key; })[0];
        if (!g) { g = { key: key, wing: w, usage: u.usage, items: [] }; groups.push(g); }
        g.items.push(u);
      });

      groups.forEach(function (g) {
        if (groups.length > 1) {
          var sub = el('div');
          sub.style.cssText = 'margin:10px 0 7px;font-size:12px;font-weight:800;color:var(--navy)';
          sub.textContent = (g.wing ? g.wing.name + ' · ' : '') + (g.usage || '');
          host.appendChild(sub);
        }
        var grid = el('div', 'xp-units');
        var seen = {};
        g.items.forEach(function (u) {
          var key = pl.planId + ':' + u.label + ':' + g.key;
          if (seen[key]) return;
          seen[key] = 1;
          var lk = linkFor(b.buildingId, f.floorId, u.label, g.wing && g.wing.wingId);
          var btn = el('button', 'xp-unit');
          btn.type = 'button';
          btn.dataset.key = key;
          btn.setAttribute('aria-pressed', state.unitKey === key ? 'true' : 'false');
          var name = el('b');
          if (lk && lk.listingId) name.appendChild(el('span', 'dot'));
          name.appendChild(document.createTextNode(lk ? lk.unitId + '호' : u.label));
          btn.appendChild(name);
          btn.appendChild(el('small', null, lk && lk.listingId ? '매물 있음' : (lk ? '연결 확인됨' : '도면 호실')));
          btn.addEventListener('click', go.bind(null, { unitKey: key }));
          grid.appendChild(btn);
        });
        host.appendChild(grid);
      });
    });
  }

  // ── 상세 ────────────────────────────────────────────────────────────
  function renderDetail(b) {
    var host = $('detailWrap');
    host.replaceChildren();
    var card = $('detailCard');
    if (!state.unitKey) {
      card.classList.remove('on');
      host.appendChild(el('div', 'xp-empty', '호실을 고르면 도면과 매물 정보가 나옵니다.'));
      return;
    }
    card.classList.add('on');
    var parts = state.unitKey.split(':');
    var planId = parts[0], label = parts[1], wingId = parts[2] || null;
    var pc = planOf(planId);
    var ud = pc && (pc.unitsDetail || []).filter(function (x) { return x.label === label; });
    var wingUsage = '';
    (b.wings || []).forEach(function (w) {
      if (w.wingId !== wingId) return;
      (ud || []).forEach(function (x) {
        if ((w.usage || '').indexOf(x.usage) !== -1) wingUsage = x.usage;
      });
    });
    var lk = linkFor(b.buildingId, state.floorId, label, wingId);
    var lst = lk && lk.listingId ? listing(lk.listingId) : null;

    var wing = (b.wings || []).filter(function (w) { return w.wingId === wingId; })[0];
    host.appendChild(el('h3', null, b.name + ' ' +
      (lk ? lk.wingId + '동 ' + lk.unitId + '호'
          : (wing ? wing.name + ' ' : '') + state.floorId + '층 ' + label)));
    var addr = el('p', 'addr', b.address);
    host.appendChild(addr);

    var tags = el('div');
    tags.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px';
    tags.appendChild(badge(lk ? lk.confidence : '참고'));
    if (lk && lk.verifiedAt) {
      var vt = el('span', 'xp-badge', '대조 ' + lk.verifiedAt);
      tags.appendChild(vt);
    }
    host.appendChild(tags);

    if (lst) {
      var price = el('div', 'xp-price');
      price.appendChild(el('em', null, lst.tradeType + ' · ' + lst.type));
      price.appendChild(el('b', null, lst.tradeType === '월세'
        ? '보증금 ' + won(lst.deposit) + ' / 월 ' + won(lst.monthlyRent)
        : won(lst.deposit)));
      host.appendChild(price);

      var facts = el('div', 'xp-facts');
      [['면적', lst.area], ['해당 층', lst.floor], ['구성', lst.roomCount],
       ['월 관리비', lst.maintenanceFee ? won(lst.maintenanceFee) : '-']].forEach(function (kv) {
        if (!kv[1]) return;
        var d = el('div');
        d.appendChild(el('em', null, kv[0]));
        d.appendChild(el('b', null, String(kv[1])));
        facts.appendChild(d);
      });
      host.appendChild(facts);

      var shots = (lst.photos || []).slice(0, 6);
      if (shots.length) {
        var g = el('div', 'xp-shots');
        shots.forEach(function (src) {
          var im = el('img');
          im.src = src; im.alt = lst.title + ' 사진'; im.loading = 'lazy';
          im.onerror = function () { im.remove(); };
          g.appendChild(im);
        });
        host.appendChild(g);
      }
      if (lst.features) host.appendChild(el('p', 'xp-feat', lst.features));
    } else {
      host.appendChild(el('div', 'xp-empty',
        lk ? '이 호실은 도면과 연결돼 있지만 현재 등록된 매물이 없습니다.'
           : '이 호실은 도면에서 읽은 구획입니다. 매물 연결 자료가 아직 없습니다.'));
    }

    var act = el('div', 'xp-act');
    var a = el('a', 'primary', '3D 도면에서 이 호실 보기');
    a.href = 'floorplan.html?p=' + encodeURIComponent(planId) + '&u=' + encodeURIComponent(label)
      + (wingUsage ? '&g=' + encodeURIComponent(wingUsage) : '');
    act.appendChild(a);
    if (lst) {
      var toList = el('a', null, '매물 목록에서 열기');
      toList.href = (lst.type === '상가' || lst.type === '사무실' || lst.type === '오피스텔'
        ? 'commercial.html' : 'housing.html') + '?open=' + encodeURIComponent(lst.id);
      act.appendChild(toList);
    }
    var tel = el('a', null, '전화 상담 032-811-2114');
    tel.href = 'tel:032-811-2114';
    act.appendChild(tel);
    host.appendChild(act);

    var note = el('p', 'xp-note');
    note.textContent = '호실 위치와 면적은 건축 도면·공부 자료를 따랐습니다. 공용부와 실내 구성은 참고용 표현이라 현장과 다를 수 있고, 실측 치수가 아닙니다.'
      + (lk && lk.planUnitLabel !== (lk && lk.unitId) ? ' 이 층은 ' + planId + ' 대표 평면을 씁니다(도면 표기 ' + label + ').' : '');
    host.appendChild(note);
  }

  // ── 상태·주소 ───────────────────────────────────────────────────────
  function renderCrumb(b) {
    var c = $('crumb');
    c.replaceChildren();
    var home = el('button', null, '건물');
    home.type = 'button';
    home.addEventListener('click', go.bind(null, { floorId: null, unitKey: null }));
    c.appendChild(home);
    c.appendChild(el('span', null, '›'));
    if (!state.floorId) { var s0 = el('span', null, b.name); s0.setAttribute('aria-current', 'page'); c.appendChild(s0); return; }
    var bb = el('button', null, b.name);
    bb.type = 'button';
    bb.addEventListener('click', go.bind(null, { floorId: null, unitKey: null }));
    c.appendChild(bb);
    c.appendChild(el('span', null, '›'));
    if (!state.unitKey) { var s1 = el('span', null, state.floorId + '층'); s1.setAttribute('aria-current', 'page'); c.appendChild(s1); return; }
    var fb = el('button', null, state.floorId + '층');
    fb.type = 'button';
    fb.addEventListener('click', go.bind(null, { unitKey: null }));
    c.appendChild(fb);
    c.appendChild(el('span', null, '›'));
    var kp = state.unitKey.split(':');
    var lk = linkFor(b.buildingId, state.floorId, kp[1], kp[2] || null);
    var s2 = el('span', null, (lk ? lk.unitId : kp[1]) + '호');
    s2.setAttribute('aria-current', 'page');
    c.appendChild(s2);
  }

  function render() {
    var b = building(state.buildingId);
    if (!b) return;
    renderBuilding(b);
    renderFloors(b);
    renderUnits(b);
    renderDetail(b);
    renderCrumb(b);
  }

  function toUrl() {
    var q = new URLSearchParams();
    q.set('b', state.buildingId);
    if (state.floorId) q.set('f', state.floorId);
    if (state.unitKey) {
      var p = state.unitKey.split(':');
      q.set('p', p[0]); q.set('u', p[1]);
      if (p[2]) q.set('w', p[2]);
    }
    return '?' + q.toString();
  }

  function go(patch, ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    history.pushState({ s: state }, '', toUrl());
    render();
  }

  function fromUrl() {
    var q = new URLSearchParams(location.search);
    var b = q.get('b') || (LINKS.buildings[0] && LINKS.buildings[0].buildingId);
    state.buildingId = building(b) ? b : (LINKS.buildings[0] || {}).buildingId;
    state.floorId = q.get('f') || null;
    var p = q.get('p'), u = q.get('u'), w = q.get('w');
    state.unitKey = (p && u) ? (p + ':' + u + (w ? ':' + w : '')) : null;
  }

  window.addEventListener('popstate', function () { fromUrl(); render(); });
  $('sheetClose').addEventListener('click', function () { go({ unitKey: null }); });

  fromUrl();
  if (!state.buildingId) {
    $('unitWrap').replaceChildren(document.createTextNode('연결 자료를 불러오지 못했습니다.'));
    return;
  }
  history.replaceState({ s: state }, '', toUrl());
  render();
})();
