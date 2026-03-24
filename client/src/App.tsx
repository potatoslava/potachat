import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useChatStore } from './store/chatStore'
import { socket } from './lib/socket'
import api from './lib/api'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const { user, token } = useAuthStore()
  const { activeChat, setActiveChat } = useChatStore()
  const setUserOnline = useChatStore((s) => s.setUserOnline)

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
      return () => {
        socket.off('user:status')
        socket.disconnect()
      }
    }
  }, [token])

  if (!user || !token) return <AuthPage />

  return (
    <div className="flex overflow-hidden" style={{ height: '100dvh' }}>
      {/* Mobile: show sidebar when no active chat, show chat when active */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-80`}>
        <Sidebar />
      </div>
      <div className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-1`}>
        <ChatWindow onBack={() => setActiveChat(null)} />
      </div>
    </div>
  )
}
