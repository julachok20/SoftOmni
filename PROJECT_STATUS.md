## 2026-09-06 — Personalized sublesson paths (v49, local)

Implemented sequential required sublesson activities, adjustable teaching preferences, contextual AI adaptation, saved conversation resume, and account-scoped local path progress. Preserved existing assessment records when reopening lessons. Chapter assessments unlock after required activities; participation is explicitly separate from scored mastery. Advanced extensions remain optional.

Targeted browser and request-payload tests passed. Foundation generator checks passed. KaTeX regression blocked by session network restrictions. AI responses mocked in workflow tests; live model quality unverified. User deployed v48 before this change; v49 still needs deployment. See tools/personal-path/README.md.

---

## 2026-09-06 — Five learning improvements (v48)

Implemented computed-answer foundation practice (16 skills), a daily study plan, mastery based on fresh independent practice plus a delayed review, honest pretest diagnostics, and explanation/example/guided/independent/review lessons. Cloud learning attempts and question reports now have owner-only access. Imported 88 exam corpus questions (2566:28, 2567:30, 2569:30); 2568 remains missing. OCR corpus content remains reviewable evidence, not automatically verified training labels.

Validation: 3,200 generated questions, delayed progression/account isolation, local database RLS, and full desktop/mobile browser flow passed. Release status will be recorded after deployment. See tools/learning/README.md. Older status below is historical.

---

# SoftOmni — Project Status & TODO

Last updated: 2026-09-04 (sub-lessons + chapter tests + sus detection; staged lesson flow; in-tab Mock asking; planner work items; leaderboard tab; offline exam extractor). Earlier: 2026-09-03 (pretest↔lesson sync; insert gap lessons; planner summary; standalone questions). Project root: `D:\Claude-Access\MathPath`. Live domain: `mathpath-sbw.vercel.app` (Vercel project internally named `graphwar`).

**Not yet deployed as of this writing.** Every change below exists locally + on Supabase (which deploys instantly). The static frontend (`index.html`/`app.js`/`tutor.js`/`style.css`) only goes live after running, from this directory:

```bash
npx vercel --prod --yes
```

Stitch project: **Softomni Professional Dashboard** `projects/5581968335801392927` (11 real screens + 2 stray assets). HTML cache (read-only, gitignored): `MathPath/.stitch-cache/`. Bridge: `tools/stitch.ps1` (Cursor cannot mount the Stitch MCP).

---

## 1. Stitch visual match — Pass 3 (layout, not tokens)

User standing instruction: **forget the old app structure/visuals, replace with the Stitch design.** Pass 1 (token swap) and Pass 2 (partial layout) were judged insufficient. Pass 3 rebuilt actual HTML/CSS structure against the downloaded Stitch HTML, **using only real data** (no fabricated duration, difficulty, names, or weekly goals).

### Matched this session (layout-for-layout, real data)

- **Test hub** (`testhub.html` / `mocktest.html`): two-column hub — recommended **course cards** (Pre-test + goal/set-goal), grouped **topic list** by level with real question counts + ฝึกฝน CTA, right **performance panel** (units done + last pretest score only). External resource cards kept. No fake Physics/TCAS mock packs.
- **AI Tutor** (`tutor.html`): full-bleed chat page — header + scrolling transcript with avatar/timestamp, suggested chips under the first AI turn, bottom-fixed pill input (attach + textarea + mic + send). Mobile hides topbar/tabbar so the chat is the screen. Signed-out state is still the existing signup gate (not a fake chat).
- **Settings** (`settings.html`): two-column — profile (email-initial avatar, real email, grade dropdown) + School/A-Level goal cards; right column is real toggles (free mode, AI consent) + account (OTP, no fake Change Password). Explicitly **no Premium CTA** and **no notification toggles** (nothing in the product to back them).
- **บทเรียน / curriculum overview** (`curriculum.html`): landing is the learner's **class path**, not a ม.1–ม.6 picker. Target-goal card + strand-grouped unit cards (เสร็จสิ้น / กำลังเรียน / ล็อก). Accepted Pre-test recommendations unlock those units and become the current start. Declining personalize keeps sequential order.
- **Pretest taking** (`functest.html`): question counter `1/N`, **elapsed** clock (count-up — we do not invent a 45-minute limit), Skip, Report Issue (local flag + honest toast; no report backend). Short MC answers can use a 2-column grid.
- **Pretest review** (`review.html`): score circle + scrollable per-question list with ✓/✕ and tap-to-see explanation.

