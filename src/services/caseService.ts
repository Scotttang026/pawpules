import {
  collection, doc, setDoc, updateDoc, onSnapshot, query,
  serverTimestamp, getDoc, writeBatch, DocumentData,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StrayReport, CaseStatus, NGOOrganization, AnimalType, UrgencyLevel, NgoAccount, CaseAcceptance } from '../types';
import { calculateDistanceKm } from '../utils/location';
import { monitoring } from '../utils/monitoring';
import { isCaseTag } from '../utils/caseLabels';
import { apiFetch } from './api';

export const CASE_COLLECTION = 'case';
export const NGO_COLLECTION = 'ngodatail';
export const ADMIN_COLLECTION = 'adminuser';
export const NGO_USER_COLLECTION = 'ngouser';
export const PRIVATE_SUBCOLLECTION = 'private';
export const CONTACT_DOC_ID = 'contact';

export interface ReporterContactInfo {
  reporterName: string;
  reporterPhone: string;
  reporterEmail: string;
  createdByUid: string;
}

/**
 * 將 Firestore 文件轉換成 StrayReport（公眾版本）。
 * 永遠唔會回傳聯絡資料；冇有效座標嘅文件會回傳 null。
 */
export function docToReport(id: string, data: DocumentData): StrayReport | null {
  const loc = data.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;

  const ai = data.aiAnalysis || data.geminiResponse || null;
  return {
    id,
    title: data.title || `#${id.slice(0, 6)}`,
    animalType: data.animalType || 'other',
    customAnimalName: data.customAnimalName || undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter(isCaseTag) : [],
    photoUrl: data.photoUrl || '',
    storagePath: data.storagePath || '',
    photos: Array.isArray(data.photos)
      ? data.photos
          .filter((p: any) => p && typeof p.url === 'string' && typeof p.path === 'string')
          .map((p: any) => ({ url: p.url, path: p.path }))
      : [],
    location: { lat: loc.lat, lng: loc.lng, address: loc.address || '', district: loc.district },
    description: data.description || '',
    reporterName: '',
    reporterPhone: '',
    reporterEmail: '',
    createdByUid: undefined,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    status: data.status || 'pending',
    urgency: data.urgency || 'P1',
    geminiResponse: ai,
    aiAnalysis: ai,
    dispatchedToNGO: data.dispatchedToNGO || undefined,
    acceptedBy:
      data.acceptedBy && typeof data.acceptedBy.ngoId === 'string'
        ? {
            ngoId: data.acceptedBy.ngoId,
            ngoName: String(data.acceptedBy.ngoName ?? ''),
            acceptedByUid: String(data.acceptedBy.acceptedByUid ?? ''),
            acceptedAt: String(data.acceptedBy.acceptedAt ?? ''),
          }
        : undefined,
  };
}

export function subscribeToCases(
  onUpdate: (cases: StrayReport[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, CASE_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const loaded: StrayReport[] = [];
      snapshot.forEach((d) => {
        const r = docToReport(d.id, d.data());
        if (r) loaded.push(r);
      });
      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(loaded);
    },
    (error) => {
      monitoring.captureError(error, { context: 'subscribeToCases' });
      if (onError) onError(error);
      onUpdate([]);
    }
  );
}

/**
 * 用 batch 一齊寫：
 *   1. /case/{caseId}                 -> 公開欄位
 *   2. /case/{caseId}/private/contact -> 報案人聯絡資料
 * 兩份一齊成功或一齊失敗。
 */
export async function createCaseInFirestore(report: StrayReport): Promise<void> {
  const caseRef = doc(db, CASE_COLLECTION, report.id);
  const contactRef = doc(db, CASE_COLLECTION, report.id, PRIVATE_SUBCOLLECTION, CONTACT_DOC_ID);

  try {
    const batch = writeBatch(db);

    const casePayload = {
      id: report.id,
      title: report.title,
      animalType: report.animalType,
      customAnimalName: report.customAnimalName || '',
      // 冇揀標籤就唔寫呢個欄位（舊案件亦冇）
      ...(report.tags?.length ? { tags: report.tags } : {}),
      photoUrl: report.photoUrl,
      storagePath: report.storagePath || '',
      photos: report.photos.map(({ url, path }) => ({ url, path })),
      location: report.location,
      description: report.description,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'pending',
      urgency: 'P1', // 真正緊急度由 server AI 分析後寫入
      geminiResponse: null,
      aiAnalysis: null,
      dispatchedToNGO: report.dispatchedToNGO || null,
    };

    // 全部 `|| ''`：Firestore 唔接受 undefined，會令成個 batch 失敗
    const contactPayload: ReporterContactInfo & { createdAt: unknown } = {
      reporterName: report.reporterName || '',
      reporterPhone: report.reporterPhone || '',
      reporterEmail: report.reporterEmail || '',
      createdByUid: report.createdByUid || 'anonymous',
      createdAt: serverTimestamp(),
    };

    batch.set(caseRef, casePayload);
    batch.set(contactRef, contactPayload);

    await batch.commit();
    monitoring.log('info', 'firestore', `Created case #${report.id} with separated contact record`, {
      urgency: report.urgency,
    });
  } catch (err) {
    monitoring.captureError(err, { caseId: report.id });
    handleFirestoreError(err, OperationType.CREATE, `${CASE_COLLECTION}/${report.id}`);
  }
}

