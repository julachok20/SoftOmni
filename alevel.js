/* SoftOmni — คลังข้อสอบจริง + โครงบท A-Level คณิตศาสตร์ประยุกต์ 1
   ไฟล์ PDF ต้นทางอยู่ที่ D:\171.sbw_hackathon\02.Source (ไม่ใส่ขึ้นเว็บ สิทธิ์ ทปอ./สทศ.)
   โครงสร้าง 16 บท / 4 สาระ ตามประกาศข้อสอบ A-Level คณิต 1 (ทปอ. / mytcas)
   ก่อนปี 2566 ใช้ชุดวิชาสามัญ คณิตศาสตร์ 1 ตามที่ระบุ */

const ALEVEL_NATIONAL = { pct: 20.44, year: 2569, label: 'A-Level คณิตศาสตร์ประยุกต์ 1', source: 'ทปอ. (mytcas)' };

const ALEVEL_EXAMS = [
  { year: 2555, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 16, scanned: false },
  { year: 2556, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 16, scanned: false },
  { year: 2557, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 16, scanned: false },
  { year: 2558, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 16, scanned: false },
  { year: 2559, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 15, scanned: false },
  { year: 2560, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 15, scanned: false },
  { year: 2561, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 15, scanned: false },
  { year: 2562, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 16, scanned: false },
  { year: 2563, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 15, scanned: false },
  { year: 2564, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 14, scanned: false },
  { year: 2565, kind: 'samuan', label: 'วิชาสามัญ คณิตศาสตร์ 1', pages: 17, scanned: true },
  { year: 2566, kind: 'a_level', label: 'A-Level คณิตศาสตร์ประยุกต์ 1', pages: 21, scanned: true, q: 30, minutes: 90, score: 100 },
  { year: 2567, kind: 'a_level', label: 'A-Level คณิตศาสตร์ประยุกต์ 1', pages: 17, scanned: false, q: 30, minutes: 90, score: 100 },
  { year: 2568, kind: 'a_level', label: 'A-Level คณิตศาสตร์ประยุกต์ 1', pages: 21, scanned: false, q: 30, minutes: 90, score: 100 },
  { year: 2569, kind: 'a_level', label: 'A-Level คณิตศาสตร์ประยุกต์ 1', pages: 19, scanned: false, q: 30, minutes: 90, score: 100 }
];

const ALEVEL_STRANDS = [
  { id: 'alg', name: 'จำนวนและพีชคณิต', share: '15–17 ข้อ' },
  { id: 'geo', name: 'การวัดและเรขาคณิต', share: '3–5 ข้อ' },
  { id: 'stat', name: 'สถิติและความน่าจะเป็น', share: '6–8 ข้อ' },
  { id: 'calc', name: 'แคลคูลัส', share: '2–4 ข้อ' }
];

/* หัวข้อย่อย = 16 บทสนามจริง
   know = สิ่งที่ต้องรู้/ฝึก (หลักการในบท ไม่แต่งทฤษฎียาว)
   units = หน่วยในคลังหลักสูตรที่ใช้เป็นโจทย์พื้นฐาน
   hard = บทที่วิเคราะห์จากข้อสอบจริงปี 69 ว่าฝึกเยอะ */
