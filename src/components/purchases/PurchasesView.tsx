import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  query, 
  orderBy,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Building2, 
  FileText, 
  Phone, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Search, 
  X,
  Boxes
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { Supplier, Purchase, PurchaseItem, Ingredient, PaymentMethodType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export const PurchasesView: React.FC = () => {
  const { userProfile, isManager, isAccountant } = useAuth();
  const { currentBranchId } = useBranch();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [loading, setLoading] = useState(true);

  // New Purchase Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Bank/Card');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [productsSupplied, setProductsSupplied] = useState('');

  useEffect(() => {
    const unsubSup = onSnapshot(collection(db, COLLECTIONS.SUPPLIERS), (snap) => {
      const arr: Supplier[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Supplier, id: d.id }));
      setSuppliers(arr);
    });

    const qPur = query(collection(db, COLLECTIONS.PURCHASES), orderBy('createdAt', 'desc'));
    const unsubPur = onSnapshot(qPur, (snap) => {
      const arr: Purchase[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Purchase, id: d.id }));
      setPurchases(arr);
      setLoading(false);
    });

    const unsubIng = onSnapshot(collection(db, COLLECTIONS.INGREDIENTS), (snap) => {
      const arr: Ingredient[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Ingredient, id: d.id }));
      setIngredients(arr);
    });

    return () => {
      unsubSup();
      unsubPur();
      unsubIng();
    };
  }, []);

  const handleAddPurchaseLine = (ingredientId: string) => {
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (!ing) return;
    if (purchaseItems.some((p) => p.ingredientId === ingredientId)) return;

    const defaultQty = ing.unit === 'g' ? 10000 : ing.unit === 'ml' ? 5000 : 10;
    setPurchaseItems([
      ...purchaseItems,
      {
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantity: defaultQty,
        unit: ing.unit,
        unitCost: ing.costPerUnit,
        totalCost: defaultQty * ing.costPerUnit
      }
    ]);
  };

  const handleUpdatePurchaseLine = (index: number, field: 'quantity' | 'unitCost', value: number) => {
    setPurchaseItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const qty = field === 'quantity' ? value : item.quantity;
          const cost = field === 'unitCost' ? value : item.unitCost;
          return {
            ...item,
            [field]: value,
            totalCost: qty * cost
          };
        }
        return item;
      })
    );
  };

  const handleRemovePurchaseLine = (index: number) => {
    setPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalPurchaseCost = purchaseItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || purchaseItems.length === 0) return;

    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      const purchaseId = `pur-${Date.now()}`;
      const sup = suppliers.find((s) => s.id === selectedSupplierId);

      const purchaseDoc: Purchase = {
        id: purchaseId,
        supplierId: selectedSupplierId,
        supplierName: sup?.businessName || 'Local Tamale Supplier',
        invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
        date: purchaseDate,
        items: purchaseItems,
        totalCost: totalPurchaseCost,
        paymentStatus,
        paymentMethod,
        notes: purchaseNotes,
        recordedBy: userProfile.uid,
        recordedByName: userProfile.displayName || 'Manager',
        branchId: currentBranchId === 'all' ? 'tamale-central' : currentBranchId,
        createdAt: nowIso
      };

      const purRef = doc(db, COLLECTIONS.PURCHASES, purchaseId);
      batch.set(purRef, purchaseDoc);

      // Automatically increment stock quantities for all purchased ingredients
      for (const item of purchaseItems) {
        const ingRef = doc(db, COLLECTIONS.INGREDIENTS, item.ingredientId);
        const ingSnap = await getDoc(ingRef);

        if (ingSnap.exists()) {
          const currentIng = ingSnap.data() as Ingredient;
          const prevQty = currentIng.currentQuantity || 0;
          const newQty = prevQty + item.quantity;

          batch.update(ingRef, {
            currentQuantity: newQty,
            costPerUnit: item.unitCost, // Update latest purchasing unit cost
            lastUpdated: nowIso
          });

          // Create inventory movement record
          const movRef = doc(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS));
          batch.set(movRef, {
            id: movRef.id,
            ingredientId: item.ingredientId,
            ingredientName: item.ingredientName,
            type: 'Purchase',
            quantityChange: item.quantity,
            previousQuantity: prevQty,
            newQuantity: newQty,
            unit: item.unit,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            purchaseId,
            reason: `Supplier Invoice: ${purchaseDoc.invoiceNumber}`,
            recordedBy: userProfile.uid,
            recordedByName: userProfile.displayName,
            branchId: purchaseDoc.branchId,
            timestamp: nowIso
          });
        }
      }

      await batch.commit();

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Staff',
        userProfile.role,
        'Purchase Order Recorded',
        'PURCHASE',
        `Recorded purchase invoice ${purchaseDoc.invoiceNumber} totaling ${formatGHS(totalPurchaseCost)} and replenished stock items.`,
        purchaseId
      );

      setIsPurchaseModalOpen(false);
      setPurchaseItems([]);
      setInvoiceNumber('');
      setPurchaseNotes('');
    } catch (err) {
      console.error('Error saving purchase:', err);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = `sup-${Date.now()}`;
      const supRef = doc(db, COLLECTIONS.SUPPLIERS, id);
      const newSup: Supplier = {
        id,
        businessName: supplierName,
        contactPerson,
        phone: supplierPhone,
        email: supplierEmail,
        address: supplierAddress,
        productsSupplied: productsSupplied.split(',').map((s) => s.trim()).filter(Boolean),
        createdAt: new Date().toISOString()
      };
      await setDoc(supRef, newSup);
      setIsSupplierModalOpen(false);
      setSupplierName('');
      setContactPerson('');
      setSupplierPhone('');
      setSupplierEmail('');
      setSupplierAddress('');
      setProductsSupplied('');
    } catch (err) {
      console.error('Error saving supplier:', err);
    }
  };

  return (
    <div id="purchases-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Suppliers & Stock Inflow</h2>
          <p className="text-xs text-stone-500">Purchase orders, raw goods replenishment, and verified vendor directory</p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'purchases' ? (
            <button
              id="new-purchase-invoice-btn"
              onClick={() => setIsPurchaseModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Record Purchase Invoice</span>
            </button>
          ) : (
            <button
              id="new-supplier-btn"
              onClick={() => setIsSupplierModalOpen(true)}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'purchases'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase Invoices ({purchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === 'suppliers'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Registered Suppliers ({suppliers.length})</span>
        </button>
      </div>

      {activeTab === 'purchases' ? (
        /* Purchases List */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Items Inflow</th>
                  <th className="p-3.5">Total Cost</th>
                  <th className="p-3.5">Payment Method</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400">
                      No purchase invoices recorded yet. Click "Record Purchase Invoice" to add stock.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50/80">
                      <td className="p-3.5 font-bold font-mono text-stone-900">
                        {p.invoiceNumber}
                      </td>
                      <td className="p-3.5 text-stone-500 whitespace-nowrap">
                        {p.date}
                      </td>
                      <td className="p-3.5 font-bold text-stone-800">
                        {p.supplierName}
                      </td>
                      <td className="p-3.5 text-stone-600 max-w-xs truncate">
                        {p.items.map((i) => `${i.quantity}${i.unit} ${i.ingredientName}`).join(', ')}
                      </td>
                      <td className="p-3.5 font-black text-amber-700 whitespace-nowrap">
                        {formatGHS(p.totalCost)}
                      </td>
                      <td className="p-3.5 text-stone-600">
                        {p.paymentMethod}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.paymentStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-stone-500">
                        {p.recordedByName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Suppliers Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">{s.businessName}</h4>
                  <p className="text-xs text-amber-800 font-semibold">{s.contactPerson}</p>
                </div>
                <Building2 className="w-5 h-5 text-stone-400" />
              </div>

              <div className="space-y-1 text-xs text-stone-600 pt-2 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{s.phone}</span>
                </div>
                {s.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    <span>{s.email}</span>
                  </div>
                )}
                <p className="text-[11px] text-stone-500 mt-1">{s.address}</p>
              </div>

              <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-1">
                {s.productsSupplied?.map((prod, i) => (
                  <span key={i} className="px-2 py-0.5 bg-stone-100 text-stone-700 text-[10px] rounded-md font-medium">
                    {prod}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Purchase Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col max-h-[92vh]">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Supplier Purchase Invoice</h3>
                <p className="text-[11px] text-amber-400">Direct Stock Replenishment Engine</p>
              </div>
              <button onClick={() => setIsPurchaseModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Select Supplier</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                  >
                    <option value="">Choose Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.businessName} ({s.contactPerson})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Invoice / Receipt #</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-2026-081"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Bank/Card">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="MTN Mobile Money">MTN MoMo</option>
                    <option value="Telecel Cash">Telecel Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Paid">Paid in Full</option>
                    <option value="Pending">Pending Invoice Settlement</option>
                  </select>
                </div>
              </div>

              {/* Purchase Line Items Picker */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-xs">Purchased Stock Items</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddPurchaseLine(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-bold"
                  >
                    <option value="">+ Add Ingredient to Invoice...</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {purchaseItems.length === 0 ? (
                    <p className="text-stone-400 text-[11px] py-2 text-center">
                      No line items selected. Choose ingredients above to replenish stock.
                    </p>
                  ) : (
                    purchaseItems.map((item, idx) => (
                      <div key={item.ingredientId} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-stone-200">
                        <span className="font-bold text-stone-800 flex-1 truncate">{item.ingredientName}</span>

                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleUpdatePurchaseLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-center"
                          />
                          <span className="text-[10px] text-stone-500 font-bold">{item.unit}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-stone-400">@ ₵</span>
                          <input
                            type="number"
                            step="any"
                            value={item.unitCost}
                            onChange={(e) => handleUpdatePurchaseLine(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-center text-amber-800"
                          />
                        </div>

                        <span className="font-black text-amber-700 text-xs w-20 text-right">
                          {formatGHS(item.totalCost)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemovePurchaseLine(idx)}
                          className="p-1 text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center font-bold text-stone-900">
                <span>Total Invoice Valuation:</span>
                <span className="text-base text-amber-800 font-black">{formatGHS(totalPurchaseCost)}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purchaseItems.length === 0}
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800 disabled:opacity-40"
                >
                  Save & Replenish Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Add New Supplier Profile</h3>
                <p className="text-[11px] text-amber-400">Tamale Food Supply Network</p>
              </div>
              <button onClick={() => setIsSupplierModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Company / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northern Poultry Hub"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alhaji Abdulai"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+233 24 000 0000"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="vendor@mail.com"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Physical Address / Market Location</label>
                <input
                  type="text"
                  placeholder="Aboabo Market, Tamale"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Supplied Products (comma-separated)</label>
                <input
                  type="text"
                  placeholder="Fresh Chicken, Gizzard, Goat Meat"
                  value={productsSupplied}
                  onChange={(e) => setProductsSupplied(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
