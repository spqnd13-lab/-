/**
 * 매물 ↔ 건물 3D 도면 연결.
 *
 * 3d/viewer-data.js 의 목록(PLAN_CATALOG)만 읽어서, 이 매물이 어느 건물·몇 층
 * 도면에 해당하는지 찾아 줍니다. 무거운 모형 파일은 도면 페이지에서만 불러옵니다.
 *
 *   Plan3D.findFor(property)  → { id, building, planLabel, level } 또는 null
 *   Plan3D.href(found)        → 'floorplan.html?p=P004'
 */
(function () {
  // 건물 이름 ↔ 매물 제목·주소에서 찾을 낱말 (모두 들어 있어야 맞는 것으로 봄)
  var MATCH = {
    '더샵송도트리플타워 이스트': ['트리플', '이스트'],
    '더샵송도트리플타워 웨스트': ['트리플', '웨스트'],
    '트리플타워 이스트·웨스트': ['트리플타워'],
    '송도오네스타': ['오네스타'],
    '송도 AIT센터': ['AIT'],
    '송도AT센터': ['AT센터'],
    '송도GTX센트럴': ['GTX'],
    '롯데캐슬캠퍼스타운': ['캠퍼스타운'],
    '송도캐슬센트럴파크': ['캐슬센트럴파크'],
    '송도아메리칸타운더샵': ['아메리칸타운더샵'],
    '송도 아메리칸타운2': ['아메리칸타운2'],
    '송도아트포레': ['아트포레'],
    '더샵 송도 엘테라스': ['엘테라스'],
    '송도중앙타워': ['중앙타워'],
    '롯데몰송도캐슬파크': ['캐슬파크']
  };

  function squash(s) { return String(s || '').replace(/[\s·()\-_,]/g, '').toUpperCase(); }

  // 동호수에서 층 뽑기: 708호 → 7, 1127호 → 11, B01호 → 지하
  function levelOf(p) {
    var t = String((p && (p.dongHo || p.title)) || '');
    var m = t.match(/(?:^|[^0-9])(\d{3,4})\s*호/);
    if (!m) return null;
    var n = m[1];
    return Number(n.length === 4 ? n.slice(0, 2) : n.slice(0, 1));
  }

  function findFor(p) {
    if (!p || !window.PLAN_CATALOG) return null;
    var text = squash((p.title || '') + ' ' + (p.address || '') + ' ' + (p.dongHo || ''));
    var building = null;
    Object.keys(MATCH).forEach(function (name) {
      if (building && MATCH[name].length <= MATCH[building].length) return;
      var ok = MATCH[name].every(function (word) { return text.indexOf(squash(word)) !== -1; });
      if (ok) building = name;
    });
    if (!building) return null;

    var plans = window.PLAN_CATALOG.filter(function (r) { return r.building === building; });
    if (!plans.length) return null;

    var level = levelOf(p);
    var hit = null;
    if (level) hit = plans.find(function (r) { return (r.levels || []).indexOf(level) !== -1; });
    // 층별 도면이 없으면, 호실이 표시된 배치도를 먼저 보여 줌
    if (!hit) hit = plans.find(function (r) { return (r.units || []).length > 1; });
    if (!hit) hit = plans[0];
    return { id: hit.id, building: building, planLabel: hit.planLabel, level: level };
  }

  function href(found) { return found ? 'floorplan.html?p=' + encodeURIComponent(found.id) : 'floorplan.html'; }


  // The verified retail plans cover only the first two floors of each tower.
  function tripleTowerHref(p) {
    if (!p) return null;
    const locationText = squash([p.title, p.address, p.dongHo].join(' '));
    if (!/트리플타워|TRIPLETOWER/.test(locationText)) return null;
    const east = /이스트|EAST|SM1(?!\d)/.test(locationText);
    const west = /웨스트|WEST|SM3(?!\d)/.test(locationText);
    if (east === west) return null;
    const wing = east ? 'e' : 'w';
    const roomText = String(p.dongHo || '');
    const candidates = [...(roomText + ' ' + (p.title || '')).matchAll(/(?:^|[^0-9])([0-9]{3,4})\s*호/g)].map(m => Number(m[1]));
    if (/^\s*\d{3,4}\s*$/.test(roomText)) candidates.push(Number(roomText));
    if (new Set(candidates).size > 1) return null;
    const room = candidates[0];
    const floorText = String(p.floor || '').split('/')[0].trim();
    if (/지하|B\s*\d/i.test([floorText,roomText].join(' '))) return null;
    const declared = floorText.match(/^(?:지상\s*)?(\d+)\s*(?:층|$)/);
    const floor = declared ? Number(declared[1]) : Math.floor(room / 100);
    if (floor !== 1 && floor !== 2) return null;
    const lastRoom = east ? [0,162,226][floor] : [0,148,225][floor];
    if (room != null && (room <= floor * 100 || room > lastRoom)) return null;
    const query = new URLSearchParams({wing, floor: String(floor)});
    if (room != null) query.set('unit', String(room));
    return 'triple-tower.html?' + query;
  }

  window.Plan3D = { tripleTowerHref, findFor: findFor, href: href, levelOf: levelOf };
})();

