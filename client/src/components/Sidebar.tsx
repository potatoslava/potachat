import { useEffect, useState, useMemo } from 'react'

import { useChatStore } from '../store/chatStore'

import { useAuthStore } from '../store/authStore'

import { socket } from '../lib/socket'

import api from '../lib/api'

import type { Chat } from '../types'

import { formatDistanceToNow } from 'date-fns'

import { ru } from 'date-fns/locale'

import NewChatModal from './NewChatModal'

import SearchPanel from './SearchPanel'

import ChatContextMenu from './ChatContextMenu'

import InvitesModal from './InvitesModal'



export default function Sidebar({ onOpenAdmin, showAdmin, onOpenSettings, showSettings, theme, onThemeToggle }: {
  onOpenAdmin: () => void; showAdmin: boolean
  onOpenSettings: () => void; showSettings: boolean
  theme: 'light' | 'dark'; onThemeToggle: () => void
}) {
  const { chats, setChats, setActiveChat, activeChat } = useChatStore()

  const clearUnread = useChatStore((s) => s.clearUnread)

  const { user, logout } = useAuthStore()

  const [search, setSearch] = useState('')

  const [searchFocused, setSearchFocused] = useState(false)

  const [showNewChat, setShowNewChat] = useState(false)

  const [showMenu, setShowMenu] = useState(false)

  const [contextMenu, setContextMenu] = useState<{ chat: Chat; x: number; y: number } | null>(null)
  const [pinVersion, setPinVersion] = useState(0)
  const isAdmin = user?.adminCode === 'cocoduck_admin_2026'

  const [showInvites, setShowInvites] = useState(false)

  const [inviteCount, setInviteCount] = useState(0)



  useEffect(() => {
    api.get('/chats')
      .then(({ data }) => setChats(data))
      .catch(() => {})
    
    // Загружаем количество приглашений
    api.get('/invites')
      .then(({ data }) => setInviteCount(data.length))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onNewInvite = () => {
      setInviteCount(c => c + 1)
    }
    
    const onInviteCancelled = () => {
      setInviteCount(c => Math.max(0, c - 1))
    }
    
    socket.on('group:invite', onNewInvite)
    socket.on('group:invite_cancelled', onInviteCancelled)
    
    return () => {
      socket.off('group:invite', onNewInvite)
      socket.off('group:invite_cancelled', onInviteCancelled)
    }
  }, [])

  useEffect(() => {

    const handler = (e: MouseEvent) => {

      if (!(e.target as Element).closest('.menu-anchor')) setShowMenu(false)

    }

    document.addEventListener('mousedown', handler)

    return () => document.removeEventListener('mousedown', handler)

  }, [])



  const isSearching = searchFocused && search.trim().length > 0

  // Закреплённые чаты наверху — pinVersion форсирует перерендер после изменения
  const pinnedIds: string[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('pinnedChats') || '[]') } catch { return [] }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinVersion])

  const filtered = chats
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aPin = pinnedIds.includes(a.id) ? 1 : 0
      const bPin = pinnedIds.includes(b.id) ? 1 : 0
      if (aPin !== bPin) return bPin - aPin
      // Сохраняем порядок из store (уже отсортирован по времени)
      return 0
    })



  return (

    <div className="w-full md:w-80 flex-shrink-0 bg-sidebar flex flex-col border-r border-border relative" style={{ height: '100dvh' }}>

      <div className="flex items-center gap-3 px-4 py-3 border-b border-border pt-safe">

        <div className="relative menu-anchor">

          <button onClick={() => setShowMenu(v => !v)}>

            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden ${isAdmin ? 'bg-yellow-500' : 'bg-primary'}`}>

              {user?.avatar && (user.avatar.startsWith('data:') || user.avatar.startsWith('http'))

                ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />

                : isAdmin ? '🛡️' : user?.displayName?.[0]?.toUpperCase()

              }

            </div>

          </button>

          {showMenu && (

            <div className="absolute top-11 left-0 bg-sidebar-hover rounded-xl shadow-xl z-50 w-48 py-1 border border-border">

              <div className="px-4 py-2 border-b border-border">

                <p className="text-sm font-medium text-white">{user?.displayName}{isAdmin && <span className="ml-1 text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">admin</span>}</p>

                <p className="text-xs text-muted">@{user?.username}</p>

              </div>

              {isAdmin && (

                <button onClick={() => { onOpenAdmin(); setShowMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-chat transition">

                  🛡️ Панель администратора

                </button>

              )}

              <button onClick={() => { onOpenSettings(); setShowMenu(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-chat transition ${showSettings ? 'text-primary' : 'text-white'}`}>

                ⚙️ Настройки

              </button>

              <button onClick={() => { onThemeToggle(); setShowMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-chat transition">

                {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}

              </button>

              <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-chat transition">

                Выйти

              </button>

            </div>

          )}

        </div>

        <div className="flex-1 bg-chat rounded-xl px-3 py-2 flex items-center gap-2">

          {isSearching ? (

            <button onClick={() => { setSearch(''); setSearchFocused(false) }} className="text-primary">

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>

            </button>

          ) : (

            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>

          )}

          <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} placeholder="Поиск" className="bg-transparent text-sm text-white placeholder-muted focus:outline-none flex-1" />

          {search && <button onClick={() => setSearch('')} className="text-muted hover:text-white"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}

        </div>

        <button onClick={() => setShowInvites(true)} className="relative w-9 h-9 rounded-full bg-chat hover:bg-sidebar-hover flex items-center justify-center transition">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {inviteCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {inviteCount > 9 ? '9+' : inviteCount}
            </span>
          )}
        </button>

        <button onClick={() => setShowNewChat(true)} className="w-9 h-9 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center transition">

          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>

        </button>

      </div>



      {isAdmin && (

        <button onClick={onOpenAdmin} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-sidebar-hover border-b border-border w-full ${showAdmin ? 'bg-sidebar-hover' : ''}`}>
          <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-xl flex-shrink-0">🛡️</div>

          <div className="flex-1 min-w-0 text-left">

            <p className="font-medium text-sm text-white">Панель администратора</p>

            <p className="text-xs text-muted">Управление пользователями</p>

          </div>

        </button>

      )}



      {isSearching && <SearchPanel query={search} onClose={() => { setSearch(''); setSearchFocused(false) }} />}



      <div className="flex-1 overflow-y-auto">

        {!isSearching && filtered.length === 0 && <div className="text-center text-muted text-sm mt-10">Нет чатов</div>}

        {!isSearching && filtered.map((chat) => (

          <ChatItem key={chat.id} chat={chat} active={activeChat?.id === chat.id}
            isPinned={pinnedIds.includes(chat.id)}
            onClick={() => { setActiveChat(chat); clearUnread(chat.id) }}

            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ chat, x: e.clientX, y: e.clientY }) }} />

        ))}

      </div>



      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}

      {showInvites && <InvitesModal onClose={() => { setShowInvites(false); api.get('/invites').then(({ data }) => setInviteCount(data.length)).catch(() => {}) }} />}

      {contextMenu && <ChatContextMenu chat={contextMenu.chat} position={{ x: contextMenu.x, y: contextMenu.y }} onClose={() => { setContextMenu(null); setPinVersion(v => v + 1) }} />}

    </div>

  )

}



function ChatItem({ chat, active, isPinned, onClick, onContextMenu }: { chat: Chat; active: boolean; isPinned: boolean; onClick: () => void; onContextMenu?: (e: React.MouseEvent) => void }) {

  const BOT_USERNAMES = ['CocoDackBot', 'PotaChatBot']
  const isBot = chat.type === 'private' && chat.members?.some(m => BOT_USERNAMES.includes(m.username))

  const { onlineUsers } = useChatStore()

  const { user } = useAuthStore()

  // для приватного чата берём id собеседника

  const otherId = chat.type === 'private' ? chat.members?.find(m => m.id !== user?.id)?.id : null

  const isOnline = otherId ? !!onlineUsers[otherId] : false

  const isMuted = chat.muted || false

  return (

    <div onClick={onClick} onContextMenu={onContextMenu} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-sidebar-hover ${active ? 'bg-sidebar-hover' : ''}`}>

      <div className="relative flex-shrink-0">

        {(() => {
          // Для приватного чата — аватарка собеседника, для группы/канала — аватарка чата
          const avatar = chat.type === 'private'
            ? chat.members?.find((m: any) => m.id !== user?.id)?.avatar
            : chat.avatar
          
          if (avatar && (avatar.startsWith('data:') || avatar.startsWith('http'))) {
            return <img src={avatar} className="w-12 h-12 rounded-full object-cover" alt="" />
          }
          
          return (
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              {chat.type === 'channel' ? '#' : chat.type === 'group' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              ) : chat.name[0]?.toUpperCase()}
            </div>
          )
        })()}

        {chat.type === 'private' && isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-sidebar" />}

      </div>

      <div className="flex-1 min-w-0">

        <div className="flex justify-between items-baseline">

          <span className="font-medium text-sm truncate flex items-center gap-1">

            {chat.name}

            {isBot && <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}

            {isMuted && <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm14.5-4.5l-3 3m0-3l3 3" /></svg>}

          </span>

          {chat.lastMessage && <span className="text-xs text-muted flex-shrink-0 ml-2">{formatDistanceToNow(new Date(chat.lastMessage.createdAt), { locale: ru, addSuffix: false })}</span>}
          {isPinned && <svg className="w-3 h-3 text-muted flex-shrink-0 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>}

        </div>

        <div className="flex justify-between items-center mt-0.5">

          <p className="text-xs text-muted truncate">
            {(() => {
              const draft = localStorage.getItem(`draft:${chat.id}`)
              if (draft) return <span className="text-primary/70">✏️ {draft}</span>
              return chat.lastMessage?.text || (chat.lastMessage?.fileType ? '📎 Файл' : 'Нет сообщений')
            })()}
          </p>

          {chat.unreadCount > 0 && <span className="ml-2 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 flex-shrink-0">{chat.unreadCount}</span>}

        </div>

      </div>

    </div>

  )

}

