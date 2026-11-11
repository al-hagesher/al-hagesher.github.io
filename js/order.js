/* על הגשר — דף ההזמנה ללקוחות */
(function () {
  const SB_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co', SB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const $ = s => document.querySelector(s), app = $('#app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
  const money = n => '₪' + nf.format(Math.round(n * 100) / 100);
  const pad = n => String(n).padStart(2, '0');
  // טפסים שפורסמו לפני המעבר לכתובת החדשה מפנים לתמונות בכתובת הישנה
  const fixBase = s => String(s || '').replace(/^https:\/\/hadasa055999-debug\.github\.io\/al-hagesher\//, 'https://al-hagesher.github.io/');
  // רק תמונות וקישורי https בטוחים
  const safeImg = s => (s = fixBase(s), /^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/|assets\/)/i.test(s) ? s : '');
  const safeUrl = s => /^https:\/\//i.test(String(s || '')) ? String(s) : '';
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const MONTHS = ['בינו׳', 'בפבר׳', 'במרץ', 'באפר׳', 'במאי', 'ביוני', 'ביולי', 'באוג׳', 'בספט׳', 'באוק׳', 'בנוב׳', 'בדצמ׳'];
  const fmtD = s => { const [, m, d] = s.split('-'); return `${+d}/${+m}`; };
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const params = new URLSearchParams(location.search);
  const preview = location.hash === '#preview';
  const slug = params.get('f') || '';
  const urlCoupon = (params.get('coupon') || '').trim().toUpperCase();
  const rpc = async (fn, body) => { const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status); return r.json(); };
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
  const saved = (!preview && store.get('ag-customer')) || {};
  const DRAFT = 'ag-draft-' + slug;

  let cfg, cart = {}, notes = {}, noteOpen = {}, sending = false, cpOpen = false, cpErr = '';
  const st = { date: '', time: '', method: 'pickup', coupon: urlCoupon, address: saved.address || '', name: saved.name || '', phone: saved.phone || '', allergies: '', notes: '', policy: false, terms: false };

  // ---------- חישובים ----------
  // ישראל: התאריך של היום לפי שעון ירושלים
  const todayIL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function availableDates() {
    const out = [], t = parse(todayIL());
    for (let i = cfg.leadDays || 0; i <= (cfg.maxDaysAhead || 30); i++) {
      const d = new Date(t); d.setDate(t.getDate() + i); const s = iso(d), day = cfg.days[d.getDay()];
      if (!day || !day.on || (cfg.blocked || []).includes(s)) continue;
      out.push({ s, d, i, full: cfg.capacity > 0 && ((cfg.load || {})[s] || 0) >= cfg.capacity });
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
  const prodOf = id => cfg.products.find(x => x.id === id);
  const maxOf = p => +p.maxQty || 20;
  const qtyOf = p => p.options.length ? p.options.reduce((s, o) => s + (cart[key(p.id, o)] || 0), 0) : (cart[key(p.id, '')] || 0);
  // שורות הסל לפי סדר התפריט
  function lines() {
    const out = [];
    cfg.products.forEach(p => (p.options.length ? p.options : ['']).forEach(o => { const q = cart[key(p.id, o)] || 0; if (q > 0) out.push({ p, opt: o, q }); }));
    return out;
  }
  const count = () => lines().reduce((s, l) => s + l.q, 0);
  const subtotal = () => lines().reduce((s, l) => s + l.q * l.p.price, 0);
  const fee = () => st.method === 'delivery' && cfg.delivery.on ? (cfg.delivery.freeAbove > 0 && subtotal() >= cfg.delivery.freeAbove ? 0 : (+cfg.delivery.fee || 0)) : 0;
  // בדיקת קופון מיידית בדפדפן; השרת בודק שוב בשליחה וקובע את הסכום הסופי
  function coupon() {
    const code = (st.coupon || '').trim().toUpperCase(); if (!code) return null;
    const c = (cfg.coupons || []).find(x => String(x.code || '').toUpperCase() === code), sub = subtotal(), today = todayIL();
    if (!c) return { ok: false, code, fatal: true, reason: 'הקוד לא קיים או כבר לא פעיל' };
    if (c.to && c.to < today) return { ok: false, code, fatal: true, reason: 'הקוד פג תוקף' };
    if (c.from && c.from > today) return { ok: false, code, fatal: true, reason: 'הקוד עוד לא בתוקף' };
    if (+c.maxUses && (+c.uses || 0) >= +c.maxUses) return { ok: false, code, fatal: true, reason: 'הקוד כבר נוצל עד הסוף' };
    if (+c.minOrder && sub < +c.minOrder) return { ok: false, code: c.code, reason: `הקוד תקף בהזמנה מעל ${money(+c.minOrder)}` };
    const val = Math.max(+c.value || 0, 0);
    const d = c.type === 'percent' ? Math.round(sub * Math.min(val, 100)) / 100 : Math.min(val, sub);
    return { ok: true, code: c.code, discount: Math.round(d * 100) / 100, first: !!c.firstOrderOnly };
  }
  const discount = () => { const c = coupon(); return c && c.ok ? c.discount : 0; };
  const total = () => Math.max(subtotal() + fee() - discount(), 0);
  const pay = () => cfg.pay || { mode: 'none' };
  const dueFor = t => pay().mode === 'full' ? t : pay().mode === 'deposit' ? Math.ceil(t * (pay().pct || 50) / 100) : 0;
  function payRule() {
    if (pay().mode === 'none') return '';
    const what = pay().mode === 'full' ? 'תשלום מלא' : `מקדמה של ${pay().pct || 50}%`, t = total();
    return `ההזמנה מאושרת רק לאחר ${what}${t ? ` (${money(dueFor(t))})` : ''} ב${safeUrl(pay().paybox) ? 'ביט או בפייבוקס' : 'ביט'}, תוך ${pay().hours || 24} שעות מהשליחה.`;
  }

  // ---------- טיוטה: מה שהלקוחה בחרה נשמר אם הדף נסגר בטעות ----------
  let draftT;
  function saveDraft() {
    if (preview) return;
    clearTimeout(draftT);
    draftT = setTimeout(() => store.set(DRAFT, { t: Date.now(), cart, notes, st: { date: st.date, time: st.time, method: st.method, coupon: st.coupon, address: st.address, name: st.name, phone: st.phone, allergies: st.allergies, notes: st.notes } }), 250);
  }
  function loadDraft() {
    if (preview) return;
    const d = store.get(DRAFT); if (!d || !d.t || Date.now() - d.t > 24 * 3600e3) return store.del(DRAFT);
    Object.entries(d.cart || {}).forEach(([k, q]) => {
      const i = k.indexOf('|'), p = prodOf(k.slice(0, i)), o = k.slice(i + 1);
      if (!p || (p.options.length ? !p.options.includes(o) : o !== '')) return;
      q = Math.min(Math.floor(+q) || 0, maxOf(p)); if (q > 0) cart[k] = q;
    });
    Object.entries(d.notes || {}).forEach(([id, t]) => { if (prodOf(id) && t) notes[id] = String(t).slice(0, 300); });
    Object.entries(d.st || {}).forEach(([k, v]) => { if (k in st && typeof v === 'string' && v && !(k === 'coupon' && urlCoupon)) st[k] = v; });
    if (st.method === 'delivery' && !cfg.delivery.on) st.method = 'pickup';
  }

  // ---------- טעינה ----------
  const emptyPage = html => { app.innerHTML = html; };
  async function load() {
    if (preview) { cfg = store.get('ag-form-preview'); if (!cfg) return emptyPage('<div class="empty">אין תצוגה מקדימה. פתחי אותה מתוך מסך הטופס באפליקציה.</div>'); }
    else {
      if (!slug) return emptyPage('<div class="empty">הקישור חסר. בקשי קישור חדש לטופס.</div>');
      try { cfg = await rpc('form_get', { p_slug: slug }); } catch (e) { cfg = undefined; }
      if (cfg === undefined) return emptyPage('<div class="empty">אין חיבור כרגע.<br><br><button class="btn ghost" data-reload>לנסות שוב</button></div>');
      if (!cfg) return emptyPage('<div class="empty">הטופס לא נמצא.</div>');
    }
    cfg.products = (cfg.products || []).map(p => ({ ...p, options: Array.isArray(p.options) ? p.options.filter(Boolean) : [], price: +p.price || 0 }));
    cfg.delivery = cfg.delivery || {}; cfg.days = cfg.days || {};
    document.title = (cfg.title || 'הזמנה') + ' · ' + (cfg.bizName || 'על הגשר');
    const head = `${preview ? '<div class="preview-banner">תצוגה מקדימה — הזמנות לא נשלחות מכאן</div>' : ''}<div class="hero"><h1>${esc(cfg.title)}</h1>`;
    if (!cfg.open && !preview) return emptyPage(`${head}</div><div class="empty">${esc(cfg.closedMsg || 'ההזמנות סגורות כרגע')}</div>`);
    if (!cfg.products.length) return emptyPage(`${head}</div><div class="empty">התפריט מתעדכן — חזרי בקרוב 🤎</div>`);
    loadDraft(); build();
  }

  // ---------- מוצר ----------
  const KZ = { parve: 'פרווה', dairy: 'חלבי' };
  function stepper(p, o) {
    const q = cart[key(p.id, o)] || 0, nm = esc(p.name + (o ? ' ' + o : ''));
    return `<div class="step">${q ? `<button type="button" data-d="1" data-o="${esc(o)}" aria-label="הוספת ${nm}">+</button><output aria-live="polite" aria-label="כמות">${q}</output><button type="button" data-d="-1" data-o="${esc(o)}" aria-label="הפחתת ${nm}">−</button>`
      : `<button type="button" class="add" data-d="1" data-o="${esc(o)}" aria-label="הוספת ${nm} לסל">הוספה</button>`}</div>`;
  }
  function prodHtml(p) {
    const q = qtyOf(p), img = safeImg(p.img), badge = q ? `<span class="qb" aria-hidden="true">${q}</span>` : '';
    const price = `<div class="price">${money(p.price)}${p.unit ? ` <span>· ${esc(p.unit)}</span>` : ''}</div>`;
    const noteHtml = !q ? '' : (p.note || noteOpen[p.id] || notes[p.id])
      ? `<label class="pnote"><span>${esc(p.note || 'הערה למוצר')}</span><input data-note maxlength="300" value="${esc(notes[p.id] || '')}" placeholder="${p.note ? '' : 'למשל: בלי אבקת סוכר'}"></label>`
      : '<button type="button" class="link sm" data-addnote>＋ הערה למוצר</button>';
    return `<div class="prod ${q ? 'in' : ''}" data-id="${esc(p.id)}">
      ${img ? `<button type="button" class="ph" data-zoom aria-label="הגדלת התמונה של ${esc(p.name)}"><img src="${esc(img)}" alt="" loading="lazy">${badge}</button>` : `<div class="ph">${esc(p.name[0] || '')}${badge}</div>`}
      <div class="info">
        <div class="name">${esc(p.name)}${KZ[p.kosher] ? `<span class="kz ${p.kosher}">${KZ[p.kosher]}</span>` : ''}${p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}</div>
        ${p.desc ? `<div class="desc" data-more>${esc(p.desc)}</div>` : ''}
        ${p.allergens && p.allergens.length ? `<div class="alg">מכיל: ${p.allergens.map(esc).join(', ')}</div>` : ''}
        ${p.options.length ? `${price}<div class="optrows">${p.options.map(o => `<div class="optrow ${cart[key(p.id, o)] ? 'in' : ''}"><span>${esc(o)}</span>${stepper(p, o)}</div>`).join('')}</div>`
          : `<div class="buy">${price}${stepper(p, '')}</div>`}
        ${noteHtml}
      </div></div>`;
  }
  function drawProd(id, focus) {
    const el = app.querySelector(`.prod[data-id="${CSS.escape(id)}"]`), p = prodOf(id); if (!el || !p) return;
    el.outerHTML = prodHtml(p);
    if (focus) { const n = app.querySelector(`.prod[data-id="${CSS.escape(id)}"]`); const b = n && (n.querySelector(`[data-d="${focus.d}"][data-o="${CSS.escape(focus.o)}"]`) || n.querySelector(`[data-d][data-o="${CSS.escape(focus.o)}"]`)); if (b) b.focus({ preventScroll: true }); }
  }

  // ---------- מתי / איך ----------
  function drawWhen() {
    const dates = availableDates(), box = $('#when'); if (!box) return;
    if (st.date && !dates.some(d => d.s === st.date && !d.full)) st.date = '';
    const sl = slots(st.date); if (st.time && !sl.includes(st.time)) st.time = '';
    if (!dates.length) { box.innerHTML = '<div class="err">אין כרגע תאריכים פנויים להזמנה.</div>'; return; }
    box.innerHTML = `<div class="dates" id="dates">${dates.map(d => `<button type="button" class="dchip ${st.date === d.s ? 'on' : ''}" aria-pressed="${st.date === d.s}" data-date="${d.s}" ${d.full ? 'disabled' : ''} aria-label="יום ${DAYS[d.d.getDay()]} ${fmtD(d.s)}${d.full ? ' — מלא' : ''}"><small>${d.i === 0 ? 'היום' : d.i === 1 ? 'מחר' : 'יום ' + DAYS[d.d.getDay()]}</small><b>${d.d.getDate()}</b><small>${d.full ? 'מלא' : MONTHS[d.d.getMonth()]}</small></button>`).join('')}</div>
      ${st.date && sl.length ? `<div class="lbl">שעה ${st.method === 'delivery' ? 'משוערת למשלוח' : 'לאיסוף'}</div><div class="times" id="times">${sl.map(t => `<button type="button" class="chip ${st.time === t ? 'on' : ''}" aria-pressed="${st.time === t}" data-time="${t}">${t}</button>`).join('')}</div>`
        : st.date && cfg.slotMinutes ? '<p class="note">לא נשארו שעות פנויות ביום הזה — בחרי יום אחר.</p>' : !st.date ? '<p class="note">בחרי יום כדי לראות את השעות.</p>' : ''}`;
    const on = box.querySelector('.dchip.on'), row = $('#dates');
    if (on && row) row.scrollLeft += on.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - on.offsetWidth) / 2;
  }
  function drawHow() {
    const box = $('#how'), dl = cfg.delivery; if (!box) return;
    box.innerHTML = `${dl.on ? `<div class="seg"><button type="button" data-m="pickup" aria-pressed="${st.method === 'pickup'}" class="${st.method === 'pickup' ? 'on' : ''}">איסוף עצמי</button><button type="button" data-m="delivery" aria-pressed="${st.method === 'delivery'}" class="${st.method === 'delivery' ? 'on' : ''}">משלוח${+dl.fee ? ' (' + money(+dl.fee) + ')' : ''}</button></div>` : ''}
      ${st.method === 'delivery' && dl.on ? `<label class="fld"><span>כתובת למשלוח *</span><input id="f_a" data-f="address" autocomplete="street-address" maxlength="200" value="${esc(st.address)}"><small class="ferr" id="e_f_a"></small></label>${dl.note ? `<p class="note">${esc(dl.note)}</p>` : ''}${+dl.freeAbove ? `<p class="note">משלוח חינם בהזמנה מעל ${money(+dl.freeAbove)}</p>` : ''}`
        : `<p class="note" style="margin-top:0">📍 ${cfg.hasPickupAddress || (preview && cfg.pickupAddress) ? 'כתובת האיסוף תופיע מיד אחרי שליחת ההזמנה.' : 'כתובת האיסוף תישלח באישור ההזמנה.'}</p>`}`;
  }

  // ---------- שלד הדף (נבנה פעם אחת; אחר כך מתעדכנים רק החלקים שהשתנו) ----------
  let cats = [];
  function build() {
    cats = []; cfg.products.forEach(p => { const c = p.cat || ''; if (!cats.includes(c)) cats.push(c); });
    const onDays = [0, 1, 2, 3, 4, 5, 6].filter(i => cfg.days[i] && cfg.days[i].on), dl = cfg.delivery;
    const pills = [
      onDays.length === 7 ? 'כל יום' : onDays.length ? 'ימי ' + onDays.map(i => DAYS[i]).join(', ') : '',
      cfg.leadDays > 0 ? (cfg.leadDays === 1 ? 'להזמין יום מראש' : `להזמין ${cfg.leadDays} ימים מראש`) : '',
      +cfg.minOrder ? `מינימום ${money(+cfg.minOrder)}` : '',
      dl.on ? (+dl.freeAbove ? `משלוח חינם מעל ${money(+dl.freeAbove)}` : 'יש משלוחים') : 'איסוף עצמי'
    ].filter(Boolean);
    const fld = (id, k, label, extra) => `<label class="fld"><span>${label}</span><input id="${id}" data-f="${k}" value="${esc(st[k])}" ${extra || ''}><small class="ferr" id="e_${id}"></small></label>`;
    app.innerHTML = `
      ${preview ? '<div class="preview-banner">תצוגה מקדימה — הזמנות לא נשלחות מכאן</div>' : ''}
      <div class="hero"><h1>${esc(cfg.title)}</h1>${cfg.intro ? `<p class="intro">${esc(cfg.intro)}</p>` : ''}<div class="pills">${pills.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div></div>
      <section id="s-menu"><h2><span class="n">1</span>מה תרצי להזמין?</h2>
        ${cats.length > 1 ? `<nav class="cats" id="cats" aria-label="קטגוריות">${cats.map((c, i) => `<button type="button" data-cat="${i}" class="${i ? '' : 'on'}">${esc(c || 'עוד')}</button>`).join('')}</nav>` : ''}
        ${cats.map((c, i) => `<div class="catsec" id="cat-${i}" data-ci="${i}">${cats.length > 1 ? `<h3 class="cat">${esc(c || 'עוד')}</h3>` : ''}<div class="card">${cfg.products.filter(p => (p.cat || '') === c).map(prodHtml).join('')}</div></div>`).join('')}
      </section>
      <section id="s-when"><h2><span class="n">2</span>מתי?</h2><div id="when"></div></section>
      <section id="s-how"><h2><span class="n">3</span>${dl.on ? 'איסוף או משלוח' : 'איסוף עצמי'}</h2><div id="how"></div></section>
      <section id="s-details"><h2><span class="n">4</span>הפרטים שלך</h2>
        ${fld('f_n', 'name', 'שם מלא *', 'autocomplete="name" maxlength="80"')}
        ${fld('f_p', 'phone', 'טלפון *', 'type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="050-0000000"')}
        ${fld('f_al', 'allergies', 'אלרגיות / רגישויות', 'maxlength="200" placeholder="למשל: ללא אגוזים"')}
        <label class="fld"><span>הערות להזמנה (הקדשה, בקשות מיוחדות)</span><textarea id="f_no" data-f="notes" rows="3" maxlength="600">${esc(st.notes)}</textarea></label>
      </section>
      <section id="s-sum"><h2><span class="n">5</span>סיכום ההזמנה</h2>
        <div class="card sumcard" id="sum"></div>
        <div class="paybox-note" id="payNote" hidden></div>
        ${cfg.cancellationPolicy ? `<details class="policy-box"><summary>📋 מדיניות ביטולים — חשוב לקרוא</summary><div class="policy-text">${esc(cfg.cancellationPolicy)}</div></details><label class="check" id="c_policy"><input type="checkbox" id="f_policy"><span>קראתי ומסכימה למדיניות הביטולים</span></label>` : ''}
        ${cfg.terms ? `<label class="check" id="c_terms"><input type="checkbox" id="f_terms"><span>${esc(cfg.terms)}</span></label>` : ''}
        <div id="err"></div>
      </section>
      <footer>${esc(cfg.bizName || 'על הגשר')} · ההזמנה תאושר סופית לאחר אישור בעלת העסק</footer>`;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="bar"><div class="in"><button type="button" class="total" id="tot" aria-label="פתיחת הסל"></button><button type="button" class="btn" id="cta"></button></div></div>
      <div class="toast" id="toast" role="status"></div>
      <dialog class="sheet" id="cartDlg" aria-label="הסל שלי"><div class="sh-head"><h3>הסל שלי</h3><button type="button" class="x" data-shclose aria-label="סגירה">✕</button></div><div class="sh-body" id="cartBody"></div><div id="cartMsg"></div><div class="sh-foot"><button type="button" class="btn ghost" data-shclose>עוד מוצרים</button><button type="button" class="btn" data-cartgo>המשך</button></div></dialog>
      <dialog class="zoom" id="imgDlg"><img alt=""><p></p></dialog>`);
    drawWhen(); drawHow(); drawSum(); drawBar(); spy();
    if (count()) toast('שמרתי לך את מה שבחרת 🤎');
  }
  // הדגשת הקטגוריה שנמצאת עכשיו על המסך
  function spy() {
    const nav = $('#cats'); if (!nav || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const b = nav.querySelector(`[data-cat="${e.target.dataset.ci}"]`); if (!b || b.classList.contains('on')) return;
      nav.querySelectorAll('.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
      nav.scrollLeft += b.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - b.offsetWidth) / 2;
    }), { rootMargin: '-70px 0px -65% 0px' });
    app.querySelectorAll('.catsec').forEach(s => io.observe(s));
  }

  // ---------- סיכום, סרגל תחתון וסל ----------
  const lineName = l => `${l.q} × ${esc(l.p.name)}${l.opt ? ' (' + esc(l.opt) + ')' : ''}`;
  const firstOf = l => !l.p.options.length || l.opt === l.p.options.find(o => cart[key(l.p.id, o)] > 0);
  function totalsHtml() {
    const f = fee(), c = coupon(), t = total(), due = dueFor(t);
    return `${st.method === 'delivery' && cfg.delivery.on ? `<div class="sl"><span>משלוח</span><span>${f ? money(f) : 'חינם'}</span></div>` : ''}
      ${c && c.ok ? `<div class="sl cpn ok"><span>קוד הנחה <span class="cptag">${esc(c.code)}</span><button type="button" class="x" data-cpx aria-label="הסרת קוד ההנחה">✕</button>${c.first ? '<small>להזמנה ראשונה בלבד</small>' : ''}</span><span>−${money(c.discount)}</span></div>`
        : c ? `<div class="sl cpn soft"><span><span class="cptag">${esc(c.code)}</span> ${esc(c.reason)}<button type="button" class="x" data-cpx aria-label="הסרת קוד ההנחה">✕</button></span><span></span></div>` : ''}
      <div class="sl tot"><span>סה״כ</span><span>${money(t)}</span></div>
      ${due && pay().mode === 'deposit' ? `<div class="sl due"><span>מקדמה לאישור ההזמנה (${pay().pct || 50}%)</span><span>${money(due)}</span></div>` : ''}`;
  }
  function drawSum() {
    const box = $('#sum'); if (!box) return; const ls = lines();
    const hadFocus = document.activeElement && document.activeElement.id === 'f_cp';
    const cp = !(cfg.coupons && cfg.coupons.length) || st.coupon ? '' : cpOpen
      ? `<div class="cpform"><input id="f_cp" maxlength="30" placeholder="קוד הנחה" autocapitalize="characters" autocomplete="off" aria-label="קוד הנחה"><button type="button" class="btn soft sm" data-cpapply>החלה</button></div><small class="ferr" id="cpErr">${esc(cpErr)}</small>`
      : `<button type="button" class="link sm" data-cpopen>יש לך קוד הנחה?</button>${cpErr ? `<small class="ferr">${esc(cpErr)}</small>` : ''}`;
    box.innerHTML = ls.length ? `${ls.map(l => `<div class="sl"><span>${lineName(l)}${notes[l.p.id] && firstOf(l) ? `<small>${esc(notes[l.p.id])}</small>` : ''}</span><span>${money(l.q * l.p.price)}</span></div>`).join('')}
      ${st.date ? `<div class="sl"><span><i>${st.method === 'delivery' ? 'משלוח' : 'איסוף'}:</i> יום ${DAYS[parse(st.date).getDay()]} ${fmtD(st.date)}${st.time ? ' · ' + st.time : ''}</span><span></span></div>` : ''}
      ${totalsHtml()}${cp}` : `<p class="empty-sum">עוד לא בחרת מוצרים.</p>${cp}`;
    if (hadFocus && $('#f_cp')) $('#f_cp').focus({ preventScroll: true });
    const pn = $('#payNote'), rule = payRule() || cfg.payInfo || '';
    if (pn) { pn.hidden = !rule; pn.textContent = rule ? '💳 ' + rule : ''; }
  }
  // הצעד הבא שחסר — הכפתור הראשי מוביל אליו
  function nextStep() {
    const n = count();
    if (!n) return { label: 'בחירת מוצרים', go: '#s-menu' };
    if (+cfg.minOrder && subtotal() < +cfg.minOrder) return { label: `עוד ${money(cfg.minOrder - subtotal())} למינימום`, go: '#s-menu', msg: `סכום ההזמנה המינימלי הוא ${money(+cfg.minOrder)}` };
    if (!st.date) return { label: 'לבחירת תאריך', go: '#s-when', pulse: '#dates' };
    if (cfg.slotMinutes && slots(st.date).length && !st.time) return { label: 'לבחירת שעה', go: '#times', pulse: '#times' };
    if (st.method === 'delivery' && st.address.trim().length < 3) return { label: 'למילוי כתובת', focus: '#f_a' };
    if (!st.name.trim()) return { label: 'המשך לפרטים', focus: '#f_n' };
    if (!st.phone.trim()) return { label: 'המשך לפרטים', focus: '#f_p' };
    return { label: 'שליחת הזמנה', send: true };
  }
  let lastTotal = null;
  function drawBar() {
    const tot = $('#tot'), cta = $('#cta'); if (!tot) return;
    const n = count(), t = total(), d = discount(), due = dueFor(t);
    tot.innerHTML = `<b>${money(t)}</b><span>${n ? (n === 1 ? 'פריט אחד' : n + ' פריטים') + (fee() ? ' · כולל משלוח' : '') + (d ? ` · הנחה ${money(d)}` : '') + (due && pay().mode === 'deposit' ? ` · מקדמה ${money(due)}` : '') + ' · לצפייה בסל' : 'הסל ריק'}</span>`;
    tot.disabled = !n;
    if (lastTotal !== null && lastTotal !== t) { tot.classList.remove('bump'); void tot.offsetWidth; tot.classList.add('bump'); }
    lastTotal = t;
    cta.textContent = sending ? 'שולחת…' : nextStep().label; cta.disabled = sending;
  }
  function drawCart() {
    const body = $('#cartBody'); if (!body) return; const ls = lines(), sub = subtotal(), dl = cfg.delivery;
    if (!ls.length) { $('#cartDlg').close(); return; }
    const prog = (target, text) => `<div class="prog">${text}<div><i style="width:${Math.min(100, Math.round(sub / target * 100))}%"></i></div></div>`;
    body.innerHTML = `${ls.map(l => `<div class="cl" data-id="${esc(l.p.id)}"><div class="cn"><b>${esc(l.p.name)}</b>${l.opt ? `<span>${esc(l.opt)}</span>` : ''}<small>${money(l.p.price)}</small></div>${stepper(l.p, l.opt)}<div class="cpr">${money(l.q * l.p.price)}</div></div>`).join('')}
      ${+cfg.minOrder && sub < +cfg.minOrder ? prog(+cfg.minOrder, `עוד ${money(cfg.minOrder - sub)} להזמנה המינימלית (${money(+cfg.minOrder)})`) : ''}
      ${dl.on && st.method === 'delivery' && +dl.freeAbove && +dl.fee && sub < +dl.freeAbove ? prog(+dl.freeAbove, `עוד ${money(dl.freeAbove - sub)} למשלוח חינם`) : ''}
      ${totalsHtml()}`;
    $('#cartMsg').textContent = '';
  }
  let toastT;
  function toast(msg) { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800); }
  const redraw = () => { drawSum(); drawBar(); if ($('#cartDlg') && $('#cartDlg').open) drawCart(); saveDraft(); };
  function setQty(id, o, d) {
    const p = prodOf(id); if (!p) return; const k = key(id, o), max = maxOf(p), cur = cart[k] || 0;
    if (d > 0 && cur >= max) return toast(`אפשר להזמין עד ${max} מ${p.name}`);
    const q = Math.max(cur + d, 0); if (q) cart[k] = q; else delete cart[k];
    if (!qtyOf(p)) { delete notes[id]; delete noteOpen[id]; }
  }
  function go(step) {
    if (step.msg) toast(step.msg);
    const el = $(step.focus || step.go); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: step.focus ? 'center' : 'start' });
    if (step.focus) setTimeout(() => el.focus({ preventScroll: true }), 350);
    const pu = step.pulse && $(step.pulse); if (pu) { pu.classList.remove('pulse'); void pu.offsetWidth; pu.classList.add('pulse'); }
  }
  function applyCoupon() {
    const inp = $('#f_cp'), code = inp ? inp.value.trim().toUpperCase() : ''; if (!code) return;
    st.coupon = code; const c = coupon();
    if (c && c.fatal) { st.coupon = ''; cpErr = c.reason; drawSum(); const i = $('#f_cp'); if (i) { i.value = code; i.classList.add('bad'); i.focus({ preventScroll: true }); } return; }
    cpErr = ''; cpOpen = false; redraw();
    toast(c && c.ok ? `קוד ההנחה הופעל — חסכת ${money(c.discount)} 🎉` : c ? c.reason : '');
  }

  // ---------- אירועים ----------
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-reload]')) { location.reload(); return; }
    if (!cfg || !$('#tot')) return;
    const dlg = t.closest('dialog');
    if (dlg && (t === dlg || dlg.id === 'imgDlg' || t.closest('[data-shclose]'))) { dlg.close(); return; }
    const d = t.closest('[data-d]'), row = t.closest('[data-id]');
    if (d && row) { const id = row.dataset.id, o = d.dataset.o || ''; setQty(id, o, +d.dataset.d); drawProd(id, row.classList.contains('prod') ? { d: d.dataset.d, o } : null); redraw(); return; }
    if (t.closest('[data-cartgo]')) { $('#cartDlg').close(); const s = nextStep(); if (s.send) go({ go: '#s-sum' }); else go(s); return; }
    if (row && row.classList.contains('prod')) {
      const id = row.dataset.id, p = prodOf(id);
      if (t.closest('[data-zoom]')) { const dl = $('#imgDlg'); dl.querySelector('img').src = safeImg(p.img); dl.querySelector('p').textContent = p.name; dl.showModal(); return; }
      if (t.closest('[data-addnote]')) { noteOpen[id] = true; drawProd(id); const i = app.querySelector(`.prod[data-id="${CSS.escape(id)}"] [data-note]`); if (i) i.focus(); return; }
      const more = t.closest('[data-more]'); if (more) more.classList.toggle('open');
      return;
    }
    const cat = t.closest('[data-cat]'); if (cat) { const s = $('#cat-' + cat.dataset.cat); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const dt = t.closest('[data-date]'); if (dt && !dt.disabled) { st.date = dt.dataset.date; drawWhen(); redraw(); return; }
    const tm = t.closest('[data-time]'); if (tm) { st.time = tm.dataset.time; drawWhen(); redraw(); return; }
    const m = t.closest('[data-m]'); if (m) { st.method = m.dataset.m; drawHow(); drawWhen(); redraw(); return; }
    if (t.closest('[data-cpopen]')) { cpOpen = true; cpErr = ''; drawSum(); const i = $('#f_cp'); if (i) i.focus(); return; }
    if (t.closest('[data-cpapply]')) return applyCoupon();
    if (t.closest('[data-cpx]')) { st.coupon = ''; cpErr = ''; cpOpen = false; redraw(); return; }
    if (t.closest('#tot')) { if (count()) { drawCart(); $('#cartDlg').showModal(); } return; }
    if (t.closest('#cta')) { const s = nextStep(); if (s.send) send(); else go(s); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'f_cp') { e.preventDefault(); applyCoupon(); } });
  document.addEventListener('input', e => {
    const t = e.target; if (!cfg) return;
    if (t.matches('[data-note]')) { const row = t.closest('.prod'); if (row) { notes[row.dataset.id] = t.value; if (!t.value) delete notes[row.dataset.id]; } drawSum(); saveDraft(); return; }
    if (t.dataset.f) { st[t.dataset.f] = t.value; t.classList.remove('bad'); const er = $('#e_' + t.id); if (er) er.textContent = ''; drawBar(); saveDraft(); return; }
    if (t.id === 'f_cp') { t.classList.remove('bad'); const er = $('#cpErr'); if (er) er.textContent = ''; cpErr = ''; return; }
    if (t.id === 'f_policy' || t.id === 'f_terms') { st[t.id.slice(2)] = t.checked; const c = $('#c_' + t.id.slice(2)); if (c) c.classList.remove('bad'); }
  });

  // ---------- שליחה ----------
  function fieldErr(id, msg) {
    const el = $('#' + id), er = $('#e_' + id); if (!el) return toast(msg);
    el.classList.add('bad'); if (er) er.textContent = msg;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus({ preventScroll: true }), 350);
  }
  function checkErr(k, msg) { const c = $('#c_' + k); if (c) { c.classList.add('bad'); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } toast(msg); }
  function banner(msg) { const el = $('#err'); if (!el) return toast(msg); el.innerHTML = `<div class="err" role="alert">${esc(msg)}</div>`; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  function validate() {
    const s = nextStep(); if (!s.send) { go(s); return false; }
    if (st.name.trim().length < 2) { fieldErr('f_n', 'נא למלא שם מלא'); return false; }
    const digits = st.phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 13) { fieldErr('f_p', 'נא למלא מספר טלפון תקין'); return false; }
    if ($('#f_policy') && !$('#f_policy').checked) { checkErr('policy', 'נא לאשר את מדיניות הביטולים'); return false; }
    if ($('#f_terms') && !$('#f_terms').checked) { checkErr('terms', 'נא לאשר את התנאים'); return false; }
    return true;
  }
  async function send() {
    if (sending || !validate()) return;
    const c = coupon(), ls = lines(), seen = {};
    const order = { v: 2, name: st.name.trim(), phone: st.phone.trim(), date: st.date, time: st.time, method: st.method, address: st.method === 'delivery' ? st.address.trim() : '',
      allergies: st.allergies.trim(), notes: st.notes.trim(), couponCode: c && c.ok ? c.code : '',
      items: ls.map(l => { const note = !seen[l.p.id] && notes[l.p.id] ? notes[l.p.id].trim() : ''; seen[l.p.id] = 1; return { id: l.p.id, qty: l.q, option: l.opt || '', note }; }) };
    const snap = { ls, fee: fee(), sub: subtotal() };
    if (preview) return done(order, { ok: true, ref: '1234', total: total(), due: dueFor(total()) }, snap);
    sending = true; $('#err').innerHTML = ''; drawBar();
    let res;
    try { res = (await rpc('form_submit', { p_slug: slug, p_order: order }))[0]; }
    catch (e) { sending = false; drawBar(); return banner('אין חיבור לאינטרנט כרגע. ההזמנה לא נשלחה — נסי שוב בעוד רגע.'); }
    sending = false;
    if (res && res.ok) {
      store.set('ag-customer', { name: order.name, phone: order.phone, address: order.address || saved.address || '' }); clearTimeout(draftT); store.del(DRAFT);
      return done(order, res, snap);
    }
    const msg = res && res.msg ? res.msg : 'משהו השתבש. נסי שוב';
    if (/^קוד ההנחה/.test(msg)) { st.coupon = ''; cpErr = msg; cpOpen = false; redraw(); toast(msg); $('#sum').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (/מלא|זמין להזמנה|סגור|אין איסוף/.test(msg)) { try { const n = await rpc('form_get', { p_slug: slug }); if (n) { cfg.load = n.load; cfg.blocked = n.blocked; cfg.days = n.days || cfg.days; cfg.capacity = n.capacity; } } catch (e) { } st.date = ''; st.time = ''; drawWhen(); redraw(); toast(msg); go({ go: '#s-when', pulse: '#dates' }); return; }
    drawBar(); banner(msg);
    if (/לא זמין. רענני/.test(msg)) setTimeout(() => location.reload(), 2500);
  }

  // ---------- מסך הסיום: תשלום, כתובת איסוף, וואטסאפ ----------
  const BIT_PKG = 'com.bnhp.payments.paymentsapp';
  function bitTarget() {
    const link = safeUrl(pay().bitLink), ua = navigator.userAgent || '';
    if (link) return { href: link, blank: true, direct: true };
    if (/Android/i.test(ua)) return { href: `intent://www.bitpay.co.il/app/#Intent;scheme=https;package=${BIT_PKG};S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=' + BIT_PKG)};end` };
    if (/iPhone|iPad|iPod/i.test(ua)) return { href: 'https://apps.apple.com/il/app/bit/id1182007739', blank: true };
    return null;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { }
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
  }
  function done(order, res, snap) {
    const d = parse(order.date), sum = +res.total, due = +res.due, off = Math.round((snap.sub + snap.fee - sum) * 100) / 100, first = esc(order.name.split(' ')[0]);
    const when = `יום ${DAYS[d.getDay()]} ${fmtD(order.date)}${order.time ? ' בשעה ' + order.time : ''}`;
    const text = `היי! שלחתי הזמנה #${res.ref} בטופס 🤎\n` + snap.ls.map(l => `• ${l.q} × ${l.p.name}${l.opt ? ' (' + l.opt + ')' : ''}`).join('\n') +
      `\n${when} · ${order.method === 'delivery' ? 'משלוח ל' + order.address : 'איסוף עצמי'}\nסה״כ: ${money(sum)}${due > 0 ? `\nלתשלום לאישור: ${money(due)}` : ''}\n${order.name}`;
    ['.bar', '#toast', '#cartDlg', '#imgDlg'].forEach(s => { const el = $(s); if (el) el.remove(); });
    const needPay = due > 0, bit = pay().bit ? String(pay().bit) : '', bitDigits = bit.replace(/\D/g, ''), pb = safeUrl(pay().paybox), bt = bitTarget();
    const bitHint = bt && bt.direct ? 'הכפתור פותח את ביט עם הפרטים שלי. נשאר רק לאשר את הסכום.' : bt ? 'הכפתור מעתיק את המספר שלי ופותח את ביט. שם: העברה ← הדבקת המספר ← הסכום.' : 'פתחי את ביט בטלפון והעבירי למספר הזה.';
    const payHtml = needPay ? `<div class="pay-step">
        <div class="due">${money(due)}</div>
        <p class="note">${pay().mode === 'full' ? 'תשלום מלא' : 'מקדמה'} לאישור ההזמנה, תוך ${pay().hours || 24} שעות. בהעברה כתבי: הזמנה #${esc(res.ref)}</p>
        ${bit ? `<div class="pay-opt"><div class="top"><div><b>ביט</b><div class="note" dir="ltr" style="text-align:right;margin:0">${esc(bit)}</div></div><button type="button" class="btn ghost sm" data-copy="${esc(bitDigits)}">העתקת המספר</button></div>
          <div class="pay-acts">${bt ? `<a class="btn" data-bit href="${esc(bt.href)}" ${bt.blank ? 'target="_blank" rel="noopener noreferrer"' : ''}>פתיחת ביט לתשלום ${money(due)}</a>` : ''}</div>
          <div class="note" id="bitHint">${bitHint}</div></div>` : ''}
        ${pb ? `<div class="pay-opt"><div class="top"><div><b>פייבוקס</b><div class="note" style="margin:0">תשלום בקישור</div></div><a class="btn ghost sm" href="${esc(pb)}" target="_blank" rel="noopener noreferrer">לתשלום בפייבוקס</a></div></div>` : ''}
        <div id="claimBox" style="margin-top:14px"><div class="note" style="margin-bottom:8px">אחרי שהעברת — לחצי כאן כדי שאדע:</div>
          <div class="addr-acts">${bit ? '<button type="button" class="btn soft" data-claim="ביט">שילמתי בביט ✓</button>' : ''}${pb ? '<button type="button" class="btn soft" data-claim="פייבוקס">שילמתי בפייבוקס ✓</button>' : ''}</div></div>
      </div>` : '';
    app.innerHTML = `${preview ? '<div class="preview-banner">תצוגה מקדימה — כך ייראה המסך אחרי שליחה (שום דבר לא נשלח)</div>' : ''}<div class="card done">
      <div class="ic" style="${needPay ? 'background:var(--sand);color:var(--brown)' : ''}">${needPay ? '₪' : '✓'}</div>
      <h1 style="margin-top:12px">${needPay ? `כמעט סיימנו, ${first}!` : `תודה ${first}! ההזמנה התקבלה`}</h1>
      <p class="note">${needPay ? `הזמנה <b>#${esc(res.ref)}</b> נקלטה ותאושר אחרי התשלום` : `מספר הזמנה <b>#${esc(res.ref)}</b>`} · ${when}</p>
      ${payHtml}
      <div class="sum">${snap.ls.map(l => `<div><span>${lineName(l)}</span><span>${money(l.q * l.p.price)}</span></div>`).join('')}
        ${snap.fee ? `<div><span>משלוח</span><span>${money(snap.fee)}</span></div>` : ''}${off > 0 ? `<div><span>קוד הנחה ${esc(order.couponCode)}</span><span style="color:var(--ok)">−${money(off)}</span></div>` : ''}<div><span>סה״כ</span><span>${money(sum)}</span></div></div>
      <div id="pickupAddr"></div>
      ${!needPay && cfg.payInfo ? `<p class="note">💳 ${esc(cfg.payInfo)}</p>` : ''}
      ${cfg.phone ? `<p class="note">${needPay ? 'שאלות? אפשר לשלוח לי הודעה:' : 'אחזור אלייך לאישור סופי. אפשר גם לשלוח לי הודעה:'}</p>` : (needPay ? '' : '<p class="note">אחזור אלייך לאישור סופי.</p>')}
      ${cfg.phone ? `<a class="btn wa" href="https://wa.me/${esc(cfg.phone)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">שליחת הודעה בוואטסאפ</a>` : ''}
      <div style="margin-top:12px"><button type="button" class="btn ghost" data-reload>הזמנה נוספת</button></div></div>`;
    scrollTo(0, 0);
    // כתובת האיסוף: מוצגת רק אחרי שליחה, עם העתקה ושיתוף בוואטסאפ (למי שאוספת בשבילך)
    const showAddr = a => {
      if (!a || !$('#pickupAddr')) return;
      const share = `📍 איסוף מ״${cfg.bizName || 'על הגשר'}״: ${a}\nהזמנה #${res.ref} · ${when}\nעל שם ${order.name}`;
      $('#pickupAddr').innerHTML = `<div class="addr">📍 איסוף מ: <b>${esc(a)}</b><div class="addr-acts">
        <button type="button" class="btn ghost sm" data-copy="${esc(a)}">העתקת הכתובת</button>
        <a class="btn wa sm" href="https://wa.me/?text=${encodeURIComponent(share)}" target="_blank" rel="noopener">שליחת הכתובת בוואטסאפ</a>
        <a class="btn ghost sm" href="https://waze.com/ul?q=${encodeURIComponent(a)}&navigate=yes" target="_blank" rel="noopener noreferrer">ניווט בוויז</a></div></div>`;
    };
    if (order.method === 'pickup') {
      if (preview) showAddr(cfg.pickupAddress);
      else if (cfg.hasPickupAddress) rpc('form_pickup', { p_slug: slug, p_ref: res.ref, p_phone: order.phone }).then(showAddr).catch(() => { });
    }
    app.onclick = async e => {
      const c = e.target.closest('[data-copy]');
      if (c) { const lbl = c.dataset.lbl || (c.dataset.lbl = c.textContent); c.textContent = (await copyText(c.dataset.copy)) ? 'הועתק ✓' : c.dataset.copy; setTimeout(() => { c.textContent = lbl; }, 2500); return; }
      // פתיחת ביט: מעתיקים את המספר (בלי לעצור את פתיחת האפליקציה) ומסבירים מה לעשות שם
      if (e.target.closest('[data-bit]')) { if (!bt.direct) { copyText(bitDigits); const h = $('#bitHint'); if (h) h.innerHTML = `<b>המספר הועתק ✓</b> בביט: העברה ← הדביקי את המספר ← ${money(due)} ← בהערה: הזמנה #${esc(res.ref)}`; } return; }
      const b = e.target.closest('[data-claim]'); if (!b) return;
      if (preview) { $('#claimBox').innerHTML = '<div class="paid-ok">✓ תודה! קיבלתי את העדכון. ההזמנה תאושר ברגע שאוודא שהתשלום נכנס.</div>'; return; }
      b.disabled = true; b.textContent = 'שולחת…';
      try {
        const ok = await rpc('form_paid_claim', { p_slug: slug, p_ref: res.ref, p_phone: order.phone, p_method: b.dataset.claim });
        $('#claimBox').innerHTML = ok ? '<div class="paid-ok">✓ תודה! קיבלתי את העדכון. ההזמנה תאושר ברגע שאוודא שהתשלום נכנס.</div>' : '<div class="err">לא הצלחתי לעדכן. שלחי לי הודעה בוואטסאפ.</div>';
      } catch (err) { b.disabled = false; b.textContent = 'שילמתי ב' + b.dataset.claim + ' ✓'; if (!$('#claimBox .err')) $('#claimBox').insertAdjacentHTML('beforeend', '<div class="err">אין חיבור — נסי שוב</div>'); }
    };
  }
  load();
})();
