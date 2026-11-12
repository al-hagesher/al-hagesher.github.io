/* על הגשר — מרנדר סרטונים בדפדפן: מנגן את הקטעים לפי תוכנית העריכה, מצייר על קנבס (חיתוך, זום, צבע, כיתובים,
   מסך סיום), מערבב מוזיקה וצליל מקורי, ומקליט לקובץ MP4 (או WebM בדפדפנים שלא תומכים). הכל במכשיר — שום סרטון לא עולה לשרת. */
(function (root) {
  const A = root.App;
  const SIZES = { '9:16': [720, 1280], '4:5': [864, 1080], '1:1': [960, 960] };
  const HQ = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080] };
  const pickMime = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find(m => root.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  A.videoSupport = () => !!(root.MediaRecorder && HTMLCanvasElement.prototype.captureStream && pickMime());

  const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const once = (el, ev) => new Promise(res => el.addEventListener(ev, res, { once: true }));
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  async function seek(v, t) {
    if (Math.abs(v.currentTime - t) < 0.02 && v.readyState >= 2) return;
    const p = once(v, 'seeked'); v.currentTime = t; await Promise.race([p, new Promise(r => setTimeout(r, 2500))]);
  }
  async function makeVideo(url) {
    const v = document.createElement('video');
    v.src = url; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.muted = true; v.crossOrigin = 'anonymous';
    // חייב להיות "גלוי" (בגודל אמיתי) — אחרת הדפדפן עוצר סרטונים נסתרים כדי לחסוך סוללה. הוא יושב מאחורי התוכן.
    v.style.cssText = 'position:fixed;left:0;bottom:0;width:180px;height:320px;object-fit:cover;z-index:-1;pointer-events:none';
    document.body.appendChild(v);
    if (v.readyState < 1) await Promise.race([once(v, 'loadedmetadata'), new Promise(r => setTimeout(r, 6000))]);
    return v;
  }
  // ציור "כיסוי" (כמו object-fit: cover) עם זום ומרכז
  // (גם לתמונות: pan = תנועה עדינה לצד, p = התקדמות 0..1)
  function drawCover(ctx, v, W, H, zoom, pan, p) {
    const vw = v.videoWidth || v.naturalWidth || W, vh = v.videoHeight || v.naturalHeight || H, s = Math.max(W / vw, H / vh) * zoom;
    const dw = vw * s, dh = vh * s, dx = pan ? pan * (dw - W) * 0.5 * ((p || 0) - 0.5) : 0;
    ctx.drawImage(v, (W - dw) / 2 + dx, (H - dh) / 2, dw, dh);
  }
  const ready = el => el && (el.tagName === 'IMG' ? el.complete && el.naturalWidth > 0 : el.readyState >= 2);
  function grade(ctx, W, H, kind) {
    ctx.save();
    // גרדינג עדין — בלי הבזק כתום, רק חימום/קירור מתון
    if (kind === 'warm') { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(210,180,140,0.08)'; ctx.fillRect(0, 0, W, H); }
    if (kind === 'vivid') { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(200,170,130,0.05)'; ctx.fillRect(0, 0, W, H); }
    if (kind === 'film') { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(180,170,150,0.1)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    // וינייטה עדינה בחום-שוקולד ולא כתום
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, kind === 'film' ? 'rgba(15,10,6,0.4)' : 'rgba(15,10,6,0.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines.slice(0, 3);
  }
  // כותרת פתיחה (באזור הבטוח: מתחת ל־14% העליונים)
  function drawTitle(ctx, W, H, text, alpha, font) {
    if (!text || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = Math.round(W * (font === 'serif' ? 0.095 : 0.085));
    ctx.font = font === 'serif' ? `500 ${size}px "Frank Ruhl Libre", serif` : `800 ${size}px "Assistant", sans-serif`;
    const lines = wrap(ctx, text, W * 0.82), lh = size * 1.18, y0 = H * 0.3 - (lines.length - 1) * lh / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.35; ctx.fillStyle = '#fffaf2';
    lines.forEach((l, k) => ctx.fillText(l, W / 2, y0 + k * lh));
    ctx.restore();
  }
  // כיתוב שלב — "גלולה" חומה מעל אזור הכיתובים של אינסטגרם
  function drawCaption(ctx, W, H, text, alpha) {
    if (!text || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = Math.round(W * 0.058); ctx.font = `700 ${size}px "Assistant", sans-serif`;
    const lines = wrap(ctx, text, W * 0.78), lh = size * 1.25, w = Math.min(W * 0.86, Math.max(...lines.map(l => ctx.measureText(l).width)) + size * 1.4), h = lines.length * lh + size * 0.7;
    const x = (W - w) / 2, y = H * 0.6 - h / 2, r = size * 0.6;
    ctx.fillStyle = 'rgba(42,30,19,0.85)'; ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f7ecdc'; lines.forEach((l, k) => ctx.fillText(l, W / 2, y + size * 0.35 + lh / 2 + k * lh));
    ctx.restore();
  }
  // מסך סיום ממותג: רקע חום, לוגו שמנת, קריאה לפעולה
  function drawEnd(ctx, W, H, logo, cta, sub, t) {
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#503c28'); g.addColorStop(0.55, '#3b2d1e'); g.addColorStop(1, '#26180e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const a = ease(Math.min(1, t / 0.6));
    ctx.save(); ctx.globalAlpha = a;
    if (logo) { const lw = W * 0.56, lh = lw * logo.height / logo.width; ctx.drawImage(logo, (W - lw) / 2, H * 0.4 - lh / 2 + (1 - a) * 12, lw, lh); }
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f4e8d8';
    const size = Math.round(W * 0.055); ctx.font = `600 ${size}px "Assistant", sans-serif`;
    wrap(ctx, cta, W * 0.84).forEach((l, k) => ctx.fillText(l, W / 2, H * 0.62 + k * size * 1.3));
    if (sub) { ctx.globalAlpha = a * 0.75; ctx.font = `400 ${Math.round(size * 0.72)}px "Assistant", sans-serif`; ctx.fillText(sub, W / 2, H * 0.62 + size * 2.9); }
    ctx.restore();
  }

  /**
   * רינדור. clips: [{url}], plan: מ-planEdit, opts: {format, hq, title, cta, sub, musicUrl, musicVol, keepOriginal}
   * מחזיר {blob, mime, ext}. onFrame(progress 0..1). signal.cancelled = true עוצר.
   */
  A.renderVideo = async (canvas, clips, plan, opts, onFrame, signal = {}) => {
    const [W, H] = (opts.hq ? HQ : SIZES)[opts.format || '9:16'];
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });
    const S = plan.styleDef || {};
    try { await Promise.all([document.fonts.load(`500 60px "Frank Ruhl Libre"`), document.fonts.load(`800 60px "Assistant"`), document.fonts.load(`600 40px "Assistant"`)]); } catch (e) { }
    const logo = await loadImg('assets/logo-cream.png');
    // קליפים: נגן נפרד לכל קליפ (נטען מראש) — מעברים חלקים בלי מסך שחור
    // שני נגנים לכל קליפ: בזמן שאחד מנגן, השני כבר מחכה על הקטע הבא — חיתוך נקי בלי המתנה לחיפוש
    const used = new Set(plan.segments.filter(s => s.photo == null).map(s => s.clip));
    const pairs = await Promise.all(clips.map((c, k) => used.has(k) ? Promise.all([makeVideo(c.url), makeVideo(c.url)]) : Promise.resolve(null)));
    const photos = await Promise.all((opts.photos || []).map(p => loadImg(p.url)));
    const uses = {}; const segEl = plan.segments.map(s => { if (s.photo != null) return photos[s.photo] || null; uses[s.clip] = (uses[s.clip] || 0) + 1; return pairs[s.clip][(uses[s.clip] - 1) % 2]; });
    const vids = pairs.flat().filter(Boolean);
    // אודיו
    const AC = root.AudioContext || root.webkitAudioContext, ac = opts.audioContext || new AC();
    if (ac.state === 'suspended') try { await Promise.race([ac.resume(), new Promise(r => setTimeout(r, 600))]); } catch (e) { } // בלי לחיצה הדפדפן לא מפעיל אודיו — לא נתקעים
    const dest = ac.createMediaStreamDestination();
    // כל הצלילים עוברים דרך out: להקלטה, ובתצוגה מקדימה — גם לרמקולים
    const out = ac.createGain(); out.connect(dest); if (opts.preview) out.connect(ac.destination);
    // ערוץ שקט קבוע: בלי זה, כשאין מוזיקה וצליל מקורי, הקלטת ה-MP4 נעצרת אחרי שנייה וחצי
    const silent = ac.createConstantSource ? ac.createConstantSource() : ac.createOscillator(); const sg = ac.createGain(); sg.gain.value = 0.00001;
    silent.connect(sg).connect(dest); silent.start();
    let musicSrc = null, musicGain = null, voiceSrc = null;
    if (opts.musicUrl) {
      try {
        const buf = await ac.decodeAudioData(await (await fetch(opts.musicUrl)).arrayBuffer());
        musicSrc = ac.createBufferSource(); musicSrc.buffer = buf; musicSrc.loop = buf.duration < plan.total;
        musicGain = ac.createGain(); musicGain.gain.value = 0; musicSrc.connect(musicGain).connect(out);
      } catch (e) { console.warn('music', e); }
    }
    // קריינות / הקלטה שלך
    const vo = opts.voice;
    if (vo && vo.url) {
      try {
        const buf = await ac.decodeAudioData(await (await fetch(vo.url)).arrayBuffer());
        voiceSrc = ac.createBufferSource(); voiceSrc.buffer = buf; const vg = ac.createGain(); vg.gain.value = vo.vol ?? 1; voiceSrc.connect(vg).connect(out);
      } catch (e) { console.warn('voice', e); }
    }
    const origGain = new Map();
    if (opts.keepOriginal) vids.forEach(v => {
      try { v.muted = false; const g = ac.createGain(); g.gain.value = 0; ac.createMediaElementSource(v).connect(g).connect(out); origGain.set(v, g); } catch (e) { v.muted = true; }
    });
    const mime = pickMime();
    const rec = opts.preview ? null : new MediaRecorder(new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]), { mimeType: mime, videoBitsPerSecond: opts.hq ? 10e6 : 6e6, audioBitsPerSecond: 160000 });
    const chunks = []; if (rec) rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = rec ? once(rec, 'stop') : Promise.resolve();

    // לוח זמנים מוחלט
    const segs = plan.segments; let t0 = 0; const times = segs.map(s => { const r = { from: t0, to: t0 + s.dur }; t0 += s.dur; return r; });
    const total = plan.total, endFrom = t0;
    const isVid = el => el && el.tagName === 'VIDEO';
    if (isVid(segEl[0])) await seek(segEl[0], segs[0].start);
    if (isVid(segEl[1])) await seek(segEl[1], segs[1].start);
    // קטע ראשון מוכן — מתחילים
    if (rec) rec.start(250);
    const startAt = performance.now(); // לרישום בלבד
    const mv = opts.musicVol ?? 0.8, t0a = ac.currentTime;
    if (musicSrc) {
      musicSrc.start(); musicGain.gain.setValueAtTime(0, t0a); musicGain.gain.linearRampToValueAtTime(mv, t0a + 0.6);
      // "דאקינג": כשמדברים — המוזיקה יורדת, בהפסקות — חוזרת. לפי קטעי הדיבור שזוהו בהקלטה
      if (vo && vo.segs && voiceSrc) vo.segs.forEach(sg2 => {
        const a = t0a + (vo.offset || 0) + sg2.a, b = t0a + (vo.offset || 0) + sg2.b; if (a < t0a + 0.6) return;
        musicGain.gain.setTargetAtTime(mv * 0.28, a - 0.12, 0.06); musicGain.gain.setTargetAtTime(mv, b + 0.25, 0.25);
      });
    }
    if (voiceSrc) voiceSrc.start(t0a + Math.max(0, vo.offset || 0));

    let cur = -1, playing = null;
    const log = A._vlog = [];
    const startSeg = async i => {
      const s = segs[i], v = segEl[i];
      if (!isVid(v)) { // תמונה: עוצרים את הנגן הקודם אחרי המעבר
        if (playing) { const pv = playing; const g = origGain.get(pv); if (g) g.gain.value = 0; setTimeout(() => { if (pv !== playing) pv.pause(); }, (s.transDur || 0) * 1000 + 50); }
        playing = null; return;
      }
      log.push({ i, clip: s.clip, at: +((performance.now() - startAt) / 1000).toFixed(2), rs: v.readyState, ct: +v.currentTime.toFixed(2), want: s.start, paused: v.paused });
      if (playing && playing !== v) { const pv = playing; const g = origGain.get(pv); if (g) g.gain.value = 0; setTimeout(() => { if (pv !== playing) pv.pause(); }, (s.trans === 'fade' ? s.transDur : 0) * 1000 + 50); }
      if (Math.abs(v.currentTime - s.start) > 0.08) await seek(v, s.start);
      v.playbackRate = s.speed;
      // צליל מקורי: חלש כשהמהירות שונה, וחלש מאוד כשיש קריינות
      const og = origGain.get(v); if (og) og.gain.value = (s.speed > 1.05 || s.speed < 0.95 ? 0.25 : 0.9) * (voiceSrc ? 0.2 : 1);
      try { await v.play(); } catch (e) { v.muted = true; try { await v.play(); } catch (e2) { } }
      playing = v;
      // מכינים מראש את הקטע הבא בנגן שלו
      const n = segs[i + 1], nv = segEl[i + 1]; if (n && isVid(nv) && nv !== v && Math.abs(nv.currentTime - n.start) > 0.05) { setTimeout(() => { if (nv !== playing) { nv.pause(); nv.currentTime = n.start; } }, (s.trans === 'fade' ? s.transDur : 0) * 1000 + 120); }
    };

    // שעון לפי פריימים: אם המכשיר נתקע לרגע, ציר הזמן מחכה ולא מדלג על תוכן
    let t = 0, last = performance.now(), paused = false, lastAc = ac.currentTime, lastAcWall = performance.now();
    const onVis = () => {
      if (document.visibilityState === 'hidden' && !paused) { paused = true; try { rec && rec.pause(); } catch (e) { } if (playing) playing.pause(); try { ac.suspend(); } catch (e) { } }
      else if (document.visibilityState === 'visible' && paused) { paused = false; last = performance.now(); try { rec && rec.resume(); } catch (e) { } try { ac.resume(); } catch (e) { } if (playing) playing.play().catch(() => { }); }
    };
    document.addEventListener('visibilitychange', onVis);
    await new Promise(resolve => {
      const frame = async () => {
        if (signal.cancelled) { resolve(); return; }
        const now = performance.now();
        // שעון ראשי = שעון האודיו (זה גם הזמן של הקובץ המוקלט): קול, כתוביות, מוזיקה ותמונה נשארים מסונכרנים גם כשהמכשיר נתקע לרגע.
        // אם האודיו לא רץ (נחסם בדפדפן) — שעון לפי פריימים, כמו קודם
        const acT = ac.currentTime; if (acT > lastAc + 1e-4) { lastAc = acT; lastAcWall = now; }
        if (!paused) t = ac.state === 'running' && now - lastAcWall < 600 ? Math.max(t, acT - t0a) : t + Math.min(0.25, (now - last) / 1000);
        last = now;
        if (t >= total) { resolve(); return; }
        let i = times.findIndex(x => t < x.to); if (i < 0) i = segs.length;
        if (i !== cur && i < segs.length) { cur = i; startSeg(i); }
        if (i >= segs.length) { if (playing) { playing.pause(); playing = null; } drawEnd(ctx, W, H, logo, opts.cta, opts.sub, t - endFrom); }
        else {
          const s = segs[i], tm = times[i], p = (t - tm.from) / s.dur, v = segEl[i];
          const zoom = s.zoomFrom + (s.zoomTo - s.zoomFrom) * ease(Math.min(1, Math.max(0, p)));
          let z = zoom; if (s.trans === 'punch' && t - tm.from < 0.2) z *= 1 + 0.08 * (1 - (t - tm.from) / 0.2);
          if (ready(v)) drawCover(ctx, v, W, H, z, s.pan, p); else if (log.length < 300) log.push({ stall: i, at: +t.toFixed(2), rs: v && v.readyState });
          // מעבר דהייה מהקטע הקודם
          if (s.trans === 'fade' && i > 0 && t - tm.from < s.transDur) {
            const pv = segEl[i - 1]; if (pv !== v && ready(pv)) { ctx.save(); ctx.globalAlpha = 1 - (t - tm.from) / s.transDur; drawCover(ctx, pv, W, H, segs[i - 1].zoomTo, segs[i - 1].pan, 1); ctx.restore(); }
          }
          grade(ctx, W, H, S.grade);
          // הבזק קצר ועדין — לא "פוצץ" בכתום. ~0.1 שנייה של רקע שוקולדי בהיר חצי-שקוף.
          if (s.trans === 'flash' && t - tm.from < 0.1) { ctx.fillStyle = `rgba(240,232,220,${0.45 * (1 - (t - tm.from) / 0.1)})`; ctx.fillRect(0, 0, W, H); }
          // כותרת בשניות הראשונות
          if (t < 3) drawTitle(ctx, W, H, opts.title, t < 0.25 ? t / 0.25 : t > 2.5 ? (3 - t) / 0.5 : 1, S.text);
          // כיתוב שלב
          if (s.caption) { const ct = t - tm.from, d = Math.min(s.dur, 2.2); drawCaption(ctx, W, H, s.caption, ct < 0.2 ? ct / 0.2 : ct > d - 0.25 ? Math.max(0, (d - ct) / 0.25) : 1); }
          // מעבר רך אל מסך הסיום
          if (i === segs.length - 1 && plan.endCard && tm.to - t < 0.35) { ctx.fillStyle = `rgba(38,24,14,${1 - (tm.to - t) / 0.35})`; ctx.fillRect(0, 0, W, H); }
        }
        // כתוביות מההקלטה — מעל הכל, גם על מסך הסיום אם עוד מדברים
        const cap = opts.captions; if (cap && cap.lines && cap.lines.length && A.voice) A.voice.draw(ctx, W, H, cap.lines, t - (cap.offset || 0), cap.look, cap.pos);
        if (musicGain && t > total - 1.6 && !musicGain._fading) { musicGain._fading = true; const n = ac.currentTime; musicGain.gain.cancelScheduledValues(n); musicGain.gain.setValueAtTime(musicGain.gain.value, n); musicGain.gain.linearRampToValueAtTime(0, n + Math.max(0.3, total - t)); }
        onFrame && onFrame(Math.min(1, t / total));
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    document.removeEventListener('visibilitychange', onVis);
    if (rec) rec.stop(); await stopped;
    try { musicSrc && musicSrc.stop(); voiceSrc && voiceSrc.stop(); silent.stop(); } catch (e) { }
    vids.forEach(v => { v.pause(); v.remove(); });
    try { ac.close(); } catch (e) { }
    if (signal.cancelled || !rec) return null;
    const type = mime.split(';')[0];
    return { blob: new Blob(chunks, { type }), mime: type, ext: type.includes('mp4') ? 'mp4' : 'webm', width: W, height: H };
  };
})(window);
