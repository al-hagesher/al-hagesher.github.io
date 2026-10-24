/* על הגשר — לקוחות (נבנה אוטומטית מההזמנות) */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = { q: '', sort: 'total' };

  P.customers = {
    title: 'לקוחות',
    render(main) {
      const all = C.customers();
      const today = U.today();
      let list = all.filter(c => !view.q || (`${c.name} ${c.phone} ${c.notes || ''}`).includes(view.q));
      const sorters = { total: (a, b) => b.total - a.total, count: (a, b) => b.count - a.count, last: (a, b) => b.last.localeCompare(a.last), name: (a, b) => (a.name || '').localeCompare(b.name || '', 'he') };
      list.sort(sorters[view.sort]);
      const repeat = all.filter(c => c.count > 1).length;
      const sleeping = all.filter(c => c.count >= 2 && U.diffDays(today, c.last) > 60);
      main.innerHTML = `
        <div class="grid g4 section">
          <div class="card kpi"><div class="lbl">לקוחות</div><div class="val">${all.length}</div></div>
          <div class="card kpi"><div class="lbl">חוזרות</div><div class="val">${all.length ? U.pct(repeat / all.length) : '—'}</div><div class="sub">${repeat} הזמינו יותר מפעם אחת</div></div>
          <div class="card kpi"><div class="lbl">ממוצע ללקוחה</div><div class="val">${U.money(all.length ? U.sum(all, c => c.total) / all.length : 0, 0)}</div></div>
          <div class="card kpi"><div class="lbl">לא הזמינו 60+ יום</div><div class="val">${sleeping.length}</div><div class="sub">הזדמנות להודעה אישית</div></div>
        </div>
        <div class="row section">
          <div class="search">${A.icon('search')}<input type="search" placeholder="חיפוש לקוחה" value="${U.esc(view.q)}" data-f="q"></div>
          <select data-f="sort" style="width:auto">${A.opts([['total', 'לפי סכום'], ['count', 'לפי מספר הזמנות'], ['last', 'לפי הזמנה אחרונה'], ['name', 'לפי שם']], view.sort)}</select>
        </div>
        <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>שם</th><th class="hide-m">טלפון</th><th class="n">הזמנות</th><th class="n">סה״כ</th><th class="n">אחרונה</th></tr></thead><tbody>
          ${list.map(c => `<tr class="click" data-c="${U.esc(c.key)}"><td><b>${U.esc(c.name)}</b>${c.count >= 5 ? ' <span class="badge brown">VIP</span>' : ''}${c.allergies ? ' <span class="badge warn">רגישות</span>' : ''}${c.birthday ? ` <span class="small muted">🎂 ${U.esc(c.birthday)}</span>` : ''}</td>
          <td class="hide-m" dir="ltr" style="text-align:end">${U.esc(c.phone || '')}</td><td class="n">${c.count}</td><td class="n">${U.money(c.total, 0)}</td><td class="n small">${U.fmtDate(c.last)}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty"><h3>עוד אין לקוחות</h3><p>לקוחות נוספות כאן אוטומטית מכל הזמנה.</p></div>`}</div>`;
      main.oninput = e => { if (e.target.dataset.f === 'q') { view.q = e.target.value.trim(); const p = e.target.selectionStart; A.refresh(); const i = main.querySelector('[data-f=q]'); i.focus(); i.setSelectionRange(p, p); } };
      main.onchange = e => { if (e.target.dataset.f === 'sort') { view.sort = e.target.value; A.refresh(); } };
      main.onclick = e => { const r = e.target.closest('[data-c]'); if (r) openCustomer(r.dataset.c); };
    }
  };

  function openCustomer(key) {
    const c = C.customers().find(x => x.key === key); if (!c) return;
    const meta = A.state.customers[key] || {};
    const orders = c.orders.slice().sort((a, b) => b.date.localeCompare(a.date));
    const fav = U.groupBy(orders.filter(o => o.status !== 'cancelled').flatMap(o => o.items), i => i.name);
    const favTop = Object.entries(fav).map(([n, its]) => [n, U.sum(its, i => i.qty)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    A.modal({
      title: U.esc(c.name),
      body: `<div class="grid g3 section" style="gap:10px">
          <div><div class="muted small">הזמנות</div><b>${c.count}</b></div><div><div class="muted small">סה״כ</div><b>${U.money(c.total)}</b></div><div><div class="muted small">לקוחה מאז</div><b>${U.fmtDate(c.first)}</b></div></div>
        ${favTop.length ? `<p class="small"><span class="muted">הכי אוהבת:</span> ${favTop.map(([n, q]) => `${U.esc(n)} (${U.fmt(q)})`).join(' · ')}</p>` : ''}
        <div class="form-grid section">
          <label class="field"><span>תאריך יום הולדת / אירוע</span><input name="birthday" value="${U.esc(meta.birthday || '')}" placeholder="למשל 14/3"></label>
          <label class="field"><span>כתובת קבועה</span><input name="address" value="${U.esc(meta.address || '')}"></label>
          <label class="field full"><span>אלרגיות / רגישויות קבועות</span><input name="allergies" value="${U.esc(meta.allergies || '')}"></label>
          <label class="field full"><span>הערות (העדפות, טעמים, איך הגיעה)</span><textarea name="notes" rows="2">${U.esc(meta.notes || '')}</textarea></label>
        </div>
        <h4 style="margin-bottom:6px">היסטוריית הזמנות</h4>${orders.map(A.orderRow).join('')}`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירת פרטים</button><button class="btn soft" data-new>${A.icon('plus')}הזמנה חדשה</button>${c.phone ? `<a class="btn wa" target="_blank" rel="noopener" href="${U.wa(c.phone, `היי ${(c.name || '').split(' ')[0]}, `)}">${A.icon('msg')}וואטסאפ</a>` : ''}<button class="btn ghost" data-close>סגירה</button>`,
      onMount(w) {
        w.addEventListener('click', e => {
          const o = e.target.closest('[data-order]'); if (o) return A.openOrder(o.dataset.order);
          if (e.target.closest('[data-save]')) { A.state.customers[key] = A.formData(w.querySelector('.form-grid')); A.closeModal(); A.commit('נשמר'); }
          if (e.target.closest('[data-new]')) A.editOrder(null, { customerName: c.name, phone: c.phone || '', allergies: meta.allergies || '', address: meta.address || '' });
        });
      }
    });
  }
})(window);
