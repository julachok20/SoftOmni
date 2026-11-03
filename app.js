/* MathPath — ตรรกะทั้งหมด
   ต้องโหลดหลัง curriculum.js (ใช้ตัวแปร CURRICULUM และ LEVEL_ORDER)
   สถานะทั้งหมดเก็บใน localStorage คีย์ 'mathpath.v1'
   ถ้าจะย้ายไป Supabase ภายหลัง แก้แค่ load() / save() สองฟังก์ชัน
*/
'use strict';

/* ============ 1. ที่เก็บข้อมูล ============ */
const KEY = 'mathpath.v1';
const HEART_MAX = 5;
const HEART_REGEN_MS = 10 * 60 * 1000;   // ฟื้น 1 ดวงทุก 10 นาที
const PASS_PCT = 60;                      // ผ่านบทเรียนที่ 60%

// ทดลองเรียนได้ฟรีก่อนสมัคร พอครบต้องมีบัญชีเพื่อไปต่อ
const TRIAL_QUESTIONS = 25;
const TRIAL_UPLOADS = 3;

const DEFAULT_STATE = {
  v: 1, name: '', level: null, xp: 0, streak: 0, lastDay: null,
  hearts: HEART_MAX, heartsAt: Date.now(), freeMode: false,
  progress: {}, subProgress: {}, topicTests: {}, uploads: [],
  board: { alias: '', joined: true, minutes: 0, questions: 0, days: [] }, trialQ: 0, profile: null, onboarded: false, consent: null,
  // บัญชีที่ข้อมูลชุดนี้เป็นของ — null คือยังไม่เคยล็อกอิน (ข้อมูลช่วงทดลองเรียน)
  ownerId: null
};

/** สลับบัญชีแล้วต้องล้างของเดิมก่อน ไม่งั้นข้อมูลบัญชีเก่าจะค้างและทับของบัญชีใหม่
    เช่น ผล pre-test จะขึ้นก็ต่อเมื่อใหม่กว่าของเดิม ถ้าบัญชีเก่าทำทีหลัง ของใหม่จะไม่มีวันขึ้น
    ข้อมูลช่วงทดลองเรียน (ownerId เป็น null) ไม่ล้าง เพราะตั้งใจให้ย้ายเข้าบัญชีแรกที่สมัคร */
function claimStateFor(userId) {
  if (!userId) return false;
  const owner = S.ownerId || null;
  if (owner === userId) return false;
  if (owner === null) { S.ownerId = userId; save(); return false; }
  const keep = { hearts: S.hearts, heartsAt: S.heartsAt };
  S = Object.assign({}, DEFAULT_STATE, keep, { ownerId: userId });
  try { localStorage.removeItem(typeof MOCK_CACHE_KEY === 'string' ? MOCK_CACHE_KEY : 'softomni.mockset.v2'); } catch (e) { /* ไม่เป็นไร */ }
  save();
  return true;
}

/* จำนวนที่ยังทำได้ในโหมดทดลอง — ล็อกอินแล้วคือไม่จำกัด
   ตัวนับอยู่ในเครื่อง ล้างข้อมูลเบราว์เซอร์ก็รีเซ็ตได้
   ตรงนี้ไม่ได้กันการโกง แค่ชวนให้สมัครเพื่อไม่ให้ความคืบหน้าหาย */
function trialLeft() {
  if (Cloud.signedIn()) return Infinity;
  return Math.max(0, TRIAL_QUESTIONS - (S.trialQ || 0));
}
function uploadsLeft() {
  if (Cloud.signedIn()) return Infinity;
  return Math.max(0, TRIAL_UPLOADS - S.uploads.length);
}

let S = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.assign({}, DEFAULT_STATE, raw);
  } catch (e) {
    console.warn('อ่านข้อมูลเดิมไม่ได้ เริ่มใหม่', e);
    return Object.assign({}, DEFAULT_STATE);
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    // โควตาเต็ม — มักเกิดจากรูปโจทย์ที่อัปโหลดไว้มาก
    toast('พื้นที่เก็บข้อมูลเต็ม ลองลบโจทย์ที่มีรูปออกบ้าง');
    console.error(e);
  }
  // ถ้าล็อกอินอยู่ ค่อยส่งขึ้นคลาวด์แบบหน่วงรวม (ไม่ล็อก UI ไม่พังถ้าเน็ตหลุด)
  if (typeof Cloud !== 'undefined') Cloud.schedulePush();
}

/* ============ 2. หัวใจ / สตรีค ============ */
function regenHearts() {
  if (S.hearts >= HEART_MAX) { S.heartsAt = Date.now(); return; }
  const gained = Math.floor((Date.now() - S.heartsAt) / HEART_REGEN_MS);
  if (gained > 0) {
    S.hearts = Math.min(HEART_MAX, S.hearts + gained);
    S.heartsAt = Date.now();
    save();
  }
}
const todayStr = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD ตามเวลาเครื่อง

function touchStreak() {
  const t = todayStr();
  if (S.lastDay === t) return;
  const y = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE');
  S.streak = (S.lastDay === y) ? S.streak + 1 : 1;
  S.lastDay = t;
  save();
}

/* ============ 3. ตัวช่วยทั่วไป ============ */
const $ = (sel, root) => (root || document).querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** เส้นทางเบรดครัมบ์ด้านบนหน้า — อ้างอิงแพทเทิร์นที่เจอซ้ำแทบทุกหน้าจอใน Stitch
    parts = [[label, hash|null], ...] — hash เป็น null แปลว่าเป็นข้อความปัจจุบัน กดไม่ได้ */
function breadcrumb(parts) {
  return `<nav class="crumbs">${parts.map((p, i) => {
    const [label, hash] = p;
    const item = hash ? `<a href="${hash}">${esc(label)}</a>` : `<span>${esc(label)}</span>`;
    return item + (i < parts.length - 1 ? '<span class="sep">›</span>' : '');
  }).join('')}</nav>`;
}

/** เรนเดอร์สมการ LaTeX ($...$ / $$...$$) เป็นสัญลักษณ์คณิตศาสตร์จริงด้วย KaTeX
    ใช้ร่วมกันทั้งการ์ดโจทย์ (บทเรียน/แบบทดสอบ) และห้องคุยติวเตอร์ — เผื่อ KaTeX โหลดไม่ทัน/พัง ก็ปล่อยผ่านเป็นข้อความดิบ */
/** ซ่อม LaTeX ที่โมเดลเขียนพลาด แล้วค่อยส่งให้ KaTeX
    อาการที่เจอจริง: เขียน $frac{1}{2}$ โดยลืม backslash ทำให้ KaTeX แสดงเป็นตัวอักษรเปล่า
    ซ่อมเฉพาะภายในคู่ $...$ เท่านั้น จะได้ไม่ไปแตะข้อความไทยที่บังเอิญมีคำเหล่านี้ */
const TEX_CMDS = /(^|[^\\\\A-Za-z])(frac|sqrt|sin|cos|tan|cot|sec|csc|log|ln|exp|lim|sum|prod|int|theta|alpha|beta|gamma|pi|lambda|mu|sigma|omega|delta|phi|cup|cap|subset|in|notin|neq|leq|geq|approx|times|div|pm|cdot|left|right|begin|end|text|mathbb|overline|vec|angle|triangle|ldots|cdots|infty)(?=[^A-Za-z]|$)/g;
function fixTex(src) {
  return String(src || '').replace(/\$([^$\n]{1,400})\$/g,
    (all, inner) => '$' + inner.replace(TEX_CMDS, (m, pre, cmd) => pre + '\\' + cmd) + '$');
}

function renderMath(el) {
  if (!el || !window.renderMathInElement) return;
  // ซ่อมข้อความในโหนดตัวอักษรก่อน KaTeX จะไล่หา delimiter
  try {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const fixes = [];
    let n;
    while ((n = walk.nextNode())) {
      if (n.nodeValue && n.nodeValue.indexOf('$') >= 0) {
        const out = fixTex(n.nodeValue);
        if (out !== n.nodeValue) fixes.push([n, out]);
      }
    }
    fixes.forEach(([node, out]) => { node.nodeValue = out; });
  } catch (e) { /* ซ่อมไม่ได้ก็ปล่อยให้ KaTeX จัดการเท่าที่ได้ */ }
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  } catch (e) { /* noop */ }
}
const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [r[i], r[j]] = [r[j], r[i]]; } return r; };

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function findUnit(unitId) {
  for (const lv of LEVEL_ORDER) {
    const u = CURRICULUM[lv].units.find(x => x.id === unitId);
    if (u) return { unit: u, levelId: lv };
  }
  return null;
}

/* รวมโจทย์ในหลักสูตร + โจทย์ที่ผู้ใช้อัปโหลดไว้ในหน่วยนั้น */
function poolFor(unitId) {
  const found = findUnit(unitId);
  const base = found ? found.unit.q : [];
  // โจทย์ที่ไม่ได้ใส่เฉลยไว้ (อัปโหลดมาให้ AI วิเคราะห์อย่างเดียว) ตรวจคำตอบไม่ได้ ห้ามสุ่มมาถามในบทเรียน
  const mine = S.uploads.filter(u => u.unit === unitId && u.a !== null && u.a !== undefined);
  return base.concat(mine.map(q => Object.assign({},q,{_unverified:true})));
}

function levelPct(levelId) {
  const units = CURRICULUM[levelId].units;
  const done = units.filter(u => (S.progress[u.id] || {}).stars > 0).length;
  return Math.round(done / units.length * 100);
}

function unitsDoneCount() {
  return Object.keys(S.progress).filter(k => (S.progress[k] || {}).stars > 0).length;
}

function profileInitial() {
  const email = Cloud.signedIn() ? (Cloud.state.email || '') : '';
  return email ? email[0].toUpperCase() : 'S';
}

function choiceGridClass(q) {
  return q.t === 'mc' && q.c.every(c => String(c).length < 24) ? 'choices cols2' : 'choices';
}

/** ชั้นเรียนของผู้ใช้ — จากวิซาร์ด/ตั้งค่า/คลาวด์ ไม่ใช่ตัวเลือกในหน้าบทเรียน */
function userClassId() {
  const g = (S.profile && S.profile.grade) || S.level;
  return (g && CURRICULUM[g]) ? g : 'm1';
}

function understandingLabel() {
  const id = (S.profile || {}).understanding;
  const found = typeof UNDERSTANDING_LEVELS !== 'undefined'
    ? UNDERSTANDING_LEVELS.find(u => u[0] === id) : null;
  return found ? found[1] : '';
}

/** หน่วยที่ AI แนะนำจาก Pre-test — ใช้ได้เฉพาะรอบที่ผู้เรียนกด "ใช้เลย"
    ถ้ากด "อยากปรับเอง" จะไม่ดึงคำแนะนำมาจัดเส้นทาง */
function appliedRecIds() {
  const lp = S.lastPretest;
  if (!lp || S.pretestApplied === false) return [];
  return lp.recommendedUnits || [];
}

function schoolStretchIds(gradeId) {
  const start = LEVEL_ORDER.indexOf(gradeId);
  const from = start < 0 ? 0 : Math.max(0, start);
  return LEVEL_ORDER.slice(from).flatMap(lv => CURRICULUM[lv].units.map(u => u.id));
}

function goalTrackIds() {
  const p = S.profile || {};
  if (p.goal === 'a_level' && p.major && FACULTY_TRACKS[p.major]) return FACULTY_TRACKS[p.major].slice();
  if (p.goal === 'a_level' || !p.goal) return STEM_TRACK.slice();
  return schoolStretchIds(userClassId());
}

function goalTrackUnits() {
  return goalTrackIds().map(id => findUnit(id)).filter(Boolean);
}

/** หน่วยที่ต้องแทรก — อยู่นอกเส้นทางปกติ (เช่น พหุนาม ทั้งที่คณะนี้ยังไม่ถึง) */
function insertedTrackUnits() {
  const seen = {};
  const out = [];
  const add = uid => {
    if (!uid || seen[uid]) return;
    seen[uid] = true;
    const f = findUnit(uid);
    if (f) out.push(f);
  };
  (typeof planTopicIds === 'function' ? planTopicIds() : []).forEach(tid => {
    const t = typeof alevelTopic === 'function' ? alevelTopic(tid) : null;
    (t && t.units ? t.units : []).forEach(add);
  });
  appliedRecIds().forEach(add);
  return out;
}

function personalizedTrack() {
  const seen = {};
  const out = [];
  insertedTrackUnits().concat(goalTrackUnits()).forEach(f => {
    if (!f || seen[f.unit.id]) return;
    seen[f.unit.id] = true;
    out.push(f);
  });
  return out;
}

function isTrackUnlocked(idx) {
  if (S.freeMode || idx === 0) return true;
  const track = personalizedTrack();
  const rec = appliedRecIds();
  if (track[idx] && rec.indexOf(track[idx].unit.id) >= 0) return true;
  const extras = insertedTrackUnits().map(f => f.unit.id);
  if (track[idx] && extras.indexOf(track[idx].unit.id) >= 0) return true;
  const prev = track[idx - 1];
  return prev ? ((S.progress[prev.unit.id] || {}).stars || 0) > 0 : true;
}

function currentTrackIndex() {
  const track = personalizedTrack();
  if (!track.length) return 0;
  const rec = appliedRecIds();
  const recI = track.findIndex(f => rec.indexOf(f.unit.id) >= 0 && !(S.progress[f.unit.id] || {}).stars);
  if (recI >= 0) return recI;
  let i = track.findIndex((f, idx) => isTrackUnlocked(idx) && !(S.progress[f.unit.id] || {}).stars);
  if (i < 0) i = track.findIndex((f, idx) => isTrackUnlocked(idx));
  return i < 0 ? 0 : i;
}

function trackPct() {
  const track = personalizedTrack();
  if (!track.length) return 0;
  const done = track.filter(f => (S.progress[f.unit.id] || {}).stars > 0).length;
  return Math.round(done / track.length * 100);
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** โจทย์ประจำวัน — กลางหรือยาก จากเส้นทางเป้าหมาย ไม่ใช่ข้อสอบ A-Level ปีนั้น */
function dailyPick() {
  const track = personalizedTrack();
  if (!track.length) return null;
  const med = [], hard = [];
  track.forEach((f, i) => {
    (f.unit.q || []).forEach(q => {
      const row = { unitId: f.unit.id, q: q, unitName: f.unit.name };
      if (i >= Math.floor(track.length * 0.45)) hard.push(row);
      else if (i >= 1) med.push(row);
    });
  });
  const wantHard = hashStr(todayKey()) % 2 === 1;
  const pool = (wantHard && hard.length) ? hard : (med.length ? med : (hard.length ? hard : []));
  if (!pool.length) return null;
  const hit = pool[hashStr(todayKey() + 'q') % pool.length];
  hit.difficulty = (pool === hard || wantHard) ? 'hard' : 'medium';
  return hit;
}

/* หน่วยจะปลดล็อกเมื่อหน่วยก่อนหน้าได้อย่างน้อย 1 ดาว
   ยกเว้นเปิด "เรียนอิสระ" ไว้ — หรือหน่วยที่ Pre-test แนะนำให้เริ่ม (เส้นทางส่วนตัว) */
function isUnlocked(levelId, idx) {
  if (S.freeMode || idx === 0) return true;
  const u = CURRICULUM[levelId].units[idx];
  if (u && appliedRecIds(levelId).includes(u.id)) return true;
  const prev = CURRICULUM[levelId].units[idx - 1];
  return ((S.progress[prev.id] || {}).stars || 0) > 0;
}

function currentUnitIndex(levelId) {
  const L = CURRICULUM[levelId];
  if (!L) return 0;
  const rec = appliedRecIds(levelId);
  if (rec.length) {
    const recI = L.units.findIndex(u => rec.includes(u.id) && !(S.progress[u.id] || {}).stars);
    if (recI >= 0) return recI;
  }
  let i = L.units.findIndex((u, idx) => isUnlocked(levelId, idx) && !(S.progress[u.id] || {}).stars);
  if (i < 0) i = L.units.findIndex((u, idx) => isUnlocked(levelId, idx));
  return i < 0 ? 0 : i;
}

/* ============ 4. แปลงคำตอบเป็นตัวเลข (ใช้กับทั้งช่องพิมพ์และโหมดพูด) ============ */
const TH_DIGIT = {'ศูนย์':0,'หนึ่ง':1,'เอ็ด':1,'สอง':2,'ยี่':2,'สาม':3,'สี่':4,'ห้า':5,'หก':6,'เจ็ด':7,'แปด':8,'เก้า':9};
const TH_UNIT  = {'สิบ':10,'ร้อย':100,'พัน':1000,'หมื่น':10000,'แสน':100000,'ล้าน':1000000};
// เรียงคำยาวก่อน เพื่อไม่ให้คำสั้นไปชิงจับคู่ก่อนคำยาวที่ขึ้นต้นเหมือนกัน
const TH_TOKENS = Object.keys(TH_DIGIT).concat(Object.keys(TH_UNIT)).sort((a, b) => b.length - a.length);

/** อ่านคำบอกจำนวนภาษาไทยเป็นจำนวนเต็ม (รองรับถึงหลักล้าน) */
function thaiWordsToInt(s) {
  let total = 0, pending = 0, i = 0, saw = false;
  while (i < s.length) {
    const tok = TH_TOKENS.find(t => s.startsWith(t, i));
    if (!tok) { i++; continue; }
    saw = true;
    i += tok.length;
    if (tok in TH_DIGIT) {
      pending = TH_DIGIT[tok];
    } else {
      const mul = TH_UNIT[tok];
      if (mul === 1000000) { total = (total + pending) * mul; }
      else { total += (pending || 1) * mul; }
      pending = 0;
    }
  }
  return saw ? total + pending : null;
}

/** แปลงข้อความคำตอบเป็นตัวเลข คืน null ถ้าแปลงไม่ได้
    รองรับ: "12", "-3.5", "๑๒", "ลบสาม", "ยี่สิบสาม", "สองจุดห้า" */
function toNumber(text) {
  if (text === null || text === undefined) return null;
  let t = String(text).trim()
    .replace(/[๐-๙]/g, d => '๐๑๒๓๔๕๖๗๘๙'.indexOf(d))   // เลขไทย -> อารบิก
    .replace(/,/g, '')
    .replace(/\s+/g, ' ');                              // เหลือเว้นวรรคช่องเดียว ใช้แยกเศษส่วนคละ
  if (!t) return null;

  const neg = /^(ลบ|-|−)/.test(t);
  t = t.replace(/^(ลบ|-|−)\s*/, '');
  const sign = neg ? -1 : 1;

  // เศษส่วนคละ เช่น 1 1/2 = 1.5 ต้องเช็คก่อนเศษส่วนธรรมดา
  const mixed = t.match(/^(\d+) (\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (mixed) {
    const den = parseFloat(mixed[3]);
    if (!den) return null;
    return sign * (parseInt(mixed[1], 10) + parseFloat(mixed[2]) / den);
  }

  const flat = t.replace(/ /g, '');

  // เศษส่วน เช่น 3/10 ต้องได้ 0.3 ไม่ใช่ 3 · ส่วนเป็นศูนย์ถือว่าตอบไม่ได้
  const frac = flat.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) {
    const den = parseFloat(frac[2]);
    if (!den) return null;
    return sign * (parseFloat(frac[1]) / den);
  }

  const digits = flat.match(/^\d+(\.\d+)?/);
  if (digits) return sign * parseFloat(digits[0]);
  t = flat;

  // คำภาษาไทย อาจมี "จุด" คั่นทศนิยม
  const parts = t.split('จุด');
  const whole = thaiWordsToInt(parts[0]);
  if (whole === null) return null;
  let val = whole;
  if (parts[1]) {
    // ส่วนทศนิยมอ่านเรียงทีละหลัก เช่น "สองห้า" = .25
    let frac = '', i = 0;
    while (i < parts[1].length) {
      const tok = TH_TOKENS.find(x => parts[1].startsWith(x, i) && x in TH_DIGIT);
      if (!tok) { i++; continue; }
      frac += TH_DIGIT[tok]; i += tok.length;
    }
    if (frac) val = parseFloat(whole + '.' + frac);
  }
  return (neg ? -1 : 1) * val;
}

/** ผู้เรียนพิมพ์คำตอบมาเป็นเศษส่วนหรือเปล่า เช่น 3/10 หรือ 1 1/3 */
/* ---------- สถิติสำหรับกระดานจัดอันดับ ----------
   นับเวลาและจำนวนข้อจากที่ทำจริงในแอป ไม่ได้ให้กรอกเอง
   วันที่เข้ามาเก็บเป็นรายวันไม่ซ้ำ เพื่อวัด "มาต่อเนื่อง" ไม่ใช่ "นั่งยาววันเดียว" */
function boardState() {
  if (!S.board) S.board = { alias: '', joined: true, minutes: 0, questions: 0, days: [] };
  if (!Array.isArray(S.board.days)) S.board.days = [];
  return S.board;
}

function boardTouchToday() {
  const b = boardState();
  const today = new Date().toISOString().slice(0, 10);
  if (b.days.indexOf(today) < 0) b.days.push(today);
  if (b.days.length > 400) b.days = b.days.slice(-400);
}

/** เรียกทุกครั้งที่จบชุดฝึกหรือสอบ — นาทีมาจากเวลาที่จับได้จริงของรอบนั้น */
function boardAddSession(startedAt, questionCount) {
  const b = boardState();
  const mins = startedAt ? Math.min(180, Math.round((Date.now() - startedAt) / 60000)) : 0;
  b.minutes = (b.minutes || 0) + mins;
  b.questions = (b.questions || 0) + (questionCount || 0);
  boardTouchToday();
  save();
  pushBoard();
}

/** คะแนนตั้งต้นคือ Pre-test ครั้งแรก ปลายทางคือคะแนนดีสุดที่ทำได้ในระบบ */
function boardScores() {
  const first = S.firstScore != null ? S.firstScore
    : (S.lastPretest && S.lastPretest.scorePct != null ? S.lastPretest.scorePct : null);
  if (first != null && S.firstScore == null) S.firstScore = first;
  let best = first;
  if (S.lastMock && S.lastMock.scorePct != null) best = Math.max(best == null ? 0 : best, S.lastMock.scorePct);
  Object.keys(S.topicTests || {}).forEach(k => {
    const t = S.topicTests[k];
    if (t && t.pct != null) best = Math.max(best == null ? 0 : best, t.pct);
  });
  return { first: first, best: best };
}

function pushBoard() {
  if (!Cloud.signedIn()) return;
  const b = boardState();
  const sc = boardScores();
  Cloud.saveBoard({
    alias: b.alias, joined: b.joined !== false,
    minutes: b.minutes || 0, questions: b.questions || 0,
    activeDays: (b.days || []).length, streak: S.streak || 0,
    firstScore: sc.first, bestScore: sc.best
  });
}

function isFractionInput(text) {
  const t = String(text == null ? '' : text)
    .replace(/[๐-๙]/g, d => '๐๑๒๓๔๕๖๗๘๙'.indexOf(d))
    .replace(/,/g, '');
  return /^\s*(ลบ|-|−)?\s*\d+(\s+\d+)?\s*\/\s*\d+(\.\d+)?\s*$/.test(t);
}

/** เฉลยที่เขียนเป็นทศนิยมปัดเศษ เช่น 0.33 คือ 1/3 ที่ปัดไว้สองตำแหน่ง
    ถ้าผู้เรียนตอบเป็นเศษส่วน (1/3 = 0.3333…) ต้องถือว่าตรงกัน จึงผ่อนเกณฑ์
    เท่ากับครึ่งหนึ่งของหลักสุดท้ายที่เฉลยเขียนไว้ ไม่ใช่ผ่อนแบบตายตัว
    ผ่อนเฉพาะเฉลยที่มีทศนิยมตั้งแต่ 2 ตำแหน่ง เพราะทศนิยมตำแหน่งเดียวมักเป็นค่าที่ลงตัวอยู่แล้ว
    ถ้าโจทย์กำหนด tol มาเอง ให้ใช้ของโจทย์เสมอ */
function answerTolerance(q, given) {
  if (q.tol != null) return q.tol;
  if (!isFractionInput(given)) return 1e-9;
  const s = String(q.a);
  const dot = s.indexOf('.');
  const decimals = dot < 0 ? 0 : s.length - dot - 1;
  if (decimals < 2) return 1e-9;
  return 0.5 * Math.pow(10, -decimals) + 1e-9;
}

function isCorrect(q, given) {
  if (q.t === 'mc') return given === q.a;
  const n = toNumber(given);
  if (n === null) return false;
  return Math.abs(n - q.a) <= answerTolerance(q, given);
}

/* ============ 5. เสียง (Web Speech API) ============ */
const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSTT = !!SRClass;

/** เว็บไม่อ่านออกเสียงแล้ว — คงฟังก์ชันไว้ให้จุดที่เรียกอยู่เดิมไม่พัง
    และยังเรียก callback ต่อ เพื่อไม่ให้ลำดับงานที่รอเสียงจบค้างอยู่ */
function speak(text, onEnd) {
  if (onEnd) onEnd();
}

/** ฟังเสียง คืนผ่าน cb(ข้อความที่ได้ยิน, ตัวเลขที่แปลงได้) */
function listen(cb, onState) {
  if (!hasSTT) { toast('เบราว์เซอร์นี้ยังไม่รองรับการรับเสียง ลองใช้ Chrome'); return null; }
  const r = new SRClass();
  r.lang = 'th-TH';
  r.interimResults = false;
  r.maxAlternatives = 3;   // ผลอันดับ 1 มักถอดมาเป็นคำ ไม่ใช่ตัวเลข จึงต้องดูหลายตัวเลือก
  r.onstart = () => onState && onState(true);
  r.onend = () => onState && onState(false);
  r.onerror = ev => {
    onState && onState(false);
    toast(ev.error === 'not-allowed' ? 'ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน' : 'ฟังไม่ชัด ลองอีกครั้ง');
  };
  r.onresult = ev => {
    const alts = Array.prototype.map.call(ev.results[0], a => a.transcript);
    // เลือกตัวเลือกแรกที่แปลงเป็นตัวเลขได้ ถ้าไม่มีเลยก็ส่งตัวแรกกลับไป
    const hit = alts.find(a => toNumber(a) !== null);
    cb(hit || alts[0] || '', toNumber(hit || alts[0]));
  };
  r.start();
  return r;
}

/* ============ 6. เส้นทางหน้า (hash router) ============ */
function go(hash) { location.hash = hash; }
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  // ไม่ต้องอุ่นเครื่องรายชื่อเสียงแล้ว เพราะไม่มีการอ่านออกเสียง
  regenHearts();
  render();                                      // วาดจากข้อมูลในเครื่องก่อน ไม่รอเน็ต
  // ดึงของใหม่จากคลาวด์มารวมทีหลัง แล้ววาดซ้ำถ้ามีอะไรเปลี่ยน
  if (Cloud.signedIn()) Cloud.pullAll().then(ok => { if (ok) render(); });
});

function route() {
  const parts = (location.hash || '#/').slice(2).split('/').filter(Boolean);
  return { name: parts[0] || 'dashboard', a: parts[1], b: parts[2] };
}

function render() {
  if (location.hash === '#test') return;
  regenHearts();
  const r = route();
  const app = $('#app');
  window.scrollTo(0, 0);
  document.body.classList.toggle('tutor-mode', r.name === 'tutor' && Cloud.signedIn());
  document.body.classList.toggle('wide-app', r.name === 'test' || r.name === 'me' || r.name === 'path' || r.name === 'home' || r.name === 'topic' || r.name === 'planner' || r.name === 'mock' || r.name === 'askq' || r.name === 'drill' || r.name === 'board');
  if (r.name !== 'pretest' && r.name !== 'mock') clearInterval(window._pretestClock);
  ({
    dashboard: viewDashboard, home: viewHome, path: viewPath, lesson: viewLesson,
    topic: viewTopic, realscores: viewRealScore, planner: viewPlanner, mock: viewMock,
    learn: (app,r) => Learning.view(app,r), drill: viewDrill, board: viewBoard,
    askq: viewAskQ,
    upload: viewUpload, bank: viewBank, me: viewMe,
    auth: viewAuth, gate: viewGate,
    welcome: viewWelcome, tutor: viewTutor, privacy: viewPrivacy,
    setgoal: viewSetGoal, pretest: viewPretest, test: viewTestHub,
    uploadresult: viewUploadResult, personalize: viewPersonalize
  }[r.name] || viewDashboard)(app, r);
  paintPretestNag(app, r);
  renderTopbar(r);
  renderTabs(r);
  hydrateImages();
  // เฟดเข้าเบาๆ ทุกครั้งที่เปลี่ยนหน้า — รีสตาร์ท animation ด้วยการ reflow (อ่าน offsetWidth บังคับเบราว์เซอร์คำนวณ layout ใหม่ก่อน)
  app.classList.remove('pagefade'); void app.offsetWidth; app.classList.add('pagefade');
}

/* รูปที่ดึงมาจากคลาวด์เก็บเป็น path ไม่ใช่ base64 (บักเก็ตเป็นแบบส่วนตัว)
   จึงต้องขอ URL ชั่วคราวตอนแสดงผล ทำแบบไม่บล็อกการวาดหน้า */
