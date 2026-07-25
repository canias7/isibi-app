import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard.tsx'
import Input from '../components/Input.tsx'
import PasswordInput from '../components/PasswordInput.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import { useAuth } from '../lib/auth.tsx'

// Sign in / sign up. One card, one toggle — a separate /signup route just doubles the surface for no gain.
export default function SignIn() {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isSignUp = mode === 'signup'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isSignUp) await signup(email, password, name)
      else await login(email, password)
      navigate('/tickets')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <AuthCard
        title={isSignUp ? 'Create your account' : 'Welcome back'}
        subtitle={isSignUp ? 'So you can pick up tickets and answer them.' : 'Sign in to open the queue.'}
        footer={
          <button type="button" className="text-brand-600 hover:underline" onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError('') }}>
            {isSignUp ? 'Already have an account? Sign in' : "New here? Create an account"}
          </button>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {isSignUp ? (
            <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          ) : null}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            showStrength={isSignUp}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
          <Button type="submit" loading={busy} disabled={busy} className="w-full">
            {isSignUp ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      </AuthCard>
    </div>
  )
}
