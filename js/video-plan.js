/* על הגשר — מנוע עריכה אוטומטית: הופך קליפים + אורך + סגנון לתוכנית עריכה מדויקת.
   מבוסס על דפוסים של רילס אוכל מצליחים: הוק בשנייה הראשונה (הצצה לתוצאה), התקדמות כל 2–3 שניות,
   חיתוך על הביט, חשיפה איטית של המוצר המוגמר, ומסך סיום עם קריאה לפעולה. אין כאן DOM — נבדק ב-node. */
(function (root) {
  const A = root.App = root.App || {};

  // סגנונות: cut = אורך חיתוך ממוצע (שניות), beats = כמה ביטים לחיתוך כשיש מוזיקה, speed = מהירות קטעי התהליך
  const STYLES = {
    calm: {
      name: 'רגוע / ASMR', desc: 'חיתוכים רכים וארוכים, מעברי דהייה, צבע חם. מושלם לבצק, שוקולד נמס וקרם — ושומר על הצלילים המקוריים.',
      cut: 2.6, beats: 4, speed: 1, trans: 'fade', transDur: 0.35, kb: 0.06, grade: 'warm', hook: 1.2, reveal: 2.6, revealSpeed: 0.85, revealTrans: 'fade', keepOriginal: true, musicVol: 0.35, text: 'serif'
    },
    rhythm: {
      name: 'קצבי וטרנדי', desc: 'חיתוכים מהירים על הביט, הדגשת זום בכל חיתוך, צבעים חיים. מושך עין ועוצר גלילה.',
      cut: 1.0, beats: 2, speed: 1.4, trans: 'punch', transDur: 0.18, kb: 0.04, grade: 'vivid', hook: 0.9, reveal: 1.8, revealSpeed: 1, revealTrans: 'flash', keepOriginal: false, musicVol: 0.9, text: 'bold'
    },
    recipe: {
      name: 'מתכון שלב־אחר־שלב', desc: 'כל קליפ הוא שלב, עם כיתוב גדול (השלב או מה שכתבת לקליפ). מתאים להדרכות ולשמירות.',
      cut: 2.2, beats: 4, speed: 1.3, trans: 'cut', transDur: 0, kb: 0.05, grade: 'warm', hook: 1.0, reveal: 2.2, revealSpeed: 0.9, revealTrans: 'fade', keepOriginal: false, musicVol: 0.75, text: 'bold', steps: true
    },
    reveal: {
      name: 'חשיפה מרשימה', desc: 'בנייה מהירה של התהליך ואז חשיפה איטית של המוצר המוגמר עם זום — מעולה לעוגות וקינוחים.',
      cut: 1.2, beats: 2, speed: 1.5, trans: 'cut', transDur: 0, kb: 0.05, grade: 'warm', hook: 0.8, reveal: 3.6, revealSpeed: 0.6, revealTrans: 'flash', revealZoom: 0.14, keepOriginal: false, musicVol: 0.85, text: 'serif'
    },
    cinematic: {
      name: 'סינמטי', desc: 'הילוך איטי, תנועת מצלמה עדינה, מעברים רכים ומראה של סרט. יוקרתי ומרגיע.',
      cut: 3.0, beats: 8, speed: 0.8, trans: 'fade', transDur: 0.5, kb: 0.09, grade: 'film', hook: 1.4, reveal: 3.2, revealSpeed: 0.7, revealTrans: 'fade', keepOriginal: false, musicVol: 0.8, text: 'serif', bars: true
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
    const q = (sec, beats) => beat ? Math.max(beat, Math.round(sec / beat) * beat) : sec; // יישור לביט
    const valid = clips.map((c, i) => ({ ...c, i })).filter(c => c.duration > 0.3);
    if (!valid.length) return { segments: [], endCard: 0, total: 0, style: opts.style };
    const heroC = valid.find(c => c.hero) || valid[valid.length - 1];
    const endCard = opts.endCard === false ? 0 : (target >= 12 ? 2 : 1.2);
    let hook = opts.hook === false || valid.length < 2 ? 0 : q(S.hook, 2);
    let reveal = q(S.reveal, 4);
    // סרטון קצר מאוד: מקצרים הוק וחשיפה כדי שישאר מקום לתהליך
    const minBody = Math.min(valid.length - (valid.length > 1 ? 1 : 0), 3) * 0.9;
    let body = target - endCard - hook - reveal;
    if (body < minBody) { const scale = Math.max(0.35, (target - endCard - minBody) / (hook + reveal)); hook *= scale; reveal *= scale; body = target - endCard - hook - reveal; }
    const bodyClips = valid.length > 1 ? valid.filter(c => c !== heroC) : valid;
    const segs = [];
    // החלק מתוך הקליפ שבדרך כלל הכי טוב: בלי ההתחלה והסוף (רעידות, ידיים שנכנסות)
    const usable = c => { const a = c.duration * 0.08, b = c.duration * 0.92; return { a, b, len: Math.max(0.2, b - a) }; };
    const pick = (c, dur, speed, at) => { // at = מיקום יחסי 0..1 בתוך החלק השמיש
      const u = usable(c); let sp = speed, src = dur * sp;
      if (src > u.len) { sp = Math.max(0.5, u.len / dur); src = Math.min(u.len, dur * sp); if (src < dur * sp) dur = src / sp; }
      const start = clamp(u.a + at * u.len - src / 2, u.a, u.b - src);
      return { start: r3(Math.max(0, start)), dur: r3(dur), speed: r3(sp) };
    };

    // 1. הוק — הצצה למוצר המוגמר כבר בשנייה הראשונה
    if (hook > 0.2) {
      const p = pick(heroC, hook, 1, 0.72);
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
    // 3. חשיפה — המוצר המוגמר, לאט, עם זום פנימה
    const pr = pick(heroC, reveal, S.revealSpeed, 0.6);
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
    return { segments: segs, endCard: r3(finalEnd), total: r3(sum() + finalEnd), style: opts.style, styleDef: S };
  }

  A.VIDEO_STYLES = STYLES;
  A.planEdit = planEdit;
})(typeof window !== 'undefined' ? window : globalThis);
