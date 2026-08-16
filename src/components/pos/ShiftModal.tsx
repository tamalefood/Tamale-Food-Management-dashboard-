import React, { useState } from 'react';
import { 
  X, 
  CircleDollarSign, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  ArrowRight,
  ShieldAlert,
  Download
} from 'lucide-react';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { PosShift, UserProfile } from '../../types';
import { generateShiftReportPdf } from '../../services/pdfService';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: PosShift | null;
  currentUser?: UserProfile;
  currentBranchId?: string;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  currentUser: propUser,
  currentBranchId: propBranchId
}) => {
  const { userProfile } = useAuth();
  const { currentBranchId: contextBranchId } = useBranch();

  const currentUser = propUser || userProfile || {
    uid: 'system',
    displayName: 'Staff',
    role: 'Cashier/Sales Staff'
  };
  const currentBranchId = propBranchId || contextBranchId || 'tamale-central';

  const [openingCashInput, setOpeningCashInput] = useState<string>('200');
  const [actualClosingCashInput, setActualClosingCashInput] = useState<string>('');
  const [cashDepositInput, setCashDepositInput] = useState<string>('');
  const [cashExpenseInput, setCashExpenseInput] = useState<string>('');
  const [discrepancyNote, setDiscrepancyNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const opening = parseFloat(openingCashInput) || 0;
      const shiftRef = doc(collection(db, COLLECTIONS.POS_SHIFTS));
      const nowIso = new Date().toISOString();

      const newShift: PosShift = {
        id: shiftRef.id,
        cashierId: currentUser.uid,
        cashierName: currentUser.displayName || 'Cashier',
        branchId: currentBranchId === 'all' ? 'tamale-central' : currentBranchId,
        status: 'Open',
        openedAt: nowIso,
        openingCash: opening,
        cashSales: 0,
        cashRefunds: 0,
        cashExpenses: 0,
        cashDeposits: 0,
        expectedCash: opening,
        totalOrdersCount: 0
      };

      await setDoc(shiftRef, newShift);
      await logAuditEvent(
        currentUser.uid,
        currentUser.displayName || 'Cashier',
        currentUser.role,
        'POS Shift Opened',
        'SALE',
        `Started POS shift with float of ${formatGHS(opening)}`,
        shiftRef.id,
        '',
        JSON.stringify(newShift),
        newShift.branchId
      );

      onClose();
    } catch (err: any) {
      console.error('Error opening shift:', err);
      setError(err.message || 'Failed to open shift.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setLoading(true);
    setError(null);

    try {
      const actualCash = parseFloat(actualClosingCashInput) || 0;
      const expected = activeShift.expectedCash || 0;
      const diff = actualCash - expected;
      const nowIso = new Date().toISOString();

      const updatedShiftData: Partial<PosShift> = {
        status: 'Closed',
        closedAt: nowIso,
        actualClosingCash: actualCash,
        difference: diff,
        shortage: diff < 0 ? Math.abs(diff) : 0,
        excess: diff > 0 ? diff : 0,
        discrepancyNote: discrepancyNote || (diff !== 0 ? 'Variance reported' : 'Clean drawer reconciliation')
      };

      const shiftRef = doc(db, COLLECTIONS.POS_SHIFTS, activeShift.id);
      await updateDoc(shiftRef, updatedShiftData);

      await logAuditEvent(
        currentUser.uid,
        currentUser.displayName || 'Cashier',
        currentUser.role,
        'POS Shift Closed',
        'SALE',
        `Closed shift. Expected: ${formatGHS(expected)}, Actual: ${formatGHS(actualCash)}, Variance: ${formatGHS(diff)}`,
        activeShift.id,
        JSON.stringify(activeShift),
        JSON.stringify(updatedShiftData),
        activeShift.branchId
      );

      onClose();
    } catch (err: any) {
      console.error('Error closing shift:', err);
      setError(err.message || 'Failed to close shift.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddExpense = async () => {
    if (!activeShift || !cashExpenseInput) return;
    const amount = parseFloat(cashExpenseInput);
    if (isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      const newCashExpenses = (activeShift.cashExpenses || 0) + amount;
      const newExpected = (activeShift.openingCash || 0) + (activeShift.cashSales || 0) + (activeShift.cashDeposits || 0) - (activeShift.cashRefunds || 0) - newCashExpenses;

      const shiftRef = doc(db, COLLECTIONS.POS_SHIFTS, activeShift.id);
      await updateDoc(shiftRef, {
        cashExpenses: newCashExpenses,
        expectedCash: newExpected
      });

      // Also create expense document
      const expRef = doc(collection(db, COLLECTIONS.EXPENSES));
      await setDoc(expRef, {
        id: expRef.id,
        amount,
        category: 'Other',
        description: `Petty cash drawer expense from active shift (${currentUser.displayName})`,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        recordedBy: currentUser.uid,
        recordedByName: currentUser.displayName,
        approvalStatus: 'Approved',
        branchId: activeShift.branchId,
        createdAt: new Date().toISOString()
      });

      setCashExpenseInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const actualCashVal = parseFloat(actualClosingCashInput);
  const diffVal = !isNaN(actualCashVal) && activeShift ? actualCashVal - activeShift.expectedCash : 0;

  return (
    <div id="shift-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        id="shift-modal-card"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-bold">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {activeShift ? 'Active Cashier Shift Reconciliation' : 'Start New POS Cashier Shift'}
              </h2>
              <p className="text-xs text-amber-400">Cash Register & Drawer Management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 scrollbar-thin">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!activeShift ? (
            /* Open Shift Form */
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
                <p className="font-semibold mb-1">Enter Opening Float</p>
                <p className="text-stone-600">
                  Count physical cash in the drawer before starting your sales session. All cash orders will automatically accrue to your shift balance.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cash Float on Hand (GHS)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-stone-500">₵</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    placeholder="200.00"
                    className="w-full pl-8 pr-3 py-2.5 text-base font-bold text-stone-900 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>Cashier Name:</span>
                  <span className="font-bold text-stone-800">{currentUser.displayName || 'Staff'}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Assigned Location:</span>
                  <span className="font-bold text-stone-800">{currentBranchId.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Session Start:</span>
                  <span className="font-bold text-stone-800">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <button
                id="start-shift-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 text-stone-950 font-black rounded-xl text-sm hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <span>Open Shift & Activate POS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Active Shift Management & Reconciliation */
            <div className="space-y-4">
              {/* Shift Overview Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                  <span className="text-stone-500 block text-[11px]">Opening Float</span>
                  <span className="text-sm font-black text-stone-900">{formatGHS(activeShift.openingCash)}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-700 block text-[11px] font-semibold">(+) Cash Sales</span>
                  <span className="text-sm font-black text-emerald-900">{formatGHS(activeShift.cashSales)}</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-amber-800 block text-[11px]">Total Shift Orders</span>
                  <span className="text-sm font-black text-stone-900">{activeShift.totalOrdersCount || 0} completed</span>
                </div>
                <div className="p-3 bg-stone-900 text-white rounded-xl">
                  <span className="text-amber-400 block text-[11px] font-bold">(=) Expected Drawer Cash</span>
                  <span className="text-base font-black text-white">{formatGHS(activeShift.expectedCash)}</span>
                </div>
              </div>

              {/* Quick Petty Cash Outflow */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="block text-xs font-bold text-stone-800 mb-2">Record Drawer Outflow (Petty Cash Expense)</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount (GHS)"
                    value={cashExpenseInput}
                    onChange={(e) => setCashExpenseInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddExpense}
                    disabled={loading || !cashExpenseInput}
                    className="px-3 py-1.5 bg-stone-800 text-white text-xs font-semibold rounded-lg hover:bg-stone-700 disabled:opacity-50"
                  >
                    Deduct
                  </button>
                </div>
              </div>

              {/* Close Shift Form */}
              <form onSubmit={handleCloseShift} className="border-t border-stone-200 pt-4 space-y-3">
                <span className="block text-xs font-bold text-stone-900">
                  End Shift & Count Physical Cash in Drawer
                </span>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Actual Counted Cash in Drawer (GHS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter physical cash counted"
                    value={actualClosingCashInput}
                    onChange={(e) => setActualClosingCashInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold text-stone-900 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {!isNaN(actualCashVal) && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      diffVal === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : diffVal < 0
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {diffVal === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-semibold">
                        {diffVal === 0 ? 'Exact Match' : diffVal < 0 ? 'Cash Shortage' : 'Cash Excess'}
                      </span>
                    </div>
                    <span className="font-black text-sm">
                      {diffVal > 0 ? `+${formatGHS(diffVal)}` : formatGHS(diffVal)}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Discrepancy Notes / Closing Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Explain any drawer shortage, excess, or operational handover notes..."
                    value={discrepancyNote}
                    onChange={(e) => setDiscrepancyNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pdf = generateShiftReportPdf(activeShift);
                      pdf.save(`shift-report-${activeShift.id}.pdf`);
                    }}
                    className="px-3 py-2.5 bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold hover:bg-stone-200 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>

                  <button
                    id="close-shift-submit-btn"
                    type="submit"
                    disabled={loading || !actualClosingCashInput}
                    className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    Reconcile & Close Cashier Shift
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
