/* על הגשר — עוזרת AI (Claude Opus 5.5 דרך Supabase Edge Function) */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};

  const EDGE_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co/functions/v1/assistant';
  const PUB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const LS_KEY = 'ag-assistant-chat';
  const CHAT_API_KEY = 'ag-assistant-api';
  const MAX_TURNS = 10;
  const MODEL = 'claude-opus-5-5';

  const loadChat = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; } };
  const saveChat = m => { try { localStorage.setItem(LS_KEY, JSON.stringify(m.slice(-40))); } catch (e) { } };
  const loadApiMessages = () => { try { return cleanHistory(JSON.parse(localStorage.getItem(CHAT_API_KEY) || '[]')); } catch (e) { return []; } };
  const saveApiMessages = m => { try { localStorage.setItem(CHAT_API_KEY, JSON.stringify(cleanHistory(m))); } catch (e) { } };

  /* ---------- היסטוריית השיחה — תמיד במבנה תקין ----------
     השיחה שנשלחת ל-Claude חייבת: להתחיל בשאלה של המשתמשת, ולכל בקשת כלי צמודה התוצאה שלה.
     קודם היא נגזרה באמצע (slice) — ואז כל שאלה אחריה נכשלה עד "שיחה חדשה". כאן מנקים ומקצרים רק בגבולות בטוחים,
     ותמונות ישנות מוחלפות בהערה (הן כבדות ונשלחו מחדש בכל שאלה). */
  const blocks = c => typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : [];
  const isToolResults = m => m.role === 'user' && blocks(m.content).some(b => b.type === 'tool_result');
  function cleanHistory(msgs, max = 30) {
    const src = (Array.isArray(msgs) ? msgs : []).filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role, content: blocks(m.content).map(b => b.type === 'image' ? { type: 'text', text: '[צורפה תמונה]' } : b).filter(b => b && b.type && (b.type !== 'text' || String(b.text || '').trim())) }));
    const out = [];
    for (let i = 0; i < src.length; i++) {
      const m = src[i];
      if (m.role === 'assistant') {
        const ids = m.content.filter(b => b.type === 'tool_use').map(b => b.id);
        const nx = src[i + 1], got = nx && isToolResults(nx) ? nx.content.filter(b => b.type === 'tool_result').map(b => b.tool_use_id) : [];
        if (ids.length && ids.every(id => got.includes(id))) {
          out.push(m, { role: 'user', content: nx.content.filter(b => b.type !== 'tool_result' || ids.includes(b.tool_use_id)) }); i++; continue;
        }
        m.content = m.content.filter(b => b.type !== 'tool_use');   // בקשת כלי בלי תוצאה — משאירים רק את הטקסט
      } else m.content = m.content.filter(b => b.type !== 'tool_result');   // תוצאה בלי בקשה
      if (!m.content.length) continue;
      const prev = out[out.length - 1];
      // שתי הודעות רצופות מאותו צד — מאחדים (אלא אם הקודמת היא חלק מזוג כלי)
      if (prev && prev.role === m.role && !(prev.role === 'assistant' && prev.content.some(b => b.type === 'tool_use'))) prev.content = prev.content.concat(m.content);
      else out.push(m);
    }
    let start = Math.max(0, out.length - max);
    while (start < out.length && !(out[start].role === 'user' && !isToolResults(out[start]))) start++;
    return out.slice(start);
  }

  // saveState: שומר בלי לרענן את כל הדף (אחרת הצ'אט נשבר)
  const saveState = (msg) => { A.save(); if (msg) A.toast(msg); };

  /* ---------- Snapshot ל-System prompt ---------- */
  function stateSnapshot() {
    const s = A.state, today = U.today();
    const slim = r => ({ id: r.id, name: r.name, category: r.category, yield: r.yield, yieldUnit: r.yieldUnit, price: r.price, tags: r.tags });
    const slimOrder = o => {
      const t = C.orderTotals(o);
      return { id: o.id, num: o.num, customer: o.customerName, phone: o.phone, date: o.date, time: o.time, method: o.method, status: o.status, items: (o.items || []).map(i => i.qty + '× ' + i.name), total: t.total, balance: t.balance };
    };
    const upcoming = s.orders.filter(o => o.date >= today && o.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 25).map(slimOrder);
    const f = s.form || {}, fbList = s.feedback || [];
    const ym = today.slice(0, 7), pnl = (() => { try { const p = C.pnl(ym); return { month: ym, orders: p.orders, revenue: Math.round(p.revenue), netProfit: Math.round(p.netProfit) }; } catch (e) { return null; } })();
    return {
      today, weekday: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date(today).getDay()],
      businessName: s.settings.businessName,
      thisMonth: pnl,
      upcomingOrders: upcoming,
      newOrdersWaiting: s.orders.filter(o => o.status === 'new').length,
      recipes: s.recipes.map(r => `${r.name} | ${r.category || ''} | ₪${+r.price || 0}`),
      ingredients: s.ingredients.map(i => `${i.name} | ₪${+i.pkgPrice || 0} ל־${+i.pkgSize || 1}${i.pkgUnit || ''}${i.estimated ? ' (מחיר משוער)' : ''}`),
      coupons: (s.coupons || []).filter(c => c.active !== false).map(c => c.code),
      orderForm: f.enabled ? { open: !!f.open, link: A.form && A.form.link ? A.form.link() : '', minItems: f.minItems, minOrder: f.minOrder, minEither: !!f.minEither } : 'לא מופעל',
      feedback: { total: fbList.length, notHandled: fbList.filter(x => x.status !== 'done').length }
    };
  }

  // החלק הקבוע של ההנחיות (נשמר במטמון אצל Claude — מהיר וזול יותר); הנתונים המתחלפים נשלחים בנפרד
  const SYSTEM_STATIC = `את העוזרת האישית של הדסה, בעלת מאפייה ביתית "על הגשר" (מאפים, מתוקים, סופגניות). את מחוברת לאפליקציית הניהול שלה: הזמנות, לקוחות, מתכונים, מחסן ומחירים, הוצאות ורווחיות, טופס הזמנות, משובים וקופונים.

איך לענות:
- תמיד בעברית, בגוף שני נקבה ("את"), חמה ומקצועית, קצר ולעניין. בלי מונחים באנגלית ובלי שמות של כלים.
- מספרים: ₪ ותאריכים בפורמט ישראלי (יום/חודש). רשימות קצרות עם "•".
- לפני שעונים על נתונים — בודקים עם הכלים. הסיכום שלמטה הוא רק תמונת מצב חלקית. לא ממציאים מספרים.
- כשמבקשים פעולה — מבצעים מיד עם הכלי המתאים. פעולות רגישות מציגות לה כפתור אישור לבד, אז לא שואלים "את בטוחה?" בטקסט.
- אם חסר פרט (למשל "תבטלי את ההזמנה" בלי של מי) — מחפשים קודם (list_orders / list_customers), ורק אם עדיין לא ברור שואלים שאלה אחת קצרה.
- ביטול הזמנה = שינוי סטטוס ל-cancelled (לא מחיקה), אלא אם ביקשה במפורש למחוק.
- עצות עסקיות (תמחור, מבצעים, יעדים, שיווק) — מבוססות על הנתונים האמיתיים שלה, עם המלצה ברורה אחת ולא רשימה ארוכה.
- אחרי פעולה — משפט אחד שמסכם מה נעשה.

סריקת קבלה: כשמצורפת תמונה של קבלה — זהי לכל פריט שם, מחיר כולל וגודל אריזה. התאימי לרשימת המצרכים שבסיכום גם כשהשם לא זהה (למשל "חמאת תנובה 200 גר" = "חמאה"). לכל פריט קראי ל-update_ingredient_price עם השם המדויק מהרשימה, pkg_price = המחיר ששולם, pkg_size + pkg_unit לפי האריזה. מצרך שלא קיים — עם category מתאימה. בסוף: מה עודכן, מה נוצר, ומה לא זוהה.`;

  const systemBlocks = () => [
    { type: 'text', text: SYSTEM_STATIC, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `תמונת מצב נוכחית (חלקית):\n${JSON.stringify(stateSnapshot())}` }
  ];

  /* ---------- Tools ---------- */
  const TOOLS = {
    list_orders: {
      description: 'רשימת הזמנות עם סינון. מחזיר מערך כולל פרטי כל פריט, תיאור, סטטוס ומצב תשלום.',
      input_schema: { type: 'object', properties: {
        status: { type: 'string', enum: ['new', 'confirmed', 'baking', 'ready', 'delivered', 'cancelled', 'any'] },
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date: { type: 'string', description: 'YYYY-MM-DD' },
        customer: { type: 'string', description: 'חיפוש לפי שם לקוח (חלקי)' }
      } },
      execute(args) {
        let list = A.state.orders.slice();
        if (args.status && args.status !== 'any') list = list.filter(o => o.status === args.status);
        if (args.from_date) list = list.filter(o => o.date >= args.from_date);
        if (args.to_date) list = list.filter(o => o.date <= args.to_date);
        if (args.customer) list = list.filter(o => (o.customerName || '').includes(args.customer));
        return JSON.stringify(list.slice(0, 50).map(o => {
          const t = C.orderTotals(o);
          return { id: o.id, num: o.num, customer: o.customerName, phone: o.phone, date: o.date, time: o.time, method: o.method, status: o.status, items: o.items, total: t.total, paid: t.paid, balance: t.balance, notes: o.notes, allergies: o.allergies, couponCode: o.couponCode };
        }));
      }
    },

    get_recipe: {
      description: 'מידע מלא על מתכון לפי שם או ID (כולל מצרכים, שלבים, עלות ורווחיות).',
      input_schema: { type: 'object', required: ['name_or_id'], properties: { name_or_id: { type: 'string' } } },
      execute(args) {
        const q = args.name_or_id;
        const r = A.state.recipes.find(x => x.id === q) || A.state.recipes.find(x => (x.name || '').includes(q));
        if (!r) return JSON.stringify({ error: 'לא נמצא מתכון בשם "' + q + '"' });
        const p = C.pricing(r);
        return JSON.stringify({
          id: r.id, name: r.name, category: r.category, yield: r.yield, yieldUnit: r.yieldUnit,
          price: r.price, times: r.times, ingredients: r.ingredients,
          steps: (r.steps || []).map(s => typeof s === 'string' ? s : s.text),
          cost: p.perUnit, suggestedPrice: p.suggested, margin: p.margin, profit: p.profit
        });
      }
    },

    recipes_by_profit: {
      description: 'מתכונים ממוינים לפי אחוז רווח (יורד).',
      input_schema: { type: 'object', properties: { limit: { type: 'integer' } } },
      execute(args) {
        const limit = args.limit || 10;
        const list = A.state.recipes.filter(r => r.price > 0).map(r => {
          const p = C.pricing(r);
          return { name: r.name, price: r.price, costPerUnit: p.perUnit, profitPerUnit: p.profit, marginPct: Math.round(p.margin * 100) };
        }).sort((a, b) => b.marginPct - a.marginPct).slice(0, limit);
        return JSON.stringify(list);
      }
    },

    low_stock: {
      description: 'רשימת מצרכים שהכמות במחסן מתחת למינימום.',
      input_schema: { type: 'object', properties: {} },
      execute() {
        const list = A.state.ingredients.filter(i => i.minStock > 0 && (i.stock || 0) < i.minStock)
          .map(i => ({ name: i.name, category: i.category, stock: i.stock, minStock: i.minStock, missing: i.minStock - (i.stock || 0), unit: i.pkgUnit }));
        return JSON.stringify(list.length ? list : { message: 'אין מצרכים חסרים כרגע' });
      }
    },

    business_stats: {
      description: 'רווח והפסד ומכירות לתקופה: הכנסות, עלות חומרי גלם, הוצאות קבועות ואחרות, רווח נקי, רווח לשעת עבודה, מספר הזמנות, המוצרים הנמכרים ביותר והלקוחות הגדולות. לשאלות על כסף, רווח, מכירות ויעדים.',
      input_schema: { type: 'object', properties: {
        from_month: { type: 'string', description: 'YYYY-MM (ברירת מחדל: החודש הנוכחי)' },
        to_month: { type: 'string', description: 'YYYY-MM (ברירת מחדל: כמו from_month)' }
      } },
      execute(args) {
        const ok = s => /^\d{4}-\d{2}$/.test(s || '');
        const from = ok(args.from_month) ? args.from_month : U.today().slice(0, 7), to = ok(args.to_month) && args.to_month >= from ? args.to_month : from;
        const p = C.pnl(from, to), r = x => Math.round(x * 100) / 100;
        const orders = A.state.orders.filter(o => o.status !== 'cancelled' && o.date >= p.from && o.date <= p.to);
        const prod = {}, cust = {};
        orders.forEach(o => {
          (o.items || []).forEach(i => { const e = prod[i.name] = prod[i.name] || { name: i.name, qty: 0, revenue: 0 }; e.qty += +i.qty || 0; e.revenue += (+i.qty || 0) * (+i.unitPrice || 0); });
          const k = o.customerName || 'ללא שם'; cust[k] = (cust[k] || 0) + C.orderTotals(o).total;
        });
        return JSON.stringify({
          from: p.from, to: p.to, orders: p.orders, revenue: r(p.revenue), revenueBeforeVat: r(p.net), ingredientsCost: r(p.cogs), grossProfit: r(p.gross),
          fixedExpenses: r(p.fixed), otherExpenses: r(p.other), netProfit: r(p.netProfit), marginPct: Math.round(p.margin * 100), workHours: r(p.hours), profitPerHour: r(p.perHour),
          ordersNeededToBreakEven: p.breakEvenOrders,
          topProducts: Object.values(prod).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map(x => ({ ...x, revenue: r(x.revenue) })),
          topCustomers: Object.entries(cust).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({ name, total: r(total) }))
        });
      }
    },

    list_customers: {
      description: 'לקוחות (נגזר מההזמנות): שם, טלפון, מספר הזמנות, סכום כולל, הזמנה ראשונה ואחרונה, הערות. אפשר לחפש ולמיין.',
      input_schema: { type: 'object', properties: {
        search: { type: 'string', description: 'חלק משם או טלפון' },
        sort: { type: 'string', enum: ['total', 'recent', 'count', 'inactive'], description: 'inactive = הכי הרבה זמן לא הזמינו' },
        limit: { type: 'integer' }
      } },
      execute(args) {
        const q = String(args.search || '').trim();
        let list = C.customers().filter(c => !q || (c.name || '').includes(q) || String(c.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '@@'));
        const by = { total: (a, b) => b.total - a.total, recent: (a, b) => b.last.localeCompare(a.last), count: (a, b) => b.count - a.count, inactive: (a, b) => a.last.localeCompare(b.last) };
        list.sort(by[args.sort] || by.total);
        return JSON.stringify({ count: list.length, customers: list.slice(0, Math.min(+args.limit || 20, 60)).map(c => ({ name: c.name, phone: c.phone, orders: c.count, total: Math.round(c.total), first: c.first, last: c.last, note: c.note || '', tags: c.tags || [] })) });
      }
    },

    list_ingredients: {
      description: 'מצרכים במחסן: מחיר אריזה, גודל, מלאי, מינימום, ספק. אפשר לחפש לפי שם או קטגוריה.',
      input_schema: { type: 'object', properties: { search: { type: 'string' }, category: { type: 'string' } } },
      execute(args) {
        const q = String(args.search || '').trim(), cat = String(args.category || '').trim();
        const list = A.state.ingredients.filter(i => (!q || (i.name || '').includes(q)) && (!cat || (i.category || '').includes(cat)));
        return JSON.stringify(list.slice(0, 80).map(i => ({ name: i.name, category: i.category, pkgPrice: i.pkgPrice, pkgSize: i.pkgSize, pkgUnit: i.pkgUnit, stock: i.stock || 0, minStock: i.minStock || 0, supplier: i.supplier || '', estimatedPrice: !!i.estimated })));
      }
    },

    feedback_summary: {
      description: 'משובים מלקוחות: דירוג ממוצע, התפלגות, השאלה החלשה ביותר, משובים שדורשים טיפול, והמשובים האחרונים עם הטקסט.',
      input_schema: { type: 'object', properties: { limit: { type: 'integer', description: 'כמה משובים אחרונים להחזיר (ברירת מחדל 10)' } } },
      execute(args) {
        const list = (A.state.feedback || []).slice().sort((a, b) => String(b.at || b.date).localeCompare(String(a.at || a.date)));
        if (!list.length) return JSON.stringify({ message: 'עוד אין משובים' });
        let ins = null; try { ins = A.fb && A.fb.insights ? A.fb.insights(list, (A.state.form.feedback || {}).questions || [], U.today()) : null; } catch (e) { }
        const slim = x => ({ date: x.date, rating: x.rating, name: x.name, order: x.order, handled: x.status === 'done', answers: (x.answers || []).map(a => `${a.label}: ${a.value}`) });
        return JSON.stringify({ total: list.length, insights: ins, needCare: list.filter(x => A.fb && A.fb.needsCare && A.fb.needsCare(x)).slice(0, 10).map(slim), latest: list.slice(0, Math.min(+args.limit || 10, 30)).map(slim) });
      }
    },

    order_form_info: {
      description: 'טופס ההזמנות ללקוחות: האם פתוח, קישור, המוצרים והמחירים שמוצגים בו, מינימום הזמנה, ימי איסוף ושעת סגירה.',
      input_schema: { type: 'object', properties: {} },
      execute() {
        const f = A.state.form || {};
        if (!f.enabled) return JSON.stringify({ message: 'טופס ההזמנות לא מופעל' });
        const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        const items = A.form && A.form.items ? A.form.items().filter(i => i.on).map(i => ({ name: i.name, price: i.price, options: (i.p.options || []), pack: +i.p.pack > 1 ? +i.p.pack : undefined, badge: i.p.badge || undefined })) : [];
        return JSON.stringify({ open: !!f.open, link: A.form && A.form.link ? A.form.link() : '', products: items, minItems: f.minItems, minOrder: f.minOrder, minEither: !!f.minEither,
          pickupDays: Object.entries(f.days || {}).filter(([, d]) => d && d.on).map(([k, d]) => `${DAYS[k]} ${d.from}–${d.to}`), leadDays: f.leadDays, cutoffTime: f.cutoffTime });
      }
    },

    update_order_status: {
      description: 'שינוי סטטוס להזמנה (כולל ביטול — עדיף על delete_order).',
      input_schema: { type: 'object', required: ['order_id', 'status'], properties: {
        order_id: { type: 'string' },
        status: { type: 'string', enum: ['new', 'confirmed', 'baking', 'ready', 'delivered', 'cancelled'] }
      } },
      execute(args) {
        const o = A.state.orders.find(x => x.id === args.order_id || x.num == args.order_id);
        if (!o) return JSON.stringify({ error: 'הזמנה לא נמצאה' });
        const prev = o.status; o.status = args.status; saveState('סטטוס עודכן');
        return JSON.stringify({ ok: true, order_num: o.num, from: prev, to: o.status });
      }
    },

    shopping_list: {
      description: 'תכנון ייצור ורשימת קניות להזמנות בטווח תאריכים: כמה להכין מכל מתכון (כולל בצקים ומילויים), זמן עבודה, וכמה לקנות מכל מצרך מול המלאי.',
      input_schema: { type: 'object', properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD (ברירת מחדל: היום)' },
        to_date: { type: 'string', description: 'YYYY-MM-DD (ברירת מחדל: היום + 7)' }
      } },
      execute(args) {
        const d = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : '';
        const from = d(args.from_date) || U.today(), to = d(args.to_date) || U.addDays(from, 7), r = x => Math.round(x * 100) / 100;
        const p = C.production(from, to);
        return JSON.stringify({
          from, to, orderCount: p.orders.length, activeWorkMinutes: Math.round(p.totalActive), ovenMinutes: Math.round(p.totalOven),
          toMake: p.rows.map(x => ({ recipe: x.recipe.name, units: x.units, batches: r(x.batches) })),
          itemsWithoutRecipe: p.other.map(x => `${x.qty}× ${x.name}`),
          toBuy: p.shopping.filter(s => s.missing > 0).map(s => ({ name: s.ing.name, need: r(s.need), stock: r(s.stock), unit: s.ing.pkgUnit, packages: s.pkgs, cost: r(s.buyCost) })),
          totalToBuy: r(p.totalBuy)
        });
      }
    },

    today_summary: {
      description: 'סיכום היום: כמה הזמנות למסירה, כמה הכנסה צפויה, רשימת הזמנות עם שעות, התראות.',
      input_schema: { type: 'object', properties: {} },
      execute() {
        const today = U.today();
        const todays = A.state.orders.filter(o => o.date === today && o.status !== 'cancelled');
        const totals = todays.reduce((s, o) => { const t = C.orderTotals(o); s.revenue += t.total; s.balance += t.balance; return s; }, { revenue: 0, balance: 0 });
        const byTime = todays.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
          .map(o => ({ num: o.num, time: o.time || '—', customer: o.customerName, method: o.method, items: o.items.map(i => i.qty + '× ' + i.name).join(', '), status: o.status, total: C.orderTotals(o).total }));
        return JSON.stringify({
          today, orderCount: todays.length,
          revenue: totals.revenue, outstanding: totals.balance,
          orders: byTime,
          unpaidOrdersAcrossAll: A.state.orders.filter(o => o.status !== 'cancelled' && C.orderTotals(o).balance > 0.01).length
        });
      }
    },

    update_order_notes: {
      description: 'הוספה/עדכון של הערות על הזמנה.',
      input_schema: { type: 'object', required: ['order_id', 'notes'], properties: {
        order_id: { type: 'string' }, notes: { type: 'string' }
      } },
      execute(args) {
        const o = A.state.orders.find(x => x.id === args.order_id || x.num == args.order_id);
        if (!o) return JSON.stringify({ error: 'הזמנה לא נמצאה' });
        o.notes = args.notes; saveState('הערות עודכנו');
        return JSON.stringify({ ok: true, order_num: o.num });
      }
    },

    add_item_to_order: {
      description: 'הוספת פריט להזמנה. אם name תואם למתכון קיים — ימלא מחיר אוטומטית.',
      input_schema: { type: 'object', required: ['order_id', 'name', 'qty'], properties: {
        order_id: { type: 'string' }, name: { type: 'string' }, qty: { type: 'number' },
        unit_price: { type: 'number' }, description: { type: 'string' }
      } },
      execute(args) {
        const o = A.state.orders.find(x => x.id === args.order_id || x.num == args.order_id);
        if (!o) return JSON.stringify({ error: 'הזמנה לא נמצאה' });
        const r = A.state.recipes.find(x => x.name === args.name);
        const unitPrice = args.unit_price != null ? args.unit_price : (r ? r.price : 0);
        o.items.push({ recipeId: r ? r.id : null, name: args.name, qty: args.qty, unitPrice, description: args.description || '' });
        saveState('פריט נוסף להזמנה');
        return JSON.stringify({ ok: true, order_num: o.num, items_count: o.items.length });
      }
    },

    create_recipe: {
      description: 'יצירת מתכון חדש. אפשר להעביר חלקיים — שדות שלא נמסרו יהיו ריקים ואפשר להשלים אחר כך. מצרכים שלא קיימים במחסן ייווצרו אוטומטית עם מחיר 0 (יש לסמן אותם estimated=true).',
      input_schema: { type: 'object', required: ['name', 'yield', 'ingredients'], properties: {
        name: { type: 'string', description: 'שם המתכון' },
        category: { type: 'string', description: 'עוגות / עוגיות / חלות ולחמים / קינוחים / מאפים מלוחים / בסיסים וקרמים' },
        yield: { type: 'number', description: 'כמות יחידות שיוצאות ממנה אחת' },
        yield_unit: { type: 'string', description: 'שם היחידה: עוגה / קופסה / חלה / יח׳' },
        price: { type: 'number', description: 'מחיר מכירה ליחידה (אופציונלי)' },
        oven_temp: { type: 'number', description: 'טמפרטורת תנור במעלות' },
        times: { type: 'object', description: 'זמנים בדקות', properties: {
          prep: { type: 'number', description: 'הכנה — עבודה פעילה' },
          rest: { type: 'number', description: 'התפחה / מנוחה' },
          bake: { type: 'number', description: 'אפייה' },
          cool: { type: 'number', description: 'צינון' },
          decor: { type: 'number', description: 'עיצוב ואריזה' }
        } },
        ingredients: { type: 'array', description: 'רשימת מצרכים', items: { type: 'object', required: ['name', 'qty', 'unit'], properties: {
          name: { type: 'string' }, qty: { type: 'number' },
          unit: { type: 'string', enum: ['g', 'kg', 'ml', 'l', 'unit', 'cup', 'tbsp', 'tsp'], description: 'g=גרם, kg=ק״ג, ml=מ״ל, l=ליטר, unit=יחידה, cup=כוס, tbsp=כף, tsp=כפית' },
          section: { type: 'string', description: 'קבוצה (למשל: בצק / מילוי / ציפוי)' }
        } } },
        steps: { type: 'array', items: { type: 'string' }, description: 'שלבי הכנה בסדר' },
        notes: { type: 'string', description: 'הערות וטיפים' },
        description: { type: 'string', description: 'תיאור קצר' },
        tags: { type: 'array', items: { type: 'string' } },
        storage: { type: 'object', properties: {
          room: { type: 'number', description: 'ימים בטמפ׳ חדר' },
          fridge: { type: 'number', description: 'ימים במקרר' },
          freezer: { type: 'number', description: 'ימים במקפיא' },
          note: { type: 'string', description: 'הוראות אחסון' }
        } }
      } },
      execute(args) {
        if (A.state.recipes.find(x => x.name === args.name)) return JSON.stringify({ error: 'כבר קיים מתכון בשם "' + args.name + '"' });
        const createdIngredients = [];
        const ingredients = (args.ingredients || []).map(line => {
          let ing = A.state.ingredients.find(i => i.name === line.name);
          if (!ing) {
            ing = { id: U.uid(), name: line.name, category: 'אחר', pkgPrice: 0, pkgSize: 1, pkgUnit: ['g','kg','ml','l'].includes(line.unit) ? (line.unit === 'g' ? 'kg' : line.unit === 'ml' ? 'l' : line.unit) : 'unit', gramsPerCup: 240, gramsPerUnit: 0, allergens: [], stock: 0, minStock: 0, supplier: '', estimated: true };
            A.state.ingredients.push(ing);
            createdIngredients.push(line.name);
          }
          return { ingId: ing.id, qty: +line.qty || 0, unit: line.unit, section: line.section || '' };
        });
        const t = args.times || {};
        const recipe = {
          id: U.uid(),
          name: args.name,
          category: args.category || 'עוגות',
          yield: +args.yield || 1,
          yieldUnit: args.yield_unit || 'יח׳',
          price: +args.price || 0,
          packagingPerUnit: 0, otherCost: 0,
          ovenTemp: args.oven_temp || '',
          times: { prep: +t.prep || 0, rest: +t.rest || 0, bake: +t.bake || 0, cool: +t.cool || 0, decor: +t.decor || 0 },
          ingredients,
          steps: (args.steps || []).map(s => ({ text: s, history: [] })),
          notes: args.notes || '',
          description: args.description || '',
          tags: args.tags || [],
          storage: args.storage || { room: 0, fridge: 0, freezer: 0, note: '' },
          favorite: false,
          created: U.today(),
          image: ''
        };
        A.state.recipes.push(recipe);
        saveState('מתכון נוסף');
        const pricing = C.pricing(recipe);
        return JSON.stringify({ ok: true, id: recipe.id, name: recipe.name, cost_per_unit: pricing.perUnit, suggested_price: pricing.suggested, new_ingredients_created: createdIngredients });
      }
    },

    update_recipe: {
      approval: 'confirm',
      description: 'עדכון מתכון קיים — שם, זמנים, מחיר, מצרכים, שלבים, הערות ועוד. שולחים רק את השדות שרוצים לשנות.',
      input_schema: { type: 'object', required: ['recipe_id_or_name'], properties: {
        recipe_id_or_name: { type: 'string', description: 'ID של מתכון או שם מדויק' },
        name: { type: 'string' }, category: { type: 'string' }, yield: { type: 'number' }, yield_unit: { type: 'string' },
        price: { type: 'number' }, oven_temp: { type: 'number' },
        times: { type: 'object', properties: { prep: { type: 'number' }, rest: { type: 'number' }, bake: { type: 'number' }, cool: { type: 'number' }, decor: { type: 'number' } } },
        add_ingredients: { type: 'array', description: 'מצרכים להוסיף', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' }, section: { type: 'string' } } } },
        replace_ingredients: { type: 'array', description: 'החלפה מלאה של רשימת המצרכים', items: { type: 'object' } },
        add_steps: { type: 'array', items: { type: 'string' }, description: 'שלבים להוסיף בסוף' },
        replace_steps: { type: 'array', items: { type: 'string' }, description: 'החלפת כל רשימת השלבים' },
        notes: { type: 'string' },
        description: { type: 'string' }
      } },
      execute(args) {
        const q = args.recipe_id_or_name;
        let r = A.state.recipes.find(x => x.id === q) || A.state.recipes.find(x => x.name === q);
        if (!r) { const m = A.state.recipes.filter(x => (x.name || '').includes(q)); if (m.length !== 1) return JSON.stringify({ error: m.length ? 'שם דו-משמעי' : 'מתכון לא נמצא', matches: m.map(x => ({ id: x.id, name: x.name })) }); r = m[0]; }
        const changes = {};
        if (args.name) { changes.name = { from: r.name, to: args.name }; r.name = args.name; }
        if (args.category) { r.category = args.category; changes.category = args.category; }
        if (args.yield) { r.yield = +args.yield; changes.yield = +args.yield; }
        if (args.yield_unit) { r.yieldUnit = args.yield_unit; changes.yieldUnit = args.yield_unit; }
        if (args.price != null) { changes.price = { from: r.price, to: +args.price }; r.price = +args.price; }
        if (args.oven_temp) { r.ovenTemp = +args.oven_temp; changes.ovenTemp = +args.oven_temp; }
        if (args.times) { Object.assign(r.times = r.times || {}, args.times); changes.times = args.times; }
        if (args.notes != null) { r.notes = args.notes; changes.notes = true; }
        if (args.description != null) { r.description = args.description; changes.description = true; }
        const mapIngLine = line => {
          let ing = A.state.ingredients.find(i => i.name === line.name);
          if (!ing) { ing = { id: U.uid(), name: line.name, category: 'אחר', pkgPrice: 0, pkgSize: 1, pkgUnit: 'kg', gramsPerCup: 240, gramsPerUnit: 0, allergens: [], stock: 0, minStock: 0, supplier: '', estimated: true }; A.state.ingredients.push(ing); }
          return { ingId: ing.id, qty: +line.qty || 0, unit: line.unit || 'g', section: line.section || '' };
        };
        if (args.replace_ingredients) { r.ingredients = args.replace_ingredients.map(mapIngLine); changes.ingredients = 'replaced'; }
        else if (args.add_ingredients) { r.ingredients = (r.ingredients || []).concat(args.add_ingredients.map(mapIngLine)); changes.ingredients = 'added ' + args.add_ingredients.length; }
        if (args.replace_steps) { r.steps = args.replace_steps.map(s => ({ text: s, history: [] })); changes.steps = 'replaced'; }
        else if (args.add_steps) { r.steps = (r.steps || []).concat(args.add_steps.map(s => ({ text: s, history: [] }))); changes.steps = 'added ' + args.add_steps.length; }
        saveState('מתכון עודכן');
        return JSON.stringify({ ok: true, recipe: r.name, changes });
      }
    },

    update_ingredient_price: {
      approval: 'confirm',
      description: 'עדכון מחיר ומידת אריזה של מצרך קיים (אחרי סריקת קבלה או קנייה). אם המצרך לא קיים — יישלחו גם name+category והוא ייווצר. פעולה רגישה — משפיעה על חישוב עלות של כל המתכונים.',
      input_schema: { type: 'object', required: ['name', 'pkg_price'], properties: {
        name: { type: 'string', description: 'שם המצרך (חייב להיות זהה לקיים אם רוצים לעדכן קיים)' },
        pkg_price: { type: 'number', description: 'מחיר האריזה בשקלים (למשל: ק״ג קמח = 7)' },
        pkg_size: { type: 'number', description: 'גודל האריזה (למשל: 1 עבור ק״ג, 500 עבור חבילת 500 גרם)' },
        pkg_unit: { type: 'string', enum: ['kg', 'g', 'l', 'ml', 'unit'], description: 'יחידת האריזה' },
        category: { type: 'string', description: 'קטגוריה אם המצרך חדש (קמחים/סוכרים/שמרים ואפייה/נוזלים/חלבי/שומנים/ביצים/שוקולד וקקאו/טעמים ותמציות/פירות ואגוזים/חוטי קישוט ואריזות/אחר)' },
        allergens: { type: 'array', items: { type: 'string' } },
        supplier: { type: 'string', description: 'שם ספק (למשל: מחסני קניוקנ)' },
        stock_add: { type: 'number', description: 'כמה להוסיף למלאי (ביחידות של האריזה, אופציונלי)' }
      } },
      execute(args) {
        let i = A.state.ingredients.find(x => x.name === args.name);
        const created = !i;
        if (!i) {
          if (!args.category) return JSON.stringify({ error: 'מצרך חדש — נדרש גם category' });
          i = { id: U.uid(), name: args.name, category: args.category, pkgPrice: 0, pkgSize: 1, pkgUnit: 'kg', gramsPerCup: 240, gramsPerUnit: 0, allergens: [], stock: 0, minStock: 0, supplier: '', estimated: false };
          A.state.ingredients.push(i);
        }
        const prev = { pkgPrice: i.pkgPrice, pkgSize: i.pkgSize, pkgUnit: i.pkgUnit };
        i.pkgPrice = +args.pkg_price;
        if (args.pkg_size) i.pkgSize = +args.pkg_size;
        if (args.pkg_unit) i.pkgUnit = args.pkg_unit;
        if (args.allergens) i.allergens = args.allergens;
        if (args.supplier) i.supplier = args.supplier;
        if (args.stock_add) i.stock = (+i.stock || 0) + +args.stock_add;
        i.estimated = false;
        saveState(created ? 'מצרך נוסף' : 'מחיר עודכן');
        return JSON.stringify({ ok: true, name: i.name, created, from: prev, to: { pkgPrice: i.pkgPrice, pkgSize: i.pkgSize, pkgUnit: i.pkgUnit } });
      }
    },

    create_coupon: {
      description: 'יצירת קופון חדש.',
      input_schema: { type: 'object', required: ['code', 'type', 'value'], properties: {
        code: { type: 'string' },
        type: { type: 'string', enum: ['percent', 'fixed'] },
        value: { type: 'number' },
        min_order: { type: 'number' },
        max_uses: { type: 'integer', description: 'מגבלת שימושים כוללת לכל הלקוחות יחד (0 = ללא הגבלה)' },
        once_per_customer: { type: 'boolean', description: 'חד־פעמי לכל לקוחה (לפי מספר טלפון)' },
        first_order_only: { type: 'boolean', description: 'רק להזמנה ראשונה של לקוחה חדשה' },
        valid_from: { type: 'string', description: 'YYYY-MM-DD' },
        valid_to: { type: 'string', description: 'YYYY-MM-DD' },
        note: { type: 'string' }
      } },
      execute(args) {
        const code = String(args.code || '').replace(/\s+/g, '').toUpperCase();
        if (!code) return JSON.stringify({ error: 'חסר קוד' });
        if (A.state.coupons.some(c => (c.code || '').toUpperCase() === code)) return JSON.stringify({ error: 'קוד כבר קיים' });
        const type = args.type === 'fixed' ? 'fixed' : 'percent', value = +args.value || 0;
        if (!(value > 0)) return JSON.stringify({ error: 'ערך ההנחה חייב להיות גדול מ-0' });
        if (type === 'percent' && value > 100) return JSON.stringify({ error: 'אחוז הנחה חייב להיות עד 100' });
        const day = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : '';
        const from = day(args.valid_from), to = day(args.valid_to);
        if (from && to && from > to) return JSON.stringify({ error: 'תאריך הסיום לפני תאריך ההתחלה' });
        const c = { id: U.uid(), code, type, value, minOrder: Math.max(+args.min_order || 0, 0), maxUses: Math.max(Math.floor(+args.max_uses || 0), 0), active: true, note: args.note || '', from, to, firstOrderOnly: !!args.first_order_only, oncePerCustomer: !!args.once_per_customer };
        A.state.coupons.push(c); saveState('קופון נוצר');
        return JSON.stringify({ ok: true, code: c.code });
      }
    },

    delete_order: {
      approval: 'confirm',
      description: 'מחיקת הזמנה לצמיתות (עדיף update_order_status ל-cancelled).',
      input_schema: { type: 'object', required: ['order_id'], properties: { order_id: { type: 'string' } } },
      execute(args) {
        const o = A.state.orders.find(x => x.id === args.order_id || x.num == args.order_id);
        if (!o) return JSON.stringify({ error: 'הזמנה לא נמצאה' });
        A.state.orders = A.state.orders.filter(x => x !== o); saveState('הזמנה נמחקה');
        return JSON.stringify({ ok: true, deleted_order_num: o.num });
      }
    },

    delete_coupon: {
      approval: 'confirm',
      description: 'מחיקת קופון לצמיתות.',
      input_schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
      execute(args) {
        const code = args.code.trim().toUpperCase();
        const c = A.state.coupons.find(x => x.code.toUpperCase() === code);
        if (!c) return JSON.stringify({ error: 'קופון לא נמצא' });
        A.state.coupons = A.state.coupons.filter(x => x !== c); saveState('קופון נמחק');
        return JSON.stringify({ ok: true, deleted: code });
      }
    },

    change_recipe_price: {
      approval: 'confirm',
      description: 'שינוי מחיר מתכון. פעולה רגישה — משפיע על תמחור ללקוחות. עדיף להעביר את ה-recipe_id המדויק (לא שם).',
      input_schema: { type: 'object', required: ['recipe_id_or_name', 'new_price'], properties: {
        recipe_id_or_name: { type: 'string', description: 'ID של המתכון, או שם מדויק' }, new_price: { type: 'number' }
      } },
      execute(args) {
        const q = args.recipe_id_or_name;
        let r = A.state.recipes.find(x => x.id === q);
        if (!r) r = A.state.recipes.find(x => x.name === q);
        if (!r) {
          const matches = A.state.recipes.filter(x => (x.name || '').includes(q));
          if (matches.length !== 1) return JSON.stringify({ error: matches.length ? 'שם דו-משמעי — תני ID' : 'מתכון לא נמצא', matches: matches.map(m => ({ id: m.id, name: m.name })) });
          r = matches[0];
        }
        const prev = r.price; r.price = args.new_price; saveState('מחיר עודכן');
        return JSON.stringify({ ok: true, recipe: r.name, from: prev, to: r.price });
      }
    }
  };

  const toolsForAPI = () => {
    const list = Object.entries(TOOLS).map(([name, def]) => ({ name, description: def.description, input_schema: def.input_schema }));
    list[list.length - 1].cache_control = { type: 'ephemeral' };
    return list;
  };
  // מה מוצג לה בצ'אט כשהעוזרת משתמשת בכלי (בעברית, בלי שמות טכניים)
  const TOOL_LABEL = {
    list_orders: 'בדקתי את ההזמנות', get_recipe: 'בדקתי את המתכון', recipes_by_profit: 'בדקתי רווחיות מתכונים', low_stock: 'בדקתי מלאי',
    business_stats: 'בדקתי הכנסות ורווחים', list_customers: 'בדקתי לקוחות', list_ingredients: 'בדקתי את המחסן', feedback_summary: 'בדקתי משובים',
    order_form_info: 'בדקתי את טופס ההזמנות', shopping_list: 'חישבתי ייצור וקניות', today_summary: 'בדקתי את היום',
    update_order_status: 'עדכנתי סטטוס הזמנה', update_order_notes: 'עדכנתי הערות להזמנה', add_item_to_order: 'הוספתי פריט להזמנה',
    create_recipe: 'יצרתי מתכון', update_recipe: 'עדכנתי מתכון', update_ingredient_price: 'עדכנתי מחיר מצרך', create_coupon: 'יצרתי קופון',
    delete_order: 'מחקתי הזמנה', delete_coupon: 'מחקתי קופון', change_recipe_price: 'שיניתי מחיר מתכון'
  };

  function approvalText(name, input) {
    const descs = {
      delete_order: `למחוק הזמנה #${input.order_id} לצמיתות? לא ניתן לשחזר.`,
      delete_coupon: `למחוק את הקופון "${input.code}" לצמיתות?`,
      change_recipe_price: `לשנות את המחיר של "${input.recipe_id_or_name || input.recipe_name}" ל-${U.money(+input.new_price)}?`,
      update_recipe: `לעדכן את המתכון "${input.recipe_id_or_name}"${input.name ? ` → שם: ${input.name}` : ''}${input.price != null ? ` → מחיר: ${U.money(+input.price)}` : ''}${input.add_steps ? ` → ${input.add_steps.length} שלבים חדשים` : ''}${input.add_ingredients ? ` → ${input.add_ingredients.length} מצרכים חדשים` : ''}?`,
      update_ingredient_price: `לעדכן את המחיר של "${input.name}": ${U.money(+input.pkg_price)}${input.pkg_size ? ` ל-${input.pkg_size} ${({g:'גרם', kg:'ק״ג', ml:'מ״ל', l:'ליטר', unit:'יחידות'})[input.pkg_unit] || input.pkg_unit}` : ''}${input.supplier ? ` (${input.supplier})` : ''}?`
    };
    return descs[name] || `לבצע ${name}?`;
  }

  // שגיאה מהשרת → הסבר בעברית; retry = אפשר לנסות שוב אוטומטית
  function apiError(status, data) {
    const raw = String((data && data.error && (data.error.message || data.error)) || '');
    const e = new Error(
      status === 401 || status === 403 || /api.?key|authentication|secret/i.test(raw) ? 'יש בעיה במפתח של העוזרת בשרת. תגידי לי ואבדוק.'
      : status === 413 || /too large|too long|prompt is too long/i.test(raw) ? 'ההודעה ארוכה מדי. נסי תמונה קטנה יותר, או "שיחה חדשה".'
      : status === 429 ? 'יותר מדי בקשות ברגע זה. נסי שוב בעוד דקה.'
      : status === 529 || status === 503 || /overloaded/i.test(raw) ? 'השירות עמוס כרגע. נסי שוב בעוד רגע.'
      : /credit|billing|balance/i.test(raw) ? 'נגמרה יתרת השימוש בחשבון של העוזרת.'
      : status === 400 ? 'הבקשה לא התקבלה.'
      : `תקלה בשרת (${status}). נסי שוב.`);
    e.status = status; e.retry = [408, 429, 500, 502, 503, 504, 529].includes(status); e.badRequest = status === 400 && !/credit|billing/i.test(raw);
    return e;
  }
  async function callApi(messages) {
    const body = JSON.stringify({ model: MODEL, max_tokens: 4096, system: systemBlocks(), tools: toolsForAPI(), messages });
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise(res => setTimeout(res, attempt * 3000));
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 150000);
      try {
        const r = await fetch(EDGE_URL, { method: 'POST', signal: ctl.signal, body,
          headers: { 'content-type': 'application/json', apikey: PUB_KEY, authorization: 'Bearer ' + PUB_KEY } });
        let data = null; try { data = await r.json(); } catch (e) { }
        if (r.ok && data && Array.isArray(data.content)) return data;
        last = apiError(r.ok ? 502 : r.status, data);
        if (!last.retry) throw last;
      } catch (e) {
        if (e.status && !e.retry) throw e;
        if (e.name === 'AbortError') throw new Error('התשובה לקחה יותר מדי זמן. נסי שוב.');
        last = e.status ? e : new Error(e.name === 'AbortError' ? 'התשובה לקחה יותר מדי זמן. נסי שוב.' : navigator.onLine ? 'בעיית תקשורת עם השרת. נסי שוב.' : 'אין חיבור לאינטרנט.');
      } finally { clearTimeout(timer); }
    }
    throw last;
  }

  async function runTurn(messages, uiAppend, uiReplaceLoading) {
    let turn = 0;
    while (turn++ < MAX_TURNS) {
      uiAppend({ type: 'loading' });
      const data = await callApi(messages);
      uiReplaceLoading();
      // רק סוגי תוכן שאפשר לשלוח בחזרה (טקסט ובקשות כלים)
      let assistantContent = (data.content || []).filter(b => b.type === 'text' || b.type === 'tool_use');
      // תשובה שנקטעה באמצע בקשת כלי — לא מבצעים בקשה חלקית
      if (data.stop_reason === 'max_tokens') assistantContent = assistantContent.filter(b => b.type !== 'tool_use');
      if (!assistantContent.length) { uiAppend({ type: 'text', text: 'לא הצלחתי לנסח תשובה. נסי לשאול שוב במילים אחרות.', error: true }); return messages; }
      messages.push({ role: 'assistant', content: assistantContent });
      for (const block of assistantContent) {
        if (block.type === 'text' && block.text.trim()) uiAppend({ type: 'text', text: block.text });
      }
      const toolUses = assistantContent.filter(b => b.type === 'tool_use');
      if (!toolUses.length) return messages;
      const toolResults = [];
      for (const use of toolUses) {
        const def = TOOLS[use.name];
        if (!def) { toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: 'tool not found', is_error: true }); continue; }
        if (def.approval === 'confirm') {
          const ok = await new Promise(res => uiAppend({ type: 'approval', toolName: use.name, input: use.input, resolve: res }));
          if (!ok) {
            toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: 'המשתמש ביטל את הפעולה', is_error: true });
            uiAppend({ type: 'tool', name: use.name, result: 'בוטל ע״י המשתמש', error: true });
            continue;
          }
        }
        try {
          const result = def.execute(use.input || {});
          toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: result });
          uiAppend({ type: 'tool', name: use.name, result });
        } catch (e) {
          toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: 'שגיאה: ' + e.message, is_error: true });
          uiAppend({ type: 'tool', name: use.name, result: 'שגיאה: ' + e.message, error: true });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }
    uiAppend({ type: 'text', text: 'זה לקח יותר מדי צעדים. נסי לפרק את הבקשה לשאלה קצרה יותר.', error: true });
    return messages;
  }

  function renderMsg(m) {
    if (m.type === 'user') {
      const img = m.image ? `<img src="${m.image}" class="msg-img" alt="תמונה">` : '';
      const text = m.text && m.text !== '(תמונה)' ? U.esc(m.text).replace(/\n/g, '<br>') : '';
      return `<div class="msg msg-u">${img}${text}</div>`;
    }
    if (m.type === 'text') {
      let html = U.esc(m.text);
      html = html.replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>').replace(/^\s*[-*]\s+/gm, '• ');
      html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\n/g, '<br>');
      return `<div class="msg msg-a ${m.error ? 'err' : ''}">${html}</div>`;
    }
    if (m.type === 'tool') {
      const failed = m.error || /"error"/.test(m.result || '');
      return `<div class="msg msg-tool ${failed ? 'err' : ''}">${failed ? '⚠' : '✓'} ${U.esc(TOOL_LABEL[m.name] || 'בדקתי נתונים')}${failed && m.result ? ` — ${U.esc(String(m.result).replace(/^\{"error":"|"\}$|[{}"]/g, '').slice(0, 120))}` : ''}</div>`;
    }
    if (m.type === 'loading') return `<div class="msg msg-a loading"><span></span><span></span><span></span></div>`;
    if (m.type === 'approval') {
      if (m.resolved === 'yes') return `<div class="msg msg-approval resolved">✓ אושר: ${U.esc(approvalText(m.toolName, m.input))}</div>`;
      if (m.resolved === 'no') return `<div class="msg msg-approval resolved">✗ בוטל: ${U.esc(approvalText(m.toolName, m.input))}</div>`;
      return `<div class="msg msg-approval" data-approval-id="${m._id}">❓ ${U.esc(approvalText(m.toolName, m.input))}<div class="row" style="margin-top:8px;gap:8px"><button class="btn sm" data-apr-yes>${A.icon('check')}אשר</button><button class="btn sm ghost" data-apr-no>${A.icon('x')}בטל</button></div></div>`;
    }
    return '';
  }

  function render(main) {
    const persistent = loadChat();
    A.setActions(`<button class="btn ghost sm" data-act="clear">${A.icon('trash')}שיחה חדשה</button>`);
    main.innerHTML = `
      <div class="assistant-wrap">
        <div class="card section" style="padding:14px 18px;display:flex;gap:14px;align-items:center">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--brown),var(--brown-3));color:var(--cream);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">✦</div>
          <div>
            <h2 class="display" style="margin:0;font-size:1.65rem;color:var(--brown)">העוזרת של הדסה</h2>
            <p class="small muted" style="margin:2px 0 0;letter-spacing:.01em">רואה הזמנות, לקוחות, מחסן, רווחים ומשובים · פעולות רגישות מחכות לאישור שלך</p>
          </div>
        </div>
        <div id="chat" class="chat-box">${persistent.length ? persistent.map(renderMsg).join('') : `<div class="chat-empty"><p class="muted">הי! אני יכולה לעזור לך עם ניתוח הזמנות, תמחור, עדכון סטטוס, יצירת קופונים ועוד.</p><div class="chat-suggestions">${suggestions().map(s => `<button class="btn ghost sm" data-suggest="${U.esc(s)}">${U.esc(s)}</button>`).join('')}</div></div>`}</div>
        <form id="chatForm" class="chat-input">
          <label class="btn ghost sm" style="flex-shrink:0;cursor:pointer" aria-label="צילום קבלה">${A.icon('image')}<input type="file" accept="image/*" capture="environment" id="chatImg" hidden></label>
          <textarea id="chatIn" rows="1" placeholder="מה תרצי לדעת או לבצע? (אפשר גם לצלם קבלה)" autofocus></textarea>
          <button class="btn" type="submit" id="chatSend">${A.icon('msg')}שליחה</button>
        </form>
        <div id="chatAttach" class="chat-attach"></div>
      </div>`;

    const chatBox = main.querySelector('#chat'), input = main.querySelector('#chatIn'), form = main.querySelector('#chatForm'), sendBtn = main.querySelector('#chatSend');
    const imgInput = main.querySelector('#chatImg'), attachBox = main.querySelector('#chatAttach');
    let pendingImage = null; // { data: base64, media_type: '...' }
    chatBox.scrollTop = chatBox.scrollHeight;

    const renderAttach = () => {
      if (!pendingImage) { attachBox.innerHTML = ''; return; }
      attachBox.innerHTML = `<div class="chat-attach-item"><img src="data:${pendingImage.media_type};base64,${pendingImage.data}" alt="תמונה"><button type="button" class="icon-btn" data-rm-img aria-label="הסרת תמונה">${A.icon('x')}</button></div>`;
    };

    const uiMsgs = persistent.slice();
    let apiMsgs = loadApiMessages();

    const redrawChat = () => {
      chatBox.innerHTML = uiMsgs.map(renderMsg).join('');
      chatBox.scrollTop = chatBox.scrollHeight;
      chatBox.querySelectorAll('[data-approval-id]').forEach(el => {
        const id = el.dataset.approvalId;
        const pendingMsg = uiMsgs.find(m => m._id === id);
        if (!pendingMsg || !pendingMsg.resolve) return;
        el.querySelector('[data-apr-yes]').onclick = () => { const r = pendingMsg.resolve; pendingMsg.resolve = null; pendingMsg.resolved = 'yes'; redrawChat(); r(true); };
        el.querySelector('[data-apr-no]').onclick = () => { const r = pendingMsg.resolve; pendingMsg.resolve = null; pendingMsg.resolved = 'no'; redrawChat(); r(false); };
      });
    };

    const persistTypes = ['user', 'text', 'tool'];
    const uiAppend = (m) => {
      if (m.type === 'approval') m._id = 'ap-' + Math.random().toString(36).slice(2, 8);
      uiMsgs.push(m);
      saveChat(uiMsgs.filter(x => persistTypes.includes(x.type)));
      redrawChat();
    };
    const uiReplaceLoading = () => { const i = uiMsgs.findIndex(m => m.type === 'loading'); if (i >= 0) uiMsgs.splice(i, 1); redrawChat(); };

    const send = async text => {
      if ((!text && !pendingImage) || sendBtn.disabled) return;
      const hasImage = !!pendingImage;
      uiMsgs.push({ type: 'user', text: text || '(תמונה)', image: pendingImage ? `data:${pendingImage.media_type};base64,${pendingImage.data}` : null });
      saveChat(uiMsgs.filter(x => persistTypes.includes(x.type)));
      const promptForReceipt = 'סרקי את הקבלה הזו: זהי את שם הספק, את כל המצרכים ומחיריהם, ואז השוי מול המצרכים שבמחסן. לכל מצרך שמצאת, קראי ל-update_ingredient_price עם המחיר והמידות המעודכנים. סכמי מה עודכן בסוף.';
      const userContent = hasImage
        ? [
            { type: 'image', source: { type: 'base64', media_type: pendingImage.media_type, data: pendingImage.data } },
            { type: 'text', text: text || promptForReceipt }
          ]
        : text;
      apiMsgs = cleanHistory(apiMsgs);
      const before = apiMsgs.slice();
      apiMsgs.push({ role: 'user', content: userContent });
      pendingImage = null; renderAttach();
      redrawChat();
      sendBtn.disabled = true; input.disabled = true; input.value = '';
      try {
        try { apiMsgs = await runTurn(apiMsgs, uiAppend, uiReplaceLoading); }
        catch (e) {
          // השיחה הקודמת לא התקבלה — ממשיכים בלעדיה עם השאלה הנוכחית בלבד (במקום להיתקע)
          if (!e.badRequest || !before.length) throw e;
          uiReplaceLoading();
          apiMsgs = await runTurn([{ role: 'user', content: userContent }], uiAppend, uiReplaceLoading);
        }
      } catch (e) {
        uiReplaceLoading();
        uiAppend({ type: 'text', text: '⚠ ' + e.message, error: true });
      } finally {
        saveApiMessages(apiMsgs);
        saveChat(uiMsgs.filter(x => persistTypes.includes(x.type)));
        sendBtn.disabled = false; input.disabled = false; input.style.height = 'auto'; input.focus();
      }
    };

    form.onsubmit = e => { e.preventDefault(); send(input.value.trim()); };
    input.oninput = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; };
    input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } };
    imgInput.onchange = async () => {
      const file = imgInput.files[0]; if (!file) return;
      try {
        const compressed = await compressImage(file);
        pendingImage = compressed;
        renderAttach();
      } catch (err) { A.toast('לא הצלחתי לקרוא את התמונה'); }
      imgInput.value = '';
    };
    main.onclick = e => {
      const s = e.target.closest('[data-suggest]'); if (s) { input.value = s.dataset.suggest; send(s.dataset.suggest); return; }
      if (e.target.closest('[data-rm-img]')) { pendingImage = null; renderAttach(); return; }
    };
    document.getElementById('topActions').onclick = e => {
      if (e.target.closest('[data-act=clear]')) { saveChat([]); saveApiMessages([]); A.refresh(); }
    };
  }

  // דוחסים תמונה ל-base64 לפני שליחה (עד 1600px, JPEG 0.8)
  async function compressImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image(); img.src = url;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    URL.revokeObjectURL(url);
    const MAX = 1600;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const data = dataUrl.split(',')[1];
    return { data, media_type: 'image/jpeg' };
  }

  function suggestions() {
    const upcoming = A.state.orders.filter(o => o.date >= U.today() && o.status !== 'cancelled').length;
    return [
      'כמה הרווחתי החודש?',
      upcoming ? 'מה צריך לקנות ולהכין להזמנות של השבוע?' : 'אילו מצרכים חסרים לי?',
      'מה הלקוחות אומרות במשובים?',
      'אילו לקוחות לא הזמינו הרבה זמן?',
      'אילו מתכונים לא מספיק רווחיים?'
    ];
  }

  P.assistant = { title: 'עוזרת AI', render, cleanHistory, TOOLS };
})(window);
