import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Utensils, 
  Clock, 
  Tag, 
  Percent, 
  PauseCircle, 
  PlayCircle, 
  User, 
  Phone, 
  MapPin, 
  Check, 
  X,
  CreditCard,
  ChefHat,
  Filter,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { COLLECTIONS, formatGHS } from '../../services/dbService';
import { MenuItem, PosShift, Order, OrderType } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentModal } from './PaymentModal';
import { ReceiptModal } from './ReceiptModal';

interface PosViewProps {
  activeShift: PosShift | null;
  onOpenShiftModal: () => void;
}

export const PosView: React.FC<PosViewProps> = ({ activeShift, onOpenShiftModal }) => {
  const { 
    items, 
    addItem, 
    updateQuantity, 
    removeItem, 
    setItemNotes, 
    subtotal, 
    discount, 
    deliveryFee, 
    total, 
    orderType, 
    setOrderType, 
    customerName, 
    setCustomerName, 
    customerPhone, 
    setCustomerPhone, 
    deliveryAddress,
    setDeliveryAddress,
    setDiscount, 
    clearCart, 
    holdCurrentCart, 
    heldCarts, 
    resumeHeldCart, 
    removeHeldCart 
  } = useCart();

  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showHeldDrawer, setShowHeldDrawer] = useState<boolean>(false);
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);
  const [discountVal, setDiscountVal] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [editingNotesItemId, setEditingNotesItemId] = useState<string | null>(null);
  const [itemNoteText, setItemNoteText] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<'menu' | 'cart'>('menu');

  const categories = [
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

  // Subscribe to real-time Firestore menuItems
  useEffect(() => {
    const q = collection(db, COLLECTIONS.MENU_ITEMS);
    const unsub = onSnapshot(q, (snap) => {
      const itemsArr: MenuItem[] = [];
      snap.forEach((docSnap) => {
        itemsArr.push({ ...docSnap.data() as MenuItem, id: docSnap.id });
      });
      setMenuList(itemsArr);
      setLoading(false);
    }, (err) => {
      console.warn('Menu load warning:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredMenuItems = menuList.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleApplyDiscount = () => {
    const d = parseFloat(discountVal) || 0;
    setDiscount(d);
    setShowDiscountInput(false);
  };

  const handleOpenItemNotes = (itemId: string, existingNotes?: string) => {
    setEditingNotesItemId(itemId);
    setItemNoteText(existingNotes || '');
  };

  const handleSaveItemNotes = () => {
    if (editingNotesItemId) {
      setItemNotes(editingNotesItemId, itemNoteText);
      setEditingNotesItemId(null);
      setItemNoteText('');
    }
  };

  return (
    <div id="pos-screen" className="flex flex-col lg:flex-row h-[calc(100vh-65px)] overflow-hidden bg-stone-100 relative">
      {/* Mobile Top View Switcher */}
      <div className="lg:hidden bg-stone-900 px-3 py-2 border-b border-stone-800 flex items-center justify-between shrink-0">
        <div className="flex bg-stone-800 p-0.5 rounded-xl text-xs font-bold w-full max-w-xs">
          <button
            type="button"
            onClick={() => setMobileTab('menu')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              mobileTab === 'menu'
                ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Menu Dishes</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              mobileTab === 'cart'
                ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Cart ({items.reduce((s, i) => s + i.quantity, 0)})</span>
            {total > 0 && <span className="font-mono text-[10px] text-stone-950 bg-amber-300 px-1 rounded">{formatGHS(total)}</span>}
          </button>
        </div>

        {heldCarts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHeldDrawer(true)}
            className="ml-2 px-2.5 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Held ({heldCarts.length})</span>
          </button>
        )}
      </div>

      {/* LEFT SECTION: Category tabs, Search & Menu Grid */}
      <div className={`flex-1 flex-col min-w-0 border-r border-stone-200 overflow-hidden ${mobileTab === 'menu' ? 'flex' : 'hidden lg:flex'}`}>
        {/* Top Controls: Search Bar & Shift Warning */}
        <div className="p-3 bg-white border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              id="pos-menu-search-input"
              type="text"
              placeholder="Search Tamale dishes, drinks, extra meat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {heldCarts.length > 0 && (
              <button
                id="view-held-orders-btn"
                type="button"
                onClick={() => setShowHeldDrawer(true)}
                className="hidden lg:flex px-3 py-2 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold items-center gap-1.5 hover:bg-amber-100 transition-all shadow-xs"
              >
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>Held Carts ({heldCarts.length})</span>
              </button>
            )}

            {!activeShift && (
              <button
                id="pos-open-shift-warning-btn"
                onClick={onOpenShiftModal}
                className="px-3 py-2 bg-amber-500 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-amber-400 animate-pulse shadow-xs"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Shift Not Open</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Horizontal Scrollable Bar */}
        <div className="bg-white px-3 py-2 border-b border-stone-200 overflow-x-auto flex items-center gap-1.5 scrollbar-none shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              id={`cat-btn-${cat.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-stone-400 text-xs">
              Loading Tamale Food catalog...
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-xs gap-2">
              <Utensils className="w-8 h-8 text-stone-300" />
              <p>No dishes found matching "{searchQuery}" in {selectedCategory}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 pb-20 lg:pb-0">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  id={`menu-card-${item.id}`}
                  onClick={() => item.available && addItem(item)}
                  className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden group select-none ${
                    item.available 
                      ? 'border-stone-200 hover:border-amber-400 hover:shadow-md cursor-pointer active:scale-98' 
                      : 'border-stone-200 opacity-60 cursor-not-allowed bg-stone-50'
                  }`}
                >
                  {/* Food Image */}
                  <div className="h-24 sm:h-28 w-full bg-stone-100 relative overflow-hidden">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-400">
                        <Utensils className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.category}
                    </span>
                    {!item.available && (
                      <span className="absolute inset-0 bg-stone-950/60 flex items-center justify-center text-white text-xs font-black uppercase tracking-wider">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-2 leading-tight">
                        {item.name}
                      </h4>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-2 border-t border-stone-100">
                      <div>
                        <span className="text-xs sm:text-sm font-black text-amber-700 block">
                          {formatGHS(item.sellingPrice)}
                        </span>
                        {item.totalProductionCost > 0 && (
                          <span className="text-[9px] text-stone-600 block">
                            Cost: {formatGHS(item.totalProductionCost)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!item.available}
                        aria-label={`Add ${item.name} to cart`}
                        className="w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center justify-center transition-all disabled:opacity-30 shadow-xs"
                      >
                        <Plus className="w-4 h-4 font-black" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Sticky Floating Cart Bar when looking at Menu */}
        {items.length > 0 && mobileTab === 'menu' && (
          <div className="lg:hidden p-3 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 fixed bottom-0 left-0 right-0 z-30 shadow-2xl">
            <button
              onClick={() => setMobileTab('cart')}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-950 font-black rounded-xl text-sm flex items-center justify-between shadow-md transition-all"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                <span>{items.reduce((s, i) => s + i.quantity, 0)} Items Selected</span>
              </div>
              <div className="flex items-center gap-1 text-base font-black">
                <span>{formatGHS(total)}</span>
                <span className="text-stone-950 font-black">→</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* RIGHT SECTION: Cart Sidebar */}
      <div 
        id="pos-cart-sidebar"
        className={`w-full lg:w-96 bg-white flex-col h-auto lg:h-full border-t lg:border-t-0 shadow-lg lg:shadow-none z-10 ${
          mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {/* Order Type Header */}
        <div className="p-3 bg-stone-900 text-white border-b border-stone-800 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Active Order
              </span>
              <span className="text-[11px] font-mono text-stone-300">
                ({items.reduce((s, i) => s + i.quantity, 0)} items)
              </span>
            </div>

            {/* Back button on mobile */}
            <button
              type="button"
              onClick={() => setMobileTab('menu')}
              className="lg:hidden text-xs text-stone-300 hover:text-white flex items-center gap-1 bg-stone-800 px-2 py-1 rounded-lg"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dishes
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {(['Dine-in', 'Takeaway', 'Pickup', 'Delivery'] as OrderType[]).map((type) => (
              <button
                key={type}
                type="button"
                id={`order-type-btn-${type.toLowerCase()}`}
                onClick={() => setOrderType(type)}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  orderType === type
                    ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Customer & Delivery Inputs */}
        <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-2" />
              <input
                type="tel"
                placeholder="Phone (MoMo/Call)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {orderType === 'Delivery' && (
            <div className="relative animate-in fade-in">
              <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Tamale Delivery Address / Landmark"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-stone-400 text-xs text-center">
              <Utensils className="w-8 h-8 text-stone-300 mb-2" />
              <p className="font-semibold text-stone-600">Cart is empty</p>
              <p className="text-[11px]">Select dishes from the menu to start order</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.menuItemId}
                id={`cart-item-${item.menuItemId}`}
                className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-stone-900 truncate">
                      {item.name}
                    </h5>
                    <span className="text-[11px] font-semibold text-amber-700">
                      {formatGHS(item.unitPrice)} each
                    </span>
                  </div>

                  <span className="text-xs font-black text-stone-900">
                    {formatGHS(item.subtotal)}
                  </span>
                </div>

                {/* Modifiers / Notes */}
                {item.notes && (
                  <p className="text-[10px] text-amber-700 italic bg-amber-50/80 px-2 py-0.5 rounded">
                    Note: {item.notes}
                  </p>
                )}

                {/* Stepper & Actions */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenItemNotes(item.menuItemId, item.notes)}
                    className="text-[10px] font-semibold text-stone-500 hover:text-amber-700 underline"
                  >
                    {item.notes ? 'Edit note' : '+ Add note / sauce'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menuItemId, -1)}
                      className="w-6 h-6 rounded-md bg-white border border-stone-300 text-stone-700 flex items-center justify-center hover:bg-stone-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-stone-900 min-w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menuItemId, 1)}
                      className="w-6 h-6 rounded-md bg-amber-500 text-stone-950 flex items-center justify-center hover:bg-amber-400 font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.menuItemId)}
                      className="p-1 text-stone-400 hover:text-red-600 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Item Note Modal / Prompt */}
        {editingNotesItemId && (
          <div className="p-3 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Extra spicy shito, no onions..."
              value={itemNoteText}
              onChange={(e) => setItemNoteText(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveItemNotes}
              className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingNotesItemId(null)}
              className="p-1 text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Totals & Discounts Section */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 text-xs space-y-1.5">
          <div className="flex justify-between text-stone-600">
            <span>Subtotal</span>
            <span>{formatGHS(subtotal)}</span>
          </div>

          {orderType === 'Delivery' && (
            <div className="flex justify-between text-stone-600">
              <span>Delivery Fee</span>
              <span>{formatGHS(deliveryFee)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-stone-600">
            <button
              type="button"
              onClick={() => setShowDiscountInput(!showDiscountInput)}
              className="text-amber-700 font-semibold hover:underline flex items-center gap-1"
            >
              <Tag className="w-3 h-3" />
              <span>{discount > 0 ? `Discount (${formatGHS(discount)})` : '+ Apply Discount'}</span>
            </button>
            {discount > 0 && <span className="text-red-600 font-bold">-{formatGHS(discount)}</span>}
          </div>

          {showDiscountInput && (
            <div className="flex gap-1.5 pt-1">
              <input
                type="number"
                placeholder="GHS amount"
                value={discountVal}
                onChange={(e) => setDiscountVal(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="px-2.5 py-1 bg-stone-800 text-white rounded-lg text-xs font-bold"
              >
                Apply
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline font-black">
            <span className="text-stone-900 text-sm">TOTAL AMOUNT</span>
            <span className="text-lg text-amber-700">{formatGHS(total)}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-white border-t border-stone-200 space-y-2">
          <div className="flex gap-2">
            <button
              id="clear-cart-btn"
              type="button"
              disabled={items.length === 0}
              onClick={clearCart}
              className="flex-1 py-2 bg-stone-100 text-stone-600 font-bold rounded-xl text-xs hover:bg-stone-200 disabled:opacity-40"
            >
              Cancel Order
            </button>

            <button
              id="hold-order-btn"
              type="button"
              disabled={items.length === 0}
              onClick={() => holdCurrentCart()}
              className="flex-1 py-2 bg-amber-50 text-amber-900 border border-amber-300 font-bold rounded-xl text-xs hover:bg-amber-100 disabled:opacity-40 flex items-center justify-center gap-1"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Hold Order</span>
            </button>
          </div>

          <button
            id="proceed-to-payment-btn"
            type="button"
            disabled={items.length === 0}
            onClick={() => setShowPaymentModal(true)}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pay {formatGHS(total)}</span>
          </button>
        </div>
      </div>

      {/* Held Carts Drawer */}
      {showHeldDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-stone-900">Held Orders Queue</h3>
              </div>
              <button onClick={() => setShowHeldDrawer(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5">
              {heldCarts.length === 0 ? (
                <p className="text-center py-6 text-xs text-stone-400">No held orders right now.</p>
              ) : (
                heldCarts.map((h) => {
                  const hTotal = h.items.reduce((s, i) => s + i.subtotal, 0) - (h.discount || 0);
                  return (
                    <div key={h.id} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <span className="font-bold text-stone-900 block">
                            {h.customerName || 'Walk-in Guest'} ({h.orderType})
                          </span>
                          <span className="text-[10px] text-stone-500">Held at {h.heldAt} • {h.items.length} items</span>
                        </div>
                        <span className="font-black text-amber-700">{formatGHS(hTotal)}</span>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            resumeHeldCart(h.id);
                            setShowHeldDrawer(false);
                          }}
                          className="flex-1 py-1.5 bg-amber-500 text-stone-950 font-bold rounded-lg text-xs hover:bg-amber-400 flex items-center justify-center gap-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Resume to Cart</span>
                        </button>
                        <button
                          onClick={() => removeHeldCart(h.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        activeShift={activeShift}
        onPaymentSuccess={(completedOrder) => {
          setShowPaymentModal(false);
          setLastCompletedOrder(completedOrder);
          setShowReceiptModal(true);
        }}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        order={lastCompletedOrder}
        onClose={() => setShowReceiptModal(false)}
      />
    </div>
  );
};
