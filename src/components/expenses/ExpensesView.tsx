import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  PieChart as PieIcon, 
  X,
  CreditCard,
  Building2,
  FileCheck
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { Expense, ExpenseCategory, PaymentMethodType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export const ExpensesView: React.FC = () => {
  const { userProfile, isManager, isAccountant } = useAuth();
  const { currentBranchId } = useBranch();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // New Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Utilities');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');

  const categoriesList: ExpenseCategory[] = [
    'Rent',
    'Utilities',
    'Gas & Fuel',
    'Packaging',
    'Marketing',
    'Maintenance',
    'Transport',
    'Cleaning',
    'Permits & Taxes',
    'Sundry'
  ];

  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.EXPENSES), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Expense[] = [];
      snap.forEach((d) => {
        const data = { ...d.data() as Expense, id: d.id };
        if (currentBranchId === 'all' || data.branchId === currentBranchId) {
          arr.push(data);
        }
      });
      setExpenses(arr);
      setLoading(false);
    });

    return () => unsub();
  }, [currentBranchId]);

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Grouped by Category for breakdown
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const filteredExpenses = expenses.filter((e) => {
    const matchesCat = categoryFilter === 'All' || e.category === categoryFilter;
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (e.receiptNumber && e.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    try {
      const id = `exp-${Date.now()}`;
      const expRef = doc(db, COLLECTIONS.EXPENSES, id);
      const numAmount = parseFloat(amount) || 0;
      const nowIso = new Date().toISOString();

      const newExp: Expense = {
        id,
        title,
        category,
        amount: numAmount,
        date,
        paymentMethod,
        receiptNumber: receiptNumber || undefined,
        notes: notes || undefined,
        recordedBy: userProfile.uid,
        recordedByName: userProfile.displayName || 'Staff',
        branchId: currentBranchId === 'all' ? 'tamale-central' : currentBranchId,
        createdAt: nowIso
      };

      await setDoc(expRef, newExp);

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Staff',
        userProfile.role,
        'Expense Recorded',
        'EXPENSE',
        `Recorded expense "${title}" (${category}) of ${formatGHS(numAmount)}`,
        id
      );

      setIsModalOpen(false);
      setTitle('');
      setAmount('');
      setReceiptNumber('');
      setNotes('');
    } catch (err) {
      console.error('Error saving expense:', err);
    }
  };

  return (
    <div id="expenses-management-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Operating Expenses Register</h2>
          <p className="text-xs text-stone-500">Track utilities, LPG gas cylinders, generator fuel, rent, and overheads</p>
        </div>

        <div className="flex items-center gap-2">
          {(isManager || isAccountant) && (
            <button
              id="record-new-expense-btn"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Record New Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI & Category Breakdown Ribbon */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-stone-500 uppercase">Total Logged Overheads</span>
            <h3 className="text-2xl font-black text-stone-900 mt-1">{formatGHS(totalExpenseAmount)}</h3>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">{expenses.length} operating receipts logged</p>
        </div>

        {/* Category Breakdown Bar in remaining 3 columns */}
        <div className="lg:col-span-3 p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700">Expense Category Distribution</span>
            <span className="text-[11px] text-stone-400">Total: {formatGHS(totalExpenseAmount)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {categoriesList.map((cat) => {
              const val = categoryTotals[cat] || 0;
              const pct = totalExpenseAmount > 0 ? (val / totalExpenseAmount) * 100 : 0;
              return (
                <div key={cat} className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] font-bold text-stone-500 block truncate">{cat}</span>
                  <span className="text-xs font-black text-stone-900 block mt-0.5">{formatGHS(val)}</span>
                  <div className="w-full bg-stone-200 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-amber-600 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search expense description, receipt #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-auto"
        >
          <option value="All">All Categories</option>
          {categoriesList.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Title / Expense Item</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5">Receipt #</th>
                <th className="p-3.5">Notes</th>
                <th className="p-3.5">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">Loading expenses...</td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">No expenses found matching filters.</td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-stone-50/80">
                    <td className="p-3.5 text-stone-500 whitespace-nowrap">{exp.date}</td>
                    <td className="p-3.5 font-bold text-stone-900">{exp.title}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-amber-700 whitespace-nowrap">{formatGHS(exp.amount)}</td>
                    <td className="p-3.5 text-stone-600">{exp.paymentMethod}</td>
                    <td className="p-3.5 font-mono text-stone-500">{exp.receiptNumber || '-'}</td>
                    <td className="p-3.5 text-stone-500 max-w-xs truncate">{exp.notes || '-'}</td>
                    <td className="p-3.5 text-stone-500">{exp.recordedByName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Operating Expense</h3>
                <p className="text-[11px] text-amber-400">Tamale Food Cost Accounting</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Expense Title / Vendor Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50kg LPG Cooking Gas Refill"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Expense Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-bold"
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-black text-amber-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Cash">Cash (Petty Cash)</option>
                    <option value="MTN Mobile Money">MTN MoMo</option>
                    <option value="Telecel Cash">Telecel Cash</option>
                    <option value="Bank/Card">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Vendor Receipt / Invoice # (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. REC-8492"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Operational Notes / Reason</label>
                <textarea
                  rows={2}
                  placeholder="Details for accountant verification..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
