"""อ่านข้อสอบจริงทั้ง 15 ชุดด้วย Typhoon OCR แล้วให้ Gemma สรุปว่ายากแค่ไหนและหน้าตาเป็นอย่างไร

สองขั้น เพราะโมเดลสองตัวถนัดคนละอย่าง:
  ขั้น 1  Typhoon = อ่านตัวอักษรไทยจากภาพ (ทำตามพรอมป์อิสระไม่ได้ ต้องใช้พรอมป์แบบที่มันเทรนมา)
  ขั้น 2  Gemma   = อ่านข้อความที่ถอดได้ แล้วจัดเป็นข้อมูลรายข้อ + สรุปภาพรวมของชุด

ลิขสิทธิ์: ข้อความข้อสอบเป็นของ ทปอ./สทศ. จึงเก็บใน _private เท่านั้น
(_private อยู่ใน .gitignore และ tools/ อยู่ใน .vercelignore แล้ว)

ใช้งาน:
    set TYPHOON_OCR_URL=...      set TYPHOON_OCR_API_KEY=...
    set GEMMA_URL=...            set GEMMA_API_KEY=...
    python typhoon_pipeline.py                 # ทำทุกชุดที่เจอ
    python typhoon_pipeline.py --years 2568    # เฉพาะบางปี
    python typhoon_pipeline.py --ocr-only      # อ่านอย่างเดียว ยังไม่วิเคราะห์
"""

import argparse
import base64
import concurrent.futures
import hashlib
import io
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

import fitz  # PyMuPDF

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = pathlib.Path(__file__).parent
PRIVATE = HERE / "_private"
OCR_DIR = PRIVATE / "ocr"
SOURCE = pathlib.Path(os.environ.get("EXAM_SOURCE", r"D:/171.sbw_hackathon/02.Source"))

TYPHOON_URL = os.environ.get("TYPHOON_OCR_URL", "").rstrip("/")
TYPHOON_KEY = os.environ.get("TYPHOON_OCR_API_KEY", "")
TYPHOON_MODEL = os.environ.get("TYPHOON_OCR_MODEL", "/model")
GEMMA_URL = os.environ.get("GEMMA_URL", "").rstrip("/")
GEMMA_KEY = os.environ.get("GEMMA_API_KEY", "")
GEMMA_MODEL = os.environ.get("GEMMA_MODEL", "google/gemma-4-26b-a4b-it")

VERSION = "typhoon-gemma-v1"
TOPICS = ["set", "logic", "real", "func", "explog", "trig", "complex", "matrix", "seq",
          "analytic", "vector", "stat", "count", "prob", "dist", "calc"]
STRANDS = ["alg", "geo", "stat", "calc"]
DIFFS = ["easy", "medium", "hard"]

# พรอมป์แบบที่ Typhoon OCR เทรนมา — ทดสอบแล้วว่าแบบนี้เท่านั้นที่ทำให้มันคืน LaTeX
# พรอมป์อิสระ (ไทยหรืออังกฤษ) ได้ ASCII เปล่าๆ เช่น "p V ~q" แทน LaTeX
OCR_PROMPT = (
    "Below is an image of a document page along with its dimensions and possibly some raw textual content "
    "previously extracted from it. Note that the text extraction may be incomplete or partially missing. "
    "Carefully consider both the image and the extracted text to reconstruct the document accurately.\n"
    "Your task is to return the markdown representation of this document, presented in a clean and structured format.\n"
    "Render tables in markdown. Render all equations and mathematical symbols in LaTeX.\n"
    "RAW_TEXT_START\n\nRAW_TEXT_END"
)


