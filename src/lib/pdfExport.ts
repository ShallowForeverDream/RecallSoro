import type { Capture, Experience } from '../types';
import { getCompField, getGradeBucket, isAwarded } from './competition';
import { resolveCaptureBlob } from './tauriBridge';
import { blobToDataUrl, renderRedactedBlob } from './redaction';
import { downloadBlob } from './utils';

import type { PDFFont, PDFPage, PDFDocument, RGB } from 'pdf-lib';

/** pdf-lib 体积较大，按需动态加载，避免拖慢应用首屏（这里只保留类型导入）。 */
type PdfColor = RGB;

export interface ProofPdfOptions {
  title: string;
  subtitle?: string;
  applyRedaction: boolean;
  includeImages: boolean;
}

export interface ProofPdfResult {
  totalRecords: number;
  embeddedImages: number;
  fileName: string;
  bytes: number;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;

/** 把中文字体嵌入 PDF；失败时退回内置 Helvetica（中文会缺字但不至于报错）。 */
async function loadCjkFont(
  doc: PDFDocument,
  fontkit: typeof import('@pdf-lib/fontkit'),
): Promise<PDFFont | null> {
  try {
    const { readCjkFontBase64 } = await import('./tauriBridge');
    const base64 = await readCjkFontBase64();
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const kit = (fontkit as unknown as { default?: unknown }).default ?? fontkit;
    doc.registerFontkit(kit as Parameters<PDFDocument['registerFontkit']>[0]);
    return await doc.embedFont(bytes, { subset: true });
  } catch {
    return null;
  }
}

interface TextWriter {
  draw(text: string, x: number, y: number, size: number, color: PdfColor): void;
  width(text: string, size: number): number;
  /** 按实际字体宽度裁剪文本，超出部分用省略号代替 */
  clip(text: string, maxWidth: number, size: number): string;
  /** 按可用宽度折行，返回实际写入的行数 */
  wrap(text: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number, color: PdfColor): number;
}

function makeWriter(page: PDFPage, font: PDFFont | null, fallback: PDFFont): TextWriter {
  const useFont = font ?? fallback;
  return {
    draw(text, x, y, size, color) {
      if (!text) return;
      try {
        page.drawText(text, { x, y, size, font: useFont, color });
      } catch {
        // 内置 Helvetica 遇到中文会抛错，此时静默跳过该段，避免整份 PDF 失败
      }
    },
    width(text, size) {
      try {
        return useFont.widthOfTextAtSize(text, size);
      } catch {
        return text.length * size * 0.5;
      }
    },
    clip(text, maxWidth, size) {
      if (!text) return '';
      if (this.width(text, size) <= maxWidth) return text;
      const chars = Array.from(text);
      let out = '';
      for (const ch of chars) {
        if (this.width(out + ch + '…', size) > maxWidth) break;
        out += ch;
      }
      return out + '…';
    },
    wrap(text, x, y, maxWidth, size, lineHeight, color) {
      const chars = Array.from(text ?? '');
      let line = '';
      let lines = 0;
      let cursorY = y;
      for (const ch of chars) {
        if (ch === '\n') {
          this.draw(line, x, cursorY, size, color);
          lines += 1;
          cursorY -= lineHeight;
          line = '';
          continue;
        }
        const test = line + ch;
        if (this.width(test, size) > maxWidth && line) {
          this.draw(line, x, cursorY, size, color);
          lines += 1;
          cursorY -= lineHeight;
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) {
        this.draw(line, x, cursorY, size, color);
        lines += 1;
      }
      return lines;
    },
  };
}

/** 生成真正可下载的「获奖证明与经历汇编」PDF 文件（不再依赖打印窗口）。 */
export async function exportProofPortfolioPdf(
  experiences: Experience[],
  captures: Capture[],
  options: ProofPdfOptions,
): Promise<ProofPdfResult> {
  const sorted = experiences.slice().sort((a, b) => (b.startAt ?? '').localeCompare(a.startAt ?? ''));

  let aClass = 0;
  let awardedCount = 0;
  for (const e of sorted) {
    if (isAwarded(e)) awardedCount += 1;
    const g = getGradeBucket(getCompField(e, '湖大分级'));
    if (g === 'A1' || g === 'A2') aClass += 1;
  }

  const pdfLib = await import('pdf-lib');
  const fontkitMod = await import('@pdf-lib/fontkit');
  const { PDFDocument, StandardFonts, rgb } = pdfLib;

  const doc = await PDFDocument.create();
  doc.setTitle(options.title);
  doc.setCreator('RecallSoro 个人电子经历总台账');
  doc.setProducer('RecallSoro');

  const cjk = await loadCjkFont(doc, fontkitMod);
  const helv = await doc.embedFont(StandardFonts.Helvetica);

  let embeddedImages = 0;
  // 预先统计含图片佐证的记录数，封面文案据此判断是否真的会脱敏
  const captureMap = new Map(captures.map((c) => [c.id, c]));
  const recordsWithImages = sorted.filter((e) =>
    e.captureIds.some((cid) => {
      const c = captureMap.get(cid);
      return !!c && c.kind === 'image';
    }),
  ).length;
  const stamp = new Date().toISOString().slice(0, 10);
  const ink = rgb(0.12, 0.11, 0.1);
  const muted = rgb(0.42, 0.42, 0.44);
  const accent = rgb(0.55, 0.33, 0.12);
  const rule = rgb(0.82, 0.8, 0.78);

  // ---------- 封面 ----------
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  {
    const w = makeWriter(cover, cjk, helv);
    cover.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.99, 0.985, 0.975) });
    cover.drawRectangle({ x: 0, y: PAGE_H - 12, width: PAGE_W, height: 12, color: accent });
    cover.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 8, color: accent });

    w.draw('PROOF PORTFOLIO', MARGIN, PAGE_H - 150, 11, accent);
    w.draw(options.title, MARGIN, PAGE_H - 190, 26, ink);
    if (options.subtitle) {
      w.wrap(options.subtitle, MARGIN, PAGE_H - 214, PAGE_W - MARGIN * 2, 12, 18, muted);
    }
    cover.drawLine({
      start: { x: MARGIN, y: PAGE_H - 236 },
      end: { x: PAGE_W - MARGIN, y: PAGE_H - 236 },
      thickness: 1,
      color: rule,
    });

    const stats: [string, number][] = [
      ['总记录', sorted.length],
      ['获奖项', awardedCount],
      ['A 类竞赛', aClass],
    ];
    let sx = MARGIN;
    for (const [label, value] of stats) {
      cover.drawRectangle({ x: sx, y: PAGE_H - 320, width: 150, height: 66, color: rgb(1, 1, 1) });
      cover.drawRectangle({ x: sx, y: PAGE_H - 320, width: 3, height: 66, color: accent });
      w.draw(String(value), sx + 16, PAGE_H - 296, 22, ink);
      w.draw(label, sx + 16, PAGE_H - 306, 10, muted);
      sx += 168;
    }

    w.draw(`生成日期 ${stamp}`, MARGIN, MARGIN + 24, 10, muted);
    w.draw(
      options.applyRedaction && recordsWithImages > 0
        ? '本册已应用隐私脱敏（身份证号 / 学号等已遮挡）'
        : options.applyRedaction
          ? '本册未包含佐证图片，无可脱敏内容'
          : '本册为内部留存版本，未应用脱敏',
      MARGIN,
      MARGIN + 10,
      10,
      embeddedImages > 0 && options.applyRedaction ? accent : muted,
    );
  }

  // ---------- 目录表 ----------
  const toc = doc.addPage([PAGE_W, PAGE_H]);
  const rows = sorted.map((e, i) => {
    const scoreRank = [getCompField(e, '成绩'), getCompField(e, '排名')].filter(Boolean).join(' / ') || '—';
    return {
      idx: i + 1,
      date: e.startAt ?? '待确认',
      title: e.title,
      grade: getCompField(e, '湖大分级') || '待确认',
      award: getCompField(e, '奖项') || '—',
      scoreRank,
      issuer: getCompField(e, '颁奖单位') || '—',
    };
  });

  {
    let page = toc;
    let w = makeWriter(page, cjk, helv);
    w.draw('目录表', MARGIN, PAGE_H - 60, 16, ink);
    w.draw('共 ' + rows.length + ' 条记录', PAGE_W - MARGIN - 90, PAGE_H - 58, 10, muted);

    const cols = [
      { key: 'idx', label: '#', width: 22 },
      { key: 'date', label: '时间', width: 58 },
      { key: 'title', label: '名称', width: 216 },
      { key: 'grade', label: '分级', width: 52 },
      { key: 'award', label: '奖项', width: 42 },
      { key: 'scoreRank', label: '成绩/排名', width: 48 },
      { key: 'issuer', label: '颁奖单位', width: 61 },
    ];
    let y = PAGE_H - 88;
    let x = MARGIN;
    page.drawRectangle({ x: MARGIN, y: y - 5, width: PAGE_W - MARGIN * 2, height: 20, color: rgb(0.94, 0.92, 0.9) });
    for (const c of cols) {
      w.draw(c.label, x + 4, y, 9, muted);
      x += c.width;
    }
    y -= 20;

    for (const r of rows) {
      if (y < MARGIN + 18) {
        // 当前页放满，换页继续写表头
        page = doc.addPage([PAGE_W, PAGE_H]);
        w = makeWriter(page, cjk, helv);
        w.draw('目录表（续）', MARGIN, PAGE_H - 60, 14, ink);
        y = PAGE_H - 82;
        page.drawRectangle({ x: MARGIN, y: y - 5, width: PAGE_W - MARGIN * 2, height: 20, color: rgb(0.94, 0.92, 0.9) });
        let hx = MARGIN;
        for (const c of cols) {
          w.draw(c.label, hx + 4, y, 9, muted);
          hx += c.width;
        }
        y -= 20;
      }
      x = MARGIN;
      const values: Record<string, string> = {
        idx: String(r.idx),
        date: r.date,
        title: r.title,
        grade: r.grade,
        award: r.award,
        scoreRank: r.scoreRank,
        issuer: r.issuer,
      };
      for (const c of cols) {
        const text = values[c.key] ?? '';
        // 按真实字体宽度裁剪，确保不串到相邻列
        const clipped = w.clip(text, c.width - 8, 8.6);
        w.draw(clipped, x + 4, y, 8.6, ink);
        x += c.width;
      }
      page.drawLine({
        start: { x: MARGIN, y: y - 4 },
        end: { x: PAGE_W - MARGIN, y: y - 4 },
        thickness: 0.4,
        color: rgb(0.93, 0.92, 0.9),
      });
      y -= 15;
    }
  }

  // ---------- 佐证附页 ----------
  if (options.includeImages) {
    for (const e of sorted) {
      const imageCaps = e.captureIds
        .map((cid) => captureMap.get(cid))
        .filter((c): c is Capture => !!c && c.kind === 'image');
      if (imageCaps.length === 0) continue;

      const prepared: { data: Uint8Array; title: string; redacted: boolean }[] = [];
      for (const cap of imageCaps) {
        const raw = await resolveCaptureBlob(cap);
        if (!raw) continue;
        const redacted = options.applyRedaction && !!cap.redactions?.length;
        const finalBlob = redacted ? await renderRedactedBlob(raw, cap.redactions!) : raw;
        const dataUrl = await blobToDataUrl(finalBlob);
        const base64 = dataUrl.split(',')[1] ?? '';
        prepared.push({
          data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
          title: cap.title,
          redacted,
        });
      }
      if (prepared.length === 0) continue;

      for (const img of prepared) {
        const page = doc.addPage([PAGE_W, PAGE_H]);
        const w = makeWriter(page, cjk, helv);
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });

        const metaLine = [
          e.startAt ?? '时间待确认',
          getCompField(e, '湖大分级'),
          getCompField(e, '奖项'),
          getCompField(e, '排名') || getCompField(e, '成绩'),
          getCompField(e, '颁奖单位'),
        ]
          .filter(Boolean)
          .join(' · ');

        w.draw(e.title, MARGIN, PAGE_H - 58, 15, ink);
        w.wrap(metaLine, MARGIN, PAGE_H - 76, PAGE_W - MARGIN * 2, 10, 14, muted);
        page.drawLine({
          start: { x: MARGIN, y: PAGE_H - 92 },
          end: { x: PAGE_W - MARGIN, y: PAGE_H - 92 },
          thickness: 0.8,
          color: rule,
        });

        // 图片按可用区域等比缩放居中
        let embedded;
        try {
          embedded = await doc.embedJpg(img.data);
        } catch {
          embedded = await doc.embedPng(img.data).catch(() => null);
        }
        if (!embedded) {
          w.draw('（此图片格式无法嵌入 PDF）', MARGIN, PAGE_H - 120, 11, muted);
          continue;
        }
        const maxW = PAGE_W - MARGIN * 2;
        const maxH = PAGE_H - 180;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1.6);
        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;
        const drawX = (PAGE_W - drawW) / 2;
        const drawY = Math.max(MARGIN + 24, (maxH - drawH) / 2 + MARGIN);
        page.drawImage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });
        embeddedImages += 1;

        w.draw(img.title, MARGIN, MARGIN + 10, 9, muted);
        if (img.redacted) {
          w.draw('已应用隐私脱敏', PAGE_W - MARGIN - 78, MARGIN + 10, 9, accent);
        }
      }
    }
  }

  const bytes = await doc.save();
  const fileName = `${options.title}-证明汇编-${stamp}.pdf`;
  downloadBlob(fileName, new Blob([bytes as BlobPart], { type: 'application/pdf' }));

  return { totalRecords: sorted.length, embeddedImages, fileName, bytes: bytes.length };}
