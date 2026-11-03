/* MathPath — ชั้นซิงก์ข้อมูลกับ Supabase
   ออกแบบเป็น "ออฟไลน์มาก่อน": localStorage คือแหล่งข้อมูลหลักที่ใช้งานทันที
   Supabase เป็นชั้นซิงก์เพิ่มเข้ามา ถ้าเน็ตล่มหรือยังไม่ล็อกอิน แอปยังใช้ได้ครบ

   เรียก REST API ตรงด้วย fetch ไม่ใช้ supabase-js จาก CDN
   เพราะไม่ต้องพึ่งเน็ตตอนเปิดแอป และไม่ต้องโหลดไลบรารีเพิ่ม

   คีย์ที่ใส่ไว้นี่คือ publishable key ซึ่งออกแบบมาให้เปิดเผยได้
   ความปลอดภัยมาจาก RLS ในฐานข้อมูล ไม่ใช่จากการซ่อนคีย์
   ห้ามใส่ service_role key หรือคีย์ Gemini ในไฟล์นี้เด็ดขาด — มันจะหลุดทันที
*/
'use strict';

const SB_URL = 'https://xhkyaasgezqalsymnryg.supabase.co';
const SB_KEY = 'sb_publishable_-1rWEJE676c43HHyaBO3WA_M86cmHMN';
const AUTH_KEY = 'mathpath.auth';

const Cloud = {
  state: null,           // { access_token, refresh_token, user_id, email } หรือ null
  pushing: false,
  lastError: null
};

/* ---------- เซสชัน ---------- */
function loadAuth() {
  try { Cloud.state = JSON.parse(localStorage.getItem(AUTH_KEY)) || null; }
  catch (e) { Cloud.state = null; }
}
function saveAuth(s) {
  Cloud.state = s;
  if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  else localStorage.removeItem(AUTH_KEY);
}
Cloud.signedIn = () => !!(Cloud.state && Cloud.state.access_token);
loadAuth();

/* ---------- เรียก API ---------- */
async function sbFetch(path, opts, retry) {
  opts = opts || {};
  const headers = Object.assign({
    apikey: SB_KEY,
    'Content-Type': 'application/json'
  }, opts.headers || {});
  if (Cloud.state && Cloud.state.access_token) {
    headers.Authorization = 'Bearer ' + Cloud.state.access_token;
  }
  const res = await fetch(SB_URL + path, Object.assign({}, opts, { headers }));

  // โทเคนหมดอายุ -> ต่ออายุแล้วลองอีกครั้งเดียว
  if (res.status === 401 && !retry && Cloud.state && Cloud.state.refresh_token) {
    if (await refreshSession()) return sbFetch(path, opts, true);
  }
  return res;
}

async function refreshSession() {
  try {
    const res = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: Cloud.state.refresh_token })
    });
    if (!res.ok) { saveAuth(null); return false; }
    const d = await res.json();
    saveAuth({
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      user_id: d.user && d.user.id,
      email: d.user && d.user.email
    });
    return true;
  } catch (e) { return false; }
}

/* ---------- เข้าสู่ระบบด้วยรหัสทางอีเมล ---------- */
Cloud.sendOtp = async function (email) {
  const res = await fetch(SB_URL + '/auth/v1/otp', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, create_user: true })
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.msg || d.error_description || 'ส่งรหัสไม่สำเร็จ');
  }
  return true;
};

Cloud.verifyOtp = async function (email, code) {
  const res = await fetch(SB_URL + '/auth/v1/verify', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, token: code, type: 'email' })
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.msg || d.error_description || 'รหัสไม่ถูกต้องหรือหมดอายุ');
  saveAuth({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    user_id: d.user && d.user.id,
    email: d.user && d.user.email
  });
  return true;
};

Cloud.signOut = async function () {
  try { await sbFetch('/auth/v1/logout', { method: 'POST' }); } catch (e) {}
  saveAuth(null);
};

