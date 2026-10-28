/* על הגשר — סטודיו סרטונים: מעלים קליפים, בוחרים אורך וסגנון, והאפליקציה עורכת רילס מוכן לאינסטגרם */
(function (root) {
  const A = root.App, U = A.util, P = A.pages = A.pages || {};
  const st = { clips: [], target: 30, style: 'calm', format: '9:16', hq: false, title: '', cta: 'להזמנות — הקישור בפרופיל 🤎', music: 'auto', keepOriginal: null, customMusic: null, result: null, rendering: false };
  let previewAudio = null, signal = null;

  const musicFor = () => {
    if (st.music === 'none') return null;
    if (st.music === 'custom') return st.customMusic ? { url: st.customMusic.url, bpm: null, title: st.customMusic.name } : null;
    const m = st.music === 'auto' ? (A.MUSIC.find(x => x.styles[0] === st.style) || A.MUSIC.find(x => x.styles.includes(st.style)) || A.MUSIC[0]) : A.MUSIC.find(x => x.id === st.music);
    return m ? { url: A.musicUrl(m), bpm: m.bpm, title: m.title } : null;
  };
  const keepOrig = () => st.keepOriginal == null ? A.VIDEO_STYLES[st.style].keepOriginal : st.keepOriginal;
  const fmtDur = s => s >= 60 ? `${Math.floor(s / 60)}:${U.pad(Math.round(s % 60))}` : `${U.round(s, 1)} ש׳`;

  // קריאת אורך הקליפ ותמונה ממוזערת
  function probe(file) {
    return new Promise(res => {
      const url = URL.createObjectURL(file), v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = url;
      const done = (thumb) => res({ id: U.uid(), url, name: file.name, duration: v.duration || 0, thumb, w: v.videoWidth, h: v.videoHeight, hero: false, caption: '' });
      v.onerror = () => res(null);
      v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
      v.onseeked = () => {
        try { const c = document.createElement('canvas'), s = 160 / Math.max(v.videoWidth, v.videoHeight); c.width = v.videoWidth * s; c.height = v.videoHeight * s; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.7)); }
        catch (e) { done(''); }
      };
      setTimeout(() => { if (v.duration) done(''); }, 8000);
    });
  }

  P.video = {
    title: 'סטודיו סרטונים',
    render(main) {
      if (!A.videoSupport()) {
        main.innerHTML = `<div class="card empty"><h3>הדפדפן הזה לא תומך בעריכת וידאו</h3><p>פתחי את האפליקציה בכרום (מחשב/אנדרואיד) או בספארי מעודכן באייפון.</p></div>`; return;
      }
      const total = U.sum(st.clips, c => c.duration), S = A.VIDEO_STYLES[st.style], mu = musicFor();
      const plan = st.clips.length ? A.planEdit(st.clips, { target: st.target, style: st.style, bpm: mu && mu.bpm }) : null;
      main.innerHTML = `
      ${st.result ? resultCard() : ''}
      <div class="grid g2 section" style="align-items:start">
        <div class="stack">
          <div class="card"><div class="card-h"><h3>${A.icon('play')}1. הקליפים שלך</h3><span class="small muted">${st.clips.length ? `${st.clips.length} קליפים · ${fmtDur(total)}` : ''}</span></div>
            <label class="btn" style="width:100%">${A.icon('upload')}הוספת קליפים מהגלריה / צילום<input type="file" accept="video/*" multiple data-files hidden></label>
            <p class="small muted" style="margin:8px 0 0">סדר הקליפים = סדר הסיפור. סמני ⭐ על הקליף של המוצר המוגמר — ממנו נפתח ונסיים.</p>
            <div id="clipList" style="margin-top:10px">${st.clips.map((c, k) => `<div class="list-item" data-k="${k}">
              <div style="width:54px;height:72px;border-radius:8px;overflow:hidden;background:var(--sand);flex:none">${c.thumb ? `<img src="${c.thumb}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}</div>
              <div class="main"><div class="t">${k + 1}. ${fmtDur(c.duration)} ${c.hero ? '<span class="badge brown">⭐ מוצר מוגמר</span>' : ''}</div>
                <input data-cap="${k}" value="${U.esc(c.caption)}" placeholder="${st.style === 'recipe' ? `כיתוב לשלב (ברירת מחדל: שלב ${k + 1})` : 'כיתוב (לא חובה)'}" style="min-height:34px;padding:5px 9px;margin-top:4px"></div>
              <div class="row" style="gap:2px;flex-direction:column">
                <button class="icon-btn" data-hero="${k}" aria-label="סימון כמוצר מוגמר">${A.icon('star')}</button>
                <div class="row" style="gap:0"><button class="icon-btn" data-up="${k}" aria-label="להעלות" ${k ? '' : 'disabled'}>${A.icon('right')}</button><button class="icon-btn" data-down="${k}" aria-label="להוריד" ${k < st.clips.length - 1 ? '' : 'disabled'}>${A.icon('left')}</button></div>
                <button class="icon-btn" data-del="${k}" aria-label="הסרה">${A.icon('trash')}</button></div></div>`).join('')}</div>
          </div>
          <div class="card"><div class="card-h"><h3>${A.icon('star')}טיפים לצילום שעובד</h3></div>
            <ul class="install-steps small" style="line-height:1.9">
              <li><b>מצלמים לאורך</b> (9:16), באור יום מהחלון — לא מתחת לנורה צהובה.</li>
              <li>כל קליפ <b>3–8 שניות</b>, מצלמה יציבה (להשעין על משהו). כמה זוויות: מלמעלה, מהצד, תקריב.</li>
              <li><b>מצלמים את הרגעים הטעימים:</b> חיתוך לתוך העוגה, שוקולד נמס, אבקת סוכר נופלת, בצק נמתח.</li>
              <li>הקליף של <b>המוצר המוגמר</b> הכי חשוב — ממנו נפתח את הסרטון (הוק בשנייה הראשונה) ובו נסיים.</li>
              <li>להשאיר מרווח מהשוליים: אינסטגרם מכסה את החלק העליון והתחתון של המסך.</li>
            </ul></div>
        </div>

        <div class="stack">
          <div class="card"><div class="card-h"><h3>2. אורך וסגנון</h3></div>
            <div class="field"><span>אורך הסרטון</span><div class="row">${[15, 30, 45, 60].map(s => `<button class="btn sm ${st.target === s ? '' : 'ghost'}" data-len="${s}">${s} ש׳</button>`).join('')}
              <input type="number" min="5" max="180" data-f="target" value="${st.target}" aria-label="אורך בשניות" style="width:84px"></div>
              <small>${st.target <= 20 ? 'קצר = יותר צפיות עד הסוף. מעולה לטרנדים.' : st.target <= 35 ? 'האורך הפופולרי לרילס של מתכונים.' : 'ארוך — מתאים להדרכה מלאה.'}</small></div>
            <div class="stack" style="margin-top:12px">${Object.entries(A.VIDEO_STYLES).map(([k, v]) => `<label class="card flat" style="padding:10px 12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start;${st.style === k ? 'border-color:var(--brown);box-shadow:0 0 0 1px var(--brown) inset' : ''}">
              <input type="radio" name="vstyle" value="${k}" ${st.style === k ? 'checked' : ''} style="margin-top:4px"><div><b>${v.name}</b><div class="small muted">${v.desc}</div></div></label>`).join('')}</div>
          </div>
          <div class="card"><div class="card-h"><h3>3. טקסטים ומוזיקה</h3></div>
            <div class="form-grid">
              <label class="field full"><span>כותרת פתיחה (הוק)</span><input data-f="title" value="${U.esc(st.title)}" placeholder="למשל: הבבקה הכי שוקולדית שתאכלי"></label>
              <label class="field full"><span>טקסט בסיום</span><input data-f="cta" value="${U.esc(st.cta)}"></label>
              <label class="field"><span>מוזיקה</span><select data-f="music">${A.opts([['auto', `אוטומטית לפי הסגנון${mu && st.music === 'auto' ? ` (${mu.title})` : ''}`], ...A.MUSIC.map(m => [m.id, `${m.title} · ${m.mood}`]), ['custom', 'קובץ שלי…'], ['none', 'בלי מוזיקה']], st.music)}</select></label>
              <div class="field"><span>&nbsp;</span><div class="row">${mu ? `<button class="btn sm ghost" data-act="preview">${A.icon(previewAudio && !previewAudio.paused ? 'x' : 'play')}${previewAudio && !previewAudio.paused ? 'עצירה' : 'האזנה'}</button>` : ''}
                ${st.music === 'custom' ? `<label class="btn sm soft">${A.icon('upload')}${st.customMusic ? U.esc(st.customMusic.name.slice(0, 18)) : 'בחירת קובץ'}<input type="file" accept="audio/*" data-audio hidden></label>` : ''}</div></div>
              <label class="row full" style="gap:8px"><input type="checkbox" data-f="keepOriginal" ${keepOrig() ? 'checked' : ''}> לשמור את הצליל המקורי מהקליפים (ASMR: חיתוך, ערבוב, קראנץ׳)</label>
              <label class="field"><span>פורמט</span><select data-f="format">${A.opts([['9:16', 'רילס / טיקטוק / סטורי (9:16)'], ['4:5', 'פוסט בפיד (4:5)'], ['1:1', 'ריבוע (1:1)']], st.format)}</select></label>
              <label class="field"><span>איכות</span><select data-f="hq">${A.opts([['0', 'רגילה (720p) — מהיר'], ['1', 'גבוהה (1080p)']], st.hq ? '1' : '0')}</select></label>
            </div>
            <p class="small muted" style="margin:8px 0 0">כל המוזיקה כאן חופשית לשימוש מסחרי (CC0). אפשר גם לייצא בלי מוזיקה ולהוסיף צליל טרנדי באינסטגרם.</p>
          </div>
          <div class="card">
            ${plan && plan.segments.length ? `<p class="small" style="margin:0 0 10px">${plan.segments.length} חיתוכים · ${fmtDur(plan.total)} · ${S.name}${mu ? ' · ' + U.esc(mu.title) : ''}${total < st.target * 0.6 ? ` <span class="badge warn">מעט חומר מצולם — חלק מהקטעים יואטו</span>` : ''}</p>` : ''}
            <button class="btn" style="width:100%;min-height:52px;font-size:1.05rem" data-act="render" ${st.clips.length ? '' : 'disabled'}>${A.icon('play')}עריכת הסרטון</button>
            ${!st.clips.length ? '<p class="small muted" style="margin:8px 0 0;text-align:center">הוסיפי קליפים כדי להתחיל</p>' : ''}
          </div>
        </div>
      </div>`;

      main.onchange = async e => {
        const f = e.target;
        if (f.matches('[data-files]') && f.files.length) {
          A.toast('טוענת קליפים…');
          const added = (await Promise.all([...f.files].map(probe))).filter(Boolean);
          st.clips.push(...added); if (!st.clips.some(c => c.hero) && st.clips.length) st.clips[st.clips.length - 1].hero = true;
          A.refresh(); return;
        }
        if (f.matches('[data-audio]') && f.files[0]) { st.customMusic = { url: URL.createObjectURL(f.files[0]), name: f.files[0].name }; A.refresh(); return; }
        if (f.name === 'vstyle') { st.style = f.value; st.keepOriginal = null; A.refresh(); return; }
        const k = f.dataset.f; if (!k) return;
        if (k === 'target') st.target = Math.max(5, Math.min(180, U.num(f.value) || 30));
        else if (k === 'keepOriginal') st.keepOriginal = f.checked;
        else if (k === 'hq') st.hq = f.value === '1';
        else st[k] = f.value;
        stopPreview(); A.refresh();
      };
      main.oninput = e => { const c = e.target.dataset.cap; if (c != null) st.clips[+c].caption = e.target.value; };
      main.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        const d = b.dataset;
        if (d.len) { st.target = +d.len; A.refresh(); }
        else if (d.hero != null) { st.clips.forEach((c, k) => c.hero = k === +d.hero); A.refresh(); }
        else if (d.up != null) { const k = +d.up; [st.clips[k - 1], st.clips[k]] = [st.clips[k], st.clips[k - 1]]; A.refresh(); }
        else if (d.down != null) { const k = +d.down; [st.clips[k + 1], st.clips[k]] = [st.clips[k], st.clips[k + 1]]; A.refresh(); }
        else if (d.del != null) { const [c] = st.clips.splice(+d.del, 1); URL.revokeObjectURL(c.url); if (c.hero && st.clips.length) st.clips[st.clips.length - 1].hero = true; A.refresh(); }
        else if (d.act === 'preview') { if (previewAudio && !previewAudio.paused) stopPreview(); else { previewAudio = new Audio(musicFor().url); previewAudio.play(); previewAudio.onended = () => A.refresh(); } A.refresh(); }
        else if (d.act === 'render') render();
        else if (d.act === 'download') A.download(`al-hagesher-${U.today()}.${st.result.ext}`, st.result.blob, st.result.mime);
        else if (d.act === 'share') share();
        else if (d.act === 'closeResult') { URL.revokeObjectURL(st.result.url); st.result = null; A.refresh(); }
      };
    }
  };
  function stopPreview() { if (previewAudio) { previewAudio.pause(); previewAudio = null; } }
  function resultCard() {
    const r = st.result;
    return `<div class="card section"><div class="card-h"><h3>${A.icon('check')}הסרטון מוכן</h3><button class="icon-btn" data-act="closeResult" aria-label="סגירה">${A.icon('x')}</button></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <video src="${r.url}" controls playsinline style="width:min(100%,320px);border-radius:14px;background:#000"></video>
        <div class="stack" style="flex:1;min-width:200px">
          <p style="margin:0">${fmtDur(r.duration)} · ${r.width}×${r.height} · ${r.ext.toUpperCase()} · ${U.round(r.blob.size / 1048576, 1)}MB</p>
          ${navigator.canShare ? `<button class="btn" data-act="share">${A.icon('upload')}שיתוף / שמירה לגלריה</button>` : ''}
          <button class="btn ghost" data-act="download">${A.icon('download')}הורדת הקובץ</button>
          ${r.ext === 'webm' ? '<p class="small muted" style="margin:0">הדפדפן הזה שומר בפורמט WebM. לאינסטגרם עדיף לערוך מהטלפון (נשמר כ־MP4).</p>' : ''}
          <p class="small muted" style="margin:0">לא אהבת? שני סגנון/מוזיקה/סדר קליפים ולחצי שוב "עריכה".</p>
        </div></div></div>`;
  }
  async function share() {
    const r = st.result, file = new File([r.blob], `al-hagesher.${r.ext}`, { type: r.mime });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'על הגשר' }); else A.download(file.name, r.blob, r.mime); }
    catch (e) { if (e.name !== 'AbortError') A.download(file.name, r.blob, r.mime); }
  }
  async function render() {
    stopPreview();
    // חייבים ליצור ולהפעיל את האודיו ברגע הלחיצה — אחרת באייפון הסרטון יוצא שקט
    let audioContext = null; try { audioContext = new (root.AudioContext || root.webkitAudioContext)(); audioContext.resume(); } catch (e) { }
    const mu = musicFor(), S = A.VIDEO_STYLES[st.style];
    const plan = A.planEdit(st.clips, { target: st.target, style: st.style, bpm: mu && mu.bpm });
    signal = { cancelled: false };
    A.modal({
      title: 'עורכת את הסרטון…', size: 'narrow',
      body: `<div style="text-align:center"><canvas id="vcanvas" style="width:min(100%,260px);border-radius:14px;background:#2e190c"></canvas>
        <div class="time-bar" style="height:8px;margin:14px 0 6px"><i id="vprog" style="width:0;background:var(--caramel)"></i></div>
        <div class="small muted" id="vtxt">מכינה…</div><p class="small muted">העריכה נעשית בזמן אמת — סרטון של ${st.target} שניות לוקח בערך ${st.target} שניות. השאירי את המסך פתוח.</p></div>`,
      foot: `<button class="btn ghost" data-cancel>ביטול</button>`,
      onMount(w) { w.querySelector('[data-cancel]').onclick = () => { signal.cancelled = true; A.closeModal(); }; },
      onClose: () => { if (!st.result || st.rendering) signal.cancelled = true; }
    });
    const canvas = document.getElementById('vcanvas'); st.rendering = true;
    try {
      const out = await A.renderVideo(canvas, st.clips, plan, {
        format: st.format, hq: st.hq, title: st.title, cta: st.cta, sub: A.state.settings.businessName || 'על הגשר',
        audioContext, musicUrl: mu && mu.url, musicVol: keepOrig() ? Math.min(S.musicVol, 0.45) : S.musicVol, keepOriginal: keepOrig()
      }, p => { const pr = document.getElementById('vprog'), tx = document.getElementById('vtxt'); if (pr) pr.style.width = (p * 100) + '%'; if (tx) tx.textContent = `${Math.round(p * 100)}%`; }, signal);
      st.rendering = false;
      if (!out) { A.toast('העריכה בוטלה'); return; }
      if (st.result) URL.revokeObjectURL(st.result.url);
      st.result = Object.assign(out, { url: URL.createObjectURL(out.blob), duration: plan.total });
      A.closeModal(); A.refresh(); root.scrollTo({ top: 0, behavior: 'smooth' }); A.toast('הסרטון מוכן 🎬');
    } catch (err) {
      st.rendering = false; console.error(err); A.closeModal(); A.toast('העריכה נכשלה: ' + (err.message || 'שגיאה') + '. נסי קליפים קצרים יותר או איכות רגילה.');
    }
  }
})(window);
