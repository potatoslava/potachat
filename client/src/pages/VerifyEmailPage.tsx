import { useState } from 'react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import SupportModal from '../components/SupportModal'

export default function VerifyEmailPage() {
  const { user, token, setAuth } = useAuthStore()
  const [email, setEmail] = useState(user?.email || '')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>(user?.email ? 'code' : 'email')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [resent, setResent] = useState(false)
  const [showSupport, setShowSupport] = useState(false)

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      await api.post('/auth/send-verification', { email })
      setStep('code')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка')
    } finally { setSending(false) }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/auth/verify-email', { userId: user!.id, code })
      // Обновляем юзера в сторе
      const { data } = await api.get('/users/me')
      setAuth(data, token!)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Неверный код')
    }
  }

  const resend = async () => {
    await api.post('/auth/resend-code', { userId: user!.id })
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  return (
    <div className="fixed inset-0 bg-chat flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4 text-4xl">✉️</div>
          <h1 className="text-2xl font-bold text-white">Подтвердить аккаунт</h1>
          <p className="text-muted text-sm mt-2 text-center">
            {step === 'email'
              ? 'Введи свой Gmail для подтверждения аккаунта'
              : `Код отправлен на ${email || user?.email || 'твой email'}`
            }
          </p>
        </div>

        <div className="bg-sidebar rounded-2xl p-6 shadow-xl">
          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-3">
              <input type="email" placeholder="твой@gmail.com" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
                required />
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
              <button type="submit" disabled={sending}
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
                {sending ? 'Отправка...' : 'Отправить код'}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-3">
              <input type="text" placeholder="6-значный код" value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary text-center text-lg tracking-widest"
                maxLength={6} required />
              <p className="text-xs text-muted text-center">📁 Код может находиться в папке «Спам»</p>
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
              <button type="submit"
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition">
                Подтвердить
              </button>
              <button type="button" onClick={resend} disabled={resent}
                className="w-full text-center text-muted text-sm hover:text-white transition disabled:opacity-50">
                {resent ? 'Код отправлен повторно' : 'Отправить снова'}
              </button>
              <button type="button" onClick={() => setShowSupport(true)}
                className="w-full text-center text-primary text-sm hover:underline transition">
                Связаться с поддержкой
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
    {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
  )
}
