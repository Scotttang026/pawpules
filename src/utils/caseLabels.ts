// src/utils/caseLabels.ts
import i18n, { getApiLang } from '../i18n';
import type { AnimalType, CaseStatus, UrgencyLevel } from '../types';

// 下拉選單、篩選器可以直接用呢啲陣列
export const CASE_STATUSES: CaseStatus[] = ['pending', 'in_progress', 'rescued', 'closed'];
export const URGENCY_LEVELS: UrgencyLevel[] = ['P0', 'P1', 'P2'];
export const ANIMAL_TYPES: AnimalType[] = ['cat', 'dog', 'bird', 'other'];

export function statusLabel(status: CaseStatus): string {
  return i18n.t(`status.${status}`, { defaultValue: status });
}

export function urgencyLabel(level: UrgencyLevel): string {
  return i18n.t(`urgency.${level}`, { defaultValue: level });
}

// animalType 係 'other' 而報案人有填物種名，就顯示佢填嘅名
export function animalLabel(type: AnimalType, customName?: string): string {
  if (type === 'other' && customName?.trim()) return customName.trim();
  return i18n.t(`animal.${type}`, { defaultValue: type });
}

// 日期跟用戶揀嘅語言格式化，例如「2026年10月7日 下午3:20」或「7 Oct 2026, 3:20 pm」
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(getApiLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}