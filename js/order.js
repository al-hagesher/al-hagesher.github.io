/* על הגשר — דף ההזמנה ללקוחות */
  (function () {
    const SB_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co', SB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
    const $ = s => document.querySelector(s), app = $('#app');
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
    const money = n => '₪' + nf.format(Math.round(n * 100) / 100);
    const pad = n => String(n).padStart(2, '0');
    // רק תמונות וקישורי https בטוחים
    // טפסים שפורסמו לפני המעבר לכתובת החדשה מפנים לתמונות בכתובת הישנה
    const fixBase = s => String(s || '').replace(/^https:\/\/hadasa055999-debug\.github\.io\/al-hagesher\//, 'https://al-hagesher.github.io/');
    const safeImg = s => (s = fixBase(s), /^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/|assets\/)/i.test(s) ? s : '');
    const safeUrl = s => /^https:\/\//i.test(String(s || '')) ? String(s) : '';
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const fmtD = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}`; };
    const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const slug = new URLSearchParams(location.search).get('f') || '';
    const rpc = async (fn, body) => { const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status); return r.json(); };
    let cfg, cart = {}, sel = {}, st = { date: '', time: '', method: 'pickup' }, sending = false;
    const saved = (() => { try { return JSON.parse(localStorage.getItem('ag-customer') || '{}'); } catch (e) { return {}; } })();

    // ישראל: התאריך של היום לפי שעון ירושלים
    const todayIL = () => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); return p; };
    function availableDates() {
      const out = [], t = parse(todayIL());
      for (let i = cfg.leadDays || 0; i <= (cfg.maxDaysAhead || 30); i++) {
        const d = new Date(t); d.setDate(t.getDate() + i); const s = iso(d), day = cfg.days[d.getDay()];
        if (!day || !day.on || (cfg.blocked || []).includes(s)) continue;
        const full = cfg.capacity > 0 && ((cfg.load || {})[s] || 0) >= cfg.capacity;
        out.push({ s, d, full });
      }
      return out;
    }
    function slots(dateStr) {
      if (!dateStr || !cfg.slotMinutes) return [];
      const day = cfg.days[parse(dateStr).getDay()]; if (!day) return [];
      const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
      const out = []; let m = toMin(day.from); const end = toMin(day.to);
      // להיום: רק שעות שעוד לא עברו (עם שעה מרווח)
      let min = -1; if (dateStr === todayIL()) { const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })); min = n.getHours() * 60 + n.getMinutes() + 60; }
      for (; m <= end; m += cfg.slotMinutes) if (m >= min) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
      return out;
    }
    const key = (id, opt) => id + '|' + (opt || '');
    const lines = () => Object.entries(cart).filter(([, q]) => q > 0).map(([k, q]) => { const [id, opt] = k.split('|'); const p = cfg.products.find(x => x.id === id); return p && { p, opt, q }; }).filter(Boolean);
    const subtotal = () => lines().reduce((s, l) => s + l.q * l.p.price, 0);
    const fee = () => st.method === 'delivery' && cfg.delivery.on ? (cfg.delivery.freeAbove > 0 && subtotal() >= cfg.delivery.freeAbove ? 0 : cfg.delivery.fee) : 0;

    async function load() {
      if (!slug) return app.innerHTML = '<div class="empty">הקישור חסר. בקשי קישור חדש לטופס.</div>';
      try { cfg = await rpc('form_get', { p_slug: slug }); } catch (e) { cfg = undefined; }
      if (cfg === undefined) return app.innerHTML = '<div class="empty">אין חיבור כרגע.<br><br><button class="btn ghost" data-reload>לנסות שוב</button></div>';
      if (!cfg) return app.innerHTML = '<div class="empty">הטופס לא נמצא.</div>';
      document.title = (cfg.title || 'הזמנה') + ' · ' + (cfg.bizName || 'על הגשר');
      if (!cfg.open) return app.innerHTML = `<h1 style="text-align:center">${esc(cfg.title)}</h1><div class="empty">${esc(cfg.closedMsg || 'ההזמנות סגורות כרגע')}</div>`;
      if (!cfg.products.length) return app.innerHTML = `<h1 style="text-align:center">${esc(cfg.title)}</h1><div class="empty">התפריט מתעדכן — חזרי בקרוב 🤎</div>`;
      render();
    }

    function productHtml(p) {
      const opt = sel[p.id] ?? (p.options.length ? null : ''), q = cart[key(p.id, opt)] || 0;
      const inCart = p.options.length ? p.options.map(o => [o, cart[key(p.id, o)] || 0]).filter(x => x[1]) : [];
      return `<div class="prod" data-id="${esc(p.id)}">
        <div class="ph">${safeImg(p.img) ? `<img src="${esc(safeImg(p.img))}" alt="" loading="lazy">` : esc(p.name[0] || '')}</div>
        <div class="info"><div class="name">${esc(p.name)}</div>${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ''}
          <div class="price">${money(p.price)}${p.unit ? ` <span>· ${esc(p.unit)}</span>` : ''}</div>
          ${p.allergens && p.allergens.length ? `<div class="alg">מכיל: ${p.allergens.map(esc).join(', ')}</div>` : ''}
          ${p.options.length ? `<div class="opts">${p.options.map(o => `<button type="button" class="chip ${opt === o ? 'on' : ''}" aria-pressed="${opt === o}" data-opt="${esc(o)}">${esc(o)}${cart[key(p.id, o)] ? ` · ${cart[key(p.id, o)]}` : ''}</button>`).join('')}</div>` : ''}
          ${opt === null ? '<div class="note">בחרי סוג כדי להוסיף</div>' :
            `<div class="step">${q ? `<button type="button" data-d="1" aria-label="הוספת ${esc(p.name)}">+</button><output aria-live="polite" aria-label="כמות">${q}</output><button type="button" data-d="-1" aria-label="הפחתת ${esc(p.name)}">−</button>` : `<button type="button" class="add" data-d="1" aria-label="הוספת ${esc(p.name)} לסל">הוספה</button>`}</div>`}
          ${inCart.length > 1 || (inCart.length === 1 && inCart[0][0] !== opt) ? `<div class="note" style="margin-top:4px">בסל: ${inCart.map(([o, n]) => `${esc(o)} ×${n}`).join(', ')}</div>` : ''}
        </div></div>`;
    }

    function render() {
      const cats = []; cfg.products.forEach(p => { if (!cats.includes(p.cat)) cats.push(p.cat); });
      const dates = availableDates();
      if (st.date && !dates.some(d => d.s === st.date && !d.full)) st.date = '';
      const sl = slots(st.date); if (st.time && !sl.includes(st.time)) st.time = '';
      const scroll = scrollY;
      app.innerHTML = `
        <h1 style="text-align:center">${esc(cfg.title)}</h1>
        ${cfg.intro ? `<p class="intro">${esc(cfg.intro)}</p>` : ''}
        <h2><span class="n">1</span>מה תרצי להזמין?</h2>
        ${cats.map(c => `${cats.length > 1 && c ? `<div class="cat">${esc(c)}</div>` : ''}<div class="card">${cfg.products.filter(p => p.cat === c).map(productHtml).join('')}</div>`).join('')}
        <h2><span class="n">2</span>מתי?</h2>
        ${dates.length ? `<div class="dates" id="dates">${dates.map(d => `<button type="button" class="chip ${st.date === d.s ? 'on' : ''}" aria-pressed="${st.date === d.s}" data-date="${d.s}" ${d.full ? 'disabled title="היום מלא"' : ''}>${DAYS[d.d.getDay()]}<b>${fmtD(d.s)}</b>${d.full ? '<small>מלא</small>' : ''}</button>`).join('')}</div>`
          : '<div class="err">אין כרגע תאריכים פנויים להזמנה.</div>'}
        ${st.date && sl.length ? `<div class="note" style="margin:6px 0">שעה ${st.method === 'delivery' ? 'משוערת למשלוח' : 'לאיסוף'}:</div><div class="times">${sl.map(t => `<button type="button" class="chip ${st.time === t ? 'on' : ''}" aria-pressed="${st.time === t}" data-time="${t}">${t}</button>`).join('')}</div>` : ''}
        <h2><span class="n">3</span>איסוף או משלוח</h2>
        ${cfg.delivery.on ? `<div class="seg"><button type="button" data-m="pickup" aria-pressed="${st.method === 'pickup'}" class="${st.method === 'pickup' ? 'on' : ''}">איסוף עצמי</button><button type="button" data-m="delivery" aria-pressed="${st.method === 'delivery'}" class="${st.method === 'delivery' ? 'on' : ''}">משלוח ${cfg.delivery.fee ? '(' + money(cfg.delivery.fee) + ')' : ''}</button></div>` : ''}
        ${st.method === 'delivery' ? `<label><span>כתובת למשלוח *</span><input id="f_a" autocomplete="street-address" value="${esc(saved.address || '')}"></label>${cfg.delivery.note ? `<p class="note">${esc(cfg.delivery.note)}</p>` : ''}${cfg.delivery.freeAbove ? `<p class="note">משלוח חינם בהזמנה מעל ${money(cfg.delivery.freeAbove)}</p>` : ''}`
          : `<p class="note" style="margin-top:0">${cfg.hasPickupAddress ? 'כתובת האיסוף תופיע מיד אחרי שליחת ההזמנה.' : 'כתובת האיסוף תישלח באישור ההזמנה.'}</p>`}
        <h2><span class="n">4</span>פרטים</h2>
        <label><span>שם מלא *</span><input id="f_n" autocomplete="name" value="${esc(saved.name || '')}"></label>
        <label><span>טלפון *</span><input id="f_p" type="tel" inputmode="tel" autocomplete="tel" placeholder="050-0000000" value="${esc(saved.phone || '')}"></label>
        <label><span>אלרגיות / רגישויות</span><input id="f_al" placeholder="למשל: ללא אגוזים"></label>
        <label><span>הערות (הקדשה, צבעים, בקשות)</span><textarea id="f_no" rows="3"></textarea></label>
        ${payRule() ? `<div class="paybox-note">💳 ${payRule()}</div>` : cfg.payInfo ? `<p class="note">💳 ${esc(cfg.payInfo)}</p>` : ''}
        ${cfg.terms ? `<label class="check"><input type="checkbox" id="f_terms"><span>${esc(cfg.terms)}</span></label>` : ''}
        <div id="err"></div>
        <footer>${esc(cfg.bizName || 'על הגשר')} · ההזמנה תאושר סופית לאחר אישור בעלת העסק</footer>`;
      scrollTo(0, scroll);
      if (st.date) { const b = app.querySelector(`[data-date="${st.date}"]`); if (b) b.scrollIntoView({ block: 'nearest', inline: 'center' }); }
      bar();
    }
    const pay = () => cfg.pay || { mode: 'none' };
    const dueFor = total => pay().mode === 'full' ? total : pay().mode === 'deposit' ? Math.ceil(total * (pay().pct || 50) / 100) : 0;
    function payRule() {
      if (pay().mode === 'none') return '';
      const what = pay().mode === 'full' ? 'תשלום מלא' : `מקדמה של ${pay().pct || 50}%`;
      const t = subtotal() + fee();
      return `ההזמנה מאושרת רק לאחר ${what}${t ? ` (${money(dueFor(t))})` : ''} ב${safeUrl(pay().paybox) ? 'ביט או בפייבוקס' : 'ביט'}, תוך ${pay().hours || 24} שעות מהשליחה.`;
    }
    function bar() {
      let b = $('.bar');
      if (!b) { document.body.insertAdjacentHTML('beforeend', '<div class="bar"><div class="in"><div class="total" id="tot"></div><button class="btn" id="send">שליחת הזמנה</button></div></div>'); b = $('.bar'); }
      const n = lines().reduce((s, l) => s + l.q, 0), f = fee();
      const due = dueFor(subtotal() + f);
      $('#tot').innerHTML = `<b>${money(subtotal() + f)}</b><span>${n ? n + ' פריטים' + (f ? ' · כולל משלוח' : '') : 'הסל ריק'}${cfg.minOrder && subtotal() < cfg.minOrder ? ` · מינימום ${money(cfg.minOrder)}` : ''}${n && due && pay().mode === 'deposit' ? ` · מקדמה ${money(due)}` : ''}</span>`;
      const pn = $('.paybox-note'); if (pn) pn.textContent = '💳 ' + payRule();
      $('#send').disabled = !n || sending;
    }
    const keep = () => { ['f_n', 'f_p', 'f_a', 'f_al', 'f_no'].forEach(id => { const e = $('#' + id); if (e) keepVals[id] = e.value; }); const t = $('#f_terms'); if (t) keepVals.terms = t.checked; };
    const restore = () => { Object.entries(keepVals).forEach(([id, v]) => { if (id === 'terms') { const t = $('#f_terms'); if (t) t.checked = v; } else { const e = $('#' + id); if (e) e.value = v; } }); };
    const keepVals = {};
    // שומר על הפוקוס במקום (חשוב לניווט במקלדת ולקורא מסך)
    const focusKey = el => { if (!el || !el.closest) return null; const p = el.closest('.prod'); const a = ['data-d', 'data-opt', 'data-date', 'data-time', 'data-m'].find(x => el.hasAttribute && el.hasAttribute(x)); return a ? { id: p && p.dataset.id, a, v: el.getAttribute(a) } : null; };
    const rerender = () => {
      const fk = focusKey(document.activeElement);
      keep(); render(); restore();
      if (fk) { const scope = fk.id ? app.querySelector(`.prod[data-id="${CSS.escape(fk.id)}"]`) : app; const el = scope && (scope.querySelector(`[${fk.a}="${CSS.escape(fk.v)}"]`) || scope.querySelector(`[${fk.a}]`)); if (el) el.focus({ preventScroll: true }); }
    };

    document.addEventListener('click', e => {
      if (e.target.closest('[data-reload]')) { location.reload(); return; }
      const prod = e.target.closest('.prod');
      if (prod) {
        const id = prod.dataset.id, p = cfg.products.find(x => x.id === id);
        const o = e.target.closest('[data-opt]'); if (o) { sel[id] = o.dataset.opt; rerender(); return; }
        const d = e.target.closest('[data-d]');
        if (d) { const opt = sel[id] ?? ''; const k = key(id, opt); cart[k] = Math.min(Math.max((cart[k] || 0) + (+d.dataset.d), 0), p.maxQty || 20); if ((cart[k] || 0) === (p.maxQty || 20) && +d.dataset.d > 0) flash(`אפשר להזמין עד ${p.maxQty || 20} מהמוצר הזה`); rerender(); }
        return;
      }
      const dt = e.target.closest('[data-date]'); if (dt && !dt.disabled) { st.date = dt.dataset.date; rerender(); return; }
      const tm = e.target.closest('[data-time]'); if (tm) { st.time = tm.dataset.time; rerender(); return; }
      const m = e.target.closest('[data-m]'); if (m) { st.method = m.dataset.m; rerender(); return; }
      if (e.target.id === 'send') send();
    });
    function flash(msg) { const el = $('#err'); if (el) el.innerHTML = `<div class="err" role="alert">${esc(msg)}</div>`; }
    function fail(msg, focusSel) {
      const el = $('#err'); el.innerHTML = `<div class="err" role="alert">${esc(msg)}</div>`;
      const f = focusSel && $(focusSel);
      if (f) { f.classList.add('missing'); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (f.focus) f.focus({ preventScroll: true }); setTimeout(() => f.classList.remove('missing'), 2500); }
      else el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    async function send() {
      const v = id => ($('#' + id) ? $('#' + id).value.trim() : '');
      if (!lines().length) return fail('הסל ריק', '.card');
      if (cfg.minOrder && subtotal() < cfg.minOrder) return fail(`סכום ההזמנה המינימלי הוא ${money(cfg.minOrder)}`);
      if (!st.date) return fail('נא לבחור תאריך', '#dates');
      if (cfg.slotMinutes && slots(st.date).length && !st.time) return fail('נא לבחור שעה', '.times');
      if (st.method === 'delivery' && v('f_a').length < 3) return fail('נא למלא כתובת למשלוח', '#f_a');
      if (v('f_n').length < 2) return fail('נא למלא שם', '#f_n');
      if (v('f_p').replace(/\D/g, '').length < 9) return fail('נא למלא מספר טלפון תקין', '#f_p');
      if ($('#f_terms') && !$('#f_terms').checked) return fail('נא לאשר את התנאים', '#f_terms');
      sending = true; bar(); $('#send').textContent = 'שולחת…';
      const order = { name: v('f_n'), phone: v('f_p'), date: st.date, time: st.time, method: st.method, address: v('f_a'), allergies: v('f_al'), notes: v('f_no'),
        items: lines().map(l => ({ id: l.p.id, qty: l.q, option: l.opt || '' })) };
      try {
        const res = (await rpc('form_submit', { p_slug: slug, p_order: order }))[0];
        if (!res || !res.ok) {
          sending = false; $('#send').textContent = 'שליחת הזמנה'; bar();
          fail(res ? res.msg : 'משהו השתבש. נסי שוב');
          if (res && /מלא|זמין|סגור/.test(res.msg)) { try { cfg = await rpc('form_get', { p_slug: slug }) || cfg; } catch (e) { } st.date = ''; rerender(); flash(res.msg); }
          if (res && /לא זמין. רענני/.test(res.msg)) setTimeout(() => location.reload(), 2500);
          return;
        }
        try { localStorage.setItem('ag-customer', JSON.stringify({ name: order.name, phone: order.phone, address: order.address || saved.address || '' })); } catch (e) { }
        done(order, res);
      } catch (e) {
        sending = false; $('#send').textContent = 'שליחת הזמנה'; bar();
        fail('אין חיבור לאינטרנט כרגע. ההזמנה לא נשלחה — נסי שוב בעוד רגע.');
      }
    }
    function done(order, res) {
      const ls = lines(), f = fee(), d = parse(order.date);
      const when = `יום ${DAYS[d.getDay()]} ${fmtD(order.date)}${order.time ? ' בשעה ' + order.time : ''}`;
      const text = `היי! שלחתי הזמנה #${res.ref} בטופס 🤎\n` + ls.map(l => `• ${l.q} × ${l.p.name}${l.opt ? ' (' + l.opt + ')' : ''}`).join('\n') +
        `\n${when} · ${order.method === 'delivery' ? 'משלוח ל' + order.address : 'איסוף עצמי'}\nסה״כ: ${money(+res.total)}${+res.due > 0 ? `\nלתשלום לאישור: ${money(+res.due)}` : ''}\n${order.name}`;
      $('.bar') && $('.bar').remove();
      const needPay = +res.due > 0;
      const payHtml = needPay ? `<div class="pay-step">
          <div class="due">${money(+res.due)}</div>
          <p class="note">${pay().mode === 'full' ? 'תשלום מלא' : 'מקדמה'} לאישור ההזמנה, תוך ${pay().hours || 24} שעות. בהעברה כתבי: הזמנה #${esc(res.ref)}</p>
          ${pay().bit ? `<div class="pay-opt"><div><b>ביט</b><div class="note" dir="ltr" style="text-align:right">${esc(pay().bit)}</div></div><button class="btn ghost" data-copy="${esc(pay().bit.replace(/\D/g, ''))}">העתקת המספר</button></div>` : ''}
          ${safeUrl(pay().paybox) ? `<div class="pay-opt"><div><b>פייבוקס</b><div class="note">תשלום בקישור</div></div><a class="btn ghost" href="${esc(safeUrl(pay().paybox))}" target="_blank" rel="noopener noreferrer">לתשלום בפייבוקס</a></div>` : ''}
          <div id="claimBox" style="margin-top:14px"><div class="note" style="margin-bottom:8px">אחרי שהעברת — לחצי כאן:</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${pay().bit ? '<button class="btn" data-claim="ביט">שילמתי בביט ✓</button>' : ''}${safeUrl(pay().paybox) ? '<button class="btn" data-claim="פייבוקס">שילמתי בפייבוקס ✓</button>' : ''}</div></div>
        </div>` : '';
      app.innerHTML = `<div class="card done">
        <div class="ic" style="${needPay ? 'background:var(--sand);color:var(--brown)' : ''}">${needPay ? '₪' : '✓'}</div>
        <h1 style="margin-top:12px">${needPay ? `כמעט סיימנו, ${esc(order.name.split(' ')[0])}!` : `תודה ${esc(order.name.split(' ')[0])}! ההזמנה התקבלה`}</h1>
        <p class="note">${needPay ? `הזמנה <b>#${esc(res.ref)}</b> נקלטה ותאושר אחרי התשלום` : `מספר הזמנה <b>#${esc(res.ref)}</b>`} · ${when}</p>
        ${payHtml}
        <div class="sum">${ls.map(l => `<div><span>${l.q} × ${esc(l.p.name)}${l.opt ? ' (' + esc(l.opt) + ')' : ''}</span><span>${money(l.q * l.p.price)}</span></div>`).join('')}
          ${f ? `<div><span>משלוח</span><span>${money(f)}</span></div>` : ''}<div><span>סה״כ</span><span>${money(+res.total)}</span></div></div>
        <p id="pickupAddr"></p>
        ${!needPay && cfg.payInfo ? `<p class="note">💳 ${esc(cfg.payInfo)}</p>` : ''}
        <p class="note">${needPay ? 'שאלות? אפשר לשלוח לי הודעה:' : 'אחזור אלייך לאישור סופי. אפשר גם לשלוח לי הודעה:'}</p>
        ${cfg.phone ? `<a class="btn wa" href="https://wa.me/${esc(cfg.phone)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">שליחת הודעה בוואטסאפ</a>` : ''}
        <div style="margin-top:12px"><button class="btn ghost" data-reload>הזמנה נוספת</button></div></div>`;
      scrollTo(0, 0);
      if (order.method === 'pickup' && cfg.hasPickupAddress) rpc('form_pickup', { p_slug: slug, p_ref: res.ref, p_phone: order.phone }).then(a => { if (a) $('#pickupAddr').innerHTML = `📍 איסוף מ: <b>${esc(a)}</b>`; }).catch(() => { });
      app.onclick = async e => {
        const c = e.target.closest('[data-copy]');
        if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); c.textContent = 'הועתק ✓'; } catch (err) { c.textContent = c.dataset.copy; } return; }
        const b = e.target.closest('[data-claim]'); if (!b) return;
        b.disabled = true; b.textContent = 'שולחת…';
        try {
          const ok = await rpc('form_paid_claim', { p_slug: slug, p_ref: res.ref, p_phone: order.phone, p_method: b.dataset.claim });
          $('#claimBox').innerHTML = ok ? '<div class="paid-ok">✓ תודה! קיבלתי את העדכון. ההזמנה תאושר ברגע שאוודא שהתשלום נכנס.</div>' : '<div class="err">לא הצלחתי לעדכן. שלחי לי הודעה בוואטסאפ.</div>';
        } catch (err) { b.disabled = false; b.textContent = 'שילמתי ב' + b.dataset.claim + ' ✓'; $('#claimBox').insertAdjacentHTML('beforeend', '<div class="err">אין חיבור — נסי שוב</div>'); }
      };
    }
    load();
  })();
