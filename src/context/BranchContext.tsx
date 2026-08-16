import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../services/dbService';
import { Branch } from '../types';

interface BranchContextType {
  branches: Branch[];
  currentBranchId: string;
  currentBranch: Branch | null;
  setCurrentBranchId: (id: string) => void;
  loading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branches, setBranches] = useState<Branch[]>([
    {
      id: 'tamale-central',
      name: 'Tamale Main Branch - Central Market',
      code: 'TF-CTR',
      address: 'Central Market Road, Tamale',
      phone: '+233 24 111 2233',
      active: true
    },
    {
      id: 'tamale-airport',
      name: 'Tamale Airport Road Branch',
      code: 'TF-AIR',
      address: 'Airport Residential, Tamale',
      phone: '+233 24 444 5566',
      active: true
    },
    {
      id: 'tamale-lamashegu',
      name: 'Tamale Lamashegu Branch',
      code: 'TF-LAM',
      address: 'Near Lamashegu Market, Tamale',
      phone: '+233 24 777 8899',
      active: true
    }
  ]);
  const [currentBranchId, setCurrentBranchId] = useState<string>('all'); // 'all' or specific branchId
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, COLLECTIONS.BRANCHES), (snap) => {
      if (!snap.empty) {
        const branchList: Branch[] = [];
        snap.forEach(doc => branchList.push({ ...doc.data() as Branch, id: doc.id }));
        setBranches(branchList);
      }
      setLoading(false);
    }, (err) => {
      console.warn('Branch listener note:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const currentBranch = branches.find(b => b.id === currentBranchId) || null;

  return (
    <BranchContext.Provider value={{ branches, currentBranchId, currentBranch, setCurrentBranchId, loading }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
};