const ALEVEL_TOPICS = [
  { id: 'set', strand: 'alg', name: 'เซต', icon: '∪',
    about: 'เซตคือกลุ่มของสิ่งของที่กำหนดชัดว่าอะไรอยู่ในกลุ่ม อะไรไม่อยู่ สมาชิกไม่ซ้ำและไม่สนใจลำดับ',
    terms: [
      { name: 'เพาเวอร์เซต', def: 'P(A) คือเซตของสับเซตทั้งหมดของ A ถ้า A มี n สมาชิก แล้ว |P(A)| = 2ⁿ รวมเซตว่างและ A เอง' },
      { name: 'ยูเนียน / อินเตอร์เซกชัน', def: 'A ∪ B คือสมาชิกที่อยู่ใน A หรือ B หรือทั้งคู่ · A ∩ B คือสมาชิกที่อยู่ในทั้งสองเซต' },
      { name: 'ส่วนเติมเต็ม', def: 'A′ (หรือ Aᶜ) คือสมาชิกในเอกภพสัมพัทธ์ U ที่ไม่อยู่ใน A' }
    ],
    know: ['เพาเวอร์เซต', 'ยูเนียน อินเตอร์เซกชัน ส่วนเติมเต็ม', 'แก้โจทย์ด้วยแผนภาพเวนน์'],
    units: ['m4u1'], hard: false },
  { id: 'logic', strand: 'alg', name: 'ตรรกศาสตร์', icon: '🧠',
    about: 'ตรรกศาสตร์ดูประพจน์ว่าจริงหรือเท็จ และดูว่าการอ้างเหตุผลสมเหตุสมผลหรือไม่',
    terms: [
      { name: 'ประพจน์', def: 'ประโยคที่ตัดสินได้ว่าจริงหรือเท็จอย่างใดอย่างหนึ่ง ไม่ทั้งสอง' },
      { name: 'ตัวเชื่อม', def: '∧ และ · ∨ หรือ · → ถ้า…แล้ว · ↔ ก็ต่อเมื่อ · ∼ นิเสธ' },
      { name: 'ข้อความแย้งสลับที่', def: 'contrapositive ของ p → q คือ ∼q → ∼p สมมูลกับต้นฉบับ' }
    ],
    know: ['ประพจน์และค่าความจริง', 'ตัวเชื่อมและตารางค่าความจริง', 'เหตุผลและการอ้างเหตุผล'],
    units: ['m4u2'], hard: false },
  { id: 'real', strand: 'alg', name: 'จำนวนจริงและพหุนาม', icon: 'ℝ',
    about: 'จำนวนจริงครอบคลุมตรรกยะและอตรรกยะ พหุนามคือผลรวมพจน์ axⁿ ใช้หาร แยกตัวประกอบ และแก้สมการ',
    terms: [
      { name: 'พหุนาม', def: 'รูป aₙxⁿ + … + a₀ ดีกรีคือเลขชี้กำลังสูงสุดที่สัมประสิทธิ์ไม่เป็นศูนย์' },
      { name: 'ทฤษฎีบทเศษเหลือ', def: 'หาร f(x) ด้วย (x − c) เหลือเศษ f(c)' },
      { name: 'อสมการพหุนาม', def: 'หาช่วงจากราก แล้วดูเครื่องหมายของแต่ละช่วงบนเส้นจำนวน' }
    ],
    know: ['สมบัติจำนวนจริง', 'พหุนาม หารและเศษ', 'สมการ/อสมการพหุนาม'],
    units: ['m4u3', 'm4u4', 'm2u3', 'm2u4'], hard: false },
  { id: 'func', strand: 'alg', name: 'ความสัมพันธ์และฟังก์ชัน', icon: 'ƒ',
    about: 'ฟังก์ชันจับคู่สมาชิกโดเมนแต่ละตัวกับเรนจ์ได้เพียงค่าเดียว กราฟช่วยอ่านค่าและพฤติกรรม',
    terms: [
      { name: 'โดเมน / เรนจ์', def: 'โดเมนคือค่า x ที่ f นิยามได้ เรนจ์คือค่า y ที่ f ให้ได้จริง' },
      { name: 'ฟังก์ชันประกอบ', def: '(f ∘ g)(x) = f(g(x)) ทำ g ก่อน แล้วค่อย f' },
      { name: 'อินเวอร์ส', def: 'f⁻¹ สลับคู่ (x,y) เป็น (y,x) มีได้เมื่อ f เป็นหนึ่งต่อหนึ่งและทั่วถึง' }
    ],
    know: ['โดเมน เรนจ์', 'ฟังก์ชันประกอบและอินเวอร์ส', 'อ่านกราฟ'],
    units: ['m4u5'], hard: false },
  { id: 'explog', strand: 'alg', name: 'เอกซ์โพเนนเชียลและลอการิทึม', icon: '📈',
    about: 'เอกซ์โพเนนเชียลคือฐานยกกำลังแปรผัน ลอการิทึมคือเลขชี้กำลังที่ทำให้ฐานได้ค่านั้น',
    terms: [
      { name: 'ลอการิทึม', def: 'log_b a = c ก็ต่อเมื่อ bᶜ = a (b > 0, b ≠ 1, a > 0)' },
      { name: 'เปลี่ยนฐาน', def: 'log_b a = log_k a / log_k b' },
      { name: 'สมบัติ', def: 'log(xy) = log x + log y · log(x/y) = log x − log y · log xⁿ = n log x' }
    ],
    know: ['สมบัติเลขยกกำลัง', 'ลอการิทึมและการเปลี่ยนฐาน', 'สมการเอกซ์โพเนนเชียล/ลอการิทึม'],
    units: ['m4u7'], hard: false },
  { id: 'trig', strand: 'alg', name: 'ฟังก์ชันตรีโกณมิติ', icon: '🌊',
    about: 'sin cos tan ผูกมุมกับอัตราส่วนในสามเหลี่ยมมุมฉาก และขยายเป็นฟังก์ชันบนวงกลมหนึ่งหน่วย',
    terms: [
      { name: 'อัตราส่วน', def: 'sin = ข้าม/ด้านตรงข้ามมุมฉาก · cos = ชิด/ด้านตรงข้ามมุมฉาก · tan = ข้าม/ชิด' },
      { name: 'เอกลักษณ์', def: 'sin²θ + cos²θ = 1 และสูตรมุมรวม มุมสองเท่า' },
      { name: 'สมการตรีโกณ', def: 'หาคำตอบทั่วไปในรอบ 360° หรือ 2π แล้วบวกคาบ' }
    ],
    know: ['อัตราส่วนตรีโกณมิติ', 'เอกลักษณ์และสมการ', 'ประยุกต์มุมและสามเหลี่ยม'],
    units: ['m5u1', 'm3u7'], hard: true },
  { id: 'complex', strand: 'alg', name: 'จำนวนเชิงซ้อน', icon: '𝑖',
    about: 'จำนวนเชิงซ้อนเขียน a + bi โดย i² = −1 ใช้แก้สมการที่รากไม่อยู่ในจำนวนจริง',
    terms: [
      { name: 'รูปมาตรฐาน', def: 'z = a + bi · a ส่วนจริง b ส่วนจินตภาพ' },
      { name: 'โมดูลัส', def: '|z| = √(a² + b²) คือระยะจากจุดกำเนิดบนระนาบเชิงซ้อน' },
      { name: 'รากของสมการ', def: 'สมการพหุนามดีกรี n มีรากเชิงซ้อน n ราก นับซ้ำ' }
    ],
    know: ['รูป a+bi และโมดูลัส', 'การดำเนินการ', 'รากของสมการ'],
    units: ['m5u4'], hard: false },
  { id: 'matrix', strand: 'alg', name: 'เมทริกซ์', icon: '▦',
    about: 'เมทริกซ์จัดตัวเลขเป็นแถวคอลัมน์ ใช้คูณ หาดีเทอร์มิแนนต์ อินเวอร์ส และแก้ระบบเชิงเส้น',
    terms: [
      { name: 'คูณเมทริกซ์', def: 'แถวของตัวหน้าจุดกับคอลัมน์ของตัวหลัง จำนวนคอลัมน์ซ้ายต้องเท่าแถวขวา' },
      { name: 'ดีเทอร์มิแนนต์', def: 'det สำหรับเมทริกซ์จัตุรัส ถ้า det ≠ 0 จะมีอินเวอร์ส' },
      { name: 'ระบบสมการ', def: 'AX = B มีคำตอบเดียวเมื่อ A หาอินเวอร์สได้ X = A⁻¹B' }
    ],
    know: ['บวก คูณ ดีเทอร์มิแนนต์', 'อินเวอร์ส', 'ระบบสมการเชิงเส้น'],
    units: ['m5u2'], hard: false },
  { id: 'seq', strand: 'alg', name: 'ลำดับและอนุกรม', icon: '🔢',
    about: 'ลำดับคือรายการเลขตามตำแหน่ง อนุกรมคือผลบวกของพจน์ในลำดับ',
    terms: [
      { name: 'เลขคณิต', def: 'ผลต่างร่วม d · พจน์ที่ n คือ a + (n−1)d · ผลบวก n พจน์ = n/2 · (พจน์แรก+พจน์สุดท้าย)' },
      { name: 'เรขาคณิต', def: 'อัตราส่วนร่วม r · พจน์ที่ n คือ arⁿ⁻¹' },
      { name: 'อนุกรมอนันต์', def: 'ลู่เข้าเมื่อ |r| < 1 ผลบวก = a/(1−r)' }
    ],
    know: ['ลำดับเลขคณิต/เรขาคณิต', 'ผลบวกอนุกรม', 'อนุกรมอนันต์ที่ลู่เข้า'],
    units: ['m5u5'], hard: false },
  { id: 'analytic', strand: 'geo', name: 'เรขาคณิตวิเคราะห์', icon: '🗺️',
    about: 'ใช้พิกัด (x,y) อธิบายเส้นตรง วงกลม และภาคตัดกรวยด้วยสมการ',
    terms: [
      { name: 'ความชัน', def: 'm = (y₂−y₁)/(x₂−x₁) เส้นขนานชันเท่ากัน เส้นตั้งฉาก m₁m₂ = −1' },
      { name: 'วงกลม', def: '(x−h)² + (y−k)² = r² จุดศูนย์กลาง (h,k) รัศมี r' },
      { name: 'ระยะ', def: 'ระยะระหว่างสองจุด √[(x₂−x₁)²+(y₂−y₁)²]' }
    ],
    know: ['เส้นตรง ความชัน ระยะ', 'วงกลม', 'ภาคตัดกรวยเบื้องต้น'],
    units: ['m4u6'], hard: true },
  { id: 'vector', strand: 'geo', name: 'เวกเตอร์ในสามมิติ', icon: '➡️',
    about: 'เวกเตอร์มีทิศและขนาด ใช้ดอทหาฉายและมุม ใช้ครอสหาเวกเตอร์ตั้งฉากกับระนาบ',
    terms: [
      { name: 'หนึ่งหน่วย', def: 'û = u/|u| มีขนาด 1 ตามทิศของ u' },
      { name: 'ดอท', def: 'u · v = |u||v| cos θ เป็นสเกลาร์' },
      { name: 'ครอส', def: 'u × v ตั้งฉากกับทั้ง u และ v ขนาดเท่าพื้นที่สี่เหลี่ยมด้านขนาน' }
    ],
    know: ['เวกเตอร์หนึ่งหน่วย', 'ดอทและครอส', 'เส้นและระนาบเบื้องต้น'],
    units: ['m5u3'], hard: false },
  { id: 'stat', strand: 'stat', name: 'สถิติ', icon: '📊',
    about: 'สถิติสรุปข้อมูลด้วยค่ากลางและการกระจาย แล้วอ่านจากตาราง กราฟ หรือแผนภาพกล่อง',
    terms: [
      { name: 'ค่ากลาง', def: 'ค่าเฉลี่ย มัธยฐาน ฐานนิยม บอกจุดรวมของข้อมูลคนละแบบ' },
      { name: 'การกระจาย', def: 'พิสัย ส่วนเบี่ยงเบนมาตรฐาน IQR บอกว่าข้อมูลกระจายแค่ไหน' },
      { name: 'แผนภาพกล่อง', def: 'แสดง Q1 มัธยฐาน Q3 และจุดสุดโต่ง' }
    ],
    know: ['ค่ากลาง การกระจาย', 'แผนภาพกล่อง', 'อ่านตาราง/กราฟ'],
    units: ['m6u2', 'm1u9'], hard: false },
  { id: 'count', strand: 'stat', name: 'หลักการนับเบื้องต้น', icon: '🔀',
    about: 'นับวิธีจัดของโดยกฎบวก/คูณ เรียงสับเปลี่ยนเมื่อลำดับสำคัญ จัดหมู่เมื่อลำดับไม่สำคัญ',
    terms: [
      { name: 'กฎคูณ', def: 'ถ้าทำทีละขั้นได้ n₁, n₂, … วิธี รวม n₁ × n₂ × …' },
      { name: 'เรียงสับเปลี่ยน', def: 'P(n,r) = n! / (n−r)! ลำดับสำคัญ' },
      { name: 'การจัดหมู่', def: 'C(n,r) = n! / [r!(n−r)!] ลำดับไม่สำคัญ' }
    ],
    know: ['กฎการบวก/คูณ', 'เรียงสับเปลี่ยน', 'การจัดหมู่'],
    units: ['m5u7'], hard: true },
  { id: 'prob', strand: 'stat', name: 'ความน่าจะเป็น', icon: '🎲',
    about: 'ความน่าจะเป็นวัดโอกาสของเหตุการณ์ระหว่าง 0 ถึง 1 จากปริภูมิตัวอย่าง',
    terms: [
      { name: 'ปริภูมิตัวอย่าง', def: 'เซตของผลลัพธ์ที่เป็นไปได้ทั้งหมด' },
      { name: 'มีเงื่อนไข', def: 'P(A|B) = P(A∩B) / P(B) โอกาสของ A เมื่อรู้ว่า B เกิดแล้ว' },
      { name: 'อิสระ', def: 'A กับ B อิสระเมื่อ P(A∩B) = P(A)P(B)' }
    ],
    know: ['เหตุการณ์และปริภูมิตัวอย่าง', 'ความน่าจะเป็นแบบมีเงื่อนไข', 'เหตุการณ์อิสระ'],
    units: ['m6u1', 'm3u11'], hard: true },
  { id: 'dist', strand: 'stat', name: 'ตัวแปรสุ่มและการแจกแจง', icon: '🔔',
    about: 'ตัวแปรสุ่มแปลงผลทดลองเป็นตัวเลข การแจกแจงบอกความน่าจะเป็นของแต่ละค่า',
    terms: [
      { name: 'ค่าคาดหมาย', def: 'E(X) = ผลรวม x · P(X=x) คือค่าเฉลี่ยระยะยาว' },
      { name: 'ไม่ต่อเนื่อง / ต่อเนื่อง', def: 'นับได้เป็นจุด vs วัดได้เป็นช่วง ใช้ผลรวมหรือปริพันธ์' },
      { name: 'ปกติ', def: 'โค้งระฆังสมมาตรรอบ μ ความกว้างจาก σ' }
    ],
    know: ['ตัวแปรสุ่มไม่ต่อเนื่อง/ต่อเนื่อง', 'ค่าคาดหมาย', 'การแจกแจงปกติเบื้องต้น'],
    units: ['m6u3'], hard: false },
  { id: 'calc', strand: 'calc', name: 'แคลคูลัสเบื้องต้น', icon: '∫',
    about: 'ลิมิตดูค่าเข้าใกล้ อนุพันธ์ดูอัตราเปลี่ยน ปริพันธ์ดูพื้นที่ใต้กราฟหรือปริมาณสะสม',
    terms: [
      { name: 'ลิมิต', def: 'lim x→a f(x) คือค่าที่ f เข้าใกล้เมื่อ x เข้าใกล้ a ไม่จำเป็นต้องเท่า f(a)' },
      { name: 'อนุพันธ์', def: "f'(x) = lim h→0 [f(x+h)−f(x)] / h ความชันเส้นสัมผัส" },
      { name: 'ปริพันธ์จำกัดเขต', def: '∫ₐᵇ f(x) dx = F(b) − F(a) เมื่อ F′ = f' }
    ],
    know: ['ลิมิตและความต่อเนื่อง', 'อนุพันธ์และการประยุกต์', 'ปริพันธ์จำกัดเขตเบื้องต้น'],
    units: ['m6u4', 'm6u5', 'm6u6'], hard: false }
];

