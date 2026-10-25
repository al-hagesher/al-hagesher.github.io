/* על הגשר — החלת ערכת צבעים לפני ציור הדף (מונע הבהוב) */
try { const t = localStorage.getItem('al-hagesher-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { }
