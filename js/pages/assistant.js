/* על הגשר — עוזרת AI (Claude Opus 5.5 דרך Supabase Edge Function) */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};

  const EDGE_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co/functions/v1/assistant';
  const PUB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const LS_KEY = 'ag-assistant-chat';
  const CHAT_API_KEY = 'ag-assistant-api';
  const MAX_TURNS = 8;

  const loadChat = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; } };
  const saveChat = m => { try { localStorage.setItem(LS_KEY, JSON.stringify(m.slice(-40))); } catch (e) { } };
  const loadApiMessages = () => { try { return JSON.parse(localStorage.getItem(CHAT_API_KEY) || '[]'); } catch (e) { return []; } };
  const saveApiMessages = m => { try { localStorage.setItem(CHAT_API_KEY, JSON.stringify(m.slice(-20))); } catch (e) { } };

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
    const upcoming = s.orders.filter(o => o.date >= today && o.status !== 'cancelled').slice(0, 20).map(slimOrder);
    return {
      today,
      businessName: s.settings.businessName,
      recipeCount: s.recipes.length,
      ingredientCount: s.ingredients.length,
      upcomingOrders: upcoming,
      activeCouponCount: (s.coupons || []).filter(c => c.active !== false).length
    };
  }

  function systemPrompt() {
    return `את עוזרת ה-AI של הדסה, בעלת מאפייה "על הגשר". ממשק ניהול מלא עם מתכונים, הזמנות, מצרכים וקופונים.

**איך לענות:**
- בעברית, תמציתית וממוקדת.
- השתמשי בכלים לקבל נתונים מעודכנים לפני תשובה — הסנאפשוט שלמטה חלקי בלבד.
- כשמבקשים ממך לבצע פעולה, **קראי מיד לכלי המתאים** — אל תבקשי אישור בטקסט. פעולות הרסניות מציגות אוטומטית דיאלוג אישור ב-UI, אז אל תשאלי "את בטוחה?" לפני — פשוט קראי לכלי.
- אם חסר מידע חיוני לפעולה (למשל "תמחקי הזמנה" בלי לדעת של מי), תחפשי קודם עם list_orders.
- אם שם של פריט דו-משמעי, בקשי הבהרה.

**סריקת קבלה:** אם המשתמש שלחה תמונה של קבלה/חשבונית, זהי לכל פריט: שם המצרך, מחיר כולל, גודל האריזה (ק״ג/גרם/ליטר). השוי מול רשימת המצרכים בסנאפשוט — התאמה גם אם השם לא זהה (למשל "חמאת תנובה 200ג" מתאים ל"חמאה"). לכל פריט שזיהית, קראי ל-update_ingredient_price עם pkg_price = המחיר הכולל, pkg_size + pkg_unit מהגודל האמיתי של האריזה שקנתה. הדיאלוג יבקש אישור לכל אחד. אם מצרך לא קיים — יצרי עם category מתאימה. סכמי בסוף מה עודכן ומה נוצר.

**תאריך היום:** ${new Date().toISOString().slice(0, 10)}

**Snapshot חלקי של המערכת:**
\`\`\`json
${JSON.stringify(stateSnapshot(), null, 2)}
\`\`\``;
  }

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
      description: 'רשימת קניות למצרכים הנדרשים לכל ההזמנות בטווח תאריכים. מחשב כמויות לפי מתכונים.',
      input_schema: { type: 'object', properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD (ברירת מחדל: היום)' },
        to_date: { type: 'string', description: 'YYYY-MM-DD (ברירת מחדל: היום + 7)' }
      } },
      execute(args) {
        const from = args.from_date || U.today();
        const to = args.to_date || U.addDays(from, 7);
        const orders = A.state.orders.filter(o => o.status !== 'cancelled' && o.date >= from && o.date <= to);
        const needed = {};
        orders.forEach(o => o.items.forEach(item => {
          if (!item.recipeId) return;
          const r = C.recipe(item.recipeId); if (!r) return;
          const factor = (+item.qty || 0) / (+r.yield || 1);
          (r.ingredients || []).forEach(l => {
            if (!l.ingId) return;
            const key = l.ingId;
            needed[key] = needed[key] || { ingId: l.ingId, name: (C.ing(l.ingId) || {}).name || '?', unit: l.unit, qty: 0 };
            needed[key].qty += (+l.qty || 0) * factor;
          });
        }));
        const items = Object.values(needed).map(n => {
          const ing = C.ing(n.ingId) || {};
          const stock = +ing.stock || 0;
          return { name: n.name, needed: Math.round(n.qty * 100) / 100, unit: n.unit, stock, shortBy: Math.max(0, Math.round((n.qty - stock) * 100) / 100) };
        }).filter(x => x.shortBy > 0).sort((a, b) => b.shortBy - a.shortBy);
        return JSON.stringify({ from, to, orderCount: orders.length, missing: items.length ? items : 'כל המצרכים קיימים במחסן' });
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

  const toolsForAPI = () => Object.entries(TOOLS).map(([name, def]) => ({ name, description: def.description, input_schema: def.input_schema }));

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

  async function callApi(messages) {
    const r = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: PUB_KEY, authorization: 'Bearer ' + PUB_KEY },
      body: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 2048, system: systemPrompt(), tools: toolsForAPI(), messages })
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data && data.error && (data.error.message || data.error)) || `שגיאה ${r.status}`);
    return data;
  }

  async function runTurn(messages, uiAppend, uiReplaceLoading) {
    let turn = 0;
    while (turn++ < MAX_TURNS) {
      uiAppend({ type: 'loading' });
      const data = await callApi(messages);
      uiReplaceLoading();
      const assistantContent = data.content || [];
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
    uiAppend({ type: 'text', text: '⚠ הגענו לתקרת הכלים ללא תשובה סופית.' });
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
      html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\n/g, '<br>');
      return `<div class="msg msg-a ${m.error ? 'err' : ''}">${html}</div>`;
    }
    if (m.type === 'tool') {
      const resPreview = (m.result || '').slice(0, 300);
      return `<div class="msg msg-tool ${m.error ? 'err' : ''}">🔧 <b>${U.esc(m.name)}</b><details><summary class="small muted">תוצאה (${(m.result || '').length} תווים)</summary><pre style="white-space:pre-wrap;font-size:.8rem;margin-top:6px">${U.esc(resPreview)}${(m.result || '').length > 300 ? '…' : ''}</pre></details></div>`;
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
            <p class="small muted" style="margin:2px 0 0;letter-spacing:.01em">Claude Opus · קריאה חופשית · פעולות הרסניות דורשות אישור</p>
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
      apiMsgs.push({ role: 'user', content: userContent });
      pendingImage = null; renderAttach();
      redrawChat();
      sendBtn.disabled = true; input.disabled = true;
      try {
        apiMsgs = await runTurn(apiMsgs, uiAppend, uiReplaceLoading);
        saveApiMessages(apiMsgs);
        saveChat(uiMsgs.filter(x => persistTypes.includes(x.type)));
      } catch (e) {
        uiReplaceLoading();
        uiAppend({ type: 'text', text: '⚠ שגיאה: ' + e.message, error: true });
      } finally {
        sendBtn.disabled = false; input.disabled = false; input.value = ''; input.style.height = 'auto'; input.focus();
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
      'מה המתכונים הכי רווחיים שלי?',
      upcoming ? 'מה יש לי השבוע?' : 'אילו מצרכים חסרים לי?',
      'תיצרי קופון SHABBAT15 עם 15% הנחה',
      'אילו מתכונים בהפסד?'
    ];
  }

  P.assistant = { title: 'עוזרת AI', render };
})(window);