/* ข้อ 5–7: โครงจากข้อสอบจริงในโฟลเดอร์ (ไม่เก็บโจทย์ดิบ)
   ปี 67–69 ที่อ่านโทเคนคณิตได้ · ปี 65–66 สแกน · mix ทางการ ทปอ. 30 ข้อ */
// Populated from the stored exam corpus. Missing evidence remains unknown.
const EXAM_SIGNALS = {};
let EXAM_CORPUS_LOADED = false;
async function loadExamCorpus() {
  if (EXAM_CORPUS_LOADED || !Cloud.signedIn()) return;
  try {
    const res = await sbFetch('/functions/v1/tutor', { method: 'POST', body: JSON.stringify({mode:'examCorpus'}) });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.papers)) return;
    data.papers.forEach(p => { if (Number.isInteger(p.year) && p.year >= 2555 && p.year <= 2700 && Array.isArray(p.extra)) EXAM_SIGNALS[p.year] = p; });
    EXAM_CORPUS_LOADED = data.available === true;
  } catch (_) { /* Keep unknown values rather than fabricated defaults. */ }
}

const MOCK_LEN = 15;

/** จำนวนข้อและเวลาของข้อสอบจริง — เอาจากชุดล่าสุดที่มีข้อมูลครบ ไม่ใช่ตัวเลขที่ตั้งเอง */
function examFormat() {
  const e = ALEVEL_EXAMS
    .filter(x => x.kind === 'a_level' && x.q && x.minutes)
    .sort((a, b) => b.year - a.year)[0];
  return e
    ? { year: e.year, questions: e.q, minutes: e.minutes, score: e.score || 100 }
    : { year: null, questions: 30, minutes: 90, score: 100 };
}
const MOCK_MIX = [
  ['set', 1], ['logic', 1], ['real', 2], ['func', 1], ['explog', 1], ['trig', 2],
  ['complex', 1], ['matrix', 1], ['seq', 1], ['analytic', 1], ['stat', 1], ['count', 1], ['prob', 1]
];
const POLY_UNITS = ['m2u3', 'm2u4', 'm3u2', 'm4u3', 'm4u4'];

