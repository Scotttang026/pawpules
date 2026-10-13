// src/utils/caseLabels.ts
import i18n, { getApiLang } from '../i18n';
import type { AnimalType, CaseStatus, CaseTag, UrgencyLevel } from '../types';

// 下拉選單、篩選器可以直接用呢啲陣列
export const CASE_STATUSES: CaseStatus[] = ['pending', 'in_progress', 'rescued', 'closed'];
export const URGENCY_LEVELS: UrgencyLevel[] = ['P0', 'P1', 'P2'];
export const ANIMAL_TYPES: AnimalType[] = ['cat', 'dog', 'bird', 'other'];
// 次序 = 顯示次序，亦係寫入「現場狀況」第一行嘅次序；改動要同步 firestore.rules
export const CASE_TAGS: CaseTag[] = ['stray', 'injured', 'trapped', 'juvenile', 'adult'];

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

// 動物篩選（個案頁、地圖共用）：同通報表單一樣只分貓／狗／其他／雀鳥。
// 表單揀「其他／雀鳥」會存做 'other'，舊資料可能係 'bird'，所以 'other' 篩選兩樣都包。
export type AnimalFilter = 'all' | 'cat' | 'dog' | 'other';
export const ANIMAL_FILTERS: Exclude<AnimalFilter, 'all'>[] = ['cat', 'dog', 'other'];

export function matchesAnimalFilter(type: AnimalType, filter: AnimalFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'other') return type === 'other' || type === 'bird';
  return type === filter;
}

// 用返通報表單嘅字眼（「其他／雀鳥」），確保兩邊一致
export function animalFilterLabel(filter: Exclude<AnimalFilter, 'all'>): string {
  return i18n.t(`reportForm.animal.${filter}`, { defaultValue: filter });
}

// 日期跟用戶揀嘅語言格式化，例如「2026年10月7日 下午3:20」或「7 Oct 2026, 3:20 pm」
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(getApiLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function isCaseTag(value: unknown): value is CaseTag {
  return typeof value === 'string' && (CASE_TAGS as string[]).includes(value);
}

export function tagLabel(tag: CaseTag): string {
  return i18n.t(`caseTag.${tag}`, { defaultValue: tag });
}

// 篩選：揀咗幾個標籤就要全部都有（AND），冇揀就全部顯示
export function matchesTagFilter(tags: CaseTag[] | undefined, selected: CaseTag[]): boolean {
  return selected.every((tag) => tags?.includes(tag));
}

// 「現場狀況」第一行，例如「#流浪動物 #幼年」；用當時嘅介面語言
export function buildTagLine(tags: CaseTag[]): string {
  return CASE_TAGS.filter((tag) => tags.includes(tag))
    .map((tag) => `#${tagLabel(tag)}`)
    .join(' ');
}

// 如果第一行全部都係標籤（任何語言），就拎走佢，淨返報案人自己寫嘅內容
export function stripTagLine(description: string): string {
  const [first, ...rest] = description.split('\n');
  const tokens = first.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return description;

  const known = new Set(
    Object.keys(i18n.options.resources ?? {}).flatMap((lng) =>
      CASE_TAGS.map((tag) => `#${i18n.t(`caseTag.${tag}`, { lng })}`)
    )
  );
  return tokens.every((tok) => known.has(tok)) ? rest.join('\n') : description;
}

// 將標籤行放喺第一行（冇標籤就拎走標籤行）
export function applyTagLine(description: string, tags: CaseTag[]): string {
  const body = stripTagLine(description);
  const line = buildTagLine(tags);
  if (!line) return body;
  return `${line}\n${body}`;
}
