import type { Capture, Experience } from '../types';
import { getCompField, getGradeBucket, isAwarded } from './competition';
import { resolveCaptureBlob } from './tauriBridge';
import { blobToDataUrl, renderRedactedBlob } from './redaction';
import { downloadBlob } from './utils';

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ProofPdfOptions {
  title: string;
  subtitle?: string;
  applyRedaction: boolean;
  includeImages: boolean;
}

/**
 * 生成排版精致的「获奖证明与经历汇编」打印页（支持浏览器/WebView 一键另存为矢量 PDF）
 */
export async function exportProofPortfolioPdf(
  experiences: Experience[],
  captures: Capture[],
  options: ProofPdfOptions,
): Promise<{ totalRecords: number; embeddedImages: number; openedPrintWindow: boolean }> {
  const captureMap = new Map(captures.map((c) => [c.id, c]));
  const sorted = experiences.slice().sort((a, b) => (b.startAt ?? '').localeCompare(a.startAt ?? ''));

  let aClass = 0;
  let awardedCount = 0;
  for (const e of sorted) {
    if (isAwarded(e)) awardedCount += 1;
    const g = getGradeBucket(getCompField(e, '湖大分级'));
    if (g === 'A1' || g === 'A2') aClass += 1;
  }

  let embeddedImages = 0;
  const proofSections: string[] = [];

  if (options.includeImages) {
    for (let idx = 0; idx < sorted.length; idx += 1) {
      const e = sorted[idx];
      const imgTags: string[] = [];
      for (const cid of e.captureIds) {
        const cap = captureMap.get(cid);
        if (!cap || cap.kind !== 'image') continue;
        const rawBlob = await resolveCaptureBlob(cap);
        if (!rawBlob) continue;
        const finalBlob =
          options.applyRedaction && cap.redactions?.length
            ? await renderRedactedBlob(rawBlob, cap.redactions)
            : rawBlob;
        const dataUrl = await blobToDataUrl(finalBlob);
        embeddedImages += 1;
        imgTags.push(
          `<figure class="proof-fig"><img src="${dataUrl}" alt="${esc(cap.title)}" /><figcaption>${esc(cap.title)}${options.applyRedaction && cap.redactions?.length ? '（已应用隐私脱敏）' : ''}</figcaption></figure>`,
        );
      }

      if (imgTags.length > 0) {
        const metaLine = [
          e.startAt ?? '时间待确认',
          getCompField(e, '湖大分级'),
          getCompField(e, '奖项'),
          getCompField(e, '排名') || getCompField(e, '成绩'),
          getCompField(e, '颁奖单位'),
        ]
          .filter(Boolean)
          .join(' · ');
        proofSections.push(`
          <section class="proof-page">
            <div class="proof-head">
              <span class="proof-idx">佐证 #${idx + 1}</span>
              <h2>${esc(e.title)}</h2>
              <p>${esc(metaLine)}</p>
            </div>
            <div class="proof-imgs">${imgTags.join('')}</div>
          </section>
        `);
      }
    }
  }

  const tableRows = sorted
    .map((e, i) => {
      const scoreRank = [getCompField(e, '成绩'), getCompField(e, '排名')].filter(Boolean).join(' / ') || '—';
      return `<tr>
        <td class="num">${i + 1}</td>
        <td class="num">${esc(e.startAt ?? '待确认')}</td>
        <td><strong>${esc(e.title)}</strong></td>
        <td><span class="pill">${esc(getCompField(e, '湖大分级') || '待确认')}</span></td>
        <td>${esc(getCompField(e, '奖项') || '—')}</td>
        <td class="num">${esc(scoreRank)}</td>
        <td>${esc(getCompField(e, '颁奖单位') || '—')}</td>
      </tr>`;
    })
    .join('');

  const stamp = new Date().toISOString().slice(0, 10);
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${esc(options.title)} - 证明汇编</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #1c1917; background: #fff; font-size: 12.5px; line-height: 1.55;
  }
  .toolbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; margin-bottom: 20px; border-radius: 10px;
    background: #f7f6f3; border: 1px solid #e7e5e4;
  }
  .toolbar button {
    background: #3b5bdb; color: #fff; border: 0; padding: 8px 16px;
    border-radius: 8px; font-weight: 600; cursor: pointer;
  }
  .cover {
    border-bottom: 2px solid #1c1917; padding-bottom: 16px; margin-bottom: 18px;
  }
  .cover h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: -0.02em; }
  .cover p { margin: 0; color: #57534e; font-size: 13px; }
  .stats { display: flex; gap: 22px; margin-top: 12px; font-size: 12.5px; }
  .stats strong { font-size: 16px; margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
  th, td { border: 1px solid #d6d3d1; padding: 7px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f4; font-weight: 600; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pill { display: inline-block; padding: 1px 6px; border-radius: 99px; background: #edf2ff; color: #3730a3; font-weight: 600; font-size: 10.5px; }
  .proof-page { page-break-before: always; padding-top: 4px; }
  .proof-head { border-left: 4px solid #3b5bdb; padding-left: 12px; margin-bottom: 14px; }
  .proof-idx { font-size: 11px; color: #3b5bdb; font-weight: 700; }
  .proof-head h2 { margin: 3px 0 4px; font-size: 17px; }
  .proof-head p { margin: 0; color: #57534e; font-size: 12px; }
  .proof-imgs { display: flex; flex-direction: column; gap: 16px; align-items: center; }
  .proof-fig { margin: 0; width: 100%; text-align: center; }
  .proof-fig img { max-width: 100%; max-height: 215mm; object-fit: contain; border: 1px solid #e7e5e4; border-radius: 6px; }
  .proof-fig figcaption { margin-top: 6px; font-size: 11.5px; color: #78716c; }
  @media print {
    body { padding: 0; }
    .toolbar { display: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span><strong>${esc(options.title)}</strong> · 共 ${sorted.length} 条记录，附带 ${embeddedImages} 张证明原图${options.applyRedaction ? '（已启用无损脱敏）' : ''}</span>
    <button onclick="window.print()">打印 / 另存为 PDF</button>
  </div>
  <header class="cover">
    <h1>${esc(options.title)}</h1>
    <p>${esc(options.subtitle || '由 RecallSoro 个人电子经历总台账生成')} · 生成日期 ${stamp}</p>
    <div class="stats">
      <span><strong>${sorted.length}</strong>条总记录</span>
      <span><strong>${awardedCount}</strong>项获奖</span>
      <span><strong>${aClass}</strong>项 A 类</span>
      <span><strong>${embeddedImages}</strong>张佐证附页</span>
    </div>
  </header>
  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th style="width:76px">时间</th>
        <th>名称</th>
        <th style="width:66px">分级</th>
        <th style="width:90px">奖项</th>
        <th style="width:84px">成绩/排名</th>
        <th>颁奖单位</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  ${proofSections.join('\n')}
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=780');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
    return { totalRecords: sorted.length, embeddedImages, openedPrintWindow: true };
  }

  downloadBlob(
    `${options.title}-证明汇编-${stamp}.html`,
    new Blob([html], { type: 'text/html;charset=utf-8' }),
  );
  return { totalRecords: sorted.length, embeddedImages, openedPrintWindow: false };
}