### Still NOT matching (needs new content/features, not just CSS)

- **Concept/lesson content page** (`linearfunc.html`): right-side Concept Summary + highlighted formula with color-coded term callouts. Curriculum is still **question-only** — no concept-explanation content type exists. Do not invent lesson prose.
- **Solution & AI Assistance** (`solution.html`): step-by-step numbered solution card + compact AI-tutor mini-widget beside it. No inline worked-solution view outside chat.
- **Mock-exam product** (`mocktest.html` dark "TCAS Mock Exam 68" cards, Physics A-Level cards, 90/120-minute durations): we do not sell or store those packs. Test hub uses Pre-test + goal practice instead of fabricating them.
- **Difficulty badges / countdown exam timer / notification prefs / Upgrade to Premium**: no data or product behind them. Left out on purpose.

### Recommended next step
Concept page and Solution widget are feature work (new content type + a second tutor surface), not a restyle. Ask before inventing curriculum explanations or a mock-exam catalog.

---

## 1b. Lesson click → teach, then interactive AI (2026-08-29 night)

- Removed **ตอบด้วยเสียง** tuition mode (`startLesson(..., 'speak')` and the offline numeric STT drill). Tutor chat **mic + TTS** are unchanged — students still talk with the AI.
- Clicking a unit (บทเรียน cards, path, Test topic rows) now opens `#/lesson/{id}` as a **teach preview**: unit name, strand, real question stems from the curriculum (no invented concept prose), and the easiest starter question.
- One CTA **เริ่มเรียนกับติวเตอร์ AI**. The tutor must teach 2–5 sentences from those stems, then ask that easy first question, wait for an answer (type or speak), then continue interactively. Chips stay available during the lesson (harder / easier / ask / wrap up).
- Static “ทำโจทย์เอง” picker is no longer on the unit click path. `startLesson` quiz remains only as leftover for a completed quiz round.

Cache bust: `?v=27`.

---

## 1c. บทเรียน close / เนื้อหา-then-AI / personalization (2026-08-29)

- Closing the study chat (or quiz) returns to **`#/home`**, not the old `#/path` map — that map was the same curriculum in a second design. `#/path/*` now redirects to บทเรียน.
- Study still shows **เนื้อหา first** (unit teach card), then AI. The priming instruction is **silent** — the student does not see that prompt; the AI speaks first. เนื้อหา stays as a compact banner on the chat.
- บทเรียน curriculum follows the signed-in learner: `pullAll` hydrates grade/school/goal from `learners`, and the latest `pretest_results` into `S.lastPretest`. Grade switcher on บทเรียน removed — change class in Settings.

---

## 1d. Goal path + uni/คณะ dropdowns + daily Q (2026-08-29)

- Signup/settings A-Level: **university and คณะ are `<select>` only** (real Thai unis + faculties). Typing is disabled. A-Level cannot continue without both.
- **บทเรียน is a dream-goal track**, not a ม.1–ม.6 class catalog. A-Level + faculty maps onto real units across grades (e.g. engineering includes พีทาโกรัส). Repeating a unit starts medium/hard and climbs.
- **Test**: daily medium/hard question from that track. **แบบฝึกหัด A-Level** is an honest placeholder until real A-Level papers are provided — no fake exam packs.

Cache bust: `?v=28`.

---

## 1e. A-Level corpus as the lesson backbone (2026-09-01)

Source papers (local only, not on Vercel): `D:\171.sbw_hackathon\02.Source` — 15 PDFs. Years **2555–2565** = วิชาสามัญ คณิตศาสตร์ 1; **2566–2569** = A-Level คณิตศาสตร์ประยุกต์ 1 (30 ข้อ / 90 นาที / 100 คะแนน). 2565–2566 are scans. Text-layer years have broken Thai encoding — **stems are not loaded into the app**. Catalog lives in `alevel.js` (`ALEVEL_EXAMS`, 4 สาระ / 16 บท).

What shipped locally (`?v=30`):

