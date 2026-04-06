import { useState } from 'react'
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
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isPinned = getPinnedIds().includes(chat.id)
  const isOwner = chat.myRole === 'owner'
  const canDelete = chat.type === 'private' || isOwner
  const isMuted = chat.muted || false

  const togglePin = () => {
    const ids = getPinnedIds()
    const updated = isPinned ? ids.filter(id => id !== chat.id) : [...ids, chat.id]
    setPinnedIds(updated)
    // Обновляем pinned в store
    setChats(chats.map(c => c.id === chat.id ? { ...c, pinned: !isPinned } : c))
    onClose()
  }

  const toggleMute = async () => {
    try {
      const { data } = await api.patch(`/chats/${chat.id}/mute`)
      setChats(chats.map(c => c.id === chat.id ? { ...c, muted: data.muted } : c))
      if (activeChat?.id === chat.id) setActiveChat({ ...activeChat, muted: data.muted })
    } catch {}
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
      if (otherId) {
        await api.post(`/users/block/${otherId}`)
        // Удаляем чат из списка после блокировки
        setChats(chats.filter(c => c.id !== chat.id))
        if (activeChat?.id === chat.id) setActiveChat(null)
      }
    } catch {}
    onClose()
  }

  if (showBlockConfirm) {
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div className="fixed z-50 bg-sidebar rounded-xl shadow-2xl border border-border p-4 w-64"
          style={{ top: position.y, left: position.x }}>
          <p className="text-sm text-white mb-3">Заблокировать этого пользователя? Вы не сможете получать от него сообщения.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowBlockConfirm(false)}
              className="flex-1 py-1.5 rounded-lg bg-chat text-muted text-xs hover:text-white transition">
              Отмена
            </button>
            <button onClick={blockUser}
              className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition">
              Заблокировать
            </button>
          </div>
        </div>
      </>
    )
  }

  if (showDeleteConfirm) {
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div className="fixed z-50 bg-sidebar rounded-xl shadow-2xl border border-border p-4 w-64"
          style={{ top: position.y, left: position.x }}>
          <p className="text-sm text-white mb-3">Удалить этот чат? Это действие нельзя отменить.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-1.5 rounded-lg bg-chat text-muted text-xs hover:text-white transition">
              Отмена
            </button>
            <button onClick={deleteChat}
              className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition">
              Удалить
            </button>
          </div>
        </div>
      </>
    )
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
        <button onClick={toggleMute}
          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-chat transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm14.5-4.5l-3 3m0-3l3 3" />
            )}
          </svg>
          {isMuted ? 'Включить уведомления' : 'Выключить уведомления'}
        </button>
        {chat.type === 'private' && (
          <button onClick={() => setShowBlockConfirm(true)}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-chat transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Заблокировать
          </button>
        )}
        {canDelete && (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-chat transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Удалить чат
          </button>
        )}
      </div>
    </>
  )
}
