import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query,
  serverTimestamp, getDoc, writeBatch, DocumentData,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StrayReport, CaseStatus, NGOOrganization, AnimalType, UrgencyLevel } from '../types';
import { calculateDistanceKm } from '../utils/location';
import { monitoring } from '../utils/monitoring';
import { apiFetch } from './api';

export const CASE_COLLECTION = 'case';
export const NGO_COLLECTION = 'ngodatail';
export const ADMIN_COLLECTION = 'adminuser';
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
 * 永遠唔會回傳聯絡資料；冇有效座標嘅舊文件會回傳 null，唔會再塞香港預設座標。
 * 亦唔再讀 matchedNGOs：NGO 推薦一律由 ngodatail 即時計算。
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
    photoUrl: data.photoUrl || '',
    storagePath: data.storagePath || '',
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
 * Save a new report using an atomic batch write:
 *   1. /case/{caseId}                 -> 公開欄位（動物相片、GPS、傷勢描述等）
 *   2. /case/{caseId}/private/contact -> 報案人聯絡資料，只有 admin 可讀
 *
 * ⚠️ 用 writeBatch 確保兩份文件一齊成功或一齊失敗，唔會出現「案件已建立
 * 但聯絡資料遺失」嘅不一致狀態。
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
      photoUrl: report.photoUrl,
      storagePath: report.storagePath || '',
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

    // ⚠️ reporterName / reporterPhone 補返 `|| ''` fallback，避免 undefined
    // 傳入 Firestore 令整個 batch（包括公開案件文件）一齊寫入失敗。
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

/**
 * Admin-only fetch of a case's private contact information.
 *
 * ⚠️ Fail-closed：任何讀取失敗（包括非 admin 被 Rules 拒絕）都回傳 null
 * 而唔係拋出例外，確保呼叫方可以安全預設「未能載入聯絡資料」。
 */
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

export async function updateCaseStatusInFirestore(
  caseId: string,
  newStatus: CaseStatus,
  dispatchedToNGO?: StrayReport['dispatchedToNGO']
): Promise<void> {
  try {
    const caseRef = doc(db, CASE_COLLECTION, caseId);
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updatedAt: serverTimestamp(),
    };
    if (dispatchedToNGO !== undefined) {
      updatePayload.dispatchedToNGO = dispatchedToNGO;
    }
    await updateDoc(caseRef, updatePayload);
    monitoring.log('info', 'firestore', `Updated case #${caseId} status to ${newStatus}`);
  } catch (err) {
    monitoring.captureError(err, { caseId, newStatus });
    handleFirestoreError(err, OperationType.UPDATE, `${CASE_COLLECTION}/${caseId}`);
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
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
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
    const payload = {
      ...ngo,
      capacityStatus: ngo.capacityStatus || 'available',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };
    await setDoc(ngoRef, payload);
    monitoring.log('info', 'firestore', `Added NGO ${ngo.name} (${ngo.id}) to ngodatail table`);
  } catch (err) {
    monitoring.captureError(err, { ngoId: ngo.id });
    handleFirestoreError(err, OperationType.CREATE, `${NGO_COLLECTION}/${ngo.id}`);
  }
}

export async function deleteNGOInFirestore(ngoId: string): Promise<void> {
  try {
    const ngoRef = doc(db, NGO_COLLECTION, ngoId);
    await deleteDoc(ngoRef);
    monitoring.log('warn', 'firestore', `Deleted NGO #${ngoId} from ngodatail table`);
  } catch (err) {
    monitoring.captureError(err, { ngoId });
    handleFirestoreError(err, OperationType.DELETE, `${NGO_COLLECTION}/${ngoId}`);
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
