// 가로(16:10) 카드 HTML을 PNG로 굽는다.  node tools/wide_card_shot.cjs <html> <저장 폴더>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const html = path.resolve(process.argv[2]);
  const out = path.resolve(process.argv[3]);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await p.goto('file://' + html);
  await p.waitForTimeout(900);
  const n = await p.locator('.card.wide').count();
  for (let i = 0; i < n; i++) {
    const id = await p.locator('.card.wide').nth(i).getAttribute('data-id');
    await p.locator('.card.wide').nth(i).screenshot({ path: path.join(out, `wide_${id}.png`) });
    console.log(`wide_${id}.png`);
  }
  await b.close();
})();
