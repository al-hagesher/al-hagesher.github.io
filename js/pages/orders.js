/* על הגשר — הזמנות: רשימה, לוח שנה, טופס, וואטסאפ, קליטה מטופס לקוחות */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = { mode: 'list', filter: 'upcoming', q: '', month: null, day: null };

  const statusBadge = o => `<span class="badge ${A.STATUSES[o.status].cls}">${A.STATUSES[o.status].label}</span>`;
  const payBadge = o => { const p = C.payState(o); return `<span class="badge ${p.cls}">${p.label}</span>`; };
  const itemsTxt = o => o.items.map(i => `${U.fmt(i.qty)}× ${i.name}`).join(', ');
  const dateBox = s => { const d = U.parse(s); return `<div class="date-box"><b>${d.getDate()}</b><span>${U.MONTHS[d.getMonth()].slice(0, 3)}׳ · ${U.DAYS[d.getDay()].slice(0, 1)}׳</span></div>`; };
  // מתי ההזמנה נשלחה (מהטופס) או נרשמה (ידנית) — לפי שעון ישראל
  A.sentAt = (o, short) => {
    if (o.createdTs) {
      const dt = new Date(o.createdTs); if (isNaN(dt)) return '';
      const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dt);
      const g = k => (p.find(x => x.type === k) || {}).value, day = `${g('year')}-${g('month')}-${g('day')}`, hm = `${g('hour')}:${g('minute')}`;
      const mins = Math.round((Date.now() - dt) / 6e4);
      const ago = mins < 1 ? 'עכשיו' : mins < 60 ? `לפני ${mins} דק׳` : mins < 24 * 60 ? `לפני ${Math.floor(mins / 60)} שע׳` : '';
      const when = ['היום', 'אתמול'].includes(U.relDay(day)) ? `${U.relDay(day)} ב־${hm}` : `${U.dayName(day)} ${U.fmtDate(day)} ב־${hm}`;
      return short ? when : when + (ago && ago !== 'עכשיו' ? ` (${ago})` : ago === 'עכשיו' ? ' (עכשיו)' : '');
    }
    return o.createdAt ? `${U.dayName(o.createdAt)} ${U.fmtDate(o.createdAt)}` : '';
  };
  A.orderRow = o => {
    const t = C.orderTotals(o);
    return `<div class="list-item click" data-order="${o.id}">${dateBox(o.date)}
      <div class="main"><div class="t">${U.esc(o.customerName || 'ללא שם')} <span class="muted small">#${o.num}</span> ${o.method === 'delivery' ? `<span class="muted" title="משלוח">${A.icon('truck', 'inl')}</span>` : ''}</div>
      <div class="s">${U.relDay(o.date)}${o.time ? ' ' + o.time : ''} · ${U.esc(itemsTxt(o))}</div>
      ${o.createdTs && o.source === 'טופס הזמנה' ? `<div class="s small" style="opacity:.8">${A.icon('clock', 'inl')}נשלחה ${A.sentAt(o, true)}</div>` : ''}</div>
      <div style="text-align:end"><div class="money"><b>${U.money(t.total)}</b></div><div class="row" style="gap:4px;justify-content:flex-end;margin-top:3px">${statusBadge(o)}${o.status !== 'cancelled' ? payBadge(o) : ''}</div></div></div>`;
  };

  function filtered() {
    const today = U.today(), wkEnd = U.addDays(today, 6);
    return A.state.orders.filter(o => {
      if (view.q && !(`${o.customerName} ${o.phone} ${o.num} ${itemsTxt(o)} ${o.notes}`).includes(view.q)) return false;
      switch (view.filter) {
        case 'upcoming': return !['delivered', 'cancelled'].includes(o.status);
        case 'today': return o.date === today && o.status !== 'cancelled';
        case 'week': return o.date >= today && o.date <= wkEnd && o.status !== 'cancelled';
        case 'unpaid': return o.status !== 'cancelled' && C.orderTotals(o).balance > 0.01;
        case 'done': return o.status === 'delivered';
        case 'cancelled': return o.status === 'cancelled';
        default: return true;
      }
    }).sort((a, b) => {
      const k = (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
      return ['done', 'all', 'cancelled'].includes(view.filter) ? -k : k;
    });
  }

  P.orders = {
    title: 'הזמנות',
    render(main) {
      A.setActions(`<a class="btn ghost hide-m" href="#/form">${A.icon('link')}טופס ללקוחות</a><button class="btn ghost hide-m" data-act="weekly">${A.icon('print')}הדפסה שבועית</button><button class="btn" data-act="new">${A.icon('plus')}הזמנה חדשה</button>`);
      const list = filtered();
      const counts = { today: A.state.orders.filter(o => o.date === U.today() && o.status !== 'cancelled').length, unpaid: A.state.orders.filter(o => o.status !== 'cancelled' && C.orderTotals(o).balance > 0.01).length };
      const head = `<div class="row section">
          <div class="seg">${[['list', 'רשימה'], ['cal', 'לוח שנה']].map(([v, l]) => `<button data-mode="${v}" class="${view.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          ${view.mode === 'list' ? `<div class="search">${A.icon('search')}<input type="search" placeholder="שם, טלפון, מוצר, מספר…" value="${U.esc(view.q)}" data-f="q"></div>` : ''}
        </div>`;
      if (view.mode === 'cal') { main.innerHTML = head + calendar(); }
      else {
        const groups = U.groupBy(list, o => o.date);
        main.innerHTML = head + `
        <div class="seg section scroll" style="display:flex">${[['upcoming', 'פתוחות'], ['today', `היום (${counts.today})`], ['week', 'השבוע'], ['unpaid', `לא שולמו (${counts.unpaid})`], ['done', 'נמסרו'], ['cancelled', 'בוטלו'], ['all', 'הכל']].map(([v, l]) => `<button data-filter="${v}" class="${view.filter === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="card">${list.length ? Object.keys(groups).map(d => `<div class="small muted" style="padding:10px 4px 2px;font-weight:700">${U.relDay(d)} · ${U.dayName(d)} ${U.fmtDate(d)} · ${groups[d].length} הזמנות · ${U.money(U.sum(groups[d].filter(o => o.status !== 'cancelled'), o => C.orderTotals(o).total))}</div>${groups[d].map(A.orderRow).join('')}`).join('')
            : `<div class="empty"><h3>אין הזמנות כאן</h3><p>${A.state.orders.length ? 'נסי מסנן אחר' : 'כשתיכנס הזמנה, היא תופיע כאן.'}</p><button class="btn" data-act="new">${A.icon('plus')}הזמנה חדשה</button></div>`}</div>`;
      }
      main.oninput = e => { if (e.target.dataset.f === 'q') { view.q = e.target.value.trim(); const p = e.target.selectionStart; A.refresh(); const i = main.querySelector('[data-f=q]'); i.focus(); i.setSelectionRange(p, p); } };
      main.onclick = e => {
        const b = e.target.closest('[data-mode],[data-filter],[data-order],[data-day],[data-mon],[data-act]'); if (!b) return;
        if (b.dataset.mode) { view.mode = b.dataset.mode; A.refresh(); }
        else if (b.dataset.filter) { view.filter = b.dataset.filter; A.refresh(); }
        else if (b.dataset.order) A.openOrder(b.dataset.order);
        else if (b.dataset.day) { view.day = view.day === b.dataset.day ? null : b.dataset.day; A.refresh(); }
        else if (b.dataset.mon) { const m = view.month || U.today().slice(0, 7) + '-01'; const d = U.parse(m); d.setMonth(d.getMonth() + (+b.dataset.mon)); view.month = U.iso(d); view.day = null; A.refresh(); }
        else if (b.dataset.act === 'new') A.editOrder(null, view.day ? { date: view.day } : null);
      };
      document.getElementById('topActions').onclick = e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'new') A.editOrder(null, view.mode === 'cal' && view.day ? { date: view.day } : null);
        else if (b.dataset.act === 'weekly') A.printWeeklyOrders();
      };
    }
  };

  function calendar() {
    const first = U.parse(view.month || U.today().slice(0, 7) + '-01');
    const y = first.getFullYear(), m = first.getMonth();
    const start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    const byDay = U.groupBy(A.state.orders.filter(o => o.status !== 'cancelled'), o => o.date);
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = U.iso(d), os = byDay[iso] || [];
      if (i >= 35 && d.getMonth() !== m) break;
      cells += `<div class="d ${d.getMonth() !== m ? 'out' : ''} ${iso === U.today() ? 'today' : ''} ${iso === view.day ? 'sel' : ''}" data-day="${iso}">
        <span class="n">${d.getDate()}</span>${os.slice(0, 3).map(o => `<span class="o st-${o.status}">${o.time || ''} ${U.esc((o.customerName || '').split(' ')[0])}</span>`).join('')}
        ${os.length > 3 ? `<span class="small muted">+${os.length - 3}</span>` : ''}${os.length ? `<span class="cnt">${os.length} הז׳</span>` : ''}</div>`;
    }
    const monthOrders = A.state.orders.filter(o => o.status !== 'cancelled' && o.date.slice(0, 7) === U.iso(first).slice(0, 7));
    const dayList = view.day ? A.state.orders.filter(o => o.date === view.day).sort((a, b) => (a.time || '').localeCompare(b.time || '')) : [];
    return `<div class="card section">
      <div class="card-h"><button class="icon-btn" data-mon="-1" aria-label="חודש קודם">${A.icon('right')}</button><h3>${U.MONTHS[m]} ${y}</h3><button class="icon-btn" data-mon="1" aria-label="חודש הבא">${A.icon('left')}</button>
      <span class="spacer"></span><span class="muted small">${monthOrders.length} הזמנות · ${U.money(U.sum(monthOrders, o => C.orderTotals(o).total), 0)}</span></div>
      <div class="cal">${U.DAYS.map(d => `<div class="dh">${d}</div>`).join('')}${cells}</div></div>
      ${view.day ? `<div class="card"><div class="card-h"><h3>${U.dayName(view.day)} ${U.fmtDate(view.day)}</h3><button class="btn sm" data-act="new">${A.icon('plus')}הזמנה ליום הזה</button></div>${dayList.map(A.orderRow).join('') || '<p class="muted">אין הזמנות ביום הזה.</p>'}</div>` : '<p class="muted small">לחצי על יום כדי לראות את ההזמנות שלו.</p>'}`;
  }

  A.ordersFilter = f => { view.mode = 'list'; view.filter = f; };

  /* ---------- כרטיס הזמנה ---------- */
  A.openOrder = id => {
    const o = A.state.orders.find(x => x.id === id); if (!o) return;
    const t = C.orderTotals(o), s = A.state.settings;
    const next = A.STATUS_FLOW[A.STATUS_FLOW.indexOf(o.status) + 1];
    const msgs = waTemplates(o, t);
    A.modal({
      title: `הזמנה #${o.num} · ${U.esc(o.customerName || '')}`,
      body: `<div class="row section">${statusBadge(o)}${o.status !== 'cancelled' ? payBadge(o) : ''}<span class="chip">${U.esc(o.source || '')}${o.formRef ? ' #' + o.formRef : ''}</span>${A.sentAt(o) ? `<span class="small muted" style="display:inline-flex;align-items:center;gap:4px">${A.icon('clock', 'inl')}${o.source === 'טופס הזמנה' ? 'נשלחה' : 'נרשמה'} ${A.sentAt(o)}</span>` : ''}</div>
        <div class="grid g2 section" style="gap:10px">
          <div><div class="muted small">מועד</div><b>${U.dayName(o.date)} ${U.fmtDate(o.date)}${o.time ? ' · ' + o.time : ''}</b> <span class="muted small">(${U.relDay(o.date)})</span></div>
          <div><div class="muted small">${o.method === 'delivery' ? 'משלוח לכתובת' : 'איסוף עצמי'}</div><b>${o.method === 'delivery' ? U.esc(o.address || '—') : '—'}</b></div>
          <div><div class="muted small">טלפון</div><b dir="ltr">${U.esc(o.phone || '—')}</b></div>
          <div><div class="muted small">אמצעי תשלום</div><b>${U.esc(o.payMethod || '—')}</b></div>
        </div>
        ${payNotice(o, t)}
        ${o.allergies ? `<div class="notice section">${A.icon('alert')}<div><b>רגישויות:</b> ${U.esc(o.allergies)}</div></div>` : ''}
        <table class="section"><thead><tr><th>מוצר</th><th class="n">כמות</th><th class="n">מחיר</th><th class="n">סה״כ</th></tr></thead><tbody>
          ${o.items.map(i => `<tr><td>${i.recipeId ? `<a href="#/recipe/${i.recipeId}" data-close>${U.esc(i.name)}</a>` : U.esc(i.name)}${i.description ? `<div class="small muted" style="white-space:pre-wrap;margin-top:2px">${U.esc(i.description)}</div>` : ''}</td><td class="n">${U.fmt(i.qty)}</td><td class="n">${U.money(i.unitPrice)}</td><td class="n">${U.money(i.qty * i.unitPrice)}</td></tr>`).join('')}
          ${t.discount ? `<tr><td colspan="3">הנחה</td><td class="n">−${U.money(t.discount)}</td></tr>` : ''}
          ${t.couponDiscount ? `<tr><td colspan="3">קופון${o.couponCode ? ` · ${U.esc(o.couponCode)}` : ''}</td><td class="n">−${U.money(t.couponDiscount)}</td></tr>` : ''}
          ${t.delivery ? `<tr><td colspan="3">משלוח</td><td class="n">${U.money(t.delivery)}</td></tr>` : ''}
        </tbody><tfoot><tr><td colspan="3">סה״כ לתשלום</td><td class="n">${U.money(t.total)}</td></tr>
          <tr><td colspan="3" style="font-weight:400">שולם</td><td class="n" style="font-weight:400">${U.money(t.paid)}</td></tr>
          ${t.balance ? `<tr><td colspan="3" style="color:var(--bad)">יתרה</td><td class="n" style="color:var(--bad)">${U.money(t.balance)}</td></tr>` : ''}</tfoot></table>
        <div class="row small muted section">עלות חומרים ואריזה: ${U.money(t.cost)} · רווח גולמי: <b style="color:${t.profit >= 0 ? 'var(--ok)' : 'var(--bad)'}">${U.money(t.profit)}</b> · זמן עבודה: ${U.minutes(t.activeMin)}</div>
        ${o.notes ? `<div class="card flat section" style="padding:12px"><b>הערות:</b> <span style="white-space:pre-wrap">${U.esc(o.notes)}</span></div>` : ''}
        <h4 style="margin-bottom:8px">עדכון סטטוס</h4>
        <div class="row section">${Object.entries(A.STATUSES).map(([k, v]) => `<button class="btn sm ${o.status === k ? '' : 'ghost'}" data-status="${k}">${v.label}</button>`).join('')}</div>
        ${o.phone ? `<h4 style="margin-bottom:8px">הודעה ללקוחה בוואטסאפ</h4><div class="row">${msgs.map((m, i) => `<a class="btn sm wa" target="_blank" rel="noopener" href="${U.wa(o.phone, m.text)}">${A.icon('msg')}${m.label}</a>`).join('')}</div>` : ''}`,
      foot: `${next && o.status !== 'cancelled' ? `<button class="btn" data-status="${next}">${A.icon('check')}סמני כ"${A.STATUSES[next].label}"</button>` : ''}
        ${t.balance > 0 && o.status !== 'cancelled' ? `<button class="btn soft" data-paid>${A.icon('wallet')}התקבל תשלום מלא</button>` : ''}
        <button class="btn ghost" data-edit>${A.icon('edit')}עריכה</button><button class="btn ghost hide-m" data-print>${A.icon('print')}פתק</button><button class="btn ghost" data-dup>${A.icon('copy')}שכפול</button>
        <span class="spacer"></span><button class="btn danger" data-del>${A.icon('trash')}</button>`,
      onMount(w) {
        w.addEventListener('click', async e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.status) { o.status = b.dataset.status; if (o.status === 'delivered' && C.orderTotals(o).balance > 0) A.toast('שימי לב: נשארה יתרה לתשלום'); A.save(); A.refresh(); A.openOrder(o.id); }
          else if ('approvepay' in b.dataset) { o.paid = Math.max(+o.paid || 0, o.payDue); if (o.status === 'new') o.status = 'confirmed'; A.save(); A.refresh(); A.openOrder(o.id); A.toast('התשלום אושר וההזמנה מאושרת — שלחי לה אישור בוואטסאפ'); }
          else if ('cancelunpaid' in b.dataset) { o.status = 'cancelled'; A.save(); A.refresh(); A.openOrder(o.id); A.undoToast('ההזמנה בוטלה', () => { o.status = 'new'; A.commit(); }); }
          else if ('paid' in b.dataset) { o.paid = C.orderTotals(o).total; A.save(); A.refresh(); A.openOrder(o.id); A.toast('התשלום נרשם'); }
          else if ('edit' in b.dataset) A.editOrder(o);
          else if ('dup' in b.dataset) { const c = U.clone(o); Object.assign(c, { id: U.uid(), num: s.nextOrderNum++, status: 'new', paid: 0, demo: false, date: U.addDays(U.today(), 1), createdAt: U.today(), createdTs: new Date().toISOString(), source: '', formRef: undefined, payClaim: null }); A.state.orders.push(c); A.save(); A.editOrder(c); }
          else if ('print' in b.dataset) printSlip(o);
          else if ('del' in b.dataset) { A.closeModal(); if (await A.confirm(`למחוק את הזמנה #${o.num}? אם היא בוטלה, עדיף לסמן "בוטלה" כדי שתישאר בסטטיסטיקה.`, 'מחיקה')) { const idx = A.state.orders.indexOf(o); A.state.orders = A.state.orders.filter(x => x !== o); A.commit(); A.undoToast(`הזמנה #${o.num} נמחקה`, () => { A.state.orders.splice(idx, 0, o); A.commit(); }); } }
        });
      }
    });
  };

  A.payOverdue = o => {
    const hrs = +((A.state.form || {}).pay || {}).hours || 24;
    return o.payDue > 0 && (+o.paid || 0) < o.payDue - 0.01 && !o.payClaim && o.status !== 'cancelled' && o.createdTs && (Date.now() - new Date(o.createdTs)) / 36e5 > hrs;
  };
  function payNotice(o, t) {
    if (!(o.payDue > 0) || t.paid >= o.payDue - 0.01 || o.status === 'cancelled') return '';
    const kind = o.payMode === 'full' ? 'תשלום מלא' : 'מקדמה';
    const ago = o.createdTs ? Math.max(0, Math.round((Date.now() - new Date(o.createdTs)) / 36e5)) : null;
    if (o.payClaim) return `<div class="notice info section">${A.icon('wallet')}<div><b>הלקוחה דיווחה ששילמה ${U.money(o.payDue)} ב${U.esc(o.payClaim.method || 'העברה')}.</b> בדקי באפליקציה שהכסף נכנס, ואז אשרי.
      <div style="margin-top:8px"><button class="btn sm" data-approvepay>${A.icon('check')}התשלום התקבל — אישור ההזמנה</button></div></div></div>`;
    return `<div class="notice section">${A.icon('wallet')}<div><b>ממתינה ל${kind}: ${U.money(o.payDue)}.</b> ההזמנה לא מאושרת עד שהתשלום מתקבל${ago != null ? ` · נשלחה לפני ${ago} שעות` : ''}${A.payOverdue(o) ? ' · <b>עבר הזמן לתשלום</b> — אפשר לבטל או לשלוח תזכורת' : ''}.
      <div class="row" style="margin-top:8px"><button class="btn sm" data-approvepay>${A.icon('check')}התשלום התקבל — אישור ההזמנה</button>${A.payOverdue(o) ? `<button class="btn sm danger" data-cancelunpaid>${A.icon('x')}ביטול ההזמנה</button>` : ''}</div></div></div>`;
  }

  function waTemplates(o, t) {
    const biz = A.state.settings.businessName || 'על הגשר';
    const first = (o.customerName || '').split(' ')[0];
    const when = `${U.dayName(o.date)} ${U.fmtDate(o.date)}${o.time ? ' בשעה ' + o.time : ''}`;
    const items = o.items.map(i => `• ${U.fmt(i.qty)} × ${i.name}${i.description ? ` (${i.description})` : ''}`).join('\n');
    const pickup = (A.state.form && A.state.form.pickupAddress) || A.state.settings.address || '';
    const pay = A.state.form && A.state.form.payInfo || '';
    return [
      { label: 'אישור הזמנה', text: `היי ${first}, תודה שהזמנת מ${biz}! 🤎 ההזמנה מאושרת.\n${items}\nמועד: ${when} (${o.method === 'delivery' ? 'משלוח' : 'איסוף'})${o.method !== 'delivery' && pickup ? `\nכתובת לאיסוף: ${pickup}` : ''}\nסה״כ: ${U.money(t.total)}${t.paid ? `\nשולם: ${U.money(t.paid)}` : ''}${pay && t.balance ? `\n${pay}` : ''}\nמחכה לאפות בשבילך!` },
      { label: 'ההזמנה מוכנה', text: `היי ${first}, ההזמנה שלך מ${biz} מוכנה ${o.method === 'delivery' ? 'ויוצאת אלייך' : 'לאיסוף'} 🥐${t.balance ? `\nיתרה לתשלום: ${U.money(t.balance)}` : ''}` },
      { label: 'תזכורת תשלום', text: o.payDue > 0 && t.paid < o.payDue ? `היי ${first}, כדי לאשר את הזמנה #${o.num} חסר${o.payMode === 'full' ? ' התשלום' : 'ה המקדמה'} של ${U.money(o.payDue - t.paid)}.${(A.state.form.pay || {}).bit || A.state.settings.phone ? ` ביט: ${(A.state.form.pay || {}).bit || A.state.settings.phone}` : ''}${A.safeUrl((A.state.form.pay || {}).paybox) ? `\nפייבוקס: ${A.safeUrl(A.state.form.pay.paybox)}` : ''}\nתודה! 🤎` : `היי ${first}, תזכורת עדינה — נשארה יתרה של ${U.money(t.balance)} על הזמנה #${o.num}. אפשר בביט/פייבוקס. תודה! 🤎` },
      { label: 'בקשת חוות דעת', text: `היי ${first}, מקווה שנהניתם! 🤎 אשמח לשמוע איך היה — ואם אהבת, תמונה או המלצה קטנה עוזרות לי מאוד.` },
      ...(A.state.settings.cancellationPolicy ? [{ label: 'מדיניות ביטולים', text: A.state.settings.cancellationPolicy }] : [])
    ].filter(m => m.label !== 'תזכורת תשלום' || t.balance > 0);
  }

  function printSlip(o) {
    const t = C.orderTotals(o), w = root.open('', '_blank');
    if (!w) return A.toast('הדפדפן חסם חלון — אפשרי חלונות קופצים');
    w.document.write(`<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>הזמנה ${o.num}</title><style>body{font-family:Assistant,Arial;max-width:380px;margin:20px auto;color:#2f1d11}h2{font-family:'Frank Ruhl Libre',serif;color:#3b2d1e;margin:6px 0}td{padding:4px 0}.n{text-align:left}hr{border:0;border-top:1px dashed #a8805a}</style></head><body>
      <div style="text-align:center"><img src="${new URL('assets/logo.png', location.href)}" style="width:150px"></div>
      <h2>הזמנה #${o.num}</h2><div>${U.esc(o.customerName)} · <span dir="ltr">${U.esc(o.phone || '')}</span></div>
      <div>${U.dayName(o.date)} ${U.fmtDate(o.date)} ${o.time || ''} · ${o.method === 'delivery' ? 'משלוח: ' + U.esc(o.address || '') : 'איסוף עצמי'}</div><hr>
      <table style="width:100%">${o.items.map(i => `<tr><td>${U.fmt(i.qty)} × ${U.esc(i.name)}${i.description ? `<div style="color:#8a7462;font-size:0.85em;white-space:pre-wrap">${U.esc(i.description)}</div>` : ''}</td><td class="n">${U.money(i.qty * i.unitPrice)}</td></tr>`).join('')}
      ${t.discount ? `<tr><td>הנחה</td><td class="n">−${U.money(t.discount)}</td></tr>` : ''}${t.delivery ? `<tr><td>משלוח</td><td class="n">${U.money(t.delivery)}</td></tr>` : ''}
      <tr><td><b>סה״כ</b></td><td class="n"><b>${U.money(t.total)}</b></td></tr><tr><td>שולם</td><td class="n">${U.money(t.paid)}</td></tr>${t.balance ? `<tr><td>יתרה</td><td class="n">${U.money(t.balance)}</td></tr>` : ''}</table><hr>
      ${o.allergies ? `<p><b>רגישויות:</b> ${U.esc(o.allergies)}</p>` : ''}${o.notes ? `<p>${U.esc(o.notes)}</p>` : ''}
      <p style="text-align:center;color:#8a7462">תודה שבחרת ב${U.esc(A.state.settings.businessName)} 🤎</p></body></html>`);
    w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 500);
  }

  /* ---------- ייצוא שבועי ---------- */
  A.printWeeklyOrders = (fromDate) => {
    const start = fromDate || U.today();
    const end = U.addDays(start, 6);
    const list = A.state.orders.filter(o => o.status !== 'cancelled' && o.date >= start && o.date <= end).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    if (!list.length && !confirm('אין הזמנות השבוע. להציג בכל זאת?')) return;
    const biz = A.state.settings.businessName || 'על הגשר';
    const totals = list.reduce((s, o) => { const t = C.orderTotals(o); s.rev += t.total; s.paid += t.paid; s.bal += t.balance; s.prof += t.profit; return s; }, { rev: 0, paid: 0, bal: 0, prof: 0 });
    const byDay = U.groupBy(list, o => o.date);
    const w = root.open('', '_blank');
    if (!w) return A.toast('הדפדפן חסם חלון — אפשרי חלונות קופצים');
    const dayBlock = (iso) => {
      const os = byDay[iso] || [];
      const dayTotal = os.reduce((s, o) => s + C.orderTotals(o).total, 0);
      return `<section class="day"><h2>${U.dayName(iso)} · ${U.fmtDate(iso)} <span class="muted">· ${os.length} הזמנות · ${U.money(dayTotal)}</span></h2>
        ${os.length ? os.map(o => {
          const t = C.orderTotals(o);
          return `<article class="ord">
            <header><div><b>#${o.num}</b> · ${U.esc(o.customerName || 'ללא שם')}${o.phone ? ` · <span dir="ltr">${U.esc(o.phone)}</span>` : ''}</div>
              <div class="right"><b>${U.money(t.total)}</b>${t.balance ? `<span class="bal"> · יתרה ${U.money(t.balance)}</span>` : ''}</div></header>
            <div class="meta">${o.time ? '⏰ ' + o.time + ' · ' : ''}${o.method === 'delivery' ? '🚚 משלוח: ' + U.esc(o.address || '') : '🛍 איסוף עצמי'}${o.allergies ? ` · <b>⚠ רגישויות: ${U.esc(o.allergies)}</b>` : ''}${o.createdTs && o.source === 'טופס הזמנה' ? ` · <span class="muted">נשלחה ${A.sentAt(o, true)}</span>` : ''}</div>
            <ul class="items">${o.items.map(i => `<li>${U.fmt(i.qty)} × <b>${U.esc(i.name)}</b> ${i.unitPrice ? `<span class="muted">(${U.money(i.unitPrice)}/יח׳ · סה״כ ${U.money(i.qty * i.unitPrice)})</span>` : ''}${i.description ? `<div class="desc">${U.esc(i.description)}</div>` : ''}</li>`).join('')}</ul>
            ${o.notes ? `<div class="notes"><b>הערות:</b> ${U.esc(o.notes)}</div>` : ''}
          </article>`;
        }).join('') : '<p class="empty">אין הזמנות ביום הזה</p>'}
      </section>`;
    };
    const days = [];
    for (let i = 0; i < 7; i++) days.push(U.addDays(start, i));
    w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>סיכום שבועי · ${U.fmtDate(start)}–${U.fmtDate(end)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Assistant', Arial, sans-serif; color: #2f1d11; max-width: 820px; margin: 0 auto; padding: 24px; line-height: 1.45; }
        h1 { font-family: 'Frank Ruhl Libre', serif; color: #3b2d1e; margin: 0 0 4px; font-size: 1.8rem; }
        .topline { color: #8a7462; margin-bottom: 20px; }
        .summary { background: #f7efe5; border-radius: 12px; padding: 14px 18px; margin-bottom: 22px; display: flex; gap: 22px; flex-wrap: wrap; font-size: .95rem; }
        .summary b { color: #3b2d1e; }
        h2 { font-family: 'Frank Ruhl Libre', serif; color: #3b2d1e; border-bottom: 2px solid #a8805a; padding-bottom: 4px; margin: 28px 0 10px; font-size: 1.3rem; }
        .muted { color: #8a7462; font-weight: 400; font-size: .9em; }
        .ord { border: 1px solid #e8ddd0; border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }
        .ord header { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 4px; }
        .ord .right { text-align: left; }
        .ord .meta { color: #5a4030; font-size: .9rem; margin-bottom: 6px; }
        .ord .items { margin: 4px 0; padding-right: 20px; }
        .ord .items li { margin-bottom: 2px; }
        .ord .desc { color: #8a7462; font-size: .85rem; white-space: pre-wrap; padding-right: 8px; }
        .ord .notes { background: #fff8ef; padding: 6px 10px; border-radius: 6px; margin-top: 6px; font-size: .9rem; }
        .ord .bal { color: #b00020; }
        .empty { color: #8a7462; font-style: italic; padding: 6px 10px; }
        .foot { margin-top: 30px; text-align: center; color: #8a7462; font-size: .85rem; }
        .print-btn { position: fixed; top: 16px; left: 16px; background: #3b2d1e; color: #fff8ef; border: 0; padding: 10px 18px; border-radius: 10px; font-size: 1rem; cursor: pointer; font-family: inherit; }
        @media print {
          .print-btn { display: none; }
          body { padding: 12px; }
          .summary { background: #fff; border: 1px solid #ccc; }
        }
        @page { margin: 12mm; }
      </style></head>
      <body>
        <button class="print-btn" onclick="window.print()">🖨 הדפסה</button>
        <h1>${U.esc(biz)} · סיכום שבועי</h1>
        <div class="topline">${U.fmtDate(start)} – ${U.fmtDate(end)}</div>
        <div class="summary">
          <div><b>${list.length}</b> הזמנות</div>
          <div>הכנסה צפויה: <b>${U.money(totals.rev)}</b></div>
          <div>שולם: <b>${U.money(totals.paid)}</b></div>
          ${totals.bal > 0.01 ? `<div>יתרה: <b style="color:#b00020">${U.money(totals.bal)}</b></div>` : ''}
          <div>רווח גולמי: <b style="color:${totals.prof >= 0 ? '#2e7d32' : '#b00020'}">${U.money(totals.prof)}</b></div>
        </div>
        ${days.map(dayBlock).join('')}
        <div class="foot">הופק ב-${U.fmtDate(U.today())} · ${U.esc(biz)}</div>
      </body></html>`);
    w.document.close();
  };

  /* ---------- טופס הזמנה ---------- */
  A.editOrder = (o, preset) => {
    const isNew = !o, s = A.state.settings;
    const d = o ? U.clone(o) : Object.assign({ customerName: '', phone: '', date: U.addDays(U.today(), 1), time: '', method: 'pickup', address: '', deliveryFee: s.defaultDeliveryFee, items: [], discount: 0, paid: 0, payMethod: 'ביט', source: 'וואטסאפ', notes: '', allergies: '', status: 'new' }, preset || {});
    if (!d.items.length) d.items.push({ recipeId: '', name: '', qty: 1, unitPrice: '', description: '' });
    const recipes = A.state.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
    const custs = C.customers();
    const itemHtml = i => `<div class="item-row" data-item>
      <div class="item-main">
        <input list="prodList" value="${U.esc(i.name)}" placeholder="מוצר" data-k="name">
        <input type="number" min="0" step="any" value="${i.qty}" data-k="qty" aria-label="כמות">
        <input type="number" min="0" step="any" value="${i.unitPrice}" placeholder="מחיר" data-k="unitPrice" aria-label="מחיר ליחידה">
        <span class="sub small n" data-k="sum"></span>
        <button class="icon-btn" data-rm aria-label="הסרה">${A.icon('x')}</button>
      </div>
      <textarea class="item-desc" placeholder="תיאור / עיצוב / הקדשה (אופציונלי)" data-k="description" rows="1">${U.esc(i.description || '')}</textarea>
    </div>`;
    A.modal({
      title: isNew ? 'הזמנה חדשה' : `עריכת הזמנה #${o.num}`, size: 'wide',
      body: `<datalist id="prodList">${recipes.map(r => `<option value="${U.esc(r.name)}">${r.price ? U.money(r.price) : ''}</option>`).join('')}</datalist>
        <datalist id="custList">${custs.map(c => `<option value="${U.esc(c.name)}">${U.esc(c.phone || '')}</option>`).join('')}</datalist>
        <div class="form-grid c3">
          <label class="field"><span>שם הלקוחה *</span><input name="customerName" list="custList" value="${U.esc(d.customerName)}" autofocus></label>
          <label class="field"><span>טלפון</span><input type="tel" name="phone" value="${U.esc(d.phone)}" placeholder="050-0000000"></label>
          <label class="field"><span>מקור ההזמנה</span><select name="source">${A.opts(A.SOURCES, d.source)}</select></label>
          <label class="field"><span>תאריך *</span><input type="date" name="date" value="${d.date}"></label>
          <label class="field"><span>שעה</span><input type="time" name="time" value="${d.time || ''}"></label>
          <label class="field"><span>סטטוס</span><select name="status">${A.opts(Object.keys(A.STATUSES), d.status, Object.fromEntries(Object.entries(A.STATUSES).map(([k, v]) => [k, v.label])))}</select></label>
          <div class="field"><span>איסוף / משלוח</span><div class="seg"><button type="button" data-method="pickup" class="${d.method !== 'delivery' ? 'on' : ''}">איסוף עצמי</button><button type="button" data-method="delivery" class="${d.method === 'delivery' ? 'on' : ''}">משלוח</button></div></div>
          <label class="field" data-del-only><span>כתובת למשלוח</span><input name="address" value="${U.esc(d.address || '')}"></label>
          <label class="field" data-del-only><span>דמי משלוח (₪)</span><input type="number" min="0" name="deliveryFee" value="${d.deliveryFee || 0}"></label>
        </div>
        <div class="divider"></div>
        <div class="row between" style="margin-bottom:8px"><h4>מוצרים</h4><span class="small muted">בחרי מוצר מהרשימה — המחיר יתמלא לבד</span></div>
        <div id="items">${d.items.map(itemHtml).join('')}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn ghost sm" data-add>${A.icon('plus')}הוספת פריט ידני</button>
          <button class="btn ghost sm" data-pick>${A.icon('plus')}בחירה מהקטלוג</button>
        </div>
        <div class="divider"></div>
        <div class="form-grid c4">
          <label class="field"><span>הנחה (₪)</span><input type="number" min="0" step="any" name="discount" value="${d.discount || 0}"></label>
          <label class="field"><span>קוד קופון</span><input name="couponCode" value="${U.esc(d.couponCode || '')}" placeholder="קוד הנחה" style="text-transform:uppercase;letter-spacing:.05em"><span class="small" data-coupon-msg></span></label>
          <label class="field"><span>שולם עד עכשיו (₪)</span><input type="number" min="0" step="any" name="paid" value="${d.paid || 0}"></label>
          <label class="field"><span>אמצעי תשלום</span><select name="payMethod">${A.opts(A.PAY_METHODS, d.payMethod)}</select></label>
          <div class="field"><span>סיכום</span><div id="sumBox" style="font-family:var(--serif);font-size:1.5rem;color:var(--brown)"></div></div>
          <label class="field" style="grid-column:span 2"><span>אלרגיות / רגישויות</span><input name="allergies" value="${U.esc(d.allergies || '')}" placeholder="למשל: ללא אגוזים"></label>
          <label class="field" style="grid-column:span 2"><span>הערות (הקדשה, עיצוב, צבעים…)</span><input name="notes" value="${U.esc(d.notes || '')}"></label>
        </div>
        <div id="allergyWarn"></div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}${isNew ? 'שמירת הזמנה' : 'שמירה'}</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount(w) {
        const items = w.querySelector('#items');
        let method = d.method;
        const pickFromCatalog = onPick => {
          let q = '';
          const checked = new Set();
          const dlg = document.createElement('dialog');
          dlg.className = 'wide';
          dlg.style.cssText = 'padding:0;border:0;border-radius:16px;max-width:620px;width:92vw;background:var(--cream);box-shadow:0 20px 60px rgba(0,0,0,.35)';
          const renderList = () => {
            const match = recipes.filter(r => !q || r.name.includes(q));
            return match.length ? match.map(r => `<label class="pick-row"><input type="checkbox" data-rid="${r.id}"${checked.has(r.id) ? ' checked' : ''}><span class="pr-name">${U.esc(r.name)}</span>${r.price ? `<span class="pr-price">${U.money(r.price)}</span>` : ''}</label>`).join('') : '<p class="muted" style="padding:16px;text-align:center">אין מתכונים תואמים</p>';
          };
          const draw = () => {
            dlg.innerHTML = `<div class="m-wrap"><div class="m-head"><h2>בחירת מוצרים מהקטלוג</h2><button class="icon-btn" data-x aria-label="סגירה">${A.icon('x')}</button></div>
              <div class="m-body">
                <div class="row section" style="gap:8px;align-items:center;flex-wrap:wrap">
                  <div class="search" style="flex:1;min-width:180px">${A.icon('search')}<input type="search" placeholder="חיפוש מתכון…" data-pq value="${U.esc(q)}" autofocus></div>
                  <button class="btn ghost sm" data-all>סמני הכל</button>
                  <button class="btn ghost sm" data-none>נקי הכל</button>
                </div>
                <div class="pick-list" data-list>${renderList()}</div>
                <div class="small muted" style="margin-top:8px" data-count>נבחרו: ${checked.size}</div>
              </div>
              <div class="m-foot"><button class="btn" data-ok>${A.icon('check')}הוספת הנבחרים</button><button class="btn ghost" data-x>ביטול</button></div>
            </div>`;
          };
          draw();
          document.body.appendChild(dlg);
          const refreshList = () => { dlg.querySelector('[data-list]').innerHTML = renderList(); dlg.querySelector('[data-count]').textContent = 'נבחרו: ' + checked.size; };
          dlg.addEventListener('change', e => { const cb = e.target.closest('[data-rid]'); if (cb) { if (cb.checked) checked.add(cb.dataset.rid); else checked.delete(cb.dataset.rid); dlg.querySelector('[data-count]').textContent = 'נבחרו: ' + checked.size; } });
          dlg.addEventListener('input', e => { if (e.target.dataset.pq !== undefined) { q = e.target.value.trim(); const pos = e.target.selectionStart; refreshList(); const inp = dlg.querySelector('[data-pq]'); inp.focus(); inp.setSelectionRange(pos, pos); } });
          const close = () => { dlg.close(); dlg.remove(); };
          dlg.addEventListener('click', e => {
            if (e.target.closest('[data-all]')) { recipes.forEach(r => { if (!q || r.name.includes(q)) checked.add(r.id); }); refreshList(); }
            if (e.target.closest('[data-none]')) { if (!q) checked.clear(); else recipes.forEach(r => { if (r.name.includes(q)) checked.delete(r.id); }); refreshList(); }
            if (e.target.closest('[data-x]')) close();
            if (e.target.closest('[data-ok]')) { const picked = recipes.filter(r => checked.has(r.id)); if (!picked.length) return A.toast('לא נבחרו מתכונים'); close(); onPick(picked); }
          });
          dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
          dlg.showModal();
        };
        const showDel = () => w.querySelectorAll('[data-del-only]').forEach(x => x.style.display = method === 'delivery' ? '' : 'none');
        showDel();
        const origCoupon = {
          raw: (o && o.couponCode) || '', code: String((o && o.couponCode) || '').trim().toUpperCase(), discount: +(o && o.couponDiscount) || 0,
          subtotal: ((o && o.items) || []).reduce((s, i) => s + (+i.qty || 0) * (+i.unitPrice || 0), 0)
        };
        const readItems = () => [...items.querySelectorAll('[data-item]')].map(row => {
          const g = k => row.querySelector(`[data-k="${k}"]`).value.trim();
          const name = g('name'), r = A.state.recipes.find(x => x.name === name);
          return { recipeId: r ? r.id : null, name, qty: U.num(g('qty')), unitPrice: U.num(g('unitPrice')), description: g('description'), row };
        }).filter(i => i.name);
        const update = () => {
          const v = A.formData(w.querySelector('.m-body'));
          const its = readItems();
          its.forEach(i => i.row.querySelector('[data-k=sum]').textContent = U.money(i.qty * i.unitPrice));
          const subtotal = its.reduce((s, i) => s + i.qty * i.unitPrice, 0);
          let couponDiscount = 0, couponCode = '', couponErr = '';
          const msgEl = w.querySelector('[data-coupon-msg]');
          const codeInput = (v.couponCode || '').trim().toUpperCase();
          const setMsg = (txt, ok) => { if (msgEl) { msgEl.textContent = txt; msgEl.style.color = ok ? 'var(--ok)' : 'var(--bad)'; } };
          if (codeInput && codeInput === origCoupon.code) {
            // הקופון שכבר שמור בהזמנה — ההנחה הובטחה ללקוחה, אז לא בודקים אותו מחדש (תוקף / מגבלת שימושים).
            // רק אם סכום המוצרים השתנה מחשבים את ההנחה מחדש לפי הקופון.
            const c = C.findCoupon(codeInput);
            couponCode = origCoupon.raw;
            couponDiscount = Math.abs(subtotal - origCoupon.subtotal) < 0.005 || !c ? Math.min(origCoupon.discount, subtotal) : C.couponDiscountFor(c, subtotal);
            setMsg(`✓ הנחה ${U.money(couponDiscount)}`, true);
          } else if (codeInput) {
            const res = C.validateCoupon(codeInput, subtotal, (o && o.createdAt) || U.today(), v.phone, { excludeOrderId: o && o.id });
            if (res.ok) { couponDiscount = res.discount; couponCode = res.coupon.code; setMsg(`✓ הנחה ${U.money(res.discount)}`, true); }
            else { couponErr = res.reason; setMsg('⚠ ' + res.reason, false); }
          } else setMsg('', true);
          d.couponCode = couponCode; d.couponDiscount = couponDiscount; d.couponErr = couponErr;
          const t = C.orderTotals({ items: its, discount: v.discount, couponDiscount, method, deliveryFee: v.deliveryFee, paid: v.paid });
          w.querySelector('#sumBox').innerHTML = `${U.money(t.total)}${couponDiscount ? `<div class="small" style="font-family:var(--sans);color:var(--ok)">− קופון ${U.money(couponDiscount)}</div>` : ''}${t.balance ? `<div class="small" style="font-family:var(--sans);color:var(--bad)">יתרה ${U.money(t.balance)}</div>` : ''}`;
          // התראת אלרגנים מול המוצרים
          const al = (v.allergies || '');
          const hits = al ? its.flatMap(i => { const r = i.recipeId && C.recipe(i.recipeId); return r ? C.allergens(r).filter(a => al.includes(a) || (a === 'אגוזים' && al.includes('אגוז')) || (a === 'חלב' && al.includes('חלבי'))).map(a => `${i.name}: ${a}`) : []; }) : [];
          w.querySelector('#allergyWarn').innerHTML = hits.length ? `<div class="notice" style="margin-top:12px">${A.icon('alert')}<div><b>שימי לב — התאמה לרגישות:</b> ${hits.map(U.esc).join(' · ')}</div></div>` : '';
        };
        update();
        w.oninput = update;
        w.onchange = e => {
          const row = e.target.closest('[data-item]');
          if (row && e.target.dataset.k === 'name') {
            const r = A.state.recipes.find(x => x.name === e.target.value.trim());
            const pr = row.querySelector('[data-k=unitPrice]');
            if (r && r.price) pr.value = r.price;
          }
          if (e.target.name === 'customerName') {
            const c = custs.find(x => x.name === e.target.value.trim()); const ph = w.querySelector('[name=phone]');
            if (c && !ph.value) { ph.value = c.phone || ''; if (c.allergies) w.querySelector('[name=allergies]').value = c.allergies; if (c.address && !w.querySelector('[name=address]').value) w.querySelector('[name=address]').value = c.address; }
          }
          update();
        };
        w.addEventListener('click', e => {
          const m = e.target.closest('[data-method]');
          if (m) { method = m.dataset.method; w.querySelectorAll('[data-method]').forEach(x => x.classList.toggle('on', x === m)); showDel(); update(); }
          if (e.target.closest('[data-add]')) { items.insertAdjacentHTML('beforeend', itemHtml({ name: '', qty: 1, unitPrice: '', description: '' })); items.lastElementChild.querySelector('input').focus(); }
          if (e.target.closest('[data-pick]')) { pickFromCatalog(selected => { selected.forEach(r => items.insertAdjacentHTML('beforeend', itemHtml({ recipeId: r.id, name: r.name, qty: 1, unitPrice: r.price || '', description: '' }))); update(); }); }
          const rm = e.target.closest('[data-rm]'); if (rm) { rm.closest('[data-item]').remove(); update(); }
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.m-body'));
            const its = readItems().map(({ row, ...i }) => i);
            if (!v.customerName) return A.toast('חסר שם לקוחה');
            if (!v.date) return A.toast('חסר תאריך');
            if (!its.length) return A.toast('הוסיפי לפחות מוצר אחד');
            if (its.some(i => !(i.qty > 0))) return A.toast('כמות חייבת להיות גדולה מ־0');
            update();
            if (d.couponErr) { const ci = w.querySelector('[name=couponCode]'); ci.focus(); return A.toast(`קוד הקופון לא תקף: ${d.couponErr}. תקני או מחקי אותו`); }
            const target = o || { id: U.uid(), num: s.nextOrderNum++, createdAt: U.today(), createdTs: new Date().toISOString() };
            Object.assign(target, v, { method, items: its, deliveryFee: method === 'delivery' ? (v.deliveryFee || 0) : 0, discount: v.discount || 0, paid: v.paid || 0, couponCode: d.couponCode || '', couponDiscount: d.couponDiscount || 0, demo: false });
            if (method !== 'delivery') target.address = '';
            if (isNew) A.state.orders.push(target);
            A.save(); A.refresh(); A.openOrder(target.id); A.toast(isNew ? 'ההזמנה נקלטה' : 'נשמר');
          }
        });
      }
    });
  };

})(window);
