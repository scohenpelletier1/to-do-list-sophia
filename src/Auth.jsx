import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './Auth.css'

function Auth() {
  const [mode, setMode] = useState('signup')
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser))
    return () => unsub()
  }, [])

  const welcomeText = useMemo(() => {
    if (!user) return 'Create an account to start'
    return user.displayName
      ? `Welcome, ${user.displayName}!`
      : `Welcome, ${user.email}!`
  }, [user])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const persistUser = async (createdUser, displayName) => {
    const profile = {
      uid: createdUser.uid,
      email: createdUser.email,
      displayName: displayName || createdUser.displayName || '',
      provider: createdUser.providerData[0]?.providerId ?? 'password',
      updatedAt: serverTimestamp(),
    }

    // Merge so repeat sign-ins do not overwrite other data.
    await setDoc(
      doc(db, 'users', createdUser.uid),
      { ...profile, createdAt: serverTimestamp() },
      { merge: true },
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: 'idle', message: '' })
    setLoading(true)

    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          form.email,
          form.password,
        )

        if (form.displayName) {
          await updateProfile(cred.user, { displayName: form.displayName })
        }

        await persistUser(cred.user, form.displayName)
        setStatus({ type: 'success', message: 'Account created and saved.' })
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.password)
        setStatus({ type: 'success', message: 'Signed in successfully.' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    setStatus({ type: 'success', message: 'Signed out.' })
  }

  const switchMode = () => {
    setMode((prev) => (prev === 'signup' ? 'login' : 'signup'))
    setStatus({ type: 'idle', message: '' })
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">To-Do List App</p>
        <h1>{welcomeText}</h1>
        <p className="subhead">
          {user
            ? 'You are authenticated. Your profile is saved in the "users" collection.'
            : 'Sign up or log in with email and password.'}
        </p>
      </header>

      <main className="card">
        <div className="card-header">
          <div className="chip">{mode === 'signup' ? 'Sign up' : 'Log in'}</div>
          <button className="link-btn" onClick={switchMode} type="button">
            {mode === 'signup'
              ? 'Already have an account? Log in'
              : "Need an account? Sign up"}
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="field">
              <span>Display name</span>
              <input
                name="displayName"
                type="text"
                placeholder="Ada Lovelace"
                value={form.displayName}
                onChange={handleChange}
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </label>

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Working...' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        {status.message && (
          <div
            className={`status ${
              status.type === 'error' ? 'status-error' : 'status-success'
            }`}
            role="alert"
          >
            {status.message}
          </div>
        )}

        {user && (
          <div className="user-card">
            <div>
              <p className="label">Signed in as</p>
              <p className="value">{user.email}</p>
              {user.displayName ? <p className="value">{user.displayName}</p> : null}
              <p className="label">UID</p>
              <p className="value mono">{user.uid}</p>
            </div>
            <button className="ghost-btn" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default Auth

