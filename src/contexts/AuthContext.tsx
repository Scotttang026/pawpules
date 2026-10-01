import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  simulateAdminMode: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const ADMIN_COLLECTION = 'adminuser';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // ⚠️ Fail-closed：admin 身份完全由 Firestore `adminuser/{uid}` 文件是否
      // 存在決定。讀取失敗（網絡問題、Rules 拒絕、文件根本不存在）一律視為
      // 非管理員，絕對唔會再用 email 字串比對做後備判斷。
      try {
        const snap = await getDoc(doc(db, ADMIN_COLLECTION, firebaseUser.uid));
        setIsAdmin(snap.exists());
      } catch (err) {
        console.warn('AuthContext: 無法確認 admin 身份，預設視為非管理員。', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const profile: UserProfile | null = user
    ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: isAdmin ? 'admin' : 'user',
        isAdmin,
      }
    : null;

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  /**
   * ⚠️ 開發輔助工具，僅供本機開發環境使用。AdminDashboard.tsx 嘅
   * 「模擬管理員登入」按鈕會呼叫此函式，讓未被登記喺 adminuser
   * collection 嘅開發者帳號可以在本機預覽後台畫面，唔需要每次都
   * 手動去 Firebase Console 新增 adminuser 文件。
   *
   * 防禦設計：函式內部再次檢查 import.meta.env.DEV，即使呼叫方
   * 嘅判斷被繞過（例如打包設定出錯），生產環境下呼叫此函式依然
   * 會被拒絕並只在 console 留下警告，絕對唔會令 isAdmin 被意外
   * 設為 true，避免呢個開發工具變成隱藏嘅權限後門。
   */
  const simulateAdminMode = (enabled: boolean) => {
    if (import.meta.env.DEV !== true) {
      console.warn('AuthContext: simulateAdminMode 僅可在開發環境 (import.meta.env.DEV) 使用，此次呼叫已被忽略。');
      return;
    }
    setIsAdmin(enabled);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, isAdmin, loading, signInWithGoogle, signOut, simulateAdminMode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
