import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { UserProfile } from '../types';
import { monitoring } from '../utils/monitoring';

// The designated developer / super administrator email from runtime context
const SUPERADMIN_EMAIL = 'scotttang026jp@gmail.com';

// ⚠️ 是否允許啟用「模擬管理員模式」。呢個功能只應該喺開發／測試
// 環境使用（方便冇 Google 帳號都可以試用後台介面），正式部署
// （production build）必須完全停用，否則任何訪客都可以透過瀏覽器
// 開發者工具手動設定 localStorage 令自己喺 UI 層面「變成」管理員
// （雖然 Firestore Rules 依然會拒絕佢實際寫入任何資料，但佢會見到
// 唔應該見到嘅後台管理介面同按鈕）。
const ALLOW_SIMULATED_ADMIN = import.meta.env.DEV === true;

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  simulateAdminMode: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  simulateAdminMode: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulatedAdmin, setSimulatedAdmin] = useState<boolean>(() => {
    if (!ALLOW_SIMULATED_ADMIN) return false;
    return localStorage.getItem('pawpulse_simulate_admin') === 'true';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const isSuperEmail = currentUser.email?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

        let isAdminRole = isSuperEmail;

        try {
          const adminDocRef = doc(db, 'adminuser', currentUser.uid);
          const adminDoc = await getDoc(adminDocRef);

          if (adminDoc.exists()) {
            isAdminRole = true;
          } else if (isSuperEmail) {
            // Bootstrap：首次用超級管理員 email 登入時自動建立
            // adminuser 文件。⚠️ 已移除原本對已廢棄嘅 /admins 路徑
            // 嘅 mirror 寫入 —— 現行 firestore.rules 只保護
            // /adminuser 呢一條路徑，/admins 已經落入預設拒絕規則，
            // 任何寫入嘗試一定會 permission-denied（雖然原本用
            // .catch(() => {}) 靜默吞掉，但依然係冇意義嘅殭屍程式碼）。
            const adminPayload = {
              uid: currentUser.uid,
              email: currentUser.email,
              name: currentUser.displayName || 'Platform Administrator',
              role: 'superadmin' as const,
              createdAt: new Date().toISOString(),
            };
            await setDoc(adminDocRef, adminPayload);
            isAdminRole = true;
          }
        } catch (e) {
          // Firestore 讀取失敗（例如網絡問題），fallback 至 email 判斷
          console.warn('Failed to check adminuser document, falling back to email check:', e);
          isAdminRole = isSuperEmail;
        }

        const userProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          role: isAdminRole ? 'admin' : 'user',
          isAdmin: isAdminRole,
        };

        setProfile(userProfile);
        monitoring.log('info', 'auth', `User signed in: ${currentUser.email}`, { role: userProfile.role });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      monitoring.captureError(err, { action: 'signInWithGoogle' });
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setProfile(null);
      monitoring.log('info', 'auth', 'User signed out');
    } catch (err) {
      monitoring.captureError(err, { action: 'signOut' });
    }
  };

  const simulateAdminMode = (enabled: boolean) => {
    if (!ALLOW_SIMULATED_ADMIN) {
      console.warn('模擬管理員模式已在正式環境停用，此為刻意設計以保護後台介面。');
      return;
    }
    setSimulatedAdmin(enabled);
    localStorage.setItem('pawpulse_simulate_admin', String(enabled));
    monitoring.log('info', 'auth', `Simulated admin mode toggled: ${enabled}`);
  };

  const effectiveIsAdmin = profile?.isAdmin || (ALLOW_SIMULATED_ADMIN && simulatedAdmin);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: effectiveIsAdmin,
        signInWithGoogle,
        signOut,
        simulateAdminMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
