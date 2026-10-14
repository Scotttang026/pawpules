import type { CasePhoto, StrayReport } from '../types';

/** 案件同時顯示最多 5 張（第 1 張係封面） */
export const MAX_CASE_PHOTOS = 5;
/** Storage 每宗案件最多 10 個位（0–9.jpg）：報案 5 張 + 修改時新增 5 張 */
export const MAX_STORED_PHOTOS = 10;

/** 新案件用 photos；舊案件得 photoUrl，就包成一張相嘅陣列 */
export function getCasePhotos(report: Pick<StrayReport, 'photos' | 'photoUrl' | 'storagePath'>): CasePhoto[] {
  if (Array.isArray(report.photos) && report.photos.length > 0) {
    return report.photos.filter((p) => p && typeof p.url === 'string' && p.url);
  }
  return report.photoUrl ? [{ url: report.photoUrl, path: report.storagePath || '' }] : [];
}
