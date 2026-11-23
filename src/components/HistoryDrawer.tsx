import { useEffect, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import { db, type HistoryRecord } from '../db';
import type { Experience } from '../types';
import { Chip, useToast } from './common';

export function HistoryDrawer({
  entityId,
  onClose,
  onRestore,
}: {
  entityId: string;
  onClose: () => void;
  onRestore: (snapshot: Experience) => Promise<void>;
}) {
  const toast = useToast();
  const [records, setRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    void db.history
      .where('entityId')
      .equals(entityId)
      .reverse()
      .sortBy('createdAt')
      .then((rows) => setRecords(rows.reverse()));
  }, [entityId]);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="row-gap" style={{ marginBottom: 4 }}>
              <History size={15} className="muted" />
              <Chip tone="accent">共 {records.length} 条快照</Chip>
            </div>
            <h2 className="drawer-title">修改历史与版本回溯</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {records.length === 0 ? (
            <p className="muted small">这条记录目前还没有历史修改快照。每次保存时系统都会自动留存一份。</p>
          ) : (
            <div className="history-list">
              {records.map((rec) => {
                const snap = rec.snapshot as Partial<Experience>;
                const timeText = rec.createdAt.replace('T', ' ').slice(0, 19);
                const cf = snap.customFields ?? {};
                const summary = [
                  snap.startAt ? `时间: ${snap.startAt}` : '',
                  cf['湖大分级'] ? `分级: ${cf['湖大分级']}` : '',
                  cf['奖项'] ? `奖项: ${cf['奖项']}` : '',
                  snap.captureIds ? `佐证: ${snap.captureIds.length} 份` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div key={rec.id} className="history-card">
                    <div className="history-card-top">
                      <span className="muted small tabular">{timeText}</span>
                      <button
                        className="btn small"
                        onClick={async () => {
                          await onRestore(snap as Experience);
                          toast('已恢复到该历史版本');
                          onClose();
                        }}
                      >
                        <RotateCcw size={12} /> 恢复此版本
                      </button>
                    </div>
                    <div className="history-card-title">{snap.title || '未命名'}</div>
                    {summary && <div className="muted small">{summary}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
