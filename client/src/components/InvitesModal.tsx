import { useEffect, useState } from 'react'
import api from '../lib/api'
import { socket } from '../lib/socket'

interface Invite {
  id: string
  chatId: string
  chatName: string
  chatAvatar?: string
  chatType: string
  inviterName: string
  inviterAvatar?: string
  createdAt: string
}

export default function InvitesModal({ onClose }: { onClose: () => void }) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadInvites()

    const onNewInvite = (invite: Invite) => {
      setInvites(prev => [invite, ...prev])
    }

    const onInviteCancelled = ({ inviteId }: { inviteId: string }) => {
      setInvites(prev => prev.filter(inv => inv.id !== inviteId))
    }

    socket.on('group:invite', onNewInvite)
    socket.on('group:invite_cancelled', onInviteCancelled)

    return () => {
      socket.off('group:invite', onNewInvite)
      socket.off('group:invite_cancelled', onInviteCancelled)
    }
  }, [])

  const loadInvites = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/invites')
      setInvites(data)
    } catch {
      setInvites([])
    } finally {
      setLoading(false)
    }
  }

  const accept = async (inviteId: string) => {
    setProcessing(inviteId)
    try {
      await api.post(`/invites/${inviteId}/accept`)
      setInvites(prev => prev.filter(inv => inv.id !== inviteId))
    } catch (e: any) {
      alert(e.response?.data?.message || 'Ошибка')
    } finally {
      setProcessing(null)
    }
  }

  const decline = async (inviteId: string) => {
    setProcessing(inviteId)
    try {
      await api.post(`/invites/${inviteId}/decline`)
      setInvites(prev => prev.filter(inv => inv.id !== inviteId))
    } catch (e: any) {
      alert(e.response?.data?.message || 'Ошибка')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <p className="font-semibold text-sm">Приглашения в группы</p>
          <button onClick={onClose} className="text-muted hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="text-center text-muted py-8">Загрузка...</div>}
          {!loading && invites.length === 0 && (
            <div className="text-center text-muted py-8">
              <p className="text-4xl mb-2">📬</p>
              <p className="text-sm">Нет приглашений</p>
            </div>
          )}
          {!loading && invites.map(inv => (
            <div key={inv.id} className="bg-chat rounded-xl p-4 mb-3 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                  {inv.chatAvatar && (inv.chatAvatar.startsWith('data:') || inv.chatAvatar.startsWith('http'))
                    ? <img src={inv.chatAvatar} className="w-full h-full object-cover" alt="" />
                    : inv.chatType === 'channel' ? '#' : inv.chatType === 'group' ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                    ) : inv.chatName[0]?.toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-white truncate">{inv.chatName}</p>
                  <p className="text-xs text-muted">
                    {inv.inviterName} приглашает вас
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => accept(inv.id)}
                  disabled={processing === inv.id}
                  className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
                >
                  ✅ Принять
                </button>
                <button
                  onClick={() => decline(inv.id)}
                  disabled={processing === inv.id}
                  className="flex-1 py-2 rounded-xl bg-chat text-muted text-sm hover:text-white transition disabled:opacity-50"
                >
                  ❌ Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