- **บทเรียน** (A-Level / unset goal): หัวข้อใหญ่ = 4 สาระ, หัวข้อย่อย = 16 บท. Each lesson is a **short know/practice summary** + optional geometry SVG + **in-lesson check question** (from mapped curriculum items, then a follow-up). Tutor continues in real time from those principles.
- **Test hub**: real year packs 2555–2569 with honest OCR/scan status. Opening a year does **not** serve copyrighted items.
- **Dashboard**: predicted A-Level = in-app Pre-test % (labeled, compared to ทปอ. mean **20.44 / 100 ปี 2569**); prep hours/day from remaining topics × months to March exam; “ควรเพิ่มความรู้” = unfinished chapters. After the real exam, `#/realscores` stores score vs prediction + **+50 XP** thank-you.
- **Auth**: email OTP only. Phone login is **not** implemented (needs Supabase SMS). Grade required; school optional in wizard + settings.

Still blocked until OCR: item-level classification (ข้อนี้หัวข้อใหญ่/ย่อยอะไร), step-count difficulty from actual ทปอ. items, and generated lookalikes from those items. Do not invent A-Level stems.

---

## 1f. Planner + personalized lessons + Mock (2026-09-01 afternoon)

Analyzed 15 local PDFs with math-token classification (Thai encoding still broken; 2565–66 scans). Year signals 2567–69 (trig/func/set/prob/analytic/dist) + official 30-item mix drive **Mock Test** — AI-generated items when signed in, else curriculum pool shuffled to the same blueprint. Stems from ทปอ. are not stored.

- **บทเรียน**: each of 16 chapters has เนื้อหา (what it is + terms, e.g. เพาเวอร์เซต). Choose **อ่านเอง** or **เรียนกับ AI**. Repeat uses a different question rotation. AI teaches first, then 5 questions harder; after 5, **จบบทเรียน** or **ให้ AI จบให้**.
- **Pre-test** (A-Level path) samples across 16 chapters. Missed topics (including พหุนาม) are inserted into `S.planTopics` and unlocked first.
- Tab **AI Tutor → AI Planner**: plan from pretest gaps + remaining chapters, links into personalized lessons. Free chat remains “ถามอิสระ”.
- Test hub **MOCK TEST** card → `#/mock`.

Cache bust: `?v=31`.

---

## 1g. Planner graph + talk + ask-any-question (2026-09-03)

- **AI Planner** is the student’s own plan graph (4 สาระ rows, polyline = their order, not the catalog lock chain). Hours/day and time slots sit next to it. **คุยกับ AI เพื่อปรับแผน** opens a real planner chat; when they agree, the model appends `[PLAN]{hours,slots,order,note}[/PLAN]`, the client sanitizes topic ids, and the graph/lesson unlock order updates.
- **Personalization:** `personalizedTopics()` uses `S.studyPlan.order` if set; otherwise scores by pretest/mock gaps, hard chapters, stars, and self-rated understanding. Unlock is along that personal order (`max(3, done+2)` after pretest/plan), not 16 chapters in fixed sequence.
- **ถามโจทย์** (`#/askq`): paste or upload any question (including the current Mock item). AI compares hardness to A-Level คณิต 1 and splits into 3–5 easier parts. Each part can be practiced with the tutor (no final-answer dump). Same split runs after bank upload analyze. Mock keeps in-memory state so “กลับข้อเดิม” works.

Cache bust: `?v=32`.

---

## 1h. Pre-test ↔ lessons, inserted gaps, planner summary (2026-09-03)

- Continuation stems (“จากข้อบน / ชุดเดิม”) rewritten to be standalone; leftover dependents are skipped in Pre-test, Mock, lesson checks, and tutor samples. AI Mock is told not to refer to a previous item.
- **Personalization = insert:** if Pre-test misses e.g. พหุนาม, that lesson is **prepended** even when the default faculty/class track would not include it yet. บทเรียน shows “แทรกให้คุณ” first, then the normal path.
- **AI Planner** is a readable summary: hours/day + time slots, orange dots for inserted gaps, numbered “why this next” list — not the cramped SVG graph.
- **Pre-test syncs with lessons:** A-Level = 1 question per 16 chapters (same as บทเรียน). Missed items write `planTopics` even if AI analysis fails. Review “ไปเรียนบทนี้” opens that same lesson. Recommend buttons go to `#/topic/{id}`.

