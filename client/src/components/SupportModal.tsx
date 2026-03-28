import { useState } from 'react'
import api from '../lib/api'

export default function SupportModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      await api.post('/users/support', { message })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка')
    } finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-white mb-1">Поддержка</h3>
        <p className="text-xs text-muted mb-4">Опиши проблему — администратор ответит в ближайшее время</p>
        {sent ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-white font-medium">Обращение отправлено</p>
            <p className="text-xs text-muted mt-1">Администратор рассмотрит его в ближайшее время</p>
            <button onClick={onClose} className="mt-4 text-primary text-sm hover:underline">Закрыть</button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder="Опиши свою проблему..."
              className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary resize-none" />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-chat text-muted text-sm hover:text-white transition">
                Отмена
              </button>
              <button type="submit" disabled={sending || !message.trim()}
                className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
