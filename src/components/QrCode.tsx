import { useMemo } from 'react';

/**
 * 零依赖 ISO/IEC 18004 QR Code 编码器（Byte 模式，容错级别 M，支持 Version 1–6，覆盖最多 106 字节 URL）
 */
const EC_CODEWORDS_M = [0, 10, 16, 26, 36, 48, 64];
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172];
const NUM_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4];
const ALIGN_POS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEcc(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGeneratorPoly(eccLen);
  const rem = new Uint8Array(eccLen);
  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[eccLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < eccLen; j += 1) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

export function generateQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);
  let version = 1;
  while (version <= 6) {
    const dataCap = TOTAL_CODEWORDS[version] - EC_CODEWORDS_M[version];
    // 4 bits mode + 8 bits len + 8*N data + 4 bits terminator
    if (utf8.length + 2 <= dataCap) break;
    version += 1;
  }
  if (version > 6) version = 6;

  const totalCw = TOTAL_CODEWORDS[version];
  const ecCw = EC_CODEWORDS_M[version];
  const dataCw = totalCw - ecCw;
  const numBlocks = NUM_BLOCKS_M[version];

  // 1. 组装比特流
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4); // Byte mode
  pushBits(utf8.length, 8);
  for (const b of utf8) pushBits(b, 8);

  const maxBits = dataCw * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(dataCw);
  for (let i = 0; i < bits.length / 8 && i < dataCw; i += 1) {
    let v = 0;
    for (let j = 0; j < 8; j += 1) v = (v << 1) | bits[i * 8 + j];
    dataBytes[i] = v;
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  for (let i = Math.floor(bits.length / 8); i < dataCw; i += 1) {
    dataBytes[i] = padBytes[padIdx % 2];
    padIdx += 1;
  }

  // 2. 分块计算 RS 纠错码并交织
  const ecPerBlock = ecCw / numBlocks;
  const shortBlockDataLen = Math.floor(dataCw / numBlocks);
  const numLongBlocks = dataCw % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b += 1) {
    const len = shortBlockDataLen + (b >= numShortBlocks ? 1 : 0);
    const slice = dataBytes.subarray(offset, offset + len);
    offset += len;
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeEcc(slice, ecPerBlock));
  }

  const finalCodewords: number[] = [];
  const maxBlockLen = shortBlockDataLen + (numLongBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i += 1) {
    for (let b = 0; b < numBlocks; b += 1) {
      if (i < dataBlocks[b].length) finalCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (let b = 0; b < numBlocks; b += 1) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // 3. 构建矩阵与功能图形
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = dark;
    isFunc[r][c] = true;
  };

  const drawFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        setFunc(r, c, dist !== 2 && dist !== 4);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 0; i < size; i += 1) {
    if (!isFunc[6][i]) setFunc(6, i, i % 2 === 0);
    if (!isFunc[i][6]) setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const aligns = ALIGN_POS[version];
  for (const r of aligns) {
    for (const c of aligns) {
      if (isFunc[r][c]) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          setFunc(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = size - 8; i < size; i += 1) {
    setFunc(8, i, false);
    setFunc(i, 8, false);
  }
  setFunc(size - 8, 8, true); // Dark module

  // 4. 填充数据位并应用 Mask 0: (r + c) % 2 === 0
  let bitIndex = 0;
  const totalBits = finalCodewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const c = right - j;
        if (isFunc[r][c]) continue;
        let bit = false;
        if (bitIndex < totalBits) {
          bit = ((finalCodewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex += 1;
        }
        if ((r + c) % 2 === 0) bit = !bit;
        modules[r][c] = bit;
      }
    }
    upward = !upward;
  }

  // 5. 写入格式信息（ECC Level M = 00, Mask 0 = 000 -> 5-bit = 00000 -> BCH+XOR = 0x5412）
  const formatBits = 0x5412;
  for (let i = 0; i <= 5; i += 1) setFunc(8, i, ((formatBits >> (14 - i)) & 1) === 1);
  setFunc(8, 7, ((formatBits >> 8) & 1) === 1);
  setFunc(8, 8, ((formatBits >> 7) & 1) === 1);
  setFunc(7, 8, ((formatBits >> 6) & 1) === 1);
  for (let i = 9; i < 15; i += 1) setFunc(14 - i, 8, ((formatBits >> (14 - i)) & 1) === 1);

  for (let i = 0; i < 8; i += 1) setFunc(size - 1 - i, 8, ((formatBits >> (14 - i)) & 1) === 1);
  for (let i = 8; i < 15; i += 1) setFunc(8, size - 15 + i, ((formatBits >> (14 - i)) & 1) === 1);

  return modules;
}

export function QrCode({ value, size = 196 }: { value: string; size?: number }) {
  const matrix = useMemo(() => generateQrMatrix(value), [value]);
  const n = matrix.length;
  const quiet = 3;
  const viewSize = n + quiet * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      shapeRendering="crispEdges"
      className="qr-svg"
      role="img"
      aria-label="局域网扫码传图二维码"
    >
      <rect width={viewSize} height={viewSize} fill="#ffffff" rx="0.6" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1} height={1} fill="#1c1917" />
          ) : null,
        ),
      )}
    </svg>
  );
}
