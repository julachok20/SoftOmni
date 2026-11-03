/* MathPath — ติวเตอร์ AI (Gemini) + คำถามตอนสมัครครั้งแรก
   ต้องโหลดหลัง sync.js (ใช้ sbFetch, Cloud) และก่อน app.js (app.js เรียก view เหล่านี้)

   คีย์ Gemini ไม่ได้อยู่ในไฟล์นี้และไม่ได้อยู่ในเบราว์เซอร์เลย
   ไฟล์นี้เรียก Edge Function ชื่อ tutor ซึ่งถือคีย์ไว้ฝั่งเซิร์ฟเวอร์
*/
'use strict';

/* ============ คำถามตอนสมัครครั้งแรก — วิซาร์ดทีละหน้าจอ ============
   ลดเป้าหมายเหลือ 2 อย่างตามคำขอ: ตามโรงเรียน / A-Level (ตัด TCAS, POSN, อื่นๆ ออกทั้งระบบ
   เพื่อไม่ให้ตัวเลือกตอนสมัครล้นเกินไป) — ดู migration softomni_goal_simplify_school_alevel */
const GOALS = [
  ['school',  'ตามโรงเรียน', 'เรียนตามหลักสูตรในห้องเรียน เน้นเกรดให้ดีขึ้น'],
  ['a_level', 'A-Level',     'เตรียมสอบ A-Level เข้ามหาวิทยาลัย']
];
const STRANDS = ['จำนวนและพีชคณิต', 'การวัดและเรขาคณิต', 'สถิติและความน่าจะเป็น', 'แคลคูลัส'];

/* ระดับความเข้าใจคณิตศาสตร์ที่ผู้เรียนประเมินตัวเอง — คนละตัวกับเกรดเฉลี่ย เพราะความมั่นใจ
   กับเกรดไม่เท่ากันเสมอไป ใช้ปรับ "โทน" คำอธิบายของ AI ให้ตรงกับสไตล์ผู้เรียนแต่ละคน */
const UNDERSTANDING_LEVELS = [
  ['weak',   'ยังไม่ค่อยเข้าใจ', 'อธิบายละเอียด ทีละขั้น ให้กำลังใจเยอะๆ'],
  ['ok',     'พอเข้าใจ',        'อธิบายกระชับ แต่ยังให้เหตุผลประกอบ'],
  ['strong', 'เข้าใจดี มั่นใจ', 'ตรงประเด็น ท้าทายด้วยโจทย์ที่ยากขึ้น']
];

/* ค่าเฉลี่ยคะแนนคณิตศาสตร์ระดับประเทศ — ตัวเลขจริงจากการสอบมาตรฐาน ไม่ใช่ AI ประมาณการ
   ม.1–ม.3 เทียบกับ O-NET ม.3 (สทศ.) · ม.4–ม.6 เทียบกับ A-Level คณิตศาสตร์ประยุกต์ 1 (ทปอ.)
   ทั้งสองคิดเป็นคะแนนเต็ม 100 เหมือนกัน จึงเทียบกับ % คะแนนแบบทดสอบก่อนเรียนของเราได้ตรงสเกล
   แต่ข้อสอบคนละชุดคนละมาตรฐาน ให้ใช้เป็น "เกณฑ์เทียบเคียง" ไม่ใช่มาตรฐานเดียวกันทุกประการ */
const NATIONAL_AVG = {
  lower: { pct: 26.8, label: 'O-NET คณิตศาสตร์ ม.3', year: 'ปีการศึกษา 2568', source: 'สทศ.' },
  upper: { pct: 34.7, label: 'A-Level คณิตศาสตร์ประยุกต์ 1', year: 'ปีการศึกษา 2568', source: 'ทปอ. (mytcas.com)' }
};
function nationalBenchmark(levelId) {
  return (levelId === 'm4' || levelId === 'm5' || levelId === 'm6') ? NATIONAL_AVG.upper : NATIONAL_AVG.lower;
}

function goalLabel(goal) {
  const found = GOALS.find(g => g[0] === goal);
  return found ? found[1] : '';
}

/** การ์ดเลือกเป้าหมาย ใช้ร่วมกันทั้งวิซาร์ดตอนสมัครและหน้าตั้งค่าเปลี่ยนเป้าหมายภายหลัง
    onPick คือชื่อฟังก์ชัน (string) ที่จะถูกเรียกตอนแตะการ์ด เพราะ state เก็บคนละที่กันระหว่างสองบริบท
    onPick(id) = เลือกเป้าหมายใหม่ (วาดใหม่ทั้งหน้า), onPick(id,'university'|'major',value) = เลือกจาก dropdown */
function uniSelectOptions(current) {
  const list = UNI_LIST.slice();
  if (current && list.indexOf(current) < 0) list.unshift(current);
  return `<option value="">เลือกมหาวิทยาลัย</option>` +
    list.map(n => `<option value="${esc(n)}" ${n === current ? 'selected' : ''}>${esc(n)}</option>`).join('');
}
function facultySelectOptions(current) {
  const list = FACULTY_LIST.slice();
  if (current && list.indexOf(current) < 0) list.unshift(current);
  return `<option value="">เลือกคณะ</option>` +
    list.map(n => `<option value="${esc(n)}" ${n === current ? 'selected' : ''}>${esc(n)}</option>`).join('');
}
function renderGoalPicker(selected, university, major, onPick) {
  return `
    <div class="goalcards">
      ${GOALS.map(g => `
        <button type="button" class="goalcard ${selected === g[0] ? 'sel' : ''}" onclick="${onPick}('${g[0]}')">
          <span class="t">${esc(g[1])}</span>
          <span class="d">${esc(g[2])}</span>
        </button>`).join('')}
    </div>
    ${selected === 'a_level' ? `
      <label for="uniInput">มหาวิทยาลัยที่อยากเข้า</label>
      <select id="uniInput" onchange="${onPick}('a_level','university',this.value)">
        ${uniSelectOptions(university)}
      </select>
      <label for="majorInput">คณะที่อยากเข้า</label>
      <select id="majorInput" onchange="${onPick}('a_level','major',this.value)">
        ${facultySelectOptions(major)}
      </select>
      <p class="note">เลือกจากรายการเท่านั้น เส้นทางในบทเรียนจะจัดตามคณะนี้ (เช่น วิศวะมีพีทาโกรัส) ไม่ให้พิมพ์เอง</p>` : ''}`;
}

/* ---------- วิซาร์ด: สถานะระหว่างตอบคำถาม ---------- */
const WIZ_STEPS = ['school', 'grade', 'gpa', 'understanding', 'goal', 'consent'];
let WIZ = null;

function wizInit() {
  WIZ = {
    step: 0, school: '', grade: S.level || 'm1', gpa: '', understanding: '',
    goal: '', university: '', major: '', pdpa: false, ai: false
  };
}

function viewWelcome(app) {
  if (!WIZ) wizInit();
  wizRender(app);
}

function wizRender(app) {
  const i = WIZ.step;
  const total = WIZ_STEPS.length;
  const dots = `<div class="stepdots">${WIZ_STEPS.map((_, k) =>
    `<span class="${k === i ? 'on' : k < i ? 'done' : ''}"></span>`).join('')}</div>
    <p class="note" style="text-align:center;margin-bottom:18px">ข้อ ${i + 1} จาก ${total}</p>`;

  let body = '', canSkip = false;
  if (WIZ_STEPS[i] === 'school') {
    body = `<h1>เรียนอยู่โรงเรียนไหน</h1>
      <p class="sub">ช่วยให้เราดูภาพรวมของโรงเรียนได้ในอนาคต ไม่บังคับ</p>
      <input type="text" id="wIn" value="${esc(WIZ.school)}" placeholder="เช่น สระบุรีวิทยาคม" autocomplete="organization">`;
    canSkip = true;
  } else if (WIZ_STEPS[i] === 'grade') {
    body = `<h1>กำลังเรียนชั้นไหน</h1>
      <p class="sub">ใช้จัดหน่วยการเรียนรู้ให้ตรงระดับ</p>
      <select id="wIn">
        ${LEVEL_ORDER.map(id =>
          `<option value="${id}" ${id === WIZ.grade ? 'selected' : ''}>${CURRICULUM[id].name}</option>`).join('')}
      </select>`;
  } else if (WIZ_STEPS[i] === 'gpa') {
    body = `<h1>เกรดเฉลี่ยล่าสุดเท่าไหร่</h1>
      <p class="sub">0.00–4.00 — ติวเตอร์จะปรับความละเอียดในการอธิบายให้เหมาะกับคุณ ไม่บังคับ</p>
      <input type="text" id="wIn" inputmode="decimal" value="${esc(WIZ.gpa)}" placeholder="เช่น 3.25">`;
    canSkip = true;
  } else if (WIZ_STEPS[i] === 'understanding') {
    body = `<h1>เข้าใจคณิตศาสตร์แค่ไหนตอนนี้</h1>
      <p class="sub">ประเมินตัวเองคร่าวๆ ติวเตอร์จะปรับน้ำเสียงและความละเอียดให้เหมาะกับคุณ ไม่บังคับ</p>
      <div class="goalcards">
        ${UNDERSTANDING_LEVELS.map(u => `
          <button type="button" class="goalcard ${WIZ.understanding === u[0] ? 'sel' : ''}"
            onclick="wizPickUnderstanding('${u[0]}')">
            <span class="t">${esc(u[1])}</span>
            <span class="d">${esc(u[2])}</span>
          </button>`).join('')}
      </div>`;
    canSkip = true;
  } else if (WIZ_STEPS[i] === 'goal') {
    body = `<h1>เป้าหมายของคุณคืออะไร</h1>
      <p class="sub">ตามโรงเรียน หรือ A-Level — ถ้าเป็น A-Level ต้องเลือกมหาวิทยาลัยและคณะจากรายการ ไม่พิมพ์เอง</p>
      ${renderGoalPicker(WIZ.goal, WIZ.university, WIZ.major, 'wizPickGoal')}`;
    canSkip = WIZ.goal !== 'a_level';
  } else { // consent
    body = `<h1>ก่อนเริ่มเรียน</h1>
      <p class="sub">ข้อสุดท้าย — จำเป็นต่อการใช้งาน</p>
      <div class="card">
        <label style="font-weight:600;font-size:14px;margin:0 0 12px;color:var(--graphite);display:flex;gap:9px">
          <input type="checkbox" id="cPdpa" ${WIZ.pdpa ? 'checked' : ''} onchange="WIZ.pdpa=this.checked"
            style="width:auto;margin-top:3px;flex:0 0 auto">
          <span>ฉันอายุถึงเกณฑ์ตามกฎหมาย หรือได้รับความยินยอมจากผู้ปกครองแล้ว
            และยอมรับ<a href="#/privacy" onclick="event.stopPropagation()"
            style="color:var(--pen-blue)">เงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว (PDPA)</a> — จำเป็นต่อการใช้งาน</span>
        </label>
        <label style="font-weight:600;font-size:14px;margin:0;color:var(--graphite);display:flex;gap:9px">
          <input type="checkbox" id="cAI" ${WIZ.ai ? 'checked' : ''} onchange="WIZ.ai=this.checked"
            style="width:auto;margin-top:3px;flex:0 0 auto">
          <span>ยินยอมให้นำข้อมูลการเรียนแบบไม่ระบุตัวตนไปใช้พัฒนา AI และงานวิเคราะห์เชิงสถิติ
            (ไม่บังคับ เปลี่ยนใจภายหลังได้ที่หน้า “ของฉัน”)</span>
        </label>
      </div>`;
  }

  app.innerHTML = dots + body + `
    <div style="height:20px"></div>
    <button class="btn" onclick="wizNext()">${i === total - 1 ? 'เริ่มเรียน' : 'ต่อไป'}</button>
    <div style="height:10px"></div>
    <div class="row">
      ${i > 0 ? `<button class="btn ghost" onclick="wizBack()">ย้อนกลับ</button>` : ''}
      ${canSkip ? `<button class="btn ghost" onclick="wizNext(true)">ข้ามข้อนี้</button>` : ''}
    </div>`;
  setTimeout(() => { const el = $('#wIn'); if (el) el.focus(); }, 60);
}

function wizPickGoal(id, field, value) {
  if (field) { WIZ[field] = value; return; }
  WIZ.goal = id;
  if (id !== 'a_level') { WIZ.university = ''; WIZ.major = ''; }
  wizRender($('#app'));
}
function wizPickUnderstanding(id) {
  WIZ.understanding = id;
  wizRender($('#app'));
}

async function wizNext(skip) {
  const step = WIZ_STEPS[WIZ.step];
  if (!skip) {
    if (step === 'school') WIZ.school = $('#wIn').value.trim();
    else if (step === 'grade') WIZ.grade = $('#wIn').value;
    else if (step === 'gpa') {
      const raw = $('#wIn').value.trim();
      if (raw) {
        const n = toNumber(raw);
        if (n === null || n < 0 || n > 4) return toast('เกรดเฉลี่ยต้องอยู่ระหว่าง 0.00 ถึง 4.00');
        WIZ.gpa = String(n);
      } else WIZ.gpa = '';
    } else if (step === 'goal') {
      if (!WIZ.goal) return toast('เลือกเป้าหมายก่อน');
      if (WIZ.goal === 'a_level') {
        const uniEl = $('#uniInput'), majEl = $('#majorInput');
        if (uniEl) WIZ.university = uniEl.value;
        if (majEl) WIZ.major = majEl.value;
        if (!WIZ.university || !WIZ.major) return toast('เลือกมหาวิทยาลัยและคณะจากรายการ');
      }
    } else if (step === 'consent') {
      if (!WIZ.pdpa) return toast('ต้องยอมรับเงื่อนไขการใช้งานก่อนเริ่มเรียน');
      return wizFinish();
    }
  } else if (step === 'consent') {
    // ข้อสุดท้ายข้ามไม่ได้ ต้องติ๊กยอมรับก่อนเสมอ
    if (!WIZ.pdpa) return toast('ต้องยอมรับเงื่อนไขการใช้งานก่อน');
    return wizFinish();
  }
  WIZ.step++;
  wizRender($('#app'));
}

function wizBack() { WIZ.step = Math.max(0, WIZ.step - 1); wizRender($('#app')); }

