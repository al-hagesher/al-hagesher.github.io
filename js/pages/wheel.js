/* על הגשר — גלגל החיים (טוני רובינס) ומעקב התקדמות */
(function (root) {
  const A = root.App, U = A.util, P = A.pages = A.pages || {};
  const view = { sel: null, cmp: 'prev', area: -1 };
  const COLORS = ['#8f603f', '#b8875e', '#a35c46', '#6b7f5e', '#6d4a33', '#c9a77c', '#7d6a5a', '#9a7b4f'];
  const avg = e => U.sum(e.scores) / e.scores.length;
  const entries = () => A.state.wheel.entries.slice().sort((a, b) => a.date.localeCompare(b.date));
  const todayEntry = () => A.state.wheel.entries.find(e => e.date === U.today());
  // רצף ימים של צ׳ק־אין (נספר עד היום, או עד אתמול אם היום עוד לא מולא)
  const streak = () => {
    const days = new Set(A.state.wheel.entries.map(e => e.date));
    let d = days.has(U.today()) ? U.today() : U.addDays(U.today(), -1), n = 0;
    while (days.has(d)) { n++; d = U.addDays(d, -1); }
    return n;
  };
  const avgRange = (from, to) => { const es = A.state.wheel.entries.filter(e => e.date >= from && e.date <= to); return es.length ? U.sum(es, avg) / es.length : null; };

  function wheelSvg(areas, cur, cmp) {
    const S = 520, c = S / 2, R = 180, n = areas.length, step = 2 * Math.PI / n;
    const pt = (r, a) => [c + r * Math.cos(a), c + r * Math.sin(a)];
    const ang = i => -Math.PI / 2 + i * step;
    const wedge = (r, i) => { const [x0, y0] = pt(r, ang(i)), [x1, y1] = pt(r, ang(i + 1)); return `M${c},${c}L${x0},${y0}A${r},${r} 0 0 1 ${x1},${y1}Z`; };
    let s = `<svg class="wheel-svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="גלגל החיים">`;
    for (let k = 10; k >= 2; k -= 2) s += `<circle cx="${c}" cy="${c}" r="${R * k / 10}" fill="${k === 10 ? 'var(--sand-2)' : 'none'}" stroke="var(--line-2)" stroke-width="${k === 10 ? 1.4 : .8}" ${k < 10 ? 'stroke-dasharray="2 4"' : ''}/>`;
    for (let i = 0; i < n; i++) { const [x, y] = pt(R, ang(i)); s += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="var(--line-2)" stroke-width=".8"/>`; }
    if (cur) cur.scores.forEach((v, i) => s += `<path d="${wedge(R * v / 10, i)}" fill="${COLORS[i % 8]}" fill-opacity=".82" stroke="var(--paper)" stroke-width="1.5"><title>${U.esc(areas[i])}: ${v}</title></path>`);
    if (cmp) cmp.scores.forEach((v, i) => s += `<path d="${wedge(R * v / 10, i)}" fill="none" stroke="var(--brown)" stroke-width="1.6" stroke-dasharray="5 4"/>`);
    // קווי כבלים עדינים — מוטיב הגשר במרכז
    s += `<circle cx="${c}" cy="${c}" r="22" fill="var(--paper)" stroke="var(--brown)" stroke-width="1"/><text x="${c}" y="${c + 6}" text-anchor="middle" style="font-family:var(--serif);font-size:17px">${cur ? U.fmt(U.round(avg(cur), 1)) : ''}</text>`;
    areas.forEach((a, i) => {
      const m = ang(i + .5), [x, y] = pt(R + 24, m), cos = Math.cos(m);
      const anchor = Math.abs(cos) < .25 ? 'middle' : cos > 0 ? 'start' : 'end';
      const words = a.split(' '); const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [a];
      s += `<text x="${x}" y="${y + (Math.sin(m) > .3 ? 8 : Math.sin(m) < -.3 ? -4 : 4) - (lines.length - 1) * 7}" text-anchor="${anchor}">${lines.map((l, k) => `<tspan x="${x}" dy="${k ? 15 : 0}">${U.esc(l)}</tspan>`).join('')}${cur ? `<tspan x="${x}" dy="15" style="fill:${COLORS[i % 8]};font-size:14px">${cur.scores[i]}</tspan>` : ''}</text>`;
    });
    return s + '</svg>';
  }

  P.wheel = {
    title: 'גלגל החיים',
    render(main) {
      const areas = A.state.wheel.areas, list = entries();
      A.setActions(`<button class="btn" data-act="new">${A.icon(todayEntry() ? 'edit' : 'plus')}${todayEntry() ? 'עדכון הצ׳ק־אין של היום' : 'הצ׳ק־אין של היום'}</button>`);
      if (!list.length) {
        main.innerHTML = `<div class="card cables" style="max-width:760px">
          <h2 style="margin-bottom:10px">גלגל החיים</h2>
          <p>כלי של טוני רובינס לבדיקת איזון: מדרגים כל תחום בחיים מ־1 עד 10, ורואים בעין איפה הגלגל "שטוח". גלגל לא מאוזן לא מתגלגל חלק — גם כשהעסק פורח.</p>
          <p class="muted">צ׳ק־אין יומי של דקה: מדרגים, כותבים ניצחון קטן ודבר אחד שמודים עליו. אפשר לחזור ולעדכן במהלך היום — נשמרת רשומה אחת לכל יום, וכאן תראי רצף, ממוצע שבועי וגרף התקדמות.</p>
          <button class="btn" data-act="new">${A.icon('wheel')}הצ׳ק־אין הראשון שלי</button></div>`;
      } else {
        const cur = list.find(e => e.id === view.sel) || list[list.length - 1];
        const idx = list.indexOf(cur), prev = list[idx - 1];
        const cmp = view.cmp === 'prev' ? prev : view.cmp === 'first' ? (idx > 0 ? list[0] : null) : null;
        const low = cur.scores.indexOf(Math.min(...cur.scores)), high = cur.scores.indexOf(Math.max(...cur.scores));
        const days = U.diffDays(U.today(), list[list.length - 1].date);
        const labels = list.map(e => U.fmtDate(e.date));
        const series = view.area < 0 ? [{ name: 'ממוצע', color: 'var(--brown)', values: list.map(avg), width: 3 }, { name: 'מצב רוח', color: 'var(--caramel)', values: list.map(e => e.mood || null) }]
          : [{ name: areas[view.area], color: COLORS[view.area % 8], values: list.map(e => e.scores[view.area]), width: 3 }];
        const st = streak(), w1 = avgRange(U.addDays(U.today(), -6), U.today()), w0 = avgRange(U.addDays(U.today(), -13), U.addDays(U.today(), -7));
        main.innerHTML = `
        <div class="grid g3 section">
          <div class="card kpi"><div class="lbl">${A.icon('flame')}רצף ימים</div><div class="val">${st}</div><div class="sub">${todayEntry() ? 'היום כבר מילאת ✓' : 'עוד לא מילאת היום'}</div></div>
          <div class="card kpi"><div class="lbl">ממוצע 7 ימים</div><div class="val">${w1 != null ? U.fmt(U.round(w1, 1)) : '—'}</div>${w1 != null && w0 != null ? `<div class="sub">${w1 >= w0 ? '▲' : '▼'} ${U.fmt(U.round(Math.abs(w1 - w0), 1))} מהשבוע הקודם</div>` : ''}</div>
          <div class="card kpi" style="display:flex;align-items:center;justify-content:center"><button class="btn" data-act="new">${A.icon(todayEntry() ? 'edit' : 'plus')}${todayEntry() ? 'עדכון היום' : 'צ׳ק־אין להיום'}</button></div>
        </div>
        <div class="wheel-wrap section">
          <div class="card">
            <div class="card-h"><h3>${U.fmtDate(cur.date)}${cur === list[list.length - 1] ? ' · אחרונה' : ''}</h3>
              <div class="seg">${[['prev', 'מול הקודמת'], ['first', 'מול הראשונה'], ['none', 'בלי השוואה']].map(([v, l]) => `<button data-cmp="${v}" class="${view.cmp === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
            ${wheelSvg(areas, cur, cmp)}
            ${cmp ? `<p class="small muted" style="text-align:center;margin:0">הקו המקווקו = ${view.cmp === 'prev' ? 'הבדיקה הקודמת' : 'הבדיקה הראשונה'} (${U.fmtDate(cmp.date)})</p>` : ''}
          </div>
          <div class="stack">
            <div class="grid g2">
              <div class="card kpi"><div class="lbl">ציון איזון ממוצע</div><div class="val">${U.fmt(U.round(avg(cur), 1))}</div>${prev ? `<div class="sub">${avg(cur) >= avg(prev) ? '▲' : '▼'} ${U.fmt(U.round(Math.abs(avg(cur) - avg(prev)), 1))} מהבדיקה הקודמת</div>` : ''}</div>
              <div class="card kpi"><div class="lbl">מצב רוח כללי</div><div class="val">${cur.mood || '—'}<span class="small muted">/10</span></div></div>
            </div>
            <div class="card">
              <div class="insight good"><div class="ic">${A.icon('star')}</div><div><b>התחום החזק: ${U.esc(areas[high])} (${cur.scores[high]})</b><div class="small muted">מה עובד כאן — ואיך להעביר את זה לתחומים אחרים?</div></div></div>
              <div class="insight alert"><div class="ic">${A.icon('heart')}</div><div><b>דורש תשומת לב: ${U.esc(areas[low])} (${cur.scores[low]})</b><div class="small muted">${cur.notes && cur.notes[low] ? U.esc(cur.notes[low]) : 'שיפור קטן בתחום הנמוך משפיע הכי הרבה על כל הגלגל.'}</div></div></div>
              ${prev ? (() => { const ch = cur.scores.map((v, i) => [i, v - prev.scores[i]]).sort((a, b) => b[1] - a[1]); return ch[0][1] > 0 ? `<div class="insight"><div class="ic">${A.icon('trend')}</div><div><b>הכי השתפר: ${U.esc(areas[ch[0][0]])} (+${ch[0][1]})</b></div></div>` : ''; })() : ''}
            </div>
            <div class="card">
              ${cur.focus ? `<h4>הצעד שבחרתי</h4><p style="margin:4px 0 12px;font-size:1.05rem">${U.esc(cur.focus)}</p>` : ''}
              ${cur.wins ? `<h4>ניצחונות</h4><p style="margin:4px 0 12px;white-space:pre-wrap">${U.esc(cur.wins)}</p>` : ''}
              ${cur.gratitude ? `<h4>הכרת תודה</h4><p style="margin:4px 0 0;white-space:pre-wrap">${U.esc(cur.gratitude)}</p>` : ''}
              <div class="row" style="margin-top:12px"><button class="btn sm ghost" data-edit="${cur.id}">${A.icon('edit')}עריכה</button></div>
            </div>
          </div>
        </div>
        <div class="card section"><div class="card-h"><h3>${A.icon('trend')}ההתקדמות שלי</h3><select data-f="area" style="width:auto">${A.opts([[-1, 'ממוצע ומצב רוח'], ...areas.map((a, i) => [i, a])], view.area)}</select></div>
          ${list.length > 1 ? A.chart.lines(labels, series, { min: 0, max: 10, fmt: v => U.fmt(v) }) : '<p class="muted">אחרי הבדיקה השנייה יופיע כאן גרף התקדמות.</p>'}</div>
        <div class="card"><div class="card-h"><h3>כל הבדיקות</h3></div>
          ${list.slice().reverse().map(e => `<div class="list-item click ${e === cur ? 'sel' : ''}" data-sel="${e.id}"><div class="date-box"><b>${U.parse(e.date).getDate()}</b><span>${U.MONTHS[U.parse(e.date).getMonth()].slice(0, 3)}׳</span></div>
            <div class="main"><div class="t">ממוצע ${U.fmt(U.round(avg(e), 1))}${e === cur ? ' <span class="badge">מוצגת</span>' : ''}</div><div class="s">${U.esc(e.focus || e.wins || '')}</div></div>
            <div class="row" style="gap:3px">${e.scores.map((v, i) => `<i title="${U.esc(areas[i])}: ${v}" style="width:6px;height:${v * 3}px;background:${COLORS[i % 8]};border-radius:2px;align-self:flex-end;display:inline-block"></i>`).join('')}</div></div>`).join('')}</div>`;
      }
      main.onclick = e => {
        const b = e.target.closest('[data-cmp],[data-sel],[data-edit],[data-act]'); if (!b) return;
        if (b.dataset.cmp) { view.cmp = b.dataset.cmp; A.refresh(); }
        else if (b.dataset.sel) { view.sel = b.dataset.sel; A.refresh(); root.scrollTo({ top: 0, behavior: 'smooth' }); }
        else if (b.dataset.edit) edit(A.state.wheel.entries.find(x => x.id === b.dataset.edit));
        else if (b.dataset.act === 'new') edit();
      };
      main.onchange = e => { if (e.target.dataset.f === 'area') { view.area = +e.target.value; A.refresh(); } };
      document.getElementById('topActions').onclick = e => { if (e.target.closest('[data-act=new]')) edit(); };
    }
  };

  function edit(x) {
    if (!x) x = todayEntry();
    const areas = A.state.wheel.areas, last = entries().slice(-1)[0];
    const d = x || { date: U.today(), scores: last ? last.scores.slice() : areas.map(() => 5), notes: {}, wins: '', gratitude: '', focus: '', mood: 7 };
    const hints = Object.fromEntries(A.WHEEL_AREAS.map(a => [a.name, a.hint]));
    A.modal({
      title: `צ׳ק־אין · ${x ? U.dayName(x.date) + ' ' + U.fmtDate(x.date) : 'היום'}`, size: 'wide',
      body: `<p class="muted small" style="margin-top:0">דרגי כל תחום מ־1 (רחוק מאוד ממה שאני רוצה) עד 10 (בדיוק כמו שחלמתי). לא מה שנכון "להרגיש" — מה שבאמת.</p>
        <div class="grid g2" style="gap:0 28px">${areas.map((a, i) => `<div class="area-slider">
          <div class="top"><div><b>${U.esc(a)}</b><div class="hint">${U.esc(hints[a] || '')}</div></div><span class="score" id="sc${i}">${d.scores[i]}</span></div>
          <input type="range" min="1" max="10" step="1" value="${d.scores[i]}" data-i="${i}" aria-label="${U.esc(a)}">
          <input placeholder="מה יעלה את הציון בנקודה אחת?" data-note="${i}" value="${U.esc((d.notes || {})[i] || '')}" style="min-height:34px;padding:6px 10px;font-size:.88rem"></div>`).join('')}</div>
        <div class="divider"></div>
        <div class="form-grid">
          <label class="field"><span>תאריך</span><input type="date" name="date" value="${d.date}"></label>
          <label class="field"><span>מצב רוח כללי: <b id="moodV">${d.mood || 7}</b>/10</span><input type="range" min="1" max="10" name="mood" data-num="1" value="${d.mood || 7}"></label>
          <label class="field full"><span>ניצחונות מהתקופה האחרונה (גם קטנים)</span><textarea name="wins" rows="2">${U.esc(d.wins)}</textarea></label>
          <label class="field full"><span>על מה אני מודה</span><textarea name="gratitude" rows="2">${U.esc(d.gratitude)}</textarea></label>
          <label class="field full"><span>הצעד האחד שאני מתחייבת אליו עד הבדיקה הבאה</span><input name="focus" value="${U.esc(d.focus)}"></label>
        </div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button><span class="spacer"></span>${x ? `<button class="btn danger" data-del>${A.icon('trash')}</button>` : ''}`,
      onMount(w) {
        w.oninput = e => {
          if (e.target.dataset.i != null) w.querySelector('#sc' + e.target.dataset.i).textContent = e.target.value;
          if (e.target.name === 'mood') w.querySelector('#moodV').textContent = e.target.value;
        };
        w.addEventListener('click', async e => {
          if (e.target.closest('[data-save]')) {
            const v = A.formData(w.querySelector('.form-grid'));
            const scores = [...w.querySelectorAll('[data-i]')].map(r => +r.value);
            const notes = {}; w.querySelectorAll('[data-note]').forEach(n => { if (n.value.trim()) notes[n.dataset.note] = n.value.trim(); });
            const date = v.date || U.today();
            // רשומה אחת ליום: אם כבר יש צ׳ק־אין בתאריך הזה — מעדכנים אותו
            const sameDay = A.state.wheel.entries.find(e => e.date === date && e !== x);
            const t = sameDay || x || { id: U.uid() };
            Object.assign(t, { date, mood: v.mood, wins: v.wins, gratitude: v.gratitude, focus: v.focus, scores, notes, demo: false });
            if (sameDay && x) A.state.wheel.entries = A.state.wheel.entries.filter(e => e !== x);
            if (!sameDay && !x) A.state.wheel.entries.push(t);
            view.sel = t.id; A.closeModal(); A.commit('הגלגל נשמר 🤎');
          }
          if (e.target.closest('[data-del]')) {
            A.closeModal();
            if (await A.confirm('למחוק את הבדיקה הזאת?', 'מחיקה')) { A.state.wheel.entries = A.state.wheel.entries.filter(y => y !== x); view.sel = null; A.commit(); A.undoToast('הבדיקה נמחקה', () => { A.state.wheel.entries.push(x); A.commit(); }); }
          }
        });
      }
    });
  }
  A.wheelSvg = wheelSvg;
})(window);
