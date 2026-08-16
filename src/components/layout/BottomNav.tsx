import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ChefHat, 
  Receipt, 
  Menu 
} from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenSidebar: () => void;
  pendingOrdersCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenSidebar,
  pendingOrdersCount = 0,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'pos', label: 'POS', icon: ShoppingCart },
    { id: 'kitchen', label: 'KDS', icon: ChefHat, badge: pendingOrdersCount },
    { id: 'orders', label: 'Orders', icon: Receipt },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="lg:hidden shrink-0 bg-stone-900 border-t border-stone-800 px-2 py-1.5 flex items-center justify-around z-40"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            id={`bottom-nav-btn-${tab.id}`}
            onClick={() => onNavigate(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
              isActive 
                ? 'text-amber-400 font-bold' 
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-stone-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}

      {/* Menu / Drawer button to open full sidebar */}
      <button
        id="bottom-nav-btn-more"
        onClick={onOpenSidebar}
        className="flex-1 flex flex-col items-center justify-center py-1 rounded-xl text-stone-400 hover:text-stone-200 transition-all"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">More</span>
      </button>
    </nav>
  );
};
