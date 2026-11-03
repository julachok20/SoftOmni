# -*- coding: utf-8 -*-
"""แยกสถิติคะแนนรับเข้า (TCAS) จากไฟล์ xx.ENTRACE_SCORE.pdf

ไฟล์พวกนี้มีข้อความฝังอยู่แล้ว ไม่ต้อง OCR แต่เป็นตาราง จึงอ่านด้วยพิกัดของคำ
แล้วจัดกลุ่มเป็นแถวตามแกน y ไม่ใช่อ่านทีละบรรทัดซึ่งจะได้ทีละช่อง

หัวตารางแต่ละปีไม่เหมือนกัน จึงไม่ยึดตำแหน่งคอลัมน์ตายตัว
เก็บตัวเลขท้ายแถวไว้ทั้งชุด แล้วค่อยเดาว่าตัวไหนคือคะแนนสูงสุด/ต่ำสุด
ถ้าเดาผิดก็ยังมีตัวเลขดิบให้แก้ทีหลังได้ ดีกว่าทิ้งข้อมูล
"""
import argparse
import io
import json
import pathlib
import re
import sys
import time

import fitz

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SOURCE = pathlib.Path(r"D:\171.sbw_hackathon\02.Source")
OUT_DIR = pathlib.Path(__file__).parent / "_private"

NUM = re.compile(r"^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$")
UNI_HINT = re.compile(r"มหาวิทยาลัย|จุฬาลงกรณ์|สถาบัน|วิทยาลัย|ราชภัฏ|ราชมงคล")


def to_num(tok):
    try:
        return float(tok.replace(",", ""))
    except ValueError:
        return None


def rows_from_page(page, tol=2.5):
    """จัดคำให้เป็นแถวของตาราง

    ไฟล์ชุดนี้หมุน 90 องศา แถวจริงจึงเรียงตามแกน x ไม่ใช่ y
    ถ้าจัดตามแกน y จะได้คอลัมน์ของคะแนนมาแทน ซึ่งจับคู่กับชื่อคณะไม่ได้
    """
    words = page.get_text("words")   # (x0, y0, x1, y1, word, block, line, word_no)
    if not words:
        return []
    rot = page.rotation % 360
    sideways = rot in (90, 270)
    key = (lambda w: w[0]) if sideways else (lambda w: w[1])      # แกนที่ใช้แบ่งแถว
    order = (lambda w: -w[1]) if rot == 90 else (lambda w: w[1]) if sideways else (lambda w: w[0])
    buckets = {}
    for w in words:
        buckets.setdefault(round(key(w) / tol), []).append(w)
    rows = []
    for k in sorted(buckets):
        rows.append([w[4] for w in sorted(buckets[k], key=order)])
    return rows


def parse_row(tokens):
    """แยกแถวเป็นส่วนข้อความกับตัวเลขท้ายแถว คืน None ถ้าไม่ใช่แถวข้อมูล"""
    if len(tokens) < 4:
        return None
    tail = []
    i = len(tokens) - 1
    while i >= 0 and NUM.match(tokens[i]):
        tail.append(to_num(tokens[i]))
        i -= 1
    tail.reverse()
    head = tokens[:i + 1]
    if len(tail) < 3 or not head:
        return None
    text = " ".join(head)
    if not UNI_HINT.search(text):
        return None
    code = ""
    m = re.search(r"\b\d{8,}[A-Za-z]?\b", text)
    if m:
        code = m.group(0)
        text = text.replace(code, " ").strip()
    # ชื่อมหาวิทยาลัยเป็นคำเดียวติดกัน ส่วนหน้าเป็นเลขลำดับกับรหัส จึงหาจากคำที่ตรงเงื่อนไข
    toks = [t for t in text.split() if t]
    uni_at = next((k for k, t in enumerate(toks) if UNI_HINT.search(t)), -1)
    uni = toks[uni_at] if uni_at >= 0 else ""
    rest = [t for k, t in enumerate(toks) if k != uni_at and not NUM.match(t)]
    parts = [uni] + rest if uni else (rest or [text])
    # คะแนนมักเป็นคู่ที่ติดกันและมีทศนิยม สูงสุดมาก่อนต่ำสุดเสมอ
    best = None
    for a in range(len(tail) - 1):
        hi, lo = tail[a], tail[a + 1]
        if hi is None or lo is None:
            continue
        if hi >= lo > 0 and (hi != int(hi) or lo != int(lo)) and hi < 100000:
            best = (hi, lo)
            break
    return {
        "code": code,
        "university": parts[0][:80],
        "detail": " · ".join(parts[1:])[:200],
        "nums": tail,
        "max": best[0] if best else None,
        "min": best[1] if best else None,
    }


def year_of(name):
    m = re.match(r"(\d{2})\.", name)
    return 2500 + int(m.group(1)) if m else None


def run(paths, limit_pages=0):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for pdf in paths:
        year = year_of(pdf.name)
        if not year:
            print("ข้ามไฟล์ที่อ่านปีไม่ออก: %s" % pdf.name, flush=True)
            continue
        t0 = time.time()
        doc = fitz.open(pdf)
        total = doc.page_count if not limit_pages else min(limit_pages, doc.page_count)
        rows = []
        for i in range(total):
            for toks in rows_from_page(doc[i]):
                r = parse_row(toks)
                if r:
                    r["page"] = i + 1
                    rows.append(r)
        doc.close()
        scored = [r for r in rows if r["min"] is not None]
        out = {
            "year": year,
            "source": pdf.name,
            "page_count": total,
            "row_count": len(rows),
            "with_score": len(scored),
            "rows": rows,
        }
        path = OUT_DIR / ("scores-%d.json" % year)
        io.open(path, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False))
        print("%d: %d หน้า · %d แถว (มีคะแนน %d) · %.0f วินาที" % (
            year, total, len(rows), len(scored), time.time() - t0), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="")
    ap.add_argument("--pages", type=int, default=0, help="จำกัดจำนวนหน้าต่อไฟล์ ใช้ตอนลองของ")
    args = ap.parse_args()
    want = {int(y) for y in args.years.split(",") if y.strip()} if args.years else None
    paths = [p for p in sorted(SOURCE.glob("*.ENTRACE_SCORE.pdf"))
             if not want or year_of(p.name) in want]
    print("จะทำ %d ไฟล์: %s" % (len(paths), ", ".join(str(year_of(p.name)) for p in paths)), flush=True)
    run(paths, args.pages)
    print("เสร็จทั้งหมด", flush=True)


if __name__ == "__main__":
    main()
