import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StrayReport, CaseStatus, NGOOrganization, AnimalType, UrgencyLevel } from '../types';
import { calculateDistanceKm } from '../utils/location';
import { monitoring } from '../utils/monitoring';

const CASES_PATH = 'cases';
const NGOS_PATH = 'ngos';

/**
 * Real-time listener for stray animal rescue cases directly from Firestore.
 * If no cases exist in Firestore, updates with an empty array [].
 */
export function subscribeToCases(
  onUpdate: (cases: StrayReport[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, CASES_PATH));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const loadedCases: StrayReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedCases.push({
          id: docSnap.id,
          title: data.title || `通報 #${docSnap.id.slice(0, 6)}`,
          animalType: data.animalType || 'other',
          customAnimalName: data.customAnimalName,
          photoUrl: data.photoUrl || '',
          location: data.location || { lat: 22.3193, lng: 114.1694, address: '未提供地址' },
          description: data.description || '',
          reporterName: data.reporterName || '熱心市民',
          reporterPhone: data.reporterPhone || '',
          reporterEmail: data.reporterEmail || '',
          createdByUid: data.createdByUid,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          status: data.status || 'pending',
          urgency: data.urgency || 'P1',
          aiAnalysis: data.aiAnalysis,
          matchedNGOs: data.matchedNGOs,
          dispatchedToNGO: data.dispatchedToNGO,
        });
      });

      // Sort newest first
      loadedCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(loadedCases);
    },
    (error) => {
      monitoring.captureError(error, { context: 'subscribeToCases' });
      if (onError) onError(error);
      onUpdate([]);
    }
  );
}

/**
 * Save new report to Firestore
 */
export async function createCaseInFirestore(report: StrayReport): Promise<void> {
  try {
    const caseRef = doc(db, CASES_PATH, report.id);
    const payload = {
      id: report.id,
      title: report.title,
      animalType: report.animalType,
      customAnimalName: report.customAnimalName || '',
      photoUrl: report.photoUrl,
      location: report.location,
      description: report.description,
      reporterName: report.reporterName,
      reporterPhone: report.reporterPhone,
      reporterEmail: report.reporterEmail || '',
      createdByUid: report.createdByUid || 'anonymous',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: report.status,
      urgency: report.urgency,
      aiAnalysis: report.aiAnalysis || null,
      matchedNGOs: report.matchedNGOs || null,
      dispatchedToNGO: report.dispatchedToNGO || null,
    };

    await setDoc(caseRef, payload);
    monitoring.log('info', 'firestore', `Created case #${report.id}`, { urgency: report.urgency });
  } catch (err) {
    monitoring.captureError(err, { caseId: report.id });
    handleFirestoreError(err, OperationType.CREATE, `${CASES_PATH}/${report.id}`);
  }
}

/**
 * Update case rescue status
 */
export async function updateCaseStatusInFirestore(
  caseId: string,
  newStatus: CaseStatus,
  dispatchedToNGO?: StrayReport['dispatchedToNGO']
): Promise<void> {
  try {
    const caseRef = doc(db, CASES_PATH, caseId);
    const updatePayload: Record<string, any> = {
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
    handleFirestoreError(err, OperationType.UPDATE, `${CASES_PATH}/${caseId}`);
  }
}

/**
 * Admin action: Delete a case
 */
export async function deleteCaseInFirestore(caseId: string): Promise<void> {
  try {
    const caseRef = doc(db, CASES_PATH, caseId);
    await deleteDoc(caseRef);
    monitoring.log('warn', 'firestore', `Deleted case #${caseId}`);
  } catch (err) {
    monitoring.captureError(err, { caseId });
    handleFirestoreError(err, OperationType.DELETE, `${CASES_PATH}/${caseId}`);
  }
}

/**
 * Real-time listener for NGOs directly from Firestore.
 * If no NGOs exist in Firestore, updates with an empty array [].
 */
export function subscribeToNGOs(
  onUpdate: (ngos: NGOOrganization[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, NGOS_PATH));

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

/**
 * Create or save an NGO to Firestore
 */
export async function createNGOInFirestore(ngo: NGOOrganization): Promise<void> {
  try {
    const ngoRef = doc(db, NGOS_PATH, ngo.id);
    await setDoc(ngoRef, {
      ...ngo,
      capacityStatus: ngo.capacityStatus || 'available',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    monitoring.log('info', 'firestore', `Added NGO ${ngo.name} (${ngo.id}) to Firestore`);
  } catch (err) {
    monitoring.captureError(err, { ngoId: ngo.id });
    handleFirestoreError(err, OperationType.CREATE, `${NGOS_PATH}/${ngo.id}`);
  }
}

/**
 * Delete an NGO from Firestore
 */
export async function deleteNGOInFirestore(ngoId: string): Promise<void> {
  try {
    const ngoRef = doc(db, NGOS_PATH, ngoId);
    await deleteDoc(ngoRef);
    monitoring.log('warn', 'firestore', `Deleted NGO #${ngoId} from Firestore`);
  } catch (err) {
    monitoring.captureError(err, { ngoId });
    handleFirestoreError(err, OperationType.DELETE, `${NGOS_PATH}/${ngoId}`);
  }
}

/**
 * Update NGO operational capacity status in Firestore
 */
export async function updateNGOCapacity(
  ngoId: string,
  capacityStatus: 'available' | 'busy' | 'full'
): Promise<void> {
  try {
    const ngoRef = doc(db, NGOS_PATH, ngoId);
    await updateDoc(ngoRef, {
      capacityStatus,
      updatedAt: serverTimestamp(),
    });
    monitoring.log('info', 'firestore', `Updated NGO ${ngoId} capacity to ${capacityStatus}`);
  } catch (err) {
    monitoring.captureError(err, { ngoId, capacityStatus });
    handleFirestoreError(err, OperationType.UPDATE, `${NGOS_PATH}/${ngoId}`);
  }
}

/**
 * Rank Firestore NGOs for a specific case by geographic distance, species specialty, and urgency
 */
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
    // Distance penalty
    score -= distKm * 3.5;

    // Animal type acceptance check
    if (ngo.acceptedAnimals && ngo.acceptedAnimals.includes(animalType)) {
      score += 25;
    } else {
      score -= 40;
    }

    // Urgency matching
    if (urgency === 'P0') {
      if (ngo.hasEmergencyRescue) score += 35;
      else score -= 25;
    }

    // Capacity status
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