Cache bust: `?v=33`.

---

## 1i. Session 2026-09-04 — everything another AI must know

Worked a user punch list (numbered as the user wrote it), then leaderboards and an offline exam tool.
**Everything below was verified in a real browser** against `python -m http.server` (launch.json entry `mathpath`, port 8600), not only by reading code.

### AI provider reality (read this first)

- Edge Function `tutor` is **version 15**. Gemini is primary; the fallback env vars are still named `DEEPSEEK_*` for historical reasons but now default to **SiamCodex**: base `https://chatbot.siamcodex.com/api/v1`, model `vertex.gemini-3.8-flash`.
- **SiamCodex is Gemini.** It proxies Vertex AI Gemini. "Use Gemini" and "use SiamCodex" are the same model family, different quota owner.
- **SiamCodex returns HTTP 500 on `response_format: {type: json_object}`.** That parameter was removed from `callDeepSeek`. JSON is forced by prompt wording plus `parseJsonLoose`. Do not re-add it.
- The real DeepSeek key was dead (401) and the Gemini key hit 429 quota exhaustion on 2026-09-03. If every AI feature fails at once, check the providers before touching app code: `query_logs` with `source = 'function_logs'` prints the provider error verbatim.
- **Staged but NOT deployed:** local `supabase/functions/tutor/index.ts` raises chat `maxOutputTokens` 1400 to 2600 (two places). Deploy if long Thai answers truncate again.
- **Deliberately not done:** the table/graph LaTeX rule went into the *client* prompts only. The same rule in the server `BASE_RULES` was **rejected by the user**, so lesson-mode answers can still draw ASCII tables. Ask before adding it.

### Items delivered

1. **Real exam difficulty** — `examPressure(year)` in `alevel.js` returns recorded facts only (30 ข้อ / 90 นาที / 180 วินาทีต่อข้อ / pages / avgSteps / hardShare / strand shares). `#/test/{year}` shows them plus `runExamWhy(year)` (AI explains why the paper is hard; prompt forbids guessing individual questions) and `askFromExam(year)`.
2. **Sub-lessons** — `topicSubLessons(topic)`: tier 1 from the chapter's real `know` entries, tier 2 `<ชื่อบท> 2 (ยากขึ้น)` unlocked at 1 star or best >= 60, tier 3 `แนวข้อสอบแข่งขัน` at best >= 80. Progress lives in `S.subProgress` (local only — `unit_progress` is keyed by unit_id, so never push sub ids there). Tier raises tutor difficulty automatically.
3. **Mock** — clicking Mock goes straight to a loading screen (`mockIntro` deleted). Asking during a mock opens an **in-page panel**, never a route change; that question's mark becomes `null` and leaves both numerator and denominator.
4. **Tables/graphs** — mock-generation prompt forbids ASCII art, requires per-line lists and LaTeX `array`; KaTeX renders it.
5. **Gating + anti-cheat** — `SUB_QUOTA` 12 (min 10 counts), `TOPIC_TEST_LEN` 15, `TOPIC_TEST_PASS` 60. Chapter test stays locked until every tier-1 sub-lesson is done; passing writes stars and unlocks tiers 2/3. `susWatch()` counts window blur, tab hidden, paste, and answers under `SUS_FAST_MS` (3000 ms); the result screen warns that such a score will not match a real A-Level result. Nothing is blocked; the flag is stored on `S.topicTests[id].sus`.
6. **`ค้นหาสถิติคะแนน`** — never a code bug: both providers were down. Fixed by repointing the fallback.
7. **Upload** — new Edge Function mode `solveUpload`; the user presses "ให้ AI ช่วยเฉลย" then only confirms ถูก/ไม่ถูก.

### Lesson flow is staged

`Tutor.stage` is `teach -> drill -> summary -> done`, advanced by buttons, not by the model. The teach prompt **forbids attaching a question** — that was the real cause of the truncated `โจทย์ข้อที่ 1: ...` the user reported. `looksTruncated()` also catches replies ending mid-sentence or with an odd number of `$`, then asks for one continuation and stitches the halves.

