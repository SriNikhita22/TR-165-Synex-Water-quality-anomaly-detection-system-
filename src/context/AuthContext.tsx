import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  addDoc
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// Note: In AI Studio, we try to use the provided config or fallback to demo
import firebaseConfigData from '../../firebase-applet-config.json';

export const firebaseConfig = firebaseConfigData;
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  lastLogin?: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  logAction: (action: string, details?: string, resourceId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

  // Audit Logging
  const logAction = async (action: string, details?: string, resourceId?: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'auditLogs'), {
        timestamp: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
        action,
        details: details || '',
        resourceId: resourceId || ''
      });
    } catch (err) {
      console.error('Failed to log action:', err);
    }
  };

  useEffect(() => {
    // Set persistence to local
    setPersistence(auth, browserLocalPersistence);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch or Initialize Profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          // Update last login
          await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
        } else {
          // Default to VIEWER unless it's the bootstrapped admin
          const defaultRole: UserRole = firebaseUser.email === 'sg5279@srmist.edu.in' ? 'ADMIN' : 'VIEWER';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: defaultRole,
            displayName: firebaseUser.displayName || 'User',
          };
          await setDoc(userRef, { ...newProfile, lastLogin: serverTimestamp() });
          setProfile(newProfile);
        }
        
        await logAction('LOGIN', `User logged in via ${firebaseUser.providerData[0]?.providerId || 'unknown'}`);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Inactivity Timeout
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > TIMEOUT_MS) {
        handleLogout('SESSION_TIMEOUT');
      }
    }, 60000); // Check every minute

    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, [user, lastActivity]);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleLogout = async (reason: string = 'USER_LOGOUT') => {
    if (user) await logAction('LOGOUT', `Logout reason: ${reason}`);
    await signOut(auth);
  };

  const logout = () => handleLogout('USER_LOGOUT');

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, logout, logAction }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