function hydrateImages() {
  document.querySelectorAll('img[data-imgpath]:not([src])').forEach(el => {
    Cloud.signedImageUrl(el.getAttribute('data-imgpath')).then(url => { if (url) el.src = url; });
  });
}
function imgTag(q) {
  if (q.img) return `<img class="qimg" src="${q.img}" alt="ภาพประกอบโจทย์">`;
  if (q.imgPath) return `<img class="qimg" data-imgpath="${esc(q.imgPath)}" alt="ภาพประกอบโจทย์">`;
  return '';
}

/** ยังไม่ได้ทำ Pre-test = ระบบยังไม่รู้ระดับผู้เรียน แผนเรียนและการทำนายคะแนนจึงยังทำไม่ได้
    จึงเตือนทุกหน้าจนกว่าจะทำ ยกเว้นหน้าที่กำลังทำอยู่หรือหน้าที่ยังไม่ได้ล็อกอิน */
function paintPretestNag(app, r) {
  if (!app || !Cloud.signedIn()) return;
  if (S.lastPretest && S.lastPretest.scorePct != null) return;
  const skip = ['pretest', 'auth', 'gate', 'welcome', 'personalize', 'tutor', 'privacy'];
  if (skip.indexOf(r.name) >= 0) return;
  if (app.querySelector('.pretestnag')) return;
  const f = typeof pretestFormat === 'function' ? pretestFormat() : { questions: 30, minutes: 90 };
  const bar = document.createElement('div');
  bar.className = 'banner pretestnag';
  bar.innerHTML = '<b>ยังไม่ได้ทำแบบทดสอบวัดระดับ</b>' +
    '<p class="note" style="margin:4px 0 8px">' + f.questions + ' ข้อ · ' + f.minutes +
    ' นาที · จับเวลาต่อข้อเท่าสนามจริงแต่ข้อง่ายกว่า ระบบต้องใช้ผลนี้เพื่อวางแผนเรียนและทำนายคะแนนให้คุณ</p>' +
    '<button class="btn sm" style="width:auto" onclick="go(' + String.fromCharCode(39) + '#/pretest' + String.fromCharCode(39) + ')">ทำแบบทดสอบวัดระดับ</button>';
  app.insertBefore(bar, app.firstChild);
}

function renderTopbar(r) {
  const back = ['lesson', 'bank', 'upload', 'uploadresult', 'pretest', 'setgoal'].indexOf(r.name) >= 0
    ? `<button class="backbtn" onclick="${r.name === 'lesson' ? "go('#/home')" : 'history.back()'}" aria-label="ย้อนกลับ">←</button>` : '';
  // ระหว่างทำโจทย์ ซ่อนตัวเลขบนสุด เพราะแถบในบทเรียนแสดงหัวใจอยู่แล้ว
  const inQuiz = r.name === 'lesson' && LESSON;
  $('#topbar').innerHTML = `
    ${back}
    <span class="brand"><img class="brandmark" src="assets/mark-64.png?v=10" alt="">SoftOmni</span>
    <span class="spacer"></span>
    ${inQuiz ? '' : `
      <span class="stat streak" title="วันต่อเนื่อง">🔥 ${S.streak}</span>
      <span class="stat xp" title="คะแนนสะสม">⭐ ${S.xp}</span>
      <span class="stat heart" title="หัวใจ">❤️ ${S.hearts}</span>`}`;
}

// จัดกลุ่มหน้าจอย่อยเข้าแท็บหลัก 5 แท็บ: หน้าแรก/บทเรียน/AI Tutor/Test/ตั้งค่า
// แท็บ "tutor" (#/tutor เฉยๆ ไม่มี unit) แยกจากห้องคุยระหว่างทำบทเรียน (#/tutor/หน่วยไอดี)
// ห้องคุยระหว่างบทเรียนถือเป็นส่วนหนึ่งของ "บทเรียน" ไม่ใช่แท็บ AI Tutor เพื่อไม่ให้สับสนว่าเป็นคนละโหมด
const TAB_GROUPS = {
  dashboard: ['dashboard'],
  home: ['learn', 'home', 'path', 'lesson', 'topic', 'bank', 'upload', 'uploadresult', 'personalize', 'realscores', 'askq'],
  tutor: ['planner', 'tutor'],
  test: ['test', 'pretest', 'mock'],
  board: ['board'],
  me: ['me', 'setgoal', 'privacy']
};
function activeTabId(r) {
  if (r.name === 'tutor') return r.a ? 'home' : 'tutor';
  for (const id in TAB_GROUPS) if (TAB_GROUPS[id].includes(r.name)) return id;
  return null;
}
function renderTabs(r) {
  const tabs = [
    ['dashboard', '🏠', 'หน้าแรก', "go('#/dashboard')"],
    ['home', '📘', 'บทเรียน', "go('#/home')"],
    ['tutor', '🗺️', 'AI Planner', "go('#/planner')"],
    ['test', '📝', 'Test', "go('#/test')"],
    ['board', '🏆', 'อันดับ', "go('#/board')"],
    ['me', '⚙️', 'ตั้งค่า', "go('#/me')"]
  ];
  // sidehead โผล่เฉพาะจอกว้าง (ซ่อนด้วย CSS บนมือถือ) — ไม่ซ้ำกับแถบบนเพราะ
  // #topbar .brand ถูกซ่อนไว้ที่จอกว้างเหมือนกัน
  const sidehead = `<div class="sidehead"><img src="assets/mark-64.png?v=10" alt="">SoftOmni</div>`;
  // การ์ดโปรไฟล์ท้ายแถบข้าง (จอกว้างเท่านั้น) — อวตารตัวอักษรแรกจากอีเมลจริงถ้าล็อกอินแล้ว
  // ไม่ใช้ชื่อ/รูปสมมติ เพราะแอปยังไม่มีฟิลด์ชื่อเล่นให้ผู้ใช้กรอก
  const sfEmail = Cloud.signedIn() ? (Cloud.state.email || '') : '';
  const sfInitial = sfEmail ? sfEmail[0].toUpperCase() : '👤';
  const sidefoot = `<div class="sidefoot">
      <div class="sf-avatar">${sfInitial}</div>
      <div class="sf-info">
        <div class="sf-name">${sfEmail ? esc(sfEmail) : 'ยังไม่ได้เข้าสู่ระบบ'}</div>
        <div class="sf-sub">🔥 ${S.streak} วัน · ⭐ ${S.xp}</div>
      </div>
    </div>`;
  const active = activeTabId(r);
  $('#tabbar').innerHTML = sidehead + tabs.map(t =>
    `<button class="${t[0] === active ? 'on' : ''}" onclick="${t[3]}">
       <span class="ic">${t[1]}</span><span>${t[2]}</span></button>`).join('') + sidefoot;
}

/* ============ 7. บทเรียน ============ */
function isAlevelPath() {
  const g = (S.profile || {}).goal;
  return g === 'a_level' || !g;
}

function isTopicUnlocked(idx) {
  const topics = personalizedTopics();
  if (S.freeMode) return true;
  const t = topics[idx];
  if (!t) return false;
  if ((S.progress[t.id] || {}).stars) return true;
  if (planTopicIds().indexOf(t.id) >= 0) return true;
  if (!S.lastPretest && !S.studyPlan) return idx === 0;
  const done = ALEVEL_TOPICS.filter(x => (S.progress[x.id] || {}).stars).length;
  return idx < Math.max(3, done + 2);
}

function topicPct() {
  const n = ALEVEL_TOPICS.length;
  const done = ALEVEL_TOPICS.filter(t => (S.progress[t.id] || {}).stars > 0).length;
  return Math.round(done / n * 100);
}

function monthsUntilAlevel() {
  const extra = { m1: 5, m2: 4, m3: 3, m4: 2, m5: 1, m6: 0 }[userClassId()] || 0;
  const now = new Date();
  let y = now.getFullYear() + extra;
  let exam = new Date(y, 2, 15);
  if (exam < now) exam = new Date(y + 1, 2, 15);
  const months = Math.max(1, Math.round((exam - now) / (30.44 * 86400000)));
  return { months: months, exam: exam };
}

function prepPlanNote() {
  const left = ALEVEL_TOPICS.filter(t => !((S.progress[t.id] || {}).stars)).length;
  const { months } = monthsUntilAlevel();
  const days = Math.max(20, months * 20);
  const hours = Math.min(4, Math.max(0.5, Math.round((left * 1.5 / days) * 10) / 10));
  return { left: left, months: months, hours: hours };
}

function viewHome(app) {
  if (isAlevelPath()) return viewAlevelHome(app);
  return viewSchoolHome(app);
}

function viewAlevelHome(app) {
  const p = S.profile || {};
  const gLabel = goalLabel(p.goal);
  const dream = p.major ? (p.major + (p.university ? ' · ' + p.university : '')) : (gLabel || 'A-Level คณิต 1');
  const pct = topicPct();
  const recIds = appliedRecIds();
  const plan = prepPlanNote();
  const topics = personalizedTopics();
  const gaps = planTopicIds();
  const firstOpen = topics.findIndex((t, i) => isTopicUnlocked(i) && !((S.progress[t.id] || {}).stars));
  const current = topics[firstOpen < 0 ? 0 : firstOpen];
  const insert = gaps.map(alevelTopic).filter(t => t && !((S.progress[t.id] || {}).stars));
  const insertIds = {};
  insert.forEach(t => { insertIds[t.id] = true; });
  const rest = topics.filter(t => !insertIds[t.id]);

  const topicCard = t => {
    const i = topics.findIndex(x => x.id === t.id);
    const prog = S.progress[t.id] || { stars: 0, runs: 0 };
    const open = isTopicUnlocked(i);
    const rec = insertIds[t.id] || t.units.some(u => recIds.indexOf(u) >= 0);
    const n = t.units.reduce((s, id) => s + poolFor(id).length, 0);
    let state = 'locked', badge = 'ล็อกอยู่', cta = 'ล็อกอยู่';
    if (open && (prog.stars || prog.runs)) { state = 'done'; badge = 'ทบทวนคนละชุด'; cta = 'ทบทวน — ข้อใหม่รอบนี้'; }
    else if (open && i === (firstOpen < 0 ? 0 : firstOpen)) { state = 'current'; badge = rec ? 'แทรกให้คุณ' : 'กำลังเรียน'; cta = 'เรียนสรุป'; }
    else if (open) { state = ''; badge = rec ? 'แทรกให้คุณ' : 'ยังไม่เริ่ม'; cta = 'เรียนสรุป'; }
    const action = open ? `go('#/topic/${t.id}')` : `toast('เรียนหัวข้อที่แทรก/ก่อนหน้าให้ผ่านก่อน หรือทำ Pre-test เพื่อปลดล็อกจุดอ่อน')`;
    return `
      <button class="modcard ${state}${rec && !prog.stars ? ' insertcard' : ''}" onclick="${action}">
        <div class="mod-top">
          <span class="mod-ico">${open ? t.icon : '🔒'}</span>
          <span class="pill">${badge}${t.hard ? ' · ฝึกเยอะ' : ''}</span>
        </div>
        <h3>${esc(t.name)}</h3>
        <p class="cc-desc">${rec && !prog.stars ? 'แทรกจาก Pre-test — ปกติยังไม่ถึงบทนี้ · ' : ''}${esc((t.about || '').slice(0, 64))}${t.about && t.about.length > 64 ? '…' : ''} · ${n} ข้อฝึก</p>
        <div class="mod-foot">
          <div class="pbar"><i style="width:${Math.round((prog.stars || 0) / 3 * 100)}%"></i></div>
          <span class="${open ? 'btn sm' : 'btn ghost sm'}" style="width:100%;margin-top:8px">${cta}</span>
        </div>
      </button>`;
  };

  const gapBanner = insert.length
    ? `<div class="banner">แทรกบทที่ Pre-test ยังไม่ผ่าน (${insert.map(t => esc(t.name)).join(', ')})
         แม้บทนั้นจะไม่อยู่ต้นทางปกติ — <a href="#/planner" style="color:var(--pen-blue)">ดูแผน</a></div>`
    : `<div class="banner">ยังไม่มีแผนเฉพาะคุณ —
         <a href="#/pretest" style="color:var(--pen-blue)">ทำ Pre-test</a>
         เพื่อแทรกบทที่ยังไม่แม่น (เช่น พหุนาม) เข้าเส้นทาง</div>`;

  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['บทเรียน', null]])}
    <h1>ภาพรวมหลักสูตร</h1>
    <p class="sub">บทเรียนปรับตามคุณ · เส้นทางสู่${esc(dream)}</p>
    <div class="goalbanner">
      <div class="k">TARGET GOAL</div>
      <h2 style="margin:6px 0 4px">${esc(dream)}</h2>
      <p class="note">แต่ละบทเป็นสรุปเนื้อหา อ่านเองหรือเรียนกับ AI ได้ ทบทวนแต่ละรอบได้ข้อคนละชุด</p>
      <div class="row" style="align-items:center;margin-top:12px">
        <div class="pbar" style="flex:1"><i style="width:${pct}%"></i></div>
        <span class="note">${pct}%</span>
      </div>
      <p class="note" style="margin-top:8px">เหลือ ${plan.left} บท · ประมาณ ${plan.months} เดือนถึงสนาม ·
        ควรเข้าเรียนราว ${plan.hours} ชม./วัน</p>
      ${current ? `<button class="btn" style="margin-top:14px" onclick="go('#/topic/${current.id}')">เรียนต่อ</button>` : ''}
    </div>
    ${gapBanner}
    ${insert.length ? `<h2 class="strandlabel" style="margin-top:8px">แทรกให้คุณ — จาก Pre-test</h2>
      <p class="note" style="margin-bottom:10px">บทเหล่านี้ไม่ได้อยู่ต้นทางปกติ แต่ข้อในแบบทดสอบยังไม่ผ่าน จึงแทรกให้เรียนก่อน</p>
      <div class="modgrid">${insert.map(topicCard).join('')}</div>` : ''}
    <h2 class="strandlabel" style="margin-top:8px">ตามแผนของคุณ</h2>
    <div class="modgrid">${rest.map(topicCard).join('')}</div>
    <p class="note" style="margin-top:28px">Mock Test ในแท็บ Test สร้างข้อใหม่ตามโครงข้อสอบจริงในโฟลเดอร์ ไม่ก็อปข้อ ทปอ.</p>`;
}

function viewTopic(app, r) {
  const topic = alevelTopic(r.a);
  if (!topic) return viewHome(app);
  const strand = alevelStrand(topic.strand);
  const runs = (S.progress[topic.id] || {}).runs || 0;
  const check = topicCheckQuestion(topic, runs);
  const fig = topicFigure(topic);
  const figSvg = fig && typeof renderGeometrySVG === 'function' ? renderGeometrySVG(fig) : '';
  const cx = topicComplexity(topic);
  const terms = (topic.terms || []).slice();
  if (runs) terms.push(terms.shift());
  window._topicCheck = check;
  window._topicGraded = false;
  window._topicFollowup = false;
  window._topicId = topic.id;
  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['บทเรียน', '#/home'], [topic.name, null]])}
    <h1>${esc(topic.name)}</h1>
    <p class="sub"><span class="pill">${esc(strand ? strand.name : '')}</span>
      ${runs ? 'รอบที่ ' + (runs + 1) + ' — ข้อและจุดเน้นไม่ซ้ำรอบก่อน' : 'หัวข้อย่อยในสนาม A-Level คณิต 1'}</p>
    <div class="teachcard">
      <div class="k">เนื้อหา — ${esc(topic.name)} คืออะไร</div>
      <p>${esc(topic.about || '')}</p>
      ${(terms).map(tm => `<p class="teach-k">${esc(tm.name)}</p><p>${esc(tm.def)}</p>`).join('')}
      <p class="note">ความซับซ้อนโดยประมาณ: สาระ ${cx.majors} · หลัก ${cx.minors} · ประมาณ ${cx.steps} ขั้น
        ${topic.hard ? ' · จากข้อสอบปีหลังๆ ต้องฝึกเยอะ' : ''}</p>
    </div>
    ${figSvg ? `<div class="teachcard"><div class="k">รูปประกอบ</div>${figSvg}</div>` : ''}
    ${subLessonList(topic)}
    <p class="note" style="margin-top:12px">เรียนทีละหัวข้อย่อย แต่ละหัวข้อสอนเฉพาะเรื่องของตัวเอง
      จบครบแล้วจึงเปิดสอบท้ายบท</p>`;
  renderMath(app);
}

/* ---------- ฝึกหัวข้อย่อย 10–15 ข้อ + สอบท้ายบท ---------- */
const SUB_QUOTA = 12;        // ต้องทำครบก่อนถือว่าจบหัวข้อย่อย (อยู่ในช่วง 10–15)
const SUB_MIN = 10;          // ต่ำกว่านี้ไม่นับว่าจบ แม้จะทำครบชุดที่ออกได้
const TOPIC_TEST_LEN = 15;
const TOPIC_TEST_PASS = 60;  // เปอร์เซ็นต์ที่ถือว่าผ่านบท
const SUS_FAST_MS = 3000;    // ตอบเร็วกว่านี้ถือว่าเร็วผิดปกติ
let DRILL = null;
let DRILL_LOADING = false;
let DRILL_LAST = null;

function subDone(subId) { return !!subLessonState(subId).done; }

/** หัวข้อย่อยพื้นฐานต้องจบให้หมดก่อน ถึงจะเปิดข้อสอบท้ายบท */
function topicTestOpen(topic) {
  const base = (topicSubLessons(topic) || []).filter(s => s.tier === 1);
  return base.length > 0 && base.every(s => PersonalPath.complete(s.id));
}
function topicTestState(topicId) { return ((S.topicTests || {})[topicId]) || null; }

function viewDrill(app, r) {
  const topic = alevelTopic(r.a);
  if (!topic) return viewHome(app);
  if (!DRILL) {
    drillLoading(app);
    if (!DRILL_LOADING) startDrill(r.a, r.b);
    return;
  }
  if (DRILL.i >= DRILL.qs.length) return drillDone(app);
  drillQuestion(app);
}

function drillLoading(app) {
  app.innerHTML = `
    <div class="mockloading">
      <div class="spinner" aria-hidden="true"></div>
      <h2>กำลังจัดชุดโจทย์…</h2>
      <p class="note">คลังในเครื่องมีบทละไม่กี่ข้อ ที่เหลือให้ AI ออกใหม่</p>
      <button class="btn ghost sm" onclick="quitDrill()">ยกเลิก</button>
    </div>`;
}

async function startDrill(topicId, subKey) {
  DRILL_LOADING = true;
  const topic = alevelTopic(topicId);
  const isTest = subKey === '_test';
  const isTopicPractice = subKey === '_topic';
  const sub = (isTest || isTopicPractice) ? null
    : (topicSubLessons(topic) || []).find(s => s.id === decodeURIComponent(subKey || ''));
  const want = isTest ? TOPIC_TEST_LEN : SUB_QUOTA;
  try {
    let qs = [];
    (topic.units || []).forEach(u => { qs = qs.concat(poolFor(u)); });
    qs = shuffle(qs);
    if (qs.length < want && Cloud.signedIn()) {
      try {
        const ai = await fetchAiTopicQuestions(topic, sub, want - qs.length, qs.map(q => q.q));
        if (ai && ai.length) qs = qs.concat(ai);
      } catch (e) { /* ออกข้อเพิ่มไม่ได้ก็ใช้เท่าที่มี แล้วบอกตรงๆ ตอนสรุปผล */ }
    }
    DRILL = {
      kind: isTest ? 'test' : isTopicPractice ? 'practice' : 'sub',
      topicId: topicId, subId: sub ? sub.id : null, subName: sub ? sub.name : null,
      want: want, qs: qs.slice(0, want), i: 0, marks: [], answered: false, sel: null,
      startedAt: Date.now(), qAt: Date.now(),
      sus: { blurs: 0, pastes: 0, fast: 0 }
    };
    susWatch(true);
  } finally {
    DRILL_LOADING = false;
  }
  render();
}

/** จับพฤติกรรมที่ทำให้คะแนนไม่สะท้อนความสามารถจริง — สลับหน้าจอ วางข้อความ ตอบเร็วผิดปกติ
    ไม่บล็อกอะไร แค่บันทึกไว้เตือนตอนสรุปผล */
function susWatch(on) {
  if (window._susOff) { window._susOff(); window._susOff = null; }
  if (!on) return;
  // ใช้ทั้งตอนฝึก (DRILL) และตอนสอบจริง (MOCK) — ตัวไหนกำลังทำอยู่ก็นับตัวนั้น
  const tgt = () => (DRILL && DRILL.sus) ? DRILL : ((MOCK && MOCK.sus) ? MOCK : null);
  const onBlur = () => { const d = tgt(); if (d) d.sus.blurs++; };
  const onVis = () => { const d = tgt(); if (d && document.hidden) d.sus.blurs++; };
  const onPaste = () => { const d = tgt(); if (d) d.sus.pastes++; };
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  document.addEventListener('paste', onPaste);
  window._susOff = () => {
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
    document.removeEventListener('paste', onPaste);
  };
}

function susVerdict(d) {
  const reasons = [];
  if (d.sus.blurs >= 2) reasons.push('สลับออกจากหน้าจอระหว่างทำ ' + d.sus.blurs + ' ครั้ง');
  if (d.sus.pastes >= 1) reasons.push('วางข้อความจากที่อื่น ' + d.sus.pastes + ' ครั้ง');
  const fastLimit = Math.max(3, Math.ceil(d.qs.length * 0.4));
  if (d.sus.fast >= fastLimit) reasons.push('ตอบเร็วกว่า 3 วินาที ' + d.sus.fast + ' ข้อ');
  return { flag: reasons.length > 0, reasons: reasons };
}

function drillQuestion(app) {
  const q = DRILL.qs[DRILL.i];
  const topic = alevelTopic(DRILL.topicId);
  const pct = DRILL.i / DRILL.qs.length * 100;
  const THAI_LABELS = ['ก.', 'ข.', 'ค.', 'ง.', 'จ.'];
  const head = DRILL.kind === 'test' ? 'สอบท้ายบท ' + topic.name : (DRILL.subName || '');
  DRILL.qAt = Date.now();
  app.innerHTML = `
    ${breadcrumb([['บทเรียน', '#/home'], [topic.name, '#/topic/' + topic.id], [DRILL.kind === 'test' ? 'สอบท้ายบท' : 'ฝึก', null]])}
    <div class="row" style="align-items:center;margin-bottom:12px">
      <button class="backbtn" onclick="quitDrill()" aria-label="ออก">✕</button>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <span class="pill">${DRILL.i + 1}/${DRILL.qs.length}</span>
    </div>
    <p class="note">${esc(head)}${DRILL.kind === 'test' ? ' · ผ่านที่ ' + TOPIC_TEST_PASS + '%' : ''}${q._ai ? ' · ข้อสร้างโดย AI' : ''}</p>
    <div class="qcard">
      <p class="qtext">${esc(q.q)}</p>
      ${q.t === 'mc' && q.c && q.c.length
        ? `<div class="choices">${q.c.map((c, i) =>
            `<button class="choice" id="dch${i}" data-label="${THAI_LABELS[i] || (i + 1) + '.'}"
              onclick="drillPick(${i})"><span>${esc(c)}</span></button>`).join('')}</div>`
        : `<input type="text" id="dAns" inputmode="decimal" placeholder="พิมพ์คำตอบ">`}
    </div>
    <button class="btn" onclick="drillSubmit()">ตรวจ / ข้อถัดไป</button>`;
  renderMath(app);
}

function reportDrillQuestion(button) {
  if (!DRILL || !DRILL.answered || button.disabled) return;
  const q=DRILL.qs[DRILL.i]; DRILL.marks[DRILL.i]=null;
  const data=Learning.data(); data.reports.push({id:crypto.randomUUID(),topic:DRILL.topicId,question:q.q,answer:q.a,at:Date.now()});Learning.save(data);Learning.sync();
  button.disabled=true;button.textContent='บันทึกปัญหาแล้ว · ไม่นับข้อนี้';
}

function drillPick(i) {
  if (DRILL.answered) return;
  const q = DRILL.qs[DRILL.i];
  if (!(q.c && q.c.length)) return;
  DRILL.sel = i;
  q.c.forEach((_, k) => { const el = $('#dch' + k); if (el) el.classList.toggle('sel', k === i); });
}

function drillSubmit() {
  if (DRILL.answered) return drillNext();
  const q = DRILL.qs[DRILL.i];
  const isMc = q.t === 'mc' && q.c && q.c.length;
  const given = isMc ? DRILL.sel : (($('#dAns') && $('#dAns').value) || '');
  if (given === null || given === '') return toast('ยังไม่ได้ตอบ');
  if (Date.now() - DRILL.qAt < SUS_FAST_MS) DRILL.sus.fast++;
  DRILL.answered = true;
  const ok = isCorrect(q, given);
  DRILL.marks.push(q._ai || q._unverified ? null : ok);
  if (isMc) {
    const sel = $('#dch' + DRILL.sel);
    if (sel) sel.classList.add(ok ? 'ok' : 'bad');
    if (!ok) { const right = $('#dch' + q.a); if (right) right.classList.add('ok'); }
  }
  toast(ok ? 'ถูกต้อง' : 'ยังไม่ถูก');
  const feedback = document.createElement('div'); feedback.className='teachcard';
  feedback.innerHTML = `<p>${q._ai || q._unverified ? 'คำตอบอ้างอิงยังไม่ได้ตรวจรับรอง · ข้อนี้ไม่นับเพิ่มความคืบหน้า' : (ok ? 'ถูกต้อง' : 'ทบทวนวิธีคิดก่อนข้อถัดไป')}</p><p>${esc(q.s || 'ยังไม่มีคำอธิบายสำหรับข้อนี้')}</p><button class="btn ghost sm" onclick="reportDrillQuestion(this)">โจทย์หรือเฉลยมีปัญหา · ไม่นับข้อนี้</button><button class="btn" onclick="drillNext()">ข้อถัดไป</button>`;
  $('#app').appendChild(feedback); renderMath(feedback);
}

function drillNext() {
  if (!DRILL || !DRILL.answered) return;
  DRILL.i++; DRILL.answered = false; DRILL.sel = null;
  render();
}

function quitDrill() {
  const t = DRILL ? DRILL.topicId : null;
  susWatch(false);
  DRILL = null;
  go(t ? '#/topic/' + t : '#/home');
}

function drillDone(app) {
  susWatch(false);
  const d = DRILL;
  const topic = alevelTopic(d.topicId);
  const total = d.marks.filter(m => typeof m === 'boolean').length;
  const right = d.marks.filter(Boolean).length;
  const pct = total ? Math.round(right / total * 100) : 0;
  const sus = susVerdict(d);
  const short = total < SUB_MIN;
  let verdict = '';

  if (d.kind === 'practice') {
    // ฝึกทั้งบทจากแผน ไม่ผูกกับหัวข้อย่อยไหน จึงไม่ไปติ๊กว่าหัวข้อย่อยจบ
    S.xp += right * 2;
    verdict = `<div class="banner">ฝึกทั้งบทจบรอบนี้ ${right}/${total} ข้อ — ถ้าจะปิดหัวข้อย่อย ให้กดฝึกจากหน้าบท</div>`;
  } else if (d.kind === 'sub') {
    // ต้องได้ครบ 10 ข้อขึ้นไปถึงนับว่าจบหัวข้อย่อย ถ้าออกข้อไม่ครบก็บอกตรงๆ ไม่ปลอมให้ผ่าน
    const prev = subLessonState(d.subId);
    S.subProgress = Object.assign({}, S.subProgress);
    S.subProgress[d.subId] = {
      runs: prev.runs || 0,
      answered: total,
      best: Math.max(prev.best || 0, pct),
      done: prev.practicePassed || (!short && pct >= 80),
      practicePassed: prev.practicePassed || (!short && pct >= 80),
      at: new Date().toISOString()
    };
    S.xp += right * 2;
    verdict = short
      ? `<div class="banner">ออกโจทย์ได้ ${total} ข้อ ยังไม่ถึง ${SUB_MIN} ข้อ จึงยังไม่นับว่าจบหัวข้อย่อยนี้ — ลองใหม่ตอนเข้าสู่ระบบ ระบบจะให้ AI ออกข้อเพิ่ม</div>`
      : `<div class="banner">รอบฝึก ${right}/${total} ข้อ · ${pct >= 80 ? 'ผ่านรอบฝึก' : 'ทบทวนแล้วลองใหม่ เป้าหมาย 80%'} · ตรวจความจำในแผนวันนี้แยกจากการจบรอบฝึก</div>`;
  } else {
    const pass = total >= SUB_MIN && pct >= TOPIC_TEST_PASS;
    S.topicTests = Object.assign({}, S.topicTests);
    S.topicTests[d.topicId] = { pct: pct, pass: pass, at: new Date().toISOString(), sus: sus.flag };
    if (pass) {
      const prev = S.progress[d.topicId] || { stars: 0, best: 0, runs: 0 };
      S.progress[d.topicId] = {
        stars: Math.max(prev.stars || 0, pct >= 90 ? 3 : pct >= 75 ? 2 : 1),
        best: Math.max(prev.best || 0, pct),
        runs: (prev.runs || 0) + 1
      };
      S.xp += 40;
    }
    verdict = pass
      ? '<div class="banner">ผ่านบทนี้แล้ว — ชั้นที่ยากขึ้นในบทนี้เปิดให้เรียนต่อ</div>'
      : `<div class="banner">ยังไม่ผ่าน ต้องได้ ${TOPIC_TEST_PASS}% ขึ้นไป ทบทวนหัวข้อย่อยแล้วสอบใหม่ได้</div>`;
  }
  boardAddSession(d.startedAt, total);
  save();

  // ทำไม่ผ่านแปลว่ามีรูรั่วที่หัวข้อย่อยเดิมยังอุดไม่ได้
  // ให้ AI แตกหัวข้อที่เล็กลงจากจุดที่พลาดจริง แล้วเติมเข้ารายการของบทนี้
  if (!short && pct < 60 && topic && typeof proposeRemedialSubs === 'function') {
    const missed = (d.answers || []).filter(a => a && !a.ok)
      .map(a => (a.skill || a.topic || '')).filter(Boolean);
    proposeRemedialSubs(topic, d.subName || (topic && topic.name), missed)
      .then(added => {
        if (added && added.length) {
          toast('AI เพิ่มหัวข้อซ่อมเสริมให้ ' + added.length + ' หัวข้อ: ' + added[0].name);
          if (location.hash.indexOf('#/topic/') === 0) render();
        }
      })
      .catch(() => { /* เสนอไม่ได้ก็ไม่กระทบผลสอบ */ });
  }
  DRILL_LAST = { topicId: d.topicId, key: d.kind === 'test' ? '_test' : encodeURIComponent(d.subId) };

  app.innerHTML = `
    ${breadcrumb([['บทเรียน', '#/home'], [topic.name, '#/topic/' + topic.id], ['ผล', null]])}
    <h1>${d.kind === 'test' ? 'ผลสอบท้ายบท' : d.kind === 'practice' ? 'จบรอบฝึกทั้งบท' : 'จบรอบฝึก'}</h1>
    <p class="sub">${esc(topic.name)}${d.subName ? ' · ' + esc(d.subName) : ''}</p>
    <div class="scorecircle ${pct >= TOPIC_TEST_PASS ? 'hi' : ''}"><span>${pct}</span></div>
    <p class="sub" style="text-align:center">${right}/${total} ข้อ</p>
    ${verdict}
    ${sus.flag ? `<div class="banner" style="margin-top:10px">
      พฤติกรรมที่ระบบเห็นรอบนี้: ${esc(sus.reasons.join(' · '))}<br>
      ใช้เป็นบันทึกบริบทเท่านั้น ไม่ใช่ข้อสรุปว่าทุจริตหรือใช้ทำนายคะแนนสอบ
    </div>` : ''}
    <div style="height:12px"></div>
    <button class="btn" onclick="DRILL=null; go('#/topic/${d.topicId}')">กลับหน้าบท</button>
    <div style="height:10px"></div>
    <button class="btn ghost" onclick="retryDrill()">ทำอีกรอบ</button>`;
  DRILL = null;
}

