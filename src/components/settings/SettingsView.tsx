import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Building2, 
  Plus, 
  Settings as SettingsIcon, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert, 
  Database, 
  Store,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, seedInitialTamaleFoodData, logAuditEvent } from '../../services/dbService';
import { Branch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export const SettingsView: React.FC = () => {
  const { userProfile, isOwnerOrAdmin } = useAuth();
  const { branches, reloadBranches } = useBranch();
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // New Branch Modal
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchManager, setBranchManager] = useState('');

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin || !userProfile) return;

    try {
      const id = branchCode.toLowerCase().replace(/[^a-z0-9]/g, '-') || `branch-${Date.now()}`;
      const branchRef = doc(db, COLLECTIONS.BRANCHES, id);

      const newBranch: Branch = {
        id,
        name: branchName,
        code: branchCode.toUpperCase(),
        address: branchAddress,
        phone: branchPhone,
        managerName: branchManager,
        active: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(branchRef, newBranch);

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Owner',
        userProfile.role,
        'Branch Created',
        'SETTINGS',
        `Opened new business branch: ${branchName} (${branchCode})`,
        id
      );

      setIsBranchModalOpen(false);
      setBranchName('');
      setBranchCode('');
      setBranchAddress('');
      setBranchPhone('');
      setBranchManager('');
      reloadBranches();
    } catch (err) {
      console.error('Error creating branch:', err);
    }
  };

  const handleReSeedDatabase = async () => {
    if (!window.confirm('Restore initial Tamale Food catalog, recipes, and sample data in Firestore?')) return;
    setSeeding(true);
    try {
      await seedInitialTamaleFoodData();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 5000);
      reloadBranches();
    } catch (err) {
      console.error('Error seeding:', err);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div id="settings-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">System Settings & Multi-Branch Hub</h2>
          <p className="text-xs text-stone-500">Configure branch outlets, localized POS settings, and database management</p>
        </div>

        {isOwnerOrAdmin && (
          <button
            onClick={() => setIsBranchModalOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Business Outlet / Branch</span>
          </button>
        )}
      </div>

      {/* Multi-Branch Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
          <Store className="w-4 h-4 text-amber-600" />
          <span>Active Restaurant Outlets ({branches.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">{b.name}</h4>
                  <span className="inline-block px-2 py-0.5 rounded bg-stone-100 font-mono text-[10px] text-stone-700 font-bold mt-1">
                    CODE: {b.code}
                  </span>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${b.active ? 'bg-emerald-500' : 'bg-stone-300'}`}></span>
              </div>

              <div className="space-y-1 text-xs text-stone-600 pt-2 border-t border-stone-100">
                <p className="text-stone-800 font-semibold">{b.address}</p>
                <p className="text-stone-500">Phone: {b.phone}</p>
                <p className="text-amber-800 font-medium">Branch Lead: {b.managerName}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Business & POS Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-stone-900">Regional & Financial Parameters</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
              <div>
                <span className="font-bold text-stone-900 block">Currency Standard</span>
                <span className="text-[10px] text-stone-500">Ghanaian Cedi (GHS / ₵)</span>
              </div>
              <span className="font-mono font-black text-amber-700">GHS (₵)</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
              <div>
                <span className="font-bold text-stone-900 block">Thermal Printer Format</span>
                <span className="text-[10px] text-stone-500">Standard 80mm roll with QR verification</span>
              </div>
              <span className="font-bold text-stone-800">80mm ESC/POS</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
              <div>
                <span className="font-bold text-stone-900 block">Default Delivery Dispatch Fee</span>
                <span className="text-[10px] text-stone-500">Tamale metropolitan radius</span>
              </div>
              <span className="font-bold text-stone-800">₵15.00</span>
            </div>
          </div>
        </div>

        {/* Database & Cloud Operations */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-stone-900">Cloud Firestore Data Management</h3>
          </div>

          <p className="text-xs text-stone-600">
            Initialize or replenish baseline menu items, recipes, sample inventory ingredients, and suppliers for testing.
          </p>

          {seedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tamale Food data successfully populated in Firebase!</span>
            </div>
          )}

          {isOwnerOrAdmin && (
            <button
              onClick={handleReSeedDatabase}
              disabled={seeding}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Populating Firestore...' : 'Re-Populate Initial Tamale Food Data'}</span>
            </button>
          )}

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-500 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-600" />
            <span>PWA Enabled: Ready for full-screen tablet and mobile use across all branch counters.</span>
          </div>
        </div>
      </div>

      {/* Modal: New Branch */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Open New Branch Outlet</h3>
                <p className="text-[11px] text-amber-400">Tamale Food Multi-Branch Expansion</p>
              </div>
              <button onClick={() => setIsBranchModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tamale Aboabo Market Branch"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Branch Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TAM-ABOABO"
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="+233 24 555 0101"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Physical Location Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Market Circle Road, Near Aboabo Station"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Branch Manager Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alhassan Mohammed"
                  value={branchManager}
                  onChange={(e) => setBranchManager(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Save Branch Outlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
