const {chromium}=require('C:/Users/julachok/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/julachok/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:1200,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://xhkyaasgezqalsymnryg.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
await page.goto('http://127.0.0.1:8610/#/dashboard');await page.waitForSelector('.daily-plan');
await page.evaluate(()=>{S.lastPretest={scorePct:75,predictedGpa:3.8};render();});
assert.ok(!(await page.locator('#app').innerText()).includes('คาด A-Level'));
await page.evaluate(()=>Learning.start('real'));await page.getByRole('button',{name:'ดูตัวอย่างที่ทำให้ดู'}).click();
assert.ok(await page.locator('.katex').count()>0);
await page.getByRole('button',{name:'ลองทำพร้อมคำใบ้',exact:true}).click();
await page.getByRole('button',{name:'ขอคำใบ้',exact:true}).click();
await page.locator('#learnAnswer').fill(String(await page.evaluate(()=>Learning.session.guided.a)));
await page.getByRole('button',{name:'ตรวจคำตอบ',exact:true}).click();
await page.getByRole('button',{name:'พร้อมแล้ว ทำเอง 5 ข้อ'}).click();
const firstIds=await page.evaluate(()=>Learning.session.questions.map(q=>q.id));
for(let i=0;i<5;i++){
 await page.locator('#learnAnswer').fill(String(await page.evaluate(()=>Learning.session.questions[Learning.session.i].a)));
 await page.getByRole('button',{name:'ตรวจคำตอบ',exact:true}).click();
 if(i===0)await page.getByRole('button',{name:'โจทย์หรือเฉลยมีปัญหา',exact:true}).click();
 await page.getByRole('button',{name:i===4?'ดูสรุป':'ข้อถัดไป',exact:true}).click();
}
assert.ok((await page.locator('#app').innerText()).includes('4/5'));
assert.equal(await page.evaluate(()=>Learning.data().events.length),1);
assert.equal(await page.evaluate(()=>Learning.evidence('real').state),'review');
await page.getByRole('button',{name:'กลับแผนวันนี้',exact:true}).click();
await page.screenshot({path:'work/learning-upgrade/dashboard.png',fullPage:true});
await page.evaluate(()=>{const d=Learning.data();d.events[0].at=Date.now()-86400001;Learning.save(d);Learning.start('real');});
assert.equal(await page.evaluate(()=>Learning.session.stage),'independent');
assert.ok((await page.evaluate(()=>Learning.session.questions.map(q=>q.id))).every(id=>!firstIds.includes(id)));
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'work/learning-upgrade/mobile.png',fullPage:true});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
// Unverified drill answers remain practice only, with no timed auto-advance.
await page.evaluate(()=>{DRILL={topicId:'real',kind:'practice',qs:[{q:'2+2',t:'num',a:4,_ai:true}],i:0,marks:[],sus:{fast:0,blurs:0,pastes:0}};drillQuestion(document.querySelector('#app'));});
await page.locator('#dAns').fill('4');await page.getByRole('button',{name:'ตรวจ / ข้อถัดไป'}).click();
assert.equal(await page.evaluate(()=>DRILL.marks[0]),null);assert.equal(await page.evaluate(()=>DRILL.i),0);
await page.evaluate(()=>{DRILL={topicId:'real',subId:'real:k0',kind:'sub',qs:Array(12).fill({}),marks:Array(12).fill(false),startedAt:Date.now(),sus:{fast:0,blurs:0,pastes:0}};drillDone(document.querySelector('#app'));});
assert.equal(await page.evaluate(()=>S.subProgress['real:k0'].done),false);
assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS: full five-stage lesson, math rendering, help/report handling, saved evidence, delayed fresh review, mobile layout, honest diagnostics, unverified drill exclusion and failure cannot complete a sublesson');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