function retryDrill() {
  if (!DRILL_LAST) return go('#/home');
  goDrill('#/drill/' + DRILL_LAST.topicId + '/' + DRILL_LAST.key);
}

/** หัวข้อย่อยในบท — ชั้นพื้นฐานเปิดหมด ชั้นยากขึ้นปลดตามผลงาน
    หัวข้อที่เคยเรียนแล้วติดป้ายทบทวน จะได้รู้ว่าเคยผ่านอันไหนมาแล้ว */
function subLessonList(topic) {
  const subs = typeof topicSubLessons === 'function' ? topicSubLessons(topic) : [];
  if (!subs.length) return '';
  const tierName = { 1: 'เส้นทางหลัก', 2: 'เสริม: ยากขึ้น', 3: 'เสริม: แข่งขัน' };
  const rows = subs.map(s => {
    const st = subLessonState(s.id);
    const taught = (st.runs || 0) > 0;
    const fin = PersonalPath.complete(s.id);
    const quota = fin ? 'กิจกรรมครบแล้ว · ผลสอบวัดแยกต่างหาก'
      : st.answered ? 'ทำไป ' + st.answered + '/' + SUB_QUOTA + ' ข้อ'
      : 'รอบฝึกเป้าหมาย 80% · ไม่เท่ากับความชำนาญทั้งบท';
    return `<div class="subrow${s.open ? '' : ' locked'}">
      <button class="topicrow" onclick="startSubLesson('${topic.id}','${s.id}')">
        <span>
          <span class="t">${fin ? '✓ ' : ''}${esc(s.name)}${taught ? ' · ทบทวน' : ''}</span>
          <span class="d">${esc(tierName[s.tier] || '')} · ${esc(s.open ? quota : (s.needs || 'ยังไม่ปลด'))}${st.best ? ' · ดีสุด ' + st.best + '%' : ''}</span>
        </span>
        <span class="go">${s.open ? (taught ? 'ทบทวน' : 'เรียน') : '🔒'}</span>
      </button>
      ${s.open ? `<button class="btn ghost sm subdrill" onclick="startSubDrill('${topic.id}','${s.id}')">ฝึก ${SUB_QUOTA} ข้อ</button>` : ''}
    </div>`;
  }).join('');
  const tt = topicTestState(topic.id);
  const testOpen = topicTestOpen(topic);
  const testRow = `<div class="subrow${testOpen ? '' : ' locked'}">
    <button class="topicrow" onclick="startTopicTest('${topic.id}')">
      <span>
        <span class="t">${tt && tt.pass ? '✓ ' : ''}สอบท้ายบท — ${esc(topic.name)}</span>
        <span class="d">${TOPIC_TEST_LEN} ข้อ · ผ่านที่ ${TOPIC_TEST_PASS}%${tt ? ' · ครั้งล่าสุด ' + tt.pct + '%' : ''}${testOpen ? '' : ' · ต้องจบหัวข้อย่อยพื้นฐานให้ครบก่อน'}</span>
      </span>
      <span class="go">${testOpen ? (tt && tt.pass ? 'สอบใหม่' : 'สอบ') : '🔒'}</span>
    </button>
  </div>`;
  return `<div class="teachcard">
    <div class="k">เส้นทางหัวข้อย่อย · ${subs.filter(s=>s.tier===1 && PersonalPath.complete(s.id)).length}/${subs.filter(s=>s.tier===1).length} กิจกรรมครบ</div>
    <p class="note" style="margin-bottom:10px">เรียนทีละหัวข้อ: อธิบาย → ตัวอย่าง → ฝึกมีคำใบ้ → ลองตอบเอง 3 ครั้ง → สรุป · ครบกิจกรรมเพื่อเปิดหัวข้อถัดไป คะแนนและความชำนาญวัดแยกต่างหาก</p>
    ${rows}
    ${testRow}
  </div>`;
}

/** ไปหน้าฝึก/สอบ — ถ้าอยู่ URL เดิมอยู่แล้ว hash ไม่เปลี่ยน จึงต้องสั่ง render เอง
    ไม่งั้นกด "ทำอีกรอบ" จากหน้าผลจะค้างอยู่หน้าเดิม */
function goDrill(hash) {
  DRILL = null;
  if (location.hash === hash) return render();
  go(hash);
}

function startSubDrill(topicId, subId) {
  const topic = alevelTopic(topicId);
  const s = topic && (topicSubLessons(topic) || []).find(x => x.id === subId);
  if (!s) return;
  if (!s.open) return toast(s.needs ? 'ยังไม่ปลด — ' + s.needs : 'ยังไม่ปลดหัวข้อนี้');
  goDrill('#/drill/' + topicId + '/' + encodeURIComponent(subId));
}

function startTopicTest(topicId) {
  const topic = alevelTopic(topicId);
  if (!topic) return;
  if (!topicTestOpen(topic)) return toast('ต้องทำหัวข้อย่อยพื้นฐานให้จบครบก่อน');
  goDrill('#/drill/' + topicId + '/_test');
}

function startSubLesson(topicId, subId) {
  const topic = alevelTopic(topicId);
  if (!topic) return;
  const s = (topicSubLessons(topic) || []).find(x => x.id === subId);
  if (!s) return;
  if (!s.open) return toast(s.needs ? 'ยังไม่ปลด — ' + s.needs : 'ยังไม่ปลดหัวข้อนี้');
  if (!Cloud.signedIn()) return go('#/auth/signin');
  const prev = (S.subProgress || {})[subId] || { runs: 0 };
  S.subProgress = Object.assign({}, S.subProgress);
  S.subProgress[subId] = Object.assign({}, prev, { runs: (prev.runs || 0) + 1, at: new Date().toISOString() });
  save();
  startTutorLesson(topic.units[0], topic.id, s);
}

function startTopicAi(topicId) {
  const topic = alevelTopic(topicId);
  if (!topic) return;
  if (!Cloud.signedIn()) return go('#/auth/signin');
  startTutorLesson(topic.units[0], topic.id);
}

/** อ่านจบแล้วยังไม่ถือว่าจบบท — ต้องผ่านข้อสอบท้ายบทก่อน
    ปุ่มนี้จึงบันทึกแค่ว่าอ่านแล้ว แล้วพาไปสอบ */
function completeTopicByReading(topicId) {
  const topic = alevelTopic(topicId);
  S.xp += 5;
  save();
  if (topic && topicTestOpen(topic)) {
    toast('อ่านจบแล้ว +5 XP — ไปสอบท้ายบทเพื่อปิดบทนี้');
    return startTopicTest(topicId);
  }
  toast('อ่านจบแล้ว +5 XP — ทำหัวข้อย่อยให้ครบก่อน แล้วจึงสอบท้ายบท');
  go('#/topic/' + topicId);
}

function topicQuizInner(check) {
  const q = check.q;
  if (q.t === 'mc') {
    return `<p class="teachq">${esc(q.q)}</p>
      <div class="choices">${q.c.map((c, i) =>
        `<button class="choice" data-label="${['ก.','ข.','ค.','ง.','จ.'][i] || (i+1)+'.'}"
          onclick="gradeTopicCheck(${i})"><span>${esc(c)}</span></button>`).join('')}</div>`;
  }
  return `<p class="teachq">${esc(q.q)}</p>
    <input type="text" id="topicAns" inputmode="decimal" placeholder="พิมพ์คำตอบ">
    <div style="height:10px"></div>
    <button class="btn" onclick="gradeTopicCheck()">ตรวจ</button>`;
}

function gradeTopicCheck(sel) {
  const check = window._topicCheck;
  if (!check || window._topicGraded) return;
  const q = check.q;
  const given = q.t === 'mc' ? sel : (($('#topicAns') && $('#topicAns').value) || '');
  if (q.t === 'mc' && (given === null || given === undefined || given === '')) return;
  if (q.t !== 'mc' && given === '') return toast('ยังไม่ได้ตอบ');
  const ok = isCorrect(q, given);
  window._topicGraded = true;
  const box = $('#topicVerdict');
  const correct = q.t === 'mc' ? q.c[q.a] : String(q.a);
  if (q.t === 'mc') {
    document.querySelectorAll('#topicQuiz .choice').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.a) btn.classList.add('ok');
      if (i === given && !ok) btn.classList.add('bad');
    });
  }
  if (box) box.innerHTML = `<p class="${ok ? 'ok' : ''}" style="margin-top:12px">${ok ? 'ถูกต้อง' : 'ยังไม่ถูก — คำตอบคือ ' + esc(String(correct))}${q.s ? ' · ' + esc(q.s) : ''}</p>`;
  const topicId = window._topicId || alevelTopicIdFromCheck(check);
  const prev = S.progress[topicId] || { stars: 0, best: 0, runs: 0 };
  S.progress[topicId] = {
    stars: Math.max(prev.stars || 0, ok ? 1 : 0),
    best: Math.max(prev.best || 0, ok ? 100 : 0),
    runs: (prev.runs || 0) + 1
  };
  if (ok) S.xp += 10;
  save();
  const topic = alevelTopic(topicId);
  const next = topic && !window._topicFollowup ? topicCheckQuestion(topic, (check.idx || 0) + 1) : null;
  if (ok && next) {
    window._topicFollowup = true;
    window._topicCheck = next;
    window._topicGraded = false;
    if (box) box.innerHTML += `<p class="note" style="margin-top:14px">ข้อถัดไป — ตรวจอีกครั้ง</p>`;
    const body = $('#topicQBody');
    if (body) { body.innerHTML = topicQuizInner(next); renderMath(body); }
  }
}

function alevelTopicIdFromCheck(check) {
  const t = ALEVEL_TOPICS.find(x => x.units.indexOf(check.unit.id) >= 0);
  return t ? t.id : check.unit.id;
}

function viewSchoolHome(app) {
  const track = personalizedTrack();
  if (!track.length) return;
  const p = S.profile || {};
  const gLabel = goalLabel(p.goal);
  const know = understandingLabel();
  const recIds = appliedRecIds();
  const pct = trackPct();
  const currentIdx = currentTrackIndex();
  const current = track[currentIdx];
  const lp = S.lastPretest;
  const dream = p.goal === 'a_level' && p.major
    ? (p.major + (p.university ? ' · ' + p.university : ''))
    : (gLabel || 'คณิตศาสตร์สู่เป้าหมาย');

  const extraShow = insertedTrackUnits().filter(f => !(S.progress[f.unit.id] || {}).stars);
  const extraIds = {};
  extraShow.forEach(f => { extraIds[f.unit.id] = true; });

  const strands = [];
  track.forEach(f => { if (!extraIds[f.unit.id] && strands.indexOf(f.unit.strand) < 0) strands.push(f.unit.strand); });

  const unitCard = (f, i) => {
    const u = f.unit;
    const prog = S.progress[u.id] || { stars: 0, runs: 0 };
    const open = isTrackUnlocked(i);
    const rec = recIds.indexOf(u.id) >= 0 || extraIds[u.id];
    const n = poolFor(u.id).length;
    const unitPct = Math.round((prog.stars / 3) * 100);
    const harder = (prog.runs || 0) > 0 || (prog.stars || 0) > 0;
    let state = 'locked', badge = 'ล็อกอยู่', cta = 'ล็อกอยู่';
    if (open && harder) { state = 'done'; badge = 'ทบทวนยากขึ้น'; cta = 'ทบทวนยากขึ้น'; }
    else if (open && i === currentIdx) { state = 'current'; badge = rec ? 'แทรกให้คุณ' : 'กำลังเรียน'; cta = 'เรียนต่อ'; }
    else if (open) { state = ''; badge = rec ? 'แทรกให้คุณ' : 'ยังไม่เริ่ม'; cta = 'เริ่มเรียน'; }
    const action = open
      ? `go('#/lesson/${u.id}')`
      : `toast('ทำหน่วยที่แทรก/ก่อนหน้าให้ผ่านก่อน หรือเปิดโหมดเรียนอิสระที่หน้าตั้งค่า')`;
    const lvShort = CURRICULUM[f.levelId] ? CURRICULUM[f.levelId].short : '';
    return `
      <button class="modcard ${state}${rec && !harder ? ' insertcard' : ''}" onclick="${action}">
        <div class="mod-top">
          <span class="mod-ico">${open ? u.icon : '🔒'}</span>
          <span class="pill">${badge}</span>
        </div>
        <h3>${esc(u.name)}</h3>
        <p class="cc-desc">${lvShort} · ${n} ข้อในคลัง${rec ? ' · แทรกจาก Pre-test' : ''}${harder ? ' · รอบถัดไปยากขึ้น' : ''}</p>
        <div class="mod-foot">
          <div class="pbar"><i style="width:${unitPct}%"></i></div>
          <span class="note">${prog.stars ? '⭐'.repeat(prog.stars) + '☆'.repeat(3 - prog.stars) : (open ? '0%' : '')}</span>
          <span class="${open ? (state === 'current' ? 'btn sm' : 'btn ghost sm') : 'btn ghost sm'}"
            style="width:100%;margin-top:8px">${cta}</span>
        </div>
      </button>`;
  };

  const cardsFor = strand => track.map((f, i) => {
    if (extraIds[f.unit.id] || f.unit.strand !== strand) return '';
    return unitCard(f, i);
  }).join('');

  const recNote = extraShow.length
    ? `<div class="banner">แทรกหน่วยที่ Pre-test ยังไม่ผ่าน แม้ไม่อยู่บนเส้นทางปกติของชั้น/คณะนี้
         (${extraShow.map(f => esc(f.unit.name)).join(', ')})</div>`
    : recIds.length
    ? `<div class="banner">จัดเส้นทางตามผลแบบทดสอบแล้ว — หน่วยที่แนะนำอยู่บนเส้นทางสู่เป้าหมาย</div>`
    : lp && S.pretestApplied === false
      ? `<div class="banner">คุณเลือกจัดเส้นทางเอง — เดินตามหน่วยบนเส้นทางเป้าหมายจากง่ายไปยาก</div>`
      : `<div class="banner">ยังไม่มีผลประเมินความรู้
           <a href="#/pretest" style="color:var(--pen-blue)">ทำ Pre-test</a>
           เพื่อแทรกบทที่ยังไม่แม่น (เช่น พหุนาม) เข้าเส้นทาง</div>`;

  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['บทเรียน', null]])}
    <h1>ภาพรวมหลักสูตร</h1>
    <p class="sub">เส้นทางสู่${esc(dream)}${know ? ' · ประเมินว่า' + esc(know) : ''}</p>

    <div class="goalbanner">
      <div class="k">TARGET GOAL</div>
      <h2 style="margin:6px 0 4px">${esc(dream)}</h2>
      <p class="note">${p.goal === 'a_level'
        ? 'หน่วยเรียงตามคณะที่อยากเข้า ข้ามชั้นได้ (เช่น พีทาโกรัส) ไม่ได้ล็อกตามห้องเรียน — ทบทวนแต่ละหน่วยจะยากขึ้น'
        : p.goal === 'school'
          ? 'จากชั้นปัจจุบันไต่ไปเนื้อหายากขึ้น เพื่อเกรดในห้อง ไม่ได้หยุดแค่หน่วยของเทอมนี้'
          : 'เส้นทางข้ามชั้นจากง่ายไปยาก รวมพีทาโกรัส — ตั้ง A-Level + คณะที่ตั้งค่าเพื่อจัดตามความฝัน'}</p>
      <div class="row" style="align-items:center;margin-top:12px">
        <div class="pbar" style="flex:1"><i style="width:${pct}%"></i></div>
        <span class="note" style="flex:0 0 auto">${pct}%</span>
      </div>
      ${current ? `<button class="btn" style="margin-top:14px" onclick="go('#/lesson/${current.unit.id}')">${pct === 100 ? 'ทบทวนยากขึ้น' : 'เรียนต่อ'}</button>` : ''}
    </div>

    ${recNote}

    ${extraShow.length ? `<h2 class="strandlabel" style="margin-top:8px">แทรกให้คุณ — จาก Pre-test</h2>
      <p class="note" style="margin-bottom:10px">หน่วยเหล่านี้ไม่อยู่บนเส้นทางปกติ แต่ข้อสอบชี้ว่ายังไม่ผ่าน</p>
      <div class="modgrid">${extraShow.map(f => unitCard(f, track.findIndex(x => x.unit.id === f.unit.id))).join('')}</div>` : ''}

    <div class="row" style="margin:14px 0">
      <button class="btn ghost sm" onclick="go('#/bank')">📚 คลังโจทย์ของฉัน</button>
      <button class="btn ghost sm" onclick="go('#/upload')">➕ เพิ่มโจทย์</button>
    </div>

    ${strands.map(s => `
      <h2 class="strandlabel" style="margin-top:8px">${esc(s)}</h2>
      <div class="modgrid">${cardsFor(s)}</div>
    `).join('')}

    <p class="note" style="margin-top:28px">เปลี่ยนมหาวิทยาลัยหรือคณะได้ที่หน้าตั้งค่า — เส้นทางบทเรียนจะจัดใหม่ตามเป้าหมาย</p>`;
}
function pickLevel(id) {
  S.level = id; save();
  if (route().name === 'home') render();
  else go('#/home');
}

/* ============ 8. หน้าแผนที่บทเรียน ============
   แผนที่เก่า (#/path) เป็นดีไซน์ซ้ำกับหน้าบทเรียน — ส่งกลับไปหลักสูตรส่วนตัวเสมอ */
function viewPath(app) {
  if (location.hash !== '#/home') return go('#/home');
  viewHome(app);
}

/* ============ 9. บทเรียน ============ */
let LESSON = null;

function viewLesson(app, r) {
  const found = findUnit(r.a);
  if (!found) return viewHome(app);
  // โหมดทดลองหมดโควตา -> ชวนสมัครก่อนทำต่อ
  if (trialLeft() === 0) return viewGate(app);
  // ยังไม่ได้เริ่มควิซคลัง → แสดงว่าหน่วยนี้สอนอะไร แล้วเข้าโหมดติวเตอร์ AI
  if (!LESSON || LESSON.unitId !== r.a) return lessonIntro(app, found.unit);
  if (LESSON.i >= LESSON.qs.length) return lessonDone(app, found.unit);
  renderQuestion(app, found.unit);
}

/** เรียงโจทย์ในหน่วยให้ง่ายก่อน (ตัวเลขสั้น / ตัวเลข / ปรนัย) — ใช้ทั้งหน้าสอนและข้อแรกของติวเตอร์ */
function easiestQuestions(unit) {
  const qs = (unit.q || []).slice();
  qs.sort((a, b) => {
    const rank = q => {
      let r = (q.t === 'num' && q.v) ? 0 : (q.t === 'num' ? 1 : 2);
      if (typeof isDependentStem === 'function' && isDependentStem(q)) r += 10;
      return r;
    };
    return rank(a) - rank(b);
  });
  return qs;
}

function lessonIntro(app, unit) {
  const pool = poolFor(unit.id);
  const stems = easiestQuestions(unit).map(q => q.q).filter(Boolean);
  const topics = [];
  stems.forEach(s => { if (topics.indexOf(s) < 0) topics.push(s); });
  const preview = topics.slice(0, 4);
  const starter = preview[0] || '';
  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['บทเรียน', '#/home'], [unit.name, null]])}
    <h1>${esc(unit.name)}</h1>
    <p class="sub"><span class="pill">${esc(unit.strand)}</span> ${pool.length} ข้อในคลัง</p>
    ${trialBar()}
    ${S.hearts === 0 ? `<div class="banner">หัวใจหมด — ยังฝึกต่อได้ แต่จะไม่ได้รับคะแนนจนกว่าหัวใจจะฟื้น (1 ดวงทุก 10 นาที)</div>` : ''}
    <div class="teachcard">
      <div class="k">หน่วยนี้สอนอะไร</div>
      <p>ฝึกเรื่อง <b>${esc(unit.name)}</b> ในสาระ ${esc(unit.strand)} จากโจทย์จริงในคลัง ไม่แต่งเนื้อหาเพิ่ม</p>
      ${preview.length ? `<p class="teach-k">ตัวอย่างที่จะได้ฝึก</p>
        <ul class="teachlist">${preview.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${starter ? `<p class="teach-k">ข้อแรกที่จะเริ่ม (ข้อง่าย)</p>
        <div class="teachq">${esc(starter)}</div>` : ''}
    </div>
    <button class="btn" onclick="startTutorLesson('${unit.id}')">${
      ((S.progress[unit.id] || {}).runs || (S.progress[unit.id] || {}).stars) ? 'ทบทวนรอบที่ยากขึ้น' : 'เริ่มเรียนกับติวเตอร์ AI'
    }</button>
    <p class="note" style="margin-top:14px">
      ${((S.progress[unit.id] || {}).runs || (S.progress[unit.id] || {}).stars)
        ? 'เคยฝึกหน่วยนี้แล้ว รอบนี้ติวเตอร์จะเริ่มยากขึ้น แล้วยากกว่าเดิมอีกเมื่อตอบถูก'
        : 'ติวเตอร์จะอธิบายสั้นๆ จากเนื้อหาด้านบน แล้วออกโจทย์ง่ายข้อแรกให้ตอบ พิมพ์หรือพูดก็ได้ ต้องมีบัญชี'}</p>`;
  renderMath(app);
}

function startLesson(unitId, mode) {
  const pool = poolFor(unitId);
  LESSON = { unitId: unitId, mode: mode || 'quiz', qs: shuffle(pool).slice(0, 8),
             i: 0, right: 0, answered: false, sel: null, marks: [] };
  render();
}

function renderQuestion(app, unit) {
  const q = LESSON.qs[LESSON.i];
  const pct = LESSON.i / LESSON.qs.length * 100;
  const head = `
    <div class="row" style="align-items:center;margin-bottom:18px">
      <button class="backbtn" onclick="quitLesson()" aria-label="ออกจากบทเรียน">✕</button>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <span class="stat heart">❤️ ${S.hearts}</span>
    </div>`;

  const THAI_LABELS = ['ก.', 'ข.', 'ค.', 'ง.', 'จ.'];
  const body = q.t === 'mc'
    ? `<div class="${choiceGridClass(q)}">${q.c.map((c, i) =>
        `<button class="choice" id="ch${i}" data-label="${THAI_LABELS[i] || (i + 1) + '.'}"
           onclick="pickChoice(${i})"><span>${esc(c)}</span></button>`).join('')}</div>`
    : `<input type="text" id="ans" inputmode="decimal" autocomplete="off"
         placeholder="พิมพ์คำตอบ" onkeydown="if(event.key==='Enter')submitAnswer()">`;

  app.innerHTML = head + `
    <div class="qcard">
      <div class="qtext">${esc(q.q)}</div>
      ${imgTag(q)}
      ${q.own ? `<span class="pill" style="margin-top:12px;display:inline-block">โจทย์ของคุณ</span>` : ''}
    </div>
    ${body}
    <div style="height:14px"></div>
    <button class="btn" id="go" onclick="submitAnswer()">ตรวจคำตอบ</button>`;
  renderMath(app);
  if (q.t === 'num') setTimeout(() => { const el = $('#ans'); if (el) el.focus(); }, 60);
}

function pickChoice(i) {
  if (LESSON.answered) return;
  LESSON.sel = i;
  LESSON.qs[LESSON.i].c.forEach((_, k) => $('#ch' + k).classList.toggle('sel', k === i));
}

function submitAnswer() {
  if (LESSON.answered) return;
  const q = LESSON.qs[LESSON.i];
  const given = q.t === 'mc' ? LESSON.sel : $('#ans').value;
  if (given === null || given === '') return toast('ยังไม่ได้ตอบ');
  grade(q, given);
}

/* ตรวจคำตอบ + แสดงแถบเฉลย */
function grade(q, given) {
  if (LESSON.answered) return;
  LESSON.answered = true;
  if (!Cloud.signedIn()) { S.trialQ = (S.trialQ || 0) + 1; }
  LESSON.lastGiven = q.t === 'mc' ? (q.c[given] !== undefined ? q.c[given] : given) : given;
  const ok = isCorrect(q, given);
  LESSON.marks.push(ok);
  if (ok) {
    LESSON.right++;
    if (S.hearts > 0) S.xp += 10;
  } else if (S.hearts > 0) {
    S.hearts--; S.heartsAt = Date.now();
  }
  save();

  if (q.t === 'mc') {
    const sel = $('#ch' + LESSON.sel);
    if (sel) sel.classList.add(ok ? 'ok' : 'bad');
    if (!ok) { const right = $('#ch' + q.a); if (right) right.classList.add('ok'); }
  }

  const correctText = q.t === 'mc' ? q.c[q.a] : String(q.a);
  const bar = document.createElement('div');
  bar.className = 'verdict ' + (ok ? 'ok' : 'bad');
  bar.innerHTML = `<div class="inner">
      <div class="vt">${ok ? '✅ ถูกต้อง!' : '❌ ยังไม่ถูก — คำตอบคือ ' + esc(correctText)}</div>
      <div class="vs">${esc(q.s || '')}</div>
      <div class="row">
        <button class="btn ghost" onclick="askTutorFromLesson()">ถามติวเตอร์</button>
        <button class="btn ${ok ? '' : 'red'}" onclick="nextQuestion()">ถัดไป</button>
      </div>
    </div>`;
  document.body.appendChild(bar);
  const goBtn = $('#go'); if (goBtn) goBtn.disabled = true;
}

/* เปิดห้องคุยกับติวเตอร์จากโจทย์ข้อที่กำลังทำ
   อ่านค่าจาก LESSON ตรงๆ เพื่อไม่ต้องฝังข้อความโจทย์ลงในแอตทริบิวต์ onclick */
function askTutorFromLesson() {
  if (!LESSON) return;
  const q = LESSON.qs[LESSON.i];
  const correct = q.t === 'mc' ? q.c[q.a] : q.a;
  const bar = document.querySelector('.verdict');
  if (bar) bar.remove();
  askTutor(LESSON.unitId, q.q, correct, LESSON.lastGiven);
}

function nextQuestion() {
  const bar = document.querySelector('.verdict'); if (bar) bar.remove();
  LESSON.i++; LESSON.answered = false; LESSON.sel = null;
  render();
}

function quitLesson() {
  const bar = document.querySelector('.verdict'); if (bar) bar.remove();
  LESSON = null;
  go('#/home');
}

function lessonDone(app, unit) {
  const total = LESSON.qs.length;
  const pct = total ? Math.round(LESSON.right / total * 100) : 0;
  const stars = pct >= 90 ? 3 : pct >= 75 ? 2 : pct >= PASS_PCT ? 1 : 0;
  const prev = S.progress[unit.id] || { stars: 0, best: 0, runs: 0 };
  S.progress[unit.id] = {
    stars: Math.max(prev.stars, stars),
    best: Math.max(prev.best, pct),
    runs: (prev.runs || 0) + 1
  };
  if (stars > 0) touchStreak();
  save();

  app.innerHTML = `
    <div style="text-align:center;padding:8px 0">
      <h1>${stars ? 'ผ่านหน่วยนี้แล้ว' : 'ยังไม่ผ่าน ลองอีกรอบ'}</h1>
      <p class="sub">ถูก ${LESSON.right} จาก ${total} ข้อ · ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}
        · เกณฑ์ผ่าน ${PASS_PCT}%</p>
      ${scorePlot(LESSON.marks)}
      <p class="note" style="margin-bottom:20px">กราฟด้านบนคือจำนวนข้อที่ถูกสะสมของรอบนี้
        เส้นประแดงคือเกณฑ์ผ่าน</p>
      ${trialBar()}
      <button class="btn" onclick="startLesson('${unit.id}','${LESSON.mode}')">ทำอีกรอบ</button>
      <div style="height:10px"></div>
      <button class="btn ghost" onclick="quitLesson()">กลับไปบทเรียน</button>
    </div>`;
}

/* พล็อตผลรอบนี้ลงระนาบพิกัด: x = ข้อที่ , y = จำนวนข้อที่ถูกสะสม
   แอปคณิตศาสตร์ควรแสดงผลเป็นกราฟ ไม่ใช่ถ้วยรางวัล */
function scorePlot(marks) {
  const n = marks.length;
  if (!n) return '';
  const W = 240, H = 150, L = 26, B = 24, T = 12, R = 10;
  const px = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / n);
  const py = v => H - B - (v * (H - B - T) / n);

  let gridlines = '', ticks = '';
  for (let v = 0; v <= n; v++) {
    gridlines += `<line class="gridline" x1="${L}" y1="${py(v)}" x2="${W - R}" y2="${py(v)}"/>`;
    if (n <= 8 || v % 2 === 0) ticks += `<text class="tick" x="${L - 6}" y="${py(v) + 2.5}" text-anchor="end">${v}</text>`;
  }
  for (let i = 1; i <= n; i++) {
    ticks += `<text class="tick" x="${px(i)}" y="${H - B + 10}" text-anchor="middle">${i}</text>`;
  }

  // เส้นขั้นบันไดของคะแนนสะสม
  let cum = 0, pts = [[px(0), py(0)]];
  marks.forEach((ok, i) => { if (ok) cum++; pts.push([px(i + 1), py(cum)]); });
  const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const dots = pts.slice(1).map((p, i) =>
    `<circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${marks[i] ? 3.4 : 2}"
       ${marks[i] ? '' : 'opacity=".35"'}/>`).join('');

  const passY = py(n * PASS_PCT / 100);
  return `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="กราฟจำนวนข้อที่ถูกสะสม ได้ ${cum} จาก ${n} ข้อ">
    ${gridlines}
    <line class="passline" x1="${L}" y1="${passY.toFixed(1)}" x2="${W - R}" y2="${passY.toFixed(1)}"/>
    <text class="passlabel" x="${L + 4}" y="${(passY - 4).toFixed(1)}">เกณฑ์ผ่าน</text>
    <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>
    <line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
    ${ticks}
    <polyline class="pt" fill="none" stroke="currentColor" stroke-width="2"
      style="stroke:var(--pen-blue)" points="${line}"/>
    ${dots}
    <text class="ptlabel" x="${(W - R).toFixed(1)}" y="${(py(cum) - 8).toFixed(1)}" text-anchor="end">${cum}/${n}</text>
  </svg>`;
}

/* ============ 9.5 แบบทดสอบก่อนเรียน (Pre-Test) ============
   สุ่มโจทย์ข้ามหลายหน่วยของระดับชั้นเดียวกัน ให้ครอบคลุมทุกสาระ
   แยกจาก LESSON โดยตั้งใจ — ความหมายต่างกัน (ไม่มีหัวใจ ไม่มี XP ไม่มีดาว)
   ผสมกับกลไกเดิมจะทำให้ตรรกะ grade()/lessonDone() พันกันโดยไม่จำเป็น */
const PRETEST_LEN = 14;

/** Pre-test เป็นแบบวัดระดับ ไม่ใช่ข้อสอบเต็มสนาม 14 ข้อพอรู้ระดับแล้ว
    แต่คุมจังหวะเวลาต่อข้อเท่าของจริง จะได้คุ้นความกดดันโดยไม่กินเวลาเป็นชั่วโมง */
function pretestFormat() {
  const f = typeof examFormat === 'function' ? examFormat() : { questions: 30, minutes: 90, year: null };
  const perQ = f.questions ? (f.minutes * 60 / f.questions) : 180;
  return {
    questions: PRETEST_LEN,
    minutes: Math.max(10, Math.round(PRETEST_LEN * perQ / 60)),
    year: f.year
  };
}
let PRETEST = null;

/* ============ 9.4 หน้าชวนทำ Personalize หลังสมัครเสร็จ ============
   ขั้นตอนนี้มาแทนที่การพาผู้เรียนเข้าเรียนทันทีหลังจบวิซาร์ด — ให้เลือกเองว่าจะให้ AI
   วิเคราะห์ก่อนหรือข้ามไปเรียนเลย การยอมรับ/ปฏิเสธคำแนะนำจริงๆ เกิดขึ้นทีหลังที่ renderPredictBox() */
function viewPersonalize(app) {
  const p = S.profile || {};
  const gLabel = goalLabel(p.goal);
  app.innerHTML = `
    <div style="text-align:center;padding:12px 0">
      <h1>ปรับหลักสูตรให้เข้ากับคุณ</h1>
      <p class="sub">อยากให้ AI ทำแบบทดสอบสั้นๆ วิเคราะห์จุดแข็งจุดอ่อน แล้วแนะนำจุดเริ่มต้นที่เหมาะกับคุณ
        ${gLabel ? 'สำหรับเป้าหมาย ' + esc(gLabel) : ''} ก่อนไหม?</p>
      <div style="height:12px"></div>
      <button class="btn" onclick="go('#/pretest')">ทำ Pre-test ตอนนี้</button>
      <div style="height:10px"></div>
      <button class="btn ghost" onclick="go('#/home')">ข้ามไปเรียนเลย</button>
    </div>`;
}

function pretestSpec() {
  if (typeof isAlevelPath === 'function' && isAlevelPath()) {
    return { mode: 'topics', items: ALEVEL_TOPICS.slice() };
  }
  const lv = userClassId();
  return { mode: 'units', items: ((CURRICULUM[lv] || {}).units || []).slice() };
}
function pretestCount() {
  return pretestSpec().items.length;
}

function lessonHrefForAnswer(a) {
  if (a && a.topic && typeof alevelTopic === 'function' && alevelTopic(a.topic)) return '#/topic/' + a.topic;
  if (a && a.unit) return '#/lesson/' + a.unit;
  return '#/home';
}
function lessonLabelForAnswer(a) {
  if (a && a.topic && typeof alevelTopic === 'function' && alevelTopic(a.topic)) return alevelTopic(a.topic).name;
  const f = a && a.unit ? findUnit(a.unit) : null;
  return f ? f.unit.name : '';
}

function capturePretestGaps() {
  const missed = (PRETEST.answers || [])
    .filter(a => !a.ok)
    .map(a => a.topic || (typeof unitToTopicId === 'function' ? unitToTopicId(a.unit) : null))
    .filter(Boolean);
  const polyMiss = (PRETEST.answers || []).some(a => !a.ok && (
    a.topic === 'real' || (a.unit && POLY_UNITS.indexOf(a.unit) >= 0)
  ));
  if (polyMiss && missed.indexOf('real') < 0) missed.unshift('real');
  S.planTopics = missed.filter((id, i, arr) => arr.indexOf(id) === i);
}

function buildPretestPool(levelId) {
  const spec = pretestSpec();
  if (spec.mode === 'topics') {
    return spec.items.map(t => {
      const row = topicCheckQuestion(t, 0, true);   // Pre-test ต้องง่ายกว่าเสมอ
      if (!row) return null;
      return Object.assign({}, row.q, {
        _strand: row.unit.strand, _topic: t.id, _unit: row.unit.id, _lesson: t.name
      });
    }).filter(Boolean);
  }
  return spec.items.map(u => {
    const qs = (u.q || []).filter(q => typeof isDependentStem !== 'function' || !isDependentStem(q));
    const q = (qs[0] || (u.q || [])[0]);
    if (!q) return null;
    return Object.assign({}, q, {
      _strand: u.strand, _unit: u.id, _lesson: u.name,
      _topic: typeof unitToTopicId === 'function' ? unitToTopicId(u.id) : null
    });
  }).filter(Boolean);
}

function viewPretest(app) {
  if (!PRETEST) return pretestIntro(app);
  if (PRETEST.i >= PRETEST.qs.length) return pretestDone(app);
  pretestQuestion(app);
}

function pretestIntro(app) {
  const levelId = userClassId();
  const level = CURRICULUM[levelId];
  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['Test', '#/test'], ['แบบทดสอบก่อนเรียน', null]])}
    <h1>แบบทดสอบก่อนเรียน</h1>
    <p class="sub">${pretestCount()} ข้อ — ข้อละ 1 บทเรียนที่คุณจะเจอในแท็บบทเรียน
      ข้อที่พลาดจะถูกแทรกเข้าแผน แม้บทนั้นจะไม่อยู่ต้นทางปกติ (เช่น พหุนาม)</p>
    <p class="note" style="margin-bottom:20px">ข้อละบท ไม่สุ่มข้ามบท — ข้อที่พลาดแทรกเข้าแท็บบทเรียนทันที
      ${Cloud.signedIn() ? '' : '· ต้องเข้าสู่ระบบก่อนจึงจะให้ AI วิเคราะห์เกรดได้'}</p>
    <button class="btn" onclick="startPretest()">เริ่มทำแบบทดสอบ</button>
    <div style="height:10px"></div>
    <button class="btn ghost" onclick="go('#/test')">กลับไปหน้า Test</button>`;
}

