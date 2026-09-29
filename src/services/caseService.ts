import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StrayReport, CaseStatus, NGOOrganization, AnimalType, UrgencyLevel, AdminUser } from '../types';
import { calculateDistanceKm } from '../utils/location';
import { monitoring } from '../utils/monitoring';

// Primary collection paths as requested by user
export const CASE_COLLECTION = 'case';
export const NGO_COLLECTION = 'ngodatail';
export const ADMIN_COLLECTION = 'adminuser';

// Compatibility mirror collections
const CASES_MIRROR = 'cases';
const NGOS_MIRROR = 'ngos';

/**
 * Real-time listener for stray animal rescue cases directly from Firestore 'case' table.
 */
export function subscribeToCases(
  onUpdate: (cases: StrayReport[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, CASE_COLLECTION));

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
        const geminiResp = data.geminiResponse || data.aiAnalysis || null;

        loadedCases.push({
          id: docSnap.id,
          title: data.title || `通報 #${docSnap.id.slice(0, 6)}`,
          animalType: data.animalType || 'other',
          customAnimalName: data.customAnimalName,
          photoUrl: data.photoUrl || '',
          storagePath: data.storagePath || '',
          location: data.location || { lat: 22.3193, lng: 114.1694, address: '未提供地址' },
          description: data.description || '',
          reporterName: data.reporterName || '熱心市民',
          reporterPhone: data.reporterPhone || '',
          reporterEmail: data.reporterEmail || '',
          createdByUid: data.createdByUid,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          status: data.status || 'pending',
          urgency: data.urgency || 'P1',
          geminiResponse: geminiResp,
          aiAnalysis: geminiResp,
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
 * Save new report into database 'case' table (and mirror to 'cases' for compatibility)
 */
export async function createCaseInFirestore(report: StrayReport): Promise<void> {
  try {
    const caseRef = doc(db, CASE_COLLECTION, report.id);
    const mirrorRef = doc(db, CASES_MIRROR, report.id);

    const payload = {
      id: report.id,
      title: report.title,
      animalType: report.animalType,
      customAnimalName: report.customAnimalName || '',
      photoUrl: report.photoUrl,
      storagePath: report.storagePath || '',
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
      geminiResponse: report.geminiResponse || report.aiAnalysis || null,
      aiAnalysis: report.aiAnalysis || report.geminiResponse || null,
      matchedNGOs: report.matchedNGOs || null,
      dispatchedToNGO: report.dispatchedToNGO || null,
    };

    await setDoc(caseRef, payload);
    // Write mirror non-blocking
    setDoc(mirrorRef, payload).catch(() => {});

    monitoring.log('info', 'firestore', `Created case #${report.id} in case table`, { urgency: report.urgency });
  } catch (err) {
    monitoring.captureError(err, { caseId: report.id });
    handleFirestoreError(err, OperationType.CREATE, `${CASE_COLLECTION}/${report.id}`);
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
    const caseRef = doc(db, CASE_COLLECTION, caseId);
    const mirrorRef = doc(db, CASES_MIRROR, caseId);

    const updatePayload: Record<string, any> = {
      status: newStatus,
      updatedAt: serverTimestamp(),
    };

    if (dispatchedToNGO !== undefined) {
      updatePayload.dispatchedToNGO = dispatchedToNGO;
    }

    await updateDoc(caseRef, updatePayload);
    updateDoc(mirrorRef, updatePayload).catch(() => {});

    monitoring.log('info', 'firestore', `Updated case #${caseId} status to ${newStatus}`);
  } catch (err) {
    monitoring.captureError(err, { caseId, newStatus });
    handleFirestoreError(err, OperationType.UPDATE, `${CASE_COLLECTION}/${caseId}`);
  }
}

/**
 * Admin action: Delete a case
 */
export async function deleteCaseInFirestore(caseId: string): Promise<void> {
  try {
    const caseRef = doc(db, CASE_COLLECTION, caseId);
    await deleteDoc(caseRef);
    deleteDoc(doc(db, CASES_MIRROR, caseId)).catch(() => {});
    monitoring.log('warn', 'firestore', `Deleted case #${caseId} from case table`);
  } catch (err) {
    monitoring.captureError(err, { caseId });
    handleFirestoreError(err, OperationType.DELETE, `${CASE_COLLECTION}/${caseId}`);
  }
}

/**
 * Real-time listener for NGOs directly from Firestore 'ngodatail' table.
 */
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

/**
 * Create or save an NGO to 'ngodatail' table
 */
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
    setDoc(doc(db, NGOS_MIRROR, ngo.id), payload).catch(() => {});

    monitoring.log('info', 'firestore', `Added NGO ${ngo.name} (${ngo.id}) to ngodatail table`);
  } catch (err) {
    monitoring.captureError(err, { ngoId: ngo.id });
    handleFirestoreError(err, OperationType.CREATE, `${NGO_COLLECTION}/${ngo.id}`);
  }
}

/**
 * Delete an NGO from 'ngodatail' table
 */
export async function deleteNGOInFirestore(ngoId: string): Promise<void> {
  try {
    const ngoRef = doc(db, NGO_COLLECTION, ngoId);
    await deleteDoc(ngoRef);
    deleteDoc(doc(db, NGOS_MIRROR, ngoId)).catch(() => {});
    monitoring.log('warn', 'firestore', `Deleted NGO #${ngoId} from ngodatail table`);
  } catch (err) {
    monitoring.captureError(err, { ngoId });
    handleFirestoreError(err, OperationType.DELETE, `${NGO_COLLECTION}/${ngoId}`);
  }
}

/**
 * Update NGO operational capacity status in 'ngodatail'
 */
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
    updateDoc(doc(db, NGOS_MIRROR, ngoId), { capacityStatus, updatedAt: serverTimestamp() }).catch(() => {});

    monitoring.log('info', 'firestore', `Updated NGO ${ngoId} capacity to ${capacityStatus}`);
  } catch (err) {
    monitoring.captureError(err, { ngoId, capacityStatus });
    handleFirestoreError(err, OperationType.UPDATE, `${NGO_COLLECTION}/${ngoId}`);
  }
}

/**
 * Check or register an Admin User in 'adminuser' table
 */
export async function checkAndRegisterAdminUser(
  uid: string,
  email: string | null,
  displayName?: string | null
): Promise<boolean> {
  if (!uid || !email) return false;

  const isConfiguredAdmin = email.toLowerCase() === 'scotttang026jp@gmail.com';

  try {
    const adminDocRef = doc(db, ADMIN_COLLECTION, uid);
    const snap = await getDoc(adminDocRef);

    if (snap.exists()) {
      return true;
    }

    if (isConfiguredAdmin) {
      await setDoc(adminDocRef, {
        uid,
        email,
        name: displayName || 'Platform Administrator',
        role: 'superadmin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      monitoring.log('info', 'auth', `Registered SuperAdmin ${email} into adminuser table`);
      return true;
    }
  } catch (err) {
    console.warn('Error checking admin user record in adminuser table:', err);
  }

  return isConfiguredAdmin;
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
