import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  Flame, 
  AlertCircle, 
  BellRing, 
  ArrowRight,
  Sparkles,
  UtensilsCrossed,
  Layers
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, logAuditEvent } from '../../services/dbService';
import { Order, OrderStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export const KitchenView: React.FC = () => {
  const { userProfile } = useAuth();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Update timer every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to real-time non-completed orders
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.ORDERS),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const activeArr: Order[] = [];
      snap.forEach((docSnap) => {
        const data = { ...docSnap.data() as Order, id: docSnap.id };
        if (data.status !== 'Completed' && data.status !== 'Cancelled') {
          if (currentBranchId === 'all' || data.branchId === currentBranchId) {
            activeArr.push(data);
          }
        }
      });
      setOrders(activeArr);
      setLoading(false);
    }, (err) => {
      console.warn('KDS listener error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentBranchId]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        completedAt: newStatus === 'Completed' ? new Date().toISOString() : undefined
      });

      if (userProfile) {
        await logAuditEvent(
          userProfile.uid,
          userProfile.displayName || 'Kitchen Chef',
          userProfile.role,
          'Kitchen Order Status Updated',
          'SALE',
          `Order ${orderId} moved to ${newStatus}`,
          orderId
        );
      }
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  const getElapsedMinutes = (createdAt: string) => {
    const diffMs = now - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Aggregated dishes to prepare across active queue
  const aggregatedPrepItems = orders.reduce((acc, order) => {
    order.items.forEach(item => {
      acc[item.name] = (acc[item.name] || 0) + item.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  return (
    <div id="kitchen-display-screen" className="p-4 sm:p-6 bg-stone-900 min-h-[calc(100vh-65px)] text-stone-100 space-y-6">
      {/* KDS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-950 p-4 rounded-2xl border border-stone-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-black shadow-lg shadow-amber-500/20">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Kitchen Display System (KDS)</h2>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE SYNC
              </span>
            </div>
            <p className="text-xs text-stone-400">Tamale Kitchen Expediter & Station Queue</p>
          </div>
        </div>

        {/* Live Metrics Summary */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-stone-900 rounded-xl border border-stone-800 text-center">
            <span className="text-[10px] text-stone-500 block uppercase font-bold">In Queue</span>
            <span className="text-base font-black text-amber-400">{orders.length} orders</span>
          </div>
          <div className="px-4 py-2 bg-stone-900 rounded-xl border border-stone-800 text-center">
            <span className="text-[10px] text-stone-500 block uppercase font-bold">Total Plates</span>
            <span className="text-base font-black text-white">
              {Object.values(aggregatedPrepItems).reduce<number>((a, b) => a + Number(b || 0), 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Aggregated Preparation Quick Bar */}
      {Object.keys(aggregatedPrepItems).length > 0 && (
        <div className="bg-stone-950/80 p-3 rounded-xl border border-stone-800 flex items-center gap-3 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 shrink-0">
            <Flame className="w-4 h-4" />
            <span>Active Batch Needed:</span>
          </div>
          <div className="flex items-center gap-2">
            {Object.entries(aggregatedPrepItems).map(([name, qty]) => (
              <span
                key={name}
                className="px-2.5 py-1 bg-stone-800 border border-stone-700 rounded-lg text-xs text-stone-200 font-semibold whitespace-nowrap flex items-center gap-1.5"
              >
                <span className="font-bold text-amber-400">x{qty}</span>
                <span>{name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active Orders Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-stone-500 text-sm">
          Loading live kitchen orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-stone-950 rounded-2xl border border-stone-800 text-stone-500 gap-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <p className="text-base font-bold text-white">All Caught Up!</p>
          <p className="text-xs text-stone-400">No pending orders in the kitchen queue right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order) => {
            const elapsed = getElapsedMinutes(order.createdAt);
            const isLate = elapsed > 15;
            const isVeryLate = elapsed > 25;

            return (
              <div
                key={order.id}
                id={`kds-card-${order.id}`}
                className={`bg-stone-950 rounded-2xl border flex flex-col justify-between overflow-hidden transition-all shadow-xl ${
                  isVeryLate
                    ? 'border-red-500 ring-2 ring-red-500/20'
                    : isLate
                    ? 'border-amber-500'
                    : 'border-stone-800'
                }`}
              >
                {/* Card Top */}
                <div className="p-4 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-white">
                        {order.receiptNumber}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold text-[10px] rounded uppercase">
                        {order.orderType}
                      </span>
                    </div>
                    {order.customerName && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        Guest: <span className="text-stone-200 font-semibold">{order.customerName}</span>
                      </p>
                    )}
                  </div>

                  {/* Timer Pill */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                      isVeryLate
                        ? 'bg-red-500 text-white animate-pulse'
                        : isLate
                        ? 'bg-amber-500 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsed}m ago</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-60 scrollbar-thin">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between border-b border-stone-800/60 pb-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center shrink-0">
                            {item.quantity}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {item.name}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-amber-300 italic pl-8">
                            ⚠️ Note: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {order.notes && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200">
                      <span className="font-bold block">Order Memo:</span>
                      <span>{order.notes}</span>
                    </div>
                  )}
                </div>

                {/* Status Advancement Controls */}
                <div className="p-3 bg-stone-900 border-t border-stone-800 flex items-center gap-2">
                  {order.status === 'Pending' || order.status === 'Confirmed' ? (
                    <button
                      id={`kds-start-prep-${order.id}`}
                      onClick={() => updateOrderStatus(order.id, 'Preparing')}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Start Cooking (Preparing)</span>
                    </button>
                  ) : order.status === 'Preparing' ? (
                    <button
                      id={`kds-ready-${order.id}`}
                      onClick={() => updateOrderStatus(order.id, 'Ready')}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark Ready for Pickup / Delivery</span>
                    </button>
                  ) : order.status === 'Ready' ? (
                    <button
                      id={`kds-complete-${order.id}`}
                      onClick={() => updateOrderStatus(order.id, order.orderType === 'Delivery' ? 'Out for Delivery' : 'Completed')}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>{order.orderType === 'Delivery' ? 'Hand to Rider' : 'Complete Order'}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
