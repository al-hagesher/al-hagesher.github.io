/* על הגשר — כלים: ממיר כמויות, תבניות, טמפרטורה, שמרים, טיימרים, מחשבון תמחור מהיר */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const st = { ing: '', qty: 1, from: 'cup', pan1: '24', pan2: '26', c: 180, yeastQ: 25, yeastFrom: 'fresh', qc: { cost: 30, hours: 1, price: '' } };

  P.tools = {
    title: 'כלים וממירים',
    render(main) {
      const ings = A.state.ingredients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
      if (!st.ing && ings.length) st.ing = (ings.find(i => i.name === 'קמח לבן') || ings[0]).id;
      main.innerHTML = `
      <div class="grid g2">
        <div class="card"><div class="card-h"><h3>${A.icon('scale')}ממיר כוסות ↔ גרמים</h3></div>
          <div class="form-grid c3">
            <label class="field full"><span>מצרך</span><select data-f="ing">${A.opts(ings.map(i => [i.id, i.name]), st.ing)}</select></label>
            <label class="field"><span>כמות</span><input type="number" step="any" min="0" data-f="qty" value="${st.qty}"></label>
            <label class="field" style="grid-column:span 2"><span>יחידה</span><select data-f="from">${A.unitOpts(st.from)}</select></label>
          </div>
          <div id="convOut" style="margin-top:14px"></div>
          <p class="small muted">כוס = 240 מ״ל · כף = 15 מ״ל · כפית = 5 מ״ל. המשקל לכוס נלקח מהמחסן — אפשר לכייל אותו שם לפי הכוס שלך.</p></div>

        <div class="card"><div class="card-h"><h3>${A.icon('box')}התאמת תבנית</h3></div>
          <div class="form-grid"><label class="field"><span>תבנית במתכון</span><input data-f="pan1" value="${U.esc(st.pan1)}"><small>קוטר (24) או מידות (20x30)</small></label>
          <label class="field"><span>התבנית שלי</span><input data-f="pan2" value="${U.esc(st.pan2)}"></label></div>
          <div id="panOut" style="margin-top:14px"></div>
          <div class="divider"></div>
          <h4 style="margin-bottom:8px">טבלת שטחים מהירה (פי כמה לעומת עגולה 24)</h4>
          <div class="small" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 12px">${['18', '20', '22', '24', '26', '28', '20x30', '25x35', '30x40'].map(p => `<span>${p.replace('x', '×')} ס״מ: <b>×${U.fmt(U.round(A.panArea(p) / A.panArea('24'), 2))}</b></span>`).join('')}</div></div>

        <div class="card"><div class="card-h"><h3>${A.icon('flame')}טמפרטורה ותנור</h3></div>
          <label class="field"><span>צלזיוס</span><input type="number" data-f="c" value="${st.c}"></label>
          <div id="tempOut" style="margin-top:12px"></div></div>

        <div class="card"><div class="card-h"><h3>שמרים</h3></div>
          <div class="form-grid"><label class="field"><span>כמות (גרם)</span><input type="number" step="any" data-f="yeastQ" value="${st.yeastQ}"></label>
          <label class="field"><span>סוג במתכון</span><select data-f="yeastFrom">${A.opts([['fresh', 'שמרים טריים'], ['dry', 'שמרים יבשים (אינסטנט)'], ['active', 'שמרים יבשים פעילים']], st.yeastFrom)}</select></label></div>
          <div id="yeastOut" style="margin-top:12px"></div></div>

        <div class="card"><div class="card-h"><h3>${A.icon('timer')}טיימרים</h3></div>
          <div class="row">${[1, 3, 5, 10, 12, 15, 20, 25, 30, 40, 45, 60].map(m => `<button class="btn sm ghost" data-t="${m}">${m} דק׳</button>`).join('')}</div>
          <div class="row" style="margin-top:12px;flex-wrap:nowrap"><input type="number" min="1" placeholder="דקות" id="tMin" style="width:100px"><input placeholder="שם (למשל: עוגיות)" id="tLbl"><button class="btn sm" data-act="timer">הפעלה</button></div>
          <p class="small muted">אפשר להפעיל כמה טיימרים במקביל. הם מופיעים בפינת המסך ומצפצפים בסיום.</p></div>

        <div class="card"><div class="card-h"><h3>${A.icon('wallet')}מחשבון תמחור מהיר</h3><span class="small muted">להצעת מחיר לעוגה מעוצבת או הזמנה מיוחדת</span></div>
          <div class="form-grid c3">
            <label class="field"><span>חומרים ואריזה (₪)</span><input type="number" step="any" data-q="cost" value="${st.qc.cost}"></label>
            <label class="field"><span>שעות עבודה</span><input type="number" step="any" data-q="hours" value="${st.qc.hours}"></label>
            <label class="field"><span>מחיר שחשבת (₪)</span><input type="number" step="any" data-q="price" value="${st.qc.price}"></label>
          </div>
          <div id="qcOut" style="margin-top:12px"></div></div>
      </div>`;
      const out = () => {
        const ing = C.ing(st.ing);
        if (ing) {
          const g = A.toGrams(st.qty, st.from, ing);
          const row = (u, l) => { const v = A.fromGrams(g, u, ing); return isFinite(v) && v > 0 ? `<div class="cost-row"><span>${l}</span><b>${A.fmtQty(v, u)}</b></div>` : ''; };
          main.querySelector('#convOut').innerHTML = `<div class="verdict none" style="margin-bottom:10px"><div class="big">${A.fmtGrams(g)}</div><div class="small">${U.fmt(st.qty)} ${A.UNITS[st.from]} ${U.esc(ing.name)}</div></div>` +
            row('cup', 'כוסות') + row('tbsp', 'כפות') + row('tsp', 'כפיות') + row('ml', 'מ״ל') + (ing.gramsPerUnit ? row('unit', 'יחידות') : '') +
            `<div class="cost-row"><span>עלות</span><b>${U.money(C.lineCost({ ingId: ing.id, qty: st.qty, unit: st.from }).cost)}</b></div>`;
        }
        const a1 = A.panArea(st.pan1), a2 = A.panArea(st.pan2);
        main.querySelector('#panOut').innerHTML = a1 && a2 ? `<div class="verdict none"><div class="big">×${U.fmt(U.round(a2 / a1, 2))}</div><div class="small">הכפילי את כל המצרכים פי ${U.fmt(U.round(a2 / a1, 2))}. ${a2 > a1 * 1.3 ? 'בתבנית גדולה בהרבה — בדקי זמן אפייה ארוך יותר בכ־10–20%.' : a2 < a1 * 0.75 ? 'בתבנית קטנה — בדקי את העוגה מוקדם יותר.' : ''}</div></div>` : '';
        const c = +st.c || 0;
        main.querySelector('#tempOut').innerHTML = `<div class="cost-row"><span>פרנהייט</span><b>${Math.round(c * 9 / 5 + 32)}°F</b></div><div class="cost-row"><span>תנור טורבו (מאוורר)</span><b>${c - 20}°C</b></div><div class="cost-row"><span>גז מארק (בערך)</span><b>${Math.max(1, Math.round((c - 121) / 14))}</b></div>`;
        const q = +st.yeastQ || 0, fresh = st.yeastFrom === 'fresh' ? q : st.yeastFrom === 'dry' ? q * 3 : q * 2.5;
        main.querySelector('#yeastOut').innerHTML = `<div class="cost-row"><span>שמרים טריים</span><b>${U.fmt(U.round(fresh, 1))} גרם</b></div><div class="cost-row"><span>שמרים יבשים (אינסטנט)</span><b>${U.fmt(U.round(fresh / 3, 1))} גרם · כ־${U.fmt(U.round(fresh / 3 / 3.1, 1))} כפיות</b></div><div class="cost-row"><span>שמרים יבשים פעילים</span><b>${U.fmt(U.round(fresh / 2.5, 1))} גרם</b></div>`;
        const s = A.state.settings, qc = st.qc, vf = C.vatFactor();
        const full = (+qc.cost || 0) + (+qc.hours || 0) * s.hourlyRate;
        const sug = Math.ceil(full / (1 - s.targetMargin) * vf), min = Math.ceil(full * vf);
        const pr = +qc.price || 0, margin = pr ? (pr / vf - full) / (pr / vf) : 0, perHour = qc.hours ? (pr / vf - qc.cost) / qc.hours : 0;
        main.querySelector('#qcOut').innerHTML = `<div class="price-tiers"><div><span>מינימום</span><b>${U.money(min)}</b></div><div class="rec"><span>מומלץ</span><b>${U.money(sug)}</b></div><div><span>שלך</span><b>${pr ? U.money(pr) : '—'}</b><span>${pr ? 'רווח ' + U.pct(margin) : ''}</span></div></div>
          ${pr ? `<p class="small" style="margin-bottom:0">במחיר הזה נשאר לך <b>${U.money(perHour, 0)}</b> לשעת עבודה (היעד שלך: ${U.money(s.hourlyRate)} + רווח).</p>` : ''}`;
      };
      out();
      main.oninput = e => {
        const f = e.target.dataset.f, q = e.target.dataset.q;
        if (f) st[f] = ['qty', 'c', 'yeastQ'].includes(f) ? U.num(e.target.value) : e.target.value;
        if (q) st.qc[q] = U.num(e.target.value);
        out();
      };
      main.onchange = main.oninput;
      main.onclick = e => {
        const t = e.target.closest('[data-t]'); if (t) return A.startTimer(+t.dataset.t, t.dataset.t + ' דקות');
        if (e.target.closest('[data-act=timer]')) { const m = U.num(main.querySelector('#tMin').value); if (m > 0) A.startTimer(m, main.querySelector('#tLbl').value || m + ' דקות'); }
      };
    }
  };
})(window);
