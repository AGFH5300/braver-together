import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const processes=[];
function start(args,env={}){const p=spawn(process.execPath,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});processes.push(p);let errors='';p.stderr.on('data',d=>errors+=d);p.on('exit',code=>{if(code)console.error(errors.slice(-1500));});return p;}
async function wait(url){for(let i=0;i<100;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Local fixture server did not start.');}
try{
 start(['scripts/preview-fixtures.mjs']);await wait('http://127.0.0.1:54321/rest/v1/competitions');
 start(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3100'],{VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_local_fixture'});await wait('http://127.0.0.1:3100');
 for(const path of ['/','/about','/competitions','/competitions/digital-legal-rights-essay-2026','/advisors','/privacy','/safety','/community-guidelines','/decoder','/resources']){
  const r=await fetch('http://127.0.0.1:3100'+path);const html=await r.text();assert.equal(r.status,200,path);assert.ok(!html.includes("This page didn&#x27;t load"),path);assert.ok(html.includes('rel="canonical"'),path+' canonical');assert.ok(!html.includes('sb_secret_local_fixture'),path+' secrets');assert.ok(!html.includes('href="/news"')&&!html.includes('href="/team"'),path+' stale links');
  if(path==='/advisors'){assert.ok(html.includes('Qurratulain Azza Kazmi'));assert.ok(html.includes('/advisors/maliha-320.webp'));}
  if(path.includes('/competitions/')){assert.ok(html.includes('1,500'));assert.ok(html.replace(/<!--.*?-->/g, '').includes('Prompt 4'));}
  console.log('SSR passed',path);
 }
 for(const path of ['/auth','/messages']){const html=await (await fetch('http://127.0.0.1:3100'+path)).text();assert.ok(html.includes('noindex'),path);console.log('Private noindex passed',path);}
 for(const path of ['/team','/news']){const r=await fetch('http://127.0.0.1:3100'+path,{redirect:'manual'});assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/about');}
 const xml=await (await fetch('http://127.0.0.1:3100/sitemap.xml')).text();assert.ok(xml.includes('/competitions/digital-legal-rights-essay-2026'));assert.ok(!xml.includes('/messages'));console.log('Sitemap and redirects passed');
 for(const path of ['/favicon.svg','/social-card.png','/robots.txt','/advisors/maliha-160.webp'])assert.equal((await fetch('http://127.0.0.1:3100'+path)).status,200,path);
 console.log('Public assets passed. This test checks server HTML, not browser interaction.');
}finally{for(const p of processes)p.kill('SIGTERM');}
