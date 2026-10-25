/* על הגשר — סטטיסטיקות ותובנות לפיתוח העסק */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = { period: 'month' };

  function range(p) {
    const t = U.today(), d = U.parse(t), y = d.getFullYear(), m = d.getMonth();
    switch (p) {
      case 'month': return [U.iso(new Date(y, m, 1)), U.iso(new Date(y, m + 1, 0)), 'החודש'];
      case 'last': return [U.iso(new Date(y, m - 1, 1)), U.iso(new Date(y, m, 0)), 'חודש שעבר'];
      case '3m': return [U.iso(new Date(y, m - 2, 1)), U.iso(new Date(y, m + 1, 0)), '3 חודשים'];
      case 'year': return [U.iso(new Date(y, 0, 1)), U.iso(new Date(y, 11, 31)), 'השנה'];
      default: return ['0000-01-01', '9999-12-31', 'כל הזמן'];
    }
  }
  // אותה תקופה לפני כן — להשוואה
  function prevRange(p) {
    const d = U.parse(U.today()), y = d.getFullYear(), m = d.getMonth();
    if (p === 'month') return [U.iso(new Date(y, m - 1, 1)), U.iso(new Date(y, m - 1, Math.min(d.getDate(), new Date(y, m, 0).getDate())))];
    if (p === 'last') return [U.iso(new Date(y, m - 2, 1)), U.iso(new Date(y, m - 1, 0))];
    if (p === '3m') return [U.iso(new Date(y, m - 5, 1)), U.iso(new Date(y, m - 2, 0))];
    if (p === 'year') return [U.iso(new Date(y - 1, 0, 1)), U.iso(new Date(y - 1, d.getMonth(), d.getDate()))];
    return null;
  }
  const inRange = (o, [a, b]) => o.date >= a && o.date <= b;

  A.statsFor = (from, to) => {
    const orders = C.activeOrders().filter(o => o.date >= from && o.date <= to);
    const tot = orders.map(o => ({ o, t: C.orderTotals(o) }));
    const revenue = U.sum(tot, x => x.t.total), profit = U.sum(tot, x => x.t.profit), cost = U.sum(tot, x => x.t.cost);
    const minutes = U.sum(tot, x => x.t.activeMin);
    return { from, to, orders, tot, revenue, profit, cost, minutes, count: orders.length, avg: orders.length ? revenue / orders.length : 0, unpaid: U.sum(tot, x => x.t.balance) };
  };

  const delta = (cur, prev) => {
    if (prev == null || !prev) return '';
    const d = (cur - prev) / prev;
    return `<span class="badge ${d >= 0 ? 'ok' : 'bad'}" title="לעומת התקופה המקבילה">${d >= 0 ? '▲' : '▼'} ${U.pct(Math.abs(d))}</span>`;
  };

  P.stats = {
    title: 'סטטיסטיקות',
    render(main) {
      const r = range(view.period), st = A.statsFor(r[0], r[1]);
      const pr = prevRange(view.period), ps = pr ? A.statsFor(pr[0], pr[1]) : null;
      const exp = U.sum(A.state.expenses.filter(e => e.date >= r[0] && e.date <= r[1]), e => e.amount);
      const cancelled = A.state.orders.filter(o => o.status === 'cancelled' && inRange(o, r)).length;
      const future = st.orders.filter(o => o.date > U.today()).length;

      // 12 חודשים
      const today = U.parse(U.today()), months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const s = A.statsFor(U.iso(d), U.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
        months.push({ label: U.MONTHS[d.getMonth()].slice(0, 3) + '׳', value: s.revenue, value2: s.profit, count: s.count });
      }
      // מוצרים
      const prod = {};
      st.orders.forEach(o => o.items.forEach(i => {
        const k = i.recipeId || 'n:' + i.name, rec = i.recipeId && C.recipe(i.recipeId);
        const p = prod[k] = prod[k] || { name: rec ? rec.name : i.name, qty: 0, revenue: 0, cost: 0, rec };
        p.qty += +i.qty || 0; p.revenue += i.qty * i.unitPrice;
        p.cost += (rec ? C.recipeCost(rec).directPerUnit : (+i.unitCost || 0)) * i.qty;
      }));
      const products = Object.values(prod).map(p => Object.assign(p, { profit: p.revenue / C.vatFactor() - p.cost, margin: p.revenue ? (p.revenue / C.vatFactor() - p.cost) / (p.revenue / C.vatFactor()) : 0 }));
      const byRev = products.slice().sort((a, b) => b.revenue - a.revenue);
      // ימי שבוע
      const wd = U.DAYS.map((d, i) => ({ label: d.slice(0, 3), value: st.orders.filter(o => U.parse(o.date).getDay() === i).length }));
      // מקורות
      const src = Object.entries(U.groupBy(st.orders, o => o.source || 'אחר')).map(([k, v]) => ({ label: k, value: v.length })).sort((a, b) => b.value - a.value);
      // לקוחות בתקופה
      const allCust = C.customers();
      const custInPeriod = new Set(st.orders.map(o => U.phoneKey(o.phone) || 'n:' + (o.customerName || '').trim()));
      const newCust = allCust.filter(c => custInPeriod.has(c.key) && c.first >= r[0]).length;
      const lead = st.orders.filter(o => o.createdAt).map(o => U.diffDays(o.date, o.createdAt)).filter(x => x >= 0);
      const avgLead = lead.length ? U.sum(lead) / lead.length : null;
      const hours = st.minutes / 60, perHour = hours ? st.profit / hours : 0;
      const delivery = st.orders.filter(o => o.method === 'delivery').length;

      main.innerHTML = `
        <div class="row section"><div class="seg">${[['month', 'החודש'], ['last', 'חודש שעבר'], ['3m', '3 חודשים'], ['year', 'השנה'], ['all', 'הכל']].map(([v, l]) => `<button data-p="${v}" class="${view.period === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="small muted">${view.period === 'all' ? '' : U.fmtDate(r[0]) + ' – ' + U.fmtDate(r[1])}${future ? ` · כולל ${future} הזמנות עתידיות` : ''}</span></div>
        <div class="grid g4 section">
          <div class="card kpi"><div class="lbl">הכנסות ${delta(st.revenue, ps && ps.revenue)}</div><div class="val">${U.money(st.revenue, 0)}</div><div class="sub">${st.count} הזמנות${cancelled ? ` · ${cancelled} בוטלו` : ''}</div></div>
          <div class="card kpi"><div class="lbl">רווח גולמי ${delta(st.profit, ps && ps.profit)}</div><div class="val ok">${U.money(st.profit, 0)}</div><div class="sub">אחרי חומרי גלם, אריזה ותנור${st.revenue ? ` · ${U.pct(st.profit / (st.revenue / C.vatFactor()))}` : ''}</div></div>
          <div class="card kpi"><div class="lbl">הזמנה ממוצעת ${delta(st.avg, ps && ps.avg)}</div><div class="val">${U.money(st.avg, 0)}</div><div class="sub">${delivery} משלוחים · ${st.count - delivery} איסופים</div></div>
          <div class="card kpi"><div class="lbl">רווח לשעת עבודה</div><div class="val">${hours ? U.money(perHour, 0) : '—'}</div><div class="sub">${U.fmt(U.round(hours, 1))} שעות עבודה פעילה</div></div>
        </div>
        <div class="grid g4 section">
          <div class="card kpi"><div class="lbl">הוצאות בפועל</div><div class="val">${U.money(exp, 0)}</div><div class="sub">מדף ההוצאות</div></div>
          <div class="card kpi"><div class="lbl">תזרים (הכנסות − הוצאות)</div><div class="val ${st.revenue - exp >= 0 ? 'ok' : 'bad'}">${U.money(st.revenue - exp, 0)}</div></div>
          <div class="card kpi"><div class="lbl">ממתין לתשלום</div><div class="val ${st.unpaid ? 'bad' : ''}">${U.money(st.unpaid, 0)}</div></div>
          <div class="card kpi"><div class="lbl">לקוחות חדשות</div><div class="val">${newCust}</div><div class="sub">מתוך ${custInPeriod.size} שהזמינו${avgLead != null ? ` · מזמינות ${U.fmt(U.round(avgLead, 1))} ימים מראש` : ''}</div></div>
        </div>
        <div class="card section"><div class="card-h"><h3>${A.icon('chart')}12 החודשים האחרונים</h3><div class="legend"><span><i style="background:var(--brown-3)"></i>הכנסות</span><span><i style="background:var(--caramel)"></i>רווח גולמי</span></div></div>
          ${A.chart.bars(months, { series2: true, height: 240 })}</div>
        <div class="grid g2 section">
          <div class="card"><div class="card-h"><h3>${A.icon('star')}מוצרים מובילים בהכנסות</h3></div>${A.chart.hbars(byRev.slice(0, 8).map(p => ({ label: p.name, value: p.revenue })), v => U.money(v, 0))}</div>
          <div class="card"><div class="card-h"><h3>${A.icon('trend')}תובנות והמלצות</h3></div>${insights(st, ps, products, wd, src, allCust, months).join('') || '<p class="muted">צריך עוד קצת הזמנות כדי לזהות מגמות.</p>'}</div>
        </div>
        <div class="card section"><div class="card-h"><h3>רווחיות לפי מוצר</h3><span class="small muted">רווח = מחיר נטו פחות חומרי גלם, אריזה ותנור (לפני שכר)</span></div>
          <div class="table-wrap"><table><thead><tr><th>מוצר</th><th class="n">נמכרו</th><th class="n">הכנסות</th><th class="n">עלות</th><th class="n">רווח</th><th class="n">שולי רווח</th></tr></thead><tbody>
          ${byRev.map(p => `<tr ${p.rec ? `class="click" data-recipe="${p.rec.id}"` : ''}><td><b>${U.esc(p.name)}</b></td><td class="n">${U.fmt(p.qty)}</td><td class="n">${U.money(p.revenue, 0)}</td><td class="n">${U.money(p.cost, 0)}</td><td class="n">${U.money(p.profit, 0)}</td><td class="n"><span class="badge ${p.margin >= 0.5 ? 'ok' : p.margin >= 0.3 ? 'warn' : 'bad'}">${U.pct(p.margin)}</span></td></tr>`).join('') || '<tr><td colspan="6" class="muted">אין נתונים</td></tr>'}
          </tbody></table></div></div>
        ${menuEngineering(products)}
        <div class="grid g2">
          <div class="card"><div class="card-h"><h3>הזמנות לפי יום מסירה</h3></div>${A.chart.bars(wd, { height: 200, fmt: v => U.fmt(Math.round(v)) })}</div>
          <div class="card"><div class="card-h"><h3>מאיפה מגיעות ההזמנות</h3></div>${A.chart.donut(src)}</div>
        </div>`;
      main.onclick = e => {
        const b = e.target.closest('[data-p]'); if (b) { view.period = b.dataset.p; A.refresh(); }
        const r2 = e.target.closest('[data-recipe]'); if (r2) A.go('recipe/' + r2.dataset.recipe);
      };
    }
  };

  // הנדסת תפריט (Kasavana & Smith): פופולריות מול רווח ליחידה
  function menuEngineering(products) {
    const items = products.filter(p => p.rec && p.qty > 0);
    if (items.length < 3) return `<div class="card section"><div class="card-h"><h3>${A.icon('star')}הנדסת תפריט</h3></div><p class="muted" style="margin:0">צריך לפחות 3 מוצרים שנמכרו בתקופה כדי לסווג את התפריט.</p></div>`;
    const totalQty = U.sum(items, p => p.qty), totalProfit = U.sum(items, p => p.profit);
    const popLine = 0.7 / items.length, avgMargin = totalProfit / totalQty;
    const Q = { star: [], plow: [], puzzle: [], dog: [] };
    items.forEach(p => {
      const pop = p.qty / totalQty >= popLine, prof = p.profit / p.qty >= avgMargin;
      Q[pop && prof ? 'star' : pop ? 'plow' : prof ? 'puzzle' : 'dog'].push(p);
    });
    const box = (k, title, txt, cls) => `<div class="card flat" style="padding:14px;border-color:var(--line-2)"><div class="row between"><b>${title}</b><span class="badge ${cls}">${Q[k].length}</span></div>
      <p class="small muted" style="margin:4px 0 8px">${txt}</p>${Q[k].map(p => `<span class="chip" style="margin:2px">${U.esc(p.name)} · ${U.money(p.profit / p.qty)}</span>`).join('') || '<span class="small muted">—</span>'}</div>`;
    return `<div class="card section"><div class="card-h"><h3>${A.icon('star')}הנדסת תפריט</h3><span class="small muted">רווח ממוצע ליחידה ${U.money(avgMargin)} · סף פופולריות ${U.pct(popLine)} מהמכירות</span></div>
      <div class="grid g2" style="gap:10px">
        ${box('star', '⭐ כוכבים', 'נמכרים הרבה ורווחיים. לשמור על האיכות, לשים במקום בולט, לא להוריד מחיר.', 'ok')}
        ${box('plow', '🐎 סוסי עבודה', 'נמכרים הרבה אבל מרוויחים מעט. להעלות מחיר בהדרגה או להוזיל עלות/גודל מנה.', 'warn')}
        ${box('puzzle', '🧩 חידות', 'רווחיים אבל נמכרים מעט. לקדם: צילום טוב, המלצה, מארז.', 'info')}
        ${box('dog', '🍂 לבחינה', 'מעט מכירות ומעט רווח. לשפר, לשלב במארז — או להוריד מהתפריט.', 'bad')}
      </div></div>`;
  }

  function insights(st, ps, products, wd, src, custs, months) {
    const out = [], add = (cls, icon, html) => out.push(`<div class="insight ${cls}"><div class="ic">${A.icon(icon)}</div><div>${html}</div></div>`);
    const s = A.state.settings;
    if (ps && ps.revenue && st.revenue) {
      const d = (st.revenue - ps.revenue) / ps.revenue;
      if (d >= 0.1) add('good', 'trend', `<b>צמיחה של ${U.pct(d)}</b> בהכנסות לעומת התקופה המקבילה. כל הכבוד!`);
      else if (d <= -0.1) add('alert', 'alert', `ההכנסות ירדו ב־${U.pct(-d)} לעומת התקופה המקבילה. זה זמן טוב לפוסט, מבצע עונתי או הודעה ללקוחות קבועות.`);
    }
    const sellable = products.filter(p => p.qty >= 2);
    if (sellable.length >= 2) {
      const best = sellable.slice().sort((a, b) => b.profit - a.profit)[0];
      add('good', 'star', `<b>${U.esc(best.name)}</b> מכניס הכי הרבה רווח (${U.money(best.profit, 0)}). שווה לקדם אותו בשיווק ובמארזים.`);
      const weak = sellable.slice().sort((a, b) => a.margin - b.margin)[0];
      if (weak.margin < 0.45 && weak.rec) {
        const p = C.pricing(weak.rec);
        add('alert', 'wallet', `<b>${U.esc(weak.name)}</b> ברווחיות נמוכה (${U.pct(weak.margin)} לפני שכר). ${p.suggested > p.price ? `המחיר המומלץ: <b>${U.money(p.suggested)}</b> במקום ${U.money(p.price)}.` : 'בדקי עלויות חומרי הגלם או גודל המנה.'}`);
      }
    }
    const waste = U.sum(A.state.expenses.filter(e => e.category === 'פחת ומוצרים שנזרקו' && e.date >= st.from && e.date <= st.to), e => e.amount);
    if (waste && st.revenue) add(waste / st.revenue > 0.05 ? 'alert' : 'good', 'trash', `פחת: ${U.money(waste, 0)} (${U.pct(waste / st.revenue)} מההכנסות). ${waste / st.revenue > 0.05 ? 'מעל 5% — כדאי לבדוק עודפי ייצור ומוצרים שלא נמכרו.' : 'נמוך — ניהול מלאי טוב.'}`);
    const lossMakers = A.state.recipes.filter(r => r.price && C.pricing(r).status === 'bad');
    if (lossMakers.length) add('alert', 'alert', `${lossMakers.length === 1 ? 'מתכון אחד' : lossMakers.length + ' מתכונים'} לא מכסים את העלות המלאה כולל שכר: ${lossMakers.slice(0, 3).map(r => `<a href="#/recipe/${r.id}">${U.esc(r.name)}</a>`).join(', ')}.`);
    const maxD = wd.reduce((m, d, i) => d.value > wd[m].value ? i : m, 0);
    if (wd[maxD].value >= 3) add('', 'calendar', `יום ${U.DAYS[maxD]} הוא היום העמוס ביותר (${wd[maxD].value} הזמנות). תכנני קניות והכנות מוקדמות יום־יומיים לפני.`);
    if (src.length > 1) add('', 'users', `רוב ההזמנות מגיעות מ<b>${U.esc(src[0].label)}</b> (${U.pct(src[0].value / U.sum(src, x => x.value))}). ${src[0].label === 'המלצה' ? 'לקוחות מרוצות הן השיווק הכי טוב — בקשי מהן חוות דעת.' : 'כדאי לחזק גם ערוץ שני.'}`);
    const hours = st.minutes / 60;
    if (hours >= 3 && st.profit / hours < s.hourlyRate) add('alert', 'clock', `הרווח לשעת עבודה (${U.money(st.profit / hours, 0)}) נמוך מהשכר שהגדרת לעצמך (${U.money(s.hourlyRate)}). שקלי להעלות מחירים או להתמקד במוצרים הרווחיים.`);
    const sleeping = custs.filter(c => c.count >= 2 && U.diffDays(U.today(), c.last) > 60);
    if (sleeping.length) add('', 'heart', `${sleeping.length === 1 ? 'לקוחה קבועה אחת לא הזמינה' : sleeping.length + ' לקוחות קבועות לא הזמינו'} יותר מחודשיים (${sleeping.slice(0, 3).map(c => U.esc(c.name)).join(', ')}). הודעה אישית קטנה יכולה להחזיר אותן.`);
    const repeat = custs.length ? custs.filter(c => c.count > 1).length / custs.length : 0;
    if (custs.length >= 5) add(repeat >= 0.4 ? 'good' : '', 'users', `${U.pct(repeat)} מהלקוחות חוזרות. ${repeat >= 0.4 ? 'נאמנות גבוהה מאוד!' : 'מגע אישי (פתק, דוגמית, הנחת לקוחה חוזרת) יכול להעלות את זה.'}`);
    const avg = st.avg;
    if (avg && st.count >= 5) add('', 'cart', `ההזמנה הממוצעת ${U.money(avg, 0)}. מארז משולב או תוספת קטנה ליד הקופה ("עוד קופסת עוגיות?") מעלים את הסכום בקלות.`);
    return out.slice(0, 7);
  }
})(window);
