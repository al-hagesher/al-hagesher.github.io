/* על הגשר — סנכרון בין מכשירים דרך Supabase.
   כל המכשירים חולקים "קוד סנכרון" סודי. המיזוג נעשה ברמת רשומה (מתכון, הזמנה, מצרך…)
   מול העותק האחרון שסונכרן, כך שעריכות משני מכשירים לא דורסות זו את זו. */
(function (root) {
  const A = root.App = root.App || {}, U = A.util;
  const SB_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co';
  const SB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const CFG_KEY = 'al-hagesher-sync', BASE_KEY = 'syncBase';

  /* ---------- מיזוג (פונקציות טהורות) ---------- */
  const canon = v => {
    if (v === null || typeof v !== 'object') return v === undefined ? 'null' : JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  };
  const eq = (a, b) => (a === undefined || b === undefined) ? a === b : canon(a) === canon(b);
  // מיזוג תלת־כיווני של ערך: מה שהשתנה מול הבסיס מנצח; עריכה בשני הצדדים — המקומי מנצח, אלא אם נמחק
  const pick = (b, l, r) => eq(l, r) ? l : eq(l, b) ? r : eq(r, b) ? l : (l === undefined ? r : l);
  const mergeMap = (b, l, r) => {
    b = b || {}; l = l || {}; r = r || {};
    const out = {};
    new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(b)]).forEach(k => { const v = pick(b[k], l[k], r[k]); if (v !== undefined) out[k] = v; });
    return out;
  };
  const toMap = a => Object.fromEntries((a || []).filter(x => x && x.id).map(x => [x.id, x]));
  const mergeList = (b, l, r) => {
    const m = mergeMap(toMap(b), toMap(l), toMap(r)), out = [], seen = new Set();
    // סדר הענן קודם, ואחריו פריטים חדשים מקומיים — כך שני המכשירים מתכנסים לאותו סדר
    [...(r || []), ...(l || [])].forEach(x => { if (x && m[x.id] && !seen.has(x.id)) { seen.add(x.id); out.push(m[x.id]); } });
    return out;
  };
  const LISTS = ['ingredients', 'recipes', 'orders', 'expenses'];
  A.syncMerge = (base, local, remote) => {
    base = base || {}; local = U.clone(local); remote = U.clone(remote || {});
    const out = A.normalize(local);
    LISTS.forEach(k => out[k] = mergeList(base[k], local[k], remote[k]));
    out.settings = mergeMap(base.settings, local.settings, remote.settings);
    out.customers = mergeMap(base.customers, local.customers, remote.customers);
    const bf = base.form || {}, rf = remote.form || {};
    out.form = mergeMap(bf, local.form, rf);
    out.form.products = mergeMap(bf.products, local.form.products, rf.products);
    const bw = base.wheel || {}, rw = remote.wheel || {};
    out.wheel = { areas: pick(bw.areas, local.wheel.areas, rw.areas) || local.wheel.areas, entries: mergeList(bw.entries, local.wheel.entries, rw.entries) };
    // מספרי הזמנה כפולים (הזמנות שנוצרו בשני מכשירים בלי חיבור) — מקבלים מספר חדש
    let next = Math.max(+local.settings.nextOrderNum || 0, +(remote.settings || {}).nextOrderNum || 0, ...out.orders.map(o => (+o.num || 0) + 1));
    const seen = new Set();
    out.orders.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)))
      .forEach(o => { if (seen.has(o.num)) o.num = next++; seen.add(o.num); });
    out.settings.nextOrderNum = next;
    return A.normalize(out);
  };
  // חיבור מכשיר שיש בו כבר נתונים: מצרכים עם אותו שם מאוחדים לגרסת הענן
  A.syncDedupe = (local, remote) => {
    const byName = Object.fromEntries((remote.ingredients || []).map(i => [i.name, i.id]));
    const map = {};
    local.ingredients = local.ingredients.filter(i => { const rid = byName[i.name]; if (rid && rid !== i.id) { map[i.id] = rid; return false; } return true; });
    local.recipes.forEach(r => (r.ingredients || []).forEach(l => { if (map[l.ingId]) l.ingId = map[l.ingId]; }));
    return local;
  };
  // מעדכן את המצב הקיים במקום להחליף אותו — כך חלון עריכה פתוח ממשיך להצביע על הרשומה החיה
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const recObj = (t, s) => { Object.keys(t).forEach(k => { if (!(k in s)) delete t[k]; }); Object.keys(s).forEach(k => { t[k] = rec(t[k], s[k]); }); return t; };
  const rec = (t, s) => {
    if (Array.isArray(s)) {
      if (Array.isArray(t) && s.every(x => isObj(x) && x.id)) {
        const old = new Map(t.filter(x => isObj(x) && x.id).map(x => [x.id, x]));
        const next = s.map(x => old.has(x.id) ? recObj(old.get(x.id), x) : x);
        t.length = 0; t.push(...next); return t;
      }
      return s;
    }
    if (isObj(s)) return isObj(t) ? recObj(t, s) : s;
    return s;
  };
  A.reconcileState = (target, source) => recObj(target, U.clone(source));
  A.isFreshState = s => !s.recipes.length && !s.orders.length && !s.expenses.length && !s.wheel.entries.length;
  A.syncEq = eq;

  if (typeof document === 'undefined') return; // סביבת בדיקות

  /* ---------- מנוע סנכרון ---------- */
  const S = A.sync = { status: 'off', error: '', pending: false };
  let cfg = {}; try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { cfg = {}; }
  let base = null, busy = false, again = false, applying = false;
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { } };
  S.cfg = () => cfg;
  S.enabled = () => !!cfg.code;

  async function rpc(fn, body) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`${fn}: ${r.status} ${(await r.text()).slice(0, 120)}`);
    return r.json();
  }
  const deviceName = () => {
    const ua = navigator.userAgent;
    return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'אנדרואיד' : /Mac/.test(ua) ? 'מק' : /Windows/.test(ua) ? 'מחשב Windows' : 'מכשיר';
  };
  const setStatus = (st, err = '') => { S.status = st; S.error = err; render(); };

  // מחיל מצב חדש מקומית; אם המשתמשת ערכה משהו בזמן שחיכינו לרשת — ממזג גם את זה
  async function applyLocal(merged, snapAtStart) {
    let next = merged;
    if (!eq(A.state, snapAtStart)) next = A.syncMerge(snapAtStart, U.clone(A.state), merged);
    applying = true;
    A.reconcileState(A.state, next);
    try { await A.saveNow(); } finally { applying = false; }
    S.pending = true; tryRefresh();
    return U.clone(A.state);
  }
  function tryRefresh() {
    const modal = document.getElementById('modal'), ae = document.activeElement;
    const typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && document.getElementById('main').contains(ae);
    if (S.pending && !(modal && modal.open) && !typing && !document.querySelector('.cook')) { S.pending = false; A.refresh && A.refresh(); }
  }

  S.syncNow = async () => {
    if (!cfg.code) return;
    if (busy) { again = true; return; }
    if (!navigator.onLine) { setStatus('offline'); return; }
    busy = true; setStatus('syncing');
    try {
      if (base === null) base = (await A.kvGet(BASE_KEY)) || null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const snap = U.clone(A.state);
        const rv = await rpc('sync_version', { p_code: cfg.code });
        let merged = snap, remoteVer = rv == null ? 0 : rv;
        if (rv != null && rv === cfg.version) {
          if (base && eq(snap, base)) break; // אין שינוי בשום צד
        } else if (rv != null) {
          const row = (await rpc('sync_get', { p_code: cfg.code }))[0];
          if (!row) continue;
          remoteVer = row.ver;
          merged = A.syncMerge(base, snap, row.data);
          if (!eq(merged, snap)) merged = await applyLocal(merged, snap);
          if (eq(merged, row.data)) { base = row.data; cfg.version = remoteVer; break; }
        }
        const res = (await rpc('sync_put', { p_code: cfg.code, p_data: merged, p_base: remoteVer, p_device: cfg.device || deviceName() }))[0];
        if (res && res.ok) { base = U.clone(merged); cfg.version = res.ver; break; }
        // מכשיר אחר עדכן בדיוק עכשיו — מנסים שוב
      }
      await A.kvPut(BASE_KEY, base);
      cfg.last = new Date().toISOString(); saveCfg();
      setStatus('ok');
    } catch (e) {
      console.warn('sync failed', e);
      setStatus(navigator.onLine ? 'error' : 'offline', e.message);
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(S.syncNow, 300); }
    }
  };
  const scheduleSync = U.debounce(() => S.syncNow(), 1500);
  A.saveHooks.push(() => { if (!applying && cfg.code) { setStatus('dirty'); scheduleSync(); } });

  /* ---------- הפעלה, חיבור וניתוק ---------- */
  const newCode = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); let s = ''; b.forEach(c => s += String.fromCharCode(c)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  S.enable = async () => {
    cfg = { code: newCode(), version: 0, device: deviceName() }; base = null; saveCfg();
    await A.kvPut(BASE_KEY, null);
    await S.syncNow();
    return S.status === 'ok';
  };
  // חיבור מכשיר נוסף עם קוד קיים
  S.join = async code => {
    code = String(code || '').trim().replace(/^.*#\/pair\//, '');
    if (code.length < 32) throw new Error('קוד לא תקין');
    const row = (await rpc('sync_get', { p_code: code }))[0];
    if (!row) throw new Error('לא נמצאו נתונים לקוד הזה');
    let next;
    if (A.isFreshState(A.state)) next = A.normalize(row.data);
    else {
      const local = A.syncDedupe(U.clone(A.state), row.data);
      next = A.syncMerge(null, local, row.data);
      next.settings = Object.assign({}, local.settings, row.data.settings, { nextOrderNum: next.settings.nextOrderNum });
    }
    cfg = { code, version: row.ver, device: deviceName() }; saveCfg();
    base = U.clone(row.data); await A.kvPut(BASE_KEY, base);
    applying = true; A.state = next;
    try { await A.saveNow(); } finally { applying = false; }
    await S.syncNow(); // דוחף את הנתונים המקומיים שנוספו (אם יש)
  };
  S.disable = async () => { cfg = {}; base = null; saveCfg(); await A.kvPut(BASE_KEY, null); setStatus('off'); };
  S.pairLink = () => {
    const appUrl = location.protocol.startsWith('http') && !/localhost|127\.0\.0\.1/.test(location.hostname) ? location.origin + location.pathname : A.PUBLIC_BASE;
    return appUrl ? `${appUrl}#/pair/${cfg.code}` : '';
  };

  /* ---------- תצוגת מצב ---------- */
  const LABEL = { off: 'סנכרון כבוי', ok: 'מסונכרן', syncing: 'מסנכרן…', dirty: 'ממתין לסנכרון…', offline: 'אין אינטרנט — יסונכרן כשיחזור', error: 'שגיאת סנכרון' };
  S.label = () => {
    if (S.status === 'ok' && cfg.last) {
      const m = Math.round((Date.now() - new Date(cfg.last)) / 60000);
      return 'מסונכרן ' + (m < 1 ? 'עכשיו' : m < 60 ? `לפני ${m} דק׳` : `ב־${new Date(cfg.last).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`);
    }
    return LABEL[S.status] || '';
  };
  function render() {
    const cls = S.status === 'error' ? 'bad' : S.status === 'offline' || S.status === 'dirty' ? 'warn' : S.status === 'off' ? 'off' : 'ok';
    document.querySelectorAll('[data-sync-status]').forEach(el => { el.classList.remove('ok', 'warn', 'bad', 'off'); el.classList.add('sync-pill', cls); el.innerHTML = `${A.icon('cloud')}<span>${S.label()}</span>`; el.title = S.error || S.label(); });
    document.dispatchEvent(new CustomEvent('sync-status'));
  }
  S.render = render;

  S.init = () => {
    if (cfg.code) { setStatus('dirty'); setTimeout(S.syncNow, 400); } else render();
    setInterval(() => { if (cfg.code && document.visibilityState === 'visible') S.syncNow(); else render(); }, 20000);
    setInterval(tryRefresh, 1500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cfg.code) S.syncNow(); });
    root.addEventListener('online', () => cfg.code && S.syncNow());
    root.addEventListener('offline', () => cfg.code && setStatus('offline'));
  };
})(typeof window !== 'undefined' ? window : globalThis);
