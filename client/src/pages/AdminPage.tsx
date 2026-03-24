import { useEffect, useState } from 'react'
import api from '../lib/api'

interface AdminUser {
  id: string
  username: string
  displayName: string
  avatar?: string
  online: boolean
  banned: boolean
  frozen: boolean
  bannedIp?: string
  createdAt: string
}

interface Event {
  id: string
  title: string
  description?: string
  createdAt: string
}

type Tab = 'users' | 'events' | 'bot'

export default function AdminPage({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)

  // Bot message state
  const [botTarget, setBotTarget] = useState<'all' | string>('all')
  const [botText, setBotText] = useState('')
  const [botSending, setBotSending] = useState(false)
  const [botMsg, setBotMsg] = useState('')

  // Event state
  const [evTitle, setEvTitle] = useState('')
  const [evDesc, setEvDesc] = useState('')
  const [evCreating, setEvCreating] = useState(false)

  // Ban IP state
  const [banIpMap, setBanIpMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'events') loadEvents()
  }, [tab])

  const loadUsers = async () => {
    setLoading(true)
    try { const { data } = await api.get('/admin/users'); setUsers(data) }
    finally { setLoading(false) }
  }

  const loadEvents = async () => {
    setLoading(true)
    try { const { data } = await api.get('/admin/events'); setEvents(data) }
    finally { setLoading(false) }
  }

  const ban = async (id: string) => {
    await api.post(`/admin/users/${id}/ban`, { ip: banIpMap[id] || undefined })
    setUsers(u => u.map(x => x.id === id ? { ...x, banned: true } : x))
  }

  const unban = async (id: string) => {
    await api.post(`/admin/users/${id}/unban`)
    setUsers(u => u.map(x => x.id === id ? { ...x, banned: false, bannedIp: undefined } : x))
  }

  const freeze = async (id: string) => {
    await api.post(`/admin/users/${id}/freeze`)
    setUsers(u => u.map(x => x.id === id ? { ...x, frozen: true } : x))
  }

  const unfreeze = async (id: string) => {
    await api.post(`/admin/users/${id}/unfreeze`)
    setUsers(u => u.map(x => x.id === id ? { ...x, frozen: false } : x))
  }

  const createEvent = async () => {
    if (!evTitle.trim()) return
    setEvCreating(true)
    try {
      const { data } = await api.post('/admin/events', { title: evTitle, description: evDesc })
      setEvents(e => [data, ...e])
      setEvTitle(''); setEvDesc('')
    } finally { setEvCreating(false) }
  }

  const deleteEvent = async (id: string) => {
    await api.delete(`/admin/events/${id}`)
    setEvents(e => e.filter(x => x.id !== id))
  }

  const sendBotMessage = async () => {
    if (!botText.trim()) return
    setBotSending(true)
    setBotMsg('')
    try {
      if (botTarget === 'all') {
        await api.post('/admin/broadcast', { text: botText })
        setBotMsg('Отправлено всем пользователям')
      } else {
        await api.post('/admin/bot-message', { userId: botTarget, text: botText })
        setBotMsg('Сообщение отправлено')
      }
      setBotText('')
    } catch (e: any) {
      setBotMsg(e.response?.data?.message || 'Ошибка')
    } finally { setBotSending(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-sidebar rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h2 className="text-lg font-semibold">Панель администратора</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-border flex-shrink-0">
          {(['users', 'events', 'bot'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
              {t === 'users' ? '👥 Пользователи' : t === 'events' ? '📢 Ивенты' : '🤖 Бот'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* USERS TAB */}
          {tab === 'users' && (
            <div className="space-y-3">
              {loading && <div className="text-center text-muted py-8">Загрузка...</div>}
              {!loading && users.filter(u => u.username !== 'admin' && u.username !== 'CocoDackBot').map(u => (
                <div key={u.id} className="bg-chat rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                      {u.displayName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{u.displayName}
                        {u.banned && <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">забанен</span>}
                        {u.frozen && <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">заморожен</span>}
                      </p>
                      <p className="text-xs text-muted">@{u.username} · {u.online ? '🟢 онлайн' : '⚫ офлайн'}</p>
                      {u.bannedIp && <p className="text-xs text-red-400 mt-0.5">IP: {u.bannedIp}</p>}
                    </div>
                  </div>

                  {/* Ban IP input */}
                  <div className="flex gap-2 mb-2">
                    <input
                      placeholder="IP для бана (необязательно)"
                      value={banIpMap[u.id] || ''}
                      onChange={e => setBanIpMap(m => ({ ...m, [u.id]: e.target.value }))}
                      className="flex-1 bg-sidebar text-xs text-white placeholder-muted rounded-lg px-3 py-1.5 border border-border focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {u.banned ? (
                      <button onClick={() => unban(u.id)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 transition">
                        ✅ Разбанить
                      </button>
                    ) : (
                      <button onClick={() => ban(u.id)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">
                        🚫 Забанить
                      </button>
                    )}
                    {u.frozen ? (
                      <button onClick={() => unfreeze(u.id)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 transition">
                        🔓 Разморозить
                      </button>
                    ) : (
                      <button onClick={() => freeze(u.id)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition">
                        🧊 Заморозить
                      </button>
                    )}
                    <button onClick={() => { setBotTarget(u.id); setTab('bot') }}
                      className="px-3 py-1.5 rounded-lg text-xs bg-primary/20 text-primary hover:bg-primary/30 transition">
                      💬 Написать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EVENTS TAB */}
          {tab === 'events' && (
            <div className="space-y-4">
              {/* Create event */}
              <div className="bg-chat rounded-xl p-4 border border-border space-y-3">
                <p className="text-sm font-medium">Новый ивент</p>
                <input
                  placeholder="Заголовок ивента"
                  value={evTitle}
                  onChange={e => setEvTitle(e.target.value)}
                  className="w-full bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
                />
                <textarea
                  placeholder="Описание (необязательно)"
                  value={evDesc}
                  onChange={e => setEvDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary resize-none"
                />
                <button onClick={createEvent} disabled={evCreating || !evTitle.trim()}
                  className="w-full py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
                  {evCreating ? 'Создание...' : '📢 Создать и разослать всем'}
                </button>
              </div>

              {/* Events list */}
              {loading && <div className="text-center text-muted py-4">Загрузка...</div>}
              {events.map(ev => (
                <div key={ev.id} className="bg-chat rounded-xl p-4 border border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">📢 {ev.title}</p>
                      {ev.description && <p className="text-xs text-muted mt-1">{ev.description}</p>}
                      <p className="text-xs text-muted mt-1">{new Date(ev.createdAt).toLocaleString('ru')}</p>
                    </div>
                    <button onClick={() => deleteEvent(ev.id)} className="text-red-400 hover:text-red-300 transition ml-3 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* BOT TAB */}
          {tab === 'bot' && (
            <div className="space-y-4">
              <div className="bg-chat rounded-xl p-4 border border-border space-y-3">
                <p className="text-sm font-medium">Написать от имени CocoDackBot</p>

                {/* Target selector */}
                <div>
                  <label className="text-xs text-muted mb-1 block">Получатель</label>
                  <select
                    value={botTarget}
                    onChange={e => setBotTarget(e.target.value)}
                    className="w-full bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary"
                  >
                    <option value="all">📢 Всем пользователям</option>
                    {users.filter(u => u.username !== 'admin' && u.username !== 'CocoDackBot').map(u => (
                      <option key={u.id} value={u.id}>@{u.username} — {u.displayName}</option>
                    ))}
                  </select>
                </div>

                <textarea
                  placeholder="Текст сообщения..."
                  value={botText}
                  onChange={e => setBotText(e.target.value)}
                  rows={4}
                  className="w-full bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary resize-none"
                />

                {botMsg && <p className="text-xs text-primary">{botMsg}</p>}

                <button onClick={sendBotMessage} disabled={botSending || !botText.trim()}
                  className="w-full py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
                  {botSending ? 'Отправка...' : '🤖 Отправить'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
