/* על הגשר — ניתוח קליפ לפני עריכה ("העיניים" של העורכת).
   דוגם פריימים צפופים לאורך הקליפ ומודד לכל אחד: בהירות, חדות (קצוות), צבעוניות,
   ותנועה — כשהיא מפרידה בין תנועת מצלמה (רעידה/פאן) לבין תנועה אמיתית בתוך הפריים (ידיים, יציקה, חיתוך).
   מזה בונה "רגעים" על ציר הזמן, כמו שעורכת סושיאל מנוסה בתחום האוכל קוראת חומר גלם:
   - bad    → לחתוך: חשוך, מטושטש, רעידות, החלפת שוט, ההקשה על כפתור ההקלטה בהתחלה ובסוף
   - idle   → קטע מת: לא קורה כלום בתוך קליף של תהליך (מחכים, הידיים יצאו מהפריים) — חותכים
   - still  → פריים יציב, חד ויפה: מוצר מוגמר / תקריב — לחשיפה ולתקריבים
   - action → פעולה: ידיים עובדות, יציקה, קישוט — הליבה של הסרטון, במהירות רגילה
   - steady → תהליך ארוך וחוזר (ערבוב, לישה, טיגון, תפיחה) — מאיצים (טיים־לאפס)
   - peak   → רגע שיא קצר ומרשים (חיתוך לתוך הסופגניה, מילוי נוזל, אבקת סוכר נופלת) — הילוך איטי
   החלק שבונה את הרגעים (buildMoments) טהור ונבדק ב־node; הדגימה עצמה צריכה דפדפן. */
