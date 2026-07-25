// cart.ts — the basket, held in the browser.
//
// There is deliberately NO cart table. A cart is not a record: it belongs to the device, it changes on every tap,
// and writing each change to the database would be a round trip per click for data nobody keeps. The cart becomes
// a record exactly once — at checkout, as the `items` snapshot on the order — so the price the customer agreed to
// is frozen even if the product's price changes afterwards.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'cart_v1'

export interface CartLine {
  id: number | string
  title: string
  price: number
  image?: string
  quantity: number
}

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(lines: CartLine[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch {}
  // Same-tab listeners: the `storage` event only fires in OTHER tabs, so without this the header count would
  // not move when you add something from the shop.
  window.dispatchEvent(new Event('cart-change'))
}

/** useCart() — the basket plus the four things any page does to it. */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(read)

  useEffect(() => {
    const sync = () => setLines(read())
    window.addEventListener('cart-change', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('cart-change', sync); window.removeEventListener('storage', sync) }
  }, [])

  const add = useCallback((product, quantity = 1) => {
    const next = read()
    const found = next.find((l) => String(l.id) === String(product.id))
    if (found) found.quantity += quantity
    else next.push({ id: product.id, title: product.title, price: Number(product.price) || 0, image: product.image, quantity })
    write(next)
  }, [])

  const setQuantity = useCallback((id, quantity) => {
    const q = Math.max(0, Number(quantity) || 0)
    write(read().filter((l) => String(l.id) !== String(id) || q > 0).map((l) => (String(l.id) === String(id) ? { ...l, quantity: q } : l)))
  }, [])

  const removeLine = useCallback((id) => { write(read().filter((l) => String(l.id) !== String(id))) }, [])
  const clear = useCallback(() => { write([]) }, [])

  const count = lines.reduce((n, l) => n + l.quantity, 0)
  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0)

  return { lines, count, subtotal, add, setQuantity, removeLine, clear }
}

export const money = (n) => '$' + (Number(n) || 0).toFixed(2)