async function wizFinish() {
  const gpa = WIZ.gpa ? toNumber(WIZ.gpa) : null;
  S.level = WIZ.grade;
  S.profile = {
    school: WIZ.school || null, grade: WIZ.grade, gpa: gpa, understanding: WIZ.understanding || null,
    goal: WIZ.goal || null, university: WIZ.university || null, major: WIZ.major || null
  };
  S.onboarded = true;
  save();
  await persistConsent(WIZ.ai);

  if (Cloud.signedIn()) {
    try {
      await sbFetch('/rest/v1/rpc/save_onboarding', {
        method: 'POST',
        body: JSON.stringify({
          p_school: WIZ.school || null, p_grade: WIZ.grade, p_gpa: gpa,
          p_goal: WIZ.goal || null, p_weak: null,
          p_target_university: WIZ.university || null, p_target_major: WIZ.major || null,
          p_understanding: WIZ.understanding || null
        })
      });
    } catch (e) { console.warn('บันทึกข้อมูลผู้เรียนไม่สำเร็จ', e); }
  }
  WIZ = null;
  // ไปหน้าชวนทำ Pre-Test ก่อน แทนที่จะพาเข้าเรียนทันที — นี่คือขั้น Personalize
  go('#/personalize');
}

/** บันทึกความยินยอม — แยกจาก save_onboarding เพราะ PDPA ห้ามผูกความยินยอมที่ไม่จำเป็น
    (แชร์ข้อมูลไปพัฒนา AI) เข้ากับความยินยอมที่จำเป็นต่อการใช้งาน (เงื่อนไขการใช้งาน) */
async function persistConsent(aiData) {
  S.consent = { pdpaAt: (S.consent && S.consent.pdpaAt) || new Date().toISOString(), aiData: !!aiData };
  save();
  if (!Cloud.signedIn()) return;
  try {
    await sbFetch('/rest/v1/rpc/save_consent', {
      method: 'POST', body: JSON.stringify({ p_ai_data: !!aiData })
    });
  } catch (e) { console.warn('บันทึกความยินยอมไม่สำเร็จ', e); }
}

/* ---------- เปลี่ยนเป้าหมายภายหลัง (หน้าตั้งค่า) ---------- */
let SETGOAL = null;

function viewSetGoal(app) {
  const p = S.profile || {};
  if (!SETGOAL) SETGOAL = { goal: p.goal || '', university: p.university || '', major: p.major || '' };
  app.innerHTML = `
    <h1>ตั้งเป้าหมายของฉัน</h1>
    <p class="sub">เปลี่ยนได้ทุกเมื่อ ติวเตอร์และคำแนะนำเส้นทางจะปรับตามทันที</p>
    ${renderGoalPicker(SETGOAL.goal, SETGOAL.university, SETGOAL.major, 'setGoalPick')}
    <div style="height:18px"></div>
    <button class="btn" onclick="saveGoalOnly()">บันทึกเป้าหมาย</button>
    <div style="height:10px"></div>
    <button class="btn ghost" onclick="SETGOAL=null;history.back()">ยกเลิก</button>`;
}
function setGoalPick(id, field, value) {
  if (field) { SETGOAL[field] = value; return; }
  SETGOAL.goal = id;
  viewSetGoal($('#app'));
}
async function saveGoalOnly() {
  const goal = SETGOAL.goal, university = SETGOAL.university, major = SETGOAL.major;
  if (goal === 'a_level' && (!university || !major)) return toast('เลือกมหาวิทยาลัยและคณะจากรายการ');
  S.profile = Object.assign({}, S.profile, { goal: goal || null, university: university || null, major: major || null });
  save();
  if (Cloud.signedIn()) {
    try {
      await sbFetch('/rest/v1/rpc/save_onboarding', {
        method: 'POST',
        body: JSON.stringify({
          p_school: null, p_grade: null, p_gpa: null,
          p_goal: goal || null, p_weak: null,
          p_target_university: university || null, p_target_major: major || null
        })
      });
    } catch (e) { console.warn('บันทึกเป้าหมายไม่สำเร็จ', e); }
  }
  SETGOAL = null;
  go('#/me');
  toast('บันทึกเป้าหมายแล้ว');
}

/* ---------- นโยบายความเป็นส่วนตัว (PDPA) ---------- */
function viewPrivacy(app) {
  app.innerHTML = `
    <h1>นโยบายความเป็นส่วนตัว</h1>
    <p class="sub">ฉบับมาตรฐานสำหรับการทดสอบระบบ — ยังไม่ผ่านการตรวจโดยนักกฎหมาย
      ก่อนใช้งานจริงกับนักเรียนจำนวนมากควรให้ผู้เชี่ยวชาญด้าน PDPA ตรวจสอบอีกครั้ง</p>

    <h2>เราเก็บข้อมูลอะไรบ้าง</h2>
    <p class="sub">อีเมล (สำหรับเข้าสู่ระบบ) · โรงเรียน ระดับชั้น เกรดเฉลี่ย เป้าหมายการเรียน
      (จากแบบสอบถามตอนสมัคร ข้ามได้) · คะแนนและความคืบหน้ารายหน่วย · โจทย์และรูปที่คุณอัปโหลด ·
      บทสนทนากับติวเตอร์ AI ระหว่างใช้งาน (ไม่ถูกบันทึกถาวร หายเมื่อปิดหน้าเว็บ)</p>

    <h2>ใครเข้าถึงข้อมูลได้บ้าง</h2>
    <p class="sub">Supabase (ผู้ให้บริการฐานข้อมูล ตั้งอยู่สิงคโปร์) เก็บข้อมูลบัญชีและความคืบหน้า ·
      Google Gemini API ประมวลผลข้อความที่ส่งให้ติวเตอร์ AI ระหว่างการสนทนาเท่านั้น
      ไม่มีการขายข้อมูลให้บุคคลที่สาม</p>

    <h2>ความยินยอมสองส่วนที่แยกจากกัน</h2>
    <p class="sub"><b>จำเป็น</b> — เงื่อนไขการใช้งานทั่วไป ต้องยอมรับจึงจะใช้แอปได้<br>
      <b>ไม่บังคับ</b> — ยินยอมให้นำข้อมูลการเรียนแบบไม่ระบุตัวตนไปพัฒนา AI และวิเคราะห์เชิงสถิติ
      เลือกได้อิสระ ไม่กระทบการใช้งานหลัก เปลี่ยนใจภายหลังได้เสมอที่หน้า “ของฉัน”</p>

    <h2>สิทธิ์ของคุณ</h2>
    <p class="sub">สำรองข้อมูลของตัวเองเป็นไฟล์ได้ที่หน้า “ของฉัน” ตลอดเวลา ·
      ต้องการลบบัญชีถาวรหรือมีคำถามอื่น ติดต่อทีมงานได้โดยตรง</p>

    <h2>สำหรับผู้ใช้ที่เป็นเยาวชน</h2>
    <p class="sub">ถ้าคุณอายุยังไม่ถึงเกณฑ์ตามกฎหมาย ต้องได้รับความยินยอมจากผู้ปกครองก่อนใช้งาน
      ระบบนี้ยืนยันด้วยการติ๊กยอมรับเอง ยังไม่มีการตรวจสอบตัวตนผู้ปกครองจริง</p>

    <div style="height:16px"></div>
    <button class="btn ghost" onclick="history.back()">ย้อนกลับ</button>`;
}

/* ============ ติวเตอร์ AI ============ */
const Tutor = { history: [], busy: false, voice: false, ctx: null, pendingImage: null, stage: null };

/* ขั้นของบทเรียน — สอนก่อน แล้วค่อยฝึก แล้วสรุป แล้วจบ
   แยกขั้นชัดเจนเพราะถ้าให้สอนกับออกโจทย์ในข้อความเดียว คำตอบจะยาวจนโดนตัดกลางประโยค */
const LESSON_STAGES = [
  { id: 'teach', name: 'สอน' },
  { id: 'example', name: 'ตัวอย่าง' },
  { id: 'guided', name: 'ฝึกพร้อมคำใบ้' },
  { id: 'drill', name: 'ทำเอง' },
  { id: 'summary', name: 'สรุป' },
  { id: 'done', name: 'จบ' }
];

/** แยก data URL เป็น mimeType กับ base64 ล้วน — Gemini รับรูปเป็นสองส่วนนี้แยกกัน */
function splitDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  return m ? { mimeType: m[1], data: m[2] } : null;
}

/** ส่งข้อความไปที่ Edge Function — คีย์ Gemini อยู่ฝั่งนั้น ไม่ได้อยู่ในเบราว์เซอร์
    image ส่งเฉพาะข้อความปัจจุบัน ไม่ฝังซ้ำตอน replay ประวัติ ไม่งั้น payload จะบวมทุกเทิร์น */
