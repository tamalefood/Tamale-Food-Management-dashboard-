import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wallet, 
  Smartphone, 
  CreditCard, 
  Banknote, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { PaymentMethodType, SplitPayment, PosShift, Order } from '../../types';
import { formatGHS, processPosSale, generateReceiptNumber } from '../../services/dbService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: PosShift | null;
  onPaymentSuccess: (order: Order) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  onPaymentSuccess
}) => {
  const { 
    items, 
    total, 
    subtotal, 
    discount, 
    deliveryFee, 
    totalProductionCost, 
    grossProfit, 
    orderType, 
    customerName, 
    customerPhone, 
    deliveryAddress,
    notes, 
    clearCart 
  } = useCart();
  const { userProfile } = useAuth();
  const { currentBranchId } = useBranch();

  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [singleMethod, setSingleMethod] = useState<PaymentMethodType>('Cash');
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([
    { method: 'Cash', amount: total > 0 ? Math.floor(total / 2) : 0 },
    { method: 'MTN Mobile Money', amount: total > 0 ? Math.ceil(total / 2) : 0, reference: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCashTenderedInput(total.toString());
      setSplitPayments([
        { method: 'Cash', amount: Math.floor(total / 2) },
        { method: 'MTN Mobile Money', amount: total - Math.floor(total / 2), reference: '' }
      ]);
      setError(null);
    }
  }, [isOpen, total]);

  if (!isOpen) return null;

  const quickCashShortcuts = [total, 50, 100, 200, 500].filter(
    (v, i, a) => a.indexOf(v) === i && v >= total
  );

  const calculateChange = (): number => {
    if (paymentMode === 'single' && singleMethod === 'Cash') {
      const tendered = parseFloat(cashTenderedInput) || 0;
      return Math.max(0, tendered - total);
    }
    return 0;
  };

  const getFinalPaymentMethods = (): SplitPayment[] => {
    if (paymentMode === 'single') {
      const tendered = parseFloat(cashTenderedInput) || total;
      return [{
        method: singleMethod,
        amount: singleMethod === 'Cash' ? Math.min(tendered, total) : total
      }];
    }
    return splitPayments.filter(p => p.amount > 0);
  };

  const splitTotal = splitPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const splitDifference = total - splitTotal;

  const handleAddSplitRow = () => {
    setSplitPayments(prev => [
      ...prev,
      { method: 'MTN Mobile Money', amount: Math.max(0, splitDifference), reference: '' }
    ]);
  };

  const handleRemoveSplitRow = (index: number) => {
    setSplitPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSplitRow = (index: number, field: keyof SplitPayment, value: any) => {
    setSplitPayments(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleCompleteSale = async () => {
    if (!userProfile) {
      setError('You must be logged in to process sales.');
      return;
    }

    if (items.length === 0) {
      setError('Cart is empty.');
      return;
    }

    if (paymentMode === 'split' && Math.abs(splitDifference) > 0.01) {
      setError(`Split total must equal exact order total (${formatGHS(total)}). Currently off by ${formatGHS(splitDifference)}.`);
      return;
    }

    setLoading(true);
    setError(null);

    const paymentMethods = getFinalPaymentMethods();
    const tendered = paymentMode === 'single' && singleMethod === 'Cash' 
      ? (parseFloat(cashTenderedInput) || total)
      : total;
    const changeGiven = calculateChange();
    const receiptNumber = generateReceiptNumber();

    const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
      receiptNumber,
      branchId: currentBranchId === 'all' ? 'tamale-central' : currentBranchId,
      cashierId: userProfile.uid,
      cashierName: userProfile.displayName || 'Cashier',
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      orderType,
      status: 'Completed',
      items,
      subtotal,
      discount,
      deliveryFee,
      total,
      totalProductionCost,
      grossProfit,
      paymentStatus: 'Paid',
      paymentMethods,
      amountReceived: tendered,
      changeGiven,
      notes: notes || undefined,
      riderInfo: orderType === 'Delivery' && deliveryAddress ? {
        name: 'Auto Assigned Rider',
        phone: '+233 24 555 4040',
        assignedAt: new Date().toISOString(),
        deliveryAddress
      } : undefined,
      shiftId: activeShift?.id
    };

    const result = await processPosSale({
      orderData,
      user: userProfile,
      activeShift
    });

    setLoading(false);

    if (result.success) {
      const completedOrder: Order = {
        ...orderData,
        id: result.orderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      clearCart();
      onPaymentSuccess(completedOrder);
    } else {
      setError(result.error || 'Failed to complete transaction.');
    }
  };

  const methodsList: { type: PaymentMethodType; icon: React.ElementType; color: string }[] = [
    { type: 'Cash', icon: Banknote, color: 'text-emerald-600' },
    { type: 'MTN Mobile Money', icon: Smartphone, color: 'text-amber-600' },
    { type: 'Telecel Cash', icon: Smartphone, color: 'text-red-600' },
    { type: 'AirtelTigo Money', icon: Smartphone, color: 'text-blue-600' },
    { type: 'Bank/Card', icon: CreditCard, color: 'text-purple-600' }
  ];

  return (
    <div id="payment-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
      <div 
        id="payment-modal-card" 
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white p-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-stone-950 font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">POS Checkout & Payment</h2>
              <p className="text-xs text-amber-400">Total Due: {formatGHS(total)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 scrollbar-thin">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher: Single vs Split Payment */}
          <div className="flex rounded-xl bg-stone-100 p-1 border border-stone-200">
            <button
              id="payment-single-mode-btn"
              type="button"
              onClick={() => setPaymentMode('single')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                paymentMode === 'single'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Single Tender Method
            </button>
            <button
              id="payment-split-mode-btn"
              type="button"
              onClick={() => setPaymentMode('split')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                paymentMode === 'split'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Split / Mixed Payment (Cash + MoMo)
            </button>
          </div>

          {paymentMode === 'single' ? (
            /* Single Tender Mode */
            <div className="space-y-4">
              <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Select Payment Channel
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {methodsList.map((m) => {
                  const Icon = m.icon;
                  const isSelected = singleMethod === m.type;
                  return (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => setSingleMethod(m.type)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-20 ${
                        isSelected
                          ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-500/20 font-bold'
                          : 'border-stone-200 hover:border-amber-300 bg-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${m.color}`} />
                      <span className="text-xs text-stone-900 font-bold leading-tight">
                        {m.type}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* If Cash Selected: Tendered shortcuts & Change calculator */}
              {singleMethod === 'Cash' && (
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-700">Cash Received from Customer</label>
                    <span className="text-xs text-stone-500">Order: {formatGHS(total)}</span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-stone-500">₵</span>
                    <input
                      type="number"
                      step="0.01"
                      min={total}
                      value={cashTenderedInput}
                      onChange={(e) => setCashTenderedInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-base font-black text-stone-900 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Quick cash pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {quickCashShortcuts.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashTenderedInput(val.toString())}
                        className="px-2.5 py-1 text-xs bg-white border border-stone-300 rounded-md font-semibold hover:border-amber-500 hover:bg-amber-50"
                      >
                        GHS {val}
                      </button>
                    ))}
                  </div>

                  {/* Change output */}
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-xs font-bold text-emerald-900">Change Due to Customer:</span>
                    <span className="text-sm font-black text-emerald-800">
                      {formatGHS(calculateChange())}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Split / Mixed Payment Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 uppercase">
                  Multi-Tender Splits
                </span>
                <span className={`text-xs font-black ${splitDifference === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {splitDifference === 0 
                    ? '✓ Balanced' 
                    : `Remaining: ${formatGHS(splitDifference)}`}
                </span>
              </div>

              <div className="space-y-2">
                {splitPayments.map((row, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-stone-50 rounded-xl border border-stone-200">
                    <select
                      value={row.method}
                      onChange={(e) => handleUpdateSplitRow(index, 'method', e.target.value as PaymentMethodType)}
                      className="text-xs font-bold bg-white border border-stone-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="MTN Mobile Money">MTN MoMo</option>
                      <option value="Telecel Cash">Telecel Cash</option>
                      <option value="AirtelTigo Money">AirtelTigo</option>
                      <option value="Bank/Card">Bank/Card</option>
                    </select>

                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1.5 text-[11px] font-bold text-stone-500">₵</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={row.amount || ''}
                        onChange={(e) => handleUpdateSplitRow(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full pl-6 pr-2 py-1.5 text-xs font-bold border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Ref / Phone (opt)"
                      value={row.reference || ''}
                      onChange={(e) => handleUpdateSplitRow(index, 'reference', e.target.value)}
                      className="w-28 px-2 py-1.5 text-xs border border-stone-300 rounded-lg bg-white focus:outline-none"
                    />

                    {splitPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSplitRow(index)}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSplitRow}
                className="w-full py-2 border border-dashed border-stone-300 rounded-xl text-xs font-bold text-stone-600 hover:border-amber-500 hover:text-amber-700 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tender Method</span>
              </button>
            </div>
          )}

          {/* Quick Summary Box */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1 text-stone-600">
            <div className="flex justify-between">
              <span>Items count:</span>
              <span className="font-bold text-stone-900">{items.reduce((s, i) => s + i.quantity, 0)} plates/items</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Recipe Production Cost:</span>
              <span className="font-semibold text-stone-700">{formatGHS(totalProductionCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Gross Profit:</span>
              <span className="font-bold text-emerald-700">{formatGHS(grossProfit)}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-stone-500 block">Total Due</span>
            <span className="text-base font-black text-amber-700">{formatGHS(total)}</span>
          </div>

          <button
            id="confirm-checkout-btn"
            type="button"
            disabled={loading || (paymentMode === 'split' && Math.abs(splitDifference) > 0.01)}
            onClick={handleCompleteSale}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Deducting Stock & Saving...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Payment & Print Receipt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
