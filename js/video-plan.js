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
  const photoSeg = (k, dur, S) => ({ photo: k, start: 0, dur: r3(dur), speed: 1, trans: 'fade', transDur: Math.min(0.45, dur * 0.3), zoomFrom: k % 2 ? 1.1 : 1.02, zoomTo: k % 2 ? 1.02 : 1.1, pan: k % 2 ? -1 : 1, role: 'photo', caption: '', why: 'תמונה מוגמרת' });

  /**
   * @param clips [{duration, hero?, caption?}]
   * @param opts {target, style, bpm?, hook?=true, endCard?=true}
   * @returns {segments:[{clip, start, dur, speed, trans, transDur, zoomFrom, zoomTo, caption, role}], endCard, total, style}
   */
  function planEdit(clips, opts) {
    const S = STYLES[opts.style] || STYLES.calm;
    const fullTarget = clamp(+opts.target || 30, 5, 180);
    // תמונות מוגמרות לסיום (אחרי חשיפת המוצר, לפני מסך הסיום): זמן קבוע לכל תמונה לפי הסגנון, עד 40% מהסרטון
    const nPh = Math.max(0, Math.min(10, opts.photos | 0));
    let phDur = nPh ? ({ calm: 2.4, rhythm: 1.3, recipe: 2, reveal: 2.2, cinematic: 2.8 }[opts.style] || 2) : 0;
    if (nPh && nPh * phDur > fullTarget * 0.4) phDur = Math.max(0.8, fullTarget * 0.4 / nPh);
    const target = fullTarget - nPh * phDur;
    const beat = opts.bpm ? 60 / opts.bpm : null;
    // ניתוח מילות מפתח מהתיאור — משפיע על דגשים בעריכה
    const desc = (opts.description || '').toLowerCase();
    const focusHints = {
      closeup: /קלוז|תקריב|close/.test(desc),              // להעדיף קליפים סטטיים לתקריבים
      action: /תהליך|הכנ|שלבים|פעולה|חיתוך|יציקה|ערבוב|אפי|נמס/.test(desc), // להעדיף קליפי פעולה
      product: /מוצר מוגמר|תוצאה|מראה סופי|חשיפה/.test(desc),              // חשיפה ארוכה יותר
      quick: /קצר|מהיר|טרנד/.test(desc),                                   // חיתוכים קצרים יותר
      asmr: /asmr|שקט|נזילה|קראנץ|צליל/.test(desc),                       // שמור צליל מקורי
      slow: /הילוך איטי|סלואו|slow|נזילה|נמס|אבקת סוכר|מילוי/.test(desc),   // יותר רגעי הילוך איטי
      fast: /טיים.?לאפס|timelapse|מואץ|הילוך מהיר/.test(desc)             // תהליכים ארוכים מואצים יותר
    };
    const autoSpeed = opts.autoSpeed !== false;
    // רגעים שזוהו בניתוח (בלי פסולים). זה מה שמאפשר לדעת מה להשאיר, מה לחתוך ובאיזו מהירות
    const momentsOf = c => (c.analysis && Array.isArray(c.analysis.moments) ? c.analysis.moments : []).filter(m => m.kind !== 'bad' && m.b - m.a >= 0.2);
    const bias = m => m.score * (focusHints.slow && m.kind === 'peak' ? 1.2 : 1) * (focusHints.closeup && m.kind === 'still' ? 1.15 : 1) * (focusHints.action && (m.kind === 'action' || m.kind === 'steady') ? 1.12 : 1);
    // מהירות לפי סוג הרגע — כמו עורכת: שיא קצר באיטי, תהליך ארוך מואץ, פעולה רגילה בקצב הסגנון
    const speedFor = (m, base) => {
      if (!autoSpeed || !m) return base;
      if (m.kind === 'peak') return clamp(m.speed * (focusHints.slow ? 0.9 : 1), 0.5, 0.8);
      if (m.kind === 'steady') return clamp(Math.max(m.speed, base) * (focusHints.fast ? 1.2 : 1), 1.5, 3);
      if (m.kind === 'idle') return clamp(Math.max(2.4, base), 1.5, 3);
      return base;
    };
    const durW = m => !m || !autoSpeed ? 1 : m.kind === 'peak' ? 1.4 : m.kind === 'steady' ? 0.9 : m.kind === 'idle' ? 0.7 : 1;
    const q = (sec, beats) => beat ? Math.max(beat, Math.round(sec / beat) * beat) : sec; // יישור לביט
    const valid = clips.map((c, i) => ({ ...c, i })).filter(c => c.duration > 0.3);
    if (!valid.length) {
      if (!nPh) return { segments: [], endCard: 0, total: 0, style: opts.style };
      // רק תמונות — מצגת: כל הזמן מתחלק בין התמונות
      const end = fullTarget >= 12 ? 2 : 1.2, d = r3(Math.max(0.8, (fullTarget - end) / nPh)), segs = Array.from({ length: nPh }, (_, k) => photoSeg(k, d, S));
      return { segments: segs, endCard: r3(Math.max(end, fullTarget - d * nPh)), total: r3(fullTarget), style: opts.style, styleDef: S, hookText: '', hints: focusHints, summary: { slow: 0, fast: 0, analyzed: false, shortBy: 0 } };
    }
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
    // הטווח הנקי סביב רגע: הרגע עצמו + רגעים טובים צמודים (בלי לחצות קטע פסול או זמן מת)
    const spanOf = (c, m) => {
      const ms = (c.analysis && c.analysis.moments) || [], mid = (m.a + m.b) / 2, ok = x => x.kind !== 'bad' && x.kind !== 'idle';
      const k = ms.findIndex(x => x.a <= mid && x.b >= mid); if (k < 0) return [m.a, m.b];
      let L = k, R = k; while (L > 0 && ok(ms[L - 1]) && ok(ms[k])) L--; while (R < ms.length - 1 && ok(ms[R + 1]) && ok(ms[k])) R++;
      return [ms[L].a, ms[R].b];
    };
    const pick = (c, dur, speed, at, preferBest, m) => {
      const u = usable(c); let sp = speed;
      let lo = u.a, hi = u.b, L = u.a, R = u.b;
      if (m) {
        // בתוך רגע שזוהה: נשארים בגבולות שלו, ואם צריך — מתרחבים רק לרגעים טובים צמודים
        lo = clamp(m.a, u.a, u.b); hi = clamp(m.b, u.a, u.b); if (hi - lo < 0.2) { lo = u.a; hi = u.b; }
        const sp2 = spanOf(c, m); L = Math.max(u.a, Math.min(lo, sp2[0])); R = Math.min(u.b, Math.max(hi, sp2[1]));
        // תהליך קצר מהצפוי — מאיצים פחות, אבל נשארים מואצים (אחרת זה כבר לא "מהיר") ומקצרים את החיתוך
        if ((m.kind === 'steady' || m.kind === 'idle') && dur * sp > hi - lo) { sp = Math.max(autoSpeed ? 1.5 : 1, Math.min(sp, (hi - lo) / dur)); if (dur * sp > hi - lo) dur = Math.max(0.5, (hi - lo) / sp); }
        // קודם כל בתוך הרגע עצמו (הילוך איטי רק על השיא; פעולה בלי לגלוש לצילומים של חיתוך שכן). אם חסר זמן — ההתאמה בסוף תאריך
        if (dur * sp > hi - lo) dur = Math.max(autoSpeed && m.kind === 'peak' ? 0.5 : 0.6, (hi - lo) / sp);
        if (dur * sp > R - L) dur = Math.max(0.5, (R - L) / sp);   // אין מספיק חומר נקי: מקצרים את החיתוך, והזמן עובר לחיתוכים אחרים
        if (dur * sp > R - L) sp = Math.max(0.5, (R - L) / dur);
      }
      let src = dur * sp;
      if (src > R - L) { sp = Math.max(0.5, (R - L) / dur); src = Math.min(R - L, dur * sp); if (src < dur * sp) dur = src / sp; }
      const center = m ? (m.peak != null ? m.peak : (lo + hi) / 2) : preferBest ? u.best : u.a + at * u.len;
      const start = src <= hi - lo ? clamp(center - src / 2, lo, hi - src) : clamp(center - src / 2, L, R - src);
      return { start: r3(Math.max(0, start)), dur: r3(dur), speed: r3(sp), lim: r3(Math.max(R, start + src)), own: r3(Math.max(hi, start + src)) };
    };
    const why = (m, sp) => !m ? '' : autoSpeed && m.kind === 'peak' && sp < 0.95 ? 'הילוך איטי — רגע שיא' : autoSpeed && m.kind === 'steady' && sp > 1.3 ? `מואץ ×${Math.round(sp * 10) / 10} — תהליך ארוך` : m.kind === 'idle' ? 'קטע שקט — מואץ' : m.kind === 'still' ? 'פריים יציב ויפה' : m.kind === 'action' ? 'פעולה' : '';

    // 1. הוק — הרגע הכי "עוצר גלילה": רגע שיא (בהילוך איטי) אם זוהה כזה מספיק טוב, אחרת הצצה למוצר המוגמר
    let hookM = null;
    if (hook > 0.2) {
      const peaks = valid.flatMap(c => momentsOf(c).filter(m => m.kind === 'peak' && m.score >= 0.55).map(m => ({ c, m }))).sort((x, y) => bias(y.m) - bias(x.m));
      if (autoSpeed && peaks[0]) {
        hookM = peaks[0];
        const p = pick(hookM.c, hook, clamp(hookM.m.speed + 0.1, 0.55, 0.85), 0, false, hookM.m);
        segs.push({ clip: hookM.c.i, ...p, trans: 'cut', transDur: 0, zoomFrom: 1.1, zoomTo: 1.03, role: 'hook', caption: '', kind: 'peak', why: 'הוק — רגע השיא בהילוך איטי' });
      } else {
        const p = pick(heroC, hook, 1, 0.72, true);
        segs.push({ clip: heroC.i, ...p, trans: 'cut', transDur: 0, zoomFrom: 1.12, zoomTo: 1.04, role: 'hook', caption: '', why: 'הוק — הצצה לתוצאה' });
      }
    }
    // הרגעים הכי טובים בקליף, לפי סדר הזמן (הסיפור נשמר). רגע ארוך יכול לתת כמה חיתוכים; זמן מת — רק אם אין ברירה
    // n = כמה חיתוכים רוצים מהקליף; srcLen = כמה שניות מקור בערך כל חיתוך צורך. מחזיר עד n רגעים — בלי לחזור על אותו קטע פעמיים
    const chooseMoments = (c, n, srcLen) => {
      let ms = momentsOf(c); if (!ms.length) return null;
      const lively = ms.filter(m => m.kind !== 'idle'); if (lively.length) ms = lively;
      const pool = [];
      ms.forEach(m => {
        const len = m.b - m.a, sp = speedFor(m, S.speed), parts = m.kind === 'peak' ? 1 : Math.max(1, Math.min(n, Math.floor(len / Math.max(1.2, srcLen * sp))));
        // רגע ארוך מייצג חלק גדול מהסיפור (למשל ערבוב של 6 שניות) — מקבל משקל; פריים שקט קצר באמצע תהליך — פחות
        const lenW = 0.85 + 0.3 * Math.min(1, len / 4), stillW = m.kind === 'still' && len < 1.5 && (c.analysis.tags || {}).action ? 0.65 : 1;
        for (let k = 0; k < parts; k++) {
          const a = m.a + len * k / parts, b = m.a + len * (k + 1) / parts;
          // רגע השיא שכבר הופיע בהוק — מעדיפים לא לחזור עליו (אבל מותר אם אין חומר אחר)
          const dup = hookM && hookM.c === c && b > hookM.m.a && a < hookM.m.b ? 0.55 : 1;
          pool.push({ ...m, a: r3(a), b: r3(b), part: k, src: m, score: bias(m) * lenW * stillW * (k ? 0.93 : 1) * dup });
        }
      });
      // בחירה חמדנית עם גיוון: אחרי שבחרנו רגע, רגעים מאותו סוג ומאותו קטע יורדים בעדיפות — כדי לספר את כל הסיפור
      const out = [], left = pool.slice();
      while (out.length < n && left.length) {
        left.sort((x, y) => y.score - x.score);
        const m = left.shift(); out.push(m);
        left.forEach(x => { if (x.kind === m.kind) x.score *= 0.8; if (x.src === m.src) x.score *= 0.75; });
      }
      return out.sort((x, y) => x.a - y.a);
    };
    // 2. גוף — התהליך, לפי סדר הקליפים
    // מתכון: כל קליף הוא שלב (לפחות חיתוך אחד לכל שלב), ושלב ארוך יכול לקבל עוד חיתוך — למשל התהליך ואז רגע השיא שלו
    let nCuts = S.steps ? Math.max(bodyClips.length, Math.round(body / q(S.cut, S.beats))) : Math.max(1, Math.round(body / q(S.cut, S.beats)));
    nCuts = Math.min(nCuts, Math.max(1, Math.floor(body / 0.6)));
    let chosen = bodyClips;
    if (nCuts < bodyClips.length) chosen = Array.from({ length: nCuts }, (_, k) => bodyClips[Math.floor((k + 0.5) * bodyClips.length / nCuts)]);
    // חלוקת חיתוכים בין הקליפים לפי אורך (קליפ ארוך מקבל יותר)
    const weights = chosen.map(c => Math.sqrt(c.duration)), wsum = weights.reduce((s, w) => s + w, 0);
    let counts = chosen.map(() => 1), extra = nCuts - chosen.length;
    while (extra > 0) { let best = 0, bv = -1; chosen.forEach((c, k) => { const v = weights[k] / wsum * nCuts - counts[k]; if (v > bv) { bv = v; best = k; } }); counts[best]++; extra--; }
    // לכל חיתוך: איזה רגע ממנו. רגע שיא מקבל קצת יותר זמן מסך (הילוך איטי צריך זמן כדי להרגיש), תהליך מואץ קצת פחות
    const plans = chosen.map((c, k) => chooseMoments(c, counts[k], body / nCuts));
    // קליף שאין בו מספיק רגעים שונים מקבל פחות חיתוכים (ארוכים יותר) — לא חוזרים על אותו קטע
    plans.forEach((ms, k) => { if (ms && ms.length) counts[k] = ms.length; });
    const nAll = counts.reduce((s, x) => s + x, 0) || 1;
    const allW = []; plans.forEach((ms, k) => { for (let j = 0; j < counts[k]; j++) allW.push(durW(ms && ms[j])); });
    const wAvg = allW.length ? allW.reduce((s, x) => s + x, 0) / allW.length : 1;
    const cutDur = body / nAll;
    let stepNo = 0, alt = false;
    chosen.forEach((c, k) => {
      stepNo++;
      for (let j = 0; j < counts[k]; j++) {
        const m = plans[k] && plans[k][j];
        const d0 = cutDur * durW(m) / wAvg, d = beat ? q(d0, S.beats) : d0;
        const p = pick(c, d, speedFor(m, S.speed), (j + 0.5) / counts[k], false, m);
        alt = !alt;
        segs.push({ clip: c.i, ...p, trans: segs.length === (hook > 0.2 ? 1 : 0) && hook > 0.2 ? (S.trans === 'fade' ? 'fade' : 'flash') : S.trans, transDur: S.transDur,
          zoomFrom: alt ? 1 : 1 + S.kb, zoomTo: alt ? 1 + S.kb : 1, role: 'body', kind: m ? m.kind : '', why: why(m, p.speed),
          caption: j === 0 ? (c.caption || (S.steps ? `שלב ${stepNo}` : '')) : '' });
      }
    });
    // 3. חשיפה — המוצר המוגמר, לאט, עם זום פנימה, על הפריים היציב והיפה ביותר שזוהה
    const heroMs = momentsOf(heroC).filter(m => m.kind === 'still' || m.kind === 'peak' || m.kind === 'action').sort((x, y) => (y.kind === 'still') - (x.kind === 'still') || y.score - x.score);
    const revM = heroMs.find(m => m.kind === 'still' && m.b - m.a >= 1) || null;
    const pr = pick(heroC, reveal, S.revealSpeed, 0.6, true, revM);
    segs.push({ clip: heroC.i, ...pr, trans: S.revealTrans, transDur: S.revealTrans === 'fade' ? 0.45 : 0.15, zoomFrom: 1, zoomTo: 1 + (S.revealZoom || S.kb * 1.4), role: 'reveal', caption: heroC.caption || '', kind: revM ? 'still' : '', why: 'חשיפה — המוצר המוגמר' });

    // התאמה מדויקת לאורך המבוקש: משנים את קטע החשיפה (ואם צריך את הגוף) כך שהסכום יוצא בדיוק
    const sum = () => segs.reduce((s, x) => s + x.dur, 0);
    let diff = target - endCard - sum();
    for (let pass = 0; pass < 3 && Math.abs(diff) > 0.02; pass++) {
      const order = [segs.length - 1, ...segs.map((_, k) => k).filter(k => segs[k].role === 'body').reverse()];
      for (const k of order) {
        const s = segs[k], c = valid.find(x => x.i === s.clip), u = usable(c);
        // בסבב הראשון לא חורגים מסוף הרגע שנבחר (שלא ייכנס קטע מת/רועד); רק אם אין ברירה — עד סוף החלק השמיש
        // סבב ראשון: כל חיתוך מתארך רק בתוך הרגע שלו (בלי לחזור על צילומים של חיתוך שכן); אחר כך — עד רגעים טובים צמודים
        // הילוך איטי/מואץ לא "דולף" מעבר לרגע שלו (אחרת פעולה רגילה הייתה מואצת, או קטע משעמם באיטי)
        const fixed = autoSpeed && (s.kind === 'steady' || s.kind === 'peak' || s.kind === 'idle');
        const nextStart = Math.min(...segs.filter(x => x !== s && x.clip === s.clip && x.start > s.start + 0.01).map(x => x.start), Infinity);
        const end = Math.min(u.b, (pass === 0 || fixed) && s.own ? s.own : pass === 1 ? Math.min(s.lim || u.b, nextStart) : s.lim || u.b);
        const maxDur = (end - s.start) / s.speed, minDur = 0.5;
        const nd = clamp(s.dur + diff, minDur, Math.max(minDur, maxDur));
        diff -= nd - s.dur; s.dur = r3(nd);
        if (Math.abs(diff) < 0.02) break;
      }
      if (Math.abs(diff) > 0.02) { // אין מספיק חומר: מאטים מעט את קטעי הגוף
        segs.filter(s => s.role !== 'hook').forEach(s => { const c = valid.find(x => x.i === s.clip), u = usable(c); const end = s.lim ? Math.min(u.b, s.lim) : u.b; const want = s.dur + diff / segs.length;
          // תהליך ארוך נשאר מואץ ורגע שיא נשאר איטי — מאטים רק פעולה רגילה (עד 0.75); את היתרה מקבל מסך הסיום
          const floor = autoSpeed && (s.kind === 'steady' || s.kind === 'idle') ? 1.5 : autoSpeed && s.kind && s.kind !== 'peak' ? 0.75 : 0.5;
          const sp = Math.max(floor, Math.min(s.speed, (end - s.start) / want)); s.speed = r3(Math.min(s.speed, sp)); });
      }
      diff = target - endCard - sum();
    }
    // עדיין חסר חומר מצולם: את היתרה מקבל מסך הסיום (לוגו וקריאה לפעולה); עודף מקוצר מהחשיפה
    // לא ממלאים בחומר ריק: מסך הסיום מתארך עד שנייה וחצי; אם חסר יותר — הסרטון יוצא קצר יותר (ומודיעים כמה חסר)
    const missing = Math.max(0, target - endCard - sum());
    let finalEnd = endCard + Math.min(missing, 1.5);
    const shortBy = r3(Math.max(0, missing - 1.5));
    if (target - shortBy - finalEnd - sum() < -0.02) { const last = segs[segs.length - 1]; last.dur = r3(Math.max(0.5, last.dur + (target - finalEnd - sum()))); }
    // הפקת הוק טקסטואלי מהתיאור — משפט פתיחה קצר למי שלא מילא כותרת
    let hookText = '';
    if (opts.description) {
      const firstLine = String(opts.description).split(/[.\n!?]/).map(s => s.trim()).filter(Boolean)[0] || '';
      const words = firstLine.split(/\s+/);
      hookText = words.length <= 7 ? firstLine : words.slice(0, 7).join(' ') + '…';
    }
    segs.forEach(s => { delete s.lim; delete s.own; if (s.role === 'body' && s.kind) s.why = why({ kind: s.kind }, s.speed); });
    // 4. תמונות מוגמרות — אחרי החשיפה, עם זום ותנועה עדינה לסירוגין
    for (let k = 0; k < nPh; k++) segs.push(photoSeg(k, phDur, S));
    // נספרים רק שינויי מהירות שנובעים מהתוכן (רגע שיא / תהליך ארוך) — לא האטה קלה בגלל מחסור בחומר
    const slow = segs.filter(s => s.kind === 'peak' && s.speed < 0.95), fast = segs.filter(s => (s.kind === 'steady' || s.kind === 'idle') && s.speed > 1.3);
    const summary = { slow: slow.length, fast: fast.length, analyzed: valid.some(c => c.analysis && c.analysis.moments), shortBy };
    return { segments: segs, endCard: r3(finalEnd), total: r3(sum() + finalEnd), style: opts.style, styleDef: S, hookText, hints: focusHints, summary };
  }

  A.VIDEO_STYLES = STYLES;
  A.planEdit = planEdit;
})(typeof window !== 'undefined' ? window : globalThis);
