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
import VerifyEmailPage from './pages/VerifyEmailPage'

export default function App() {
  const { user, token } = useAuthStore()
  const { activeChat, setActiveChat } = useChatStore()
  const setUserOnline = useChatStore((s) => s.setUserOnline)
  const updateUserAvatar = useChatStore((s) => s.updateUserAvatar)
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
        const state = useChatStore.getState()
        if (msg.senderId === useAuthStore.getState().user?.id) return

        // Если чат не в списке — перезагружаем все чаты
        const chatExists = state.chats.find(c => c.id === msg.chatId)
        if (!chatExists) {
          api.get('/chats').then(({ data }) => state.setChats(data))
          return
        }

        // Если это не активный чат — обновляем счётчик
        if (state.activeChat?.id !== msg.chatId) {
          state.incrementUnread(msg.chatId, msg)
          // Браузерное уведомление если вкладка не активна
          if (document.hidden && Notification.permission === 'granted') {
            new Notification(msg.sender?.displayName || 'CocoDack', {
              body: msg.text || '📎 Файл',
              icon: msg.sender?.avatar || '/favicon.svg',
            })
          }
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

  // Показываем экран верификации если email не подтверждён
  if (!user.emailVerified) return <VerifyEmailPage />

  const openAdmin = () => { setShowAdmin(true); setActiveChat(null); setShowSettings(false) }
  const closeAdmin = () => setShowAdmin(false)
  const openSettings = () => { setShowSettings(true); setActiveChat(null); setShowAdmin(false) }
  const closeSettings = () => setShowSettings(false)

  // Обработка ссылки /u/username — открыть чат с пользователем
  useEffect(() => {
    const match = window.location.pathname.match(/^\/u\/(.+)$/)
    if (match) {
      const username = match[1]
      window.history.replaceState({}, '', '/')
      api.post('/chats/private', { username }).then(({ data }) => {
        const state = useChatStore.getState()
        if (!state.chats.find(c => c.id === data.id)) state.setChats([data, ...state.chats])
        setActiveChat(data)
      }).catch(() => {})
    }
  }, [])

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
