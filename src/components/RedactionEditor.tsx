import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Download, Eye, EyeOff, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { db } from '../db';
import type { Capture, RedactionBox } from '../types';
import { downloadBlob, recordHistory, uid } from '../lib/utils';
import { resolveCaptureBlob } from '../lib/tauriBridge';
import { renderRedactedBlob } from '../lib/redaction';
import { Modal, useToast } from './common';

export function RedactionEditor({
  capture,
  onClose,
  onSaved,
}: {
  capture: Capture;
  onClose: () => void;
  onSaved?: (next: Capture) => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [boxes, setBoxes] = useState<RedactionBox[]>(capture.redactions ?? []);
  const [hideMasks, setHideMasks] = useState(false);
  const [drawing, setDrawing] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let objUrl = '';
    void resolveCaptureBlob(capture).then((blob) => {
      if (!active || !blob) return;
      setRawBlob(blob);
      objUrl = URL.createObjectURL(blob);
      setUrl(objUrl);
    });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [capture]);

  const toRel = (e: MouseEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onMouseDown = (e: MouseEvent) => {
    if (hideMasks) return;
    const p = toRel(e);
    setDrawing({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!drawing) return;
    const p = toRel(e);
    setDrawing({ ...drawing, x1: p.x, y1: p.y });
  };

  const onMouseUp = () => {
    if (!drawing) return;
    const x = Math.min(drawing.x0, drawing.x1);
    const y = Math.min(drawing.y0, drawing.y1);
    const w = Math.abs(drawing.x1 - drawing.x0);
    const h = Math.abs(drawing.y1 - drawing.y0);
    if (w >= 0.015 && h >= 0.015) {
      setBoxes((prev) => [...prev, { id: uid(), x, y, w, h }]);
    }
    setDrawing(null);
  };

  const saveMasks = async () => {
    await recordHistory('capture', capture.id, capture);
    const updated: Capture = { ...capture, redactions: boxes };
    await db.captures.put(updated);
    onSaved?.(updated);
    toast(`已保存 ${boxes.length} 处无损脱敏遮罩（原图未被修改）`);
  };

  const exportRedacted = async () => {
    if (!rawBlob) {
      toast('原图尚未加载完成');
      return;
    }
    const out = await renderRedactedBlob(rawBlob, boxes);
    downloadBlob(`${capture.title}-脱敏版.png`, out);
    toast('已导出脱敏版 PNG');
  };

  const draftRect = drawing
    ? {
        left: `${Math.min(drawing.x0, drawing.x1) * 100}%`,
        top: `${Math.min(drawing.y0, drawing.y1) * 100}%`,
        width: `${Math.abs(drawing.x1 - drawing.x0) * 100}%`,
        height: `${Math.abs(drawing.y1 - drawing.y0) * 100}%`,
      }
    : null;

  return (
    <Modal
      title="无损隐私脱敏画板"
      subtitle="在图片上按住鼠标拖拽框选身份证号、学号或二维码，原件永远保持完整无损"
      onClose={onClose}
      wide
    >
      <div className="redact-toolbar">
        <div className="row-gap">
          <span className="small muted">
            <ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
            已标记 <strong>{boxes.length}</strong> 处脱敏区域
          </span>
        </div>
        <div className="row-gap">
          <button className="btn small" onClick={() => setHideMasks((v) => !v)}>
            {hideMasks ? <Eye size={13} /> : <EyeOff size={13} />}
            {hideMasks ? '显示遮罩' : '透视原图'}
          </button>
          <button
            className="btn small ghost"
            disabled={boxes.length === 0}
            onClick={() => setBoxes([])}
          >
            <RotateCcw size={13} /> 清空全部
          </button>
        </div>
      </div>

      <div className="redact-stage-wrap">
        {!url ? (
          <p className="muted">正在加载原图…</p>
        ) : (
          <div
            ref={stageRef}
            className="redact-stage"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <img src={url} alt={capture.title} draggable={false} />
            {!hideMasks &&
              boxes.map((b) => (
                <div
                  key={b.id}
                  className="redact-box"
                  style={{
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.w * 100}%`,
                    height: `${b.h * 100}%`,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="redact-box-del"
                    title="移除此遮罩"
                    onClick={() => setBoxes((prev) => prev.filter((x) => x.id !== b.id))}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            {draftRect && <div className="redact-box drafting" style={draftRect} />}
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={() => void exportRedacted()}>
          <Download size={14} /> 导出脱敏 PNG
        </button>
        <button className="btn primary" onClick={() => void saveMasks()}>
          <Save size={14} /> 保存无损遮罩
        </button>
      </div>
    </Modal>
  );
}
