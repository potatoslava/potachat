import { useState, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import api from '../lib/api'

type Props = { onClose: () => void }

export default function ProfileModal({ onClose }: Props) {
  const { user, setAuth } = useAuthStore()
  const token = useAuthStore(s => s.token)!
  const { setChats } = useChatStore()
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.patch('/users/me', { displayName, bio })
      setAuth(data, token)
      // перезагружаем чаты чтобы обновить displayName везде
      api.get('/chats').then(({ data }) => setChats(data))
      setMsg('Сохранено')
    } catch { setMsg('Ошибка') }
    finally { setSaving(false) }
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('avatar', file)
    const { data } = await api.post('/users/me/avatar', form)
    setAuth(data, token)
    // перезагружаем чаты чтобы новая ава появилась у собеседников
    api.get('/chats').then(({ data }) => setChats(data))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-5">Мой профиль</h3>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
            {user?.avatar ? (
              <img src={`${user.avatar}?v=${Date.now()}`} className="w-20 h-20 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
                {user?.displayName?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          <p className="text-xs text-muted mt-2">Нажмите чтобы изменить</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Имя</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">О себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder="Расскажите о себе..."
              className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Имя пользователя</label>
            <input
              value={`@${user?.username}`}
              disabled
              className="w-full bg-chat/50 border border-border rounded-xl px-4 py-2.5 text-sm text-muted cursor-not-allowed"
            />
          </div>
        </div>

        {msg && <p className="text-xs text-primary mt-2 text-center">{msg}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-chat text-muted text-sm hover:text-white transition">
            Закрыть
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
