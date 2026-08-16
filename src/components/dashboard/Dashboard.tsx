import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingBag, 
  ChefHat, 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  Clock, 
  CreditCard, 
  Utensils, 
  CheckCircle2, 
  Sparkles,
  Users,
  Building2,
  Calendar
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS } from '../../services/dbService';
import { Order, MenuItem, Ingredient, Expense, PosShift } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

interface DashboardProps {
  onNavigate: (view: string) => void;
  activeShift: PosShift | null;
  onOpenShiftModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, activeShift, onOpenShiftModal }) => {
  const { userProfile, isOwnerOrAdmin, isManager, isCashier, isKitchen, isInvestor } = useAuth();
  const { currentBranchId, currentBranch } = useBranch();

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubOrders = onSnapshot(
      query(collection(db, COLLECTIONS.ORDERS), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => {
        const arr: Order[] = [];
        snap.forEach((d) => {
          const data = { ...d.data() as Order, id: d.id };
          if (currentBranchId === 'all' || data.branchId === currentBranchId) {
            arr.push(data);
          }
        });
        setOrders(arr);
        setLoading(false);
      }
    );

    const unsubMenu = onSnapshot(collection(db, COLLECTIONS.MENU_ITEMS), (snap) => {
      const arr: MenuItem[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as MenuItem, id: d.id }));
      setMenuItems(arr);
    });

    const unsubIng = onSnapshot(collection(db, COLLECTIONS.INGREDIENTS), (snap) => {
      const arr: Ingredient[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Ingredient, id: d.id }));
      setIngredients(arr);
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

    return () => {
      unsubOrders();
      unsubMenu();
      unsubIng();
      unsubExp();
    };
  }, [currentBranchId]);

  // Aggregate today's figures
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(todayStr) && o.status !== 'Cancelled');
  const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const todayCogs = todayOrders.reduce((sum, o) => sum + (o.totalProductionCost || 0), 0);
  const todayGrossProfit = todaySales - todayCogs;

  const activeKitchenOrders = orders.filter((o) => o.status === 'Pending' || o.status === 'Preparing' || o.status === 'Ready');
  const lowStockCount = ingredients.filter((i) => i.currentQuantity <= i.minQuantity).length;
  const totalStockValuation = ingredients.reduce((sum, i) => sum + (i.currentQuantity * i.costPerUnit), 0);
  const todayExpenses = expenses.filter((e) => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div id="executive-dashboard" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-stone-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-stone-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-500 text-stone-950 font-black text-xs rounded-full uppercase tracking-wider">
                {currentBranch ? currentBranch.name : 'Tamale Operations'}
              </span>
              <span className="text-stone-400 text-xs flex items-center gap-1 font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString('en-GH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, {userProfile?.displayName || 'Team Member'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 max-w-xl">
              Northern Ghana's premier food brand operations hub. Live sales, POS orders, kitchen fulfillment, inventory costing, and equity accounting.
            </p>
          </div>

          {/* Quick Shift Badge */}
          <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800/80 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-stone-400 font-bold uppercase">POS Register Shift</span>
              <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            </div>

            {activeShift ? (
              <div className="space-y-1">
                <div className="text-sm font-black text-emerald-400">SHIFT OPEN</div>
                <p className="text-[11px] text-stone-400">Cashier: {activeShift.cashierName}</p>
                <p className="text-[11px] text-amber-300 font-mono">Drawer: {formatGHS(activeShift.expectedCash)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-bold text-amber-400">No Shift Open</div>
                <button
                  onClick={onOpenShiftModal}
                  className="px-3 py-1.5 bg-amber-500 text-stone-950 font-bold text-xs rounded-xl hover:bg-amber-400"
                >
                  Open Shift
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('pos')}
          className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-500 transition-colors flex items-center justify-center text-amber-600 group-hover:text-stone-950 mb-3">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="text-xs font-black text-stone-900 block">Launch POS Counter</span>
          <span className="text-[10px] text-stone-500">Fast cashier terminal</span>
        </button>

        <button
          onClick={() => onNavigate('kitchen')}
          className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 group-hover:bg-orange-500 transition-colors flex items-center justify-center text-orange-600 group-hover:text-stone-950 mb-3">
            <ChefHat className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 block">Kitchen Screen</span>
            {activeKitchenOrders.length > 0 && (
              <span className="px-1.5 py-0.5 bg-orange-500 text-stone-950 font-black text-[10px] rounded-full">
                {activeKitchenOrders.length}
              </span>
            )}
          </div>
          <span className="text-[10px] text-stone-500">Live prep expediter</span>
        </button>

        <button
          onClick={() => onNavigate('inventory')}
          className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-500 transition-colors flex items-center justify-center text-blue-600 group-hover:text-stone-950 mb-3">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 block">Inventory & Stock</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white font-black text-[10px] rounded-full">
                {lowStockCount} low
              </span>
            )}
          </div>
          <span className="text-[10px] text-stone-500">Raw ingredients & SKU</span>
        </button>

        <button
          onClick={() => onNavigate('menu')}
          className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-500 transition-colors flex items-center justify-center text-emerald-600 group-hover:text-stone-950 mb-3">
            <Utensils className="w-5 h-5" />
          </div>
          <span className="text-xs font-black text-stone-900 block">Menu & Recipes</span>
          <span className="text-[10px] text-stone-500">Costing & gross margin</span>
        </button>
      </div>

      {/* Main Stats KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-stone-500 uppercase">Today's Gross Sales</span>
          <h3 className="text-2xl font-black text-stone-900">{formatGHS(todaySales)}</h3>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold pt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{todayOrders.length} completed transactions</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-stone-500 uppercase">Today's Gross Profit</span>
          <h3 className="text-2xl font-black text-emerald-700">{formatGHS(todayGrossProfit)}</h3>
          <p className="text-[11px] text-stone-500">
            COGS: {formatGHS(todayCogs)} ({(todaySales > 0 ? (todayGrossProfit / todaySales) * 100 : 0).toFixed(0)}% Margin)
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-stone-500 uppercase">Active Kitchen Orders</span>
          <h3 className="text-2xl font-black text-amber-700">{activeKitchenOrders.length} Orders</h3>
          <p className="text-[11px] text-stone-500">Currently cooking / dispatch</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-stone-500 uppercase">Stock Valuation</span>
          <h3 className="text-2xl font-black text-stone-900">{formatGHS(totalStockValuation)}</h3>
          <p className="text-[11px] text-stone-500">{ingredients.length} raw ingredients tracked</p>
        </div>
      </div>

      {/* Two Column Layout: Recent Orders & Best Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Ticker (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Recent Live POS Orders</h3>
              <p className="text-xs text-stone-400">Direct from cashier and online channels</p>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              <span>View All Register</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="py-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900">{order.receiptNumber}</span>
                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
                      {order.orderType}
                    </span>
                  </div>
                  <p className="text-stone-500 max-w-xs truncate">
                    {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </p>
                </div>

                <div className="text-right space-y-0.5">
                  <span className="font-black text-amber-700 block">{formatGHS(order.total)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    order.status === 'Completed' ? 'bg-stone-100 text-stone-600' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu Catalog & Profit Margins Summary */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">Featured Menu Dishes</h3>
              <button
                onClick={() => onNavigate('menu')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800"
              >
                Costing
              </button>
            </div>

            <div className="space-y-2.5">
              {menuItems.slice(0, 4).map((item) => (
                <div key={item.id} className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-stone-900 block truncate">{item.name}</span>
                    <span className="text-[10px] text-stone-500">{item.category} • Cost: {formatGHS(item.totalProductionCost)}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-stone-900 block">{formatGHS(item.sellingPrice)}</span>
                    <span className="text-[10px] text-emerald-700 font-bold">{item.profitMargin.toFixed(0)}% Margin</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('pos')}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 mt-4"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
