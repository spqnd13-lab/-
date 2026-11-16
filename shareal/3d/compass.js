/* 도면 방위 표시.
 * drawCompass(ctx, cx, cy, angle, tilt, nx, ny)
 *   nx, ny : 도면 좌표계에서 북쪽을 가리키는 벡터 (y는 아래로 증가)
 * 뷰어의 회전·기울기를 그대로 적용해 화면 위 북쪽 방향을 그린다.
 */
function drawCompass(ctx, cx, cy, angle, tilt, nx, ny) {
  if (typeof nx !== 'number' || typeof ny !== 'number') return;
  var len = Math.hypot(nx, ny);
  if (!len) return;
  var ux = nx / len, uy = ny / len;
  var c = Math.cos(angle), s = Math.sin(angle);
  // 평면 벡터를 뷰어와 같은 방식으로 투영 (z = 0)
  var px = c * ux - s * uy;
  var py = (s * ux + c * uy) * Math.sin(tilt);
  var pl = Math.hypot(px, py);
  if (!pl) return;
  px /= pl; py /= pl;

  var R = 21;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d6d3d1';
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 북쪽 화살표
  ctx.beginPath();
  ctx.moveTo(cx + px * (R - 4), cy + py * (R - 4));
  ctx.lineTo(cx - px * 5 - py * 5, cy - py * 5 + px * 5);
  ctx.lineTo(cx - px * 5 + py * 5, cy - py * 5 - px * 5);
  ctx.closePath();
  ctx.fillStyle = '#AF1C2A';
  ctx.fill();

  // 남쪽 꼬리
  ctx.beginPath();
  ctx.moveTo(cx - px * (R - 7), cy - py * (R - 7));
  ctx.lineTo(cx, cy);
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#44403c';
  ctx.fillText('N', cx + px * (R + 8), cy + py * (R + 8));
  ctx.restore();
}
