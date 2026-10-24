/* על הגשר — הוצאות */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = { month: null };

  P.expenses = {
    title: 'הוצאות',
    render(main) {
      A.setActions(`<button class="btn" data-act="new">${A.icon('plus')}הוצאה חדשה</button>`);
      const months = [...new Set([U.today().slice(0, 7), ...A.state.expenses.map(e => e.date.slice(0, 7))])].sort().reverse();
      const m = view.month || 'all';
      const list = A.state.expenses.filter(e => m === 'all' || e.date.startsWith(m)).sort((a, b) => b.date.localeCompare(a.date));
      const total = U.sum(list, e => e.amount);
      const rev = U.sum(C.activeOrders().filter(o => m === 'all' || o.date.startsWith(m)).filter(o => o.date <= U.today()), o => C.orderTotals(o).total);
      const byCat = Object.entries(U.groupBy(list, e => e.category)).map(([k, v]) => ({ label: k, value: U.sum(v, e => e.amount) })).sort((a, b) => b.value - a.value);
      const mLabel = s => { const [y, mo] = s.split('-'); return `${U.MONTHS[+mo - 1]} ${y}`; };
      main.innerHTML = `
        <div class="row section"><select data-f="month" style="width:auto">${A.opts([['all', 'כל התקופה'], ...months.map(x => [x, mLabel(x)])], m)}</select></div>
        <div class="grid g3 section">
          <div class="card kpi"><div class="lbl">סה״כ הוצאות</div><div class="val">${U.money(total, 0)}</div></div>
          <div class="card kpi"><div class="lbl">הכנסות מהזמנות (עד היום)</div><div class="val">${U.money(rev, 0)}</div></div>
          <div class="card kpi"><div class="lbl">נשאר בקופה</div><div class="val ${rev - total >= 0 ? 'ok' : 'bad'}">${U.money(rev - total, 0)}</div><div class="sub">הכנסות פחות הוצאות בפועל</div></div>
        </div>
        <div class="grid cols-main">
          <div class="card">${list.length ? list.map(e => `<div class="list-item click" data-e="${e.id}"><div class="main"><div class="t">${U.esc(e.desc || e.category)}</div><div class="s">${U.fmtDate(e.date)} · ${U.esc(e.category)}</div></div><b class="money">${U.money(e.amount)}</b></div>`).join('')
          : `<div class="empty"><h3>אין הוצאות</h3><p>תעדי קניות של חומרי גלם, אריזות וציוד — כדי לדעת כמה באמת נשאר לך.</p></div>`}</div>
          <div class="card"><div class="card-h"><h3>לפי קטגוריה</h3></div>${A.chart.hbars(byCat, v => U.money(v, 0))}</div>
        </div>`;
      main.onchange = e => { if (e.target.dataset.f === 'month') { view.month = e.target.value; A.refresh(); } };
      main.onclick = e => { const r = e.target.closest('[data-e]'); if (r) edit(A.state.expenses.find(x => x.id === r.dataset.e)); };
      document.getElementById('topActions').onclick = e => { if (e.target.closest('[data-act=new]')) edit(); };
    }
  };

  function edit(x) {
    const d = x || { date: U.today(), category: 'חומרי גלם', amount: '', desc: '' };
    A.modal({
      title: x ? 'עריכת הוצאה' : 'הוצאה חדשה', size: 'narrow',
      body: `<div class="form-grid">
        <label class="field"><span>סכום (₪) *</span><input type="number" min="0" step="any" name="amount" value="${d.amount}" autofocus></label>
        <label class="field"><span>תאריך</span><input type="date" name="date" value="${d.date}"></label>
        <label class="field full"><span>קטגוריה</span><select name="category">${A.opts(A.EXPENSE_CATS, d.category)}</select></label>
        <label class="field full"><span>תיאור</span><input name="desc" value="${U.esc(d.desc)}" placeholder="למשל: קניות בסיטונאי"></label></div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button><span class="spacer"></span>${x ? `<button class="btn danger" data-del>${A.icon('trash')}</button>` : ''}`,
      onMount(w) {
        w.addEventListener('click', e => {
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.m-body'));
            if (!(v.amount > 0)) return A.toast('הזיני סכום');
            if (!v.date) return A.toast('חסר תאריך');
            if (x) Object.assign(x, v, { demo: false }); else A.state.expenses.push(Object.assign({ id: U.uid() }, v));
            A.closeModal(); A.commit('נשמר');
          }
          if (e.target.closest('[data-del]')) { A.state.expenses = A.state.expenses.filter(y => y !== x); A.closeModal(); A.commit('נמחק'); }
        });
      }
    });
  }
})(window);
