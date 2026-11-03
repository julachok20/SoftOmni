# exam-extract — อ่านข้อสอบจริง เก็บเฉพาะสถิติ

เครื่องมือรันในเครื่องผู้พัฒนาเท่านั้น ไม่ได้เป็นส่วนหนึ่งของเว็บแอป

## ทำไมต้องมี

`EXAM_SIGNALS` ใน `alevel.js` เดิมเป็นค่าประมาณที่กะเอาแค่ 3 ปี
เครื่องมือนี้แทนที่ด้วยตัวเลขที่นับจากข้อสอบจริงได้ทั้ง 15 ชุด

ทำไมไม่ใช้ pdftotext: เลเยอร์ข้อความใน PDF ของ ทปอ. อ่านไทยไม่ออก
ปี 69 หน้า 2 ได้ออกมาเป็น `3.   p, q  r ... .1.  q ? p` — ภาษาไทยหายทั้งหมด
ปี 66 ไม่มีเลเยอร์ข้อความเลย (0 อักขระ)
แต่พอเรนเดอร์เป็นภาพแล้วให้โมเดลอ่าน ได้ครบทั้งไทย สัญลักษณ์ และสมการ

## ลิขสิทธิ์ — ข้อจำกัดที่ต้องรักษา

ข้อสอบเป็นของ ทปอ./สทศ. เครื่องมือนี้จึง:

- **ไม่เก็บข้อความโจทย์ ตัวเลือก หรือเฉลย** — พรอมป์สั่งห้าม และ `clean()` ตัดฟิลด์ที่ไม่ได้ขอทิ้งทุกตัว
- เก็บเฉพาะ metadata ที่สรุปเอง: บทไหน สาระไหน ปรนัย/เติมตัวเลข กี่ขั้นคิด ยากแค่ไหน มีรูปหรือตารางไหม
- ภาพหน้ากระดาษอยู่ใน `_work/` เท่านั้น **ห้ามคอมมิต ห้ามอัปขึ้นเว็บ ห้ามใส่ลงแอป**
- ไฟล์ที่เอาขึ้นแอปได้คือ `out/exam-*.json` และ `alevel-signals.generated.js` ซึ่งมีแต่ตัวเลข

## วิธีใช้

```bat
set SIAMCODEX_API_KEY=sk-...
cd D:\Claude-Access\MathPath\tools\exam-extract

REM อ่านทีละชุด ทำซ้ำได้ ผลรายหน้าถูกแคชไว้
python extract_exam.py --pdf "D:/171.sbw_hackathon/02.Source/ข้อสอบคณิต1 A-Level ปี69.pdf" --year 2569
python extract_exam.py --pdf "D:/171.sbw_hackathon/02.Source/tcas68-math1-a-level.pdf" --year 2568
python extract_exam.py --pdf "D:/171.sbw_hackathon/02.Source/3. A-Level ปี 67.pdf" --year 2567
python extract_exam.py --pdf "D:/171.sbw_hackathon/02.Source/4. A-Level ปี 66.pdf" --year 2566
python extract_exam.py --pdf "D:/171.sbw_hackathon/02.Source/ข้อสอบสามัญปี63.pdf" --year 2563 --kind samuan

REM รวมทุกปีเป็นไฟล์เดียวให้แอป
python build_signals.py
```

ตัวเลือกที่ใช้บ่อย:

| ตัวเลือก | ทำอะไร |
|---|---|
| `--pages 2-21` | อ่านเฉพาะหน้าที่ระบุ หน้าแรกมักเป็นปก |
| `--limit 3` | อ่าน 3 หน้าแรกแล้วหยุด ไว้ลองก่อนรันเต็ม |
| `--dpi 150` | เพิ่มความละเอียดถ้าหน้าไหนอ่านพลาด ค่าเริ่มต้น 120 |
| `--force` | อ่านใหม่ทับผลที่แคชไว้ |
| `--render-only` | เรนเดอร์ภาพอย่างเดียว ไม่เรียกโมเดล ไม่เสียโควตา |

## ผลลัพธ์

`out/exam-2569.json` — รายข้อ:

```json
{"page": 2, "number": 3, "topicId": "logic", "strand": "alg", "type": "mc",
 "steps": 3, "difficulty": "medium", "skills": ["การอ้างเหตุผล", "ค่าความจริง"],
 "hasFigure": false, "hasTable": false}
```

`alevel-signals.generated.js` — สรุปรายปี ประกาศ `EXAM_SIGNALS_REAL`:
`counted`, `extra` (บทที่ออกเยอะสุด), `topics`, `strands`, `avgSteps`,
`hardShare`, `numericShare`, `figureCount`, `tableCount`, `topSkills`

## เอาไปต่อยังไง

1. เพิ่ม `<script src="alevel-signals.generated.js?v=NN"></script>` ใน `index.html` ก่อน `alevel.js`
2. ใน `alevel.js` ให้ `EXAM_SIGNALS` อ่านจาก `EXAM_SIGNALS_REAL` เมื่อมีปีนั้น แล้วค่อยถอยไปใช้ค่าเดิม
3. `examPressure()` กับ `runExamWhy()` จะได้ตัวเลขจริงทันที ไม่ต้องแก้อะไรเพิ่ม

ยังไม่ได้ต่อให้ เพราะควรรันครบทุกปีก่อน แล้วค่อยสลับทีเดียว

## ข้อควรรู้

- ปลายทางอยู่หลัง Cloudflare ที่บล็อก User-Agent ของ urllib (`error code: 1010` คืน HTTP 403) สคริปต์จึงส่ง UA แบบเบราว์เซอร์
- โมเดลอ่านผิดได้ ค่าที่ได้คือการจัดหมวดของโมเดล ไม่ใช่ประกาศของ ทปอ. ถ้าจะใช้อ้างอิงจริงจังควรสุ่มตรวจ
- ราคาและเวลา: หน้าละ 1 คำขอ ชุดหนึ่งราว 19-21 หน้า ครบ 15 ชุดประมาณ 250 คำขอ
