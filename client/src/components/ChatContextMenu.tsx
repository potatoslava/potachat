import api from '../lib/api'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import type { Chat } from '../types'

type Props = {
  chat: Chat
  onClose: () => void
  position: { x: number; y: number }
}

function getPinnedIds(): string[] {
  try { return JSON.parse(localStorage.getItem('pinnedChats') || '[]') } catch { return [] }
}

function setPinnedIds(ids: string[]) {
  localStorage.setItem('pinnedChats', JSON.stringify(ids))
}

export default function ChatContextMenu({ chat, onClose, position }: Props) {
  const { chats, setChats, setActiveChat, activeChat } = useChatStore()
  const { user } = useAuthStore()
  const isPinned = getPinnedIds().includes(chat.id)

  const togglePin = () => {
    const ids = getPinnedIds()
    const updated = isPinned ? ids.filter(id => id !== chat.id) : [...ids, chat.id]
    setPinnedIds(updated)
    // Обновляем pinned в store
    setChats(chats.map(c => c.id === chat.id ? { ...c, pinned: !isPinned } : c))
    onClose()
  }

  const deleteChat = async () => {
    try {
      await api.delete(`/chats/${chat.id}`)
      setChats(chats.filter(c => c.id !== chat.id))
      if (activeChat?.id === chat.id) setActiveChat(null)
    } catch {}
    onClose()
  }

  const blockUser = async () => {
    try {
      const otherId = chat.members?.find(m => m.id !== user?.id)?.id
      if (otherId) await api.post(`/users/block/${otherId}`)
    } catch {}
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-sidebar-hover rounded-xl shadow-2xl border border-border py-1 w-44"
        style={{ top: position.y, left: position.x }}
      >
        <button onClick={togglePin}
          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-chat transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          {isPinned ? 'Открепить' : 'Закрепить'}
        </button>
        {chat.type === 'private' && (
          <button onClick={blockUser}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-chat transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Заблокировать
          </button>
        )}
        <button onClick={deleteChat}
          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-chat transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Удалить чат
        </button>
      </div>
    </>
  )
}
