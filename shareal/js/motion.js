/**
 * 인천홈앤비즈 움직임 (메인·주택·상가)
 *
 * 네 가지만 씁니다 — 마스크 리빌(큰 제목) · 스크롤 리빌(섹션) ·
 * 스태거(카드 목록) · 카운트업(실적 숫자).
 *
 * 규칙
 *  - "동작 줄이기"를 켠 기기에서는 아무것도 하지 않습니다.
 *  - 글과 숫자가 안 보이게 되는 일은 없어야 합니다. 숨기는 class 는 전부
 *    이 파일이 붙입니다. 이 파일이 안 돌면 그냥 예전처럼 보입니다.
 *  - 섹션이 보였는지는 스크롤할 때마다 직접 재서 판단합니다.
 *    (IntersectionObserver 는 빠르게 스크롤하면 놓쳐서 섹션이 영영 숨습니다)
 *  - 3D 도면 화면에서는 부르지 않습니다. 모형이 무거워 끊깁니다.
 */
(function () {
  'use strict';

  var reduce = false;
  try {
    reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduce = false; }
  if (reduce) return;

  function markIn(el) { el.classList.add('is-in'); }

  // ---------- 스크롤 리빌 ----------
  var pending = [];

  function sweep() {
    if (!pending.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var rest = [];
    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      var r;
      try { r = el.getBoundingClientRect(); } catch (e) { markIn(el); continue; }
      // 화면 아래쪽에 조금이라도 들어왔거나, 이미 지나쳤으면 띄웁니다
      if (r.top < vh * 0.94 || r.bottom < vh) markIn(el);
      else rest.push(el);
    }
    pending = rest;
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; sweep(); });
  }

  // ---------- 마스크 리빌 : 큰 제목을 줄 단위로 감싼다 ----------
  function buildMask(h) {
    if (h.dataset.moReady) return;
    var lines = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = lines.map(function (ln) {
      return '<span class="mo-line"><span>' + ln + '</span></span>';
    }).join('');
    h.dataset.moReady = '1';
    h.classList.add('mo-mask');
  }

  // ---------- 카운트업 : 숫자가 0부터 올라간다 ----------
  function countUp(el, to, ms) {
    var start = null;
    function step(t) {
      if (start === null) start = t;
      var k = Math.min(1, (t - start) / ms);
      var eased = 1 - Math.pow(1 - k, 3);            // ease-out
      el.textContent = String(Math.round(to * eased));
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = String(to);
    }
    requestAnimationFrame(step);
  }

  // 숫자는 다른 코드가 나중에 채웁니다. 값이 들어오면 그때 한 번만 올립니다.
  function watchNumber(el) {
    if (!el || el.dataset.moCount === 'on') return;
    el.dataset.moCount = 'on';
    var fired = false;

    function run() {
      if (fired) return;
      var raw = String(el.textContent);
      if (/\+/.test(raw)) return;                     // "240+" 같은 기본값이면 기다립니다
      var n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
      if (!n || n < 2) return;
      fired = true;
      mo.disconnect();
      countUp(el, n, 1400);
    }

    var mo = new MutationObserver(run);
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 20000);
    run();
  }

  // ---------- 켜기 ----------
  function start() {
    var hero = document.querySelector('[data-mo="mask"]');
    if (hero) {
      buildMask(hero);
      requestAnimationFrame(function () { markIn(hero); });
    }

    // 히어로 안쪽 — 스크롤을 기다리지 않고 바로 순서대로
    var leads = document.querySelectorAll('[data-mo="lead"]');
    Array.prototype.forEach.call(leads, function (el, i) {
      el.classList.add('mo-lead');
      el.style.transitionDelay = (0.18 + i * 0.09).toFixed(2) + 's';
      void el.offsetWidth;            // 숨긴 상태를 한 번 그리게 해야 전환이 걸립니다
      requestAnimationFrame(function () { markIn(el); });
    });

    // 섹션
    var sections = document.querySelectorAll('[data-mo="reveal"]');
    Array.prototype.forEach.call(sections, function (el) {
      el.classList.add('mo-reveal');
      pending.push(el);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    sweep();
    // 스크롤이 멈춘 뒤 한 박자 늦게 들어오는 경우와, 사진이 늦게 들어와
    // 높이가 바뀌는 경우를 위해 처음 15초 동안 주기로 훑습니다.
    var tick = setInterval(function () {
      if (!pending.length) { clearInterval(tick); return; }
      sweep();
    }, 250);
    setTimeout(function () { clearInterval(tick); }, 15000);

    // 실적 숫자
    Array.prototype.forEach.call(document.querySelectorAll('[data-mo-count]'), watchNumber);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // 카드 목록은 다른 코드가 채운 뒤에 스태거를 겁니다.
  window.Motion = {
    stagger: function (container) {
      if (!container) return;
      container.classList.remove('mo-stagger');
      void container.offsetWidth;                     // 애니메이션을 다시 돌리기 위해
      container.classList.add('mo-stagger');
      sweep();                                        // 숨어 있던 섹션이 열렸을 수 있습니다
    }
  };
})();
