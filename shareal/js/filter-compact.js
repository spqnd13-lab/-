/**
 * 목록 페이지 필터를 버튼 3개(종류 · 거래 · 지역)로 줄임 (주택·상가 페이지 공통)
 *
 * 원래의 필터 버튼 줄(…-type-btn, …-trade-btn, …-region-btn)은 화면에서 숨기고 그대로 둡니다.
 * 새 버튼을 누르면 아래로 목록이 펼쳐지고, 고르면 원래 버튼을 대신 눌러 줍니다.
 * 그래서 걸러내는 기능과 건수 표시는 각 페이지의 기존 코드가 그대로 맡습니다.
 */
(function () {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  var GROUPS = [['type', '종류'], ['trade', '거래'], ['region', '지역']];

  ready(function () {
    var groups = GROUPS.map(function (g) {
      var btns = Array.prototype.slice.call(document.querySelectorAll('[class*="-' + g[0] + '-btn"]'));
      return btns.length ? { key: g[0], name: g[1], btns: btns, row: btns[0].parentElement } : null;
    }).filter(Boolean);
    if (!groups.length) return;

    var host = groups[0].row.closest('.space-y-2\\.5') || groups[0].row.parentElement.parentElement;
    document.body.classList.add('fc-on');
    groups.forEach(function (g) {            // 줄을 감쌀 때 바깥 묶음까지 숨겨 빈 자리가 남지 않게
      var top = g.row;
      while (top.parentElement && top.parentElement !== host) top = top.parentElement;
      top.classList.add('fc-src');
    });

    var bar = document.createElement('div');
    bar.className = 'fc-bar';
    var panel = document.createElement('div');
    panel.className = 'fc-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'listbox');
    var openKey = null;

    // 그림 문자(🏢 🔴 등)는 떼고 글자만
    function labelOf(btn) { var s = btn.querySelector('span'); return (s ? s.textContent : btn.textContent).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim(); }
    function countOf(btn) { var s = btn.querySelectorAll('span'); return s.length > 1 ? s[s.length - 1].textContent.trim() : ''; }
    // 고른 버튼은 페이지마다 색이 달라도(검정·파랑·남색) 글자가 흰색(text-white)입니다
    function activeOf(g) { return g.btns.filter(function (b) { return b.classList.contains('text-white'); })[0] || g.btns[0]; }

    function close() { panel.hidden = true; openKey = null; sync(); }
    function sync() {
      groups.forEach(function (g) {
        var act = activeOf(g), isDefault = act === g.btns[0];
        g.value.textContent = isDefault ? g.name : labelOf(act);
        g.button.classList.toggle('is-set', !isDefault);
        g.button.classList.toggle('is-open', openKey === g.key);
        g.button.setAttribute('aria-expanded', openKey === g.key ? 'true' : 'false');
      });
      reset.hidden = groups.every(function (g) { return activeOf(g) === g.btns[0]; });
    }
    function open(g) {
      openKey = g.key;
      panel.textContent = '';
      var act = activeOf(g);
      g.btns.forEach(function (b) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'fc-item' + (b === act ? ' is-on' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', b === act ? 'true' : 'false');
        var name = document.createElement('span'); name.textContent = labelOf(b);
        var cnt = document.createElement('span'); cnt.className = 'fc-count'; cnt.textContent = countOf(b);
        item.appendChild(name); item.appendChild(cnt);
        item.addEventListener('click', function () { b.click(); close(); g.button.focus(); });
        panel.appendChild(item);
      });
      panel.hidden = false;
      sync();
      var on = panel.querySelector('.is-on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }

    groups.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-btn';
      b.setAttribute('aria-haspopup', 'listbox');
      g.value = document.createElement('span');
      g.value.className = 'fc-value';
      var chev = document.createElement('span'); chev.className = 'fc-chev'; chev.setAttribute('aria-hidden', 'true');
      b.appendChild(g.value); b.appendChild(chev);
      b.addEventListener('click', function () { if (openKey === g.key) close(); else open(g); });
      g.button = b;
      bar.appendChild(b);
    });
    var reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'fc-reset'; reset.textContent = '초기화'; reset.hidden = true;
    reset.addEventListener('click', function () { if (typeof window.resetFilters === 'function') window.resetFilters(); close(); });
    bar.appendChild(reset);

    var wrap = document.createElement('div');
    wrap.className = 'fc-wrap';
    wrap.appendChild(bar); wrap.appendChild(panel);
    host.insertBefore(wrap, host.firstChild);

    document.addEventListener('click', function (e) { if (openKey && !wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openKey) close(); });
    // 원래 버튼이 다른 경로(초기화, 주소의 ?type= 등)로 바뀌어도 새 버튼 글자를 맞춤
    new MutationObserver(function () { if (!openKey) sync(); }).observe(host, { subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
  });
})();
