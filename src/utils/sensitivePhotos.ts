// src/utils/sensitivePhotos.ts
// 血腥／令人不安相片判斷：AI 未檢查（未分析、失敗、超額度、舊資料）一律當有問題
import type { StrayReport } from '../types';

/** AI 標記咗嘅相片位置；null = 未檢查 */
function flaggedPhotos(report: StrayReport): number[] | null {
  const list = report.aiAnalysis?.sensitivePhotos;
  if (!report.aiAnalysis || !Array.isArray(list)) return null;
  return list.filter((n) => Number.isInteger(n) && n >= 0);
}

/** 封面要唔要模糊（個案列表用） */
export function isCoverSensitive(report: StrayReport): boolean {
  const list = flaggedPhotos(report);
  return list === null || list.includes(0);
}

/** 任何一張有問題 → 入詳情要彈警告 */
export function hasSensitivePhotos(report: StrayReport): boolean {
  const list = flaggedPhotos(report);
  return list === null || list.length > 0;
}

/** AI 有冇檢查過（用嚟揀警告文字） */
export function isSensitiveChecked(report: StrayReport): boolean {
  return flaggedPhotos(report) !== null;
}

// 同一個分頁之內確認過就唔再問；關咗分頁會重新問
const ackKey = (caseId: string) => `pawpulse-sensitive-ok-${caseId}`;

export function isSensitiveAcknowledged(caseId: string): boolean {
  try {
    return sessionStorage.getItem(ackKey(caseId)) === '1';
  } catch {
    return false;
  }
}

export function acknowledgeSensitive(caseId: string): void {
  try {
    sessionStorage.setItem(ackKey(caseId), '1');
  } catch {
    // 私密瀏覽等情況寫唔到 sessionStorage，就淨係今次顯示
  }
}
