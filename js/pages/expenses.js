/* על הגשר — הוצאות ורווחיות: רווח והפסד חודשי, הוצאות קבועות, פריסת ציוד, נקודת איזון */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = { tab: 'pnl', ym: null };
  const ymLabel = ym => { const [y, m] = ym.split('-'); return `${U.MONTHS[+m - 1]} ${y}`; };
  const shift = (ym, n) => { const [y, m] = ym.split('-').map(Number); return U.iso(new Date(y, m - 1 + n, 1)).slice(0, 7); };
  const row = (label, v, cls = '', hint = '') => `<div class="cost-row ${cls}"><span>${label}${hint ? ` <span class="small muted">${hint}</span>` : ''}</span><span class="money">${v}</span></div>`;

  P.expenses = {
    title: 'הוצאות ורווחיות',
    render(main) {
      const ym = view.ym = view.ym || U.today().slice(0, 7);
      A.setActions(`<button class="btn ghost" data-act="newFixed">${A.icon('clock')}הוצאה קבועה</button><button class="btn ghost" data-act="new">${A.icon('plus')}הוצאה</button><button class="btn" data-act="receipt">${A.icon('image')}קבלה</button>`);
      const head = `<div class="row section between">
          <div class="row" style="gap:4px"><button class="icon-btn" data-mon="-1" aria-label="חודש קודם">${A.icon('right')}</button><h3 style="min-width:120px;text-align:center">${ymLabel(ym)}</h3><button class="icon-btn" data-mon="1" aria-label="חודש הבא">${A.icon('left')}</button></div>
          <div class="seg scroll">${[['pnl', 'רווח והפסד'], ['fixed', 'הוצאות קבועות'], ['list', 'כל ההוצאות']].map(([v, l]) => `<button data-tab="${v}" class="${view.tab === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
      main.innerHTML = head + (view.tab === 'pnl' ? pnlView(ym) : view.tab === 'fixed' ? fixedView(ym) : listView(ym));
      main.onclick = e => {
        const b = e.target.closest('[data-tab],[data-mon],[data-e],[data-r],[data-act]'); if (!b) return;
        if (b.dataset.tab) { e.preventDefault(); view.tab = b.dataset.tab; A.refresh(); }
        else if (b.dataset.mon) { view.ym = shift(view.ym, +b.dataset.mon); A.refresh(); }
        else if (b.dataset.e) edit(A.state.expenses.find(x => x.id === b.dataset.e));
        else if (b.dataset.r) editFixed(A.state.recurring.find(x => x.id === b.dataset.r));
        else if (b.dataset.act === 'new') edit();
        else if (b.dataset.act === 'newFixed') editFixed();
        else if (b.dataset.act === 'receipt') A.openReceipt();
      };
      main.onchange = e => {
        const f = e.target;
        if (f.name === 'monthlyHours') { A.state.settings.monthlyHours = Math.max(1, U.num(f.value)); A.commit('נשמר — התמחור עודכן'); }
        if (f.name === 'includeFixed') { A.state.settings.includeFixed = f.checked; A.commit(f.checked ? 'ההוצאות הקבועות נכללות בתמחור' : 'ההוצאות הקבועות לא נכללות בתמחור'); }
      };
      document.getElementById('topActions').onclick = e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'new') edit(); if (b.dataset.act === 'newFixed') editFixed(); if (b.dataset.act === 'receipt') A.openReceipt();
      };
    }
  };

  /* ---------- רווח והפסד ---------- */
  function pnlView(ym) {
    const p = C.pnl(ym), s = A.state.settings, vat = C.vatFactor() > 1;
    const empty = !p.orders && !p.fixed && !p.other;
    const cls = empty ? 'none' : p.netProfit > 0 ? 'ok' : p.netProfit < 0 ? 'bad' : 'none';
    const verdict = empty ? 'עוד אין נתונים לחודש הזה.' : p.netProfit > 0 ? `העסק <b>רווחי</b> החודש: אחרי כל העלויות וההוצאות נשארו לך ${U.money(p.netProfit, 0)}.` : p.netProfit < 0 ? `החודש <b>בהפסד</b> של ${U.money(-p.netProfit, 0)}: ההוצאות גדולות מהרווח על המוצרים.` : 'החודש מאוזן — בלי רווח ובלי הפסד.';
    // נקודת איזון: לפי רווח גולמי ממוצע להזמנה (החודש, או 3 החודשים הקודמים אם החודש ריק)
    let gpo = p.grossPerOrder; if (!gpo) gpo = C.pnl(shift(ym, -3), shift(ym, -1)).grossPerOrder;
    const need = gpo > 0 && (p.fixed + p.other) > 0 ? Math.ceil((p.fixed + p.other) / gpo) : null;
    const pct = need ? Math.min(p.orders / need, 1) : 0;
    const months = []; for (let i = 5; i >= 0; i--) { const m = shift(ym, -i), q = C.pnl(m); months.push({ label: U.MONTHS[+m.slice(5) - 1].slice(0, 3) + '׳', value: q.revenue, value2: q.cogs * C.vatFactor() + q.fixed + q.other, net: q.netProfit }); }
    return `
      <div class="grid g2 section">
        <div class="card">
          <div class="verdict ${cls}" style="margin-bottom:14px"><div class="big">${empty ? '—' : U.money(p.netProfit, 0)}</div><div><b>רווח נקי</b><div class="small">${verdict}</div></div></div>
          ${row('הכנסות מהזמנות', U.money(p.revenue, 0), '', `${p.orders} הזמנות${vat ? ' · כולל מע״מ' : ''}`)}
          ${vat ? row('מע״מ', '−' + U.money(p.revenue - p.net, 0)) : ''}
          ${row('חומרי גלם, אריזה ותנור של מה שנמכר', '−' + U.money(p.cogs, 0))}
          ${row('רווח גולמי', U.money(p.gross, 0), 'total')}
          ${row('הוצאות קבועות', '−' + U.money(p.fixed, 0), '', '<a href="#" data-tab="fixed">פירוט</a>')}
          ${row('הוצאות נוספות', '−' + U.money(p.other, 0), '', 'שיווק, ציוד קטן, פחת…')}
          ${row('רווח נקי', U.money(p.netProfit, 0), 'total')}
          ${p.stockBought ? `<p class="small muted" style="margin:10px 0 0">קניות חומרי גלם ואריזות החודש (${U.money(p.stockBought, 0)}) לא מופיעות כאן כהוצאה, כי העלות שלהן כבר נכללת במוצרים שנמכרו — אחרת היו נספרות פעמיים.</p>` : ''}
        </div>
        <div class="stack">
          <div class="grid g2" style="gap:12px">
            <div class="card kpi"><div class="lbl">${A.icon('clock')}שעות עבודה</div><div class="val">${U.fmt(U.round(p.hours, 1))}</div><div class="sub">לפי זמני המתכונים</div></div>
            <div class="card kpi"><div class="lbl">${A.icon('wallet')}נשאר לך לשעה</div><div class="val ${p.hours && p.perHour < s.hourlyRate ? 'bad' : 'ok'}">${p.hours ? U.money(p.perHour, 0) : '—'}</div><div class="sub">היעד שלך: ${U.money(s.hourlyRate, 0)}</div></div>
          </div>
          <div class="card"><div class="card-h"><h3>${A.icon('trend')}נקודת איזון</h3></div>
            ${need != null ? `<p style="margin:0 0 8px">כדי לכסות את ההוצאות של ${ymLabel(ym)} (${U.money(p.fixed + p.other, 0)}) צריך כ־<b>${need}</b> הזמנות.</p>
              <div class="time-bar" style="height:10px"><i style="width:${pct * 100}%;background:${pct >= 1 ? 'var(--ok)' : 'var(--caramel)'}"></i></div>
              <p class="small muted" style="margin:8px 0 0">${p.orders >= need ? `✓ עברת את נקודת האיזון — כל הזמנה נוספת היא רווח (בממוצע ${U.money(gpo, 0)}).` : `עד עכשיו ${p.orders} הזמנות · חסרות עוד ${need - p.orders}. רווח גולמי ממוצע להזמנה: ${U.money(gpo, 0)}.`}</p>`
              : `<p class="muted" style="margin:0">${p.fixed + p.other > 0 ? 'אחרי ההזמנות הראשונות אחשב כמה הזמנות צריך בחודש כדי לכסות את ההוצאות.' : 'הוסיפי הוצאות קבועות — ואחשב כמה הזמנות צריך בחודש כדי לכסות אותן.'}</p>`}
          </div>
          ${insights(p, s)}
        </div>
      </div>
      <div class="card"><div class="card-h"><h3>${A.icon('chart')}חצי שנה אחרונה</h3><div class="legend"><span><i style="background:var(--brown-3)"></i>הכנסות</span><span><i style="background:var(--caramel)"></i>כל העלויות וההוצאות</span></div></div>
        ${A.chart.bars(months, { series2: true, height: 220 })}
        <div class="row small" style="justify-content:space-around;margin-top:6px">${months.map(m => `<span style="color:${m.net > 0 ? 'var(--ok)' : m.net < 0 ? 'var(--bad)' : 'var(--muted)'}">${m.label}: ${U.money(m.net, 0)}</span>`).join('')}</div></div>`;
  }
  function insights(p, s) {
    const out = [];
    if (p.netProfit > 0 && p.margin >= 0.25) out.push(['good', 'star', `שולי רווח נקי של ${U.pct(p.margin)} — מצוין.`]);
    if (p.hours && p.perHour < s.hourlyRate) out.push(['alert', 'clock', `נשאר לך ${U.money(p.perHour, 0)} לשעה — פחות מהיעד (${U.money(s.hourlyRate)}). שווה לבדוק מחירים או להתמקד במוצרים הרווחיים (סטטיסטיקות ← הנדסת תפריט).`]);
    if (p.fixed && p.net && p.fixed / p.net > 0.3) out.push(['alert', 'wallet', `ההוצאות הקבועות הן ${U.pct(p.fixed / p.net)} מההכנסות — גבוה. אולי יש מנוי או הוצאה שאפשר לוותר עליה?`]);
    if (!A.state.recurring.length) out.push(['', 'clock', 'עוד לא הוספת הוצאות קבועות (גז, חשמל, פרסום, מנויים…). בלעדיהן הרווח נראה גבוה ממה שהוא באמת.']);
    return out.length ? `<div class="card">${out.map(([c, ic, t]) => `<div class="insight ${c}"><div class="ic">${A.icon(ic)}</div><div style="align-self:center">${t}</div></div>`).join('')}</div>` : '';
  }

  /* ---------- הוצאות קבועות ---------- */
  function fixedView(ym) {
    const mf = C.monthlyFixed(ym), s = A.state.settings, perHour = C.fixedPerHour();
    const rec = A.state.recurring.slice().sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name, 'he'));
    return `
      <div class="grid g2 section">
        <div class="card"><div class="card-h"><h3>${A.icon('clock')}הוצאות קבועות</h3><span class="badge">${U.money(mf.recurring, 0)} לחודש</span></div>
          ${rec.length ? rec.map(r => `<div class="list-item click" data-r="${r.id}"><div class="main"><div class="t">${U.esc(r.name)} ${r.active === false ? '<span class="badge muted">מושהית</span>' : ''}${r.end && r.end < U.today() ? '<span class="badge muted">הסתיימה</span>' : ''}</div>
            <div class="s">${U.money(r.amount)} ${A.FREQS[r.freq] || ''} · ${U.esc(r.category || '')}${r.freq !== 'month' ? ` · ${U.money((+r.amount || 0) * (r.freq === 'year' ? 1 / 12 : 52 / 12), 0)} לחודש` : ''}</div></div>${A.icon('edit')}</div>`).join('')
            : `<div class="empty"><h3>אין עדיין הוצאות קבועות</h3><p>גז וחשמל, פרסום, מנויים (קנבה, אתר), ביטוח, רואה חשבון, עמלות בנק…</p><button class="btn" data-act="newFixed">${A.icon('plus')}הוספת הוצאה קבועה</button></div>`}
        </div>
        <div class="stack">
          <div class="card"><div class="card-h"><h3>${A.icon('box')}ציוד בפריסה</h3><span class="badge">${U.money(mf.amortized, 0)} ב${ymLabel(ym)}</span></div>
            ${mf.items.filter(i => i.kind === 'amortized').map(i => `<div class="list-item click" data-e="${i.ref.id}"><div class="main"><div class="t">${U.esc(i.name)}</div><div class="s">${U.money(i.ref.amount, 0)} מחולק ל־${i.ref.amortize} חודשים</div></div><b class="money">${U.money(i.amount, 0)}</b></div>`).join('')
              || '<p class="small muted" style="margin:0">קנייה גדולה (תנור, מיקסר, תבניות)? בהוספת הוצאה בחרי "פריסה לחודשים" — וכל חודש יישא רק את החלק שלו.</p>'}
          </div>
          <div class="card"><div class="card-h"><h3>${A.icon('wallet')}בתמחור המתכונים</h3></div>
            <label class="row" style="gap:8px;font-weight:600;margin-bottom:10px"><input type="checkbox" name="includeFixed" ${s.includeFixed !== false ? 'checked' : ''}> לכלול את ההוצאות הקבועות בעלות של כל מתכון</label>
            <label class="field"><span>כמה שעות את עובדת על העסק בחודש (בערך)</span><input type="number" min="1" name="monthlyHours" value="${s.monthlyHours || 60}"></label>
            <p class="small" style="margin:10px 0 0">${s.includeFixed !== false ? `כל שעת עבודה במתכון נושאת עכשיו <b>${U.money(perHour)}</b> מההוצאות הקבועות (${U.money(C.monthlyFixed(U.today().slice(0, 7)).total, 0)} לחודש ÷ ${s.monthlyHours || 60} שעות). כך המחיר המומלץ מכסה גם אותן.` : 'כרגע המחיר המומלץ לא כולל את ההוצאות הקבועות.'}</p>
          </div>
        </div>
      </div>`;
  }

  /* ---------- כל ההוצאות ---------- */
  function listView(ym) {
    const list = A.state.expenses.filter(e => e.date.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date));
    const total = U.sum(list, e => e.amount);
    const byCat = Object.entries(U.groupBy(list, e => e.category)).map(([k, v]) => ({ label: k, value: U.sum(v, e => e.amount) })).sort((a, b) => b.value - a.value);
    return `<div class="grid cols-main">
      <div class="card"><div class="card-h"><h3>הוצאות ב${ymLabel(ym)}</h3><b class="money">${U.money(total, 0)}</b></div>
        ${list.length ? list.map(e => `<div class="list-item click" data-e="${e.id}"><div class="main"><div class="t">${U.esc(e.desc || e.category)} ${+e.amortize >= 2 ? `<span class="badge info">פריסה ל־${e.amortize} ח׳</span>` : ''}${e.receipt ? `<span class="badge">${A.icon('image', 'inl')} ${(e.items || []).length} פריטים</span>` : ''}</div><div class="s">${U.fmtDate(e.date)} · ${U.esc(e.category)}</div></div><b class="money">${U.money(e.amount)}</b></div>`).join('')
          : `<div class="empty"><h3>אין הוצאות בחודש הזה</h3><p>תעדי קניות, ציוד ושיווק — כדי לדעת כמה באמת נשאר לך.</p><button class="btn" data-act="new">${A.icon('plus')}הוצאה חדשה</button></div>`}</div>
      <div class="card"><div class="card-h"><h3>לפי קטגוריה</h3></div>${A.chart.hbars(byCat, v => U.money(v, 0))}</div></div>`;
  }

  /* ---------- עריכה ---------- */
  function edit(x) {
    const d = x || { date: U.today(), category: 'חומרי גלם', amount: '', desc: '', amortize: '' };
    A.modal({
      title: x ? 'עריכת הוצאה' : 'הוצאה חדשה', size: 'narrow',
      body: `<div class="form-grid">
        <label class="field"><span>סכום (₪) *</span><input type="number" min="0" step="any" name="amount" value="${d.amount}" autofocus></label>
        <label class="field"><span>תאריך</span><input type="date" name="date" value="${d.date}"></label>
        <label class="field full"><span>קטגוריה</span><select name="category">${A.opts(A.EXPENSE_CATS, d.category)}</select></label>
        <label class="field full"><span>תיאור</span><input name="desc" value="${U.esc(d.desc)}" placeholder="למשל: מיקסר / קניות בסיטונאי"></label>
        ${d.receipt ? `<div class="field full"><span>פריטים בקבלה</span><div class="small">${(d.items || []).map(i => `${U.esc(i.text || (C.ing(i.ingId) || {}).name || '')} · ${U.fmt(i.qty)} ${U.esc(i.unit === 'unit' ? 'יח׳' : A.UNITS[i.unit] || '')} · ${U.money(i.price)}${i.ingId ? ' ✓' : ''}`).join('<br>')}</div>${d.image ? `<img src="${A.safeImg(d.image)}" alt="הקבלה" style="max-width:100%;max-height:260px;border-radius:8px;margin-top:8px">` : ''}<small>מחיקת הקבלה מבטלת גם את עדכון המלאי והמחירים.</small></div>` : ''}
        <label class="field full"><span>פריסה לחודשים (לקנייה גדולה)</span><input type="number" min="0" max="60" step="1" name="amortize" value="${d.amortize || ''}" placeholder="למשל 12 — ריק = הוצאה רגילה"><small>מיקסר ב־1,200 ₪ בפריסה ל־12 = 100 ₪ בכל חודש ברווח והפסד.</small></label></div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button><span class="spacer"></span>${x ? `<button class="btn danger" data-del aria-label="מחיקה">${A.icon('trash')}</button>` : ''}`,
      onMount(w) {
        w.addEventListener('click', e => {
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.m-body'));
            if (!(v.amount > 0)) return A.toast('הזיני סכום');
            if (!v.date) return A.toast('חסר תאריך');
            v.amortize = +v.amortize >= 2 ? Math.round(v.amortize) : 0;
            if (x) Object.assign(x, v, { demo: false }); else A.state.expenses.push(Object.assign({ id: U.uid() }, v));
            A.closeModal(); A.commit('נשמר');
          }
          if (e.target.closest('[data-del]')) {
            if (x.receipt) A.removePurchasesFor(x.id);
            A.state.expenses = A.state.expenses.filter(y => y !== x); A.closeModal(); A.commit();
            A.undoToast(x.receipt ? 'הקבלה נמחקה (והמלאי/המחירים חזרו)' : 'ההוצאה נמחקה', () => {
              A.state.expenses.push(x);
              if (x.receipt) (x.items || []).filter(i => i.ingId).forEach(i => { const ing = C.ing(i.ingId); if (ing) try { A.recordPurchase(ing, { date: x.date, qty: i.qty, unit: i.unit, price: i.price, expenseId: x.id }); } catch (err) { } });
              A.commit();
            });
          }
        });
      }
    });
  }
  function editFixed(x) {
    const d = x || { name: '', amount: '', freq: 'month', category: 'חשמל וגז', start: U.today().slice(0, 8) + '01', end: '', active: true };
    A.modal({
      title: x ? 'עריכת הוצאה קבועה' : 'הוצאה קבועה חדשה', size: 'narrow',
      body: `<div class="form-grid">
        <label class="field full"><span>שם *</span><input name="name" value="${U.esc(d.name)}" placeholder="למשל: גז, פרסום באינסטגרם, ביטוח" autofocus></label>
        <label class="field"><span>סכום (₪) *</span><input type="number" min="0" step="any" name="amount" value="${d.amount}"></label>
        <label class="field"><span>כל כמה זמן</span><select name="freq">${A.opts(Object.keys(A.FREQS), d.freq, A.FREQS)}</select></label>
        <label class="field full"><span>קטגוריה</span><select name="category">${A.opts(A.EXPENSE_CATS, d.category)}</select></label>
        <label class="field"><span>החל מ־</span><input type="date" name="start" value="${d.start || ''}"></label>
        <label class="field"><span>עד (לא חובה)</span><input type="date" name="end" value="${d.end || ''}"></label>
        <label class="row full" style="gap:8px"><input type="checkbox" name="active" ${d.active !== false ? 'checked' : ''}> פעילה</label></div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button><span class="spacer"></span>${x ? `<button class="btn danger" data-del aria-label="מחיקה">${A.icon('trash')}</button>` : ''}`,
      onMount(w) {
        w.addEventListener('click', e => {
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.m-body'));
            if (!v.name) return A.toast('חסר שם');
            if (!(v.amount > 0)) return A.toast('הזיני סכום');
            if (v.end && v.start && v.end < v.start) return A.toast('תאריך הסיום לפני תאריך ההתחלה');
            if (x) Object.assign(x, v); else A.state.recurring.push(Object.assign({ id: U.uid() }, v));
            A.closeModal(); A.commit('נשמר — נכלל ברווח והפסד ובתמחור');
          }
          if (e.target.closest('[data-del]')) { const idx = A.state.recurring.indexOf(x); A.state.recurring = A.state.recurring.filter(y => y !== x); A.closeModal(); A.commit(); A.undoToast('ההוצאה הקבועה נמחקה', () => { A.state.recurring.splice(idx, 0, x); A.commit(); }); }
        });
      }
    });
  }
})(window);
