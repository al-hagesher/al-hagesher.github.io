/* על הגשר — מנוע עריכה אוטומטית: הופך קליפים + אורך + סגנון לתוכנית עריכה מדויקת.
   מבוסס על דפוסים של רילס אוכל מצליחים: הוק בשנייה הראשונה (הצצה לתוצאה), התקדמות כל 2–3 שניות,
   חיתוך על הביט, חשיפה איטית של המוצר המוגמר, ומסך סיום עם קריאה לפעולה. אין כאן DOM — נבדק ב-node. */
(function (root) {
  const A = root.App = root.App || {};

  // סגנונות — מבוססים על best-practices של רילס אוכל: הוק של שנייה, מקצב לפי "retention curve"
  // של אינסטגרם, חשיפה שומרת על "זינוק דופמין" בסוף. מעברי דהייה עדינים — בלי הבזקי כתום.
  const STYLES = {
    calm: {
      name: 'רגוע / ASMR', desc: 'חיתוכים רכים, מעברי דהייה שקטים, צליל מקורי (קראנץ׳, מיקסר, נזילה). האלגוריתם נותן לזה משקל גבוה כשהצליל אמיתי.',
      cut: 2.6, beats: 4, speed: 1, trans: 'fade', transDur: 0.4, kb: 0.05, grade: 'warm', hook: 1.2, reveal: 2.8, revealSpeed: 0.85, revealTrans: 'fade', keepOriginal: true, musicVol: 0.3, text: 'serif'
    },
    rhythm: {
      name: 'קצבי וטרנדי', desc: 'חיתוכים מדויקים על הביט, מעברי דהייה קצרים (לא הבזקי כתום!), שמירה על קצב של 0.8–1 שנייה לחיתוך — האורך שעוצר גלילה בפיד.',
      cut: 0.95, beats: 2, speed: 1.35, trans: 'fade', transDur: 0.12, kb: 0.04, grade: 'vivid', hook: 0.9, reveal: 1.8, revealSpeed: 1, revealTrans: 'fade', keepOriginal: false, musicVol: 0.85, text: 'bold'
    },
    recipe: {
      name: 'מתכון שלב־אחר־שלב', desc: 'כל קליפ שלב מסומן בכיתוב גדול וקריא. הסגנון עם הכי הרבה שמירות (saves) — ולכן מגיע ליותר אנשים חדשים.',
      cut: 2.2, beats: 4, speed: 1.25, trans: 'cut', transDur: 0, kb: 0.04, grade: 'warm', hook: 1.0, reveal: 2.2, revealSpeed: 0.9, revealTrans: 'fade', keepOriginal: false, musicVol: 0.7, text: 'bold', steps: true
    },
    reveal: {
      name: 'חשיפה מרשימה', desc: 'בנייה מהירה של התהליך ואז חשיפה איטית של המוצר המוגמר עם זום. הטריק הקלאסי של tasting-videos — "מתח ושחרור".',
      cut: 1.2, beats: 2, speed: 1.5, trans: 'cut', transDur: 0, kb: 0.05, grade: 'warm', hook: 0.8, reveal: 3.6, revealSpeed: 0.6, revealTrans: 'fade', revealZoom: 0.14, keepOriginal: false, musicVol: 0.8, text: 'serif'
    },
    cinematic: {
      name: 'סינמטי', desc: 'הילוך איטי, תנועת מצלמה עדינה, מעברי דהייה רכים ווינייטה חמה. לוקס שנראה כמו Bon Appétit.',
      cut: 3.0, beats: 8, speed: 0.8, trans: 'fade', transDur: 0.55, kb: 0.08, grade: 'film', hook: 1.4, reveal: 3.4, revealSpeed: 0.7, revealTrans: 'fade', keepOriginal: false, musicVol: 0.75, text: 'serif', bars: true
    }
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = v => Math.round(v * 1000) / 1000;

  /**
   * @param clips [{duration, hero?, caption?}]
   * @param opts {target, style, bpm?, hook?=true, endCard?=true}
   * @returns {segments:[{clip, start, dur, speed, trans, transDur, zoomFrom, zoomTo, caption, role}], endCard, total, style}
   */
  function planEdit(clips, opts) {
    const S = STYLES[opts.style] || STYLES.calm;
    const target = clamp(+opts.target || 30, 5, 180);
    const beat = opts.bpm ? 60 / opts.bpm : null;
    // ניתוח מילות מפתח מהתיאור — משפיע על דגשים בעריכה
    const desc = (opts.description || '').toLowerCase();
    const focusHints = {
      closeup: /קלוז|תקריב|close/.test(desc),              // להעדיף קליפים סטטיים לתקריבים
      action: /תהליך|הכנ|שלבים|פעולה|חיתוך|יציקה|ערבוב|אפי|נמס/.test(desc), // להעדיף קליפי פעולה
      product: /מוצר מוגמר|תוצאה|מראה סופי|חשיפה/.test(desc),              // חשיפה ארוכה יותר
      quick: /קצר|מהיר|טרנד/.test(desc),                                   // חיתוכים קצרים יותר
      asmr: /asmr|שקט|נזילה|קראנץ|צליל/.test(desc)                        // שמור צליל מקורי
    };
    const q = (sec, beats) => beat ? Math.max(beat, Math.round(sec / beat) * beat) : sec; // יישור לביט
    const valid = clips.map((c, i) => ({ ...c, i })).filter(c => c.duration > 0.3);
    if (!valid.length) return { segments: [], endCard: 0, total: 0, style: opts.style };
    // בחירת hero חכמה: המשתמשת סימנה ⭐, או הקליפ הסטטי+בהיר ביותר (לפי ניתוח), או האחרון
    const chooseHero = () => {
      const starred = valid.find(c => c.hero); if (starred) return starred;
      const scored = valid.filter(c => c.analysis).map(c => ({
        c,
        // hero טוב: תנועה נמוכה, בהירות גבוהה, איכות גבוהה (מוצר מוגמר מצולם יציב)
        score: (c.analysis.tags?.static ? 0.35 : 0) + c.analysis.avgQuality * 0.4 + Math.min(1, c.analysis.avgBrightness * 1.5) * 0.25
      })).sort((a, b) => b.score - a.score);
      return scored[0]?.c || valid[valid.length - 1];
    };
    const heroC = chooseHero();
    const endCard = opts.endCard === false ? 0 : (target >= 12 ? 2 : 1.2);
    let hook = opts.hook === false || valid.length < 2 ? 0 : q(S.hook, 2);
    let reveal = q(S.reveal, 4);
    // התיאור מכתיב דגשים: "חשיפה" מאריך את הסוף, "קצר" מקצר חיתוכים, וכו׳
    if (focusHints.product) reveal = reveal * 1.3;
    if (focusHints.quick) reveal = reveal * 0.75;
    // סרטון קצר מאוד: מקצרים הוק וחשיפה כדי שישאר מקום לתהליך
    const minBody = Math.min(valid.length - (valid.length > 1 ? 1 : 0), 3) * 0.9;
    let body = target - endCard - hook - reveal;
    if (body < minBody) { const scale = Math.max(0.35, (target - endCard - minBody) / (hook + reveal)); hook *= scale; reveal *= scale; body = target - endCard - hook - reveal; }
    // מסננים קליפים חשוכים/מטושטשים מגוף הסרטון (אבל משאירים אם אין ברירה)
    let bodyClips = valid.length > 1 ? valid.filter(c => c !== heroC) : valid;
    const bodyFiltered = bodyClips.filter(c => !c.analysis || (!c.analysis.tags.dark && !c.analysis.tags.blurry));
    if (bodyFiltered.length >= Math.max(1, Math.floor(bodyClips.length * 0.5))) bodyClips = bodyFiltered;
    // סדר הקליפים — אם יש ניתוח, מעדיפים להתחיל עם קליפי פעולה (תנועה) ולסיים ברגוע
    if (bodyClips.length > 1 && bodyClips.some(c => c.analysis)) {
      bodyClips = bodyClips.slice().sort((a, b) => {
        const am = a.analysis?.avgMotion || 0, bm = b.analysis?.avgMotion || 0;
        // סדר "סיפורי": תנועה גוברת באמצע, ואז יורדת. פשוט לפי מוטיון ממוצע יורד אז עולה — נשמור על סדר המשתמשת.
        return 0; // משאירים את הסדר המקורי של המשתמשת — זה הסיפור שלה
      });
    }
    const segs = [];
    // החלק השמיש של הקליפ. אם יש ניתוח — משתמשים ב-suggestedStart/End שזיהינו (מתעלמים ממסגרת שחורה/רעידה).
    const usable = c => {
      if (c.analysis && c.analysis.suggestedEnd > c.analysis.suggestedStart + 0.4) {
        const a = c.analysis.suggestedStart, b = c.analysis.suggestedEnd;
        return { a, b, len: Math.max(0.2, b - a), best: c.analysis.bestMoment };
      }
      const a = c.duration * 0.08, b = c.duration * 0.92;
      return { a, b, len: Math.max(0.2, b - a), best: (a + b) / 2 };
    };
    const pick = (c, dur, speed, at, preferBest) => {
      const u = usable(c); let sp = speed, src = dur * sp;
      if (src > u.len) { sp = Math.max(0.5, u.len / dur); src = Math.min(u.len, dur * sp); if (src < dur * sp) dur = src / sp; }
      // אם preferBest = true (hook/reveal), ממקמים סביב bestMoment במקום סביב at
      const center = preferBest ? u.best : u.a + at * u.len;
      const start = clamp(center - src / 2, u.a, u.b - src);
      return { start: r3(Math.max(0, start)), dur: r3(dur), speed: r3(sp) };
    };

    // 1. הוק — הצצה למוצר המוגמר על הפריים הכי טוב שזוהה בניתוח
    if (hook > 0.2) {
      const p = pick(heroC, hook, 1, 0.72, true);
      segs.push({ clip: heroC.i, ...p, trans: 'cut', transDur: 0, zoomFrom: 1.12, zoomTo: 1.04, role: 'hook', caption: '' });
    }
    // 2. גוף — התהליך, לפי סדר הקליפים
    let nCuts = S.steps ? bodyClips.length : Math.max(1, Math.round(body / q(S.cut, S.beats)));
    nCuts = Math.min(nCuts, Math.max(1, Math.floor(body / 0.6)));
    let chosen = bodyClips;
    if (nCuts < bodyClips.length) chosen = Array.from({ length: nCuts }, (_, k) => bodyClips[Math.floor((k + 0.5) * bodyClips.length / nCuts)]);
    // חלוקת חיתוכים בין הקליפים לפי אורך (קליפ ארוך מקבל יותר)
    const weights = chosen.map(c => Math.sqrt(c.duration)), wsum = weights.reduce((s, w) => s + w, 0);
    let counts = chosen.map(() => 1), extra = nCuts - chosen.length;
    while (extra > 0) { let best = 0, bv = -1; chosen.forEach((c, k) => { const v = weights[k] / wsum * nCuts - counts[k]; if (v > bv) { bv = v; best = k; } }); counts[best]++; extra--; }
    const cutDur = body / nCuts;
    let stepNo = 0, alt = false;
    chosen.forEach((c, k) => {
      stepNo++;
      for (let j = 0; j < counts[k]; j++) {
        const d = beat ? q(cutDur, S.beats) : cutDur;
        const p = pick(c, d, S.speed, (j + 0.5) / counts[k]);
        alt = !alt;
        segs.push({ clip: c.i, ...p, trans: segs.length === (hook > 0.2 ? 1 : 0) && hook > 0.2 ? (S.trans === 'fade' ? 'fade' : 'flash') : S.trans, transDur: S.transDur,
          zoomFrom: alt ? 1 : 1 + S.kb, zoomTo: alt ? 1 + S.kb : 1, role: 'body',
          caption: j === 0 ? (c.caption || (S.steps ? `שלב ${stepNo}` : '')) : '' });
      }
    });
    // 3. חשיפה — המוצר המוגמר, לאט, עם זום פנימה, מתמקדים ברגע הטוב ביותר שזוהה
    const pr = pick(heroC, reveal, S.revealSpeed, 0.6, true);
    segs.push({ clip: heroC.i, ...pr, trans: S.revealTrans, transDur: S.revealTrans === 'fade' ? 0.45 : 0.15, zoomFrom: 1, zoomTo: 1 + (S.revealZoom || S.kb * 1.4), role: 'reveal', caption: heroC.caption || '' });

    // התאמה מדויקת לאורך המבוקש: משנים את קטע החשיפה (ואם צריך את הגוף) כך שהסכום יוצא בדיוק
    const sum = () => segs.reduce((s, x) => s + x.dur, 0);
    let diff = target - endCard - sum();
    for (let pass = 0; pass < 3 && Math.abs(diff) > 0.02; pass++) {
      const order = [segs.length - 1, ...segs.map((_, k) => k).filter(k => segs[k].role === 'body').reverse()];
      for (const k of order) {
        const s = segs[k], c = valid.find(x => x.i === s.clip), u = usable(c);
        const maxDur = (u.b - s.start) / s.speed, minDur = 0.5;
        const nd = clamp(s.dur + diff, minDur, Math.max(minDur, maxDur));
        diff -= nd - s.dur; s.dur = r3(nd);
        if (Math.abs(diff) < 0.02) break;
      }
      if (Math.abs(diff) > 0.02) { // אין מספיק חומר: מאטים מעט את קטעי הגוף
        segs.filter(s => s.role !== 'hook').forEach(s => { const c = valid.find(x => x.i === s.clip), u = usable(c); const want = s.dur + diff / segs.length; const sp = Math.max(0.5, Math.min(s.speed, (u.b - s.start) / want)); s.speed = r3(sp); });
      }
      diff = target - endCard - sum();
    }
    // עדיין חסר חומר מצולם: את היתרה מקבל מסך הסיום (לוגו וקריאה לפעולה); עודף מקוצר מהחשיפה
    let finalEnd = endCard + Math.max(0, target - endCard - sum());
    if (target - finalEnd - sum() < -0.02) { const last = segs[segs.length - 1]; last.dur = r3(Math.max(0.5, last.dur + (target - finalEnd - sum()))); }
    // הפקת הוק טקסטואלי מהתיאור — משפט פתיחה קצר למי שלא מילא כותרת
    let hookText = '';
    if (opts.description) {
      const firstLine = String(opts.description).split(/[.\n!?]/).map(s => s.trim()).filter(Boolean)[0] || '';
      const words = firstLine.split(/\s+/);
      hookText = words.length <= 7 ? firstLine : words.slice(0, 7).join(' ') + '…';
    }
    return { segments: segs, endCard: r3(finalEnd), total: r3(sum() + finalEnd), style: opts.style, styleDef: S, hookText, hints: focusHints };
  }

  A.VIDEO_STYLES = STYLES;
  A.planEdit = planEdit;
})(typeof window !== 'undefined' ? window : globalThis);
