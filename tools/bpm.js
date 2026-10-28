// הערכת קצב (BPM) מקובץ אודיו: ffmpeg → אנרגיה → אוטוקורלציה של התפרצויות. שימוש: node tools/bpm.js file
const { execFileSync } = require('child_process');
const SR = 11025, HOP = 256;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', process.argv[2], '-t', '60', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const n = Math.floor(x.length / HOP), e = new Float32Array(n);
for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < HOP; j++) { const v = x[i * HOP + j]; s += v * v; } e[i] = Math.log1p(s * 100); }
const on = new Float32Array(n); for (let i = 1; i < n; i++) on[i] = Math.max(0, e[i] - e[i - 1]);
const fps = SR / HOP; let best = 0, bestBpm = 0;
for (let bpm = 70; bpm <= 180; bpm += 0.5) {
  const lag = fps * 60 / bpm, L = Math.floor(lag), f = lag - L; let s = 0;
  for (let i = 0; i + L + 1 < n; i++) s += on[i] * (on[i + L] * (1 - f) + on[i + L + 1] * f);
  s /= (n - L); if (s > best) { best = s; bestBpm = bpm; }
}
while (bestBpm < 80) bestBpm *= 2; while (bestBpm > 160) bestBpm /= 2;
console.log(Math.round(bestBpm));
