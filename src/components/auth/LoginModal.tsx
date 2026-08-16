import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  User, 
  ShieldCheck, 
  KeyRound, 
  Phone, 
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth, DEMO_PROFILES } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { signIn, signUp, switchDemoRole, userProfile } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('Owner/Admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, displayName, role, phone);
        setSuccessMsg('Account created successfully!');
      } else {
        await signIn(email, password);
        setSuccessMsg('Signed in successfully!');
      }
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = async (targetRole: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      await switchDemoRole(targetRole);
      setSuccessMsg(`Switched role to ${targetRole}!`);
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Failed to switch role.');
    } finally {
      setLoading(false);
    }
  };

  const rolesList: { role: UserRole; desc: string; color: string }[] = [
    { role: 'Owner/Admin', desc: 'Full business control, financial statements & investor setups', color: 'bg-amber-600' },
    { role: 'Manager', desc: 'POS, orders, menu costing, inventory, stock adjustments & staff', color: 'bg-blue-600' },
    { role: 'Cashier/Sales Staff', desc: 'Fast POS, payment multi-split tender, receipts & shift cashiering', color: 'bg-emerald-600' },
    { role: 'Kitchen Staff', desc: 'Live KDS orders display, preparation timers & menu availability', color: 'bg-orange-600' },
    { role: 'Accountant', desc: 'Expenses, payroll distribution, P&L statements & investor ledgers', color: 'bg-purple-600' },
    { role: 'Investor', desc: 'Read-only capital tracking, equity %, and profit statements', color: 'bg-stone-700' }
  ];

  return (
    <div id="login-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        id="login-modal-card" 
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-stone-950 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tamale Food Authentication & Roles</h2>
              <p className="text-xs text-amber-400">Cloud Firestore & Firebase Auth Engine</p>
            </div>
          </div>
          <button
            id="close-login-modal-btn"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6 scrollbar-thin">
          {/* Quick Role Switcher Banner */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 text-amber-900 font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Instant Role Switcher (Evaluation & Testing)</span>
            </div>
            <p className="text-xs text-stone-600 mb-3">
              Click any role below to test the live Firestore role permissions and view restrictions:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {rolesList.map((item) => {
                const isCurrent = userProfile?.role === item.role;
                return (
                  <button
                    key={item.role}
                    id={`switch-role-${item.role.replace(/[^a-zA-Z0-9]/g, '')}`}
                    type="button"
                    onClick={() => handleQuickSwitch(item.role)}
                    disabled={loading}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isCurrent
                        ? 'border-amber-600 bg-amber-100/80 ring-2 ring-amber-500/20 font-bold shadow-xs'
                        : 'border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 block truncate">
                        {item.role}
                      </span>
                      {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                      {DEMO_PROFILES[item.role].name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Divider */}
          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-stone-200"></div>
            <span className="shrink mx-3 text-stone-400 text-xs font-medium uppercase tracking-wider">
              or custom login
            </span>
            <div className="grow border-t border-stone-200"></div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Salifu Alhassan"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      placeholder="e.g. +233 24 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    System Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    <option value="Owner/Admin">Owner/Admin (Full Access)</option>
                    <option value="Manager">Manager (Operations, POS, Stock & Staff)</option>
                    <option value="Cashier/Sales Staff">Cashier/Sales Staff (POS & Orders)</option>
                    <option value="Kitchen Staff">Kitchen Staff (KDS & Production)</option>
                    <option value="Accountant">Accountant (Expenses, Payroll & Reports)</option>
                    <option value="Investor">Investor (Financials & Profit Accrual)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@tamalefood.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-amber-700 font-semibold hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Create a new staff account'}
              </button>

              <button
                id="submit-auth-form-btn"
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-stone-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span>{isSignUp ? 'Register Account' : 'Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