function alevelTopic(id) { return ALEVEL_TOPICS.find(t => t.id === id) || null; }
function alevelStrand(id) { return ALEVEL_STRANDS.find(s => s.id === id) || null; }
function alevelExam(year) { return ALEVEL_EXAMS.find(e => e.year === Number(year)) || null; }

/** ตัวเลขความกดดันของชุดสอบจริงปีนั้น — คำนวณจากข้อมูลชุดนั้นตรงๆ (จำนวนข้อ เวลา หน้า)
    ช่องไหนไม่มีข้อมูลจริงคืน null ไม่เติมตัวเลขเอง */
function examPressure(year) {
  const e = alevelExam(year);
  if (!e) return null;
  const sig = EXAM_SIGNALS[year] || null;
  return {
    year: e.year, label: e.label, kind: e.kind, pages: e.pages, scanned: !!e.scanned,
    q: e.q || null, minutes: e.minutes || null, score: e.score || null,
    secPerQ: (e.q && e.minutes) ? Math.round(e.minutes * 60 / e.q) : null,
    corpus: sig,
    avgSteps: sig ? sig.avgSteps : null,
    hardShare: sig ? sig.hardShare : null,
    focus: sig ? sig.extra.map(id => (alevelTopic(id) || {}).name).filter(Boolean) : [],
    strands: ALEVEL_STRANDS.map(s => ({ name: s.name, share: s.share }))
  };
}

