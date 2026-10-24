/* על הגשר — קטלוג מצרכים התחלתי ונתוני דוגמה */
(function (root) {
  const A = root.App, U = A.util;
  const S = A.seed = {};

  // [שם, קטגוריה, מחיר אריזה, גודל, יחידת אריזה, גרם לכוס, גרם ליחידה, אלרגנים]
  // מחירים משוערים — יש לעדכן לפי הקבלות שלך
  const CATALOG = [
    ['קמח לבן', 'קמחים', 6, 1, 'kg', 140, 0, ['גלוטן']],
    ['קמח מלא', 'קמחים', 9, 1, 'kg', 130, 0, ['גלוטן']],
    ['קמח כוסמין', 'קמחים', 16, 1, 'kg', 130, 0, ['גלוטן']],
    ['קמח תופח', 'קמחים', 7, 1, 'kg', 140, 0, ['גלוטן']],
    ['קורנפלור (עמילן תירס)', 'קמחים', 8, 400, 'g', 130, 0, []],
    ['סוכר לבן', 'סוכרים וממתיקים', 6, 1, 'kg', 200, 0, []],
    ['סוכר חום', 'סוכרים וממתיקים', 12, 1, 'kg', 190, 0, []],
    ['אבקת סוכר', 'סוכרים וממתיקים', 7, 500, 'g', 120, 0, []],
    ['סוכר וניל', 'תבלינים ותמציות', 5, 100, 'g', 200, 10, []],
    ['דבש', 'סוכרים וממתיקים', 25, 500, 'g', 340, 0, []],
    ['סילאן', 'סוכרים וממתיקים', 16, 500, 'g', 330, 0, []],
    ['ביצים L', 'ביצים', 15, 12, 'unit', 243, 50, ['ביצים']],
    ['חמאה', 'מוצרי חלב', 9, 200, 'g', 227, 200, ['חלב']],
    ['מרגרינה', 'שומנים ושמנים', 7, 250, 'g', 227, 250, []],
    ['שמן קנולה', 'שומנים ושמנים', 12, 1, 'l', 218, 0, []],
    ['חלב 3%', 'מוצרי חלב', 7, 1, 'l', 245, 0, ['חלב']],
    ['שמנת מתוקה 32%', 'מוצרי חלב', 7, 250, 'ml', 240, 0, ['חלב']],
    ['שמנת צמחית להקצפה', 'מוצרי חלב', 6, 250, 'ml', 240, 0, ['סויה']],
    ['גבינה לבנה 5%', 'מוצרי חלב', 6, 250, 'g', 245, 250, ['חלב']],
    ['מסקרפונה', 'מוצרי חלב', 16, 250, 'g', 240, 250, ['חלב']],
    ['שוקולד מריר', 'שוקולד וקקאו', 7, 100, 'g', 170, 100, ['סויה']],
    ['שוקולד צ׳יפס', 'שוקולד וקקאו', 18, 400, 'g', 170, 0, ['סויה']],
    ['אבקת קקאו', 'שוקולד וקקאו', 14, 200, 'g', 100, 0, []],
    ['אבקת אפייה', 'תפיחה ושמרים', 5, 100, 'g', 192, 10, []],
    ['סודה לשתייה', 'תפיחה ושמרים', 5, 200, 'g', 230, 0, []],
    ['שמרים יבשים', 'תפיחה ושמרים', 12, 100, 'g', 150, 11, []],
    ['שמרים טריים', 'תפיחה ושמרים', 3, 50, 'g', 200, 50, []],
    ['מלח', 'תבלינים ותמציות', 3, 1, 'kg', 290, 0, []],
    ['תמצית וניל', 'תבלינים ותמציות', 12, 50, 'ml', 230, 0, []],
    ['קינמון', 'תבלינים ותמציות', 6, 50, 'g', 125, 0, []],
    ['קפה נמס', 'תבלינים ותמציות', 30, 200, 'g', 80, 0, []],
    ['שיבולת שועל', 'קמחים', 9, 500, 'g', 90, 0, ['גלוטן']],
    ['קוקוס טחון', 'אגוזים וזרעים', 8, 200, 'g', 85, 0, []],
    ['אגוזי מלך', 'אגוזים וזרעים', 16, 200, 'g', 110, 0, ['אגוזים']],
    ['פקאן', 'אגוזים וזרעים', 22, 200, 'g', 110, 0, ['אגוזים']],
    ['שקדים טחונים', 'אגוזים וזרעים', 15, 200, 'g', 100, 0, ['אגוזים']],
    ['שומשום', 'אגוזים וזרעים', 10, 250, 'g', 145, 0, ['שומשום']],
    ['טחינה גולמית', 'ממרחים ומילויים', 14, 500, 'g', 250, 0, ['שומשום']],
    ['ריבה', 'ממרחים ומילויים', 12, 450, 'g', 320, 0, []],
    ['ריבת חלב', 'ממרחים ומילויים', 14, 400, 'g', 300, 0, ['חלב']],
    ['ממרח לוטוס', 'ממרחים ומילויים', 22, 400, 'g', 270, 0, ['גלוטן', 'סויה']],
    ['ממרח נוטלה', 'ממרחים ומילויים', 30, 750, 'g', 270, 0, ['אגוזים', 'חלב']],
    ['מים', 'אחר', 0, 1, 'l', 240, 0, [], true]
  ];

  S.catalog = state => {
    CATALOG.forEach(c => {
      if (state.ingredients.some(i => i.name === c[0])) return;
      state.ingredients.push({
        id: U.uid(), name: c[0], category: c[1], pkgPrice: c[2], pkgSize: c[3], pkgUnit: c[4],
        gramsPerCup: c[5], gramsPerUnit: c[6], allergens: c[7], free: !!c[8],
        estimated: !c[8], stock: 0, minStock: 0, supplier: ''
      });
    });
  };

  const byName = (state, n) => (state.ingredients.find(i => i.name === n) || {}).id;

  S.demo = state => {
    S.catalog(state);
    const L = (n, qty, unit, section) => ({ ingId: byName(state, n), qty, unit, section: section || '' });
    const recipes = [
      {
        name: 'חלה מתוקה', category: 'לחמים וחלות', yield: 3, yieldUnit: 'חלות', price: 25, packagingPerUnit: 0.8,
        ovenTemp: 180, times: { prep: 25, rest: 120, bake: 30, cool: 30, decor: 10 },
        description: 'חלה רכה ואוורירית לשבת, קלועה בשש.',
        ingredients: [L('קמח לבן', 1, 'kg'), L('שמרים יבשים', 2, 'tbsp'), L('סוכר לבן', 0.75, 'cup'), L('מלח', 1, 'tsp'), L('ביצים L', 2, 'unit'), L('שמן קנולה', 0.5, 'cup'), L('מים', 1.5, 'cup')],
        steps: ['מערבבים קמח, שמרים וסוכר.', 'מוסיפים ביצים, שמן ומים ולשים 8 דקות.', 'מוסיפים מלח ולשים עוד 2 דקות עד בצק חלק.', 'מתפיחים שעה עד הכפלה.', 'מחלקים, קולעים ומתפיחים שוב 45 דקות.', 'מורחים ביצה ואופים 30 דקות ב־180°.']
      },
      {
        name: 'עוגיות שוקולד צ׳יפס', category: 'עוגיות', yield: 3, yieldUnit: 'קופסאות (10 יח׳)', price: 45, packagingPerUnit: 2.5,
        ovenTemp: 175, times: { prep: 20, rest: 30, bake: 12, cool: 20, decor: 10 },
        description: 'עוגיות רכות מבפנים ופריכות בשוליים.',
        ingredients: [L('חמאה', 200, 'g'), L('סוכר חום', 1, 'cup'), L('סוכר לבן', 0.5, 'cup'), L('ביצים L', 2, 'unit'), L('תמצית וניל', 1, 'tsp'), L('קמח לבן', 2.5, 'cup'), L('סודה לשתייה', 1, 'tsp'), L('מלח', 0.5, 'tsp'), L('שוקולד צ׳יפס', 1.5, 'cup')],
        steps: ['מקציפים חמאה רכה עם הסוכרים.', 'מוסיפים ביצים ווניל.', 'מוסיפים קמח, סודה ומלח ומערבבים קלות.', 'מקפלים פנימה שוקולד צ׳יפס ומקררים חצי שעה.', 'יוצרים כדורים ואופים 12 דקות.']
      },
      {
        name: 'בבקה שוקולד', category: 'עוגות שמרים', yield: 2, yieldUnit: 'בבקות', price: 65, packagingPerUnit: 3,
        ovenTemp: 175, times: { prep: 40, rest: 150, bake: 35, cool: 40, decor: 10 },
        description: 'בצק חמאה עשיר עם מילוי שוקולד עמוק.',
        ingredients: [L('קמח לבן', 500, 'g', 'בצק'), L('שמרים יבשים', 1, 'tbsp', 'בצק'), L('סוכר לבן', 0.5, 'cup', 'בצק'), L('ביצים L', 2, 'unit', 'בצק'), L('חמאה', 100, 'g', 'בצק'), L('חלב 3%', 0.5, 'cup', 'בצק'), L('מלח', 0.5, 'tsp', 'בצק'),
          L('שוקולד מריר', 200, 'g', 'מילוי'), L('חמאה', 100, 'g', 'מילוי'), L('אבקת קקאו', 3, 'tbsp', 'מילוי'), L('אבקת סוכר', 0.5, 'cup', 'מילוי')],
        steps: ['לשים את כל מרכיבי הבצק 10 דקות.', 'מתפיחים שעה וחצי.', 'ממיסים שוקולד וחמאה ומערבבים עם קקאו ואבקת סוכר.', 'מרדדים, מורחים, מגלגלים וחוצים לאורך.', 'קולעים, מכניסים לתבנית ומתפיחים 45 דקות.', 'אופים 35 דקות ומברישים בסירופ.']
      },
      {
        name: 'עוגת גבינה אפויה', category: 'עוגות', yield: 1, yieldUnit: 'עוגה (24 ס״מ)', price: 120, packagingPerUnit: 4,
        ovenTemp: 160, times: { prep: 30, rest: 240, bake: 60, cool: 60, decor: 15 },
        description: 'עוגת גבינה גבוהה וקרמית על בסיס פירורים.',
        ingredients: [L('קמח לבן', 1.5, 'cup', 'בסיס'), L('חמאה', 100, 'g', 'בסיס'), L('אבקת סוכר', 0.33, 'cup', 'בסיס'),
          L('גבינה לבנה 5%', 750, 'g', 'קרם'), L('שמנת מתוקה 32%', 250, 'ml', 'קרם'), L('סוכר לבן', 1, 'cup', 'קרם'), L('ביצים L', 4, 'unit', 'קרם'), L('קורנפלור (עמילן תירס)', 3, 'tbsp', 'קרם'), L('תמצית וניל', 1, 'tsp', 'קרם')],
        steps: ['מפוררים את מרכיבי הבסיס ומשטחים בתבנית.', 'אופים את הבסיס 10 דקות.', 'מערבבים את כל מרכיבי הקרם עד אחידות — בלי להקציף.', 'יוצקים ואופים שעה ב־160°.', 'מצננים בתנור פתוח ומקררים לפחות 4 שעות.']
      }
    ].map(r => Object.assign({ id: U.uid(), demo: true, notes: '', tags: [], favorite: false, otherCost: 0, created: U.today() }, r));
    state.recipes.push(...recipes);

    // הזמנות דוגמה: 5 חודשים אחורה + כמה קדימה
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const names = ['נועה כהן', 'מיכל לוי', 'רחל אברהם', 'שירה פרץ', 'יעל מזרחי', 'אסתר ביטון', 'דבורה פרידמן', 'תמר אוחיון', 'הדס רוזן', 'ליאת שפירא', 'חני גולד', 'אורית דהן'];
    const custs = names.map((n, i) => ({ name: n, phone: '050-00000' + U.pad(i + 10) }));
    const today = U.today();
    for (let i = 0; i < 70; i++) {
      const back = Math.floor(rnd() * 150) - 6;
      let date = U.addDays(today, -back);
      // יותר הזמנות לחמישי ושישי
      const dow = U.parse(date).getDay();
      if (dow === 6) date = U.addDays(date, -1);
      if (rnd() < 0.35 && dow < 4) date = U.addDays(date, 4 - dow);
      const c = custs[Math.floor(Math.pow(rnd(), 1.6) * custs.length)];
      const items = [];
      const n = 1 + Math.floor(rnd() * 2.2);
      for (let k = 0; k < n; k++) {
        const r = pick(recipes);
        if (items.some(x => x.recipeId === r.id)) continue;
        items.push({ recipeId: r.id, name: r.name, qty: 1 + Math.floor(rnd() * (r.yield > 1 ? 3 : 1.5)), unitPrice: r.price });
      }
      const future = date > today;
      const method = rnd() < 0.35 ? 'delivery' : 'pickup';
      const o = {
        id: U.uid(), demo: true, num: state.settings.nextOrderNum++, customerName: c.name, phone: c.phone,
        date, time: pick(['10:00', '12:00', '13:30', '16:00', '18:00']), method, address: method === 'delivery' ? 'רחוב הגפן 4' : '',
        deliveryFee: method === 'delivery' ? 20 : 0, items, discount: rnd() < 0.1 ? 10 : 0, paid: 0,
        payMethod: pick(A.PAY_METHODS.slice(0, 3)), source: pick(A.SOURCES.slice(0, 5)), notes: '', allergies: '',
        status: future ? pick(['new', 'confirmed', 'confirmed']) : (rnd() < 0.05 ? 'cancelled' : 'delivered'),
        createdAt: U.addDays(date, -Math.floor(rnd() * 6) - 1)
      };
      const t = A.calc.orderTotals(o);
      o.paid = future ? (rnd() < 0.5 ? Math.round(t.total / 2) : 0) : (o.status === 'delivered' ? t.total : 0);
      state.orders.push(o);
    }
    // הוצאות דוגמה
    for (let m = 0; m < 5; m++) {
      const d = U.addDays(today, -m * 30 - 3);
      state.expenses.push({ id: U.uid(), demo: true, date: d, category: 'חומרי גלם', amount: 650 + Math.round(rnd() * 300), desc: 'קנייה חודשית' });
      state.expenses.push({ id: U.uid(), demo: true, date: U.addDays(d, -10), category: 'אריזות', amount: 120 + Math.round(rnd() * 80), desc: 'קופסאות וסרטים' });
    }
    state.expenses.push({ id: U.uid(), demo: true, date: U.addDays(today, -60), category: 'ציוד וכלים', amount: 480, desc: 'מיקסר ידני ותבניות' });
    // גלגל החיים — שתי בדיקות דוגמה
    state.wheel.entries.push(
      { id: U.uid(), demo: true, date: U.addDays(today, -60), scores: [5, 6, 7, 4, 6, 5, 7, 6], notes: {}, wins: 'סגרתי 10 הזמנות בשבוע', gratitude: 'משפחה תומכת', focus: 'לקבוע שעות עבודה קבועות', mood: 6 },
      { id: U.uid(), demo: true, date: U.addDays(today, -7), scores: [6, 7, 8, 6, 8, 6, 7, 7], notes: {}, wins: 'העליתי מחירים בלי לאבד לקוחות', gratitude: 'לקוחות שחוזרות', focus: 'שעה ביום של תנועה', mood: 8 }
    );
  };

  S.clearDemo = state => {
    const demoRecipeIds = new Set(state.recipes.filter(r => r.demo).map(r => r.id));
    state.recipes = state.recipes.filter(r => !r.demo);
    state.orders = state.orders.filter(o => !o.demo);
    state.expenses = state.expenses.filter(e => !e.demo);
    state.wheel.entries = state.wheel.entries.filter(e => !e.demo);
    state.orders.forEach(o => o.items.forEach(i => { if (demoRecipeIds.has(i.recipeId)) i.recipeId = null; }));
    if (!state.orders.length) state.settings.nextOrderNum = 1001;
  };
  S.hasDemo = state => state.recipes.some(r => r.demo) || state.orders.some(o => o.demo);
})(typeof window !== 'undefined' ? window : globalThis);
