import zlib from 'node:zlib';
import fs from 'node:fs';

const SIZE = 512;
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function px(x, y) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = Math.hypot(x - cx, y - cy);
  const inner = r < 150;
  const ring = r > 128 && r < 158;
  let color;
  if (r > 232) color = [0, 0, 0, 0];
  else if (ring) color = [126, 200, 255, 255];
  else if (inner) color = [37, 99, 168, 255];
  else color = [22, 32, 46, 255];

  // a simple "R" glyph in the center
  const gx = x - cx;
  const gy = y - cy;
  const stem = gx > -58 && gx < -34 && gy > -86 && gy < 86;
  const top = gy > -86 && gy < -60 && gx > -58 && gx < 46;
  const mid = gy > -14 && gy < 10 && gx > -58 && gx < 34;
  const bowl = gx > 18 && gx < 48 && gy > -86 && gy < 8;
  const right = gx > 30 && gx < 58 && gy > -14 && gy < 48;
  const leg = gy > 26 && gy < 52 && gx > -20 && gx < 66 && (gx - gy) > -70;
  if (stem || top || mid || bowl || right || leg) color = [255, 255, 255, 255];
  return color;
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0;
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = px(x, y);
    raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = process.argv[2] || 'app-icon.png';
fs.writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
