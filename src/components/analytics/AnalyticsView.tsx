import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShieldCheck, 
  FileText, 
  Download, 
  Calendar, 
  Search, 
  Filter, 
  Sparkles,
  PieChart as PieIcon,
  CreditCard
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS } from '../../services/dbService';
import { Order, Expense, PayrollRecord, AuditEvent, Investor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { generateFinancialStatementPdf } from '../../services/pdfService';

export const AnalyticsView: React.FC = () => {
  const { userProfile } = useAuth();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'financials' | 'audit'>('financials');
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, COLLECTIONS.ORDERS), (snap) => {
      const arr: Order[] = [];
      snap.forEach((d) => {
        const data = { ...d.data() as Order, id: d.id };
        if (currentBranchId === 'all' || data.branchId === currentBranchId) {
          arr.push(data);
        }
      });
      setOrders(arr);
    });

    const unsubExp = onSnapshot(collection(db, COLLECTIONS.EXPENSES), (snap) => {
      const arr: Expense[] = [];
      snap.forEach((d) => {
        const data = { ...d.data() as Expense, id: d.id };
        if (currentBranchId === 'all' || data.branchId === currentBranchId) {
          arr.push(data);
        }
      });
      setExpenses(arr);
    });

    const unsubPay = onSnapshot(collection(db, COLLECTIONS.PAYROLL), (snap) => {
      const arr: PayrollRecord[] = [];
      snap.forEach((d) => {
        const data = { ...d.data() as PayrollRecord, id: d.id };
        if (currentBranchId === 'all' || data.branchId === currentBranchId) {
          arr.push(data);
        }
      });
      setPayrolls(arr);
    });

    const qAudit = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(100));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      const arr: AuditEvent[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as AuditEvent, id: d.id }));
      setAuditLogs(arr);
      setLoading(false);
    });

    const unsubInv = onSnapshot(collection(db, COLLECTIONS.INVESTORS), (snap) => {
      const arr: Investor[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Investor, id: d.id }));
      setInvestors(arr);
    });

    return () => {
      unsubOrders();
      unsubExp();
      unsubPay();
      unsubAudit();
      unsubInv();
    };
  }, [currentBranchId]);

  // Financial Calculations
  const validOrders = orders.filter((o) => o.status !== 'Cancelled');
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
  const totalCogs = validOrders.reduce((sum, o) => sum + (o.totalProductionCost || 0), 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalOperatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayroll = payrolls.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + (p.netSalary || p.netPay || 0), 0);
  const totalExpensesAndPayroll = totalOperatingExpenses + totalPayroll;
  const netProfit = grossProfit - totalExpensesAndPayroll;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Best Selling Dishes
  const itemCounts: Record<string, { qty: number; revenue: number }> = {};
  validOrders.forEach((o) => {
    o.items.forEach((item) => {
      if (!itemCounts[item.name]) itemCounts[item.name] = { qty: 0, revenue: 0 };
      itemCounts[item.name].qty += item.quantity;
      itemCounts[item.name].revenue += item.subtotal;
    });
  });
  const sortedBestSellers = Object.entries(itemCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty);

  // Payment Breakdown
  const paymentTotals: Record<string, number> = {};
  validOrders.forEach((o) => {
    o.paymentMethods.forEach((pm) => {
      paymentTotals[pm.method] = (paymentTotals[pm.method] || 0) + pm.amount;
    });
  });

  const handleExportStatement = () => {
    generateFinancialStatementPdf({
      title: 'Tamale Food - Management Profit & Loss Statement',
      period: 'Year-to-Date 2026',
      branchName: currentBranchId === 'all' ? 'All Tamale Food Branches' : currentBranchId,
      revenue: totalRevenue,
      cogs: totalCogs,
      grossProfit: grossProfit,
      expenses: totalOperatingExpenses,
      payroll: totalPayroll,
      netProfit: netProfit,
      investors
    });
  };

  const filteredAuditLogs = auditLogs.filter((log) => {
    const q = auditSearch.toLowerCase();
    const detailsText = (log.details || log.description || '').toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.userName.toLowerCase().includes(q) ||
      detailsText.includes(q) ||
      log.category.toLowerCase().includes(q)
    );
  });

  return (
    <div id="analytics-and-audit-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Business Intelligence & Audit Trail</h2>
          <p className="text-xs text-stone-500">Live P&L calculations, dish sales velocity, and verifiable security audit ledger</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStatement}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Download P&L Statement (PDF)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('financials')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'financials'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Financial Performance & P&L</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>System Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {activeTab === 'financials' ? (
        <div className="space-y-6">
          {/* Main P&L Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-bold text-stone-500 block uppercase">Total Gross Sales</span>
              <span className="text-xl font-black text-stone-900 block mt-1">{formatGHS(totalRevenue)}</span>
              <span className="text-[10px] text-stone-400">{validOrders.length} Completed Orders</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-bold text-stone-500 block uppercase">Cost of Goods (COGS)</span>
              <span className="text-xl font-black text-stone-700 block mt-1">{formatGHS(totalCogs)}</span>
              <span className="text-[10px] text-stone-400">Ingredients & Direct Costs</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-bold text-stone-500 block uppercase">Gross Profit</span>
              <span className="text-xl font-black text-emerald-700 block mt-1">{formatGHS(grossProfit)}</span>
              <span className="text-[10px] text-emerald-600 font-bold">{grossMargin.toFixed(1)}% Gross Margin</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-bold text-stone-500 block uppercase">Net Operating Profit</span>
              <span className={`text-xl font-black block mt-1 ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatGHS(netProfit)}
              </span>
              <span className="text-[10px] text-stone-400">{netMargin.toFixed(1)}% Net Margin</span>
            </div>
          </div>

          {/* Breakdown Matrix: Overheads, COGS & Net */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Best Sellers */}
            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-stone-900">Top Selling Menu Items</h3>
              <div className="space-y-2.5">
                {sortedBestSellers.length === 0 ? (
                  <p className="text-xs text-stone-400 py-4 text-center">No orders recorded yet.</p>
                ) : (
                  sortedBestSellers.slice(0, 5).map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-stone-100 font-bold text-stone-600 text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-stone-800 truncate max-w-[140px]">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-700 block">{item.qty} sold</span>
                        <span className="text-[10px] text-stone-400">{formatGHS(item.revenue)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payment Tender Distribution */}
            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-stone-900">Payment Tender Distribution</h3>
              <div className="space-y-2.5">
                {Object.keys(paymentTotals).length === 0 ? (
                  <p className="text-xs text-stone-400 py-4 text-center">No transactions recorded.</p>
                ) : (
                  Object.entries(paymentTotals).map(([method, amt]) => {
                    const pct = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
                    return (
                      <div key={method} className="space-y-1 text-xs">
                        <div className="flex justify-between font-semibold text-stone-700">
                          <span>{method}</span>
                          <span className="font-bold text-stone-900">{formatGHS(amt)} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cost Breakdown Structure */}
            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-stone-900">Cost Structure</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 bg-stone-50 rounded-lg">
                  <span className="text-stone-600">Production & Ingredients (COGS)</span>
                  <span className="font-bold text-stone-900">{formatGHS(totalCogs)}</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 rounded-lg">
                  <span className="text-stone-600">Operating Expenses & Utilities</span>
                  <span className="font-bold text-stone-900">{formatGHS(totalOperatingExpenses)}</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 rounded-lg">
                  <span className="text-stone-600">Staff Compensation & Payroll</span>
                  <span className="font-bold text-stone-900">{formatGHS(totalPayroll)}</span>
                </div>
                <div className="flex justify-between p-2 bg-amber-500/10 rounded-lg font-black text-amber-900 border border-amber-500/20">
                  <span>Net Retained Earnings</span>
                  <span>{formatGHS(netProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* System Audit Log View */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search audit trail by user, action, target or keyword..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-400">
                        No audit events recorded matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50/80">
                        <td className="p-3.5 text-stone-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-GH', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="p-3.5 font-bold text-stone-900">{log.userName}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-semibold">
                            {log.userRole}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-amber-800">{log.action}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-mono font-bold">
                            {log.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-stone-600 max-w-sm truncate">{log.details || log.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
