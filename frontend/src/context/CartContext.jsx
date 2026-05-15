/**
 * CartContext — Müşteri Sepet Yönetimi
 *
 * İçerik oturum boyunca bellekte tutulur (localStorage yok).
 * useCart() hook'u ile her yerden erişilebilir.
 */

import { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  // items: [{ listing_id, title, price, cargo_price, image, stock, quantity }]

  const addItem = (listing, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.listing_id === listing.id)
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, listing.stock ?? 99)
        return prev.map(i =>
          i.listing_id === listing.id ? { ...i, quantity: newQty } : i
        )
      }
      return [
        ...prev,
        {
          listing_id:  listing.id,
          title:       listing.title,
          price:       listing.price,
          cargo_price: listing.cargo_price ?? 29.90,
          image:       listing.clean_image_url,
          stock:       listing.stock,
          quantity:    Math.min(qty, listing.stock ?? 99),
        },
      ]
    })
  }

  const removeItem = (listing_id) =>
    setItems(prev => prev.filter(i => i.listing_id !== listing_id))

  const updateQty = (listing_id, qty) => {
    if (qty <= 0) { removeItem(listing_id); return }
    setItems(prev =>
      prev.map(i => i.listing_id === listing_id
        ? { ...i, quantity: Math.min(qty, i.stock ?? 99) }
        : i
      )
    )
  }

  const clear = () => setItems([])

  const totalItems = items.reduce((s, i) => s + i.quantity, 0)
  const totalPrice = items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0)

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQty, clear,
      totalItems, totalPrice,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
