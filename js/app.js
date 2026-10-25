/* על הגשר — ניווט והפעלה */
(function (root) {
  const A = root.App, U = A.util;
  A.pages = A.pages || {};
  const NAV = [
    ['', 'home', 'בית'], ['orders', 'orders', 'הזמנות'], ['recipes', 'book', 'מתכונים'], ['form', 'link', 'טופס הזמנות'], ['production', 'calendar', 'תכנון ייצור'],
    ['pantry', 'box', 'מחסן ומחירים'], ['customers', 'users', 'לקוחות'], ['expenses', 'wallet', 'הוצאות'],
    'sep', ['stats', 'chart', 'סטטיסטיקות'], ['wheel', 'wheel', 'גלגל החיים'], ['tools', 'scale', 'כלים וממירים'], ['settings', 'settings', 'הגדרות וגיבוי']
  ];
  const TABS = [['', 'home', 'בית'], ['orders', 'orders', 'הזמנות'], ['recipes', 'book', 'מתכונים'], ['stats', 'chart', 'נתונים']];

  A.route = () => {
    const h = location.hash.replace(/^#\/?/, '');
    const [page, ...args] = h.split('/').map(decodeURIComponent);
    return { page: page || '', args };
  };
  A.go = path => { location.hash = '#/' + path; };
  A.setActions = html => { document.getElementById('topActions').innerHTML = html || ''; };

  A.render = () => {
    const { page, args } = A.route();
    const p = A.pages[page] || A.pages[''];
    const main = document.getElementById('main');
    main.onclick = main.oninput = main.onchange = main.onsubmit = null;
    A.setActions('');
    document.getElementById('pageTitle').textContent = typeof p.title === 'function' ? p.title(args) : p.title;
    document.title = (typeof p.title === 'function' ? p.title(args) : p.title) + ' · על הגשר';
    const navKey = page === 'recipe' ? 'recipes' : page;
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === navKey));
    const fresh = A.state.orders.filter(o => o.status === 'new').length;
    document.querySelectorAll('[data-nav="orders"]').forEach(a => { let b = a.querySelector('.nav-badge'); if (!b) { b = document.createElement('i'); b.className = 'nav-badge'; a.appendChild(b); } b.textContent = fresh || ''; b.style.display = fresh ? '' : 'none'; });
    try { p.render(main, args); }
    catch (e) { console.error(e); main.innerHTML = `<div class="card"><h3>משהו השתבש</h3><p class="muted">${U.esc(e.message)}</p></div>`; }
    closeMenu();
  };
  // רענון הדף הנוכחי בלי לאבד גלילה
  A.refresh = () => { const y = root.scrollY; A.render(); root.scrollTo(0, y); };
  A.commit = (msg) => { A.save(); A.refresh(); if (msg) { A.toast(msg); A.haptic && A.haptic(); } };

  const closeMenu = () => { document.getElementById('sidebar').classList.remove('open'); document.querySelector('.scrim').classList.remove('show'); };

  function buildNav() {
    document.getElementById('nav').innerHTML = NAV.map(n => n === 'sep' ? '<div class="sep"></div>' :
      `<a href="#/${n[0]}" data-nav="${n[0]}">${A.icon(n[1])}<span>${n[2]}</span></a>`).join('');
    document.getElementById('tabbar').innerHTML = TABS.map(n => `<a href="#/${n[0]}" data-nav="${n[0]}">${A.icon(n[1])}<span>${n[2]}</span></a>`).join('') +
      `<button data-act="menu">${A.icon('menu')}<span>עוד</span></button>`;
    document.addEventListener('click', e => {
      if (e.target.closest('[data-act="menu"]')) { document.getElementById('sidebar').classList.toggle('open'); document.querySelector('.scrim').classList.toggle('show'); }
      if (e.target.classList.contains('scrim')) closeMenu();
    });
  }

  A.start = async () => {
    buildNav();
    await A.load();
    A.sync && A.sync.init();
    A.form && A.form.init();
    root.addEventListener('hashchange', () => { A.render(); root.scrollTo(0, 0); });
    A.render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  };
  document.addEventListener('DOMContentLoaded', A.start);
})(window);
