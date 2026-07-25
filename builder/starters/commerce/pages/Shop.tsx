import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import SearchFilterBar from '../components/SearchFilterBar.tsx'
import ProductCard from '../components/ProductCard.tsx'
import Pagination from '../components/Pagination.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import Button from '../components/Button.tsx'
import Select from '../components/Select.tsx'
import Alert from '../components/Alert.tsx'
import { useResource } from '../lib/useResource.ts'
import { useCart, money } from '../lib/cart.ts'
import { PackageSearch, ShoppingBag } from 'lucide-react'

const PER_PAGE = 12

export default function Shop() {
  const { data, loading, error } = useResource('products')
  const { add, count } = useCart()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  const categories = useMemo(
    () => [...new Set(data.map((p) => p.category).filter(Boolean))].sort(),
    [data]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = data.filter((p) =>
      p.active !== false &&
      (!category || p.category === category) &&
      (!q || (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    )
    if (sort === 'price-low') return [...rows].sort((a, b) => (a.price || 0) - (b.price || 0))
    if (sort === 'price-high') return [...rows].sort((a, b) => (b.price || 0) - (a.price || 0))
    return [...rows].sort((a, b) => (b.id || 0) - (a.id || 0))
  }, [data, query, category, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, pageCount)
  const shown = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Shop"
        description={filtered.length ? `${filtered.length} item${filtered.length === 1 ? '' : 's'}` : 'Everything we make.'}
        actions={
          <Button as={Link} to="/cart" variant={count ? 'primary' : 'secondary'}>
            <ShoppingBag size={16} />Cart{count ? ` (${count})` : ''}
          </Button>
        }
      />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}

      <SearchFilterBar
        className="mt-6"
        query={query}
        onQueryChange={(v) => { setQuery(v); setPage(1) }}
        placeholder="Search products…"
        trailing={
          <div className="flex gap-2">
            {categories.length ? (
              <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} aria-label="Category">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            ) : null}
            <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </Select>
          </div>
        }
      />

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-72 w-full rounded-xl2" />)}
        </div>
      ) : !shown.length ? (
        <EmptyState
          icon={PackageSearch}
          title={query || category ? 'Nothing matched' : 'The shop is empty'}
          description={query || category ? 'Try a broader search or clear the category filter.' : 'Products appear here as soon as they are added.'}
          actionLabel={query || category ? 'Clear filters' : undefined}
          onAction={() => { setQuery(''); setCategory(''); setPage(1) }}
          className="mt-12"
        />
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((p) => (
              <ProductCard
                key={p.id}
                title={p.title}
                price={money(p.price)}
                comparePrice={p.compare_price ? money(p.compare_price) : undefined}
                image={p.image}
                badge={p.stock === 0 ? 'Sold out' : p.compare_price > p.price ? 'Sale' : undefined}
                meta={p.category}
                onAdd={p.stock === 0 ? undefined : () => add(p)}
              />
            ))}
          </div>
          {pageCount > 1 ? <Pagination className="mt-10" page={safePage} pageCount={pageCount} onChange={setPage} /> : null}
        </>
      )}
    </div>
  )
}
