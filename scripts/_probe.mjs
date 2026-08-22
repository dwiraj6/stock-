import { chromium } from 'playwright';
const b = await chromium.launch({channel:'chrome'});
const p = await (await b.newContext()).newPage();
const logs=[];
p.on('console',m=>logs.push(`${m.type()}: ${m.text().slice(0,200)}`));
p.on('pageerror',e=>logs.push('pageerror: '+e.message.slice(0,200)));
await p.goto('https://stock-six-sand.vercel.app/login',{waitUntil:'networkidle'});
await p.waitForTimeout(3000);
// what did NEXT_PUBLIC_* get baked as?
const cfg = await p.evaluate(async () => {
  const out = {};
  for (const s of [...document.scripts]) {
    if (!s.src) continue;
    try {
      const t = await (await fetch(s.src)).text();
      const m = t.match(/stock-963fa[a-z0-9.\-]*/g);
      if (m) out[s.src.split('/').pop()] = [...new Set(m)];
    } catch {}
  }
  return out;
});
console.log('project id found in bundles:', JSON.stringify(cfg,null,1) || 'NONE');
console.log('google button:', await p.getByRole('button',{name:/Continue with Google/i}).count());
console.log('redirect link:', await p.locator('a.au-google').count());
console.log('console:', logs.length? logs.join('\n  ') : 'clean');
await b.close();
