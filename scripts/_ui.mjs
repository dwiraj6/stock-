import { chromium } from 'playwright';
const B='https://stock-six-sand.vercel.app';
const email=`ui${Date.now()}@example.com`, pass='correct-horse-battery';
const b=await chromium.launch({channel:'chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,120)));

// ── sign up through the form ──
await p.goto(B+'/login?mode=signup',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
console.log('1. button says :', await p.locator('.au-submit').innerText());
await p.locator('#au-email').fill(email);
await p.locator('#au-password').fill(pass);
await p.locator('.au-submit').click();
await p.waitForTimeout(4000);
console.log('2. after signup:', p.url());

// ── is the app usable now? ──
await p.goto(B+'/app',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3000);
const head=(await p.locator('header').innerText()).replace(/\n/g,' | ');
console.log('3. masthead    :', head);
console.log('   signed in?  :', /Sign out/i.test(head) ? 'YES' : 'NO');

// ── sign out, then log back in with the same credentials ──
await p.getByRole('button',{name:/sign out/i}).click().catch(()=>{});
await p.waitForTimeout(3000);
await p.goto(B+'/login',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2200);
await p.locator('#au-email').fill(email);
await p.locator('#au-password').fill(pass);
await p.getByRole('button',{name:'Sign in'}).click();
await p.waitForTimeout(4000);
console.log('4. after login :', p.url());
const h2=(await p.locator('header').innerText().catch(()=>''))?.replace(/\n/g,' | ');
console.log('   signed in?  :', /Sign out/i.test(h2||'') ? 'YES' : 'NO');
console.log('5. errors      :', errs.length? errs.join(' | ') : 'none');
await p.screenshot({path:'.lp/prod-signedin.png'});
await b.close();