/* ---------- ดึงข้อมูลจากคลาวด์มารวมกับเครื่อง ---------- */
/* ---------- กระดานจัดอันดับ ----------
   ฝั่งเซิร์ฟเวอร์คืนเฉพาะนามแฝงกับตัวเลข ไม่มี user_id ไม่มีข้อมูลส่วนตัว
   อันดับของตัวเองมาจาก my_board_rank ซึ่งอ่านได้เฉพาะเจ้าของบัญชี */
Cloud.saveBoard = async function (stats) {
  if (!Cloud.signedIn()) return false;
  try {
    const res = await sbFetch('/rest/v1/rpc/save_board_stats', {
      method: 'POST',
      body: JSON.stringify({
        p_alias: stats.alias || '',
        p_joined: stats.joined !== false,
        p_minutes: stats.minutes || 0,
        p_questions: stats.questions || 0,
        p_active_days: stats.activeDays || 0,
        p_streak: stats.streak || 0,
        p_first_score: stats.firstScore == null ? null : stats.firstScore,
        p_best_score: stats.bestScore == null ? null : stats.bestScore
      })
    });
    return res.ok;
  } catch (e) {
    console.warn('บันทึกสถิติกระดานไม่สำเร็จ', e);
    return false;
  }
};

Cloud.fetchBoard = async function (metric) {
  if (!Cloud.signedIn()) return [];
  const res = await sbFetch('/rest/v1/rpc/board_top', {
    method: 'POST', body: JSON.stringify({ p_metric: metric || 'effort', p_limit: 100 })
  });
  if (!res.ok) throw new Error('โหลดกระดานไม่สำเร็จ');
  return await res.json();
};

/** อันดับของตัวเองทุกหมวดในครั้งเดียว — คืนเป็น { effort: {rank,total,value}, ... } */
Cloud.myRanks = async function () {
  if (!Cloud.signedIn()) return {};
  const res = await sbFetch('/rest/v1/rpc/my_board_ranks', { method: 'POST', body: '{}' });
  if (!res.ok) return {};
  const rows = await res.json().catch(() => []);
  const out = {};
  (rows || []).forEach(r => { out[r.metric] = { rank: r.rank, total: r.total, value: r.value }; });
  return out;
};

