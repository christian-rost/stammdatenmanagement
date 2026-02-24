import { useState } from 'react'
import { useAuth } from '../auth.jsx'

function Login() {
  const { login, register } = useAuth()
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', confirmPassword: ''
  })

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      await login(loginForm.username, loginForm.password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwörter stimmen nicht überein')
      setLoading(false); return
    }
    try {
      await register(registerForm.username, registerForm.email, registerForm.password)
      setActiveTab('login')
      setLoginForm({ username: registerForm.username, password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Dubletten-Bereinigung</h1>

        <div className="login-tabs">
          <button
            className={`login-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setError(null) }}
          >Login</button>
          <button
            className={`login-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setError(null) }}
          >Registrieren</button>
        </div>

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Benutzername</label>
              <input type="text" value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Passwort</label>
              <input type="password" value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Benutzername</label>
              <input type="text" value={registerForm.username}
                onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                minLength={3} maxLength={32} required />
            </div>
            <div className="form-group">
              <label>E-Mail</label>
              <input type="email" value={registerForm.email}
                onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Passwort</label>
              <input type="password" value={registerForm.password}
                onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                minLength={8} required />
            </div>
            <div className="form-group">
              <label>Passwort bestätigen</label>
              <input type="password" value={registerForm.confirmPassword}
                onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} required />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
              {loading ? 'Registrieren...' : 'Registrieren'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login