/** หัวข้อย่อยของบท — ชั้นพื้นฐานมาจาก know ที่เขียนไว้ในบทนี้จริง
    ชั้น 2 และ 3 คือชั้นที่ยากขึ้น ปลดตามผลงานผู้เรียน เนื้อหาให้ AI สอนสดตอนกดเข้า
    ไม่ได้เขียนบทเรียนสำเร็จรูปไว้ล่วงหน้า */
function topicSubLessons(topic) {
  if (!topic) return [];
  const p = (typeof S !== 'undefined' && S.progress && S.progress[topic.id]) || {};
  const best = p.best || 0;
  const stars = p.stars || 0;
  const subs = (topic.know || []).map((k, i) => ({
    id: topic.id + ':k' + i, name: k, tier: 1, open: true,
    why: 'หัวข้อย่อยพื้นฐานของบทนี้'
  }));
  // หัวข้อซ่อมเสริมที่ AI เพิ่มให้ตอนเห็นว่าผู้เรียนยังไม่เข้าใจ
  // วางต่อจากพื้นฐาน ก่อนหัวข้อยากขึ้น เพราะต้องอุดรูรั่วให้ได้ก่อน
  ((typeof S !== 'undefined' && S.extraSubs && S.extraSubs[topic.id]) || []).forEach(x => {
    subs.push({
      id: x.id, name: x.name, tier: 1, open: true, ai: true,
      why: x.why || 'AI เพิ่มให้เพราะข้อนี้ยังพลาดบ่อย'
    });
  });
  subs.push({
    id: topic.id + ':deep', name: topic.name + ' 2 (ยากขึ้น)', tier: 2,
    open: stars >= 1 || best >= 60,
    why: 'โจทย์หลายขั้นแบบที่ออกสอบจริง ต่อยอดจากพื้นฐาน',
    needs: 'ผ่านบทนี้ก่อน หรือทำได้ 60% ขึ้นไป'
  });
  subs.push({
    id: topic.id + ':contest', name: 'แนวข้อสอบแข่งขัน — ' + topic.name, tier: 3,
    open: best >= 80,
    why: 'แนวยากกว่าห้องเรียน สำหรับเก็บคะแนนส่วนบน',
    needs: 'ทำบทนี้ได้ 80% ขึ้นไป'
  });
  const out = typeof PersonalPath !== "undefined" ? PersonalPath.decorate(subs) : subs;
  // หัวข้อซ่อมเสริมต้องเข้าเรียนได้ทันที เพราะเพิ่มมาเพราะเพิ่งทำไม่ผ่าน
  // ถ้าปล่อยให้ตัวจัดลำดับล็อกไว้ตามคิวปกติ มันจะไร้ประโยชน์
  return out.map(s => (s.ai ? Object.assign({}, s, { open: true, needs: "" }) : s));
}

