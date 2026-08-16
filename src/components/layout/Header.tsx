import React, { useState } from 'react';
import { 
  Menu as MenuIcon, 
  Building2, 
  CircleDollarSign, 
  Bell, 
  User, 
  LogOut, 
  ChevronDown, 
  AlertTriangle,
  Receipt,
  Sparkles,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { PosShift } from '../../types';
import { formatGHS } from '../../services/dbService';

export interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenLoginModal: () => void;
  onOpenShiftModal: () => void;
  activeShift: PosShift | null;
  lowStockItemsCount?: number;
  pendingOrdersCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onOpenLoginModal,
  onOpenShiftModal,
  activeShift,
  lowStockItemsCount = 0,
  pendingOrdersCount = 0
}) => {
  const { userProfile, signOut, isCashier, isManager } = useAuth();
  const { branches, currentBranchId, setCurrentBranchId, currentBranch } = useBranch();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const totalNotifications = (lowStockItemsCount > 0 ? 1 : 0) + (pendingOrdersCount > 0 ? 1 : 0);

  return (
    <header id="main-header" className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between shadow-xs">
      {/* Left section: Hamburger & Branch Selector */}
      <div className="flex items-center gap-3">
        <button
          id="toggle-sidebar-mobile-btn"
          onClick={onToggleSidebar}
          className="p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 lg:hidden"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Branch Selector */}
        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs">
          <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-stone-600 font-medium leading-none">Branch Location</span>
            <select
              id="branch-selector-dropdown"
              value={currentBranchId}
              onChange={(e) => setCurrentBranchId(e.target.value)}
              className="bg-transparent font-bold text-stone-800 text-xs focus:outline-none cursor-pointer pr-2"
            >
              <option value="all">All Tamale Branches (HQ Consolidated)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Right Section: POS Shift indicator, Notifications & User Info */}
      <div className="flex items-center gap-2.5">
        {/* Active POS Cash Register Shift Status */}
        {(isCashier || isManager) && (
          <button
            id="header-shift-btn"
            onClick={onOpenShiftModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              activeShift
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100/80 shadow-xs'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 animate-pulse'
            }`}
          >
            <CircleDollarSign className={`w-4 h-4 ${activeShift ? 'text-emerald-600' : 'text-amber-600'}`} />
            <div className="text-left hidden sm:block">
              <span className="block text-[10px] uppercase font-bold text-stone-500">
                {activeShift ? 'Shift Active' : 'Shift Closed'}
              </span>
              <span className="text-xs">
                {activeShift ? `Drawer: ${formatGHS(activeShift.expectedCash)}` : 'Open POS Shift'}
              </span>
            </div>
          </button>
        )}

        {/* Notifications Button */}
        <div className="relative">
          <button
            id="notifications-toggle-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {totalNotifications > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-stone-950 font-black text-[10px] rounded-full flex items-center justify-center ring-2 ring-white">
                {totalNotifications}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div 
              id="notifications-popover" 
              className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-800">Operational Alerts</span>
                <span className="text-[10px] text-stone-600">Real-time Firestore</span>
              </div>
              <div className="divide-y divide-stone-100 text-xs py-1">
                {lowStockItemsCount > 0 && (
                  <div className="py-2 flex items-start gap-2 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{lowStockItemsCount} Ingredients Low on Stock</p>
                      <p className="text-[11px] text-stone-500">Check inventory tab to replenish before orders run out.</p>
                    </div>
                  </div>
                )}
                {pendingOrdersCount > 0 && (
                  <div className="py-2 flex items-start gap-2 text-blue-800">
                    <Receipt className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{pendingOrdersCount} Active Kitchen Orders</p>
                      <p className="text-[11px] text-stone-500">Pending or preparing in the kitchen display.</p>
                    </div>
                  </div>
                )}
                {totalNotifications === 0 && (
                  <div className="py-4 text-center text-stone-400 text-xs">
                    All inventory levels and orders are clear!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Role Badge & Switcher Button */}
        <button
          id="user-profile-menu-btn"
          onClick={onOpenLoginModal}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 rounded-xl transition-all"
        >
          <div className="w-6 h-6 rounded-full bg-stone-800 text-amber-400 font-bold text-[11px] flex items-center justify-center">
            {userProfile?.displayName?.charAt(0) || 'A'}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-xs font-bold text-stone-800 leading-tight">
              {userProfile?.displayName || 'User'}
            </p>
            <p className="text-[10px] font-semibold text-amber-800 leading-none">
              {userProfile?.role || 'Staff'}
            </p>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1" />
        </button>
      </div>
    </header>
  );
};
