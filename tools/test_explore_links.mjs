/**
 * 건물→층→호실 연결이 잘못된 주소로 깨지지 않는지 확인한다.
 * 사용: python3 -m http.server 8777 --directory shareal 를 띄운 뒤
 *       node tools/test_explore_links.mjs [기준주소]
 */
import { createRequire } from 'node:module';

// playwright 는 전역에 설치돼 있을 수 있어 경로를 넓게 찾는다
const require_ = createRequire(import.meta.url);
let chromium;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) {
  try { ({ chromium } = require_(p)); break; } catch (e) { /* 다음 경로 */ }
}
if (!chromium) {
  console.error('playwright 를 찾지 못했습니다. npm i -D playwright 후 다시 실행하세요.');
  process.exit(2);
}

const BASE = process.argv[2] || 'http://localhost:8777';
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  통과  ' : '  실패  ') + name + (detail ? '  — ' + detail : ''));
}

const browser = await chromium.launch();

// 1) 층에 속하지 않는 도면을 주소로 넣으면 매물이 붙으면 안 된다
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/explore.html?b=ait-center&f=11&p=P134&u=707&w=101`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const text = await p.locator('#detailWrap').innerText();
  const url = new URL(p.url()).search;
  check('11층에 없는 도면(P134)으로 들어오면 매물이 붙지 않는다',
    !/1107호/.test(text) && !/보증금/.test(text), `상세="${text.slice(0, 30).replace(/\n/g, ' ')}"`);
  check('잘못된 주소는 안전한 층 상태로 정규화된다',
    !/p=P134/.test(url) && /f=11/.test(url), `주소=${url}`);
  await p.close();
}

// 2) 없는 층·없는 호실·맞지 않는 동
for (const [label, q, want] of [
  ['없는 층(f=99)은 건물 화면으로', '?b=ait-center&f=99', s => !/f=/.test(s)],
  ['없는 호실(u=9999)은 층 화면으로', '?b=ait-center&f=11&p=P139&u=9999', s => !/u=/.test(s)],
  ['용도와 맞지 않는 동(w=102 + 지식산업센터)은 층 화면으로',
    '?b=ait-center&f=11&p=P139&u=707&w=999', s => !/w=/.test(s)],
]) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/explore.html${q}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(350);
  const url = new URL(p.url()).search;
  check(label, want(url), `주소=${url}`);
  await p.close();
}

// 3) 정상 주소는 그대로 살아 있어야 한다
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/explore.html?b=ait-center&f=11&p=P139&u=707&w=101`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const url = new URL(p.url()).search;
  const text = await p.locator('#detailWrap').innerText();
  check('정상 주소는 유지된다', /p=P139/.test(url) && /u=707/.test(url), `주소=${url}`);
  check('도면 구획이 미확인이면 호실 강조 링크를 주지 않는다',
    await p.locator('.xp-act a.primary').getAttribute('href').then(h => !/[?&]u=/.test(h)),
    await p.locator('.xp-act a.primary').getAttribute('href'));
  check('보류 사유가 화면에 보인다', /보류|확인하지 못/.test(text));
  await p.close();
}

// 4) 뷰어: 용도가 맞지 않으면 다른 동 호실을 강조하지 않는다
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/floorplan.html?p=P139&u=707&g=없는용도`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const sel = await p.locator('#selection').innerText();
  check('용도가 맞지 않으면 "찾지 못함"을 보여 준다', /찾지 못/.test(sel), sel.split('\n')[0]);
  await p.close();
}

// 5) 기존 주소 형식은 계속 동작한다
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/floorplan.html?p=P139`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1100);
  const info = await p.locator('#modelCount').innerText();
  check('기존 ?p=P139 주소가 그대로 열린다', /P139/.test(info), info);
  await p.close();
}

// 6) 360px 가로 밀림
for (const page of ['explore.html', 'floorplan.html', 'index.html', 'housing.html', 'commercial.html']) {
  const p = await browser.newPage({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`360px 가로 밀림 없음 — ${page}`, over === 0, `${over}px`);
  await p.close();
}

await browser.close();
const bad = results.filter(r => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} 통과`);
process.exit(bad.length ? 1 : 0);
