# Learning improvements (2026-09-06)

Frontend v48 adds 16 named foundation skills with computed answers, a stable daily plan, fresh independent practice, 24-hour retention checks, and five-stage lessons. This is not full A-Level curriculum coverage. AI and unreviewed OCR answers are excluded from scored drill evidence. Pretest figures are diagnostics, not calibrated national-exam predictions.

Schema is installed on MathPath Supabase. Both new tables require authenticated owner access; practice evidence is client submitted and is not suitable for competitive rankings. Question reports exclude the reported answer from current mastery evidence.

Tests: test.cjs checks 3,200 generated questions and progression; test-db.cjs tests RLS with local PGlite; browser.cjs exercises the full flow with mocked cloud calls. Test runtime paths reflect the development machine.