/** 讀報案人聯絡資料；任何失敗都回 null（fail-closed） */
export async function fetchCaseContact(caseId: string): Promise<ReporterContactInfo | null> {
  try {
    const contactRef = doc(db, CASE_COLLECTION, caseId, PRIVATE_SUBCOLLECTION, CONTACT_DOC_ID);
    const snap = await getDoc(contactRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      reporterName: data.reporterName || '',
      reporterPhone: data.reporterPhone || '',
      reporterEmail: data.reporterEmail || '',
      createdByUid: data.createdByUid || '',
    };
  } catch (err) {
    console.warn(`fetchCaseContact: 無法讀取案件 #${caseId} 嘅聯絡資料（可能冇權限或文件不存在）。`, err);
    monitoring.captureError(err, { caseId, context: 'fetchCaseContact' });
    return null;
  }
}

/** 交由 server 一次過刪除案件、聯絡資料同 Storage 相片（只限 admin） */
export async function deleteCaseInFirestore(caseId: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/cases/${encodeURIComponent(caseId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`);
    monitoring.log('warn', 'firestore', `Deleted case #${caseId} with contact and photo`);
  } catch (err) {
    monitoring.captureError(err, { caseId });
    throw err;
  }
}

export function subscribeToNGOs(
  onUpdate: (ngos: NGOOrganization[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, NGO_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: NGOOrganization[] = [];
      snapshot.forEach((snap) => {
        list.push({ id: snap.id, ...(snap.data() as any) });
      });
      onUpdate(list);
    },
    (error) => {
      monitoring.captureError(error, { context: 'subscribeToNGOs' });
      if (onError) onError(error);
      onUpdate([]);
    }
  );
}

export async function createNGOInFirestore(ngo: NGOOrganization): Promise<void> {
  try {
    const ngoRef = doc(db, NGO_COLLECTION, ngo.id);
    // 配對時計出嚟嘅數值唔儲；undefined 欄位要刪走，否則 Firestore 會拒絕成份文件
    const payload: Record<string, unknown> = { ...ngo, capacityStatus: ngo.capacityStatus || 'available' };
    delete payload.distanceKm;
    delete payload.driveTimeMins;
    delete payload.matchScore;
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }
    payload.updatedAt = serverTimestamp();
    payload.createdAt = serverTimestamp();

    await setDoc(ngoRef, payload);
    monitoring.log('info', 'firestore', `Added NGO ${ngo.name} (${ngo.id}) to ngodatail table`);
  } catch (err) {
    monitoring.captureError(err, { ngoId: ngo.id });
    handleFirestoreError(err, OperationType.CREATE, `${NGO_COLLECTION}/${ngo.id}`);
  }
}

