import { useState } from 'react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', displayName: '', password: '' })
  const [error, setError] = useState('')
  const setAuth = useAuthStore((s) => s.setAuth)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const url = isLogin ? '/auth/login' : '/auth/register'
      const { data } = await api.post(url, form)
      setAuth(data.user, data.token)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка')
    }
  }

  return (
    <div className="min-h-screen bg-chat flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.25.38-.51 1.07-.78 4.19-1.82 6.98-3.02 8.38-3.61 3.99-1.66 4.82-1.95 5.36-1.96.12 0 .38.03.55.17.14.12.18.28.2.45-.02.07-.02.13-.03.2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">PotaChat</h1>
          <p className="text-muted text-sm mt-1">Быстрый и безопасный мессенджер</p>
        </div>

        {/* Form */}
        <div className="bg-sidebar rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-5 text-center">
            {isLogin ? 'Войти в аккаунт' : 'Создать аккаунт'}
          </h2>

          <form onSubmit={handle} className="space-y-3">
            <input
              type="text"
              placeholder="Имя пользователя"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary transition"
              required
            />
            {!isLogin && (
              <input
                type="text"
                placeholder="Отображаемое имя"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary transition"
                required
              />
            )}
            <input
              type="password"
              placeholder="Пароль"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary transition"
              required
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition"
            >
              {isLogin ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>

          <p className="text-center text-muted text-sm mt-4">
            {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? 'Создать' : 'Войти'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
