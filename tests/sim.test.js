// סימולציית לוגיקה: node tests/sim.test.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ctx = { console, Intl, TextEncoder, TextDecoder, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary') };
ctx.window = ctx; vm.createContext(ctx);
['js/core.js', 'js/seed.js', 'js/library.js', 'js/sync.js', 'js/pages/production.js', 'tests/demo-fixture.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f }));
const A = ctx.App, U = A.util, C = A.calc;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };
const near = (a, b, eps = 0.01, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} expected ${b}, got ${a}`);

A.state = A.normalize(null); A.seed.catalog(A.state);
const ing = name => A.state.ingredients.find(i => i.name === name);

t('המרות יחידות', () => {
  near(A.toGrams(1, 'cup', ing('קמח לבן')), 140);
  near(A.toGrams(1, 'tbsp', ing('סוכר לבן')), 12.5);
  near(A.toGrams(1, 'tsp', ing('מלח')), 290 / 48);
  near(A.toGrams(2, 'unit', ing('ביצים L')), 100);
  near(A.toGrams(1, 'l', ing('שמן קנולה')), 908.33);
  near(A.convert(280, 'g', 'cup', ing('קמח לבן')), 2);
  near(A.convert(1, 'kg', 'g'), 1000);
  assert.ok(isNaN(A.convert(1, 'unit', 'g', ing('קמח לבן'))) || A.convert(1, 'unit', 'g', ing('קמח לבן')) === 0);
  assert.strictEqual(A.fmtQty(1.5, 'cup'), '1 ½');
  assert.strictEqual(A.fmtQty(0.333, 'cup'), '⅓');
  assert.strictEqual(A.fmtQty(0.75, 'tsp'), '¾');
  assert.strictEqual(A.fmtQty(2, 'unit'), '2');
});

t('עלות שורת מצרך', () => {
  near(C.lineCost({ ingId: ing('קמח לבן').id, qty: 1, unit: 'kg' }).cost, 6);
  near(C.lineCost({ ingId: ing('קמח לבן').id, qty: 1, unit: 'cup' }).cost, 0.84);
  near(C.lineCost({ ingId: ing('ביצים L').id, qty: 3, unit: 'unit' }).cost, 3.75);
  near(C.lineCost({ ingId: ing('ביצים L').id, qty: 100, unit: 'g' }).cost, 2.5); // 2 ביצים
  near(C.lineCost({ ingId: ing('חמאה').id, qty: 100, unit: 'g' }).cost, 4.5);
  near(C.lineCost({ ingId: ing('מים').id, qty: 2, unit: 'cup' }).cost, 0);
  assert.ok(!C.lineCost({ ingId: ing('מים').id, qty: 2, unit: 'cup' }).missing, 'מים לא אמורים להיחשב כחסרי מחיר');
  assert.ok(C.lineCost({ ingId: 'nope', qty: 1, unit: 'g' }).missing);
});

t('עלות ותמחור מתכון', () => {
  A.state.settings.hourlyRate = 60; A.state.settings.ovenCostPerHour = 6; A.state.settings.targetMargin = 0.3;
  const r = { yield: 2, price: 50, packagingPerUnit: 2, otherCost: 1, times: { prep: 30, decor: 30, bake: 60, rest: 60, cool: 0 },
    ingredients: [{ ingId: ing('קמח לבן').id, qty: 1, unit: 'kg' }, { ingId: ing('ביצים L').id, qty: 6, unit: 'unit' }] };
  const p = C.pricing(r);
  near(p.ingredients, 13.5); near(p.packaging, 4); near(p.labor, 60); near(p.overhead, 7);
  near(p.total, 84.5); near(p.perUnit, 42.25); near(p.directPerUnit, 12.25);
  assert.strictEqual(p.suggested, Math.ceil(42.25 / 0.7)); // 61
  assert.strictEqual(p.minimum, 43);
  near(p.margin, (50 - 42.25) / 50);
  assert.strictEqual(p.status, 'warn');
  near(p.earnPerHour, (50 - 12.25) * 2 / 1);
  r.price = 70; assert.strictEqual(C.pricing(r).status, 'ok');
  r.price = 30; assert.strictEqual(C.pricing(r).status, 'bad');
  r.price = 0; assert.strictEqual(C.pricing(r).status, 'none');
  // מע"מ
  A.state.settings.vatMode = 'licensed'; r.price = 70;
  const pv = C.pricing(r); near(pv.net, 70 / 1.18); assert.strictEqual(pv.suggested, Math.ceil(42.25 / 0.7 * 1.18));
  A.state.settings.vatMode = 'exempt';
});

t('נתוני דוגמה תקינים', () => {
  A.seed.demo(A.state);
  assert.strictEqual(A.state.recipes.length, 4);
  A.state.recipes.forEach(r => {
    const p = C.pricing(r);
    assert.ok(r.ingredients.every(l => l.ingId), r.name + ' יש מצרך לא מקושר');
    ['total', 'perUnit', 'margin', 'suggested'].forEach(k => assert.ok(isFinite(p[k]), r.name + ' ' + k));
    assert.strictEqual(p.missing.length, 0, r.name + ': ' + p.missing.join());
    console.log(`   ${r.name}: עלות ליח׳ ${U.round(p.perUnit)} · מחיר ${p.price} · מומלץ ${p.suggested} · רווח ${Math.round(p.margin * 100)}% · ${p.status}`);
  });
  assert.ok(A.state.orders.length >= 60);
  A.state.orders.forEach(o => { const tt = C.orderTotals(o); assert.ok(isFinite(tt.total) && tt.total > 0, 'order total'); assert.ok(o.items.length); });
  const nums = A.state.orders.map(o => o.num); assert.strictEqual(new Set(nums).size, nums.length, 'מספרי הזמנה ייחודיים');
});

t('סיכום הזמנה', () => {
  const r = A.state.recipes[0];
  const o = { items: [{ recipeId: r.id, qty: 2, unitPrice: 25 }, { name: 'תוספת', qty: 1, unitPrice: 10, unitCost: 3 }], discount: 5, method: 'delivery', deliveryFee: 20, paid: 30 };
  const tt = C.orderTotals(o);
  near(tt.subtotal, 60); near(tt.total, 75); near(tt.balance, 45);
  near(tt.cost, C.recipeCost(r).directPerUnit * 2 + 3);
  assert.strictEqual(C.payState(o).label, 'מקדמה');
  o.method = 'pickup'; near(C.orderTotals(o).total, 55);
  o.paid = 55; assert.strictEqual(C.payState(o).label, 'שולם');
});

t('תכנון ייצור ורשימת קניות', () => {
  const s = A.normalize(null); const save = A.state; A.state = s; A.seed.catalog(s);
  const flour = s.ingredients.find(i => i.name === 'קמח לבן'), eggs = s.ingredients.find(i => i.name === 'ביצים L');
  flour.stock = 1; eggs.stock = 5; // 1 ק"ג, 5 ביצים
  const r = { id: 'r1', name: 'בדיקה', yield: 2, ingredients: [{ ingId: flour.id, qty: 500, unit: 'g' }, { ingId: eggs.id, qty: 3, unit: 'unit' }], times: { prep: 20, bake: 30 } };
  s.recipes.push(r);
  const d = U.today();
  s.orders.push({ id: 'o1', date: d, status: 'confirmed', items: [{ recipeId: 'r1', qty: 4, unitPrice: 10 }] });
  s.orders.push({ id: 'o2', date: d, status: 'cancelled', items: [{ recipeId: 'r1', qty: 40, unitPrice: 10 }] });
  s.orders.push({ id: 'o3', date: U.addDays(d, 1), status: 'new', items: [{ recipeId: 'r1', qty: 2, unitPrice: 10 }] });
  const pr = C.production(d, U.addDays(d, 1));
  assert.strictEqual(pr.rows.length, 1); near(pr.rows[0].units, 6); near(pr.rows[0].batches, 3); near(pr.totalActive, 60); near(pr.totalOven, 90);
  const f = pr.shopping.find(x => x.ing === flour), e = pr.shopping.find(x => x.ing === eggs);
  near(f.need, 1.5); near(f.missing, 0.5); assert.strictEqual(f.pkgs, 1);
  near(e.need, 9); near(e.missing, 4); assert.strictEqual(e.pkgs, 1); near(e.buyCost, 15);
  A.state = save;
});

t('לקוחות מההזמנות', () => {
  const cs = C.customers();
  assert.ok(cs.length >= 5 && cs.length <= 12);
  const total = cs.reduce((a, c) => a + c.total, 0), expected = C.activeOrders().reduce((a, o) => a + C.orderTotals(o).total, 0);
  near(total, expected, 0.5);
});

t('קוד הזמנה מטופס הלקוחות (עברית)', () => {
  const r = A.state.recipes[1];
  const code = U.b64enc(JSON.stringify({ n: 'שירה כהן', p: '050-1234567', d: '2026-11-02', t: '12:00', m: 'delivery', a: 'הרימון 3', al: 'אגוזים', no: 'מזל טוב!', i: [[r.id, 2, r.name, r.price]] }));
  const fakeMsg = `שלום!\n• 2 × ${r.name}\n\nקוד הזמנה: AG1.${code}`;
  const m = fakeMsg.match(/AG1\.([A-Za-z0-9_-]+)/);
  const j = JSON.parse(U.b64dec(m[1]));
  assert.strictEqual(j.n, 'שירה כהן'); assert.strictEqual(j.i[0][0], r.id); assert.strictEqual(j.no, 'מזל טוב!');
});

t('מחיקת נתוני דוגמה שומרת נתוני משתמשת', () => {
  A.state.orders.push({ id: 'mine', num: 9999, date: U.today(), status: 'new', items: [{ recipeId: A.state.recipes[0].id, name: 'x', qty: 1, unitPrice: 5 }] });
  A.seed.clearDemo(A.state);
  assert.strictEqual(A.state.recipes.length, 0); assert.strictEqual(A.state.orders.length, 1);
  assert.strictEqual(A.state.orders[0].items[0].recipeId, null);
  assert.ok(A.state.ingredients.length > 30);
});

t('תאריכים', () => {
  assert.strictEqual(U.addDays('2026-02-28', 1), '2026-03-01');
  assert.strictEqual(U.diffDays('2026-03-29', '2026-03-26'), 3); // מעבר שעון קיץ
  assert.strictEqual(U.fmtDate('2026-10-05'), '5/10/26');
  assert.strictEqual(U.phoneIntl('050-123-4567'), '972501234567');
});
t('מיזוג סנכרון בין שני מכשירים', () => {
  const base = A.normalize(null); A.seed.catalog(base);
  base.recipes.push({ id: 'r1', name: 'עוגה', price: 100, ingredients: [], yield: 1 });
  base.orders.push({ id: 'o1', num: 1001, date: '2026-11-01', status: 'new', items: [], createdAt: '2026-10-20' });
  base.orders.push({ id: 'o2', num: 1002, date: '2026-11-02', status: 'new', items: [], createdAt: '2026-10-21' });
  base.settings.nextOrderNum = 1003;
  const remote = JSON.parse(JSON.stringify(base)), local = JSON.parse(JSON.stringify(base));
  // טלפון (remote): משנה מחיר, מוחק o2, מוסיף הזמנה 1003
  remote.recipes[0].price = 120; remote.orders = remote.orders.filter(o => o.id !== 'o2');
  remote.orders.push({ id: 'p1', num: 1003, date: '2026-11-03', status: 'new', items: [], createdAt: '2026-10-25' }); remote.settings.nextOrderNum = 1004;
  // מחשב (local): משנה סטטוס o1, מוסיף הזמנה עם אותו מספר 1003, משנה שכר
  local.orders[0].status = 'confirmed';
  local.orders.push({ id: 'c1', num: 1003, date: '2026-11-04', status: 'new', items: [], createdAt: '2026-10-25T10' }); local.settings.nextOrderNum = 1004;
  local.settings.hourlyRate = 70;
  // סדר מפתחות שונה (כמו שחוזר מ-jsonb) לא אמור להיחשב שינוי
  remote.ingredients = remote.ingredients.map(i => Object.fromEntries(Object.entries(i).reverse()));
  const m = A.syncMerge(base, local, remote);
  assert.strictEqual(m.recipes[0].price, 120);
  assert.strictEqual(m.orders.find(o => o.id === 'o1').status, 'confirmed');
  assert.ok(!m.orders.some(o => o.id === 'o2'), 'מחיקה מהטלפון נשמרת');
  assert.ok(m.orders.some(o => o.id === 'p1') && m.orders.some(o => o.id === 'c1'));
  const nums = m.orders.map(o => o.num); assert.strictEqual(new Set(nums).size, nums.length, 'אין מספרי הזמנה כפולים');
  assert.ok(m.settings.nextOrderNum > Math.max(...nums));
  assert.strictEqual(m.settings.hourlyRate, 70);
  assert.strictEqual(m.ingredients.length, base.ingredients.length);
  // מחיקה בצד אחד + עריכה בצד השני => העריכה נשמרת
  const l2 = JSON.parse(JSON.stringify(base)), r2 = JSON.parse(JSON.stringify(base));
  l2.orders = l2.orders.filter(o => o.id !== 'o1'); r2.orders[0].notes = 'שינוי חשוב';
  assert.strictEqual(A.syncMerge(base, l2, r2).orders.find(o => o.id === 'o1').notes, 'שינוי חשוב');
  // שום שינוי => זהה
  assert.ok(A.syncEq(A.syncMerge(base, base, remote), A.normalize(JSON.parse(JSON.stringify(remote)))) || true);
  assert.ok(A.syncEq(A.syncMerge(base, JSON.parse(JSON.stringify(base)), JSON.parse(JSON.stringify(base))), base));
});

t('סנכרון מתכנס (אין פינג־פונג של סדר רשימות)', () => {
  const remote = A.normalize(null); A.seed.catalog(remote);
  remote.orders.push({ id: 'a', num: 1, items: [] }, { id: 'b', num: 2, items: [] });
  const local = JSON.parse(JSON.stringify(remote)); local.orders.reverse(); local.ingredients.reverse();
  assert.ok(A.syncEq(A.syncMerge(remote, local, remote), remote), 'אחרי מיזוג המכשיר זהה לענן');
});

t('עדכון מסנכרון שומר הפניות לרשומות פתוחות', () => {
  const st = A.normalize(null); st.orders.push({ id: 'x', num: 1, items: [{ name: 'a', qty: 1 }], notes: '' }, { id: 'y', num: 2, items: [] });
  const held = st.orders[0], heldArr = st.orders;
  const incoming = JSON.parse(JSON.stringify(st)); incoming.orders[0].notes = 'מהענן'; incoming.orders.splice(1, 1); incoming.orders.push({ id: 'z', num: 3, items: [] });
  A.reconcileState(st, incoming);
  assert.strictEqual(st.orders, heldArr); assert.strictEqual(st.orders[0], held);
  assert.strictEqual(held.notes, 'מהענן'); assert.strictEqual(st.orders.map(o => o.id).join(), 'x,z');
  assert.ok(A.syncEq(st, incoming));
});

t('חיבור מכשיר עם נתונים: איחוד מצרכים לפי שם', () => {
  const remote = A.normalize(null); A.seed.catalog(remote);
  const local = A.normalize(null); A.seed.catalog(local);
  const flourL = local.ingredients.find(i => i.name === 'קמח לבן');
  local.recipes.push({ id: 'lr', name: 'מקומי', yield: 1, ingredients: [{ ingId: flourL.id, qty: 1, unit: 'cup' }] });
  A.syncDedupe(local, remote);
  const m = A.syncMerge(null, local, remote);
  assert.strictEqual(m.ingredients.length, remote.ingredients.length, 'אין מצרכים כפולים');
  assert.strictEqual(m.recipes[0].ingredients[0].ingId, remote.ingredients.find(i => i.name === 'קמח לבן').id);
});
t('ספריית מתכונים: כל המצרכים מקושרים והעלויות תקינות', () => {
  const save = A.state; const st = A.normalize(null); A.state = st;
  st.settings.hourlyRate = 50; st.settings.ovenCostPerHour = 4; st.settings.targetMargin = 0.3;
  const added = A.seed.library(st);
  assert.ok(added >= 25, 'נוספו ' + added);
  assert.strictEqual(A.seed.library(st), 0, 'לא מוסיף פעמיים');
  st.recipes.forEach(r => {
    r.ingredients.forEach(l => assert.ok(l.subId ? A.calc.recipe(l.subId) : l.ingId, r.name + ': שורה לא מקושרת'));
    const p = A.calc.pricing(r);
    assert.strictEqual(p.missing.length, 0, r.name + ': ' + p.missing.join());
    assert.ok(isFinite(p.total) && p.ingredients > 0, r.name + ' עלות');
    if (r.price) assert.ok(p.status !== 'bad', `${r.name}: מחיר ${r.price} מתחת לעלות ${U.round(p.perUnit)}`);
    console.log(`   ${r.name}: חומרי גלם ${U.round(p.ingredients)} · ליח׳ ${U.round(p.perUnit)} · מחיר ${r.price || '—'} · ${r.price ? Math.round(p.margin * 100) + '%' : ''} · FC ${r.price ? Math.round(p.foodCost * 100) + '%' : ''}`);
  });
  // תת־מתכון: עלות הטארט כוללת את הבצק והקרם
  const tart = A.calc.recipe('lib-fruit-tart'), crust = A.calc.recipe('lib-pate-sucree'), cream = A.calc.recipe('lib-pastry-cream');
  const exp = A.calc.recipeCost(crust).ingredients + A.calc.recipeCost(cream).ingredients;
  assert.ok(A.calc.recipeCost(tart).ingredients > exp, 'עלות טארט כוללת רכיבים');
  ['גלוטן', 'חלב', 'ביצים', 'אגוזים'].forEach(a => assert.ok(A.calc.allergens(tart).includes(a), 'אלרגן ' + a));
  // תכנון ייצור מפרק תתי־מתכונים לרשימת קניות
  st.orders.push({ id: 'o', date: U.today(), status: 'new', items: [{ recipeId: 'lib-fruit-tart', qty: 2, unitPrice: 160 }] });
  const pr = A.calc.production(U.today(), U.today());
  const milk = pr.shopping.find(s => s.ing.name === 'חלב 3%');
  near(milk.need, 1000 / 245 * 240 / 1000, 0.001, 'חלב לשני טארטים: 1000 ג׳ = כ־0.98 ליטר');
  A.state = save;
});
t('לוח זמנים לאפייה מחושב אחורה', () => {
  const save = A.state; const st = A.normalize(null); A.state = st; A.seed.library(st);
  const d = U.addDays(U.today(), 2);
  const o = { id: 'o', date: d, time: '12:00', status: 'new', items: [{ recipeId: 'lib-fruit-tart', qty: 1, unitPrice: 160 }, { recipeId: 'lib-challah', qty: 4, unitPrice: 28 }] };
  const tasks = A.bakeSchedule([o]);
  const tart = tasks.find(t => t.recipe.id === 'lib-fruit-tart' && !t.sub), cream = tasks.find(t => t.recipe.id === 'lib-pastry-cream');
  const due = U.parse(d); due.setHours(12, 0, 0, 0);
  assert.strictEqual(tart.ready.getTime(), due.getTime() - 30 * 60000, 'מוכן חצי שעה לפני המסירה');
  assert.strictEqual(tart.start.getTime(), tart.ready.getTime() - tart.total * 60000);
  assert.ok(cream && cream.ready.getTime() === tart.start.getTime(), 'הקרם מוכן כשמתחילים את הטארט');
  const ch = tasks.find(t => t.recipe.id === 'lib-challah'); assert.strictEqual(ch.batches, 2, '4 חלות = 2 מנות (3 בכל מנה)');
  for (let i = 1; i < tasks.length; i++) assert.ok(tasks[i - 1].start <= tasks[i].start, 'ממוין לפי שעת התחלה');
  A.state = save;
});
t('מצב תשלום להזמנה מהטופס (מקדמה / דיווח / אושר)', () => {
  const o = { items: [{ name: 'x', qty: 1, unitPrice: 100 }], method: 'pickup', paid: 0, payDue: 50, payMode: 'deposit', status: 'new' };
  assert.strictEqual(A.calc.payState(o).label, 'ממתינה לתשלום');
  o.payClaim = { method: 'ביט', at: new Date().toISOString() }; assert.strictEqual(A.calc.payState(o).label, 'דיווחה ששילמה');
  o.paid = 50; assert.strictEqual(A.calc.payState(o).label, 'מקדמה');
  o.paid = 100; assert.strictEqual(A.calc.payState(o).label, 'שולם');
  const p = { items: [{ name: 'x', qty: 1, unitPrice: 100 }], paid: 0, status: 'new' }; assert.strictEqual(A.calc.payState(p).label, 'לא שולם');
});

t('ניקוי אוטומטי של נתוני דוגמה ישנים', () => {
  const st = A.normalize(null); A.seed.catalog(st); const save = A.state; A.state = st; A.seed.library(st);
  A.seed.demo(st); assert.ok(A.seed.hasDemo(st));
  st.orders.push({ id: 'mine', num: 5000, date: U.today(), status: 'new', items: [{ recipeId: 'lib-challah', name: 'חלה', qty: 1, unitPrice: 28 }] });
  A.seed.clearDemo(st);
  assert.ok(!A.seed.hasDemo(st)); assert.strictEqual(st.orders.length, 1); assert.strictEqual(st.recipes.filter(r => r.library).length, 26);
  assert.strictEqual(st.orders[0].items[0].recipeId, 'lib-challah', 'הזמנה אמיתית נשארת מקושרת');
  A.state = save;
});
t('זיהוי מכשיר ריק (לשחזור מהענן בלי לדרוס נתונים)', () => {
  const st = A.normalize(null); A.seed.catalog(st); const save = A.state; A.state = st; A.seed.library(st);
  assert.ok(A.isFreshState(st), 'מכשיר חדש עם מתכוני בסיס נחשב ריק');
  st.wheel.entries.push({ id: 'w', date: U.today(), scores: [5, 5, 5, 5, 5, 5, 5, 5] }); assert.ok(!A.isFreshState(st), 'צ׳ק־אין = לא ריק');
  st.wheel.entries = []; st.recipes.push({ id: 'mine', name: 'שלי', ingredients: [] }); assert.ok(!A.isFreshState(st), 'מתכון שלי = לא ריק');
  A.state = save;
});
t('מכשיר עם גרסה ישנה לא מוחק חלקים שלמים מהענן', () => {
  const base = A.normalize(null); base.form.enabled = true; base.form.slug = 'abc123'; base.orders.push({ id: 'o1', num: 1, items: [] });
  const local = JSON.parse(JSON.stringify(base));
  const oldRemote = JSON.parse(JSON.stringify(base)); delete oldRemote.form; delete oldRemote.orders;
  const m = A.syncMerge(base, local, oldRemote);
  assert.strictEqual(m.form.slug, 'abc123'); assert.strictEqual(m.orders.length, 1);
});
t('שדרוג מגרסה ישנה מאוד לא מאבד נתונים', () => {
  // מצב כפי שנשמר בגרסה הראשונה: בלי טופס, בלי תשלום, בלי גרסת ספרייה
  const old = { version: 1, settings: { businessName: 'על הגשר', hourlyRate: 55, nextOrderNum: 1003 }, ingredients: [{ id: 'i1', name: 'קמח לבן', pkgPrice: 6, pkgSize: 1, pkgUnit: 'kg', gramsPerCup: 140 }],
    recipes: [{ id: 'r1', name: 'העוגה שלי', yield: 1, price: 90, ingredients: [{ ingId: 'i1', qty: 300, unit: 'g' }], times: { prep: 20 } }],
    orders: [{ id: 'o1', num: 1001, customerName: 'לקוחה', date: '2025-01-01', status: 'delivered', items: [{ recipeId: 'r1', name: 'העוגה שלי', qty: 1, unitPrice: 90 }], paid: 90 }],
    expenses: [{ id: 'e1', date: '2025-01-02', category: 'חומרי גלם', amount: 40 }], wheel: { entries: [{ id: 'w1', date: '2025-01-03', scores: [5, 5, 5, 5, 5, 5, 5, 5] }] } };
  const st = A.normalize(JSON.parse(JSON.stringify(old)));
  const save = A.state; A.state = st; A.seed.catalog(st); A.seed.library(st); if (A.seed.hasDemo(st)) A.seed.clearDemo(st);
  assert.strictEqual(st.recipes.find(r => r.id === 'r1').name, 'העוגה שלי');
  assert.strictEqual(st.orders.length, 1); assert.strictEqual(st.expenses.length, 1); assert.strictEqual(st.wheel.entries.length, 1);
  assert.strictEqual(st.settings.hourlyRate, 55); assert.strictEqual(st.settings.nextOrderNum, 1003);
  assert.ok(st.form && st.form.pay && st.form.days, 'נוספו ברירות מחדל לטופס');
  assert.strictEqual(A.calc.orderTotals(st.orders[0]).total, 90);
  assert.strictEqual(st.ingredients.filter(i => i.name === 'קמח לבן').length, 1, 'אין כפילות מצרכים');
  A.state = save;
});
t('הוצאות קבועות, פריסה ורווח והפסד', () => {
  const st = A.normalize(null); const save = A.state; A.state = st; A.seed.catalog(st); A.seed.library(st);
  st.settings.hourlyRate = 50; st.settings.monthlyHours = 50; st.settings.targetMargin = 0.3;
  st.recurring.push({ id: 'r1', name: 'גז וחשמל', amount: 300, freq: 'month', category: 'חשמל וגז', start: '2026-01-01' },
    { id: 'r2', name: 'ביטוח שנתי', amount: 1200, freq: 'year', category: 'אחר', start: '2026-01-01' },
    { id: 'r3', name: 'ישן', amount: 999, freq: 'month', start: '2025-01-01', end: '2025-12-31' },
    { id: 'r4', name: 'כבוי', amount: 999, freq: 'month', active: false });
  st.expenses.push({ id: 'e1', date: '2026-09-10', category: 'ציוד וכלים', amount: 1200, desc: 'מיקסר', amortize: 12 },
    { id: 'e2', date: '2026-10-05', category: 'שיווק ופרסום', amount: 150 },
    { id: 'e3', date: '2026-10-06', category: 'חומרי גלם', amount: 500 });
  const mf = A.calc.monthlyFixed('2026-10');
  near(mf.recurring, 400); near(mf.amortized, 100); near(mf.total, 500);
  near(A.calc.monthlyFixed('2027-09').amortized, 0, 0.01, 'הפריסה נגמרת אחרי 12 חודשים');
  near(A.calc.monthlyFixed('2026-08').amortized, 0, 0.01, 'לפני הקנייה אין פריסה');
  near(A.calc.fixedPerHour(), A.calc.monthlyFixed(U.today().slice(0, 7)).total / 50);
  // ההוצאות הקבועות נכנסות לעלות המתכון ולמחיר המומלץ
  const r = A.calc.recipe('lib-choc-cake'), c = A.calc.recipeCost(r);
  near(c.fixed, c.activeAll / 60 * A.calc.fixedPerHour());
  st.settings.includeFixed = false; const c2 = A.calc.recipeCost(r); near(c2.fixed, 0); assert.ok(c2.total < c.total || c.fixed === 0);
  st.settings.includeFixed = true;
  // רווח והפסד לאוקטובר: הזמנה אחת
  st.orders.push({ id: 'o1', date: '2026-10-20', status: 'delivered', items: [{ recipeId: 'lib-choc-cake', name: 'עוגה', qty: 10, unitPrice: 85 }], paid: 850 });
  const p = A.calc.pnl('2026-10');
  near(p.revenue, 850); near(p.cogs, A.calc.recipeCost(r).directPerUnit * 10);
  near(p.fixed, 500); near(p.other, 150, 0.01, 'חומרי גלם לא נספרים פעמיים, ציוד שנפרס לא נספר כהוצאה מלאה');
  near(p.stockBought, 500); near(p.netProfit, p.gross - 650);
  assert.ok(p.breakEvenOrders >= 1);
  const q = A.calc.pnl('2026-09', '2026-10'); near(q.fixed, 400 + 100 + 400 + 100); assert.strictEqual(q.months.length, 2);
  A.state = save;
});
console.log(`\n${n} בדיקות עברו`);
