"""รวมผลจาก out/exam-*.json เป็นไฟล์ JS ก้อนเดียวให้แอปใช้

ผลลัพธ์: alevel-signals.generated.js ซึ่งประกาศ EXAM_SIGNALS_REAL
โครงเดียวกับ EXAM_SIGNALS ที่เขียนมือไว้ใน alevel.js แต่ตัวเลขมาจากข้อสอบจริง
ไม่ใช่ค่าประมาณ จึงเอาไปแทนของเดิมได้ตรงๆ

ใช้งาน:
    python build_signals.py                 # เขียนไฟล์ไว้ข้าง alevel.js
    python build_signals.py --print         # ดูผลเฉยๆ ไม่เขียนไฟล์
"""

import argparse
import glob
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# คอนโซล Windows ไทยเป็น cp874 พิมพ์ไทย/สัญลักษณ์แล้วพัง จึงบังคับเป็น utf-8
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

OUT = os.path.join(HERE, "out")
TARGET = os.path.abspath(os.path.join(HERE, "..", "..", "alevel-signals.generated.js"))


def summarize(doc):
    qs = doc.get("questions") or []
    if not qs:
        return None
    topics, strands, skills = {}, {}, {}
    steps, hard, figures, tables, numeric = [], 0, 0, 0, 0
    for q in qs:
        topics[q["topicId"]] = topics.get(q["topicId"], 0) + 1
        if q.get("strand"):
            strands[q["strand"]] = strands.get(q["strand"], 0) + 1
        if q.get("steps"):
            steps.append(q["steps"])
        if q.get("difficulty") == "hard":
            hard += 1
        if q.get("hasFigure"):
            figures += 1
        if q.get("hasTable"):
            tables += 1
        if q.get("type") == "num":
            numeric += 1
        for s in (q.get("skills") or []):
            skills[s] = skills.get(s, 0) + 1

    ranked = sorted(topics.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "year": doc["year"],
        "kind": doc.get("kind", "a_level"),
        "counted": len(qs),
        "extra": [t for t, _ in ranked[:4]],           # บทที่ออกเยอะสุดของปีนั้น
        "topics": dict(ranked),
        "strands": strands,
        "avgSteps": round(sum(steps) / len(steps), 2) if steps else None,
        "hardShare": round(hard / len(qs), 3),
        "numericShare": round(numeric / len(qs), 3),
        "figureCount": figures,
        "tableCount": tables,
        "topSkills": [s for s, _ in sorted(skills.items(), key=lambda kv: (-kv[1], kv[0]))[:8]],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", dest="show", action="store_true")
    args = ap.parse_args()

    out = {}
    for path in sorted(glob.glob(os.path.join(OUT, "exam-*.json"))):
        with io.open(path, encoding="utf-8") as f:
            doc = json.load(f)
        s = summarize(doc)
        if s:
            out[str(s["year"])] = s
            print("%d: %d kho · avgSteps %s · hard %s%%"
                  % (s["year"], s["counted"], s["avgSteps"], round(s["hardShare"] * 100)))

    if not out:
        print("no files in out/ — run extract_exam.py first")
        return

    body = json.dumps(out, ensure_ascii=False, indent=2)
    if args.show:
        print(body)
        return

    js = (
        "/* สร้างอัตโนมัติจาก tools/exam-extract/build_signals.py — ห้ามแก้มือ\n"
        "   ตัวเลขทุกตัวนับจากข้อสอบจริงที่อ่านด้วยโมเดลอ่านภาพ ไม่ใช่ค่าประมาณ\n"
        "   เก็บเฉพาะสถิติ ไม่มีข้อความโจทย์ ตัวเลือก หรือเฉลย */\n"
        "const EXAM_SIGNALS_REAL = " + body + ";\n"
    )
    with io.open(TARGET, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    print("wrote %s (%d years)" % (TARGET, len(out)))


if __name__ == "__main__":
    main()