Cloud.pullAll = async function () {
  if (!Cloud.signedIn()) return false;
  try {
    const results = await Promise.all([
      sbFetch('/rest/v1/learners?select=*&limit=1'),
      sbFetch('/rest/v1/unit_progress?select=unit_id,stars,best,runs'),
      sbFetch('/rest/v1/questions?select=*&order=created_at.asc')
    ]);
    if (results.some(r => !r.ok)) throw new Error('ดึงข้อมูลไม่สำเร็จ');

    // ถ้าเป็นคนละบัญชีกับที่ข้อมูลในเครื่องเป็นของ ต้องล้างทิ้งก่อนรวมข้อมูล
    if (typeof claimStateFor === 'function') claimStateFor(Cloud.state && Cloud.state.user_id);

    const learner = (await results[0].json())[0];
    const progress = await results[1].json();
    const remoteQs = await results[2].json();

    // โปรไฟล์: ตัวเลขสะสมเอาค่าที่มากกว่า ไม่ให้เครื่องที่ล้าหลังลบของใหม่
    if (learner) {
      S.xp = Math.max(S.xp || 0, learner.xp || 0);
      S.streak = Math.max(S.streak || 0, learner.streak || 0);
      if (learner.last_day && (!S.lastDay || learner.last_day > S.lastDay)) S.lastDay = learner.last_day;
    // ชั้นเรียนและโปรไฟล์: ของบนคลาวด์เป็นต้นทางเมื่อล็อกอินไว้ หน้าบทเรียนจะตามผู้ใช้คนนี้
    const grade = learner.grade || learner.level;
    if (grade) S.level = grade;
    // กู้โปรไฟล์เสมอ ไม่ผูกกับว่ามีชั้นเรียนหรือไม่
    // เดิมครอบด้วย if (grade) แถวที่ไม่มีชั้นเรียนจึงเสียโรงเรียน เกรด และเป้าหมายไปทั้งหมด
    S.profile = Object.assign({}, S.profile || {}, {
      grade: grade || (S.profile && S.profile.grade) || null,
      school: learner.school || (S.profile && S.profile.school) || null,
      gpa: learner.gpa != null ? learner.gpa : (S.profile && S.profile.gpa),
      goal: learner.goal || (S.profile && S.profile.goal) || null,
      university: learner.target_university || (S.profile && S.profile.university) || null,
      major: learner.target_major || (S.profile && S.profile.major) || null,
      understanding: learner.understanding || (S.profile && S.profile.understanding) || null
    });
    // เคยตอบคำถามเริ่มต้นไว้แล้วบนคลาวด์ = ผ่านขั้นตอนนั้นมาแล้ว
    // ไม่งั้นล็อกอินบนเครื่องใหม่จะโดนถามข้อมูลเดิมซ้ำ ทั้งที่ระบบมีอยู่แล้ว
    if (learner.onboarded_at || grade || learner.school || learner.goal) S.onboarded = true;
    if (learner.free_mode) S.freeMode = true;
    }

    progress.forEach(p => {
      const cur = S.progress[p.unit_id] || { stars: 0, best: 0, runs: 0 };
      S.progress[p.unit_id] = {
        stars: Math.max(cur.stars || 0, p.stars || 0),
        best: Math.max(cur.best || 0, p.best || 0),
        runs: Math.max(cur.runs || 0, p.runs || 0)
      };
    });

    // โจทย์: เพิ่มข้อจากคลาวด์ที่เครื่องนี้ยังไม่มี (เทียบด้วย rid)
    const haveRids = {};
    S.uploads.forEach(u => { if (u.rid) haveRids[u.rid] = true; });
    remoteQs.forEach(r => {
      if (!haveRids[r.id]) S.uploads.push(remoteToLocal(r));
    });

    try {
      const pr = await sbFetch('/rest/v1/pretest_results?select=level,score_pct,predicted_gpa,ai_analysis,recommended_units,created_at&order=created_at.desc&limit=1');
      if (pr.ok) {
        const row = (await pr.json())[0];
        if (row && (!S.lastPretest || !S.lastPretest.at || row.created_at > S.lastPretest.at)) {
          S.lastPretest = {
            level: row.level,
            scorePct: row.score_pct,
            predictedGpa: row.predicted_gpa,
            analysis: row.ai_analysis,
            recommendedUnits: row.recommended_units || [],
            at: row.created_at
          };
        }
      }
    } catch (e) { console.warn('ดึงผล pretest ไม่สำเร็จ', e); }

    save();
    return true;
  } catch (e) {
    Cloud.lastError = e.message;
    console.warn('pullAll ล้มเหลว', e);
    return false;
  }
};

function remoteToLocal(r) {
  const rec = {
    id: 'u_' + r.id.slice(0, 8),
    rid: r.id,
    level: r.level,
    unit: r.unit_id,
    t: r.kind,
    q: r.body,
    s: r.solution || '',
    own: true,
    img: null,
    imgPath: r.image_path || null,
    at: r.created_at
  };
  if (r.kind === 'mc') { rec.c = r.choices || []; rec.a = r.answer_index; }
  else { rec.a = r.answer_num; rec.v = true; if (r.tolerance) rec.tol = r.tolerance; }
  return rec;
}

