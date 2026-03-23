import { useState } from 'react'
import api from '../lib/api'
import { useChatStore } from '../store/chatStore'

type Props = { onClose: () => void }

export default function NewChatModal({ onClose }: Props) {
  const [tab, setTab] = useState<'private' | 'group' | 'channel'>('private')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { chats, setChats, setActiveChat } = useChatStore()

  const create = async () => {
    setError('')
    try {
      if (tab === 'private') {
        const { data } = await api.post('/chats/private', { username })
        setChats([data, ...chats])
        setActiveChat(data)
      } else {
        const { data } = await api.post('/chats/group', { name, type: tab })
        setChats([data, ...chats])
        setActiveChat(data)
      }
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Ошибка')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Новый чат</h3>

        <div className="flex gap-1 bg-chat rounded-xl p-1 mb-4">
          {(['private', 'group', 'channel'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${tab === t ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}
            >
              {t === 'private' ? 'Личный' : t === 'group' ? 'Группа' : 'Канал'}
            </button>
          ))}
        </div>

        {tab === 'private' ? (
          <input
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
          />
        ) : (
          <input
            placeholder={tab === 'group' ? 'Название группы' : 'Название канала'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-chat border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
          />
        )}

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-chat text-muted text-sm hover:text-white transition">
            Отмена
          </button>
          <button onClick={create} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition">
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}
