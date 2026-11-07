/* על הגשר — קופונים */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};

  const defaultCoupon = () => ({
    id: U.uid(), code: '', type: 'percent', value: 10,
    minOrder: 0, from: '', to: '', maxUses: 0, uses: 0, active: true, note: ''
  });

  const describe = c => {
    const val = c.type === 'percent' ? `${+c.value || 0}%` : U.money(+c.value || 0);
    const parts = [val + ' הנחה'];
    if (c.minOrder) parts.push(`מעל ${U.money(c.minOrder)}`);
    if (c.from || c.to) parts.push([c.from && U.fmtDate(c.from), c.to && U.fmtDate(c.to)].filter(Boolean).join(' – '));
    if (c.maxUses) parts.push(`${c.uses || 0}/${c.maxUses} שימושים`);
    return parts.join(' · ');
  };

  const status = c => {
    const today = U.today();
    if (c.active === false) return { label: 'כבוי', cls: 'bad' };
    if (c.from && today < c.from) return { label: 'עתידי', cls: 'warn' };
    if (c.to && today > c.to) return { label: 'פג תוקף', cls: 'bad' };
    if (c.maxUses && (c.uses || 0) >= c.maxUses) return { label: 'נוצל', cls: 'bad' };
    return { label: 'פעיל', cls: 'ok' };
  };

  P.coupons = {
    title: 'קופונים',
    render(main) {
      A.setActions(`<button class="btn" data-act="new">${A.icon('plus')}קופון חדש</button>`);
      const list = (A.state.coupons || []).slice().sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      const activeCount = list.filter(c => status(c).cls === 'ok').length;
      main.innerHTML = `
        <div class="card section" style="padding:16px">
          <p class="muted" style="margin:0 0 6px"><b>${A.state.coupons.length}</b> קופונים · <b>${activeCount}</b> פעילים</p>
          <p class="muted small" style="margin:0">צרי קודי הנחה שלקוחות יקלידו בטופס ההזמנה. ההנחה תחושב אוטומטית.</p>
        </div>
        <div class="card">
          ${list.length ? `<table style="width:100%">
            <thead><tr><th style="text-align:start">קוד</th><th style="text-align:start">הנחה</th><th style="text-align:start">תוקף</th><th style="text-align:start">שימושים</th><th style="text-align:start">סטטוס</th><th></th></tr></thead>
            <tbody>${list.map(c => {
              const st = status(c);
              return `<tr data-id="${c.id}" style="cursor:pointer">
                <td><b>${U.esc(c.code || '—')}</b>${c.note ? `<div class="small muted">${U.esc(c.note)}</div>` : ''}</td>
                <td>${c.type === 'percent' ? (+c.value || 0) + '%' : U.money(+c.value || 0)}${c.minOrder ? `<div class="small muted">מעל ${U.money(c.minOrder)}</div>` : ''}</td>
                <td class="small">${[c.from && U.fmtDate(c.from), c.to && U.fmtDate(c.to)].filter(Boolean).join(' – ') || '<span class="muted">ללא הגבלה</span>'}</td>
                <td class="small">${c.maxUses ? `${c.uses || 0} / ${c.maxUses}` : (c.uses || 0)}</td>
                <td><span class="badge ${st.cls}">${st.label}</span></td>
                <td style="text-align:end"><button class="icon-btn" data-edit="${c.id}" aria-label="עריכה">${A.icon('edit')}</button></td>
              </tr>`;
            }).join('')}</tbody>
          </table>` : `<div class="empty"><h3>אין קופונים</h3><p>צרי קוד הנחה שלקוחות יוכלו להשתמש בו בטופס ההזמנה.</p><button class="btn" data-act="new">${A.icon('plus')}קופון ראשון</button></div>`}
        </div>`;
      main.onclick = e => {
        const b = e.target.closest('[data-act],[data-edit],[data-id]'); if (!b) return;
        if (b.dataset.act === 'new') editCoupon(null);
        else if (b.dataset.edit) editCoupon(A.state.coupons.find(c => c.id === b.dataset.edit));
        else if (b.dataset.id) editCoupon(A.state.coupons.find(c => c.id === b.dataset.id));
      };
    }
  };

  function editCoupon(c) {
    const isNew = !c, d = c ? U.clone(c) : defaultCoupon();
    A.modal({
      title: isNew ? 'קופון חדש' : `עריכת קופון · ${d.code || ''}`,
      body: `<div class="form-grid c2">
        <label class="field"><span>קוד הקופון *</span><input name="code" value="${U.esc(d.code)}" placeholder="HOLIDAY10" autofocus style="text-transform:uppercase;letter-spacing:.05em"></label>
        <label class="field"><span>תיאור (לך)</span><input name="note" value="${U.esc(d.note || '')}" placeholder="למשל: שבת סוכות"></label>
        <div class="field"><span>סוג הנחה</span><div class="seg"><button type="button" data-type="percent" class="${d.type === 'percent' ? 'on' : ''}">אחוז</button><button type="button" data-type="fixed" class="${d.type === 'fixed' ? 'on' : ''}">סכום קבוע</button></div></div>
        <label class="field"><span>ערך <span data-vlabel>${d.type === 'percent' ? '(%)' : '(₪)'}</span></span><input type="number" min="0" step="any" name="value" value="${d.value}" required></label>
        <label class="field"><span>מינימום הזמנה (₪, אופציונלי)</span><input type="number" min="0" step="any" name="minOrder" value="${d.minOrder || 0}"></label>
        <label class="field"><span>מגבלת שימושים (אופציונלי)</span><input type="number" min="0" step="1" name="maxUses" value="${d.maxUses || 0}" placeholder="0 = ללא הגבלה"></label>
        <label class="field"><span>בתוקף מתאריך (אופציונלי)</span><input type="date" name="from" value="${d.from || ''}"></label>
        <label class="field"><span>בתוקף עד תאריך (אופציונלי)</span><input type="date" name="to" value="${d.to || ''}"></label>
        <label class="field" style="grid-column:span 2"><input type="checkbox" name="active"${d.active !== false ? ' checked' : ''}> קופון פעיל</label>
        ${!isNew && (d.uses || 0) > 0 ? `<p class="muted small" style="grid-column:span 2">נוצל ${d.uses} פעמים</p>` : ''}
      </div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button>${!isNew ? `<button class="btn danger" data-del>${A.icon('trash')}מחיקה</button>` : ''}<button class="btn ghost" data-close>ביטול</button>`,
      onMount(w) {
        let type = d.type;
        w.addEventListener('click', e => {
          const t = e.target.closest('[data-type]');
          if (t) { type = t.dataset.type; w.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x === t)); w.querySelector('[data-vlabel]').textContent = type === 'percent' ? '(%)' : '(₪)'; }
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.m-body'));
            const code = (v.code || '').trim().toUpperCase();
            if (!code) return A.toast('חסר קוד');
            const dup = A.state.coupons.find(x => x.code.toUpperCase() === code && x.id !== d.id);
            if (dup) return A.toast('קוד כזה כבר קיים');
            if (!(+v.value > 0)) return A.toast('הערך חייב להיות גדול מ-0');
            if (type === 'percent' && +v.value > 100) return A.toast('אחוז חייב להיות עד 100');
            const target = c || defaultCoupon();
            Object.assign(target, {
              code, type, value: +v.value || 0,
              minOrder: +v.minOrder || 0, maxUses: +v.maxUses || 0,
              from: v.from || '', to: v.to || '',
              active: !!v.active, note: v.note || ''
            });
            if (isNew) A.state.coupons.push(target);
            A.commit(isNew ? 'הקופון נוסף' : 'הקופון עודכן');
            A.closeModal();
          }
          if (e.target.closest('[data-del]')) {
            if (confirm(`למחוק את הקופון "${d.code}"?`)) {
              A.state.coupons = A.state.coupons.filter(x => x.id !== d.id);
              A.commit('הקופון נמחק'); A.closeModal();
            }
          }
        });
      }
    });
  }
})(window);