/* ---------- ส่งข้อมูลขึ้นคลาวด์ (หน่วงรวมกันเพื่อลดจำนวนคำขอ) ---------- */
let pushTimer = null;
Cloud.schedulePush = function () {
  if (!Cloud.signedIn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(Cloud.pushAll, 2500);
};

Cloud.pushAll = async function () {
  if (!Cloud.signedIn() || Cloud.pushing) return false;
  Cloud.pushing = true;
  try {
    await sbFetch('/rest/v1/rpc/sync_learner', {
      method: 'POST',
      body: JSON.stringify({
        p_level: S.level, p_xp: S.xp, p_streak: S.streak,
        p_last_day: S.lastDay, p_free_mode: !!S.freeMode, p_nickname: S.name || null
      })
    });

    const rows = Object.keys(S.progress).map(k => ({
      unit_id: k,
      stars: S.progress[k].stars || 0,
      best: S.progress[k].best || 0,
      runs: S.progress[k].runs || 0
    }));
    if (rows.length) {
      await sbFetch('/rest/v1/rpc/sync_progress', {
        method: 'POST', body: JSON.stringify({ rows: rows })
      });
    }

    // โจทย์ที่ยังไม่เคยขึ้นคลาวด์
    for (const u of S.uploads) {
      if (!u.rid) await Cloud.pushQuestion(u);
    }
    save();
    return true;
  } catch (e) {
    Cloud.lastError = e.message;
    console.warn('pushAll ล้มเหลว', e);
    return false;
  } finally {
    Cloud.pushing = false;
  }
};

/** อัปโหลดโจทย์หนึ่งข้อ พร้อมรูปถ้ามี — เขียน u.rid กลับเมื่อสำเร็จ */
Cloud.pushQuestion = async function (u) {
  if (!Cloud.signedIn() || u.rid) return false;
  try {
    let imagePath = u.imgPath || null;
    if (u.img && !imagePath) imagePath = await uploadImage(u.img);

    const row = {
      user_id: Cloud.state.user_id,
      level: u.level, unit_id: u.unit, kind: u.t,
      body: u.q, solution: u.s || null, image_path: imagePath
    };
    if (u.t === 'mc') { row.choices = u.c; row.answer_index = u.a; }
    else { row.answer_num = u.a; row.tolerance = u.tol || null; }

    const res = await sbFetch('/rest/v1/questions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error(await res.text());
    const saved = (await res.json())[0];
    u.rid = saved.id;
    u.imgPath = saved.image_path;
    return true;
  } catch (e) {
    Cloud.lastError = e.message;
    console.warn('pushQuestion ล้มเหลว', e);
    return false;
  }
};

Cloud.deleteQuestion = async function (rid) {
  if (!Cloud.signedIn() || !rid) return false;
  try {
    const res = await sbFetch('/rest/v1/questions?id=eq.' + encodeURIComponent(rid), { method: 'DELETE' });
    return res.ok;
  } catch (e) { return false; }
};

/* ---------- รูปโจทย์ใน Storage ---------- */
function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = (parts[0].match(/:(.*?);/) || [, 'image/jpeg'])[1];
  const bin = atob(parts[1]);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

async function uploadImage(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const path = Cloud.state.user_id + '/' + Date.now() + '.jpg';
  const res = await fetch(SB_URL + '/storage/v1/object/question-images/' + path, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + Cloud.state.access_token,
      'Content-Type': blob.type
    },
    body: blob
  });
  if (!res.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ');
  return path;
}

/** ขอ URL ชั่วคราวสำหรับรูปที่ดึงมาจากคลาวด์ (บักเก็ตเป็นแบบส่วนตัว) */
Cloud.signedImageUrl = async function (path) {
  if (!Cloud.signedIn() || !path) return null;
  try {
    const res = await sbFetch('/storage/v1/object/sign/question-images/' + path, {
      method: 'POST', body: JSON.stringify({ expiresIn: 3600 })
    });
    if (!res.ok) return null;
    const d = await res.json();
    return SB_URL + '/storage/v1' + d.signedURL;
  } catch (e) { return null; }
};
