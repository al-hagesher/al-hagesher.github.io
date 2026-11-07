/* על הגשר — עוזרת AI (Claude Opus 5.5 דרך Supabase Edge Function) */
(function (root) {
  const A = root.App, U = A.util, C = A.calc, P = A.pages = A.pages || {};

  const EDGE_URL = 'https://atyvnyfadjzedcdrrwpl.supabase.co/functions/v1/assistant';
  const PUB_KEY = 'sb_publishable_VYxvnQePn2dITBiFCyEAhA_Og_aEgPR';
  const LS_KEY = 'ag-assistant-chat';

  // היסטוריית שיחה נשמרת מקומית
  const loadChat = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; } };
  const saveChat = m => { try { localStorage.setItem(LS_KEY, JSON.stringify(m.slice(-40))); } catch (e) { } };

  // מצטמצם למצב רלוונטי בלבד (בלי תמונות/בייס64)
  function stateSnapshot() {
    const s = A.state, today = U.today();
    const slim = r => ({ id: r.id, name: r.name, category: r.category, yield: r.yield, yieldUnit: r.yieldUnit, price: r.price, ovenTemp: r.ovenTemp, times: r.times, tags: r.tags });
    const slimIng = i => ({ id: i.id, name: i.name, category: i.category, pkgPrice: i.pkgPrice, pkgSize: i.pkgSize, pkgUnit: i.pkgUnit, stock: i.stock, minStock: i.minStock });
    const slimOrder = o => {
      const t = C.orderTotals(o);
      return { id: o.id, num: o.num, customerName: o.customerName, phone: o.phone, date: o.date, time: o.time, method: o.method, status: o.status, items: (o.items || []).map(i => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, description: i.description })), total: t.total, paid: t.paid, balance: t.balance, notes: o.notes, allergies: o.allergies, couponCode: o.couponCode };
    };
    const upcoming = s.orders.filter(o => o.date >= today && o.status !== 'cancelled').slice(0, 30).map(slimOrder);
    const recent = s.orders.filter(o => o.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(slimOrder);
    return {
      today,
      settings: { businessName: s.settings.businessName, hourlyRate: s.settings.hourlyRate, targetMargin: s.settings.targetMargin, defaultDeliveryFee: s.settings.defaultDeliveryFee },
      recipes: s.recipes.map(slim),
      ingredients: s.ingredients.map(slimIng),
      orders: { upcoming, recent, totalCount: s.orders.length },
      coupons: (s.coupons || []).map(c => ({ code: c.code, type: c.type, value: c.value, active: c.active, uses: c.uses, maxUses: c.maxUses }))
    };
  }

  function systemPrompt() {
    const snap = stateSnapshot();
    return `את עוזרת ה-AI האישית של הדסה, בעלת מאפייה בשם "על הגשר". את עוזרת לה לנהל את העסק: הזמנות, מתכונים, מחסן, לקוחות, תמחור, קופונים וסטטיסטיקות.

**איך לענות:**
- בעברית, נעימה, ישירה וממוקדת. בלי בירבור.
- ספציפית ומבוססת נתונים — ציטטי מספרי הזמנה, שמות מתכונים, סכומים ותאריכים מתוך הנתונים שלמטה.
- כשחסר מידע, אמרי זאת במפורש במקום לנחש.
- אם הדסה מבקשת ממך לבצע פעולה (למשל "תמחקי את ההזמנה של שרה") — כרגע עדיין אין לך הרשאה לכתיבה, אז תסבירי לה בדיוק מה לעשות ידנית.

**תאריך היום:** ${snap.today}

**נתוני המערכת (snapshot מעודכן):**
\`\`\`json
${JSON.stringify(snap, null, 2)}
\`\`\``;
  }

  async function sendMessage(messages) {
    const r = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: PUB_KEY, authorization: 'Bearer ' + PUB_KEY },
      body: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 2048, system: systemPrompt(), messages })
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data && data.error && (data.error.message || data.error)) || `שגיאה ${r.status}`);
    // תגובה יכולה לכלול thinking + text — חילצי רק את הטקסט
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return text || '(אין תוכן בתגובה)';
  }

  function render(main) {
    const chat = loadChat();
    A.setActions(`<button class="btn ghost sm" data-act="clear">${A.icon('trash')}שיחה חדשה</button>`);
    main.innerHTML = `
      <div class="assistant-wrap">
        <div class="card section" style="padding:12px 16px;display:flex;gap:12px;align-items:center">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--brown);color:var(--cream);display:flex;align-items:center;justify-content:center;font-size:1.3rem">🤖</div>
          <div>
            <h3 style="margin:0">העוזרת של הדסה</h3>
            <p class="small muted" style="margin:0">Claude Opus · רואה את ההזמנות, המתכונים, המחסן והקופונים שלך</p>
          </div>
        </div>
        <div id="chat" class="chat-box">${chat.length ? chat.map(renderMsg).join('') : `<div class="chat-empty"><p class="muted">הי! אני יכולה לעזור לך לנתח הזמנות, להציע מחירים, לזכור מתכונים, לחשב עלויות ורווחיות ועוד.</p><div class="chat-suggestions">${suggestions().map(s => `<button class="btn ghost sm" data-suggest="${U.esc(s)}">${U.esc(s)}</button>`).join('')}</div></div>`}</div>
        <form id="chatForm" class="chat-input">
          <textarea id="chatIn" rows="1" placeholder="מה תרצי לדעת?" autofocus></textarea>
          <button class="btn" type="submit" id="chatSend">${A.icon('msg')}שליחה</button>
        </form>
      </div>`;

    const chatBox = main.querySelector('#chat'), input = main.querySelector('#chatIn'), form = main.querySelector('#chatForm'), sendBtn = main.querySelector('#chatSend');
    chatBox.scrollTop = chatBox.scrollHeight;

    const send = async text => {
      if (!text || sendBtn.disabled) return;
      const messages = loadChat();
      messages.push({ role: 'user', content: text });
      saveChat(messages);
      chatBox.innerHTML = messages.map(renderMsg).join('') + `<div class="msg msg-a loading"><span></span><span></span><span></span></div>`;
      chatBox.scrollTop = chatBox.scrollHeight;
      sendBtn.disabled = true; input.disabled = true;
      try {
        const reply = await sendMessage(messages.map(m => ({ role: m.role, content: m.content })));
        messages.push({ role: 'assistant', content: reply });
        saveChat(messages);
        chatBox.innerHTML = messages.map(renderMsg).join('');
      } catch (e) {
        messages.push({ role: 'assistant', content: '⚠ שגיאה: ' + e.message, error: true });
        saveChat(messages);
        chatBox.innerHTML = messages.map(renderMsg).join('');
      } finally {
        sendBtn.disabled = false; input.disabled = false; input.value = ''; input.style.height = 'auto'; input.focus();
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    };

    form.onsubmit = e => { e.preventDefault(); send(input.value.trim()); };
    input.oninput = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; };
    input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } };
    main.onclick = e => {
      const s = e.target.closest('[data-suggest]'); if (s) { input.value = s.dataset.suggest; send(s.dataset.suggest); return; }
    };
    document.getElementById('topActions').onclick = e => {
      if (e.target.closest('[data-act=clear]')) { saveChat([]); A.refresh(); }
    };
  }

  function renderMsg(m) {
    if (m.role === 'user') return `<div class="msg msg-u">${U.esc(m.content).replace(/\n/g, '<br>')}</div>`;
    const cls = m.error ? 'msg msg-a err' : 'msg msg-a';
    // formatting: bold **x**, code `x`, line breaks
    let html = U.esc(m.content);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return `<div class="${cls}">${html}</div>`;
  }

  function suggestions() {
    const upcoming = A.state.orders.filter(o => o.date >= U.today() && o.status !== 'cancelled').length;
    return [
      upcoming ? `כמה הזמנות יש לי השבוע?` : `אין לי הזמנות פתוחות — מה כדאי לבדוק?`,
      'מה המתכון הכי רווחי שלי?',
      'יש מצרכים שקרובים להיגמר?',
      'איך אפשר להעלות את הרווחיות?'
    ];
  }

  P.assistant = {
    title: 'עוזרת AI',
    render
  };
})(window);
