import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import Stepper from '../components/Stepper.tsx'
import CartLineItem from '../components/CartLineItem.tsx'
import OrderSummary from '../components/OrderSummary.tsx'
import PromoCodeInput from '../components/PromoCodeInput.tsx'
import ShippingOptions from '../components/ShippingOptions.tsx'
import AddressForm from '../components/AddressForm.tsx'
import Input from '../components/Input.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import { FormSection } from '../components/FormSection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useCart, money } from '../lib/cart.ts'
import { useAuth } from '../lib/auth.tsx'
import { ShoppingCart } from 'lucide-react'

const SHIPPING = [
  { id: 'standard', label: 'Standard', eta: '3–5 working days', price: 'Free over $50', priceValue: 4.95 },
  { id: 'express', label: 'Express', eta: 'Next working day', price: '$12.00', priceValue: 12 },
]
const FREE_OVER = 50

export default function Cart() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { lines, subtotal, setQuantity, removeLine, clear } = useCart()
  const { saving, create } = useResource('orders')

  const [step, setStep] = useState(0)
  const [shipping, setShipping] = useState('standard')
  const [discount, setDiscount] = useState(0)
  const [error, setError] = useState('')

  const method = SHIPPING.find((s) => s.id === shipping) || SHIPPING[0]
  const shipCost = subtotal >= FREE_OVER && method.id === 'standard' ? 0 : method.priceValue
  const total = Math.max(0, subtotal - discount + shipCost)

  // The server owns discount codes in a real store; this keeps the field honest until that endpoint exists.
  const applyCode = (code) => {
    if (String(code).trim().toUpperCase() === 'WELCOME10') {
      setDiscount(subtotal * 0.1)
      return { ok: true, message: '10% off applied' }
    }
    return { ok: false, message: "That code isn't recognised" }
  }

  const placeOrder = async (e) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    const first = String(fd.get('first_name') || '').trim()
    const last = String(fd.get('last_name') || '').trim()
    const line2 = String(fd.get('line2') || '').trim()
    try {
      await create({
        reference: 'ORD-' + Date.now().toString(36).toUpperCase(),
        // The cart is snapshotted onto the order, so the customer keeps the price they agreed to even if the
        // product's price changes tomorrow.
        items: lines.map((l) => ({ id: l.id, title: l.title, price: l.price, quantity: l.quantity })),
        subtotal: Number(subtotal.toFixed(2)),
        shipping: Number(shipCost.toFixed(2)),
        total: Number(total.toFixed(2)),
        email: String(fd.get('email') || '').trim(),
        ship_name: `${first} ${last}`.trim(),
        ship_address: [String(fd.get('line1') || '').trim(), line2].filter(Boolean).join(', '),
        ship_city: String(fd.get('city') || '').trim(),
        ship_postcode: String(fd.get('postal_code') || '').trim(),
        status: 'pending',
      })
      clear()
      navigate('/orders')
    } catch (err) {
      setError(err.message || 'The order could not be placed. Please check your details.')
    }
  }

  if (!lines.length) {
    return (
      <div className="container-page py-10">
        <PageHeader title="Your cart" />
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Anything you add will show up here."
          actionLabel="Start shopping"
          actionAs={Link}
          actionTo="/shop"
          className="mt-10"
        />
      </div>
    )
  }

  const summary = (
    <OrderSummary
      title="Summary"
      lines={[
        { label: `Subtotal (${lines.length} item${lines.length === 1 ? '' : 's'})`, value: money(subtotal) },
        discount ? { label: 'Discount', value: '−' + money(discount) } : null,
        { label: 'Delivery', value: shipCost ? money(shipCost) : 'Free', muted: !shipCost },
      ].filter(Boolean)}
      total={money(total)}
      footer={<PromoCodeInput onApply={applyCode} onRemove={() => setDiscount(0)} applied={discount ? 'WELCOME10' : undefined} />}
    />
  )

  return (
    <div className="container-page py-10">
      <PageHeader title={step === 0 ? 'Your cart' : 'Checkout'} />
      <Stepper className="mt-6" steps={[{ label: 'Cart' }, { label: 'Delivery' }, { label: 'Done' }]} current={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {error ? <Alert tone="danger" className="mb-6" onDismiss={() => setError('')}>{error}</Alert> : null}

          {step === 0 ? (
            <>
              <div className="divide-y divide-ink-100 rounded-xl2 border border-ink-100 bg-surface px-5">
                {lines.map((l) => (
                  <CartLineItem
                    key={l.id}
                    title={l.title}
                    image={l.image}
                    price={money(l.price)}
                    quantity={l.quantity}
                    onQuantityChange={(q) => setQuantity(l.id, q)}
                    onRemove={() => removeLine(l.id)}
                  />
                ))}
              </div>
              <div className="mt-6 flex justify-between">
                <Button as={Link} to="/shop" variant="ghost">Keep shopping</Button>
                <Button onClick={() => setStep(1)}>Checkout</Button>
              </div>
            </>
          ) : (
            <form onSubmit={placeOrder} className="space-y-6">
              {!user ? (
                <Alert tone="info" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
                  Sign in before checking out so the order is saved to your account and you can track it.
                </Alert>
              ) : null}

              <FormSection title="Where is it going?">
                <Input name="email" label="Email" type="email" required autoComplete="email" hint="For the confirmation and tracking." />
                <AddressForm className="mt-4" />
              </FormSection>

              <FormSection title="How fast?">
                <ShippingOptions
                  options={SHIPPING.map((s) => (s.id === 'standard' && subtotal >= FREE_OVER ? { ...s, price: 'Free', note: 'Order over $50' } : s))}
                  value={shipping}
                  onChange={setShipping}
                />
              </FormSection>

              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(0)}>Back to cart</Button>
                <Button type="submit" loading={saving} disabled={saving || !user}>Place order · {money(total)}</Button>
              </div>
            </form>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">{summary}</div>
      </div>
    </div>
  )
}
