/**
 * 매물 상세 창 꾸미기 (주택·상가 페이지 공통)
 *
 * 각 페이지의 openDetailModal 이 내용을 채운 뒤에 실행되어,
 *  - 첫 사진을 맨 위 큰 사진으로 올리고 (사진을 누르면 바뀜)
 *  - 건물 도면이 등록된 매물이면 [도면 보기] 버튼을 붙입니다.
 * 모양은 css/design.css 의 .pd-* 규칙.
 */
(function () {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function findProperty(id) {
    var lists = [];
    try { if (typeof allHousingProperties !== 'undefined') lists.push(allHousingProperties); } catch (e) {}
    try { if (typeof allCommercialProperties !== 'undefined') lists.push(allCommercialProperties); } catch (e) {}
    for (var i = 0; i < lists.length; i++) {
      var hit = (lists[i] || []).find(function (p) { return p.id === id; });
      if (hit) return hit;
    }
    return null;
  }

  ready(function () {
    var modal = document.getElementById('propertyDetailModal');
    if (!modal || typeof window.openDetailModal !== 'function') return;
    var card = modal.firstElementChild;
    modal.classList.add('pd');
    card.classList.add('pd-sheet');

    // 구조에 이름 붙이기 (기존 마크업은 그대로 둠)
    var header = card.children[0], body = card.children[1], footer = card.children[2];
    header.classList.add('pd-top'); body.classList.add('pd-body'); footer.classList.add('pd-foot');
    var price = document.getElementById('modalPrice');
    if (price) price.parentElement.parentElement.classList.add('pd-price');
    body.querySelectorAll('.grid > .bg-slate-50').forEach(function (t) { t.classList.add('pd-tile'); });
    var memo = document.getElementById('modalPublicMemo');
    if (memo) memo.parentElement.classList.add('pd-card');
    var mgr = document.getElementById('modalManagerName');
    if (mgr) mgr.closest('.bg-slate-900').classList.add('pd-agent');
    var closeBtn = footer.querySelector('button'), callBtn = footer.querySelector('a[href^="tel:"]');
    if (closeBtn) closeBtn.classList.add('pd-btn');
    if (callBtn) {
      callBtn.classList.add('pd-btn', 'pd-btn-main');
      var long = callBtn.querySelector('span');           // 좁은 화면에서는 짧은 문구로
      if (long) { long.classList.add('pd-long'); var short = document.createElement('span'); short.className = 'pd-short'; short.textContent = '전화 상담'; callBtn.appendChild(short); }
    }

    // 맨 위 큰 사진
    var hero = document.createElement('div');
    hero.className = 'pd-hero';
    var heroImg = document.createElement('img');
    heroImg.alt = '';
    hero.appendChild(heroImg);
    var count = document.createElement('span');
    count.className = 'pd-count';
    hero.appendChild(count);
    body.insertBefore(hero, body.firstChild);

    // 도면 보기 버튼
    var planBtn = document.createElement('button');
    planBtn.type = 'button';
    planBtn.className = 'pd-btn pd-btn-plan';
    planBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg><span>도면 보기</span>';
    planBtn.hidden = true;
    footer.insertBefore(planBtn, callBtn || null);

    var original = window.openDetailModal;
    window.openDetailModal = function (id) {
      original.apply(this, arguments);
      var imgs = Array.prototype.slice.call(document.querySelectorAll('#modalPhotoGallery img'));
      var srcs = imgs.map(function (i) { return i.getAttribute('src'); }).filter(Boolean);
      hero.classList.toggle('is-empty', srcs.length === 0);
      heroImg.style.display = srcs.length ? '' : 'none';
      if (srcs.length) heroImg.src = srcs[0];
      heroImg.onerror = function () { hero.classList.add('is-empty'); heroImg.style.display = 'none'; };
      count.textContent = srcs.length > 1 ? '사진 ' + srcs.length + '장' : '';
      count.hidden = srcs.length < 2;
      // 사진이 한 장뿐이면 아래 작은 사진 목록은 숨김 (위 큰 사진과 같으므로)
      var section = document.getElementById('modalPhotoSection');
      if (section) section.classList.toggle('pd-hide', srcs.length < 2);
      imgs.forEach(function (im) {
        im.parentElement.classList.add('pd-thumb');
        im.parentElement.onclick = function () { heroImg.src = im.getAttribute('src'); hero.classList.remove('is-empty'); heroImg.style.display = ''; body.scrollTo({ top: 0, behavior: 'smooth' }); };
      });
      body.scrollTop = 0;

      var plan = window.Floorplan ? window.Floorplan.findFor(findProperty(id)) : null;
      planBtn.hidden = !plan;
      planBtn.onclick = plan ? function () { window.Floorplan.open(plan.key, { level: plan.level, unit: plan.unit }); } : null;
    };
  });
})();