def post(base, key, model, messages, max_tokens, temperature=0.0, timeout=300, retries=3):
    body = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(base + "/chat/completions",
                                     data=json.dumps(body).encode("utf-8"),
                                     headers={"Authorization": "Bearer " + key,
                                              "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.load(r)
            return d["choices"][0]["message"]["content"] or ""
        except Exception as e:
            last = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("%s: %s" % (type(last).__name__, str(last)[:160]))


def unwrap(raw):
    """Typhoon หุ้มผลไว้เป็น JSON คีย์ต่างกันไปตามพรอมป์ — แกะให้ได้ข้อความจริง"""
    t = (raw or "").strip()
    if not t.startswith("{"):
        return t
    try:
        o = json.loads(t[t.index("{"):t.rindex("}") + 1])
        for k in ("natural_language", "natural language", "text", "markdown"):
            if isinstance(o.get(k), str) and o[k].strip():
                return o[k].strip()
    except Exception:
        pass
    return t


def to_dollar_latex(s):
    r"""Typhoon คืน \( ... \) แต่ KaTeX ในแอปตั้ง delimiter ไว้ที่ $ เท่านั้น
    และมันใส่ escape แบบ markdown มาด้วย (3\. 1\)) ต้องล้างทิ้ง"""
    s = s.replace("\\(", "$").replace("\\)", "$")
    s = s.replace("\\[", "$$").replace("\\]", "$$")
    s = re.sub(r"\\([.)\[\]])", r"\1", s)
    return s


def ocr_page(args):
    year, idx, img_path = args
    out = OCR_DIR / str(year) / ("page-%02d.txt" % (idx + 1))
    if out.exists() and out.stat().st_size > 0:
        return idx, io.open(out, encoding="utf-8").read(), True
    b64 = base64.b64encode(open(img_path, "rb").read()).decode()
    raw = post(TYPHOON_URL, TYPHOON_KEY, TYPHOON_MODEL,
               [{"role": "user", "content": [
                   {"type": "text", "text": OCR_PROMPT},
                   {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}}]}],
               max_tokens=3000)
    text = to_dollar_latex(unwrap(raw))
    out.parent.mkdir(parents=True, exist_ok=True)
    io.open(out, "w", encoding="utf-8").write(text)
    return idx, text, False


ANALYZE_SYS = (
    "คุณคือผู้วิเคราะห์ข้อสอบคณิตศาสตร์ A-Level ของไทย ตอบเป็น JSON อย่างเดียว "
    "ห้ามมีข้อความอื่น ห้ามใส่ code fence"
)


JSON_ESCAPES = set('\\"/bfnrtu')


def fix_json_escapes(s):
    r"""โมเดลเขียน LaTeX ในสตริง JSON เป็น $\sqrt{3}$ ซึ่ง \s ไม่ใช่ escape ที่ JSON ยอมรับ
    ข้อเดียวที่มีรากจึงทำให้ทั้งเอกสาร parse ไม่ผ่าน ต้องเติม backslash ให้ถูกก่อน
    ดูเป็นชุด ไม่ใช่ทีละตัว ไม่งั้นจะไปทำลายของที่ escape ถูกอยู่แล้ว"""
    def repl(m):
        run, ch = m.group(1), m.group(2)
        # จำนวนคู่ = escape ครบแล้ว เช่น \\vec ที่โมเดลเขียนถูกอยู่แล้ว ห้ามไปยุ่ง
        if len(run) % 2 == 0 or ch in JSON_ESCAPES:
            return m.group(0)
        return run + '\\' + ch
    return re.sub(r"(\\+)(.)", repl, s, flags=re.S)


def parse_or_salvage(raw):
    """ถ้ายังพังอีกก็ยังมีข้อที่สมบูรณ์อยู่ข้างหน้า อย่าทิ้งทั้งก้อน
    ตัดกลับไปที่ } ตัวสุดท้ายที่ปิดครบ แล้วปิดวงเล็บให้เอง"""
    raw = fix_json_escapes(raw)
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        try:
            return json.loads(m.group(0))
        except ValueError:
            pass
    start = raw.find('"questions"')
    if start < 0:
        return None
    body = raw[raw.find("[", start):]
    depth = 0
    cut = -1
    for i, ch in enumerate(body):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                cut = i
    if cut < 0:
        return None
    try:
        return {"questions": json.loads(body[:cut + 1] + "]")}
    except ValueError:
        return None


def analyze_pages(year, pages_text, first_no):
    """ให้ Gemma แปลงข้อความที่ถอดได้เป็นข้อมูลรายข้อ"""
    joined = "\n\n".join("[หน้า %d]\n%s" % (p, t[:4000]) for p, t in pages_text)
    user = (
        "ข้างล่างคือข้อความที่ถอดจากข้อสอบคณิตศาสตร์ของไทย ปี %d\n"
        "แยกออกมาเป็นรายข้อ ตอบ JSON รูปแบบ:\n"
        '{"questions":[{"number":3,"page":2,"stem":"โจทย์ตามที่อ่านได้",'
        '"choices":["1. ...","2. ..."],"topic":"logic","strand":"alg","type":"mc",'
        '"steps":3,"difficulty":"medium","skills":["ตารางค่าความจริง"],'
        '"reason":"เหตุผลสั้นๆ ว่าทำไมยากระดับนี้","hasFigure":false,"hasTable":false}]}\n'
        "topic เลือกจาก: %s\n"
        "strand: alg=จำนวนและพีชคณิต geo=การวัดและเรขาคณิต stat=สถิติและความน่าจะเป็น calc=แคลคูลัส\n"
        "type: mc=ปรนัย num=เติมตัวเลข · steps=จำนวนขั้นคิด 1-6 · difficulty: easy/medium/hard\n"
        "เอาเฉพาะข้อที่มีเลขข้อชัดเจนในข้อความนี้ ถ้าอ่านไม่ออกให้ข้ามข้อนั้น\n\n%s"
    ) % (year, ", ".join(TOPICS), joined)
    raw = post(GEMMA_URL, GEMMA_KEY, GEMMA_MODEL,
               [{"role": "system", "content": ANALYZE_SYS}, {"role": "user", "content": user}],
               max_tokens=8000, temperature=0.1)
    data = parse_or_salvage(raw)
    if data is None:
        print("  หน้า %d: อ่าน JSON ไม่ได้ ทิ้งทั้งก้อน (%d อักขระ)" % (first_no, len(raw)), flush=True)
        return []
    out = []
    for q in (data.get("questions") or []):
        if not isinstance(q, dict) or q.get("topic") not in TOPICS:
            continue
        try:
            num = int(q.get("number"))
        except (TypeError, ValueError):
            continue
        steps = q.get("steps")
        page = q.get("page")
        page = int(page) if isinstance(page, int) else first_no
        out.append({
            "number": num,
            "page_start": page,
            "page_end": page,
            "stem": str(q.get("stem") or "")[:2000],
            "choices": [str(c)[:300] for c in (q.get("choices") or [])][:6],
            "topics": [q["topic"]],
            "strand": q.get("strand") if q.get("strand") in STRANDS else "",
            "type": "num" if q.get("type") == "num" else "mc",
            "steps_estimate": int(steps) if isinstance(steps, int) and 1 <= steps <= 6 else None,
            "difficulty_estimate": q.get("difficulty") if q.get("difficulty") in DIFFS else None,
            "skills": [str(s)[:40] for s in (q.get("skills") or [])][:3],
            "reason": str(q.get("reason") or "")[:300],
            "solution_outline": "",
            "has_figure": bool(q.get("hasFigure")),
            "has_table": bool(q.get("hasTable")),
            "needs_review": (not q.get("stem")) or (q.get("difficulty") not in DIFFS),
            "review_reason": "",
        })
    return out


def describe_paper(year, questions):
    """ให้ Gemma สรุปว่าชุดนี้ยากแค่ไหนและหน้าตาเป็นอย่างไร — ใช้เป็นคำอธิบายในแอป"""
    facts = [{"number": q["number"], "topic": q["topics"][0], "steps": q["steps_estimate"],
              "difficulty": q["difficulty_estimate"], "skills": q["skills"]} for q in questions]
    user = (
        "นี่คือสรุปรายข้อของข้อสอบคณิตศาสตร์ ปี %d\n%s\n\n"
        "เขียนสรุปภาษาไทย 5-8 บรรทัด บอกว่า 1) ชุดนี้ยากระดับไหนเมื่อเทียบกับเวลาที่ให้ "
        "2) บทไหนออกหนัก 3) หน้าตาข้อสอบเป็นอย่างไร ต้องเตรียมตัวแบบไหน "
        "อ้างเฉพาะตัวเลขที่ให้มา ห้ามแต่งสถิติเพิ่ม ห้ามลอกข้อความโจทย์ ตอบเป็นข้อความธรรมดา"
    ) % (year, json.dumps(facts, ensure_ascii=False)[:6000])
    try:
        return post(GEMMA_URL, GEMMA_KEY, GEMMA_MODEL,
                    [{"role": "user", "content": user}], max_tokens=900, temperature=0.4).strip()
    except Exception as e:
        return "สรุปไม่สำเร็จ: %s" % type(e).__name__


def summarize(year, kind, questions, page_count):
    rated = [q for q in questions if q["difficulty_estimate"]]
    stepped = [q["steps_estimate"] for q in questions if q["steps_estimate"]]
    topics = {}
    for q in questions:
        topics[q["topics"][0]] = topics.get(q["topics"][0], 0) + 1
    ranked = sorted(topics.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "counted": len(questions),
        "ratedCount": len(rated),
        "coverage": "complete" if len(questions) >= 28 else "partial",
        "kind": kind,
        "pages": page_count,
        "topics": dict(ranked),
        "extra": [t for t, _ in ranked[:4]],
        "avgSteps": round(sum(stepped) / len(stepped), 2) if stepped else None,
        "hardShare": round(sum(1 for q in rated if q["difficulty_estimate"] == "hard") / len(rated), 3) if rated else None,
        "numericShare": round(sum(1 for q in questions if q["type"] == "num") / len(questions), 3) if questions else None,
        "figureCount": sum(1 for q in questions if q["has_figure"]),
        "tableCount": sum(1 for q in questions if q["has_table"]),
    }


def find_papers():
    """จับคู่ไฟล์ PDF กับ พ.ศ. จากชื่อไฟล์ — ชื่อมีทั้งแบบ 'ปี69' และ 'tcas68'"""
    out = []
    for pdf in sorted(SOURCE.glob("*.pdf")):
        # ไฟล์คะแนนรับเข้า (ENTRACE_SCORE) ไม่ใช่ข้อสอบ ต้องข้าม
        # ไม่งั้นจะถูกจับเป็นปีเดียวกับข้อสอบแล้วเขียนทับผลของจริง
        if re.search(r"(?i)entrace|entrance|score", pdf.name):
            continue
        year = None
        for n in re.findall(r"(\d{2,4})", pdf.name):
            v = int(n)
            if 2555 <= v <= 2600:
                year = v
                break
            if 55 <= v <= 99:
                year = 2500 + v
                break
        if not year:
            print("ข้ามไฟล์ที่เดาปีไม่ได้:", pdf.name, flush=True)
            continue
        out.append((year, "a_level" if year >= 2566 else "samuan", pdf))
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--ocr-only", action="store_true")
    args = ap.parse_args()

    if not TYPHOON_URL or not TYPHOON_KEY:
        sys.exit("ต้องตั้ง TYPHOON_OCR_URL และ TYPHOON_OCR_API_KEY")
    if not args.ocr_only and (not GEMMA_URL or not GEMMA_KEY):
        sys.exit("ต้องตั้ง GEMMA_URL และ GEMMA_API_KEY")

    want = {int(y) for y in args.years.split(",") if y.strip()} if args.years else None
    papers = [p for p in find_papers() if not want or p[0] in want]
    print("จะทำ %d ชุด: %s" % (len(papers), ", ".join(str(p[0]) for p in papers)), flush=True)

    for year, kind, pdf in papers:
        t0 = time.time()
        doc = fitz.open(pdf)
        total = doc.page_count
        img_dir = PRIVATE / "pages" / str(year)
        img_dir.mkdir(parents=True, exist_ok=True)
        tasks = []
        for i in range(total):
            p = img_dir / ("page-%02d.jpg" % (i + 1))
            if not p.exists():
                doc[i].get_pixmap(dpi=args.dpi).save(str(p))
            tasks.append((year, i, str(p)))

        pages = {}
        cached = 0
        failed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(ocr_page, t): t[1] for t in tasks}
            for f in concurrent.futures.as_completed(futs):
                try:
                    idx, text, was_cached = f.result()
                    pages[idx] = text
                    cached += 1 if was_cached else 0
                except Exception as e:
                    failed += 1
                    print("  หน้า %d อ่านไม่สำเร็จ: %s" % (futs[f] + 1, type(e).__name__), flush=True)
        print("%d: OCR %d/%d หน้า (แคช %d, พลาด %d) %.0f วินาที" % (
            year, len(pages), total, cached, failed, time.time() - t0), flush=True)
        if args.ocr_only:
            continue

        questions = []
        for start in range(0, total, 3):
            chunk = [(i + 1, pages[i]) for i in range(start, min(start + 3, total)) if pages.get(i)]
            if not chunk:
                continue
            try:
                got = analyze_pages(year, chunk, start + 1)
            except Exception as e:
                print("  วิเคราะห์หน้า %d-%d ไม่สำเร็จ: %s" % (start + 1, start + len(chunk), type(e).__name__), flush=True)
                continue
            if not got:
                print("  หน้า %d-%d: ไม่ได้ข้อเลย" % (start + 1, start + len(chunk)), flush=True)
            seen = {q["number"] for q in questions}
            questions += [q for q in got if q["number"] not in seen]
        questions.sort(key=lambda q: q["number"])

        summary = summarize(year, kind, questions, total)
        summary["narrative"] = describe_paper(year, questions) if questions else ""
        paper = {
            "id": hashlib.sha256(pdf.read_bytes()).hexdigest(),
            "year": year, "kind": kind, "source_name": pdf.name, "page_count": total,
            "model": "typhoon+" + GEMMA_MODEL, "prompt_version": VERSION,
            "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "summary": summary, "questions": questions,
        }
        io.open(PRIVATE / ("exam-%d.json" % year), "w", encoding="utf-8").write(
            json.dumps(paper, ensure_ascii=False, indent=1))
        print("%d: %d ข้อ · %s · ขั้นเฉลี่ย %s · ข้อยาก %s · รวม %.0f วินาที" % (
            year, len(questions), summary["coverage"], summary["avgSteps"],
            summary["hardShare"], time.time() - t0), flush=True)


if __name__ == "__main__":
    main()