function startPretest() {
  const levelId = userClassId();
  const f = pretestFormat();
  const qs = buildPretestPool(levelId);
  PRETEST = {
    levelId: levelId, qs: qs.slice(0, f.questions), i: 0, marks: [], answers: [],
    answered: false, sel: null, strand: {}, startedAt: Date.now(),
    deadline: Date.now() + f.minutes * 60000, limitMin: f.minutes,
    flagged: []
  };
  render();
}

function armPretestClock() {
  clearInterval(window._pretestClock);
  window._pretestClock = setInterval(pretestTick, 1000);
  pretestTick();
}
function pretestTick() {
  const el = $('#pTimer');
  if (!PRETEST) return;
  // นับถอยหลังจากเวลาจริงของ A-Level หมดเวลาแล้วส่งให้เอง
  if (PRETEST.deadline) {
    const left = Math.max(0, Math.round((PRETEST.deadline - Date.now()) / 1000));
    if (el) {
      el.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      el.classList.toggle('warn', left <= 300);
    }
    if (left <= 0) {
      clearInterval(window._pretestClock);
      PRETEST.i = PRETEST.qs.length;
      toast('หมดเวลา ส่งแบบทดสอบอัตโนมัติ');
      render();
    }
    return;
  }
  if (!el || !PRETEST.startedAt) return;
  const s = Math.max(0, Math.floor((Date.now() - PRETEST.startedAt) / 1000));
  el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function pretestQuestion(app) {
  const q = PRETEST.qs[PRETEST.i];
  const pct = PRETEST.i / PRETEST.qs.length * 100;
  const THAI_LABELS = ['ก.', 'ข.', 'ค.', 'ง.', 'จ.'];
  const body = q.t === 'mc'
    ? `<div class="${choiceGridClass(q)}">${q.c.map((c, i) =>
        `<button class="choice" id="pch${i}" data-label="${THAI_LABELS[i] || (i + 1) + '.'}"
           onclick="pretestPick(${i})"><span>${esc(c)}</span></button>`).join('')}</div>`
    : `<input type="text" id="pAns" inputmode="decimal" autocomplete="off"
         placeholder="พิมพ์คำตอบ" onkeydown="if(event.key==='Enter')pretestSubmit()">`;

  app.innerHTML = `
    <div class="testhead">
      <button class="backbtn" onclick="quitPretest()" aria-label="ออกจากแบบทดสอบ">✕</button>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <span class="pill">${PRETEST.i + 1}/${PRETEST.qs.length}</span>
      <span class="testclock" id="pTimer" title="เวลาที่ใช้ (นับขึ้น ไม่จำกัดเวลา)">00:00</span>
    </div>
    <p class="note" style="margin-bottom:10px">${esc(q._lesson || q._strand || '')}${q._topic ? ' · ตรงกับบทเรียนนี้' : ''}</p>
    <div class="qcard"><div class="qtext">${esc(q.q)}</div>${imgTag(q)}</div>
    ${body}
    <div style="height:14px"></div>
    <button class="btn" id="pGo" onclick="pretestSubmit()">ตรวจคำตอบ</button>
    <div class="testactions">
      <button class="btn ghost sm" onclick="pretestSkip()">ข้าม</button>
      <button class="linkish" onclick="pretestReport()">⚑ แจ้งปัญหา</button>
    </div>`;
  renderMath(app);
  armPretestClock();
  if (q.t === 'num') setTimeout(() => { const el = $('#pAns'); if (el) el.focus(); }, 60);
}

function pretestPick(i) {
  if (PRETEST.answered) return;
  PRETEST.sel = i;
  PRETEST.qs[PRETEST.i].c.forEach((_, k) => $('#pch' + k).classList.toggle('sel', k === i));
}

function pretestRecord(q, given, ok, skipped) {
  const correctText = q.t === 'mc' ? q.c[q.a] : String(q.a);
  PRETEST.marks.push(ok);
  PRETEST.answers.push({
    q: q.q, given: skipped ? null : given, ok: ok, skipped: !!skipped,
    correct: correctText, explain: q.s || '',
    topic: q._topic || unitToTopicId(q._unit), unit: q._unit
  });
  const st = PRETEST.strand[q._strand] || { right: 0, total: 0 };
  st.total++; if (ok) st.right++;
  PRETEST.strand[q._strand] = st;
}

function pretestSubmit() {
  if (PRETEST.answered) return;
  const q = PRETEST.qs[PRETEST.i];
  const given = q.t === 'mc' ? PRETEST.sel : $('#pAns').value;
  if (given === null || given === '') return toast('ยังไม่ได้ตอบ');
  PRETEST.answered = true;
  const ok = isCorrect(q, given);
  pretestRecord(q, given, ok, false);

  if (q.t === 'mc') {
    const sel = $('#pch' + PRETEST.sel);
    if (sel) sel.classList.add(ok ? 'ok' : 'bad');
    if (!ok) { const right = $('#pch' + q.a); if (right) right.classList.add('ok'); }
  }
  const correctText = q.t === 'mc' ? q.c[q.a] : String(q.a);
  const bar = document.createElement('div');
  bar.className = 'verdict ' + (ok ? 'ok' : 'bad');
  bar.innerHTML = `<div class="inner">
      <div class="vt">${ok ? '✅ ถูกต้อง!' : '❌ ยังไม่ถูก — คำตอบคือ ' + esc(correctText)}</div>
      <div class="vs">${esc(q.s || '')}</div>
      <button class="btn ${ok ? '' : 'red'}" onclick="pretestNext()">ถัดไป</button>
    </div>`;
  document.body.appendChild(bar);
  const goBtn = $('#pGo'); if (goBtn) goBtn.disabled = true;
}

function pretestSkip() {
  if (PRETEST.answered) return pretestNext();
  const q = PRETEST.qs[PRETEST.i];
  PRETEST.answered = true;
  pretestRecord(q, null, false, true);
  pretestNext();
}

function pretestReport() {
  if (!PRETEST) return;
  PRETEST.flagged = PRETEST.flagged || [];
  if (!PRETEST.flagged.includes(PRETEST.i)) PRETEST.flagged.push(PRETEST.i);
  toast('บันทึกแล้วว่าข้อนี้มีปัญหา — ยังไม่มีกล่องรับรายงานอัตโนมัติ ใช้เป็นเครื่องหมายในเครื่องนี้เท่านั้น');
}

function pretestNext() {
  const bar = document.querySelector('.verdict'); if (bar) bar.remove();
  PRETEST.i++; PRETEST.answered = false; PRETEST.sel = null;
  render();
}

function quitPretest() {
  const bar = document.querySelector('.verdict'); if (bar) bar.remove();
  clearInterval(window._pretestClock);
  PRETEST = null;
  go('#/test');
}

async function pretestDone(app) {
  clearInterval(window._pretestClock);
  const total = PRETEST.qs.length;
  const right = PRETEST.marks.filter(Boolean).length;
  const scorePct = total ? Math.round(right / total * 100) : 0;
  const nb = nationalBenchmark(PRETEST.levelId);
  const diff = scorePct - nb.pct;
  const ring = scorePct >= 70 ? 'hi' : scorePct >= 40 ? 'mid' : 'lo';
  const review = (PRETEST.answers || []).map((a, i) => `
    <button class="reviewitem ${a.ok ? 'ok' : 'bad'}" onclick="this.querySelector('.rev-more').hidden = !this.querySelector('.rev-more').hidden">
      <span class="reviewico">${a.ok ? '✓' : '✕'}</span>
      <span style="flex:1;min-width:0">
        <span class="k">ข้อ ${i + 1}${a.skipped ? ' · ข้าม' : ''}${lessonLabelForAnswer(a) ? ' · ' + esc(lessonLabelForAnswer(a)) : ''}</span>
        <span style="display:block;font-size:14px;line-height:1.5;margin-top:2px">${esc(a.q)}</span>
        <span class="rev-more note" hidden style="margin-top:6px">
          ${a.skipped ? 'ไม่ได้ตอบ' : 'คุณตอบ: ' + esc(String(a.given))}
          ${a.ok ? '' : ' · เฉลย: ' + esc(String(a.correct))}
          ${a.explain ? '<br>' + esc(a.explain) : ''}
          ${!a.ok ? '<br><span class="linkish" onclick="event.stopPropagation();go(\'' + lessonHrefForAnswer(a) + '\')">ไปเรียนบทนี้</span>' : ''}
        </span>
      </span>
      <span class="note">${a.ok ? 'ถูกต้อง' : 'ดูเฉลย'}</span>
    </button>`).join('');

  app.innerHTML = `
    <div style="text-align:center;padding:8px 0">
      <h1>ทำแบบทดสอบเสร็จแล้ว</h1>
      <div class="scorecircle ${ring}">${scorePct}%</div>
      <p class="sub">ถูก ${right} จาก ${total} ข้อ</p>
      ${scorePlot(PRETEST.marks)}
      <div class="card" style="text-align:left">
        <div class="k">เทียบค่าเฉลี่ยระดับประเทศ</div>
        <p class="note" style="margin-top:4px">${esc(nb.label)} ${esc(nb.year)} เฉลี่ย ${nb.pct}%
          (${esc(nb.source)}) · คุณทำได้ ${scorePct}%
          (${diff >= 0 ? '+' : ''}${diff.toFixed(1)} จุด${diff >= 0 ? ' สูงกว่าค่าเฉลี่ย' : ' ต่ำกว่าค่าเฉลี่ย'})</p>
        <p class="note">*ข้อสอบคนละชุด ใช้เป็นเกณฑ์เทียบเคียงคร่าวๆ ไม่ใช่มาตรฐานเดียวกัน</p>
      </div>
      ${review ? `
        <div class="card" style="text-align:left">
          <div class="k" style="margin-bottom:10px">สรุปรายข้อ · ${total} คำถาม</div>
          <div class="reviewlist">${review}</div>
          <p class="note" style="margin-top:8px">แตะข้อเพื่อดูเฉลย</p>
        </div>` : ''}
      <div id="predictBox">
        ${Cloud.signedIn()
          ? `<div class="calcbox"><div class="spinner" aria-hidden="true"></div>
               <p><b>กำลังคำนวณผล</b></p>
               <p class="note">AI กำลังวิเคราะห์จุดแข็งจุดอ่อนและทำนายคะแนน อย่าเพิ่งปิดหน้านี้</p></div>`
          : `<div class="banner">ต้องเข้าสู่ระบบก่อนจึงจะให้ AI วิเคราะห์และทำนายเกรดได้
               ผลคะแนนดิบด้านบนยังดูได้ตามปกติ</div>
             <button class="btn" onclick="go('#/auth/signup')">สมัครบัญชีฟรี</button>`}
      </div>
      <div style="height:10px"></div>
      <div id="pretestExit">${Cloud.signedIn()
        ? '<p class="note">ยังกดออกไม่ได้จนกว่าจะคำนวณผลเสร็จ</p>'
        : '<button class="btn ghost" onclick="quitPretest()">กลับไปหน้า Test</button>'}</div>
    </div>`;

  capturePretestGaps();
  const preAt = new Date().toISOString();
  S.lastPretest = Object.assign({}, S.lastPretest || {}, {
    level: PRETEST.levelId, scorePct: scorePct, nationalPct: nb.pct, nationalLabel: nb.label,
    at: preAt
  });
  // ภาพรวมชุดเดียวกับ Mock ใครทำทีหลังคนนั้นเป็นตัวล่าสุด
  S.lastAssessment = { kind: 'pretest', scorePct: scorePct, projected: null, at: preAt };
  save();

  if (!Cloud.signedIn()) {
    const box = $('#predictBox');
    if (box) box.innerHTML = `${renderInsertedLessonsCard()}
      <div class="banner">สมัครเพื่อให้ AI วิเคราะห์เกรด — บทที่พลาดถูกแทรกเข้าบทเรียนแล้ว</div>
      <button class="btn" onclick="go('#/home')">ไปบทเรียนที่แทรกให้</button>`;
    return;
  }

  try {
    const result = await analyzePretest({
      level: PRETEST.levelId, scorePct: scorePct, strandBreakdown: PRETEST.strand,
      goal: (S.profile || {}).goal, university: (S.profile || {}).university,
      major: (S.profile || {}).major, selfRating: (S.profile || {}).understanding
    });
    renderPredictBox(result, scorePct);
    unlockPretestExit();
    S.lastPretest = Object.assign(S.lastPretest || {}, result, {
      level: PRETEST.levelId, scorePct: scorePct, nationalPct: nb.pct, nationalLabel: nb.label,
      at: new Date().toISOString()
    });
    const recTopics = (result.recommendedUnits || [])
      .map(id => typeof unitToTopicId === 'function' ? unitToTopicId(id) : null)
      .filter(Boolean);
    recTopics.forEach(id => {
      if ((S.planTopics || []).indexOf(id) < 0) S.planTopics = (S.planTopics || []).concat([id]);
    });
    save();
    await savePretestToCloud(scorePct, result);
  } catch (e) {
    // วิเคราะห์ด้วย AI ล้มก็ยังต้องเก็บคะแนนไว้ ไม่งั้นที่สอบไปหายทั้งหมด
    S.lastPretest = Object.assign(S.lastPretest || {}, {
      level: PRETEST.levelId, scorePct: scorePct, nationalPct: nb.pct, nationalLabel: nb.label,
      at: new Date().toISOString()
    });
    save();
    await savePretestToCloud(scorePct, null);
    unlockPretestExit();
    const box = $('#predictBox');
    if (box) box.innerHTML = `${renderInsertedLessonsCard()}<div class="banner">วิเคราะห์ไม่สำเร็จ: ${esc(e.message)} — คะแนนถูกเก็บไว้แล้ว</div>
      <button class="btn" onclick="go('#/home')">ไปบทเรียนที่แทรกให้</button>`;
  }
}

/** ปลดล็อกปุ่มออกหลังคำนวณเสร็จ ระหว่างคำนวณจงใจไม่มีปุ่มให้กด */
function unlockPretestExit() {
  const box = $('#pretestExit');
  if (box) box.innerHTML = '<button class="btn ghost" onclick="quitPretest()">กลับไปหน้า Test</button>';
}

/** บันทึกผลทดสอบขึ้นคลาวด์
    เดิมไม่เคยเช็ก res.ok เลย insert ที่ถูกปฏิเสธจึงเงียบสนิท
    (user_id เป็น NOT NULL แต่ไคลเอนต์ไม่ได้ส่งมา ตอนนี้ฐานเติม auth.uid() ให้เอง) */
async function savePretestToCloud(scorePct, result, override) {
  if (!Cloud.signedIn()) return false;
  const src = override || (PRETEST ? { level: PRETEST.levelId, strand: PRETEST.strand } : null);
  if (!src) return false;
  try {
    const res = await sbFetch('/rest/v1/pretest_results', {
      method: 'POST',
      body: JSON.stringify({
        level: src.level, score_pct: scorePct, strand_breakdown: src.strand || {},
        predicted_gpa: (result && result.predictedGpa) || null,
        ai_analysis: (result && result.analysis) || null,
        recommended_units: (result && result.recommendedUnits) || null
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('บันทึกผลทดสอบไม่สำเร็จ', res.status, detail.slice(0, 300));
      toast('บันทึกผลขึ้นบัญชีไม่สำเร็จ (' + res.status + ') ผลยังอยู่ในเครื่องนี้');
      return false;
    }
    return true;
  } catch (e) {
    console.error('บันทึกผลทดสอบไม่สำเร็จ', e);
    toast('บันทึกผลขึ้นบัญชีไม่สำเร็จ ผลยังอยู่ในเครื่องนี้');
    return false;
  }
}

function renderInsertedLessonsCard() {
  const gaps = (typeof planTopicIds === 'function' ? planTopicIds() : S.planTopics || [])
    .map(id => typeof alevelTopic === 'function' ? alevelTopic(id) : null)
    .filter(Boolean);
  if (!gaps.length) return '';
  return `<div class="card" style="text-align:left">
    <div class="k">จะแทรกเข้าบทเรียน</div>
    <p class="note" style="margin:6px 0 10px">บทเหล่านี้ไม่ได้อยู่ต้นทางปกติ แต่ Pre-test ชี้ว่ายังไม่ผ่าน</p>
    ${gaps.map(t => `<button class="btn ghost sm" style="margin:0 6px 6px 0"
      onclick="go('#/topic/${t.id}')">${esc(t.name)}</button>`).join('')}
  </div>`;
}

function renderPredictBox(result, scorePct) {
  const box = $('#predictBox');
  if (!box) return;
  const recTopics = (result.recommendedUnits || [])
    .map(id => typeof unitToTopicId === 'function' ? unitToTopicId(id) : null)
    .map(id => id && alevelTopic(id))
    .filter(Boolean);
  box.innerHTML = `
    <div class="card" style="text-align:left">
      <div class="k">การประเมินเบื้องต้นของ AI (ยังไม่ปรับเทียบเกรดจริง)</div>
      <div class="predictbig">${result.predictedGpa.toFixed(2)}</div>
    </div>
    <div class="card" style="text-align:left">
      <div class="k">AI วิเคราะห์</div>
      <p style="margin-top:6px;font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(result.analysis)}</p>
    </div>
    ${renderInsertedLessonsCard()}
    ${recTopics.length ? `
      <div class="card" style="text-align:left">
        <div class="k">แนะนำให้เริ่มจากบทเรียนนี้</div>
        <div style="height:8px"></div>
        ${recTopics.map(t => `<button class="btn ghost sm" style="margin:0 6px 6px 0"
          onclick="go('#/topic/${t.id}')">${esc(t.name)}</button>`).join('')}
      </div>` : ''}
    <p class="sub" style="margin-top:6px">ใช้คำแนะนำนี้แทรกบทเข้าบทเรียนเลยไหม?</p>
    <div class="row">
      <button class="btn" onclick="acceptPersonalize()">ใช้เลย — ไปบทเรียน</button>
      <button class="btn ghost" onclick="declinePersonalize()">ดูบทเรียนก่อน</button>
    </div>`;
}

function acceptPersonalize() {
  S.pretestApplied = true;
  save();
  toast('แทรกบทที่ยังไม่ผ่านเข้าบทเรียนแล้ว');
  go('#/home');
}
function declinePersonalize() {
  S.pretestApplied = false;
  save();
  toast('บทที่พลาดยังถูกแทรกไว้ — ไม่ใช้คำแนะนำเพิ่มจาก AI');
  go('#/home');
}

/* ============ 10. อัปโหลดโจทย์ ============ */
function viewUpload(app) {
  const lv = userClassId();
  const left = uploadsLeft();
  if (left === 0) return viewGate(app);
  app.innerHTML = `
    <h1>เพิ่มโจทย์ของคุณ</h1>
    <p class="sub">เก็บเข้าคลัง หรือแค่ถาม AI ให้เทียบความยากกับ A-Level แล้วแยกเป็นขั้นง่าย</p>
    <button class="btn" onclick="go('#/askq')">ถามโจทย์ / อัปโหลดรูป เพื่อวิเคราะห์ vs A-Level</button>
    <div style="height:16px"></div>
    <p class="note">ด้านล่างนี้ถ้าใส่เฉลย โจทย์จะถูกสุ่มมาในบทเรียนของหน่วยนั้นด้วย</p>
    ${left === Infinity ? '' : `<div class="trialbar">
      <span>โหมดทดลอง เพิ่มได้อีก <b>${left}</b> ข้อ</span>
      <button onclick="go('#/auth/signup')">สมัครฟรี</button></div>`}

    <label for="uLevel">ระดับชั้นของโจทย์นี้ *</label>
    <select id="uLevel" onchange="fillUnits()">
      ${LEVEL_ORDER.map(id => `<option value="${id}" ${id === lv ? 'selected' : ''}>${CURRICULUM[id].name}</option>`).join('')}
    </select>

    <label for="uUnit">หน่วยการเรียนรู้ *</label>
    <select id="uUnit"></select>

    <label for="uType">รูปแบบคำตอบ</label>
    <select id="uType" onchange="toggleUploadType()">
      <option value="num">เติมตัวเลข</option>
      <option value="mc">เลือกตอบ 4 ตัวเลือก</option>
    </select>

    ${MathOCR.panel('uploadOcr', 'uQ')}
    <label for="uQ">โจทย์ *</label>
    <textarea id="uQ" placeholder="เช่น จงหา x จาก 4x − 8 = 20"></textarea>

    <div id="numBox">
      <label for="uA">คำตอบ (ตัวเลข) — ไม่บังคับ</label>
      <input type="text" id="uA" inputmode="decimal" placeholder="เว้นว่างได้ถ้าไม่รู้เฉลย เช่น 7 หรือ -2.5">
      <label for="uTol">ค่าคลาดเคลื่อนที่ยอมรับ</label>
      <input type="text" id="uTol" inputmode="decimal" placeholder="เว้นว่าง = ต้องตรงเป๊ะ">
    </div>

    <div id="mcBox" hidden>
      ${[0,1,2,3].map(i => `<label for="uC${i}">ตัวเลือกที่ ${i+1} ${i<2?'*':''}</label>
        <input type="text" id="uC${i}" placeholder="ตัวเลือกที่ ${i+1}">`).join('')}
      <label for="uCorrect">ข้อที่ถูก — ไม่บังคับ</label>
      <select id="uCorrect">
        <option value="-1">ไม่ระบุเฉลย</option>
        ${[0,1,2,3].map(i => `<option value="${i}">ตัวเลือกที่ ${i+1}</option>`).join('')}
      </select>
    </div>

    <div class="row" style="margin:10px 0">
      <button type="button" class="btn ghost sm" onclick="aiSolveUpload()">🤖 ให้ AI ช่วยเฉลย แล้วแค่กดยืนยัน</button>
    </div>
    <div id="aiSolveBox"></div>

    <label for="uS">คำอธิบายเฉลย</label>
    <textarea id="uS" placeholder="อธิบายวิธีคิด (ไม่บังคับ แต่ช่วยตอนทบทวน)"></textarea>

    <label for="uSource">โจทย์นี้มาจากไหน *</label>
    <input type="text" id="uSource" placeholder="เช่น หนังสือเรียน ม.5, ข้อสอบ A-Level ปี 2567, ครูแจก, แต่งเอง">
    <p class="note">ไม่ต้องบอกเฉลย แต่บอกที่มาไว้ AI จะช่วยดูว่าโจทย์นี้ยากง่ายแค่ไหนเทียบกับเป้าหมายของคุณ</p>

    <label for="uImg">รูปโจทย์ (ไม่บังคับ)</label>
    <input type="file" id="uImg" accept="image/*" capture="environment">
    <p class="note">รูปจะถูกย่อเหลือกว้างไม่เกิน 800 พิกเซลก่อนบันทึก เพื่อไม่ให้พื้นที่เก็บข้อมูลเต็ม</p>

    <div style="height:20px"></div>
    <button class="btn" onclick="saveUpload()">บันทึกโจทย์</button>`;
  fillUnits();
}

function fillUnits() {
  const lv = $('#uLevel').value;
  $('#uUnit').innerHTML = CURRICULUM[lv].units
    .map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
}
function toggleUploadType() {
  const mc = $('#uType').value === 'mc';
  $('#mcBox').hidden = !mc;
  $('#numBox').hidden = mc;
}

/** ให้ AI เฉลยแทนกรอกเอง — ผู้ใช้แค่กดยืนยันว่าถูกไหม ไม่ต้องคิดเฉลยเอง
    ยังกรอกเองได้ตามปกติถ้ากด "ไม่ถูก" หรือไม่กดปุ่มนี้เลย */
async function aiSolveUpload() {
  const q = $('#uQ').value.trim();
  if (!q) return toast('พิมพ์โจทย์ก่อนถึงจะให้ AI ช่วยเฉลยได้');
  const type = $('#uType').value;
  const box = $('#aiSolveBox');
  box.innerHTML = `<p class="note" style="margin:8px 0">กำลังให้ AI คิดเฉลย…</p>`;
  const payload = { question: q, type: type };
  if (type === 'mc') payload.choices = [0, 1, 2, 3].map(i => $('#uC' + i).value.trim());
  try {
    const result = await solveUploadedQuestion(payload);
    if (!result.answerText) {
      box.innerHTML = `<div class="banner" style="margin:8px 0">AI แก้โจทย์นี้ไม่ได้ — ${esc(result.reasoning || 'ลองกรอกเฉลยเองแทน')}</div>`;
      return;
    }
    window._uAiAnswer = result;
    box.innerHTML = `
      <div class="card" style="text-align:left;margin:8px 0">
        <div class="k">AI คิดว่าคำตอบคือ</div>
        <div class="v" style="font-size:18px">${esc(result.answerText)}</div>
        ${result.reasoning ? `<p class="note" style="margin-top:6px">${esc(result.reasoning)}</p>` : ''}
        <div class="row" style="margin-top:10px">
          <button type="button" class="btn sm" onclick="confirmAiAnswer()">✓ ถูกต้อง ใช้เฉลยนี้</button>
          <button type="button" class="btn ghost sm" onclick="rejectAiAnswer()">✗ ไม่ถูก กรอกเอง</button>
        </div>
      </div>`;
  } catch (e) {
    box.innerHTML = `<div class="banner" style="margin:8px 0">เฉลยไม่สำเร็จ: ${esc(e.message)}</div>`;
  }
}
function confirmAiAnswer() {
  const r = window._uAiAnswer;
  if (!r) return;
  if ($('#uType').value === 'mc') {
    if (r.choiceIndex >= 0 && r.choiceIndex <= 3) $('#uCorrect').value = String(r.choiceIndex);
  } else {
    $('#uA').value = r.answerText;
  }
  $('#aiSolveBox').innerHTML = `<p class="note" style="margin:8px 0">✓ ใช้เฉลยจาก AI แล้ว — กด "บันทึกโจทย์" ด้านล่างได้เลย</p>`;
  window._uAiAnswer = null;
}
function rejectAiAnswer() {
  $('#aiSolveBox').innerHTML = `<p class="note" style="margin:8px 0">ไม่เป็นไร กรอกเฉลยเองด้านบนได้เลย</p>`;
  window._uAiAnswer = null;
}

/** ย่อรูปด้วย canvas แล้วคืนเป็น data URL — localStorage รับไฟล์จากกล้องแบบดิบไม่ไหว */
function shrinkImage(file, maxW, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => cb(null);
    img.src = fr.result;
  };
  fr.onerror = () => cb(null);
  fr.readAsDataURL(file);
}

function saveUpload() {
  if (uploadsLeft() === 0) return go('#/gate');
  const type = $('#uType').value;
  const q = $('#uQ').value.trim();
  if (!q) return toast('ยังไม่ได้กรอกโจทย์');
  const source = $('#uSource').value.trim();
  if (!source) return toast('ยังไม่ได้บอกว่าโจทย์นี้มาจากไหน');

  const rec = {
    id: 'u_' + Date.now().toString(36),
    level: $('#uLevel').value,
    unit: $('#uUnit').value,
    t: type,
    q: q,
    s: $('#uS').value.trim(),
    source: source,
    own: true,
    img: null,
    at: new Date().toISOString()
  };

  if (type === 'num') {
    const aRaw = $('#uA').value.trim();
    if (aRaw) {
      const a = toNumber(aRaw);
      if (a === null) return toast('คำตอบต้องเป็นตัวเลข หรือเว้นว่างไว้ถ้าไม่รู้เฉลย');
      rec.a = a;
      const tol = toNumber($('#uTol').value);
      if (tol !== null && tol > 0) rec.tol = tol;
      rec.v = true;   // เติมตัวเลข = ใช้ในโหมดพูดได้
    } else {
      rec.a = null;   // ไม่มีเฉลย — ใช้ให้ AI วิเคราะห์อย่างเดียว จะไม่ถูกสุ่มมาถามในบทเรียน
    }
  } else {
    const c = [0,1,2,3].map(i => $('#uC' + i).value.trim()).filter(Boolean);
    if (c.length < 2) return toast('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ');
    const correct = +$('#uCorrect').value;
    rec.c = c;
    if (correct === -1) {
      rec.a = null;   // ไม่ระบุเฉลย — ใช้ให้ AI วิเคราะห์อย่างเดียว จะไม่ถูกสุ่มมาถามในบทเรียน
    } else {
      if (correct >= c.length) return toast('ข้อที่ถูกชี้ไปยังตัวเลือกที่เว้นว่างไว้');
      rec.a = correct;
    }
  }

  const file = $('#uImg').files[0];
  const finish = () => {
    S.uploads.push(rec); save();
    if (Cloud.signedIn()) Cloud.pushQuestion(rec).then(ok => { if (ok) save(); });
    if (Cloud.signedIn()) {
      go('#/uploadresult/' + rec.id);
    } else {
      toast(rec.a !== null
        ? 'บันทึกแล้ว — โจทย์นี้จะโผล่ในบทเรียนของหน่วยที่เลือก'
        : 'บันทึกแล้ว — ไม่มีเฉลย จึงเก็บไว้ในคลังโจทย์เท่านั้น ไม่ถูกสุ่มมาถามในบทเรียน');
      go('#/bank');
    }
  };
  if (file) shrinkImage(file, 800, dataUrl => { rec.img = dataUrl; finish(); });
  else finish();
}

/* ============ 11.2 ผล AI วิเคราะห์โจทย์ที่อัปโหลด ============
   เทียบความยากของโจทย์กับเป้าหมายของผู้เรียน บอกว่าโจทย์นี้ระดับไหน
   และควรฝึกโจทย์ยากขึ้นหรือยัง — ไม่บอกเฉลย เพราะผู้ใช้ไม่ได้ส่งเฉลยมาด้วย */
async function viewUploadResult(app, r) {
  const rec = S.uploads.find(u => u.id === r.a);
  if (!rec) return go('#/bank');
  app.innerHTML = `
    <h1>บันทึกโจทย์แล้ว</h1>
    <div class="card" style="text-align:left">
      <div class="k">ที่มา</div>
      <div class="v" style="font-size:15px">${esc(rec.source || '-')}</div>
    </div>
    <div style="height:14px"></div>
    <div id="uaBox"><p class="note">กำลังให้ AI วิเคราะห์ความยากเทียบกับเป้าหมาย…</p></div>
    <div style="height:14px"></div>
    <button class="btn ghost" onclick="go('#/bank')">ไปที่คลังโจทย์</button>`;

  try {
    const p = S.profile || {};
    const result = await analyzeUploadedQuestion({
      question: rec.q, source: rec.source, level: rec.level, unit: rec.unit,
      goal: p.goal || 'a_level', university: p.university, major: p.major
    });
    let split = { parts: [] };
    try { split = await analyzeAndSplit(rec.q, rec.img); } catch (e2) { /* ใช้ผลความยากอย่างเดียว */ }
    window._askQ = { q: rec.q, img: rec.img, last: split, source: 'bank', back: '#/bank' };
    const box = $('#uaBox');
    if (box) box.innerHTML = `
      <div class="card" style="text-align:left">
        <div class="k">เทียบ A-Level คณิต 1</div>
        <div class="v" style="font-size:18px">${esc(result.difficulty || split.difficulty || '—')}</div>
      </div>
      <div class="card" style="text-align:left">
        <div class="k">AI วิเคราะห์</div>
        <p style="margin-top:6px;font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(result.note || split.note || '')}</p>
      </div>
      ${(split.parts || []).length ? `<div class="teachcard"><div class="k">แยกข้อยากนี้เป็นขั้นที่ง่ายกว่า — ไล่ทำจากง่ายไปยาก</div>
        <ol class="splitsteps">${split.parts.map((p, i) =>
          `<li><b>${esc(p.title || '')}</b><p>${esc(p.q || '')}</p>${p.hint ? `<p class="note">${esc(p.hint)}</p>` : ''}
           <button class="btn ghost sm" onclick="startSplitPart(${i})">ฝึกขั้นนี้กับ AI</button></li>`
        ).join('')}</ol></div>` : ''}
      <button class="btn" style="margin-top:8px" onclick="startAskTutor()">คุยโจทย์นี้ทั้งข้อกับ AI</button>
      ${result.recommendHarder
        ? `<div class="banner">โจทย์นี้ยังง่ายกว่าที่เป้าหมายต้องการ ลองหาโจทย์ที่ยากขึ้นมาฝึกเพิ่ม</div>`
        : ''}`;
  } catch (e) {
    const box = $('#uaBox');
    if (box) box.innerHTML = `<div class="banner">วิเคราะห์ไม่สำเร็จ: ${esc(e.message)}</div>`;
  }
}

/* ============ 11. คลังโจทย์ของฉัน ============ */
function viewBank(app) {
  if (!S.uploads.length) {
    app.innerHTML = `<h1>คลังโจทย์ของฉัน</h1>
      <div class="empty">ยังไม่มีโจทย์ที่คุณเพิ่มไว้<br>แตะแท็บ “เพิ่มโจทย์” เพื่อเริ่ม</div>`;
    return;
  }
  app.innerHTML = `
    <h1>คลังโจทย์ของฉัน</h1>
    <p class="sub">${S.uploads.length} ข้อ · ข้อที่มีเฉลยจะถูกสุ่มมาถามในบทเรียนของหน่วยนั้นด้วย</p>
    ${S.uploads.slice().reverse().map(u => {
      const found = findUnit(u.unit);
      const hasAns = u.a !== null && u.a !== undefined;
      const ans = hasAns ? (u.t === 'mc' ? u.c[u.a] : u.a) : null;
      return `<div class="card">
        <span class="pill">${CURRICULUM[u.level] ? CURRICULUM[u.level].short : '?'}</span>
        <span class="pill">${found ? esc(found.unit.name) : 'ไม่พบหน่วย'}</span>
        ${u.rid ? '<span class="pill">☁️ ซิงก์แล้ว</span>' : (Cloud.signedIn() ? '<span class="pill">⏳ รอซิงก์</span>' : '')}
        <div style="font-weight:800;margin:10px 0 6px;line-height:1.5">${esc(u.q)}</div>
        ${imgTag(u)}
        <div class="note">${hasAns ? 'คำตอบ: ' + esc(String(ans)) : 'ไม่มีเฉลย — เก็บไว้ให้ AI วิเคราะห์เท่านั้น'}${u.s ? ' · ' + esc(u.s) : ''}</div>
        <div style="height:10px"></div>
        <button class="btn ghost sm" onclick="delUpload('${u.id}')">ลบ</button>
      </div>`;
    }).join('')}`;
}
function delUpload(id) {
  if (!confirm('ลบโจทย์ข้อนี้ถาวร?')) return;
  const rec = S.uploads.find(u => u.id === id);
  S.uploads = S.uploads.filter(u => u.id !== id);
  save(); render(); toast('ลบแล้ว');
  // ลบบนคลาวด์ด้วย ไม่งั้นการซิงก์ครั้งหน้าจะดึงกลับมา
  if (rec && rec.rid) Cloud.deleteQuestion(rec.rid);
}

/* ============ 11.4 ภาพประกอบ "เส้นทางสู่เป้าหมาย" แบบเทือกเขา ============
   จำลองแบบหน้า "Softomni Premium Mountain Dashboard" ใน Stitch — เส้นทางสีฟ้าไต่ข้ามเทือกเขาสีกรม
   จาก START ไปถึงธงเป้าหมาย จุดบนเส้นคำนวณจริงจาก % ความคืบหน้าของระดับชั้นปัจจุบัน (levelPct)
   ไม่ใช่ตัวเลขสุ่มตกแต่งเฉยๆ */
function renderJourneySVG(pct, goal) {
  const W = 500, H = 190;
  const clamp = Math.max(0, Math.min(100, Math.round(pct)));
  const t = clamp / 100;
  const P0 = [24, 158], C1 = [150, 28], C2 = [330, 162], P3 = [468, 52];
  const bez = tt => {
    const mt = 1 - tt;
    return [
      mt * mt * mt * P0[0] + 3 * mt * mt * tt * C1[0] + 3 * mt * tt * tt * C2[0] + tt * tt * tt * P3[0],
      mt * mt * mt * P0[1] + 3 * mt * mt * tt * C1[1] + 3 * mt * tt * tt * C2[1] + tt * tt * tt * P3[1],
    ];
  };
  const [mx, my] = bez(t);
  const pathD = `M${P0[0]},${P0[1]} C${C1[0]},${C1[1]} ${C2[0]},${C2[1]} ${P3[0]},${P3[1]}`;

  return `
  <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;border-radius:var(--radius);overflow:hidden">
    <defs>
      <linearGradient id="jSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#jSky)"/>
    <polygon points="0,${H} 90,72 190,${H}" fill="#334155" opacity=".55"/>
    <polygon points="120,${H} 260,38 410,${H}" fill="#1e293b"/>
    <polygon points="300,${H} 420,88 ${W},${H}" fill="#0f172a"/>
    <path d="${pathD}" fill="none" stroke="#0ea5e9" stroke-width="6" opacity=".25"/>
    <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${P0[0]}" cy="${P0[1]}" r="4" fill="#38bdf8"/>
    <text x="${P0[0]}" y="${P0[1] + 20}" fill="#cbd5e1" font-size="11" style="font-family:var(--mono)">START</text>
    <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="7" fill="#0ea5e9" stroke="#fff" stroke-width="2"/>
    <text x="${mx.toFixed(1)}" y="${(my - 14).toFixed(1)}" fill="#fff" font-size="11" font-weight="700"
      text-anchor="middle" style="font-family:var(--mono)">${clamp}%</text>
    <text x="${P3[0]}" y="${P3[1] - 14}" font-size="16" text-anchor="middle">⭐</text>
    <text x="${P3[0]}" y="${P3[1] + 18}" fill="#e2e8f0" font-size="10.5" text-anchor="middle"
      style="font-family:var(--ui)">${esc(goal || 'เป้าหมาย')}</text>
  </svg>`;
}

/* ============ 11.5 หน้าแรก — แดชบอร์ดสรุปเป้าหมาย ============
   ย้ายการ์ดเป้าหมาย+สถิติมาจากหน้าของฉันเดิม เพราะควรเป็นสิ่งแรกที่เห็นเมื่อเปิดแอป
   ไม่ใช่ซ่อนอยู่ท้ายหน้าตั้งค่า */
function viewDashboard(app) {
  const doneUnits = Object.keys(S.progress).filter(k => S.progress[k].stars > 0).length;
  const totalUnits = LEVEL_ORDER.reduce((n, id) => n + CURRICULUM[id].units.length, 0);
  const p = S.profile || {};
  const gLabel = goalLabel(p.goal);
  const lp = S.lastPretest;
  const levelName = (CURRICULUM[userClassId()] || CURRICULUM.m1).name;

  const statusMsg = lp ? 'ใช้ผลแบบทดสอบเพื่อเลือกเรื่องที่ควรฝึกต่อ คะแนนนี้ยังไม่ใช่คะแนนสอบจริง' : 'เริ่มจากแผนวันนี้ หรือทำ Pre-test เพื่อค้นหาจุดที่ควรฝึก';

  const journeyPct = isAlevelPath() ? topicPct() : trackPct();
  const pred = predictedAlevel();
  const plan = prepPlanNote();
  const gaps = gapTopics().slice(0, 4);
  const topicDone = ALEVEL_TOPICS.filter(t => (S.progress[t.id] || {}).stars > 0).length;
  app.innerHTML = `
    ${Learning.dailyCard()}
    <div class="card" style="padding:20px 20px 0">
      <h1>สวัสดี! 👋</h1>
      <p class="sub" style="margin-bottom:14px">${esc(statusMsg)}</p>
      ${renderJourneySVG(journeyPct, gLabel)}
      <div style="height:16px"></div>
      <div class="row" style="padding-bottom:20px">
        <button class="btn" onclick="go('#/home')">📘 ไปเรียนต่อ</button>
        <button class="btn ghost" onclick="go('#/test')">📝 ไปที่ Test</button>
      </div>
    </div>

    <p class="note" style="margin:2px 0 10px">ชั้น ${esc(levelName)}${gLabel ? ' · เป้าหมาย ' + esc(gLabel) : ''}</p>
    <div class="grid2">
      <div class="card"><div class="k">คะแนนสะสม</div><div class="v">⭐ ${S.xp}</div></div>
      <div class="card"><div class="k">เรียนต่อเนื่อง</div><div class="v">🔥 ${S.streak} วัน</div></div>
      <div class="card"><div class="k">${isAlevelPath() ? 'บทที่ผ่าน' : 'หน่วยที่ผ่าน'}</div>
        <div class="v">${isAlevelPath() ? topicDone + '/' + ALEVEL_TOPICS.length : doneUnits + '/' + totalUnits}</div></div>
      <div class="card"><div class="k">Pre-test ล่าสุด</div><div class="v">${lp ? lp.scorePct + '%' : '—'}</div></div>
    </div>
    ${isAlevelPath() ? `
    <div class="grid2" style="margin-top:8px">
      <div class="card">
        <div class="k">ผลตรวจพื้นฐานในแอป</div>
        <div class="v">${pred ? pred.pct + '/100' : '—'}</div>
        <p class="note" style="margin-top:8px">${pred
          ? pred.label
          : 'ยังไม่มี Pre-test · ระบบยังไม่ทำนายคะแนน A-Level'}</p>
      </div>
      <div class="card">
        <div class="k">แผนเตรียมตัว</div>
        <div class="v">${plan.hours} ชม./วัน</div>
        <p class="note" style="margin-top:8px">เหลือ ${plan.left} บท · ประมาณ ${plan.months} เดือนถึงสนาม (มีนาฯ ตามชั้นเรียน)
          ตัวเลขขยับเมื่อเรียนและทำโจทย์</p>
      </div>
    </div>
    ${gaps.length ? `<div class="card">
      <div class="k">ควรเพิ่มความรู้</div>
      <ul class="teachlist">${gaps.map(t => `<li>${esc(t.name)}${t.hard ? ' · ฝึกเยอะ' : ''}</li>`).join('')}</ul>
      <button class="btn ghost sm" onclick="go('#/home')">ไปบทเรียน</button>
    </div>` : ''}
    <p class="note">สอบ A-Level จริงแล้ว?
      <a href="#/realscores" style="color:var(--pen-blue)">กรอกคะแนนที่ได้</a>
      เพื่อเก็บข้อมูลสำหรับตรวจสอบการประเมินในอนาคต — ได้ XP เป็นของขวัญ</p>` : ''}`;
  Learning.sync();
}

/* ============ 11.6 แท็บ Test — pre-test + หลักสูตรตามเป้าหมาย ============
   Course = ชุดหน่วยที่จัดกลุ่มข้ามระดับชั้นตามสไตล์เป้าหมาย ไม่ใช่หน่วยเดิมทีละหน่วย
   เป้าหมาย A-Level ใช้เนื้อหา ม.4-6 ทั้งหมด ส่วน school ใช้หน่วยของระดับชั้นปัจจุบันผู้เรียน */
function viewTestHub(app, r) {
  if (r && r.a && /^\d{4}$/.test(r.a)) return viewExamPack(app, Number(r.a));
  // เติมคลังข้อสอบตั้งแต่เปิดแท็บนี้ กว่าจะกดเข้า Mock มักมีข้อพร้อมแล้ว
  if (typeof prefetchMockSet === 'function') prefetchMockSet();
  const p = S.profile || {};
  const gLabel = goalLabel(p.goal);
  const lp = S.lastPretest;
  const track = goalTrackUnits();
  const daily = dailyPick();
  const dailyDiffTh = daily && daily.difficulty === 'hard' ? 'ยาก' : 'ปานกลาง';

  const groups = isAlevelPath()
    ? ALEVEL_EXAMS.slice().reverse().map(e => `
        <button class="topicrow" onclick="go('#/test/${e.year}')">
          <span>
            <span class="t">${e.year} · ${esc(e.label)}</span>
            <span class="d">${e.pages} หน้า${e.q ? ' · ' + e.q + ' ข้อ / ' + e.minutes + ' นาที / ' + e.score + ' คะแนน' : ''}${e.scanned ? ' · สแกน ยังแปลงข้อไม่ได้' : ' · ยังไม่ใส่ข้อในแอป (encoding เลเยอร์ข้อความพัง)'}</span>
          </span>
          <span class="go">ดูชุด</span>
        </button>`).join('')
    : (() => {
        const byLv = {};
        track.forEach(f => {
          if (!byLv[f.levelId]) byLv[f.levelId] = [];
          byLv[f.levelId].push(f.unit);
        });
        return Object.keys(byLv).map(lv => {
          const L = CURRICULUM[lv];
          const items = byLv[lv].map(u => {
            const prog = S.progress[u.id] || { stars: 0 };
            const n = poolFor(u.id).length;
            return `<button class="topicrow" onclick="go('#/lesson/${u.id}')">
              <span>
                <span class="t">${esc(u.name)}</span>
                <span class="d">${n} ข้อ · ${L.short}${prog.stars ? ' · ' + '⭐'.repeat(prog.stars) : ''}</span>
              </span>
              <span class="go">ฝึกฝน</span>
            </button>`;
          }).join('');
          return `<div>
            <div class="topicgroup-h">📁 ${esc(L.name)}</div>
            ${items}
          </div>`;
        }).join('');
      })();

  const recent = lp
    ? `<div class="recentrow">
        <div class="recentico">✓</div>
        <div style="flex:1;min-width:0">
          <div class="t" style="font-size:13px;font-weight:700">แบบทดสอบก่อนเรียน</div>
          <p class="note" style="margin:0">${new Date(lp.at).toLocaleDateString('th-TH')}</p>
        </div>
        <b style="color:var(--pen-green)">${lp.scorePct}%</b>
      </div>`
    : `<p class="note">ยังไม่มีผลทดสอบ — ทำ Pre-test เพื่อดูคะแนนที่นี่</p>`;

  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['Test', null]])}
    <h1>ศูนย์รวมการทดสอบ</h1>
    <p class="sub">ประเมินตัวเองก่อนเรียน แล้วฝึกจากหลักสูตรที่ตรงกับเป้าหมาย${gLabel ? ' ' + esc(gLabel) : ''}</p>

    <div class="hub">
      <div>
        <h2>แนะนำสำหรับคุณ</h2>
        <div class="coursegrid">
          <button class="coursecard" onclick="go('#/pretest')">
            <div class="cc-top"><span class="pill">PRE-TEST</span></div>
            <h3>แบบทดสอบก่อนเรียน</h3>
            <p class="cc-desc">AI วิเคราะห์คะแนน ทำนายเกรด และแนะนำจุดที่ควรเริ่ม
              ${lp ? `· ครั้งล่าสุด ${lp.scorePct}%` : ''}</p>
            <div class="cc-foot">
              <span class="cc-meta"><span>📄 ${pretestCount()} ข้อ · ตรงกับบทเรียน</span></span>
              <span class="btn sm" style="width:auto">เริ่มทำข้อสอบ</span>
            </div>
          </button>
          <button class="coursecard" onclick="go('#/mock')">
            <div class="cc-top"><span class="pill">MOCK TEST</span></div>
            <h3>Mock A-Level คณิต 1</h3>
            <p class="cc-desc">ข้อใหม่ตามโครงข้อสอบจริงปี 67–69 (ไม่ก็อปข้อ ทปอ.) เน้นจุดอ่อนจาก Pre-test
              ${S.lastMock ? '· ครั้งล่าสุด ' + S.lastMock.scorePct + '%' : ''}</p>
            <div class="cc-foot">
              <span class="cc-meta"><span>📄 ${examFormat().questions} ข้อ · ${examFormat().minutes} นาที (เท่าของจริง)</span></span>
              <span class="btn sm" style="width:auto">เริ่ม Mock</span>
            </div>
          </button>
          ${daily ? `
          <button class="coursecard" onclick="startDailyQuestion()">
            <div class="cc-top"><span class="pill">DAILY · ${dailyDiffTh}</span></div>
            <h3>โจทย์ประจำวัน</h3>
            <p class="cc-desc">${esc(daily.q.q)}</p>
            <div class="cc-foot">
              <span class="cc-meta"><span>${esc(daily.unitName)}</span></span>
              <span class="btn sm" style="width:auto">ทำข้อนี้</span>
            </div>
          </button>` : ''}
          ${gLabel && track.length ? `
          <button class="coursecard" onclick="startGoalPractice()">
            <div class="cc-top"><span class="pill">${esc(gLabel).toUpperCase()}</span></div>
            <h3>ฝึกตามเป้าหมาย: ${esc(gLabel)}</h3>
            <p class="cc-desc">คุยกับ AI ติวเตอร์ เรียงจากง่ายไปยาก — ตอบถูกต่อเนื่องจะเจอโจทย์ยากขึ้นเรื่อยๆ</p>
            <div class="cc-foot">
              <span class="cc-meta"><span>📄 ${track.length} หน่วยบนเส้นทาง</span></span>
              <span class="btn sm" style="width:auto">เริ่มฝึก</span>
            </div>
          </button>` : `
          <button class="coursecard" onclick="go('#/setgoal')">
            <div class="cc-top"><span class="pill">เป้าหมาย</span></div>
            <h3>ยังไม่ได้ตั้งเป้าหมาย</h3>
            <p class="cc-desc">ตั้งโรงเรียนหรือ A-Level ก่อน ระบบจะจัดหลักสูตรฝึกตามเป้าหมายให้</p>
            <div class="cc-foot">
              <span class="cc-meta"></span>
              <span class="btn sm" style="width:auto">ตั้งเป้าหมาย</span>
            </div>
          </button>`}
        </div>

        ${p.goal === 'a_level' && p.university && p.major ? `
          <div class="card" id="uniStatsCard">
            <div class="k">สถิติที่ใช้ยื่น</div>
            <div class="v" style="font-size:16px">${esc(p.university)} · ${esc(p.major)}</div>
            <p class="note" style="margin:8px 0 12px">AI ค้นเว็บให้คร่าวๆ ว่าคณะนี้มักใช้คะแนนเท่าไหร่
              (ข้อมูลจาก AI+เว็บ ไม่ใช่ประกาศทางการ ตรวจสอบกับเว็บมหาวิทยาลัยอีกครั้งเสมอ)</p>
            <button class="btn ghost sm" onclick="loadUniStats()">ค้นสถิติคะแนน</button>
            <div id="uniStatsBody"></div>
          </div>` : ''}

        <div class="row" style="margin:4px 0 18px">
          <button class="btn ghost sm" onclick="go('#/upload')">➕ อัปโหลดโจทย์ & ให้ AI วิเคราะห์</button>
        </div>

        <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:10px">
          <h2 style="margin:0">แบบฝึกหัด${gLabel ? ': ' + esc(gLabel) : ''}</h2>
        </div>
        <p class="note" style="margin-bottom:10px">${isAlevelPath()
          ? 'ชุดข้อสอบจริงย้อนหลัง ' + ALEVEL_EXAMS.length + ' ปี (ก่อน 2566 = วิชาสามัญ คณิต 1 · 2566+ = A-Level) — ยังไม่ใส่โจทย์ข้อต่อข้อในแอปจนกว่าจะ OCR ได้ถูกต้อง ไม่แต่งข้อปลอม'
          : 'แตะเพื่อดูเนื้อหา แล้วเริ่มคุยกับติวเตอร์ AI จากคลังหลักสูตรบนเส้นทางเป้าหมาย'}</p>
        <div class="topiclist">${groups}</div>

        <div style="height:20px"></div>
        <h2>แหล่งโจทย์เพิ่มเติมนอกแอป</h2>
        <p class="note">อยากฝึกเยอะกว่านี้ ลองแหล่งข้อสอบจริงเหล่านี้ประกอบได้
          (ลิงก์ออกไปเว็บภายนอก ไม่ใช่เนื้อหาของ SoftOmni)</p>
        <div class="card" style="text-align:left">
          <a href="https://www.smartmathpro.com/exam-free/math/" target="_blank" rel="noopener"
            style="color:var(--pen-blue);font-weight:700">SmartMathPro — คลังข้อสอบคณิต ม.ต้น/ม.ปลาย ย้อนหลัง</a>
          <p class="note" style="margin-top:4px">ข้อสอบเก่า วิชาสามัญ, PAT1, A-Level พร้อมเฉลย</p>
        </div>
        <div class="card" style="text-align:left">
          <a href="https://rathcenter.com/#/" target="_blank" rel="noopener"
            style="color:var(--pen-blue);font-weight:700">RATH Center — ชีทสรุป A-Level แยกบทพื้นฐาน/เพิ่มเติม</a>
          <p class="note" style="margin-top:4px">จัดหมวดตามหลักสูตร สอวน./A-Level ครบทุกบท</p>
        </div>
      </div>

      <aside>
        <div class="statpanel">
          <h2 style="margin-bottom:4px">ภาพรวมประสิทธิภาพ</h2>
          <div class="statgrid">
            <div class="statcell">
              <div class="k">หน่วยที่เรียนแล้ว</div>
              <div class="v">${unitsDoneCount()} <span>หน่วย</span></div>
            </div>
            <div class="statcell">
              <div class="k">Pre-test ล่าสุด</div>
              <div class="v">${lp ? lp.scorePct + '<span>%</span>' : '—'}</div>
            </div>
          </div>
          <h4 class="k" style="border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px">ล่าสุด</h4>
          ${recent}
        </div>
      </aside>
    </div>`;
}

function viewExamPack(app, year) {
  const e = alevelExam(year);
  if (!e) return viewTestHub(app, {});
  const kindTh = e.kind === 'samuan' ? 'ก่อนปี 2566 ใช้วิชาสามัญ คณิตศาสตร์ 1' : 'A-Level คณิตศาสตร์ประยุกต์ 1 · 30 ข้อ 90 นาที 100 คะแนน';
  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['Test', '#/test'], [String(e.year), null]])}
    <h1>${e.year} · ${esc(e.label)}</h1>
    <p class="sub">${esc(kindTh)}</p>
    <div class="teachcard">
      <div class="k">สถานะในแอป</div>
      <p>${EXAM_SIGNALS[e.year] ? 'AI อ่านข้อมูลจากเอกสารชุดนี้แล้ว ดูจำนวนข้อและสถานะการตรวจด้านล่าง' : 'ยังไม่มีข้อมูลชุดนี้จากฐานข้อมูลที่เชื่อมต่ออยู่'}</p>
      <p class="note">AI ใช้ข้อมูลข้อสอบเป็นเอกสารอ้างอิงเพื่อจัดหัวข้อและประเมินความยาก ตัวเลขความยากยังเป็นค่าประเมิน ไม่ใช่สถิติผลสอบของนักเรียน</p>
    </div>
    ${examPressureCard(e.year)}
    <div class="teachcard">
      <div class="k">หัวข้อที่ใช้วางแผนฝึก</div>
      <p>ข้อมูลที่อ่านได้จะเชื่อมกับหัวข้อด้านล่าง เพื่อให้ AI เลือกทักษะและบทที่ควรฝึก</p>
      <ul class="teachlist">${ALEVEL_TOPICS.map(t =>
        `<li>${esc((alevelStrand(t.strand) || {}).name || '')} · ${esc(t.name)}</li>`).join('')}</ul>
    </div>
    <button class="btn" onclick="go('#/home')">ไปบทเรียนตามหัวข้อ</button>
    <div style="height:10px"></div>
    <button class="btn ghost" onclick="go('#/test')">กลับศูนย์ Test</button>`;
}