Teaching widgets (visible during teach, hidden during drill), all computed locally and never model-generated: tappable truth table for `logic`, tappable two-set Venn for `set`, existing SVG figure for topics with `topicFigure`.

### Planner produces work, not just an order

`[PLAN]` blocks carry `items[]` with `kind` in `learn | drill | applied | test | mock`. `applied` needs at least 2 chapters and launches `startAppliedLesson()`, a cross-chapter lesson about where those chapters join in real exam questions. `sanitizePlan()` drops unknown chapter ids, unknown kinds, and single-chapter `applied` items (verified with a poisoned block). The planner prompt receives real blueprint facts: strand shares, emphasised chapters, avgSteps, hardShare, past chapter-test results.

### Answer grading fixes

`toNumber()` parsed `3/10` as **3** (the regex matched only leading digits), so every fraction answer was marked wrong. It now handles `3/10`, `1 1/2`, `-3/10`, `3 / 10`, `0.5/0.25`, and returns `null` for `5/0`. `answerTolerance()` loosens the comparison **only** when the typed answer is a fraction and the stored answer has 2+ decimals, by half the last digit — so `1/3` matches `0.33` and `22/7` matches `3.14`, while `34/100` vs `0.33` and `1/3` vs `0.3` stay wrong. An explicit `q.tol` always wins.

### Leaderboard (its own tab)

Tab bar is now **6 tabs**; `อันดับ` sits between Test and ตั้งค่า. Route `#/board/{metric}`, six categories: `effort · improve · streak · days · questions · minutes`.

- Table `board_stats`: alias, joined, minutes, questions, active_days, streak, first_score, best_score. **No name, email, school, or grade.** RLS limits direct access to the owner's own row.
- Functions: `board_effort()`, `board_metric_value()`, `board_top(metric, limit)`, `my_board_ranks()`, `save_board_stats(...)`. The earlier `board_climb` / `board_improve` / `my_board_rank` were **dropped** — do not call them.
- `board_top` returns alias plus numbers, never `user_id`. Users outside the top 100 still see their own rank through `my_board_ranks()`, visible to nobody else. Alias is user-set (emails rejected) or auto-generated server-side. Leaving and rejoining the board is supported.
- Stats come from real sessions: `boardAddSession(startedAt, count)` runs on drill/test/mock completion, caps 180 minutes per session, records unique days.
- **Known weakness:** minutes and questions are reported by the browser. The server only caps values and enforces monotonic growth. Deriving them server-side from `tutor_usage` / `unit_progress` is the real fix.

### Offline exam extractor — `tools/exam-extract/`

Settles the long-standing question: **AI can read the real papers, through page images, not text extraction.** `pdftotext` loses all Thai (ปี 69 p.2 becomes `3. p, q r ... .1. q ? p`) and ปี 66 has a zero-character text layer, yet a rendered page reads perfectly including Thai, logic symbols, and equations.

- `extract_exam.py` — renders pages to JPEG (PyMuPDF, 120 dpi, cached), asks the model to catalogue each question, writes `out/exam-<year>.json`. Flags: `--pages`, `--limit`, `--dpi`, `--force`, `--render-only`, `--ocr`, `--provider {siamcodex,gemini}`.
- `build_signals.py` — merges into `alevel-signals.generated.js` (`EXAM_SIGNALS_REAL`). **Written but not wired into `index.html` yet** — wire it only after all years are extracted, then let `EXAM_SIGNALS` prefer generated values.
- **Copyright boundary, enforced in code:** the metadata prompt forbids copying stems, choices, and answers, and `clean()` keeps only 10 whitelisted fields. `--ocr` writes full page text to `_work/<year>/page-NN.txt` **only** — never `out/`, never the app. Shipping verbatim ทปอ./สทศ. questions inside the app needs their permission; do not build that without it.
- Verified on ปี 69 pages 2-4: `{"number": 3, "topicId": "logic", "steps": 3, "difficulty": "medium", "skills": ["การอ้างเหตุผล", "ค่าความจริง"]}`; OCR of p.2 produced 1,594 characters of correct Thai plus LaTeX.

### Environment gotchas that cost time

