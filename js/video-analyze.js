/* על הגשר — ניתוח קליפ לפני עריכה.
   דוגם פריימים לאורך הסרטון, מודד בהירות, חדות (שונות) ותנועה (הפרש בין פריימים),
   ומזהה מקטעים "אטרקטיביים" שכדאי להשתמש בהם.

   החוכמה של "מנהלת סושיאל טובה בתחום האוכל":
   - חשיפת מוצר מוגמר → מחפשים פריים חד, בהיר, עם תנועה נמוכה (עומד יפה)
   - תהליך/פעולה → מחפשים פריימים עם תנועה גבוהה (חיתוך, יציקה, התזה)
   - נמנעים מפריימים שחורים/חשוכים/מטושטשים
*/
(function (root) {
  const A = root.App = root.App || {};

  const SAMPLE_W = 64;  // רזולוציית ניתוח קטנה — מהירה ומספיקה
  const MAX_FRAMES = 32;

  // ממוצע ושונות — חדות = שונות של הבהירות; תנועה = הפרש מוחלט ממוצע מול הפריים הקודם
  function analyzeFrame(ctx, w, h, prev) {
    const img = ctx.getImageData(0, 0, w, h).data;
    const n = w * h;
    let sumY = 0, sumY2 = 0, diff = 0;
    const cur = new Uint8Array(n);
    for (let i = 0, j = 0; i < img.length; i += 4, j++) {
      // luminance (BT.601)
      const y = (0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2]) | 0;
      cur[j] = y; sumY += y; sumY2 += y * y;
      if (prev) diff += Math.abs(y - prev[j]);
    }
    const mean = sumY / n;
    const variance = sumY2 / n - mean * mean;
    return {
      brightness: mean / 255,            // 0..1
      sharpness: Math.sqrt(variance) / 128,  // ~0..1 (נורמלי סביב 0.3-0.6)
      motion: prev ? (diff / n) / 128 : 0,   // 0..~0.5 (תנועה גבוהה = טעימה לקליפ פעולה)
      pixels: cur
    };
  }

  async function sampleAt(v, t) {
    return new Promise(res => {
      const h = () => { v.removeEventListener('seeked', h); res(); };
      v.addEventListener('seeked', h);
      v.currentTime = t;
      setTimeout(res, 1500); // timeout בטוח
    });
  }

  /**
   * מנתח קליפ, מחזיר: {frames:[{t, brightness, sharpness, motion, quality}], suggestedStart, suggestedEnd, bestMoment}
   * frames ממוינים לפי הזמן, quality = ציון משולב 0..1.
   */
  A.analyzeClip = async (clipUrl) => {
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
      // קנבס קטן
      const aspect = (v.videoHeight || 9) / (v.videoWidth || 16);
      const w = SAMPLE_W, h = Math.max(16, Math.round(SAMPLE_W * aspect));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      // דוגמים כל ~0.4 שניות, עד MAX_FRAMES
      const step = Math.max(0.3, dur / MAX_FRAMES);
      const times = []; for (let t = 0.05; t < dur - 0.05; t += step) times.push(t);
      if (times.length > MAX_FRAMES) times.length = MAX_FRAMES;
      const frames = [];
      let prev = null;
      for (const t of times) {
        await sampleAt(v, t);
        if (v.readyState < 2) continue;
        try { ctx.drawImage(v, 0, 0, w, h); }
        catch (e) { continue; } // sandboxed / CORS
        const f = analyzeFrame(ctx, w, h, prev);
        // quality: בהיר אבל לא מופץ (0.25-0.85), חד, קצת תנועה. שחור/לבן/לא חד מקבל ציון נמוך.
        const bScore = f.brightness < 0.1 ? 0 : f.brightness > 0.92 ? 0.3 : Math.min(1, (f.brightness - 0.08) * 2);
        const sScore = Math.min(1, f.sharpness * 2.5); // חדות גבוהה = מצלמה יציבה עם פוקוס טוב
        const quality = (bScore * 0.5 + sScore * 0.5);
        frames.push({ t: +t.toFixed(2), brightness: +f.brightness.toFixed(3), sharpness: +f.sharpness.toFixed(3), motion: +f.motion.toFixed(3), quality: +quality.toFixed(3) });
        prev = f.pixels;
      }
      if (!frames.length) return { duration: dur, frames: [], suggestedStart: dur * 0.1, suggestedEnd: dur * 0.9, bestMoment: dur / 2, avgMotion: 0, avgBrightness: 0.5, avgQuality: 0.5 };
      // סטטיסטיקה כוללת
      const avg = k => frames.reduce((s, f) => s + f[k], 0) / frames.length;
      // זיהוי הטווח האיכותי הרציף
      const qThresh = Math.max(0.3, avg('quality') * 0.75);
      let bestStart = 0.05 * dur, bestEnd = 0.95 * dur, bestLen = 0;
      let curStart = null;
      for (let i = 0; i < frames.length; i++) {
        if (frames[i].quality >= qThresh) {
          if (curStart == null) curStart = frames[i].t;
          const curEnd = i < frames.length - 1 ? frames[i + 1].t : dur;
          if (curEnd - curStart > bestLen) { bestLen = curEnd - curStart; bestStart = curStart; bestEnd = curEnd; }
        } else { curStart = null; }
      }
      const bestMoment = frames.reduce((best, f) => f.quality > best.quality ? f : best, frames[0]).t;
      return {
        duration: +dur.toFixed(2),
        frames,
        suggestedStart: +bestStart.toFixed(2),
        suggestedEnd: +bestEnd.toFixed(2),
        bestMoment: +bestMoment.toFixed(2),
        avgQuality: +avg('quality').toFixed(3),
        avgBrightness: +avg('brightness').toFixed(3),
        avgMotion: +avg('motion').toFixed(3),
        // תיוגים שימושיים לתכנון
        tags: {
          dark: avg('brightness') < 0.2,
          blurry: avg('sharpness') < 0.15,
          static: avg('motion') < 0.015,        // מצלמה יציבה / מוצר עומד = מתאים לreveal
          action: avg('motion') > 0.06         // תנועה משמעותית = מתאים לבודי
        }
      };
    } finally {
      v.pause(); v.remove();
    }
  };

  // ניתוח מרובה קליפים במקביל עם מגבלת concurrency
  A.analyzeClips = async (clips, onProgress) => {
    const results = new Array(clips.length);
    let done = 0;
    const CONC = 2;
    const queue = clips.map((c, i) => [c, i]);
    const workers = Array.from({ length: Math.min(CONC, clips.length) }, async () => {
      while (queue.length) {
        const [c, i] = queue.shift();
        try { results[i] = await A.analyzeClip(c.url); }
        catch (e) { results[i] = null; }
        done++;
        onProgress && onProgress(done / clips.length);
      }
    });
    await Promise.all(workers);
    return results;
  };
})(typeof window !== 'undefined' ? window : globalThis);
