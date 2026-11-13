/**
 * 매물 접수 결과 안내 (메인·주택·상가 페이지 공통)
 * 접수 내용은 문자로 전송됩니다. 휴대폰에서는 문자 앱이 열리고,
 * PC처럼 문자 앱이 없는 기기에서는 이 안내 창에서 내용을 복사해 보낼 수 있습니다.
 */
(function () {
  var SMS_DISPLAY = '010-9125-2285';
  var TEL = '032-811-2114';

  function isPhoneLike() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  window.showInquiryResult = function (text, smsUri) {
    var phone = isPhoneLike();
    var old = document.getElementById('inquiryResultModal');
    if (old) old.remove();

    var wrap = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-4');
    wrap.id = 'inquiryResultModal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'inquiryResultTitle');

    var box = el('div', 'bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8');
    var title = el('h3', 'text-xl font-extrabold text-gray-900', '문자를 보내면 접수가 끝납니다');
    title.id = 'inquiryResultTitle';
    var desc = el('p', 'mt-2 text-sm text-stone-600 leading-relaxed', phone
      ? '문자 앱이 열리면 [보내기]만 눌러 주세요. 열리지 않으면 아래 [문자로 보내기]를 눌러 주세요.'
      : 'PC에서는 문자 앱이 열리지 않습니다. 아래 내용을 복사해 ' + SMS_DISPLAY + ' 번호로 문자를 보내 주시거나, 전화로 알려 주세요.');
    var pre = el('pre', 'mt-4 p-4 rounded-2xl bg-stone-50 border border-stone-200 text-[13px] leading-relaxed text-gray-800 whitespace-pre-wrap break-words max-h-60 overflow-y-auto', text);
    pre.style.fontFamily = 'inherit';

    var actions = el('div', 'mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5');
    var copy = el('button', 'h-12 inline-flex items-center justify-center rounded-full text-[15px] font-bold ' +
      (phone ? 'border border-stone-300 bg-white text-gray-900' : 'bg-[#D4202F] text-white'), '내용 복사');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = '복사했습니다'; };
      var fallback = function () {
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        copy.textContent = '선택됨 · Ctrl+C로 복사';
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
    var sms = el('a', 'h-12 inline-flex items-center justify-center rounded-full bg-[#D4202F] text-white text-[15px] font-bold', '문자로 보내기');
    sms.href = smsUri;
    var call = el('a', 'h-12 inline-flex items-center justify-center rounded-full border border-stone-300 bg-white text-gray-900 text-[15px] font-bold', '전화 ' + TEL);
    call.href = 'tel:' + TEL;
    if (phone) { actions.appendChild(sms); actions.appendChild(copy); }
    else { actions.appendChild(copy); actions.appendChild(call); }

    var close = el('button', 'mt-4 w-full h-11 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-100', '닫기');
    close.type = 'button';
    var shut = function () { wrap.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') shut(); };
    close.addEventListener('click', shut);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) shut(); });
    document.addEventListener('keydown', onKey);

    box.appendChild(title); box.appendChild(desc); box.appendChild(pre); box.appendChild(actions); box.appendChild(close);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    (phone ? sms : copy).focus();

    if (phone) window.location.href = smsUri;   // 휴대폰: 문자 앱 바로 열기
  };
})();
