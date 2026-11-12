/* על הגשר — טופס משוב ללקוחות (נפתח מ־QR על ההזמנה): דירוג 1–5, טקסט חופשי ותמונות */
(function () {
  const SB_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co';
  const SB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const qs = new URLSearchParams(location.search);
  const slug = (qs.get('f') || '').replace(/[^a-z0-9]/g, '').slice(0, 20);
  const orderRef = (qs.get('o') || '').replace(/\D/g, '').slice(0, 8);
  const preview = qs.get('preview') === '1';
  const app = document.getElementById('app');
  const WORDS = ['', 'לא טוב', 'לא משהו', 'בסדר', 'טוב מאוד', 'מושלם!'];
  const MAX_PH = 3;
  const st = { answers: {}, photos: [], busy: 0, sending: false };
  let cfg = null, fb = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = s => /^https:\/\//i.test(String(s || '').trim()) ? String(s).trim() : '';
  const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>';
  const sentKey = () => `al-hagesher-fb-${slug}-${orderRef || 'x'}`;
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };

  async function rpc(fn, body) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${fn}: ${r.status}`);
    return r.json();
  }
  const fail = (msg, retry) => {
    app.innerHTML = `<div class="empty"><p>${esc(msg)}</p>${retry ? '<button class="btn ghost" data-retry style="width:auto">לנסות שוב</button>' : ''}</div>`;
    const b = app.querySelector('[data-retry]'); if (b) b.onclick = () => { app.innerHTML = '<div class="loader"></div>'; start(); };
  };

  async function start() {
    if (!slug) return fail('הקישור לא תקין');
    try { cfg = await rpc('form_get', { p_slug: slug }); }
    catch (e) { return fail('לא הצלחנו לטעון את הטופס. בדקי את החיבור לאינטרנט ונסי שוב.', true); }
    if (!cfg) return fail('הטופס לא נמצא');
    if (cfg.moved && /^[a-z0-9]{4,20}$/.test(cfg.moved)) { const u = new URL(location.href); u.searchParams.set('f', cfg.moved); location.replace(u.href); return; }
    fb = cfg.feedback;
    if (!fb || !fb.on || !(fb.questions || []).length) return fail('טופס המשוב סגור כרגע. תודה שחשבת עלינו 🤍');
    document.title = `${fb.title || 'איך היה?'} · ${cfg.bizName || 'על הגשר'}`;
    if (!preview && orderRef && store.get(sentKey())) return already();
    draw();
  }

  function already() {
    app.innerHTML = `<div class="card done"><div class="ic">✓</div><h1 style="margin-top:12px">כבר קיבלנו ממך משוב</h1>
      <p class="intro">תודה רבה! רוצה להוסיף עוד משהו?</p><button class="btn ghost" data-again>לשליחת משוב נוסף</button></div>`;
    app.querySelector('[data-again]').onclick = draw;
  }

  function draw() {
    const qsHtml = fb.questions.map(q => {
      const opt = q.required ? '' : ' <span class="opt">(לא חובה)</span>';
      if (q.type === 'rating') return `<div class="q" data-q="${esc(q.id)}"><span class="ql" id="l-${esc(q.id)}">${esc(q.label)}${opt}</span>
        <div class="stars" role="radiogroup" aria-labelledby="l-${esc(q.id)}">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} מתוך 5 — ${WORDS[n]}" data-r="${n}">${star}</button>`).join('')}</div>
        <div class="word" aria-live="polite"></div><div class="ferr"></div></div>`;
      return `<div class="q" data-q="${esc(q.id)}"><label for="t-${esc(q.id)}">${esc(q.label)}${opt}</label>
        <textarea id="t-${esc(q.id)}" data-t="${esc(q.id)}" maxlength="2000" rows="3"></textarea><div class="ferr"></div></div>`;
    }).join('');
    app.innerHTML = `${preview ? '<div class="preview-banner">תצוגה מקדימה — המשוב לא יישלח</div>' : ''}
      <h1>${esc(fb.title || 'איך היה?')}</h1>${fb.intro ? `<p class="intro">${esc(fb.intro)}</p>` : ''}
      <div class="card">${qsHtml}</div>
      ${fb.photos !== false ? `<div class="card"><span class="ql" style="display:block;font-weight:700;color:var(--brown);margin-bottom:4px">רוצה לצרף תמונה? <span class="opt" style="color:var(--muted);font-weight:400;font-size:.85rem">(לא חובה)</span></span>
        <p class="note" style="margin:0 0 10px">איך זה נראה אצלך על השולחן — או משהו שלא היה בסדר. עד ${MAX_PH} תמונות.</p>
        <div class="phs" id="phs"></div><div class="ferr" id="phErr"></div></div>` : ''}
      <div class="card">
        <div class="grid2">
          <label class="fld"><span>שם (לא חובה)</span><input type="text" id="name" maxlength="60" autocomplete="name"></label>
          <label class="fld"><span>טלפון (לא חובה)</span><input type="tel" id="phone" maxlength="20" autocomplete="tel" inputmode="tel"></label>
        </div>
        <p class="note">אם משהו לא היה בסדר ותשאירי טלפון — נחזור אלייך.</p>
        <div class="ferr" id="phoneErr"></div>
        <label class="check"><input type="checkbox" id="consent"><span>מותר לשתף את מה שכתבתי${fb.photos !== false ? ' ואת התמונות' : ''} כהמלצה (בלי מספר הטלפון)</span></label>
      </div>
      <div class="err" id="err" hidden></div>
      <button class="btn" id="send">שליחה</button>
      <footer>${esc(cfg.bizName || 'על הגשר')}</footer>`;
    drawPhotos();
    app.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (b) {
        const q = b.closest('[data-q]'), id = q.dataset.q, n = +b.dataset.r;
        st.answers[id] = n; paintStars(q, n); q.classList.remove('bad-q'); q.querySelector('.ferr').textContent = '';
        return;
      }
      const rm = e.target.closest('[data-rm]');
      if (rm) { st.photos.splice(+rm.dataset.rm, 1); drawPhotos(); return; }
      if (e.target.closest('#send')) send();
    };
    app.oninput = e => {
      const t = e.target.dataset.t;
      if (t) { st.answers[t] = e.target.value; const q = e.target.closest('[data-q]'); q.classList.remove('bad-q'); q.querySelector('.ferr').textContent = ''; }
    };
    app.onchange = e => { if (e.target.id === 'phFile') addPhotos(e.target.files); };
    // דירוג במקלדת (חיצים) — לנגישות
    app.onkeydown = e => {
      const b = e.target.closest('[data-r]'); if (!b || !/Arrow(Left|Right)/.test(e.key)) return;
      const n = Math.min(5, Math.max(1, +b.dataset.r + (e.key === 'ArrowLeft' ? 1 : -1)));
      const q = b.closest('[data-q]'); st.answers[q.dataset.q] = n; paintStars(q, n); q.querySelector(`[data-r="${n}"]`).focus(); e.preventDefault();
    };
  }
  function paintStars(q, n) {
    q.querySelectorAll('[data-r]').forEach(x => { const on = +x.dataset.r <= n; x.classList.toggle('on', on); x.setAttribute('aria-checked', +x.dataset.r === n ? 'true' : 'false'); });
    q.querySelector('.word').textContent = WORDS[n] || '';
  }

  /* ---------- תמונות: מוקטנות בטלפון לפני השליחה ---------- */
  function drawPhotos() {
    const el = document.getElementById('phs'); if (!el) return;
    el.innerHTML = st.photos.map((p, i) => `<div class="ph"><img src="${p}" alt="תמונה ${i + 1}"><button type="button" data-rm="${i}" aria-label="הסרת התמונה">✕</button></div>`).join('')
      + Array.from({ length: st.busy }, () => '<div class="ph"><div class="spin"><div class="loader"></div></div></div>').join('')
      + (st.photos.length + st.busy < MAX_PH ? `<label class="addph"><b>+</b>הוספת תמונה<input type="file" id="phFile" accept="image/*" multiple hidden></label>` : '');
  }
  async function addPhotos(files) {
    const err = document.getElementById('phErr'); err.textContent = '';
    const list = Array.from(files || []).slice(0, MAX_PH - st.photos.length - st.busy);
    if (!list.length) return;
    st.busy += list.length; drawPhotos();
    for (const f of list) {
      try { st.photos.push(await shrink(f)); }
      catch (e) { err.textContent = 'לא הצלחנו לפתוח את אחת התמונות. נסי תמונה אחרת או צילום מסך.'; }
      st.busy--; drawPhotos();
    }
  }
  function shrink(file) {
    return new Promise((res, rej) => {
      if (!/^image\//.test(file.type || 'image/')) return rej(new Error('type'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w0 = img.naturalWidth, h0 = img.naturalHeight; if (!w0 || !h0) return rej(new Error('size'));
        let max = 1400, q = 0.82, out = '';
        const c = document.createElement('canvas'), x = c.getContext('2d');
        for (let i = 0; i < 6; i++) {
          const s = Math.min(1, max / Math.max(w0, h0));
          c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
          x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length < 520000) break;
          max = Math.round(max * 0.8); q = Math.max(0.62, q - 0.05);
        }
        out.length < 690000 && out.startsWith('data:image/jpeg') ? res(out) : rej(new Error('big'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }

  /* ---------- שליחה ---------- */
  async function send() {
    if (st.sending) return;
    const errBox = document.getElementById('err'); errBox.hidden = true;
    let first = null;
    fb.questions.forEach(q => {
      const v = st.answers[q.id], empty = v == null || String(v).trim() === '';
      if (q.required && empty) {
        const el = app.querySelector(`[data-q="${CSS.escape(q.id)}"]`);
        el.classList.add('bad-q'); el.querySelector('.ferr').textContent = q.type === 'rating' ? 'נא לסמן כוכבים' : 'נא למלא';
        first = first || el;
      }
    });
    const any = fb.questions.some(q => st.answers[q.id] != null && String(st.answers[q.id]).trim() !== '');
    if (!first && !any) { errBox.textContent = 'נא לענות לפחות על שאלה אחת'; errBox.hidden = false; return; }
    const phone = document.getElementById('phone').value.trim(), digits = phone.replace(/\D/g, '');
    const pErr = document.getElementById('phoneErr'); pErr.textContent = '';
    if (digits && (digits.length < 9 || digits.length > 13)) { pErr.textContent = 'מספר הטלפון לא נראה תקין'; first = first || pErr; }
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (st.busy) { errBox.textContent = 'רגע, התמונות עוד נטענות…'; errBox.hidden = false; return; }
    const answers = {};
    fb.questions.forEach(q => { const v = st.answers[q.id]; if (v != null && String(v).trim() !== '') answers[q.id] = q.type === 'rating' ? +v : String(v).trim(); });
    const body = { answers, photos: fb.photos !== false ? st.photos : [], name: document.getElementById('name').value.trim(), phone, consent: document.getElementById('consent').checked, order: orderRef || '' };
    const overall = (() => { const q = fb.questions.find(q => q.type === 'rating' && answers[q.id]); return q ? answers[q.id] : 0; })();
    if (preview) return done(overall, !!digits, true);
    const btn = document.getElementById('send');
    st.sending = true; btn.disabled = true; btn.textContent = st.photos.length ? 'שולחת את התמונות…' : 'שולחת…';
    try {
      const r = await rpc('feedback_submit', { p_slug: slug, p_fb: body });
      const row = Array.isArray(r) ? r[0] : r;
      if (!row || !row.ok) throw Object.assign(new Error('rejected'), { userMsg: (row && row.msg) || 'השליחה לא הצליחה' });
      store.set(sentKey(), String(Date.now()));
      done(overall, !!digits);
    } catch (e) {
      st.sending = false; btn.disabled = false; btn.textContent = 'שליחה';
      errBox.textContent = e.userMsg || 'השליחה לא הצליחה — בדקי את החיבור לאינטרנט ונסי שוב.'; errBox.hidden = false;
    }
  }
  function done(overall, hasPhone, isPreview) {
    const review = safeUrl(fb.reviewLink);
    app.innerHTML = `${isPreview ? '<div class="preview-banner">תצוגה מקדימה — לא נשלח</div>' : ''}<div class="card done"><div class="ic">✓</div>
      <h1 style="margin-top:12px">${esc(fb.thanks || 'תודה רבה!')}</h1>
      ${overall && overall <= 2 ? `<p class="intro">מצטערות שזה לא היה מושלם הפעם.${hasPhone ? ' נחזור אלייך בהקדם.' : ''}</p>` : ''}
      ${overall >= 4 && review ? `<p class="intro">שמחות שנהנית! אם בא לך לעזור לנו עוד — המלצה קצרה שם עושה המון 🙏</p><a class="btn" href="${esc(review)}" target="_blank" rel="noopener">לכתוב המלצה</a>` : ''}
      </div><footer>${esc(cfg.bizName || 'על הגשר')}</footer>`;
    window.scrollTo(0, 0);
  }
  start();
})();
