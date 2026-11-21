/* AIT 1층 원본 대조선의 입체 보기. 높이는 실측값이 아닙니다. */
(function () {
  'use strict';
  const canvas = document.getElementById('model');
  const plan = document.getElementById('plan');
  if (!canvas || !plan) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new Image();
  img.src = 'images/plans/ait-1f.png';
  let angle = -.38, zoom = 1, drag = null;

  // 원본 위에서 수작업 대조한 SVG 경계선을 샘플링한다.
  const walls = [];
  plan.querySelectorAll('path.line, path.core').forEach(path => {
    const length = path.getTotalLength();
    const pieces = Math.ceil(length / 28);
    let a = path.getPointAtLength(0);
    for (let i = 1; i <= pieces; i++) {
      const b = path.getPointAtLength(length * i / pieces);
      const step = Math.hypot(b.x - a.x, b.y - a.y);
      if (step > .5 && step < 36)
        walls.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, partition: path.classList.contains('partition') });
      a = b;
    }
  });
  const columns = Array.from(plan.querySelectorAll('#columns rect')).map(r => ({
    x: Number(r.getAttribute('x')) + 4, y: Number(r.getAttribute('y')) + 4
  }));
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const c = Math.cos(angle), s = Math.sin(angle), scale = Math.min(w / 1840, h / 720) * zoom;
    const at = (x, y, z = 0) => ({
      x: w / 2 + ((x - 850) * c - (y - 345) * s) * scale,
      y: h * .61 + ((x - 850) * s + (y - 345) * c) * scale * .50 - z * scale
    });
    if (img.complete && img.naturalWidth) {
      const o = at(0, 0);
      ctx.save();
      ctx.setTransform(dpr * c * scale, dpr * s * scale * .50,
        -dpr * s * scale, dpr * c * scale * .50, dpr * o.x, dpr * o.y);
      ctx.globalAlpha = .72;
      ctx.drawImage(img, 0, 0, 1699, 691);
      ctx.restore();
    }
    const parts = walls.map(v => ({ ...v, depth: at((v.x1 + v.x2) / 2, (v.y1 + v.y2) / 2).y }));
    columns.forEach(v => parts.push({ ...v, column: true, depth: at(v.x, v.y).y }));
    parts.sort((a, b) => a.depth - b.depth);
    parts.forEach(v => {
      if (v.column) {
        const a = at(v.x - 4, v.y - 4), b = at(v.x + 4, v.y - 4);
        const topA = at(v.x - 4, v.y - 4, 55), topB = at(v.x + 4, v.y - 4, 55);
        ctx.fillStyle = '#26354a';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.lineTo(topB.x, topB.y); ctx.lineTo(topA.x, topA.y); ctx.closePath(); ctx.fill();
        return;
      }
      const a = at(v.x1, v.y1), b = at(v.x2, v.y2);
      const upperB = at(v.x2, v.y2, 55), upperA = at(v.x1, v.y1, 55);
      ctx.fillStyle = v.partition ? 'rgba(142,36,64,.72)' : 'rgba(27,39,64,.72)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(upperB.x, upperB.y); ctx.lineTo(upperA.x, upperA.y); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = '#17233b'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText('1층 원본 이미지와 수작업 대조한 골격 · 높이/치수 미검증', 12, h - 14);
  }
  img.onload = draw;
  window.addEventListener('resize', draw);
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, angle }; });
  canvas.addEventListener('pointermove', e => { if (drag) { angle = drag.angle + (e.clientX - drag.x) / 260; draw(); } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); zoom = Math.max(.6, Math.min(2.5, zoom * (e.deltaY > 0 ? .9 : 1.1))); draw();
  }, { passive: false });
  draw();
})();
