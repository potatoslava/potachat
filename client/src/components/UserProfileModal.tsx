import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import api from '../lib/api'

interface UserProfile {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  online: boolean
  lastSeen?: string
}

export default function UserProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user: currentUser } = useAuthStore()
  const { chats, setChats, setActiveChat, onlineUsers } = useChatStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadProfile()
    checkBlocked()
  }, [userId])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/users/${userId}`)
      setProfile(data)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const checkBlocked = async () => {
    try {
      const { data } = await api.get('/users/blocked')
      setIsBlocked(data.some((u: any) => u.id === userId))
    } catch {}
  }

  const openChat = async () => {
    if (!profile) return
    setActionLoading(true)
    try {
      const { data } = await api.post('/chats/private', { username: profile.username })
      const exists = chats.find(c => c.id === data.id)
      if (!exists) setChats([data, ...chats])
      setActiveChat(data)
      onClose()
    } catch (e: any) {
      // Показываем ошибку в UI вместо alert
      console.error('Ошибка открытия чата:', e.response?.data?.message || 'Ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  const toggleBlock = async () => {
    setActionLoading(true)
    try {
      if (isBlocked) {
        await api.delete(`/users/block/${userId}`)
        setIsBlocked(false)
      } else {
        await api.post(`/users/block/${userId}`)
        setIsBlocked(true)
      }
    } catch (e: any) {
      // Показываем ошибку в UI вместо alert
      console.error('Ошибка блокировки:', e.response?.data?.message || 'Ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-sidebar rounded-2xl p-6 w-80 shadow-2xl flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-sidebar rounded-2xl p-6 w-80 shadow-2xl text-center">
          <p className="text-muted">Пользователь не найден</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-chat text-white text-sm">
            Закрыть
          </button>
        </div>
      </div>
    )
  }

  const isMe = profile.id === currentUser?.id

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center mb-5">
          {profile.avatar && (profile.avatar.startsWith('data:') || profile.avatar.startsWith('http')) ? (
            <img src={profile.avatar} className="w-20 h-20 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
              {profile.displayName[0]?.toUpperCase()}
            </div>
          )}
          <h3 className="text-lg font-semibold mt-3">{profile.displayName}</h3>
          <p className="text-sm text-muted">@{profile.username}</p>
          <p className="text-xs text-muted mt-1">
            {onlineUsers[userId] ? '🟢 в сети' : profile.lastSeen ? `был(а) ${formatLastSeen(profile.lastSeen)}` : '⚫ не в сети'}
          </p>
        </div>

        {profile.bio && (
          <div className="mb-4 p-3 bg-chat rounded-xl">
            <p className="text-xs text-muted mb-1">О себе</p>
            <p className="text-sm text-white whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {!isMe && (
          <div className="space-y-2">
            <button
              onClick={openChat}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
            >
              💬 Написать сообщение
            </button>
            <button
              onClick={toggleBlock}
              disabled={actionLoading}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 ${
                isBlocked
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              }`}
            >
              {isBlocked ? '✅ Разблокировать' : '🚫 Заблокировать'}
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 rounded-xl bg-chat text-muted text-sm hover:text-white transition"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}

function formatLastSeen(lastSeen: string) {
  const diff = Date.now() - new Date(lastSeen).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  if (hours < 24) return `${hours} ч. назад`
  return `${days} дн. назад`
}
