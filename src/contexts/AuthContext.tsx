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
    return localStorage.getItem('pawpulse_simulate_admin') === 'true';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const isSuperEmail = currentUser.email?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

        // Check or record admin record in Firestore
        let isAdminRole = isSuperEmail;

        try {
          const adminDoc = await getDoc(doc(db, 'adminuser', currentUser.uid));
          if (adminDoc.exists() || isSuperEmail) {
            isAdminRole = true;
            if (isSuperEmail && !adminDoc.exists()) {
              const adminPayload = {
                uid: currentUser.uid,
                email: currentUser.email,
                name: currentUser.displayName || 'Platform Administrator',
                role: 'superadmin',
                createdAt: new Date().toISOString(),
              };
              await setDoc(doc(db, 'adminuser', currentUser.uid), adminPayload);
              setDoc(doc(db, 'admins', currentUser.uid), adminPayload).catch(() => {});
            }
          }
        } catch (e) {
          // If firestore rules prevent read for non-admins, fallback to email check
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
    setSimulatedAdmin(enabled);
    localStorage.setItem('pawpulse_simulate_admin', String(enabled));
    monitoring.log('info', 'auth', `Simulated admin mode toggled: ${enabled}`);
  };

  const effectiveIsAdmin = profile?.isAdmin || simulatedAdmin;

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
