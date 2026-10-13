import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  onIdTokenChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import i18n from 'i18next';
import { auth, googleProvider, db } from '../firebase';
import type { UserRole } from '../types';

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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_ROLE: RoleInfo = { role: 'user', ngoId: null };

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // 防止舊嘅查詢結果蓋過新嘅（例如快速登出再登入）
  const requestSeq = useRef(0);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      const seq = ++requestSeq.current;
      setUser(u);
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

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    auth.languageCode = i18n.language || 'zh'; // 重設密碼信跟介面語言
    await sendPasswordResetEmail(auth, email.trim());
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
    signInWithGoogle,
    signInWithEmail,
    sendResetEmail,
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