- All JS/CSS files are **CRLF**. String-replacement scripts must convert LF to CRLF before matching or every patch misses.
- `String.replace(from, to)` treats a dollar-quote sequence inside the replacement as "everything after the match" — it silently corrupted `tutor.js`. Always use `s.replace(from, () => to)`.
- SiamCodex sits behind Cloudflare, which blocks urllib's default user-agent with `error code: 1010` (HTTP 403) even when the key is valid. Send a browser user-agent.
- The Windows console is **cp874**; both Python tools force UTF-8 stdout or they crash printing Thai.
- Bash heredocs eat backslashes; build escape sequences with `chr(92)` or `String.fromCharCode(92)` when generating code.


## Session 2026-09-05 — website Math OCR (Codex)

Implemented locally, NOT deployed: `ocr.js`, OCR panels on `#/askq` and `#/upload`, local pinned `assets/vendor/pdf-lib-1.17.1.min.js`, `tutor` Edge Function mode `ocr`, styles, cache v45.

- JPG/PNG/WebP or PDF up to 10 MB. PDF page chooser extracts a single page in-browser before sending; API payload limit is 4 MB. Images resized to at most 2400 px.
- Requires sign-in and the existing AI consent setting in the UI. Uses existing authenticated tutor endpoint and daily usage counter. Deploy with JWT verification enabled (existing handler depends on the gateway signature check).
- Server reads `GEMINI_OCR_API_KEY` (falls back to `GEMINI_API_KEY`); `GEMINI_OCR_MODEL` defaults to `gemini-3.8-flash`. No provider key written into project files.
- OCR preserves text, choices, math and table cells; does not solve. Diagram reconstruction is not supported. Editable text plus escaped KaTeX preview; applying appends to the question field. Does not auto-publish extracted question content.
- Rejects invalid/oversized input, incomplete model output, quota errors, and timeouts. Controls recover for retry. Navigation/file changes cannot apply a stale response to a new panel.
- Verified new server branch with a live Gemini call on scanned 2566 page 2: Thai, fractions and LaTeX truth table. Browser tested using captured live result: PDF second-page isolation, image request, KaTeX, mobile overflow, HTML escaping, draft preservation, auth/consent, quota retry, invalid/oversized files, both panels. Browser tests used an isolated fake login and mocked HTTP response; production end-to-end verification remains outstanding.
- Publishing blocked: Supabase connector `get_edge_function` returned "You do not have permission to perform this action" for project xhkyaasgezqalsymnryg. No Supabase access token found in current environment. Need authorized Supabase access, set OCR secret, deploy tutor, then publish frontend and verify authenticated OCR on production.

## 1j. โหมดสอบจริง (Mock = exam mode) — 2026-09-07

Mock ไม่ใช่แบบฝึกอีกแล้ว มันคือการจำลองห้องสอบ ทุกตัวเลขมาจากข้อสอบจริง ไม่ได้ตั้งเอง

- `examFormat()` ใน `alevel.js` อ่านจาก `ALEVEL_EXAMS` ชุดล่าสุดที่มีข้อมูลครบ ตอนนี้ได้ 30 ข้อ / 90 นาที / ปี 2569
  ถ้าปีใหม่เปลี่ยนรูปแบบ แก้ที่ `ALEVEL_EXAMS` ที่เดียว ทั้งแอปตามทันที
- `mockBlueprintForUser(want)` ขยายสัดส่วนสาระให้ครบ `items` (เดิมย่อได้อย่างเดียว จึงได้แค่ 15 ข้อ)
  เติมให้จุดอ่อนของผู้เรียนและหัวข้อที่ `hard: true` ก่อน
- หน้าเตรียมข้อสอบ `mockLoading()` มีวงแหวนหมุน + ข้อความไล่ขั้น (`PREP_STEPS`) เปลี่ยนทุก 4 วินาที
  ผู้ใช้ยืนยันว่ารอ 2 นาทีได้ ขอแค่อย่าให้จอนิ่ง
- นาฬิกา `armMockClock()` นับ **ถอยหลัง** จาก `MOCK.deadline` (ตั้งครั้งเดียวตอนเริ่ม รีเฟรชไม่ยืดเวลา)
  เหลือ ≤ 5 นาที pill เป็นสีแดง (`.pill.warn`) หมดเวลาส่งอัตโนมัติ