Tutor.ask = async function (message, context, image) {
  if (!Cloud.signedIn()) throw new Error('ต้องเข้าสู่ระบบก่อนใช้ติวเตอร์');
  const p = S.profile || {};
  const res = await sbFetch('/functions/v1/tutor', {
    method: 'POST',
    body: JSON.stringify({
      message: message,
      context: [context, typeof PersonalPath !== "undefined" ? PersonalPath.context() : ""].filter(Boolean).join("\n") || null,
      // ขอข้อมูลข้อสอบจริงเฉพาะงานที่ต้องเทียบความยาก ไม่ใช่ทุกครั้งที่คุย
      wantExamEvidence: !!(Tutor.ctx && Tutor.ctx.wantExamEvidence),
      examYear: (Tutor.ctx && Tutor.ctx.examYear) || null,
      examTopic: Tutor.ctx && Tutor.ctx.topicId,
      maxOut: (Tutor.ctx && Tutor.ctx.maxOut) || null,
      // ชุดข้อสอบหนึ่งชุดถูกแบ่งเป็นหลายก้อน ต้องบอกลำดับไว้ให้นับโควตาแค่ครั้งเดียวต่อชุด
      batchIndex: (Tutor.ctx && typeof Tutor.ctx.batchIndex === 'number') ? Tutor.ctx.batchIndex : null,
      history: Tutor.history.slice(-8).map(m => ({ role: m.role, text: m.text })),
      image: image ? splitDataUrl(image) : null,
      // ระดับชั้นจากหน่วยที่กำลังทำมาก่อน แล้วค่อยถอยไปที่ระดับที่เลือกไว้/ที่กรอกตอนสมัคร
      level: (Tutor.ctx && Tutor.ctx.levelId) || S.level || p.grade || null,
      unit: Tutor.ctx && Tutor.ctx.unitName,
      // ชื่อหัวข้อย่อย ถ้าไม่ส่ง AI จะสอนทั้งหน่วยแล้วลอยไปเรื่องอื่น
      subLesson: (Tutor.ctx && Tutor.ctx.subName) || null,
      subWhy: (Tutor.ctx && Tutor.ctx.subWhy) || null,
      mode: (Tutor.ctx && Tutor.ctx.genset) ? 'genset'
        : (Tutor.ctx && Tutor.ctx.lesson) ? 'lesson' : 'ask',
      samples: (Tutor.ctx && Tutor.ctx.samples) || null,
      school: p.school, gpa: p.gpa, goal: p.goal,
      university: p.university, major: p.major, selfRating: p.understanding
    })
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'ติวเตอร์ไม่พร้อมใช้งาน');
  return d.text;
};

/** เรียก Edge Function โหมดวิเคราะห์ผลทดสอบ — คืน JSON โครงสร้างแน่นอน ไม่ใช่ข้อความแชท */
async function analyzePretest(payload) {
  const res = await sbFetch('/functions/v1/tutor', {
    method: 'POST',
    body: JSON.stringify(Object.assign({ mode: 'analyze' }, payload))
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'วิเคราะห์ไม่สำเร็จ');
  return d; // { predictedGpa, analysis, recommendedUnits }
}

/** วิเคราะห์โจทย์ที่ผู้ใช้อัปโหลด — เทียบความยากกับเป้าหมาย ไม่รับ/ไม่ต้องการเฉลย */
async function analyzeUploadedQuestion(payload) {
  const res = await sbFetch('/functions/v1/tutor', {
    method: 'POST',
    body: JSON.stringify(Object.assign({ mode: 'analyzeUpload' }, payload))
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'วิเคราะห์ไม่สำเร็จ');
  return d; // { difficulty, note, recommendHarder }
}

/** ให้ AI เฉลยโจทย์ที่กำลังอัปโหลด — ใช้ตอนผู้ใช้กด "ให้ AI ช่วยเฉลย" แทนกรอกเฉลยเอง
    ผู้ใช้แค่กดยืนยันว่าถูกไหมหลังเห็นคำตอบที่ AI เสนอ */
async function solveUploadedQuestion(payload) {
  const res = await sbFetch('/functions/v1/tutor', {
    method: 'POST',
    body: JSON.stringify(Object.assign({ mode: 'solveUpload' }, payload))
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'เฉลยไม่สำเร็จ');
  return d; // { answerText, choiceIndex, reasoning }
}

/** ค้นสถิติคะแนนที่ใช้ยื่นมหาวิทยาลัย/คณะ — ใช้ Gemini Search grounding เพราะเราไม่มีฐานข้อมูล
   คะแนนจริง ผลลัพธ์จึงต้องกำกับเสมอว่าเป็นข้อมูลจาก AI+เว็บ อาจไม่ใช่ประกาศทางการล่าสุด */
async function getUniStats(university, major) {
  const res = await sbFetch('/functions/v1/tutor', {
    method: 'POST',
    body: JSON.stringify({ mode: 'uniStats', university: university, major: major })
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'ค้นข้อมูลไม่สำเร็จ');
  return d; // { text, sources }
}

/** ออกชุดข้อสอบให้ยากเท่าของจริง
    เซิร์ฟเวอร์จะแนบหลักฐานจากข้อสอบจริง (โจทย์ที่ Typhoon OCR อ่านมา + ค่าความยากที่วัดได้)
    เข้าไปในระบบพรอมป์ตอนที่ส่ง wantExamEvidence — ตรงนี้แค่สั่งให้ยึดตัวเลขนั้นเป็นเป้า
    ไม่งั้นโมเดลจะออกข้อขั้นเดียวซึ่งง่ายกว่าของจริงมาก */
/** โมเดลเขียน LaTeX ในสตริง JSON เป็น $\sqrt{3}$ ซึ่ง \s ไม่ใช่ escape ที่ JSON ยอมรับ
    ข้อเดียวที่มีรากทำให้ JSON.parse ล้มทั้งชุด แล้วระบบตกไปใช้คลังข้อง่ายแทน
    ต้องดูเป็นชุด ไม่ใช่ทีละตัว ไม่งั้นจะไปทำลาย \\vec ที่ escape ถูกอยู่แล้ว */
const JSON_ESCAPES = new Set(['\\', '\\"', '/', 'b', 'f', 'n', 'r', 't', 'u']);
function fixJsonEscapes(str) {
  return String(str).replace(/(\\+)([\\s\\S])/g, (all, run, ch) =>
    (run.length % 2 === 0 || JSON_ESCAPES.has(ch)) ? all : run + '\\' + ch);
}

/** parse ผลจากโมเดล ซ่อม escape ให้ก่อน ถ้ายังพังค่อยคืน null */
function parseModelJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { /* ลองซ่อม escape */ }
  try { return JSON.parse(fixJsonEscapes(m[0])); } catch (e) { return null; }
}

/** กติกาการออกข้อ ใช้ร่วมกันทุกก้อน */
const MOCK_RULES =
  ' ห้ามก็อปข้อสอบ ทปอ. ตัวเลขต้องคนละชุดกับข้อสอบจริง t เป็น mc หรือ num ถ้า num ใส่ a เป็นตัวเลข ไม่ต้องมี c'
  + ' ความยากต้องเท่าข้อสอบจริง ไม่ใช่ระดับแบบฝึกหัด: ดูค่า avgSteps และ hardShare ในหลักฐานข้อสอบจริงที่แนบมา'
  + ' แล้วออกให้ขั้นการคิดเฉลี่ยไม่ต่ำกว่านั้น ห้ามมีข้อที่แทนค่าครั้งเดียวจบ'
  + ' อย่างน้อยหนึ่งในสามของก้อนนี้ต้องเป็นข้อที่ต้องรวมสองแนวคิดขึ้นไปถึงจะแก้ได้'
  + ' ตัวเลือกลวงต้องมาจากความเข้าใจผิดที่พบจริง เช่น เผลอสลับเครื่องหมาย ลืมกรณี ใช้สูตรผิดเงื่อนไข ไม่ใช่ตัวเลขสุ่ม'
  + ' ข้อปรนัยต้องมี 5 ตัวเลือกเท่าข้อสอบจริง'
  + ' ความยากมาจากจำนวนขั้นคิด ไม่ใช่ความยาวของข้อความ ข้อสอบจริงยาวกลางๆ ราว 180 ตัวอักษร และใช้ราว 3 ถึง 4 ขั้น'
  + ' เขียนกระชับแบบข้อสอบจริง ทุกประโยคต้องจำเป็นต่อการแก้โจทย์'
  + ' ห้ามใส่เรื่องเล่าหรือฉากประกอบที่ไม่ได้ใช้คำนวณ ห้ามทวนคำถามซ้ำ ห้ามอธิบายสิ่งที่โจทย์บอกไปแล้ว'
  + ' เงื่อนไขทุกข้อที่ให้มาต้องถูกใช้จริงในการหาคำตอบ ถ้าตัดประโยคไหนออกแล้วยังแก้ได้เหมือนเดิม แปลว่าประโยคนั้นไม่ควรมี'
  + ' ข้อที่ต้องดูกราฟให้ใส่ฟิลด์ fig เป็น {"kind":"graph","fn":"x**2-2*x","domain":[-3,5],"alt":"คำบรรยาย"}'
  + ' หรือ {"kind":"points","pts":[[0,1],[1,4]],"alt":"..."} ระบบจะวาดให้เอง'
  + ' fn เขียนแบบ JavaScript ใช้ได้แค่ x ตัวเลข + - * / ** วงเล็บ และ sin cos tan sqrt abs log exp'
  + ' ข้อที่ไม่ต้องใช้รูปให้ fig เป็น null ห้ามใส่ลิงก์รูปหรือ ascii art'
  + ' แต่ละข้อต้องจบในตัว ห้ามอ้างข้ออื่น ห้ามใช้คำว่า จากข้อบน ชุดเดิม ข้อมูลข้างต้น'
  + ' ถ้ามีตารางหรือชุดข้อมูล ห้ามวาดด้วยอักขระ ให้ไล่เป็นรายการทีละบรรทัด'
  + ' เขียนตัวเลขและสมการด้วย LaTeX ครอบ $...$'
  + ' ช่อง s เขียนสั้นไม่เกินหนึ่งประโยค อย่าอธิบายวิธีทำยาว'
  + ' ในทุกก้อนต้องมีอย่างน้อยหนึ่งข้อที่ยาวกว่าเพื่อน คือให้ข้อมูลตั้งต้นหลายบรรทัด เช่น ตารางข้อมูล หรือเงื่อนไขสามข้อขึ้นไป'
  + ' แต่ข้อมูลทุกบรรทัดต้องถูกใช้จริง ไม่ใช่ยาวเพราะใส่น้ำ'
  + ' และต้องมีอย่างน้อยหนึ่งข้อที่ต้องอ่านกราฟถึงจะตอบได้ โดยใส่ฟิลด์ fig ให้ระบบวาดกราฟให้'
  + ' ข้อที่มี fig ต้องถามสิ่งที่ดูจากกราฟ เช่น จุดตัดแกน ค่าต่ำสุด ช่วงที่เพิ่มขึ้น ห้ามบอกสูตรซ้ำในโจทย์จนไม่ต้องดูกราฟ';

/* ชุดข้อสอบที่เตรียมไว้ล่วงหน้า เก็บข้ามการรีเฟรชหน้าได้
   ผู้ใช้จะได้กดเริ่มสอบแล้วเข้าห้องสอบทันที ไม่ต้องนั่งรอสามนาที */
const MOCK_CACHE_KEY = 'softomni.mockset.v2';
const MOCK_CACHE_DAYS = 3;

/** งานที่กำลังเตรียมอยู่ตอนนี้ — null คือยังไม่ได้เริ่ม */
let MOCK_PREFETCH = null;

function onMockProgress(done, total) {
  if (MOCK_PREFETCH) { MOCK_PREFETCH.done = done; MOCK_PREFETCH.total = total; }
  const el = typeof $ === 'function' ? $('#prepCount') : null;
  if (el) el.textContent = done + '/' + total + ' ข้อ';
}

/* คลังข้อสอบสะสม แทนที่จะออกใหม่ทั้ง 30 ข้อทุกครั้ง (ราว 7 นาที)
   ข้อที่เคยออกไว้ถูกเก็บสะสม รอบต่อไปหยิบใช้ได้ทันทีแล้วค่อยเติมคลังเบื้องหลัง
   ข้อที่หยิบไปใช้แล้วถูกลบออก จึงไม่มีทางเจอซ้ำ */
const MOCK_BANK_MAX = 120;

function readMockBank() {
  try {
    const d = JSON.parse(localStorage.getItem(MOCK_CACHE_KEY) || "null");
    if (!d || !Array.isArray(d.qs)) return [];
    const ageDays = (Date.now() - new Date(d.at).getTime()) / 86400000;
    if (!(ageDays >= 0) || ageDays > MOCK_CACHE_DAYS) return [];
    // เปลี่ยนระดับชั้นแล้วข้อเดิมใช้ไม่ได้ ต้องออกใหม่ให้ตรงชั้น
    if (d.level && typeof userClassId === "function" && d.level !== userClassId()) return [];
    return d.qs;
  } catch (e) { return []; }
}

function writeMockBank(qs) {
  try {
    localStorage.setItem(MOCK_CACHE_KEY, JSON.stringify({
      at: new Date().toISOString(),
      level: typeof userClassId === "function" ? userClassId() : null,
      qs: qs.slice(0, MOCK_BANK_MAX)
    }));
  } catch (e) { /* พื้นที่เต็มก็แค่ไม่ได้เก็บ ไม่ถึงกับใช้งานไม่ได้ */ }
}

/** เติมข้อใหม่เข้าคลัง ตัดข้อที่ซ้ำกับของเดิมทิ้ง */
function addToMockBank(qs) {
  const bank = readMockBank();
  const key = q => String(q && q.q || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const seen = new Set(bank.map(key));
  (qs || []).forEach(q => { const k = key(q); if (k && !seen.has(k)) { seen.add(k); bank.push(q); } });
  writeMockBank(bank);
  return bank.length;
}

/** ยังมีข้อพอสำหรับหนึ่งชุดไหม */
function mockBankReady() {
  const want = typeof examFormat === "function" ? examFormat().questions : 30;
  return readMockBank().length >= want;
}

/** ของเดิมชื่อนี้ ยังมีที่เรียกอยู่ในหน้าคำชี้แจง */
function readMockCache() { return mockBankReady() ? readMockBank() : null; }

function clearMockCache() {
  try { localStorage.removeItem(MOCK_CACHE_KEY); } catch (e) { /* ไม่เป็นไร */ }
}

/** สั่งเติมคลังไว้เงียบๆ เรียกซ้ำได้ ไม่สร้างงานซ้อน
    คลังเต็มพอแล้วจะไม่ทำ เพื่อไม่ให้เปลืองโควตาต่อวัน */
function prefetchMockSet(force) {
  if (typeof Cloud === "undefined" || !Cloud.signedIn()) return null;
  if (MOCK_PREFETCH && !MOCK_PREFETCH.settled) return MOCK_PREFETCH.promise;
  if (!force && mockBankReady()) return null;
  const want = typeof examFormat === "function" ? examFormat().questions : 30;
  const have = readMockBank().length;
  const need = Math.max(MOCK_BATCH, want - have);   // ออกเฉพาะส่วนที่ขาด ไม่ออกใหม่ทั้งชุด
  MOCK_PREFETCH = { done: have, total: want, settled: false, error: "", promise: null };
  MOCK_PREFETCH.promise = fetchAiMockQuestions(need)
    .then(qs => {
      addToMockBank(qs);
      MOCK_PREFETCH.settled = true;
      if (mockBankReady() && typeof notifyMockReady === "function") notifyMockReady();
      return readMockBank();
    })
    .catch(e => {
      MOCK_PREFETCH.settled = true;
      MOCK_PREFETCH.error = e && e.message ? e.message : String(e);
      throw e;
    });
  return MOCK_PREFETCH.promise;
}

/** หยิบหนึ่งชุดจากคลัง — ข้อที่หยิบไปถูกลบออกจากคลัง จึงไม่ซ้ำรอบหน้า
    คลังไม่พอค่อยรอให้ออกเพิ่ม */
async function takeMockSet() {
  const want = typeof examFormat === "function" ? examFormat().questions : 30;
  let bank = readMockBank();
  if (bank.length < want) {
    try { await prefetchMockSet(true); } catch (e) { if (!bank.length) throw e; }
    bank = readMockBank();
  }
  if (!bank.length) throw new Error("AI ยังออกข้อไม่ได้");
  const take = bank.slice(0, want);
  writeMockBank(bank.slice(want));
  setTimeout(() => { try { prefetchMockSet(); } catch (e) { /* เติมคลังรอบหน้า */ } }, 1500);
  return take;
}

/** ผู้เรียนยังไม่ผ่านหัวข้อย่อยนี้ ให้ AI แตกเป็นหัวข้อย่อยที่เล็กลงจากจุดที่พลาดจริง
    เก็บไว้ในเครื่อง แล้วจะโผล่ในรายการหัวข้อย่อยของบทนั้นทันที */
async function proposeRemedialSubs(topic, subName, missed) {
  if (!topic || typeof Cloud === 'undefined' || !Cloud.signedIn()) return [];
  const existing = ((S.extraSubs || {})[topic.id] || []).map(x => x.name);
  if (existing.length >= 4) return [];   // อย่าให้รายการยาวเกินจนอ่านไม่ไหว
  const prev = Tutor.ctx, prevHist = Tutor.history;
  Tutor.ctx = { lesson: false, genset: true, maxOut: 700, unitName: topic.name,
                levelId: (typeof userClassId === 'function' ? userClassId() : null) };
  Tutor.history = [];
  try {
    const text = await Tutor.ask(
      'ตอบเป็น JSON อย่างเดียว: {"subs":[{"name":"ชื่อหัวข้อย่อยสั้นๆ","why":"เหตุผลหนึ่งประโยค"}]}'
        + ' เสนอหัวข้อย่อยซ่อมเสริม 1 ถึง 2 หัวข้อ สำหรับผู้เรียนที่เพิ่งทำหัวข้อ "' + String(subName || topic.name) + '" ไม่ผ่าน'
        + ' แต่ละหัวข้อต้องเล็กกว่าเดิมและเจาะจงทักษะเดียว เช่น แยกขั้นที่เขาพลาดออกมาฝึกเฉพาะจุด'
        + ' ห้ามตั้งชื่อซ้ำกับที่มีอยู่แล้ว: ' + (existing.join(', ') || 'ไม่มี')
        + ' ห้ามเสนอหัวข้อที่กว้างกว่าเดิมหรือเป็นเรื่องอื่นนอกบท ' + topic.name,
      'จุดที่พลาดบ่อย: ' + ((missed || []).slice(0, 6).join(', ') || 'ไม่ระบุ')
    );
    const data = parseModelJson(text);
    const subs = (data && data.subs) || [];
    if (!Array.isArray(subs) || !subs.length) return [];
    const added = subs.slice(0, 2)
      .filter(x => x && x.name && existing.indexOf(String(x.name)) < 0)
      .map((x, i) => ({
        id: topic.id + ':ai' + Date.now() + i,
        name: String(x.name).slice(0, 60),
        why: String(x.why || '').slice(0, 160),
        at: new Date().toISOString()
      }));
    if (!added.length) return [];
    S.extraSubs = Object.assign({}, S.extraSubs);
    S.extraSubs[topic.id] = ((S.extraSubs[topic.id]) || []).concat(added);
    save();
    return added;
  } catch (e) {
    console.warn('เสนอหัวข้อซ่อมเสริมไม่สำเร็จ', e);
    return [];
  } finally {
    Tutor.ctx = prev;
    Tutor.history = prevHist;
  }
}

/** ออกทีละก้อนเล็ก
    วัดจริง: 30 ข้อรวดเดียวใช้ 227 วินาที · ก้อนละ 6 ข้อใช้ 117 วินาที ซึ่งชิดขอบ timeout 120 เกินไป
    ก้อนละ 3 ข้อจึงมีระยะปลอดภัย และงานนี้ทำเบื้องหลังอยู่แล้ว เวลารวมไม่กระทบผู้ใช้ */
const MOCK_BATCH = 3;

async function fetchAiMockQuestions(want) {
  const bp = typeof mockBlueprintForUser === "function" ? mockBlueprintForUser(want) : {};
  const count = bp.items || want || (typeof MOCK_LEN === "number" ? MOCK_LEN : 15);
  const mix = Array.isArray(bp.mix) && bp.mix.length ? bp.mix : [["set", count]];

  // กระจายหัวข้อตามบลูปริ้นลงแต่ละก้อน ก้อนละไม่เกิน MOCK_BATCH ข้อ
  const groups = [];
  let cur = [];
  let curN = 0;
  mix.forEach(pair => {
    let left = pair[1];
    while (left > 0) {
      const take = Math.min(left, MOCK_BATCH - curN);
      cur.push([pair[0], take]);
      curN += take;
      left -= take;
      if (curN >= MOCK_BATCH) { groups.push(cur); cur = []; curN = 0; }
    }
  });
  if (cur.length) groups.push(cur);

  const prev = Tutor.ctx;
  const prevHist = Tutor.history;
  const errors = [];
  let out = [];
  try {
    // ทำเรียงกันทีละก้อน ไม่ยิงขนาน — วัดแล้วว่าเครื่อง Gemma ประมวลผลทีละคิวอยู่ดี
    // ยิงพร้อมกันทำให้ทุกก้อนช้าลงจนชน timeout พร้อมกันหมด (สำเร็จแค่ 2 จาก 5)
    const seen = new Set();
    for (let i = 0; i < groups.length; i++) {
      try {
        const got = await askMockBatch(groups[i], bp, i);
        (got || []).forEach(q => {
          const key = String(q.q || "").replace(/\s+/g, " ").trim().slice(0, 80);
          if (!key || seen.has(key)) return;
          seen.add(key);
          out.push(q);
        });
      } catch (e) {
        errors.push(e && e.message ? e.message : String(e));
      }
      if (typeof onMockProgress === "function") onMockProgress(out.length, count);
    }
  } finally {
    Tutor.ctx = prev;
    Tutor.history = prevHist;
  }
  if (!out.length) throw new Error(errors[0] || "AI ไม่ตอบกลับมา");
  if (out.length < Math.min(8, count)) {
    throw new Error("AI ออกได้ " + out.length + " ข้อจาก " + count + (errors.length ? " · " + errors[0] : ""));
  }
  return out.slice(0, count);
}

/** ขอข้อสอบหนึ่งก้อนตามหัวข้อที่กำหนด */
async function askMockBatch(group, bp, index) {
  const n = group.reduce((s, g) => s + g[1], 0);
  const topics = group.map(g => {
    const t = typeof alevelTopic === "function" ? alevelTopic(g[0]) : null;
    return (t ? t.name : g[0]) + " " + g[1] + " ข้อ";
  }).join(", ");
  Tutor.ctx = {
    lesson: false, unitName: "Mock", wantExamEvidence: true, genset: true,
    maxOut: 2600, batchIndex: index || 0,
    levelId: (typeof userClassId === "function" ? userClassId() : null)
  };
  Tutor.history = [];
  const text = await Tutor.ask(
    'ตอบเป็น JSON อย่างเดียว ห้าม markdown ห้ามคำนำ: {"questions":[{"q":"โจทย์","t":"mc","c":["ก","ข","ค","ง","จ"],"a":0,"s":"เหตุผลสั้น","_topic":"set","fig":null}]} ให้ครบ '
      + n + " ข้อ ตามสัดส่วนนี้: " + topics + MOCK_RULES,
    "บลูปริ้น: " + JSON.stringify({ year: bp.year, avgSteps: bp.avgSteps, extra: bp.extra })
  );
  if (!text) throw new Error("AI ไม่ตอบกลับมา");
  const data = parseModelJson(text);
  if (!data) throw new Error("AI ตอบมา " + String(text).length + " อักขระ แต่อ่านเป็นชุดข้อสอบไม่ได้");
  const qs = data.questions || data;
  if (!Array.isArray(qs)) throw new Error("AI ตอบผิดรูปแบบ ไม่มีรายการข้อสอบ");
  return qs
    .filter(q => q && q.q && (typeof isDependentStem !== "function" || !isDependentStem(q)))
    .map(q => Object.assign({}, q, {
      _ai: true,
      _topic: q._topic || q.topic,
      t: q.t || (q.c ? "mc" : "num")
    }));
}

/** เปิดห้องคุยแบบอิสระ ไม่ผูกกับบทเรียนหรือโจทย์ข้อไหน — ถามอะไรก็ได้
    ถ้ากำลังคุยค้างอยู่แล้วก็สานต่อ ไม่ล้างประวัติทิ้งเวลาสลับแท็บไปมา */
function openTutorChat() {
  // ถ้าก่อนหน้านี้กำลังอยู่ในโหมดติวหน่วย/ฝึกตามเป้าหมาย ต้องเริ่มห้องคุยอิสระใหม่
  // ไม่งั้นหัวข้อ/ประวัติของบทเรียนเดิมจะค้างอยู่ ทั้งที่แท็บ AI Tutor ควรเป็นคนละโหมดกับบทเรียน
  if (!Tutor.ctx || Tutor.ctx.lesson || Tutor.ctx.planner) {
    Tutor.ctx = { unitId: null, levelId: S.level, unitName: '', lesson: false,
                  samples: null, q: '', correct: null, given: null };
    Tutor.history = [];
  }
  go('#/tutor');
}

/** คุยกับ AI เพื่อปรับกราฟแผนเรียน — เวลา + ลำดับบทของคนนี้ ไม่ใช่หลักสูตรตายตัว */
function openPlannerChat() {
  if (!Cloud.signedIn()) return go('#/auth/signin');
  Tutor.ctx = {
    planner: true, lesson: false, unitId: null,
    levelId: typeof userClassId === 'function' ? userClassId() : S.level,
    unitName: 'วางแผนเรียน', samples: null, q: '', correct: null, given: null
  };
  Tutor.history = [];
  go('#/tutor');
}

/** เทียบโจทย์กับ A-Level แล้วแยกเป็นขั้นย่อยที่ง่ายกว่า — ไม่เฉลยข้อต้นฉบับ */
async function analyzeAndSplit(question, image) {
  const prev = Tutor.ctx;
  const prevHist = Tutor.history;
  const p = S.profile || {};
  let difficulty = '', note = '', recommendHarder = false, parts = [], vs = '';
  try {
    try {
      const a = await analyzeUploadedQuestion({
        question: question,
        source: (window._askQ && window._askQ.source) || 'ask',
        level: typeof userClassId === 'function' ? userClassId() : S.level,
        unit: (window._askQ && window._askQ.topic) || '',
        goal: 'a_level',
        university: p.university,
        major: p.major
      });
      difficulty = a.difficulty || '';
      note = a.note || '';
      recommendHarder = !!a.recommendHarder;
    } catch (e1) { /* ยังแยกขั้นได้แม้โหมด analyzeUpload ล้ม */ }

    Tutor.ctx = {
      lesson: false, unitName: 'วิเคราะห์โจทย์',
      levelId: typeof userClassId === 'function' ? userClassId() : S.level
    };
    Tutor.history = [];
    const text = await Tutor.ask(
      'ตอบเป็น JSON อย่างเดียว ห้าม markdown ห้ามคำนำ: {"vsAlevel":"ง่ายกว่า A-Level / ใกล้เคียงข้อสอบ / ยากกว่า A-Level","parts":[{"title":"ขั้นที่ 1","q":"โจทย์ย่อยที่ง่ายกว่า","hint":"ใบ้สั้น"}]} ถอดข้อยากข้อนี้ออกเป็นขั้นย่อยที่ง่ายกว่า มี 3 ถึง 5 ขั้น แล้วเรียงลำดับให้ทำจากง่ายไปยากจนกลับไปตอบข้อต้นฉบับได้ ห้ามเฉลยคำตอบสุดท้ายของข้อต้นฉบับ ขั้นย่อยต้องเป็นโจทย์ที่นักเรียนทำเองได้',
      'เป้าหมาย: A-Level คณิตศาสตร์ประยุกต์ 1 (30 ข้อ 90 นาที 100 คะแนน ค่าเฉลี่ยประเทศประมาณ 20.44/100)\nโจทย์:\n' + (question || '(อยู่ในรูป)'),
      image
    );
    const data = parseModelJson(text);
    if (data) {
      vs = data.vsAlevel || '';
      if (!difficulty && data.difficulty) difficulty = data.difficulty;
      parts = Array.isArray(data.parts) ? data.parts.filter(x => x && (x.q || x.title)).slice(0, 5).map(x => ({
        title: String(x.title || '').slice(0, 80),
        q: String(x.q || x.question || '').slice(0, 800),
        hint: String(x.hint || '').slice(0, 240)
      })) : [];
    }
  } catch (e) {
    if (!difficulty && !parts.length) throw e;
  } finally {
    Tutor.ctx = prev;
    Tutor.history = prevHist;
  }
  if (!difficulty) difficulty = vs || 'เทียบ A-Level ไม่ระบุระดับ';
  if (vs && note && note.indexOf(vs) < 0) note = vs + '\n' + note;
  else if (vs && !note) note = vs;
  return { difficulty: difficulty, note: note, parts: parts, recommendHarder: recommendHarder, vsAlevel: vs };
}

/** เปิดห้องคุย พร้อมบริบทของโจทย์ที่กำลังทำ */
function askTutor(unitId, qText, correct, given) {
  const found = findUnit(unitId);
  Tutor.ctx = {
    unitId: unitId,
    levelId: found ? found.levelId : null,
    unitName: found ? found.unit.name : '',
    q: qText || '', correct: correct, given: given
  };
  Tutor.history = [];
  go('#/tutor/' + unitId);
}

/** โหมดคุยเรียนทั้งหน่วย — ติวเตอร์ตั้งคำถามเอง ทีละข้อ
    ส่งโจทย์ในหลักสูตรไปเป็นตัวอย่าง เพื่อคุมความยากไม่ให้หลุดระดับชั้น */
/** ให้ AI ออกโจทย์เพิ่มสำหรับฝึกหัวข้อย่อย/สอบท้ายบท — คลังในเครื่องมีบทละ 4 ข้อ
    ไม่พอโควตา 10–15 ข้อ จึงต้องเติมด้วยข้อที่สร้างใหม่ ไม่ใช่วนข้อเดิมซ้ำให้ครบ */
async function fetchAiTopicQuestions(topic, subLesson, count, avoid) {
  if (!topic || count <= 0) return [];
  const tier = subLesson ? subLesson.tier : 2;
  const level = tier >= 3 ? 'ยากระดับข้อสอบแข่งขัน'
    : tier === 2 ? 'ยากขึ้นแบบข้อสอบ A-Level หลายขั้น'
    : 'ระดับพื้นฐานถึงกลางตามหลักสูตร';
  const prev = Tutor.ctx, prevHist = Tutor.history;
  // ออกชุดโจทย์ฝึกก็เป็น genset เหมือนกัน ไม่งั้นโดนกฎ ตอบสั้นไม่เกิน 4 ประโยค เช่นกัน
  Tutor.ctx = { lesson: false, genset: true, maxOut: 4000, unitName: topic.name, levelId: (typeof userClassId === 'function' ? userClassId() : null) };
  Tutor.history = [];
  try {
    const text = await Tutor.ask(
      'ตอบเป็น JSON อย่างเดียว ห้าม markdown ห้ามคำนำ: {"questions":[{"q":"โจทย์","t":"mc","c":["ก","ข","ค","ง"],"a":0,"s":"เหตุผลสั้น"}]} ให้ครบ '
        + count + ' ข้อ ระดับ ' + level
        + ' t เป็น mc หรือ num ถ้า num ใส่ a เป็นตัวเลขและไม่ต้องมี c'
        + ' แต่ละข้อต้องจบในตัว ห้ามอ้างข้อก่อนหน้า ห้ามซ้ำโจทย์ในรายการห้ามซ้ำ'
        + ' ถ้ามีตาราง กราฟ หรือชุดข้อมูล ให้ไล่เป็นรายการทีละบรรทัดและเขียนสมการด้วย LaTeX ครอบ $...$ ห้ามวาดตารางด้วยอักขระ',
      'บท: ' + topic.name
        + (subLesson ? '\nหัวข้อย่อย: ' + subLesson.name : '')
        + (topic.know && topic.know.length ? '\nขอบเขต:\n' + topic.know.map(k => '- ' + k).join('\n') : '')
        + (avoid && avoid.length ? '\nห้ามซ้ำ:\n' + avoid.slice(0, 8).map(q => '- ' + q).join('\n') : '')
    );
    const data = parseModelJson(text);
    if (!data) return [];
    const qs = data.questions || data;
    if (!Array.isArray(qs)) return [];
    return qs
      .filter(q => q && q.q && q.a !== undefined && q.a !== null)
      .filter(q => typeof isDependentStem !== 'function' || !isDependentStem(q))
      .map(q => Object.assign({}, q, { _ai: true, t: q.t || (q.c ? 'mc' : 'num') }));
  } finally {
    Tutor.ctx = prev;
    Tutor.history = prevHist;
  }
}

/** วิเคราะห์ว่าชุดสอบจริงปีนั้นยากตรงไหน — ป้อนเฉพาะตัวเลขจริงของชุดนั้นให้ AI
    ไม่ได้ส่งตัวข้อสอบไปด้วย (ไม่มีในแอป) จึงสั่งห้ามเดาว่าข้อไหนถามอะไร */
async function analyzeExamYear(year) {
  const x = typeof examPressure === 'function' ? examPressure(year) : null;
  if (!x) throw new Error('ไม่มีข้อมูลชุดปีนี้');
  const pred = typeof predictedAlevel === 'function' ? predictedAlevel() : null;
  const weak = (typeof gapTopics === 'function' ? gapTopics() : []).slice(0, 5).map(t => t.name);
  const facts = [
    'ชุด: ' + x.label + ' ปี ' + x.year,
    x.q ? 'จำนวนข้อ: ' + x.q : '',
    x.minutes ? 'เวลา: ' + x.minutes + ' นาที' : '',
    x.secPerQ ? 'เฉลี่ยต่อข้อ: ' + x.secPerQ + ' วินาที' : '',
    'ความยาว: ' + x.pages + ' หน้า',
    x.corpus ? 'ความครอบคลุม: ' + x.corpus.counted + ' ข้อ; ประเมินได้ ' + x.corpus.ratedCount + '; ' + x.corpus.coverage + '; ยังไม่ปรับเทียบคะแนนจริง' : 'ยังไม่มีข้อมูลจากคลังข้อสอบ',
    x.avgSteps ? 'ขั้นคิดเฉลี่ยที่ AI ประเมิน: ' + x.avgSteps : '',
    x.hardShare != null ? 'สัดส่วนข้อยากที่ AI ประเมิน: ' + Math.round(x.hardShare * 100) + '%' : '',
    x.focus.length ? 'บทที่เน้นปีนี้: ' + x.focus.join(', ') : '',
    'สัดส่วนตามสาระ: ' + x.strands.map(s => s.name + ' ' + s.share).join(' · '),
    'ค่าเฉลี่ยประเทศล่าสุด: ' + ALEVEL_NATIONAL.pct + ' คะแนน (' + ALEVEL_NATIONAL.year + ')',
    pred ? 'Pre-test ของผู้เรียน (ไม่ใช่คะแนนคาดการณ์): ' + pred.pct + '/100' : 'ยังไม่มีคะแนนคาดของผู้เรียน',
    weak.length ? 'บทที่ผู้เรียนยังไม่ผ่าน: ' + weak.join(', ') : ''
  ].filter(Boolean).join('\n');

  const prev = Tutor.ctx, prevHist = Tutor.history;
  Tutor.ctx = { examYear: x.year, lesson: false, wantExamEvidence: true, unitName: 'วิเคราะห์ชุดสอบ ' + x.year, levelId: (typeof userClassId === 'function' ? userClassId() : null) };
  Tutor.history = [];
  try {
    return await Tutor.ask(
      'วิเคราะห์ว่าชุดสอบนี้ยากตรงไหน ตอบเป็นข้อความไทยล้วน ไม่ใช้มาร์กดาวน์ ไม่เกิน 12 บรรทัด'
        + ' โครงคำตอบ: 1) ยากระดับไหนเมื่อเทียบกับเวลาที่ให้ 2) สามเหตุผลว่าอะไรทำให้ยาก อ้างตัวเลขที่ให้มาเท่านั้น'
        + ' 3) ผู้เรียนคนนี้น่าจะเสียคะแนนตรงไหน 4) ควรฝึกอะไรก่อนสองอย่าง'
        + ' ห้ามเดาว่าข้อไหนในชุดถามเรื่องอะไร เพราะไม่ได้ส่งตัวข้อสอบมาให้ และห้ามแต่งสถิติที่ไม่ได้ให้',
      facts
    );
  } finally {
    Tutor.ctx = prev;
    Tutor.history = prevHist;
  }
}

function startTutorLesson(unitId, topicId, subLesson) {
  const found = findUnit(unitId);
  if (!found) return;
  const ordered = (typeof easiestQuestions === 'function')
    ? easiestQuestions(found.unit)
    : found.unit.q.slice();
  const prev = S.progress[unitId] || { stars: 0, runs: 0 };
  const difficulty = (prev.runs >= 3 || prev.stars >= 3) ? 'hard'
    : (prev.runs >= 1 || prev.stars >= 1) ? 'medium' : 'easy';
  const stand = ordered.filter(q => typeof isDependentStem !== 'function' || !isDependentStem(q));
  const use = stand.length ? stand : ordered;
  const pool = difficulty === 'hard' ? use.slice().reverse() : use;
  const topic = topicId && typeof alevelTopic === 'function' ? alevelTopic(topicId) : null;
  // หัวข้อย่อยชั้นลึกบังคับความยากขึ้นทันที ไม่ต้องรอสะสมรอบ
  const subDiff = subLesson && subLesson.tier >= 3 ? 'hard'
    : subLesson && subLesson.tier === 2 ? (difficulty === 'easy' ? 'medium' : 'hard')
    : difficulty;
  Tutor.ctx = {
    unitId: unitId,
    levelId: found.levelId,
    unitName: found.unit.name,
    strand: found.unit.strand || '',
    lesson: true,
    topicLesson: !!topic,
    topicId: topic ? topic.id : null,
    difficulty: subLesson ? (PersonalPath.state(subLesson.id).completed ? 'medium' : 'easy') : subDiff,
    subId: subLesson ? subLesson.id : null,
    subName: subLesson ? subLesson.name : null,
    subTier: subLesson ? subLesson.tier : null,
    subWhy: subLesson ? subLesson.why : null,
    repeat: (prev.runs || 0) > 0,
    samples: pool.slice(0, 5).map(q => q.q),
    starter: pool[0] ? pool[0].q : '',
    topicName: topic ? topic.name : null,
    topicKnow: topic ? topic.know : null,
    topicAbout: topic ? topic.about : null,
    topicTerms: topic ? topic.terms : null,
    q: '', correct: null, given: null
  };
  Tutor.history = [];
  Tutor.stage = 'teach';
  if (subLesson) PersonalPath.begin();
  go('#/tutor/' + unitId);
}

/** บทเรียนประยุกต์ — รวมสองถึงสามบทแบบที่ข้อสอบจริงชอบออกรวมกัน
    ใช้โจทย์จากคลังของทุกบทที่รวมกันเป็นตัวเทียบระดับ ไม่ได้แต่งบทใหม่ขึ้นมา */
function startAppliedLesson(topicIds, label) {
  const topics = (topicIds || []).map(id => (typeof alevelTopic === 'function' ? alevelTopic(id) : null)).filter(Boolean);
  if (topics.length < 2) return toast('งานประยุกต์ต้องมีอย่างน้อยสองบท');
  if (!Cloud.signedIn()) return go('#/auth/signin');
  let samples = [];
  topics.forEach(t => (t.units || []).forEach(u => {
    const f = findUnit(u);
    if (f) samples = samples.concat((f.unit.q || []).map(q => q.q));
  }));
  Tutor.ctx = {
    lesson: true, applied: true,
    unitName: label || ('ประยุกต์: ' + topics.map(t => t.name).join(' + ')),
    levelId: (typeof userClassId === 'function' ? userClassId() : S.level),
    difficulty: 'medium',
    samples: shuffle(samples).slice(0, 6),
    appliedTopics: topics.map(t => ({ id: t.id, name: t.name, know: t.know || [] })),
    q: '', correct: null, given: null
  };
  Tutor.history = [];
  Tutor.stage = 'teach';
  go('#/tutor');
}

function startGoalPractice() {
  const track = typeof goalTrackUnits === 'function' ? goalTrackUnits() : [];
  const p = S.profile || {};
  const label = (p.major && p.university)
    ? (p.major + ' · ' + p.university)
    : (goalLabel(p.goal) || 'เป้าหมาย');
  const sampleQs = track.length
    ? track.flatMap(f => f.unit.q || [])
    : (CURRICULUM[userClassId()] || { units: [] }).units.flatMap(u => u.q);
  const stand = sampleQs.filter(q => typeof isDependentStem !== 'function' || !isDependentStem(q));
  const samples = shuffle(stand.length ? stand : sampleQs).slice(0, 6).map(q => q.q);
  Tutor.ctx = {
    unitId: null, levelId: userClassId(), unitName: 'ฝึกตามเป้าหมาย: ' + label,
    lesson: true, goalPractice: true, difficulty: 'medium', samples: samples,
    q: '', correct: null, given: null
  };
  Tutor.history = [];
  go('#/tutor');
}

function startDailyQuestion() {
  const pick = typeof dailyPick === 'function' ? dailyPick() : null;
  if (!pick) return toast('ยังไม่มีโจทย์ประจำวันนี้');
  if (!Cloud.signedIn()) return go('#/auth/signin');
  const found = findUnit(pick.unitId);
  Tutor.ctx = {
    unitId: pick.unitId,
    levelId: found ? found.levelId : userClassId(),
    unitName: found ? found.unit.name : '',
    strand: found ? found.unit.strand : '',
    lesson: true,
    daily: true,
    difficulty: pick.difficulty,
    samples: found ? (found.unit.q || []).slice(0, 4).map(q => q.q) : [],
    starter: pick.q.q,
    q: '', correct: null, given: null
  };
  Tutor.history = [];
  S.dailyShown = todayKey();
  save();
  go('#/tutor/' + pick.unitId);
}

function plannerBanner() {
  const sch = typeof studySchedule === 'function' ? studySchedule() : { hours: 1, slots: [] };
  const next = typeof personalizedTopics === 'function'
    ? personalizedTopics().find(t => !((S.progress[t.id] || {}).stars))
    : null;
  return `<div class="teachcard teachcard-inchat">
    <div class="k">แผนปัจจุบันของคนนี้</div>
    <p>${esc(String(sch.hours))} ชม./วัน · ${esc((sch.slots || []).slice(0, 2).join(' · ') || 'ยังไม่ตั้งช่วงเวลา')}</p>
    ${next ? `<p>บทถัดไปตามกราฟ: <b>${esc(next.name)}</b></p>` : ''}
  </div>`;
}

/** หน้าจอโต้ตอบสำหรับช่วงสอน — ค่าทุกอย่างคำนวณในเครื่อง ไม่ได้ให้ AI แต่ง
    มีเฉพาะบทที่วาดได้ตรงไปตรงมา บทอื่นไม่ต้องแสดง ดีกว่าใส่ภาพมั่ว */
function learnWidget(ctx) {
  if (!ctx || Tutor.stage === 'drill') return '';
  const id = ctx.topicId;
  if (id === 'logic') return logicWidget();
  if (id === 'set') return setWidget();
  if (id && typeof topicFigure === 'function' && typeof alevelTopic === 'function') {
    const t = alevelTopic(id);
    const fig = t && topicFigure(t);
    if (fig && typeof renderGeometrySVG === 'function') {
      return `<div class="teachcard teachcard-inchat"><div class="k">รูปประกอบ</div>${renderGeometrySVG(fig)}</div>`;
    }
  }
  return '';
}

/** ตารางค่าความจริงกดเล่นได้ — ทุกช่องคำนวณจากตรรกศาสตร์จริง */
function logicWidget() {
  const p = !!(window._lw && window._lw.p);
  const q = !!(window._lw && window._lw.q);
  const T = v => v ? '<span class="tv t">จริง</span>' : '<span class="tv f">เท็จ</span>';
  const rows = [
    ['p ∧ q (และ)', p && q],
    ['p ∨ q (หรือ)', p || q],
    ['p → q (ถ้า…แล้ว)', !p || q],
    ['p ↔ q (ก็ต่อเมื่อ)', p === q],
    ['∼p (นิเสธ)', !p]
  ];
  return `<div class="teachcard teachcard-inchat">
    <div class="k">ลองกดดู — ค่าความจริงเปลี่ยนตามที่เลือก</div>
    <div class="row" style="gap:8px;margin:8px 0">
      <button class="btn ghost sm" onclick="logicToggle('p')">p = ${p ? 'จริง' : 'เท็จ'}</button>
      <button class="btn ghost sm" onclick="logicToggle('q')">q = ${q ? 'จริง' : 'เท็จ'}</button>
    </div>
    <table class="truthtable">
      ${rows.map(r => `<tr><td>${r[0]}</td><td>${T(r[1])}</td></tr>`).join('')}
    </table>
  </div>`;
}
function logicToggle(k) {
  window._lw = Object.assign({ p: false, q: false }, window._lw);
  window._lw[k] = !window._lw[k];
  render();
}

/** แผนภาพเวนน์สองเซตกดเล่นได้ — ระบายพื้นที่ตามตัวดำเนินการที่เลือก */
function setWidget() {
  const op = (window._sw && window._sw.op) || 'union';
  const ops = [['union', 'A ∪ B'], ['inter', 'A ∩ B'], ['diff', 'A − B'], ['comp', 'A′']];
  const fillA = (op === 'union' || op === 'diff') ? 'var(--pen-blue)' : 'none';
  const fillB = op === 'union' ? 'var(--pen-blue)' : 'none';
  const lens = (op === 'inter' || op === 'union') ? 'var(--pen-blue)' : 'none';
  return `<div class="teachcard teachcard-inchat">
    <div class="k">ลองกดดู — พื้นที่ที่ระบายคือผลลัพธ์</div>
    <div class="row" style="gap:6px;margin:8px 0;flex-wrap:wrap">
      ${ops.map(o => `<button class="btn ${op === o[0] ? '' : 'ghost'} sm" onclick="setOp('${o[0]}')">${o[1]}</button>`).join('')}
    </div>
    <svg viewBox="0 0 220 120" style="width:100%;height:auto" role="img" aria-label="แผนภาพเวนน์สองเซต">
      <rect x="2" y="2" width="216" height="116" rx="8" fill="${op === 'comp' ? 'var(--pen-blue)' : 'none'}"
        opacity="${op === 'comp' ? '.25' : '1'}" stroke="var(--line)"/>
      ${op === 'comp' ? '<circle cx="85" cy="60" r="45" fill="var(--card)"/>' : ''}
      <circle cx="85" cy="60" r="45" fill="${fillA}" opacity=".28" stroke="var(--graphite)"/>
      <circle cx="135" cy="60" r="45" fill="${fillB}" opacity=".28" stroke="var(--graphite)"/>
      ${lens !== 'none' ? '<path d="M110 22 A45 45 0 0 1 110 98 A45 45 0 0 1 110 22 Z" fill="' + lens + '" opacity=".45"/>' : ''}
      <text x="52" y="64" font-size="13" fill="var(--graphite)">A</text>
      <text x="162" y="64" font-size="13" fill="var(--graphite)">B</text>
    </svg>
  </div>`;
}
function setOp(op) { window._sw = { op: op }; render(); }

function lessonTeachBanner(ctx) {
  if (ctx.goalPractice) {
    return `<div class="teachcard teachcard-inchat">
      <div class="k">เนื้อหา</div>
      <p>${esc(ctx.unitName)}</p>
    </div>`;
  }
  if (ctx.topicKnow && ctx.topicKnow.length) {
    return `<div class="teachcard teachcard-inchat">
      <div class="k">${esc(ctx.topicName || 'เนื้อหา')}</div>
      ${ctx.topicAbout ? `<p>${esc(ctx.topicAbout)}</p>` : ''}
      <ul class="teachlist">${ctx.topicKnow.map(k => `<li>${esc(k)}</li>`).join('')}</ul>
    </div>`;
  }
  const preview = (ctx.samples || []).slice(0, 3);
  return `<div class="teachcard teachcard-inchat">
    <div class="k">เนื้อหาหน่วยนี้</div>
    <p>ฝึกเรื่อง <b>${esc(ctx.unitName)}</b>${ctx.strand ? ' · ' + esc(ctx.strand) : ''}</p>
    ${preview.length ? `<ul class="teachlist">${preview.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function lessonStageBar() {
  const cur = Tutor.stage || 'teach';
  const idx = LESSON_STAGES.findIndex(s => s.id === cur);
  return `<div class="stagebar">${LESSON_STAGES.map((s, i) => `
    <span class="stagechip ${i === idx ? 'on' : i < idx ? 'past' : ''}">${i + 1}. ${s.name}</span>`).join('')}</div>`;
}

/** ปุ่มเดินขั้น — ผู้เรียนกดเองเมื่อพร้อม ไม่ใช่ AI ตัดสินใจแทน */
function lessonStageActions() {
  const st = Tutor.stage || 'teach';
  if (st === 'teach') {
    return `<div class="stageact">
      <button class="btn sm" onclick="lessonGoExample()">ดูตัวอย่างพร้อมวิธีคิด</button>
      <button class="btn ghost sm" onclick="lessonAskMore()">ขออธิบายเพิ่ม</button>
    </div>`;
  }
  if (st === 'example') return `<div class="stageact"><button class="btn sm" onclick="lessonGoGuided()">ลองทำพร้อมคำใบ้</button></div>`;
  if (st === 'guided') return `<div class="stageact"><button class="btn sm" onclick="lessonGoDrill()">พร้อมแล้ว ลองทำเอง</button></div>`;
  if (st === 'drill') {
    return `<div class="stageact">
      <button class="btn ghost sm" onclick="lessonGoSummary()">พอแล้ว ขอสรุปบทนี้</button>
    </div>`;
  }
  if (st === 'summary') {
    return `<div class="stageact">
      <button class="btn sm" onclick="lessonFinish()">จบบทเรียนนี้</button>
      <button class="btn ghost sm" onclick="lessonGoDrill()">ขอทำโจทย์ต่อ</button>
    </div>`;
  }
  return '';
}

function lessonGoExample() {
  if (Tutor.busy) return;
  Tutor.stage='example'; render();
  sendToTutor('ยกตัวอย่างหนึ่งข้อในหัวข้อที่กำลังเรียน แสดงวิธีคิดทีละขั้น พร้อมเหตุผลแต่ละขั้นและตรวจคำตอบย้อนกลับ ยังไม่ถามโจทย์นักเรียน', null, null, {silent:true});
}
function lessonGoGuided() {
  if (Tutor.busy) return;
  Tutor.stage='guided'; render();
  sendToTutor('ให้โจทย์ใหม่หนึ่งข้อในทักษะเดียวกับตัวอย่าง ถามให้นักเรียนลองขั้นแรกก่อน ถ้าติดให้คำใบ้ทีละนิด ไม่บอกคำตอบสุดท้าย รอคำตอบก่อนเสมอ', null, null, {silent:true});
}
function lessonGoDrill() {
  if (Tutor.busy) return;
  Tutor.stage = 'drill';
  render();
  sendToTutor(
    'ให้โจทย์ใหม่ที่ไม่ซ้ำตัวอย่างหรือข้อฝึกมีคำใบ้ เพื่อให้ลองทำเอง ห้ามเฉลยหรือใบ้ก่อน รอคำตอบผมก่อนทุกครั้ง ถามทีละข้อเท่านั้น',
    null, null, { silent: true }
  );
}

function lessonAskMore() {
  sendToTutor('ขออธิบายส่วนที่ยังไม่ชัดเพิ่มอีกหน่อย ยังไม่ต้องออกโจทย์', null, null, { silent: true });
}

function lessonGoSummary() {
  if (Tutor.busy) return;
  Tutor.stage = 'summary';
  render();
  sendToTutor(
    'สรุปบทนี้ให้หน่อย: สิ่งที่ต้องจำ 3-5 ข้อ จุดที่ผมยังพลาดบ่อย และสิ่งที่ควรไปทบทวนต่อ ไม่ต้องออกโจทย์เพิ่ม',
    null, null, { silent: true }
  );
}

/** จบบทเรียน — ถ้ามาจากหัวข้อย่อย ให้ไปทำโควตาข้อของหัวข้อนั้นต่อ ไม่ใช่ปิดทิ้งเฉยๆ */
function lessonFinish() {
  const ctx = Tutor.ctx || {};
  const topicId = ctx.topicId;
  const subId = ctx.subId;
  Tutor.stage = 'done';
  if (topicId && subId) return PersonalPath.finish();
  if (topicId && subId && typeof startSubDrill === 'function') {
    toast('จบบทเรียนแล้ว — ทำโจทย์ให้ครบเพื่อปิดหัวข้อนี้');
    return startSubDrill(topicId, subId);
  }
  if (topicId) return go('#/topic/' + topicId);
  closeTutor();
}

function viewTutor(app, r) {
  const unitId = (r && r.a) || (Tutor.ctx && Tutor.ctx.unitId);
  const found = unitId ? findUnit(unitId) : null;

  if (!Cloud.signedIn()) {
    app.innerHTML = `
      <h1>ติวเตอร์ AI</h1>
      <p class="sub">ติวเตอร์ตอบเป็นภาษาไทย อธิบายทีละขั้น และปรับตามระดับชั้นกับเกรดของคุณ
        ต้องมีบัญชีก่อนใช้ เพราะทุกคำถามส่งผ่านเซิร์ฟเวอร์ของเรา</p>
      <button class="btn" onclick="go('#/auth/signup')">สมัครบัญชีฟรี</button>
      <div style="height:10px"></div>
      <button class="btn ghost" onclick="go('#/auth/signin')">เข้าสู่ระบบ</button>`;
    return;
  }

  const ctx = Tutor.ctx;
  const isPlanner = ctx && ctx.planner;
  const modeLabel = isPlanner ? 'คุยปรับแผนเรียน' : ctx && ctx.lesson ? 'ติวทั้งหน่วย' : ctx && ctx.splitHelp ? 'แยกขั้นโจทย์' : ctx && ctx.q ? 'ถามจากโจทย์ที่ทำ' : 'ถามอิสระ';
  app.innerHTML = `
    <div class="tutorpage">
      <div class="tutorhead">
        <button class="backbtn" onclick="closeTutor()" aria-label="ปิดห้องคุย">✕</button>
        <span class="tutoravatar">AI</span>
        <div class="tutortitle">
          <div class="tt-name">${isPlanner ? 'AI Planner' : ctx && ctx.topicLesson ? 'ติวเตอร์ในบทเรียน' : found ? 'ติวเตอร์ AI' : ctx && ctx.splitHelp ? 'ติวเตอร์ AI' : 'AI Planner'}</div>
          <div class="tt-sub">${found ? esc(found.unit.name) : modeLabel}</div>
        </div>
      </div>

      ${isPlanner ? plannerBanner() : ctx && ctx.lesson ? lessonStageBar() + lessonTeachBanner(ctx) + learnWidget(ctx) : ''}
      ${ctx && ctx.q && !isPlanner ? `
        <div class="ctxcard">
          <div class="ctx-row"><span class="ctx-k">โจทย์</span><span class="ctx-v">${esc(ctx.q)}</span></div>
          ${ctx.correct !== undefined && ctx.correct !== null
            ? `<div class="ctx-row"><span class="ctx-k">เฉลย</span><span class="ctx-v ok">${esc(String(ctx.correct))}</span></div>` : ''}
          ${ctx.given ? `<div class="ctx-row"><span class="ctx-k">คุณตอบ</span><span class="ctx-v">${esc(String(ctx.given))}</span></div>` : ''}
        </div>` : ''}

      <div id="chat" class="chat"></div>
      ${ctx && ctx.lesson ? lessonStageActions() + PersonalPath.feedback() : ''}
      <div id="imgPreview"></div>
      <div class="askbar">
        <div class="askpill">
          <input type="file" id="tImgFile" accept="image/*" capture="environment" hidden onchange="tutorImageChosen(this)">
          <button class="iconbtn" onclick="tutorPickImage()" aria-label="แนบรูปโจทย์">📎</button>
          <textarea id="tIn" rows="1" placeholder="${isPlanner ? 'เช่น อยากเรียนตรีโกณก่อน วันละ 45 นาที' : ctx && ctx.lesson ? 'พิมพ์คำตอบ หรือคุยกับติวเตอร์ได้เลย' : ctx && ctx.unitId ? 'พิมพ์คำถาม เช่น ทำไมต้องย้ายข้าง' : 'พิมพ์ข้อความหรือโจทย์ที่สงสัย...'}"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();tutorSend()}"></textarea>
          <button class="iconbtn" id="tMic" onclick="tutorMic()" aria-label="พูดคำถาม">🎤</button>
          <button class="iconbtn send" id="tSend" onclick="tutorSend()" aria-label="ส่งคำถาม">➤</button>
        </div>
        <p class="note" id="tHint">${isPlanner ? 'คุยแล้วตกลงกัน แผนบนกราฟจะเปลี่ยนตามคุณ' : 'AI Tutor อาจให้ข้อมูลที่ไม่ถูกต้อง โปรดตรวจสอบความถูกต้องของเนื้อหาเสมอ'}</p>
      </div>
    </div>`;

  paintChat();
  // โหมดคุยอิสระไม่ต้องรอ AI ทักก่อน ประหยัดโควตาและให้ผู้ใช้เริ่มถามได้ทันที
  if (!Tutor.history.length && ctx) {
    if (ctx.planner) primePlanner();
    else if (ctx.splitHelp) primeSplitHelp();
    else if (ctx.lesson) primeTutorLesson();
    else if (ctx.q) primeTutor();
    else setTimeout(() => { const el = $('#tIn'); if (el) el.focus(); }, 60);
  }
}

/* ปุ่มลัด — ลดการพิมพ์ซ้ำๆ ผูกกับฟังก์ชันเปล่าแทนการฝังข้อความลง onclick ตรงๆ
   (เคยพังมาแล้วครั้งหนึ่งเพราะเครื่องหมายคำพูดในข้อความไปตัดแอตทริบิวต์ HTML ขาดกลาง) */
function chipHarder()   { sendToTutor('ขอโจทย์ข้อที่ยากขึ้นอีกนิด', null); }
function chipEasier()   { sendToTutor('ขอโจทย์ข้อที่ง่ายลงอีกนิด', null); }
function chipAsk()      { const el = $('#tIn'); if (el) { el.focus(); toast('พิมพ์หรือพูดคำถามได้เลย'); } }
function chipWrapUp()   { sendToTutor('สรุปสิ่งที่เราคุยกันวันนี้ให้หน่อย', null); }
function chipAiComplete() {
  sendToTutor('จบบทเรียนนี้ให้เลย สรุปสิ่งที่เรียนแล้วบอกว่าบันทึกบทได้', null);
  setTimeout(completeLessonNow, 1600);
}
function completeLessonNow() {
  const ctx = Tutor.ctx || {};
  const topicId = ctx.topicId;
  if (topicId) {
    const prev = S.progress[topicId] || { stars: 0, best: 0, runs: 0 };
    S.progress[topicId] = {
      stars: 3, best: 100, runs: (prev.runs || 0) + 1
    };
    S.xp += 25;
    save();
  }
  toast('จบบทเรียนแล้ว +25 XP');
  closeTutor();
}
function chipReveal()   { sendToTutor('ขอเฉลยวิธีทำแบบละเอียดเลย', null); }
function chipMore()     { sendToTutor('ขอโจทย์แบบเดียวกันอีกข้อให้ลองทำเอง', null); }
function chipPractice() { sendToTutor('ขอโจทย์คณิตศาสตร์ระดับชั้นของผมสัก 1 ข้อให้ลองทำ', null); }
function chipSummary()  { sendToTutor('ช่วยสรุปสูตรสำคัญของหน่วยนี้ให้หน่อย', null); }
function chipPlanHours() {
  sendToTutor('อยากปรับเวลาเรียนต่อวันและช่วงในตาราง ช่วยเสนอแล้วคุยให้จบ ถ้าตกลงใส่ [PLAN]', null);
}
function chipPlanOrder() {
  sendToTutor('อยากสลับลำดับบทตามจุดอ่อนของผม ไม่ใช่เรียงตามสาระตายตัว ถ้าตกลงใส่ [PLAN]', null);
}
function chipPlanCommit() {
  sendToTutor('ใช้แผนที่คุยกันนี้เลย ใส่บล็อก [PLAN] ให้ครบ hours, slots, order', null);
}

function tutorChips(ctx) {
  const asked = Tutor.history.filter(m => m.role === 'user').length;
  const inner = ctx && ctx.planner
    ? `<button class="chip" onclick="chipPlanHours()">ปรับเวลา</button>
    <button class="chip" onclick="chipPlanOrder()">สลับบท</button>
    <button class="chip" onclick="chipPlanCommit()">ใช้แผนนี้</button>`
    : ctx && ctx.splitHelp
    ? `<button class="chip" onclick="chipEasier()">ขอขั้นที่ง่ายกว่า</button>
    <button class="chip" onclick="chipAsk()">ถามต่อ</button>`
    : ctx && ctx.lesson
    ? `<button class="chip" onclick="chipHarder()">ขอข้อยากขึ้น</button>
    <button class="chip" onclick="chipEasier()">ขอข้อง่ายลง</button>
    <button class="chip" onclick="chipAsk()">ถามติวเตอร์</button>
    ${asked >= 5
      ? `<button class="chip" onclick="completeLessonNow()">จบบทเรียน</button>
         <button class="chip" onclick="chipAiComplete()">ให้ AI จบบทให้</button>`
      : `<button class="chip" onclick="chipWrapUp()">พอแค่นี้ก่อน</button>`}`
    : ctx && ctx.q
    ? `<button class="chip" onclick="chipReveal()">ขอเฉลยเลย</button>
    <button class="chip" onclick="chipMore()">ขอโจทย์คล้ายกันอีกข้อ</button>`
    : `<button class="chip" onclick="chipPractice()">ขอโจทย์ฝึก 1 ข้อ</button>
    <button class="chip" onclick="chipSummary()">สรุปสูตรสำคัญ</button>`;
  return `<div class="chips chips-inchat">${inner}</div>`;
}

/* ---------- แนบรูปโจทย์ ---------- */
function tutorPickImage() { $('#tImgFile').click(); }

function tutorImageChosen(input) {
  const file = input.files[0];
  input.value = '';   // เคลียร์ไว้ เผื่อเลือกไฟล์เดิมซ้ำในครั้งถัดไป
  if (!file) return;
  if (!file.type.startsWith('image/')) return toast('เลือกไฟล์รูปภาพเท่านั้น');
  // ใช้ shrinkImage ตัวเดียวกับหน้าอัปโหลดโจทย์ (นิยามไว้ใน app.js)
  shrinkImage(file, 1000, dataUrl => {
    if (!dataUrl) return toast('อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
    Tutor.pendingImage = dataUrl;
    renderImagePreview();
  });
}

function renderImagePreview() {
  const el = $('#imgPreview');
  if (!el) return;
  el.innerHTML = Tutor.pendingImage ? `
    <div class="imgpreview">
      <img src="${Tutor.pendingImage}" alt="รูปที่จะแนบ">
      <span>แนบรูปแล้ว พิมพ์คำถามเพิ่มได้ (ไม่บังคับ) แล้วกดส่ง</span>
      <button type="button" onclick="removePendingImage()" aria-label="ลบรูปที่แนบ">✕</button>
    </div>` : '';
}
function removePendingImage() { Tutor.pendingImage = null; renderImagePreview(); }

function primeTutor() {
  const ctx = Tutor.ctx;
  const wrong = ctx.given !== undefined && ctx.given !== null &&
                String(ctx.given) !== String(ctx.correct);
  const ask = wrong
    ? 'ช่วยบอกว่าผมพลาดตรงไหน แล้วถามกลับมาหนึ่งข้อให้ผมคิดต่อ'
    : 'ช่วยอธิบายวิธีคิดโจทย์ข้อนี้ทีละขั้น';
  sendToTutor(ask, `หน่วย: ${ctx.unitName}\nโจทย์: ${ctx.q}\nคำตอบที่ถูก: ${ctx.correct}` +
    (wrong ? `\nนักเรียนตอบ: ${ctx.given}` : ''));
}

function primePlanner() {
  const sch = typeof studySchedule === 'function' ? studySchedule() : { hours: 1, slots: [] };
  const topics = typeof personalizedTopics === 'function' ? personalizedTopics() : [];
  const gaps = (typeof planTopicIds === 'function' ? planTopicIds() : [])
    .map(id => (typeof alevelTopic === 'function' && alevelTopic(id) || {}).name).filter(Boolean);
  const orderLines = topics.map((t, i) => (i + 1) + '. ' + t.id + ' ' + t.name).join('\n');
  const ids = (typeof ALEVEL_TOPICS !== 'undefined' ? ALEVEL_TOPICS : []).map(t => t.id).join(',');
  const strandLines = (typeof ALEVEL_STRANDS !== 'undefined' ? ALEVEL_STRANDS : [])
    .map(s => '- ' + s.name + ' ' + s.share).join('\n');
  const sig = (typeof EXAM_SIGNALS !== 'undefined' && EXAM_SIGNALS[2569]) || null;
  const focusNames = sig ? sig.extra.map(id => (alevelTopic(id) || {}).name).filter(Boolean).join(', ') : '';
  const testLines = Object.keys((typeof S !== 'undefined' && S.topicTests) || {})
    .map(id => '- ' + ((alevelTopic(id) || {}).name || id) + ': สอบท้ายบทได้ ' + S.topicTests[id].pct + '%'
      + (S.topicTests[id].pass ? ' ผ่าน' : ' ยังไม่ผ่าน')).join('\n');

  sendToTutor(
    'คุณคือ AI Planner ไม่ใช่ติวเตอร์ยาว สรุปแผนปัจจุบัน 2–4 ประโยค แล้วถามว่าจะปรับอะไร คุยเป็นภาษาไทยสั้นๆ'
      + ' ผู้เรียนขอเปลี่ยนแผนได้ทุกอย่าง ทั้งเวลา ลำดับบท และงานที่ต้องทำ ถ้าเขาขอให้เปลี่ยน ให้เปลี่ยนตามแล้วส่งแผนใหม่ออกมาเลย'
      + ' แผนต้องไม่ใช่แค่ไล่อ่านเนื้อหา เพราะคะแนน A-Level มาจากการทำโจทย์ด้วย จึงต้องมีงานผสมกัน:'
      + ' เรียนเนื้อหา (learn) ฝึกทำโจทย์ (drill) และงานประยุกต์ที่รวมบทตั้งแต่สองบทขึ้นไปแบบที่ข้อสอบจริงชอบออกรวมกัน (applied)'
      + ' เพิ่ม test (สอบท้ายบท) และ mock (ข้อสอบเสมือน) ได้ตามจังหวะที่เหมาะ'
      + ' เลือกบทและงานประยุกต์จากสัดส่วนสาระของข้อสอบจริงและจุดอ่อนของผู้เรียนที่ให้มา ห้ามแต่งสถิติเอง'
      + ' เมื่อตกลงกันแล้วให้ปิดท้ายด้วยบล็อกเดียว'
      + ' [PLAN]{"hours":1,"slots":["จ–ศ 19:00–20:15"],"order":["real","trig"],"items":[{"kind":"learn","topics":["real"],"name":"...","why":"..."},{"kind":"applied","topics":["func","calc"],"name":"ประยุกต์ ฟังก์ชัน+แคลคูลัส","why":"..."}],"note":"..."}[/PLAN]'
      + ' hours เป็นชม./วัน 0.25–4, slots ไม่เกิน 5 ช่วง, order และ topics ใช้รหัสบทตามรายการเท่านั้น,'
      + ' kind ต้องเป็น learn drill applied test หรือ mock, applied ต้องมีอย่างน้อยสองบท, items ไม่เกิน 12 งาน'
      + ' ห้ามใส่ [PLAN] จนกว่าจะตกลงกันแล้ว',
    'เวลาปัจจุบัน: ' + sch.hours + ' ชม./วัน\nช่วง: ' + (sch.slots || []).join(' · ')
      + '\nจุดอ่อน: ' + (gaps.join(', ') || 'ยังไม่มีจากแบบทดสอบ')
      + '\nลำดับปัจจุบัน:\n' + orderLines
      + '\nสัดส่วนข้อสอบจริงตามสาระ:\n' + strandLines
      + (focusNames ? '\nบทที่เน้นในข้อสอบปีล่าสุด: ' + focusNames : '')
      + (sig ? '\nขั้นคิดเฉลี่ยที่ AI ประเมิน: ' + sig.avgSteps + ' · สัดส่วนข้อยาก ' + Math.round(sig.hardShare * 100) + '%' : '')
      + (testLines ? '\nผลสอบท้ายบทที่ผ่านมา:\n' + testLines : '')
      + '\nรหัสที่ใช้ได้: ' + ids,
    null,
    { silent: true }
  );
}

function primeSplitHelp() {
  const ctx = Tutor.ctx;
  sendToTutor(
    'สอนโจทย์ข้อนี้ทีละขั้นย่อยที่ง่ายกว่า อย่าเฉลยคำตอบสุดท้ายทันที ถามทีละขั้น รอคำตอบ แล้วค่อยขั้นถัดไป ภาษาไทยสั้นๆ',
    'โจทย์: ' + (ctx.q || '') + (ctx.hint ? '\nใบ้: ' + ctx.hint : '') + '\nโหมด: แยกขั้นให้ทำเอง',
    null,
    { silent: true }
  );
}

function primeTutorLesson() {
  const ctx = Tutor.ctx;
  const sampleLines = (ctx.samples || []).map(s => '- ' + s).join('\n');
  const diff = ctx.difficulty || 'easy';
  const diffRule = diff === 'hard'
    ? 'รอบนี้ระดับยาก อย่าเริ่มจากข้อง่าย ใช้ข้อท้ายรายการหรือดัดแปลงให้ยากขึ้น ตอบถูกแล้วยากกว่าเดิมอีก'
    : diff === 'medium'
      ? 'รอบนี้ระดับปานกลาง ข้ามข้อง่ายที่สุด ออกข้อกลางๆ แล้วค่อยยากขึ้นเมื่อตอบถูก'
      : 'เริ่มจากข้อง่ายข้อแรก แล้วค่อยยากขึ้นเมื่อตอบถูก';
  if (ctx.topicLesson) {
    const termLines = (ctx.topicTerms || []).map(t => '- ' + t.name + ': ' + t.def).join('\n');
    // ขั้นสอนอย่างเดียว ห้ามพ่วงโจทย์ท้ายข้อความ ไม่งั้นคำตอบยาวจนโดนตัดกลางโจทย์
    sendToTutor(
      'ตอนนี้คือขั้นสอน อธิบายอย่างเดียว ห้ามออกโจทย์และห้ามถามคำถามท้ายข้อความ'
        + ' อธิบาย 5-8 ประโยคจากสรุปและคำนิยามที่ให้ อย่าแต่งทฤษฎีเกินนั้น'
        + ' ปิดท้ายด้วยประโยคเดียวว่าให้กดปุ่ม ดูตัวอย่างพร้อมวิธีคิด เมื่อพร้อม'
        + (ctx.subName ? ' สอนเฉพาะหัวข้อย่อยที่ระบุ ไม่ต้องไล่ทั้งบท' : ''),
      (ctx.subName ? 'ขอบเขต: หัวข้อย่อยนี้เท่านั้น\n' : 'ขอบเขต: ทั้งบทนี้\n')
        + 'บท: ' + (ctx.topicName || ctx.unitName)
        + (ctx.subName ? '\nหัวข้อย่อยที่เลือก: ' + ctx.subName + ' (ชั้นที่ ' + ctx.subTier + ')' : '')
        + (ctx.subWhy ? '\nจุดเน้น: ' + ctx.subWhy : '')
        + '\nคืออะไร: ' + (ctx.topicAbout || '')
        + (termLines ? '\nคำนิยาม:\n' + termLines : '')
        + '\nระดับ: ' + diff + (ctx.repeat ? ' · รอบทบทวน ห้ามซ้ำข้อเดิม' : '')
        + (sampleLines ? '\nตัวอย่างโจทย์ในคลัง:\n' + sampleLines : ''),
      null,
      { silent: true }
    );
    return;
  }
  if (ctx.applied) {
    const parts = (ctx.appliedTopics || []).map(t => '- ' + t.name + (t.know && t.know.length ? ': ' + t.know.join(', ') : '')).join('\n');
    sendToTutor(
      'ตอนนี้คือขั้นสอนของงานประยุกต์ที่รวมหลายบทเข้าด้วยกัน อธิบายอย่างเดียว ห้ามออกโจทย์ท้ายข้อความ'
        + ' อธิบาย 5-8 ประโยคว่าบทเหล่านี้มาต่อกันตรงไหนในข้อสอบจริง ต้องใช้อะไรจากบทไหนก่อนหลัง'
        + ' ใช้เฉพาะขอบเขตที่ให้มา อย่าแต่งทฤษฎีเกินนั้น ปิดท้ายว่าให้กดปุ่ม ดูตัวอย่างพร้อมวิธีคิด เมื่อพร้อม',
      'งาน: ' + ctx.unitName + '\nบทที่รวมกัน:\n' + parts
        + (sampleLines ? '\nโจทย์ในคลังของบทเหล่านี้:\n' + sampleLines : ''),
      null,
      { silent: true }
    );
    return;
  }
  if (ctx.daily) {
    sendToTutor(
      'นี่คือโจทย์ประจำวันนี้ ทักสั้นๆ แล้วออกโจทย์ข้อที่ระบุให้ผมตอบเลย อย่าเฉลยก่อน รอคำตอบแล้วค่อยออกข้อถัดไปที่ยากขึ้น ' + diffRule,
      'โจทย์ประจำวัน (' + diff + '): ' + (ctx.starter || '')
        + '\nหน่วย: ' + ctx.unitName
        + (sampleLines ? '\nโจทย์ใกล้เคียง:\n' + sampleLines : ''),
      null,
      { silent: true }
    );
    return;
  }
  if (ctx.goalPractice) {
    sendToTutor(
      'เริ่มฝึกตามเป้าหมายของผม ทักสั้นๆ แล้วออกโจทย์ข้อแรก ' + diffRule + ' อย่าเฉลยก่อน',
      'โหมด: ' + ctx.unitName + (sampleLines ? '\nตัวอย่าง:\n' + sampleLines : ''),
      null,
      { silent: true }
    );
    return;
  }
  sendToTutor(
    'เริ่มติวหน่วยนี้ตามลำดับนี้เท่านั้น: 1) สอนสั้นๆ 2–5 ประโยคว่าหน่วยนี้เกี่ยวกับอะไร จากรายการโจทย์ที่ส่งมา อย่าแต่งทฤษฎีที่ไม่มีในรายการ' + (ctx.topicKnow ? ' และจากหลักการบทที่ระบุ' : '') + ' จากนั้นหยุดรอให้ผมกดดูตัวอย่าง ยังไม่ออกโจทย์หรือข้ามไปขั้นฝึกเอง',
    (ctx.topicName ? 'บท A-Level: ' + ctx.topicName + '\n' : '')
      + (ctx.subName ? 'หัวข้อย่อยที่เลือก: ' + ctx.subName + ' (ชั้นที่ ' + ctx.subTier + ')\nสอนและออกโจทย์เฉพาะหัวข้อย่อยนี้ ไม่ต้องไล่ทั้งบท\n' : '')
      + (ctx.subWhy ? 'จุดเน้นของหัวข้อย่อยนี้: ' + ctx.subWhy + '\n' : '')
      + (ctx.topicKnow && ctx.topicKnow.length ? 'ต้องรู้/ฝึก:\n' + ctx.topicKnow.map(k => '- ' + k).join('\n') + '\n' : '')
      + 'หน่วย: ' + ctx.unitName
      + (ctx.strand ? '\nสาระ: ' + ctx.strand : '')
      + '\nระดับรอบนี้: ' + diff
      + (ctx.starter ? '\nข้อแรกที่ควรออก: ' + ctx.starter : '')
      + (sampleLines ? '\nโจทย์ในคลัง:\n' + sampleLines : ''),
    null,
    { silent: true }
  );
}

function paintChat() {
  const el = $('#chat');
  if (!el) return;
  const clock = ts => ts
    ? new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : '';
  const asked = Tutor.history.some(m => m.role === 'user');
  const hasModel = Tutor.history.some(m => m.role === 'model');
  const rows = Tutor.history.map(m => {
    const ai = m.role === 'model';
    return `<div class="chatrow ${ai ? 'ai' : 'me'}">
      ${ai ? `<span class="tutoravatar">AI</span>` : ''}
      <div>
        ${ai ? `<div class="chatmeta">${Tutor.ctx && Tutor.ctx.planner ? 'AI Planner' : 'AI Tutor'}${clock(m.at) ? ' • ' + clock(m.at) : ''}</div>` : ''}
        <div class="bub ${ai ? 'ai' : 'me'}">
          ${m.thumb ? `<img class="bubimg" src="${m.thumb}" alt="รูปโจทย์ที่แนบ">` : ''}
          ${esc(m.text).replace(/\n/g, '<br>')}
          ${m.diagram ? renderGeometrySVG(m.diagram) : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  const chips = !Tutor.busy && (
    Tutor.ctx && (Tutor.ctx.lesson || Tutor.ctx.planner || Tutor.ctx.splitHelp) ? hasModel : !asked
  ) ? tutorChips(Tutor.ctx) : '';
  el.innerHTML = `<div class="datediv"><span>วันนี้</span></div>`
    + rows
    + chips
    + (Tutor.busy ? `<div class="chatrow ai"><span class="tutoravatar">AI</span><div class="bub ai typing">กำลังคิด…</div></div>` : '');
  el.scrollTop = el.scrollHeight;
  renderMath(el);
}

/* ============ รูปประกอบโจทย์เรขาคณิต ============
   AI แนบข้อมูลรูปทรงท้ายคำตอบเป็น [DIAGRAM]{...}[/DIAGRAM] เมื่อโจทย์เป็นเรขาคณิต
   ฝั่งเรานี้ตัดบล็อกนี้ออกจากข้อความก่อนแสดง แล้ววาด SVG เองจากตัวเลขที่ตรวจสอบแล้วเท่านั้น
   (ไม่เคยฝัง SVG/HTML ดิบจาก AI ลง DOM ตรงๆ กัน XSS) */
const DIAGRAM_SHAPES = ['triangle', 'rightTriangle', 'rectangle', 'parallelogram', 'circle', 'trapezoid'];

function extractPlan(text) {
  const m = String(text || '').match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/);
  if (!m) return { text: text, plan: null };
  const cleanText = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  let raw;
  try { raw = JSON.parse(m[1]); } catch { return { text: cleanText, plan: null }; }
  return { text: cleanText, plan: sanitizePlan(raw) };
}

function sanitizePlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ids = typeof ALEVEL_TOPICS !== 'undefined' ? ALEVEL_TOPICS.map(t => t.id) : [];
  const out = {};
  if (raw.hours != null) {
    const n = Number(raw.hours);
    if (Number.isFinite(n)) out.hours = Math.min(4, Math.max(0.25, n));
  }
  if (Array.isArray(raw.slots)) {
    const slots = raw.slots.map(s => String(s).slice(0, 80)).filter(Boolean).slice(0, 5);
    if (slots.length) out.slots = slots;
  }
  if (Array.isArray(raw.order)) {
    const seen = {};
    const order = [];
    raw.order.forEach(id => {
      const k = String(id);
      if (ids.indexOf(k) >= 0 && !seen[k]) { seen[k] = true; order.push(k); }
    });
    if (order.length) out.order = order;
  }
  // งานในแผน — ไม่ใช่แค่อ่านบทไหนก่อน แต่รวมฝึกทำโจทย์ สอบท้ายบท และงานประยุกต์ข้ามบท
  // ทุกค่าตรวจกับรายการบทที่มีจริงก่อนเสมอ ไม่รับรหัสที่ AI แต่งขึ้นเอง
  if (Array.isArray(raw.items)) {
    const kinds = ['learn', 'drill', 'applied', 'test', 'mock'];
    const items = [];
    raw.items.forEach(it => {
      if (!it || typeof it !== 'object') return;
      const kind = String(it.kind || '');
      if (kinds.indexOf(kind) < 0) return;
      const topics = (Array.isArray(it.topics) ? it.topics : [])
        .map(x => String(x))
        .filter(x => ids.indexOf(x) >= 0)
        .slice(0, 3);
      if (kind === 'applied' && topics.length < 2) return;
      if (kind !== 'mock' && kind !== 'applied' && topics.length !== 1) return;
      items.push({
        kind: kind,
        topics: topics,
        name: it.name ? String(it.name).slice(0, 80) : '',
        why: it.why ? String(it.why).slice(0, 140) : ''
      });
    });
    if (items.length) out.items = items.slice(0, 12);
  }
  if (raw.note) out.note = String(raw.note).slice(0, 200);
  return Object.keys(out).length ? out : null;
}

function extractDiagram(text) {
  const m = text.match(/\[DIAGRAM\]([\s\S]*?)\[\/DIAGRAM\]/);
  if (!m) return { text: text, diagram: null };
  const cleanText = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  let raw;
  try { raw = JSON.parse(m[1]); } catch { return { text: cleanText, diagram: null }; }
  if (!raw || !DIAGRAM_SHAPES.includes(raw.shape)) return { text: cleanText, diagram: null };

  const num = (v, def) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : def; };
  const p = raw.params || {};
  const d = { shape: raw.shape };
  if (raw.shape === 'triangle' || raw.shape === 'rightTriangle') {
    d.base = num(p.base, 6); d.height = num(p.height, 4);
  } else if (raw.shape === 'rectangle' || raw.shape === 'parallelogram') {
    d.width = num(p.width, 6); d.height = num(p.height, 4);
  } else if (raw.shape === 'circle') {
    d.radius = num(p.radius, 4);
  } else if (raw.shape === 'trapezoid') {
    d.topWidth = num(p.topWidth, 4); d.bottomWidth = num(p.bottomWidth, 7); d.height = num(p.height, 4);
  }
  return { text: cleanText, diagram: d };
}

function renderGeometrySVG(d) {
  const W = 220, H = 160, pad = 26;
  const maxDim = Math.max(d.base || 0, d.height || 0, d.width || 0, (d.radius || 0) * 2,
    d.topWidth || 0, d.bottomWidth || 0, 1);
  const scale = Math.min(W - pad * 2, H - pad * 2) / maxDim;
  const S = 'var(--pen-blue)';
  let shape = '';

  if (d.shape === 'triangle' || d.shape === 'rightTriangle') {
    const b = d.base * scale, h = d.height * scale, x0 = (W - b) / 2, y0 = H - pad;
    const pts = d.shape === 'rightTriangle'
      ? `${x0},${y0} ${x0 + b},${y0} ${x0},${y0 - h}`
      : `${x0},${y0} ${x0 + b},${y0} ${x0 + b / 2},${y0 - h}`;
    shape = `<polygon points="${pts}" fill="none" stroke="${S}" stroke-width="2"/>
      <text x="${x0 + b / 2}" y="${y0 + 16}" text-anchor="middle" font-size="12">${d.base}</text>
      <text x="${x0 - 8}" y="${y0 - h / 2}" text-anchor="end" font-size="12">${d.height}</text>`;
  } else if (d.shape === 'rectangle' || d.shape === 'parallelogram') {
    const w = d.width * scale, h = d.height * scale, x0 = (W - w) / 2, y0 = (H - h) / 2;
    shape = d.shape === 'parallelogram'
      ? `<polygon points="${x0 + w * 0.2},${y0} ${x0 + w},${y0} ${x0 + w * 0.8},${y0 + h} ${x0},${y0 + h}"
           fill="none" stroke="${S}" stroke-width="2"/>`
      : `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="${S}" stroke-width="2"/>`;
    shape += `<text x="${x0 + w / 2}" y="${y0 + h + 16}" text-anchor="middle" font-size="12">${d.width}</text>
      <text x="${x0 - 8}" y="${y0 + h / 2}" text-anchor="end" font-size="12">${d.height}</text>`;
  } else if (d.shape === 'circle') {
    const r = d.radius * scale;
    shape = `<circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="none" stroke="${S}" stroke-width="2"/>
      <line x1="${W / 2}" y1="${H / 2}" x2="${W / 2 + r}" y2="${H / 2}" stroke="${S}" stroke-width="1.5"/>
      <text x="${W / 2 + r / 2}" y="${H / 2 - 6}" text-anchor="middle" font-size="12">${d.radius}</text>`;
  } else if (d.shape === 'trapezoid') {
    const top = d.topWidth * scale, bot = d.bottomWidth * scale, h = d.height * scale;
    const x0 = (W - bot) / 2, y0 = H - pad, xt = (W - top) / 2;
    shape = `<polygon points="${xt},${y0 - h} ${xt + top},${y0 - h} ${x0 + bot},${y0} ${x0},${y0}"
        fill="none" stroke="${S}" stroke-width="2"/>
      <text x="${xt + top / 2}" y="${y0 - h - 6}" text-anchor="middle" font-size="12">${d.topWidth}</text>
      <text x="${x0 + bot / 2}" y="${y0 + 16}" text-anchor="middle" font-size="12">${d.bottomWidth}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
      style="display:block;margin:10px auto 4px;color:var(--graphite)">${shape}</svg>`;
}

/** image เป็น data URL ของรูปที่แนบ (ถ้ามี) — ส่งขึ้นเซิร์ฟเวอร์เฉพาะเทิร์นนี้เทิร์นเดียว
    ไม่ฝังเข้าไปใน history ที่ replay ซ้ำทุกครั้ง ไม่งั้น payload จะบวมขึ้นเรื่อยๆ ทุกคำถามถัดไป */
/** เดาว่าคำตอบโดนตัดกลางคันไหม — จบด้วยเครื่องหมายจบประโยคหรือคำลงท้ายถือว่าจบดี
    ถ้า $ ไม่ครบคู่ แปลว่าขาดกลางสมการแน่ๆ */
function looksTruncated(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if ((t.match(/\$/g) || []).length % 2 === 1) return true;
  return !/(ครับ|ค่ะ|คะ|นะ|แล้ว|เลย|[.!?…”)\]])$/.test(t);
}

async function sendToTutor(message, context, image, opts) {
  if (Tutor.busy) return;
  const silent = opts && opts.silent;
  if (!silent) {
    Tutor.history.push({ role: 'user', text: message, thumb: image || null, at: Date.now() });
  }
  Tutor.busy = true;
  Tutor.pendingImage = null;
  renderImagePreview();
  paintChat();
  const send = $('#tSend'); if (send) send.disabled = true;
  try {
    const reply = await Tutor.ask(message, context, image);
    const parsed = extractDiagram(reply);
    let shown = parsed.text;
    if (Tutor.ctx && Tutor.ctx.planner) {
      const planned = extractPlan(parsed.text);
      shown = planned.text;
      if (!silent && planned.plan && typeof applyStudyPlan === 'function') {
        applyStudyPlan(planned.plan);
        toast('อัปเดตแผนเรียนแล้ว');
      }
    }
    // โดนตัดกลางคัน ขอต่อให้จบหนึ่งครั้ง แล้วต่อข้อความเข้าด้วยกัน
    if (looksTruncated(shown)) {
      try {
        const more = await Tutor.ask('พิมพ์ต่อจากที่ค้างไว้ให้จบ ห้ามเริ่มใหม่ ห้ามทวนของเดิม', null, null);
        const m2 = extractDiagram(more || '');
        if (m2.text) shown = shown + m2.text;
        if (!parsed.diagram && m2.diagram) parsed.diagram = m2.diagram;
      } catch (e) { /* ต่อไม่ได้ก็แสดงเท่าที่มี */ }
    }
    Tutor.history.push({ role: 'model', text: shown, diagram: parsed.diagram, at: Date.now() });
    PersonalPath.record(silent);
    // เว็บไม่อ่านคำตอบออกเสียงแล้ว
  } catch (e) {
    Tutor.history.push({ role: 'model', text: '⚠️ ' + e.message, at: Date.now() });
  } finally {
    Tutor.busy = false;
    paintChat();
    const s = $('#tSend'); if (s) s.disabled = false;
    if (Tutor.ctx && Tutor.ctx.subId && location.hash.startsWith('#/tutor/')) render();
  }
}

function tutorSend() {
  const input = $('#tIn');
  const txt = (input.value || '').trim();
  const img = Tutor.pendingImage;
  if (!txt && !img) return;
  input.value = '';
  // แนบรูปมาโดยไม่พิมพ์อะไรเลยก็ส่งได้ ใช้คำถามเริ่มต้นแทน
  sendToTutor(txt || 'ช่วยดูโจทย์ในรูปนี้ให้หน่อย', null, img);
}

/** ฟังคำพูดแบบอิสระ (ไม่ใช่เฉพาะตัวเลขเหมือนโหมดตอบโจทย์) */
function tutorMic() {
  if (!hasSTT) return toast('เบราว์เซอร์นี้ยังไม่รองรับการรับเสียง ลองใช้ Chrome');
  const mic = $('#tMic'), hint = $('#tHint'), input = $('#tIn');
  const r = new SRClass();
  r.lang = 'th-TH';
  r.interimResults = true;
  r.continuous = false;
  r.onstart = () => { mic.classList.add('rec'); hint.textContent = 'กำลังฟัง… พูดคำถามได้เลย'; };
  r.onend = () => {
    mic.classList.remove('rec');
    hint.textContent = 'พูดจบแล้วตรวจข้อความก่อนส่งได้ · ติวเตอร์เป็น AI อาจตอบผิดได้';
  };
  r.onerror = ev => {
    mic.classList.remove('rec');
    toast(ev.error === 'not-allowed' ? 'ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน' : 'ฟังไม่ชัด ลองอีกครั้ง');
  };
  // ใส่ข้อความลงช่องพิมพ์ ไม่ส่งทันที ให้ผู้ใช้แก้คำที่ถอดเสียงผิดก่อนได้
  r.onresult = ev => {
    let txt = '';
    for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
    input.value = txt.trim();
    if (ev.results[ev.results.length - 1].isFinal) input.focus();
  };
  r.start();
}


function closeTutor() {
  const ctx = Tutor.ctx;
  if (ctx && ctx.planner) {
    Tutor.ctx = null;
    return go('#/planner');
  }
  if (ctx && ctx.splitHelp) {
    const back = ctx.back || '#/askq';
    Tutor.ctx = null;
    return go(back);
  }
  const back = ctx && ctx.unitId;
  const wasLesson = ctx && ctx.lesson;
  if (wasLesson && back && Tutor.history.some(m => m.role === 'user')) {
    const prev = S.progress[back] || { stars: 0, best: 0, runs: 0 };
    S.progress[back] = Object.assign({}, prev, { runs: (prev.runs || 0) + 1 });
    save();
  }
  Tutor.ctx = null;

  // ถ้ามาจากการทำโจทย์แล้วข้อนั้นตอบไปแล้ว ให้เดินหน้าไปข้อถัดไป
  // ไม่งั้นจะกลับมาเจอข้อเดิมที่ตอบแล้ว กดตรวจไม่ได้ ค้างอยู่ตรงนั้น
  if (!wasLesson && LESSON && back && LESSON.unitId === back && LESSON.answered) {
    LESSON.i++; LESSON.answered = false; LESSON.sel = null;
  }
  if (!back) return go('#/');                          // คุยอิสระ ไม่ผูกหน่วย -> กลับหน้าแรก
  if (wasLesson) return go('#/home');
  go('#/lesson/' + back);
}

/** สลับความยินยอมให้ AI ใช้ข้อมูลเรียนไปพัฒนา — เปลี่ยนใจได้ตลอด ตาม PDPA */
async function toggleAIConsent() {
  const on = $('#cAiMe').checked;
  await persistConsent(on);
  toast(on ? 'ยินยอมให้นำข้อมูลไปพัฒนา AI แล้ว' : 'ยกเลิกความยินยอมแล้ว');
}
