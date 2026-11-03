/* Verified foundation practice, personal daily plans and spaced evidence. */
'use strict';
const Learning = {
  version: 'core-1', session: null, syncing: false,
  // Each generator covers the named foundation skill, not an entire exam chapter.
  skills: {
    set: ['จำนวนสมาชิกของยูเนียน', 'บวกสมาชิกสองเซตแล้วลบส่วนที่นับซ้ำหนึ่งครั้ง', '$n(A\\cup B)=n(A)+n(B)-n(A\\cap B)$'],
    logic: ['ค่าความจริงของการอิมพลิเคชัน', 'เหตุจริงแต่ผลเท็จเป็นกรณีเดียวที่อิมพลิเคชันเป็นเท็จ', '$p\\to q\\equiv \\neg p\\lor q$'],
    real: ['แก้สมการเชิงเส้น', 'ลบจำนวนเดียวกันทั้งสองข้าง แล้วหารด้วยสัมประสิทธิ์ที่ไม่เป็นศูนย์', '$ax+b=c\\Rightarrow x=(c-b)/a$'],
    func: ['แทนค่าในฟังก์ชัน', 'แทนตัวแปรด้วยค่าที่กำหนด แล้วคูณก่อนบวก', '$f(x)=ax+b$'],
    explog: ['ลอการิทึมของกำลัง', 'ลอการิทึมถามว่า ต้องยกกำลังฐานเท่าใดจึงได้จำนวนที่ระบุ', '$\\log_b(b^k)=k\\quad(b>0,b\\ne1)$'],
    trig: ['ไซน์ในสามเหลี่ยมมุมฉาก', 'หาอัตราส่วนด้านตรงข้ามมุมต่อด้านตรงข้ามมุมฉาก', '$\\sin\\theta=\\frac{\\text{ด้านตรงข้าม}}{\\text{ด้านตรงข้ามมุมฉาก}}$'],
    complex: ['มอดูลัสยกกำลังสอง', 'ยกกำลังสองส่วนจริงและส่วนจินตภาพ แล้วบวกกัน', '$|a+bi|^2=a^2+b^2$'],
    matrix: ['ดีเทอร์มิแนนต์ขนาดสอง', 'คูณแนวทแยงหลักแล้วลบผลคูณอีกแนวหนึ่ง', '$\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}=ad-bc$'],
    seq: ['พจน์ของลำดับเลขคณิต', 'จากพจน์แรกไปพจน์ที่ n มีการเพิ่มผลต่างร่วม n−1 ครั้ง', '$a_n=a_1+(n-1)d$'],
    analytic: ['ระยะทางยกกำลังสอง', 'หาผลต่างพิกัดแต่ละแกน ยกกำลังสองแล้วบวกกัน', '$d^2=(x_2-x_1)^2+(y_2-y_1)^2$'],
    vector: ['ดอตโปรดักต์สองมิติ', 'คูณองค์ประกอบตำแหน่งเดียวกัน แล้วรวมผล', '$(a,b)\\cdot(c,d)=ac+bd$'],
    stat: ['ค่าเฉลี่ยเลขคณิต', 'รวมข้อมูลทุกค่าแล้วหารด้วยจำนวนข้อมูล', '$\\bar{x}=\\frac{\\sum x_i}{n}$'],
    count: ['เลือกสองสิ่งโดยไม่เรียงลำดับ', 'นับคู่ที่เรียงลำดับแล้วหารสอง เพราะแต่ละคู่ถูกนับสองครั้ง', '$\\binom n2=\\frac{n(n-1)}2$'],
    prob: ['ความน่าจะเป็นของการหยิบหนึ่งครั้ง', 'เมื่อทุกชิ้นมีโอกาสถูกเลือกเท่ากัน ให้หารจำนวนกรณีที่ต้องการด้วยจำนวนทั้งหมด', '$P(E)=\\frac{n(E)}{n(S)}$'],
    dist: ['ค่าคาดหมายของตัวแปรสองค่า', 'คูณค่าที่เป็นไปได้ด้วยความน่าจะเป็นของค่านั้น แล้วรวมกัน', '$E(X)=\\sum xP(X=x)$'],
    calc: ['อนุพันธ์พหุนามกำลังสอง', 'ใช้กฎกำลังหาอนุพันธ์ก่อน แล้วจึงแทนค่าจุดที่กำหนด', '$f(x)=ax^2+bx\\Rightarrow f\u2032(x)=2ax+b$']
  },
  key() { return 'mathpath.learning.v1:' + (Cloud.state && Cloud.state.user_id || 'guest'); },
  data() { try { return Object.assign({events:[],reports:[],seen:[],budget:20,plan:null}, JSON.parse(localStorage.getItem(this.key()) || '{}')); } catch (_) { return {events:[],reports:[],seen:[],budget:20,plan:null}; } },
  save(d) { localStorage.setItem(this.key(), JSON.stringify(d)); },
  hash(text) { let n=2166136261; for (const c of text) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; },
  question(topic, seed) {
    let state=seed>>>0;
    const n=(lo,hi)=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return lo+state%(hi-lo+1);};
    const a=n(2,19), b=n(2,17), c=n(1,9), d=n(1,9);
    let q, answer, steps;
    switch(topic) {
      case 'set': q=`$n(A)=${a+c}, n(B)=${b+c}, n(A\\cap B)=${c}$ จงหา $n(A\\cup B)$`;answer=a+b+c;steps=[`บวกจำนวนสมาชิก: ${a+c}+${b+c}=${a+b+2*c}`,`ลบส่วนที่นับซ้ำ ${c} ได้ ${answer}`];break;
      case 'logic': { const p=a>b, r=c>d;q=`ให้ $p$ คือประพจน์ $${a}>${b}$ และ $q$ คือประพจน์ $${c}>${d}$ จงหาค่าความจริงของ $p\\to q$ โดยตอบ 1 เมื่อจริง และ 0 เมื่อเท็จ`;answer=(!p||r)?1:0;steps=[`p เป็น${p?'จริง':'เท็จ'} และ q เป็น${r?'จริง':'เท็จ'}`,`อิมพลิเคชันเท็จเฉพาะเหตุจริงผลเท็จ จึงตอบ ${answer}`];break; }
      case 'real': answer=c;q=`จงแก้สมการ $${a}x+${b}=${a*c+b}$`;steps=[`ลบ ${b} ทั้งสองข้าง ได้ $${a}x=${a*c}$`,`หารด้วย ${a} ได้ $x=${c}$`];break;
      case 'func': answer=a*c+b;q=`ให้ $f(x)=${a}x+${b}$ จงหา $f(${c})$`;steps=[`แทน $x=${c}$ ได้ $${a}(${c})+${b}$`,`คูณก่อนบวก ได้ ${answer}`];break;
      case 'explog': {const base=n(2,16),k=n(2,6);answer=k;q=`จงหา $\\log_{${base}} ${base**k}$`;steps=[`เขียน $${base**k}=${base}^{${k}}$`,`ลอการิทึมฐานเดียวกันจึงเท่ากับ ${k}`];break;}
      case 'trig': {const u=a+10,v=c;const opposite=2*u*v,h=u*u+v*v;answer=opposite/h;q=`สามเหลี่ยมมุมฉากมีด้านตรงข้ามมุม $\\theta$ ยาว ${opposite} และด้านตรงข้ามมุมฉากยาว ${h} จงหา $\\sin\\theta$`;steps=['ใช้ไซน์ = ด้านตรงข้าม / ด้านตรงข้ามมุมฉาก',`ได้ $\\frac{${opposite}}{${h}}$`];break;}
      case 'complex': answer=a*a+b*b;q=`ให้ $z=${a}+${b}i$ จงหา $|z|^2$`;steps=[`ใช้ $|z|^2=${a}^2+${b}^2$`,`รวม ${a*a}+${b*b} ได้ ${answer}`];break;
      case 'matrix': answer=a*d-b*c;q=`จงหาดีเทอร์มิแนนต์ของ $\\begin{pmatrix}${a}&${b}\\\\${c}&${d}\\end{pmatrix}$`;steps=[`คูณแนวทแยงหลัก: ${a}×${d}=${a*d}`,`ลบอีกแนว: ${a*d}−${b}×${c}=${answer}`];break;
      case 'seq': answer=a+(c+1)*b;q=`ลำดับเลขคณิตมีพจน์แรก ${a} ผลต่างร่วม ${b} จงหาพจน์ที่ ${c+2}`;steps=[`เพิ่มผลต่างร่วม ${c+1} ครั้ง`,`ได้ ${a}+${c+1}×${b}=${answer}`];break;
      case 'analytic': answer=(a-c)**2+(b-d)**2;q=`จุด $A(${a},${b})$ และ $B(${c},${d})$ ห่างกันเป็นระยะ $r$ จงหา $r^2$`;steps=[`ผลต่างพิกัดคือ ${a-c} และ ${b-d}`,`รวมกำลังสอง ได้ $(${a-c})^2+(${b-d})^2=${answer}$`];break;
      case 'vector': answer=a*c+b*d;q=`จงหา $( ${a},${b})\\cdot(${c},${d})$`;steps=[`คูณองค์ประกอบที่ตรงกัน: ${a}×${c} และ ${b}×${d}`,`รวมได้ ${answer}`];break;
      case 'stat': answer=(a+b+c+d)/4;q=`ข้อมูล ${a}, ${b}, ${c}, ${d} มีค่าเฉลี่ยเท่าใด`;steps=[`ผลรวมคือ ${a+b+c+d}`,`หารด้วย 4 ได้ ${answer}`];break;
      case 'count': {const size=n(2,99);answer=size*(size-1)/2;q=`เลือกนักเรียน 2 คนจาก ${size} คน โดยไม่สนลำดับ เลือกได้กี่วิธี`;steps=[`คู่แบบเรียงลำดับมี ${size}×${size-1} วิธี`,`หารสอง ได้ ${answer} วิธี`];break;}
      case 'prob': answer=a/(a+b);q=`ถุงมีลูกบอลแดง ${a} ลูก และน้ำเงิน ${b} ลูก แต่ละลูกมีโอกาสถูกหยิบเท่ากัน หยิบ 1 ลูก ความน่าจะเป็นที่จะได้สีแดงเท่าใด`;steps=[`มีทั้งหมด ${a+b} ลูก`,`กรณีที่ต้องการมี ${a} ลูก จึงได้ $\\frac{${a}}{${a+b}}$`];break;
      case 'dist': {const other=a===b?b+1:b;answer=(a*c+other*(10-c))/10;q=`$X$ มีค่า ${a} ด้วยความน่าจะเป็น $${c}/10$ และมีค่า ${other} ด้วยความน่าจะเป็น $${10-c}/10$ จงหา $E(X)$`;steps=[`คูณค่าแต่ละตัวด้วยความน่าจะเป็น`,`$E(X)=${a}\\times\\frac{${c}}{10}+${other}\\times\\frac{${10-c}}{10}=${answer}$`];break;}
      case 'calc': answer=2*a*c+b;q=`ให้ $f(x)=${a}x^2+${b}x$ จงหา $f\u2032(${c})$`;steps=[`อนุพันธ์คือ $f\u2032(x)=${2*a}x+${b}$`,`แทน $x=${c}$ ได้ ${answer}`];break;
      default: throw new Error('Unknown skill');
    }
    return {q, a:answer, t:'num', tol:1e-8, steps, id:topic+':'+this.hash(q), _verified:true, skill:topic+':'+this.version};
  },
  mark(question, input) {
    // Accept numeric literals and rational/mixed fractions only; never evaluate user code.
    const s=String(input).trim().replace(/−/g,'-');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*\/\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(s) && !/^[+-]?\d+\s+\d+\s*\/\s*\d+$/.test(s)) return null;
    const value=toNumber(s);
    return Number.isFinite(value) ? Math.abs(value-question.a)<=1e-8 : null;
  },
  evidence(topic, now=Date.now(), data=this.data()) {
    const ev=data.events.filter(e=>e.topic===topic && e.version===this.version).sort((a,b)=>a.at-b.at);
    let state='new', readyAt=null, dueAt=null, last=null;const seen=new Set();
    for (const e of ev) {
      const unique=new Set();const score=e.results.filter(r=>{const fresh=!seen.has(r.id)&&!unique.has(r.id);unique.add(r.id);return fresh&&r.correct && !r.assisted && !r.reported;}).length;
      const passed=e.results.length===5 && score>=4;
      if (passed) {
        if (readyAt && e.at-readyAt>=86400000) {state='mastered';dueAt=e.at+7*86400000;}
        else if (!readyAt) {readyAt=e.at;state='review';dueAt=e.at+86400000;}
      } else {state='developing';readyAt=null;dueAt=e.at+86400000;}
      e.results.forEach(r=>seen.add(r.id));last=e;
    }
    return {state,dueAt,last,due:dueAt!==null&&dueAt<=now};
  },
  label(topic) {const e=this.evidence(topic);return e.due?'ถึงเวลาทบทวน':({new:'ยังไม่ตรวจ',developing:'กำลังพัฒนา',review:'ผ่านครั้งแรก · รอทบทวน',mastered:'ทักษะพื้นฐานนี้ผ่านการทบทวน'})[e.state];},
  plan() {
    const data=this.data(),day=todayStr();
    if (data.plan && data.plan.day===day) return data.plan;
    const ids=Object.keys(this.skills);
    const due=ids.filter(t=>this.evidence(t).due).sort((a,b)=>this.evidence(a).dueAt-this.evidence(b).dueAt);
    const weak=ids.filter(t=>this.evidence(t).state==='developing');
    const gaps=typeof planTopicIds==='function'?planTopicIds():[];
    const order=typeof personalizedTopics==='function'?personalizedTopics().map(t=>t.id):ids;
    const chosen=[...new Set([...due,...weak,...gaps,...order,...ids])].filter(t=>this.skills[t]).slice(0,data.budget>=20?2:1);
    data.plan={day,topics:chosen.map(topic=>({topic,reason:due.includes(topic)?'ถึงวันตรวจความจำด้วยข้อใหม่':weak.includes(topic)?'รอบก่อนยังมีจุดที่พลาด':gaps.includes(topic)?'เป็นจุดอ่อนจากแบบทดสอบก่อนเรียน':'ฝึกพื้นฐานตามลำดับแผนของคุณ'}))};
    this.save(data);return data.plan;
  },
  dailyCard() {
    const plan=this.plan(),data=this.data();
    return `<section class="teachcard daily-plan"><h2>วันนี้เรียนอะไรดี?</h2><p class="note">เวลาที่ตั้งใจใช้ <select aria-label="เวลาเรียนวันนี้" onchange="Learning.budget(this.value)">${[10,20,30].map(n=>`<option value="${n}" ${data.budget===n?'selected':''}>${n} นาที</option>`).join('')}</select> · เป็นแผนเวลา ไม่ใช่เวลาที่เรียนแล้ว</p>
      ${plan.topics.map(item=>{const complete=data.events.some(e=>e.topic===item.topic&&new Date(e.at).toLocaleDateString('sv-SE')===plan.day);return `<div class="daily-item"><h3>${esc(this.skills[item.topic][0])}</h3><p>${esc(item.reason)}</p><p class="note">${esc(this.label(item.topic))} · ${complete?'ทำรอบของวันนี้แล้ว':'อธิบาย → ตัวอย่าง → ฝึกพร้อมคำใบ้ → ทำเอง 5 ข้อ'}</p><button class="btn ${complete?'ghost':''} sm" onclick="Learning.start('${item.topic}')">${complete?'ฝึกเพิ่ม (ไม่เร่งวันทบทวน)':'เริ่มงานนี้'}</button></div>`;}).join('')}
      <p class="note">ความคืบหน้านี้วัดเฉพาะทักษะพื้นฐานที่ระบุ ยังไม่ใช่ความพร้อมทั้งบทหรือคะแนน A-Level</p><p class="note" id="learningSync">${Cloud.signedIn()?'บันทึกในเครื่อง และซิงก์กับบัญชีเมื่อเชื่อมต่อได้':'ความคืบหน้าเก็บในเครื่องสำหรับโหมดทดลอง'}</p></section>`;
  },
  budget(n) {const d=this.data();d.budget=[10,20,30].includes(Number(n))?Number(n):20;d.plan=null;this.save(d);render();},
  topicCard(topic) {return `<section class="teachcard"><h2>เรียนพื้นฐานทีละขั้น</h2><p>${esc(this.skills[topic][0])} · ${esc(this.label(topic))}</p><button class="btn" onclick="Learning.start('${topic}')">อธิบาย → ดูตัวอย่าง → ฝึก → ตรวจความเข้าใจ</button></section>`;},
  start(topic, stage='explain') {
    if (!this.skills[topic]) return;
    this.session={id:crypto.randomUUID(),topic,stage,results:[],i:0,checked:false,assisted:false,reported:false,questions:[],account:this.key(),seed:this.hash(crypto.randomUUID())};
    go('#/learn/'+topic);if(this.evidence(topic).due){this.independent();return;}if(location.hash==='#/learn/'+topic)render();
  },
  independent() {
    const s=this.session;if(!s)return;
    const data=this.data();const used=new Set([...data.events.flatMap(e=>e.results.map(r=>r.id)),...data.seen]);
    [s.example,s.guided].filter(Boolean).forEach(q=>used.add(q.id));
    const qs=[];
    for(let i=0;qs.length<5&&i<5000;i++){const q=this.question(s.topic,s.seed+i+101);if(!used.has(q.id)){qs.push(q);used.add(q.id);}}
    if(qs.length<5){toast('ยังไม่มีข้อใหม่พอสำหรับวัดความจำ ลองฝึกโดยดูตัวอย่างได้');return;}
    s.questions=qs;s.stage='independent';s.i=0;s.results=[];s.checked=false;s.assisted=false;s.reported=false;render();
  },
  move(stage) {const s=this.session;if(!s)return;s.stage=stage;s.checked=false;s.assisted=false;s.reported=false;render();},
  view(app,r) {
    if(!this.skills[r.a])return viewHome(app);
    if(!this.session||this.session.topic!==r.a||this.session.account!==this.key()){this.start(r.a);return;}
    const s=this.session,meta=this.skills[s.topic];
    s.example=s.example||this.question(s.topic,s.seed);s.guided=s.guided||this.question(s.topic,s.seed+59);
    const stages=['explain','example','guided','independent','summary'];const names=['เข้าใจหลักการ','ดูตัวอย่าง','ฝึกพร้อมคำใบ้','ลองทำเอง','สรุปและทบทวน'];
    let body='';
    if(s.stage==='explain')body=`<h2>${esc(meta[0])}</h2><p>${esc(meta[1])}</p><div class="learning-formula">${esc(meta[2])}</div><p class="note">เป้าหมาย: ทำทักษะนี้ด้วยตัวเองก่อนต่อยอดโจทย์หลายขั้น</p><button class="btn" onclick="Learning.move('example')">ดูตัวอย่างที่ทำให้ดู</button>`;
    if(s.stage==='example'){this.expose(s.example);body=`<h2>ตัวอย่างพร้อมวิธีคิด</h2><p>${esc(s.example.q)}</p><ol>${s.example.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><button class="btn" onclick="Learning.move('guided')">ลองทำพร้อมคำใบ้</button>`;}
    if(['guided','independent'].includes(s.stage)){
      const q=s.stage==='guided'?s.guided:s.questions[s.i];
      this.expose(q);
      body=`<h2>${s.stage==='guided'?'ฝึกพร้อมคำใบ้':`ลองทำเอง ${s.i+1}/5`}</h2><p>${esc(q.q)}</p><label for="learnAnswer">คำตอบ (จำนวนหรือเศษส่วน)</label><input id="learnAnswer" type="text" inputmode="decimal" ${s.checked?'disabled':''} onkeydown="if(event.key==='Enter')Learning.submit()"><button class="btn" ${s.checked?'disabled':''} onclick="Learning.submit()">ตรวจคำตอบ</button><button class="btn ghost sm" ${s.checked?'disabled':''} onclick="Learning.hint()">ขอคำใบ้${s.stage==='independent'?' (ไม่นับข้อนี้เป็นการทำเอง)':''}</button><div id="learnFeedback" aria-live="polite"></div>`;
    }
    if(s.stage==='summary'){
      const right=s.results.filter(r=>r.correct&&!r.assisted&&!r.reported).length;
      body=`<h2>ทำเองได้ ${right}/5 ข้อ</h2><p>${esc(this.label(s.topic))}</p><p>${right>=4?'กลับมาทำข้อใหม่หลังอย่างน้อย 24 ชั่วโมง เพื่อดูว่ายังจำและใช้หลักการได้':'ทบทวนขั้นที่พลาดด้านล่าง แล้วกลับมาลองอีกครั้ง'}</p><p class="note">คำใบ้และข้อที่แจ้งปัญหาไม่ถือเป็นหลักฐานว่าทำเองได้</p>${s.questions.map((q,i)=>`<details><summary>ข้อ ${i+1}: ${s.results[i].reported?'แจ้งปัญหา':s.results[i].assisted?'ใช้คำใบ้':s.results[i].correct?'ถูก':'ทบทวน'}</summary><p>${esc(q.q)}</p><ol>${q.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`).join('')}<button class="btn" onclick="go('#/dashboard')">กลับแผนวันนี้</button><button class="btn ghost" onclick="Learning.start('${s.topic}')">ฝึกทักษะนี้เพิ่ม</button>`;
    }
    app.innerHTML=`${breadcrumb([['แผนวันนี้','#/dashboard'],[meta[0],null]])}<h1>เรียนแล้วลองทำด้วยตัวเอง</h1><div class="stagebar">${stages.map((stage,i)=>`<span class="stagechip ${stage===s.stage?'on':''}">${i+1}. ${names[i]}</span>`).join('')}</div><section class="teachcard learning-content">${body}</section><p class="note">โจทย์พื้นฐานและเฉลยคำนวณด้วยกฎคณิตศาสตร์ในระบบ ไม่ใช้คำตอบที่ AI เดาเพื่อให้คะแนน</p>`;
    renderMath(app);
  },
  hint() {const s=this.session;if(!s||s.checked)return;s.assisted=true;const q=s.stage==='guided'?s.guided:s.questions[s.i];const el=$('#learnFeedback');el.textContent=q.steps[0];renderMath(el);},
  expose(q) {const d=this.data();if(!d.seen.includes(q.id)){d.seen.push(q.id);this.save(d);}},
  submit() {
    const s=this.session;if(!s||s.checked||!['guided','independent'].includes(s.stage))return;
    const q=s.stage==='guided'?s.guided:s.questions[s.i];const given=$('#learnAnswer').value;const ok=this.mark(q,given);
    if(ok===null)return toast('ใส่จำนวนหรือเศษส่วนที่ถูกต้อง เช่น 0.5 หรือ 1/2');
    s.checked=true;s.correct=ok;s.given=given;
    const box=$('#learnFeedback');box.innerHTML=`<p><b>${ok?'ถูกต้อง':'ยังไม่ถูก ลองดูขั้นที่พลาด'}</b></p><ol>${q.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><button class="btn ghost sm" id="learnReport" onclick="Learning.report()">โจทย์หรือเฉลยมีปัญหา</button><button class="btn" onclick="Learning.next()">${s.stage==='guided'?'พร้อมแล้ว ทำเอง 5 ข้อ':s.i===4?'ดูสรุป':'ข้อถัดไป'}</button>`;
    $('#learnAnswer').disabled=true;renderMath(box);
  },
  report() {const s=this.session;if(!s||s.reported)return;s.reported=true;const q=s.stage==='guided'?s.guided:s.questions[s.i];const d=this.data();d.reports.push({id:crypto.randomUUID(),topic:s.topic,question:q.q,answer:q.a,at:Date.now()});this.save(d);$('#learnReport').textContent='บันทึกปัญหาแล้ว · ข้อนี้ไม่ใช้วัดความเข้าใจ';$('#learnReport').disabled=true;this.sync();},
  next() {
    const s=this.session;if(!s||!s.checked)return;
    if(s.stage==='guided'){this.independent();return;}
    const q=s.questions[s.i];s.results.push({id:q.id,correct:s.correct,assisted:s.assisted,reported:s.reported});s.i++;s.checked=false;s.assisted=false;s.reported=false;
    if(s.i===5){const d=this.data();if(!d.events.some(e=>e.id===s.id)){d.events.push({id:s.id,topic:s.topic,version:this.version,at:Date.now(),results:s.results});this.save(d);this.sync();}s.stage='summary';}
    render();
  },
  async sync() {
    if(this.syncing||!Cloud.signedIn()||!Cloud.state.user_id)return;
    this.syncing=true;const key=this.key(),uid=Cloud.state.user_id;
    try {
      const data=this.data();
      const pending=data.events.filter(e=>!e.synced).map(e=>({id:e.id,user_id:uid,topic:e.topic,completed_at:new Date(e.at).toISOString(),evidence:{version:e.version,results:e.results}}));
      if(pending.length){const r=await sbFetch('/rest/v1/learning_attempts?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(pending)});if(!r.ok)throw Error('sync');}
      const reports=data.reports.filter(e=>!e.synced).map(e=>({id:e.id,user_id:uid,topic:e.topic,details:{question:e.question,answer:e.answer}}));
      if(reports.length){const r=await sbFetch('/rest/v1/learning_question_reports?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(reports)});if(!r.ok)throw Error('sync');}
      const r=await sbFetch('/rest/v1/learning_attempts?select=id,topic,completed_at,evidence&order=completed_at.desc&limit=1000');if(!r.ok)throw Error('sync');
      const remote=await r.json();if(key!==this.key())return;
      const fresh=this.data(),have=new Set(fresh.events.map(e=>e.id));let added=false;
      for(const e of remote){if(!have.has(e.id)&&this.skills[e.topic]&&Number.isFinite(Date.parse(e.completed_at))&&Array.isArray(e.evidence?.results)&&e.evidence.results.length===5&&e.evidence.results.every(r=>r&&typeof r.id==='string'&&typeof r.correct==='boolean')){fresh.events.push({id:e.id,topic:e.topic,at:Date.parse(e.completed_at),version:e.evidence.version,results:e.evidence.results,synced:true});have.add(e.id);added=true;}}
      const sent=new Set(pending.map(e=>e.id));fresh.events.forEach(e=>{if(sent.has(e.id))e.synced=true;});const reported=new Set(reports.map(e=>e.id));fresh.reports.forEach(e=>{if(reported.has(e.id))e.synced=true;});this.save(fresh);
      if($('#learningSync'))$('#learningSync').textContent='ซิงก์ความคืบหน้ากับบัญชีแล้ว';
      if(added&&location.hash==='#/dashboard'){fresh.plan=null;this.save(fresh);render();}
    }catch(_){if(key===this.key()&&$('#learningSync'))$('#learningSync').textContent='เก็บในเครื่องแล้ว · ซิงก์ยังไม่สำเร็จ จะลองใหม่เมื่อกลับมา';}
    finally{this.syncing=false;}
  }
};
window.addEventListener('online',()=>Learning.sync());