- ระหว่างสอบ **ไม่มีตัวช่วยและไม่เฉลยรายข้อ** ปุ่มถาม AI ถูกถอดออกจาก `mockQuestion()`
  (`askThisMockQ` / `mockAskPanel` / `runMockAsk` ยังอยู่ในไฟล์แต่ไม่มีใครเรียก เผื่อทำโหมดฝึกแยกทีหลัง)
- `susWatch()` ใช้ร่วมกันแล้วทั้ง DRILL และ MOCK (นับ blur / paste / ตอบเร็วกว่า 3 วินาที) เตือนตอนสรุปผลอย่างเดียว ไม่บล็อก
- ออกกลางคันได้: `quitMock()` ถาม confirm แล้วตรวจจากข้อที่ทำไปแล้ว ข้อที่ยังไม่ทำไม่ถูกนับเป็นตัวหาร
- `mockDone()` แสดงจุดแข็ง (≥70%) / จุดอ่อน (<50%) รายสาระจาก `mockByTopic()` เวลาที่ใช้ ธงพฤติกรรม
  และรายการข้อที่ผิดซึ่งกดถาม AI ได้ **หลังสอบเสร็จ** ผ่าน `reviewMockQ(i)`

### ความยากต้องเท่าของจริง

ปัญหาเดิม: ข้อที่ AI ออกง่ายกว่าข้อสอบจริงมาก `fetchAiMockQuestions(want)` จึงสั่งเพิ่มว่า
ให้ยึด `avgSteps` และ `hardShare` จากหลักฐานข้อสอบจริงที่เซิร์ฟเวอร์แนบมาเป็นเป้า
ห้ามมีข้อแทนค่าครั้งเดียวจบ อย่างน้อย 1 ใน 3 ต้องรวมสองแนวคิดขึ้นไป และตัวเลือกลวงต้องมาจากความเข้าใจผิดจริง

หลักฐานนั้นมาจาก `wantExamEvidence: true` → `examEvidence()` ใน Edge Function ซึ่งดึง `exam_corpus_items`
(โจทย์ที่ Typhoon OCR อ่านมา + ค่าความยากที่ Gemma ประเมิน) **ต้อง import คลังเข้า Supabase ก่อนถึงจะมีผล**

### Edge Function (tutor v21)

- โหมด ocr ใช้พรอมป์ทางการของ Typhoon (`TYPHOON_PROMPT`) พรอมป์อิสระมันไม่สน จะไม่ได้ LaTeX
- `toDollarLatex()` แปลง `\( \)` เป็น `$` เพราะ KaTeX ในแอปตั้ง delimiter ไว้ที่ `$` เท่านั้น
- Gemma รับภาพได้ (ทดสอบแล้ว) ถอดเงื่อนไข `!image` ออก ตอนนี้ fallback ส่งรูปแนบไปด้วย

## 2. Feature work completed previously (still accurate)

- **Curriculum simplified**: Goal choices reduced from 5 (A-Level/TCAS/POSN/Classroom/Other) to 2 (School / A-Level) system-wide. Migration `softomni_goal_simplify_school_alevel` applied — 3 real user rows remapped, zero data loss.
- **A-Level target university + สาขา (major)**: New fields `target_university`/`target_major` on `learners`. AI tutor context includes them. New "สถิติที่ใช้ยื่น" (admission stats) feature on Test hub uses **Gemini Search grounding** (live web lookup, not a static DB) to estimate real admission-score ranges — clearly labeled as AI+web estimate, not official data.
- **Onboarding wizard**: school → grade → GPA → **new self-rated math-understanding step** → goal (2 choices, university/major sub-fields for A-Level) → PDPA consent. Finishing signup now routes to a new **Personalize** screen (`#/personalize`) offering "take Pre-test now" vs "skip," instead of dumping straight into lessons.
- **Personalize accept/reject loop**: After any pretest's AI analysis, user can "ใช้เลย" (apply recommendation) or "ไม่เอา อยากปรับเอง" (decline) — declining suppresses the 🎯 AI-recommended-unit highlight on the lesson path.
- **AI tone adaptation**: Chat tutor and pretest analysis now adjust register (encouraging/simple vs terse/challenging) based on the self-rated understanding level.
- **5-tab IA**: หน้าแรก (Dashboard) / บทเรียน (Lesson) / AI Tutor / Test / ตั้งค่า (Settings). Lesson-mode chat correctly attributes to "บทเรียน" tab, not "AI Tutor" tab.
- **LaTeX rendering**: KaTeX via CDN. AI tutor writes real LaTeX (`$...$`/`$$...$$`).
- **Geometry diagrams**: AI appends a `[DIAGRAM]{...}[/DIAGRAM]` JSON block; client validates against a shape whitelist and numeric params only (XSS-safe) and renders inline SVG.
- **Upload-question flow**: Answer optional. Source/provenance field required.
- **"Harder and harder" goal-practice**: Test hub units launch the adaptive AI-tutor chat.
- **National-average benchmark**: Real static data — O-NET ม.3 คณิตศาสตร์ 26.8% (สทศ., ปีการศึกษา 2568) for ม.1-3, A-Level คณิตศาสตร์ประยุกต์ 1 34.7% (ทปอ.) for ม.4-6.

