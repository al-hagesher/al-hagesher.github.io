/* על הגשר — מחסן ומחירי מצרכים */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = { q: '', cat: 'הכל', filter: 'all' };

  const pkgLabel = i => `${U.fmt(i.pkgSize)} ${A.PKG_UNITS[i.pkgUnit] || ''}`;
  // מחיר לק"ג/ליטר/יחידה לתצוגה
  const unitPrice = i => {
    if (!(+i.pkgPrice > 0) || !(+i.pkgSize > 0)) return '—';
    if (i.pkgUnit === 'unit') return U.money(i.pkgPrice / i.pkgSize) + ' ליח׳';
    const perKg = i.pkgPrice / A.toGrams(i.pkgSize, i.pkgUnit, i) * 1000;
    return U.money(perKg) + (['ml', 'l'].includes(i.pkgUnit) ? ' לליטר*' : ' לק״ג');
  };
  const usedIn = id => A.state.recipes.filter(r => r.ingredients.some(l => l.ingId === id));
  const low = i => +i.minStock > 0 && (+i.stock || 0) < +i.minStock;

  P.pantry = {
    title: 'מחסן ומחירים',
    render(main) {
      A.setActions(`<button class="btn" data-act="new">${A.icon('plus')}מצרך חדש</button>`);
      const ings = A.state.ingredients;
      const est = ings.filter(i => i.estimated).length, lows = ings.filter(low).length;
      const list = ings.filter(i => {
        if (view.cat !== 'הכל' && i.category !== view.cat) return false;
        if (view.q && !i.name.includes(view.q)) return false;
        if (view.filter === 'low' && !low(i)) return false;
        if (view.filter === 'est' && !i.estimated) return false;
        if (view.filter === 'used' && !usedIn(i.id).length) return false;
        return true;
      }).sort((a, b) => a.category.localeCompare(b.category, 'he') || a.name.localeCompare(b.name, 'he'));
      main.innerHTML = `
        ${est ? `<div class="notice section">${A.icon('alert')}<div><b>${est} מצרכים עם מחיר משוער.</b> המחירים הוזנו כנקודת התחלה לפי מחירי סופר ממוצעים. עדכני אותם לפי הקבלות שלך כדי שהתמחור יהיה מדויק — מצרך שעודכן מסומן אוטומטית כמאומת.</div></div>` : ''}
        <div class="grid g3 section">
          <div class="card kpi"><div class="lbl">מצרכים במחסן</div><div class="val">${ings.length}</div></div>
          <div class="card kpi"><div class="lbl">מתחת למינימום</div><div class="val ${lows ? 'bad' : ''}">${lows}</div><div class="sub">מוגדר לפי "מלאי מינימום"</div></div>
          <div class="card kpi"><div class="lbl">שווי מלאי משוער</div><div class="val">${U.money(U.sum(ings, i => i.pkgSize ? (+i.stock || 0) / i.pkgSize * (+i.pkgPrice || 0) : 0), 0)}</div></div>
        </div>
        <div class="row section">
          <div class="search">${A.icon('search')}<input type="search" placeholder="חיפוש מצרך" value="${U.esc(view.q)}" data-f="q"></div>
          <select data-f="cat" style="width:auto">${A.opts(['הכל', ...A.ING_CATS], view.cat)}</select>
          <div class="seg">${[['all', 'הכל'], ['used', 'בשימוש'], ['low', 'חסרים'], ['est', 'מחיר משוער']].map(([v, l]) => `<button data-filter="${v}" class="${view.filter === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="card">
          <div class="table-wrap"><table>
            <thead><tr><th>מצרך</th><th class="hide-m">קטגוריה</th><th class="n">אריזה</th><th class="n">מחיר</th><th class="n hide-m">מחיר ליחידת מידה</th><th class="n hide-m">גרם לכוס</th><th class="n">מלאי</th><th></th></tr></thead>
            <tbody>${list.map(i => `<tr class="click" data-edit="${i.id}">
              <td><b>${U.esc(i.name)}</b> ${i.estimated ? '<span class="badge warn">משוער</span>' : ''} ${(i.allergens || []).length ? `<span class="small muted">· ${i.allergens.join(', ')}</span>` : ''}</td>
              <td class="hide-m muted small">${U.esc(i.category)}</td>
              <td class="n">${pkgLabel(i)}</td>
              <td class="n">${i.free ? '—' : U.money(i.pkgPrice || 0)}</td>
              <td class="n hide-m small">${i.free ? '—' : unitPrice(i)}</td>
              <td class="n hide-m small">${U.fmt(i.gramsPerCup)}</td>
              <td class="n"><span class="${low(i) ? 'badge bad' : ''}">${U.fmt(i.stock || 0)} ${A.PKG_UNITS[i.pkgUnit] || ''}</span></td>
              <td class="n"><button class="icon-btn" data-edit="${i.id}" aria-label="עריכה">${A.icon('edit')}</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">לא נמצאו מצרכים</td></tr>'}</tbody>
          </table></div>
          <p class="small muted" style="margin:10px 0 0">* מחיר לליטר מחושב לפי הנפח. "גרם לכוס" משמש להמרת כוסות וכפות לגרמים (כוס = 240 מ״ל).</p>
        </div>`;
      main.oninput = e => { if (e.target.dataset.f === 'q') { view.q = e.target.value.trim(); const p = e.target.selectionStart; A.refresh(); const i = main.querySelector('[data-f=q]'); i.focus(); i.setSelectionRange(p, p); } };
      main.onchange = e => { if (e.target.dataset.f === 'cat') { view.cat = e.target.value; A.refresh(); } };
      main.onclick = e => {
        const f = e.target.closest('[data-filter]'); if (f) { view.filter = f.dataset.filter; A.refresh(); return; }
        const ed = e.target.closest('[data-edit]'); if (ed) editIng(C.ing(ed.dataset.edit));
      };
      document.getElementById('topActions').onclick = e => { if (e.target.closest('[data-act=new]')) editIng(); };
    }
  };

  function editIng(i) {
    const isNew = !i;
    const d = i || { name: '', category: 'אחר', pkgPrice: '', pkgSize: 1, pkgUnit: 'kg', gramsPerCup: 240, gramsPerUnit: 0, allergens: [], stock: 0, minStock: 0, supplier: '' };
    const used = i ? usedIn(i.id) : [];
    A.modal({
      title: isNew ? 'מצרך חדש' : U.esc(d.name),
      body: `<div class="form-grid">
        <label class="field"><span>שם *</span><input name="name" value="${U.esc(d.name)}" autofocus></label>
        <label class="field"><span>קטגוריה</span><select name="category">${A.opts(A.ING_CATS, d.category)}</select></label>
        <label class="field"><span>מחיר האריזה (₪)</span><input type="number" step="any" min="0" name="pkgPrice" value="${d.pkgPrice}"></label>
        <div class="row" style="gap:8px;align-items:flex-end;flex-wrap:nowrap">
          <label class="field" style="flex:1"><span>גודל האריזה</span><input type="number" step="any" min="0" name="pkgSize" value="${d.pkgSize}"></label>
          <label class="field" style="width:110px"><span>יחידה</span><select name="pkgUnit">${A.opts(Object.keys(A.PKG_UNITS), d.pkgUnit, A.PKG_UNITS)}</select></label>
        </div>
        <label class="field"><span>גרם בכוס אחת</span><input type="number" step="any" min="1" name="gramsPerCup" value="${d.gramsPerCup}"><small>קמח 140, סוכר 200, שמן 218, מים 240</small></label>
        <label class="field"><span>משקל יחידה אחת (גרם)</span><input type="number" step="any" min="0" name="gramsPerUnit" value="${d.gramsPerUnit || ''}"><small>ביצה 50, חבילת חמאה 200, שקית 10</small></label>
        <label class="field"><span>מלאי נוכחי (ב${A.PKG_UNITS[d.pkgUnit]})</span><input type="number" step="any" min="0" name="stock" value="${d.stock || 0}"></label>
        <label class="field"><span>מלאי מינימום להתראה</span><input type="number" step="any" min="0" name="minStock" value="${d.minStock || 0}"></label>
        <label class="field full"><span>ספק / איפה קונים</span><input name="supplier" value="${U.esc(d.supplier || '')}"></label>
        <div class="field full"><span>אלרגנים</span><div class="row">${A.ALLERGENS.map(a => `<label class="row" style="gap:5px"><input type="checkbox" name="allergens" data-multi="1" value="${a}" ${(d.allergens || []).includes(a) ? 'checked' : ''}>${a}</label>`).join('')}</div></div>
      </div>
      ${used.length ? `<p class="small muted" style="margin-top:14px">משמש ב: ${used.map(r => `<a href="#/recipe/${r.id}" data-close>${U.esc(r.name)}</a>`).join(', ')}</p>` : ''}`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button><span class="spacer"></span>${isNew ? '' : `<button class="btn danger" data-del>${A.icon('trash')}מחיקה</button>`}`,
      onMount(w) {
        w.addEventListener('click', async e => {
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.m-body'));
            if (!v.name) return A.toast('חסר שם');
            if (A.state.ingredients.some(x => x.name === v.name && x !== i)) return A.toast('כבר קיים מצרך בשם הזה');
            const priceChanged = !i || +v.pkgPrice !== +i.pkgPrice || +v.pkgSize !== +i.pkgSize || v.pkgUnit !== i.pkgUnit;
            const t = i || { id: U.uid() };
            Object.assign(t, v, { pkgPrice: v.pkgPrice || 0, pkgSize: v.pkgSize || 1, gramsPerCup: v.gramsPerCup || 240, gramsPerUnit: v.gramsPerUnit || 0, stock: v.stock || 0, minStock: v.minStock || 0 });
            if (priceChanged) t.estimated = false;
            if (t.pkgPrice > 0) t.free = false;
            if (isNew) A.state.ingredients.push(t);
            A.closeModal(); A.commit('נשמר');
          }
          if (e.target.closest('[data-del]')) {
            if (used.length) return A.toast('המצרך משמש במתכונים — הסירי אותו מהם קודם');
            A.closeModal();
            if (await A.confirm(`למחוק את "${U.esc(i.name)}"?`, 'מחיקה')) { const idx = A.state.ingredients.indexOf(i); A.state.ingredients = A.state.ingredients.filter(x => x !== i); A.commit(); A.undoToast(`"${i.name}" נמחק`, () => { A.state.ingredients.splice(idx, 0, i); A.commit(); }); }
          }
        });
      }
    });
  }
  A.editIng = editIng;
})(window);
