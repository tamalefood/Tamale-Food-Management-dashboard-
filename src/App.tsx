import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './lib/firebase';
import { COLLECTIONS, seedInitialTamaleFoodData } from './services/dbService';
import { PosShift } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BranchProvider, useBranch } from './context/BranchContext';
import { CartProvider } from './context/CartContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { Dashboard } from './components/dashboard/Dashboard';
import { PosView } from './components/pos/PosView';
import { KitchenView } from './components/kitchen/KitchenView';
import { OrdersView } from './components/orders/OrdersView';
import { InventoryView } from './components/inventory/InventoryView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { MenuView } from './components/menu/MenuView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { PayrollView } from './components/payroll/PayrollView';
import { InvestorsView } from './components/investors/InvestorsView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';
import { ShiftModal } from './components/pos/ShiftModal';
import { LoginModal } from './components/auth/LoginModal';

const AppContent: React.FC = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const { currentBranchId } = useBranch();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  // Subscribe to open shifts
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.POS_SHIFTS),
      where('status', '==', 'Open')
    );

    const unsub = onSnapshot(q, (snap) => {
      let foundShift: PosShift | null = null;
      snap.forEach((d) => {
        const data = { ...d.data() as PosShift, id: d.id };
        if (currentBranchId === 'all' || data.branchId === currentBranchId) {
          foundShift = data;
        }
      });
      setActiveShift(foundShift);
    }, (err) => {
      console.warn('Shift listener error:', err);
    });

    return () => unsub();
  }, [currentBranchId]);

  // Subscribe to pending orders and low stock ingredients for badges
  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, COLLECTIONS.ORDERS), (snap) => {
      let pending = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (
          (currentBranchId === 'all' || data.branchId === currentBranchId) &&
          (data.status === 'Pending' || data.status === 'Preparing')
        ) {
          pending++;
        }
      });
      setPendingOrdersCount(pending);
    });

    const unsubIngredients = onSnapshot(collection(db, COLLECTIONS.INGREDIENTS), (snap) => {
      let low = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (data.currentStock <= data.reorderLevel) {
          low++;
        }
      });
      setLowStockCount(low);
    });

    return () => {
      unsubOrders();
      unsubIngredients();
    };
  }, [currentBranchId]);

  // Initial seed check on first load
  useEffect(() => {
    const checkAndSeed = async () => {
      try {
        await seedInitialTamaleFoodData();
      } catch (err) {
        console.warn('Auto-seed check failed or already seeded:', err);
      }
    };
    checkAndSeed();
  }, []);

  return (
    <div className="flex h-screen bg-stone-100 text-stone-900 font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeShift={activeShift}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        pendingOrdersCount={pendingOrdersCount}
        lowStockCount={lowStockCount}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          activeShift={activeShift}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          pendingOrdersCount={pendingOrdersCount}
          lowStockItemsCount={lowStockCount}
        />

        {/* View Switcher Viewport */}
        <main className="flex-1 overflow-y-auto bg-stone-100 pb-16 lg:pb-0">
          {currentView === 'dashboard' && (
            <Dashboard
              onNavigate={(view) => setCurrentView(view)}
              activeShift={activeShift}
              onOpenShiftModal={() => setIsShiftModalOpen(true)}
            />
          )}
          {currentView === 'pos' && (
            <PosView
              activeShift={activeShift}
              onOpenShiftModal={() => setIsShiftModalOpen(true)}
            />
          )}
          {currentView === 'kitchen' && <KitchenView />}
          {currentView === 'orders' && <OrdersView />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'purchases' && <PurchasesView />}
          {currentView === 'menu' && <MenuView />}
          {currentView === 'expenses' && <ExpensesView />}
          {(currentView === 'payroll' || currentView === 'employees') && <PayrollView />}
          {currentView === 'investors' && <InvestorsView />}
          {(currentView === 'analytics' || currentView === 'reports' || currentView === 'audit') && <AnalyticsView />}
          {currentView === 'settings' && <SettingsView />}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          pendingOrdersCount={pendingOrdersCount}
        />
      </div>

      {/* Shift Open / Close Reconcile Modal */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        activeShift={activeShift}
      />

      {/* Role Switcher & Auth Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BranchProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </BranchProvider>
    </AuthProvider>
  );
}
