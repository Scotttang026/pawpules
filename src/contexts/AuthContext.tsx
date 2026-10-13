import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  onIdTokenChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import i18n from 'i18next';
import { auth, googleProvider, db } from '../firebase';
import type { MemberProfile, UserRole } from '../types';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';

interface RoleInfo {
  role: UserRole;
  ngoId: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  role: UserRole | null; // 未登入 = null
  ngoId: string | null;
  isAdmin: boolean;
  isNgo: boolean;
  profile: MemberProfile | null; // 未填會員資料 = null
  profileLoading: boolean;
  emailVerified: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_ROLE: RoleInfo = { role: 'user', ngoId: null };

/** Firebase 寄信（驗證信、重設密碼信）跟介面語言 */
function applyAuthLanguage() {
  auth.languageCode = (i18n.language || 'zh').startsWith('zh') ? 'zh-TW' : 'en';
}

/**
 * admin：有 adminuser/{uid} 文件
 * ngo：有 ngouser/{uid} 文件（入面有 ngoId）
 * 其他：普通 user；讀取失敗一律當普通 user（fail-closed）
 * ⚠️ 呢度只係決定介面顯示乜，真正權限由 firestore.rules 同 server 檢查
 */
async function resolveRole(u: User): Promise<RoleInfo> {
  const [adminSnap, ngoSnap] = await Promise.all([
    getDoc(doc(db, 'adminuser', u.uid)).catch((err) => {
      console.warn('[Auth] adminuser check failed:', err);
      return null;
    }),
    getDoc(doc(db, 'ngouser', u.uid)).catch((err) => {
      console.warn('[Auth] ngouser check failed:', err);
      return null;
    }),
  ]);

  if (adminSnap?.exists()) return { role: 'admin', ngoId: null };

  const ngoId = ngoSnap?.exists() ? ngoSnap.data().ngoId : null;
  if (typeof ngoId === 'string' && ngoId !== '') return { role: 'ngo', ngoId };

  return USER_ROLE;
}

/** 三個欄位都要係非空字串先當有效，否則當未填 */
function parseProfile(data: unknown): MemberProfile | null {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return null;
  const { firstName, lastName, username, usernameChangedAt } = d;
  if (typeof firstName !== 'string' || typeof lastName !== 'string' || typeof username !== 'string') return null;
  if (!firstName || !lastName || !username) return null;
  return {
    firstName,
    lastName,
    username,
    usernameChangedAt: usernameChangedAt instanceof Timestamp ? usernameChangedAt.toMillis() : null,
  };
}


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // User 物件 reload 後係同一個 reference，React 唔會重新顯示，所以另外記
  const [emailVerified, setEmailVerified] = useState(false);
  // 防止舊嘅查詢結果蓋過新嘅（例如快速登出再登入）
  const requestSeq = useRef(0);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      const seq = ++requestSeq.current;
      setUser(u);
      setEmailVerified(u?.emailVerified ?? false);
      if (!u) {
        setRoleInfo(null);
        setLoading(false);
        return;
      }
      const info = await resolveRole(u);
      if (seq !== requestSeq.current) return;
      setRoleInfo(info);
      setLoading(false);
    });
    return unsub;
  }, []);

  // 會員資料即時訂閱：server 寫入後畫面即刻更新
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const unsub = onSnapshot(
      doc(db, 'userprofiles', uid),
      (snap) => {
        setProfile(snap.exists() ? parseProfile(snap.data()) : null);
        setProfileLoading(false);
      },
      (err) => {
        console.warn('[Auth] profile subscribe failed:', err);
        setProfile(null);
        setProfileLoading(false);
      }
    );
    return unsub;
  }, [uid]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  /** 開帳戶 + 寄驗證信（驗證信寄唔到都唔阻註冊，之後可以重寄） */
  const registerWithEmail = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    applyAuthLanguage();
    try {
      await sendEmailVerification(cred.user);
    } catch (err) {
      console.warn('[Auth] verification email failed:', err);
    }
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    applyAuthLanguage();
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const sendVerification = useCallback(async () => {
    const u = auth.currentUser;
    if (!u || u.emailVerified) return;
    applyAuthLanguage();
    await sendEmailVerification(u);
  }, []);

  /** 重新讀取驗證狀態；驗證咗就換新 token，server 先會知 */
  const reloadUser = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return false;
    await u.reload();
    if (u.emailVerified) await u.getIdToken(true);
    setEmailVerified(u.emailVerified);
    return u.emailVerified;
  }, []);

  const refreshRole = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    const seq = ++requestSeq.current;
    const info = await resolveRole(u);
    if (seq !== requestSeq.current) return;
    setRoleInfo(info);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const role = user ? roleInfo?.role ?? null : null;

  const value: AuthContextValue = {
    user,
    loading,
    role,
    ngoId: user ? roleInfo?.ngoId ?? null : null,
    isAdmin: role === 'admin',
    isNgo: role === 'ngo',
    profile: user ? profile : null,
    profileLoading,
    emailVerified: user ? emailVerified : false,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendResetEmail,
    sendVerification,
    reloadUser,
    refreshRole,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
