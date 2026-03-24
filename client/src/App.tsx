import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useChatStore } from './store/chatStore'
import { socket } from './lib/socket'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const { user, token } = useAuthStore()
  const setUserOnline = useChatStore((s) => s.setUserOnline)

  useEffect(() => {
    if (token) {
      socket.connect()
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <ChatWindow />
    </div>
  )
}