/** 交由 server 刪除機構，連埋佢所有登入帳戶（只限 admin） */
export async function deleteNGOInFirestore(ngoId: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/ngos/${encodeURIComponent(ngoId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete NGO failed: HTTP ${res.status}`);
    monitoring.log('warn', 'firestore', `Deleted NGO #${ngoId} with its login accounts`);
  } catch (err) {
    monitoring.captureError(err, { ngoId });
    throw err;
  }
}

export async function updateNGOCapacity(
  ngoId: string,
  capacityStatus: 'available' | 'busy' | 'full'
): Promise<void> {
  try {
    const ngoRef = doc(db, NGO_COLLECTION, ngoId);
    await updateDoc(ngoRef, {
      capacityStatus,
      updatedAt: serverTimestamp(),
    });
    monitoring.log('info', 'firestore', `Updated NGO ${ngoId} capacity to ${capacityStatus}`);
  } catch (err) {
    monitoring.captureError(err, { ngoId, capacityStatus });
    handleFirestoreError(err, OperationType.UPDATE, `${NGO_COLLECTION}/${ngoId}`);
  }
}

// ---------- 機構登入帳戶（只限 admin） ----------

/** 即時讀取所有機構登入帳戶（rules 只俾 admin 讀晒） */
export function subscribeToNgoAccounts(
  onUpdate: (accounts: NgoAccount[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    collection(db, NGO_USER_COLLECTION),
    (snapshot) => {
      const list: NgoAccount[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (typeof data.ngoId === 'string') {
          list.push({ uid: d.id, email: typeof data.email === 'string' ? data.email : '', ngoId: data.ngoId });
        }
      });
      list.sort((a, b) => a.email.localeCompare(b.email));
      onUpdate(list);
    },
    (error) => {
      monitoring.captureError(error, { context: 'subscribeToNgoAccounts' });
      if (onError) onError(error);
      onUpdate([]);
    }
  );
}

/** 建立（或重寄）機構登入帳戶；失敗會 throw server 嘅錯誤訊息 */
export async function createNgoAccount(
  ngoId: string,
  email: string,
  lang: string
): Promise<{ emailed: boolean; link?: string }> {
  const res = await apiFetch('/api/admin/ngo-accounts', {
    method: 'POST',
    body: JSON.stringify({ ngoId, email, lang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  monitoring.log('info', 'auth', `NGO account ${email} linked to ${ngoId}`);
    return { emailed: data.simulated === false };
}

/** 移除機構登入帳戶（帳戶本身保留，變返普通 user，並即刻登出） */
export async function deleteNgoAccount(uid: string): Promise<void> {
  const res = await apiFetch(`/api/admin/ngo-accounts/${encodeURIComponent(uid)}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  monitoring.log('warn', 'auth', `NGO account ${uid} removed`);
}

// ---------- 接手案件／更新進度（經 server，admin 同 NGO 共用） ----------

/** 帶 HTTP 狀態碼嘅錯誤，例如 409 = 已被其他機構接手 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** 更新案件進度：admin 任何案件；NGO 只可以改自己機構接手咗嘅 */
export async function updateCaseStatus(caseId: string, status: CaseStatus): Promise<void> {
  const res = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  }
  monitoring.log('info', 'firestore', `Updated case #${caseId} status to ${status}`);
}

/** NGO 接手案件；server 用 transaction 防搶，並寄信通知報案人 */
export async function acceptCase(
  caseId: string,
  lang: string
): Promise<{ acceptedBy: CaseAcceptance; emailSent: boolean }> {
  const res = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ lang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  monitoring.log('info', 'firestore', `Case #${caseId} accepted by ${data.acceptedBy?.ngoId}`);
  return { acceptedBy: data.acceptedBy, emailSent: !!data.emailSent };
}

// 訂閱「我的案件」ID 清單：usercases/{uid} 只有本人可讀，由 server 寫入
export function subscribeToMyCaseIds(
  uid: string,
  onChange: (ids: string[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'usercases', uid),
    (snap) => {
      const raw = snap.exists() ? snap.data().caseIds : null;
      onChange(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
    },
    (err) => {
      console.warn('[MyCases] subscribe failed:', err);
      onError?.(err);
    },
  );
}

export function rankFirestoreNGOs(
  ngos: NGOOrganization[],
  caseLat: number,
  caseLng: number,
  animalType: AnimalType,
  urgency: UrgencyLevel
): NGOOrganization[] {
  if (!ngos || ngos.length === 0) return [];
  const scored = ngos.map((ngo) => {
    const distKm = calculateDistanceKm(caseLat, caseLng, ngo.lat, ngo.lng);
    const driveTimeMins = Math.max(5, Math.round(distKm * 2.5));
    let score = 100;
    score -= distKm * 3.5;
    if (ngo.acceptedAnimals && ngo.acceptedAnimals.includes(animalType)) {
      score += 25;
    } else {
      score -= 40;
    }
    if (urgency === 'P0') {
      if (ngo.hasEmergencyRescue) score += 35;
      else score -= 25;
    }
    if (ngo.capacityStatus === 'busy') score -= 15;
    if (ngo.capacityStatus === 'full') score -= 50;
    return {
      ...ngo,
      distanceKm: distKm,
      driveTimeMins,
      matchScore: Math.max(10, Math.min(99, Math.round(score))),
    };
  });
  return scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}
