/**
 * 손님 붙여넣기 등록 (매물장 → 손님 탭)
 *
 * 손님 정보(이름·연락처)는 공개 파일에 넣을 수 없으므로, 정해진 양식의 글을 붙여 넣으면
 * 이 기기의 매물장(브라우저 저장소)에만 저장합니다. 양식은 .claude/skills/sonnim-register 참고.
 *
 *   [손님등록]
 *   구분: 매매(실거주)
 *   이름: 홍길동
 *   연락처: 010-1234-5678
 *   희망지역: 송도동
 *   ...
 *   ---            ← 여러 명이면 줄을 긋고 이어서
 */
(function () {
  // 화면 표기(임대/매매) → 저장 값(임차/매수)
  var TYPE_MAP = {
    '매매(실거주)': '매수(실거주)', '매매(투자)': '매수(투자)', '매매': '매수(실거주)',
    '임대(월세)': '임차(월세)', '임대(전세)': '임차(전세)', '임대': '임차(월세)',
    '상가창업(임대)': '상가창업(임차)', '상가임대': '상가창업(임차)',
    '상가·사무실': '상가·사무실', '상가사무실': '상가·사무실',
    '분양권/전매': '분양권/전매', '분양권': '분양권/전매', '기타': '기타',
    '매수(실거주)': '매수(실거주)', '매수(투자)': '매수(투자)', '임차(월세)': '임차(월세)',
    '임차(전세)': '임차(전세)', '상가창업(임차)': '상가창업(임차)'
  };
  var STATUSES = ['상담중', '투어예정', '계약완료', '보류'];
  var KEYS = {
    '구분': 'type', '이름': 'name', '성함': 'name', '연락처': 'phone', '전화': 'phone', '상태': 'status',
    '희망지역': 'preferredRegion', '희망유형': 'preferredType', '예산': 'budget', '입주시기': 'moveInDate',
    '추천매물': 'recommendedProps', '미팅일': 'meetingDate', '미팅메모': 'meetingMemo', '메모': 'memo'
  };

  function digits(s) { return String(s || '').replace(/\D/g, ''); }

  function parse(text) {
    var blocks = String(text).split(/^\s*(?:-{3,}|\[손님등록\])\s*$/m);
    var out = [];
    blocks.forEach(function (block) {
      var c = {}, errors = [], seen = false;
      block.split(/\r?\n/).forEach(function (line) {
        var m = line.match(/^\s*([^:：]+?)\s*[:：]\s*(.*)$/);
        if (!m) return;
        var key = KEYS[m[1].replace(/\s/g, '')];
        if (!key) return;
        seen = true;
        c[key] = m[2].trim();
      });
      if (!seen) return;
      var rawType = (c.type || '').replace(/\s/g, '');
      c.type = TYPE_MAP[rawType];
      if (!c.name) errors.push('이름이 없습니다');
      if (!c.phone) errors.push('연락처가 없습니다');
      if (!c.type) errors.push('구분을 알 수 없습니다' + (rawType ? ' (' + rawType + ')' : ''));
      if (c.status && STATUSES.indexOf(c.status) === -1) errors.push('상태는 ' + STATUSES.join(' / ') + ' 중 하나여야 합니다');
      if (c.meetingDate) {
        var d = c.meetingDate.match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?$/);
        if (!d) errors.push('미팅일은 2026-11-20 14:00 형식으로 적어 주세요');
        else c.meetingDate = d[1] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[3]).slice(-2) + 'T' + ('0' + (d[4] || '10')).slice(-2) + ':' + (d[5] || '00');
      }
      out.push({ client: c, errors: errors });
    });
    return out;
  }

  function label(type) { return String(type || '').replace(/임차/g, '임대').replace(/매수/g, '매매'); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  window.openClientImportModal = function () {
    var old = document.getElementById('clientImportModal');
    if (old) old.remove();
    var wrap = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-4');
    wrap.id = 'clientImportModal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    var box = el('div', 'bg-white rounded-2xl shadow-2xl max-w-xl w-full p-5 sm:p-6');
    box.appendChild(el('h3', 'text-lg font-bold text-slate-900', '손님 붙여넣기 등록'));
    box.appendChild(el('p', 'mt-1 text-xs text-slate-600 leading-relaxed',
      '정리된 손님 정보를 그대로 붙여 넣으세요. 이 기기의 매물장에만 저장되고, 홈페이지 공개 파일에는 올라가지 않습니다.'));
    var ta = el('textarea', 'mt-3 w-full h-48 text-xs border border-slate-300 rounded-xl p-3 font-mono');
    ta.placeholder = '[손님등록]\n구분: 매매(실거주)\n이름: 홍길동\n연락처: 010-1234-5678\n희망지역: 송도동\n희망유형: 아파트 34평\n예산: 매매 6억 이하\n메모: 남향 선호\n---\n구분: 임대(월세)\n이름: …';
    box.appendChild(ta);
    var preview = el('div', 'mt-3 text-xs space-y-1 max-h-40 overflow-y-auto');
    box.appendChild(preview);
    var row = el('div', 'mt-4 flex items-center justify-end gap-2');
    var cancel = el('button', 'px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl', '닫기');
    cancel.type = 'button';
    var save = el('button', 'px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50', '등록');
    save.type = 'button';
    save.disabled = true;
    row.appendChild(cancel); row.appendChild(save);
    box.appendChild(row);
    wrap.appendChild(box);
    document.body.appendChild(wrap);

    var ready = [];
    function refresh() {
      var existing = getStoredClients();
      var phones = {};
      existing.forEach(function (c) { if (digits(c.phone)) phones[digits(c.phone)] = c.name; });
      preview.textContent = '';
      ready = [];
      parse(ta.value).forEach(function (r, i) {
        var c = r.client, msg, cls;
        var dup = digits(c.phone) && phones[digits(c.phone)];
        if (r.errors.length) { msg = '✕ ' + (c.name || (i + 1) + '번째') + ': ' + r.errors.join(', '); cls = 'text-rose-600 font-bold'; }
        else if (dup) { msg = '– ' + c.name + ': 같은 연락처의 손님(' + dup + ')이 이미 있어 건너뜁니다'; cls = 'text-amber-700'; }
        else { msg = '✓ ' + c.name + ' · ' + label(c.type) + (c.preferredRegion ? ' · ' + c.preferredRegion : '') + (c.budget ? ' · ' + c.budget : ''); cls = 'text-emerald-700'; ready.push(c); phones[digits(c.phone)] = c.name; }
        preview.appendChild(el('div', cls, msg));
      });
      save.disabled = ready.length === 0;
      save.textContent = ready.length ? ready.length + '명 등록' : '등록';
    }
    ta.addEventListener('input', refresh);

    function shut() { wrap.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') shut(); }
    document.addEventListener('keydown', onKey);
    cancel.addEventListener('click', shut);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) shut(); });

    save.addEventListener('click', function () {
      var user = (typeof USERS !== 'undefined' && USERS[currentUserKey]) || { id: 'user_admin', name: '유수정' };
      var today = new Date().toISOString().split('T')[0];
      var base = Date.now();
      var added = ready.map(function (c, i) {
        return {
          id: 'C-' + today.slice(0, 4) + '-' + String(base + i).slice(-6),
          name: c.name, phone: c.phone, type: c.type, status: c.status || '상담중',
          preferredType: c.preferredType || '', preferredRegion: c.preferredRegion || '', budget: c.budget || '',
          moveInDate: c.moveInDate || '', recommendedProps: c.recommendedProps || '',
          nextMeeting: { date: c.meetingDate || '', memo: c.meetingMemo || '' },
          memo: c.memo || '', createdById: user.id, createdByName: user.name, createdAt: today
        };
      });
      saveClients(added.concat(getStoredClients()));
      shut();
      if (typeof refreshAll === 'function') refreshAll();
      alert(added.length + '명의 손님이 등록되었습니다.\n매매 손님 / 임대 손님 탭에서 확인하세요.');
    });
    ta.focus();
  };
})();
