import { useState } from 'react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

type Screen = 'auth' | 'verify'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', displayName: '', password: '', email: '' })
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<Screen>('auth')
  const [userId, setUserId] = useState('')
  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [resent, setResent] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [pendingAuth, setPendingAuth] = useState<{ user: any; token: string } | null>(null)

  const handleUsername = (val: string) => {
    setForm(f => ({ ...f, username: val.replace(/[^a-zA-Z0-9_.]/g, '') }))
  }

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const url = isLogin ? '/auth/login' : '/auth/register'
      const { data } = await api.post(url, form)
      if (data.needVerification) {
        setUserId(data.user.id)
        setPendingAuth({ user: data.user, token: data.token })
        setScreen('verify')
      } else {
        setAuth(data.user, data.token)
        window.location.reload()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка')
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyError('')
    try {
      await api.post('/auth/verify-email', { userId, code })
      if (pendingAuth) {
        setAuth(pendingAuth.user, pendingAuth.token)
        window.location.reload()
      }
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || 'Неверный код')
    }
  }

  const resend = async () => {
    try {
      await api.post('/auth/resend-code', { userId })
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || 'Не удалось отправить код')
    }
  }

  if (screen === 'verify') {
    return (
      <div className="min-h-screen bg-chat flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4 text-4xl">✉️</div>
            <h1 className="text-2xl font-bold text-white">Подтверждение</h1>
            <p className="text-muted text-sm mt-1 text-center">Код отправлен на {form.email || 'твой email'}</p>
          </div>
          <div className="bg-sidebar rounded-2xl p-6 shadow-xl">
            <form onSubmit={verify} className="space-y-3">
              <input
                type="text"
                placeholder="Введи 6-значный код"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary text-center text-lg tracking-widest"
                maxLength={6}
                required
              />
              {verifyError && <p className="text-red-400 text-xs text-center">{verifyError}</p>}
              <button type="submit"
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition">
                Подтвердить
              </button>
            </form>
            <button onClick={resend} disabled={resent}
              className="w-full text-center text-muted text-sm mt-4 hover:text-white transition disabled:opacity-50">
              {resent ? 'Код отправлен повторно' : 'Отправить код снова'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-chat flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full overflow-hidden mb-4">
            <img src="/logo.png" className="w-full h-full object-cover" alt="CocoDack" />
          </div>
          <h1 className="text-2xl font-bold text-white">CocoDack</h1>
          <p className="text-muted text-sm mt-1">Быстрый и безопасный мессенджер</p>
        </div>

        <div className="bg-sidebar rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-5 text-center">
            {isLogin ? 'Войти в аккаунт' : 'Создать аккаунт'}
          </h2>

          <form onSubmit={handle} className="space-y-3">
            {!isLogin && (
              <input type="text" placeholder="Отображаемое имя" value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
                className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary transition"
                required />
            )}

            <div className="flex items-center bg-chat border border-border rounded-xl px-4 py-3 gap-1 focus-within:border-primary transition">
              <span className="text-muted text-sm select-none">@</span>
              <input type="text" placeholder="username" value={form.username}
                onChange={e => handleUsername(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder-muted focus:outline-none"
                required autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </div>

            {!isLogin && (
              <input type="email" placeholder="Email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary transition"
                required />
            )}

            <input type="password" placeholder="Пароль" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary transition"
              required />

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <button type="submit"
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition">
              {isLogin ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>

          <p className="text-center text-muted text-sm mt-4">
            {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <button onClick={() => { setIsLogin(!isLogin); setForm({ username: '', displayName: '', password: '', email: '' }); setError('') }}
              className="text-primary hover:underline">
              {isLogin ? 'Создать' : 'Войти'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
