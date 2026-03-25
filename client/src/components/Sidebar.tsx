import { useEffect, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import type { Chat } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import NewChatModal from './NewChatModal'
import SearchPanel from './SearchPanel'
import ProfileModal from './ProfileModal'
import ChatContextMenu from './ChatContextMenu'

export default function Sidebar({ onOpenAdmin, showAdmin }: { onOpenAdmin: () => void; showAdmin: boolean }) {
  const { chats, setChats, setActiveChat, activeChat } = useChatStore()
  const { user, logout } = useAuthStore()
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ chat: Chat; x: number; y: number } | null>(null)
  const isAdmin = user?.username === 'admin'

  useEffect(() => { api.get('/chats').then(({ data }) => setChats(data)) }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.menu-anchor')) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isSearching = searchFocused && search.trim().length > 0
  const filtered = chats.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="w-full md:w-80 flex-shrink-0 bg-sidebar flex flex-col border-r border-border relative" style={{ height: '100dvh' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border pt-safe">
        <div className="relative menu-anchor">
          <button onClick={() => setShowMenu(!showMenu)}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${isAdmin ? 'bg-yellow-500' : 'bg-primary'}`}>
              {isAdmin ? '🛡️' : user?.displayName?.[0]?.toUpperCase()}
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
              <button onClick={() => { setShowProfile(true); setShowMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-chat transition">
                Редактировать профиль
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
            onClick={() => setActiveChat(chat)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ chat, x: e.clientX, y: e.clientY }) }} />
        ))}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {contextMenu && <ChatContextMenu chat={contextMenu.chat} position={{ x: contextMenu.x, y: contextMenu.y }} onClose={() => setContextMenu(null)} />}
    </div>
  )
}

function ChatItem({ chat, active, onClick, onContextMenu }: { chat: Chat; active: boolean; onClick: () => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  const isBot = chat.name === 'CocoDackBot'
  const { onlineUsers } = useChatStore()
  const { user } = useAuthStore()
  // для приватного чата берём id собеседника
  const otherId = chat.type === 'private' ? chat.members?.find(m => m.id !== user?.id)?.id : null
  const isOnline = otherId ? !!onlineUsers[otherId] : false
  return (
    <div onClick={onClick} onContextMenu={onContextMenu} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-sidebar-hover ${active ? 'bg-sidebar-hover' : ''}`}>
      <div className="relative flex-shrink-0">
        {chat.avatar && (chat.avatar.startsWith('data:') || chat.avatar.startsWith('http')) ? <img src={chat.avatar} className="w-12 h-12 rounded-full object-cover" alt="" /> : <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold">{chat.type === 'channel' ? '#' : chat.name[0]?.toUpperCase()}</div>}
        {chat.type === 'private' && isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-sidebar" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <span className="font-medium text-sm truncate flex items-center gap-1">
            {chat.name}
            {isBot && <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}
          </span>
          {chat.lastMessage && <span className="text-xs text-muted flex-shrink-0 ml-2">{formatDistanceToNow(new Date(chat.lastMessage.createdAt), { locale: ru, addSuffix: false })}</span>}
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className="text-xs text-muted truncate">{chat.lastMessage?.text || (chat.lastMessage?.fileType ? '📎 Файл' : 'Нет сообщений')}</p>
          {chat.unreadCount > 0 && <span className="ml-2 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 flex-shrink-0">{chat.unreadCount}</span>}
        </div>
      </div>
    </div>
  )
}