/** ตัวเลขจริงของชุดสอบปีนั้น + ปุ่มให้ AI อธิบายว่ายากตรงไหน
    ตัวเลขทุกตัวมาจากข้อมูลชุดสอบที่บันทึกไว้ ไม่ได้ให้ AI เดา
    ส่วนที่เป็นความเห็นของ AI แยกกล่องและกำกับที่มาไว้ชัด */
function examPressureCard(year) {
  if (!EXAM_CORPUS_LOADED && Cloud.signedIn()) loadExamCorpus().then(() => { if (EXAM_CORPUS_LOADED && location.hash === '#/test/' + year) render(); });
  const x = typeof examPressure === 'function' ? examPressure(year) : null;
  if (!x) return '';
  const pred = predictedAlevel();
  const rows = [
    x.q ? ['จำนวนข้อ', x.q + ' ข้อ'] : null,
    x.minutes ? ['เวลา', x.minutes + ' นาที'] : null,
    x.secPerQ ? ['เฉลี่ยต่อข้อ', x.secPerQ + ' วินาที'] : null,
    ['ความยาวข้อสอบ', x.pages + ' หน้า'],
    x.avgSteps ? ['ขั้นคิดเฉลี่ยของข้อที่ประเมินได้ (AI)', x.avgSteps + ' ขั้น'] : null,
    x.hardShare != null ? ['ข้อยากในกลุ่มที่ประเมินได้ (AI)', Math.round(x.hardShare * 100) + '%'] : null
  ].filter(Boolean);
  return `<div class="teachcard">
    <div class="k">ชุดนี้กดดันแค่ไหน — จากตัวเลขของชุดจริง</div>
    <p class="note">${x.corpus ? `อ่านจากเอกสารแล้ว ${x.corpus.counted} ข้อ · ประเมินความยากได้ ${x.corpus.ratedCount} ข้อ · รอตรวจ ${x.corpus.reviewCount} ข้อ · ${x.corpus.coverage === 'complete' ? 'จำนวนข้อครบ' : 'ข้อมูลยังไม่ครบ'} · ความยากเป็นค่าประเมินของ AI ยังไม่ปรับเทียบกับผลสอบจริง` : 'ยังไม่มีข้อมูลข้อสอบที่อ่านจากฐานข้อมูล — ไม่แสดงค่าความยากที่เดาไว้'}</p>
    <ul class="teachlist">${rows.map(r => `<li>${esc(r[0])}: ${esc(r[1])}</li>`).join('')}</ul>
    ${x.focus.length ? `<p class="note">บทที่เน้นในปีนี้: ${esc(x.focus.join(', '))}</p>` : ''}
    <p class="note">สัดส่วนตามสาระ: ${x.strands.map(s => esc(s.name) + ' ' + esc(s.share)).join(' · ')}</p>
    ${pred ? `<p class="note">Pre-test ในแอป ${pred.pct}% · ไม่ใช่คะแนนคาดการณ์ A-Level</p>` : ''}
    <div class="row" style="margin-top:10px">
      <button class="btn sm" onclick="runExamWhy(${x.year})">ให้ AI วิเคราะห์ว่ายากตรงไหน</button>
      <button class="btn ghost sm" onclick="askFromExam(${x.year})">มีข้อจากชุดนี้ ให้เทียบความยากรายข้อ</button>
    </div>
    <div id="examWhy"></div>
  </div>`;
}

