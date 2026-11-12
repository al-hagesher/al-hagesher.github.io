/* על הגשר — קריינות וכתוביות לסרטונים.
   - הקלטה מהמיקרופון, ובמקביל זיהוי דיבור בעברית (כשהדפדפן תומך) — כדי שהטקסט יהיה מוכן בלי להקליד
   - תזמון כל מילה לפי גל הקול עצמו: איפה יש דיבור ואיפה הפסקות — ככה המילה המודגשת "רוכבת" על הדיבור
   - חלוקה לשורות קצרות, וציור כתוביות בסגנון שמתאים לאווירת הסרטון, עם הדגשת המילה שנאמרת עכשיו
   החלקים החישוביים (envelope/segments/align/lines) טהורים ונבדקים ב־node. */
(function (root) {
  const A = root.App = root.App || {};
  const V = A.voice = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const HOP = 0.01; // 10ms

  /* ---------- יכולות הדפדפן ---------- */
  const SR = () => root.SpeechRecognition || root.webkitSpeechRecognition;
  V.canRecord = () => !!(root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && root.MediaRecorder);
  V.canRecognize = () => !!SR();
  // תמלול קובץ קיים: רק בכרום החדש, שמקבל ערוץ שמע לזיהוי (ולא מקשיב בטעות למיקרופון)
  V.canTranscribeFile = () => !!(root.SpeechRecognition && typeof root.SpeechRecognition.available === 'function');

  /* ---------- ניתוח גל הקול (טהור) ---------- */
  // עוצמה (RMS) כל 10ms, ממוצע של הערוצים. buf: {sampleRate, length, numberOfChannels, getChannelData}
  V.envelope = buf => {
    const sr = buf.sampleRate, hop = Math.max(1, Math.round(sr * HOP)), n = Math.floor(buf.length / hop), env = new Float32Array(n);
    const chs = []; for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    for (let i = 0; i < n; i++) {
      let s = 0, k = 0;
      for (const d of chs) for (let j = i * hop, e = j + hop; j < e; j += 2) { s += d[j] * d[j]; k++; }
      env[i] = Math.sqrt(s / Math.max(1, k));
    }
    return env;
  };
  // קטעי דיבור: סף מסתגל (מעל רעש הרקע), ממלאים הפסקות קצרצרות ומוחקים "קליקים"
  V.speechSegments = env => {
    const n = env.length; if (!n) return [];
    const s = Array.from(env).sort((a, b) => a - b), floor = s[Math.floor(n * 0.15)], peak = s[Math.floor(n * 0.97)];
    const thr = Math.max(floor * 2.2, floor + (peak - floor) * 0.16, 0.004);
    const on = Array.from(env, x => x >= thr);
    const fill = (val, maxLen) => { let i = 0; while (i < n) { if (on[i] !== val) { i++; continue; } let j = i; while (j < n && on[j] === val) j++; if (j - i <= maxLen && i > 0 && j < n) for (let k = i; k < j; k++) on[k] = !val; i = j; } };
    fill(false, 12); // הפסקה של עד 120ms בתוך מילה — לא הפסקה
    fill(true, 5);   // רעש של עד 50ms — לא דיבור
    const out = []; let i = 0;
    while (i < n) { if (!on[i]) { i++; continue; } let j = i; while (j < n && on[j]) j++; out.push({ a: r3(i * HOP), b: r3(j * HOP) }); i = j; }
    return out;
  };

  /* ---------- תזמון מילים (טהור) ---------- */
  V.tokenize = text => String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  // משקל מילה ≈ כמה זמן לוקח להגיד אותה (אותיות + מינימום להברה)
  const weight = w => Math.max(1.5, (w.match(/[\p{L}\p{N}]/gu) || []).length) + 0.6;
  // פיזור מילים על זמן הדיבור בחלון [from,to]: רק על זמן שבו באמת מדברים, וגבולות בין מילים "נצמדים" להפסקות
  function spread(words, segs, from, to) {
    // שלב 1: חלוקה ראשונית והצמדה להפסקות — קובעת איזו מילה שייכת לאיזה קטע דיבור
    const first = prop(words, segs, from, to, true);
    // שלב 2: בתוך כל קבוצה שבין הפסקות — חלוקה מחדש רק על זמן הדיבור שלה (כך קצב משפט אחד לא "מושך" את השני)
    const out = []; let g = 0;
    for (let k = 0; k <= first.length; k++) {
      if (k < first.length && !(k > g && first[k].gapBefore)) continue;
      const grp = first.slice(g, k); if (!grp.length) { g = k; continue; }
      const gs = grp[0].s, ge = grp[grp.length - 1].e;
      out.push(...(grp.length > 1 ? prop(grp.map(x => x.w), segs, gs, ge, false) : grp.map(x => ({ w: x.w, s: x.s, e: x.e }))));
      g = k;
    }
    for (let k = 1; k < out.length; k++) if (out[k].s < out[k - 1].e) out[k].s = out[k - 1].e;
    return out.map(o => ({ w: o.w, s: r3(o.s), e: r3(Math.max(o.s + 0.05, o.e)) }));
  }
  function prop(words, segs, from, to, snap) {
    const parts = segs.map(s => ({ a: Math.max(s.a, from), b: Math.min(s.b, to) })).filter(s => s.b - s.a > 0.02);
    const W = words.map(weight), tw = W.reduce((x, y) => x + y, 0);
    if (!parts.length) { // אין דיבור מזוהה בחלון — חלוקה לפי משקל על כל החלון
      let c = from; return words.map((w, k) => { const d = (to - from) * W[k] / tw; const o = { w, s: c, e: c + d }; c += d; return o; });
    }
    const total = parts.reduce((x, p) => x + p.b - p.a, 0);
    const at = (f, preferNext) => { // מיקום בציר הדיבור → זמן אמיתי
      let left = clamp(f, 0, 1) * total;
      for (let k = 0; k < parts.length; k++) {
        const len = parts[k].b - parts[k].a;
        if (left < len - 1e-6 || k === parts.length - 1) return parts[k].a + Math.min(left, len);
        if (Math.abs(left - len) < 1e-6) return preferNext && parts[k + 1] ? parts[k + 1].a : parts[k].b;
        left -= len;
      }
      return to;
    };
    let cw = 0;
    const out = words.map((w, k) => { const s = at(cw / tw, true); cw += W[k]; const e = at(cw / tw, false); return { w, s, e }; });
    if (!snap) return out;
    // הצמדה להפסקות: גבול בין שתי מילים שקרוב להפסקה אמיתית — עובר אליה (מהפסקה הארוכה לקצרה)
    const gaps = []; for (let k = 1; k < parts.length; k++) gaps.push({ a: parts[k - 1].b, b: parts[k].a, used: false });
    gaps.sort((x, y) => (y.b - y.a) - (x.b - x.a)).forEach(g => {
      const mid = (g.a + g.b) / 2; let best = -1, bd = Infinity;
      for (let k = 0; k < out.length - 1; k++) { const d = Math.abs((out[k].e + out[k + 1].s) / 2 - mid); if (d < bd) { bd = d; best = k; } }
      if (best < 0) return;
      const avg = (out[best].e - out[best].s + out[best + 1].e - out[best + 1].s) / 2;
      if (bd < Math.max(0.25, avg * 1.2) && g.a > out[best].s + 0.05 && g.b < out[best + 1].e + avg && !out[best + 1].gapBefore) {
        out[best].e = g.a; out[best + 1].s = g.b; out[best + 1].gapBefore = true;
        // המילים שאחרי ההפסקה לא יכולות להתחיל לפניה
        for (let k = best + 2; k < out.length && out[k].s < g.b; k++) { const d = out[k].e - out[k].s; out[k].s = out[k - 1].e; out[k].e = Math.max(out[k].e, out[k].s + d * 0.5); }
        for (let k = best - 1; k >= 0 && out[k].e > g.a; k--) { out[k].e = out[k + 1].s; out[k].s = Math.min(out[k].s, out[k].e - 0.05); }
      }
    });
    return out;
  }
  /**
   * מתזמן טקסט על הקלטה. segs: קטעי דיבור; phrases (לא חובה): [{text, t0, t1}] מזיהוי הדיבור — עוגנים לכל משפט.
   * מחזיר [{w, s, e}] בשניות מתחילת ההקלטה.
   */
  V.align = (text, segs, duration, phrases) => {
    const words = V.tokenize(text); if (!words.length) return [];
    const dur = duration || (segs.length ? segs[segs.length - 1].b + 0.2 : words.length * 0.4);
    const ph = (phrases || []).filter(p => p && p.text && V.tokenize(p.text).length && isFinite(p.t0));
    // עוגנים רק אם הטקסט הוא בדיוק מה שזוהה (אם נערך — מתזמנים על כל ההקלטה)
    if (ph.length > 1 && V.tokenize(ph.map(p => p.text).join(' ')).join(' ') === words.join(' ')) {
      const starts = ph.map(p => { // תחילת משפט ≈ תחילת הדיבור שלפני שהטקסט הופיע (הזיהוי מאחר ב~0.5 שנייה)
        const guess = Math.max(0, p.t0 - 0.6), seg = segs.filter(s => s.a <= guess + 0.4).pop();
        return seg ? Math.max(seg.a, Math.min(guess, seg.b)) : guess;
      });
      for (let k = 1; k < starts.length; k++) starts[k] = Math.max(starts[k], starts[k - 1] + 0.2);
      const out = [];
      ph.forEach((p, k) => out.push(...spread(V.tokenize(p.text), segs, starts[k], k < ph.length - 1 ? starts[k + 1] : dur)));
      return out;
    }
    const first = segs.length ? segs[0].a : 0, last = segs.length ? segs[segs.length - 1].b : dur;
    return spread(words, segs, first, last);
  };
  // מתזמן מחדש מילים בתוך שורה אחת (אחרי עריכת טקסט של שורה)
  V.retimeLine = (text, segs, s, e) => spread(V.tokenize(text), segs || [], s, Math.max(s + 0.2, e));

  /* ---------- שורות כתוביות ---------- */
  V.lines = (words, maxWords, maxChars) => {
    const out = []; let cur = null;
    words.forEach((w, k) => {
      const prev = words[k - 1], pause = prev ? w.s - prev.e : 0;
      const chars = cur ? cur.words.reduce((x, y) => x + y.w.length + 1, 0) + w.w.length : 0;
      if (!cur || cur.words.length >= maxWords || chars > maxChars || pause > 0.35 || (prev && /[.!?,:;…]$/.test(prev.w))) { cur = { words: [] }; out.push(cur); }
      cur.words.push({ ...w });
    });
    out.forEach(l => { l.s = l.words[0].s; l.e = l.words[l.words.length - 1].e; });
    return out;
  };
  V.flatten = lines => lines.flatMap(l => l.words);

  /* ---------- מראה הכתוביות לפי אווירת הסרטון ---------- */
  V.LOOKS = {
    pop: { name: 'בולט וקצבי', maxWords: 3, maxChars: 18 },
    soft: { name: 'עדין ואלגנטי', maxWords: 5, maxChars: 28 },
    box: { name: 'בתיבה — קריא במיוחד', maxWords: 4, maxChars: 24 },
    clean: { name: 'נקי ופשוט', maxWords: 5, maxChars: 28 }
  };
  V.lookFor = style => ({ rhythm: 'pop', reveal: 'pop', recipe: 'box', calm: 'soft', cinematic: 'soft' }[style] || 'clean');
  const POS = { bottom: 0.74, middle: 0.56, top: 0.2 };
  const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  // ציור השורה הנוכחית. lines בזמני ההקלטה; tv = הזמן בסרטון פחות נקודת ההתחלה של ההקלטה
  V.draw = (ctx, W, H, lines, tv, lookKey, pos) => {
    // השורה האחרונה שכבר התחילה (כששורה חדשה מתחילה — היא מחליפה את הקודמת)
    let line = null; for (const l of lines) { if (l.s - 0.12 <= tv) line = l; else break; }
    if (!line || tv > line.e + 0.35) return;
    const look = lookKey || 'clean', y0 = H * (POS[pos] || POS.bottom);
    const size = Math.round(W * (look === 'pop' ? 0.074 : look === 'soft' ? 0.066 : look === 'box' ? 0.058 : 0.062));
    ctx.save();
    ctx.font = look === 'soft' ? `500 ${size}px "Frank Ruhl Libre", serif` : `${look === 'pop' ? 800 : 700} ${size}px "Assistant", sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.direction = 'rtl';
    const gap = size * (look === 'pop' ? 0.5 : 0.32), maxW = W * 0.84; // בבולט — רווח שמשאיר מקום לבועה של המילה המודגשת
    const ws = line.words.map(w => ({ ...w, width: ctx.measureText(w.w).width }));
    // שבירה לשתי שורות לכל היותר
    const rows = [[]]; let rw = 0;
    ws.forEach(w => { if (rows[rows.length - 1].length && rw + gap + w.width > maxW && rows.length < 2) { rows.push([]); rw = 0; } rows[rows.length - 1].push(w); rw += (rw ? gap : 0) + w.width; });
    const lh = size * 1.3, appear = easeOut((tv - line.s + 0.12) / 0.18), out = clamp((line.e + 0.35 - tv) / 0.15, 0, 1);
    ctx.globalAlpha = Math.min(appear, out);
    const lift = (1 - appear) * size * 0.25;
    if (look === 'box') { // תיבה חומה מאחורי השורה
      const bw = Math.max(...rows.map(r => r.reduce((x, w) => x + w.width, 0) + gap * (r.length - 1))) + size * 1.2, bh = rows.length * lh + size * 0.55;
      const bx = (W - bw) / 2, by = y0 - bh / 2 + lift, rr = size * 0.45;
      ctx.fillStyle = 'rgba(42,30,19,0.82)'; ctx.beginPath(); ctx.moveTo(bx + rr, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr); ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr); ctx.arcTo(bx, by + bh, bx, by, rr); ctx.arcTo(bx, by, bx + bw, by, rr); ctx.closePath(); ctx.fill();
    }
    rows.forEach((row, ri) => {
      const total = row.reduce((x, w) => x + w.width, 0) + gap * (row.length - 1);
      let x = (W + total) / 2; const y = y0 + (ri - (rows.length - 1) / 2) * lh + lift;
      row.forEach(w => {
        const active = tv >= w.s && tv < Math.max(w.e, w.s + 0.12) + 0.05, spoken = tv >= w.s, k = clamp((tv - w.s) / 0.14, 0, 1);
        const cx = x - w.width / 2; let sc = 1;
        if (active) sc = look === 'pop' ? 1 + 0.16 * (k < 1 ? easeOut(k) : 1) - 0.04 * clamp((tv - w.s - 0.14) / 0.2, 0, 1) : look === 'soft' ? 1.03 : 1.07;
        ctx.save(); ctx.translate(cx, y); ctx.scale(sc, sc); ctx.translate(-cx, -y);
        if (look === 'pop') {
          if (active) { // בועת שמנת מאחורי המילה שנאמרת, טקסט שוקולד — בולט על כל רקע
            const pw = w.width + size * 0.4, ph = size * 1.1, px = x - w.width - size * 0.2, py = y - ph / 2, pr = size * 0.26;
            ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = size * 0.25;
            ctx.fillStyle = '#fff3df'; ctx.beginPath(); ctx.moveTo(px + pr, py); ctx.arcTo(px + pw, py, px + pw, py + ph, pr); ctx.arcTo(px + pw, py + ph, px, py + ph, pr); ctx.arcTo(px, py + ph, px, py, pr); ctx.arcTo(px, py, px + pw, py, pr); ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = '#3b2d1e'; ctx.fillText(w.w, x, y);
          } else {
            ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(30,18,10,0.85)'; ctx.strokeText(w.w, x, y);
            ctx.fillStyle = '#fffaf2'; ctx.fillText(w.w, x, y);
          }
        } else if (look === 'soft') {
          ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = size * 0.4;
          ctx.globalAlpha *= spoken ? 1 : 0.5; ctx.fillStyle = active ? '#f3d7a8' : '#fff6ea'; ctx.fillText(w.w, x, y);
          if (active) { ctx.shadowBlur = 0; ctx.fillStyle = '#e2b77c'; ctx.fillRect(x - w.width * easeOut(k), y + size * 0.55, w.width * easeOut(k), Math.max(2, size * 0.06)); }
        } else if (look === 'box') {
          ctx.fillStyle = active ? '#f2c48d' : spoken ? '#f7ecdc' : 'rgba(247,236,220,0.6)'; ctx.fillText(w.w, x, y);
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = size * 0.35; ctx.fillStyle = active ? '#ffc067' : '#ffffff'; ctx.fillText(w.w, x, y);
        }
        ctx.restore();
        x -= w.width + gap;
      });
    });
    ctx.restore();
  };

  /* ---------- הקלטה (דפדפן) ---------- */
  // מקליטה קול, ובמקביל מזהה דיבור (אם אפשר). onLevel(0..1) למד עוצמה, onText(טקסט עד עכשיו)
  V.record = async ({ onLevel, onText } = {}) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const AC = root.AudioContext || root.webkitAudioContext, ac = new AC(), an = ac.createAnalyser(); an.fftSize = 512;
    ac.createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.fftSize); let raf = 0;
    const meter = () => { an.getByteTimeDomainData(data); let m = 0; for (const v of data) m = Math.max(m, Math.abs(v - 128)); onLevel && onLevel(m / 128); raf = requestAnimationFrame(meter); };
    // זיהוי דיבור: כרום עוצר אחרי שתיקה — מפעילים מחדש. כל משפט נשמר עם הזמן שבו התחיל להופיע
    const phrases = []; let sr = null, active = true, base = 0;
    const t0 = performance.now(), now = () => (performance.now() - t0) / 1000;
    if (SR()) {
      try {
        sr = new (SR())(); sr.lang = 'he-IL'; sr.continuous = true; sr.interimResults = true; sr.maxAlternatives = 1;
        sr.onresult = e => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i], k = base + i, p = phrases[k] || (phrases[k] = { t0: now(), text: '' });
            p.text = (r[0] && r[0].transcript || '').trim(); if (r.isFinal) { p.final = true; p.t1 = now(); }
          }
          onText && onText(phrases.filter(Boolean).map(p => p.text).join(' '));
        };
        sr.onend = () => { if (!active) return; base = phrases.length; try { sr.start(); } catch (e) { } };
        sr.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { active = false; sr = null; } };
        sr.start();
      } catch (e) { sr = null; }
    }
    rec.start(250); meter();
    return {
      recognizing: () => !!sr,
      stop: async () => {
        active = false; cancelAnimationFrame(raf);
        const stopped = new Promise(r => rec.onstop = r); rec.stop();
        if (sr) { const ended = new Promise(r => { const t = setTimeout(r, 1500); sr.onend = () => { clearTimeout(t); r(); }; }); try { sr.stop(); } catch (e) { } await ended; }
        await stopped; stream.getTracks().forEach(t => t.stop()); try { ac.close(); } catch (e) { }
        const blob = new Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] });
        return { blob, phrases: phrases.filter(p => p && p.text) };
      }
    };
  };

  // פענוח קובץ שמע + ניתוח: משך, קטעי דיבור
  V.load = async blobOrUrl => {
    const AC = root.AudioContext || root.webkitAudioContext, ac = new AC();
    try {
      const ab = await (typeof blobOrUrl === 'string' ? (await fetch(blobOrUrl)).arrayBuffer() : blobOrUrl.arrayBuffer());
      const buf = await ac.decodeAudioData(ab);
      return { buffer: buf, duration: r2(buf.duration), segs: V.speechSegments(V.envelope(buf)) };
    } finally { try { ac.close(); } catch (e) { } }
  };

  // תמלול קובץ קיים (כרום חדש בלבד): מנגנים את הקובץ "בשקט" לתוך זיהוי הדיבור, בזמן אמת
  V.transcribe = async (buffer, onProgress, signal = {}) => {
    const Rec = root.SpeechRecognition, ac = new (root.AudioContext || root.webkitAudioContext)();
    const src = ac.createBufferSource(); src.buffer = buffer; const dest = ac.createMediaStreamDestination(); src.connect(dest);
    const sr = new Rec(); sr.lang = 'he-IL'; sr.continuous = true; sr.interimResults = true;
    const phrases = []; let base = 0, done = false; const t0 = () => ac.currentTime - startAt; let startAt = 0;
    sr.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i], k = base + i, p = phrases[k] || (phrases[k] = { t0: t0(), text: '' }); p.text = (r[0] && r[0].transcript || '').trim(); if (r.isFinal) p.t1 = t0(); } };
    const track = dest.stream.getAudioTracks()[0];
    sr.onend = () => { if (!done) { base = phrases.length; try { sr.start(track); } catch (e) { } } };
    sr.start(track);
    startAt = ac.currentTime; src.start();
    await new Promise(res => { const iv = setInterval(() => { onProgress && onProgress(Math.min(1, t0() / buffer.duration)); if (signal.cancelled || t0() >= buffer.duration + 0.8) { clearInterval(iv); res(); } }, 200); });
    done = true; try { src.stop(); } catch (e) { }
    await new Promise(r => { const t = setTimeout(r, 1500); sr.onend = () => { clearTimeout(t); r(); }; try { sr.stop(); } catch (e) { r(); } });
    try { ac.close(); } catch (e) { }
    return phrases.filter(p => p && p.text);
  };

  // מכל מה שיש (טקסט + עוגנים) → שורות כתוביות מוכנות
  V.build = (text, segs, duration, phrases, lookKey) => {
    const L = V.LOOKS[lookKey] || V.LOOKS.clean;
    return V.lines(V.align(text, segs, duration, phrases), L.maxWords, L.maxChars);
  };
})(typeof window !== 'undefined' ? window : globalThis);
