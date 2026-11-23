import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Smartphone, Wifi } from 'lucide-react';
import { db } from '../db';
import type { Capture, Experience } from '../types';
import { extractFacts, humanSize, now, uid } from '../lib/utils';
import {
  isTauriDesktop,
  pollLanDropInbox,
  startLanDrop,
  stopLanDrop,
  type LanDropStatus,
} from '../lib/tauriBridge';
import { setCompField } from '../lib/competition';
import { Chip, Modal, useToast } from './common';
import { QrCode } from './QrCode';

interface ReceivedLog {
  capture: Capture;
  slot: string;
  assignedExpId?: string;
}

export function LanDropModal({
  onClose,
  onReceived,
}: {
  onClose: () => void;
  onReceived?: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<LanDropStatus | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<ReceivedLog[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);

  useEffect(() => {
    void db.experiences.orderBy('updatedAt').reverse().toArray().then(setExperiences);
  }, []);

  useEffect(() => {
    if (!isTauriDesktop()) return;
    let alive = true;
    void startLanDrop()
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });

    const timer = window.setInterval(async () => {
      try {
        const items = await pollLanDropInbox();
        if (!items.length || !alive) return;
        const newlyAdded: ReceivedLog[] = [];
        for (const item of items) {
          let cap = await db.captures.where('sha256').equals(item.sha256).first();
          if (!cap) {
            const kind: Capture['kind'] = item.mimeType.startsWith('image/')
              ? 'image'
              : item.mimeType.startsWith('video/')
                ? 'video'
                : 'file';
            const tags = item.slot && item.slot !== '随手资料' ? [item.slot] : [];
            cap = {
              id: uid(),
              kind,
              originalName: item.originalName,
              mimeType: item.mimeType,
              sizeBytes: item.sizeBytes,
              sha256: item.sha256,
              source: 'mobile_lan',
              capturedAt: undefined,
              importedAt: now(),
              status: 'ready',
              title: item.originalName.replace(/\.[^.]+$/, ''),
              note: item.note,
              tags,
              facts: [],
            };
            cap.facts = extractFacts(cap);
            await db.captures.put(cap);
          }
          newlyAdded.push({ capture: cap, slot: item.slot || '相关图片' });
        }
        if (newlyAdded.length && alive) {
          setLogs((prev) => [...newlyAdded, ...prev]);
          toast(`收到来自手机的 ${newlyAdded.length} 份资料`);
          onReceived?.();
        }
      } catch {
        // ignore transient poll error
      }
    }, 1200);

    return () => {
      alive = false;
      window.clearInterval(timer);
      void stopLanDrop();
    };
  }, [onReceived, toast]);

  const copyUrl = async () => {
    if (!status?.url) return;
    await navigator.clipboard.writeText(status.url);
    setCopied(true);
    toast('已复制局域网上传链接');
    window.setTimeout(() => setCopied(false), 1800);
  };

  const assignToExperience = async (logIdx: number, expId: string) => {
    const entry = logs[logIdx];
    if (!entry || !expId) return;
    const exp = await db.experiences.get(expId);
    if (!exp) return;

    const slotKey = ['证书照片', '奖牌照片', '合照', '相关图片'].includes(entry.slot)
      ? entry.slot
      : '相关图片';
    const prevSlots = exp.evidenceSlots ?? {};
    const nextSlotIds = Array.from(new Set([...(prevSlots[slotKey] ?? []), entry.capture.id]));
    const nextCapIds = Array.from(new Set([...exp.captureIds, entry.capture.id]));

    await db.experiences.put({
      ...exp,
      captureIds: nextCapIds,
      evidenceSlots: { ...prevSlots, [slotKey]: nextSlotIds },
      customFields: setCompField(exp, slotKey, entry.capture.title),
      updatedAt: now(),
    });
    setLogs((prev) =>
      prev.map((l, i) => (i === logIdx ? { ...l, assignedExpId: expId } : l)),
    );
    toast(`已归属到「${exp.title}」的${slotKey}`);
    onReceived?.();
  };

  return (
    <Modal
      title="手机扫码传图"
      subtitle="同一 Wi-Fi 下微信或手机浏览器扫码即传，原图直落本机，不经第三方云端"
      onClose={onClose}
      wide
    >
      {!isTauriDesktop() ? (
        <div className="lan-fallback">
          <Smartphone size={36} />
          <h3>局域网扫码服务需在桌面端运行</h3>
          <p className="muted">
            当前正处于浏览器网页预览模式（<code>pnpm dev</code>）。在本地终端执行{' '}
            <code>pnpm tauri dev</code> 或打开打包后的 RecallSoro 桌面客户端，即可一键开启局域网二维码快传和本地原件落盘。
          </p>
        </div>
      ) : error ? (
        <div className="lan-fallback">
          <h3>启动局域网服务失败</h3>
          <p className="muted">{error}</p>
        </div>
      ) : !status ? (
        <div className="lan-fallback">
          <p className="muted">正在启动本机局域网接收服务…</p>
        </div>
      ) : (
        <div className="lan-grid">
          <div className="lan-qr-card">
            <QrCode value={status.url} size={204} />
            <div className="lan-status-pill">
              <Wifi size={13} />
              <span>服务运行中 · 端口 {status.port}</span>
            </div>
            <div className="lan-url-row">
              <code className="lan-url">{status.url}</code>
              <button className="btn small" onClick={() => void copyUrl()}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <p className="muted small" style={{ textAlign: 'center', marginTop: 6 }}>
              关闭此窗口后链接与 Token 自动失效
            </p>
          </div>

          <div className="lan-feed">
            <div className="panel-head">
              <h3>本次已接收 ({logs.length})</h3>
              <Chip tone="emerald">自动 SHA-256 去重</Chip>
            </div>
            {logs.length === 0 ? (
              <div className="lan-feed-empty">
                <Smartphone size={26} />
                <p>等待手机扫码上传…</p>
                <span className="muted small">
                  拍好的证书、奖牌、合照传上来后，可在这里顺手归属到对应竞赛。
                </span>
              </div>
            ) : (
              <div className="lan-log-list">
                {logs.map((item, idx) => (
                  <div key={`${item.capture.id}-${idx}`} className="lan-log-item">
                    <div className="lan-log-main">
                      <strong>{item.capture.title}</strong>
                      <div className="row-gap" style={{ marginTop: 4 }}>
                        <Chip tone="accent">{item.slot}</Chip>
                        <span className="muted small">{humanSize(item.capture.sizeBytes)}</span>
                        {item.capture.note && (
                          <span className="muted small">· {item.capture.note}</span>
                        )}
                      </div>
                    </div>
                    <div className="lan-log-assign">
                      <Link2 size={13} className="muted" />
                      <select
                        className="select compact"
                        value={item.assignedExpId ?? ''}
                        onChange={(e) => void assignToExperience(idx, e.target.value)}
                      >
                        <option value="">归属到竞赛…</option>
                        {experiences.slice(0, 80).map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.startAt ? `[${e.startAt.slice(0, 7)}] ` : ''}
                            {e.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
