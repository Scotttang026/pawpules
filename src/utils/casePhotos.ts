import type { CasePhoto, StrayReport } from '../types';

export const MAX_CASE_PHOTOS = 5;

/** 新案件用 photos；舊案件得 photoUrl，就包成一張相嘅陣列 */
export function getCasePhotos(report: Pick<StrayReport, 'photos' | 'photoUrl' | 'storagePath'>): CasePhoto[] {
  if (Array.isArray(report.photos) && report.photos.length > 0) {
    return report.photos.filter((p) => p && typeof p.url === 'string' && p.url);
  }
  return report.photoUrl ? [{ url: report.photoUrl, path: report.storagePath || '' }] : [];
}
