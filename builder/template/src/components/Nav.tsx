// TEMPLATE — the shared top nav. Its links come from src/routes.js, which the scaffold GENERATES in code from
// the pages that exist, so adding a page updates the nav for free (0 tokens) and this file never needs rewriting.
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth.tsx'
import Button from './Button.tsx'
import Avatar from './Avatar.tsx'
import { cx } from '../lib/cx.js'
import { navLinks, brand } from '../routes.js'


export default function Nav() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur border-b border-ink-100">
      <div className="container-page flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-ink-900 text-lg tracking-tight">
          <span className="h-8 w-8 rounded-lg bg-brand-600 text-brandfg flex items-center justify-center">
            <LayoutDashboard size={17} />
          </span>
          {brand}
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cx(
                'px-3 py-2 rounded-lg text-sm font-medium transition',
                location.pathname === link.to
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Avatar name={user.display_name || user.email} size="md" />
              <Button variant="ghost" onClick={logout}>
                <LogOut size={16} className="mr-1.5" /> Log out
              </Button>
            </div>
          ) : (
            <Link to="/signin">
              <Button variant="primary">Sign in</Button>
            </Link>
          )}
        </div>

        <button
          className="md:hidden p-2 rounded-lg text-ink-600 hover:bg-ink-50"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-ink-100 bg-surface">
          <nav className="container-page py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={cx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition',
                  location.pathname === link.to
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 mt-2 border-t border-ink-100">
              {user ? (
                <button
                  onClick={() => {
                    logout()
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-ink-600 hover:bg-ink-50"
                >
                  <LogOut size={16} /> Log out
                </button>
              ) : (
                <Link
                  to="/signin"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}