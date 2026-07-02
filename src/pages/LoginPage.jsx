import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LOGOS from '../assets/logos/index.js'
import './LoginPage.css'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-bg"/>
      <div className="login-card">
        <div className="login-logo">
          <img src={LOGOS.LEAGUE} alt="Sickos Only" className="login-league-logo"/>
        </div>
        <h1 className="login-title">SICKOS<em> ONLY</em></h1>
        <p className="login-sub">Commissioner Fantasy Football League</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">Email</label>
            <input className="login-input" type="email" autoComplete="email"
              placeholder="your@email.com"
              value={email} onChange={e=>setEmail(e.target.value)} required/>
          </div>
          <div className="login-field">
            <label className="login-label">Password</label>
            <input className="login-input" type="password" autoComplete="current-password"
              placeholder="••••••••"
              value={password} onChange={e=>setPassword(e.target.value)} required/>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className="login-footer">
          Access restricted to league members.<br/>
          Contact the commissioner if you need access.
        </p>
      </div>
    </div>
  )
}