## 3. Bugs found and fixed along the way

- `.goalcards`/`.goalcard`/`.stepdots` CSS classes were used throughout the wizard but had **zero styling rules** until the redesign pass.
- PowerShell `Get-Content`/`Set-Content` cache-version bumps were silently mojibake-corrupting the Thai `<title>`/`<meta description>` in `index.html`. Direct UTF-8 file I/O only.
- `S.lastPretest` never stored the `level` field, so the AI-recommended-unit 🎯 highlight was silently always inactive.
- `<svg height="auto">` — invalid as an XML attribute; moved into `style`.
- Pretest timer interval now clears when leaving `#/pretest` so it cannot leak across routes.

## 4. Architecture reference (unchanged, still accurate)

- Cache bust: **`?v=44`** — bump every `?v=` in `index.html` on any deploy-relevant change, using direct UTF-8 file I/O (never PowerShell `Get-Content`/`Set-Content`).
- Routes added 2026-09-04: `#/drill/{topicId}/{subId|_test|_topic}` and `#/board/{metric}`.
- State keys added: `S.subProgress`, `S.topicTests`, `S.board`, `S.firstScore` — all local; only `S.board` is mirrored to Supabase via `save_board_stats`.
- Supabase project `xhkyaasgezqalsymnryg` (ap-southeast-1) — Postgres + Auth (email OTP) + Storage + Edge Functions. Kept strictly separate from the user's other Supabase project (`Child`/NongRak).
- Edge Function `tutor` (Deno) — **version 15**. Gemini first, SiamCodex fallback (env vars still named `DEEPSEEK_*`). Two-layer auth gate, daily rate limit via `bump_tutor_usage`. Modes: `ask`, `lesson`, `analyze`, `analyzeUpload`, **`solveUpload`**, `uniStats`. Local source: `supabase/functions/tutor/index.ts`.
- RLS on every table; writes go through RPCs with coalesce-merge (never blind overwrite).
- Models: `gemini-3.6-flash` (primary), `vertex.gemini-3.8-flash` (fallback via SiamCodex).
- Tables: `learners`, `unit_progress`, `questions`, `tutor_usage`, `pretest_results`, **`board_stats`** (new).

## 5. Outstanding TODOs

- Concept-explanation content type (blocks `linearfunc.html` match).
- Inline step-by-step solution + mini AI widget (`solution.html`).
- Decision: whether to ever offer real mock-exam packs, or keep Test hub as Pre-test + unit practice forever.
- **Run the extractor over all 15 papers**, then wire `EXAM_SIGNALS_REAL` into `alevel.js` — replaces 3 hand-estimated years with real per-question data (~250 model calls).
- Deploy the staged `maxOutputTokens` 2600 change if truncation recurs.
- Decide whether the server-side table/LaTeX rule should be added (rejected once).
- Move leaderboard minutes/questions to server-derived values so a browser cannot forge them.
- Optional: `--cross-check` in the extractor (OCR through both providers, diff pages that disagree).
- Phone/SMS login (Supabase Twilio) if product still wants เบอร์โทร.
- Production deploy (`npx vercel --prod --yes`) after visual sign-off.
