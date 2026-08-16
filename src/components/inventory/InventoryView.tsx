import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { 
  Boxes, 
  Plus, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Search, 
  Filter, 
  FileText, 
  Layers, 
  CheckCircle2, 
  X,
  History,
  TrendingDown
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { Ingredient, InventoryMovement, InventoryMovementType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export const InventoryView: React.FC = () => {
  const { userProfile, isManager, isKitchen } = useAuth();
  const { currentBranchId } = useBranch();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'movements'>('stock');

  // New Ingredient Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Ingredient['category']>('Grains');
  const [unit, setUnit] = useState<Ingredient['unit']>('g');
  const [currentQty, setCurrentQty] = useState('10000');
  const [minQty, setMinQty] = useState('2000');
  const [maxQty, setMaxQty] = useState('50000');
  const [costPerUnit, setCostPerUnit] = useState('0.025');
  const [storageLocation, setStorageLocation] = useState('Pantry Shelf A');

  // Adjustment Modal State
  const [adjustItem, setAdjustItem] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<InventoryMovementType>('Adjustment');
  const [adjustQtyChange, setAdjustQtyChange] = useState<string>('0');
  const [adjustReason, setAdjustReason] = useState<string>('Routine physical count verification');

  useEffect(() => {
    const unsubIng = onSnapshot(collection(db, COLLECTIONS.INGREDIENTS), (snap) => {
      const arr: Ingredient[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Ingredient, id: d.id }));
      setIngredients(arr);
      setLoading(false);
    });

    const qMov = query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), orderBy('timestamp', 'desc'));
    const unsubMov = onSnapshot(qMov, (snap) => {
      const arr: InventoryMovement[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as InventoryMovement, id: d.id }));
      setMovements(arr);
    });

    return () => {
      unsubIng();
      unsubMov();
    };
  }, []);

  const totalValuation = ingredients.reduce((sum, i) => sum + (i.currentQuantity * i.costPerUnit), 0);
  const lowStockItems = ingredients.filter((i) => i.currentQuantity <= i.minQuantity);
  const outOfStockItems = ingredients.filter((i) => i.currentQuantity <= 0);

  const handleSaveNewIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;

    try {
      const id = `ing-${Date.now()}`;
      const ingRef = doc(db, COLLECTIONS.INGREDIENTS, id);
      const nowIso = new Date().toISOString();
      const qty = parseFloat(currentQty) || 0;
      const cost = parseFloat(costPerUnit) || 0;

      const newIng: Ingredient = {
        id,
        name,
        category,
        unit,
        currentQuantity: qty,
        minQuantity: parseFloat(minQty) || 0,
        maxQuantity: parseFloat(maxQty) || 0,
        costPerUnit: cost,
        storageLocation,
        lastUpdated: nowIso
      };

      await setDoc(ingRef, newIng);

      // Log initial stock creation movement
      const movRef = doc(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS));
      await setDoc(movRef, {
        id: movRef.id,
        ingredientId: id,
        ingredientName: name,
        type: 'Adjustment',
        quantityChange: qty,
        previousQuantity: 0,
        newQuantity: qty,
        unit,
        unitCost: cost,
        totalCost: qty * cost,
        reason: 'Initial stock intake',
        recordedBy: userProfile?.uid || 'admin',
        recordedByName: userProfile?.displayName || 'Manager',
        branchId: currentBranchId === 'all' ? 'tamale-central' : currentBranchId,
        timestamp: nowIso
      });

      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Error saving ingredient:', err);
    }
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem || !userProfile) return;

    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      const delta = parseFloat(adjustQtyChange) || 0;
      const prev = adjustItem.currentQuantity;
      const newQty = Math.max(0, prev + delta);

      // 1. Update ingredient currentQuantity
      const ingRef = doc(db, COLLECTIONS.INGREDIENTS, adjustItem.id);
      batch.update(ingRef, {
        currentQuantity: newQty,
        lastUpdated: nowIso
      });

      // 2. Add inventoryMovement document
      const movRef = doc(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS));
      const movementDoc: InventoryMovement = {
        id: movRef.id,
        ingredientId: adjustItem.id,
        ingredientName: adjustItem.name,
        type: adjustType,
        quantityChange: delta,
        previousQuantity: prev,
        newQuantity: newQty,
        unit: adjustItem.unit,
        unitCost: adjustItem.costPerUnit,
        totalCost: Math.abs(delta) * adjustItem.costPerUnit,
        reason: adjustReason,
        recordedBy: userProfile.uid,
        recordedByName: userProfile.displayName || 'Staff',
        branchId: currentBranchId === 'all' ? 'tamale-central' : currentBranchId,
        timestamp: nowIso
      };
      batch.set(movRef, movementDoc);

      await batch.commit();

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName || 'Staff',
        userProfile.role,
        'Manual Inventory Adjustment',
        'INVENTORY',
        `Adjusted ${adjustItem.name} by ${delta} ${adjustItem.unit} (Reason: ${adjustReason})`,
        adjustItem.id
      );

      setAdjustItem(null);
    } catch (err) {
      console.error('Error adjusting inventory:', err);
    }
  };

  const categoriesList = [
    'All',
    'Grains',
    'Meats & Poultry',
    'Vegetables',
    'Oils & Fats',
    'Spices & Seasoning',
    'Packaging',
    'Beverages',
    'Utilities & Gas',
    'Other'
  ];

  const filteredIngredients = ingredients.filter((item) => {
    const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div id="inventory-management-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Inventory & Stock Tracking</h2>
          <p className="text-xs text-stone-500">Live ingredient consumption, automatic POS deductions, and valuation</p>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <button
              id="add-inventory-item-btn"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stock Item</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block">Total Inventory Valuation</span>
          <span className="text-lg font-black text-amber-700 block mt-1">{formatGHS(totalValuation)}</span>
          <span className="text-[10px] text-stone-400">{ingredients.length} total SKUs tracked</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block">Low Stock Items</span>
          <span className={`text-lg font-black block mt-1 ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {lowStockItems.length} items
          </span>
          <span className="text-[10px] text-stone-400">Below reorder minimum</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block">Out of Stock</span>
          <span className={`text-lg font-black block mt-1 ${outOfStockItems.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {outOfStockItems.length} items
          </span>
          <span className="text-[10px] text-stone-400">Zero inventory remaining</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block">Recorded Movements</span>
          <span className="text-lg font-black text-stone-900 block mt-1">{movements.length} records</span>
          <span className="text-[10px] text-stone-400">Audited POS sales & entries</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-stone-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('stock')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeSubTab === 'stock'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Current Stock Levels ({ingredients.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('movements')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeSubTab === 'movements'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Ledger ({movements.length})</span>
        </button>
      </div>

      {activeSubTab === 'stock' ? (
        /* Stock Table */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search raw ingredient, packaging or beverage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-auto"
            >
              {categoriesList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                  <tr>
                    <th className="p-3.5">Ingredient Name</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Current Stock</th>
                    <th className="p-3.5">Cost / Unit</th>
                    <th className="p-3.5">Total Valuation</th>
                    <th className="p-3.5">Location</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredIngredients.map((ing) => {
                    const isLow = ing.currentQuantity <= ing.minQuantity;
                    const isZero = ing.currentQuantity <= 0;
                    return (
                      <tr key={ing.id} className="hover:bg-stone-50/80">
                        <td className="p-3.5">
                          <span className="font-bold text-stone-900 block">{ing.name}</span>
                          <span className="text-[10px] text-stone-400">Min: {ing.minQuantity} {ing.unit}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-semibold">
                            {ing.category}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold font-mono text-stone-900">
                          {Number(ing.currentQuantity).toLocaleString()} {ing.unit}
                        </td>
                        <td className="p-3.5 text-stone-600">
                          {formatGHS(ing.costPerUnit)} / {ing.unit}
                        </td>
                        <td className="p-3.5 font-bold text-amber-700">
                          {formatGHS(ing.currentQuantity * ing.costPerUnit)}
                        </td>
                        <td className="p-3.5 text-stone-500">
                          {ing.storageLocation || 'General Store'}
                        </td>
                        <td className="p-3.5">
                          {isZero ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              Adequate
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          {(isManager || isKitchen) && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustItem(ing);
                                setAdjustQtyChange('0');
                                setAdjustReason('Physical stocktake adjustment');
                              }}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg text-xs"
                            >
                              Adjust Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Movements Table */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                <tr>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Ingredient</th>
                  <th className="p-3.5">Movement Type</th>
                  <th className="p-3.5">Qty Change</th>
                  <th className="p-3.5">Balance</th>
                  <th className="p-3.5">Total Value</th>
                  <th className="p-3.5">Reason / Reference</th>
                  <th className="p-3.5">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {movements.map((m) => {
                  const isDeduction = m.quantityChange < 0;
                  return (
                    <tr key={m.id} className="hover:bg-stone-50/80">
                      <td className="p-3.5 text-stone-500 whitespace-nowrap">
                        {new Date(m.timestamp).toLocaleString('en-GH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3.5 font-bold text-stone-900">
                        {m.ingredientName}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.type === 'Sale/Consumption' 
                            ? 'bg-amber-50 text-amber-800'
                            : m.type === 'Purchase'
                            ? 'bg-emerald-50 text-emerald-800'
                            : m.type === 'Wastage'
                            ? 'bg-red-50 text-red-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}>
                          {m.type}
                        </span>
                      </td>
                      <td className="p-3.5 font-black">
                        <span className={isDeduction ? 'text-red-600' : 'text-emerald-600'}>
                          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange} {m.unit}
                        </span>
                      </td>
                      <td className="p-3.5 text-stone-600">
                        {m.newQuantity} {m.unit}
                      </td>
                      <td className="p-3.5 font-bold text-stone-900">
                        {formatGHS(m.totalCost)}
                      </td>
                      <td className="p-3.5 text-stone-600 max-w-xs truncate">
                        {m.reason || (m.orderId ? `POS Sale ${m.orderId}` : '-')}
                      </td>
                      <td className="p-3.5 text-stone-500">
                        {m.recordedByName || 'System'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Stock Adjustment: {adjustItem.name}</h3>
                <p className="text-[11px] text-amber-400">Current Qty: {adjustItem.currentQuantity} {adjustItem.unit}</p>
              </div>
              <button onClick={() => setAdjustItem(null)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as InventoryMovementType)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                >
                  <option value="Adjustment">Adjustment (Physical Audit Correction)</option>
                  <option value="Wastage">Wastage / Kitchen Spoilage</option>
                  <option value="Return">Return to Supplier</option>
                  <option value="Production">Production Batch Output</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Quantity Delta (Positive to add, Negative to deduct)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="-50 or +100"
                    value={adjustQtyChange}
                    onChange={(e) => setAdjustQtyChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-xs font-black"
                  />
                  <span className="font-bold text-stone-600">{adjustItem.unit}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Reason / Operational Memo</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Expired batch discarded, or weekly stock audit variance"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <div className="flex justify-between font-bold text-stone-800">
                  <span>New Expected Balance:</span>
                  <span className="text-amber-700">
                    {Math.max(0, adjustItem.currentQuantity + (parseFloat(adjustQtyChange) || 0))} {adjustItem.unit}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Record & Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Add New Raw Ingredient / Stock Item</h3>
                <p className="text-[11px] text-amber-400">Tamale Food Inventory Registry</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewIngredient} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northern Suya Spices"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    {categoriesList.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Stock Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="L">Liters (L)</option>
                    <option value="portion">Portion</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="bottle">Bottle</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={currentQty}
                    onChange={(e) => setCurrentQty(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Cost Per Unit (GHS)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-black text-amber-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Min Reorder Level</label>
                  <input
                    type="number"
                    step="any"
                    value={minQty}
                    onChange={(e) => setMinQty(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Storage Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Chiller A"
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs hover:bg-stone-800"
                >
                  Save Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
