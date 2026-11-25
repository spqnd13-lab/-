// 카드 HTML을 PNG로 굽는다.  node tools/content_card_shot.cjs <cards.html 경로> <저장 폴더>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const html = path.resolve(process.argv[2]);
  const out = path.resolve(process.argv[3] || path.dirname(html));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await p.goto('file://' + html);
  await p.waitForTimeout(1200);
  const n = await p.locator('.card').count();
  for (let i = 0; i < n; i++) {
    const id = (await p.locator('.card').nth(i).locator('.note').innerText()).match(/P-[\w-]+/);
    const name = `card_${id ? id[0] : i + 1}.png`;
    await p.locator('.card').nth(i).screenshot({ path: path.join(out, name) });
    console.log(path.join(out, name));
  }
  await b.close();
})();
