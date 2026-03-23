import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { socket } from './lib/socket'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const { user, token } = useAuthStore()

  useEffect(() => {
    if (token) {
      socket.connect()
      return () => { socket.disconnect() }
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
