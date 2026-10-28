// בדיקת קצה לעריכת וידאו בכרום אמיתי (headless) דרך CDP: מעלה קליפים, מרנדר, ובודק אורך/תמונה/סדר/אודיו.
// דרוש שרת מקומי על 8765. שימוש: node tests/video-e2e.js [style] [target] [music-id|none]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [style = 'rhythm', target = '15', music = 'lofi-hiphop'] = process.argv.slice(2);
const OUT = path.join(__dirname, 'fixtures', 'clips');
(async () => {
  const prof = fs.mkdtempSync('/tmp/agvideo-');
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${prof}`, '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--window-size=900,1200', 'about:blank'], { stdio: 'ignore' });
  let ws, id = 0; const pending = {};
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:9333/json'); const t = (await r.json()).find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await new Promise(r => setTimeout(r, 200)); }
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 240000 }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500)); return r.result.result.value; };
  const logs = [];
  const prevOnMsg = ws.onmessage; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 400)); if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) logs.push(d.params.type + ' ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 300)); prevOnMsg(m); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:8765/#/video' }); await new Promise(r => setTimeout(r, 2500));
  const res = await evalJs(`(async () => {
    const urls = []; for (let i = 1; i <= 5; i++) { const b = await (await fetch('/tests/fixtures/clips/clip' + i + '.mp4')).blob(); urls.push({ url: URL.createObjectURL(b) }); }
    const clips = [6, 8, 5, 10, 7].map((d, i) => ({ duration: d, hero: i === 4, caption: i === 1 ? 'מקפלים את הבצק' : '' }));
    const m = ${JSON.stringify(music)} === 'none' ? null : App.MUSIC.find(x => x.id === ${JSON.stringify(music)});
    const plan = App.planEdit(clips, { target: ${+target}, style: ${JSON.stringify(style)}, bpm: m && m.bpm });
    const c = document.createElement('canvas'); document.body.appendChild(c);
    const t0 = performance.now();
    const out = await App.renderVideo(c, urls, plan, { format: '9:16', title: 'בבקה שוקולד מושלמת', cta: 'להזמנות — הקישור בפרופיל', sub: 'על הגשר', musicUrl: m ? App.musicUrl(m) : null, musicVol: 0.8, keepOriginal: ${style === 'calm'} }, p => { window.__frames = (window.__frames || 0) + 1; window.__lastP = p; });
    const secs = (performance.now() - t0) / 1000;
    const url = URL.createObjectURL(out.blob), v = document.createElement('video'); v.muted = true; v.src = url; document.body.appendChild(v);
    await new Promise(r => v.onloadedmetadata = r);
    if (!isFinite(v.duration)) { v.currentTime = 1e9; await new Promise(r => v.ondurationchange = r); }
    // פס פריימים לפי זמני התוכנית: אמצע כל קטע + מסך הסיום
    let t = 0; const marks = plan.segments.map(s => { const m = { at: t + s.dur / 2, clip: s.clip + 1, role: s.role }; t += s.dur; return m; }); marks.push({ at: t + plan.endCard / 2, clip: 'end', role: 'end' });
    const W = 90, H = 160, cols = Math.min(10, marks.length), rows = Math.ceil(marks.length / cols), sh = document.createElement('canvas'); sh.width = cols * W; sh.height = rows * (H + 14); const x = sh.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, sh.width, sh.height);
    const colors = { 1: [181, 101, 29], 2: [107, 142, 35], 3: [70, 130, 180], 4: [205, 133, 63], 5: [139, 69, 19] }; const hits = [];
    for (let i = 0; i < marks.length; i++) {
      await new Promise(r => { v.onseeked = r; v.currentTime = marks[i].at; });
      const gx = (i % cols) * W, gy = Math.floor(i / cols) * (H + 14); x.drawImage(v, gx, gy, W, H);
      x.fillStyle = '#fff'; x.font = '11px Arial'; x.fillText(marks[i].at.toFixed(1) + ' c' + marks[i].clip, gx + 2, gy + H + 11);
      // בדיקת צבע: איזה קליפ מופיע בפועל (דגימה בצד, רחוק מהטקסט והריבועים)
      const px = x.getImageData(gx + 8, gy + H * 0.8, 1, 1).data; let best = null, bd = 1e9;
      Object.entries(colors).forEach(([k, c]) => { const d = (c[0] - px[0]) ** 2 + (c[1] - px[1]) ** 2 + (c[2] - px[2]) ** 2; if (d < bd) { bd = d; best = +k; } });
      hits.push(marks[i].clip === 'end' ? 'end' : best === marks[i].clip ? 'ok' : 'got c' + best + ' want c' + marks[i].clip);
    }
    let audio = null; try { const ab = await new AudioContext().decodeAudioData(await out.blob.arrayBuffer()); let s = 0; const d = ab.getChannelData(0); for (let i = 0; i < d.length; i += 64) s += d[i] * d[i]; audio = { dur: +ab.duration.toFixed(2), rms: +Math.sqrt(s / (d.length / 64)).toFixed(4) }; } catch (e) { audio = 'err ' + e.message; }
    const stalls = (App._vlog || []).filter(l => l.stall !== undefined).length; const dbg = ['frames=' + window.__frames + ' lastP=' + window.__lastP + ' vlog=' + (App._vlog || []).length, ...(App._vlog || []).slice(0, 12).map(l => JSON.stringify(l))];
    return { mime: out.mime, size: out.blob.size, w: out.width, h: out.height, renderSecs: +secs.toFixed(1), duration: +v.duration.toFixed(2), planTotal: plan.total, segments: plan.segments.length, hits, audio, stalls, dbg, sheet: sh.toDataURL('image/png') };
  })()`);
  const png = Buffer.from(res.sheet.split(',')[1], 'base64'); const sheetFile = path.join(OUT, `sheet-${style}-${target}.png`); fs.writeFileSync(sheetFile, png); delete res.sheet;
  console.log(JSON.stringify(res, null, 1)); console.log('LOGS', logs.slice(0, 10)); console.log('sheet:', sheetFile);
  ws.close(); ch.kill();
})().catch(e => { console.error(e); process.exit(1); });
