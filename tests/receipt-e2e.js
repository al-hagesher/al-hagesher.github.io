// בדיקת קצה לזיהוי קבלות בכרום אמיתי: מצייר קבלה בעברית, מריץ זיהוי (Tesseract מקומי, תחת ה-CSP של האפליקציה), ומפענח.
// דרוש שרת מקומי על 8765. שימוש: node tests/receipt-e2e.js
const { spawn } = require('child_process'), fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async () => {
  const prof = fs.mkdtempSync('/tmp/agrcpt-');
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let ws, id = 0; const pending = {}, logs = [];
  for (let i = 0; i < 50; i++) { try { const t = (await (await fetch('http://127.0.0.1:9334/json')).json()).find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await new Promise(r => setTimeout(r, 200)); }
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 300)); if (d.method === 'Log.entryAdded' && /Content Security|CSP|Refused/i.test(d.params.entry.text)) logs.push('CSP ' + d.params.entry.text.slice(0, 300)); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: 'http://localhost:8765/#/expenses' }); await new Promise(r => setTimeout(r, 2500));
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, timeout: 180000, expression: `(async () => {
    const lines = ['שופרסל דיל', '28/10/26  10:15', 'קמח לבן 1 ק"ג            5.90', 'חמאה 200 גרם              8.90', 'ביצים L 12 יח             14.90', 'שוקולד מריר 100 גרם       6.90', 'סה"כ לתשלום              36.60'];
    const c = document.createElement('canvas'); c.width = 900; c.height = 140 + lines.length * 70; const x = c.getContext('2d');
    x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111'; x.font = '38px Arial'; x.direction = 'rtl'; x.textAlign = 'right';
    lines.forEach((l, k) => x.fillText(l, 860, 90 + k * 70));
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); const file = new File([blob], 'r.jpg', { type: 'image/jpeg' });
    const t0 = performance.now(); const text = await App.ocr(file); const secs = (performance.now() - t0) / 1000;
    const p = App.parseReceipt(text);
    return { secs: +secs.toFixed(1), text, parsed: { store: p.store, date: p.date, total: p.total, items: p.items.map(i => ({ t: i.text, q: i.qty, p: i.price, m: (App.matchIngredient(i.text) || {}).ing ? App.matchIngredient(i.text).ing.name : null })) } };
  })()` });
  console.log(JSON.stringify(r.result.result.value || r.result, null, 1)); console.log('LOGS', logs.slice(0, 8));
  ws.close(); ch.kill();
})().catch(e => { console.error(e); process.exit(1); });
