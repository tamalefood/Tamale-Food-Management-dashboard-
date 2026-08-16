import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Receipt, 
  ChefHat, 
  UtensilsCrossed, 
  Boxes, 
  Truck, 
  Wallet, 
  TrendingUp, 
  Users, 
  BadgeDollarSign, 
  FileBarChart, 
  ShieldCheck, 
  Settings, 
  History,
  Store
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

export type ActiveTab = 
  | 'dashboard'
  | 'pos'
  | 'orders'
  | 'kitchen'
  | 'menu'
  | 'inventory'
  | 'purchases'
  | 'expenses'
  | 'investors'
  | 'employees'
  | 'payroll'
  | 'reports'
  | 'analytics'
  | 'audit'
  | 'settings';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: string | number;
}

export interface SidebarProps {
  currentView?: string;
  activeTab?: ActiveTab;
  onNavigate?: (view: string) => void;
  setActiveTab?: (tab: ActiveTab) => void;
  isOpen?: boolean;
  onClose?: () => void;
  setIsOpen?: (open: boolean) => void;
  activeShift?: any;
  onOpenShiftModal?: () => void;
  pendingOrdersCount?: number;
  lowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeTab,
  onNavigate,
  setActiveTab,
  isOpen = false,
  onClose,
  setIsOpen,
  activeShift,
  onOpenShiftModal,
  pendingOrdersCount = 0,
  lowStockCount = 0
}) => {
  const { userProfile, hasAccess } = useAuth();

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
    if (typeof setIsOpen === 'function') {
      setIsOpen(false);
    }
  };

  const handleSelectTab = (tabId: ActiveTab) => {
    if (typeof onNavigate === 'function') {
      onNavigate(tabId);
    }
    if (typeof setActiveTab === 'function') {
      setActiveTab(tabId);
    }
    if (window.innerWidth < 1024) {
      handleClose();
    }
  };

  const currentActive = currentView || activeTab || 'dashboard';

  const navItems: NavItem[] = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      roles: ['Owner/Admin', 'Manager', 'Accountant'] 
    },
    { 
      id: 'pos', 
      label: 'Point of Sale (POS)', 
      icon: ShoppingCart, 
      roles: ['Owner/Admin', 'Manager', 'Cashier/Sales Staff'] 
    },
    { 
      id: 'orders', 
      label: 'Orders Management', 
      icon: Receipt, 
      roles: ['Owner/Admin', 'Manager', 'Cashier/Sales Staff'],
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined
    },
    { 
      id: 'kitchen', 
      label: 'Kitchen Display (KDS)', 
      icon: ChefHat, 
      roles: ['Owner/Admin', 'Manager', 'Kitchen Staff'],
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} live` : undefined
    },
    { 
      id: 'menu', 
      label: 'Menu & Recipe Costing', 
      icon: UtensilsCrossed, 
      roles: ['Owner/Admin', 'Manager', 'Kitchen Staff'] 
    },
    { 
      id: 'inventory', 
      label: 'Inventory & Stock', 
      icon: Boxes, 
      roles: ['Owner/Admin', 'Manager', 'Kitchen Staff'],
      badge: lowStockCount > 0 ? `${lowStockCount} alert` : undefined
    },
    { 
      id: 'purchases', 
      label: 'Purchases & Suppliers', 
      icon: Truck, 
      roles: ['Owner/Admin', 'Manager', 'Accountant'] 
    },
    { 
      id: 'expenses', 
      label: 'Daily Expenses', 
      icon: Wallet, 
      roles: ['Owner/Admin', 'Manager', 'Accountant'] 
    },
    { 
      id: 'investors', 
      label: 'Investors & Equity', 
      icon: TrendingUp, 
      roles: ['Owner/Admin', 'Accountant', 'Investor'] 
    },
    { 
      id: 'employees', 
      label: 'Staff Directory', 
      icon: Users, 
      roles: ['Owner/Admin', 'Manager', 'Accountant'] 
    },
    { 
      id: 'payroll', 
      label: 'Payroll & Wages', 
      icon: BadgeDollarSign, 
      roles: ['Owner/Admin', 'Accountant'] 
    },
    { 
      id: 'reports', 
      label: 'Reports & P&L', 
      icon: FileBarChart, 
      roles: ['Owner/Admin', 'Manager', 'Accountant'] 
    },
    { 
      id: 'audit', 
      label: 'Audit Trail', 
      icon: History, 
      roles: ['Owner/Admin', 'Manager'] 
    },
    { 
      id: 'settings', 
      label: 'Settings & Data Seed', 
      icon: Settings, 
      roles: ['Owner/Admin', 'Manager'] 
    }
  ];

  const filteredNavItems = navItems.filter((item) => hasAccess(item.roles));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      <aside
        id="main-app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-68 bg-stone-900 text-stone-100 flex flex-col transition-transform duration-300 ease-in-out border-r border-stone-800 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div id="brand-header" className="p-5 border-b border-stone-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-black shadow-md shadow-amber-500/20">
            <Store className="w-5 h-5 text-stone-950" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Tamale Food
              <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                POS
              </span>
            </h1>
            <p className="text-xs text-amber-300 font-medium">The Taste of the North</p>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-300">
            Operations & Control
          </div>
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentActive === item.id || 
              (currentActive === 'payroll' && item.id === 'employees') ||
              (currentActive === 'analytics' && (item.id === 'reports' || item.id === 'audit'));
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white font-semibold shadow-xs'
                    : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-300'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-amber-800 text-white'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Current Profile Badge */}
        <div id="sidebar-user-footer" className="p-3 border-t border-stone-800 bg-stone-950/60">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 font-bold text-xs">
              {userProfile?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {userProfile?.displayName || 'Tamale Staff'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] text-amber-400 font-medium truncate">
                  {userProfile?.role || 'Staff'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
