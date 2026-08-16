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
  Users, 
  Plus, 
  DollarSign, 
  CheckCircle2, 
  Calendar, 
  Phone, 
  CreditCard, 
  Briefcase, 
  FileText, 
  X,
  Send,
  AlertCircle
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { Employee, PayrollRecord, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export const PayrollView: React.FC = () => {
  const { userProfile, isOwnerOrAdmin, isAccountant } = useAuth();
  const { currentBranchId } = useBranch();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'payroll' | 'employees'>('payroll');
  const [loading, setLoading] = useState(true);

  // New Employee Modal
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState<UserRole>('Cashier');
  const [empPhone, setEmpPhone] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empBaseSalary, setEmpBaseSalary] = useState('1800');
  const [empFrequency, setEmpFrequency] = useState<'Monthly' | 'Weekly'>('Monthly');
  const [empPaymentMethod, setEmpPaymentMethod] = useState<'MTN Mobile Money' | 'Bank' | 'Cash'>('MTN Mobile Money');
  const [empAccountDetails, setEmpAccountDetails] = useState('');

  // Generate Payroll Run Modal
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [payPeriod, setPayPeriod] = useState('August 2026');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const unsubEmp = onSnapshot(collection(db, COLLECTIONS.EMPLOYEES), (snap) => {
      const arr: Employee[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Employee, id: d.id }));
      setEmployees(arr);
    });

    const qPay = query(collection(db, COLLECTIONS.PAYROLL), orderBy('createdAt', 'desc'));
    const unsubPay = onSnapshot(qPay, (snap) => {
      const arr: PayrollRecord[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as PayrollRecord, id: d.id }));
      setPayrolls(arr);
      setLoading(false);
    });

    return () => {
      unsubEmp();
      unsubPay();
    };
  }, []);

  const totalMonthlyPayroll = employees
    .filter((e) => e.active)
    .reduce((sum, e) => sum + e.baseSalary, 0);

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    try {
      const id = `emp-${Date.now()}`;
      const empRef = doc(db, COLLECTIONS.EMPLOYEES, id);
      const nowIso = new Date().toISOString();

      const newEmp: Employee = {
        id,
        fullName: empName,
        role: empRole,
        phone: empPhone,
        email: empEmail || undefined,
        baseSalary: parseFloat(empBaseSalary) || 0,
        salaryFrequency: empFrequency,
        paymentMethod: empPaymentMethod,
        accountDetails: empAccountDetails,
        hireDate: nowIso.split('T')[0],
        active: true,
        branchId: currentBranchId === 'all' ? 'tamale-central' : currentBranchId,
        createdAt: nowIso
      };

      await setDoc(empRef, newEmp);

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Admin',
        userProfile.role,
        'Employee Created',
        'PAYROLL',
        `Registered employee ${empName} (${empRole}) with salary ${formatGHS(newEmp.baseSalary)}`,
        id
      );

      setIsEmpModalOpen(false);
      setEmpName('');
      setEmpPhone('');
      setEmpEmail('');
      setEmpAccountDetails('');
    } catch (err) {
      console.error('Error saving employee:', err);
    }
  };

  const handleGeneratePayrollBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    try {
      const nowIso = new Date().toISOString();

      for (const emp of employees.filter((e) => e.active)) {
        const id = `pay-${emp.id}-${Date.now()}`;
        const payRef = doc(db, COLLECTIONS.PAYROLL, id);

        const record: PayrollRecord = {
          id,
          employeeId: emp.id,
          employeeName: emp.fullName,
          role: emp.role,
          period: payPeriod,
          baseSalary: emp.baseSalary,
          bonuses: 0,
          deductions: 0,
          netSalary: emp.baseSalary,
          paymentDate: payDate,
          paymentMethod: emp.paymentMethod,
          accountDetails: emp.accountDetails,
          status: 'Approved',
          recordedBy: userProfile.uid,
          branchId: emp.branchId,
          createdAt: nowIso
        };

        await setDoc(payRef, record);
      }

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Admin',
        userProfile.role,
        'Payroll Batch Generated',
        'PAYROLL',
        `Generated ${payPeriod} payroll for ${employees.filter((e) => e.active).length} staff members.`
      );

      setIsRunModalOpen(false);
    } catch (err) {
      console.error('Error generating payroll:', err);
    }
  };

  const handleMarkPayrollPaid = async (payrollId: string) => {
    try {
      const ref = doc(db, COLLECTIONS.PAYROLL, payrollId);
      await updateDoc(ref, {
        status: 'Paid',
        paidAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error marking paid:', err);
    }
  };

  return (
    <div id="payroll-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Staff & Payroll Management</h2>
          <p className="text-xs text-stone-500">Employee records, monthly compensation runs, and MoMo disbursements</p>
        </div>

        <div className="flex items-center gap-2">
          {(isOwnerOrAdmin || isAccountant) && (
            <>
              <button
                id="generate-payroll-run-btn"
                onClick={() => setIsRunModalOpen(true)}
                className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>Run Payroll Batch</span>
              </button>

              <button
                id="add-new-employee-btn"
                onClick={() => setIsEmpModalOpen(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block uppercase">Active Workforce</span>
          <span className="text-xl font-black text-stone-900 block mt-1">
            {employees.filter((e) => e.active).length} Employees
          </span>
          <span className="text-[10px] text-stone-400">Cashiers, Chefs, Riders & Admins</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block uppercase">Monthly Payroll Commitment</span>
          <span className="text-xl font-black text-amber-700 block mt-1">
            {formatGHS(totalMonthlyPayroll)}
          </span>
          <span className="text-[10px] text-stone-400">Total base salaries</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block uppercase">Disbursed Records</span>
          <span className="text-xl font-black text-emerald-700 block mt-1">
            {payrolls.filter((p) => p.status === 'Paid').length} Slips Settled
          </span>
          <span className="text-[10px] text-stone-400">Historical payroll payments</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('payroll')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'payroll'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Payroll Slips & Runs ({payrolls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'employees'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory ({employees.length})</span>
        </button>
      </div>

      {activeTab === 'payroll' ? (
        /* Payroll Table */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                <tr>
                  <th className="p-3.5">Period</th>
                  <th className="p-3.5">Employee Name</th>
                  <th className="p-3.5">Designation</th>
                  <th className="p-3.5">Base Salary</th>
                  <th className="p-3.5">Bonuses</th>
                  <th className="p-3.5">Deductions</th>
                  <th className="p-3.5">Net Pay</th>
                  <th className="p-3.5">Disbursement Channel</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-stone-400">
                      No payroll records generated yet. Click "Run Payroll Batch".
                    </td>
                  </tr>
                ) : (
                  payrolls.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50/80">
                      <td className="p-3.5 font-bold text-stone-900">{p.period}</td>
                      <td className="p-3.5 font-bold text-stone-800">{p.employeeName}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-semibold">
                          {p.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-stone-600">{formatGHS(p.baseSalary)}</td>
                      <td className="p-3.5 text-emerald-600">{formatGHS(p.bonuses)}</td>
                      <td className="p-3.5 text-red-600">-{formatGHS(p.deductions)}</td>
                      <td className="p-3.5 font-black text-amber-800">{formatGHS(p.netSalary)}</td>
                      <td className="p-3.5 text-stone-600">
                        <div>
                          <span className="block font-semibold">{p.paymentMethod}</span>
                          <span className="text-[10px] text-stone-400 font-mono">{p.accountDetails}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {p.status !== 'Paid' && (isOwnerOrAdmin || isAccountant) && (
                          <button
                            type="button"
                            onClick={() => handleMarkPayrollPaid(p.id)}
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
      ) : (
        /* Employees Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp.id} className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">{emp.fullName}</h4>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold mt-1">
                    {emp.role}
                  </span>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${emp.active ? 'bg-emerald-500' : 'bg-stone-300'}`}></span>
              </div>

              <div className="space-y-1 text-xs text-stone-600 pt-2 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{emp.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-stone-400" />
                  <span>{emp.paymentMethod}: {emp.accountDetails}</span>
                </div>
              </div>

              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 flex justify-between items-center text-xs">
                <span className="text-stone-500 font-semibold">Base Salary:</span>
                <span className="font-black text-amber-800">{formatGHS(emp.baseSalary)} / {emp.salaryFrequency}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Employee Modal */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Register New Staff Member</h3>
                <p className="text-[11px] text-amber-400">Tamale Food Employee Registry</p>
              </div>
              <button onClick={() => setIsEmpModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ibrahim Fuseini"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Role / Designation</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Kitchen">Kitchen Chef / Cook</option>
                    <option value="Manager">Branch Manager</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+233 24 123 4567"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Base Salary (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={empBaseSalary}
                    onChange={(e) => setEmpBaseSalary(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-black text-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Frequency</label>
                  <select
                    value={empFrequency}
                    onChange={(e) => setEmpFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Disbursement Channel</label>
                  <select
                    value={empPaymentMethod}
                    onChange={(e) => setEmpPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Bank">Bank Account</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">MoMo / Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="024XXXXXXX"
                    value={empAccountDetails}
                    onChange={(e) => setEmpAccountDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsEmpModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Run Payroll Modal */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Generate Monthly Payroll Run</h3>
                <p className="text-[11px] text-amber-400">All active branch employees</p>
              </div>
              <button onClick={() => setIsRunModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGeneratePayrollBatch} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Payroll Period Name</label>
                <input
                  type="text"
                  required
                  placeholder="August 2026"
                  value={payPeriod}
                  onChange={(e) => setPayPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>Total Staff to Process:</span>
                  <span>{employees.filter((e) => e.active).length} Active</span>
                </div>
                <div className="flex justify-between font-black text-amber-800 text-sm mt-1">
                  <span>Batch Amount:</span>
                  <span>{formatGHS(totalMonthlyPayroll)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsRunModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Confirm & Generate Slips
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
