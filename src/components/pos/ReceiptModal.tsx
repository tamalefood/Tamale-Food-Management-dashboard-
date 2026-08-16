import React from 'react';
import { X, Printer, Download, CheckCircle2, Store } from 'lucide-react';
import { Order } from '../../types';
import { formatGHS } from '../../services/dbService';
import { generateReceiptPdf } from '../../services/pdfService';

interface ReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, isOpen, onClose }) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = generateReceiptPdf(order, 'TAMALE FOOD', 'The Taste of the North');
    doc.save(`receipt-${order.receiptNumber}.pdf`);
  };

  return (
    <div id="receipt-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
      <div 
        id="receipt-modal-card" 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 flex flex-col max-h-[95vh]"
      >
        {/* Modal Top Bar */}
        <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold">Transaction Completed</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-6 overflow-y-auto font-mono text-xs text-stone-900 space-y-4 bg-amber-50/30">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-300">
            <div className="flex items-center justify-center gap-1.5 font-sans font-black text-lg text-stone-950">
              <Store className="w-5 h-5 text-amber-600" />
              <span>TAMALE FOOD</span>
            </div>
            <p className="text-[11px] text-amber-800 font-sans font-semibold">The Taste of the North</p>
            <p className="text-[10px] text-stone-500">Central Market Road, Tamale, Ghana</p>
            <p className="text-[10px] text-stone-500">Tel: +233 24 000 1234 / 0245551010</p>
          </div>

          <div className="text-[11px] space-y-1 text-stone-700">
            <div className="flex justify-between">
              <span className="font-bold">RECEIPT #:</span>
              <span className="font-bold text-stone-950">{order.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{new Date(order.createdAt).toLocaleString('en-GH')}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{order.cashierName || 'Staff'}</span>
            </div>
            <div className="flex justify-between">
              <span>Order Type:</span>
              <span className="font-bold uppercase text-amber-800">{order.orderType}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{order.customerName} ({order.customerPhone || 'N/A'})</span>
              </div>
            )}
            {order.riderInfo && (
              <div className="flex justify-between text-blue-700">
                <span>Rider:</span>
                <span>{order.riderInfo.name} ({order.riderInfo.phone})</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border-t border-b border-dashed border-stone-300 py-3 space-y-2">
            <div className="flex justify-between font-bold text-[10px] uppercase text-stone-500">
              <span>Item & Unit Price</span>
              <span>Qty / Subtotal</span>
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold text-stone-900 text-xs">
                  <span>{item.name}</span>
                  <span>{formatGHS(item.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-500">
                  <span>@{formatGHS(item.unitPrice)}</span>
                  <span>x {item.quantity}</span>
                </div>
                {item.notes && (
                  <p className="text-[10px] text-amber-700 italic">Note: {item.notes}</p>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatGHS(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount Applied:</span>
                <span>-{formatGHS(order.discount)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-stone-700">
                <span>Delivery Fee:</span>
                <span>+{formatGHS(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-stone-950 pt-1 border-t border-stone-300">
              <span>GRAND TOTAL:</span>
              <span className="text-amber-700 font-black">{formatGHS(order.total)}</span>
            </div>
          </div>

          {/* Payment Tendered */}
          <div className="bg-stone-100 p-2.5 rounded-lg space-y-1 text-[11px]">
            <span className="font-bold block text-stone-800 text-[10px] uppercase">Payment Breakdown</span>
            {order.paymentMethods.map((pm, i) => (
              <div key={i} className="flex justify-between text-stone-700">
                <span>{pm.method}{pm.reference ? ` (${pm.reference})` : ''}:</span>
                <span className="font-bold">{formatGHS(pm.amount)}</span>
              </div>
            ))}
            {order.amountReceived > order.total && (
              <>
                <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-200">
                  <span>Tender Received:</span>
                  <span>{formatGHS(order.amountReceived)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Change Given:</span>
                  <span>{formatGHS(order.changeGiven)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center pt-2 text-[10px] text-stone-500 font-sans">
            <p>Thank you for choosing Tamale Food!</p>
            <p className="font-bold text-stone-700 mt-0.5">Medaase! / Anincheba!</p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center gap-2">
          <button
            id="print-receipt-btn"
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-stone-100 text-stone-800 font-bold rounded-xl text-xs hover:bg-stone-200 flex items-center justify-center gap-2 border border-stone-300"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Print Receipt</span>
          </button>

          <button
            id="download-receipt-pdf-btn"
            type="button"
            onClick={handleDownloadPdf}
            className="flex-1 py-2.5 bg-amber-500 text-stone-950 font-black rounded-xl text-xs hover:bg-amber-400 flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4 text-stone-950" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
