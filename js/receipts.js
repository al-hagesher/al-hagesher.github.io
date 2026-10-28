/* על הגשר — קבלות: צילום וזיהוי טקסט (או הזנה ידנית) → הוצאה + עדכון מלאי + מחיר ממוצע לכל מצרך.
   החלק העליון הוא לוגיקה טהורה (נבדקת ב-node); החלון למטה רץ בדפדפן. הזיהוי נעשה במכשיר — התמונה לא נשלחת לשום שרת. */
(function (root) {
  const A = root.App = root.App || {}, U = A.util, C = A.calc;

  /* ---------- מחיר ממוצע מקניות ---------- */
  const DAYS = 180, MIN_KEEP = 3;
  // מחיר ממוצע ליחידת אריזה (ק״ג/ליטר/יחידה/גרם — לפי pkgUnit), משוקלל לפי כמות: קניות מ-180 הימים האחרונים, לפחות 3 אחרונות
  C.avgPurchase = (ing, today = U.today()) => {
    const ps = (ing.purchases || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    if (!ps.length) return null;
    const from = U.addDays(today, -DAYS);
    const use = ps.filter((p, k) => p.date >= from || k < MIN_KEEP);
    const q = U.sum(use, p => p.qty), cost = U.sum(use, p => p.price);
    return q > 0 ? { perUnit: cost / q, count: use.length, last: ps[0] } : null;
  };
  const reprice = ing => {
    const a = C.avgPurchase(ing); if (!a) return;
    ing.pkgPrice = U.round(a.perUnit * (+ing.pkgSize || 1), 2); ing.estimated = false; ing.free = false;
  };
  // רישום קנייה: כמות ביחידה כלשהי (גרם/ק״ג/מ״ל/ליטר/יחידות) מומרת ליחידת האריזה של המצרך
  A.recordPurchase = (ing, { date, qty, unit, price, expenseId, addStock = true }) => {
    const q = unit === ing.pkgUnit ? +qty : A.convert(+qty, unit, ing.pkgUnit, ing);
    if (!(q > 0) || !(+price >= 0)) throw new Error(`לא ניתן להמיר ${qty} ${A.UNITS[unit] || unit} ל${A.PKG_UNITS[ing.pkgUnit]} עבור ${ing.name}`);
    ing.purchases = ing.purchases || [];
    ing.purchases.push({ id: U.uid(), date: date || U.today(), qty: U.round(q, 4), price: U.round(+price, 2), expenseId: expenseId || '', stock: !!addStock });
    if (ing.purchases.length > 60) ing.purchases = ing.purchases.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
    if (addStock) ing.stock = U.round((+ing.stock || 0) + q, 4);
    reprice(ing);
    return q;
  };
  // ביטול קבלה: מוחק את הקניות שלה, מוריד מהמלאי ומחשב מחיר מחדש
  A.removePurchasesFor = (expenseId, state = A.state) => {
    state.ingredients.forEach(ing => {
      const mine = (ing.purchases || []).filter(p => p.expenseId === expenseId);
      if (!mine.length) return;
      ing.purchases = ing.purchases.filter(p => p.expenseId !== expenseId);
      mine.forEach(p => { if (p.stock) ing.stock = Math.max(0, U.round((+ing.stock || 0) - p.qty, 4)); });
      reprice(ing);
    });
  };

  /* ---------- פענוח טקסט של קבלה ---------- */
  const NUM = /(\d{1,4}(?:[.,]\d{1,3})?)/;
  const PRICE_RE = /(\d{1,5}[.,]\d{2})(?!\d)/g;
  const norm = s => String(s || '').replace(/[״"׳'`]/g, '').replace(/[^֐-׿a-zA-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  A.parseReceipt = text => {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = { store: '', date: '', total: null, items: [] };
    const skip = /(סה.?כ|סך.?הכל|לתשלום|תשלום|מזומן|אשראי|עודף|מע.?מ|הנחה|ח\.?פ|עוסק|טלפון|תודה|קופה|קופאי|כרטיס|ויזה|visa|change|total)/i;
    for (let l of lines) {
      const d = l.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
      if (d && !out.date) { let y = +d[3]; if (y < 100) y += 2000; const m = +d[2], dd = +d[1]; if (m >= 1 && m <= 12 && dd >= 1 && dd <= 31) out.date = `${y}-${U.pad(m)}-${U.pad(dd)}`; }
      let prices = [...l.matchAll(PRICE_RE)].map(m => U.num(m[1]));
      // זיהוי שהפיל את הנקודה העשרונית ("1490" במקום "14.90"): מספר של 3–5 ספרות בסוף שורת מוצר
      if (!prices.length && !d && /[֐-׿]{2,}/.test(l)) { const g = l.match(/(?:^|[^\d.,])(\d{3,5})\s*$/); if (g && !/(ק.?ג|גר|ליטר|מ.?ל)\s*\d{3,5}\s*$/.test(l)) { prices = [+g[1] / 100]; l = l.slice(0, l.length - g[0].length + g[0].indexOf(g[1])); } }
      if (/(סה.?כ|סך.?הכל|לתשלום|total)/i.test(l) && prices.length) { out.total = Math.max(...prices); continue; }
      if (!out.store && /[֐-׿]{2,}/.test(l) && !prices.length && !skip.test(l)) { out.store = norm(l).slice(0, 40); continue; }
      if (!prices.length || skip.test(l)) continue;
      const name = norm(l.replace(PRICE_RE, ' ').replace(/\b\d+\s*[xX*×]\s*/g, ' ').replace(/\s\d+(\.\d+)?\s/g, ' '));
      if (!/[֐-׿]{2,}/.test(name)) continue;
      // כמות: "2 x 3.50" או "2 יח"
      let qty = 1; const mq = l.match(/(\d+(?:[.,]\d+)?)\s*[xX*×]\s*\d/); if (mq) qty = U.num(mq[1]);
      // גודל אריזה מתוך השם (1 ק"ג, 500 גרם, 1 ליטר, 250 מ"ל)
      let size = null; const ms = l.match(/(\d+(?:[.,]\d+)?)\s*(ק.?ג|קילו|גר(?:ם)?|ג׳|ג'|ליטר|ל(?=\s)|מ.?ל|מל)/);
      if (ms) { const v = U.num(ms[1]), u = ms[2]; size = { qty: v, unit: /ק.?ג|קילו/.test(u) ? 'kg' : /ליטר|^ל$/.test(u) ? 'l' : /מ.?ל|מל/.test(u) ? 'ml' : 'g' }; }
      // מארז של יחידות: "12 יח", "מארז 6"
      const mu = !size && l.match(/(\d{1,3})\s*(?:יח|יחידות|יח׳|יח')|מארז\s*(\d{1,3})/);
      if (mu) size = { qty: U.num(mu[1] || mu[2]), unit: 'unit' };
      out.items.push({ text: name.slice(0, 50), qty, price: prices[prices.length - 1], size });
    }
    return out;
  };
  // התאמת שורה בקבלה למצרך במחסן (כולל מה שלמדנו מקבלות קודמות)
  A.matchIngredient = (text, state = A.state) => {
    const t = norm(text); if (!t) return null;
    const map = (state.settings.receiptMap || {});
    if (map[t]) { const ing = state.ingredients.find(i => i.id === map[t]); if (ing) return { ing, score: 1, learned: true }; }
    const tw = t.split(' ').filter(w => w.length > 1);
    let best = null;
    state.ingredients.forEach(ing => {
      const iw = norm(ing.name).split(' ').filter(w => w.length > 1); if (!iw.length) return;
      let hit = 0; iw.forEach(w => { if (tw.some(x => x === w || (w.length > 2 && (x.startsWith(w) || w.startsWith(x))))) hit++; });
      const score = hit / iw.length - (iw.length > 1 && hit === 1 ? 0.15 : 0);
      if (hit && (!best || score > best.score)) best = { ing, score };
    });
    return best && best.score >= 0.5 ? best : null;
  };
  A.learnMatch = (text, ingId, state = A.state) => { const t = norm(text); if (!t) return; state.settings.receiptMap = state.settings.receiptMap || {}; state.settings.receiptMap[t] = ingId; };

  if (typeof document === 'undefined') return;

  /* ---------- זיהוי טקסט (Tesseract, מקומי) ---------- */
  let workerP = null;
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  A.ocr = async (file, onProgress) => {
    if (!root.Tesseract) await loadScript('assets/ocr/tesseract.min.js');
    const base = new URL('assets/ocr/', location.href).href;
    // עברית + אנגלית: האנגלית מזהה מספרים ונקודות עשרוניות הרבה יותר טוב
    if (!workerP) workerP = root.Tesseract.createWorker(['heb', 'eng'], 1, {
      workerPath: base + 'worker.min.js', corePath: base, langPath: base, workerBlobURL: false, gzip: true,
      logger: m => onProgress && m.status === 'recognizing text' && onProgress(m.progress)
    }).then(async w => { await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); return w; });
    const w = await workerP;
    const img = await prepImage(file);
    const { data } = await w.recognize(img);
    return data.text;
  };
  // הכנת תמונה לזיהוי: הקטנה/הגדלה לרוחב ~1600, גווני אפור וניגודיות
  function prepImage(file) {
    return new Promise((res, rej) => {
      const img = new Image(); img.onload = () => {
        const s = Math.min(2, 1600 / img.width), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) { let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; g = Math.max(0, Math.min(255, (g - 128) * 1.5 + 140)); p[i] = p[i + 1] = p[i + 2] = g; }
        x.putImageData(d, 0, 0); res(c);
      }; img.onerror = rej; img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- חלון קבלה ---------- */
  const UNIT_OPTS = [['unit', 'יח׳ (אריזות)'], ['kg', 'ק״ג'], ['g', 'גרם'], ['l', 'ליטר'], ['ml', 'מ״ל']];
  A.openReceipt = (preset) => {
    const st = { image: null, file: null, rows: [], store: '', date: U.today(), total: '', keepImage: true, addStock: true, category: 'חומרי גלם' };
    if (preset && preset.file) st.file = preset.file;
    const ingOpts = sel => `<option value="">— לא מצרך (רק הוצאה) —</option>` + A.state.ingredients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(i => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${U.esc(i.name)}</option>`).join('');
    const rowHtml = (r, k) => `<div class="rc-row" data-r="${k}">
      <input data-k="text" value="${U.esc(r.text)}" placeholder="מה קנית" aria-label="פריט">
      <select data-k="ingId" aria-label="מצרך במחסן">${ingOpts(r.ingId)}</select>
      <div class="row" style="gap:4px;flex-wrap:nowrap"><input type="number" step="any" min="0" data-k="qty" value="${r.qty}" aria-label="כמות" style="width:72px"><select data-k="unit" aria-label="יחידה" style="width:auto">${A.opts(UNIT_OPTS, r.unit)}</select></div>
      <input type="number" step="any" min="0" data-k="price" value="${r.price}" placeholder="₪" aria-label="מחיר ששולם">
      <button class="icon-btn" data-rm="${k}" aria-label="הסרה">${A.icon('x')}</button></div>`;
    const sumRows = () => U.round(U.sum(st.rows, r => r.price), 2);
    const draw = (w) => {
      const body = w.querySelector('.m-body');
      body.innerHTML = `
        <div class="row section" style="gap:10px">
          <label class="btn">${A.icon('image')}צילום קבלה<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
          <label class="btn ghost">${A.icon('upload')}מהגלריה<input type="file" accept="image/*" data-photo hidden></label>
          ${st.image ? `<img src="${st.image}" alt="הקבלה" style="height:64px;border-radius:8px;border:1px solid var(--line)">` : ''}
          <span class="small muted" id="ocrStatus">${st.image ? '' : 'או מזינים ידנית בטבלה למטה'}</span>
        </div>
        <div class="form-grid c3 section">
          <label class="field"><span>חנות</span><input data-g="store" value="${U.esc(st.store)}" placeholder="למשל: רמי לוי"></label>
          <label class="field"><span>תאריך</span><input type="date" data-g="date" value="${st.date}"></label>
          <label class="field"><span>קטגוריה</span><select data-g="category">${A.opts(A.EXPENSE_CATS, st.category)}</select></label>
        </div>
        <div class="rc-row head small muted"><span>פריט</span><span>מצרך במחסן</span><span>כמות</span><span>מחיר (₪)</span><span></span></div>
        <div id="rcRows">${st.rows.map(rowHtml).join('')}</div>
        <button class="btn ghost sm" data-add>${A.icon('plus')}הוספת שורה</button>
        <div class="divider"></div>
        <div class="row between"><div class="stack" style="gap:6px">
          <label class="row" style="gap:8px"><input type="checkbox" data-g="addStock" ${st.addStock ? 'checked' : ''}> להוסיף את המצרכים למלאי</label>
          ${st.image ? `<label class="row" style="gap:8px"><input type="checkbox" data-g="keepImage" ${st.keepImage ? 'checked' : ''}> לשמור את תמונת הקבלה</label>` : ''}</div>
          <div style="text-align:end"><div class="small muted">סה״כ שורות</div><b style="font-family:var(--serif);font-size:1.5rem;color:var(--brown)" id="rcSum">${U.money(sumRows())}</b>
          ${st.total != null && st.total !== '' && Math.abs(st.total - sumRows()) > 0.5 ? `<div class="small" style="color:var(--warn)">בקבלה: ${U.money(st.total)}</div>` : ''}</div></div>
        <p class="small muted" style="margin:10px 0 0">כל שורה עם מצרך מעדכנת את המחיר שלו לממוצע של מה ששילמת (180 הימים האחרונים). כמות: כמה קנית — למשל 2 יח׳ של קמח 1 ק״ג = 2 ק״ג.</p>`;
      A.a11y && A.a11y(body);
    };
    A.modal({
      title: 'קבלה חדשה', size: 'wide', body: '',
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount(w) {
        draw(w);
        const readRows = () => { w.querySelectorAll('[data-r]').forEach(el => { const r = st.rows[+el.dataset.r]; el.querySelectorAll('[data-k]').forEach(f => { r[f.dataset.k] = f.type === 'number' ? U.num(f.value) : f.value; }); }); };
        const readGlobals = () => w.querySelectorAll('[data-g]').forEach(f => { st[f.dataset.g] = f.type === 'checkbox' ? f.checked : f.value; });
        const handleFile = async file => {
          st.file = file;
          try { st.image = await A.readImage(file, 1100); } catch (e) { }
          readRows(); readGlobals(); draw(w);
          const status = w.querySelector('#ocrStatus');
          try {
            status.textContent = 'קוראת את הקבלה… (בפעם הראשונה לוקח קצת יותר)';
            const text = await A.ocr(file, p => { status.textContent = `קוראת את הקבלה… ${Math.round(p * 100)}%`; });
            const r = A.parseReceipt(text);
            if (r.store && !st.store) st.store = r.store; if (r.date) st.date = r.date; st.total = r.total;
            r.items.forEach(it => {
              const m = A.matchIngredient(it.text);
              const ing = m && m.ing;
              // כמות: מספר אריזות × גודל האריזה מהשם (אם יש), אחרת יחידות
              let qty = it.qty, unit = 'unit';
              if (it.size) { qty = it.qty * it.size.qty; unit = it.size.unit; }
              else if (ing) { qty = it.qty * (+ing.pkgSize || 1); unit = ing.pkgUnit; } // שורה בקבלה = אריזה אחת בגודל הרגיל
              st.rows.push({ text: it.text, ingId: ing ? ing.id : '', qty: U.round(qty, 3), unit, price: it.price });
            });
            draw(w);
            w.querySelector('#ocrStatus').textContent = r.items.length ? `זוהו ${r.items.length} שורות — בדקי ותקני לפני שמירה` : 'לא הצלחתי לקרוא שורות. אפשר להזין ידנית.';
          } catch (err) { console.warn(err); const s2 = w.querySelector('#ocrStatus'); if (s2) s2.textContent = 'הזיהוי לא הצליח — אפשר להזין ידנית.'; }
        };
        if (st.file) handleFile(st.file);
        w.addEventListener('change', e => {
          const f = e.target;
          if (f.matches('[data-photo]') && f.files[0]) return handleFile(f.files[0]);
          if (f.dataset.k === 'ingId') { // בחירת מצרך: ממלאים יחידה לפי האריזה שלו
            readRows(); const r = st.rows[+f.closest('[data-r]').dataset.r], ing = C.ing(r.ingId);
            if (ing && r.unit === 'unit' && ing.pkgUnit !== 'unit') { r.qty = U.round((+r.qty || 1) * (+ing.pkgSize || 1), 3); r.unit = ing.pkgUnit; draw(w); }
          }
          readRows(); readGlobals(); const s = w.querySelector('#rcSum'); if (s) s.textContent = U.money(sumRows());
        });
        w.addEventListener('input', () => { readRows(); const s = w.querySelector('#rcSum'); if (s) s.textContent = U.money(sumRows()); });
        w.addEventListener('click', e => {
          if (e.target.closest('[data-add]')) { readRows(); readGlobals(); st.rows.push({ text: '', ingId: '', qty: 1, unit: 'unit', price: '' }); draw(w); w.querySelector('#rcRows').lastElementChild.querySelector('input').focus(); }
          const rm = e.target.closest('[data-rm]'); if (rm) { readRows(); readGlobals(); st.rows.splice(+rm.dataset.rm, 1); draw(w); }
          if (e.target.closest('[data-save]')) {
            readRows(); readGlobals();
            const rows = st.rows.filter(r => r.text || r.ingId || r.price);
            if (!rows.length) return A.toast('אין שורות לשמירה');
            if (rows.some(r => !(+r.price >= 0) || r.price === '')) return A.toast('חסר מחיר באחת השורות');
            const total = U.round(U.sum(rows, r => r.price), 2);
            const exp = { id: U.uid(), date: st.date || U.today(), category: st.category, amount: total, desc: st.store ? `קבלה — ${st.store}` : 'קבלה', receipt: true,
              items: rows.map(r => ({ text: r.text, ingId: r.ingId, qty: r.qty, unit: r.unit, price: r.price })), image: st.image && st.keepImage ? st.image : '' };
            const errs = [];
            rows.filter(r => r.ingId).forEach(r => {
              const ing = C.ing(r.ingId); if (!ing) return;
              try { A.recordPurchase(ing, { date: exp.date, qty: r.qty, unit: r.unit, price: r.price, expenseId: exp.id, addStock: st.addStock }); if (r.text) A.learnMatch(r.text, ing.id); }
              catch (err) { errs.push(err.message); }
            });
            if (errs.length) { A.removePurchasesFor(exp.id); return A.toast(errs[0]); }
            A.state.expenses.push(exp);
            const n = rows.filter(r => r.ingId).length;
            A.closeModal(); A.commit(n ? `נשמר: הוצאה של ${U.money(total)} ו־${n} מצרכים עודכנו` : `נשמרה הוצאה של ${U.money(total)}`);
          }
        });
      }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