async function runExamWhy(year) {
  await loadExamCorpus();
  const box = $('#examWhy');
  if (!box) return;
  if (!Cloud.signedIn()) return go('#/auth/signin');
  box.innerHTML = '<p class="note" style="margin-top:10px">กำลังวิเคราะห์ชุดปี ' + year + '…</p>';
  try {
    const text = await analyzeExamYear(year);
    box.innerHTML = `<div class="banner" style="margin-top:10px">วิเคราะห์จากโครงข้อสอบและผลของคุณ ไม่ใช่การอ่านข้อจริงข้อต่อข้อ</div>
      <p style="white-space:pre-wrap;margin-top:8px">${esc(text)}</p>`;
    renderMath(box);
  } catch (e) {
    box.innerHTML = '<div class="banner" style="margin-top:10px">วิเคราะห์ไม่สำเร็จ: ' + esc(e.message) + '</div>';
  }
}

/** พาไปหน้าถามโจทย์ พร้อมบอกว่ามาจากชุดปีไหน — ผู้ใช้พิมพ์หรือถ่ายข้อจากกระดาษจริงเอง
    ไฟล์ข้อสอบไม่ได้อยู่ในแอปเพราะลิขสิทธิ์ ทปอ./สทศ. */
function askFromExam(year) {
  window._askQ = { q: '', source: 'exam' + year, back: '#/test/' + year };
  go('#/askq');
}

/** งานในแผนที่ตกลงกับ AI ไว้ — กดแล้วเข้าไปทำได้จริง ไม่ใช่รายการให้อ่านเฉยๆ */
function planItemsCard() {
  const items = (S.studyPlan && S.studyPlan.items) || [];
  if (!items.length) {
    return `<div class="teachcard">
      <div class="k">งานในแผน</div>
      <p class="note">ยังไม่มีงานที่ตกลงไว้ — คุยกับ AI Planner ได้เลยว่าอยากเรียนอะไรก่อน
        อยากฝึกโจทย์เพิ่ม หรืออยากได้งานประยุกต์ที่รวมหลายบท แผนจะเปลี่ยนตามที่ตกลงกัน</p>
    </div>`;
  }
  const kindName = { learn: 'เนื้อหา', drill: 'ฝึกโจทย์', applied: 'ประยุกต์ข้ามบท', test: 'สอบท้ายบท', mock: 'ข้อสอบเสมือน' };
  const rows = items.map((it, i) => {
    const names = it.topics.map(id => (alevelTopic(id) || {}).name).filter(Boolean).join(' + ');
    const label = it.name || names || kindName[it.kind];
    return `<button class="topicrow" onclick="runPlanItem(${i})">
      <span>
        <span class="t">${esc(label)}</span>
        <span class="d">${esc(kindName[it.kind] || it.kind)}${names ? ' · ' + esc(names) : ''}${it.why ? ' · ' + esc(it.why) : ''}</span>
      </span>
      <span class="go">ทำ</span>
    </button>`;
  }).join('');
  return `<div class="teachcard">
    <div class="k">งานในแผน — เนื้อหา + ฝึกโจทย์ + ประยุกต์</div>
    <p class="note" style="margin-bottom:10px">คะแนน A-Level มาจากการทำโจทย์ด้วย แผนจึงไม่ได้มีแค่บทให้อ่าน</p>
    ${rows}
  </div>`;
}

function runPlanItem(i) {
  const it = ((S.studyPlan && S.studyPlan.items) || [])[i];
  if (!it) return;
  const first = it.topics[0];
  if (it.kind === 'mock') return go('#/mock');
  if (it.kind === 'applied') return startAppliedLesson(it.topics, it.name);
  if (it.kind === 'test') return startTopicTest(first);
  if (it.kind === 'drill') return goDrill('#/drill/' + first + '/_topic');
  return go('#/topic/' + first);
}

/* ---------- หน้ากระดานจัดอันดับ ----------
   ขึ้นกระดานด้วยนามแฝงเท่านั้น ไม่มีชื่อจริง อีเมล โรงเรียน หรือชั้นเรียนโผล่ที่ไหน
   คนที่ไม่ติด 100 อันดับแรกยังเห็นอันดับตัวเอง และเห็นอยู่คนเดียว */
/* หมวดของกระดาน — ใช้ข้อมูลชุดเดียวกันทุกหมวด ต่างกันแค่จัดเรียงด้วยอะไร
   unit = หน่วยของตัวเลขที่ใช้จัดอันดับ · detail = ตัวเลขประกอบไว้ให้เห็นที่มา */
const BOARD_CATS = [
  { id: 'effort',    name: 'ความพยายาม', icon: '🔥',
    sub: 'รวมความสม่ำเสมอ เวลาฝึก และจำนวนข้อเข้าด้วยกัน',
    unit: 'แต้ม', detail: x => x.active_days + ' วัน · ' + x.questions + ' ข้อ' },
  { id: 'improve',   name: 'พัฒนาการ', icon: '📈',
    sub: 'คะแนนที่ขยับขึ้นจากครั้งแรกที่วัด',
    unit: 'คะแนน', plus: true, detail: x => x.first_score + ' → ' + x.best_score },
  { id: 'streak',    name: 'ต่อเนื่อง', icon: '📅',
    sub: 'จำนวนวันติดกันที่ยังไม่ขาด',
    unit: 'วันติด', detail: x => x.active_days + ' วันรวม' },
  { id: 'days',      name: 'วันสะสม', icon: '🗓️',
    sub: 'นับเฉพาะวันที่เข้ามาทำจริง วันละครั้ง',
    unit: 'วัน', detail: x => x.questions + ' ข้อ' },
  { id: 'questions', name: 'จำนวนข้อ', icon: '✍️',
    sub: 'ข้อที่ทำจบแล้ว ทั้งฝึกและสอบ',
    unit: 'ข้อ', detail: x => x.minutes + ' นาที' },
  { id: 'minutes',   name: 'เวลาฝึก', icon: '⏱️',
    sub: 'เวลาที่ใช้ฝึกจริงในแอป',
    unit: 'นาที', detail: x => x.questions + ' ข้อ' }
];
function boardCat(id) { return BOARD_CATS.find(c => c.id === id) || BOARD_CATS[0]; }

let BOARD = { kind: 'effort', rows: null, mine: null, busy: false, error: '' };

function viewBoard(app, r) {
  const cat = boardCat(r && r.a);
  const kind = cat.id;
  if (BOARD.kind !== kind) BOARD = { kind: kind, rows: null, mine: null, busy: false, error: '' };
  const b = boardState();

  if (!Cloud.signedIn()) {
    app.innerHTML = `
      ${breadcrumb([['หน้าแรก', '#/dashboard'], ['กระดานจัดอันดับ', null]])}
      <h1>กระดานจัดอันดับ</h1>
      <p class="sub">ต้องเข้าสู่ระบบก่อน เพราะอันดับผูกกับบัญชีของคุณ · บนกระดานแสดงเฉพาะนามแฝง</p>
      <button class="btn" onclick="go('#/auth/signin')">เข้าสู่ระบบ</button>`;
    return;
  }

  if (!BOARD.rows && !BOARD.busy && !BOARD.error) loadBoard(kind);

  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['อันดับ', null]])}
    <h1>กระดานจัดอันดับ</h1>
    <p class="sub">100 อันดับแรกของแต่ละหมวด · ไม่ติดกระดานก็ยังเห็นอันดับตัวเอง</p>
    <div class="boardcats">
      ${BOARD_CATS.map(c => `<button class="boardcat ${c.id === kind ? 'on' : ''}" onclick="go('#/board/${c.id}')">
        <span class="bc-ic">${c.icon}</span><span>${c.name}</span></button>`).join('')}
    </div>
    <p class="note" style="margin:10px 0 14px">${esc(cat.icon + ' ' + cat.name + ' — ' + cat.sub)}</p>
    ${myRankCard(kind)}
    ${boardAliasCard(b)}
    ${BOARD.error ? `<div class="banner">${esc(BOARD.error)}</div>` : ''}
    ${BOARD.busy ? '<p class="note">กำลังโหลดกระดาน…</p>' : boardTable(kind)}
    <p class="note" style="margin-top:14px">กระดานนี้แสดงเฉพาะนามแฝงกับตัวเลขความก้าวหน้า
      ไม่แสดงชื่อจริง อีเมล โรงเรียน หรือระดับชั้นของใครทั้งสิ้น</p>`;
}

async function loadBoard(kind) {
  BOARD.busy = true;
  try {
    const [rows, mine] = await Promise.all([Cloud.fetchBoard(kind), Cloud.myRanks()]);
    BOARD.rows = rows || [];
    BOARD.mine = mine;
    BOARD.error = '';
  } catch (e) {
    BOARD.error = e.message || 'โหลดกระดานไม่สำเร็จ';
  } finally {
    BOARD.busy = false;
    render();
  }
}

/** อันดับของตัวเอง — ไม่ติดกระดานก็ยังเห็น และเห็นคนเดียว เพราะดึงจาก RPC ของบัญชีตัวเอง */
function myRankCard(kind) {
  const cat = boardCat(kind);
  const me = (BOARD.mine || {})[kind];
  if (!me || !me.rank) {
    return `<div class="card"><div class="k">อันดับของคุณ</div>
      <p class="note" style="margin-top:6px">${kind === 'improve'
        ? 'ต้องมีคะแนนตั้งต้นจาก Pre-test และคะแนนใหม่อย่างน้อยหนึ่งครั้ง จึงจะจัดอันดับหมวดนี้ได้'
        : 'ทำโจทย์หรือสอบสักรอบ แล้วอันดับหมวดนี้จะขึ้นมาที่นี่'}</p></div>`;
  }
  const onBoard = me.rank <= 100;
  const others = BOARD_CATS.filter(c => c.id !== kind)
    .map(c => ({ c: c, r: (BOARD.mine || {})[c.id] }))
    .filter(x => x.r && x.r.rank);
  return `<div class="card">
    <div class="k">อันดับของคุณ · ${esc(cat.name)}${onBoard ? ' · อยู่บนกระดาน' : ' · เห็นคนเดียว'}</div>
    <div class="v" style="font-size:22px">อันดับ ${me.rank} จาก ${me.total} คน</div>
    <p class="note" style="margin-top:6px">${(cat.plus ? '+' : '') + me.value} ${esc(cat.unit)}${onBoard ? '' : ' · ยังไม่ติด 100 อันดับแรก อันดับนี้ไม่มีใครเห็นนอกจากคุณ'}</p>
    ${others.length ? `<p class="note" style="margin-top:8px">หมวดอื่นของคุณ:
      ${others.map(x => esc(x.c.name) + ' อันดับ ' + x.r.rank).join(' · ')}</p>` : ''}
  </div>`;
}

function boardAliasCard(b) {
  return `<div class="teachcard">
    <div class="k">นามแฝงบนกระดาน</div>
    <p class="note" style="margin-bottom:8px">ใช้ชื่ออะไรก็ได้ที่ไม่ใช่ชื่อจริง ไม่ต้องใส่โรงเรียนหรือห้อง</p>
    <input type="text" id="boardAlias" maxlength="24" value="${esc(b.alias || '')}" placeholder="เช่น นักคิดหมายเลข 7">
    <div class="row" style="margin-top:10px">
      <button class="btn sm" onclick="saveBoardAlias()">บันทึกนามแฝง</button>
      <button class="btn ghost sm" onclick="toggleBoardJoin()">${b.joined === false ? 'กลับเข้าร่วมกระดาน' : 'ออกจากกระดาน'}</button>
    </div>
    ${b.joined === false ? '<p class="note" style="margin-top:8px">ตอนนี้คุณไม่อยู่บนกระดาน ระบบยังนับความก้าวหน้าให้ แต่ไม่มีใครเห็น</p>' : ''}
  </div>`;
}

function boardTable(kind) {
  const rows = BOARD.rows || [];
  const cat = boardCat(kind);
  if (!rows.length) return '<p class="note">ยังไม่มีใครขึ้นกระดานหมวดนี้ เป็นคนแรกได้เลย</p>';
  const mine = (boardState().alias || '').trim();
  return `<div class="teachcard" style="padding:0">
    <table class="boardtable"><tbody>
      ${rows.map(x => `<tr class="${mine && x.alias === mine ? 'me' : ''}">
        <td class="rk">${x.rank}</td>
        <td>${esc(x.alias)}</td>
        <td class="val">${(cat.plus ? '+' : '') + x.value} <span class="unit">${esc(cat.unit)}</span></td>
        <td class="sub2">${esc(cat.detail(x))}</td>
      </tr>`).join('')}
    </tbody></table>
  </div>`;
}

function saveBoardAlias() {
  const el = $('#boardAlias');
  const v = ((el && el.value) || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (v.length < 2) return toast('นามแฝงต้องยาวอย่างน้อย 2 ตัวอักษร');
  if (v.indexOf('@') >= 0) return toast('อย่าใช้อีเมลเป็นนามแฝง');
  const b = boardState();
  b.alias = v;
  save();
  pushBoard();
  toast('บันทึกนามแฝงแล้ว');
  BOARD.rows = null;
  render();
}

function toggleBoardJoin() {
  const b = boardState();
  b.joined = b.joined === false;
  save();
  pushBoard();
  toast(b.joined ? 'กลับเข้าร่วมกระดานแล้ว' : 'ออกจากกระดานแล้ว — ไม่มีใครเห็นคุณบนกระดาน');
  BOARD.rows = null;
  render();
}

function viewPlanner(app) {
  const gaps = planTopicIds().map(alevelTopic).filter(Boolean);
  const lp = S.lastPretest;
  const sch = studySchedule();
  const next = personalizedTopics().find(t => !((S.progress[t.id] || {}).stars));
  const openGaps = gaps.filter(t => !((S.progress[t.id] || {}).stars));
  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['AI Planner', null]])}
    <h1>แผนเรียนของคุณ</h1>
    <p class="sub">สรุปว่าควรเรียนอะไร ตอนไหน — แทรกบทที่ Pre-test ยังไม่ผ่าน แม้บทนั้นจะไม่อยู่ต้นทางปกติ</p>
    ${!lp ? `<div class="banner">ยังไม่มี Pre-test —
      <a href="#/pretest" style="color:var(--pen-blue)">ทำก่อน</a>
      จึงจะรู้ว่าต้องแทรกบทไหน (เช่น พหุนาม)</div>` : ''}
    <div class="plansummary">
      <div class="plancols">
        <div class="card">
          <div class="k">เวลาที่ควรเรียน</div>
          <div class="v">${sch.hours} ชม./วัน</div>
          <ul class="weekslots">${sch.slots.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          <p class="note">เหลือประมาณ ${sch.months} เดือนถึงสนาม${sch.fromAi ? ' · ปรับจากที่คุยกับ AI แล้ว' : ''}</p>
          ${sch.note ? `<p class="note">${esc(sch.note)}</p>` : ''}
        </div>
        <div class="card">
          <div class="k">จุดอ่อนที่แทรกเข้าแผน</div>
          <div class="v">${openGaps.length ? openGaps.length + ' บท' : '—'}</div>
          <p class="note">${openGaps.length
            ? openGaps.map(t => t.name).join(' · ')
            : (lp ? 'Pre-test ' + lp.scorePct + '% — ไม่มีบทที่ต้องแทรก' : 'ทำ Pre-test แล้วระบบจะแทรกบทที่พลาด')}</p>
        </div>
      </div>
      ${renderPlanDots()}
      ${planItemsCard()}
      <h2 class="strandlabel">ลำดับที่ควรเรียน</h2>
      ${renderPlanPath()}
    </div>
    <div class="row" style="margin-top:16px">
      <button class="btn" onclick="openPlannerChat()">คุยกับ AI เพื่อปรับแผน</button>
      ${next ? `<button class="btn ghost" onclick="go('#/topic/${next.id}')">เริ่ม: ${esc(next.name)}</button>` : ''}
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" onclick="go('#/askq')">อัปโหลดโจทย์มาถาม</button>
      <button class="btn ghost sm" onclick="go('#/mock')">ไป Mock Test</button>
      <button class="btn ghost sm" onclick="go('#/board')">กระดานจัดอันดับ</button>
    </div>`;
}

let MOCK = null;

let MOCK_LOADING = false;

function viewMock(app) {
  // ข้อสอบจริงอ่านคำชี้แจงก่อนเสมอ เริ่มจับเวลาต่อเมื่อผู้เข้าสอบกดยืนยันเอง
  if (!MOCK && !MOCK_STARTING) return mockBrief(app);
  if (!MOCK) {
    mockLoading(app);
    if (!MOCK_LOADING) startMock(Cloud.signedIn());
    return;
  }
  if (MOCK.stage === 'done') return mockDone(app);
  mockQuestion(app);
}

/** ผู้เข้าสอบกดยืนยันแล้วเท่านั้นถึงเริ่มจัดชุด — แยกจาก MOCK เพราะตอนนั้น MOCK ยังไม่มี */
let MOCK_STARTING = false;

/** คำชี้แจงก่อนสอบ — บอกกติกาให้ครบก่อนเริ่มจับเวลา ไม่ใช่ไปเจอเอาตอนสอบ */
function mockBrief(app) {
  const f = examFormat();
  // เริ่มออกข้อสอบตั้งแต่เปิดหน้าคำชี้แจง กว่าจะอ่านจบชุดมักพร้อมแล้ว
  prefetchMockSet();
  app.innerHTML = `
    ${breadcrumb([['Test', '#/test'], ['ข้อสอบเสมือนจริง', null]])}
    <h1>ข้อชี้แนะก่อนสอบ</h1>
    <p class="sub">อ่านให้ครบก่อนกดเริ่ม เวลาจะเดินทันทีที่กดยืนยัน</p>
    <div class="teachcard">
      <div class="k">รูปแบบข้อสอบ</div>
      <ul class="tlist">
        <li>${f.questions} ข้อ · ${f.minutes} นาที${f.year ? ' — เท่าข้อสอบจริงปี ' + f.year : ''}</li>
        <li>ปรนัย 5 ตัวเลือก และแบบเติมคำตอบ ปนกันเหมือนของจริง บางข้อมีกราฟหรือตารางประกอบ</li>
        <li>ความยากอ้างอิงจากข้อสอบจริงที่ระบบอ่านมา ไม่ใช่ระดับแบบฝึกหัด</li>
      </ul>
    </div>
    <div class="teachcard">
      <div class="k">ระหว่างสอบ</div>
      <ul class="tlist">
        <li>ย้อนกลับ ข้าม และกลับมาแก้ข้อเดิมได้ จนกว่าจะกดส่ง</li>
        <li>ไม่มีตัวช่วย ไม่เฉลยรายข้อ ถามติวเตอร์ได้หลังส่งข้อสอบแล้ว</li>
        <li>หมดเวลาระบบส่งให้อัตโนมัติ ออกกลางคันได้แต่ต้องยืนยันก่อน</li>
      </ul>
    </div>
    <div class="teachcard">
      <div class="k">ระบบตรวจความสุจริต</div>
      <ul class="tlist">
        <li>ระบบนับการสลับแท็บหรือออกจากหน้าจอ การวางข้อความจากที่อื่น และการตอบเร็วผิดปกติ</li>
        <li>ไม่บล็อกอะไร แต่จะแจ้งไว้ในผลสอบ เพราะคะแนนที่ได้แบบนั้นไม่สะท้อนความสามารถจริง</li>
      </ul>
    </div>
    <div class="banner">คะแนนนี้เป็นการประเมินในแอป ไม่ใช่คะแนน A-Level ที่ปรับเทียบแล้ว</div>
    ${mockReadyNote()}
    <button class="btn" onclick="mockConfirmStart()">${(typeof readMockCache === 'function' && readMockCache())
      ? 'พร้อมสอบ — เริ่มเลย' : 'ยืนยันและเริ่มทำข้อสอบ'}</button>
    <div style="height:10px"></div>
    <button class="btn ghost" onclick="go('#/test')">ยังไม่พร้อม กลับก่อน</button>`;
}

