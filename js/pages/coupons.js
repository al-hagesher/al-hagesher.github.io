/* על הגשר — קופונים */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};

  const defaultCoupon = () => ({
    id: U.uid(), code: '', type: 'percent', value: 10,
    minOrder: 0, from: '', to: '', maxUses: 0, active: true, note: '', firstOrderOnly: false, oncePerCustomer: true
  });
  const valText = c => c.type === 'percent' ? `${+c.value || 0}%` : U.money(+c.value || 0);
  const dates = c => c.from && c.to ? `${U.fmtDate(c.from)} – ${U.fmtDate(c.to)}` : c.from ? `מ־${U.fmtDate(c.from)}` : c.to ? `עד ${U.fmtDate(c.to)}` : '';

  // מספר השימושים נגזר מההזמנות עצמן (הזמנה שבוטלה או נמחקה מחזירה את השימוש)
  const status = c => {
    const today = U.today();
    if (+c.maxUses && C.couponUses(c) >= +c.maxUses) return { label: 'נוצל עד הסוף', cls: 'muted', live: false };
    if (c.active === false) return { label: 'כבוי', cls: 'bad', live: false };
    if (c.to && today > c.to) return { label: 'פג תוקף', cls: 'bad', live: false };
    if (c.from && today < c.from) return { label: 'עתידי', cls: 'warn', live: false };
    return { label: 'פעיל', cls: 'ok', live: true };
  };

  function buildFormLink(code) {
    const f = A.state.form; if (!f || !f.enabled || !f.slug) return '';
    return `${A.PUBLIC_BASE}order.html?f=${f.slug}&coupon=${encodeURIComponent(code)}`;
  }
  function buildWaShareText(c) {
    const link = buildFormLink(c.code);
    const biz = A.state.settings.businessName || 'על הגשר';
    const firstLine = c.firstOrderOnly
      ? `🎁 מתנה בשבילך: ${valText(c)} הנחה על ההזמנה הראשונה שלך ב${biz}!`
      : `🎁 מתנה בשבילך: ${valText(c)} הנחה בהזמנה הבאה ב${biz}!`;
    const terms = [
      c.minOrder ? `בהזמנה מעל ${U.money(c.minOrder)}` : '',
      c.to ? `בתוקף עד ${U.fmtDate(c.to)}` : '',
      c.oncePerCustomer && !c.firstOrderOnly ? 'לשימוש חד־פעמי' : ''
    ].filter(Boolean).join(' · ');
    return `${firstLine}\n\nהקוד שלך: *${c.code}*\n${terms ? `(${terms})\n` : ''}${link ? `\nלחצי כאן והקוד יתמלא לבד:\n${link}\n` : ''}\nמחכה לך 🤎`;
  }
  const randomCode = () => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let n = 0; n < 20; n++) {
      let s = 'GESHER'; for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
      if (!C.findCoupon(s)) return s;
    }
    return 'GESHER' + Date.now().toString(36).toUpperCase().slice(-5);
  };

  const cardHtml = c => {
    const st = status(c), used = C.couponOrders(c), n = used.length, given = U.sum(used, o => +o.couponDiscount || 0);
    const link = buildFormLink(c.code), max = +c.maxUses || 0;
    const conds = [c.minOrder ? `בהזמנה מעל ${U.money(c.minOrder)}` : '', dates(c)].filter(Boolean).join(' · ');
    return `<div class="cp-card${st.live ? '' : ' off'}" data-id="${c.id}">
      <div class="cp-top">
        <button class="cp-code" data-copy="${c.id}" title="העתקת הקוד">${U.esc(c.code || '—')}${A.icon('copy')}</button>
        <span class="badge ${st.cls}">${st.label}</span>
        <label class="switch" title="${c.active !== false ? 'כיבוי הקופון' : 'הפעלת הקופון'}"><input type="checkbox" data-toggle="${c.id}"${c.active !== false ? ' checked' : ''} aria-label="קופון פעיל"><i></i></label>
      </div>
      <div class="cp-val"><b>${valText(c)}</b> הנחה${conds ? `<span> · ${conds}</span>` : ''}</div>
      ${c.note ? `<div class="small muted">${U.esc(c.note)}</div>` : ''}
      <div class="cp-tags">
        ${c.firstOrderOnly ? '<span class="chip">הזמנה ראשונה בלבד</span>' : ''}
        ${c.oncePerCustomer ? '<span class="chip">פעם אחת לכל לקוחה</span>' : ''}
        ${max ? `<span class="chip">עד ${max} שימושים בסך הכל</span>` : ''}
        ${!c.firstOrderOnly && !c.oncePerCustomer && !max ? '<span class="chip">ללא הגבלת שימושים</span>' : ''}
      </div>
      <div class="cp-use">
        ${max ? `<div class="cp-bar"><i style="width:${Math.min(n / max * 100, 100)}%"></i></div>` : ''}
        <span>${n ? `נוצל ${n}${max ? ` מתוך ${max}` : ''} ${n === 1 && !max ? 'פעם' : 'פעמים'} · ניתנו ${U.money(given)} הנחה` : (max ? `עוד לא נוצל (0 מתוך ${max})` : 'עוד לא נוצל')}</span>
      </div>
      <div class="cp-acts">
        ${link ? `<a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(buildWaShareText(c))}">${A.icon('msg')}שיתוף</a>
        <button class="btn sm soft" data-link="${c.id}">${A.icon('link')}העתקת קישור</button>` : ''}
        <button class="btn sm ghost" data-edit="${c.id}">${A.icon('edit')}עריכה</button>
      </div>
    </div>`;
  };

  P.coupons = {
    title: 'קופונים',
    render(main) {
      A.setActions(`<button class="btn" data-act="new">${A.icon('plus')}קופון חדש</button>`);
      const all = A.state.coupons || [];
      // פעילים קודם, ואחריהם הכבויים / שנגמרו
      const list = all.slice().sort((a, b) => (status(b).live - status(a).live) || (a.code || '').localeCompare(b.code || ''));
      const live = list.filter(c => status(c).live).length;
      const usedOrders = A.state.orders.filter(o => o.status !== 'cancelled' && o.couponCode);
      const formOn = A.state.form && A.state.form.enabled && A.state.form.slug;
      main.innerHTML = `
        <div class="grid cp-kpis section">
          <div class="card kpi"><div class="lbl">${A.icon('tag')}קופונים פעילים</div><div class="val">${live}</div><div class="sub">מתוך ${all.length}</div></div>
          <div class="card kpi"><div class="lbl">${A.icon('orders')}הזמנות עם קופון</div><div class="val">${usedOrders.length}</div><div class="sub">לא כולל הזמנות שבוטלו</div></div>
          <div class="card kpi"><div class="lbl">${A.icon('heart')}סך ההנחות שניתנו</div><div class="val">${U.money(U.sum(usedOrders, o => +o.couponDiscount || 0))}</div><div class="sub">בכל הקופונים</div></div>
        </div>
        ${!formOn && all.length ? `<div class="notice section">${A.icon('alert')}<div>טופס ההזמנות עוד לא מופעל, אז אין קישור שיתוף לקופונים. אפשר להפעיל אותו ב<a href="#/form">טופס הזמנות</a>, או להזין את הקוד ידנית בהזמנה.</div></div>` : ''}
        ${list.length ? `<div class="cp-grid">${list.map(cardHtml).join('')}</div>`
          : `<div class="card"><div class="empty"><h3>אין עדיין קופונים</h3><p>צרי קוד הנחה, שלחי אותו ללקוחות בוואטסאפ — וההנחה תחושב לבד בטופס ההזמנה.</p><button class="btn" data-act="new">${A.icon('plus')}קופון ראשון</button></div></div>`}
        <p class="small muted" style="margin:14px 4px 0">לקוחה שמקבלת קישור שיתוף נכנסת לטופס כשהקוד כבר מוזן. הקוד נבדק שוב בשרת בזמן שליחת ההזמנה.</p>`;
      const byId = id => A.state.coupons.find(c => c.id === id);
      // הכפתור שבכותרת העמוד יושב מחוץ ל־main — בלי זה "קופון חדש" לא הגיב
      document.getElementById('topActions').onclick = e => { if (e.target.closest('[data-act=new]')) editCoupon(null); };
      main.onclick = e => {
        if (e.target.closest('a[href]') || e.target.closest('.switch')) return;
        const b = e.target.closest('[data-act],[data-copy],[data-link],[data-edit]'); if (!b) return;
        if (b.dataset.act === 'new') editCoupon(null);
        else if (b.dataset.copy) { const c = byId(b.dataset.copy); if (c) A.copy(c.code).then(() => A.toast(`הקוד ${c.code} הועתק`)); }
        else if (b.dataset.link) { const c = byId(b.dataset.link); if (c) A.copy(buildFormLink(c.code)).then(() => A.toast('הקישור עם הקוד הועתק')); }
        else if (b.dataset.edit) editCoupon(byId(b.dataset.edit));
      };
      main.onchange = e => {
        const t = e.target.closest('[data-toggle]'); if (!t) return;
        const c = byId(t.dataset.toggle); if (!c) return;
        c.active = t.checked;
        A.commit(t.checked ? `הקופון ${c.code} הופעל` : `הקופון ${c.code} כובה`);
      };
    }
  };

  function editCoupon(c) {
    const isNew = !c, d = c ? U.clone(c) : defaultCoupon();
    const used = isNew ? [] : C.couponOrders(d).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const sw = (name, on, title, sub) => `<label class="switch-row cp-opt"><span class="switch"><input type="checkbox" name="${name}"${on ? ' checked' : ''}><i></i></span><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
    A.modal({
      title: isNew ? 'קופון חדש' : `עריכת קופון · ${U.esc(d.code || '')}`,
      body: `<div class="form-grid c2">
        <label class="field"><span>קוד הקופון *</span><span class="row" style="gap:6px;flex-wrap:nowrap"><input name="code" value="${U.esc(d.code)}" placeholder="HOLIDAY10" autocomplete="off" autocapitalize="characters" dir="ltr" style="text-transform:uppercase;letter-spacing:.05em;flex:1;min-width:0"${isNew ? ' autofocus' : ''}><button type="button" class="btn sm ghost" data-gen title="קוד אקראי">קוד אקראי</button></span></label>
        <label class="field"><span>תיאור (רק בשבילך)</span><input name="note" value="${U.esc(d.note || '')}" placeholder="למשל: מבצע חנוכה"></label>
        <div class="field"><span>סוג הנחה</span><div class="seg"><button type="button" data-type="percent" class="${d.type === 'percent' ? 'on' : ''}">אחוזים</button><button type="button" data-type="fixed" class="${d.type === 'fixed' ? 'on' : ''}">סכום קבוע</button></div></div>
        <label class="field"><span>גובה ההנחה <span data-vlabel>${d.type === 'percent' ? '(%)' : '(₪)'}</span> *</span><input type="number" min="0" step="any" inputmode="decimal" name="value" value="${d.value}"></label>
        <label class="field"><span>מינימום הזמנה (₪)</span><input type="number" min="0" step="any" inputmode="decimal" name="minOrder" value="${d.minOrder || ''}" placeholder="בלי מינימום"></label>
        <label class="field"><span>מגבלת שימושים כוללת</span><input type="number" min="0" step="1" inputmode="numeric" name="maxUses" value="${d.maxUses || ''}" placeholder="ללא הגבלה"><small>כמה פעמים בסך הכל — לכל הלקוחות יחד</small></label>
        <label class="field"><span>בתוקף מתאריך</span><input type="date" name="from" value="${d.from || ''}"></label>
        <label class="field"><span>בתוקף עד תאריך (כולל)</span><input type="date" name="to" value="${d.to || ''}"></label>
      </div>
      <div class="cp-opts">
        ${sw('oncePerCustomer', d.oncePerCustomer, 'חד־פעמי לכל לקוחה', 'כל לקוחה יכולה להשתמש בקוד פעם אחת בלבד. הבדיקה לפי מספר הטלפון — גם בטופס ההזמנות וגם בהזמנה שאת מזינה.')}
        ${sw('firstOrderOnly', d.firstOrderOnly, 'להזמנה ראשונה בלבד', 'רק ללקוחה חדשה, שאין לה אף הזמנה קודמת מאותו מספר טלפון.')}
        ${sw('active', d.active !== false, 'הקופון פעיל', 'כשכבוי — הקוד לא מתקבל בטופס.')}
      </div>
      ${used.length ? `<div class="divider"></div><h4 style="margin:0 0 6px">הזמנות שהשתמשו בקוד (${used.length})</h4>
        <div class="cp-orders">${used.slice(0, 12).map(o => `<button type="button" class="list-item click" data-order-open="${o.id}"><span class="main"><span class="t">#${o.num} · ${U.esc(o.customerName || '')}</span><span class="s">${U.fmtDate(o.date)}${o.phone ? ` · ${U.esc(o.phone)}` : ''}</span></span><span class="n" style="color:var(--ok)">−${U.money(+o.couponDiscount || 0)}</span></button>`).join('')}
        ${used.length > 12 ? `<p class="small muted" style="margin:6px 0 0">ועוד ${used.length - 12} הזמנות</p>` : ''}</div>` : ''}`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button>${!isNew ? `<button class="btn danger" data-del>${A.icon('trash')}מחיקה</button>` : ''}<button class="btn ghost" data-close>ביטול</button>`,
      onMount(w) {
        let type = d.type;
        w.addEventListener('click', async e => {
          if (e.target.closest('[data-save],[data-del],[data-gen]')) e.preventDefault();
          const t = e.target.closest('[data-type]');
          if (t) { type = t.dataset.type; w.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x === t)); w.querySelector('[data-vlabel]').textContent = type === 'percent' ? '(%)' : '(₪)'; }
          if (e.target.closest('[data-gen]')) { const ci = w.querySelector('[name=code]'); ci.value = randomCode(); ci.dispatchEvent(new Event('input', { bubbles: true })); }
          const oo = e.target.closest('[data-order-open]');
          if (oo) { A.closeModal(); setTimeout(() => A.openOrder(oo.dataset.orderOpen), 60); return; }
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.m-body'));
            const code = String(v.code || '').replace(/\s+/g, '').toUpperCase();
            const bad = (msg, field) => { A.toast(msg); const el = w.querySelector(`[name=${field}]`); if (el) el.focus(); };
            if (!code) return bad('חסר קוד לקופון', 'code');
            if (code.length > 24) return bad('הקוד ארוך מדי (עד 24 תווים)', 'code');
            if (A.state.coupons.some(x => (x.code || '').toUpperCase() === code && x.id !== d.id)) return bad('כבר יש קופון עם הקוד הזה', 'code');
            const value = +v.value || 0, maxUses = Math.max(Math.floor(+v.maxUses || 0), 0), minOrder = Math.max(+v.minOrder || 0, 0);
            if (!(value > 0)) return bad('גובה ההנחה חייב להיות גדול מ־0', 'value');
            if (type === 'percent' && value > 100) return bad('אחוז ההנחה יכול להיות עד 100', 'value');
            if (v.from && v.to && v.from > v.to) return bad('תאריך הסיום לפני תאריך ההתחלה', 'to');
            if (type === 'fixed' && !(minOrder >= value) && !root.confirm(`שימי לב: בלי מינימום הזמנה של לפחות ${U.money(value)}, הזמנה קטנה יכולה לצאת בחינם. לשמור בכל זאת?`)) return bad('אפשר להוסיף מינימום הזמנה', 'minOrder');
            const target = c || defaultCoupon(), oldCode = String((c && c.code) || '').toUpperCase();
            Object.assign(target, {
              code, type, value, minOrder, maxUses, from: v.from || '', to: v.to || '',
              active: !!v.active, note: (v.note || '').trim(),
              firstOrderOnly: !!v.firstOrderOnly, oncePerCustomer: !!v.oncePerCustomer
            });
            delete target.uses; // המונה הישן — השימושים נספרים מההזמנות
            // שינוי שם של קוד: ההזמנות שכבר השתמשו בו ממשיכות להיספר תחת הקוד החדש
            if (!isNew && oldCode && oldCode !== code) A.state.orders.forEach(o => { if (String(o.couponCode || '').toUpperCase() === oldCode) o.couponCode = code; });
            if (isNew) A.state.coupons.push(target);
            A.closeModal();
            A.commit(isNew ? 'הקופון נוסף' : 'הקופון עודכן');
          }
          if (e.target.closest('[data-del]')) {
            const n = used.length;
            if (await A.confirm(`למחוק את הקופון "${d.code}"?${n ? ` ${n} הזמנות שכבר השתמשו בו ישמרו על ההנחה שלהן.` : ''}`, 'מחיקה')) {
              A.state.coupons = A.state.coupons.filter(x => x.id !== d.id);
              A.closeModal();
              A.commit('הקופון נמחק');
            } else editCoupon(c); // אישור המחיקה מחליף את חלון העריכה — מחזירים אותו
          }
        });
      }
    });
  }
})(window);
