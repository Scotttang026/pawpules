import type { StrayReport } from '../types';

export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_REPORTER_EDITS = 1;

export type EditState = 'editable' | 'accepted' | 'locked' | 'used' | 'expired';

export function toMillis(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof (v as any).toMillis === 'function') return (v as any).toMillis();
  if (v && typeof (v as any).seconds === 'number') return (v as any).seconds * 1000;
  return 0;
}

// 只係決定顯唔顯示掣；真正權限由 server 檢查
export function getEditState(r: StrayReport, now = Date.now()): EditState {
  if (r.acceptedBy) return 'accepted';
  if (r.status !== 'pending') return 'locked';
  if ((r.editCount ?? 0) >= MAX_REPORTER_EDITS) return 'used';
  const created = toMillis(r.createdAt);
  if (!created || now - created > EDIT_WINDOW_MS) return 'expired';
  return 'editable';
}
