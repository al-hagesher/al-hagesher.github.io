/* על הגשר — ליבה: כלים, יחידות, אחסון, חישובים */
(function (root) {
  const A = root.App = root.App || {};

  /* ---------- כלים כלליים ---------- */
  const U = A.util = {};
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.round = (n, d = 2) => { const f = Math.pow(10, d); return Math.round((+n || 0) * f) / f; };
  U.num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  U.clone = o => JSON.parse(JSON.stringify(o));
  const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
  U.fmt = (n, d) => (d === 0 ? nf0 : nf).format(+n || 0);
  U.money = (n, d) => { n = +n || 0; const v = (d === 0 || Math.abs(n) >= 1000 ? nf0 : nf).format(U.round(Math.abs(n), 2)); return n < -0.004 ? '\u2066−₪' + v + '\u2069' : '₪' + v; }; // מינוס בכיוון נכון גם בתוך טקסט עברי
  U.pct = n => nf0.format((+n || 0) * 100) + '%';
  U.pad = n => String(n).padStart(2, '0');
  U.iso = d => `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  U.today = () => U.iso(new Date());
  U.parse = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  U.addDays = (s, n) => { const d = U.parse(s); d.setDate(d.getDate() + n); return U.iso(d); };
  U.diffDays = (a, b) => Math.round((U.parse(a) - U.parse(b)) / 864e5);
  U.fmtDate = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d}/${+m}/${y.slice(2)}`; };
  U.DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  U.MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  U.dayName = s => U.DAYS[U.parse(s).getDay()];
  U.relDay = s => {
    const d = U.diffDays(s, U.today());
    if (d === 0) return 'היום'; if (d === 1) return 'מחר'; if (d === -1) return 'אתמול';
    if (d > 1 && d < 7) return 'יום ' + U.dayName(s);
    return U.fmtDate(s);
  };
  U.minutes = m => {
    m = Math.round(+m || 0); if (m < 60) return m + ' דק׳';
    const h = Math.floor(m / 60), r = m % 60; return h + ' ש׳' + (r ? ' ' + r + ' דק׳' : '');
  };
  U.phoneIntl = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '972' + d.slice(1); return d; };
  U.phoneKey = p => String(p || '').replace(/\D/g, '').replace(/^972/, '0');
  U.wa = (phone, text) => `https://wa.me/${U.phoneIntl(phone)}?text=${encodeURIComponent(text)}`;
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.sum = (arr, f = x => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  U.groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  U.b64enc = str => { const b = new TextEncoder().encode(str); let s = ''; b.forEach(c => s += String.fromCharCode(c)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  U.b64dec = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); };

  /* ---------- יחידות והמרות ---------- */
  // כוס ישראלית = 240 מ"ל, כף = 15 מ"ל, כפית = 5 מ"ל
  A.UNITS = {
    g: 'גרם', kg: 'ק״ג', ml: 'מ״ל', l: 'ליטר', cup: 'כוס', tbsp: 'כף', tsp: 'כפית', unit: 'יחידה', pinch: 'קורט', batch: 'מנת מתכון'
  };
  A.PKG_UNITS = { g: 'גרם', kg: 'ק״ג', ml: 'מ״ל', l: 'ליטר', unit: 'יחידות' };
  A.toGrams = (qty, unit, ing) => {
    const q = +qty || 0, gpc = (ing && +ing.gramsPerCup) || 240;
    switch (unit) {
      case 'g': return q;
      case 'kg': return q * 1000;
      case 'ml': return q * gpc / 240;
      case 'l': return q * gpc / 240 * 1000;
      case 'cup': return q * gpc;
      case 'tbsp': return q * gpc / 16;
      case 'tsp': return q * gpc / 48;
      case 'unit': return q * ((ing && +ing.gramsPerUnit) || 0);
      case 'pinch': return q * 0.4;
      case 'batch': return 0;
      default: return q;
    }
  };
  A.fromGrams = (g, unit, ing) => {
    const one = A.toGrams(1, unit, ing);
    return one ? g / one : NaN;
  };
  // המרה בין שתי יחידות עבור מצרך נתון (NaN אם אין מספיק נתונים)
  A.convert = (qty, from, to, ing) => {
    if (from === to) return +qty || 0;
    return A.fromGrams(A.toGrams(qty, from, ing), to, ing);
  };
  // תצוגה ידידותית של כמות (שברים לכוסות/כפות)
  A.fmtQty = (q, unit) => {
    q = +q || 0;
    if (['cup', 'tbsp', 'tsp', 'unit'].includes(unit)) {
      const whole = Math.floor(q + 1e-9), frac = q - whole;
      const fr = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
      let best = fr[0], diff = 9;
      fr.forEach(f => { const d = Math.abs(frac - f[0]); if (d < diff) { diff = d; best = f; } });
      if (diff < 0.04) {
        const w = best[0] === 1 ? whole + 1 : whole;
        return (w ? w : '') + (best[1] ? (w ? ' ' : '') + best[1] : '') || '0';
      }
    }
    if (unit === 'g' || unit === 'ml') return U.fmt(q >= 20 ? Math.round(q) : U.round(q, 1));
    return U.fmt(U.round(q, 2));
  };
  A.fmtGrams = g => g >= 1000 ? U.fmt(U.round(g / 1000, 2)) + ' ק״ג' : U.fmt(Math.round(g)) + ' גרם';

  /* ---------- קבועים עסקיים ---------- */
  A.STATUSES = {
    new: { label: 'חדשה', cls: 'info' },
    confirmed: { label: 'אושרה', cls: 'brown' },
    baking: { label: 'בהכנה', cls: 'warn' },
    ready: { label: 'מוכנה', cls: 'ok' },
    delivered: { label: 'נמסרה', cls: 'muted' },
    cancelled: { label: 'בוטלה', cls: 'bad' }
  };
  A.STATUS_FLOW = ['new', 'confirmed', 'baking', 'ready', 'delivered'];
  A.SOURCES = ['וואטסאפ', 'אינסטגרם', 'פייסבוק', 'המלצה', 'טלפון', 'טופס הזמנה', 'לקוחה חוזרת', 'אחר'];
  A.PAY_METHODS = ['ביט', 'פייבוקס', 'מזומן', 'העברה בנקאית', 'אשראי', 'אחר'];
  A.RECIPE_CATS = ['עוגות', 'עוגות שמרים', 'עוגיות', 'לחמים וחלות', 'מאפים מלוחים', 'קינוחים', 'עוגות מעוצבות', 'מארזים', 'בסיסים וקרמים', 'אחר'];
  A.ING_CATS = ['קמחים', 'סוכרים וממתיקים', 'מוצרי חלב', 'ביצים', 'שומנים ושמנים', 'שוקולד וקקאו', 'אגוזים וזרעים', 'תפיחה ושמרים', 'תבלינים ותמציות', 'ממרחים ומילויים', 'אריזות', 'אחר'];
  A.ALLERGENS = ['גלוטן', 'חלב', 'ביצים', 'אגוזים', 'בוטנים', 'שומשום', 'סויה'];
  A.FREQS = { month: 'כל חודש', year: 'כל שנה', week: 'כל שבוע' };
  // קנייה של חומרי גלם ואריזות כבר נכנסת לעלות של מה שנמכר (לפי המתכונים) — לא סופרים אותה פעמיים ברווח הנקי
  A.STOCK_CATS = ['חומרי גלם', 'אריזות'];
  A.EXPENSE_CATS = ['חומרי גלם', 'אריזות', 'פחת ומוצרים שנזרקו', 'ציוד וכלים', 'שיווק ופרסום', 'משלוחים ונסיעות', 'חשמל וגז', 'השתלמויות', 'אחר'];
  A.WHEEL_AREAS = [
    { name: 'בריאות וגוף', hint: 'אנרגיה, שינה, תזונה, תנועה' },
    { name: 'רגשות ומשמעות', hint: 'שמחה, שקט פנימי, תחושת משמעות' },
    { name: 'זוגיות ומערכות יחסים', hint: 'בית, משפחה, חברות' },
    { name: 'ניהול זמן', hint: 'שליטה ביומן, פנאי, סדרי עדיפויות' },
    { name: 'קריירה ושליחות', hint: 'העסק, יצירה, התפתחות מקצועית' },
    { name: 'כלכלה', hint: 'הכנסה, חיסכון, ביטחון כלכלי' },
    { name: 'רוחניות ואמונה', hint: 'חיבור, תפילה, ערכים' },
    { name: 'נתינה ותרומה', hint: 'השפעה, עזרה לאחרים, קהילה' }
  ];

  /* ---------- טופס הזמנות ללקוחות ---------- */
  A.formDefaults = () => ({
    enabled: false, slug: '', key: '', open: true,
    title: 'הזמנה מעל הגשר', intro: 'מאפים ומתוקים בעבודת יד, באהבה. בחרי מה תרצי ומתי — ואחזור אלייך לאישור.',
    closedMsg: 'ההזמנות סגורות כרגע. נפתח בקרוב!', pickupAddress: '', payInfo: 'תשלום בביט / פייבוקס / מזומן באיסוף', terms: '',
    leadDays: 2, maxDaysAhead: 30, capacity: 0, slotMinutes: 30, minOrder: 0, blocked: [],
    days: { 0: { on: false, from: '09:00', to: '18:00' }, 1: { on: false, from: '09:00', to: '18:00' }, 2: { on: false, from: '09:00', to: '18:00' }, 3: { on: false, from: '09:00', to: '18:00' }, 4: { on: true, from: '10:00', to: '19:00' }, 5: { on: true, from: '08:00', to: '13:00' }, 6: { on: false, from: '20:00', to: '22:00' } },
    delivery: { on: false, fee: 20, freeAbove: 0, note: '' },
    pay: { mode: 'deposit', pct: 50, bit: '', paybox: '', hours: 24 },
    products: {}
  });

  /* ---------- מצב ברירת מחדל ---------- */
  A.defaults = () => ({
    version: 1,
    settings: {
      businessName: 'על הגשר', ownerName: '', phone: '', address: '',
      hourlyRate: 50, ovenCostPerHour: 4, targetMargin: 0.3,
      vatMode: 'exempt', vatRate: 0.18, nextOrderNum: 1001,
      defaultDeliveryFee: 20, monthlyGoal: 0, monthlyHours: 60, includeFixed: true, lastBackup: null, orderFormUrl: ''
    },
    ingredients: [], recipes: [], orders: [], expenses: [], recurring: [],
    customers: {}, // הערות ופרטים נוספים לפי מפתח טלפון
    form: A.formDefaults(),
    wheel: { areas: A.WHEEL_AREAS.map(a => a.name), entries: [] },
    seeded: false
  });

  /* ---------- אחסון (IndexedDB עם גיבוי ל-localStorage) ---------- */
  const DB = 'al-hagesher', STORE = 'kv', KEY = 'state';
  function idb() {
    return new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(key = KEY) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction(STORE).objectStore(STORE).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  }
  async function idbPut(v, key = KEY) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, key); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }
  // אחסון כללי לפי מפתח (משמש את הסנכרון)
  A.kvGet = async key => { try { return await idbGet(key); } catch (e) { try { return JSON.parse(root.localStorage.getItem(DB + ':' + key) || 'null'); } catch (e2) { return null; } } };
  A.kvPut = async (key, v) => { try { await idbPut(v, key); } catch (e) { try { root.localStorage.setItem(DB + ':' + key, JSON.stringify(v)); } catch (e2) { } } };
  A.normalize = s => {
    const d = A.defaults();
    s = Object.assign(d, s || {});
    s.settings = Object.assign(A.defaults().settings, s.settings || {});
    s.wheel = Object.assign(A.defaults().wheel, s.wheel || {});
    ['ingredients', 'recipes', 'orders', 'expenses', 'recurring'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    if (!s.customers || typeof s.customers !== 'object') s.customers = {};
    const fd = A.formDefaults();
    s.form = Object.assign(fd, s.form || {});
    s.form.days = Object.assign(fd.days, (s.form && s.form.days) || {});
    s.form.delivery = Object.assign(A.formDefaults().delivery, s.form.delivery || {});
    s.form.pay = Object.assign(A.formDefaults().pay, s.form.pay || {});
    if (!Array.isArray(s.form.blocked)) s.form.blocked = [];
    if (!s.form.products || typeof s.form.products !== 'object') s.form.products = {};
    return s;
  };
  A.load = async () => {
    let s = null;
    try { s = await idbGet(); } catch (e) { /* נופלים ל-localStorage */ }
    if (!s) { try { s = JSON.parse(root.localStorage.getItem(DB) || 'null'); } catch (e) { s = null; } }
    A.state = A.normalize(s);
    A.requestPersist();
    if (!A.state.seeded && A.seed) { A.seed.catalog(A.state); A.state.seeded = true; A.saveNow(); }
    if (A.seed && A.seed.library && A.seed.library(A.state)) A.saveNow();
    if (A.seed && A.seed.hasDemo && A.seed.hasDemo(A.state)) { A.seed.clearDemo(A.state); A.saveNow(); } // ניקוי נתוני דוגמה מגרסאות קודמות
    return A.state;
  };
  // כמה לשוניות פתוחות באותו מכשיר: כל שמירה מודיעה לאחרות, והן טוענות את המצב העדכני
  const TAB = Math.random().toString(36).slice(2);
  let bc = null; try { bc = new root.BroadcastChannel('al-hagesher'); } catch (e) { }
  if (bc) bc.onmessage = async ev => {
    if (!ev.data || ev.data.from === TAB || ev.data.t !== 'saved') return;
    let s = null; try { s = await idbGet(); } catch (e) { try { s = JSON.parse(root.localStorage.getItem(DB) || 'null'); } catch (e2) { } }
    if (!s || !A.state) return;
    if (A.reconcileState) A.reconcileState(A.state, A.normalize(s)); else A.state = A.normalize(s);
    A.onExternalChange && A.onExternalChange();
  };
  A.saveNow = async () => {
    const json = JSON.stringify(A.state);
    try { await idbPut(JSON.parse(json)); }
    catch (e) { try { root.localStorage.setItem(DB, json); } catch (e2) { A.onSaveError && A.onSaveError(e2); } }
    try { bc && bc.postMessage({ t: 'saved', from: TAB }); } catch (e) { }
    (A.saveHooks || []).forEach(f => { try { f(); } catch (e) { console.warn(e); } });
  };
  // שמירה מושהית קצרה, אבל אף פעם לא הולכת לאיבוד: נשמרת מיד כשהאפליקציה נסגרת או עוברת לרקע
  let saveTimer = null;
  A.save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = null; A.saveNow(); }, 250); };
  A.flush = () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; return A.saveNow(); } return Promise.resolve(); };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') A.flush(); });
    root.addEventListener('pagehide', () => A.flush());
  }
  // בקשה מהדפדפן לאחסון קבוע (לא נמחק אוטומטית כשחסר מקום / אחרי זמן בלי שימוש)
  A.storage = { persisted: null };
  A.requestPersist = async () => {
    try {
      if (!navigator.storage || !navigator.storage.persist) return null;
      let p = await navigator.storage.persisted();
      if (!p) p = await navigator.storage.persist();
      A.storage.persisted = p; return p;
    } catch (e) { return null; }
  };

  /* ---------- חישובים ---------- */
  A.saveHooks = A.saveHooks || [];
  // הכתובת הקבועה של האפליקציה באינטרנט (טופס ההזמנות וקישורי חיבור)
  A.PUBLIC_BASE = 'https://al-hagesher.github.io/';
  const C = A.calc = {};
  C.ing = id => A.state.ingredients.find(i => i.id === id);
  C.recipe = id => A.state.recipes.find(r => r.id === id);

  // עלות של שורת מצרך במתכון
  C.lineCost = (line, factor = 1, depth = 0) => {
    const qty = (+line.qty || 0) * factor;
    if (line.subId) { // תת־מתכון: עלות חומרי הגלם שלו לפי מספר המנות
      const sub = C.recipe(line.subId);
      if (!sub || depth > 5) return { cost: 0, missing: true, reason: sub ? 'קישור מעגלי' : 'תת־מתכון חסר' };
      const sc = C.recipeCost(sub, A.state.settings, depth + 1);
      return { cost: sc.ingredients * qty, missing: sc.missing.length > 0, reason: sc.missing.length ? 'חסרים מחירים בתת־המתכון' : '' };
    }
    const ing = C.ing(line.ingId);
    if (!ing) return { cost: 0, missing: true, reason: 'מצרך לא מקושר' };
    if (!(+ing.pkgPrice > 0) || !(+ing.pkgSize > 0)) return { cost: 0, missing: !ing.free, reason: 'חסר מחיר' };
    if (line.unit === 'unit' && ing.pkgUnit === 'unit') return { cost: qty * ing.pkgPrice / ing.pkgSize };
    const g = A.toGrams(qty, line.unit, ing), pg = A.toGrams(ing.pkgSize, ing.pkgUnit, ing);
    if (!(g >= 0) || !(pg > 0) || (line.unit === 'unit' && !g && qty)) return { cost: 0, missing: true, reason: 'חסר משקל ליחידה' };
    return { cost: g / pg * ing.pkgPrice };
  };
  C.times = r => {
    const t = r.times || {};
    const prep = +t.prep || 0, decor = +t.decor || 0, rest = +t.rest || 0, bake = +t.bake || 0, cool = +t.cool || 0;
    return { prep, decor, rest, bake, cool, active: prep + decor, oven: bake, total: prep + decor + rest + bake + cool };
  };
  C.recipeCost = (r, settings = A.state.settings, depth = 0) => {
    const y = Math.max(+r.yield || 1, 0.0001);
    let ingredients = 0; const missing = [];
    (r.ingredients || []).forEach(l => {
      const c = C.lineCost(l, 1, depth); ingredients += c.cost;
      if (c.missing) { const nm = l.subId ? (C.recipe(l.subId) || {}).name : (C.ing(l.ingId) || {}).name; missing.push((nm || l.name || '?') + ' — ' + c.reason); }
    });
    const t = C.times(r);
    // זמן עבודה ותנור של תתי־מתכונים נכנס לתמחור של המתכון שמשתמש בהם
    let subActive = 0, subOven = 0;
    if (depth < 5) (r.ingredients || []).forEach(l => { const s = l.subId && C.recipe(l.subId); if (s) { const sc = C.recipeCost(s, settings, depth + 1); subActive += sc.activeAll * (+l.qty || 0); subOven += sc.ovenAll * (+l.qty || 0); } });
    const activeAll = t.active + subActive, ovenAll = t.oven + subOven;
    const packaging = (+r.packagingPerUnit || 0) * y;
    const labor = activeAll / 60 * (+settings.hourlyRate || 0);
    const overhead = ovenAll / 60 * (+settings.ovenCostPerHour || 0) + (+r.otherCost || 0);
    const direct = ingredients + packaging + overhead; // עלות ללא שכר עבודה
    // חלק יחסי מההוצאות הקבועות של העסק (לפי שעות עבודה)
    const fixed = activeAll / 60 * C.fixedPerHour(settings);
    const total = direct + labor + fixed;
    return { ingredients, packaging, labor, overhead, fixed, direct, total, perUnit: total / y, directPerUnit: direct / y, ingPerUnit: ingredients / y, missing, times: t, yield: y, activeAll, ovenAll };
  };
 /* ---------- הוצאות קבועות, פריסה ורווח והפסד ---------- */
  const monthStart = ym => ym + '-01';
  const monthEnd = ym => { const [y, m] = ym.split('-').map(Number); return U.iso(new Date(y, m, 0)); };
  const toMonthly = (amount, freq) => (+amount || 0) * (freq === 'year' ? 1 / 12 : freq === 'week' ? 52 / 12 : 1);
  // סך ההוצאות הקבועות לחודש מסוים (YYYY-MM): הוצאות חוזרות + ציוד שנפרס על כמה חודשים
  C.monthlyFixed = (ym = U.today().slice(0, 7), state = A.state) => {
    const s = monthStart(ym), e = monthEnd(ym), items = [];
    (state.recurring || []).forEach(r => {
      if (r.active === false) return;
      if (r.start && r.start > e) return;
      if (r.end && r.end < s) return;
      const v = toMonthly(r.amount, r.freq); if (v) items.push({ name: r.name, amount: v, kind: 'recurring', ref: r });
    });
    (state.expenses || []).forEach(x => {
      const n = +x.amortize || 0; if (n < 2) return;
      const first = x.date.slice(0, 7);
      const [fy, fm] = first.split('-').map(Number), [y, m] = ym.split('-').map(Number);
      const idx = (y - fy) * 12 + (m - fm);
      if (idx >= 0 && idx < n) items.push({ name: (x.desc || x.category) + ` (${idx + 1}/${n})`, amount: (+x.amount || 0) / n, kind: 'amortized', ref: x });
    });
    return { items, total: U.sum(items, i => i.amount), recurring: U.sum(items.filter(i => i.kind === 'recurring'), i => i.amount), amortized: U.sum(items.filter(i => i.kind === 'amortized'), i => i.amount) };
  };
  C.fixedPerHour = (settings = A.state.settings) => {
    if (!A.state || settings.includeFixed === false) return 0;
    const h = +settings.monthlyHours || 0; if (!(h > 0)) return 0;
    return C.monthlyFixed(U.today().slice(0, 7)).total / h;
  };
  // דוח רווח והפסד לטווח חודשים (כולל)
  C.pnl = (fromYm, toYm = fromYm, state = A.state) => {
    const from = monthStart(fromYm), to = monthEnd(toYm);
    const orders = state.orders.filter(o => o.status !== 'cancelled' && o.date >= from && o.date <= to);
    const vf = C.vatFactor();
    let revenue = 0, cogs = 0, minutes = 0;
    orders.forEach(o => { const t = C.orderTotals(o); revenue += t.total; cogs += t.cost; minutes += t.activeMin; });
    const net = revenue / vf, gross = net - cogs;
    let fixed = 0; const months = [];
    for (let ym = fromYm; ym <= toYm;) { months.push(ym); fixed += C.monthlyFixed(ym, state).total; const [y, m] = ym.split('-').map(Number); ym = U.iso(new Date(y, m, 1)).slice(0, 7); }
    const otherList = state.expenses.filter(x => x.date >= from && x.date <= to && !(+x.amortize >= 2) && !A.STOCK_CATS.includes(x.category));
    const other = U.sum(otherList, x => x.amount);
    const stockBought = U.sum(state.expenses.filter(x => x.date >= from && x.date <= to && A.STOCK_CATS.includes(x.category)), x => x.amount);
    const netProfit = gross - fixed - other;
    const grossPerOrder = orders.length ? gross / orders.length : 0;
    const breakEvenOrders = grossPerOrder > 0 ? Math.ceil((fixed + other) / grossPerOrder) : null;
    const allExpenses = U.sum(state.expenses.filter(x => x.date >= from && x.date <= to && !(+x.amortize >= 2)), x => x.amount) + fixed;
    return { from, to, months, orders: orders.length, revenue, net, cogs, gross, fixed, other, otherList, stockBought, netProfit, minutes, hours: minutes / 60,
      perHour: minutes ? netProfit / (minutes / 60) : 0, margin: net ? netProfit / net : 0, grossPerOrder, breakEvenOrders, cash: revenue - allExpenses };
  };

  C.vatFactor = (s = A.state.settings) => s.vatMode === 'licensed' ? 1 + (+s.vatRate || 0) : 1;
  C.pricing = (r, settings = A.state.settings) => {
    const c = C.recipeCost(r, settings);
    const vf = C.vatFactor(settings), tm = Math.min(+settings.targetMargin || 0, 0.9);
    const suggestedNet = c.perUnit / (1 - tm);
    const suggested = Math.ceil(suggestedNet * vf);            // מעוגל כלפי מעלה לשקל
    const minimum = Math.ceil(c.perUnit * vf);                 // מכסה עלויות + שכר
    const price = +r.price || 0, net = price / vf;
    const profit = net - c.perUnit;
    const margin = net ? profit / net : 0;
    const foodCost = net ? c.ingPerUnit / net : 0;
    const hours = c.activeAll / 60;
    const earnPerHour = hours ? (net - c.directPerUnit) * c.yield / hours : 0; // מה נשאר לך לשעת עבודה
    let status = 'none';
    if (price) status = margin >= tm - 0.005 ? 'ok' : margin >= 0 ? 'warn' : 'bad';
    return Object.assign(c, { suggested, minimum, price, net, profit, margin, foodCost, earnPerHour, status, targetMargin: tm });
  };
  C.allergens = (r, depth = 0) => {
    const set = new Set();
    (r.ingredients || []).forEach(l => {
      if (l.subId) { const s = C.recipe(l.subId); if (s && depth < 5) C.allergens(s, depth + 1).forEach(a => set.add(a)); return; }
      const i = C.ing(l.ingId); (i && i.allergens || []).forEach(a => set.add(a));
    });
    return [...set];
  };
  // רשימת מצרכים שטוחה בגרמים (כולל תתי־מתכונים) — לתוויות ולרשימות קניות
  C.flatten = (r, mult = 1, out = {}, depth = 0) => {
    (r.ingredients || []).forEach(l => {
      if (l.subId) { const s = C.recipe(l.subId); if (s && depth < 5) C.flatten(s, mult * (+l.qty || 0), out, depth + 1); return; }
      const ing = C.ing(l.ingId); if (!ing) return;
      const e = out[ing.id] = out[ing.id] || { ing, grams: 0, units: 0 };
      if (l.unit === 'unit' && ing.pkgUnit === 'unit') e.units += (+l.qty || 0) * mult;
      else e.grams += A.toGrams((+l.qty || 0) * mult, l.unit, ing);
      if (l.unit === 'unit' && ing.pkgUnit === 'unit' && ing.gramsPerUnit) e.gramsEq = (e.gramsEq || 0) + (+l.qty || 0) * mult * ing.gramsPerUnit;
    });
    return out;
  };
  // זמנים כוללים של תתי־מתכונים (לשימוש בתזמון)
  C.usedAsSub = id => A.state.recipes.filter(r => (r.ingredients || []).some(l => l.subId === id));
  C.orderTotals = o => {
    const subtotal = U.sum(o.items || [], i => (+i.qty || 0) * (+i.unitPrice || 0));
    const discount = +o.discount || 0, delivery = o.method === 'delivery' ? (+o.deliveryFee || 0) : 0;
    const total = Math.max(subtotal - discount + delivery, 0);
    const paid = +o.paid || 0;
    let cost = 0, activeMin = 0;
    (o.items || []).forEach(i => {
      const r = i.recipeId && C.recipe(i.recipeId);
      if (r) {
        const rc = C.recipeCost(r);
        cost += rc.directPerUnit * (+i.qty || 0);
        activeMin += rc.activeAll * (+i.qty || 0) / rc.yield;
      } else cost += (+i.unitCost || 0) * (+i.qty || 0);
    });
    const vf = C.vatFactor();
    const net = total / vf;
    return { subtotal, discount, delivery, total, paid, balance: Math.max(total - paid, 0), cost, profit: net - cost, activeMin, net };
  };
  C.payState = o => {
    const t = C.orderTotals(o);
    if (o.payDue > 0 && t.paid < o.payDue - 0.01 && o.status !== 'cancelled') return o.payClaim ? { label: 'דיווחה ששילמה', cls: 'info' } : { label: 'ממתינה לתשלום', cls: 'warn' };
    if (t.total > 0 && t.paid >= t.total - 0.01) return { label: 'שולם', cls: 'ok' };
    if (t.paid > 0) return { label: 'מקדמה', cls: 'warn' };
    return { label: 'לא שולם', cls: 'bad' };
  };
  C.activeOrders = () => A.state.orders.filter(o => o.status !== 'cancelled');

  // תכנון ייצור: צבירת מתכונים ומצרכים לטווח תאריכים
  C.production = (from, to, opts = {}) => {
    const orders = A.state.orders.filter(o => o.status !== 'cancelled' && (opts.includeDelivered || o.status !== 'delivered') && o.date >= from && o.date <= to);
    const byRecipe = {}; const other = [];
    orders.forEach(o => (o.items || []).forEach(i => {
      const r = i.recipeId && C.recipe(i.recipeId);
      if (!r) { other.push({ name: i.name, qty: i.qty, order: o }); return; }
      const e = byRecipe[r.id] = byRecipe[r.id] || { recipe: r, units: 0, orders: new Set() };
      e.units += +i.qty || 0; e.orders.add(o.id);
    }));
    const rows = Object.values(byRecipe).map(e => {
      const t = C.times(e.recipe), y = +e.recipe.yield || 1, batches = e.units / y;
      return { recipe: e.recipe, units: e.units, batches, active: t.active * batches, oven: t.oven * batches, orders: e.orders.size };
    }).sort((a, b) => b.units - a.units);
    const needs = {};
    rows.forEach(row => Object.values(C.flatten(row.recipe, row.batches)).forEach(f => {
      const ing = f.ing, n = needs[ing.id] = needs[ing.id] || { ing, grams: 0, units: 0, cost: 0 };
      n.grams += f.grams; n.units += f.units;
      n.cost += C.lineCost({ ingId: ing.id, qty: f.grams, unit: 'g' }).cost + (f.units ? C.lineCost({ ingId: ing.id, qty: f.units, unit: 'unit' }).cost : 0);
    }));
    const shopping = Object.values(needs).map(n => {
      const ing = n.ing;
      // כמות בצורה של יחידת האריזה
      let needPkgUnits;
      if (ing.pkgUnit === 'unit') needPkgUnits = n.units + (ing.gramsPerUnit ? n.grams / ing.gramsPerUnit : 0);
      else needPkgUnits = A.fromGrams(n.grams, ing.pkgUnit, ing) + (n.units && ing.gramsPerUnit ? A.fromGrams(n.units * ing.gramsPerUnit, ing.pkgUnit, ing) : 0);
      const stock = +ing.stock || 0;
      const missing = Math.max(needPkgUnits - stock, 0);
      const pkgs = ing.pkgSize ? Math.ceil(missing / ing.pkgSize - 1e-9) : 0;
      return { ing, need: needPkgUnits, stock, missing, pkgs, buyCost: pkgs * (+ing.pkgPrice || 0), useCost: n.cost };
    }).sort((a, b) => (b.missing > 0) - (a.missing > 0) || a.ing.name.localeCompare(b.ing.name, 'he'));
    return { orders, rows, shopping, other, totalActive: U.sum(rows, r => r.active), totalOven: U.sum(rows, r => r.oven), totalUseCost: U.sum(shopping, s => s.useCost), totalBuy: U.sum(shopping, s => s.buyCost) };
  };

  // לקוחות — נגזר מההזמנות
  C.customers = () => {
    const map = {};
    A.state.orders.forEach(o => {
      const key = U.phoneKey(o.phone) || ('n:' + (o.customerName || '').trim());
      if (key === 'n:') return;
      const c = map[key] = map[key] || { key, name: o.customerName, phone: o.phone, orders: [], total: 0, first: o.date, last: o.date };
      c.orders.push(o);
      if (o.status !== 'cancelled') c.total += C.orderTotals(o).total;
      if (o.date < c.first) c.first = o.date;
      if (o.date > c.last) { c.last = o.date; c.name = o.customerName || c.name; }
    });
    return Object.values(map).map(c => Object.assign(c, A.state.customers[c.key] || {}, {
      count: c.orders.filter(o => o.status !== 'cancelled').length
    }));
  };
})(typeof window !== 'undefined' ? window : globalThis);