/** ขออนุญาตแจ้งเตือนตอนผู้ใช้สั่งงานเอง ไม่ใช่ตอนเปิดแอปลอยๆ */
function askNotifyPermission() {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    Notification.requestPermission().then(p => {
      if (p === 'granted') toast('เปิดแจ้งเตือนแล้ว จะบอกเมื่อข้อสอบพร้อม');
      if (location.hash === '#/mock' && !MOCK) render();
    });
  } catch (e) { /* เบราว์เซอร์ไม่รองรับก็ข้ามไป */ }
}

/** ปุ่มขอสิทธิ์แจ้งเตือน — Chrome ยอมให้ขอเฉพาะตอนผู้ใช้กดเอง
    เรียกตอนวาดหน้าเฉยๆ จะถูกปฏิเสธเงียบ ผู้ใช้จึงไม่เคยได้รับแจ้งเตือน */
function notifyOptInRow() {
  if (typeof Notification === 'undefined') return '';
  if (Notification.permission === 'granted') return '<p class="note">จะแจ้งเตือนให้เมื่อข้อสอบพร้อม</p>';
  if (Notification.permission === 'denied') return '<p class="note">แจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ ต้องเปิดจากการตั้งค่าเว็บไซต์</p>';
  return '<button class="btn ghost sm" style="width:auto" onclick="askNotifyPermission()">เปิดแจ้งเตือนเมื่อข้อสอบพร้อม</button>';
}

/** ชุดพร้อมแล้ว — แจ้งเตือนระบบถ้าผู้ใช้สลับแท็บไป ไม่งั้นแค่ toast แล้ววาดปุ่มใหม่ */
function notifyMockReady() {
  const msg = 'ข้อสอบพร้อมแล้ว กลับมาเริ่มสอบได้เลย';
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      new Notification('SoftOmni', { body: msg, tag: 'mockready' });
    }
  } catch (e) { /* แจ้งเตือนไม่ได้ก็ไม่เป็นไร */ }
  if (typeof toast === 'function') toast(msg);
  if (location.hash === '#/mock' && !MOCK) render();
}

/** บอกตรงๆ ว่าชุดพร้อมหรือยัง จะได้ไม่กดแล้วงงว่าทำไมต้องรอ */
function mockReadyNote() {
  if (typeof Cloud === 'undefined' || !Cloud.signedIn()) {
    return '<div class="banner warn">ยังไม่ได้เข้าสู่ระบบ จะได้ข้อจากคลังในเครื่องซึ่งง่ายกว่าและมีโอกาสซ้ำ</div>';
  }
  if (readMockCache()) {
    return '<div class="banner ready">ชุดข้อสอบพร้อมแล้ว — กดเริ่มได้ทันที ไม่ต้องรอ</div>';
  }
  const p = MOCK_PREFETCH;
  if (p && !p.settled) {
    return '<div class="banner"><b>AI กำลังออกข้อสอบให้อยู่</b> ' +
      '<span id="prepCount">' + p.done + '/' + p.total + ' ข้อ</span>' +
      '<p class="note" style="margin:6px 0 0">สลับไปทำอย่างอื่นได้เลย ระบบทำต่อให้เบื้องหลัง ' +
      'เสร็จแล้วปุ่มจะเปลี่ยนเป็นพร้อมสอบ</p>' + notifyOptInRow() + '</div>';
  }
  if (p && p.error) return '<div class="banner warn">ออกข้อสอบไม่สำเร็จ: ' + esc(p.error) + '</div>';
  return '';
}

function mockConfirmStart() {
  if (!confirm('เริ่มจับเวลาทันทีที่กดตกลง พร้อมแล้วใช่ไหม')) return;
  MOCK_STARTING = true;
  render();
}

/* ออกข้อให้ยากเท่าของจริงกินเวลาถึงสองนาที ถ้าหน้าจอนิ่งผู้เรียนจะนึกว่าค้าง
   จึงบอกเป็นขั้นว่ากำลังทำอะไรอยู่ */
const PREP_STEPS = [
  'อ่านโครงข้อสอบจริงจากคลัง…',
  'เทียบระดับความยากกับข้อสอบปีที่ผ่านมา…',
  'ให้ AI ออกข้อให้ยากเท่าของจริง…',
  'ตรวจว่าแต่ละข้อจบในตัว ไม่อ้างข้ออื่น…',
  'จัดลำดับข้อตามสัดส่วนสาระ…'
];

function mockLoading(app) {
  const f = examFormat();
  app.innerHTML = `
    <div class="mockloading">
      <div class="prepring" aria-hidden="true"><span></span><span></span><span></span></div>
      <h2>AI กำลังเตรียมข้อสอบให้คุณ</h2>
      <p class="prepstep" id="prepStep">${PREP_STEPS[0]}</p>
      <p class="note">ออกแล้ว <b id="prepCount">${MOCK_PREFETCH ? MOCK_PREFETCH.done + '/' + MOCK_PREFETCH.total : '0/' + f.questions} ข้อ</b></p>
      <p class="note">${f.questions} ข้อ · ${f.minutes} นาที${f.year ? ' · เท่าข้อสอบจริงปี ' + f.year : ''}</p>
      <p class="note">ใช้เวลาประมาณ 2–4 นาที อย่าเพิ่งปิดหน้านี้</p>
      <button class="btn ghost sm" onclick="quitMock()">ยกเลิก</button>
    </div>`;
  clearInterval(window._prepTimer);
  let i = 0;
  window._prepTimer = setInterval(() => {
    const el = $('#prepStep');
    if (!el) return clearInterval(window._prepTimer);
    i = (i + 1) % PREP_STEPS.length;
    el.textContent = PREP_STEPS[i];
  }, 4000);
}

async function startMock(useAi) {
  MOCK_LOADING = true;
  const f = examFormat();
  let qs = null;
  let source = 'local';
  // คลังในเครื่องมีข้อไม่ซ้ำแค่ราว 50 ข้อ ถ้าตกมาใช้บ่อยผู้เรียนจะเจอข้อเดิมซ้ำ
  // จึงต้องบอกทุกครั้งว่าทำไมไม่ได้ใช้ AI ไม่ใช่เงียบแล้วแจกข้อซ้ำ
  let aiError = useAi ? '' : 'ยังไม่ได้เข้าสู่ระบบ จึงใช้คลังข้อในเครื่อง';
  try {
    if (useAi) {
      try {
        const aiQs = await takeMockSet();
        if (aiQs && aiQs.length >= 8) { qs = aiQs; source = 'ai'; }
        else aiError = 'AI ออกได้ ' + ((aiQs && aiQs.length) || 0) + ' ข้อ น้อยเกินไป';
      } catch (e) {
        aiError = e && e.message ? e.message : 'เรียก AI ไม่สำเร็จ';
        console.error('ออกข้อสอบด้วย AI ไม่สำเร็จ:', e);
      }
    }
    if (!qs || !qs.length) qs = localMockQuestions(f.questions);
    if (aiError) toast('ใช้คลังข้อแทน: ' + aiError);
    MOCK = {
      // given[i] คือคำตอบของข้อที่ i (null = ยังไม่ตอบ) เก็บตามตำแหน่ง ไม่ใช่ต่อท้าย
      // จะได้ย้อนกลับไปแก้ข้อเดิมได้เหมือนกระดาษคำตอบจริง
      qs: qs.slice(0, f.questions), i: 0, given: [], stage: 'exam',
      startedAt: Date.now(), qAt: Date.now(),
      // กำหนดเส้นตายตั้งแต่เริ่ม เวลาจะได้ไม่ถูกยืดเวลารีเฟรชหน้า
      deadline: Date.now() + f.minutes * 60000,
      limitMin: f.minutes, examYear: f.year,
      flagged: [], asked: [], source: source, aiError: aiError,
      sus: { blurs: 0, pastes: 0, fast: 0 }
    };
    susWatch(true);
  } finally {
    MOCK_LOADING = false;
    clearInterval(window._prepTimer);
  }
  render();
}

function mockHasAnswer(i) {
  const g = MOCK.given[i];
  return g !== null && g !== undefined && g !== '';
}
function mockAnsweredCount() {
  return MOCK.qs.reduce((s, _, i) => s + (mockHasAnswer(i) ? 1 : 0), 0);
}

function mockQuestion(app) {
  const q = MOCK.qs[MOCK.i];
  const done = mockAnsweredCount();
  const pct = done / MOCK.qs.length * 100;
  const THAI_LABELS = ['ก.', 'ข.', 'ค.', 'ง.', 'จ.'];
  const topic = alevelTopic(q._topic);
  const given = MOCK.given[MOCK.i];
  const isMc = q.t === 'mc' && q.c && q.c.length;
  const last = MOCK.i === MOCK.qs.length - 1;
  app.innerHTML = `
    ${breadcrumb([['Test', '#/test'], ['ข้อสอบเสมือนจริง', null]])}
    <div class="row" style="align-items:center;margin-bottom:12px">
      <button class="backbtn" onclick="quitMock()" aria-label="ออกจากข้อสอบ">✕</button>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <span class="pill">ข้อ ${MOCK.i + 1}/${MOCK.qs.length}</span>
      <span class="pill" id="pTimer">00:00</span>
    </div>
    <p class="note">${topic ? esc(topic.name) : ''} · ${esc(q._strand || '')} · ตอบแล้ว ${done} ข้อ</p>
    <div class="qcard">
      <p class="qtext">${esc(q.q)}</p>
      ${questionFigure(q)}
      ${isMc
        ? `<div class="choices">${q.c.map((c, i) =>
            `<button class="choice${given === i ? ' sel' : ''}" id="pch${i}" data-label="${THAI_LABELS[i] || (i+1)+'.'}"
              onclick="mockPick(${i})"><span>${esc(c)}</span></button>`).join('')}</div>`
        : `<input type="text" id="pAns" inputmode="decimal" placeholder="พิมพ์คำตอบ"
             value="${given === null || given === undefined ? '' : esc(String(given))}">`}
    </div>
    <p class="note" style="margin-top:10px">ระหว่างสอบไม่มีตัวช่วยและไม่เฉลย · กลับมาแก้ข้อเดิมได้จนกว่าจะกดส่ง</p>
    <div class="examnav">
      <button class="btn ghost sm" onclick="mockGo(-1)" ${MOCK.i === 0 ? 'disabled' : ''}>ย้อนกลับ</button>
      <button class="btn ghost sm" onclick="mockGo(1, true)" ${last ? 'disabled' : ''}>ข้าม</button>
      <button class="btn sm" onclick="mockGo(1)">${last ? 'บันทึกคำตอบ' : 'ถัดไป'}</button>
    </div>
    <div style="height:12px"></div>
    <button class="btn ghost" onclick="mockAskFinish()">ส่งข้อสอบ</button>`;
  MOCK.qAt = Date.now();
  renderMath(app);
  armMockClock();
}

/** เดินข้อ — บันทึกคำตอบข้อปัจจุบันก่อนเสมอ ยกเว้นสั่งข้าม
    ข้อสุดท้ายไม่เด้งไปหน้าสรุปเอง ต้องกดส่งเองเหมือนห้องสอบจริง */
function mockGo(delta, skip) {
  if (!skip) mockSaveCurrent();
  const next = MOCK.i + delta;
  if (next < 0 || next >= MOCK.qs.length) return render();
  MOCK.i = next;
  render();
}

/** อ่านคำตอบจากหน้าจอเก็บลงช่องของข้อนี้ ตัวเลือกเก็บตอนกดไปแล้ว เหลือแบบพิมพ์ */
function mockSaveCurrent() {
  if (!MOCK || MOCK.stage !== 'exam') return;
  const q = MOCK.qs[MOCK.i];
  if (q.t === 'mc' && q.c && q.c.length) return;
  const el = $('#pAns');
  if (!el) return;
  const v = el.value.trim();
  if (v !== '' && Date.now() - (MOCK.qAt || Date.now()) < SUS_FAST_MS) MOCK.sus.fast++;
  MOCK.given[MOCK.i] = v === '' ? null : v;
}

/** ยืนยันก่อนส่ง บอกให้เห็นก่อนว่ายังมีข้อค้างกี่ข้อ ส่งแล้วกู้ไม่ได้ */
function mockAskFinish() {
  mockSaveCurrent();
  const left = MOCK.qs.length - mockAnsweredCount();
  const warn = left
    ? 'ยังไม่ได้ตอบ ' + left + ' ข้อ ข้อที่ไม่ได้ตอบจะถูกนับว่าผิด' + String.fromCharCode(10)
    : '';
  if (!confirm(warn + 'ส่งข้อสอบให้ระบบตรวจ ส่งแล้วแก้ไม่ได้ ยืนยันไหม')) return;
  MOCK.stage = 'done';
  render();
}

/** รูปประกอบโจทย์ — ข้อสอบจริงมีกราฟ ระบบจึงต้องวาดได้ ไม่ใช่มีแต่ข้อความ
    AI ส่ง fig มาเป็นสเปกสั้นๆ แล้ววาดเป็น SVG ฝั่งเรา จะได้คมทุกจอและไม่ต้องโหลดรูป */
function questionFigure(q) {
  const f = q && q.fig;
  if (!f || typeof f !== 'object') return '';
  const W = 320, H = 220, PAD = 26;
  const dom = Array.isArray(f.domain) && f.domain.length === 2 ? f.domain : [-5, 5];
  const pts = [];
  if (f.kind === 'graph' && typeof f.fn === 'string') {
    const fn = compileFigFn(f.fn);
    if (!fn) return '';
    const steps = 120;
    for (let k = 0; k <= steps; k++) {
      const x = dom[0] + (dom[1] - dom[0]) * k / steps;
      const y = fn(x);
      if (Number.isFinite(y)) pts.push([x, y]);
    }
  } else if (f.kind === 'points' && Array.isArray(f.pts)) {
    f.pts.forEach(p => { if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) pts.push([p[0], p[1]]); });
  }
  if (pts.length < 2) return '';
  const ys = pts.map(p => p[1]);
  const yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
  const yPad = (yMax - yMin) * 0.1 || 1;
  const sx = x => PAD + (x - dom[0]) / (dom[1] - dom[0]) * (W - PAD * 2);
  const sy = y => H - PAD - (y - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad)) * (H - PAD * 2);
  const path = pts.map((p, k) => (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join(' ');
  const zeroY = (yMin - yPad) <= 0 && 0 <= (yMax + yPad) ? sy(0) : null;
  const zeroX = dom[0] <= 0 && 0 <= dom[1] ? sx(0) : null;
  return `<figure class="qfig">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(f.alt || 'กราฟประกอบโจทย์')}">
      ${zeroY !== null ? `<line x1="${PAD}" y1="${zeroY.toFixed(1)}" x2="${W - PAD}" y2="${zeroY.toFixed(1)}" class="qfig-axis"/>` : ''}
      ${zeroX !== null ? `<line x1="${zeroX.toFixed(1)}" y1="${PAD}" x2="${zeroX.toFixed(1)}" y2="${H - PAD}" class="qfig-axis"/>` : ''}
      ${f.kind === 'points'
        ? pts.map(p => `<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="3" class="qfig-dot"/>`).join('')
        : `<path d="${path}" class="qfig-line"/>`}
    </svg>
    ${f.alt ? `<figcaption>${esc(f.alt)}</figcaption>` : ''}
  </figure>`;
}

/** แปลงสูตรจาก AI เป็นฟังก์ชัน — รับเฉพาะอักขระคณิตศาสตร์ ไม่ให้โค้ดอื่นหลุดเข้ามา */
function compileFigFn(src) {
  const body = String(src).replace(/\^/g, '**');
  if (!/^[-+*/(). 0-9xXa-z]*$/.test(body)) return null;
  const allowed = body.replace(/\b(sin|cos|tan|abs|sqrt|log|exp|x)\b/g, '');
  if (/[a-z]/i.test(allowed)) return null;
  try {
    const fn = new Function('x', 'with (Math) { return (' + body + '); }');
    return Number.isFinite(fn(1)) ? fn : null;
  } catch (e) { return null; }
}

function viewAskQ(app) {
  const pre = window._askQ || {};
  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['ถามโจทย์', null]])}
    <h1>ถามโจทย์ — เทียบ A-Level</h1>
    <p class="sub">แปะหรืออัปโหลดโจทย์ใดก็ได้ (รวมข้อใน Mock) AI จะเทียบความยากกับ A-Level คณิต 1 แล้วแยกเป็นขั้นง่ายกว่า</p>
    ${MathOCR.panel('askOcr', 'askText')}
    <label for="askText">โจทย์</label>
    <textarea id="askText" placeholder="พิมพ์โจทย์ หรือแนบรูป">${esc(pre.q || '')}</textarea>
    <label for="askImg">รูปโจทย์ (ไม่บังคับ)</label>
    <input type="file" id="askImg" accept="image/*" capture="environment">
    <p class="note">${pre.source === 'mock' ? 'มาจากข้อ Mock ปัจจุบัน' : 'ไม่บังคับต้องมีเฉลย — ใช้ถามและวิเคราะห์อย่างเดียว'}</p>
    <div style="height:14px"></div>
    <button class="btn" id="askGo" onclick="runAskAnalyze()">วิเคราะห์ความยาก + แยกขั้น</button>
    <div id="askOut"></div>
    ${pre.back ? `<div style="height:12px"></div><button class="btn ghost" onclick="go('${pre.back}')">กลับข้อเดิม</button>` : ''}`;
}

async function runAskAnalyze() {
  const q = (($('#askText') && $('#askText').value) || '').trim();
  const file = $('#askImg') && $('#askImg').files && $('#askImg').files[0];
  if (!q && !file) return toast('พิมพ์โจทย์หรือแนบรูปก่อน');
  if (!Cloud.signedIn()) return go('#/auth/signin');
  const btn = $('#askGo');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังวิเคราะห์…'; }
  const box = $('#askOut');
  if (box) box.innerHTML = `<p class="note">เทียบกับ A-Level คณิตศาสตร์ประยุกต์ 1 แล้วแยกเป็นขั้นง่าย…</p>`;
  const goAnalyze = async (img) => {
    try {
      const result = await analyzeAndSplit(q || '(โจทย์อยู่ในรูป)', img);
      window._askQ = Object.assign(window._askQ || {}, { q: q, img: img, last: result });
      paintAskResult(result, q);
    } catch (e) {
      if (box) box.innerHTML = `<div class="banner">วิเคราะห์ไม่สำเร็จ: ${esc(e.message)}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'วิเคราะห์ความยาก + แยกขั้น'; }
    }
  };
  if (file) shrinkImage(file, 1000, dataUrl => goAnalyze(dataUrl));
  else goAnalyze(null);
}

function paintAskResult(result, q, boxSel) {
  const box = $(boxSel || '#askOut');
  if (!box) return;
  const parts = result.parts || [];
  box.innerHTML = `
    <div class="card" style="text-align:left;margin-top:16px">
      <div class="k">เทียบ A-Level คณิต 1</div>
      <div class="v" style="font-size:18px">${esc(result.difficulty || '—')}</div>
      ${result.note ? `<p style="margin-top:8px;font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(result.note)}</p>` : ''}
    </div>
    ${parts.length ? `<div class="teachcard">
      <div class="k">แยกข้อยากนี้เป็นขั้นที่ง่ายกว่า — ไล่ทำจากง่ายไปยาก</div>
      <ol class="splitsteps">${parts.map((p, i) =>
        `<li><b>${esc(p.title || ('ขั้นที่ ' + (i + 1)))}</b>
           <p>${esc(p.q || '')}</p>
           ${p.hint ? `<p class="note">ใบ้: ${esc(p.hint)}</p>` : ''}
           <button class="btn ghost sm" onclick="startSplitPart(${i})">ฝึกขั้นนี้กับ AI</button>
         </li>`).join('')}
      </ol>
    </div>` : ''}
    <button class="btn" style="margin-top:8px" onclick="startAskTutor()">คุยโจทย์นี้ทั้งข้อกับ AI</button>`;
  renderMath(box);
}

function startSplitPart(i) {
  const last = window._askQ && window._askQ.last;
  const part = last && last.parts && last.parts[i];
  if (!part) return;
  startQuestionTutor(part.q, part.hint || '', 'ขั้นย่อย');
}

function startAskTutor() {
  const pre = window._askQ || {};
  startQuestionTutor(pre.q || '', '', 'โจทย์ที่ถาม');
}

function startQuestionTutor(qText, hint, label) {
  if (!Cloud.signedIn()) return go('#/auth/signin');
  const pre = window._askQ || {};
  Tutor.ctx = {
    unitId: null, levelId: userClassId(), unitName: label || 'โจทย์ที่ถาม',
    lesson: false, q: qText, correct: null, given: null,
    splitHelp: true, hint: hint || '', back: pre.back || '#/askq'
  };
  Tutor.history = [];
  go('#/tutor');
}

/** นับถอยหลังจากเวลาจริงของข้อสอบ หมดเวลาแล้วส่งให้เองเหมือนห้องสอบ */
function armMockClock() {
  clearInterval(window._pretestClock);
  window._pretestClock = setInterval(() => {
    if (!MOCK || !MOCK.deadline) return clearInterval(window._pretestClock);
    const left = Math.max(0, Math.round((MOCK.deadline - Date.now()) / 1000));
    const el = $('#pTimer');
    if (el) {
      el.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      el.classList.toggle('warn', left <= 300);
    }
    if (left <= 0) {
      clearInterval(window._pretestClock);
      mockSaveCurrent();
      MOCK.timeUp = true;
      MOCK.stage = 'done';
      toast('หมดเวลา ส่งข้อสอบอัตโนมัติ');
      render();
    }
  }, 1000);
}

function mockPick(i) {
  const q = MOCK.qs[MOCK.i];
  if (!(q.c && q.c.length)) return;
  // กดตัวเดิมซ้ำ = ยกเลิกคำตอบ เผื่อเปลี่ยนใจอยากปล่อยว่างไว้ก่อน
  const pick = MOCK.given[MOCK.i] === i ? null : i;
  if (pick !== null && Date.now() - (MOCK.qAt || Date.now()) < SUS_FAST_MS) MOCK.sus.fast++;
  MOCK.given[MOCK.i] = pick;
  q.c.forEach((_, k) => { const el = $('#pch' + k); if (el) el.classList.toggle('sel', k === pick); });
}
/** ออกกลางคันได้ แต่ไม่ทิ้งของที่ทำไปแล้ว — ตรวจจากเท่าที่ทำแล้ววิเคราะห์ให้ */
function quitMock() {
  const leave = () => {
    susWatch(false);
    clearInterval(window._pretestClock);
    clearInterval(window._prepTimer);
    MOCK = null;
    MOCK_STARTING = false;
    go('#/test');
  };
  if (!MOCK || MOCK.stage !== 'exam') return leave();
  mockSaveCurrent();
  const done = mockAnsweredCount();
  if (!done) {
    if (!confirm('ออกตอนนี้ ยังไม่ได้ตอบข้อไหนเลย ข้อสอบชุดนี้จะหายไป ยืนยันไหม')) return;
    return leave();
  }
  if (!confirm('ออกตอนนี้ ระบบจะตรวจจาก ' + done + ' ข้อที่ตอบไปแล้ว ยืนยันไหม')) return;
  MOCK.quitEarly = true;
  MOCK.stage = 'done';
  render();
}
/** ประเมินคะแนน A-Level คร่าวๆ จากคะแนนที่ทำได้
    ชุดที่ AI ออกตามโครงข้อสอบจริงใกล้เคียงของจริงกว่า ชุดจากคลังในเครื่องง่ายกว่า จึงหักลง
    ตัวเลขนี้เป็นการประเมินในแอป ไม่ใช่คะแนนที่ปรับเทียบแล้ว ต้องบอกให้ชัดทุกครั้ง */
function projectAlevelScore(scorePct, fromAi) {
  const full = (typeof examFormat === 'function' ? examFormat().score : 100) || 100;
  const factor = fromAi ? 0.92 : 0.75;   // ชุดคลังง่ายกว่าของจริงมาก จึงหักหนักกว่า
  const est = Math.max(0, Math.min(full, Math.round(scorePct * factor * full / 100)));
  const nat = (typeof ALEVEL_NATIONAL !== 'undefined' && ALEVEL_NATIONAL.pct) || null;
  return { est: est, full: full, national: nat, fromAi: !!fromAi };
}

/** แยกผลรายสาระ — เรียงจากแม่นสุดไปอ่อนสุด ใช้บอกจุดแข็ง/จุดอ่อน */
/** ตัดข้อความโดยไม่ให้สูตรขาดกลาง
    ตัดดิบๆ จะเหลือ $ ไม่ครบคู่ แล้ว KaTeX จะเรนเดอร์เพี้ยนหรือโชว์โค้ดดิบ */
function cutKeepMath(text, n) {
  const t = String(text || '');
  if (t.length <= n) return t;
  let cut = t.slice(0, n);
  if ((cut.split('$').length - 1) % 2 === 1) cut = cut.slice(0, cut.lastIndexOf('$'));
  return cut.trim() + '…';
}

function mockByTopic() {
  const by = {};
  (MOCK.answers || []).forEach(a => {
    const id = a.topic || 'other';
    by[id] = by[id] || { id: id, n: 0, ok: 0 };
    by[id].n++;
    if (a.ok) by[id].ok++;
  });
  return Object.keys(by).map(id => {
    const t = alevelTopic(id);
    return Object.assign({ name: t ? t.name : 'อื่นๆ', pct: Math.round(by[id].ok / by[id].n * 100) }, by[id]);
  }).sort((x, y) => y.pct - x.pct || y.n - x.n);
}

/** ตรวจทั้งชุดตอนกดส่ง — ระหว่างสอบไม่ตรวจอะไรเลยเหมือนห้องสอบจริง
    ส่งครบหรือหมดเวลา: ข้อที่ไม่ตอบนับว่าผิดเหมือนของจริง
    ออกกลางคัน: ตรวจเฉพาะข้อที่ตอบ เพราะยังไม่ได้ตั้งใจส่งทั้งชุด */
function gradeMock() {
  return MOCK.qs.map((q, i) => {
    const g = MOCK.given[i];
    const answered = mockHasAnswer(i);
    return {
      q: q.q, topic: q._topic, given: g, a: q.a, s: q.s, t: q.t, c: q.c,
      answered: answered, skipped: !answered,
      ok: answered ? isCorrect(q, g) : false
    };
  });
}

function mockDone(app) {
  susWatch(false);
  clearInterval(window._pretestClock);
  prefetchMockSet();   // เตรียมชุดของรอบถัดไปตั้งแต่ตอนนี้ รอบหน้าจะได้ไม่ต้องรอ
  const all = gradeMock();
  MOCK.answers = MOCK.quitEarly ? all.filter(a => a.answered) : all;
  MOCK.marks = MOCK.answers.map(a => a.ok);
  const total = MOCK.answers.length;
  const right = MOCK.marks.filter(Boolean).length;
  const askedCount = 0;
  const scorePct = total ? Math.round(right / total * 100) : 0;
  const spentMin = Math.max(1, Math.round((Date.now() - MOCK.startedAt) / 60000));
  const byTopic = mockByTopic();
  const strong = byTopic.filter(t => t.pct >= 70);
  const weak = byTopic.filter(t => t.pct < 50);
  const sus = susVerdict(MOCK);
  const wrong = (MOCK.answers || []).filter(a => !a.ok);
  window._mockReview = wrong;
  S.mockRuns = (S.mockRuns || 0) + 1;
  const proj = projectAlevelScore(scorePct, MOCK.source === 'ai');
  if (total) {
    const at = new Date().toISOString();
    S.lastMock = { scorePct: scorePct, projected: proj.est, at: at, source: MOCK.source };
    // Mock เป็นการวัดระดับเหมือนกัน จึงต้องอัปเดตภาพรวมชุดเดียวกับ Pre-test
    // ไม่งั้นหน้าอื่นจะยังโชว์ผลเก่าจาก Pre-test ทั้งที่เพิ่งสอบเสร็จ
    S.lastAssessment = { kind: 'mock', scorePct: scorePct, projected: proj.est, at: at };
    savePretestToCloud(scorePct, {
      predictedGpa: null,
      analysis: 'ผลจากข้อสอบเสมือนจริง ' + MOCK.qs.length + ' ข้อ',
      recommendedUnits: null
    }, { level: MOCK.examYear ? String(MOCK.examYear) : (PRETEST && PRETEST.levelId) || userClassId(), strand: {} })
      .catch(() => { /* เก็บในเครื่องไว้แล้ว ไม่กระทบการแสดงผล */ });
  }
  boardAddSession(MOCK.startedAt, MOCK.marks.length);
  const missed = MOCK.answers.filter(a => !a.ok).map(a => a.topic).filter(Boolean);
  missed.forEach(id => {
    if ((S.planTopics || []).indexOf(id) < 0) {
      S.planTopics = (S.planTopics || []).concat([id]);
    }
  });
  save();
  app.innerHTML = `
    ${breadcrumb([['Test', '#/test'], ['Mock', null]])}
    <h1>${MOCK.timeUp ? 'หมดเวลา' : MOCK.quitEarly ? 'ออกจากข้อสอบแล้ว' : 'จบข้อสอบแล้ว'}</h1>
    <p class="sub">${total ? right + '/' + total + ' · ' + scorePct + '%' : 'ยังไม่มีข้อที่ทำ'} ·
      ใช้เวลา ${spentMin} จาก ${MOCK.limitMin} นาที ·
      แหล่งข้อ ${MOCK.source === 'ai' ? 'AI ตามโครงข้อสอบจริง' : 'คลังในเครื่อง'}</p>
    ${MOCK.source !== 'ai' ? '<div class="banner warn">ชุดนี้มาจากคลังในเครื่อง ไม่ใช่ AI จึงง่ายกว่าของจริงและมีโอกาสเจอข้อซ้ำ — สาเหตุ: ' + esc(MOCK.aiError || 'ไม่ทราบ') + '</div>' : ''}
    <div class="scorecircle ${scorePct >= 50 ? 'hi' : ''}"><span>${scorePct}</span></div>
    <div class="teachcard">
      <div class="k">คะแนน A-Level ที่ประเมินได้</div>
      <div class="v" style="font-size:26px">${proj.est}/${proj.full}</div>
      <p class="note" style="margin-top:6px">ประเมินจาก ${scorePct}% ที่ทำได้ในชุด${proj.fromAi ? 'ที่ AI ออกตามโครงข้อสอบจริง' : 'จากคลังในเครื่องซึ่งง่ายกว่าของจริง'}
        ${proj.national ? ' · ค่าเฉลี่ยประเทศราว ' + proj.national + '/100' : ''}</p>
      <p class="note">เป็นการประเมินในแอป ยังไม่ผ่านการปรับเทียบ ใช้ดูแนวโน้มเท่านั้น</p>
    </div>
    ${MOCK.quitEarly || MOCK.timeUp
      ? '<p class="note">ตรวจจาก ' + total + ' ข้อที่ทำ · อีก ' + (MOCK.qs.length - total) + ' ข้อยังไม่ได้ทำ ไม่ถูกนับเป็นตัวหาร</p>'
      : ''}
    ${sus.flag ? '<div class="banner warn">คะแนนรอบนี้อาจไม่สะท้อนความสามารถจริง: ' + sus.reasons.map(esc).join(' · ') + '</div>' : ''}
    <div class="teachcard">
      <div class="k">จุดแข็ง</div>
      ${strong.length
        ? '<ul class="tlist">' + strong.map(t => '<li>' + esc(t.name) + ' — ' + t.ok + '/' + t.n + ' (' + t.pct + '%)</li>').join('') + '</ul>'
        : '<p class="note">ยังไม่มีสาระไหนแม่นถึง 70% รอบนี้</p>'}
    </div>
    <div class="teachcard">
      <div class="k">จุดอ่อน</div>
      ${weak.length
        ? '<ul class="tlist">' + weak.map(t => '<li>' + esc(t.name) + ' — ' + t.ok + '/' + t.n + ' (' + t.pct + '%)</li>').join('') + '</ul>'
        : '<p class="note">ไม่มีสาระไหนต่ำกว่า 50% รอบนี้</p>'}
    </div>
    ${wrong.length ? `
    <div class="teachcard">
      <div class="k">ข้อที่ยังไม่ถูก — ตอนนี้ถามได้แล้ว</div>
      <p class="note">ระหว่างสอบไม่มีตัวช่วย แต่ตอนนี้กดข้อไหนก็ได้ให้ AI แยกขั้นให้</p>
      ${wrong.slice(0, 10).map((a, i) =>
        '<button class="btn ghost sm" style="width:100%;text-align:left;margin-top:6px" onclick="reviewMockQ(' + i + ')">'
        + esc(cutKeepMath(a.q, 70)) + '</button>').join('')}
    </div>` : ''}
    <p class="note">รอบหน้าจะสุ่มคนละชุด · จุดที่ผิดถูกส่งเข้า AI Planner แล้ว</p>
    <button class="btn" onclick="quitMock(); go('#/planner')">ดูแผนต่อ</button>
    <div style="height:10px"></div>
    <button class="btn ghost" onclick="MOCK=null; MOCK_STARTING=false; render()">สอบอีกรอบ</button>`;
  renderMath(app);
}

/** เปิดห้องถามหลังสอบเสร็จ — เทียบความยากกับ A-Level แล้วแยกเป็นขั้นย่อย */
function reviewMockQ(i) {
  const a = (window._mockReview || [])[i];
  if (!a) return;
  window._askQ = { q: a.q, back: '#/mock' };
  startQuestionTutor(a.q, '', 'ข้อที่ยังไม่ถูกจากข้อสอบ');
}

function viewRealScore(app) {
  const pred = predictedAlevel();
  const real = S.realAlevel;
  const years = ALEVEL_EXAMS.filter(e => e.kind === 'a_level').map(e => e.year);
  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['กรอกคะแนนจริง', null]])}
    <h1>คะแนน A-Level ที่ได้จริง</h1>
    <p class="sub">หลังสอบเสร็จ เก็บคะแนนจริงสำหรับตรวจสอบแบบประเมินในอนาคต</p>
    ${pred ? `<div class="card"><div class="k">Pre-test ล่าสุดในแอป</div>
      <div class="v">${pred.pct}/100</div>
      <p class="note" style="margin-top:8px">${esc(pred.label)}</p></div>` : `
      <div class="banner">ยังไม่มี Pre-test — กรอกคะแนนจริงได้ตามปกติ</div>`}
    ${real ? `<div class="teachcard">
      <div class="k">ครั้งล่าสุดที่กรอก</div>
      <p>ปี ${real.year} ได้ ${real.score}/100 · คะแนนที่คุณรายงาน</p>
      <p class="note">ขอบคุณที่ช่วยเทียบระบบ — ได้ +50 XP แล้ว</p>
    </div>` : ''}
    <label for="realYear">ปีที่สอบ</label>
    <select id="realYear">
      ${years.map(y => `<option value="${y}" ${real && real.year === y ? 'selected' : ''}>${y}</option>`).join('')}
    </select>
    <div style="height:12px"></div>
    <label for="realScore">คะแนนที่ได้ (0–100)</label>
    <input type="number" id="realScore" min="0" max="100" step="0.01" inputmode="decimal"
      placeholder="เช่น 42.5" value="${real ? esc(String(real.score)) : ''}">
    <div style="height:16px"></div>
    <button class="btn" onclick="saveRealAlevel()">บันทึกและรับ XP</button>
    <p class="note" style="margin-top:14px">กรอกครั้งแรกได้ +50 XP เป็นของขวัญ — ไม่มีรางวัลเงิน แสดงความยินดีในแอป</p>`;
}

