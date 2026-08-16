import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Receipt, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  Eye, 
  Printer, 
  Download,
  Calendar,
  AlertTriangle,
  User,
  Phone,
  MapPin,
  X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { Order, OrderStatus, OrderType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { ReceiptModal } from '../pos/ReceiptModal';
import { generateReceiptPdf } from '../../services/pdfService';

export const OrdersView: React.FC = () => {
  const { userProfile, isOwnerOrAdmin, isManager } = useAuth();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptOrderToPrint, setReceiptOrderToPrint] = useState<Order | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.ORDERS),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const arr: Order[] = [];
      snap.forEach((d) => {
        const data = { ...d.data() as Order, id: d.id };
        if (currentBranchId === 'all' || data.branchId === currentBranchId) {
          arr.push(data);
        }
      });
      setOrders(arr);
      setLoading(false);
    }, (err) => {
      console.warn('Orders listener error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentBranchId]);

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchesType = typeFilter === 'All' || o.orderType === typeFilter;
    const matchesSearch = 
      o.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerName && o.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.cashierName && o.cashierName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesType && matchesSearch;
  });

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
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
          userProfile.displayName || 'Staff',
          userProfile.role,
          'Order Status Changed',
          'SALE',
          `Order ${orderId} status set to ${newStatus}`,
          orderId
        );
      }
    } catch (err) {
      console.error('Error updating order:', err);
    }
  };

  const statusColors: Record<OrderStatus, { bg: string; text: string; border: string }> = {
    'Pending': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    'Confirmed': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    'Preparing': { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
    'Ready': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    'Out for Delivery': { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
    'Completed': { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' },
    'Cancelled': { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' }
  };

  return (
    <div id="orders-management-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Orders & Sales Register</h2>
          <p className="text-xs text-stone-500">Live order tracking, delivery dispatches, and sales receipts</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900">
            Total Orders: {orders.length}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by receipt #, customer name, cashier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Preparing">Preparing</option>
            <option value="Ready">Ready</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="All">All Order Types</option>
            <option value="Dine-in">Dine-in</option>
            <option value="Takeaway">Takeaway</option>
            <option value="Pickup">Pickup</option>
            <option value="Delivery">Delivery</option>
          </select>
        </div>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
            No orders found matching filters.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const sStyle = statusColors[order.status] || { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' };
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-stone-900 text-sm">{order.receiptNumber}</span>
                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold uppercase">
                      {order.orderType}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sStyle.bg} ${sStyle.text} ${sStyle.border}`}>
                    {order.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>{order.customerName ? order.customerName : 'Walk-in Guest'}</span>
                  <span className="font-mono text-stone-400 text-[11px]">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-xs text-stone-700 bg-stone-50 p-2 rounded-xl">
                  {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <div className="text-xs">
                    <span className="text-stone-400 text-[11px] block">Total</span>
                    <span className="font-black text-amber-700 text-sm">{formatGHS(order.total)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptOrderToPrint(order);
                        setShowReceiptModal(true);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-black flex items-center gap-1 shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Orders Table (Hidden on small mobile, visible on >= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
              <tr>
                <th className="p-3.5">Receipt #</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Type & Channel</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Items Summary</th>
                <th className="p-3.5">Total Sale</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">
                    No orders found matching filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const sStyle = statusColors[order.status] || { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' };
                  return (
                    <tr key={order.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-stone-900">
                        {order.receiptNumber}
                      </td>
                      <td className="p-3.5 text-stone-500 whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleString('en-GH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 text-[10px] font-bold uppercase">
                          {order.orderType}
                        </span>
                      </td>
                      <td className="p-3.5 text-stone-800">
                        {order.customerName ? (
                          <div>
                            <span className="font-bold block">{order.customerName}</span>
                            <span className="text-[10px] text-stone-500">{order.customerPhone || ''}</span>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Walk-in</span>
                        )}
                      </td>
                      <td className="p-3.5 text-stone-600 max-w-xs truncate">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="p-3.5 font-bold text-amber-700 whitespace-nowrap">
                        {formatGHS(order.total)}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${sStyle.bg} ${sStyle.text} ${sStyle.border}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg"
                            title="View Order Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptOrderToPrint(order);
                              setShowReceiptModal(true);
                            }}
                            className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg"
                            title="Print Thermal Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col max-h-[90vh]">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Order Details: {selectedOrder.receiptNumber}</h3>
                <p className="text-[11px] text-amber-400">Cashier: {selectedOrder.cashierName}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Order Status Action Selector */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-700">Update Status:</span>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => {
                    handleUpdateStatus(selectedOrder.id, e.target.value as OrderStatus);
                    setSelectedOrder({ ...selectedOrder, status: e.target.value as OrderStatus });
                  }}
                  className="px-3 py-1.5 font-bold bg-white border border-stone-300 rounded-lg text-xs"
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Ready">Ready</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <span className="font-bold text-stone-800 uppercase text-[10px] block">Items in Order</span>
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl p-3 bg-stone-50">
                  {selectedOrder.items.map((i, idx) => (
                    <div key={idx} className="py-2 flex justify-between">
                      <div>
                        <span className="font-bold text-stone-900 block">{i.quantity}x {i.name}</span>
                        <span className="text-[10px] text-stone-500">Unit: {formatGHS(i.unitPrice)} • Cost: {formatGHS(i.productionCost)}</span>
                        {i.notes && <p className="text-[10px] text-amber-700 italic">Memo: {i.notes}</p>}
                      </div>
                      <span className="font-bold text-stone-900">{formatGHS(i.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                  <span className="text-[10px] text-stone-500 block">Subtotal</span>
                  <span className="font-bold text-stone-900">{formatGHS(selectedOrder.subtotal)}</span>
                </div>
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                  <span className="text-[10px] text-stone-500 block">Production Cost</span>
                  <span className="font-bold text-stone-700">{formatGHS(selectedOrder.totalProductionCost)}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-800 block">Gross Profit</span>
                  <span className="font-black text-emerald-900">{formatGHS(selectedOrder.grossProfit)}</span>
                </div>
              </div>

              {/* Delivery Details */}
              {selectedOrder.riderInfo && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 space-y-1">
                  <span className="font-bold block text-[11px]">Delivery & Dispatch</span>
                  <p>Rider: {selectedOrder.riderInfo.name} ({selectedOrder.riderInfo.phone})</p>
                  <p>Address: {selectedOrder.riderInfo.deliveryAddress}</p>
                </div>
              )}

              {/* Tender Breakdown */}
              <div className="p-3 bg-stone-100 rounded-xl space-y-1">
                <span className="font-bold text-stone-800 block text-[10px] uppercase">Payment Tender</span>
                {selectedOrder.paymentMethods.map((pm, i) => (
                  <div key={i} className="flex justify-between text-stone-700">
                    <span>{pm.method}:</span>
                    <span className="font-bold">{formatGHS(pm.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReceiptOrderToPrint(selectedOrder);
                  setShowReceiptModal(true);
                }}
                className="px-4 py-2 bg-amber-500 text-stone-950 font-bold rounded-xl text-xs hover:bg-amber-400 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        order={receiptOrderToPrint}
        onClose={() => {
          setShowReceiptModal(false);
          setReceiptOrderToPrint(null);
        }}
      />
    </div>
  );
};