/** ความคืบหน้าหัวข้อย่อย เก็บในเครื่องอย่างเดียว ยังไม่ซิงก์ขึ้นคลาวด์ */
function subLessonState(subId) {
  return ((typeof S !== 'undefined' && S.subProgress) || {})[subId] || { runs: 0 };
}

function topicFigure(topic) {
  if (topic.id === 'trig') return { shape: 'rightTriangle', base: 4, height: 3 };
  if (topic.id === 'analytic') return { shape: 'circle', radius: 4 };
  return null;
}

/** ประมาณความซับซ้อนของบท — จากจำนวนหลักการในบท ไม่ใช่ข้อ ทปอ. ข้อต่อข้อ */
function topicComplexity(topic) {
  return {
    majors: 1,
    minors: (topic.know || []).length,
    steps: topic.hard ? 4 : 2
  };
}

/** คาดคะแนน A-Level 0–100 จาก Pre-test ในแอป ไม่ใช่ข้อสอบ ทปอ. ข้อต่อข้อ */
function predictedAlevel() {
  if (typeof S === 'undefined') return null;
  // ใช้ผลวัดระดับล่าสุด ไม่ว่าจะมาจาก Pre-test หรือ Mock
  // ก่อนหน้านี้ดูแต่ Pre-test ทำให้สอบ Mock เสร็จแล้วตัวเลขยังไม่ขยับ
  const pre = S.lastPretest;
  const mock = S.lastMock;
  const newer = (a, b) => (!a ? b : !b ? a : (String(a.at || '') >= String(b.at || '') ? a : b));
  const lp = newer(pre && pre.scorePct != null ? pre : null, mock && mock.scorePct != null ? mock : null);
  if (!lp || lp.scorePct == null) return null;
  return {
    pct: Math.round(Number(lp.scorePct)),
    national: ALEVEL_NATIONAL.pct,
    nationalYear: ALEVEL_NATIONAL.year,
    source: lp === mock ? 'mock' : 'pretest',
    at: lp.at || null,
    calibrated: false,
    label: (lp === mock ? 'คะแนนข้อสอบเสมือนจริง' : 'คะแนน Pre-test') + ' ' +
      'ในแอปเท่านั้น ยังไม่ผ่านการปรับเทียบเพื่อทำนายคะแนน A-Level'
  };
}

function gapTopics() {
  return ALEVEL_TOPICS.filter(t => !((typeof S !== 'undefined' && S.progress[t.id] || {}).stars));
}

function unitToTopicId(unitId) {
  const t = ALEVEL_TOPICS.find(x => x.units.indexOf(unitId) >= 0);
  return t ? t.id : null;
}

function seedShuffle(arr, seed) {
  const r = arr.slice();
  let h = seed || 1;
  for (let i = r.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    const tmp = r[i]; r[i] = r[j]; r[j] = tmp;
  }
  return r;
}

