import { chromium } from 'playwright';
const B='https://stock-six-sand.vercel.app';
const email=`ui${Date.now()}@example.com`, pass='correct-horse-battery';
const b=await chromium.launch({channel:'chrome'});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();

await p.goto(B+'/login?mode=signup',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.locator('#au-email').fill(email);
await p.locator('#au-password').fill(pass);
await p.locator('.au-submit').click();
await p.waitForTimeout(5000);
console.log('url after signup:', p.url());

const cookies = await ctx.cookies();
const sess = cookies.find(c=>c.name==='plumbline_session');
console.log('session cookie  :', sess ? `set (httpOnly=${sess.httpOnly}, secure=${sess.secure}, sameSite=${sess.sameSite})` : 'MISSING');

const me = await p.evaluate(async()=> (await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})).json());
console.log('api/auth/me     :', JSON.stringify(me.user));

// give the header plenty of time
await p.waitForTimeout(6000);
const head=(await p.locator('header').innerText()).replace(/\n/g,' | ');
console.log('masthead        :', head);
console.log('signed in shown :', /Sign out/i.test(head)?'YES':'NO');
await b.close();
