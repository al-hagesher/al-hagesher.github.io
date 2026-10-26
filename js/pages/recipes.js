/* על הגשר — מתכונים: רשימה, צפייה עם הכפלה והמרות, עלויות ותמחור, עריכה, מצב אפייה */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};
  const view = A.recipeView = { q: '', cat: 'הכל', sort: 'name', factor: 1, mode: 'orig', bakers: false, id: null };

  const STATUS_TXT = { ok: 'רווחי', warn: 'רווח נמוך', bad: 'בהפסד', none: 'ללא מחיר' };
  const thumb = r => A.safeImg(r.image) ? `<img src="${A.safeImg(r.image)}" alt="">` : `<span class="init">${U.esc((r.name || '?').trim()[0] || '?')}</span>`;

  /* ---------- רשימה ---------- */
  P.recipes = {
    title: 'מתכונים',
    render(main) {
      A.setActions(`<button class="btn" data-act="new">${A.icon('plus')}מתכון חדש</button>`);
      const cats = ['הכל', '★ מועדפים', '📖 מתכוני בסיס', ...A.RECIPE_CATS.filter(c => A.state.recipes.some(r => r.category === c))];
      let list = A.state.recipes.filter(r => {
        if (view.cat === '★ מועדפים' && !r.favorite) return false;
        if (view.cat === '📖 מתכוני בסיס' && !r.library) return false;
        if (!['הכל', '★ מועדפים', '📖 מתכוני בסיס'].includes(view.cat) && r.category !== view.cat) return false;
        if (view.q && !(r.name + ' ' + (r.tags || []).join(' ') + ' ' + (r.description || '')).includes(view.q)) return false;
        return true;
      }).map(r => ({ r, p: C.pricing(r) }));
      const sorters = {
        name: (a, b) => a.r.name.localeCompare(b.r.name, 'he'),
        margin: (a, b) => b.p.margin - a.p.margin,
        time: (a, b) => a.p.times.total - b.p.times.total,
        sold: (a, b) => sold(b.r.id) - sold(a.r.id)
      };
      list.sort(sorters[view.sort]);
      main.innerHTML = `
        <div class="row section">
          <div class="search">${A.icon('search')}<input type="search" placeholder="חיפוש מתכון, תגית…" value="${U.esc(view.q)}" data-f="q"></div>
          <select data-f="sort" style="width:auto">${A.opts([['name', 'לפי שם'], ['margin', 'לפי רווחיות'], ['time', 'לפי זמן'], ['sold', 'הכי נמכרים']], view.sort)}</select>
        </div>
        <div class="seg section scroll" style="display:flex">${cats.map(c => `<button data-cat="${U.esc(c)}" class="${view.cat === c ? 'on' : ''}">${U.esc(c)}</button>`).join('')}</div>
        ${list.length ? `<div class="recipe-grid">${list.map(({ r, p }) => `
          <div class="card recipe-card" data-open="${r.id}">
            <div class="ph">${thumb(r)}<button class="icon-btn fav ${r.favorite ? 'on' : ''}" data-fav="${r.id}" aria-label="מועדף">${A.icon('star')}</button></div>
            <div class="body">
              <div class="row between"><h3>${U.esc(r.name)}</h3>${(r.tags || []).includes('בניסוי') ? '<span class="badge warn">בניסוי</span>' : ''}</div>
              <div class="meta"><span>${A.icon('clock')}${U.minutes(p.times.total)}</span><span>${U.fmt(r.yield)} ${U.esc(r.yieldUnit || 'יח׳')}</span><span>${U.esc(r.category || '')}</span></div>
              <div class="row between" style="margin-top:auto;padding-top:6px">
                <span class="small">עלות ${U.money(p.perUnit)} · מחיר <b>${p.price ? U.money(p.price) : '—'}</b></span>
                <span class="badge ${p.status === 'none' ? '' : p.status}">${p.price ? U.pct(p.margin) : isComponent(r) ? 'רכיב' : STATUS_TXT.none}</span>
              </div>
            </div>
          </div>`).join('')}</div>` : `<div class="card empty"><h3>${A.state.recipes.length ? 'לא נמצאו מתכונים' : 'עוד אין מתכונים'}</h3><p>${A.state.recipes.length ? 'נסי חיפוש אחר' : 'הוסיפי את המתכון הראשון, או טעני נתוני דוגמה מדף הבית.'}</p><button class="btn" data-act="new">${A.icon('plus')}מתכון חדש</button></div>`}`;
      main.oninput = e => { if (e.target.dataset.f === 'q') { view.q = e.target.value.trim(); rerenderKeepFocus(main); } };
      main.onchange = e => { if (e.target.dataset.f === 'sort') { view.sort = e.target.value; A.refresh(); } };
      main.onclick = e => {
        const fav = e.target.closest('[data-fav]');
        if (fav) { const r = C.recipe(fav.dataset.fav); r.favorite = !r.favorite; A.commit(); return; }
        const c = e.target.closest('[data-cat]'); if (c) { view.cat = c.dataset.cat; A.refresh(); return; }
        const o = e.target.closest('[data-open]'); if (o) { A.go('recipe/' + o.dataset.open); return; }
        if (e.target.closest('[data-act="new"]')) editRecipe();
      };
      document.getElementById('topActions').onclick = e => { if (e.target.closest('[data-act="new"]')) editRecipe(); };
    }
  };
  function rerenderKeepFocus(main) {
    const pos = document.activeElement && document.activeElement.selectionStart;
    A.refresh();
    const i = main.querySelector('[data-f="q"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { } }
  }
  // תמונת הספרייה המקורית של מתכון בסיס (אם יש)
  const libImage = r => r.library && (A.LIBRARY || []).some(x => 'lib-' + x.key === r.id && !x.noImg) ? `assets/recipes/${r.id.slice(4)}.jpg` : '';
  const isComponent = r => r.category === 'בסיסים וקרמים' || (!r.price && C.usedAsSub(r.id).length > 0);
  A.isComponent = isComponent;
  const sold = id => U.sum(C.activeOrders(), o => U.sum(o.items.filter(i => i.recipeId === id), i => i.qty));

  /* ---------- תצוגת שורה לפי מצב ---------- */
  function displayLine(l, factor, mode) {
    if (l.subId) return { q: (+l.qty || 0) * factor, unit: 'batch', approx: '', ing: null, sub: C.recipe(l.subId) };
    const ing = C.ing(l.ingId), qty = (+l.qty || 0) * factor;
    let q = qty, unit = l.unit, approx = '';
    if (ing && mode === 'grams' && !(l.unit === 'unit' && !ing.gramsPerUnit)) {
      const g = A.toGrams(qty, l.unit, ing);
      if (l.unit === 'unit') approx = `${A.fmtQty(qty, 'unit')} יח׳`;
      q = g; unit = 'g';
    } else if (ing && mode === 'cups' && ['g', 'kg', 'ml', 'l'].includes(l.unit)) {
      const g = A.toGrams(qty, l.unit, ing), gpc = +ing.gramsPerCup || 240;
      if (g >= gpc / 4 - 1e-6) { q = g / gpc; unit = 'cup'; }
      else if (g >= gpc / 16 - 1e-6) { q = g / (gpc / 16); unit = 'tbsp'; }
      else { q = g / (gpc / 48); unit = 'tsp'; }
      approx = A.fmtGrams(g);
    } else if (ing && ['cup', 'tbsp', 'tsp'].includes(l.unit) && mode !== 'cups') {
      approx = A.fmtGrams(A.toGrams(qty, l.unit, ing));
    }
    return { q, unit, approx, ing };
  }
  const unitLabel = (unit, q) => unit === 'batch' ? (q === 1 ? 'מנה' : 'מנות') : unit === 'unit' ? (q === 1 ? 'יחידה' : 'יח׳') : unit === 'cup' && q > 1 ? 'כוסות' : unit === 'tbsp' && q > 1 ? 'כפות' : unit === 'tsp' && q > 1 ? 'כפיות' : A.UNITS[unit];

  /* ---------- צפייה במתכון ---------- */
  P.recipe = {
    title: args => (C.recipe(args[0]) || {}).name || 'מתכון',
    render(main, [id]) {
      const r = C.recipe(id);
      if (!r) { main.innerHTML = `<div class="card empty"><h3>המתכון לא נמצא</h3><a class="btn" href="#/recipes">לכל המתכונים</a></div>`; return; }
      if (view.id !== id) { view.id = id; view.factor = 1; view.mode = 'orig'; view.bakers = false; }
      const f = view.factor, p = C.pricing(r), t = p.times, s = A.state.settings;
      const allergens = C.allergens(r);
      A.setActions(`<button class="btn ghost hide-m" data-act="label">${A.icon('box')}תווית</button><button class="btn ghost hide-m" data-act="print">${A.icon('print')}הדפסה</button><button class="btn soft" data-act="cook">${A.icon('play')}מצב אפייה</button><button class="btn" data-act="edit">${A.icon('edit')}עריכה</button>`);

      // אחוזי אופה: ביחס לסך הקמח בגרמים
      const flourG = U.sum(r.ingredients, l => { const i = C.ing(l.ingId); return i && i.category === 'קמחים' ? A.toGrams(l.qty, l.unit, i) : 0; });
      const sections = U.groupBy(r.ingredients.map((l, idx) => Object.assign({ idx }, l)), l => l.section || '');
      const ingRows = Object.keys(sections).map(sec => (sec ? `<tr class="ing-section"><td colspan="4">${U.esc(sec)}</td></tr>` : '') + sections[sec].map(l => {
        const d = displayLine(l, f, view.mode), c = C.lineCost(l, f);
        const name = d.sub ? `<a href="#/recipe/${d.sub.id}">מתכון: ${U.esc(d.sub.name)}</a>` : U.esc(d.ing ? d.ing.name : (l.name || 'מצרך לא מקושר'));
        const bp = view.bakers && flourG && d.ing ? A.toGrams(l.qty, l.unit, d.ing) / flourG : null;
        return `<tr><td class="q">${A.fmtQty(d.q, d.unit)} ${unitLabel(d.unit, d.q)}</td><td>${name}${d.approx ? ` <span class="muted small">(${d.approx})</span>` : ''}${c.missing ? ` <span class="badge warn" title="${U.esc(c.reason)}">${U.esc(c.reason)}</span>` : ''}</td>
          <td class="n small muted">${bp != null ? U.fmt(U.round(bp * 100, 1)) + '%' : ''}</td><td class="n small">${c.cost ? U.money(c.cost) : ''}</td></tr>`;
      }).join('')).join('');

      const seg = (name, items, cur) => `<div class="seg">${items.map(([v, l]) => `<button data-${name}="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      const tb = [['prep', 'הכנה', 'var(--brown)'], ['decor', 'עיצוב ואריזה', 'var(--brown-3)'], ['rest', 'התפחה/מנוחה', 'var(--sand)'], ['bake', 'אפייה', 'var(--caramel)'], ['cool', 'צינון', 'var(--cool)']];
      const verdictTxt = {
        ok: `המחיר מכסה את כל העלויות, משלם לך ${U.money(s.hourlyRate)} לשעה ומשאיר רווח של ${U.pct(p.margin)}.`,
        warn: `המחיר מכסה עלויות ושכר, אבל הרווח (${U.pct(p.margin)}) מתחת ליעד שלך (${U.pct(p.targetMargin)}). מומלץ ${U.money(p.suggested)}.`,
        bad: `המחיר לא מכסה את העלות המלאה כולל השכר שלך. המינימום הוא ${U.money(p.minimum)}.`,
        none: 'עוד לא הוגדר מחיר מכירה. ההמלצה מבוססת על העלויות והיעד שלך.'
      };

      main.innerHTML = `
      <div class="print-only" style="text-align:center;margin-bottom:10px"><img src="assets/logo.png" style="width:160px"></div>
      <div class="card section recipe-hero cables">
        <div class="ph photo-edit">${A.safeImg(r.image) ? `<img src="${A.safeImg(r.image)}" alt="${U.esc(r.name)}">` : `<span style="font-family:var(--serif);font-size:4rem;color:var(--caramel)">${U.esc(r.name[0] || '')}</span>`}
          <div class="photo-actions no-print">
            <label class="btn sm">${A.icon('image')}${r.image ? 'החלפת תמונה' : 'הוספת תמונה'}<input type="file" accept="image/*" data-photo hidden></label>
            ${r.library && r.image && !r.image.startsWith('assets/') && libImage(r) ? `<button class="btn sm soft" data-act="photoReset">התמונה המקורית</button>` : ''}
            ${r.image ? `<button class="btn sm ghost" data-act="photoRemove" aria-label="הסרת התמונה">${A.icon('trash')}</button>` : ''}
          </div></div>
        <div class="stack">
          <div class="row"><span class="chip">${U.esc(r.category || 'ללא קטגוריה')}</span>${(r.tags || []).map(t => `<span class="chip">${U.esc(t)}</span>`).join('')}
            <button class="icon-btn fav ${r.favorite ? 'on' : ''}" data-act="fav" aria-label="מועדף">${A.icon('star')}</button></div>
          ${r.description ? `<p style="margin:0;font-size:1.05rem">${U.esc(r.description)}</p>` : ''}
          <div class="grid g4" style="gap:10px">
            <div><div class="muted small">יוצא</div><b>${U.fmt(U.round(r.yield * f, 2))} ${U.esc(r.yieldUnit || 'יח׳')}</b></div>
            <div><div class="muted small">זמן כולל</div><b>${U.minutes(t.total)}</b></div>
            <div><div class="muted small">עבודה בפועל</div><b>${U.minutes(p.activeAll)}</b>${p.activeAll > t.active ? '<div class="small muted">כולל רכיבים</div>' : ''}</div>
            <div><div class="muted small">תנור</div><b>${r.ovenTemp ? r.ovenTemp + '°' : '—'}${t.bake ? ' · ' + U.minutes(t.bake) : ''}</b></div>
          </div>
          ${allergens.length ? `<div class="row small"><span class="muted">אלרגנים:</span>${allergens.map(a => `<span class="badge warn">${a}</span>`).join('')}</div>` : ''}
        </div>
      </div>

      <div class="grid section recipe-cols">
        <div class="stack">
          <div class="card">
            <div class="card-h"><h3>${A.icon('book')}מצרכים</h3>${seg('mode', [['orig', 'כמו במתכון'], ['grams', 'בגרמים'], ['cups', 'בכוסות']], view.mode)}</div>
            <div class="row no-print" style="margin-bottom:12px">
              <span class="muted small">הכפלה:</span>${seg('factor', [[0.5, '½'], [1, '×1'], [1.5, '×1.5'], [2, '×2'], [3, '×3']], f)}
              <label class="row small" style="gap:6px">×<input type="number" step="0.05" min="0.05" value="${U.round(f, 3)}" data-f="factor" style="width:80px"></label>
            </div>
            <div class="row no-print small" style="margin-bottom:12px;gap:8px">
              <label class="row" style="gap:6px">כמות רצויה<input type="number" min="0" step="1" placeholder="${U.fmt(r.yield)}" data-f="target" style="width:80px"> ${U.esc(r.yieldUnit || '')}</label>
              <span class="muted">|</span>
              <label class="row" style="gap:6px">תבנית מקור<input data-f="panFrom" placeholder="24 או 20x30" style="width:110px"></label>
              <label class="row" style="gap:6px">התבנית שלי<input data-f="panTo" placeholder="26" style="width:90px"></label>
              <button class="btn sm ghost" data-act="pan">התאמה</button>
            </div>
            <div class="table-wrap"><table class="ing-table"><tbody>${ingRows || '<tr><td class="muted">אין מצרכים</td></tr>'}</tbody></table></div>
            ${flourG ? `<label class="row small no-print" style="margin-top:10px;gap:6px"><input type="checkbox" data-f="bakers" ${view.bakers ? 'checked' : ''}> הצגת אחוזי אופה (ביחס ל־${A.fmtGrams(flourG)} קמח)</label>` : ''}
          </div>
          <div class="card">
            <div class="card-h"><h3>אופן ההכנה</h3></div>
            ${(r.steps || []).length ? `<ol class="steps">${r.steps.map(s => `<li>${U.esc(s)}</li>`).join('')}</ol>` : '<p class="muted">לא נכתבו שלבים.</p>'}
            ${r.notes ? `<div class="divider"></div><h4>הערות וטיפים</h4><p style="white-space:pre-wrap">${U.esc(r.notes)}</p>` : ''}
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-h"><h3>${A.icon('clock')}זמנים</h3><b>${U.minutes(t.total)}</b></div>
            <div class="time-bar">${tb.map(([k, , c]) => t[k] ? `<i style="width:${t[k] / (t.total || 1) * 100}%;background:${c}" title="${U.minutes(t[k])}"></i>` : '').join('')}</div>
            <div class="legend" style="margin-top:10px">${tb.filter(([k]) => t[k]).map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} ${U.minutes(t[k])}</span>`).join('')}</div>
            <p class="small muted" style="margin:10px 0 0">עבודה פעילה: <b>${U.minutes(t.active)}</b> · זמן המתנה: ${U.minutes(t.total - t.active)}${f !== 1 ? ` · בהכפלה ×${U.fmt(f)} העבודה הפעילה תהיה בערך ${U.minutes(t.active * (1 + (f - 1) * 0.6))}` : ''}</p>
            ${(t.bake || t.rest) ? `<div class="row no-print" style="margin-top:12px">${t.rest ? `<button class="btn sm ghost" data-timer="${t.rest}" data-label="התפחה – ${U.esc(r.name)}">${A.icon('timer')}טיימר התפחה</button>` : ''}${t.bake ? `<button class="btn sm ghost" data-timer="${t.bake}" data-label="אפייה – ${U.esc(r.name)}">${A.icon('timer')}טיימר אפייה</button>` : ''}</div>` : ''}
          </div>

          ${storageCard(r)}
          <div class="card">
            <div class="card-h"><h3>${A.icon('wallet')}עלות ותמחור</h3><span class="muted small">ל־${U.fmt(r.yield)} ${U.esc(r.yieldUnit || 'יח׳')}</span></div>
            <div class="cost-row"><span>חומרי גלם</span><span class="money">${U.money(p.ingredients)}</span></div>
            <div class="cost-row"><span>אריזה</span><span class="money">${U.money(p.packaging)}</span></div>
            <div class="cost-row"><span>תנור, גז ושונות</span><span class="money">${U.money(p.overhead)}</span></div>
            ${p.fixed ? `<div class="cost-row"><span>חלק מההוצאות הקבועות <a href="#/expenses" class="small">(פירוט)</a></span><span class="money">${U.money(p.fixed)}</span></div>` : ''}
            <div class="cost-row"><span>שכר עבודה (${U.minutes(p.activeAll)}${p.activeAll > t.active ? ' כולל רכיבים' : ''} × ${U.money(s.hourlyRate)}/ש׳)</span><span class="money">${U.money(p.labor)}</span></div>
            <div class="cost-row total"><span>עלות מלאה למתכון</span><span class="money">${U.money(p.total)}</span></div>
            <div class="cost-row total" style="border-top:0;padding-top:4px;margin-top:0"><span>עלות ליחידה</span><span class="money">${U.money(p.perUnit)}</span></div>
            ${p.missing.length ? `<div class="notice" style="margin-top:10px">${A.icon('alert')}<div>חסרים נתונים לחישוב מדויק: ${p.missing.map(U.esc).join(', ')}. <a href="#/pantry">לעדכון במחסן</a></div></div>` : ''}
            <div class="divider"></div>
            <div class="price-tiers">
              <div><span>מינימום</span><b>${U.money(p.minimum)}</b><span>כיסוי עלות + שכר</span></div>
              <div class="rec"><span>מומלץ</span><b>${U.money(p.suggested)}</b><span>רווח ${U.pct(p.targetMargin)}${s.vatMode === 'licensed' ? ' · כולל מע״מ' : ''}</span></div>
              <div><span>המחיר שלך</span><b>${p.price ? U.money(p.price) : '—'}</b><span>${p.price ? 'רווח ' + U.pct(p.margin) : 'לא הוגדר'}</span></div>
            </div>
            <label class="field no-print" style="margin-top:14px"><span>מחיר מכירה ליחידה (₪) — שינוי כאן נשמר מיד</span>
              <div class="row" style="flex-wrap:nowrap"><input type="number" min="0" step="1" value="${r.price || ''}" data-f="price"><button class="btn sm soft" data-act="useSuggested">להשתמש במומלץ</button></div></label>
            ${isComponent(r) && !p.price ? `<div class="notice info" style="margin-top:14px">${A.icon('book')}<div>זה מתכון רכיב (בסיס/קרם). העלות שלו נכנסת אוטומטית למתכונים שמשתמשים בו${C.usedAsSub(r.id).length ? ': ' + C.usedAsSub(r.id).map(x => `<a href="#/recipe/${x.id}">${U.esc(x.name)}</a>`).join(', ') : ''}.</div></div>` : ''}
            <div class="verdict ${p.status}" style="margin-top:14px;${isComponent(r) && !p.price ? 'display:none' : ''}">
              <div class="big">${p.price ? U.pct(p.margin) : '?'}</div>
              <div><b>${STATUS_TXT[p.status]}</b><div class="small">${verdictTxt[p.status]}</div></div>
            </div>
            ${p.price ? `<div class="grid g2" style="margin-top:12px;gap:10px">
              <div class="kpi card flat" style="padding:12px"><div class="lbl">רווח נקי ליחידה</div><div class="val ${p.profit >= 0 ? 'ok' : 'bad'}" style="font-size:1.4rem">${U.money(p.profit)}</div></div>
              <div class="kpi card flat" style="padding:12px"><div class="lbl">מה נשאר לך לשעת עבודה</div><div class="val" style="font-size:1.4rem">${U.money(p.earnPerHour, 0)}</div><div class="sub">שכר + רווח, לפני מס</div></div>
              <div class="kpi card flat" style="padding:12px"><div class="lbl">אחוז חומרי גלם (Food cost)</div><div class="val" style="font-size:1.4rem">${U.pct(p.foodCost)}</div><div class="sub">${p.foodCost <= 0.3 ? 'מצוין — יעד מקובל 25%–35%' : p.foodCost <= 0.4 ? 'סביר, אפשר לשפר' : 'גבוה — שקלי מחיר או מתכון'}</div></div>
              <div class="kpi card flat" style="padding:12px"><div class="lbl">נמכרו עד היום</div><div class="val" style="font-size:1.4rem">${U.fmt(sold(r.id))}</div><div class="sub">${U.esc(r.yieldUnit || 'יח׳')}</div></div>
            </div>` : ''}
          </div>
          <div class="row no-print">
            <button class="btn ghost sm" data-act="dup">${A.icon('copy')}שכפול</button>
            <button class="btn danger sm" data-act="del">${A.icon('trash')}מחיקה</button>
          </div>
        </div>
      </div>`;

      const setFactor = v => { if (v > 0 && isFinite(v)) { view.factor = U.round(v, 4); A.refresh(); } };
      main.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.mode) { view.mode = b.dataset.mode; A.refresh(); }
        else if (b.dataset.factor) setFactor(+b.dataset.factor);
        else if (b.dataset.timer) A.startTimer(+b.dataset.timer, b.dataset.label);
        else if (b.dataset.act === 'pan') {
          const a1 = panArea(main.querySelector('[data-f="panFrom"]').value), a2 = panArea(main.querySelector('[data-f="panTo"]').value);
          if (!a1 || !a2) return A.toast('הזיני קוטר (24) או מידות (20x30)');
          setFactor(a2 / a1); A.toast('הוכפל פי ' + U.fmt(U.round(a2 / a1, 2)));
        }
        else if (b.dataset.act === 'photoReset') { r.image = libImage(r); A.commit('חזרה לתמונה המקורית'); }
        else if (b.dataset.act === 'photoRemove') { const old = r.image; r.image = ''; A.commit(); A.undoToast('התמונה הוסרה', () => { r.image = old; A.commit(); }); }
        else if (b.dataset.act === 'useSuggested') { r.price = p.suggested; A.commit('המחיר עודכן'); }
        else if (b.dataset.act === 'fav') { r.favorite = !r.favorite; A.commit(); }
        else if (b.dataset.act === 'dup') duplicate(r);
        else if (b.dataset.act === 'del') remove(r);
      };
      main.onchange = e => {
        const k = e.target.dataset.f;
        if (k === 'factor') setFactor(U.num(e.target.value));
        if (k === 'target') { const v = U.num(e.target.value); if (v > 0) setFactor(v / (+r.yield || 1)); }
        if (k === 'bakers') { view.bakers = e.target.checked; A.refresh(); }
        if (k === 'price') { r.price = U.num(e.target.value); A.commit('המחיר נשמר'); }
        if (e.target.matches('[data-photo]') && e.target.files[0]) {
          const file = e.target.files[0];
          if (!/^image\//.test(file.type)) return A.toast('זה לא קובץ תמונה');
          A.toast('מעבדת את התמונה…');
          A.readImage(file, 900).then(img => { r.image = img; A.commit('התמונה עודכנה'); }).catch(() => A.toast('לא הצלחתי לקרוא את התמונה. נסי קובץ JPG או PNG'));
        }
      };
      document.getElementById('topActions').onclick = e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'edit') editRecipe(r);
        if (b.dataset.act === 'cook') cookMode(r);
        if (b.dataset.act === 'print') root.print();
        if (b.dataset.act === 'label') printLabel(r);
      };
    }
  };
  // שטח תבנית: "24" = עגולה בקוטר 24, "20x30" = מלבנית
  function panArea(s) {
    s = String(s || '').replace(/[×*]/g, 'x').replace(/\s/g, '');
    if (!s) return 0;
    if (s.includes('x')) { const [a, b] = s.split('x').map(U.num); return a * b; }
    const d = U.num(s); return Math.PI * (d / 2) * (d / 2);
  }
  A.panArea = panArea;

  function duplicate(r) {
    const c = U.clone(r); c.id = U.uid(); c.name = r.name + ' (עותק)'; c.demo = false; c.created = U.today();
    A.state.recipes.push(c); A.save(); A.go('recipe/' + c.id); A.toast('המתכון שוכפל');
  }
  async function remove(r) {
    const parents = C.usedAsSub(r.id);
    if (parents.length) return A.toast('המתכון משמש כרכיב ב: ' + parents.map(x => x.name).join(', ') + ' — הסירי אותו משם קודם');
    const used = A.state.orders.some(o => o.items.some(i => i.recipeId === r.id));
    if (!await A.confirm(`למחוק את "${U.esc(r.name)}"?${used ? '<br><span class="muted small">המתכון מופיע בהזמנות — הן יישמרו עם שם המוצר.</span>' : ''}`, 'מחיקה')) return;
    const before = { orders: U.clone(A.state.orders.map(o => ({ id: o.id, items: o.items }))), idx: A.state.recipes.indexOf(r), product: A.state.form.products[r.id] };
    A.state.orders.forEach(o => o.items.forEach(i => { if (i.recipeId === r.id) { const rc = C.recipeCost(r); i.unitCost = rc.directPerUnit; i.recipeId = null; } }));
    A.state.recipes = A.state.recipes.filter(x => x.id !== r.id);
    if (r.library) { A.state.deletedLibrary = A.state.deletedLibrary || []; if (!A.state.deletedLibrary.includes(r.id)) A.state.deletedLibrary.push(r.id); }
    if (A.state.form && A.state.form.products) delete A.state.form.products[r.id];
    A.save(); A.go('recipes');
    A.undoToast(`"${r.name}" נמחק`, () => {
      A.state.recipes.splice(Math.min(before.idx, A.state.recipes.length), 0, r);
      before.orders.forEach(b => { const o = A.state.orders.find(x => x.id === b.id); if (o) o.items = b.items; });
      if (before.product) A.state.form.products[r.id] = before.product;
      if (A.state.deletedLibrary) A.state.deletedLibrary = A.state.deletedLibrary.filter(x => x !== r.id);
      A.commit(); A.go('recipe/' + r.id);
    });
  }

  /* ---------- אחסון, חיי מדף ותווית ---------- */
  function storageCard(r) {
    const s = r.storage || {};
    if (!s.room && !s.fridge && !s.freezer && !s.note) return '';
    const cell = (v, l) => `<div><div class="muted small">${l}</div><b>${v ? v + (v === 1 ? ' יום' : ' ימים') : '—'}</b></div>`;
    return `<div class="card"><div class="card-h"><h3>${A.icon('clock')}אחסון וחיי מדף</h3><button class="btn sm ghost no-print" data-act2="label">${A.icon('box')}תווית מוצר</button></div>
      <div class="grid g3" style="gap:10px">${cell(s.room, 'טמפרטורת החדר')}${cell(s.fridge, 'מקרר')}${cell(s.freezer, 'מקפיא')}</div>
      ${s.note ? `<p class="small" style="margin:10px 0 0">${U.esc(s.note)}</p>` : ''}</div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-act2="label"]'); if (b) { const r = C.recipe(A.route().args[0]); if (r) printLabel(r); } });
  function printLabel(r) {
    const flat = Object.values(C.flatten(r, 1 / (+r.yield || 1)));
    flat.forEach(f => f.w = f.grams + (f.gramsEq || 0));
    flat.sort((a, b) => b.w - a.w);
    const total = flat.reduce((s, f) => s + f.w, 0);
    const al = C.allergens(r), s = r.storage || {}, st = A.state.settings;
    const days = s.room || s.fridge || 0, where = s.room ? 'בטמפרטורת החדר' : s.fridge ? 'בקירור' : '';
    const w = root.open('', '_blank'); if (!w) return A.toast('הדפדפן חסם חלון — אפשרי חלונות קופצים');
    w.document.write(`<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>תווית — ${U.esc(r.name)}</title>
      <style>body{font-family:Assistant,Arial;margin:0;padding:16px;color:#2f1d11}.l{width:90mm;border:1px solid #4a2a16;border-radius:6px;padding:10px 12px}h1{font-family:'Frank Ruhl Libre',serif;font-size:20px;margin:4px 0;color:#4a2a16}p{margin:4px 0;font-size:11.5px;line-height:1.45}.al{font-weight:700}.row{display:flex;justify-content:space-between;font-size:11.5px;margin-top:6px}@media print{body{padding:0}}</style></head><body>
      <div class="l"><div style="text-align:center"><img src="${new URL('assets/logo.png', location.href)}" style="width:90px"></div>
      <h1>${U.esc(r.name)}</h1>
      <p><b>רכיבים:</b> ${flat.map(f => (f.ing.allergens || []).length ? `<b>${U.esc(f.ing.name)}</b>` : U.esc(f.ing.name)).join(', ')}.</p>
      ${al.length ? `<p class="al">מכיל: ${al.join(', ')}.</p>` : ''}
      <p class="small">מיוצר במטבח ביתי שבו נעשה שימוש גם ב: גלוטן, חלב, ביצים, אגוזים ושומשום.</p>
      <div class="row"><span>תאריך ייצור: ${U.fmtDate(U.today())}</span>${days ? `<span>לשימוש עד: ${U.fmtDate(U.addDays(U.today(), days))} (${where})</span>` : ''}</div>
      ${s.note ? `<p>אחסון: ${U.esc(s.note)}</p>` : ''}
      <div class="row"><span>${U.esc(st.businessName || 'על הגשר')}${st.phone ? ' · ' + U.esc(st.phone) : ''}</span><span>משקל משוער: ${Math.round(total * ((r.times || {}).bake ? 0.9 : 1))} ג׳</span></div></div>
      </body></html>`);
    w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 500);
  }
  A.printLabel = printLabel;

  /* ---------- מצב אפייה ---------- */
  function cookMode(r) {
    const f = view.factor;
    const el = document.createElement('div'); el.className = 'cook';
    el.innerHTML = `<div class="cook-inner">
      <div class="row between section"><h2 style="font-size:2rem">${U.esc(r.name)}${f !== 1 ? ` <span class="muted" style="font-size:1.1rem">×${U.fmt(f)}</span>` : ''}</h2><button class="btn ghost" data-x>${A.icon('x')}יציאה</button></div>
      <div class="grid g2">
        <div class="card"><h3 style="margin-bottom:8px">מצרכים</h3>${r.ingredients.map(l => { const d = displayLine(l, f, view.mode); return `<div class="ing-check"><input type="checkbox"><b>${A.fmtQty(d.q, d.unit)} ${unitLabel(d.unit, d.q)}</b> ${U.esc(d.sub ? 'מתכון: ' + d.sub.name : d.ing ? d.ing.name : l.name || '')}${l.section ? ` <span class="muted small">· ${U.esc(l.section)}</span>` : ''}</div>`; }).join('')}</div>
        <div class="card"><h3 style="margin-bottom:8px">שלבים</h3><ol class="steps">${(r.steps || []).map(s => `<li>${U.esc(s)}</li>`).join('')}</ol>
          <div class="row" style="margin-top:12px">${[5, 10, 15, 30].map(m => `<button class="btn sm ghost" data-t="${m}">${A.icon('timer')}${m} דק׳</button>`).join('')}${r.times && r.times.bake ? `<button class="btn sm" data-t="${r.times.bake}">אפייה ${r.times.bake} דק׳</button>` : ''}</div></div>
      </div></div>`;
    document.body.appendChild(el);
    let wake; try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => { }); } catch (e) { }
    el.onclick = e => {
      if (e.target.closest('[data-x]')) { el.remove(); wake && wake.release && wake.release(); return; }
      const t = e.target.closest('[data-t]'); if (t) return A.startTimer(+t.dataset.t, r.name);
      const li = e.target.closest('.steps li'); if (li) li.classList.toggle('done');
      const ic = e.target.closest('.ing-check'); if (ic) { const cb = ic.querySelector('input'); if (e.target !== cb) cb.checked = !cb.checked; ic.classList.toggle('done', cb.checked); }
    };
  }

  /* ---------- עורך מתכון ---------- */
  function editRecipe(r) {
    const isNew = !r;
    const d = r ? U.clone(r) : { name: '', category: 'עוגות', yield: 1, yieldUnit: '', price: '', packagingPerUnit: 0, otherCost: 0, ovenTemp: 180, times: { prep: 20, rest: 0, bake: 40, cool: 30, decor: 0 }, ingredients: [], steps: [], notes: '', tags: [], description: '', image: '' };
    if (!d.ingredients.length) d.ingredients.push({ ingId: '', qty: '', unit: 'g', section: '' });
    const ingName = id => (C.ing(id) || {}).name || '';
    const lineHtml = l => `<div class="line-row" data-line>
      <input list="ingList" value="${U.esc(l.subId ? 'מתכון: ' + ((C.recipe(l.subId) || {}).name || '') : l.ingId ? ingName(l.ingId) : l.name || '')}" placeholder="מצרך או מתכון" data-k="name">
      <input type="number" step="any" min="0" value="${l.qty}" placeholder="כמות" data-k="qty">
      <select data-k="unit">${A.unitOpts(l.unit)}</select>
      <input class="note" value="${U.esc(l.section || '')}" placeholder="קבוצה (למשל: מילוי)" data-k="section" list="secList">
      <button class="icon-btn" data-rm aria-label="הסרה">${A.icon('x')}</button></div>`;
    const t = d.times || {};
    A.modal({
      title: isNew ? 'מתכון חדש' : 'עריכת מתכון', size: 'wide',
      body: `<datalist id="ingList">${A.state.ingredients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(i => `<option value="${U.esc(i.name)}">`).join('')}${A.state.recipes.filter(x => !r || x.id !== r.id).map(x => `<option value="מתכון: ${U.esc(x.name)}">`).join('')}</datalist>
        <datalist id="secList"><option value="בצק"><option value="מילוי"><option value="ציפוי"><option value="בסיס"><option value="קרם"><option value="קישוט"></datalist>
        <div class="form-grid c3">
          <label class="field full"><span>שם המתכון *</span><input name="name" value="${U.esc(d.name)}" autofocus required></label>
          <label class="field"><span>קטגוריה</span><select name="category">${A.opts(A.RECIPE_CATS, d.category)}</select></label>
          <label class="field"><span>כמה יחידות למכירה יוצאות *</span><input type="number" step="any" min="0.01" name="yield" value="${d.yield}"></label>
          <label class="field"><span>שם היחידה</span><input name="yieldUnit" value="${U.esc(d.yieldUnit)}" placeholder="עוגה / קופסה (10 יח׳) / חלה"></label>
          <label class="field"><span>מחיר מכירה ליחידה (₪)</span><input type="number" step="any" min="0" name="price" value="${d.price}"></label>
          <label class="field"><span>אריזה ליחידה (₪)</span><input type="number" step="any" min="0" name="packagingPerUnit" value="${d.packagingPerUnit || 0}"><small>קופסה, סרט, מדבקה</small></label>
          <label class="field"><span>עלויות נוספות למתכון (₪)</span><input type="number" step="any" min="0" name="otherCost" value="${d.otherCost || 0}"><small>קישוטים, נייר אפייה וכו׳</small></label>
          <label class="field"><span>חום תנור (°C)</span><input type="number" name="ovenTemp" value="${d.ovenTemp || ''}"></label>
        </div>
        <div class="divider"></div>
        <h4 style="margin-bottom:10px">זמנים מדויקים (בדקות)</h4>
        <div class="form-grid c5">
          <label class="field"><span>הכנה (עבודה)</span><input type="number" min="0" name="t_prep" value="${t.prep || 0}"></label>
          <label class="field"><span>התפחה/מנוחה</span><input type="number" min="0" name="t_rest" value="${t.rest || 0}"></label>
          <label class="field"><span>אפייה</span><input type="number" min="0" name="t_bake" value="${t.bake || 0}"></label>
          <label class="field"><span>צינון</span><input type="number" min="0" name="t_cool" value="${t.cool || 0}"></label>
          <label class="field"><span>עיצוב ואריזה (עבודה)</span><input type="number" min="0" name="t_decor" value="${t.decor || 0}"></label>
        </div>
        <p class="small muted" style="margin:6px 0 0">רק "הכנה" ו"עיצוב ואריזה" נספרים כשעות עבודה שלך בתמחור. כדאי למדוד עם טיימר בפעם הבאה שאת מכינה.</p>
        <div class="divider"></div>
        <div class="row between" style="margin-bottom:10px"><h4>מצרכים</h4><span class="small" id="liveCost"></span></div>
        <div class="line-row head"><span>מצרך</span><span>כמות</span><span>יחידה</span><span class="note">קבוצה</span><span></span></div>
        <div id="lines">${d.ingredients.map(lineHtml).join('')}</div>
        <button class="btn ghost sm" data-add>${A.icon('plus')}הוספת מצרך</button>
        <p class="small muted">מצרך שלא קיים במחסן ייווצר אוטומטית — אחר כך עדכני לו מחיר. אפשר גם לבחור "מתכון: …" כדי להשתמש במתכון אחר כרכיב (למשל בצק או קרם) — כמות = מספר מנות מתכון.</p>
        <div class="divider"></div>
        <h4 style="margin-bottom:10px">אחסון וחיי מדף (בימים)</h4>
        <div class="form-grid c4">
          <label class="field"><span>טמפרטורת החדר</span><input type="number" min="0" name="s_room" value="${(d.storage || {}).room || ''}"></label>
          <label class="field"><span>מקרר</span><input type="number" min="0" name="s_fridge" value="${(d.storage || {}).fridge || ''}"></label>
          <label class="field"><span>מקפיא</span><input type="number" min="0" name="s_freezer" value="${(d.storage || {}).freezer || ''}"></label>
          <label class="field"><span>הוראות אחסון</span><input name="s_note" value="${U.esc((d.storage || {}).note || '')}" placeholder="למשל: במקרר בכלי סגור"></label>
        </div>
        <div class="divider"></div>
        <div class="form-grid">
          <label class="field full"><span>תיאור קצר</span><input name="description" value="${U.esc(d.description)}"></label>
          <label class="field full"><span>שלבי הכנה — שלב בכל שורה</span><textarea name="steps" rows="7">${U.esc((d.steps || []).join('\n'))}</textarea></label>
          <label class="field"><span>הערות וטיפים</span><textarea name="notes" rows="3">${U.esc(d.notes)}</textarea></label>
          <div class="stack">
            <label class="field"><span>תגיות (מופרדות בפסיק)</span><input name="tags" value="${U.esc((d.tags || []).join(', '))}" placeholder="פרווה, ללא גלוטן, שבת"></label>
            <label class="field"><span>תמונה</span><input type="file" accept="image/*" data-img></label>
            <div id="imgPrev">${A.safeImg(d.image) ? `<img src="${A.safeImg(d.image)}" alt="" style="max-height:90px;border-radius:8px"> <button class="btn sm danger" data-noimg>הסרת תמונה</button>` : ''}</div>
          </div>
        </div>`,
      foot: `<button class="btn" data-save>${A.icon('check')}שמירה</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount(dlg) {
        const lines = dlg.querySelector('#lines');
        const readLines = () => [...lines.querySelectorAll('[data-line]')].map(row => {
          const g = k => row.querySelector(`[data-k="${k}"]`).value.trim();
          const name = g('name');
          if (name.startsWith('מתכון: ')) { const sub = A.state.recipes.find(x => x.name === name.slice(7)); if (sub && (!r || sub.id !== r.id)) return { subId: sub.id, name, qty: U.num(g('qty')) || 1, unit: 'batch', section: g('section') }; }
          const ing = A.state.ingredients.find(i => i.name === name);
          return { ingId: ing ? ing.id : '', name, qty: U.num(g('qty')), unit: g('unit') === 'batch' ? 'g' : g('unit'), section: g('section') };
        }).filter(l => l.name);
        const live = () => {
          const ls = readLines(), y = U.num(dlg.querySelector('[name=yield]').value) || 1;
          const cost = U.sum(ls, l => C.lineCost(l).cost);
          dlg.querySelector('#liveCost').innerHTML = `חומרי גלם: <b>${U.money(cost)}</b> · ליחידה: <b>${U.money(cost / y)}</b>`;
        };
        live();
        dlg.oninput = live;
        dlg.onchange = async e => {
          if (e.target.matches('[data-img]') && e.target.files[0]) {
            try { d.image = await A.readImage(e.target.files[0]); dlg.querySelector('#imgPrev').innerHTML = `<img src="${A.safeImg(d.image)}" alt="" style="max-height:90px;border-radius:8px">`; }
            catch (err) { A.toast('לא הצלחתי לקרוא את התמונה'); }
          }
          live();
        };
        dlg.addEventListener('click', e => {
          if (e.target.closest('[data-add]')) { lines.insertAdjacentHTML('beforeend', lineHtml({ ingId: '', qty: '', unit: 'g', section: lines.querySelector('[data-line]:last-child [data-k=section]')?.value || '' })); lines.lastElementChild.querySelector('input').focus(); }
          const rm = e.target.closest('[data-rm]'); if (rm) { rm.closest('[data-line]').remove(); live(); }
          if (e.target.closest('[data-noimg]')) { d.image = ''; dlg.querySelector('#imgPrev').innerHTML = ''; }
          if (e.target.closest('[data-save]')) {
            const v = A.formData(dlg.querySelector('.m-body'));
            if (!v.name) { A.toast('חסר שם למתכון'); dlg.querySelector('[name=name]').focus(); return; }
            if (!(v.yield > 0)) { A.toast('כמות היחידות חייבת להיות גדולה מ־0'); return; }
            const ls = readLines().map(l => {
              if (l.subId) return { subId: l.subId, qty: l.qty, unit: 'batch', section: l.section };
              if (l.name.startsWith('מתכון: ')) l.name = l.name.slice(7);
              if (!l.ingId) { // יצירת מצרך חדש
                const ni = { id: U.uid(), name: l.name, category: 'אחר', pkgPrice: 0, pkgSize: 1, pkgUnit: 'kg', gramsPerCup: 240, gramsPerUnit: 0, allergens: [], stock: 0, minStock: 0, supplier: '', estimated: false };
                A.state.ingredients.push(ni); l.ingId = ni.id;
              }
              return { ingId: l.ingId, qty: l.qty, unit: l.unit, section: l.section };
            });
            const target = r || { id: U.uid(), created: U.today(), favorite: false };
            Object.assign(target, {
              name: v.name, category: v.category, yield: v.yield, yieldUnit: v.yieldUnit, price: v.price || 0,
              packagingPerUnit: v.packagingPerUnit || 0, otherCost: v.otherCost || 0, ovenTemp: v.ovenTemp || '',
              times: { prep: v.t_prep || 0, rest: v.t_rest || 0, bake: v.t_bake || 0, cool: v.t_cool || 0, decor: v.t_decor || 0 },
              ingredients: ls, steps: v.steps.split('\n').map(s => s.trim()).filter(Boolean), notes: v.notes,
              tags: v.tags.split(',').map(s => s.trim()).filter(Boolean), description: v.description, image: d.image || '', demo: false,
              storage: { room: v.s_room || 0, fridge: v.s_fridge || 0, freezer: v.s_freezer || 0, note: v.s_note || '' }
            });
            if (isNew) A.state.recipes.push(target);
            A.save(); A.closeModal();
            if (isNew) A.go('recipe/' + target.id); else A.refresh();
            A.toast('המתכון נשמר');
          }
        });
      }
    });
  }
  A.editRecipe = editRecipe;
})(window);
