// Dev helper: screenshot the local game and print console output.
// Usage: node tools/shot.mjs "<query>" out.png [waitMs] [js-to-eval-after-load] [js-to-eval-before-shot]
// Software WebGL (SwiftShader) is slow, so the viewport is small and timeouts are long.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , query = '', out = 'shot.png', wait = '6000', evalJs, evalJs2] = process.argv;
const W = Number(process.env.SHOT_W || 960), H = Number(process.env.SHOT_H || 540);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`.slice(0, 500)));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message} ${e.stack || ''}`.slice(0, 900)));
await page.goto(`http://localhost:${process.env.PORT || 8123}/index.html${query}`);
await page.waitForTimeout(Number(wait));
if (evalJs) { try { console.log('eval:', JSON.stringify(await page.evaluate(evalJs))); } catch (e) { console.log('eval error', e.message); } await page.waitForTimeout(Number(process.env.AFTER || 4000)); }
if (evalJs2) { try { console.log('eval2:', JSON.stringify(await page.evaluate(evalJs2))); } catch (e) { console.log('eval2 error', e.message); } }
await page.screenshot({ path: out, timeout: 180000 });
console.log(logs.slice(0, 60).join('\n'));
await browser.close();
