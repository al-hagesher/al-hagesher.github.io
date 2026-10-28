/* על הגשר — ספריית מוזיקה חופשית לסרטונים. כל הקטעים ברישיון CC0 (נחלת הכלל): מותר בשימוש מסחרי, בלי קרדיט.
   מקור: OpenGameArt.org (עמוד כל קטע מצוין ב-src). עובדו: עוצמה אחידה, עד 75 שניות, דעיכה בסוף. */
(function (root) {
  const A = root.App = root.App || {};
  // bpm: null = מוזיקת אווירה בלי ביט ברור (בלי סנכרון חיתוכים)
  A.MUSIC = [
    { id: 'chill-lofi', title: 'לואו־פיי רגוע', mood: 'רגוע · נעים', styles: ['calm', 'recipe'], bpm: 104, dur: 75, author: 'omfgdude', src: 'https://opengameart.org/content/chill-lofi-inspired' },
    { id: 'lofi-hiphop', title: 'לואו־פיי היפ הופ', mood: 'צ׳יל · קצבי', styles: ['rhythm', 'recipe'], bpm: 78, dur: 75, author: 'omfgdude', src: 'https://opengameart.org/content/lofi-hip-hop' },
    { id: 'jazzy-blues', title: 'ג׳אז בלוז', mood: 'שובב · בית קפה', styles: ['rhythm', 'recipe'], bpm: 152, dur: 52.6, author: 'LushoGames', src: 'https://opengameart.org/content/jazzy-blues' },
    { id: 'feel-good-island', title: 'פיל גוד', mood: 'שמח · קליל', styles: ['rhythm', 'reveal'], bpm: 130, dur: 75, author: 'Brandon75689', src: 'https://opengameart.org/content/feel-good-island' },
    { id: 'summers', title: 'קיץ', mood: 'עליז · אופטימי', styles: ['rhythm', 'reveal'], bpm: 104, dur: 75, author: 'symphony', src: 'https://opengameart.org/content/summers' },
    { id: 'green-hills', title: 'גבעות ירוקות', mood: 'שמח · אנרגטי', styles: ['rhythm'], bpm: 81, dur: 75, author: 'Igor Gundarev', src: 'https://opengameart.org/content/green-hills' },
    { id: 'apple-cider', title: 'סיידר תפוחים', mood: 'חמים · גיטרה וחליל', styles: ['calm', 'recipe'], bpm: 100, dur: 75, author: 'Zane Little Music', src: 'https://opengameart.org/content/apple-cider' },
    { id: 'happy-lullaby', title: 'שיר ערש שמח', mood: 'מתוק · פעמונים', styles: ['calm', 'reveal'], bpm: 100, dur: 39.5, author: 'cynicmusic', src: 'https://opengameart.org/content/happy-lullaby-song17' },
    { id: 'calm-piano', title: 'פסנתר שקט', mood: 'אלגנטי · מרגיע', styles: ['cinematic', 'calm'], bpm: null, dur: 75, author: 'cynicmusic', src: 'https://opengameart.org/content/calm-piano-1-vaporware' },
    { id: 'another-august', title: 'עוד אוגוסט', mood: 'חלומי · סינמטי', styles: ['cinematic', 'reveal'], bpm: null, dur: 75, author: 'cynicmusic', src: 'https://opengameart.org/content/another-august' }
  ];
  A.musicUrl = m => `assets/music/${m.id}.mp3`;
})(typeof window !== 'undefined' ? window : globalThis);
