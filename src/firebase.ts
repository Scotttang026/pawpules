import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Services
/* CRITICAL: Explicit firestoreDatabaseId is required by AI Studio environment */
if (!firebaseConfig.firestoreDatabaseId) {
  console.warn(
    'firebase.ts: firestoreDatabaseId 未設定，可能會連接到錯誤的 Firestore database。'
  );
}
// ignoreUndefinedProperties：自動略過值為 undefined 嘅欄位，唔會令整個寫入失敗
export const db = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Standardized Firestore error logger.
 *
 * ⚠️ 已修正私隱洩漏問題：完整結構化資訊（含 email／uid）只會寫入
 * console.error（畀開發者喺伺服器端 log 睇），但拋出畀呼叫方嗰個
 * Error 只帶簡短、唔含 PII 嘅訊息，避免呢啲個人資訊經由 UI 顯示
 * 或者第三方監控工具（例如 Sentry）意外外洩。
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };

  // 完整資訊只留喺伺服器端／開發者 console，唔會外洩
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // 拋出畀呼叫方嗰個 Error 唔含任何 PII
  throw new Error(`Firestore ${operationType} failed at ${path ?? 'unknown path'}`);
}
