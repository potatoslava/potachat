import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import type { Chat } from '../types'

interface GroupMember {
  id: string
  username: string
  displayName: string
  avatar?: string
  online: boolean
  role: string
}

interface GroupInfo {
  id: string
  name: string
  avatar?: string
  description?: string
  inviteCode?: string
  myRole: string
  members: GroupMember[]
}

export default function GroupInfoModal({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const { user } = useAuthStore()
  const [info, setInfo] = useState<GroupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'members' | 'media'>('info')

  // Edit state
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Add member
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [media, setMedia] = useState<any[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get(`/chats/${chat.id}/info`)
      .then(({ data }) => {
        setInfo(data)
        setEditName(data.name)
        setEditDesc(data.description || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [chat.id])

  const isAdminOrOwner = info?.myRole === 'owner' || info?.myRole === 'admin'
  const isOwner = info?.myRole === 'owner'

  const saveInfo = async () => {
    if (!info) return
    setSaving(true)
    try {
      const { data } = await api.patch(`/chats/${chat.id}/info`, { name: editName, description: editDesc })
      setInfo(i => i ? { ...i, name: data.name, description: data.description } : i)
      // Обновляем в store через актуальный стейт
      const { chats: currentChats, activeChat: currentActive, setChats: sc, setActiveChat: sac } = useChatStore.getState()
      sc(currentChats.map(c => c.id === chat.id ? { ...c, name: data.name, description: data.description } : c))
      if (currentActive?.id === chat.id) sac({ ...currentActive, name: data.name, description: data.description })
      setSaveMsg('Сохранено')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (e: any) {
      setSaveMsg(e.response?.data?.message || 'Ошибка')
    } finally { setSaving(false) }
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      try {
        await api.patch(`/chats/${chat.id}/info`, { avatar: base64 })
        setInfo(i => i ? { ...i, avatar: base64 } : i)
        const { chats: currentChats, activeChat: currentActive, setChats: sc, setActiveChat: sac } = useChatStore.getState()
        sc(currentChats.map(c => c.id === chat.id ? { ...c, avatar: base64 } : c))
        if (currentActive?.id === chat.id) sac({ ...currentActive, avatar: base64 })
      } catch {}
    }
    reader.readAsDataURL(file)
  }

  const generateInvite = async () => {
    try {
      const { data } = await api.post(`/chats/${chat.id}/invite`)
      setInfo(i => i ? { ...i, inviteCode: data.inviteCode } : i)
    } catch {}
  }

  const copyInvite = () => {
    if (!info?.inviteCode) return
    const link = `${window.location.origin}/join/${info.inviteCode}`
    navigator.clipboard.writeText(link).catch(() => {})
  }

  const addMember = async () => {
    if (!addUsername.trim() || adding) return
    setAdding(true)
    setAddError('')
    try {
      const { data } = await api.post(`/chats/${chat.id}/members`, { username: addUsername.trim() })
      setInfo(i => i ? { ...i, members: [...i.members, data.member] } : i)
      setAddUsername('')
    } catch (e: any) {
      setAddError(e.response?.data?.message || 'Ошибка')
    } finally { setAdding(false) }
  }

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/chats/${chat.id}/members/${userId}`)
      setInfo(i => i ? { ...i, members: i.members.filter(m => m.id !== userId) } : i)
    } catch {}
  }

  const changeRole = async (userId: string, role: string) => {
    try {
      await api.patch(`/chats/${chat.id}/members/${userId}/role`, { role })
      setInfo(i => i ? { ...i, members: i.members.map(m => m.id === userId ? { ...m, role } : m) } : i)
    } catch {}
  }

  const leaveGroup = async () => {
    if (!confirm('Покинуть группу?')) return
    try {
      await api.delete(`/chats/${chat.id}/members/${user!.id}`)
      // Сервер пришлёт chat:left через сокет — App.tsx обработает
      onClose()
    } catch {}
  }

  const deleteGroup = async () => {
    if (!confirm(`Удалить ${chat.type === 'channel' ? 'канал' : 'группу'} навсегда? Это действие необратимо.`)) return
    try {
      await api.delete(`/chats/${chat.id}`)
      const s = useChatStore.getState()
      s.setChats(s.chats.filter(c => c.id !== chat.id))
      if (s.activeChat?.id === chat.id) s.setActiveChat(null)
      onClose()
    } catch {}
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <p className="font-semibold">{chat.type === 'channel' ? 'Канал' : 'Группа'}</p>
          <button onClick={onClose} className="text-muted hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : info ? (
          <>
            {/* Tabs */}
            <div className="flex gap-1 px-4 py-2 border-b border-border flex-shrink-0">
              <button onClick={() => setTab('info')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'info' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
                Информация
              </button>
              <button onClick={() => setTab('members')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'members' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
                Участники ({info.members.length})
              </button>
              <button onClick={() => {
                setTab('media')
                if (media.length === 0 && !mediaLoading) {
                  setMediaLoading(true)
                  api.get(`/chats/${chat.id}/media`).then(({ data }) => setMedia(data)).catch(() => {}).finally(() => setMediaLoading(false))
                }
              }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'media' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
                Медиа
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'info' && (
                <div className="p-4 space-y-4">
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative cursor-pointer" onClick={() => isAdminOrOwner && fileRef.current?.click()}>
                      <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                        {info.avatar && (info.avatar.startsWith('data:') || info.avatar.startsWith('http'))
                          ? <img src={info.avatar} className="w-full h-full object-cover" alt="" />
                          : chat.type === 'channel' ? '#' : info.name[0]?.toUpperCase()
                        }
                      </div>
                      {isAdminOrOwner && (
                        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {isAdminOrOwner && <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />}
                  </div>

                  {/* Name & Description */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted mb-1 block">Название</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        disabled={!isAdminOrOwner}
                        className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">Описание</label>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        disabled={!isAdminOrOwner}
                        rows={3} placeholder="Описание группы..."
                        className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary resize-none disabled:opacity-60 disabled:cursor-not-allowed" />
                    </div>
                    {isAdminOrOwner && (
                      <>
                        {saveMsg && <p className={`text-xs text-center ${saveMsg === 'Сохранено' ? 'text-primary' : 'text-red-400'}`}>{saveMsg}</p>}
                        <button onClick={saveInfo} disabled={saving}
                          className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
                          {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Invite link */}
                  {isAdminOrOwner && (
                    <div className="bg-chat rounded-xl p-3 space-y-2">
                      <p className="text-xs text-muted font-medium uppercase tracking-wider">Ссылка-приглашение</p>
                      {info.inviteCode ? (
                        <div className="flex gap-2">
                          <input readOnly value={`${window.location.origin}/join/${info.inviteCode}`}
                            className="flex-1 bg-sidebar border border-border rounded-lg px-3 py-1.5 text-xs text-muted focus:outline-none" />
                          <button onClick={copyInvite}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-primary-dark transition">
                            Копировать
                          </button>
                          <button onClick={generateInvite}
                            className="px-3 py-1.5 rounded-lg bg-sidebar-hover text-muted text-xs hover:text-white transition">
                            Обновить
                          </button>
                        </div>
                      ) : (
                        <button onClick={generateInvite}
                          className="w-full py-2 rounded-xl bg-primary/20 text-primary text-sm hover:bg-primary/30 transition">
                          Создать ссылку
                        </button>
                      )}
                    </div>
                  )}

                  {/* Leave / Delete */}
                  {!isOwner && (
                    <button onClick={leaveGroup}
                      className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition">
                      Покинуть {chat.type === 'channel' ? 'канал' : 'группу'}
                    </button>
                  )}
                  {isOwner && (
                    <button onClick={deleteGroup}
                      className="w-full py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition font-medium">
                      🗑️ Удалить {chat.type === 'channel' ? 'канал' : 'группу'}
                    </button>
                  )}
                </div>
              )}

              {tab === 'members' && (
                <div className="p-4 space-y-3">
                  {/* Add member */}
                  {isAdminOrOwner && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input value={addUsername} onChange={e => setAddUsername(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addMember()}
                          placeholder="@username"
                          className="flex-1 bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary" />
                        <button onClick={addMember} disabled={adding || !addUsername.trim()}
                          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
                          {adding ? '...' : 'Добавить'}
                        </button>
                      </div>
                      {addError && <p className="text-red-400 text-xs">{addError}</p>}
                    </div>
                  )}

                  {/* Members list */}
                  {info.members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 bg-chat rounded-xl px-3 py-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                        {m.avatar && (m.avatar.startsWith('data:') || m.avatar.startsWith('http'))
                          ? <img src={m.avatar} className="w-full h-full object-cover" alt="" />
                          : m.displayName[0]?.toUpperCase()
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.displayName}</p>
                        <p className="text-xs text-muted">@{m.username}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Role badge */}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          m.role === 'owner' ? 'bg-yellow-500/20 text-yellow-400' :
                          m.role === 'admin' ? 'bg-primary/20 text-primary' :
                          'bg-sidebar-hover text-muted'
                        }`}>
                          {m.role === 'owner' ? 'Владелец' : m.role === 'admin' ? 'Админ' : 'Участник'}
                        </span>

                        {/* Actions */}
                        {isOwner && m.id !== user?.id && m.role !== 'owner' && (
                          <div className="flex gap-1">
                            <button onClick={() => changeRole(m.id, m.role === 'admin' ? 'member' : 'admin')}
                              className="text-xs text-muted hover:text-primary transition px-1">
                              {m.role === 'admin' ? '↓' : '↑'}
                            </button>
                            <button onClick={() => removeMember(m.id)}
                              className="text-xs text-red-400 hover:text-red-300 transition px-1">✕</button>
                          </div>
                        )}
                        {isAdminOrOwner && !isOwner && m.id !== user?.id && m.role === 'member' && (
                          <button onClick={() => removeMember(m.id)}
                            className="text-xs text-red-400 hover:text-red-300 transition px-1">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'media' && (
                <div className="p-4">
                  {mediaLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                  {!mediaLoading && media.length === 0 && <p className="text-center text-muted py-8">Нет медиафайлов</p>}
                  <div className="grid grid-cols-3 gap-1">
                    {media.map((m: any) => (
                      <div key={m.id} className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-chat"
                        onClick={() => m.fileType === 'image' && setLightbox(`/uploads/${m.fileUrl}`)}>
                        {m.fileType === 'image'
                          ? <img src={`/uploads/${m.fileUrl}`} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-center text-muted py-8">Ошибка загрузки</p>
        )}
      </div>
    </div>
    {lightbox && (
      <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center" onClick={() => setLightbox(null)}>
        <img src={lightbox} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" />
        <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center">✕</button>
      </div>
    )}
  </>
  )
}
