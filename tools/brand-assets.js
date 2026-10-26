// יוצר את נכסי המותג מהלוגו המקורי: לוגו שקוף (חום/שמנת), אייקונים ומסכי פתיחה לאייפון.
// הרצה: node tools/brand-assets.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), A = f => path.join(ROOT, 'assets', f);

/* ---------- PNG ---------- */
function decodePNG(buf) {
  let pos = 8, w, h, ct, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('unsupported png'); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error('color type ' + ct); })();
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = v & 255;
    }
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; out[i] = line[x * bpp]; out[i + 1] = line[x * bpp + 1]; out[i + 2] = line[x * bpp + 2]; out[i + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    prev = line;
  }
  return { w, h, px: out };
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function encodePNG({ w, h, px }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- עיבוד ---------- */
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// מסכת שקיפות מהלוגו (כהה על לבן) — שומר על קצוות רכים
function maskFrom(img) {
  const { w, h, px } = img, m = new Float32Array(w * h);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    let a = (238 - l) / (238 - 70); a = a < 0 ? 0 : a > 1 ? 1 : Math.pow(a, 0.85);
    m[i] = a;
    if (a > 0.12) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { w, h, m, box: [x0, y0, x1, y1] };
}
// הקטנה איכותית (ממוצע אזורי) של מסכה חתוכה
function resizeMask(mk, box, tw, th) {
  const [x0, y0, x1, y1] = box, sw = x1 - x0 + 1, sh = y1 - y0 + 1, out = new Float32Array(tw * th);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = x0 + tx * sw / tw, sx1 = x0 + (tx + 1) * sw / tw, sy0 = y0 + ty * sh / th, sy1 = y0 + (ty + 1) * sh / th;
    let s = 0, n = 0;
    for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) { s += mk.m[y * mk.w + x]; n++; }
    out[ty * tw + tx] = n ? s / n : 0;
  }
  return out;
}
function canvas(w, h, bg) { const px = Buffer.alloc(w * h * 4); if (bg) { const [r, g, b] = hex(bg); for (let i = 0; i < w * h; i++) { px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255; } } return { w, h, px }; }
// רקע חום עם הילה חמה עדינה במרכז (כמו מסך הפתיחה באפליקציה)
function brandBg(w, h) {
  const img = canvas(w, h), [r0, g0, b0] = hex('#2e190c'), [r1, g1, b1] = hex('#5a341c');
  const cx = w * 0.5, cy = h * 0.42, R = Math.max(w, h) * 0.75;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / R), k = t * t * (3 - 2 * t), i = (y * w + x) * 4;
    img.px[i] = r0 + (r1 - r0) * k; img.px[i + 1] = g0 + (g1 - g0) * k; img.px[i + 2] = b0 + (b1 - b0) * k; img.px[i + 3] = 255;
  }
  return img;
}
function stamp(img, mask, mw, mh, ox, oy, color) {
  const [r, g, b] = hex(color);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const a = mask[y * mw + x]; if (!a) continue;
    const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue;
    const i = (Y * img.w + X) * 4, ia = img.px[i + 3] / 255, oa = a + ia * (1 - a);
    img.px[i] = (r * a + img.px[i] * ia * (1 - a)) / (oa || 1); img.px[i + 1] = (g * a + img.px[i + 1] * ia * (1 - a)) / (oa || 1); img.px[i + 2] = (b * a + img.px[i + 2] * ia * (1 - a)) / (oa || 1); img.px[i + 3] = oa * 255;
  }
}

const src = decodePNG(fs.readFileSync(A('logo-full.png'))), mk = maskFrom(src);
const [bx0, by0, bx1, by1] = mk.box, bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, ratio = bh / bw;
const pad = Math.round(bw * 0.02), box = [Math.max(0, bx0 - pad), Math.max(0, by0 - pad), Math.min(src.w - 1, bx1 + pad), Math.min(src.h - 1, by1 + pad)];
const BW = box[2] - box[0] + 1, BH = box[3] - box[1] + 1;
console.log('logo box', box, BW + 'x' + BH);

// לוגו שקוף בשני צבעים
for (const [name, color, width] of [['logo-brown.png', '#4a2a16', 900], ['logo-cream.png', '#f4e8d8', 900]]) {
  const h = Math.round(width * BH / BW), m = resizeMask(mk, box, width, h), img = canvas(width, h);
  stamp(img, m, width, h, 0, 0, color); fs.writeFileSync(A(name), encodePNG(img)); console.log('✓', name);
}
// אייקונים: לוגו שמנת על רקע חום (מתאים גם ל"maskable" — הלוגו בתוך אזור הבטיחות)
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['icon.png', 512]]) {
  const img = brandBg(size, size), lw = Math.round(size * 0.62), lh = Math.round(lw * BH / BW);
  stamp(img, resizeMask(mk, box, lw, lh), lw, lh, Math.round((size - lw) / 2), Math.round((size - lh) / 2), '#f4e8d8');
  fs.writeFileSync(A(name), encodePNG(img)); console.log('✓', name);
}
// מסכי פתיחה לאייפון (apple-touch-startup-image) — זהים למסך הפתיחה באפליקציה
const SPLASH = [[1290, 2796], [1179, 2556], [1284, 2778], [1170, 2532], [1125, 2436], [1242, 2688], [828, 1792], [750, 1334], [1206, 2622], [1320, 2868]];
fs.mkdirSync(A('splash'), { recursive: true });
for (const [w, h] of SPLASH) {
  const img = brandBg(w, h), lw = Math.round(w * 0.56), lh = Math.round(lw * BH / BW);
  stamp(img, resizeMask(mk, box, lw, lh), lw, lh, Math.round((w - lw) / 2), Math.round(h * 0.42 - lh / 2), '#f4e8d8');
  fs.writeFileSync(A(`splash/${w}x${h}.png`), encodePNG(img)); console.log('✓ splash', w + 'x' + h);
}
