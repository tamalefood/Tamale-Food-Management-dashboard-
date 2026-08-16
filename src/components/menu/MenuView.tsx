import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  UtensilsCrossed, 
  Plus, 
  Edit, 
  Trash2, 
  Calculator, 
  DollarSign, 
  Percent, 
  CheckCircle2, 
  XCircle, 
  X,
  Search,
  Sparkles,
  Layers
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS, logAuditEvent } from '../../services/dbService';
import { MenuItem, Ingredient, RecipeIngredient } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const MenuView: React.FC = () => {
  const { userProfile, isManager } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MenuItem['category']>('Fried Rice');
  const [sellingPrice, setSellingPrice] = useState<string>('50');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [packagingCost, setPackagingCost] = useState<string>('1.80');
  const [laborCost, setLaborCost] = useState<string>('2.50');
  const [available, setAvailable] = useState(true);
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);

  // Real-time subscribers
  useEffect(() => {
    const unsubMenu = onSnapshot(collection(db, COLLECTIONS.MENU_ITEMS), (snap) => {
      const arr: MenuItem[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as MenuItem, id: d.id }));
      setMenuItems(arr);
      setLoading(false);
    });

    const unsubIng = onSnapshot(collection(db, COLLECTIONS.INGREDIENTS), (snap) => {
      const arr: Ingredient[] = [];
      snap.forEach((d) => arr.push({ ...d.data() as Ingredient, id: d.id }));
      setIngredients(arr);
    });

    return () => {
      unsubMenu();
      unsubIng();
    };
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setName('');
    setCategory('Fried Rice');
    setSellingPrice('50');
    setDescription('');
    setImageUrl('https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80');
    setPackagingCost('1.80');
    setLaborCost('2.00');
    setAvailable(true);
    setRecipe([]);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setSellingPrice(item.sellingPrice.toString());
    setDescription(item.description || '');
    setImageUrl(item.image || '');
    setPackagingCost((item.packagingCost || 0).toString());
    setLaborCost((item.laborCost || 0).toString());
    setAvailable(item.available);
    setRecipe(item.recipe || []);
    setIsModalOpen(true);
  };

  // Recipe helpers
  const handleAddRecipeIngredient = (ingredientId: string) => {
    const target = ingredients.find((i) => i.id === ingredientId);
    if (!target) return;
    if (recipe.some((r) => r.ingredientId === ingredientId)) return;

    const defaultQty = target.unit === 'g' ? 100 : target.unit === 'ml' ? 30 : 1;
    const subCost = defaultQty * target.costPerUnit;

    setRecipe([
      ...recipe,
      {
        ingredientId: target.id,
        ingredientName: target.name,
        quantity: defaultQty,
        unit: target.unit,
        costPerUnit: target.costPerUnit,
        subtotalCost: subCost
      }
    ]);
  };

  const handleUpdateRecipeQuantity = (ingredientId: string, qty: number) => {
    setRecipe((prev) =>
      prev.map((r) => {
        if (r.ingredientId === ingredientId) {
          const subCost = qty * r.costPerUnit;
          return { ...r, quantity: qty, subtotalCost: subCost };
        }
        return r;
      })
    );
  };

  const handleRemoveRecipeIngredient = (ingredientId: string) => {
    setRecipe((prev) => prev.filter((r) => r.ingredientId !== ingredientId));
  };

  // Computed Costing values
  const numSellingPrice = parseFloat(sellingPrice) || 0;
  const numPackaging = parseFloat(packagingCost) || 0;
  const numLabor = parseFloat(laborCost) || 0;
  const totalIngredientCost = recipe.reduce((sum, r) => sum + (r.subtotalCost || 0), 0);
  const totalProductionCost = totalIngredientCost + numPackaging + numLabor;
  const grossProfit = numSellingPrice - totalProductionCost;
  const profitMargin = numSellingPrice > 0 ? (grossProfit / numSellingPrice) * 100 : 0;

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;

    try {
      const docId = editingItem ? editingItem.id : `menu-${Date.now()}`;
      const menuRef = doc(db, COLLECTIONS.MENU_ITEMS, docId);
      const nowIso = new Date().toISOString();

      const itemData: MenuItem = {
        id: docId,
        name,
        category,
        sellingPrice: numSellingPrice,
        description,
        image: imageUrl,
        available,
        packagingCost: numPackaging,
        laborCost: numLabor,
        recipe,
        ingredientCost: totalIngredientCost,
        totalProductionCost,
        grossProfit,
        profitMargin,
        updatedAt: nowIso,
        createdAt: editingItem?.createdAt || nowIso
      };

      await setDoc(menuRef, itemData, { merge: true });

      if (userProfile) {
        await logAuditEvent(
          userProfile.uid,
          userProfile.displayName || 'Manager',
          userProfile.role,
          editingItem ? 'Menu Item Updated' : 'Menu Item Created',
          'INVENTORY',
          `Saved menu dish: ${name} (Price: ${formatGHS(numSellingPrice)}, Cost: ${formatGHS(totalProductionCost)})`,
          docId
        );
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving menu item:', err);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    if (!isManager) return;
    try {
      const ref = doc(db, COLLECTIONS.MENU_ITEMS, item.id);
      await updateDoc(ref, { available: !item.available });
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  const categoriesList = [
    'All',
    'Fried Rice',
    'Jollof Rice',
    'Yam Fries',
    'Noodles',
    'Chicken',
    'Goat Meat',
    'Drinks',
    'Add-ons',
    'Other'
  ];

  const filteredItems = menuItems.filter((i) => {
    const matchesCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          i.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div id="menu-management-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Menu Catalog & Recipe Costing</h2>
          <p className="text-xs text-stone-500">Live ingredient consumption modeling, production costing, and profit margin analysis</p>
        </div>

        {isManager && (
          <button
            id="add-new-menu-item-btn"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Menu Dish</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search dish or category..."
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

      {/* Menu Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            id={`dish-card-${item.id}`}
            className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Dish Visual Header */}
              <div className="h-36 bg-stone-100 relative overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-300">
                    <UtensilsCrossed className="w-10 h-10" />
                  </div>
                )}
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-stone-950/80 backdrop-blur-xs text-white text-[10px] font-bold">
                  {item.category}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleAvailability(item)}
                  className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-xs transition-all ${
                    item.available
                      ? 'bg-emerald-500/90 text-white'
                      : 'bg-red-500/90 text-white'
                  }`}
                >
                  {item.available ? 'Available' : 'Disabled'}
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-black text-stone-900 leading-tight">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-stone-500 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Recipe Breakdown Pills */}
                <div className="space-y-1.5 pt-2 border-t border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">
                    Recipe Ingredients ({item.recipe?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {item.recipe && item.recipe.length > 0 ? (
                      item.recipe.slice(0, 4).map((r, i) => (
                        <span key={i} className="px-2 py-0.5 bg-stone-100 rounded text-[10px] text-stone-700 font-medium">
                          {r.quantity}{r.unit} {r.ingredientName.split(' ')[0]}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-stone-400 italic">No recipe linked</span>
                    )}
                    {item.recipe && item.recipe.length > 4 && (
                      <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] text-stone-500">
                        +{item.recipe.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Mathematical Cost & Profit Matrix */}
                <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-stone-500 block">Selling</span>
                    <span className="font-black text-stone-900">{formatGHS(item.sellingPrice)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block">Prod. Cost</span>
                    <span className="font-bold text-stone-700">{formatGHS(item.totalProductionCost)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 block">Profit ({item.profitMargin.toFixed(0)}%)</span>
                    <span className="font-black text-emerald-700">{formatGHS(item.grossProfit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            {isManager && (
              <div className="p-3 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 font-bold rounded-lg text-xs hover:bg-stone-100 flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5 text-stone-500" />
                  <span>Edit Recipe & Costing</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal: Add/Edit Menu Dish & Recipe Builder */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in flex flex-col max-h-[92vh]">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {editingItem ? 'Edit Menu Item & Recipe Costing' : 'Create New Menu Item'}
                </h3>
                <p className="text-[11px] text-amber-400">Automatic Ingredient Cost & Gross Profit Matrix</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Dish Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tamale Fried Rice + Spicy Chicken"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                  >
                    {categoriesList.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Selling Price (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-black text-amber-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Packaging Cost (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={packagingCost}
                    onChange={(e) => setPackagingCost(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Labor/Production (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={laborCost}
                    onChange={(e) => setLaborCost(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Photo Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Dish Description</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, seasonings, serving details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              {/* RECIPE BUILDER SECTION */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-stone-900 text-xs">Dynamic Recipe Ingredients</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      id="ingredient-picker-select"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddRecipeIngredient(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="">+ Add Ingredient...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({formatGHS(ing.costPerUnit)}/{ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {recipe.length === 0 ? (
                    <p className="text-stone-400 text-[11px] py-2 text-center">
                      No raw ingredients attached. Pick ingredients from inventory to calculate live production cost.
                    </p>
                  ) : (
                    recipe.map((r) => (
                      <div key={r.ingredientId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-200">
                        <div className="flex-1 min-w-0 pr-2">
                          <span className="font-bold text-stone-800 block truncate">{r.ingredientName}</span>
                          <span className="text-[10px] text-stone-500">
                            Unit Cost: {formatGHS(r.costPerUnit)} per {r.unit}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              value={r.quantity}
                              onChange={(e) => handleUpdateRecipeQuantity(r.ingredientId, parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-1 text-xs border border-stone-300 rounded text-center font-bold"
                            />
                            <span className="text-[10px] text-stone-600 font-bold">{r.unit}</span>
                          </div>

                          <span className="font-bold text-amber-700 text-xs w-16 text-right">
                            {formatGHS(r.subtotalCost)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveRecipeIngredient(r.ingredientId)}
                            className="p-1 text-stone-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* LIVE MATHEMATICAL COSTING DASHBOARD */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-bold text-stone-900">
                  <span>Computed Cost Breakdown</span>
                  <span className="text-amber-800">Formula Check</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded-lg border border-amber-200">
                    <span className="text-[10px] text-stone-500 block">Ingredients</span>
                    <span className="font-bold text-stone-900">{formatGHS(totalIngredientCost)}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200">
                    <span className="text-[10px] text-stone-500 block">Total Prod. Cost</span>
                    <span className="font-bold text-stone-900">{formatGHS(totalProductionCost)}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200">
                    <span className="text-[10px] text-emerald-800 block">Gross Profit</span>
                    <span className="font-black text-emerald-700">{formatGHS(grossProfit)}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200">
                    <span className="text-[10px] text-emerald-800 block">Margin</span>
                    <span className="font-black text-emerald-700">{profitMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <span>Save Menu Dish & Recipe</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