function saveRealAlevel() {
  const rawScore = $('#realScore') && $('#realScore').value.trim();
  if (!rawScore) return toast('ใส่คะแนนก่อนบันทึก');
  const score = Number(rawScore);
  if (!(score >= 0 && score <= 100)) return toast('ใส่คะแนน 0–100');
  const year = Number($('#realYear') && $('#realYear').value) || 2569;
  const pred = predictedAlevel();
  const predPct = null; // No calibrated prediction exists yet.
  const first = !S.realAlevel;
  S.realAlevel = {
    year: year,
    score: score,
    pretestPct: pred ? pred.pct : null,
    predicted: predPct,
    error: predPct != null ? Math.round(Math.abs(score - predPct) * 10) / 10 : null,
    at: Date.now()
  };
  if (first) S.xp += 50;
  save();
  toast(first
    ? (predPct != null
      ? 'บันทึกแล้ว คลาดเคลื่อน ' + S.realAlevel.error + ' คะแนน · +50 XP ยินดีด้วยที่สอบเสร็จ'
      : 'บันทึกแล้ว · +50 XP ยินดีด้วยที่สอบเสร็จ')
    : 'อัปเดตคะแนนแล้ว');
  viewRealScore($('#app'));
}

/** ค้นสถิติคะแนนยื่นมหาวิทยาลัย/คณะ ด้วย Gemini Search grounding — ไม่มีฐานข้อมูลจริง
    ของเราเอง จึงต้องกำกับชัดเจนว่าเป็นข้อมูลจาก AI ค้นเว็บ ไม่ใช่ประกาศทางการ */
async function loadUniStats() {
  const p = S.profile || {};
  const box = $('#uniStatsBody');
  if (box) box.innerHTML = `<p class="note" style="margin-top:10px">กำลังค้นข้อมูล…</p>`;
  try {
    const result = await getUniStats(p.university, p.major);
    if (box) box.innerHTML = `
      <div style="height:8px"></div>
      <p style="font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(result.text)}</p>
      ${result.sources && result.sources.length ? `
        <p class="note" style="margin-top:8px">อ้างอิง: ${result.sources.map(s => esc(s)).join(', ')}</p>` : ''}`;
  } catch (e) {
    if (box) box.innerHTML = `<div class="banner" style="margin-top:10px">ค้นไม่สำเร็จ: ${esc(e.message)}</div>`;
  }
}

/* ============ 12. หน้าตั้งค่า ============ */
function viewMe(app) {
  const p = S.profile || {};
  const email = Cloud.signedIn() ? (Cloud.state.email || '') : '';
  const grade = S.level || p.grade || 'm1';

  app.innerHTML = `
    ${breadcrumb([['หน้าแรก', '#/dashboard'], ['ตั้งค่า', null]])}
    <h1>ตั้งค่า (Settings)</h1>
    <p class="sub">บัญชี เป้าหมายการเรียน และการสำรองข้อมูล — ไม่มีค่าพรีเมียมให้ซื้อในแอปนี้</p>

    <div class="settings-grid">
      <div style="display:flex;flex-direction:column;gap:16px">
        <section class="settings-sec">
          <h2>ข้อมูลส่วนตัว</h2>
          <div class="profile-row">
            <div class="avatar-xl" aria-hidden="true">${esc(profileInitial())}</div>
            <div class="fieldgrid">
              <label>อีเมล
                <input type="email" value="${esc(email || 'ยังไม่ได้เข้าสู่ระบบ')}" readonly>
              </label>
              <label>โรงเรียน (ไม่บังคับ)
                <input type="text" id="setSchool" value="${esc(p.school || '')}" placeholder="เช่น สระบุรีวิทยาคม"
                  onchange="saveSettingsSchool()">
              </label>
              <label>ระดับชั้น
                <select id="setGrade" onchange="saveSettingsGrade()">
                  ${LEVEL_ORDER.map(id =>
                    `<option value="${id}" ${id === grade ? 'selected' : ''}>${esc(CURRICULUM[id].name)}</option>`
                  ).join('')}
                </select>
              </label>
            </div>
          </div>
          <p class="note" style="margin-top:12px">แอปยังไม่มีฟิลด์ชื่อหรือรูปโปรไฟล์ — อวตารใช้ตัวอักษรแรกของอีเมลจริง</p>
        </section>

        <section class="settings-sec">
          <h2>เป้าหมายการเรียน</h2>
          ${renderGoalPicker(p.goal, p.university, p.major, 'settingsGoalPick')}
          <p class="note" style="margin-top:8px">ดูสรุปความคืบหน้าที่ <a href="#/dashboard" style="color:var(--pen-blue)">หน้าแรก</a></p>
        </section>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <section class="settings-sec">
          <h2>การเรียน</h2>
          <div class="togglerow">
            <div>
              <div style="font-weight:700">เรียนอิสระ</div>
              <p class="note" style="margin:0">ปลดล็อกทุกหน่วย</p>
            </div>
            <input type="checkbox" id="free" ${S.freeMode ? 'checked' : ''} onchange="toggleFree()"
              style="width:auto;height:22px">
          </div>
          <div class="togglerow">
            <div>
              <div style="font-weight:700">พัฒนา AI แบบไม่ระบุตัวตน</div>
              <p class="note" style="margin:0">ไม่บังคับ เปลี่ยนได้ตลอด</p>
            </div>
            <input type="checkbox" id="cAiMe" ${S.consent && S.consent.aiData ? 'checked' : ''}
              onchange="toggleAIConsent()" style="width:auto;height:22px">
          </div>
          <p class="note" style="margin-top:8px"><a href="#/privacy" style="color:var(--pen-blue)">อ่านนโยบายความเป็นส่วนตัว</a></p>
        </section>

        <section class="settings-sec">
          <h2>บัญชีและความปลอดภัย</h2>
          ${Cloud.signedIn() ? `
            <p class="note" style="margin-bottom:10px">เข้าสู่ระบบแล้วด้วยอีเมล (รหัสทางอีเมล ไม่มีรหัสผ่านให้เปลี่ยน)</p>
            <button class="acctbtn" onclick="syncNow()">🔄 ซิงก์เดี๋ยวนี้ <span>›</span></button>
            <button class="acctbtn" onclick="doSignOut()" style="color:var(--pen-red)">ออกจากระบบ <span>›</span></button>
          ` : `
            <p class="note" style="margin-bottom:10px">ยังไม่ได้เข้าสู่ระบบ — ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น</p>
            <button class="btn" onclick="go('#/auth/signup')">สมัครบัญชีฟรี</button>
            <div style="height:8px"></div>
            <button class="btn ghost" onclick="go('#/auth/signin')">เข้าสู่ระบบ</button>
          `}
        </section>
      </div>
    </div>

    <div style="height:24px"></div>
    <h2>บัญชีและความปลอดภัย</h2>
    ${Cloud.signedIn() ? `
      <div class="teachcard">
        <div class="k">บัญชีที่ใช้อยู่</div>
        <p>${esc((Cloud.state && Cloud.state.email) || '—')}</p>
        <p class="note">ความคืบหน้า ผลสอบ และแผนเรียนถูกซิงก์ขึ้นบัญชีนี้อัตโนมัติ
          ล็อกอินเครื่องไหนก็ได้ข้อมูลชุดเดียวกัน</p>
      </div>
      <div class="teachcard">
        <div class="k">ข้อมูลของคุณ</div>
        <p class="note">เก็บเท่าที่ใช้สอน: โปรไฟล์การเรียน ความคืบหน้า และผลทดสอบ
          ไม่มีการขายข้อมูลให้บุคคลที่สาม</p>
        <button class="btn ghost sm" style="width:auto" onclick="go('#/privacy')">อ่านนโยบายความเป็นส่วนตัว</button>
      </div>
      <div class="row">
        <button class="btn ghost" onclick="syncNow()">ซิงก์ตอนนี้</button>
        <button class="btn ghost" onclick="doSignOut()">ออกจากระบบ</button>
      </div>
    ` : `
      <div class="banner">ยังไม่ได้เข้าสู่ระบบ — ข้อมูลอยู่ในเครื่องนี้เท่านั้น
        ล้างข้อมูลเบราว์เซอร์แล้วจะหายถาวร</div>
      <button class="btn" onclick="go('#/auth/signup')">สมัครบัญชีฟรีเพื่อเก็บความคืบหน้า</button>
    `}
    <div style="height:12px"></div>
    <button class="btn red" onclick="resetAll()">ล้างข้อมูลในเครื่องนี้</button>

    <p class="note" style="margin-top:28px">
      เนื้อหาอ้างอิงโครงสร้างหลักสูตรแกนกลางฯ พ.ศ.2551 (ฉบับปรับปรุง พ.ศ.2560)
      กลุ่มสาระการเรียนรู้คณิตศาสตร์ · ตรวจสอบกับแผนการสอนของโรงเรียนอีกครั้ง</p>`;
}

function settingsGoalPick(id, field, value) {
  if (!S.profile) S.profile = {};
  if (field) {
    S.profile[field] = value;
    save();
    persistLearnerLite();
    return;
  }
  S.profile.goal = id;
  if (id !== 'a_level') { S.profile.university = null; S.profile.major = null; }
  save();
  persistLearnerLite();
  viewMe($('#app'));
}

async function saveSettingsSchool() {
  const school = (($('#setSchool') && $('#setSchool').value) || '').trim();
  S.profile = Object.assign({}, S.profile, { school: school || null });
  save();
  persistLearnerLite();
  toast(school ? 'บันทึกโรงเรียนแล้ว' : 'ไม่ระบุโรงเรียน');
}

async function saveSettingsGrade() {
  const grade = $('#setGrade') && $('#setGrade').value;
  if (!grade) return;
  S.level = grade;
  S.profile = Object.assign({}, S.profile, { grade: grade });
  save();
  persistLearnerLite();
  toast('บันทึกระดับชั้นแล้ว');
}

async function persistLearnerLite() {
  if (!Cloud.signedIn()) return;
  const p = S.profile || {};
  try {
    await sbFetch('/rest/v1/rpc/save_onboarding', {
      method: 'POST',
      body: JSON.stringify({
        p_school: p.school || null, p_grade: S.level || p.grade, p_gpa: p.gpa || null,
        p_goal: p.goal || null, p_weak: null,
        p_target_university: p.university || null, p_target_major: p.major || null,
        p_understanding: p.understanding || null
      })
    });
  } catch (e) { console.warn('บันทึกโปรไฟล์ไม่สำเร็จ', e); }
}
function toggleFree() { S.freeMode = $('#free').checked; save(); toast(S.freeMode ? 'ปลดล็อกทุกหน่วยแล้ว' : 'กลับไปเรียนตามลำดับ'); }

/* ---------- ประตูทดลองเรียน ---------- */
function viewGate(app) {
  app.innerHTML = `
    <div class="gate">
      <img class="authlogo" src="assets/wordmark-720.png?v=10" alt="SoftOmni — Learn anytime. Understand better. Succeed together.">
      <div class="mark">${TRIAL_QUESTIONS}/${TRIAL_QUESTIONS}</div>
      <h1>ทดลองเรียนครบแล้ว</h1>
      <p class="sub">สมัครบัญชีฟรีเพื่อทำโจทย์ต่อ ใช้แค่อีเมล ไม่มีค่าใช้จ่าย
        ความคืบหน้าที่ทำไว้ในเครื่องนี้จะย้ายเข้าบัญชีให้ ไม่หายไป</p>
      <ul>
        <li>ทำโจทย์ได้ไม่จำกัดทั้ง 51 หน่วย ม.1–ม.6</li>
        <li>เพิ่มโจทย์ของตัวเองได้ไม่จำกัด</li>
        <li>ดาว คะแนน และคลังโจทย์ ซิงก์ข้ามเครื่อง</li>
        <li>เปลี่ยนเครื่องหรือล้างเบราว์เซอร์แล้วข้อมูลยังอยู่</li>
      </ul>
      <button class="btn" onclick="go('#/auth/signup')">สมัครบัญชีฟรี</button>
      <div style="height:10px"></div>
      <button class="btn ghost" onclick="go('#/auth/signin')">มีบัญชีแล้ว เข้าสู่ระบบ</button>
      <div style="height:18px"></div>
      <p class="note">อยากเก็บไว้เองมากกว่า? ไปที่หน้า “ตั้งค่า”
        แล้วกดสำรองข้อมูลเป็นไฟล์ ใช้ได้โดยไม่ต้องสมัคร</p>
    </div>`;
}

/* แถบเตือนเมื่อเหลือน้อย — แสดงเฉพาะช่วงท้ายของโหมดทดลอง ไม่รบกวนตั้งแต่ข้อแรก */
function trialBar() {
  const left = trialLeft();
  if (left === Infinity || left > 10) return '';
  return `<div class="trialbar">
      <span>โหมดทดลอง เหลือ <b>${left}</b> ข้อ</span>
      <button onclick="go('#/auth/signup')">สมัครฟรี</button>
    </div>`;
}

/* ---------- เข้าสู่ระบบด้วยรหัสทางอีเมล (ไม่มีรหัสผ่านให้จำหรือให้รั่ว) ---------- */
let otpEmail = '';

function viewAuth(app, r) {
  const signup = (r && r.a) !== 'signin';   // ค่าเริ่มต้นคือสมัครใหม่
  app.innerHTML = `
    <img class="authlogo" src="assets/wordmark-720.png?v=10" alt="SoftOmni — Learn anytime. Understand better. Succeed together.">
    <h1>${signup ? 'สมัครบัญชีฟรี' : 'เข้าสู่ระบบ'}</h1>
    <p class="sub">${signup
      ? 'ใส่อีเมล เราจะส่งรหัส 6 หลักไปให้ ไม่ต้องตั้งรหัสผ่าน ความคืบหน้าที่ทำไว้ในเครื่องนี้จะย้ายเข้าบัญชีให้'
      : 'ใส่อีเมลที่เคยใช้ เราจะส่งรหัส 6 หลักไปให้ ข้อมูลในบัญชีจะรวมกับที่ทำไว้ในเครื่องนี้'}</p>
    <p class="note">เข้าด้วยเบอร์โทรยังไม่เปิด — ต้องตั้ง SMS ใน Supabase ก่อน จึงยังใช้แค่อีเมล</p>

    <div id="step1" ${otpEmail ? 'hidden' : ''}>
      <label for="email">อีเมล</label>
      <input type="email" id="email" inputmode="email" autocomplete="email" placeholder="you@example.com"
        onkeydown="if(event.key==='Enter')doSendOtp()">
      <div style="height:16px"></div>
      <button class="btn" id="sendBtn" onclick="doSendOtp()">ส่งรหัสยืนยัน</button>
      <div style="height:10px"></div>
      <button class="btn ghost" onclick="go('#/auth/${signup ? 'signin' : 'signup'}')">
        ${signup ? 'มีบัญชีแล้ว เข้าสู่ระบบ' : 'ยังไม่มีบัญชี สมัครฟรี'}</button>
    </div>

    <div id="step2" ${otpEmail ? '' : 'hidden'}>
      <p class="banner">ส่งรหัสไปที่ <b>${esc(otpEmail)}</b> แล้ว — เช็กกล่องจดหมาย (รวมโฟลเดอร์สแปม)</p>
      <label for="code">รหัส 6 หลัก</label>
      <input type="text" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
        placeholder="123456" onkeydown="if(event.key==='Enter')doVerifyOtp()">
      <div style="height:16px"></div>
      <button class="btn" id="verifyBtn" onclick="doVerifyOtp()">ยืนยันและซิงก์</button>
      <div style="height:12px"></div>
      <button class="btn ghost" onclick="otpEmail='';render()">เปลี่ยนอีเมล</button>
    </div>

    <p class="note" style="margin-top:24px">เราเก็บแค่อีเมลเพื่อใช้เข้าระบบ
      ระดับชั้นต้องระบุตอนสมัคร โรงเรียนไม่บังคับ</p>`;
  setTimeout(() => { const el = $(otpEmail ? '#code' : '#email'); if (el) el.focus(); }, 60);
}

async function doSendOtp() {
  const email = ($('#email').value || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('รูปแบบอีเมลไม่ถูกต้อง');
  const btn = $('#sendBtn'); btn.disabled = true; btn.textContent = 'กำลังส่ง…';
  try {
    await Cloud.sendOtp(email);
    otpEmail = email;
    render();
  } catch (e) {
    toast(e.message);
    btn.disabled = false; btn.textContent = 'ส่งรหัสยืนยัน';
  }
}

async function doVerifyOtp() {
  const code = ($('#code').value || '').replace(/\D/g, '');
  if (code.length < 6) return toast('ใส่รหัส 6 หลัก');
  const btn = $('#verifyBtn'); btn.disabled = true; btn.textContent = 'กำลังยืนยัน…';
  try {
    await Cloud.verifyOtp(otpEmail, code);
    // รวมข้อมูลคลาวด์เข้ากับเครื่อง แล้วดันของเครื่องขึ้นไปด้วย
    await Cloud.pullAll();
    await Cloud.pushAll();
    otpEmail = '';
    if (!S.onboarded) { go('#/welcome'); toast('เข้าสู่ระบบแล้ว ตอบคำถามสั้นๆ ก่อนเริ่ม'); }
    else { go('#/me'); toast('เข้าสู่ระบบและซิงก์เรียบร้อย'); }
  } catch (e) {
    toast(e.message);
    btn.disabled = false; btn.textContent = 'ยืนยันและซิงก์';
  }
}

async function doSignOut() {
  if (!confirm('ออกจากระบบ? ข้อมูลในเครื่องนี้ยังอยู่ แต่จะไม่ซิงก์ต่อ')) return;
  await Cloud.signOut();
  render();
  toast('ออกจากระบบแล้ว');
}

async function syncNow() {
  toast('กำลังซิงก์…');
  const okPull = await Cloud.pullAll();
  const okPush = await Cloud.pushAll();
  render();
  toast(okPull && okPush ? 'ซิงก์เรียบร้อย' : ('ซิงก์ไม่สำเร็จ: ' + (Cloud.lastError || 'เน็ตมีปัญหา')));
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mathpath-backup-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(input) {
  const f = input.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      S = Object.assign({}, DEFAULT_STATE, JSON.parse(fr.result));
      save(); render(); toast('กู้คืนข้อมูลแล้ว');
    } catch (e) { toast('ไฟล์ไม่ถูกต้อง'); }
  };
  fr.readAsText(f);
}
function resetAll() {
  if (!confirm('ลบความคืบหน้าและโจทย์ทั้งหมดถาวร?')) return;
  localStorage.removeItem(KEY);
  S = load(); LESSON = null; render(); toast('ล้างข้อมูลแล้ว');
}

/* ============ 13. ตรวจตัวเอง — เปิดหน้าด้วย #test ============ */
function selfTest() {
  const out = [];
  const eq = (got, want, label) => out.push(`${got === want ? 'PASS' : 'FAIL'}  ${label}  ได้ ${got} ต้องการ ${want}`);

  eq(toNumber('12'), 12, 'เลขอารบิก');
  eq(toNumber('-3.5'), -3.5, 'เลขติดลบทศนิยม');
  eq(toNumber('๑๒'), 12, 'เลขไทย');
  eq(toNumber('ลบสาม'), -3, 'ลบ + คำไทย');
  eq(toNumber('ยี่สิบสาม'), 23, 'ยี่สิบสาม');
  eq(toNumber('สิบเอ็ด'), 11, 'สิบเอ็ด');
  eq(toNumber('หนึ่งร้อยยี่สิบ'), 120, 'หนึ่งร้อยยี่สิบ');
  eq(toNumber('สามร้อยห้าสิบหก'), 356, 'สามร้อยห้าสิบหก');
  eq(toNumber('หนึ่งพันห้าร้อย'), 1500, 'หนึ่งพันห้าร้อย');
  eq(toNumber('ศูนย์จุดห้า'), 0.5, 'ศูนย์จุดห้า');
  eq(toNumber('สองจุดสองห้า'), 2.25, 'สองจุดสองห้า');
  eq(toNumber('สวัสดี'), null, 'ข้อความที่ไม่ใช่ตัวเลข');
  eq(toNumber(''), null, 'ค่าว่าง');

  eq(isCorrect({t:'num', a:0.65, tol:0.001}, '0.65'), true, 'ตัวเลขในค่าคลาดเคลื่อน');
  eq(isCorrect({t:'num', a:0.65, tol:0.001}, '0.7'), false, 'ตัวเลขนอกค่าคลาดเคลื่อน');
  eq(isCorrect({t:'num', a:-6}, 'ลบหก'), true, 'ตอบด้วยเสียงเป็นคำไทยติดลบ');
  eq(isCorrect({t:'mc', a:2}, 2), true, 'ข้อเลือกตอบถูก');
  eq(isCorrect({t:'mc', a:2}, 1), false, 'ข้อเลือกตอบผิด');

  // ทุกข้อในหลักสูตรต้องมีรูปแบบที่ตรวจได้จริง
  let bad = 0, count = 0;
  for (const lv of LEVEL_ORDER)
    for (const u of CURRICULUM[lv].units)
      for (const q of u.q) {
        count++;
        const okShape = q.t === 'mc'
          ? Array.isArray(q.c) && q.c.length >= 2 && q.a >= 0 && q.a < q.c.length
          : typeof q.a === 'number' && isFinite(q.a);
        if (!okShape || !q.q) { bad++; console.warn('ข้อผิดรูปแบบ', u.id, q); }
      }
  eq(bad, 0, `ทุกข้อในหลักสูตรรูปแบบถูกต้อง (ตรวจ ${count} ข้อ)`);

  const fails = out.filter(l => l.indexOf('FAIL') === 0).length;
  document.body.innerHTML =
    `<pre style="padding:20px;font:13px/1.9 monospace;white-space:pre-wrap">` +
    out.join('\n') + `\n\n${fails === 0 ? 'ผ่านทั้งหมด ✅' : fails + ' ข้อไม่ผ่าน ❌'}</pre>`;
  return fails;
}
if (location.hash === '#test') window.addEventListener('DOMContentLoaded', selfTest);
