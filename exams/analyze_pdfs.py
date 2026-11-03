# -*- coding: utf-8 -*-
"""Classify local A-Level / สามัญ PDFs into 16 topics using math tokens.
Writes UTF-8 JSON. Does not copy question stems into the web app."""
import json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
import fitz

SRC = r'D:\171.sbw_hackathon\02.Source'
DEST = r'D:\Claude-Access\MathPath\exams\profiles.json'

# token patterns that survive Thai encoding damage
RULES = [
    ('set', [r'∪', r'∩', r'⊂', r'⊆', r'∅', r'P\s*\(', r'\\cup', r'\\cap', r'power\s*set']),
    ('logic', [r'\\wedge', r'\\vee', r'\\neg', r'\\Rightarrow', r'\\leftrightarrow', r'p\s*→', r'p\s*∧']),
    ('real', [r'พหุนาม', r'polynomial', r'x\^\{?\d', r'\\mathbb\{R\}', r'\|.+\|', r'degree']),
    ('func', [r'f\s*\(', r'g\s*\(', r'โดเมน', r'domain', r'f\s*∘', r'f\^{-1}']),
    ('explog', [r'\\log', r'\blog\b', r'\\ln', r'\bln\b', r'a\^\{?x', r'2\^\{?x']),
    ('trig', [r'\bsin\b', r'\bcos\b', r'\btan\b', r'\\sin', r'\\cos', r'\\tan', r'\\theta', r'°']),
    ('complex', [r'\bi\b', r'a\s*\+\s*bi', r'\\mathbb\{C\}', r'โมดูลัส', r'arg\s*\(']),
    ('matrix', [r'det\s*\(', r'\\begin\{pmatrix\}', r'\\begin\{bmatrix\}', r'เมทริกซ์', r'\[\[']),
    ('seq', [r'a_n', r'S_n', r'\\sum', r'ลำดับ', r'อนุกรม', r'geometric', r'arithmetic']),
    ('analytic', [r'x\^2\s*\+\s*y\^2', r'ความชัน', r'slope', r'วงกลม', r'\(x\s*-\s*h\)']),
    ('vector', [r'\\vec', r'\\cdot', r'\\times', r'เวกเตอร์', r'i\s*\+\s*.*j']),
    ('stat', [r'\\bar\{', r'SD', r'ส่วนเบี่ยง', r'median', r'quartile', r'\\sigma']),
    ('count', [r'C\s*\(', r'P\s*\(', r'n!', r'\\binom', r'เรียงสับ', r'จัดหมู่']),
    ('prob', [r'P\s*\(', r'ความน่าจะ', r'independent', r'conditional']),
    ('dist', [r'ปกติ', r'binomial', r'E\s*\(', r'Var\s*\(', r'\\mu']),
    ('calc', [r'\\lim', r'\blim\b', r'\\int', r'd/dx', r"f'", r'\\frac\{d', r'อนุพันธ์', r'ปริพันธ์']),
]

def year_of(name):
    for y in range(55, 70):
        if str(y) in name or str(2500 + y) in name:
            return 2500 + y
    return None

def classify(text):
    scores = {}
    for tid, pats in RULES:
        n = 0
        for p in pats:
            n += len(re.findall(p, text, re.I))
        if n:
            scores[tid] = n
    if not scores:
        return None, 0
    best = max(scores, key=scores.get)
    return best, scores[best]

def split_items(text):
    parts = re.split(r'(?:^|\n)\s*(\d{1,2})\s*[\.\)、]', text)
    items = []
    i = 1
    while i + 1 < len(parts):
        num = parts[i]
        body = parts[i + 1]
        if num.isdigit() and 1 <= int(num) <= 40 and len(body.strip()) > 12:
            items.append({'n': int(num), 'body': body[:800]})
        i += 2
    return items

def complexity(body):
    majors = 1
    minors = len(set(tid for tid, n in ((t, classify(body)[0]) for t in [1]) if n))
    topic, _ = classify(body)
    # count distinct topic hits
    hits = [tid for tid, pats in RULES if any(re.search(p, body, re.I) for p in pats)]
    minors = max(1, len(hits))
    majors = 1 if minors <= 3 else 2
    ops = len(re.findall(r'[=+\-×÷/\\frac]|\\sum|\\int|\\lim', body))
    steps = min(8, max(1, ops // 2 + minors))
    return {'majors': majors, 'minors': minors, 'steps': steps, 'topics': hits, 'topic': topic}

rows = []
for name in os.listdir(SRC):
    if not name.lower().endswith('.pdf'):
        continue
    path = os.path.join(SRC, name)
    doc = fitz.open(path)
    text = '\n'.join((page.get_text('text') or '') for page in doc)
    chars = len(text.strip())
    items = split_items(text)
    classified = []
    topic_count = {}
    for it in items:
        cx = complexity(it['body'])
        tid = cx['topic'] or 'real'
        topic_count[tid] = topic_count.get(tid, 0) + 1
        classified.append({
            'n': it['n'],
            'topic': tid,
            'topics': cx['topics'],
            'majors': cx['majors'],
            'minors': cx['minors'],
            'steps': cx['steps']
        })
    # whole-doc fallback if split failed (scans / encoding)
    if not classified:
        tid, _ = classify(text)
        if tid:
            topic_count[tid] = 1
    avg_steps = round(sum(c['steps'] for c in classified) / len(classified), 1) if classified else None
    hard_n = sum(1 for c in classified if c['steps'] >= 4 or c['minors'] >= 3)
    kind = 'a_level' if re.search(r'A-?Level|tcas|alevel', name, re.I) else 'samuan'
    rows.append({
        'file': name,
        'year': year_of(name),
        'kind': kind,
        'pages': doc.page_count,
        'text_chars': chars,
        'scanned': chars < 500,
        'items': len(classified),
        'topic_count': topic_count,
        'avg_steps': avg_steps,
        'hard_items': hard_n,
        'classified': classified[:30]
    })
    doc.close()

rows.sort(key=lambda r: (r['year'] or 0, r['file']))
os.makedirs(os.path.dirname(DEST), exist_ok=True)
with open(DEST, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
print('wrote', DEST, 'years', len(rows))
for r in rows:
    top = sorted(r['topic_count'].items(), key=lambda x: -x[1])[:5]
    print(r['year'], r['kind'], 'items', r['items'], 'avg_steps', r['avg_steps'],
          'SCAN' if r['scanned'] else 'TEXT', top)
