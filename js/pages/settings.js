/* על הגשר — הגדרות, גיבוי ושחזור */
(function (root) {
  const A = root.App, U = A.util, P = A.pages = A.pages || {};

  P.settings = {
    title: 'הגדרות וגיבוי',
    render(main) {
      const s = A.state.settings;
      const lastB = s.lastBackup ? U.diffDays(U.today(), s.lastBackup) : null;
      main.innerHTML = `
      ${syncCard()}
      <div class="grid g2">
        <div class="card"><div class="card-h"><h3>פרטי העסק</h3></div>
          <div class="form-grid" data-form="biz">
            <label class="field"><span>שם העסק</span><input name="businessName" value="${U.esc(s.businessName)}"></label>
            <label class="field"><span>השם שלך</span><input name="ownerName" value="${U.esc(s.ownerName)}"></label>
            <label class="field"><span>וואטסאפ להזמנות</span><input type="tel" name="phone" value="${U.esc(s.phone)}" placeholder="050-0000000"></label>
            <label class="field"><span>כתובת לאיסוף</span><input name="address" value="${U.esc(s.address)}"></label>
          </div></div>
        <div class="card"><div class="card-h"><h3>תמחור</h3></div>
          <div class="form-grid" data-form="price">
            <label class="field"><span>שכר שעתי שלך (₪)</span><input type="number" min="0" step="any" name="hourlyRate" value="${s.hourlyRate}"><small>כמה שעת עבודה שלך שווה. נכנס לעלות כל מתכון.</small></label>
            <label class="field"><span>עלות תנור לשעה (₪)</span><input type="number" min="0" step="any" name="ovenCostPerHour" value="${s.ovenCostPerHour}"><small>חשמל/גז. תנור ביתי ≈ 2.5 קוט״ש × ~0.64 ₪ ≈ 1.6 ₪ + בלאי</small></label>
            <label class="field"><span>יעד רווח (%)</span><input type="number" min="0" max="90" step="1" name="targetMargin" value="${Math.round(s.targetMargin * 100)}"><small>מעל העלות המלאה כולל שכר. מקובל 25%–40%.</small></label>
            <label class="field"><span>יעד הכנסות חודשי (₪)</span><input type="number" min="0" step="100" name="monthlyGoal" value="${s.monthlyGoal || ''}"><small>יוצג כפס התקדמות בדף הבית</small></label>
            <label class="field"><span>דמי משלוח ברירת מחדל (₪)</span><input type="number" min="0" step="any" name="defaultDeliveryFee" value="${s.defaultDeliveryFee}"></label>
            <label class="field"><span>סוג עוסק</span><select name="vatMode">${A.opts([['exempt', 'עוסק פטור (בלי מע״מ)'], ['licensed', 'עוסק מורשה (מחירים כוללים מע״מ)']], s.vatMode)}</select></label>
            <label class="field"><span>שיעור מע״מ (%)</span><input type="number" min="0" step="0.1" name="vatRate" value="${U.round(s.vatRate * 100, 1)}"></label>
          </div></div>
        <div class="card"><div class="card-h"><h3>${A.icon('download')}גיבוי ושחזור</h3></div>
          <p style="margin-top:0">${A.sync && A.sync.enabled() ? 'הסנכרון שומר עותק מעודכן בענן. בנוסף, מומלץ להוריד גיבוי לקובץ פעם בחודש.' : 'כל הנתונים נשמרים בדפדפן במכשיר הזה. מחיקת נתוני גלישה או החלפת מכשיר — ימחקו אותם. <b>גבי פעם בשבוע</b> או הפעילי סנכרון.'}</p>
          <p class="small ${lastB == null || lastB > 7 ? '' : 'muted'}" style="${lastB == null || lastB > 7 ? 'color:var(--bad)' : ''}">${lastB == null ? 'עוד לא בוצע גיבוי.' : `גיבוי אחרון: ${U.fmtDate(s.lastBackup)} (לפני ${lastB} ימים)`}</p>
          <div class="row"><button class="btn" data-act="backup">${A.icon('download')}הורדת גיבוי</button>
          <label class="btn ghost">${A.icon('upload')}שחזור מגיבוי<input type="file" accept=".json,application/json" data-restore hidden></label>
          <button class="btn ghost" data-act="csv">${A.icon('download')}ייצוא הזמנות לאקסל</button></div></div>
        <div class="card"><div class="card-h"><h3>${A.icon('sun')}תצוגה</h3></div>
          <div class="seg" style="display:flex">${[['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) => `<button data-theme-set="${v}" class="${(document.documentElement.dataset.theme || 'auto') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          <p class="small muted" style="margin-bottom:0">"אוטומטי" עובר לכהה לפי הגדרות הטלפון או המחשב. ההגדרה נשמרת לכל מכשיר בנפרד.</p></div>
        <div class="card"><div class="card-h"><h3>גלגל החיים</h3></div>
          <p class="small muted" style="margin-top:0">אפשר לשנות את שמות התחומים (שינוי שם לא מוחק היסטוריה).</p>
          <div class="form-grid" data-form="wheel">${A.state.wheel.areas.map((a, i) => `<input data-area="${i}" value="${U.esc(a)}" aria-label="תחום ${i + 1}">`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>נתוני דוגמה</h3></div>
          <p class="small muted" style="margin-top:0">נתוני דוגמה (4 מתכונים, כ־70 הזמנות, הוצאות ושתי בדיקות גלגל) עוזרים להכיר את המערכת. הם מסומנים ונמחקים בלחיצה — בלי לגעת בנתונים שלך.</p>
          <div class="row">${A.seed.hasDemo(A.state) ? `<button class="btn danger" data-act="clearDemo">${A.icon('trash')}מחיקת נתוני הדוגמה</button>` : `<button class="btn soft" data-act="demo">טעינת נתוני דוגמה</button>`}
          <button class="btn ghost" data-act="catalog">השלמת קטלוג המצרכים</button></div></div>
        <div class="card"><div class="card-h"><h3 style="color:var(--bad)">איפוס מלא</h3></div>
          <p class="small muted" style="margin-top:0">מוחק את כל הנתונים במכשיר הזה. לא ניתן לבטל — הורידי גיבוי קודם.</p>
          <button class="btn danger" data-act="reset">${A.icon('trash')}מחיקת כל הנתונים</button></div>
      </div>`;
      if (A.sync && A.sync.enabled()) { A.sync.render(); A.drawSyncQr(); }
      main.onchange = async e => {
        const f = e.target;
        if (f.matches('[data-restore]') && f.files[0]) return restore(f.files[0]);
        if (f.dataset.area != null) { const v = f.value.trim(); if (v) { A.state.wheel.areas[+f.dataset.area] = v; A.save(); A.toast('נשמר'); } return; }
        if (!f.name) return;
        let v = f.type === 'number' ? U.num(f.value) : f.value.trim();
        if (f.name === 'targetMargin') v = Math.min(Math.max(v, 0), 90) / 100;
        if (f.name === 'vatRate') v = Math.max(v, 0) / 100;
        s[f.name] = v; A.save(); A.toast('נשמר');
      };
      main.onclick = async e => {
        const th = e.target.closest('[data-theme-set]');
        if (th) { const v = th.dataset.themeSet; if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v; try { localStorage.setItem('al-hagesher-theme', v); } catch (err) { } A.refresh(); return; }
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act;
        if (act.startsWith('sync')) return syncAction(act, b);
        if (act === 'backup') {
          A.download(`al-hagesher-backup-${U.today()}.json`, JSON.stringify(A.state, null, 1));
          s.lastBackup = U.today(); A.commit('הגיבוי ירד');
        }
        if (act === 'csv') exportCsv();
        if (act === 'demo') { A.seed.demo(A.state); A.commit('נתוני הדוגמה נטענו'); }
        if (act === 'clearDemo') { if (await A.confirm('למחוק את כל נתוני הדוגמה? הנתונים שלך יישארו.', 'מחיקה')) { A.seed.clearDemo(A.state); A.commit('נתוני הדוגמה נמחקו'); } }
        if (act === 'catalog') { const n = A.state.ingredients.length; A.seed.catalog(A.state); A.commit(`נוספו ${A.state.ingredients.length - n} מצרכים`); }
        if (act === 'reset') {
          const synced = A.sync && A.sync.enabled();
          if (!await A.confirm(`למחוק את <b>כל</b> הנתונים במכשיר הזה? פעולה זו אינה הפיכה.${synced ? '<br><span class="small muted">המכשיר ינותק מהסנכרון, והנתונים בענן ובמכשירים האחרים יישארו.</span>' : ''}`, 'כן, למחוק הכל')) return;
          if (synced) await A.sync.disable();
          A.state = A.normalize(null); A.seed.catalog(A.state); A.state.seeded = true; A.commit('הנתונים אופסו');
        }
      };
    }
  };

  /* ---------- סנכרון בין מכשירים ---------- */
  function syncCard() {
    const S = A.sync;
    if (!S) return '';
    if (!S.enabled()) return `<div class="card section cables"><div class="card-h"><h3>${A.icon('cloud')}סנכרון בין הטלפון למחשב</h3><span class="sync-pill off">${A.icon('cloud')}כבוי</span></div>
      <p style="margin-top:0">כשהסנכרון פעיל, כל מתכון, הזמנה או שינוי מחיר מופיעים בכל המכשירים שלך תוך שניות — וגם משמשים גיבוי בענן. עובד גם בלי אינטרנט: השינויים נשמרים ונשלחים כשהחיבור חוזר.</p>
      <div class="row"><button class="btn" data-act="syncEnable">${A.icon('cloud')}הפעלת סנכרון במכשיר הזה</button>
      <button class="btn ghost" data-act="syncJoin">יש לי כבר קוד ממכשיר אחר</button></div>
      <p class="small muted" style="margin-bottom:0">מפעילים פעם אחת במכשיר הראשי, ואז מחברים את הטלפון עם הקישור או קוד ה־QR שיופיע כאן.</p></div>`;
    const c = S.cfg(), link = S.pairLink();
    return `<div class="card section cables"><div class="card-h"><h3>${A.icon('cloud')}סנכרון בין הטלפון למחשב</h3><a data-sync-status class="sync-pill"></a></div>
      <div class="grid g2" style="align-items:start">
        <div class="stack">
          <p style="margin:0">הסנכרון פעיל. כדי לחבר מכשיר נוסף, ${link ? 'סרקי את הקוד במצלמה של הטלפון, או שלחי לעצמך את הקישור' : 'פתחי בו את האפליקציה והדביקי את הקוד'}:</p>
          ${link ? `<div class="row"><button class="btn sm" data-act="syncCopyLink">${A.icon('copy')}העתקת קישור חיבור</button><a class="btn sm wa" target="_blank" rel="noopener" href="${U.wa('', 'קישור לחיבור האפליקציה של על הגשר (אישי — לא להעביר): ' + link)}">${A.icon('msg')}שליחה לעצמי</a></div>` : ''}
          <div class="row"><button class="btn sm ghost" data-act="syncCopyCode">${A.icon('copy')}העתקת קוד הסנכרון</button><button class="btn sm ghost" data-act="syncNow">סנכרון עכשיו</button></div>
          <div class="notice" style="margin-top:6px">${A.icon('alert')}<div>הקישור והקוד הם המפתח לנתונים שלך — אל תשלחי אותם לאף אחד אחר.</div></div>
          <p class="small muted" style="margin:0">מכשיר זה: ${U.esc(c.device || '')} · גרסה ${c.version || 0}</p>
          <button class="btn sm danger" data-act="syncOff" style="align-self:flex-start">ניתוק המכשיר הזה מהסנכרון</button>
        </div>
        ${link ? `<div style="text-align:center"><div class="qr" id="syncQr"></div><div class="small muted" style="margin-top:6px">סריקה בטלפון = חיבור</div></div>` : `<div class="notice info">${A.icon('alert')}<div>כדי לחבר טלפון, פתחי את האפליקציה מהכתובת שלה באינטרנט (לא מקובץ במחשב) — שם יופיע קוד QR.</div></div>`}
      </div></div>`;
  }
  function drawQr() {
    const el = document.getElementById('syncQr'); if (!el) return;
    const link = A.sync.pairLink();
    const draw = () => { el.innerHTML = ''; new root.QRCode(el, { text: link, width: 360, height: 360, colorDark: '#4a2a16', colorLight: '#ffffff', correctLevel: root.QRCode.CorrectLevel.M }); };
    if (root.QRCode) return draw();
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = draw; s.onerror = () => { el.innerHTML = '<span class="small muted">אין חיבור לטעינת QR — השתמשי בקישור</span>'; };
    document.head.appendChild(s);
  }
  A.drawSyncQr = drawQr;
  async function syncAction(act, b) {
    const S = A.sync;
    if (act === 'syncEnable') {
      b.disabled = true; b.textContent = 'מפעילה…';
      const ok = await S.enable();
      A.refresh(); A.toast(ok ? 'הסנכרון פעיל ☁️' : 'לא הצלחתי להתחבר — בדקי אינטרנט ונסי שוב');
      if (!ok) await S.disable();
    }
    if (act === 'syncJoin') joinDialog();
    if (act === 'syncNow') { await S.syncNow(); A.refresh(); A.toast(S.status === 'ok' ? 'סונכרן' : S.label()); }
    if (act === 'syncCopyLink') A.copy(S.pairLink());
    if (act === 'syncCopyCode') A.copy(S.cfg().code);
    if (act === 'syncOff') {
      if (!await A.confirm('לנתק את המכשיר הזה? הנתונים יישארו כאן, אבל שינויים לא יעברו יותר בין המכשירים.', 'ניתוק')) return;
      await S.disable(); A.refresh(); A.toast('המכשיר נותק מהסנכרון');
    }
  }
  function joinDialog(prefill = '') {
    A.modal({
      title: 'חיבור למכשיר קיים', size: 'narrow',
      body: `<p style="margin-top:0">הדביקי את קוד הסנכרון (או את קישור החיבור) מהמכשיר הראשי.</p>
        <input id="joinCode" dir="ltr" value="${U.esc(prefill)}" placeholder="קוד או קישור" autofocus>
        <p class="small muted">${A.isFreshState(A.state) ? 'המכשיר הזה ריק — הוא יקבל את כל הנתונים מהענן.' : 'יש נתונים גם במכשיר הזה — הם יתמזגו עם הנתונים בענן (מצרכים באותו שם יאוחדו).'}</p>`,
      foot: `<button class="btn" data-go>${A.icon('cloud')}חיבור</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount(w) {
        w.addEventListener('click', async e => {
          const go = e.target.closest('[data-go]'); if (!go) return;
          go.disabled = true; go.textContent = 'מתחברת…';
          try { await A.sync.join(w.querySelector('#joinCode').value); A.closeModal(); A.go('settings'); A.refresh(); A.toast('המכשיר מחובר ומסונכרן ☁️'); }
          catch (err) { go.disabled = false; go.textContent = 'חיבור'; A.toast(err.message || 'החיבור נכשל'); }
        });
      }
    });
  }
  A.joinDialog = joinDialog;

  // קישור חיבור: #/pair/<code>
  P.pair = {
    title: 'חיבור מכשיר',
    render(main, [code]) {
      if (A.sync && A.sync.enabled() && A.sync.cfg().code === code) { main.innerHTML = `<div class="card empty"><h3>המכשיר הזה כבר מחובר ☁️</h3><a class="btn" href="#/">לדף הבית</a></div>`; return; }
      main.innerHTML = `<div class="card empty"><h3>חיבור המכשיר לסנכרון</h3><p>אחרי החיבור, כל הנתונים של על הגשר יופיעו כאן ויתעדכנו אוטומטית.</p><button class="btn" data-go>${A.icon('cloud')}להמשיך</button></div>`;
      main.onclick = e => { if (e.target.closest('[data-go]')) joinDialog(code || ''); };
      if (code) joinDialog(code);
    }
  };

  async function restore(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !data.settings || !Array.isArray(data.recipes)) throw new Error('bad');
      const msg = `לשחזר מהגיבוי? (${data.recipes.length} מתכונים, ${(data.orders || []).length} הזמנות)<br>הנתונים הנוכחיים יוחלפו${A.sync && A.sync.enabled() ? ' — גם בכל המכשירים המחוברים לסנכרון' : ''}.`;
      if (!await A.confirm(msg, 'שחזור')) return;
      A.state = A.normalize(data); A.state.seeded = true; A.commit('השחזור הושלם');
    } catch (e) { A.toast('הקובץ לא נראה כמו גיבוי תקין'); }
  }

  function exportCsv() {
    const C = A.calc;
    const rows = [['מספר', 'תאריך', 'שעה', 'לקוחה', 'טלפון', 'מוצרים', 'סה״כ', 'שולם', 'יתרה', 'סטטוס', 'מקור', 'איסוף/משלוח', 'רווח גולמי']];
    A.state.orders.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(o => {
      const t = C.orderTotals(o);
      rows.push([o.num, o.date, o.time || '', o.customerName, o.phone, o.items.map(i => `${i.qty}× ${i.name}`).join('; '), U.round(t.total), U.round(t.paid), U.round(t.balance), A.STATUSES[o.status].label, o.source, o.method === 'delivery' ? 'משלוח' : 'איסוף', U.round(t.profit)]);
    });
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    A.download(`orders-${U.today()}.csv`, csv, 'text/csv;charset=utf-8');
  }
})(window);
