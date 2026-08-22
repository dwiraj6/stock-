const B = process.argv[2] || 'https://stock-six-sand.vercel.app';
const q = process.argv[3] || 'Why is the range so wide?';
const t0 = Date.now();
const res = await fetch(B+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({symbol:'RELIANCE',amount:50000,conviction:72,question:q})});
const ct = res.headers.get('content-type')||'';
console.log('model       :', res.headers.get('x-plumbline-model') || '(none — error path)');
if (ct.includes('json')) { const j = await res.json(); console.log('ERROR       :', j.code, '|', j.message); process.exit(0); }
const reader = res.body.getReader(); const dec=new TextDecoder();
let chunks=0, first=null, total='';
while(true){const {done,value}=await reader.read(); if(done)break; chunks++; if(first===null)first=Date.now()-t0; total+=dec.decode(value,{stream:true});}
console.log('first word  :', first+'ms', first<4000?'✓ feels live':'✗ too slow');
console.log('chunks      :', chunks, chunks>3?'✓ streaming':'(few chunks)');
console.log('total       :', (Date.now()-t0)+'ms |', total.length, 'chars');
console.log('citations   :', (total.match(/\[\[metric:[^\]]+\]\]/g)||[]).join(', ')||'none');
console.log('answer      :', total.slice(0,180).replace(/\s+/g,' '));
