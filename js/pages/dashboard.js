/* על הגשר — דף הבית */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};

  P[''] = {
    title: () => { const h = new Date().getHours(); const n = A.state && A.state.settings.ownerName; return (h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב') + (n ? ', ' + n : ''); },
    render(main) {
      const s = A.state.settings, today = U.today(), tmr = U.addDays(today, 1);
      A.setActions(`<button class="btn" data-act="newOrder">${A.icon('plus')}הזמנה חדשה</button>`);
      const open = A.state.orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
      const todayO = open.filter(o => o.date <= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      const tmrO = open.filter(o => o.date === tmr);
      const weekO = open.filter(o => o.date > tmr && o.date <= U.addDays(today, 7));
      const d = U.parse(today), mStart = U.iso(new Date(d.getFullYear(), d.getMonth(), 1)), mEnd = U.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      const month = A.statsFor(mStart, mEnd);
      const unpaid = U.sum(C.activeOrders(), o => C.orderTotals(o).balance);
      const weekRev = U.sum(C.activeOrders().filter(o => o.date >= today && o.date <= U.addDays(today, 6)), o => C.orderTotals(o).total);

      // התראות
      const alerts = [];
      const claimed = A.state.orders.filter(o => o.payClaim && o.payDue > 0 && (+o.paid || 0) < o.payDue - 0.01 && o.status !== 'cancelled');
      if (claimed.length) alerts.push(['wallet', `${claimed.length === 1 ? 'לקוחה דיווחה' : claimed.length + ' לקוחות דיווחו'} על תשלום — לבדוק ולאשר`, 'orders']);
      const overdue = A.state.orders.filter(o => A.payOverdue && A.payOverdue(o));
      if (overdue.length) alerts.push(['alert', `${overdue.length === 1 ? 'הזמנה אחת לא שולמה' : overdue.length + ' הזמנות לא שולמו'} בזמן — לבטל או לשלוח תזכורת`, 'orders']);
      if (A.platform && A.platform() !== 'desktop' && !A.isStandalone()) alerts.push(['download', 'אפשר להתקין את האפליקציה על המסך הראשי — 3 צעדים', 'settings']);
      const fresh = A.state.orders.filter(o => o.status === 'new');
      if (fresh.length) alerts.push(['orders', `${fresh.length === 1 ? 'הזמנה חדשה מחכה' : fresh.length + ' הזמנות חדשות מחכות'} לאישור שלך`, 'orders']);
      const late = open.filter(o => o.date < today);
      if (late.length) alerts.push(['alert', `${late.length} הזמנות מתאריך שעבר עדיין לא סומנו כנמסרו`, 'orders']);
      const low = A.state.ingredients.filter(i => +i.minStock > 0 && (+i.stock || 0) < +i.minStock);
      if (low.length) alerts.push(['box', `חסר במלאי: ${low.slice(0, 4).map(i => i.name).join(', ')}${low.length > 4 ? '…' : ''}`, 'pantry']);
      const noPrice = A.state.recipes.filter(r => !r.price && !(A.isComponent && A.isComponent(r)));
      if (noPrice.length) alerts.push(['wallet', `${noPrice.length} מתכונים בלי מחיר מכירה`, 'recipes']);
      const loss = A.state.recipes.filter(r => r.price && C.pricing(r).status === 'bad');
      if (loss.length) alerts.push(['alert', `${loss.length} מתכונים מתומחרים מתחת לעלות המלאה`, 'recipes']);
      const est = A.state.ingredients.filter(i => i.estimated && A.state.recipes.some(r => r.ingredients.some(l => l.ingId === i.id)));
      if (est.length) alerts.push(['box', `${est.length} מצרכים בשימוש עם מחיר משוער — עדכני לפי קבלה`, 'pantry']);
      const synced = A.sync && A.sync.enabled();
      if (!synced && A.state.orders.length + A.state.recipes.length > 0) alerts.push(['cloud', 'הנתונים שמורים רק במכשיר הזה — כדאי להפעיל סנכרון', 'settings']);
      if (!s.lastBackup || U.diffDays(today, s.lastBackup) > (synced ? 30 : 7)) alerts.push(['download', s.lastBackup ? `עברו ${U.diffDays(today, s.lastBackup)} ימים מהגיבוי האחרון` : 'עוד לא בוצע גיבוי לנתונים', 'settings']);
      const lastWheel = A.state.wheel.entries.map(e => e.date).sort().pop();
      if (lastWheel !== today) alerts.push(['wheel', 'הצ׳ק־אין היומי בגלגל החיים מחכה לך (דקה אחת)', 'wheel']);

      const first = !A.state.orders.length && !s.welcomeDone;
      const goal = +s.monthlyGoal || 0;
      main.innerHTML = `
      ${first ? `<div class="card welcome section cables">
        <h2 style="margin-bottom:8px">ברוכה הבאה למערכת של על הגשר 🤎</h2>
        <p style="margin:0 0 14px;opacity:.9">כבר מחכים לך ${A.state.recipes.filter(r => r.library).length} מתכוני בסיס מדויקים בגרמים, מחסן עם ${A.state.ingredients.length} מצרכים ומחירים משוערים, ותמחור אוטומטי לכל מתכון. שלושה צעדים לפתיחה:</p>
        <ol style="margin:0 0 14px;padding-inline-start:20px;line-height:1.9;opacity:.95"><li>בהגדרות: השכר השעתי שלך ויעד הרווח</li><li>במחסן: עדכון מחירי המצרכים לפי הקבלות</li><li>בטופס ההזמנות: יצירת קישור קבוע ללקוחות</li></ol>
        <div class="row"><a class="btn soft" href="#/settings">להתחיל בהגדרות</a><a class="btn ghost" href="#/recipes">למתכונים</a><button class="btn ghost" data-act="dismiss">${A.icon('x')}הבנתי</button></div></div>` : ''}
      <div class="grid g4 section">
        <div class="card kpi"><div class="lbl">${A.icon('orders')}להיום</div><div class="val">${todayO.length}</div><div class="sub">${tmrO.length} מחר · ${weekO.length} בהמשך השבוע</div></div>
        <div class="card kpi"><div class="lbl">${A.icon('calendar')}7 הימים הקרובים</div><div class="val">${U.money(weekRev, 0)}</div><div class="sub">הכנסות צפויות</div></div>
        <div class="card kpi"><div class="lbl">${A.icon('chart')}${U.MONTHS[d.getMonth()]}</div><div class="val">${U.money(month.revenue, 0)}</div>
          ${goal ? `<div class="time-bar" style="height:7px;margin-top:6px"><i style="width:${Math.min(month.revenue / goal * 100, 100)}%;background:var(--brown-3)"></i></div><div class="sub">${U.pct(month.revenue / goal)} מהיעד (${U.money(goal, 0)})</div>` : `<div class="sub">${month.count} הזמנות · רווח ${U.money(month.profit, 0)}</div>`}</div>
        <div class="card kpi"><div class="lbl">${A.icon('wallet')}ממתין לתשלום</div><div class="val ${unpaid ? 'bad' : ''}">${U.money(unpaid, 0)}</div><div class="sub"><a href="#/orders" data-unpaid>לרשימה</a></div></div>
      </div>
      <div class="grid cols-main">
        <div class="stack">
          <div class="card"><div class="card-h"><h3>${A.icon('orders')}היום${late.length ? ' ומה שנשאר' : ''}</h3><a href="#/production" class="btn sm ghost">${A.icon('flame')}תכנון ייצור</a></div>
            ${todayO.length ? todayO.map(A.orderRow).join('') : '<p class="muted" style="margin:0">אין מסירות היום. זמן טוב להכנות מוקדמות, צילום מוצרים או מנוחה 🤎</p>'}</div>
          <div class="card"><div class="card-h"><h3>מחר</h3></div>${tmrO.length ? tmrO.map(A.orderRow).join('') : '<p class="muted" style="margin:0">אין הזמנות למחר.</p>'}</div>
          ${weekO.length ? `<div class="card"><div class="card-h"><h3>בהמשך השבוע</h3><a href="#/orders" class="small">לכל ההזמנות</a></div>${weekO.sort((a, b) => a.date.localeCompare(b.date)).map(A.orderRow).join('')}</div>` : ''}
        </div>
        <div class="stack">
          ${alerts.length ? `<div class="card"><div class="card-h"><h3>${A.icon('alert')}דורש תשומת לב</h3></div>
            ${alerts.map(([ic, t, link]) => `<a class="insight alert" href="#/${link}" style="text-decoration:none;color:inherit"><div class="ic">${A.icon(ic)}</div><div style="align-self:center">${U.esc(t)}</div></a>`).join('')}</div>` : `<div class="card"><div class="insight good" style="border:0"><div class="ic">${A.icon('check')}</div><div style="align-self:center">הכל מסודר. אין התראות.</div></div></div>`}
          <div class="card"><div class="card-h"><h3>פעולות מהירות</h3></div>
            <div class="grid g2 qa" style="gap:8px">
              <button class="btn soft" data-act="newOrder">${A.icon('orders')}הזמנה</button>
              <button class="btn soft" data-act="newRecipe">${A.icon('book')}מתכון</button>
              <a class="btn soft" href="#/tools">${A.icon('scale')}ממיר</a>
              <a class="btn soft" href="#/wheel">${A.icon('wheel')}גלגל החיים</a>
            </div></div>
          ${lastWheel ? (() => { const e = A.state.wheel.entries.find(x => x.date === lastWheel); return e && e.focus ? `<div class="card cables"><div class="muted small">הצעד שבחרת בגלגל החיים</div><p style="font-family:var(--serif);font-size:1.2rem;color:var(--brown);margin:6px 0 0">${U.esc(e.focus)}</p></div>` : ''; })() : ''}
        </div>
      </div>`;
      const act = e => {
        const o = e.target.closest('[data-order]'); if (o) return A.openOrder(o.dataset.order);
        if (e.target.closest('[data-unpaid]')) { e.preventDefault(); A.ordersFilter && A.ordersFilter('unpaid'); A.go('orders'); return; }
        const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'newOrder') A.editOrder();
        if (b.dataset.act === 'newRecipe') A.editRecipe();
        if (b.dataset.act === 'dismiss') { s.welcomeDone = true; A.commit(); return; }
      };
      main.onclick = act;
      document.getElementById('topActions').onclick = act;
    }
  };
})(window);
