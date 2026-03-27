import { useEffect, useState } from 'react'
import { useAuthStore } from './store/authStore'
import { useChatStore } from './store/chatStore'
import { socket } from './lib/socket'
import api from './lib/api'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import AdminPage from './pages/AdminPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const { user, token } = useAuthStore()
  const { activeChat, setActiveChat } = useChatStore()
  const setUserOnline = useChatStore((s) => s.setUserOnline)
  const updateUserAvatar = useChatStore((s) => s.updateUserAvatar)
  const incrementUnread = useChatStore((s) => s.incrementUnread)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (token) {
      socket.connect()
      // Запрашиваем разрешение на уведомления
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
      api.get('/chats/online').then(({ data }) => {
        Object.entries(data).forEach(([userId, online]) => {
          setUserOnline(userId, online as boolean)
        })
      }).catch(() => {})
      socket.on('user:status', ({ userId, online }: { userId: string; online: boolean }) => {
        setUserOnline(userId, online)
      })
      socket.on('user:avatar', ({ userId, avatar }: { userId: string; avatar: string }) => {
        updateUserAvatar(userId, avatar)
      })

      // Глобальный слушатель новых сообщений для уведомлений
      socket.on('message', (msg: any) => {
        // Получаем актуальный activeChat из стора
        const state = useChatStore.getState()
        if (msg.senderId === useAuthStore.getState().user?.id) return
        if (state.activeChat?.id === msg.chatId) return

        // Обновляем счётчик непрочитанных и поднимаем чат вверх
        incrementUnread(msg.chatId, msg)

        // Браузерное уведомление если вкладка не активна
        if (document.hidden && Notification.permission === 'granted') {
          new Notification(msg.sender?.displayName || 'CocoDack', {
            body: msg.text || '📎 Файл',
            icon: msg.sender?.avatar || '/favicon.svg',
          })
        }
      })
      return () => {
        socket.off('user:status')
        socket.off('user:avatar')
        socket.off('message')
        socket.disconnect()
      }
    }
  }, [token])

  if (!user || !token) return <AuthPage />

  const openAdmin = () => { setShowAdmin(true); setActiveChat(null); setShowSettings(false) }
  const closeAdmin = () => setShowAdmin(false)
  const openSettings = () => { setShowSettings(true); setActiveChat(null); setShowAdmin(false) }
  const closeSettings = () => setShowSettings(false)

  const hasRight = !!activeChat || showAdmin || showSettings

  return (
    <div className="flex overflow-hidden" style={{ height: '100dvh' }}>
      <div className={`${hasRight ? 'hidden md:flex' : 'flex'} w-full md:w-80`}>
        <Sidebar onOpenAdmin={openAdmin} showAdmin={showAdmin} onOpenSettings={openSettings} showSettings={showSettings} />
      </div>
      <div className={`${hasRight ? 'flex' : 'hidden md:flex'} flex-1`}>
        {showAdmin
          ? <AdminPage onClose={closeAdmin} />
          : showSettings
          ? <SettingsPage onClose={closeSettings} />
          : <ChatWindow onBack={() => setActiveChat(null)} />
        }
      </div>
    </div>
  )
}
