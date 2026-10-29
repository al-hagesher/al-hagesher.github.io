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
  F.priceOf = r => { const p = fs().products[r.id] || {}; return +p.price > 0 ? +p.price : +r.price || 0; };
  F.load = () => {
    const t = U.today(), load = {};
    A.state.orders.forEach(o => { if (o.status !== 'cancelled' && o.date >= t) load[o.date] = (load[o.date] || 0) + 1; });
    return load;
  };
  F.buildConfig = async () => {
    const f = fs(), s = A.state.settings, t = U.today();
    const products = [];
    for (const r of F.productList()) {
      const p = f.products[r.id];
      const price = F.priceOf(r);
      if (!(price > 0)) continue;
      products.push({
        id: r.id, name: (p.name || r.name).trim(), desc: (p.desc || r.description || '').trim(), price, unit: r.yieldUnit || '', cat: r.category || '',
        img: p.showImg === false ? '' : await thumb(r.image), options: (p.options || []).filter(Boolean), maxQty: +p.maxQty || 20, allergens: C.allergens(r)
      });
    }
    return {
      v: 1, bizName: s.businessName, phone: U.phoneIntl(s.phone), open: !!f.open, closedMsg: f.closedMsg, title: f.title, intro: f.intro,
      pickupAddress: f.pickupAddress, payInfo: f.payInfo, terms: f.terms, leadDays: +f.leadDays || 0, maxDaysAhead: +f.maxDaysAhead || 30,
      capacity: +f.capacity || 0, slotMinutes: +f.slotMinutes || 0, minOrder: +f.minOrder || 0, blocked: f.blocked.filter(d => d >= t),
      pay: { mode: f.pay.mode, pct: +f.pay.pct || 50, bit: f.pay.bit || s.phone || '', paybox: A.safeUrl(f.pay.paybox), hours: +f.pay.hours || 24 },
      days: f.days, delivery: { on: !!f.delivery.on, fee: +f.delivery.fee || 0, freeAbove: +f.delivery.freeAbove || 0, note: f.delivery.note || '' },
      products, load: F.load()
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
    F.render(); return F.pubStatus === 'ok';
  };
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const schedulePublish = U.debounce(() => F.publish(), 2500);
  A.saveHooks.push(() => { if (fs().enabled) schedulePublish(); });

  /* ---------- קליטת הזמנות מהטופס ---------- */
  let polling = false;
  F.poll = async () => {
    const f = fs(); if (!f.enabled || !f.key || polling || !navigator.onLine) return 0;
    polling = true;
    try {
      const rows = await rpc('form_inbox', { p_key: f.key, p_slug: f.slug });
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
        const o = {
          id, num: A.state.settings.nextOrderNum++, formRef: 1000 + row.id, customerName: p.name, phone: p.phone, date: p.date, time: p.time || '',
          method: p.method, address: p.address || '', deliveryFee: +p.deliveryFee || 0, discount: 0, paid: 0, payMethod: '',
          items: p.items.map(i => ({ recipeId: C.recipe(i.id) ? i.id : null, name: i.name + (i.option ? ` (${i.option})` : ''), qty: +i.qty, unitPrice: +i.price })),
          source: 'טופס הזמנה', notes: [p.notes, ...itemNotes].filter(Boolean).join(' · '), allergies: p.allergies || '', status: 'new',
          createdAt: (row.created_at || '').slice(0, 10) || U.today(), createdTs: row.created_at || '',
          payMode: p.payMode || 'none', payDue: +p.amountDue || 0, payClaim: claim
        };
        A.state.orders.push(o); added.push(o);
      });
      if (added.length || claims.length) { await A.saveNow(); }
      await rpc('form_ack', { p_key: f.key, p_slug: f.slug, p_ids: rows.map(r => r.id), p_before: rows[0].fetched_at });
      if (added.length) notify(added);
      if (claims.length) notify(claims, true);
      return added.length;
    } catch (e) { console.warn('form poll', e); return 0; }
    finally { polling = false; }
  };
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

  P.form = {
    title: 'טופס הזמנות',
    render(main) {
      const f = fs(), s = A.state.settings;
      if (!f.enabled) {
        main.innerHTML = `<div class="card cables" style="max-width:820px">
          <h2 style="margin-bottom:10px">טופס הזמנות קבוע ללקוחות</h2>
          <p>קישור אחד קבוע שאפשר לשים באינסטגרם, בסטטוס ובוואטסאפ. הלקוחות רואות את התפריט העדכני, בוחרות יום ושעה פנויים — וההזמנה <b>נכנסת ישר לאפליקציה</b>, עם צליל והתראה.</p>
          <ul class="muted" style="line-height:1.9;margin:0 0 16px;padding-inline-start:20px">
            <li>מוצרים ומחירים נמשכים מהמתכונים שלך — שינוי מחיר מתעדכן בטופס אוטומטית</li>
            <li>את קובעת ימי איסוף ושעות, כמה ימים מראש מזמינים, תקרת הזמנות ליום ותאריכים סגורים</li>
            <li>טעמים/סוגים לכל מוצר, משלוחים עם דמי משלוח, מינימום הזמנה ופרטי תשלום</li>
            <li>יום מלא נסגר לבד; המחירים נבדקים בשרת ולא ניתן לשנות אותם מהדפדפן</li>
          </ul>
          ${!s.phone ? `<div class="notice section">${A.icon('alert')}<div>מומלץ להוסיף את מספר הוואטסאפ שלך ב<a href="#/settings">הגדרות</a> — כך לקוחות יוכלו לשלוח לך אישור.</div></div>` : ''}
          ${A.state.recipes.some(r => r.price > 0) ? '' : `<div class="notice section">${A.icon('alert')}<div>עוד אין מתכונים עם מחיר מכירה. אפשר ליצור את הטופס עכשיו ולהוסיף מוצרים אחר כך.</div></div>`}
          <button class="btn" data-act="create">${A.icon('link')}יצירת הטופס שלי</button></div>`;
        main.onclick = async e => {
          const b = e.target.closest('[data-act=create]'); if (!b) return;
          b.disabled = true; b.textContent = 'יוצרת…';
          const ok = await F.create();
          A.toast(ok ? 'הטופס מוכן! 🎉' : 'לא הצלחתי ליצור את הטופס — בדקי חיבור לאינטרנט'); A.refresh();
        };
        return;
      }
      const link = F.link();
      const fromForm = A.state.orders.filter(o => o.source === 'טופס הזמנה');
      const recipes = A.state.recipes.filter(r => !(A.isComponent && A.isComponent(r)) || (f.products[r.id] || {}).on).sort((a, b) => (a.category || '').localeCompare(b.category || '', 'he') || a.name.localeCompare(b.name, 'he'));
      const onCount = F.productList().filter(r => F.priceOf(r) > 0).length;
      const shareText = `${f.title || 'הזמנות'} 🤎\nלהזמנה: ${link}`;
      A.setActions(`<a class="btn ghost" href="${U.esc(link)}" target="_blank" rel="noopener">${A.icon('link')}צפייה בטופס</a>`);
      main.innerHTML = `
      <div class="card section cables">
        <div class="card-h"><h3>${A.icon('link')}הקישור הקבוע שלך</h3><span data-form-status class="sync-pill"></span></div>
        <div class="grid g2" style="align-items:start">
          <div class="stack">
            <input readonly dir="ltr" value="${U.esc(link)}" data-selectall aria-label="הקישור לטופס">
            <div class="row"><button class="btn sm" data-act="copy">${A.icon('copy')}העתקה</button>
              <a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText)}">${A.icon('msg')}שיתוף בוואטסאפ</a>
              <button class="btn sm ghost" data-act="publish">פרסום עכשיו</button></div>
            <div class="row" style="margin-top:6px">
              <label class="row" style="gap:8px;font-weight:600"><input type="checkbox" data-p="open" ${f.open ? 'checked' : ''}> הטופס פתוח להזמנות</label>
              ${root.Notification && Notification.permission !== 'granted' ? `<button class="btn sm soft" data-act="notif">${A.icon('alert')}הפעלת התראות על הזמנה חדשה</button>` : ''}
            </div>
            ${!f.open ? `<label class="field"><span>הודעה כשהטופס סגור</span>${inp('closedMsg', f.closedMsg)}</label>` : ''}
            <p class="small muted" style="margin:0">${onCount} מוצרים מוצגים · ${fromForm.length} הזמנות התקבלו מהטופס עד היום. הקישור לא משתנה לעולם — שינויים כאן מתעדכנים בו תוך שניות.</p>
          </div>
          <div style="text-align:center"><div class="qr" id="formQr"></div><div class="small muted" style="margin-top:6px">QR להדפסה על כרטיס ביקור או אריזה</div></div>
        </div>
      </div>

      <div class="grid g2 section">
        <div class="card"><div class="card-h"><h3>מה הלקוחות רואות</h3></div>
          <div class="form-grid">
            <label class="field full"><span>כותרת</span>${inp('title', f.title)}</label>
            <label class="field full"><span>פתיח</span><textarea data-p="intro" rows="2">${U.esc(f.intro)}</textarea></label>
            <label class="field full"><span>כתובת לאיסוף</span>${inp('pickupAddress', f.pickupAddress, 'placeholder="רחוב, עיר (מוצג אחרי ההזמנה)"')}</label>
            <label class="field full"><span>פרטי תשלום</span>${inp('payInfo', f.payInfo)}</label>
            <label class="field full"><span>תנאים / הערות חשובות (לא חובה)</span><textarea data-p="terms" rows="2" placeholder="למשל: ביטול עד 48 שעות לפני. העוגות נאפות במטבח ביתי שאינו נקי מאגוזים.">${U.esc(f.terms)}</textarea><small>אם מולא — הלקוחה תסמן שקראה לפני שליחה</small></label>
          </div></div>

        <div class="card"><div class="card-h"><h3>${A.icon('calendar')}ימים ושעות איסוף</h3></div>
          ${U.DAYS.map((d, i) => { const dd = f.days[i]; return `<div class="day-row">
            <label class="row" style="gap:8px;width:92px;flex:none"><input type="checkbox" data-p="days.${i}.on" ${dd.on ? 'checked' : ''}><b>${d}</b></label>
            <input type="time" data-p="days.${i}.from" value="${dd.from}" ${dd.on ? '' : 'disabled'}><span class="muted">עד</span>
            <input type="time" data-p="days.${i}.to" value="${dd.to}" ${dd.on ? '' : 'disabled'}></div>`; }).join('')}
          <div class="form-grid" style="margin-top:12px">
            <label class="field"><span>בחירת שעה</span><select data-p="slotMinutes" data-num="1">${A.opts([[0, 'בלי בחירת שעה'], [15, 'כל רבע שעה'], [30, 'כל חצי שעה'], [60, 'כל שעה'], [120, 'כל שעתיים']], f.slotMinutes)}</select></label>
            <label class="field"><span>כמה ימים מראש לפחות</span><input type="number" min="0" max="30" data-p="leadDays" data-num="1" value="${f.leadDays}"><small>0 = אפשר להזמין להיום</small></label>
            <label class="field"><span>עד כמה ימים קדימה</span><input type="number" min="1" max="180" data-p="maxDaysAhead" data-num="1" value="${f.maxDaysAhead}"></label>
            <label class="field"><span>מקסימום הזמנות ליום</span><input type="number" min="0" data-p="capacity" data-num="1" value="${f.capacity}"><small>0 = ללא הגבלה. נספרות גם הזמנות שהזנת ידנית</small></label>
          </div>
          <div class="field" style="margin-top:12px"><span>תאריכים סגורים (חגים, חופשה)</span>
            <div class="row"><input type="date" id="blockDate" min="${U.today()}" style="width:auto"><button class="btn sm ghost" data-act="block">${A.icon('plus')}הוספה</button></div>
            <div class="row" style="margin-top:6px">${f.blocked.filter(d => d >= U.today()).sort().map(d => `<span class="chip">${U.dayName(d)} ${U.fmtDate(d)} <button class="icon-btn" data-unblock="${d}" style="padding:0" aria-label="הסרה">${A.icon('x', 'inl')}</button></span>`).join('') || '<span class="small muted">אין</span>'}</div></div>
        </div>
      </div>

      <div class="card section"><div class="card-h"><h3>${A.icon('truck')}משלוחים ומינימום</h3></div>
        <div class="form-grid c4">
          <label class="field"><span>&nbsp;</span><label class="row" style="gap:8px;min-height:40px"><input type="checkbox" data-p="delivery.on" ${f.delivery.on ? 'checked' : ''}> יש משלוחים</label></label>
          <label class="field"><span>דמי משלוח (₪)</span><input type="number" min="0" data-p="delivery.fee" data-num="1" value="${f.delivery.fee}" ${f.delivery.on ? '' : 'disabled'}></label>
          <label class="field"><span>משלוח חינם מעל (₪)</span><input type="number" min="0" data-p="delivery.freeAbove" data-num="1" value="${f.delivery.freeAbove}" ${f.delivery.on ? '' : 'disabled'}><small>0 = אין</small></label>
          <label class="field"><span>מינימום הזמנה (₪)</span><input type="number" min="0" data-p="minOrder" data-num="1" value="${f.minOrder}"></label>
          <label class="field full"><span>אזורי משלוח / הערה</span>${inp('delivery.note', f.delivery.note, `placeholder="למשל: משלוחים בתוך העיר בלבד" ${f.delivery.on ? '' : 'disabled'}`)}</label>
        </div></div>

      <div class="card section"><div class="card-h"><h3>${A.icon('wallet')}תשלום לאישור ההזמנה</h3></div>
        <div class="form-grid c4">
          <label class="field"><span>מה נדרש כדי לאשר</span><select data-p="pay.mode">${A.opts([['deposit', 'מקדמה'], ['full', 'תשלום מלא'], ['none', 'בלי תשלום מראש']], f.pay.mode)}</select></label>
          ${f.pay.mode === 'deposit' ? `<label class="field"><span>גובה המקדמה (%)</span><input type="number" min="10" max="100" step="5" data-p="pay.pct" data-num="1" value="${f.pay.pct}"></label>` : ''}
          ${f.pay.mode !== 'none' ? `<label class="field"><span>תוך כמה שעות לשלם</span><input type="number" min="1" max="168" data-p="pay.hours" data-num="1" value="${f.pay.hours}"></label>
          <label class="field"><span>מספר לביט</span><input type="tel" data-p="pay.bit" value="${U.esc(f.pay.bit || '')}" placeholder="${U.esc(s.phone || '050-0000000')}"></label>
          <label class="field full"><span>קישור לתשלום בפייבוקס</span><input type="url" dir="ltr" data-p="pay.paybox" value="${U.esc(f.pay.paybox || '')}" placeholder="https://payboxapp.page.link/…"><small>יוצרים באפליקציית פייבוקס: "בקשת תשלום" ← "שיתוף קישור". אם ריק — יוצג רק ביט.</small></label>` : ''}
        </div>
        <p class="small muted" style="margin:10px 0 0">${f.pay.mode === 'none' ? 'ההזמנות ייכנסו בלי דרישת תשלום.' : 'אחרי שליחת ההזמנה הלקוחה רואה את הסכום לתשלום וכפתורי ביט/פייבוקס, ולוחצת "שילמתי". ההזמנה נשארת "ממתינה לתשלום" עד שאת בודקת שהכסף נכנס ומאשרת — ואז נשלח לה אישור.'}</p>
      </div>

      <div class="card"><div class="card-h"><h3>${A.icon('book')}מוצרים בטופס</h3><span class="small muted">המחיר נלקח מהמתכון אלא אם תכתבי מחיר אחר לטופס</span></div>
        ${recipes.length ? `<div class="table-wrap"><table class="form-products"><thead><tr><th>מוצג</th><th>מוצר</th><th class="n">מחיר</th><th>תיאור קצר</th><th>טעמים / סוגים (בפסיקים)</th><th class="n">מקס׳</th></tr></thead><tbody>
          ${recipes.map(r => { const p = f.products[r.id] || {}; const price = F.priceOf(r); return `<tr>
            <td><input type="checkbox" data-pp="${r.id}.on" ${p.on ? 'checked' : ''}></td>
            <td><b>${U.esc(r.name)}</b><div class="small muted">${U.esc(r.yieldUnit || '')}${!price ? ' · <span style="color:var(--bad)">חסר מחיר</span>' : ''}</div></td>
            <td class="n"><input type="number" min="0" data-pp="${r.id}.price" value="${p.price || ''}" placeholder="${r.price || ''}" style="width:80px"></td>
            <td><input data-pp="${r.id}.desc" value="${U.esc(p.desc || '')}" placeholder="${U.esc((r.description || '').slice(0, 40))}"></td>
            <td><input data-pp="${r.id}.options" value="${U.esc((p.options || []).join(', '))}" placeholder="וניל, שוקולד"></td>
            <td class="n"><input type="number" min="1" data-pp="${r.id}.maxQty" value="${p.maxQty || ''}" placeholder="20" style="width:64px"></td></tr>`; }).join('')}
        </tbody></table></div>` : '<p class="muted">עוד אין מתכונים. מוצרים בטופס נלקחים מהמתכונים שלך.</p>'}
      </div>`;
      F.render(); drawQr(link);
      const setPath = (path, v) => { const ks = path.split('.'); let o = f; ks.slice(0, -1).forEach(k => o = o[k]); o[ks[ks.length - 1]] = v; };
      main.onchange = e => {
        const el = e.target;
        if (el.dataset.p) {
          let v = el.type === 'checkbox' ? el.checked : el.dataset.num || el.type === 'number' ? U.num(el.value) : el.value.trim();
          if (el.dataset.p === 'pay.paybox' && v && !A.safeUrl(v)) { A.toast('קישור פייבוקס חייב להתחיל ב־https://'); el.value = f.pay.paybox || ''; return; }
          if (el.type === 'number' && el.min !== '' && v < +el.min) { v = +el.min; el.value = v; }
          if (el.type === 'number' && el.max !== '' && v > +el.max) { v = +el.max; el.value = v; }
          setPath(el.dataset.p, v); A.save();
          if (el.type === 'checkbox' || el.tagName === 'SELECT') A.refresh();
          return;
        }
        if (el.dataset.pp) {
          const [id, k] = el.dataset.pp.split('.');
          const p = f.products[id] = f.products[id] || {};
          if (k === 'on') p.on = el.checked;
          else if (k === 'options') p.options = el.value.split(/[,،]/).map(x => x.trim()).filter(Boolean);
          else if (k === 'price' || k === 'maxQty') p[k] = el.value === '' ? '' : U.num(el.value);
          else p[k] = el.value.trim();
          A.save(); A.toast('נשמר — מתעדכן בטופס');
        }
      };
      main.onclick = async e => {
        if (e.target.matches('[data-selectall]')) { e.target.select(); return; }
        const b = e.target.closest('[data-act],[data-unblock]'); if (!b) return;
        if (b.dataset.unblock) { f.blocked = f.blocked.filter(d => d !== b.dataset.unblock); A.commit(); return; }
        const act = b.dataset.act;
        if (act === 'copy') A.copy(link);
        if (act === 'publish') { const ok = await F.publish(true); A.toast(ok ? 'הטופס עודכן' : 'הפרסום נכשל — בדקי אינטרנט'); }
        if (act === 'block') { const d = main.querySelector('#blockDate').value; if (d && !f.blocked.includes(d)) { f.blocked.push(d); A.commit('התאריך נסגר להזמנות'); } }
        if (act === 'notif') { try { const p = await Notification.requestPermission(); A.toast(p === 'granted' ? 'התראות הופעלו' : 'ההתראות לא אושרו בדפדפן'); A.refresh(); } catch (err) { } }
      };
    }
  };
  function drawQr(link) {
    const el = document.getElementById('formQr'); if (!el || !link) return;
    const draw = () => { el.innerHTML = ''; new root.QRCode(el, { text: link, width: 360, height: 360, colorDark: '#4a2a16', colorLight: '#ffffff', correctLevel: root.QRCode.CorrectLevel.M }); };
    if (root.QRCode) return draw();
    const s = document.createElement('script'); s.src = 'assets/vendor/qrcode.min.js';
    s.onload = draw; s.onerror = () => { el.innerHTML = '<span class="small muted">QR לא נטען</span>'; };
    document.head.appendChild(s);
  }
})(window);
