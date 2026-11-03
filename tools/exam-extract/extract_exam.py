"""ดึง "ข้อมูลเกี่ยวกับข้อสอบ" ออกจากไฟล์ข้อสอบจริง โดยไม่คัดลอกตัวโจทย์

ทำไมต้องอ่านจากภาพ: เลเยอร์ข้อความใน PDF ของ ทปอ. อ่านภาษาไทยไม่ได้
(pdftotext คืนอักขระว่างกับ ?) และบางปีไม่มีเลเยอร์ข้อความเลย
แต่โมเดลที่อ่านภาพอ่านหน้ากระดาษได้ครบ จึงเรนเดอร์เป็นภาพแล้วให้โมเดลอ่าน

ทำไมไม่เก็บตัวโจทย์: ข้อสอบเป็นลิขสิทธิ์ ทปอ./สทศ.
สคริปต์นี้เก็บเฉพาะ metadata ที่สรุปเอง (บทไหน ยากแค่ไหน กี่ขั้น)
ภาพหน้ากระดาษอยู่ใน _work/ ซึ่งห้ามคอมมิตและห้ามอัปขึ้นเว็บ

ใช้งาน:
    set SIAMCODEX_API_KEY=sk-...
    python extract_exam.py --pdf "D:/171.sbw_hackathon/02.Source/ข้อสอบคณิต1 A-Level ปี69.pdf" --year 2569
    python extract_exam.py --pdf "..." --year 2566 --pages 2-21
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

import fitz  # PyMuPDF

# คอนโซล Windows ไทยเป็น cp874 พิมพ์ไทย/สัญลักษณ์แล้วพัง จึงบังคับเป็น utf-8
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "_work")   # ภาพหน้ากระดาษ + ผลดิบรายหน้า ห้ามคอมมิต
OUT = os.path.join(HERE, "out")      # ผลรวมต่อปี เก็บเฉพาะ metadata คอมมิตได้

BASE = os.environ.get("SIAMCODEX_BASE", "https://chatbot.siamcodex.com/api/v1").rstrip("/")
# ปลายทางอยู่หลัง Cloudflare ซึ่งบล็อก User-Agent ของ urllib (error code: 1010)
# ต้องส่ง UA แบบเบราว์เซอร์ ไม่งั้นได้ 403 ทั้งที่คีย์ถูก
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
MODEL = os.environ.get("SIAMCODEX_MODEL", "vertex.gemini-3.8-flash")

# เรียก Gemini ตรงก็ได้ ถ้ามีคีย์ของตัวเองและอยากใช้โควตาตัวเอง
# ปลายทาง SiamCodex ก็วิ่งไป Gemini (vertex.gemini-*) เหมือนกัน ต่างที่ใครออกโควตา
GEMINI_KEY_ENV = "GEMINI_API_KEY"
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent"

# ต้องตรงกับ ALEVEL_TOPICS ใน alevel.js — ถ้าโมเดลตอบรหัสอื่นถือว่าใช้ไม่ได้
TOPICS = [
    "set", "logic", "real", "func", "explog", "trig", "complex", "matrix", "seq",
    "analytic", "vector", "stat", "count", "prob", "dist", "calc",
]
STRANDS = ["alg", "geo", "stat", "calc"]
DIFFICULTY = ["easy", "medium", "hard"]

PROMPT = (
    "คุณกำลังอ่านหน้าหนึ่งของข้อสอบคณิตศาสตร์ไทย เพื่อทำบัญชีลักษณะข้อสอบ\n"
    "ห้ามคัดลอกข้อความโจทย์ ตัวเลือก หรือเฉลย ออกมาเด็ดขาด ไม่ว่ากรณีใด\n"
    "ให้ตอบเฉพาะข้อมูลสรุปของแต่ละข้อที่เห็นในหน้านี้ เป็น JSON อย่างเดียว ห้าม markdown:\n"
    '{"questions":[{"number":3,"topicId":"logic","strand":"alg","type":"mc",'
    '"steps":2,"difficulty":"medium","skills":["ตารางค่าความจริง"],'
    '"hasFigure":false,"hasTable":false}]}\n'
    "topicId เลือกจาก: " + ", ".join(TOPICS) + "\n"
    "strand เลือกจาก: alg (จำนวนและพีชคณิต), geo (การวัดและเรขาคณิต), stat (สถิติและความน่าจะเป็น), calc (แคลคูลัส)\n"
    "type เป็น mc (ปรนัย) หรือ num (เติมคำตอบเป็นตัวเลข)\n"
    "steps คือจำนวนขั้นคิดที่ต้องทำจริงกว่าจะได้คำตอบ 1 ถึง 6\n"
    "difficulty เลือกจาก easy medium hard เทียบกับมาตรฐาน A-Level คณิตศาสตร์ประยุกต์ 1\n"
    "skills เป็นคำสั้นๆ ไม่เกิน 3 คำ บอกทักษะที่ข้อนั้นใช้ ไม่ใช่ข้อความจากโจทย์\n"
    'ถ้าหน้านี้ไม่มีข้อสอบ (ปก คำชี้แจง หน้าว่าง) ให้ตอบ {"questions":[]}\n'
    "ถ้าข้อหนึ่งต่อเนื่องมาจากหน้าก่อน ให้นับเฉพาะข้อที่มีเลขข้อปรากฏในหน้านี้"
)


OCR_PROMPT = (
    "ถอดข้อความทั้งหน้านี้ออกมาให้ครบตามที่เห็น เป็นภาษาไทยและสัญลักษณ์เดิม\n"
    "สมการและสัญลักษณ์คณิตศาสตร์ให้เขียนเป็น LaTeX ครอบด้วย $...$\n"
    "รักษาเลขข้อและลำดับตัวเลือกไว้ ห้ามเดาส่วนที่อ่านไม่ออก ให้ใส่ [อ่านไม่ออก] แทน\n"
    "ห้ามเฉลย ห้ามอธิบายเพิ่ม ตอบเฉพาะข้อความที่อยู่บนหน้ากระดาษ"
)


def render_page(doc, index, year, dpi):
    """เรนเดอร์หน้าเป็น PNG แล้วแคชไว้ ใช้ซ้ำได้เวลารันใหม่"""
    d = os.path.join(WORK, str(year))
    os.makedirs(d, exist_ok=True)
    # เก็บเป็น JPEG เพราะ PNG หน้าละ ~2.5 MB ส่งขึ้นไปแล้วช้าและเปลืองโควตา
    path = os.path.join(d, "page-%02d.jpg" % (index + 1))
    if not os.path.exists(path):
        doc[index].get_pixmap(dpi=dpi).save(path)
    return path


def ask_gemini(img_path, api_key, retries=3, prompt=None):
    """เรียก Gemini API ตรง — รูปส่งเป็น inline_data ไม่ใช่ data URL แบบ OpenAI"""
    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    payload = {
        "contents": [{"role": "user", "parts": [
            {"text": prompt or PROMPT},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
        ]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 4000},
    }
    req = urllib.request.Request(
        GEMINI_URL % GEMINI_MODEL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
    )
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read().decode("utf-8"))
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts)
        except (urllib.error.URLError, KeyError, IndexError, ValueError) as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("เรียก Gemini ไม่สำเร็จ: %s" % last)


def ask_vision(img_path, api_key, retries=3, prompt=None):
    """ส่งภาพหน้ากระดาษไปให้โมเดลอ่าน — ปลายทางเป็น OpenAI-compatible"""
    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    payload = {
        "model": MODEL,
        "temperature": 0,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt or PROMPT},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}},
            ],
        }],
    }
    req = urllib.request.Request(
        BASE + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": UA,
        },
    )
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
        except (urllib.error.URLError, KeyError, ValueError) as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("เรียกโมเดลไม่สำเร็จ: %s" % last)


def clean(raw, page_no):
    """รับเฉพาะค่าที่อยู่ในรายการที่รู้จัก ทิ้งที่เหลือ — กันโมเดลแต่งรหัสบทเอง
    และกันตัวโจทย์หลุดออกมา เพราะฟิลด์ที่ไม่ได้ขอถูกตัดทิ้งทั้งหมด"""
    m = re.search(r"\{[\s\S]*\}", raw or "")
    if not m:
        return []
    try:
        data = json.loads(m.group(0))
    except ValueError:
        return []
    out = []
    for q in (data.get("questions") or []):
        if not isinstance(q, dict):
            continue
        topic = str(q.get("topicId") or "")
        if topic not in TOPICS:
            continue
        strand = str(q.get("strand") or "")
        diff = str(q.get("difficulty") or "")
        try:
            steps = int(q.get("steps") or 0)
        except (TypeError, ValueError):
            steps = 0
        skills = [str(s)[:24] for s in (q.get("skills") or [])][:3]
        out.append({
            "page": page_no,
            "number": q.get("number") if isinstance(q.get("number"), int) else None,
            "topicId": topic,
            "strand": strand if strand in STRANDS else "",
            "type": "num" if q.get("type") == "num" else "mc",
            "steps": min(6, max(1, steps)) if steps else None,
            "difficulty": diff if diff in DIFFICULTY else "",
            "skills": skills,
            "hasFigure": bool(q.get("hasFigure")),
            "hasTable": bool(q.get("hasTable")),
        })
    return out


def parse_pages(spec, total):
    if not spec:
        return list(range(total))
    out = []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if "-" in chunk:
            a, b = chunk.split("-", 1)
            out += list(range(int(a) - 1, int(b)))
        elif chunk:
            out.append(int(chunk) - 1)
    return [i for i in out if 0 <= i < total]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--year", required=True, type=int, help="พ.ศ. ของชุดสอบ เช่น 2569")
    ap.add_argument("--kind", default="a_level", choices=["a_level", "samuan"])
    ap.add_argument("--pages", default="", help="เช่น 2-21 หรือ 2,3,5 (ว่าง = ทุกหน้า)")
    ap.add_argument("--dpi", default=120, type=int)
    ap.add_argument("--limit", default=0, type=int, help="อ่านกี่หน้าแล้วหยุด (ไว้ทดลอง)")
    ap.add_argument("--force", action="store_true", help="อ่านใหม่ทั้งที่มีผลแคชแล้ว")
    ap.add_argument("--render-only", action="store_true", help="เรนเดอร์ภาพอย่างเดียว ไม่เรียกโมเดล")
    ap.add_argument("--provider", default="siamcodex", choices=["siamcodex", "gemini"],
                    help="ใช้ SiamCodex (ค่าเริ่มต้น) หรือเรียก Gemini ตรงด้วย GEMINI_API_KEY")
    ap.add_argument("--ocr", action="store_true",
                    help="ถอดข้อความเต็มหน้า เก็บใน _work เท่านั้น (ลิขสิทธิ์ ทปอ. ห้ามนำขึ้นแอป)")
    args = ap.parse_args()

    if args.provider == "gemini":
        api_key = os.environ.get(GEMINI_KEY_ENV, "")
        ask = ask_gemini
        key_name = GEMINI_KEY_ENV
    else:
        api_key = os.environ.get("SIAMCODEX_API_KEY", "")
        ask = ask_vision
        key_name = "SIAMCODEX_API_KEY"
    if not api_key and not args.render_only:
        sys.exit("ต้องตั้ง %s ก่อน (ห้ามใส่คีย์ลงไฟล์)" % key_name)

    doc = fitz.open(args.pdf)
    pages = parse_pages(args.pages, doc.page_count)
    if args.limit:
        pages = pages[:args.limit]

    os.makedirs(OUT, exist_ok=True)
    cache_dir = os.path.join(WORK, str(args.year))
    os.makedirs(cache_dir, exist_ok=True)

    questions = []
    for i in pages:
        img = render_page(doc, i, args.year, args.dpi)
        if args.render_only:
            print("rendered p%d" % (i + 1))
            continue
        if args.ocr:
            # ข้อความเต็มหน้าเป็นของ ทปอ./สทศ. จึงเขียนลง _work เท่านั้น
            # ห้ามคัดลอกไป out/ ห้ามคอมมิต ห้ามอัปขึ้นแอป ใช้สอบทานในเครื่องเท่านั้น
            txt_path = os.path.join(cache_dir, "page-%02d.txt" % (i + 1))
            if not os.path.exists(txt_path) or args.force:
                text = ask(img, api_key, prompt=OCR_PROMPT)
                with open(txt_path, "w", encoding="utf-8") as f:
                    f.write(text or "")
            print("p%-3d ocr -> %s" % (i + 1, os.path.basename(txt_path)))

        cache = os.path.join(cache_dir, "page-%02d.json" % (i + 1))
        if os.path.exists(cache) and not args.force:
            with open(cache, encoding="utf-8") as f:
                got = json.load(f)
        else:
            got = clean(ask(img, api_key), i + 1)
            with open(cache, "w", encoding="utf-8") as f:
                json.dump(got, f, ensure_ascii=False, indent=1)
        questions += got
        print("p%-3d %d ข้อ" % (i + 1, len(got)))

    if args.render_only:
        return

    out_path = os.path.join(OUT, "exam-%d.json" % args.year)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "year": args.year,
            "kind": args.kind,
            "pages": doc.page_count,
            "source": os.path.basename(args.pdf),
            "questions": questions,
        }, f, ensure_ascii=False, indent=1)
    print("รวม %d ข้อ -> %s" % (len(questions), out_path))


if __name__ == "__main__":
    main()
