import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'
import { useChatStore } from '../store/chatStore'
import type { Chat, User } from '../types'

interface SearchResults {
  users: User[]
  chats: { id: string; name: string; type: string; avatar?: string }[]
  channels: { id: string; name: string; type: string; avatar?: string }[]
}

interface Props {
  query: string
  onClose: () => void
}

export default function SearchPanel({ query, onClose }: Props) {
  const [results, setResults] = useState<SearchResults>({ users: [], chats: [], channels: [] })
  const [loading, setLoading] = useState(false)
  const [openError, setOpenError] = useState('')
  const { chats, setChats, setActiveChat } = useChatStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) { setResults({ users: [], chats: [], channels: [] }); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`)
        setResults(data)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  const openPrivateChat = async (user: User) => {
    try {
      const { data } = await api.post('/chats/private', { username: user.username })
      const exists = chats.find(c => c.id === data.id)
      if (!exists) setChats([data, ...chats])
      setActiveChat(data)
      onClose()
    } catch (e: any) {
      setOpenError(e.response?.data?.message || 'Ошибка')
      setTimeout(() => setOpenError(''), 3000)
    }
  }

  const openChat = (item: { id: string; name: string; type: string; avatar?: string }) => {
    const existing = chats.find(c => c.id === item.id)
    if (existing) {
      setActiveChat(existing)
    } else {
      const chat: Chat = { id: item.id, name: item.name, type: item.type as any, avatar: item.avatar, unreadCount: 0, createdAt: new Date().toISOString() }
      setChats([chat, ...chats])
      setActiveChat(chat)
    }
    onClose()
  }

  const isEmpty = !results.users.length && !results.chats.length && !results.channels.length

  return (
    <div className="absolute top-14 left-0 right-0 bg-sidebar border-t border-border z-40 max-h-[70vh] overflow-y-auto shadow-2xl">
      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {openError && <p className="text-red-400 text-xs text-center py-2 px-4">{openError}</p>}

      {!loading && query.trim() && isEmpty && (
        <div className="text-center text-muted text-sm py-8">Ничего не найдено</div>
      )}

      {/* Users */}
      {results.users.length > 0 && (
        <Section title="Пользователи">
          {results.users.map(user => (
            <button key={user.id} onClick={() => openPrivateChat(user)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover transition text-left">
              <div className="relative flex-shrink-0">
                <Avatar name={user.displayName} avatar={user.avatar} size="sm" />
                {user.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-sidebar" />}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user.displayName}</p>
                <p className="text-xs text-muted">@{user.username}</p>
              </div>
            </button>
          ))}
        </Section>
      )}

      {/* Chats */}
      {results.chats.length > 0 && (
        <Section title="Чаты и группы">
          {results.chats.map(chat => (
            <button key={chat.id} onClick={() => openChat(chat)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover transition text-left">
              <Avatar name={chat.name} avatar={chat.avatar} size="sm" icon={chat.type === 'group' ? 'group' : undefined} />
              <div>
                <p className="text-sm font-medium text-white">{chat.name}</p>
                <p className="text-xs text-muted">{chat.type === 'group' ? 'Группа' : 'Чат'}</p>
              </div>
            </button>
          ))}
        </Section>
      )}

      {/* Channels */}
      {results.channels.length > 0 && (
        <Section title="Каналы">
          {results.channels.map(ch => (
            <button key={ch.id} onClick={() => openChat(ch)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover transition text-left">
              <Avatar name={ch.name} avatar={ch.avatar} size="sm" icon="channel" />
              <div>
                <p className="text-sm font-medium text-white">{ch.name}</p>
                <p className="text-xs text-muted">Канал</p>
              </div>
            </button>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider bg-chat/50">{title}</p>
      {children}
    </div>
  )
}

function Avatar({ name, avatar, size, icon }: { name: string; avatar?: string; size: 'sm'; icon?: string }) {
  const sz = 'w-9 h-9'
  if (avatar) return <img src={avatar} className={`${sz} rounded-full object-cover flex-shrink-0`} alt="" />
  return (
    <div className={`${sz} rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
      {icon === 'channel' ? '#' : icon === 'group' ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      ) : name[0]?.toUpperCase()}
    </div>
  )
}