(function (root) {
  const A = root.App = root.App || {};

  const SAMPLE_W = 64;   // רזולוציית ניתוח קטנה — מהירה ומספיקה
  const MAX_FRAMES = 80; // עד ~80 דגימות לקליף (כל 0.2–0.5 שנייה)
  const SHIFT = 3;       // חיפוש תזוזת מצלמה עד 3 פיקסלים (בפריים של 64) לכל כיוון

  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;

  // ---------- מדידת פריים (דפדפן) ----------
  function frameStats(img, w, h) {
    const n = w * h, Y = new Uint8Array(n);
    let sum = 0, sum2 = 0, sat = 0;
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const r = img[i], g = img[i + 1], b = img[i + 2];
      const y = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
      Y[j] = y; sum += y; sum2 += y * y;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b); sat += mx ? (mx - mn) / mx : 0;
    }
    // חדות = עוצמת קצוות ממוצעת (טשטוש תנועה/פוקוס מוריד אותה), לא רק ניגודיות
    let grad = 0;
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { const k = y * w + x; grad += Math.abs(Y[k + 1] - Y[k]) + Math.abs(Y[k + w] - Y[k]); }
    const m = sum / n;
    return { Y, brightness: m / 255, contrast: Math.sqrt(Math.max(0, sum2 / n - m * m)) / 128, sharpness: grad / ((w - 1) * (h - 1)) / 64, color: sat / n };
  }
  // תנועה בין שני פריימים: מוצאים את תזוזת המצלמה שהכי מסבירה את השינוי; מה שנשאר = תנועה אמיתית בתוך התמונה
  function motionBetween(P, Q, w, h) {
    let raw = 0, cnt = 0, best = Infinity, bdx = 0, bdy = 0;
    for (let dy = -SHIFT; dy <= SHIFT; dy++) for (let dx = -SHIFT; dx <= SHIFT; dx++) {
      let d = 0, c = 0;
      for (let y = SHIFT; y < h - SHIFT; y += 2) for (let x = SHIFT; x < w - SHIFT; x += 2) { d += Math.abs(Q[y * w + x] - P[(y + dy) * w + x + dx]); c++; }
      d /= c * 255;
      if (dx === 0 && dy === 0) { raw = d; cnt = c; }
      if (d < best - 1e-6 || (Math.abs(d - best) < 1e-6 && Math.hypot(dx, dy) < Math.hypot(bdx, bdy))) { best = d; bdx = dx; bdy = dy; }
    }
    return { raw, residual: best, cam: Math.hypot(bdx, bdy), camX: bdx, camY: bdy, n: cnt };
  }

  A._videoMeasure = { frameStats, motionBetween, SAMPLE_W }; // לבדיקות

  // ---------- מפריימים לרגעים (טהור) ----------
  const KIND_W = { peak: 1, action: 0.82, still: 0.75, steady: 0.6, idle: 0.15, bad: 0 };
  /**
   * frames: [{t, brightness, sharpness, color, motion(residual לכל 0.25 ש׳), cam, raw}] ממוינים לפי זמן.
   * מחזיר {moments:[{a,b,kind,score,speed,peak?}], labels, stats}
   */
  A.buildMoments = (frames, dur) => {
    if (!frames.length) return { moments: [{ a: 0, b: dur, kind: 'action', score: 0.5, speed: 1 }], labels: [], stats: {} };
    const N = frames.length, dt = N > 1 ? (frames[N - 1].t - frames[0].t) / (N - 1) : dur;
    // החלקה קלה של התנועה (רעש דחיסה של הטלפון)
    const mot = frames.map((f, i) => { const a = frames[Math.max(0, i - 1)].motion, b = f.motion, c = frames[Math.min(N - 1, i + 1)].motion; return median([a, b, c]); });
    mot[0] = frames[0].motion; // לפריים הראשון אין "קודם"
    const medM = median(mot.slice(1)), medS = median(frames.map(f => f.sharpness));
    const lo = Math.max(0.012, medM * 0.45), hi = Math.max(0.03, medM * 1.5), peakThr = Math.max(0.065, medM * 2.3, hi * 1.35);
    const sharpFloor = Math.max(0.025, medS * 0.45);
    // 1. איכות ופריימים פסולים
    const quality = frames.map(f => {
      const b = f.brightness < 0.1 ? 0 : f.brightness > 0.93 ? 0.3 : Math.min(1, (f.brightness - 0.08) * 2.2);
      const s = Math.min(1, f.sharpness / Math.max(0.05, medS * 1.3));
      const c = Math.min(1, (f.color || 0) * 2.5);
      return b * 0.4 + s * 0.4 + c * 0.2;
    });
    const labels = frames.map((f, i) => {
      if (f.brightness < 0.1 || f.brightness > 0.95) return 'bad';
      if (f.sharpness < sharpFloor && mot[i] < peakThr) return 'bad';                 // לא בפוקוס (אבל לא רגע שיא שמטושטש מתנועה)
      // החלפת שוט בתוך הקליף: שינוי גדול שגם נשאר (התאורה/הצבעים זזו ולא חזרו). רגע שיא הוא קפיצה שחולפת
      // (משווים גם לפריים שלפני הקודם — כדי שהחזרה למצב הרגיל אחרי רגע שיא לא תיחשב "שוט חדש")
      if (f.raw > 0.2 && f.motion > 0.16 && i > 1) {
        const d = (x, y) => Math.abs(x.brightness - y.brightness) + Math.abs((x.color || 0) - (y.color || 0));
        const p = frames[i - 1], pp = frames[i - 2], n = frames[i + 1] || f, jump = d(f, p);
        if (jump > 0.1 && d(f, pp) > 0.1 && d(n, f) < jump / 2) return 'bad';
      }
      if (f.cam >= 2.5 && f.sharpness < medS * 0.85) return 'bad';                      // רעידה חזקה
      if (f.t < Math.min(0.3, dur * 0.08) || f.t > dur - Math.min(0.4, dur * 0.1)) return 'bad'; // ההקשה על כפתור ההקלטה
      if (mot[i] <= lo) return 'low';
      return 'move';
    });
    // רעידות (מצלמה ביד בלי יציבות): בחלון של 5 דגימות המצלמה זזה הרבה וכיוון התזוזה מתהפך שוב ושוב.
    // פאן חלק (תזוזה לכיוון אחד) לא נחשב רעידה
    const flip = (a, b) => (Math.sign(a.camX || 0) * Math.sign(b.camX || 0) < 0 ? 1 : 0) + (Math.sign(a.camY || 0) * Math.sign(b.camY || 0) < 0 ? 1 : 0);
    const shaky = frames.map((_, i) => {
      const w = frames.slice(Math.max(0, i - 2), Math.min(N, i + 3)); let flips = 0;
      for (let k = 1; k < w.length; k++) flips += flip(w[k - 1], w[k]);
      return flips >= 3 && mean(w.map(f => f.cam)) >= 1.2;
    });
    shaky.forEach((s, i) => { if (s) labels[i] = 'bad'; });
    const moveShare = labels.filter(l => l === 'move').length / Math.max(1, labels.filter(l => l !== 'bad').length);
    // רגע שיא נמדד על התנועה הגולמית — ההחלקה נגד רעש הייתה מוחקת בדיוק את הקפיצות הקצרות שצריך לזהות
    const rawM = frames.map(f => f.motion);
    // (שיא שנמשך שתי דגימות כמעט זהות — שתיהן נחשבות חלק מהשיא)
    const isPeak = i => labels[i] !== 'bad' && rawM[i] >= peakThr && rawM[i] >= 0.85 * (rawM[i - 1] ?? 0) && rawM[i] >= 0.85 * (rawM[i + 1] ?? 0) && frames[i].cam < 2.5;
    for (let i = 1; i < N; i++) if (labels[i] === 'low' && isPeak(i)) labels[i] = 'move';
    // 2. ריצות רצופות → סוג הרגע
    const runs = []; let s0 = 0;
    for (let i = 1; i <= N; i++) if (i === N || labels[i] !== labels[s0]) { runs.push({ i0: s0, i1: i - 1, lab: labels[s0] }); s0 = i; }
    const lastGood = runs.filter(r => r.lab !== 'bad').pop();
    const kinds = new Array(N);
    runs.forEach(r => {
      const len = (r.i1 - r.i0 + 1) * dt, idx = []; for (let i = r.i0; i <= r.i1; i++) idx.push(i);
      if (r.lab === 'bad') { idx.forEach(i => kinds[i] = 'bad'); return; }
      if (r.lab === 'low') {
        // שקט בתוך קליף שרובו פעולה = זמן מת (מחכים, הידיים מחוץ לפריים) — חוץ מהסוף, שם בדרך כלל מראים את התוצאה.
        // שקט בקליף רגוע, או תנועת מצלמה עדינה על המוצר = פריים יפה
        const camMove = mean(idx.map(i => frames[i].cam)) >= 0.8;
        const dead = moveShare > 0.45 && len >= 1.2 && !camMove && !(r === lastGood && mean(idx.map(i => quality[i])) >= 0.6);
        idx.forEach(i => kinds[i] = dead ? 'idle' : 'still'); return;
      }
      // תנועה: קפיצה חדה וקצרה → הילוך איטי; בין השיאים — תהליך ארוך ואחיד → מאיצים, אחרת פעולה רגילה
      idx.forEach(i => { kinds[i] = isPeak(i) ? 'peak' : 'action'; });
      let k0 = r.i0;
      while (k0 <= r.i1) {
        if (kinds[k0] === 'peak') { k0++; continue; }
        let k1 = k0; while (k1 + 1 <= r.i1 && kinds[k1 + 1] !== 'peak') k1++;
        const ms = mot.slice(k0, k1 + 1), mu = mean(ms), cv = Math.sqrt(mean(ms.map(m => (m - mu) ** 2))) / Math.max(1e-6, mu);
        if ((k1 - k0 + 1) * dt >= 3 && cv < 0.5) for (let q = k0; q <= k1; q++) kinds[q] = 'steady';
        k0 = k1 + 1;
      }
      // שיא שנמשך הרבה זמן הוא לא "רגע" — זו פעולה מהירה רגילה
      let k = r.i0; while (k <= r.i1) { if (kinds[k] !== 'peak') { k++; continue; } let e = k; while (e + 1 <= r.i1 && kinds[e + 1] === 'peak') e++; if ((e - k + 1) * dt > 1.6) for (let q = k; q <= e; q++) kinds[q] = 'action'; k = e + 1; }
    });
    // 3. רגעים על ציר הזמן (שיא מורחב קצת לפני ואחרי — כדי לראות את הרגע נבנה)
    const edge = i => clamp(i === 0 ? 0 : (frames[i - 1].t + frames[i].t) / 2, 0, dur);
    const edgeEnd = i => clamp(i === N - 1 ? dur : (frames[i].t + frames[i + 1].t) / 2, 0, dur);
    const out = []; let i = 0;
    while (i < N) {
      let e = i; while (e + 1 < N && kinds[e + 1] === kinds[i]) e++;
      const kind = kinds[i], a = edge(i), b = edgeEnd(e), q = mean(quality.slice(i, e + 1));
      const m = { a: r2(a), b: r2(b), kind, score: r3(q * KIND_W[kind]), speed: 1 };
      if (kind === 'peak') {
        let pk = i; for (let k = i; k <= e; k++) if (rawM[k] > rawM[pk]) pk = k;
        m.peak = r2(frames[pk].t); m.a = r2(Math.max(0, frames[pk].t - Math.max(0.5, dt * 1.5))); m.b = r2(Math.min(dur, frames[pk].t + Math.max(0.6, dt * 1.8)));
        m.speed = m.b - m.a <= 1.4 ? 0.5 : 0.65;
        m.score = r3(Math.min(1, q * KIND_W.peak + Math.min(0.25, (rawM[pk] / peakThr - 1) * 0.15)));
      } else if (kind === 'steady') m.speed = b - a >= 12 ? 2.8 : b - a >= 6 ? 2.2 : 1.8;
      else if (kind === 'idle') m.speed = 2.5;
      out.push(m); i = e + 1;
    }
    // רגעים קצרצרים (חוץ מפסולים ושיאים) מתמזגים לשכן — לא חותכים באמצע תנועה בגלל דגימה אחת
    const merged = [];
    out.forEach(m => {
      const prev = merged[merged.length - 1];
      if (prev && m.kind !== 'bad' && m.kind !== 'peak' && m.b - m.a < 0.45 && prev.kind !== 'bad') { prev.b = m.b; return; }
      if (prev && prev.kind !== 'bad' && prev.kind !== 'peak' && prev.b - prev.a < 0.45 && m.kind !== 'bad') { m.a = prev.a; merged.pop(); }
      merged.push(m);
    });
    // שיאים חופפים (הורחבו) — לא חופפים לשכנים: השכן מתקצר
    merged.forEach((m, k) => { if (m.kind !== 'peak') return; const p = merged[k - 1], n = merged[k + 1]; if (p && p.b > m.a) p.b = Math.max(p.a, m.a); if (n && n.a < m.b) n.a = Math.min(n.b, m.b); });
    // רגעים צמודים מאותו סוג מתאחדים לרגע אחד (חוץ משיאים — כל שיא הוא רגע בפני עצמו)
    const moments = [];
    merged.filter(m => m.b - m.a > 0.05).forEach(m => {
      const p = moments[moments.length - 1];
      if (p && p.kind === m.kind && m.kind !== 'peak' && Math.abs(p.b - m.a) < 0.02) { const la = p.b - p.a, lb = m.b - m.a; p.score = r3((p.score * la + m.score * lb) / (la + lb)); p.b = m.b; if (m.kind === 'steady') p.speed = p.b - p.a >= 12 ? 2.8 : p.b - p.a >= 6 ? 2.2 : 1.8; }
      else moments.push(m);
    });
    return { moments, labels: kinds, stats: { medMotion: r3(medM), medSharp: r3(medS), moveShare: r2(moveShare), dt: r3(dt) } };
  };

  // סיכום קריא של הניתוח (לתצוגה)
  A.summarizeAnalysis = an => {
    if (!an || !an.moments) return null;
    const sec = k => an.moments.filter(m => m.kind === k).reduce((s, m) => s + (m.b - m.a), 0);
    return { cut: r2(sec('bad') + sec('idle')), slow: an.moments.filter(m => m.kind === 'peak').length, fast: r2(sec('steady')), still: r2(sec('still')), action: r2(sec('action')) };
  };

  async function seekTo(v, t) {
    return new Promise(res => {
      const h = () => { v.removeEventListener('seeked', h); res(); };
      v.addEventListener('seeked', h);
      v.currentTime = t;
      setTimeout(res, 1500); // timeout בטוח
    });
  }

  /** מנתח קליפ (דפדפן). מחזיר {duration, frames, moments, suggestedStart, suggestedEnd, bestMoment, avg*, tags} */
  A.analyzeClip = async (clipUrl, onStep) => {
    const v = document.createElement('video');
    v.src = clipUrl; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0.01';
    document.body.appendChild(v);
    try {
      await new Promise((res, rej) => {
        if (v.readyState >= 1) return res();
        v.addEventListener('loadedmetadata', res, { once: true });
        v.addEventListener('error', rej, { once: true });
        setTimeout(rej, 5000);
      });
      const dur = v.duration || 0;
      if (!(dur > 0.3)) return null;
      const aspect = (v.videoHeight || 9) / (v.videoWidth || 16);
      const w = SAMPLE_W, h = Math.max(16, Math.round(SAMPLE_W * aspect));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const step = clamp(dur / MAX_FRAMES, 0.2, 0.5);
      const times = []; for (let t = 0.05; t < dur - 0.03; t += step) times.push(t);
      if (times.length > MAX_FRAMES) times.length = MAX_FRAMES;
      const frames = []; let prev = null, prevT = 0;
      for (let k = 0; k < times.length; k++) {
        const t = times[k];
        await seekTo(v, t);
        if (v.readyState < 2) continue;
        try { ctx.drawImage(v, 0, 0, w, h); } catch (e) { continue; }
        const f = frameStats(ctx.getImageData(0, 0, w, h).data, w, h);
        const mv = prev ? motionBetween(prev, f.Y, w, h) : { raw: 0, residual: 0, cam: 0, camX: 0, camY: 0 };
        const gap = prev ? Math.max(0.05, t - prevT) : step, norm = 0.25 / gap; // תנועה מנורמלת ל־0.25 שנייה
        frames.push({ t: r2(t), brightness: r3(f.brightness), sharpness: r3(f.sharpness), color: r3(f.color), contrast: r3(f.contrast),
          motion: r3(mv.residual * norm), raw: r3(mv.raw * norm), cam: r2(mv.cam * norm), camX: mv.camX, camY: mv.camY });
        prev = f.Y; prevT = t;
        onStep && onStep((k + 1) / times.length);
      }
      if (!frames.length) return { duration: dur, frames: [], moments: [{ a: 0, b: dur, kind: 'action', score: 0.5, speed: 1 }], suggestedStart: dur * 0.1, suggestedEnd: dur * 0.9, bestMoment: dur / 2, avgMotion: 0, avgBrightness: 0.5, avgQuality: 0.5, tags: {} };
      return A.finishAnalysis(frames, dur);
    } finally {
      v.pause(); v.remove();
    }
  };

  // מסכם פריימים לתוצאת ניתוח מלאה (טהור — גם לבדיקות)
  A.finishAnalysis = (frames, dur) => {
    const { moments, stats } = A.buildMoments(frames, dur);
    const good = moments.filter(m => m.kind !== 'bad');
    const usableA = good.length ? good[0].a : dur * 0.08, usableB = good.length ? good[good.length - 1].b : dur * 0.92;
    const bestOf = k => good.filter(m => m.kind === k).sort((x, y) => y.score - x.score)[0];
    const best = bestOf('still') || bestOf('peak') || bestOf('action') || good[0];
    const q = frames.map(f => (f.brightness < 0.1 ? 0 : Math.min(1, (f.brightness - 0.08) * 2.2)) * 0.5 + Math.min(1, f.sharpness / Math.max(0.05, (stats.medSharp || 0.1) * 1.3)) * 0.5);
    const avg = k => mean(frames.map(f => f[k] || 0));
    const sum = A.summarizeAnalysis({ moments });
    return {
      duration: r2(dur), frames, moments,
      suggestedStart: r2(usableA), suggestedEnd: r2(Math.max(usableA + 0.2, usableB)),
      bestMoment: r2(best ? (best.peak ?? (best.a + best.b) / 2) : dur / 2),
      avgQuality: r3(mean(q)), avgBrightness: r3(avg('brightness')), avgMotion: r3(stats.medMotion || 0),
      tags: {
        dark: avg('brightness') < 0.2,
        blurry: (stats.medSharp || 0) < 0.04,
        static: (stats.medMotion || 0) < 0.015,   // מוצר עומד / מצלמה יציבה — מתאים לחשיפה
        action: (stats.medMotion || 0) > 0.04,    // תהליך — מתאים לגוף הסרטון
        shaky: moments.filter(m => m.kind === 'bad').reduce((s, m) => s + m.b - m.a, 0) > dur * 0.35,
        peaks: sum.slow, steady: sum.fast > 0
      },
      summary: sum
    };
  };

  // ניתוח כמה קליפים עם מגבלת מקביליות (שניים יחד — טלפונים לא אוהבים יותר)
  A.analyzeClips = async (clips, onProgress) => {
    const results = new Array(clips.length), part = new Array(clips.length).fill(0);
    const report = () => onProgress && onProgress(part.reduce((s, x) => s + x, 0) / clips.length);
    const queue = clips.map((c, i) => [c, i]);
    const workers = Array.from({ length: Math.min(2, clips.length) }, async () => {
      while (queue.length) {
        const [c, i] = queue.shift();
        try { results[i] = await A.analyzeClip(c.url, p => { part[i] = p; report(); }); }
        catch (e) { results[i] = null; }
        part[i] = 1; report();
      }
    });
    await Promise.all(workers);
    return results;
  };
})(typeof window !== 'undefined' ? window : globalThis);
