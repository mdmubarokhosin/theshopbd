'use client';

/**
 * কার্ট হুক — localStorage সার্ভিস লেয়ারের সাথে বাইন্ডিং।
 * গেস্ট কার্ট tsb_cart কিতে, লগইন ইউজারের কার্ট tsb_cart_user_<id> কিতে থাকে;
 * লগইনের সময় auth.ts স্বয়ংক্রিয়ভাবে মার্জ করে।
 */
import { useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useCartData, notifyAuthChanged } from '@/lib/db/hooks';
import {
  getCart, addToCart as svcAdd, updateCartQty, removeFromCart as svcRemove, clearCart as svcClear,
  productById,
  type HydratedCartItem,
} from '@/lib/db/services';
import { trackAddToCart } from '@/lib/analytics';

export type { HydratedCartItem };

export function useCart() {
  const setCartCount = useStore((s) => s.setCartCount);
  const { items, subtotal, count } = useCartData();

  useEffect(() => {
    setCartCount(count);
  }, [count, setCartCount]);

  const refresh = useCallback(() => {
    const c = getCart();
    setCartCount(c.count);
    notifyAuthChanged();
  }, [setCartCount]);

  const addItem = useCallback(
    (productId: string, quantity = 1, variantKey = '') => {
      const res = svcAdd(productId, quantity, variantKey);
      if (res.ok) {
        // GA4 + Facebook Pixel — add_to_cart
        const p = productById(productId);
        if (p) {
          trackAddToCart({ id: p.id, name: p.nameBn || p.name, price: p.price, qty: quantity });
        }
      }
      refresh();
      return res;
    },
    [refresh]
  );

  const updateItem = useCallback(
    (productId: string, quantity: number, variantKey = '') => {
      updateCartQty(productId, quantity, variantKey);
      refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    (productId: string, variantKey = '') => {
      svcRemove(productId, variantKey);
      refresh();
    },
    [refresh]
  );

  const clearCart = useCallback(() => {
    svcClear();
    refresh();
  }, [refresh]);

  return { refresh, addItem, updateItem, removeItem, clearCart, items, subtotal, count };
}
