/* Math OCR: files stay in memory; only the selected PDF page is sent to Gemini. */
'use strict';
const MathOCR = {
  maxFile: 10 * 1024 * 1024,
  maxPayload: 4 * 1024 * 1024,
  states: new Map(),
  panel(id, target) {
    this.states.delete(id);
    return `<section class="ocr-panel" id="${id}" data-target="${target}">
      <h2>อ่านโจทย์จากรูปหรือ PDF</h2>
      <p class="note">เลือกไฟล์ไม่เกิน 10 MB · PDF อ่านทีละหน้า · ส่งหน้าที่เลือกให้ Gemini เมื่อกดอ่าน</p>
      <label for="${id}File">ไฟล์โจทย์</label>
      <input id="${id}File" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onchange="MathOCR.select('${id}')">
      <div id="${id}PageBox" hidden><label for="${id}Page">หน้าที่ต้องการอ่าน</label>
        <input id="${id}Page" type="number" min="1" value="1" step="1" onchange="MathOCR.clearResult('${id}')"></div>
      <p id="${id}Status" class="note" role="status" aria-live="polite"></p>
      <button type="button" class="btn ghost sm" id="${id}Read" disabled onclick="MathOCR.read('${id}')">อ่านโจทย์ด้วย AI</button>
      <div id="${id}Result" hidden>
        <label for="${id}Text">ตรวจและแก้ข้อความที่อ่านได้</label>
        <textarea id="${id}Text" rows="8" oninput="MathOCR.preview('${id}')"></textarea>
        <p class="note">ช่องแก้ไขใช้รหัสสมการ แต่ตัวอย่างด้านล่างแสดงเป็นสมการคณิตศาสตร์ ตรวจตัวเลข เครื่องหมาย และรูปประกอบก่อนใช้</p>
        <div class="ocr-preview" id="${id}Preview"></div>
        <button type="button" class="btn sm" onclick="MathOCR.use('${id}')">ใช้ข้อความนี้เป็นโจทย์</button>
      </div>
    </section>`;
  },
  clearResult(id) {
    const result = document.getElementById(id + 'Result');
    if (result) result.hidden = true;
  },
  async select(id) {
    const root = document.getElementById(id);
    const state = { root, file: document.getElementById(id + 'File').files[0], busy: false };
    this.states.set(id, state);
    const status = document.getElementById(id + 'Status');
    const button = document.getElementById(id + 'Read');
    button.disabled = true;
    this.clearResult(id);
    document.getElementById(id + 'PageBox').hidden = true;
    status.textContent = '';
    if (!state.file) return;
    try {
      if (state.file.size > this.maxFile) throw new Error('ไฟล์ใหญ่เกิน 10 MB กรุณาเลือกไฟล์เล็กลง');
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(state.file.type)) throw new Error('รองรับ JPG, PNG, WebP และ PDF เท่านั้น');
      if (state.file.type === 'application/pdf') {
        status.textContent = 'กำลังเปิด PDF…';
        if (!window.PDFLib) throw new Error('โหลดเครื่องมือ PDF ไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่');
        state.pdf = await PDFLib.PDFDocument.load(await state.file.arrayBuffer());
        if (!this.current(id, state)) return;
        const count = state.pdf.getPageCount();
        if (!count) throw new Error('PDF ไม่มีหน้า');
        const input = document.getElementById(id + 'Page');
        input.max = String(count); input.value = '1';
        document.getElementById(id + 'PageBox').hidden = false;
        status.textContent = `PDF มี ${count} หน้า · เลือกหน้าที่ต้องการอ่าน`;
      } else status.textContent = 'พร้อมอ่านรูปโจทย์';
      button.disabled = false;
    } catch (e) {
      if (this.current(id, state)) status.textContent = 'เปิดไฟล์ไม่ได้: ' + e.message;
    }
  },
  current(id, state) { return this.states.get(id) === state && state.root.isConnected; },
  async payload(state, page) {
    if (state.pdf) {
      if (!Number.isInteger(page) || page < 1 || page > state.pdf.getPageCount()) throw new Error('เลขหน้าไม่อยู่ใน PDF');
      const single = await PDFLib.PDFDocument.create();
      const [copy] = await single.copyPages(state.pdf, [page - 1]);
      single.addPage(copy);
      const bytes = await single.save();
      if (bytes.length > this.maxPayload) throw new Error('หน้านี้ใหญ่เกิน 4 MB กรุณาลดขนาด PDF หรือใช้รูปแทน');
      return { mimeType: 'application/pdf', data: await single.saveAsBase64() };
    }
    const url = URL.createObjectURL(state.file);
    try {
      const img = new Image(); img.src = url;
      await img.decode();
      const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      if (data.length > Math.ceil(this.maxPayload / 3) * 4) throw new Error('รูปใหญ่เกินไป กรุณาครอบเฉพาะโจทย์');
      return { mimeType: 'image/jpeg', data };
    } finally { URL.revokeObjectURL(url); }
  },
  async read(id) {
    const state = this.states.get(id);
    if (!state || state.busy || !state.file) return;
    const status = document.getElementById(id + 'Status');
    if (!Cloud.signedIn()) { status.textContent = 'กรุณาเข้าสู่ระบบก่อนอ่านโจทย์ด้วย AI'; return; }
    if (!S.consent || !S.consent.aiData) { status.textContent = 'กรุณาเปิดความยินยอมส่งข้อมูลให้ AI ในตั้งค่าก่อน'; return; }
    state.busy = true;
    const controls = ['Read', 'File', 'Page'].map(s => document.getElementById(id + s));
    controls.forEach(el => { el.disabled = true; });
    this.clearResult(id);
    status.textContent = 'กำลังอ่านภาษาไทยและสมการ…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100000);
    try {
      const document = await this.payload(state, Number(window.document.getElementById(id + 'Page').value));
      const res = await sbFetch('/functions/v1/tutor', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ mode: 'ocr', document })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'อ่านโจทย์ไม่สำเร็จ');
      if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('ไม่พบข้อความในหน้านี้');
      if (!this.current(id, state)) return;
      window.document.getElementById(id + 'Text').value = data.text;
      window.document.getElementById(id + 'Result').hidden = false;
      this.preview(id);
      status.textContent = 'อ่านแล้ว · ตรวจข้อความและสมการก่อนนำไปใช้';
    } catch (e) {
      if (this.current(id, state)) status.textContent = e.name === 'AbortError' ? 'ใช้เวลานานเกินไป ลองใหม่หรือครอบเฉพาะโจทย์' : e.message;
    } finally {
      clearTimeout(timer); state.busy = false;
      if (this.current(id, state)) controls.forEach(el => { el.disabled = false; });
    }
  },
  preview(id) {
    const box = document.getElementById(id + 'Preview');
    box.textContent = document.getElementById(id + 'Text').value;
    renderMath(box);
  },
  use(id) {
    const root = document.getElementById(id);
    const target = document.getElementById(root.dataset.target);
    const text = document.getElementById(id + 'Text').value.trim();
    if (!text || !target) return;
    // Keep existing writing; applying OCR never silently discards a student's draft.
    target.value = target.value.trim() ? target.value.trim() + '\n\n' + text : text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById(id + 'Result').hidden = true;
    document.getElementById(id + 'Status').textContent = 'เพิ่มข้อความในช่องโจทย์แล้ว · เลือกเฉพาะข้อที่ต้องการถาม';
    target.focus();
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
