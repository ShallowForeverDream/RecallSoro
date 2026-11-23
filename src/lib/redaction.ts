import type { RedactionBox } from '../types';

/**
 * 将无损脱敏遮罩渲染到离屏 Canvas，返回脱敏后的 PNG Blob（绝不修改原图）
 */
export async function renderRedactedBlob(blob: Blob, boxes: RedactionBox[]): Promise<Blob> {
  if (!boxes.length) return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return blob;
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  for (const box of boxes) {
    const x = Math.round(box.x * canvas.width);
    const y = Math.round(box.y * canvas.height);
    const w = Math.max(4, Math.round(box.w * canvas.width));
    const h = Math.max(4, Math.round(box.h * canvas.height));

    // 先做像素马赛克块，再叠加半透明深色遮罩确保彻底不可还原
    const blockSize = Math.max(8, Math.round(Math.min(w, h) / 4));
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let px = x; px < x + w; px += blockSize) {
      for (let py = y; py < y + h; py += blockSize) {
        if (((Math.floor((px - x) / blockSize) + Math.floor((py - y) / blockSize)) & 1) === 0) {
          ctx.fillRect(px, py, Math.min(blockSize, x + w - px), Math.min(blockSize, y + h - py));
        }
      }
    }
  }

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((out) => resolve(out ?? blob), 'image/png');
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
