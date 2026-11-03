# SoftOmni (MathPath)

Thai math app for ม.1–ม.6 and A-Level คณิตศาสตร์ประยุกต์ 1. Static frontend + Supabase (auth, sync, Edge Function tutor).

Live: https://mathpath-sbw.vercel.app

## What is public

- App source (`index.html`, `app.js`, `tutor.js`, `curriculum.js`, `alevel.js`, `style.css`)
- Tutor Edge Function source under `supabase/functions/tutor/` — it reads keys from **server secrets**, not from this repo

## What stays private

Do not commit:

- `.env` / API keys (Gemini, DeepSeek, service role)
- Exam PDFs and OCR under `tools/exam-corpus/_private/` (copyright ทปอ./สทศ.)
- `exams/*.pdf` and extracted profiles

The website publishable Supabase key in `sync.js` is designed to be public. Access is enforced with RLS. Never put a `service_role` or model API key in frontend files.

## Run locally

Open `index.html` or serve the folder. Sign-in uses email OTP via Supabase.

Set Edge Function secrets in the Supabase dashboard (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`), not in git.
