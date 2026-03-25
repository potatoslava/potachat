import { useEffect, useState } from 'react'
import { useAuthStore } from './store/authStore'
import { useChatStore } from './store/chatStore'
import { socket } from './lib/socket'
import api from './lib/api'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import AdminPage from './pages/AdminPage'

export default function App() {
  const { user, token } = useAuthStore()
  const { activeChat, setActiveChat } = useChatStore()
  const setUserOnline = useChatStore((s) => s.setUserOnline)
  const updateUserAvatar = useChatStore((s) => s.updateUserAvatar)
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    if (token) {
      socket.connect()
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
      return () => {
        socket.off('user:status')
        socket.off('user:avatar')
        socket.disconnect()
      }
    }
  }, [token])

  if (!user || !token) return <AuthPage />

  const openAdmin = () => { setShowAdmin(true); setActiveChat(null) }
  const closeAdmin = () => setShowAdmin(false)

  // на мобиле: показываем правую панель если есть активный чат или открыта админка
  const hasRight = !!activeChat || showAdmin

  return (
    <div className="flex overflow-hidden" style={{ height: '100dvh' }}>
      <div className={`${hasRight ? 'hidden md:flex' : 'flex'} w-full md:w-80`}>
        <Sidebar onOpenAdmin={openAdmin} showAdmin={showAdmin} />
      </div>
      <div className={`${hasRight ? 'flex' : 'hidden md:flex'} flex-1`}>
        {showAdmin
          ? <AdminPage onClose={closeAdmin} />
          : <ChatWindow onBack={() => setActiveChat(null)} />
        }
      </div>
    </div>
  )
}
