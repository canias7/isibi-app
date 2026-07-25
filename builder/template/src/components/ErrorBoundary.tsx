import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

// ErrorBoundary — stops one broken component from blanking the whole app. Wrap page content with it.
// (Must be a class: React only supports error boundaries via componentDidCatch.)
export default class ErrorBoundary extends Component<{ children?: any; fallback?: any }, { failed: boolean }> {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    if (typeof console !== 'undefined') console.error('ErrorBoundary caught:', error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-500">
          <AlertTriangle size={22} />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold text-ink-900">Something went wrong</h2>
        <p className="mt-1.5 text-sm text-ink-500">This section failed to load. Try refreshing the page.</p>
        <button type="button" onClick={() => this.setState({ failed: false })}
          className="mt-5 rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-canvas transition hover:bg-ink-800">
          Try again
        </button>
      </div>
    )
  }
}
