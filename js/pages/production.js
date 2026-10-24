/* על הגשר — תכנון ייצור ורשימת קניות לפי ההזמנות */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = { from: null, to: null };

  const fmtNeed = (n, ing) => ing.pkgUnit === 'unit' ? U.fmt(Math.ceil(n - 1e-9)) + ' יח׳'
    : ['kg', 'g'].includes(ing.pkgUnit) ? A.fmtGrams(A.toGrams(n, ing.pkgUnit, ing))
      : (A.toGrams(n, ing.pkgUnit, ing) >= 1000 * ing.gramsPerCup / 240 ? U.fmt(U.round(A.convert(n, ing.pkgUnit, 'l', ing), 2)) + ' ליטר' : U.fmt(Math.round(A.convert(n, ing.pkgUnit, 'ml', ing))) + ' מ״ל');

  P.production = {
    title: 'תכנון ייצור',
    render(main) {
      view.from = view.from || U.today(); view.to = view.to || U.addDays(U.today(), 3);
      const pr = C.production(view.from, view.to);
      A.setActions(`<button class="btn ghost hide-m" data-act="print">${A.icon('print')}הדפסה</button>`);
      const quick = [['היום', 0, 0], ['מחר', 1, 1], ['3 ימים', 0, 3], ['שבוע', 0, 6]];
      const toBuy = pr.shopping.filter(s => s.missing > 1e-6);
      const byDay = U.groupBy(pr.orders.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), o => o.date);
      main.innerHTML = `
      <div class="card section no-print"><div class="row">
        <label class="field" style="width:160px"><span>מתאריך</span><input type="date" data-f="from" value="${view.from}"></label>
        <label class="field" style="width:160px"><span>עד תאריך</span><input type="date" data-f="to" value="${view.to}"></label>
        <div class="seg" style="align-self:flex-end">${quick.map(([l, a, b]) => `<button data-q="${a},${b}" class="${view.from === U.addDays(U.today(), a) && view.to === U.addDays(U.today(), b) ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div></div>
      <div class="print-only"><h2>תכנון ייצור ${U.fmtDate(view.from)}–${U.fmtDate(view.to)}</h2></div>
      <div class="grid g4 section">
        <div class="card kpi"><div class="lbl">הזמנות בטווח</div><div class="val">${pr.orders.length}</div></div>
        <div class="card kpi"><div class="lbl">שעות עבודה פעילה</div><div class="val">${U.fmt(U.round(pr.totalActive / 60, 1))}</div><div class="sub">${U.minutes(pr.totalActive)}</div></div>
        <div class="card kpi"><div class="lbl">זמן תנור</div><div class="val">${U.fmt(U.round(pr.totalOven / 60, 1))}</div><div class="sub">שעות (לפני מקבול)</div></div>
        <div class="card kpi"><div class="lbl">לקנות</div><div class="val">${toBuy.length}</div><div class="sub">מצרכים · כ־${U.money(pr.totalBuy, 0)}</div></div>
      </div>
      ${pr.orders.length ? `
      <div class="grid g2 section">
        <div class="card"><div class="card-h"><h3>${A.icon('flame')}מה לאפות</h3></div>
          <div class="table-wrap"><table><thead><tr><th>מתכון</th><th class="n">יחידות</th><th class="n">מנות מתכון</th><th class="n">עבודה</th></tr></thead><tbody>
          ${pr.rows.map(r => `<tr class="click" data-recipe="${r.recipe.id}"><td><b>${U.esc(r.recipe.name)}</b><div class="small muted">${r.orders} הזמנות</div></td><td class="n">${U.fmt(r.units)} <span class="small muted">${U.esc(r.recipe.yieldUnit || '')}</span></td>
            <td class="n"><b>${U.fmt(U.round(r.batches, 2))}</b>${Math.abs(r.batches - Math.round(r.batches)) > 0.01 ? `<div class="small muted">הכפלה ×${U.fmt(U.round(r.batches, 2))}</div>` : ''}</td><td class="n">${U.minutes(r.active)}</td></tr>`).join('')}
          ${pr.other.map(x => `<tr><td>${U.esc(x.name)} <span class="badge muted">לא מקושר למתכון</span></td><td class="n">${U.fmt(x.qty)}</td><td></td><td></td></tr>`).join('')}
          </tbody></table></div>
          <p class="small muted" style="margin-bottom:0">לחיצה על מתכון פותחת אותו — אפשר להכפיל שם לפי "מנות מתכון".</p></div>
        <div class="card"><div class="card-h"><h3>${A.icon('cart')}רשימת קניות</h3><span class="small muted">לפי המלאי שבמחסן</span></div>
          ${toBuy.length ? `<div class="table-wrap"><table><thead><tr><th>מצרך</th><th class="n">צריך</th><th class="n">במלאי</th><th class="n">לקנות</th></tr></thead><tbody>
            ${toBuy.map(s => `<tr><td>${U.esc(s.ing.name)}</td><td class="n">${fmtNeed(s.need, s.ing)}</td><td class="n muted">${fmtNeed(s.stock, s.ing)}</td><td class="n"><b>${s.pkgs}</b> × ${U.fmt(s.ing.pkgSize)} ${A.PKG_UNITS[s.ing.pkgUnit]}<div class="small muted">${s.buyCost ? U.money(s.buyCost) : ''}</div></td></tr>`).join('')}
          </tbody></table></div>
          <div class="row no-print" style="margin-top:12px"><button class="btn sm ghost" data-act="copyList">${A.icon('copy')}העתקת הרשימה</button></div>` : '<p class="muted">יש מספיק מכל המצרכים במלאי 👌 (או שלא הוזן מלאי במחסן)</p>'}
          <details style="margin-top:12px"><summary class="small" style="cursor:pointer">כל המצרכים הדרושים (${pr.shopping.length}) · עלות שימוש ${U.money(pr.totalUseCost)}</summary>
            <table style="margin-top:8px"><tbody>${pr.shopping.map(s => `<tr><td>${U.esc(s.ing.name)}</td><td class="n">${fmtNeed(s.need, s.ing)}</td></tr>`).join('')}</tbody></table></details>
          <div class="row no-print" style="margin-top:12px"><button class="btn sm soft" data-act="deduct">${A.icon('box')}הורדת הכמויות מהמלאי</button></div>
        </div>
      </div>
      <div class="card"><div class="card-h"><h3>${A.icon('calendar')}לו״ז מסירות</h3></div>
        ${Object.keys(byDay).map(d => `<div class="small muted" style="padding:8px 4px 0;font-weight:700">${U.relDay(d)} · ${U.dayName(d)} ${U.fmtDate(d)}</div>${byDay[d].map(A.orderRow).join('')}`).join('')}</div>`
        : `<div class="card empty"><h3>אין הזמנות פתוחות בטווח הזה</h3><p>בחרי טווח תאריכים אחר.</p></div>`}`;

      main.onchange = e => { const k = e.target.dataset.f; if (k) { view[k] = e.target.value; if (view.to < view.from) view.to = view.from; A.refresh(); } };
      main.onclick = async e => {
        const q = e.target.closest('[data-q]'); if (q) { const [a, b] = q.dataset.q.split(',').map(Number); view.from = U.addDays(U.today(), a); view.to = U.addDays(U.today(), b); A.refresh(); return; }
        const r = e.target.closest('[data-recipe]'); if (r) { const row = pr.rows.find(x => x.recipe.id === r.dataset.recipe); A.recipeView.id = row.recipe.id; A.recipeView.factor = U.round(row.batches, 3); A.recipeView.mode = 'orig'; A.go('recipe/' + row.recipe.id); return; }
        const o = e.target.closest('[data-order]'); if (o) return A.openOrder(o.dataset.order);
        const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'copyList') A.copy(`רשימת קניות — ${U.fmtDate(view.from)}–${U.fmtDate(view.to)}\n` + toBuy.map(s => `☐ ${s.ing.name}: ${s.pkgs} × ${U.fmt(s.ing.pkgSize)} ${A.PKG_UNITS[s.ing.pkgUnit]}`).join('\n'));
        if (b.dataset.act === 'deduct') {
          if (!await A.confirm('להוריד מהמלאי את כל הכמויות הדרושות להזמנות בטווח? כדאי לעשות זאת פעם אחת, אחרי האפייה.', 'הורדה מהמלאי', false)) return;
          pr.shopping.forEach(s => { s.ing.stock = Math.max(0, U.round((+s.ing.stock || 0) - s.need, 3)); });
          A.commit('המלאי עודכן');
        }
      };
      document.getElementById('topActions').onclick = e => { if (e.target.closest('[data-act=print]')) root.print(); };
    }
  };
})(window);
