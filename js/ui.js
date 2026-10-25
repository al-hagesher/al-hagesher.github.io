/* על הגשר — רכיבי ממשק: אייקונים, דיאלוג, הודעות, גרפים, טיימרים */
(function (root) {
  const A = root.App, U = A.util;
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    orders: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.6"/>',
    wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/><path d="M6 6V4h12v2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16V6"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M12 14v7M3 12h7M14 12h7M5.6 5.6l5 5M13.4 13.4l5 5M18.4 5.6l-5 5M10.6 13.4l-5 5"/>',
    scale: '<path d="M12 3v18M5 7h14M8 21h8"/><path d="M5 7 2 14a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    settings: '<path d="M4 6h9M18 6h2M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15.5" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    print: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
    msg: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 17V5M7 10l5-5 5 5M5 21h14"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.7 1.4 2.8 2.5 2.8z"/>',
    truck: '<path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    cloud: '<path d="M17.5 19H7a5 5 0 1 1 1.1-9.9A6 6 0 0 1 19.6 11a4 4 0 0 1-2.1 8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
  };
  A.icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

  /* הודעה קצרה */
  let toastT;
  A.toast = msg => {
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('has-action'); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  };
  A.onSaveError = () => A.toast('שגיאה בשמירה — מומלץ לגבות עכשיו');
  // הודעה עם "ביטול" אחרי מחיקה (6 שניות)
  A.undoToast = (msg, undo) => {
    const t = document.getElementById('toast');
    t.innerHTML = `<span>${U.esc(msg)}</span><button type="button">ביטול</button>`;
    t.classList.add('show', 'has-action');
    t.querySelector('button').onclick = () => { clearTimeout(toastT); t.classList.remove('show', 'has-action'); undo(); A.toast('שוחזר'); };
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show', 'has-action'), 6000);
    A.haptic();
  };
  A.haptic = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) { } };

  /* דיאלוג */
  let pendingClose = null;
  A.modal = ({ title, body, foot = '', size = '', onMount, onClose }) => {
    const d = document.getElementById('modal');
    d.className = size;
    d.innerHTML = `<div class="m-wrap"><div class="m-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="סגירה">${A.icon('x')}</button></div>
      <div class="m-body">${body}</div>${foot ? `<div class="m-foot">${foot}</div>` : ''}</div>`;
    d.onclick = e => { if (e.target === d || e.target.closest('[data-close]')) A.closeModal(); };
    // לא סומכים על אירוע close (לא תמיד נשלח) — סוגרים ומפעילים onClose ישירות
    const prev = pendingClose; pendingClose = onClose || null; if (prev) prev();
    d.oncancel = e => { e.preventDefault(); A.closeModal(); };
    d.oninput = d.onchange = null;
    if (!d.open) d.showModal();
    onMount && onMount(d.querySelector('.m-wrap'));
    const f = d.querySelector('[autofocus]'); if (f) f.focus();
    return d;
  };
  A.closeModal = () => {
    const d = document.getElementById('modal'); if (d.open) d.close();
    const f = pendingClose; pendingClose = null; if (f) f();
  };
  A.confirm = (msg, okLabel = 'אישור', danger = true) => new Promise(res => {
    let ok = false;
    A.modal({
      title: 'רגע לפני', size: 'narrow', body: `<p style="margin:0">${msg}</p>`,
      foot: `<button class="btn ${danger ? 'danger' : ''}" data-ok>${okLabel}</button><button class="btn ghost" data-close>ביטול</button>`,
      onMount: d => d.querySelector('[data-ok]').onclick = () => { ok = true; A.closeModal(); },
      onClose: () => res(ok)
    });
  });

  /* קריאת ערכי טופס לפי name */
  A.formData = el => {
    const o = {};
    el.querySelectorAll('[name]').forEach(f => {
      if (f.type === 'checkbox') { if (f.dataset.multi) { o[f.name] = o[f.name] || []; if (f.checked) o[f.name].push(f.value); } else o[f.name] = f.checked; }
      else if (f.type === 'radio') { if (f.checked) o[f.name] = f.value; }
      else if (f.type === 'number' || f.dataset.num) o[f.name] = f.value === '' ? '' : U.num(f.value);
      else o[f.name] = f.value.trim();
    });
    return o;
  };
  A.opts = (list, sel, labels) => list.map(v => {
    const val = Array.isArray(v) ? v[0] : v, lab = Array.isArray(v) ? v[1] : (labels ? labels[v] : v);
    return `<option value="${U.esc(val)}" ${String(val) === String(sel ?? '') ? 'selected' : ''}>${U.esc(lab)}</option>`;
  }).join('');
  A.unitOpts = sel => A.opts(Object.keys(A.UNITS), sel, A.UNITS);

  /* הורדת קובץ */
  A.download = (name, text, type = 'application/json') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  A.copy = async text => {
    try { await navigator.clipboard.writeText(text); A.toast('הועתק'); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); A.toast('הועתק'); }
  };
  /* כיווץ תמונה ל-JPEG קטן */
  A.readImage = (file, max = 900) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });

  /* ---------- גרפים ב-SVG ---------- */
  const G = A.chart = {};
  const niceMax = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const short = v => Math.abs(v) >= 1000 ? U.fmt(U.round(v / 1000, 1)) + 'K' : U.fmt(Math.round(v));
  // עמודות אנכיות; data: [{label, value, value2?}]
  G.bars = (data, { height = 220, fmt = short, color = 'var(--brown-3)', color2 = 'var(--caramel)', series2 = false } = {}) => {
    if (!data.length) return '<div class="empty small">אין נתונים</div>';
    const W = 640, H = height, pl = 8, pr = 40, pt = 22, pb = 28;
    const max = niceMax(Math.max(...data.map(d => Math.max(d.value, d.value2 || 0))));
    const cw = (W - pl - pr) / data.length, bw = Math.min(series2 ? cw * .36 : cw * .56, 42);
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">`;
    for (let k = 0; k <= 4; k++) {
      const v = max * k / 4, yy = y(v);
      s += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--line)" ${k ? 'stroke-dasharray="3 4"' : ''}/>`;
      s += `<text x="${W - pr + 6}" y="${yy + 4}" text-anchor="start">${fmt(v)}</text>`;
    }
    data.forEach((d, i) => {
      // ציר מימין לשמאל: הפריט הראשון מימין
      const cx = W - pr - cw * (i + .5);
      const draw = (v, x, c) => { const h = Math.max(H - pb - y(v), v ? 2 : 0); return `<rect x="${x}" y="${H - pb - h}" width="${bw}" height="${h}" rx="4" fill="${c}"><title>${U.esc(d.label)}: ${fmt(v)}</title></rect>`; };
      if (series2) { s += draw(d.value, cx, color); s += draw(d.value2 || 0, cx - bw - 2, color2); }
      else { s += draw(d.value, cx - bw / 2, color); if (d.value) s += `<text class="val" x="${cx}" y="${y(d.value) - 6}" text-anchor="middle">${fmt(d.value)}</text>`; }
      s += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${U.esc(d.label)}</text>`;
    });
    return s + '</svg>';
  };
  // עמודות אופקיות כ-HTML
  G.hbars = (data, fmt = v => U.fmt(v)) => {
    if (!data.length) return '<div class="empty small">אין נתונים</div>';
    const max = Math.max(...data.map(d => d.value)) || 1;
    return data.map(d => `<div class="hbar"><div class="name" title="${U.esc(d.label)}">${U.esc(d.label)}</div><div class="track"><div class="fill" style="width:${d.value / max * 100}%;${d.color ? 'background:' + d.color : ''}"></div></div><div class="v">${fmt(d.value)}</div></div>`).join('');
  };
  // קווים; series: [{name, color, values:[]}], labels: []
  G.lines = (labels, series, { height = 220, min = null, max = null, fmt = short, dots = true } = {}) => {
    if (!labels.length) return '<div class="empty small">אין נתונים</div>';
    const W = 640, H = height, pl = 14, pr = 40, pt = 16, pb = 28;
    const all = series.flatMap(s => s.values.filter(v => v != null));
    const hi = max != null ? max : niceMax(Math.max(...all, 1)), lo = min != null ? min : 0;
    const n = labels.length, step = n > 1 ? (W - pl - pr) / (n - 1) : 0;
    const x = i => n > 1 ? W - pr - i * step : (W - pr + pl) / 2;
    const y = v => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo || 1));
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px">`;
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * k / 4, yy = y(v);
      s += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--line)" ${k ? 'stroke-dasharray="3 4"' : ''}/><text x="${W - pr + 6}" y="${yy + 4}">${fmt(v)}</text>`;
    }
    const every = Math.ceil(n / 8);
    labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${U.esc(l)}</text>`; });
    series.forEach(se => {
      const pts = se.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
      if (pts.length > 1) s += `<polyline fill="none" stroke="${se.color}" stroke-width="${se.width || 2.2}" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
      if (dots) pts.forEach((p, i) => s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.4" fill="var(--paper)" stroke="${se.color}" stroke-width="2"/>`);
    });
    return s + '</svg>';
  };
  // עוגה/טבעת
  G.PALETTE = ['var(--brown)', '#b8875e', '#8f603f', '#d8bfa3', '#6b7f5e', '#a35c46', '#c9a77c', '#7d6a5a'];
  G.donut = (data, { size = 180, fmt = v => U.fmt(v) } = {}) => {
    const total = U.sum(data, d => d.value);
    if (!total) return '<div class="empty small">אין נתונים</div>';
    const r = 70, c = 2 * Math.PI * r; let off = 0;
    let s = `<div class="donut-wrap"><svg viewBox="0 0 180 180" style="width:min(${size}px,45vw);flex:none;transform:rotate(-90deg)">`;
    data.forEach((d, i) => {
      const len = d.value / total * c;
      s += `<circle cx="90" cy="90" r="${r}" fill="none" stroke="${d.color || G.PALETTE[i % 8]}" stroke-width="26" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"><title>${U.esc(d.label)}</title></circle>`;
      off += len;
    });
    s += `</svg><div class="legend" style="flex-direction:column;gap:6px">` + data.map((d, i) => `<span><i style="background:${d.color || G.PALETTE[i % 8]}"></i>${U.esc(d.label)} · <b style="color:var(--brown)">${fmt(d.value)}</b> (${Math.round(d.value / total * 100)}%)</span>`).join('') + '</div></div>';
    return s;
  };

  /* ---------- טיימרים למטבח ---------- */
  const timers = []; let tick;
  A.timers = timers;
  const beep = () => {
    try {
      const ctx = new (root.AudioContext || root.webkitAudioContext)();
      [0, .35, .7].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .3); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .32); });
    } catch (e) { }
  };
  const renderTimers = () => {
    let box = document.querySelector('.timers');
    if (!box) { box = document.createElement('div'); box.className = 'timers'; document.body.appendChild(box); }
    box.innerHTML = timers.map(t => {
      const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
      const mm = Math.floor(left / 60), ss = left % 60;
      return `<div class="timer-pill ${left ? '' : 'done'}">${A.icon('timer')}<span>${U.esc(t.label)}</span><b>${mm}:${U.pad(ss)}</b><button data-tid="${t.id}" aria-label="סגירה">${A.icon('x')}</button></div>`;
    }).join('');
    box.onclick = e => { const b = e.target.closest('[data-tid]'); if (b) { const i = timers.findIndex(t => t.id === b.dataset.tid); if (i > -1) timers.splice(i, 1); renderTimers(); } };
  };
  A.startTimer = (minutes, label) => {
    timers.push({ id: U.uid(), end: Date.now() + minutes * 60000, label, rang: false });
    if (!tick) tick = setInterval(() => {
      timers.forEach(t => { if (!t.rang && Date.now() >= t.end) { t.rang = true; beep(); A.toast('⏰ ' + t.label + ' — הזמן נגמר'); } });
      renderTimers(); if (!timers.length) { clearInterval(tick); tick = null; }
    }, 1000);
    renderTimers(); A.toast('טיימר הופעל: ' + label);
  };
})(window);
