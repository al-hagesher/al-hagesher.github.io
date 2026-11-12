/* על הגשר — סטודיו סרטונים: מעלים קליפים (ותמונות מוגמרות), מקליטים קריינות, בוחרים אורך וסגנון —
   והאפליקציה עורכת רילס מוכן לאינסטגרם, עם כתוביות מתוזמנות למילה. אחרי העריכה אפשר לתקן הכל ידנית. */
(function (root) {
  const A = root.App, U = A.util, P = A.pages = A.pages || {}, V = A.voice;
  const st = {
    clips: [], photos: [], voice: null, edit: null,
    target: 30, style: 'calm', format: '9:16', hq: false, title: '', description: '', cta: 'להזמנות — הקישור בפרופיל 🤎',
    music: 'auto', keepOriginal: null, customMusic: null, result: null, rendering: false, autoSpeed: true
  };
  let previewAudio = null, signal = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  const r1 = v => Math.round(v * 10) / 10;
  const fmtDur = s => s >= 60 ? `${Math.floor(s / 60)}:${U.pad(Math.round(s % 60))}` : `${U.round(s, 1)} ש׳`;
  const fmtT = s => `${Math.floor(s / 60)}:${String((s % 60).toFixed(1)).padStart(4, '0')}`;

  // ---------- קריינות ----------
  const lookKey = () => !st.voice || st.voice.look === 'auto' ? V.lookFor(st.style) : st.voice.look;
  const voiceEnd = () => st.voice ? (+st.voice.offset || 0) + st.voice.duration : 0;
  // הסרטון לא נחתך באמצע המשפט: אם ההקלטה ארוכה מהסרטון — הסרטון מתארך
  const effTarget = () => st.voice && voiceEnd() + 1.2 > st.target ? Math.min(180, Math.ceil(voiceEnd() + 1.8)) : st.target;
  const regroup = () => { if (!st.voice || !st.voice.lines.length) return; const L = V.LOOKS[lookKey()]; st.voice.lines = V.lines(V.flatten(st.voice.lines), L.maxWords, L.maxChars); };

  const musicFor = () => {
    if (st.music === 'none') return null;
    if (st.music === 'custom') return st.customMusic ? { url: st.customMusic.url, bpm: null, title: st.customMusic.name } : null;
    const m = st.music === 'auto' ? (A.MUSIC.find(x => x.styles[0] === st.style) || A.MUSIC.find(x => x.styles.includes(st.style)) || A.MUSIC[0]) : A.MUSIC.find(x => x.id === st.music);
    return m ? { url: A.musicUrl(m), bpm: m.bpm, title: m.title } : null;
  };
  const keepOrig = () => st.keepOriginal == null ? A.VIDEO_STYLES[st.style].keepOriginal : st.keepOriginal;
  const planOpts = mu => ({ target: effTarget(), style: st.style, bpm: mu && mu.bpm, description: st.description, autoSpeed: st.autoSpeed, photos: st.photos.length });
  const autoPlan = mu => (st.clips.length || st.photos.length) ? A.planEdit(st.clips, planOpts(mu)) : null;
  const currentPlan = mu => st.edit || autoPlan(mu);
  const planTotal = p => U.round(p.segments.reduce((s, x) => s + x.dur, 0) + (+p.endCard || 0), 3);
  // הקליפים/התמונות השתנו — עריכה ידנית כבר לא מתאימה להם
  const invalidate = () => { if (st.edit) { st.edit = null; A.toast('העריכה הידנית אופסה, כי הקליפים או התמונות השתנו'); } };

  // ציר הזמן של קליף: מה העורכת הבינה (צבעים) ואיזה קטעים נכנסו לסרטון (מסגרת)
  const KIND = { action: 'פעולה', peak: 'רגע שיא → הילוך איטי', steady: 'תהליך ארוך → מואץ', still: 'פריים יציב ויפה', idle: 'זמן מת → נחתך', bad: 'חשוך / מטושטש / רועד → נחתך' };
  const timeline = (c, k, plan) => {
    const an = c.analysis; if (!an || !an.moments || !(an.duration > 0)) return '';
    const D = an.duration, pct = x => Math.max(0, Math.min(100, x / D * 100));
    const used = plan ? plan.segments.filter(s => s.photo == null && s.clip === k) : [];
    return `<div class="vt" dir="ltr" aria-hidden="true"><div class="vt-bar">${an.moments.map(m => `<i class="vt-${m.kind}" style="width:${pct(m.b - m.a)}%" title="${KIND[m.kind] || ''} · ${U.round(m.a, 1)}–${U.round(m.b, 1)} ש׳"></i>`).join('')}</div>
      ${used.map(s => `<b class="vt-use ${s.speed < 0.95 ? 'slow' : s.speed > 1.45 ? 'fast' : ''}" style="left:${pct(s.start)}%;width:${Math.max(1.5, pct(s.dur * s.speed))}%"></b>`).join('')}</div>`;
  };
  const clipChips = an => {
    const sm = an && (an.summary || (A.summarizeAnalysis && A.summarizeAnalysis(an))); if (!sm) return [];
    return [sm.cut >= 0.5 && `✂️ ${U.round(sm.cut, 1)} ש׳ נחתכים`, sm.slow && `🐢 ${sm.slow === 1 ? 'רגע שיא' : sm.slow + ' רגעי שיא'} → הילוך איטי`, sm.fast >= 2 && `⏩ ${U.round(sm.fast, 1)} ש׳ תהליך → מואץ`, an.tags.dark && 'חשוך', an.tags.shaky && 'הרבה רעידות'].filter(Boolean);
  };
  const segLabel = s => s.photo != null ? `תמונה ${s.photo + 1}` : s.role === 'hook' ? 'פתיחה' : s.role === 'reveal' ? 'חשיפה' : `קליף ${s.clip + 1}`;

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

  /* ---------- כרטיסים ---------- */
  const clipsCard = (plan, total) => `<div class="card"><div class="card-h"><h3>${A.icon('play')}1. הקליפים שלך</h3><span class="small muted">${st.clips.length ? `${st.clips.length} קליפים · ${fmtDur(total)}` : ''}</span></div>
      <label class="btn" style="width:100%">${A.icon('upload')}הוספת קליפים מהגלריה / צילום<input type="file" accept="video/*" multiple data-files hidden></label>
      <p class="small muted" style="margin:8px 0 0">סדר הקליפים = סדר הסיפור. סמני ⭐ על הקליף של המוצר המוגמר — ממנו נפתח ונסיים.</p>
      ${st.analyzing ? `<div class="small muted" style="margin:8px 0;padding:8px 10px;background:var(--sand-2);border-radius:8px" data-analyzer>צופה בקליפים — מזהה פעולה, רגעי שיא, תהליכים ארוכים, זמן מת ורעידות</div>` : ''}
      <div id="clipList" style="margin-top:10px">${st.clips.map((c, k) => {
        const an = c.analysis, tags = clipChips(an);
        return `<div class="list-item" data-k="${k}">
        <div style="width:54px;height:72px;border-radius:8px;overflow:hidden;background:var(--sand);flex:none;position:relative">${c.thumb ? `<img src="${c.thumb}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}${an ? `<span style="position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,.6);color:#fff;font-size:.65rem;padding:1px 4px;border-radius:4px">${Math.round(an.avgQuality * 100)}</span>` : ''}</div>
        <div class="main"><div class="t">${k + 1}. ${fmtDur(c.duration)} ${c.hero ? '<span class="badge brown">⭐ מוצר מוגמר</span>' : ''}</div>
          ${tags.length ? `<div class="small muted" style="margin-top:2px">${tags.map(t => `<span class="chip" style="font-size:.72rem;padding:1px 6px;margin:0 2px">${t}</span>`).join('')}</div>` : ''}
          ${timeline(c, k, plan)}
          <input data-cap="${k}" value="${U.esc(c.caption)}" placeholder="${st.style === 'recipe' ? `כיתוב לשלב (ברירת מחדל: שלב ${k + 1})` : 'כיתוב (לא חובה)'}" style="min-height:34px;padding:5px 9px;margin-top:4px"></div>
        <div class="row" style="gap:2px;flex-direction:column">
          <button class="icon-btn" data-hero="${k}" aria-label="סימון כמוצר מוגמר">${A.icon('star')}</button>
          <div class="row" style="gap:0"><button class="icon-btn" data-up="${k}" aria-label="להעלות" ${k ? '' : 'disabled'}>${A.icon('right')}</button><button class="icon-btn" data-down="${k}" aria-label="להוריד" ${k < st.clips.length - 1 ? '' : 'disabled'}>${A.icon('left')}</button></div>
          <button class="icon-btn" data-del="${k}" aria-label="הסרה">${A.icon('trash')}</button></div></div>`;
      }).join('')}</div>
      ${st.clips.some(c => c.analysis && c.analysis.moments) ? `<div class="vt-legend small">${['action', 'peak', 'steady', 'still', 'idle', 'bad'].map(k => `<span><i class="vt-${k}"></i>${KIND[k]}</span>`).join('')}<span><i class="vt-sw-use"></i>נכנס לסרטון</span></div>` : ''}
    </div>`;

  const photosCard = () => `<div class="card"><div class="card-h"><h3>${A.icon('image')}תמונות מוגמרות לסיום</h3><span class="small muted">${st.photos.length || ''}</span></div>
      <label class="btn soft" style="width:100%">${A.icon('upload')}הוספת תמונות<input type="file" accept="image/*" multiple data-photos hidden></label>
      <p class="small muted" style="margin:8px 0 0">מופיעות בסוף, אחרי חשיפת המוצר — עם זום ותנועה עדינה. מעולה לתמונות מגש מוכן, אריזה או ביס.</p>
      ${st.photos.length ? `<div class="vp-photos">${st.photos.map((p, k) => `<div class="vp-ph"><img src="${p.url}" alt=""><span>${k + 1}</span>
        <div class="vp-ph-b"><button class="icon-btn" data-pup="${k}" aria-label="קודם" ${k ? '' : 'disabled'}>${A.icon('right')}</button><button class="icon-btn" data-pdel="${k}" aria-label="הסרה">${A.icon('trash')}</button><button class="icon-btn" data-pdown="${k}" aria-label="אחר כך" ${k < st.photos.length - 1 ? '' : 'disabled'}>${A.icon('left')}</button></div></div>`).join('')}</div>` : ''}
    </div>`;

  const voiceCard = () => {
    const v = st.voice;
    if (!v) return `<div class="card"><div class="card-h"><h3>🎙️ קריינות וכתוביות</h3></div>
      <div class="row">${V.canRecord() ? `<button class="btn" data-act="rec">🎙️ הקלטה עכשיו</button>` : ''}<label class="btn soft">${A.icon('upload')}קובץ שמע / סרטון עם דיבור<input type="file" accept="audio/*,video/*" data-voicefile hidden></label></div>
      <p class="small muted" style="margin:8px 0 0">מספרים על המוצר במילים שלך — והקול נכנס לסרטון, עם כתוביות שהמילה שנאמרת בהן מודגשת. ${V.canRecognize() ? 'בזמן ההקלטה המערכת כותבת את מה שאמרת, ואת כל זה אפשר לתקן אחר כך.' : 'אחרי ההקלטה כותבים או מדביקים את הטקסט, והתזמון של כל מילה מחושב לפי הקול.'}</p></div>`;
    const look = lookKey(), nWords = V.flatten(v.lines).length;
    return `<div class="card"><div class="card-h"><h3>🎙️ קריינות וכתוביות</h3><button class="icon-btn" data-act="voDel" aria-label="הסרת הקריינות">${A.icon('trash')}</button></div>
      <audio controls src="${v.url}" style="width:100%"></audio>
      <div class="small muted" style="margin:4px 0 10px">${U.esc(v.name)} · ${fmtDur(v.duration)}${voiceEnd() + 1.2 > st.target ? ` · <b>הסרטון יתארך ל־${effTarget()} ש׳ כדי שכל ההקלטה תיכנס</b>` : ''}</div>
      <div class="form-grid">
        <label class="field"><span>מתחילה בשנייה</span><input type="number" min="0" max="60" step="0.1" data-vo="offset" value="${r1(+v.offset || 0)}"></label>
        <label class="field"><span>עוצמת הקול</span><input type="range" min="0.3" max="1.6" step="0.05" data-vo="vol" value="${v.vol}"></label>
      </div>
      <div class="vo-caps">
        ${nWords ? `<div class="row" style="justify-content:space-between;align-items:center;gap:8px"><label class="switch-row"><span class="switch"><input type="checkbox" data-vo="show" ${v.show ? 'checked' : ''}><i></i></span><b>כתוביות בסרטון</b></label><span class="small muted">${v.lines.length} שורות · ${nWords} מילים</span></div>
          <div class="form-grid" style="margin-top:8px">
            <label class="field"><span>מראה</span><select data-vo="look">${A.opts([['auto', `לפי הסגנון (${V.LOOKS[V.lookFor(st.style)].name})`], ...Object.entries(V.LOOKS).map(([k, l]) => [k, l.name])], v.look)}</select></label>
            <label class="field"><span>מיקום</span><select data-vo="pos">${A.opts([['bottom', 'למטה (מעל הכיתוב של אינסטגרם)'], ['middle', 'באמצע'], ['top', 'למעלה']], v.pos)}</select></label>
          </div>
          <p class="small" style="margin:6px 0 8px;background:var(--sand-2);padding:8px 10px;border-radius:8px;line-height:1.7">${U.esc(v.lines.slice(0, 3).map(l => l.words.map(w => w.w).join(' ')).join(' / '))}${v.lines.length > 3 ? ' …' : ''}</p>
          <button class="btn sm" data-act="caps">${A.icon('edit')}עריכת הכתוביות והתזמון</button>`
        : `<label class="field"><span>מה נאמר בהקלטה? (כתבי או הדביקי — התזמון יחושב לפי הקול)</span><textarea rows="3" data-votext placeholder="למשל: הסופגניות של השבוע — בצק בריוש אוורירי, מילוי פיסטוק אמיתי…">${U.esc(v.text || '')}</textarea></label>
          <div class="row" style="margin-top:6px"><button class="btn sm" data-act="voBuild">יצירת כתוביות</button>${V.canTranscribeFile() && v.buffer ? `<button class="btn sm soft" data-act="voAuto">🪄 תמלול אוטומטי</button>` : ''}</div>
          ${v.noRecog ? '<p class="small muted" style="margin:6px 0 0">הדפדפן הזה לא כתב את הדיבור בזמן ההקלטה — אפשר לכתוב את הטקסט כאן.</p>' : ''}`}
      </div></div>`;
  };

  const planCard = (plan, mu, total) => {
    const S = A.VIDEO_STYLES[st.style], has = st.clips.length || st.photos.length;
    return `<div class="card">
      ${st.edit ? `<div class="notice section" style="margin:0 0 10px">${A.icon('edit')}<div><b>העריכה הידנית שלך פעילה.</b> שינוי סגנון, אורך או תיאור לא ישנה אותה. <button class="fp-link" data-act="unedit">חזרה לעריכה האוטומטית</button></div></div>` : ''}
      ${plan && plan.segments.length ? `<p class="small" style="margin:0 0 10px">${plan.segments.length} חיתוכים · ${fmtDur(plan.total)} · ${S.name}${mu ? ' · ' + U.esc(mu.title) : ''}${st.voice ? ' · 🎙️ קריינות' : ''}${!st.edit && total && total < st.target * 0.6 ? ` <span class="badge warn">מעט חומר מצולם</span>` : ''}</p>
        ${!st.edit && (plan.hookText || Object.values(plan.hints || {}).some(Boolean)) ? `<p class="small muted" style="margin:0 0 10px">העורך קלט מהתיאור:${plan.hookText ? ` הוק → "${U.esc(plan.hookText)}"` : ''}${plan.hints?.product ? ' · חשיפה ארוכה' : ''}${plan.hints?.quick ? ' · קצב מהיר' : ''}${plan.hints?.closeup ? ' · דגש על קלוז-אפ' : ''}${plan.hints?.action ? ' · דגש על תהליך' : ''}${plan.hints?.asmr ? ' · שמור צליל מקורי' : ''}${plan.hints?.slow ? ' · יותר הילוך איטי' : ''}${plan.hints?.fast ? ' · תהליכים מואצים' : ''}</p>` : ''}
        ${!st.edit && plan.summary && plan.summary.shortBy > 0.5 ? `<div class="notice section" style="margin:0 0 10px">${A.icon('alert')}<div>אין מספיק צילומים טובים ל־${effTarget()} שניות — במקום למלא בקטעים חוזרים או מתים, הסרטון ייצא <b>${fmtDur(plan.total)}</b>. כדי להגיע לאורך המלא הוסיפי עוד ${Math.ceil(plan.summary.shortBy)} שניות של צילום, או בחרי אורך קצר יותר.</div></div>` : ''}
        <details class="vt-plan"><summary class="small"><b>${st.edit ? 'החיתוכים שלך' : 'מה העורכת החליטה'}</b>${plan.summary && plan.summary.slow ? ` · ${plan.summary.slow} בהילוך איטי` : ''}${plan.summary && plan.summary.fast ? ` · ${plan.summary.fast} מואצים` : ''}</summary>
          <ol class="small">${plan.segments.map(s => `<li><b>${segLabel(s)}</b>${s.photo == null ? ` · ${U.round(s.start, 1)}–${U.round(s.start + s.dur * s.speed, 1)} ש׳ בקליף ${s.clip + 1}` : ''} · ${U.round(s.dur, 1)} ש׳ בסרטון${Math.abs(s.speed - 1) > 0.04 ? ` · <span class="vt-sp ${s.speed < 1 ? 'slow' : 'fast'}">×${U.round(s.speed, 2)}</span>` : ''}${s.why ? ` · <span class="muted">${U.esc(s.why)}</span>` : ''}</li>`).join('')}</ol></details>` : ''}
      <button class="btn" style="width:100%;min-height:52px;font-size:1.05rem" data-act="render" ${has ? '' : 'disabled'}>${A.icon('play')}${st.result ? 'יצירה מחדש' : 'עריכת הסרטון'}</button>
      ${has ? `<div class="row" style="margin-top:8px"><button class="btn soft" style="flex:1" data-act="preview2">${A.icon('search')}תצוגה מקדימה</button><button class="btn ghost" style="flex:1" data-act="editor">${A.icon('edit')}עריכה ידנית</button></div>` : '<p class="small muted" style="margin:8px 0 0;text-align:center">הוסיפי קליפים או תמונות כדי להתחיל</p>'}
    </div>`;
  };

  P.video = {
    title: 'סטודיו סרטונים',
    render(main) {
      if (!A.videoSupport()) {
        main.innerHTML = `<div class="card empty"><h3>הדפדפן הזה לא תומך בעריכת וידאו</h3><p>פתחי את האפליקציה בכרום (מחשב/אנדרואיד) או בספארי מעודכן באייפון.</p></div>`; return;
      }
      const total = U.sum(st.clips, c => c.duration), mu = musicFor();
      const plan = currentPlan(mu);
      main.innerHTML = `
      ${st.result ? resultCard() : ''}
      <div class="grid g2 section" style="align-items:start">
        <div class="stack">
          ${clipsCard(plan, total)}
          ${photosCard()}
          <div class="card"><div class="card-h"><h3>${A.icon('star')}טיפים לצילום שעובד</h3></div>
            <ul class="install-steps small" style="line-height:1.9">
              <li><b>מצלמים לאורך</b> (9:16), באור יום מהחלון — לא מתחת לנורה צהובה.</li>
              <li>כל קליפ <b>3–8 שניות</b>, מצלמה יציבה (להשעין על משהו). כמה זוויות: מלמעלה, מהצד, תקריב.</li>
              <li><b>מצלמים את הרגעים הטעימים:</b> חיתוך לתוך העוגה, שוקולד נמס, אבקת סוכר נופלת, בצק נמתח.</li>
              <li>את רגעי השיא האלה כדאי לצלם ב־<b>60fps או במצב Slo-mo</b> של הטלפון — ככה ההילוך האיטי ייצא חלק ולא "קופצני".</li>
              <li>תהליך ארוך (ערבוב, לישה, טיגון) — אפשר לצלם כמה שצריך: העורכת מזהה אותו ומאיצה, ואת הזמן המת באמצע היא חותכת.</li>
              <li><b>קריינות:</b> מקליטים בחדר שקט, הטלפון קרוב לפה, ומדברים בקצב רגיל — ככה הכתוביות יוצאות הכי מדויקות.</li>
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
          ${voiceCard()}
          <div class="card"><div class="card-h"><h3>3. טקסטים ומוזיקה</h3></div>
            <div class="form-grid">
              <label class="field full"><span>תיאור הסרטון — לפיו העורך בוחר מה להדגיש</span><textarea data-f="description" rows="2" placeholder="למשל: רילס לבאבקה שוקולד. רוצה שהצופה ירגיש את הטקסטורה המושלמת של הבצק המוכן ואת הנזילה של השוקולד — הדגש על קלוז-אפים.">${U.esc(st.description)}</textarea><small>מכוון את העורך — איזה קליפים להעדיף, איזה כיתובים לכתוב, ומה לשים בהוק</small></label>
              <label class="field full"><span>כותרת פתיחה (הוק) — אופציונלי</span><input data-f="title" value="${U.esc(st.title)}" placeholder="אם ריק — נגזרת מהתיאור"></label>
              <label class="field full"><span>טקסט בסיום</span><input data-f="cta" value="${U.esc(st.cta)}"></label>
              <label class="field"><span>מוזיקה</span><select data-f="music">${A.opts([['auto', `אוטומטית לפי הסגנון${mu && st.music === 'auto' ? ` (${mu.title})` : ''}`], ...A.MUSIC.map(m => [m.id, `${m.title} · ${m.mood}`]), ['custom', 'קובץ שלי…'], ['none', 'בלי מוזיקה']], st.music)}</select>${st.voice && st.music !== 'none' ? '<small>המוזיקה יורדת אוטומטית כשמדברים</small>' : ''}</label>
              <div class="field"><span>&nbsp;</span><div class="row">${mu ? `<button class="btn sm ghost" data-act="preview">${A.icon(previewAudio && !previewAudio.paused ? 'x' : 'play')}${previewAudio && !previewAudio.paused ? 'עצירה' : 'האזנה'}</button>` : ''}
                ${st.music === 'custom' ? `<label class="btn sm soft">${A.icon('upload')}${st.customMusic ? U.esc(st.customMusic.name.slice(0, 18)) : 'בחירת קובץ'}<input type="file" accept="audio/*" data-audio hidden></label>` : ''}</div></div>
              <label class="row full" style="gap:8px"><input type="checkbox" data-f="keepOriginal" ${keepOrig() ? 'checked' : ''}> לשמור את הצליל המקורי מהקליפים (ASMR: חיתוך, ערבוב, קראנץ׳)</label>
              <label class="row full" style="gap:8px"><input type="checkbox" data-f="autoSpeed" ${st.autoSpeed ? 'checked' : ''}> הילוך איטי ומהיר אוטומטי — רגעי שיא באיטי, תהליכים ארוכים מואצים</label>
              <label class="field"><span>פורמט</span><select data-f="format">${A.opts([['9:16', 'רילס / טיקטוק / סטורי (9:16)'], ['4:5', 'פוסט בפיד (4:5)'], ['1:1', 'ריבוע (1:1)']], st.format)}</select></label>
              <label class="field"><span>איכות</span><select data-f="hq">${A.opts([['0', 'רגילה (720p) — מהיר'], ['1', 'גבוהה (1080p)']], st.hq ? '1' : '0')}</select></label>
            </div>
            <p class="small muted" style="margin:8px 0 0">כל המוזיקה כאן חופשית לשימוש מסחרי (CC0). אפשר גם לייצא בלי מוזיקה ולהוסיף צליל טרנדי באינסטגרם.</p>
          </div>
          ${planCard(plan, mu, total)}
        </div>
      </div>`;

      main.onchange = async e => {
        const f = e.target;
        if (f.matches('[data-files]') && f.files.length) {
          A.toast('טוענת קליפים…');
          const added = (await Promise.all([...f.files].map(probe))).filter(Boolean); f.value = '';
          st.clips.push(...added); invalidate(); if (!st.clips.some(c => c.hero) && st.clips.length) st.clips[st.clips.length - 1].hero = true;
          A.refresh();
          // ניתוח ברקע — מה לחתוך, מה להאיץ ומה בהילוך איטי
          if (A.analyzeClips) {
            st.analyzing = true; A.refresh();
            try {
              const analyses = await A.analyzeClips(added, p => { const el = document.querySelector('[data-analyzer]'); if (el) el.textContent = `צופה בקליפים ומזהה מה לחתוך, מה להאיץ ומה בהילוך איטי… ${Math.round(p * 100)}%`; });
              added.forEach((c, k) => { if (analyses[k]) c.analysis = analyses[k]; });
              if (!st.clips.find(c => c.hero) || st.clips.length === added.length) {
                const scored = st.clips.filter(c => c.analysis).map(c => ({ c, score: (c.analysis.tags?.static ? 0.35 : 0) + c.analysis.avgQuality * 0.4 + Math.min(1, c.analysis.avgBrightness * 1.5) * 0.25 })).sort((a, b) => b.score - a.score);
                if (scored[0]) { st.clips.forEach(c => c.hero = false); scored[0].c.hero = true; }
              }
            } catch (err) { console.warn('analyze', err); }
            st.analyzing = false; A.refresh();
          }
          return;
        }
        if (f.matches('[data-photos]') && f.files.length) {
          [...f.files].forEach(file => st.photos.push({ id: U.uid(), url: URL.createObjectURL(file), name: file.name })); f.value = '';
          invalidate(); A.toast(`${st.photos.length} תמונות לסיום`); A.refresh(); return;
        }
        if (f.matches('[data-voicefile]') && f.files[0]) { const file = f.files[0]; f.value = ''; await setVoice(file, file.name, null); return; }
        if (f.matches('[data-audio]') && f.files[0]) { st.customMusic = { url: URL.createObjectURL(f.files[0]), name: f.files[0].name }; A.refresh(); return; }
        if (f.dataset.vo && st.voice) {
          const k = f.dataset.vo;
          if (k === 'offset') st.voice.offset = Math.max(0, Math.min(60, U.num(f.value) || 0));
          else if (k === 'vol') st.voice.vol = +f.value;
          else if (k === 'show') st.voice.show = f.checked;
          else if (k === 'look') { st.voice.look = f.value; regroup(); }
          else if (k === 'pos') st.voice.pos = f.value;
          A.refresh(); return;
        }
        if (f.matches('[data-votext]') && st.voice) { st.voice.text = f.value; return; }
        if (f.name === 'vstyle') { st.style = f.value; st.keepOriginal = null; if (st.voice && st.voice.look === 'auto') regroup(); A.refresh(); return; }
        const k = f.dataset.f; if (!k) return;
        if (k === 'target') st.target = Math.max(5, Math.min(180, U.num(f.value) || 30));
        else if (k === 'keepOriginal') st.keepOriginal = f.checked;
        else if (k === 'autoSpeed') st.autoSpeed = f.checked;
        else if (k === 'hq') st.hq = f.value === '1';
        else st[k] = f.value;
        stopPreview(); A.refresh();
      };
      main.oninput = e => { const c = e.target.dataset.cap; if (c != null) st.clips[+c].caption = e.target.value; if (e.target.matches('[data-votext]') && st.voice) st.voice.text = e.target.value; };
      main.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        const d = b.dataset;
        if (d.len) { st.target = +d.len; A.refresh(); }
        else if (d.hero != null) { st.clips.forEach((c, k) => c.hero = k === +d.hero); invalidate(); A.refresh(); }
        else if (d.up != null) { const k = +d.up; [st.clips[k - 1], st.clips[k]] = [st.clips[k], st.clips[k - 1]]; invalidate(); A.refresh(); }
        else if (d.down != null) { const k = +d.down; [st.clips[k + 1], st.clips[k]] = [st.clips[k], st.clips[k + 1]]; invalidate(); A.refresh(); }
        else if (d.del != null) { const [c] = st.clips.splice(+d.del, 1); URL.revokeObjectURL(c.url); if (c.hero && st.clips.length) st.clips[st.clips.length - 1].hero = true; invalidate(); A.refresh(); }
        else if (d.pup != null) { const k = +d.pup; [st.photos[k - 1], st.photos[k]] = [st.photos[k], st.photos[k - 1]]; invalidate(); A.refresh(); }
        else if (d.pdown != null) { const k = +d.pdown; [st.photos[k + 1], st.photos[k]] = [st.photos[k], st.photos[k + 1]]; invalidate(); A.refresh(); }
        else if (d.pdel != null) { const [p] = st.photos.splice(+d.pdel, 1); URL.revokeObjectURL(p.url); invalidate(); A.refresh(); }
        else if (d.act === 'preview') { if (previewAudio && !previewAudio.paused) stopPreview(); else { previewAudio = new Audio(musicFor().url); previewAudio.play(); previewAudio.onended = () => A.refresh(); } A.refresh(); }
        else if (d.act === 'render') render();
        else if (d.act === 'preview2') preview();
        else if (d.act === 'editor') openEditor();
        else if (d.act === 'unedit') { st.edit = null; A.toast('חזרה לעריכה האוטומטית'); A.refresh(); }
        else if (d.act === 'rec') openRecorder();
        else if (d.act === 'voDel') { if (root.confirm('להסיר את הקריינות והכתוביות?')) { URL.revokeObjectURL(st.voice.url); st.voice = null; A.refresh(); } }
        else if (d.act === 'voBuild') { const t = (st.voice.text || '').trim(); if (!t) return A.toast('כתבי קודם מה נאמר בהקלטה'); st.voice.lines = V.build(t, st.voice.segs, st.voice.duration, null, lookKey()); A.toast(`${st.voice.lines.length} שורות כתוביות מוכנות — אפשר לבדוק ולתקן בעריכת הכתוביות`); A.refresh(); }
        else if (d.act === 'voAuto') autoTranscribe(b);
        else if (d.act === 'caps') openCaptions();
        else if (d.act === 'download') A.download(`al-hagesher-${U.today()}.${st.result.ext}`, st.result.blob, st.result.mime);
        else if (d.act === 'share') share();
        else if (d.act === 'closeResult') { URL.revokeObjectURL(st.result.url); st.result = null; A.refresh(); }
      };
    }
  };
  function stopPreview() { if (previewAudio) { previewAudio.pause(); previewAudio = null; } }

  /* ---------- קריינות: הקלטה, קובץ, תמלול ---------- */
  async function setVoice(blob, name, phrases) {
    A.toast('מנתחת את ההקלטה…');
    let info;
    try { info = await V.load(blob); } catch (e) { A.toast('לא הצלחתי לקרוא את קובץ השמע'); return; }
    if (st.voice) URL.revokeObjectURL(st.voice.url);
    const text = (phrases || []).map(p => p.text).join(' ').trim();
    st.voice = { url: URL.createObjectURL(blob), name, duration: info.duration, segs: info.segs, buffer: info.buffer, phrases: phrases || [], text, lines: [], offset: 0, vol: 1, look: 'auto', pos: 'bottom', show: true, noRecog: phrases && !text };
    if (text) st.voice.lines = V.build(text, info.segs, info.duration, phrases, lookKey());
    A.toast(text ? 'ההקלטה והכתוביות מוכנות 🎙️' : 'ההקלטה נוספה'); A.refresh();
  }
  function openRecorder() {
    let ctl = null, t0 = 0, iv = 0, done = false;
    A.modal({
      title: 'הקלטת קריינות', size: 'narrow',
      body: `<div style="text-align:center"><div class="rec-dot" id="recDot"></div><div id="recTime" style="font-size:2rem;font-weight:700;font-variant-numeric:tabular-nums">0:00</div>
        <div class="time-bar" style="height:10px;margin:10px 0"><i id="recLvl" style="width:0;background:var(--ok);transition:width .08s"></i></div>
        <div id="recText" class="small" style="min-height:3.2em;text-align:start;background:var(--sand-2);border-radius:10px;padding:10px;line-height:1.7">${V.canRecognize() ? 'מתחילים לדבר — מה שתגידי ייכתב כאן' : 'מדברים בקצב רגיל. את הטקסט מוסיפים אחרי ההקלטה.'}</div>
        <p class="small muted" style="margin:10px 0 0">חדר שקט, טלפון קרוב לפה. אפשר להקליט ארוך — הסרטון יתארך לפי ההקלטה.</p></div>`,
      foot: `<button class="btn" data-stop disabled>⏹ סיום הקלטה</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount: async w => {
        try {
          ctl = await V.record({ onLevel: l => { const el = document.getElementById('recLvl'); if (el) el.style.width = Math.min(100, l * 160) + '%'; }, onText: t => { const el = document.getElementById('recText'); if (el) el.textContent = t; } });
        } catch (err) { const el = document.getElementById('recText'); if (el) el.textContent = 'אין גישה למיקרופון. צריך לאשר הקלטה בדפדפן (סמל המנעול ליד הכתובת).'; return; }
        t0 = performance.now(); iv = setInterval(() => { const s = (performance.now() - t0) / 1000, el = document.getElementById('recTime'); if (el) el.textContent = `${Math.floor(s / 60)}:${U.pad(Math.floor(s % 60))}`; }, 250);
        const sb = w.querySelector('[data-stop]'); sb.disabled = false;
        sb.onclick = async () => {
          sb.disabled = true; sb.textContent = 'שומרת…'; clearInterval(iv); done = true;
          const res = await ctl.stop(); A.closeModal();
          await setVoice(res.blob, 'הקלטה', ctl.recognizing() ? res.phrases : []);
        };
      },
      onClose: () => { clearInterval(iv); if (ctl && !done) { done = true; ctl.stop().catch(() => { }); } }
    });
  }
  async function autoTranscribe(btn) {
    const v = st.voice; if (!v || !v.buffer) return;
    btn.disabled = true; const sig = {};
    try {
      const phrases = await V.transcribe(v.buffer, p => { btn.textContent = `מתמללת… ${Math.round(p * 100)}%`; }, sig);
      const text = phrases.map(p => p.text).join(' ').trim();
      if (!text) { A.toast('לא זוהה דיבור בקובץ — אפשר לכתוב את הטקסט'); btn.disabled = false; btn.textContent = '🪄 תמלול אוטומטי'; return; }
      v.phrases = phrases; v.text = text; v.lines = V.build(text, v.segs, v.duration, phrases, lookKey());
      A.toast('התמלול מוכן — כדאי לעבור על הכתוביות ולתקן מילים אם צריך'); A.refresh();
    } catch (e) { console.warn(e); A.toast('התמלול האוטומטי לא עבד בדפדפן הזה — אפשר לכתוב את הטקסט'); btn.disabled = false; btn.textContent = '🪄 תמלול אוטומטי'; }
  }

  /* ---------- עריכת כתוביות ---------- */
  function openCaptions() {
    const v = st.voice; if (!v) return;
    let stopAt = null;
    const rows = () => v.lines.map((l, k) => `<div class="ce-row" data-l="${k}">
        <button class="icon-btn" data-play aria-label="השמעת השורה">${A.icon('play')}</button>
        <div class="ce-main"><input data-text value="${U.esc(l.words.map(w => w.w).join(' '))}" aria-label="טקסט השורה">
          <div class="ce-ctl small"><span class="ce-t" dir="ltr">${fmtT(l.s)} → ${fmtT(l.e)}</span>
            <span>התחלה <button class="btn xs ghost" data-ls="-1">−</button><button class="btn xs ghost" data-ls="1">+</button></span>
            <span>סוף <button class="btn xs ghost" data-le="-1">−</button><button class="btn xs ghost" data-le="1">+</button></span></div></div>
        <button class="icon-btn" data-ldel aria-label="מחיקת השורה">${A.icon('trash')}</button></div>`).join('') || '<p class="muted">אין שורות.</p>';
    A.modal({
      title: 'עריכת כתוביות', size: 'wide',
      body: `<audio controls src="${v.url}" id="capAudio" style="width:100%"></audio>
        <div class="row small" style="margin:8px 0;gap:8px;align-items:center"><b>הזזת כל הכתוביות:</b><button class="btn xs ghost" data-shift="-0.1">0.1 ש׳ מוקדם יותר</button><button class="btn xs ghost" data-shift="0.1">0.1 ש׳ מאוחר יותר</button></div>
        <p class="small muted" style="margin:0 0 8px">▶ משמיע את השורה כדי לבדוק. תיקון מילה — פשוט כותבים. הכפתורים − / + מזיזים את תחילת או סוף השורה ב־0.1 שנייה.</p>
        <div id="capRows">${rows()}</div>
        <details style="margin-top:10px"><summary class="small"><b>עריכת כל הטקסט בבת אחת</b></summary>
          <textarea id="capAll" rows="5" style="margin-top:6px">${U.esc(V.flatten(v.lines).map(w => w.w).join(' '))}</textarea>
          <button class="btn sm" data-realign style="margin-top:6px">החלה ויישור מחדש לפי הקול</button></details>`,
      foot: `<button class="btn" data-close>סיום</button>`,
      onMount: w => {
        const au = w.querySelector('#capAudio'), box = w.querySelector('#capRows');
        au.ontimeupdate = () => { if (stopAt != null && au.currentTime >= stopAt) { au.pause(); stopAt = null; } };
        const redraw = () => { box.innerHTML = rows(); };
        // הזזת גבולות שורה: המילים נמתחות באופן יחסי לגבולות החדשים, בלי לעלות על השכנות
        const setBounds = (k, s, e) => {
          const l = v.lines[k], prev = v.lines[k - 1], next = v.lines[k + 1];
          s = Math.max(prev ? prev.e : 0, Math.min(s, e - 0.2)); e = Math.min(next ? next.s : v.duration + 1, Math.max(e, s + 0.2));
          const os = l.s, oe = l.e, sc = (e - s) / Math.max(0.01, oe - os);
          l.words.forEach(x => { x.s = U.round(s + (x.s - os) * sc, 3); x.e = U.round(s + (x.e - os) * sc, 3); }); l.s = s; l.e = e;
        };
        w.addEventListener('click', ev => {
          const b = ev.target.closest('button'); if (!b) return;
          if (b.dataset.shift) { const dd = +b.dataset.shift; v.lines.forEach(l => { l.words.forEach(x => { x.s = Math.max(0, U.round(x.s + dd, 3)); x.e = Math.max(0.05, U.round(x.e + dd, 3)); }); l.s = l.words[0].s; l.e = l.words[l.words.length - 1].e; }); redraw(); return; }
          if (b.hasAttribute('data-realign')) { const t = w.querySelector('#capAll').value.trim(); if (!t) return; v.lines = V.build(t, v.segs, v.duration, null, lookKey()); redraw(); A.toast('הכתוביות תוזמנו מחדש לפי הקול'); return; }
          const row = b.closest('[data-l]'); if (!row) return; const k = +row.dataset.l, l = v.lines[k];
          if (b.hasAttribute('data-play')) { au.currentTime = Math.max(0, l.s - 0.15); stopAt = l.e + 0.2; au.play(); return; }
          if (b.dataset.ls) { setBounds(k, l.s + 0.1 * b.dataset.ls, l.e); redraw(); return; }
          if (b.dataset.le) { setBounds(k, l.s, l.e + 0.1 * b.dataset.le); redraw(); return; }
          if (b.hasAttribute('data-ldel')) { v.lines.splice(k, 1); redraw(); return; }
        });
        w.addEventListener('change', ev => {
          const inp = ev.target.closest('[data-text]'); if (!inp) return;
          const k = +inp.closest('[data-l]').dataset.l, l = v.lines[k], t = inp.value.trim();
          if (!t) { v.lines.splice(k, 1); redraw(); return; }
          l.words = V.retimeLine(t, v.segs, l.s, l.e); l.s = l.words[0].s; l.e = l.words[l.words.length - 1].e; redraw();
        });
      },
      onClose: () => A.refresh()
    });
  }

  /* ---------- עריכה ידנית של החיתוכים ---------- */
  function openEditor() {
    const mu = musicFor();
    if (!st.edit) { const p = autoPlan(mu); if (!p) return; st.edit = clone(p); }
    const e = st.edit, S = A.VIDEO_STYLES[st.style];
    const fix = s => { // חיתוך תמיד בתוך הקליף
      if (s.photo != null) { s.dur = Math.max(0.5, Math.min(15, s.dur)); return; }
      const c = st.clips[s.clip]; if (!c) return;
      s.speed = Math.max(0.25, Math.min(4, s.speed)); s.start = Math.max(0, Math.min(s.start, c.duration - 0.2));
      s.dur = Math.max(0.3, Math.min(s.dur, (c.duration - s.start) / s.speed));
    };
    const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    const rows = () => e.segments.map((s, i) => {
      const isP = s.photo != null, c = isP ? null : st.clips[s.clip], ph = isP ? st.photos[s.photo] : null, thumb = isP ? ph && ph.url : c && c.thumb;
      return `<div class="ve-row" data-i="${i}">
        <div class="ve-th">${thumb ? `<img src="${thumb}" alt="">` : ''}<span>${i + 1}</span></div>
        <div class="ve-main"><div><b>${segLabel(s)}</b>${s.why ? ` <span class="small muted">· ${U.esc(s.why)}</span>` : ''}</div>
          <div class="ve-ctl">
            ${isP ? '' : `<label>מהשנייה<input type="number" step="0.1" min="0" data-k="start" value="${r1(s.start)}"></label>`}
            <label>משך בסרטון<input type="number" step="0.1" min="0.3" data-k="dur" value="${r1(s.dur)}"></label>
            ${isP ? '' : `<label>מהירות<select data-k="speed">${(SPEEDS.some(x => Math.abs(x - s.speed) < 0.03) ? SPEEDS : [...SPEEDS, s.speed].sort((a, b) => a - b)).map(x => `<option value="${x}" ${Math.abs(x - s.speed) < 0.03 ? 'selected' : ''}>${x === 1 ? 'רגילה' : x < 1 ? `איטי ×${U.round(x, 2)}` : `מהיר ×${U.round(x, 2)}`}</option>`).join('')}</select></label>`}
            <label class="ve-cap">כיתוב<input data-k="caption" value="${U.esc(s.caption || '')}" placeholder="לא חובה"></label>
          </div></div>
        <div class="ve-btns"><button class="icon-btn" data-mv="-1" aria-label="למעלה" ${i ? '' : 'disabled'}>▲</button><button class="icon-btn" data-mv="1" aria-label="למטה" ${i < e.segments.length - 1 ? '' : 'disabled'}>▼</button><button class="icon-btn" data-rm aria-label="מחיקת הקטע">${A.icon('trash')}</button></div></div>`;
    }).join('');
    const addOpts = () => [...st.clips.map((c, k) => [`c${k}`, `קליף ${k + 1} (${fmtDur(c.duration)})`]), ...st.photos.map((p, k) => [`p${k}`, `תמונה ${k + 1}`])];
    const head = () => `<b>${fmtDur(planTotal(e))}</b> · ${e.segments.length} קטעים`;
    A.modal({
      title: 'עריכה ידנית', size: 'wide',
      body: `<p class="small muted" style="margin:0 0 10px">כאן הכל בידיים שלך: מאיזו שנייה בקליף, כמה זמן, באיזו מהירות, איזה כיתוב ובאיזה סדר. השינויים נשמרים מיד — אחר כך "תצוגה מקדימה" או "יצירה מחדש".</p>
        <div class="row small" style="justify-content:space-between;margin-bottom:8px"><span id="veHead">${head()}</span><label class="row" style="gap:6px">מסך סיום (ש׳)<input type="number" step="0.5" min="0" max="8" id="veEnd" value="${r1(e.endCard)}" style="width:70px"></label></div>
        <div id="veRows">${rows()}</div>
        <div class="row" style="margin-top:10px;gap:8px"><select id="veAdd" style="width:auto">${A.opts(addOpts(), addOpts()[0] ? addOpts()[0][0] : '')}</select><button class="btn sm soft" data-add>${A.icon('plus')}הוספת קטע</button></div>`,
      foot: `<button class="btn" data-close>סיום</button><button class="btn ghost" data-pv>${A.icon('search')}תצוגה מקדימה</button><button class="btn ghost" data-reset style="margin-inline-start:auto">חזרה לעריכה האוטומטית</button>`,
      onMount: w => {
        const redraw = () => { w.querySelector('#veRows').innerHTML = rows(); w.querySelector('#veHead').innerHTML = head(); e.total = planTotal(e); };
        w.addEventListener('change', ev => {
          const el = ev.target;
          if (el.id === 'veEnd') { e.endCard = Math.max(0, Math.min(8, U.num(el.value) || 0)); redraw(); return; }
          const row = el.closest('[data-i]'), k = el.dataset.k; if (!row || !k) return;
          const s = e.segments[+row.dataset.i];
          if (k === 'caption') s.caption = el.value.trim(); else s[k] = U.num(el.value);
          if (k !== 'caption') s.why = 'נערך ידנית';
          fix(s); redraw();
        });
        w.addEventListener('click', ev => {
          const b = ev.target.closest('button'); if (!b) return;
          if (b.hasAttribute('data-pv')) { A.closeModal(); preview(); return; }
          if (b.hasAttribute('data-reset')) { st.edit = null; A.closeModal(); A.toast('חזרה לעריכה האוטומטית'); A.refresh(); return; }
          if (b.hasAttribute('data-add')) {
            const v = w.querySelector('#veAdd').value; if (!v) return;
            const n = v[0] === 'p' ? { photo: +v.slice(1), start: 0, dur: 2, speed: 1, trans: 'fade', transDur: 0.4, zoomFrom: 1.02, zoomTo: 1.1, pan: 1, role: 'photo', caption: '', why: 'נוסף ידנית' }
              : (() => { const c = st.clips[+v.slice(1)], a = c.analysis ? c.analysis.suggestedStart : 0; return { clip: +v.slice(1), start: a, dur: 2, speed: 1, trans: S.trans, transDur: S.transDur, zoomFrom: 1, zoomTo: 1 + S.kb, role: 'body', caption: '', why: 'נוסף ידנית' }; })();
            fix(n); const before = e.segments.findIndex(s => s.role === 'reveal' || s.photo != null); e.segments.splice(before < 0 ? e.segments.length : before, 0, n); redraw(); return;
          }
          const row = b.closest('[data-i]'); if (!row) return; const i = +row.dataset.i;
          if (b.dataset.mv) { const j = i + +b.dataset.mv; if (j < 0 || j >= e.segments.length) return; [e.segments[i], e.segments[j]] = [e.segments[j], e.segments[i]]; redraw(); return; }
          if (b.hasAttribute('data-rm')) { if (e.segments.length < 2) return A.toast('צריך לפחות קטע אחד'); e.segments.splice(i, 1); redraw(); }
        });
      },
      onClose: () => { if (st.edit) st.edit.total = planTotal(st.edit); A.refresh(); }
    });
  }

  /* ---------- רינדור ותצוגה מקדימה ---------- */
  const renderOpts = (mu, S) => ({
    format: st.format, hq: st.hq, title: st.title, cta: st.cta, sub: A.state.settings.businessName || 'על הגשר',
    musicUrl: mu && mu.url, musicVol: keepOrig() ? Math.min(S.musicVol, 0.45) : S.musicVol, keepOriginal: keepOrig(),
    photos: st.photos.map(p => ({ url: p.url })),
    voice: st.voice ? { url: st.voice.url, offset: +st.voice.offset || 0, vol: st.voice.vol, segs: st.voice.segs } : null,
    captions: st.voice && st.voice.show && st.voice.lines.length ? { lines: st.voice.lines, look: lookKey(), pos: st.voice.pos, offset: +st.voice.offset || 0 } : null
  });
  const finalPlan = mu => {
    const p = st.edit ? clone(st.edit) : autoPlan(mu); if (!p) return null;
    if (st.edit) p.total = planTotal(p);
    if (!st.title && p.hookText) p.title = p.hookText;
    return p;
  };
  function preview() {
    stopPreview();
    let audioContext = null; try { audioContext = new (root.AudioContext || root.webkitAudioContext)(); audioContext.resume(); } catch (e) { }
    const mu = musicFor(), S = A.VIDEO_STYLES[st.style], plan = finalPlan(mu); if (!plan || !plan.segments.length) return;
    const sig = { cancelled: false };
    A.modal({
      title: 'תצוגה מקדימה', size: 'narrow',
      body: `<div style="text-align:center"><canvas id="pvCanvas" style="width:min(100%,280px);border-radius:14px;background:#26180e"></canvas>
        <div class="time-bar" style="height:6px;margin:10px 0 4px"><i id="pvProg" style="width:0;background:var(--caramel)"></i></div>
        <p class="small muted" style="margin:6px 0 0">תצוגה בלבד — שום דבר לא נשמר. אם הכל נראה טוב: "עריכת הסרטון".</p></div>`,
      foot: `<button class="btn" data-close>סגירה</button><button class="btn ghost" data-ed>${A.icon('edit')}עריכה ידנית</button>`,
      onMount: w => { w.querySelector('[data-ed]').onclick = () => { sig.cancelled = true; A.closeModal(); setTimeout(openEditor, 50); }; },
      onClose: () => { sig.cancelled = true; }
    });
    const canvas = document.getElementById('pvCanvas');
    A.renderVideo(canvas, st.clips, plan, Object.assign(renderOpts(mu, S), { title: st.title || plan.hookText || '', audioContext, preview: true }),
      p => { const el = document.getElementById('pvProg'); if (el) el.style.width = (p * 100) + '%'; }, sig).catch(err => { console.error(err); A.toast('התצוגה נכשלה: ' + (err.message || '')); });
  }
  function resultCard() {
    const r = st.result;
    return `<div class="card section"><div class="card-h"><h3>${A.icon('check')}הסרטון מוכן</h3><button class="icon-btn" data-act="closeResult" aria-label="סגירה">${A.icon('x')}</button></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <video src="${r.url}" controls playsinline style="width:min(100%,320px);border-radius:14px;background:#000"></video>
        <div class="stack" style="flex:1;min-width:200px">
          <p style="margin:0">${fmtDur(r.duration)} · ${r.width}×${r.height} · ${r.ext.toUpperCase()} · ${U.round(r.blob.size / 1048576, 1)}MB</p>
          ${navigator.canShare ? `<button class="btn" data-act="share">${A.icon('upload')}שיתוף / שמירה לגלריה</button>` : ''}
          <button class="btn ghost" data-act="download">${A.icon('download')}הורדת הקובץ</button>
          <button class="btn soft" data-act="editor">${A.icon('edit')}עריכה ידנית — ואז יצירה מחדש</button>
          ${st.voice && st.voice.lines.length ? `<button class="btn soft" data-act="caps">${A.icon('edit')}תיקון כתוביות</button>` : ''}
          ${r.ext === 'webm' ? '<p class="small muted" style="margin:0">הדפדפן הזה שומר בפורמט WebM. לאינסטגרם עדיף לערוך מהטלפון (נשמר כ־MP4).</p>' : ''}
          <p class="small muted" style="margin:0">לא אהבת חיתוך? "עריכה ידנית" ותקני בדיוק מה שצריך — או שני סגנון/מוזיקה ולחצי שוב.</p>
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
    const mu = musicFor(), S = A.VIDEO_STYLES[st.style], plan = finalPlan(mu);
    if (!plan || !plan.segments.length) return;
    signal = { cancelled: false };
    A.modal({
      title: 'עורכת את הסרטון…', size: 'narrow',
      body: `<div style="text-align:center"><canvas id="vcanvas" style="width:min(100%,260px);border-radius:14px;background:#26180e"></canvas>
        <div class="time-bar" style="height:8px;margin:14px 0 6px"><i id="vprog" style="width:0;background:var(--caramel)"></i></div>
        <div class="small muted" id="vtxt">מכינה…</div><p class="small muted">העריכה נעשית בזמן אמת — סרטון של ${Math.round(plan.total)} שניות לוקח בערך ${Math.round(plan.total)} שניות. השאירי את המסך פתוח.</p></div>`,
      foot: `<button class="btn ghost" data-cancel>ביטול</button>`,
      onMount(w) { w.querySelector('[data-cancel]').onclick = () => { signal.cancelled = true; A.closeModal(); }; },
      onClose: () => { if (!st.result || st.rendering) signal.cancelled = true; }
    });
    const canvas = document.getElementById('vcanvas'); st.rendering = true;
    try {
      const out = await A.renderVideo(canvas, st.clips, plan, Object.assign(renderOpts(mu, S), { title: st.title || plan.hookText || '', audioContext }),
        p => { const pr = document.getElementById('vprog'), tx = document.getElementById('vtxt'); if (pr) pr.style.width = (p * 100) + '%'; if (tx) tx.textContent = `${Math.round(p * 100)}%`; }, signal);
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
