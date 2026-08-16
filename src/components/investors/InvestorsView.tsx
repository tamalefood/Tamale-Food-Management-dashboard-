import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  Briefcase, 
  Plus, 
  Percent, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  PieChart, 
  FileText, 
  CheckCircle2, 
  Download, 
  X,
  UserCheck
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { Investor, DividendPayout } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { generateFinancialStatementPdf } from '../../services/pdfService';

export const InvestorsView: React.FC = () => {
  const { userProfile, isOwnerOrAdmin, isInvestor } = useAuth();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [dividends, setDividends] = useState<DividendPayout[]>([]);
  const [loading, setLoading] = useState(true);

  // New Investor Modal
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [invName, setInvName] = useState('');
  const [invEquity, setInvEquity] = useState('15');
  const [invCapital, setInvCapital] = useState('75000');
  const [invEmail, setInvEmail] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invBank, setInvBank] = useState('');

  // Declare Dividend Modal
  const [isDivModalOpen, setIsDivModalOpen] = useState(false);
  const [divPeriod, setDivPeriod] = useState('Q3 2026 Profit Share');
  const [divTotalPool, setDivTotalPool] = useState('30000');
  const [divPaymentDate, setDivPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const unsubInv = onSnapshot(collection(db, COLLECTIONS.INVESTORS), (snap) => {
      const arr: Investor[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Investor, id: d.id }));
      setInvestors(arr);
      setLoading(false);
    });

    const qDiv = query(collection(db, COLLECTIONS.DIVIDENDS), orderBy('paymentDate', 'desc'));
    const unsubDiv = onSnapshot(qDiv, (snap) => {
      const arr: DividendPayout[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as DividendPayout, id: d.id }));
      setDividends(arr);
    });

    return () => {
      unsubInv();
      unsubDiv();
    };
  }, []);

  const totalCapitalInvested = investors.reduce((sum, i) => sum + i.totalInvestment, 0);
  const totalEquityAllocated = investors.reduce((sum, i) => sum + i.equityPercentage, 0);
  const totalDividendsPaid = dividends
    .filter((d) => d.status === 'Paid')
    .reduce((sum, d) => sum + d.amount, 0);

  const handleSaveInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isOwnerOrAdmin) return;

    try {
      const id = `inv-${Date.now()}`;
      const invRef = doc(db, COLLECTIONS.INVESTORS, id);
      const nowIso = new Date().toISOString();

      const newInv: Investor = {
        id,
        name: invName,
        fullName: invName,
        equityPercentage: parseFloat(invEquity) || 0,
        totalInvestment: parseFloat(invCapital) || 0,
        investmentAmount: parseFloat(invCapital) || 0,
        investmentDate: nowIso.split('T')[0],
        email: invEmail || undefined,
        phone: invPhone || undefined,
        bankDetails: invBank || undefined,
        totalDividendsPaid: 0,
        createdAt: nowIso
      };

      await setDoc(invRef, newInv);

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Owner',
        userProfile.role,
        'Investor Onboarded',
        'INVESTOR',
        `Registered equity partner ${invName} with ${newInv.equityPercentage}% equity for ${formatGHS(newInv.totalInvestment)}`,
        id
      );

      setIsInvModalOpen(false);
      setInvName('');
      setInvEquity('');
      setInvCapital('');
      setInvEmail('');
      setInvPhone('');
      setInvBank('');
    } catch (err) {
      console.error('Error saving investor:', err);
    }
  };

  const handleDeclareDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isOwnerOrAdmin) return;

    try {
      const pool = parseFloat(divTotalPool) || 0;
      const nowIso = new Date().toISOString();

      for (const inv of investors) {
        const shareAmount = (inv.equityPercentage / 100) * pool;
        const divId = `div-${inv.id}-${Date.now()}`;
        const divRef = doc(db, COLLECTIONS.DIVIDENDS, divId);

        const payout: DividendPayout = {
          id: divId,
          investorId: inv.id,
          investorName: inv.name,
          amount: shareAmount,
          period: divPeriod,
          paymentDate: divPaymentDate,
          status: 'Approved',
          notes: `${inv.equityPercentage}% equity distribution of ${formatGHS(pool)} profit pool`,
          recordedBy: userProfile.uid,
          createdAt: nowIso
        };

        await setDoc(divRef, payout);
      }

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Owner',
        userProfile.role,
        'Dividends Declared',
        'INVESTOR',
        `Declared dividend pool of ${formatGHS(pool)} across ${investors.length} equity stakeholders.`
      );

      setIsDivModalOpen(false);
    } catch (err) {
      console.error('Error declaring dividends:', err);
    }
  };

  const handleMarkDividendPaid = async (div: DividendPayout) => {
    try {
      const ref = doc(db, COLLECTIONS.DIVIDENDS, div.id);
      await updateDoc(ref, {
        status: 'Paid',
        paidAt: new Date().toISOString()
      });

      // Update investor cumulative dividends
      const invRef = doc(db, COLLECTIONS.INVESTORS, div.investorId);
      const target = investors.find((i) => i.id === div.investorId);
      if (target) {
        await updateDoc(invRef, {
          totalDividendsPaid: (target.totalDividendsPaid || 0) + div.amount
        });
      }
    } catch (err) {
      console.error('Error updating dividend status:', err);
    }
  };

  const handleExportStatement = () => {
    generateFinancialStatementPdf({
      title: 'Tamale Food - Investor Financial & Equity Statement',
      period: 'Fiscal Year 2026',
      branchName: 'Tamale Central & Multi-Branch Holdings',
      revenue: 450000,
      cogs: 180000,
      grossProfit: 270000,
      expenses: 85000,
      payroll: 45000,
      netProfit: 140000,
      investors
    });
  };

  return (
    <div id="investor-management-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Investor Portal & Equity Management</h2>
          <p className="text-xs text-stone-500">Cap table management, investment capital tracking, and automated dividend distribution</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-financial-statement-btn"
            onClick={handleExportStatement}
            className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Export Statement (PDF)</span>
          </button>

          {isOwnerOrAdmin && (
            <>
              <button
                id="declare-dividend-btn"
                onClick={() => setIsDivModalOpen(true)}
                className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Declare Dividend Pool</span>
              </button>

              <button
                id="onboard-investor-btn"
                onClick={() => setIsInvModalOpen(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Investor</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 uppercase">Total Capital Injected</span>
          <span className="text-xl font-black text-stone-900 block mt-1">
            {formatGHS(totalCapitalInvested)}
          </span>
          <span className="text-[10px] text-stone-400">{investors.length} Registered Stakeholders</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 uppercase">Equity Allocated</span>
          <span className="text-xl font-black text-amber-700 block mt-1">
            {totalEquityAllocated.toFixed(1)}% of 100%
          </span>
          <span className="text-[10px] text-stone-400">{(100 - totalEquityAllocated).toFixed(1)}% Retained Founder Equity</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 uppercase">Cumulative Dividends Paid</span>
          <span className="text-xl font-black text-emerald-700 block mt-1">
            {formatGHS(totalDividendsPaid)}
          </span>
          <span className="text-[10px] text-stone-400">Total profit shared to date</span>
        </div>
      </div>

      {/* Stakeholder Directory & Cap Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">Cap Table & Equity Share Breakdown</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {investors.map((inv) => (
            <div key={inv.id} className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">{inv.name}</h4>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black mt-1">
                    {inv.equityPercentage}% Equity
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-black">
                  <Percent className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-100 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Capital Invested:</span>
                  <span className="font-bold text-stone-900">{formatGHS(inv.totalInvestment)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Dividends Received:</span>
                  <span className="font-bold text-emerald-700">{formatGHS(inv.totalDividendsPaid || 0)}</span>
                </div>
                <div className="flex justify-between text-stone-500 text-[11px]">
                  <span>Onboarded:</span>
                  <span>{inv.investmentDate}</span>
                </div>
                {inv.bankDetails && (
                  <p className="text-[10px] text-stone-400 font-mono truncate">{inv.bankDetails}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dividend Payouts Ledger */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-stone-900">Profit Share & Dividend History</h3>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                <tr>
                  <th className="p-3.5">Payment Date</th>
                  <th className="p-3.5">Distribution Period</th>
                  <th className="p-3.5">Investor Name</th>
                  <th className="p-3.5">Dividend Payout</th>
                  <th className="p-3.5">Notes</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {dividends.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-400">
                      No dividend distributions recorded yet. Click "Declare Dividend Pool".
                    </td>
                  </tr>
                ) : (
                  dividends.map((div) => (
                    <tr key={div.id} className="hover:bg-stone-50/80">
                      <td className="p-3.5 text-stone-500 whitespace-nowrap">{div.paymentDate}</td>
                      <td className="p-3.5 font-bold text-stone-900">{div.period}</td>
                      <td className="p-3.5 font-bold text-stone-800">{div.investorName}</td>
                      <td className="p-3.5 font-black text-emerald-700 whitespace-nowrap">{formatGHS(div.amount)}</td>
                      <td className="p-3.5 text-stone-500 max-w-xs truncate">{div.notes || '-'}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          div.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {div.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {div.status !== 'Paid' && isOwnerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleMarkDividendPaid(div)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 ml-auto"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Paid</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Add Investor */}
      {isInvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Onboard New Equity Investor</h3>
                <p className="text-[11px] text-amber-400">Cap Table Registration</p>
              </div>
              <button onClick={() => setIsInvModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvestor} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Investor / Entity Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tamale Ventures Ltd"
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Equity Ownership (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    max="100"
                    required
                    value={invEquity}
                    onChange={(e) => setInvEquity(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-black text-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Capital Invested (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={invCapital}
                    onChange={(e) => setInvCapital(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-black text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="partner@investor.com"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+233 24..."
                    value={invPhone}
                    onChange={(e) => setInvPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Disbursement Bank / MoMo Account</label>
                <input
                  type="text"
                  placeholder="GCB Bank - Tamale Branch - Acc # 1029384729"
                  value={invBank}
                  onChange={(e) => setInvBank(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsInvModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Register Investor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Declare Dividend */}
      {isDivModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Declare Profit Dividend Pool</h3>
                <p className="text-[11px] text-amber-400">Automated Equity Pro-Rata Distribution</p>
              </div>
              <button onClick={() => setIsDivModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeclareDividend} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Period Description</label>
                <input
                  type="text"
                  required
                  placeholder="Q3 2026 Net Profit Dividend"
                  value={divPeriod}
                  onChange={(e) => setDivPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Total Pool Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={divTotalPool}
                    onChange={(e) => setDivTotalPool(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-black text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Declaration Date</label>
                  <input
                    type="date"
                    required
                    value={divPaymentDate}
                    onChange={(e) => setDivPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                <span className="font-bold text-stone-800 text-[11px] block">Calculated Stakeholder Payouts:</span>
                {investors.map((inv) => {
                  const amt = (inv.equityPercentage / 100) * (parseFloat(divTotalPool) || 0);
                  return (
                    <div key={inv.id} className="flex justify-between text-stone-700">
                      <span>{inv.name} ({inv.equityPercentage}%):</span>
                      <span className="font-black text-emerald-700">{formatGHS(amt)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsDivModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Confirm & Allocate Dividends
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
