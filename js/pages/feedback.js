/* על הגשר — משובים מלקוחות: QR להזמנות, קליטת תשובות, תובנות לשיפור */
(function (root) {
  const A = root.App, U = A.util, P = A.pages = A.pages || {};
  const SB_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co';
  const SB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const FB = A.fb = {};
  const fs = () => A.state.form, cfg = () => A.state.form.feedback;
  const view = { filter: 'all', q: '' };

  async function rpc(fn, body) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${fn}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json();
  }
  FB.ready = () => !!(fs().enabled && fs().slug && cfg().on);
  FB.link = order => fs().slug ? `${A.PUBLIC_BASE}feedback.html?f=${fs().slug}${order ? '&o=' + encodeURIComponent(order) : ''}` : '';
  const sources = () => [{ slug: fs().slug, key: fs().key }, ...(A.form && A.form.olds ? A.form.olds() : [])].filter(s => s.slug && s.key);

  /* ---------- חישובים (טהורים — נבדקים בבדיקות) ---------- */
  FB.ratingOf = x => +x.rating || 0;
  // דורש טיפול: דירוג כללי 3 ומטה, או דירוג 1–2 בשאלה כלשהי — כל עוד לא סומן "טופל"
  FB.needsCare = x => x.status !== 'done' && ((FB.ratingOf(x) && FB.ratingOf(x) <= 3) || (x.answers || []).some(a => a.type === 'rating' && +a.value <= 2));
  const STOP = new Set('של את על עם זה זו היה היתה היו גם אבל מאוד ממש הכל הכול לא כן יותר פחות אני אנחנו הם הן שלי שלך שלכם כי אם או רק עוד כל מה איך היא הוא לי לנו לכם כמו יש אין תודה רבה טוב טובה טובים היינו שזה שהיה קצת כבר אז עד בלי אחרי לפני כמה הרבה מעט ממש פשוט מאד שלנו אותו אותה אותם להם לה לו אלא בגלל רוצה רציתי היתי הייתי'.split(' '));
  const words = texts => {
    const n = {};
    texts.forEach(t => new Set(String(t).replace(/[^֐-׿a-zA-Z\s]/g, ' ').split(/\s+/).map(w => w.replace(/[֑-ׇ]/g, '')).filter(w => w.length >= 3 && !STOP.has(w))).forEach(w => n[w] = (n[w] || 0) + 1));
    return Object.entries(n).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  FB.insights = (list, questions, today) => {
    const rated = list.filter(x => FB.ratingOf(x));
    const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
    const overall = avg(rated.map(FB.ratingOf));
    const dist = [1, 2, 3, 4, 5].map(n => rated.filter(x => FB.ratingOf(x) === n).length);
    const per = {};
    list.forEach(x => (x.answers || []).forEach(a => { if (a.type !== 'rating') return; (per[a.id] = per[a.id] || { id: a.id, label: a.label, vals: [] }).vals.push(+a.value); }));
    const qLabel = id => (questions.find(q => q.id === id) || {}).label;
    const firstId = (questions.find(q => q.type === 'rating') || {}).id;
    const perQ = Object.values(per).map(p => ({ id: p.id, label: qLabel(p.id) || p.label, n: p.vals.length, avg: avg(p.vals) }))
      .filter(p => p.id !== firstId).sort((a, b) => a.avg - b.avg);
    const weakest = perQ.find(p => p.n >= 2 && p.avg < 4.5) || null;
    const d30 = U.addDays(today, -30), d60 = U.addDays(today, -60);
    const cur = rated.filter(x => x.date > d30), prev = rated.filter(x => x.date > d60 && x.date <= d30);
    const trend = cur.length >= 2 && prev.length >= 2 ? avg(cur.map(FB.ratingOf)) - avg(prev.map(FB.ratingOf)) : null;
    const textsOf = arr => arr.flatMap(x => (x.answers || []).filter(a => a.type === 'text').map(a => a.value));
    return {
      n: list.length, rated: rated.length, overall, dist, perQ, weakest, trend,
      happy: rated.length ? rated.filter(x => FB.ratingOf(x) >= 4).length / rated.length : 0,
      care: list.filter(FB.needsCare).length, withPhotos: list.filter(x => x.photos > 0).length,
      lowWords: words(textsOf(list.filter(x => FB.ratingOf(x) && FB.ratingOf(x) <= 3))),
      highWords: words(textsOf(list.filter(x => FB.ratingOf(x) >= 4)))
    };
  };

  /* ---------- קליטה מהשרת ---------- */
  let polling = false;
  FB.poll = async () => {
    const f = fs(); if (!f.enabled || !f.key || polling || !navigator.onLine) return 0;
    polling = true; const added = [];
    try { for (const src of sources()) added.push(...await pollOne(src)); }
    finally { polling = false; }
    if (added.length) notify(added);
    return added.length;
  };
  FB.fromRow = (row, slug) => {
    const p = row.payload || {}, at = row.created_at || '';
    return {
      id: 'fb-' + row.id, sid: row.id, slug, at, date: at && !isNaN(new Date(at)) ? U.iso(new Date(at)) : U.today(),
      rating: +row.rating || 0, answers: Array.isArray(p.answers) ? p.answers.map(a => ({ id: a.id, type: a.type === 'text' ? 'text' : 'rating', label: String(a.label || ''), value: a.type === 'text' ? String(a.value || '') : +a.value })) : [],
      name: String(p.name || ''), phone: String(p.phone || ''), consent: !!p.consent, order: p.order ? +p.order : null, photos: +p.photos || 0, status: 'new', note: ''
    };
  };
  async function pollOne(src) {
    try {
      const rows = await rpc('feedback_inbox', { p_key: src.key, p_slug: src.slug });
      if (!rows.length) return [];
      const added = [];
      rows.forEach(r => { if (A.state.feedback.some(x => x.id === 'fb-' + r.id)) return; const x = FB.fromRow(r, src.slug); A.state.feedback.push(x); added.push(x); });
      if (added.length) await A.saveNow();
      await rpc('feedback_ack', { p_key: src.key, p_slug: src.slug, p_ids: rows.map(r => r.id) });
      return added;
    } catch (e) { console.warn('feedback poll', src.slug, e); return []; }
  }
  const stars = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
  function notify(list) {
    const x = list[0];
    const msg = list.length === 1 ? `משוב חדש${x.name ? ' מ' + x.name : ''}${x.rating ? ' · ' + stars(x.rating) : ''}` : `${list.length} משובים חדשים`;
    A.toast('💬 ' + msg);
    try { if (root.Notification && Notification.permission === 'granted') new Notification('על הגשר', { body: msg, icon: 'assets/icon.png' }); } catch (e) { }
    if (!document.getElementById('modal').open) A.refresh(); else A.updateBadges && A.updateBadges();
  }
  FB.init = () => {
    setTimeout(() => FB.poll(), 2500);
    setInterval(() => { if (document.visibilityState === 'visible') FB.poll(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') FB.poll(); });
  };
  FB.unseen = () => A.state.feedback.filter(x => x.status === 'new').length;

  /* ---------- תמונות: נשמרות בשרת, ונשמרות גם במכשיר אחרי הצפייה הראשונה ---------- */
  const phCache = new Map();
  const okImg = s => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s);
  FB.photosOf = async x => {
    if (phCache.has(x.id)) return phCache.get(x.id);
    let arr = await A.kvGet('fbph-' + x.id);
    if (!Array.isArray(arr) || !arr.length) {
      const src = sources().find(s => s.slug === x.slug); if (!src) return [];
      arr = (await rpc('feedback_photos', { p_key: src.key, p_slug: x.slug, p_id: x.sid })) || [];
      arr = arr.filter(okImg);
      if (arr.length) A.kvPut('fbph-' + x.id, arr);
    }
    phCache.set(x.id, arr); return arr;
  };
  async function fillPhotos(main) {
    for (const el of main.querySelectorAll('[data-phs]')) {
      const x = A.state.feedback.find(f => f.id === el.dataset.phs); if (!x) continue;
      try {
        const arr = await FB.photosOf(x);
        if (!el.isConnected) continue;
        el.innerHTML = arr.map((s, i) => `<button class="fb-ph" data-zoom="${x.id}" data-i="${i}" aria-label="הגדלת תמונה ${i + 1}"><img src="${s}" alt=""></button>`).join('') || '<span class="small muted">התמונות לא נמצאו</span>';
      } catch (e) { if (el.isConnected) el.innerHTML = '<span class="small muted">התמונות ייטענו כשיהיה חיבור לאינטרנט</span>'; }
    }
  }
  const dataUrlBlob = s => { const [h, b] = s.split(','), bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' }); };

  /* ---------- QR, כרטיס להדפסה ותמונה ---------- */
  FB.loadQr = () => new Promise((res, rej) => {
    if (root.QRCode) return res(root.QRCode);
    const s = document.createElement('script'); s.src = 'assets/vendor/qrcode.min.js';
    s.onload = () => res(root.QRCode); s.onerror = rej; document.head.appendChild(s);
  });
  FB.qrDataUrl = async (text, size = 600) => {
    const Q = await FB.loadQr(), d = document.createElement('div');
    new Q(d, { text, width: size, height: size, colorDark: '#3b2d1e', colorLight: '#ffffff', correctLevel: Q.CorrectLevel.M });
    const c = d.querySelector('canvas'); return c ? c.toDataURL('image/png') : (d.querySelector('img') || {}).src || '';
  };
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // כרטיס 1080×1350 (פרופורציה של אינסטגרם/מדבקה) — להדפסה בבית דפוס או לשליחה
  FB.cardPng = async () => {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), b = cfg();
    try { await Promise.all([document.fonts.load('110px Bellefair'), document.fonts.load('700 44px Assistant'), document.fonts.load('40px Assistant')]); } catch (e) { }
    x.fillStyle = '#faf6f0'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#d2c4b2'; x.lineWidth = 4; rr(x, 36, 36, W - 72, H - 72, 46); x.stroke();
    try { const logo = await loadImg('assets/logo-brown.png'); const lw = 300, lh = lw * logo.height / logo.width; x.drawImage(logo, (W - lw) / 2, 90, lw, lh); } catch (e) { }
    x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = '#3b2d1e';
    x.font = '110px Bellefair, serif'; x.fillText(String(b.title || 'איך היה?').replace(/\s*[\u{1F300}-\u{1FAFF}☀-➿️]+/gu, ''), W / 2, 470);
    x.fillStyle = '#705f4e'; x.font = '40px Assistant, sans-serif'; x.fillText('סרקי את הקוד ושתפי אותנו — פחות מדקה', W / 2, 540);
    const qr = await loadImg(await FB.qrDataUrl(FB.link(), 640)), qs = 560, qx = (W - qs) / 2, qy = 600;
    x.fillStyle = '#fff'; rr(x, qx - 30, qy - 30, qs + 60, qs + 60, 36); x.fill();
    x.drawImage(qr, qx, qy, qs, qs);
    x.fillStyle = '#80624a'; x.font = '700 40px Assistant, sans-serif'; x.fillText(`תודה שבחרת ב${A.state.settings.businessName || 'על הגשר'} 🤍`, W / 2, H - 110);
    return c;
  };
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  async function downloadCard() {
    try { const c = await FB.cardPng(); c.toBlob(b => A.download('al-hagesher-feedback-qr.png', b, 'image/png'), 'image/png'); }
    catch (e) { A.toast('לא הצלחנו ליצור את התמונה'); }
  }
  // דף A4 עם 8 כרטיסים לגזירה — מכניסים אחד לכל הזמנה
  async function printCards() {
    const w = root.open('', '_blank'); if (!w) return A.toast('הדפדפן חסם חלון — אפשרי חלונות קופצים');
    w.document.write('<p style="font-family:Arial;text-align:center;margin-top:40px">מכינה את הכרטיסים…</p>');
    const qr = await FB.qrDataUrl(FB.link(), 500), b = cfg(), logo = new URL('assets/logo-brown.png', location.href).href, biz = A.state.settings.businessName || 'על הגשר';
    const card = `<div class="c"><img class="lg" src="${logo}" alt=""><h2>${U.esc(b.title || 'איך היה?')}</h2><p>סרקי את הקוד ושתפי אותנו — פחות מדקה</p><img class="qr" src="${qr}" alt=""><small>תודה שבחרת ב${U.esc(biz)}</small></div>`;
    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>כרטיסי משוב</title><link rel="stylesheet" href="${new URL('css/fonts.css', location.href).href}"><style>
      @page { size: A4; margin: 8mm; } * { box-sizing: border-box; } body { margin: 0; font-family: Assistant, Arial, sans-serif; color: #3b2d1e; }
      .g { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 69mm; gap: 0; }
      .c { border: 1px dashed #c9b8a3; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4mm; break-inside: avoid; }
      .lg { width: 22mm; } h2 { font-family: Bellefair, 'Frank Ruhl Libre', serif; font-weight: 400; font-size: 20pt; margin: 1mm 0 0; }
      p { margin: .5mm 0 1.5mm; font-size: 9.5pt; color: #705f4e; } .qr { width: 33mm; height: 33mm; } small { font-size: 8pt; color: #80624a; margin-top: 1mm; }
      .bar { position: fixed; top: 12px; left: 12px; } .bar button { background: #3b2d1e; color: #fff8ef; border: 0; padding: 10px 18px; border-radius: 10px; font: inherit; cursor: pointer; }
      @media print { .bar { display: none; } }
    </style></head><body><div class="bar"><button onclick="window.print()">🖨 הדפסה</button></div><div class="g">${card.repeat(8)}</div></body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 800);
  }
  // QR קטן להזמנה מסוימת (פתק ההזמנה המודפס)
  FB.orderQr = async o => FB.ready() ? { url: FB.link(o.num), img: await FB.qrDataUrl(FB.link(o.num), 300) } : null;

  /* ---------- הדף ---------- */
  P.feedback = {
    title: 'משובים מלקוחות',
    render(main) {
      const f = fs(), b = cfg();
      if (!f.enabled || !f.slug) {
        main.innerHTML = `<div class="card"><div class="empty"><h3>קודם מפעילים את טופס ההזמנות</h3><p>טופס המשוב עובד יחד עם הקישור הקבוע של טופס ההזמנות.</p><a class="btn" href="#/form">${A.icon('link')}לטופס ההזמנות</a></div></div>`;
        return;
      }
      const all = A.state.feedback.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
      const fresh = new Set(all.filter(x => x.status === 'new').map(x => x.id));
      const ins = FB.insights(all, b.questions, U.today());
      const filters = [['all', 'הכול', all.length], ['care', 'דורש טיפול', ins.care], ['photos', 'עם תמונות', ins.withPhotos], ['consent', 'מותר לפרסם', all.filter(x => x.consent).length], ['done', 'טופלו', all.filter(x => x.status === 'done').length]];
      const q = view.q.trim();
      const list = all.filter(x => view.filter === 'all' || (view.filter === 'care' && FB.needsCare(x)) || (view.filter === 'photos' && x.photos > 0) || (view.filter === 'consent' && x.consent) || (view.filter === 'done' && x.status === 'done'))
        .filter(x => !q || `${x.name} ${x.phone} ${x.note} ${(x.answers || []).map(a => a.value).join(' ')}`.includes(q));
      main.innerHTML = `${shareCard(f, b)}
        ${all.length ? `<div class="grid g4 section">
          <div class="card kpi"><div class="lbl">דירוג ממוצע</div><div class="val">${ins.rated ? ins.overall.toFixed(1) : '—'} <span class="fb-star">★</span></div><div class="sub">${ins.rated} דירוגים${ins.trend != null ? ` · ${ins.trend >= 0 ? '▲' : '▼'} ${Math.abs(ins.trend).toFixed(1)} מהחודש הקודם` : ''}</div></div>
          <div class="card kpi"><div class="lbl">משובים</div><div class="val">${ins.n}</div><div class="sub">${ins.withPhotos} עם תמונות</div></div>
          <div class="card kpi"><div class="lbl">מרוצות (4–5 כוכבים)</div><div class="val">${ins.rated ? U.pct(ins.happy) : '—'}</div></div>
          <div class="card kpi ${ins.care ? 'fb-alert' : ''}"><div class="lbl">דורש טיפול</div><div class="val">${ins.care}</div><div class="sub">${ins.care ? 'דירוג נמוך שעוד לא טופל' : 'הכול מטופל 🤍'}</div></div>
        </div>${insightsCard(ins)}` : ''}
        <div class="card section">
          <div class="card-h"><h3>${A.icon('msg')}התשובות</h3>${all.length ? `<button class="btn sm ghost" data-act="csv">${A.icon('download')}ייצוא לאקסל</button>` : ''}</div>
          ${all.length ? `<div class="row" style="margin-bottom:10px;gap:8px">
            <div class="seg">${filters.map(([k, l, n]) => `<button data-filter="${k}" class="${view.filter === k ? 'on' : ''}">${l}${n ? ` · ${n}` : ''}</button>`).join('')}</div>
            <div class="search" style="flex:1;min-width:160px">${A.icon('search')}<input type="search" placeholder="חיפוש בתשובות" value="${U.esc(view.q)}" data-f="q"></div></div>
            ${list.map(x => itemHtml(x, fresh.has(x.id))).join('') || '<p class="muted small">אין משובים בסינון הזה</p>'}`
          : `<div class="empty"><h3>עוד אין משובים</h3><p>מדפיסים את הכרטיס עם ה־QR ומכניסים לכל הזמנה, או שולחים את הקישור בוואטסאפ אחרי האיסוף.<br>כל תשובה תופיע כאן אוטומטית.</p></div>`}
        </div>`;
      drawQr(main);
      fillPhotos(main);
      // מה שהוצג — כבר לא "חדש" (ההדגשה נשארת עד היציאה מהדף)
      if (fresh.size) { A.state.feedback.forEach(x => { if (fresh.has(x.id)) x.status = 'open'; }); A.save(); A.updateBadges && A.updateBadges(); }
      main.onclick = e => onClick(e, main);
      main.oninput = e => { if (e.target.dataset.f === 'q') { view.q = e.target.value; const p = e.target.selectionStart; A.refresh(); const i = main.querySelector('[data-f=q]'); if (i) { i.focus(); i.setSelectionRange(p, p); } } };
      main.onchange = e => { if (e.target.dataset.act === 'onoff') { b.on = e.target.checked; A.commit(b.on ? 'טופס המשוב פתוח' : 'טופס המשוב נסגר'); } };
    }
  };

  function shareCard(f, b) {
    const link = FB.link();
    const wa = `היי! 🤍 נשמח לשמוע איך היה — פחות מדקה:\n${link}`;
    return `<div class="card section">
      <div class="card-h"><h3>${A.icon('star')}טופס המשוב</h3><label class="switch-row"><span class="switch"><input type="checkbox" data-act="onoff" ${b.on ? 'checked' : ''}><i></i></span><b>${b.on ? 'פתוח' : 'סגור'}</b></label></div>
      <div class="fp-top">
        <div class="stack">
          <input readonly dir="ltr" value="${U.esc(link)}" data-selectall aria-label="הקישור לטופס המשוב">
          <div class="row">
            <button class="btn sm" data-act="print">${A.icon('print')}הדפסת כרטיסים להזמנות</button>
            <button class="btn sm soft" data-act="png">${A.icon('image')}תמונת QR להורדה</button>
            <button class="btn sm soft" data-act="copy">${A.icon('copy')}העתקת הקישור</button>
            <a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(wa)}">${A.icon('msg')}וואטסאפ</a>
          </div>
          <div class="row"><button class="btn sm ghost" data-act="preview">${A.icon('search')}תצוגה מקדימה</button><button class="btn sm ghost" data-act="edit">${A.icon('edit')}עריכת השאלות</button></div>
          <p class="small muted" style="margin:0">${b.questions.filter(q => q.type === 'rating').length} שאלות דירוג (1–5) · ${b.questions.filter(q => q.type === 'text').length} שאלות פתוחות${b.photos !== false ? ' · אפשר לצרף תמונות' : ''}. בפתק ההזמנה המודפס ובהודעת "בקשת חוות דעת" בוואטסאפ יש קישור שמחובר להזמנה עצמה.</p>
          ${!b.on ? '<div class="notice">הטופס סגור — מי שתסרוק תראה הודעה שהמשוב סגור כרגע.</div>' : ''}
        </div>
        <div class="fp-qr"><div class="qr" id="fbQr"></div><div class="small muted" style="margin-top:6px">QR למשוב</div></div>
      </div></div>`;
  }
  function drawQr(main) {
    const el = main.querySelector('#fbQr'); if (!el) return;
    FB.qrDataUrl(FB.link(), 360).then(src => { if (el.isConnected) el.innerHTML = `<img src="${src}" alt="QR לטופס המשוב">`; }).catch(() => { el.innerHTML = '<span class="small muted">QR לא נטען</span>'; });
  }
  function insightsCard(ins) {
    if (ins.n < 3) return `<div class="card section"><div class="card-h"><h3>${A.icon('chart')}איפה להשתפר</h3></div><p class="small muted" style="margin:0">אחרי 3 משובים יופיעו כאן תובנות: מה הכי חזק, מה הכי חלש ומה חוזר על עצמו.</p></div>`;
    const bar = (l, v, n, weak) => `<div class="fb-bar ${weak ? 'weak' : ''}"><span>${U.esc(l)}</span><div><i style="width:${v / 5 * 100}%"></i></div><b>${v.toFixed(1)}</b><small>${n}</small></div>`;
    const maxD = Math.max(1, ...ins.dist);
    const best = ins.perQ.length ? ins.perQ[ins.perQ.length - 1] : null;
    const chips = ws => ws.map(([w, c]) => `<span class="chip">${U.esc(w)} · ${c}</span>`).join(' ');
    return `<div class="card section"><div class="card-h"><h3>${A.icon('chart')}איפה להשתפר</h3></div>
      ${ins.weakest ? `<div class="notice section">${A.icon('alert')}<div><b>הכי כדאי להתמקד ב: ${U.esc(ins.weakest.label)}</b> — ממוצע ${ins.weakest.avg.toFixed(1)} מתוך 5 (${ins.weakest.n} דירוגים). ${best && best.id !== ins.weakest.id ? `הכי חזק: ${U.esc(best.label)} (${best.avg.toFixed(1)}).` : ''}</div></div>`
        : ins.perQ.length ? `<div class="notice info section">${A.icon('check')}<div>כל התחומים מקבלים 4.5 ומעלה — מעולה!</div></div>` : ''}
      <div class="grid g2" style="gap:18px">
        <div>${ins.perQ.length ? `<div class="small muted" style="margin-bottom:6px">ממוצע לכל שאלה (מהחלש לחזק)</div>${ins.perQ.map(p => bar(p.label, p.avg, p.n, ins.weakest && p.id === ins.weakest.id)).join('')}` : ''}</div>
        <div><div class="small muted" style="margin-bottom:6px">התפלגות הדירוג הכללי</div>
          ${[5, 4, 3, 2, 1].map(n => `<div class="fb-bar dist"><span>${'★'.repeat(n)}</span><div><i style="width:${ins.dist[n - 1] / maxD * 100}%"></i></div><b>${ins.dist[n - 1]}</b></div>`).join('')}</div>
      </div>
      ${ins.lowWords.length ? `<p class="small" style="margin:14px 0 4px"><b>חוזר במשובים הפחות טובים:</b></p><div>${chips(ins.lowWords)}</div>` : ''}
      ${ins.highWords.length ? `<p class="small" style="margin:12px 0 4px"><b>מה אוהבים (במשובים של 4–5):</b></p><div>${chips(ins.highWords)}</div>` : ''}
    </div>`;
  }
  function itemHtml(x, isNew) {
    const care = FB.needsCare(x);
    const order = x.order ? A.state.orders.find(o => +o.num === +x.order) : null;
    const rat = (x.answers || []).filter(a => a.type === 'rating'), txt = (x.answers || []).filter(a => a.type === 'text');
    const when = A.sentAt ? A.sentAt({ createdTs: x.at }) : U.fmtDate(x.date);
    return `<div class="fb-item ${care ? 'care' : ''} ${x.status === 'done' ? 'done' : ''}" data-id="${x.id}">
      <div class="fb-head"><span class="fb-stars" aria-label="${x.rating ? x.rating + ' מתוך 5' : 'בלי דירוג כללי'}">${stars(x.rating) || '<span class="small muted">בלי דירוג</span>'}</span>
        <b>${U.esc(x.name || 'ללא שם')}</b>${x.phone ? ` <span class="small muted" dir="ltr">${U.esc(x.phone)}</span>` : ''}
        <span class="small muted">${when}</span>
        ${isNew ? '<span class="badge brown">חדש</span>' : ''}${care ? '<span class="badge bad">דורש טיפול</span>' : ''}${x.status === 'done' ? '<span class="badge ok">טופל</span>' : ''}${x.consent ? '<span class="badge info">מותר לפרסם</span>' : ''}
        ${order ? `<button class="chip" data-order="${order.id}" style="cursor:pointer">הזמנה #${order.num}</button>` : x.order ? `<span class="chip">הזמנה #${x.order}</span>` : ''}</div>
      ${rat.length > 1 || (rat.length === 1 && !x.rating) ? `<div class="fb-rats">${rat.slice(x.rating ? 1 : 0).map(a => `<span class="chip ${+a.value <= 2 ? 'low' : ''}">${U.esc(a.label)} <b>${+a.value}</b>★</span>`).join('')}</div>` : ''}
      ${txt.map(a => `<div class="fb-txt"><small>${U.esc(a.label)}</small><p>${U.esc(a.value)}</p></div>`).join('')}
      ${x.photos ? `<div class="fb-phs" data-phs="${x.id}">${'<span class="fb-ph ph-wait"></span>'.repeat(x.photos)}</div>` : ''}
      ${x.note ? `<div class="fb-note">${A.icon('edit', 'inl')} <b>מה עשיתי:</b> ${U.esc(x.note)}</div>` : ''}
      <div class="row fb-acts">
        <button class="btn sm ${x.status === 'done' ? 'ghost' : 'soft'}" data-done="${x.id}">${A.icon('check')}${x.status === 'done' ? 'החזרה לטיפול' : 'סימון כטופל'}</button>
        <button class="btn sm ghost" data-note="${x.id}">${A.icon('edit')}${x.note ? 'עריכת הערה' : 'הערה: מה עשיתי'}</button>
        ${x.phone ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${U.wa(x.phone, `היי ${(x.name || '').split(' ')[0]}, תודה על המשוב! `)}">${A.icon('msg')}תשובה בוואטסאפ</a>` : ''}
        ${x.consent && txt.length ? `<button class="btn sm ghost" data-quote="${x.id}">${A.icon('copy')}העתקה כהמלצה</button>` : ''}
        <button class="icon-btn" data-del="${x.id}" aria-label="מחיקת המשוב">${A.icon('trash')}</button>
      </div></div>`;
  }

  async function onClick(e, main) {
    const t = e.target.closest('button, a'); if (!t) return;
    const byId = id => A.state.feedback.find(x => x.id === id);
    const act = t.dataset.act;
    if (t.dataset.filter) { view.filter = t.dataset.filter; return A.refresh(); }
    if (act === 'copy') return A.copy(FB.link()).then(() => A.toast('הקישור הועתק'));
    if (act === 'preview') return root.open(FB.link() + '&preview=1', '_blank', 'noopener');
    if (act === 'print') return printCards();
    if (act === 'png') return downloadCard();
    if (act === 'edit') return openEditor();
    if (act === 'csv') return exportCsv();
    if (t.dataset.order) return A.openOrder(t.dataset.order);
    if (t.dataset.done) { const x = byId(t.dataset.done); x.status = x.status === 'done' ? 'open' : 'done'; return A.commit(x.status === 'done' ? 'סומן כטופל' : 'הוחזר לטיפול'); }
    if (t.dataset.note) return openNote(byId(t.dataset.note));
    if (t.dataset.quote) {
      const x = byId(t.dataset.quote), txt = x.answers.filter(a => a.type === 'text').map(a => a.value).join(' ');
      return A.copy(`״${txt}״${x.name ? ` — ${x.name.split(' ')[0]}` : ''}${x.rating ? ' ' + '⭐'.repeat(x.rating) : ''}`).then(() => A.toast('ההמלצה הועתקה — אפשר להדביק בסטורי'));
    }
    if (t.dataset.zoom) {
      const x = byId(t.dataset.zoom), arr = await FB.photosOf(x).catch(() => []), s = arr[+t.dataset.i]; if (!s) return;
      A.modal({ title: `תמונה מ${U.esc(x.name || 'לקוחה')}`, body: `<img src="${s}" alt="" style="width:100%;border-radius:12px;display:block">`,
        foot: `<button class="btn" data-save>${A.icon('download')}שמירה למכשיר</button><button class="btn ghost" data-close>סגירה</button>`,
        onMount(w) { w.querySelector('[data-save]').onclick = () => A.download(`feedback-${x.sid}-${+t.dataset.i + 1}.jpg`, dataUrlBlob(s), 'image/jpeg'); } });
      return;
    }
    if (t.dataset.del) {
      const x = byId(t.dataset.del);
      if (!confirm('למחוק את המשוב? הוא יימחק לגמרי, כולל התמונות, ואי אפשר לשחזר.')) return;
      const src = sources().find(s => s.slug === x.slug);
      try { if (src) await rpc('feedback_delete', { p_key: src.key, p_slug: x.slug, p_id: x.sid }); }
      catch (err) { return A.toast('אין חיבור — נסי למחוק שוב כשיהיה אינטרנט'); }
      A.state.feedback = A.state.feedback.filter(f => f.id !== x.id); phCache.delete(x.id); A.kvPut('fbph-' + x.id, null);
      A.commit('המשוב נמחק');
    }
  }
  function openNote(x) {
    A.modal({
      title: 'מה עשיתי עם המשוב', body: `<label class="field"><span>למשל: "התקשרתי והתנצלתי, קיבלה קופון" או "שיניתי את האריזה"</span><textarea name="note" rows="3">${U.esc(x.note || '')}</textarea></label>
        <label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" name="done" ${x.status === 'done' || !x.note ? 'checked' : ''}> לסמן כטופל</label>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount(w) {
        w.querySelector('[data-save]').onclick = () => {
          x.note = w.querySelector('[name=note]').value.trim().slice(0, 500);
          x.status = w.querySelector('[name=done]').checked ? 'done' : (x.status === 'done' ? 'open' : x.status);
          A.closeModal(); A.commit('נשמר');
        };
      }
    });
  }
  function exportCsv() {
    const qs = [];
    A.state.feedback.forEach(x => (x.answers || []).forEach(a => { if (!qs.some(q => q.id === a.id)) qs.push({ id: a.id, label: a.label }); }));
    const cell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['תאריך', 'שם', 'טלפון', 'דירוג כללי', ...qs.map(q => q.label), 'תמונות', 'מותר לפרסם', 'הזמנה', 'מצב', 'מה עשיתי'];
    const rows = A.state.feedback.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).map(x => [
      x.date, x.name, x.phone, x.rating || '', ...qs.map(q => { const a = (x.answers || []).find(a => a.id === q.id); return a ? a.value : ''; }),
      x.photos || '', x.consent ? 'כן' : '', x.order || '', x.status === 'done' ? 'טופל' : FB.needsCare(x) ? 'דורש טיפול' : '', x.note || '']);
    A.download(`feedback-${U.today()}.csv`, '﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* ---------- עריכת השאלות ---------- */
  function openEditor() {
    const b = cfg(), d = U.clone(b);
    const newId = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const rows = () => d.questions.map((q, i) => `<div class="fbq-row" data-i="${i}">
        <input value="${U.esc(q.label)}" data-ql="${i}" placeholder="השאלה" aria-label="שאלה ${i + 1}">
        <select data-qt="${i}" aria-label="סוג">${A.opts([['rating', 'כוכבים 1–5'], ['text', 'כתיבה חופשית']], q.type)}</select>
        <label class="row small" style="gap:4px;white-space:nowrap"><input type="checkbox" data-qr="${i}" ${q.required ? 'checked' : ''}>חובה</label>
        <span class="row" style="gap:0"><button type="button" class="icon-btn" data-up="${i}" aria-label="למעלה" ${i ? '' : 'disabled'}>▲</button><button type="button" class="icon-btn" data-dn="${i}" aria-label="למטה" ${i < d.questions.length - 1 ? '' : 'disabled'}>▼</button><button type="button" class="icon-btn" data-rmq="${i}" aria-label="מחיקה">${A.icon('trash')}</button></span>
      </div>`).join('');
    A.modal({
      title: 'עריכת טופס המשוב', size: 'wide',
      body: `<div class="form-grid">
          <label class="field"><span>כותרת</span><input name="title" value="${U.esc(d.title)}" maxlength="80"></label>
          <label class="field"><span>הודעת תודה בסוף</span><input name="thanks" value="${U.esc(d.thanks)}" maxlength="300"></label>
          <label class="field full"><span>פתיח</span><textarea name="intro" rows="2" maxlength="400">${U.esc(d.intro)}</textarea></label>
          <label class="field full"><span>קישור להמלצה בגוגל / אינסטגרם (לא חובה)</span><input name="reviewLink" dir="ltr" value="${U.esc(d.reviewLink)}" placeholder="https://…"><small>מי שנותנת 4–5 כוכבים תקבל כפתור "לכתוב המלצה" שמוביל לכאן</small></label>
          <label class="switch-row full"><span class="switch"><input type="checkbox" name="photos" ${d.photos !== false ? 'checked' : ''}><i></i></span><b>אפשר לצרף תמונות (עד 3)</b></label>
        </div>
        <h4 style="margin:16px 0 6px">השאלות</h4><p class="small muted" style="margin:0 0 8px">שאלת הכוכבים הראשונה היא "הדירוג הכללי" — לפיה מחושב הממוצע והתראות "דורש טיפול".</p>
        <div id="fbqRows">${rows()}</div>
        <div class="row" style="margin-top:8px"><button type="button" class="btn sm soft" data-addq="rating">${A.icon('plus')}שאלת כוכבים</button><button type="button" class="btn sm soft" data-addq="text">${A.icon('plus')}שאלה פתוחה</button>
          <button type="button" class="btn sm ghost" data-reset>חזרה לשאלות המקוריות</button></div>
        <div class="small" id="fbqErr" style="color:var(--bad);margin-top:6px"></div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה ופרסום</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount(w) {
        const box = w.querySelector('#fbqRows'), redraw = () => { box.innerHTML = rows(); };
        w.addEventListener('input', e => { const i = e.target.dataset.ql; if (i != null) d.questions[+i].label = e.target.value; });
        w.addEventListener('change', e => {
          if (e.target.dataset.qt != null) d.questions[+e.target.dataset.qt].type = e.target.value;
          if (e.target.dataset.qr != null) d.questions[+e.target.dataset.qr].required = e.target.checked;
        });
        w.addEventListener('click', e => {
          const t = e.target.closest('button'); if (!t) return;
          const ds = t.dataset, qq = d.questions;
          if (ds.up != null) { const i = +ds.up; [qq[i - 1], qq[i]] = [qq[i], qq[i - 1]]; redraw(); }
          else if (ds.dn != null) { const i = +ds.dn; [qq[i + 1], qq[i]] = [qq[i], qq[i + 1]]; redraw(); }
          else if (ds.rmq != null) { qq.splice(+ds.rmq, 1); redraw(); }
          else if (ds.addq) { if (qq.length >= 12) return A.toast('עד 12 שאלות'); qq.push({ id: newId(), type: ds.addq, label: '', required: false }); redraw(); box.querySelector(`[data-ql="${qq.length - 1}"]`).focus(); }
          else if (ds.reset != null) { if (confirm('לחזור לשאלות המקוריות?')) { d.questions = A.feedbackDefaults().questions; redraw(); } }
          else if (ds.save != null) {
            const err = w.querySelector('#fbqErr');
            d.questions = d.questions.map(q => ({ ...q, label: String(q.label || '').trim() })).filter(q => q.label);
            if (!d.questions.length) { err.textContent = 'צריך לפחות שאלה אחת'; return; }
            const link = w.querySelector('[name=reviewLink]').value.trim();
            if (link && !A.safeUrl(link)) { err.textContent = 'הקישור להמלצה חייב להתחיל ב־https://'; return; }
            Object.assign(b, { title: w.querySelector('[name=title]').value.trim() || 'איך היה?', thanks: w.querySelector('[name=thanks]').value.trim(), intro: w.querySelector('[name=intro]').value.trim(),
              reviewLink: link, photos: w.querySelector('[name=photos]').checked, questions: d.questions });
            A.closeModal(); A.commit('נשמר — הטופס מתעדכן תוך כמה שניות');
          }
        });
      }
    });
  }
})(window);
