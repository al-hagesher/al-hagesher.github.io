/* על הגשר — טופס הזמנות קבוע ללקוחות: ניהול, פרסום אוטומטי וקליטת הזמנות לאפליקציה */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const SB_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co';
  const SB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const F = A.form = { pubStatus: 'idle', pubError: '', lastPub: null };
  const fs = () => A.state.form;

  async function rpc(fn, body) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${fn}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json();
  }
  F.link = () => fs().slug ? `${A.PUBLIC_BASE}order.html?f=${fs().slug}` : '';

  /* ---------- בניית ההגדרות הציבוריות ---------- */
  const thumbs = {};
  const thumb = src => {
    if (!src) return Promise.resolve('');
    if (!src.startsWith('data:')) return Promise.resolve(new URL(src, A.PUBLIC_BASE).href); // תמונה קבועה מהאתר — קישור במקום העתקה
    const k = src.length + ':' + src.slice(-40);
    if (thumbs[k]) return Promise.resolve(thumbs[k]);
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 420 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(thumbs[k] = c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => res(''); img.src = src;
    });
  };
  F.productList = () => A.state.recipes.filter(r => { const p = fs().products[r.id]; return p && p.on; });
  F.customList = () => (fs().customProducts || []).filter(p => p.on !== false);
  F.priceOf = r => { const p = fs().products[r.id] || {}; return +p.price > 0 ? +p.price : +r.price || 0; };
  const KOSHER = { parve: 'פרווה', dairy: 'חלבי' };
  // הערות פנימיות מהמתכון לא אמורות להגיע ללקוחות
  const cleanDesc = s => String(s || '').replace(/\s*מתכון בניסוי[^.]*\.?/g, '').trim();
  // רשימה אחת של כל מה שיכול להופיע בטופס: מתכונים (r:) ומוצרים ידניים (c:), ממוינת לפי סדר הקטגוריות והמוצרים
  F.items = () => {
    const f = fs(), out = [];
    A.state.recipes.forEach(r => {
      const p = f.products[r.id] || {};
      if (A.isComponent && A.isComponent(r) && !p.on) return;
      out.push({ key: 'r:' + r.id, kind: 'r', id: r.id, r, p, on: !!p.on, name: (p.name || r.name || '').trim(), price: F.priceOf(r), cat: (p.cat || r.category || '').trim(),
        unit: p.unit === '-' ? '' : (p.unit || r.yieldUnit || '').trim(), desc: (p.desc || cleanDesc(r.description)).trim(), image: p.showImg === false ? '' : (r.image || ''), allergens: C.allergens(r) });
    });
    (f.customProducts || []).forEach(cp => out.push({ key: 'c:' + cp.id, kind: 'c', id: 'c-' + cp.id, p: cp, on: cp.on !== false, name: (cp.name || '').trim(), price: +cp.price || 0, cat: (cp.cat || '').trim(),
      unit: cp.unit === '-' ? '' : (cp.unit || '').trim(), desc: (cp.desc || '').trim(), image: cp.showImg === false ? '' : (cp.image || ''), allergens: cp.allergens || [] }));
    const co = f.catOrder || [], po = f.order || [];
    const ci = c => { const i = co.indexOf(c); return i < 0 ? 1e6 : i; }, oi = k => { const i = po.indexOf(k); return i < 0 ? 1e6 : i; };
    return out.sort((a, b) => ci(a.cat) - ci(b.cat) || a.cat.localeCompare(b.cat, 'he') || oi(a.key) - oi(b.key) || a.name.localeCompare(b.name, 'he'));
  };
  F.load = () => {
    const t = U.today(), load = {};
    A.state.orders.forEach(o => { if (o.status !== 'cancelled' && o.date >= t) load[o.date] = (load[o.date] || 0) + 1; });
    return load;
  };
  F.buildConfig = async () => {
    const f = fs(), s = A.state.settings, t = U.today();
    // כל המוצרים המוצגים (מתכונים + מוצרים ידניים), לפי הסדר שנקבע במסך הטופס
    const products = [];
    for (const it of F.items()) {
      if (!it.on || !(it.price > 0) || !it.name) continue;
      const p = it.p, prod = {
        id: it.id, name: it.name, desc: it.desc, price: it.price, unit: it.unit, cat: it.cat,
        img: it.image ? await thumb(it.image) : '', options: (p.options || []).filter(Boolean), maxQty: +p.maxQty || 20, allergens: it.allergens,
        kosher: KOSHER[p.kosher] ? p.kosher : '', badge: (p.badge || '').trim(), note: (p.note || '').trim()
      };
      if (it.kind === 'c') prod.custom = true;
      products.push(prod);
    }
    // קופונים ציבוריים (רק פעילים) — כולל דגל firstOrderOnly לצד הלקוחה. אין כאן מידע סודי: הקוד עצמו מחולק ללקוחות.
    const coupons = (A.state.coupons || []).filter(c => c.active !== false && (!c.to || c.to >= t)).map(c => ({
      code: c.code, type: c.type, value: +c.value || 0, minOrder: +c.minOrder || 0,
      from: c.from || '', to: c.to || '', maxUses: +c.maxUses || 0, uses: C.couponUses(c), firstOrderOnly: !!c.firstOrderOnly, oncePerCustomer: !!c.oncePerCustomer
    }));
    return {
      v: 2, bizName: s.businessName, phone: U.phoneIntl(s.phone), open: !!f.open, closedMsg: f.closedMsg, title: f.title, intro: f.intro,
      pickupAddress: f.pickupAddress, payInfo: f.payInfo, terms: f.terms, cancellationPolicy: s.cancellationPolicy || '', leadDays: +f.leadDays || 0, maxDaysAhead: +f.maxDaysAhead || 30,
      capacity: +f.capacity || 0, slotMinutes: +f.slotMinutes || 0, minOrder: +f.minOrder || 0,
      minItems: Math.max(0, Math.round(+f.minItems || 0)), minItemsWord: String(f.minItemsWord || '').trim().slice(0, 20),
      cutoffTime: /^\d{2}:\d{2}$/.test(f.cutoffTime || '') ? f.cutoffTime : '', daysNote: String(f.daysNote || '').trim().slice(0, 300),
      onlyDates: (f.onlyDates || []).filter(d => d >= t).sort(), blocked: f.blocked.filter(d => d >= t),
      pay: { mode: f.pay.mode, pct: +f.pay.pct || 50, bit: f.pay.bit || s.phone || '', bitLink: A.safeUrl(f.pay.bitLink), paybox: A.safeUrl(f.pay.paybox), hours: +f.pay.hours || 24 },
      days: f.days, delivery: { on: !!f.delivery.on, fee: +f.delivery.fee || 0, freeAbove: +f.delivery.freeAbove || 0, note: f.delivery.note || '' },
      products, coupons, load: F.load(), feedback: F.feedbackConfig()
    };
  };
  // טופס המשוב (feedback.html) קורא את ההגדרות האלה מאותו טופס
  F.feedbackConfig = () => {
    const b = fs().feedback || A.feedbackDefaults();
    return {
      on: !!b.on, title: String(b.title || '').slice(0, 80), intro: String(b.intro || '').slice(0, 400), thanks: String(b.thanks || '').slice(0, 300),
      reviewLink: A.safeUrl(b.reviewLink), photos: b.photos !== false,
      questions: (b.questions || []).filter(q => q && q.id && String(q.label || '').trim()).slice(0, 12)
        .map(q => ({ id: String(q.id).slice(0, 20), type: q.type === 'text' ? 'text' : 'rating', label: String(q.label).trim().slice(0, 120), required: !!q.required }))
    };
  };
  const canon = v => A.syncEq ? JSON.stringify(v) : JSON.stringify(v);
  let lastHash = (() => { try { return localStorage.getItem('al-hagesher-form-hash') || ''; } catch (e) { return ''; } })();
  F.publish = async (force) => {
    const f = fs(); if (!f.enabled || !f.slug || !f.key) return false;
    if (!navigator.onLine) { F.pubStatus = 'offline'; F.render(); return false; }
    try {
      const cfg = await F.buildConfig(), h = String(canon(cfg).length) + ':' + hash(canon(cfg));
      if (!force && h === lastHash) { F.pubStatus = 'ok'; F.render(); return true; }
      F.pubStatus = 'publishing'; F.render();
      await rpc('form_publish', { p_key: f.key, p_slug: f.slug, p_config: cfg });
      lastHash = h; try { localStorage.setItem('al-hagesher-form-hash', h); } catch (e) { }
      F.pubStatus = 'ok'; F.pubError = ''; F.lastPub = new Date();
    } catch (e) { console.warn(e); F.pubStatus = 'error'; F.pubError = e.message; }
    F.render();
    if (F.pubStatus === 'ok') publishMoved();
    return F.pubStatus === 'ok';
  };

  /* ---------- טפסים ישנים (קישור שהוחלף) ----------
     אם פעם נוצר טופס אחר (למשל בטלפון ובמחשב בנפרד), הקישור הישן ממשיך להיות אצל לקוחות.
     שומרים אותו, ממשיכים לקלוט ממנו הזמנות, ומפרסמים בו "עבר" — כך הדף מעביר את הלקוחה לטופס הנוכחי. */
  const KNOWN = 'al-hagesher-form-known';
  const olds = () => { const f = fs(); return (f.oldForms || []).filter(o => o && o.slug && o.key && o.slug !== f.slug); };
  F.olds = olds;
  F.rememberForms = () => {
    const f = fs(); if (!f.slug || !f.key) return;
    let known = []; try { known = JSON.parse(localStorage.getItem(KNOWN) || '[]') || []; } catch (e) { }
    let changed = false;
    known.forEach(k => { if (k && k.slug && k.key && k.slug !== f.slug && !f.oldForms.some(o => o.slug === k.slug)) { f.oldForms.push({ slug: k.slug, key: k.key }); changed = true; } });
    if (!known.some(k => k && k.slug === f.slug)) known.push({ slug: f.slug, key: f.key });
    try { localStorage.setItem(KNOWN, JSON.stringify(known.slice(-12))); } catch (e) { }
    if (changed) A.save();
  };
  let movingNow = false;
  async function publishMoved() {
    const f = fs(); if (movingNow || !f.slug) return; movingNow = true;
    try {
      for (const o of olds()) {
        const mark = 'al-hagesher-moved-' + o.slug;
        try { if (localStorage.getItem(mark) === f.slug) continue; } catch (e) { }
        try {
          await rpc('form_publish', { p_key: o.key, p_slug: o.slug, p_config: {
            v: 2, moved: f.slug, open: false, title: f.title, bizName: A.state.settings.businessName, products: [],
            // דף ישן שעוד לא מכיר את ההעברה יציג את ההודעה הזו
            closedMsg: `הטופס עבר לקישור חדש: ${F.link()}`
          } });
          try { localStorage.setItem(mark, f.slug); } catch (e) { }
        } catch (e) { console.warn('form moved', o.slug, e.message); }
      }
    } finally { movingNow = false; }
  }
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const schedulePublish = U.debounce(() => F.publish(), 2500);
  A.saveHooks.push(() => { if (fs().enabled) schedulePublish(); });

  /* ---------- קליטת הזמנות מהטופס ---------- */
  let polling = false;
  F.poll = async () => {
    const f = fs(); if (!f.enabled || !f.key || polling || !navigator.onLine) return 0;
    polling = true;
    try {
      F.rememberForms();
      let n = 0;
      for (const src of [{ slug: f.slug, key: f.key }, ...olds()]) n += await pollOne(src);
      return n;
    } finally { polling = false; }
  };
  async function pollOne(src) {
    try {
      const rows = await rpc('form_inbox', { p_key: src.key, p_slug: src.slug });
      if (!rows.length) return 0;
      const added = [], claims = [];
      rows.forEach(row => {
        const id = 'form-' + row.id;
        const existing = A.state.orders.find(o => o.id === id);
        const claim = row.paid_claim ? { method: row.paid_claim.method || '', at: row.paid_claim.at } : null;
        if (existing) { if (claim && (!existing.payClaim || existing.payClaim.at !== claim.at)) { existing.payClaim = claim; claims.push(existing); } return; }
        if (!row.is_new) return;
        const p = row.payload;
        const itemNotes = p.items.filter(i => i.note).map(i => `${i.name}: ${i.note}`);
        const items = p.items.map(i => ({ recipeId: C.recipe(i.id) ? i.id : null, name: i.name + (i.option ? ` (${i.option})` : ''), qty: +i.qty, unitPrice: +i.price }));
        // קופון: השרת כבר אימת והבטיח ללקוחה את ההנחה — מכבדים את הסכום שלו. אם הרישום המקומי חושב אחרת, רק מסמנים הערה.
        let couponCode = '', couponDiscount = 0;
        if (p.couponCode && +p.couponDiscount > 0) {
          const subtotal = items.reduce((s, i) => s + (+i.qty || 0) * (+i.unitPrice || 0), 0);
          const res = C.validateCoupon(p.couponCode, subtotal, (row.created_at || '').slice(0, 10) || U.today(), p.phone);
          couponCode = p.couponCode; couponDiscount = +p.couponDiscount;
          if (!res.ok) itemNotes.push(`⚠ קופון ${p.couponCode} הוחל בטופס (${U.money(couponDiscount)}), אבל לפי הרישום שלך: ${res.reason}`);
        }
        const o = {
          id, num: A.state.settings.nextOrderNum++, formRef: 1000 + row.id, customerName: p.name, phone: p.phone, date: p.date, time: p.time || '',
          method: p.method, address: p.address || '', deliveryFee: +p.deliveryFee || 0, discount: 0, couponCode, couponDiscount, paid: 0, payMethod: '',
          items,
          source: 'טופס הזמנה', notes: [p.notes, ...itemNotes].filter(Boolean).join(' · '), allergies: p.allergies || '', status: 'new',
          // התאריך המקומי (ישראל) — בלי זה הזמנה שנשלחה אחרי חצות נרשמה ביום הקודם
          createdAt: row.created_at && !isNaN(new Date(row.created_at)) ? U.iso(new Date(row.created_at)) : U.today(), createdTs: row.created_at || '',
          payMode: p.payMode || 'none', payDue: +p.amountDue || 0, payClaim: claim
        };
        A.state.orders.push(o); added.push(o);
      });
      if (added.length || claims.length) { await A.saveNow(); }
      await rpc('form_ack', { p_key: src.key, p_slug: src.slug, p_ids: rows.map(r => r.id), p_before: rows[0].fetched_at });
      if (added.length) notify(added);
      if (claims.length) notify(claims, true);
      return added.length;
    } catch (e) { console.warn('form poll', src.slug, e); return 0; }
  }
  function notify(orders, claim) {
    const o = orders[0];
    const msg = claim ? `${o.customerName} דיווחה ששילמה ב${o.payClaim.method || 'העברה'} — בדקי ואשרי את ההזמנה`
      : orders.length === 1 ? `הזמנה חדשה מ${o.customerName} ל${U.relDay(o.date)} · ${U.money(C.orderTotals(o).total)}` : `${orders.length} הזמנות חדשות מהטופס`;
    A.toast('🛎️ ' + msg);
    try { const ctx = new (root.AudioContext || root.webkitAudioContext)(); [0, .18].forEach((t, i) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.value = i ? 1046 : 784; os.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .35); os.start(ctx.currentTime + t); os.stop(ctx.currentTime + t + .4); }); } catch (e) { }
    try { if (root.Notification && Notification.permission === 'granted') new Notification('על הגשר', { body: msg, icon: 'assets/icon.png' }); } catch (e) { }
    if (!document.getElementById('modal').open) A.refresh();
  }
  F.init = () => {
    setTimeout(() => { if (fs().enabled) { F.publish(); F.poll(); } }, 1200);
    setInterval(() => { if (fs().enabled && document.visibilityState === 'visible') F.poll(); }, 25000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && fs().enabled) F.poll(); });
  };
  const newSlug = () => { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; const b = new Uint8Array(10); crypto.getRandomValues(b); return Array.from(b, x => a[x % a.length]).join(''); };
  const newKey = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); let s = ''; b.forEach(c => s += String.fromCharCode(c)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  F.create = async () => {
    const f = fs();
    if (!f.slug) { f.slug = newSlug(); f.key = newKey(); }
    if (!f.pickupAddress) f.pickupAddress = A.state.settings.address || '';
    // ברירת מחדל: כל המתכונים עם מחיר מופיעים בטופס
    A.state.recipes.forEach(r => { if (!f.products[r.id] && r.price > 0) f.products[r.id] = { on: true }; });
    f.enabled = true; A.save();
    const ok = await F.publish(true);
    if (!ok) { f.enabled = false; A.save(); }
    return ok;
  };

  /* ---------- דף ניהול הטופס ---------- */
  const STATUS = { idle: '', publishing: 'מפרסמת שינויים…', ok: 'הטופס מעודכן באוויר', error: 'שגיאה בפרסום', offline: 'אין אינטרנט — יפורסם כשיחזור' };
  F.render = () => {
    document.querySelectorAll('[data-form-status]').forEach(el => {
      el.classList.remove('ok', 'warn', 'bad'); el.classList.add('sync-pill', F.pubStatus === 'error' ? 'bad' : F.pubStatus === 'ok' ? 'ok' : 'warn');
      el.innerHTML = `${A.icon(F.pubStatus === 'ok' ? 'check' : 'cloud')}<span>${STATUS[F.pubStatus] || ''}</span>`; el.title = F.pubError || '';
    });
  };
  const inp = (path, val, attrs = '') => `<input data-p="${path}" value="${U.esc(val ?? '')}" ${attrs}>`;
  const splitList = v => String(v || '').split(/[,،]/).map(x => x.trim()).filter(Boolean);
  const TABS = [['products', 'מוצרים'], ['days', 'ימים ושעות'], ['pay', 'משלוח ותשלום'], ['texts', 'טקסטים ומדיניות']];
  const ui = { tab: 'products', q: '', filter: 'all', sel: new Set() };
  const kzBadge = k => KOSHER[k] ? `<span class="kz ${k}">${KOSHER[k]}</span>` : '';

  // מה חסר כדי שהטופס יהיה שלם ומקצועי מול הלקוחות
  F.checks = () => {
    const f = fs(), s = A.state.settings, shown = F.items().filter(i => i.on), out = [];
    const add = (level, text, tab, href) => out.push({ level, text, tab, href });
    const names = l => l.slice(0, 3).map(i => i.name).join(', ') + (l.length > 3 ? '…' : '');
    if (!f.open) add('warn', 'הטופס סגור כרגע — הלקוחות רואות הודעת "סגור"');
    if (!s.phone) add('bad', 'חסר מספר הוואטסאפ של העסק — בלי זה הלקוחה לא יכולה לשלוח לך אישור', '', '#/settings');
    const only = (f.onlyDates || []).filter(d => d >= U.today());
    if (!only.length && !Object.values(f.days).some(d => d.on)) add('bad', 'לא נבחר אף יום איסוף', 'days');    const ok = shown.filter(i => i.price > 0), noPrice = shown.filter(i => !(i.price > 0));
    if (!ok.length) add('bad', 'אין אף מוצר מוצג עם מחיר', 'products');
    if (noPrice.length) add('warn', `${noPrice.length} מוצרים מסומנים להצגה אבל בלי מחיר, ולכן לא מופיעים: ${names(noPrice)}`, 'products');
    if (f.pay.mode !== 'none' && !(f.pay.bit || s.phone || f.pay.bitLink || f.pay.paybox)) add('bad', 'נדרש תשלום מראש, אבל אין מספר ביט או קישור תשלום', 'pay');
    if (!f.pickupAddress) add('warn', 'חסרה כתובת לאיסוף — הלקוחה לא תדע לאן להגיע', 'texts');
    const noKz = ok.filter(i => !KOSHER[i.p.kosher]);
    if (noKz.length) add('info', `ב־${noKz.length} מוצרים לא סומן פרווה / חלבי: ${names(noKz)}`, 'products');
    const noImg = ok.filter(i => !i.image);
    if (noImg.length) add('info', `${noImg.length} מוצרים בלי תמונה: ${names(noImg)}`, 'products');
    return out;
  };
  const checksHtml = () => {
    const list = F.checks();
    if (!list.length) return `<div class="fp-ready ok">${A.icon('check')}<b>הטופס שלם ומוכן ללקוחות</b></div>`;
    return `<div class="fp-ready"><b>מה כדאי להשלים</b><ul>${list.map(c => `<li class="${c.level}"><span>${U.esc(c.text)}</span>${c.tab ? `<button class="fp-link" data-tab="${c.tab}">לתיקון</button>` : c.href ? `<a class="fp-link" href="${c.href}">להגדרות</a>` : ''}</li>`).join('')}</ul></div>`;
  };

  /* --- לשונית מוצרים --- */
  const prodRow = (it, canMove) => {
    const p = it.p, bits = [it.price > 0 ? `<b>${U.money(it.price)}</b>` : '<span class="bad">חסר מחיר</span>'];
    if (it.unit) bits.push(U.esc(it.unit));
    if ((p.options || []).length) bits.push(`${p.options.length} סוגים`);
    if (p.badge) bits.push(`תווית: ${U.esc(p.badge)}`);
    if (!it.image) bits.push('בלי תמונה');
    if (it.kind === 'c') bits.push('מוצר ידני');
    return `<div class="fp-row ${it.on ? '' : 'off'}" data-key="${U.esc(it.key)}">
      <input type="checkbox" data-sel ${ui.sel.has(it.key) ? 'checked' : ''} aria-label="בחירת ${U.esc(it.name)}">
      <div class="fp-thumb">${it.image ? `<img src="${A.safeImg(it.image)}" alt="" loading="lazy">` : A.icon('image')}</div>
      <button class="fp-main" data-edit><span class="fp-name">${U.esc(it.name || 'ללא שם')}${kzBadge(p.kosher)}</span><span class="fp-sub">${bits.join(' · ')}</span></button>
      ${canMove ? `<div class="fp-move"><button data-move="-1" aria-label="הזזה למעלה">▲</button><button data-move="1" aria-label="הזזה למטה">▼</button></div>` : ''}
      <label class="switch" title="מוצג בטופס"><input type="checkbox" data-on ${it.on ? 'checked' : ''} aria-label="מוצג בטופס"><i></i></label>
    </div>`;
  };
  const visibleItems = () => {
    const q = ui.q.trim().toLowerCase();
    return F.items().filter(i => (ui.filter === 'all' || (ui.filter === 'on') === i.on) && (!q || (i.name + ' ' + i.cat).toLowerCase().includes(q)));
  };
  const listHtml = () => {
    const list = visibleItems(), canMove = !ui.q.trim() && ui.filter === 'all', groups = [];
    list.forEach(i => { const g = groups[groups.length - 1]; if (g && g.cat === i.cat) g.items.push(i); else groups.push({ cat: i.cat, items: [i] }); });
    const keys = new Set(list.map(i => i.key)); [...ui.sel].forEach(k => { if (!keys.has(k)) ui.sel.delete(k); });
    if (!list.length) return `<p class="muted" style="margin:14px 0 0">${F.items().length ? 'לא נמצאו מוצרים מתאימים.' : 'עוד אין מוצרים. מתכונים עם מחיר מופיעים כאן אוטומטית, ואפשר גם להוסיף מוצר חדש בכפתור למעלה.'}</p>`;
    const n = ui.sel.size;
    const bulk = n ? `<div class="fp-bulk"><b>${n} נבחרו</b>
        <button class="btn sm soft" data-bulk="show">הצגה</button><button class="btn sm soft" data-bulk="hide">הסתרה</button>
        <button class="btn sm soft" data-bulk="parve">סימון פרווה</button><button class="btn sm soft" data-bulk="dairy">סימון חלבי</button>
        <button class="btn sm danger" data-bulk="del">מחיקה</button><button class="btn sm ghost" data-bulk="clear">ביטול</button></div>`
      : `<div class="fp-bulk none"><button class="fp-link" data-bulk="all">בחירת כל ${list.length} המוצרים</button><span class="small muted">לסימון פרווה / חלבי או הצגה / הסתרה בבת אחת</span></div>`;
    return (n ? '' : bulk) + groups.map(g => `<div class="fp-cat"><b>${U.esc(g.cat || 'ללא קטגוריה')}</b><span class="small muted">${g.items.length}</span>
        ${canMove && groups.length > 1 ? `<span class="fp-move"><button data-catmove="-1" data-cat="${U.esc(g.cat)}" aria-label="הזזת הקטגוריה למעלה">▲</button><button data-catmove="1" data-cat="${U.esc(g.cat)}" aria-label="הזזת הקטגוריה למטה">▼</button></span>` : ''}</div>
      ${g.items.map(i => prodRow(i, canMove)).join('')}`).join('') + (n ? bulk : '');
  };
  const productsHtml = () => {
    const all = F.items(), onN = all.filter(i => i.on && i.price > 0).length;
    return `<div class="card"><div class="card-h"><h3>${A.icon('book')}המוצרים בטופס</h3><span class="small muted">${onN} מוצגים מתוך ${all.length}</span></div>
      <div class="fp-tools">
        <input type="search" data-q value="${U.esc(ui.q)}" placeholder="חיפוש מוצר…" aria-label="חיפוש מוצר">
        <div class="seg">${[['all', 'הכל'], ['on', 'מוצגים'], ['off', 'מוסתרים']].map(([k, l]) => `<button data-filter="${k}" class="${ui.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <button class="btn sm" data-act="cpAdd">${A.icon('plus')}מוצר חדש</button>
      </div>
      <div id="fpList">${listHtml()}</div>
      <p class="small muted" style="margin:12px 0 0">לחיצה על מוצר פותחת עריכה: שם, מחיר, <b>פרווה / חלבי</b>, תיאור, טעמים, תווית ועוד. החיצים קובעים את הסדר שבו הלקוחות רואות את התפריט. מחיר, תמונה ואלרגנים של מתכון מגיעים מהמתכון עצמו.</p>
    </div>`;
  };

  /* --- שאר הלשוניות --- */
  const daysHtml = () => {
    const f = fs();
    return `<div class="card"><div class="card-h"><h3>${A.icon('calendar')}ימים ושעות איסוף</h3></div>
      ${U.DAYS.map((d, i) => { const dd = f.days[i]; return `<div class="day-row">
        <label class="row" style="gap:8px;width:92px;flex:none"><input type="checkbox" data-p="days.${i}.on" ${dd.on ? 'checked' : ''}><b>${d}</b></label>
        <input type="time" data-p="days.${i}.from" value="${dd.from}" ${dd.on ? '' : 'disabled'} aria-label="משעה"><span class="muted">עד</span>
        <input type="time" data-p="days.${i}.to" value="${dd.to}" ${dd.on ? '' : 'disabled'} aria-label="עד שעה"></div>`; }).join('')}
      <div class="form-grid c4" style="margin-top:14px">
        <label class="field"><span>בחירת שעה</span><select data-p="slotMinutes" data-num="1">${A.opts([[0, 'בלי בחירת שעה'], [15, 'כל רבע שעה'], [30, 'כל חצי שעה'], [60, 'כל שעה'], [120, 'כל שעתיים']], f.slotMinutes)}</select></label>
        <label class="field"><span>כמה ימים מראש לפחות</span><input type="number" min="0" max="30" data-p="leadDays" data-num="1" value="${f.leadDays}"><small>0 = אפשר להזמין להיום</small></label>
        <label class="field"><span>שעת סגירת ההזמנות</span><input type="time" data-p="cutoffTime" value="${U.esc(f.cutoffTime || '')}"><small>${f.cutoffTime ? `ההזמנות לכל יום נסגרות ${+f.leadDays === 0 ? 'באותו יום' : +f.leadDays === 1 ? 'יום לפני' : f.leadDays + ' ימים לפני'} ב־${U.esc(f.cutoffTime)}${+f.leadDays === 1 && f.days[5] && f.days[5].on ? ' (לשישי — עד חמישי ב־' + U.esc(f.cutoffTime) + ')' : ''}` : 'ריק = אפשר להזמין עד סוף היום'}</small></label>
        <label class="field"><span>עד כמה ימים קדימה</span><input type="number" min="1" max="180" data-p="maxDaysAhead" data-num="1" value="${f.maxDaysAhead}"></label>
        <label class="field"><span>מקסימום הזמנות ליום</span><input type="number" min="0" data-p="capacity" data-num="1" value="${f.capacity}"><small>0 = ללא הגבלה. נספרות גם הזמנות שהזנת ידנית</small></label>
      </div>
      <label class="field" style="margin-top:14px"><span>מתי אפשר להזמין — הודעה שמופיעה מודגשת בראש הטופס</span><textarea data-p="daysNote" rows="2" maxlength="300" placeholder="למשל: הזמנות לשישי בלבד · איסוף בין 10:00 ל־13:00 · ההזמנות נסגרות בחמישי ב־18:00">${U.esc(f.daysNote || '')}</textarea><small>לא חובה. אם ריק — לא מוצג</small></label>
      <div class="field" style="margin-top:14px"><span>רק בתאריכים מסוימים (לא חובה)</span>
        <div class="row"><input type="date" id="openDate" min="${U.today()}" style="width:auto" aria-label="תאריך פתוח להזמנה"><button class="btn sm ghost" data-act="openDate">${A.icon('plus')}הוספה</button></div>
        <div class="row" style="margin-top:6px">${(f.onlyDates || []).filter(d => d >= U.today()).sort().map(d => `<span class="chip">${U.dayName(d)} ${U.fmtDate(d)} <button class="icon-btn" data-unopen="${d}" style="padding:0" aria-label="הסרה">${A.icon('x', 'inl')}</button></span>`).join('') || '<span class="small muted">לא נבחרו — אפשר להזמין לכל הימים המסומנים למעלה</span>'}</div>
        ${(f.onlyDates || []).some(d => d >= U.today()) ? '<small>כשיש כאן תאריכים — הלקוחות יכולות להזמין <b>רק</b> אליהם (השעות לפי היום בשבוע שלמעלה)</small>' : '<small>למשל לחנוכה: מוסיפים את התאריכים שבהם יש סופגניות, ורק הם יופיעו בטופס</small>'}</div>
      <div class="field" style="margin-top:14px"><span>תאריכים סגורים (חגים, חופשה)</span>
        <div class="row"><input type="date" id="blockDate" min="${U.today()}" style="width:auto" aria-label="תאריך לסגירה"><button class="btn sm ghost" data-act="block">${A.icon('plus')}הוספה</button></div>
        <div class="row" style="margin-top:6px">${f.blocked.filter(d => d >= U.today()).sort().map(d => `<span class="chip">${U.dayName(d)} ${U.fmtDate(d)} <button class="icon-btn" data-unblock="${d}" style="padding:0" aria-label="הסרה">${A.icon('x', 'inl')}</button></span>`).join('') || '<span class="small muted">אין</span>'}</div></div>
    </div>`;
  };
  const payHtml = () => {
    const f = fs(), s = A.state.settings, dis = f.delivery.on ? '' : 'disabled';
    return `<div class="card section"><div class="card-h"><h3>${A.icon('truck')}משלוחים ומינימום</h3></div>
        <div class="form-grid c4">
          <div class="field"><span>&nbsp;</span><label class="row" style="gap:8px;min-height:40px"><input type="checkbox" data-p="delivery.on" ${f.delivery.on ? 'checked' : ''}> יש משלוחים</label></div>
          <label class="field"><span>דמי משלוח (₪)</span><input type="number" min="0" data-p="delivery.fee" data-num="1" value="${f.delivery.fee}" ${dis}></label>
          <label class="field"><span>משלוח חינם מעל (₪)</span><input type="number" min="0" data-p="delivery.freeAbove" data-num="1" value="${f.delivery.freeAbove}" ${dis}><small>0 = אין</small></label>
          <label class="field"><span>מינימום הזמנה (₪)</span><input type="number" min="0" data-p="minOrder" data-num="1" value="${f.minOrder}"></label>
          <label class="field"><span>מינימום יחידות בהזמנה</span><input type="number" min="0" max="500" data-p="minItems" data-num="1" value="${+f.minItems || 0}"><small>למשל 4 — הזמנה עם פחות לא תתקבל. 0 = בלי מינימום</small></label>
          <label class="field"><span>איך לקרוא ליחידות</span>${inp('minItemsWord', f.minItemsWord, 'maxlength="20" placeholder="סופגניות"')}<small>מופיע ללקוחה: "מינימום ${+f.minItems || 4} ${U.esc(f.minItemsWord || 'סופגניות')}"</small></label>
          <label class="field full"><span>אזורי משלוח / הערה</span>${inp('delivery.note', f.delivery.note, `placeholder="למשל: משלוחים בתוך העיר בלבד" ${dis}`)}</label>
        </div></div>
      <div class="card"><div class="card-h"><h3>${A.icon('wallet')}תשלום לאישור ההזמנה</h3></div>
        <div class="form-grid c4">
          <label class="field"><span>מה נדרש כדי לאשר</span><select data-p="pay.mode">${A.opts([['deposit', 'מקדמה'], ['full', 'תשלום מלא'], ['none', 'בלי תשלום מראש']], f.pay.mode)}</select></label>
          ${f.pay.mode === 'deposit' ? `<label class="field"><span>גובה המקדמה (%)</span><input type="number" min="10" max="100" step="5" data-p="pay.pct" data-num="1" value="${f.pay.pct}"></label>` : ''}
          ${f.pay.mode !== 'none' ? `<label class="field"><span>תוך כמה שעות לשלם</span><input type="number" min="1" max="168" data-p="pay.hours" data-num="1" value="${f.pay.hours}"></label>
          <label class="field"><span>מספר לביט</span><input type="tel" data-p="pay.bit" value="${U.esc(f.pay.bit || '')}" placeholder="${U.esc(s.phone || '050-0000000')}"></label>
          <label class="field full"><span>קישור תשלום אישי בביט (מומלץ)</span><input type="url" dir="ltr" data-p="pay.bitLink" value="${U.esc(f.pay.bitLink || '')}" placeholder="https://…"><small>אם יש לך קישור תשלום מאפליקציית ביט — הדביקי אותו כאן, והכפתור "פתיחת ביט" בטופס יוביל ישר אלייך. בלי קישור: הכפתור פותח את אפליקציית ביט בטלפון של הלקוחה, והמספר שלך מועתק לה אוטומטית להדבקה.</small></label>
          <label class="field full"><span>קישור לתשלום בפייבוקס</span><input type="url" dir="ltr" data-p="pay.paybox" value="${U.esc(f.pay.paybox || '')}" placeholder="https://payboxapp.page.link/…"><small>יוצרים באפליקציית פייבוקס: "בקשת תשלום" ← "שיתוף קישור". אם ריק — יוצג רק ביט.</small></label>` : ''}
        </div>
        <p class="small muted" style="margin:10px 0 0">${f.pay.mode === 'none' ? 'ההזמנות ייכנסו בלי דרישת תשלום.' : 'אחרי שליחת ההזמנה הלקוחה רואה את הסכום לתשלום וכפתורי ביט / פייבוקס, ולוחצת "שילמתי". ההזמנה נשארת "ממתינה לתשלום" עד שאת בודקת שהכסף נכנס ומאשרת — ואז נשלח לה אישור.'}</p>
      </div>`;
  };
  const textsHtml = () => {
    const f = fs(), s = A.state.settings, td = U.today(), nCp = (A.state.coupons || []).filter(c => c.active !== false && (!c.to || c.to >= td) && !(+c.maxUses && C.couponUses(c) >= +c.maxUses)).length;
    return `<div class="card section"><div class="card-h"><h3>מה הלקוחות רואות</h3></div>
        <div class="form-grid">
          <label class="field full"><span>כותרת</span>${inp('title', f.title)}</label>
          <label class="field full"><span>פתיח</span><textarea data-p="intro" rows="2">${U.esc(f.intro)}</textarea></label>
          <label class="field full"><span>כתובת לאיסוף</span>${inp('pickupAddress', f.pickupAddress, 'placeholder="רחוב ומספר, עיר"')}<small>מוצגת ללקוחה רק אחרי ששלחה הזמנה — עם כפתורי העתקה, שליחה בוואטסאפ וניווט בוויז</small></label>
          <label class="field full"><span>פרטי תשלום</span>${inp('payInfo', f.payInfo)}</label>
          <label class="field full"><span>תנאים / הערות חשובות (לא חובה)</span><textarea data-p="terms" rows="2" placeholder="למשל: המאפים נאפים במטבח ביתי שאינו נקי מאגוזים.">${U.esc(f.terms)}</textarea><small>אם מולא — הלקוחה מסמנת שקראה לפני שליחה</small></label>
        </div></div>
      <div class="card section"><div class="card-h"><h3>מדיניות ביטולים</h3></div>
        <label class="field"><span class="sr-only">מדיניות ביטולים</span><textarea data-policy rows="9">${U.esc(s.cancellationPolicy || '')}</textarea><small>מוצגת בטופס לפני השליחה, והלקוחה מאשרת שקראה. אותו טקסט משמש גם בהגדרות ובאישורי ההזמנה.</small></label></div>
      <div class="card"><div class="card-h"><h3>${A.icon('tag')}קודי הנחה</h3><a class="btn sm ghost" href="#/coupons">ניהול קופונים</a></div>
        <p class="small muted" style="margin:0">${nCp ? `${nCp} קופונים פעילים. ` : 'אין קופונים פעילים. '}לקוחה שמזינה קוד רואה את ההנחה מיד, והקוד נבדק שוב בשרת בזמן השליחה — כך שההנחה שהיא רואה היא ההנחה שנרשמת אצלך.</p></div>`;
  };
  const tabHtml = () => ({ products: productsHtml, days: daysHtml, pay: payHtml, texts: textsHtml }[ui.tab] || productsHtml)();
  const topHtml = link => {
    const f = fs(), fromForm = A.state.orders.filter(o => o.source === 'טופס הזמנה').length;
    const shareText = `${f.title || 'הזמנות'} 🤎\nלהזמנה: ${link}`;
    return `<div class="card section cables">
      <div class="card-h"><h3>${A.icon('link')}הקישור הקבוע שלך</h3><span data-form-status class="sync-pill"></span></div>
      <div class="fp-top">
        <div class="stack">
          <input readonly dir="ltr" value="${U.esc(link)}" data-selectall aria-label="הקישור לטופס">
          <div class="row"><button class="btn sm" data-act="preview">${A.icon('search')}תצוגה מקדימה</button>
            <button class="btn sm soft" data-act="copy">${A.icon('copy')}העתקת הקישור</button>
            <a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText)}">${A.icon('msg')}שיתוף בוואטסאפ</a>
            <button class="btn sm ghost" data-act="publish">פרסום עכשיו</button></div>
          <div class="row" style="margin-top:4px;gap:14px">
            <label class="switch-row"><span class="switch"><input type="checkbox" data-p="open" ${f.open ? 'checked' : ''}><i></i></span><b>${f.open ? 'הטופס פתוח להזמנות' : 'הטופס סגור'}</b></label>
            ${root.Notification && Notification.permission !== 'granted' ? `<button class="btn sm soft" data-act="notif">${A.icon('bell')}הפעלת התראות על הזמנה חדשה</button>` : ''}
          </div>
          ${!f.open ? `<label class="field"><span>הודעה כשהטופס סגור</span>${inp('closedMsg', f.closedMsg)}</label>` : ''}
          <p class="small muted" style="margin:0">${fromForm} הזמנות התקבלו מהטופס עד היום. הקישור לא משתנה לעולם — כל שינוי כאן מתעדכן בו תוך שניות.</p>
        </div>
        <div class="fp-qr"><div class="qr" id="formQr"></div><div class="small muted" style="margin-top:6px">QR לכרטיס ביקור או לאריזה</div></div>
      </div>
      <div id="fpChecks">${checksHtml()}</div>
    </div>`;
  };

  /* --- עריכת מוצר (מתכון או מוצר ידני) --- */
  function openEdit(key) {
    const f = fs(), it = key ? F.items().find(i => i.key === key) : null;
    if (key && !it) return;
    const isR = !!it && it.kind === 'r', r = isR ? it.r : null;
    const p = it ? (isR ? (f.products[it.id] || {}) : it.p) : { on: true };
    let kz = KOSHER[p.kosher] ? p.kosher : '', image = isR ? (r.image || '') : (p.image || '');
    const cats = [...new Set(F.items().map(i => i.cat).filter(Boolean))];
    const e = U.esc, kzSeg = () => [['', 'לא מצוין'], ['parve', 'פרווה'], ['dairy', 'חלבי']].map(([k, l]) => `<button type="button" data-k="${k}" class="${kz === k ? 'on ' + k : ''}">${l}</button>`).join('');
    const imgHtml = () => isR
      ? (image ? `<img src="${A.safeImg(image)}" alt=""><label class="row" style="gap:8px"><input type="checkbox" name="showImg" ${p.showImg === false ? '' : 'checked'}> להציג את התמונה מהמתכון</label>`
        : '<span class="small muted">למתכון הזה אין תמונה. מוסיפים אותה במסך המתכונים — ומוצר עם תמונה נמכר הרבה יותר טוב.</span>')
      : (image ? `<img src="${A.safeImg(image)}" alt=""><button type="button" class="btn sm ghost" data-rmimg>${A.icon('x')}הסרת התמונה</button>`
        : `<label class="btn sm soft" style="cursor:pointer">${A.icon('image')}העלאת תמונה<input type="file" accept="image/*" data-img hidden></label>`);
    A.modal({
      title: it ? `עריכת מוצר · ${e(it.name || '')}` : 'מוצר חדש לטופס', size: 'wide',
      body: `<div class="form-grid">
        <label class="field full"><span>שם המוצר בטופס</span><input name="name" maxlength="60" value="${e(p.name || '')}" placeholder="${isR ? e(r.name) : 'למשל: מארז 6 סופגניות'}" ${it ? '' : 'autofocus'}></label>
        <label class="field"><span>מחיר (₪)</span><input name="price" type="number" min="0" step="0.5" inputmode="decimal" value="${p.price || ''}" placeholder="${isR ? e(r.price || '') : ''}">${isR ? '<small>ריק = המחיר מהמתכון</small>' : ''}</label>
        <label class="field"><span>יחידה</span><input name="unit" maxlength="20" value="${e(p.unit || '')}" placeholder="${isR ? e(r.yieldUnit || '') : 'יחידה / מארז'}">${isR ? '<small>ריק = מהמתכון · מקף (-) = לא להציג</small>' : ''}</label>
        <div class="field full"><span>פרווה או חלבי? — מופיע מודגש ליד שם המוצר</span><div class="seg kz-seg" data-kz>${kzSeg()}</div></div>
        <label class="field full"><span>תיאור קצר</span><textarea name="desc" rows="2" maxlength="300" placeholder="${isR ? e(cleanDesc(r.description).slice(0, 80)) : 'מה יש בפנים, כמה יחידות, למה זה שווה'}">${e(p.desc || '')}</textarea></label>
        <label class="field"><span>קטגוריה בתפריט</span><input name="cat" maxlength="30" list="fpCats" value="${e(p.cat || '')}" placeholder="${isR ? e(r.category || '') : 'למשל: סופגניות'}"><datalist id="fpCats">${cats.map(c => `<option value="${e(c)}">`).join('')}</datalist></label>
        <label class="field"><span>תווית מודגשת (לא חובה)</span><input name="badge" maxlength="18" value="${e(p.badge || '')}" placeholder="חדש · הכי נמכר · מהדורה מוגבלת"></label>
        <label class="field full"><span>טעמים / סוגים לבחירה (מופרדים בפסיק)</span><input name="options" value="${e((p.options || []).join(', '))}" placeholder="ריבה, שוקולד, פיסטוק"><small>אם מולא — הלקוחה בוחרת כמות לכל סוג בנפרד</small></label>
        <label class="field"><span>מקסימום בהזמנה אחת</span><input name="maxQty" type="number" min="1" max="999" inputmode="numeric" value="${p.maxQty || ''}" placeholder="20"></label>
        <label class="field"><span>שאלה ללקוחה על המוצר (לא חובה)</span><input name="note" maxlength="40" value="${e(p.note || '')}" placeholder="למשל: מה לכתוב על העוגה?"></label>
        ${isR ? '' : `<label class="field full"><span>אלרגנים (מופרדים בפסיק)</span><input name="allergens" value="${e((p.allergens || []).join(', '))}" placeholder="גלוטן, חלב, ביצים"></label>`}
        <div class="field full"><span>תמונה</span><div class="fp-img" data-imgbox>${imgHtml()}</div></div>
        <label class="row full" style="gap:8px;font-weight:600"><input type="checkbox" name="on" ${!it || it.on ? 'checked' : ''}> מוצג בטופס</label>
      </div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button>${it && !isR ? `<button class="btn danger" data-del style="margin-inline-start:auto">${A.icon('trash')}מחיקה</button>` : ''}`,
      onMount: d => {
        const g = n => d.querySelector(`[name=${n}]`), v = n => g(n) ? g(n).value.trim() : '';
        d.addEventListener('click', async ev => {
          const k = ev.target.closest('[data-kz] button');
          if (k) { kz = k.dataset.k; d.querySelector('[data-kz]').innerHTML = kzSeg(); d.dispatchEvent(new Event('input', { bubbles: true })); return; }
          if (ev.target.closest('[data-rmimg]')) { image = ''; d.querySelector('[data-imgbox]').innerHTML = imgHtml(); return; }
          if (ev.target.closest('[data-del]')) {
            if (!root.confirm(`למחוק את המוצר "${it.name || 'ללא שם'}"?`)) return;
            f.customProducts = f.customProducts.filter(x => x !== it.p); A.closeModal(); A.commit('המוצר נמחק'); return;
          }
          if (!ev.target.closest('[data-save]')) return;
          const name = v('name'), price = g('price').value === '' ? '' : U.num(g('price').value);
          if (!isR && !name) { A.toast('חסר שם למוצר'); g('name').focus(); return; }
          if (!isR && !(price > 0)) { A.toast('חסר מחיר למוצר'); g('price').focus(); return; }
          const t = isR ? (f.products[it.id] = f.products[it.id] || {}) : (it ? it.p : { id: U.uid() });
          Object.assign(t, { name, price, unit: v('unit'), desc: v('desc'), cat: v('cat'), badge: v('badge'), note: v('note'), options: splitList(v('options')),
            maxQty: g('maxQty').value === '' ? '' : Math.min(999, Math.max(1, Math.round(U.num(g('maxQty').value)))), kosher: kz, on: g('on').checked });
          if (isR) { if (g('showImg')) t.showImg = g('showImg').checked; }
          else { t.image = image; t.allergens = splitList(v('allergens')); }
          if (!it) f.customProducts.push(t);
          A.closeModal(); A.commit('נשמר — מתעדכן בטופס');
        });
        d.addEventListener('change', async ev => {
          if (!ev.target.matches('[data-img]')) return;
          const file = ev.target.files[0]; if (!file) return;
          try { image = await A.readImage(file, 600); d.querySelector('[data-imgbox]').innerHTML = imgHtml(); }
          catch (err) { A.toast('לא הצלחתי לקרוא את התמונה'); }
        });
      }
    });
  }

  /* --- תצוגה מקדימה: אותו דף שהלקוחות רואות, בתוך מסגרת טלפון. שום דבר לא נשלח. --- */
  async function openPreview() {
    const cfg = await F.buildConfig(); cfg.open = true;
    const put = () => localStorage.setItem('ag-form-preview', JSON.stringify(cfg));
    try { put(); }
    catch (e1) { cfg.products.forEach(p => { if (String(p.img).startsWith('data:')) p.img = ''; }); try { put(); A.toast('התצוגה נפתחת בלי חלק מהתמונות (מגבלת זיכרון של הדפדפן)'); } catch (e2) { A.toast('לא הצלחתי לפתוח תצוגה מקדימה'); return; } }
    A.modal({
      title: 'תצוגה מקדימה — כך הלקוחות רואות', size: 'narrow',
      body: `<div class="fp-phone"><iframe src="order.html#preview" title="תצוגה מקדימה של טופס ההזמנות"></iframe></div>
        <p class="small muted" style="margin:10px 0 0;text-align:center">אפשר לבחור מוצרים ולעבור את כל התהליך עד מסך התשלום — שום הזמנה לא נשלחת.</p>`,
      foot: `<a class="btn ghost" href="${U.esc(F.link())}" target="_blank" rel="noopener">${A.icon('link')}פתיחת הטופס האמיתי</a><button class="btn" data-close>סגירה</button>`
    });
  }

  P.form = {
    title: 'טופס הזמנות',
    render(main) {
      const f = fs(), s = A.state.settings;
      main.oninput = null;
      if (!f.enabled) {
        main.innerHTML = `<div class="card cables" style="max-width:820px">
          <h2 style="margin-bottom:10px">טופס הזמנות קבוע ללקוחות</h2>
          <p>קישור אחד קבוע שאפשר לשים באינסטגרם, בסטטוס ובוואטסאפ. הלקוחות רואות את התפריט העדכני, בוחרות יום ושעה פנויים — וההזמנה <b>נכנסת ישר לאפליקציה</b>, עם צליל והתראה.</p>
          <ul class="muted" style="line-height:1.9;margin:0 0 16px;padding-inline-start:20px">
            <li>מוצרים ומחירים נמשכים מהמתכונים שלך — שינוי מחיר מתעדכן בטופס אוטומטית</li>
            <li>את קובעת ימי איסוף ושעות, כמה ימים מראש מזמינים, תקרת הזמנות ליום ותאריכים סגורים</li>
            <li>טעמים/סוגים לכל מוצר, סימון פרווה / חלבי, משלוחים, מינימום הזמנה ופרטי תשלום</li>
            <li>יום מלא נסגר לבד; המחירים וקודי ההנחה נבדקים בשרת ולא ניתן לשנות אותם מהדפדפן</li>
          </ul>
          ${!s.phone ? `<div class="notice section">${A.icon('alert')}<div>מומלץ להוסיף את מספר הוואטסאפ שלך ב<a href="#/settings">הגדרות</a> — כך לקוחות יוכלו לשלוח לך אישור.</div></div>` : ''}
          ${A.state.recipes.some(r => r.price > 0) ? '' : `<div class="notice section">${A.icon('alert')}<div>עוד אין מתכונים עם מחיר מכירה. אפשר ליצור את הטופס עכשיו ולהוסיף מוצרים אחר כך.</div></div>`}
          <button class="btn" data-act="create">${A.icon('link')}יצירת הטופס שלי</button></div>`;
        main.onchange = null;
        main.onclick = async e => {
          const b = e.target.closest('[data-act=create]'); if (!b) return;
          b.disabled = true; b.textContent = 'יוצרת…';
          const ok = await F.create();
          A.toast(ok ? 'הטופס מוכן! 🎉' : 'לא הצלחתי ליצור את הטופס — בדקי חיבור לאינטרנט'); A.refresh();
        };
        return;
      }
      const link = F.link(), $ = q => main.querySelector(q);
      A.setActions(`<a class="btn ghost" href="${U.esc(link)}" target="_blank" rel="noopener">${A.icon('link')}צפייה בטופס</a>`);
      main.innerHTML = `${topHtml(link)}
        <div class="seg scroll fp-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${ui.tab === k}" class="${ui.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div id="fpTab">${tabHtml()}</div>`;
      F.render(); drawQr(link);
      const drawChecks = () => { const el = $('#fpChecks'); if (el) el.innerHTML = checksHtml(); };
      const drawList = () => { const el = $('#fpList'); if (el) el.innerHTML = listHtml(); };
      const drawTab = () => {
        main.querySelectorAll('.fp-tabs [data-tab]').forEach(b => { const on = b.dataset.tab === ui.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
        $('#fpTab').innerHTML = tabHtml();
      };
      const propsOf = it => it.kind === 'r' ? (f.products[it.id] = f.products[it.id] || {}) : it.p;
      const byKey = k => F.items().find(i => i.key === k);
      const setPath = (path, v) => { const ks = path.split('.'); let o = f; ks.slice(0, -1).forEach(k => o = o[k]); o[ks[ks.length - 1]] = v; };
      const saved = () => { A.save(); drawChecks(); };

      main.oninput = e => { if (e.target.matches('[data-q]')) { ui.q = e.target.value; drawList(); } };
      main.onchange = e => {
        const el = e.target;
        if (el.matches('[data-q]')) return;
        if (el.matches('[data-sel]')) { const k = el.closest('[data-key]').dataset.key; el.checked ? ui.sel.add(k) : ui.sel.delete(k); drawList(); return; }
        if (el.matches('[data-on]')) {
          const it = byKey(el.closest('[data-key]').dataset.key); if (!it) return;
          propsOf(it).on = el.checked; saved(); drawTab();
          A.toast(el.checked ? (it.price > 0 ? 'המוצר מוצג בטופס' : 'המוצר יוצג ברגע שיהיה לו מחיר') : 'המוצר הוסתר מהטופס'); return;
        }
        if (el.matches('[data-policy]')) { A.state.settings.cancellationPolicy = el.value.trim(); saved(); A.toast('המדיניות נשמרה'); return; }
        if (!el.dataset.p) return;
        let v = el.type === 'checkbox' ? el.checked : el.dataset.num || el.type === 'number' ? U.num(el.value) : el.value.trim();
        if ((el.dataset.p === 'pay.paybox' || el.dataset.p === 'pay.bitLink') && v && !A.safeUrl(v)) { A.toast('הקישור חייב להתחיל ב־https://'); el.value = f.pay[el.dataset.p.slice(4)] || ''; return; }
        if (el.type === 'number' && el.min !== '' && v < +el.min) { v = +el.min; el.value = v; }
        if (el.type === 'number' && el.max !== '' && v > +el.max) { v = +el.max; el.value = v; }
        setPath(el.dataset.p, v);
        if (el.dataset.p === 'open') { A.commit(v ? 'הטופס נפתח להזמנות' : 'הטופס נסגר להזמנות'); return; }
        saved();
        if (el.type === 'checkbox' || el.tagName === 'SELECT' || ['cutoffTime', 'leadDays', 'minItems'].includes(el.dataset.p)) drawTab();
      };
      main.onclick = async e => {
        if (e.target.matches('[data-selectall]')) { e.target.select(); return; }
        const b = e.target.closest('[data-tab],[data-filter],[data-move],[data-catmove],[data-edit],[data-bulk],[data-unblock],[data-unopen],[data-act]'); if (!b) return;
        const d = b.dataset;
        if (d.tab) { ui.tab = d.tab; drawTab(); if (b.classList.contains('fp-link')) $('.fp-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (d.filter) { ui.filter = d.filter; drawTab(); return; }
        if (d.move) {
          const all = F.items(), keys = all.map(i => i.key), i = keys.indexOf(b.closest('[data-key]').dataset.key), j = i + +d.move;
          if (i < 0 || !all[j] || all[j].cat !== all[i].cat) return;
          [keys[i], keys[j]] = [keys[j], keys[i]]; f.order = keys; A.save(); drawList(); return;
        }
        if (d.catmove) {
          const cats = [...new Set(F.items().map(i => i.cat))], i = cats.indexOf(d.cat), j = i + +d.catmove;
          if (i < 0 || j < 0 || j >= cats.length) return;
          [cats[i], cats[j]] = [cats[j], cats[i]]; f.catOrder = cats; A.save(); drawList(); return;
        }
        if ('edit' in d) { openEdit(b.closest('[data-key]').dataset.key); return; }
        if (d.bulk) {
          if (d.bulk === 'all') { visibleItems().forEach(i => ui.sel.add(i.key)); drawList(); return; }
          if (d.bulk === 'clear') { ui.sel.clear(); drawList(); return; }
          const items = F.items().filter(i => ui.sel.has(i.key)); if (!items.length) return;
          if (d.bulk === 'del') {
            const custom = items.filter(i => i.kind === 'c'), rec = items.length - custom.length;
            const msg = `${custom.length ? `למחוק ${custom.length} מוצרים ידניים לצמיתות?` : 'להסתיר את המוצרים שנבחרו מהטופס?'}${rec ? ` ${rec} מוצרים שמבוססים על מתכון רק יוסתרו מהטופס — המתכון עצמו נשאר.` : ''}`;
            if (!await A.confirm(msg, custom.length ? 'מחיקה' : 'הסתרה', !!custom.length)) return;
            const gone = new Set(custom.map(i => i.p)); f.customProducts = f.customProducts.filter(x => !gone.has(x));
            items.filter(i => i.kind === 'r').forEach(i => propsOf(i).on = false);
            ui.sel.clear(); A.commit(custom.length ? 'המוצרים נמחקו' : 'המוצרים הוסתרו'); return;
          }
          items.forEach(i => { const p = propsOf(i); if (d.bulk === 'show') p.on = true; else if (d.bulk === 'hide') p.on = false; else p.kosher = d.bulk; });
          ui.sel.clear(); saved(); drawTab();
          A.toast({ show: 'המוצרים מוצגים בטופס', hide: 'המוצרים הוסתרו', parve: `${items.length} מוצרים סומנו פרווה`, dairy: `${items.length} מוצרים סומנו חלבי` }[d.bulk]); return;
        }
        if (d.unblock) { f.blocked = f.blocked.filter(x => x !== d.unblock); saved(); drawTab(); return; }
        if (d.unopen) { f.onlyDates = (f.onlyDates || []).filter(x => x !== d.unopen); saved(); drawTab(); A.toast(f.onlyDates.some(x => x >= U.today()) ? 'התאריך הוסר' : 'התאריך הוסר — אפשר שוב להזמין לכל הימים המסומנים'); return; }
        const act = d.act;
        if (act === 'copy') A.copy(link);
        if (act === 'preview') { b.disabled = true; try { await openPreview(); } finally { b.disabled = false; } }
        if (act === 'publish') { const ok = await F.publish(true); A.toast(ok ? 'הטופס עודכן' : 'הפרסום נכשל — בדקי אינטרנט'); }
        if (act === 'openDate') {
          const v = $('#openDate').value; if (!v) { A.toast('בחרי תאריך'); return; }
          f.onlyDates = (f.onlyDates || []).filter(x => x >= U.today());
          if (!f.onlyDates.includes(v)) { f.onlyDates.push(v); f.onlyDates.sort(); saved(); drawTab(); A.toast(`נפתח להזמנות: ${U.dayName(v)} ${U.fmtDate(v)}`); }
        }
        if (act === 'block') { const v = $('#blockDate').value; if (v && !f.blocked.includes(v)) { f.blocked.push(v); saved(); drawTab(); A.toast('התאריך נסגר להזמנות'); } }
        if (act === 'notif') { try { const r = await Notification.requestPermission(); A.toast(r === 'granted' ? 'התראות הופעלו' : 'ההתראות לא אושרו בדפדפן'); A.refresh(); } catch (err) { } }
        if (act === 'cpAdd') openEdit(null);
      };
    }
  };

  function drawQr(link) {
    const el = document.getElementById('formQr'); if (!el || !link) return;
    const draw = () => { el.innerHTML = ''; new root.QRCode(el, { text: link, width: 360, height: 360, colorDark: '#3b2d1e', colorLight: '#ffffff', correctLevel: root.QRCode.CorrectLevel.M }); };
    if (root.QRCode) return draw();
    const s = document.createElement('script'); s.src = 'assets/vendor/qrcode.min.js';
    s.onload = draw; s.onerror = () => { el.innerHTML = '<span class="small muted">QR לא נטען</span>'; };
    document.head.appendChild(s);
  }
})(window);