function learnerSeed() {
  const uid = (typeof Cloud !== 'undefined' && Cloud.state && Cloud.state.user_id) || '';
  const extra = (typeof S !== 'undefined' && (S.mockRuns || 0)) + ':' + ((S && S.progress) ? Object.keys(S.progress).length : 0);
  let h = 0;
  const s = uid + extra + String((S && S.lastPretest && S.lastPretest.at) || '');
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/** บทที่ควรแทรกจาก Pre-test — เช่น พหุนาม ถ้าตอบพลาดหน่วยพหุนาม */
function planTopicIds() {
  if (typeof S === 'undefined') return [];
  const fromTest = S.planTopics || [];
  const rec = (typeof appliedRecIds === 'function' ? appliedRecIds() : [])
    .map(unitToTopicId).filter(Boolean);
  const seen = {};
  const out = [];
  fromTest.concat(rec).forEach(id => {
    if (id && !seen[id]) { seen[id] = true; out.push(id); }
  });
  return out;
}

function personalizedTopics() {
  if (typeof S === 'undefined') return ALEVEL_TOPICS.slice();
  const catalog = ALEVEL_TOPICS.slice();
  const gaps = planTopicIds().filter(id => {
    const t = alevelTopic(id);
    return t && !((S.progress[id] || {}).stars);
  });
  const custom = S.studyPlan && S.studyPlan.order;
  let rest;
  if (custom && custom.length) {
    const first = custom.map(alevelTopic).filter(Boolean);
    rest = first.concat(catalog.filter(t => first.every(f => f.id !== t.id)));
  } else {
    rest = catalog.slice();
  }
  const gapSet = {};
  gaps.forEach(id => { gapSet[id] = true; });
  const inserted = gaps.map(alevelTopic).filter(Boolean);
  rest = rest.filter(t => !gapSet[t.id]);
  return inserted.concat(rest);
}

function defaultStudySlots() {
  const g = typeof userClassId === 'function' ? userClassId() : 'm6';
  if (g === 'm6') return ['จ–ศ หลังเลิก 19:00–20:15', 'ส 10:00–11:30 Mock หรือทบทวนจุดอ่อน'];
  if (g === 'm5') return ['จ–ศ 19:30–20:15', 'อา เช้า 45 นาที ทบทวนบทที่พลาด'];
  return ['จ–ศ หลังการบ้าน 30–45 นาที', 'วันหยุด ชุดสั้น 1 ชุด'];
}

function studySchedule() {
  const plan = (typeof S !== 'undefined' && S.studyPlan) || {};
  const note = typeof prepPlanNote === 'function' ? prepPlanNote() : { hours: 1, months: 6 };
  return {
    hours: plan.hours != null ? plan.hours : note.hours,
    slots: (plan.slots && plan.slots.length) ? plan.slots : defaultStudySlots(),
    months: note.months,
    note: plan.note || '',
    fromAi: !!plan.fromAi
  };
}

function applyStudyPlan(plan) {
  if (!plan || typeof S === 'undefined') return;
  S.studyPlan = Object.assign({}, S.studyPlan || {}, plan, { fromAi: true, at: Date.now() });
  save();
}

function topicWhy(t) {
  const gaps = planTopicIds();
  if (gaps.indexOf(t.id) >= 0) {
    return 'แทรกจาก Pre-test — ปกติยังไม่ถึงบทนี้ แต่ข้อนี้ยังไม่ผ่าน';
  }
  const done = typeof S !== 'undefined' && S.progress[t.id] && S.progress[t.id].stars;
  if (done) return 'เรียนแล้ว — ทบทวนได้เมื่อพร้อม';
  return 'ตามเส้นทางปกติของ A-Level คณิต 1';
}

function renderPlanDots() {
  const topics = personalizedTopics();
  const gaps = planTopicIds();
  return `<div class="plandots">${topics.map(t => {
    const done = typeof S !== 'undefined' && S.progress[t.id] && S.progress[t.id].stars;
    const gap = gaps.indexOf(t.id) >= 0;
    const cls = done ? 'done' : gap ? 'gap' : '';
    return `<a class="plandot ${cls}" href="#/topic/${t.id}" title="${esc(t.name)}"></a>`;
  }).join('')}</div>
  <p class="note">จุดส้ม = แทรกจากข้อที่พลาด · ฟ้า = จบแล้ว · เทา = ตามทางปกติ</p>`;
}

function renderPlanPath() {
  const topics = personalizedTopics();
  const gaps = planTopicIds();
  const unfinished = topics.filter(t => !(typeof S !== 'undefined' && S.progress[t.id] && S.progress[t.id].stars));
  const show = unfinished.slice(0, 8);
  const more = Math.max(0, unfinished.length - show.length);
  const rows = show.map((t, i) => {
    const gap = gaps.indexOf(t.id) >= 0;
    return `<li class="${gap ? 'insert' : ''}">
      <span class="n">${i + 1}</span>
      <div>
        <b>${esc(t.name)}</b>
        <p class="note">${esc(topicWhy(t))}</p>
      </div>
      <a class="btn ghost sm" href="#/topic/${t.id}">เรียน</a>
    </li>`;
  }).join('');
  return `<ol class="planpath">${rows}</ol>
    ${more ? `<p class="note">อีก ${more} บทตามแผน หลังจบบทที่แทรกและบทถัดไป</p>` : ''}`;
}

/** จัดอันดับความง่ายของโจทย์ — ใช้เกณฑ์เดียวกับตอนเปิดบทเรียน
    เติมคำตอบที่มีค่าให้ตรวจ ง่ายสุด · ปรนัยยากกว่า · ข้อที่อ้างข้ออื่นยากสุดและตัดทิ้งอยู่แล้ว */
function questionEase(q) {
  let r = (q.t === 'num' && q.v) ? 0 : (q.t === 'num' ? 1 : 2);
  if (String(q.q || '').length > 120) r += 1;   // โจทย์ยาวมักมีหลายเงื่อนไข
  if (typeof isDependentStem === 'function' && isDependentStem(q)) r += 10;
  return r;
}

/** easyOnly = สุ่มเฉพาะในกลุ่มที่ง่ายที่สุดของหัวข้อนั้น
    ใช้กับ Pre-test เพื่อรับประกันว่าง่ายกว่าข้อสอบเสมือนจริงเสมอ ไม่ใช่บังเอิญง่าย */
function topicCheckQuestion(topic, idx, easyOnly) {
  const runs = (typeof S !== 'undefined' && S.progress[topic.id] && S.progress[topic.id].runs) || 0;
  const all = [];
  topic.units.forEach(id => {
    const found = findUnit(id);
    if (found && found.unit.q) {
      found.unit.q.forEach((q, qi) => all.push({ unit: found.unit, q: q, levelId: found.levelId, idx: qi }));
    }
  });
  const pool = all.filter(row => typeof isDependentStem !== 'function' || !isDependentStem(row.q));
  const use = pool.length ? pool : all;
  if (!use.length) return null;
  let pick = use;
  if (easyOnly) {
    const ranked = use.slice().sort((a, b) => questionEase(a.q) - questionEase(b.q));
    const best = questionEase(ranked[0].q);
    pick = ranked.filter(r => questionEase(r.q) <= best);
  }
  const rotated = seedShuffle(pick, learnerSeed() + runs * 17);
  const i0 = idx || 0;
  return rotated[i0 % rotated.length];
}

function mockBlueprintForUser(want) {
  const fmt = examFormat();
  const items = want || fmt.questions;
  const year = fmt.year || 2569;
  const sig = EXAM_SIGNALS[year] || { extra: [], avgSteps: null };
  const gaps = planTopicIds();
  const mix = MOCK_MIX.map(row => row.slice());
  gaps.forEach(id => {
    const hit = mix.find(m => m[0] === id);
    if (hit) hit[1] += 1;
    else mix.unshift([id, 1]);
  });
  const mixTotal = () => mix.reduce((s, m) => s + m[1], 0);
  while (mixTotal() > items) {
    const plump = mix.filter(m => m[1] > 1 && gaps.indexOf(m[0]) < 0);
    if (!plump.length) break;
    plump[plump.length - 1][1]--;
  }
  // ข้อสอบจริงยาวกว่าสัดส่วนตั้งต้น ต้องเติมให้ครบ ไม่ใช่ปล่อยให้ชุดสั้นกว่าของจริง
  // เติมทีละรอบ ให้จุดอ่อนของคนนี้และหัวข้อที่ขึ้นชื่อว่ายากได้เพิ่มก่อน
  const fillOrder = mix.slice().sort((x, y) => {
    const rank = m => (gaps.indexOf(m[0]) >= 0 ? 0 : 1) + ((alevelTopic(m[0]) || {}).hard ? 0 : 1);
    return rank(x) - rank(y);
  });
  for (let k = 0; mixTotal() < items && fillOrder.length; k++) fillOrder[k % fillOrder.length][1]++;
  return {
    year: year,
    items: items,
    minutes: fmt.minutes,
    avgSteps: sig.avgSteps,
    extra: sig.extra,
    mix: mix,
    gaps: gaps,
    note: 'ข้อฝึกที่ AI สร้างตามหัวข้อและข้อมูลอ้างอิงที่มี ไม่ใช่ข้อสอบจริงหรือแบบวัดที่ปรับเทียบแล้ว'
  };
}

function localMockQuestions(want) {
  const bp = mockBlueprintForUser(want);
  const seed = learnerSeed() + ((typeof S !== 'undefined' && S.mockRuns) || 0) * 99;
  const qs = [];
  bp.mix.forEach(pair => {
    const topic = alevelTopic(pair[0]);
    if (!topic) return;
    const pool = [];
    topic.units.forEach(id => {
      const found = findUnit(id);
      if (found) (found.unit.q || []).forEach(q => {
        pool.push(Object.assign({}, q, { _topic: topic.id, _strand: found.unit.strand, _unit: id }));
      });
    });
    const stand = pool.filter(q => typeof isDependentStem !== 'function' || !isDependentStem(q));
    const use = stand.length ? stand : pool;
    seedShuffle(use, seed + String(pair[0]).length).slice(0, pair[1]).forEach(q => qs.push(q));
  });
  return seedShuffle(qs, seed).slice(0, bp.items);
}
