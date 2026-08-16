import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COLLECTIONS, logAuditEvent } from '../services/dbService';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string, role: UserRole, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: UserRole) => Promise<void>;
  isOwnerOrAdmin: boolean;
  isManager: boolean;
  isAccountant: boolean;
  isCashier: boolean;
  isKitchen: boolean;
  isInvestor: boolean;
  hasAccess: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Preset demo accounts for quick role-testing with realistic Tamale Food staff credentials
export const DEMO_PROFILES: Record<UserRole, { email: string; name: string; phone: string }> = {
  'Owner/Admin': {
    email: 'admin@tamalefood.com',
    name: 'Alhaji Sumaila (Owner & MD)',
    phone: '+233 24 100 0001'
  },
  'Manager': {
    email: 'manager@tamalefood.com',
    name: 'Mustapha Iddrisu (Operations Manager)',
    phone: '+233 24 555 1010'
  },
  'Cashier/Sales Staff': {
    email: 'cashier@tamalefood.com',
    name: 'Fatima Zuleiha (POS Lead)',
    phone: '+233 20 555 3030'
  },
  'Kitchen Staff': {
    email: 'kitchen@tamalefood.com',
    name: 'Chef Salifu Mohammed (Head Chef)',
    phone: '+233 24 555 2020'
  },
  'Accountant': {
    email: 'finance@tamalefood.com',
    name: 'Kojo Antwi (Financial Controller)',
    phone: '+233 24 777 8811'
  },
  'Investor': {
    email: 'investor.yakubu@tamaleinvest.org',
    name: 'Dr. Abdul-Rahman Yakubu (Angel Partner)',
    phone: '+233 24 888 9900'
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync profile from Firestore or create baseline profile
  const syncUserProfile = async (user: User, fallbackRole: UserRole = 'Owner/Admin') => {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setUserProfile(data);
      } else {
        // Auto-provision initial profile doc
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || 'user@tamalefood.com',
          displayName: user.displayName || user.email?.split('@')[0] || 'Staff Member',
          role: fallbackRole,
          branchId: 'tamale-central',
          active: true,
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      // Fallback local profile in case of network or permissions issue
      setUserProfile({
        uid: user.uid,
        email: user.email || 'user@tamalefood.com',
        displayName: user.displayName || 'Tamale Staff',
        role: fallbackRole,
        branchId: 'tamale-central',
        active: true,
        createdAt: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await syncUserProfile(user);
      } else {
        // Automatically sign in with default Owner/Admin for immediate frictionless experience if no user
        try {
          const defaultRole: UserRole = 'Owner/Admin';
          const demoInfo = DEMO_PROFILES[defaultRole];
          const cred = await signInWithEmailAndPassword(auth, demoInfo.email, 'TamaleFood2026!').catch(async () => {
            return await createUserWithEmailAndPassword(auth, demoInfo.email, 'TamaleFood2026!');
          });
          if (cred.user) {
            await syncUserProfile(cred.user, defaultRole);
          }
        } catch (e) {
          console.warn('Initial auto-auth fallback triggered:', e);
          // Set a default profile so the app loads seamlessly
          setUserProfile({
            uid: 'admin-guest',
            email: 'admin@tamalefood.com',
            displayName: 'Alhaji Sumaila (Owner & MD)',
            role: 'Owner/Admin',
            branchId: 'tamale-central',
            active: true,
            createdAt: new Date().toISOString()
          });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      await syncUserProfile(cred.user);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, pass: string, name: string, role: UserRole, phone?: string) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const userRef = doc(db, COLLECTIONS.USERS, cred.user.uid);
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        email,
        displayName: name,
        role,
        branchId: 'tamale-central',
        phone,
        active: true,
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, newProfile);
      setUserProfile(newProfile);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setUserProfile(null);
  };

  const switchDemoRole = async (role: UserRole) => {
    setLoading(true);
    try {
      const demo = DEMO_PROFILES[role];
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, demo.email, 'TamaleFood2026!');
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
          userCred = await createUserWithEmailAndPassword(auth, demo.email, 'TamaleFood2026!');
        } else {
          throw err;
        }
      }

      if (userCred && userCred.user) {
        const userRef = doc(db, COLLECTIONS.USERS, userCred.user.uid);
        const profile: UserProfile = {
          uid: userCred.user.uid,
          email: demo.email,
          displayName: demo.name,
          role: role,
          branchId: 'tamale-central',
          phone: demo.phone,
          active: true,
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, profile, { merge: true });
        setUserProfile(profile);
        setCurrentUser(userCred.user);

        await logAuditEvent(
          userCred.user.uid,
          demo.name,
          role,
          'Switched User Role',
          'AUTH',
          `Logged in as ${role} (${demo.name})`
        );
      }
    } catch (err) {
      console.error('Failed to switch demo role:', err);
      // Fallback local override
      const demo = DEMO_PROFILES[role];
      setUserProfile({
        uid: `demo-${role.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        email: demo.email,
        displayName: demo.name,
        role,
        branchId: 'tamale-central',
        phone: demo.phone,
        active: true,
        createdAt: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const role = userProfile?.role;
  const isOwnerOrAdmin = role === 'Owner/Admin';
  const isManager = isOwnerOrAdmin || role === 'Manager';
  const isAccountant = isOwnerOrAdmin || role === 'Accountant';
  const isCashier = isManager || role === 'Cashier/Sales Staff';
  const isKitchen = isManager || role === 'Kitchen Staff';
  const isInvestor = role === 'Investor';

  const hasAccess = (allowedRoles: UserRole[]) => {
    if (!role) return false;
    if (isOwnerOrAdmin) return true;
    return allowedRoles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        signIn,
        signUp,
        signOut,
        switchDemoRole,
        isOwnerOrAdmin,
        isManager,
        isAccountant,
        isCashier,
        isKitchen,
        isInvestor,
        hasAccess
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
