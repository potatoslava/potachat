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
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

function AppContent() {
  const { user, token } = useAuthStore()
  const { activeChat, setActiveChat } = useChatStore()
  const setUserOnline = useChatStore((s) => s.setUserOnline)
  const setUserLastSeen = useChatStore((s) => s.setUserLastSeen)
  const updateUserAvatar = useChatStore((s) => s.updateUserAvatar)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
  })

  // Применяем тему
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Все хуки должны быть до любого условного return
  useEffect(() => {
    if (!user || !token) return
    const match = window.location.pathname.match(/^\/u\/(.+)$/)
    const joinMatch = window.location.pathname.match(/^\/join\/([a-f0-9]+)$/)
    if (match) {
      const username = match[1]
      window.history.replaceState({}, '', '/')
      api.post('/chats/private', { username }).then(({ data }) => {
        const state = useChatStore.getState()
        if (!state.chats.find(c => c.id === data.id)) state.setChats([data, ...state.chats])
        setActiveChat(data)
      }).catch(() => {})
    } else if (joinMatch) {
      const inviteCode = joinMatch[1]
      window.history.replaceState({}, '', '/')
      api.post(`/chats/join/${inviteCode}`).then(({ data }) => {
        const state = useChatStore.getState()
        if (!state.chats.find(c => c.id === data.id)) state.setChats([data, ...state.chats])
        setActiveChat(data)
      }).catch(() => {})
    }
  }, [user, token])

  useEffect(() => {
    if (!token) return
    socket.connect()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    
    // Создаём аудио для уведомлений один раз
    let notificationSound: HTMLAudioElement | null = null
    try {
      if (typeof Audio !== 'undefined') {
        notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6OyrWBUIQ5zd8sFuJAUuhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvsw==')
        notificationSound.volume = 0.3
      }
    } catch (e) {
      console.error('Failed to create notification sound:', e)
    }
    
    api.get('/chats/online').then(({ data }) => {
      Object.entries(data).forEach(([userId, online]) => {
        setUserOnline(userId, online as boolean)
      })
    }).catch(() => {})

    const onUserStatus = ({ userId, online, lastSeen }: { userId: string; online: boolean; lastSeen?: string }) => {
      setUserOnline(userId, online)
      if (!online && lastSeen) setUserLastSeen(userId, lastSeen)
    }
    const onUserAvatar = ({ userId, avatar }: { userId: string; avatar: string }) => {
      updateUserAvatar(userId, avatar)
    }
    const onChatLeft = ({ chatId }: { chatId: string }) => {
      const state = useChatStore.getState()
      state.setChats(state.chats.filter(c => c.id !== chatId))
      if (state.activeChat?.id === chatId) state.setActiveChat(null)
      // Удаляем черновик
      localStorage.removeItem(`draft:${chatId}`)
    }
    const onChatDeleted = ({ chatId }: { chatId: string }) => {
      const state = useChatStore.getState()
      state.setChats(state.chats.filter(c => c.id !== chatId))
      if (state.activeChat?.id === chatId) state.setActiveChat(null)
      // Удаляем черновик
      localStorage.removeItem(`draft:${chatId}`)
    }
    const onChatJoined = (chat: any) => {
      const state = useChatStore.getState()
      if (!state.chats.find(c => c.id === chat.id)) {
        state.setChats([chat, ...state.chats])
      }
    }
    const onMessage = (msg: any) => {
      const state = useChatStore.getState()
      const currentUser = useAuthStore.getState().user
      if (msg.senderId === currentUser?.id) return

      const chatExists = state.chats.find(c => c.id === msg.chatId)
      if (!chatExists) {
        api.get('/chats').then(({ data: freshChats }) => {
          const latest = useChatStore.getState()
          const newChat = freshChats.find((c: any) => c.id === msg.chatId)
          if (newChat && !latest.chats.find((c: any) => c.id === newChat.id)) {
            latest.setChats([newChat, ...latest.chats])
          }
          // Инкрементируем непрочитанные для нового чата
          if (newChat && latest.activeChat?.id !== msg.chatId) {
            latest.incrementUnread(msg.chatId, msg)
          }
        }).catch(() => {})
        return
      }

      if (state.activeChat?.id !== msg.chatId) {
        state.incrementUnread(msg.chatId, msg)
        // Проверяем muted перед показом уведомления
        const chat = state.chats.find(c => c.id === msg.chatId)
        const isMuted = chat?.muted || false
        if (!isMuted) {
          // Воспроизводим звук
          if (notificationSound) {
            notificationSound.play().catch(() => {})
          }
          
          if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(msg.sender?.displayName || 'CocoDack', {
              body: msg.text || '📎 Файл',
              icon: msg.sender?.avatar || '/favicon.svg',
            })
          }
        }
      } else {
        // Чат активен — сообщение уже добавляется в ChatWindow через его собственный обработчик
        // Здесь только обновляем lastMessage в списке чатов
        state.updateLastMessage(msg.chatId, msg)
      }
    }

    socket.on('user:status', onUserStatus)
    socket.on('user:avatar', onUserAvatar)
    socket.on('chat:left', onChatLeft)
    socket.on('chat:deleted', onChatDeleted)
    socket.on('chat:joined', onChatJoined)
    socket.on('message', onMessage)

    return () => {
      socket.off('user:status', onUserStatus)
      socket.off('user:avatar', onUserAvatar)
      socket.off('chat:left', onChatLeft)
      socket.off('chat:deleted', onChatDeleted)
      socket.off('chat:joined', onChatJoined)
      socket.off('message', onMessage)
      socket.disconnect()
      // Очищаем аудио
      if (notificationSound) {
        notificationSound.pause()
        notificationSound.src = ''
      }
    }
  }, [token])

  if (!user || !token) return <AuthPage />

  // Email verification temporarily disabled
  // if (!user.emailVerified) return <VerifyEmailPage />

  const openAdmin = () => { setShowAdmin(true); setActiveChat(null); setShowSettings(false) }
  const closeAdmin = () => setShowAdmin(false)
  const openSettings = () => { setShowSettings(true); setActiveChat(null); setShowAdmin(false) }
  const closeSettings = () => setShowSettings(false)

  const hasRight = !!activeChat || showAdmin || showSettings

  return (
    <div className="flex items-center justify-center p-4 md:p-6" style={{ height: '100vh', background: '#071521' }}>
      <div className="flex overflow-hidden rounded-[28px] shadow-[0_25px_45px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(72,181,255,0.2)] transition-shadow duration-300 hover:shadow-[0_30px_50px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(72,181,255,0.3)]" style={{ width: '1300px', maxWidth: '98vw', height: '90vh', background: '#0C1C2C' }}>
        <div className={`${hasRight ? 'hidden md:flex' : 'flex'} w-full md:w-80`}>
          <Sidebar onOpenAdmin={openAdmin} showAdmin={showAdmin} onOpenSettings={openSettings} showSettings={showSettings} theme={theme} onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
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
    </div>
  )
}
