import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem, OrderType } from '../types';

interface HeldCart {
  id: string;
  heldAt: string;
  customerName?: string;
  customerPhone?: string;
  orderType: OrderType;
  items: CartItem[];
  discount: number;
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryFee: number;
  discount: number; // in GHS
  notes: string;
  heldCarts: HeldCart[];
  addItem: (menuItem: MenuItem) => void;
  updateQuantity: (menuItemId: string, delta: number) => void;
  removeItem: (menuItemId: string) => void;
  setItemNotes: (menuItemId: string, notes: string) => void;
  setOrderType: (type: OrderType) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setDeliveryAddress: (addr: string) => void;
  setDeliveryFee: (fee: number) => void;
  setDiscount: (discount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
  holdCurrentCart: () => boolean;
  resumeHeldCart: (heldId: string) => void;
  removeHeldCart: (heldId: string) => void;
  // Calculations
  subtotal: number;
  totalProductionCost: number;
  total: number;
  grossProfit: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Calculate delivery fee auto-rule
  useEffect(() => {
    if (orderType === 'Delivery') {
      if (deliveryFee === 0) setDeliveryFee(15); // default GHS 15 within Tamale metro
    } else {
      setDeliveryFee(0);
    }
  }, [orderType]);

  const addItem = (menuItem: MenuItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItem.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: (i.quantity + 1) * i.unitPrice
              }
            : i
        );
      } else {
        return [
          ...prev,
          {
            menuItemId: menuItem.id,
            name: menuItem.name,
            unitPrice: menuItem.sellingPrice,
            quantity: 1,
            discount: 0,
            category: menuItem.category,
            recipeSnapshot: menuItem.recipe || [],
            productionCost: menuItem.totalProductionCost || 0,
            subtotal: menuItem.sellingPrice
          }
        ];
      }
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setItems((prev) => {
      return prev
        .map((item) => {
          if (item.menuItemId === menuItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.unitPrice
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeItem = (menuItemId: string) => {
    setItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const setItemNotes = (menuItemId: string, itemNotes: string) => {
    setItems((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, notes: itemNotes } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDeliveryFee(0);
    setDiscount(0);
    setNotes('');
    setOrderType('Dine-in');
  };

  const holdCurrentCart = (): boolean => {
    if (items.length === 0) return false;
    const newHeld: HeldCart = {
      id: `hold-${Date.now()}`,
      heldAt: new Date().toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }),
      customerName,
      customerPhone,
      orderType,
      items: [...items],
      discount,
      notes
    };
    setHeldCarts((prev) => [newHeld, ...prev]);
    clearCart();
    return true;
  };

  const resumeHeldCart = (heldId: string) => {
    const target = heldCarts.find((h) => h.id === heldId);
    if (!target) return;
    setItems(target.items);
    setCustomerName(target.customerName || '');
    setCustomerPhone(target.customerPhone || '');
    setOrderType(target.orderType);
    setDiscount(target.discount || 0);
    setNotes(target.notes || '');
    setHeldCarts((prev) => prev.filter((h) => h.id !== heldId));
  };

  const removeHeldCart = (heldId: string) => {
    setHeldCarts((prev) => prev.filter((h) => h.id !== heldId));
  };

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const totalProductionCost = items.reduce((sum, i) => sum + (i.productionCost * i.quantity), 0);
  const total = Math.max(0, subtotal - discount + deliveryFee);
  const grossProfit = total - totalProductionCost;

  return (
    <CartContext.Provider
      value={{
        items,
        orderType,
        customerName,
        customerPhone,
        deliveryAddress,
        deliveryFee,
        discount,
        notes,
        heldCarts,
        addItem,
        updateQuantity,
        removeItem,
        setItemNotes,
        setOrderType,
        setCustomerName,
        setCustomerPhone,
        setDeliveryAddress,
        setDeliveryFee,
        setDiscount,
        setNotes,
        clearCart,
        holdCurrentCart,
        resumeHeldCart,
        removeHeldCart,
        subtotal,
        totalProductionCost,
        total,
        grossProfit
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
