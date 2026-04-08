import { useEffect, useRef, useState, useCallback } from 'react'
import React from 'react'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { socket } from '../lib/socket'
import api from '../lib/api'
import type { Message } from '../types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useDropzone } from 'react-dropzone'
import AvatarViewer from './AvatarViewer'
import GroupInfoModal from './GroupInfoModal'

export default function ChatWindow({ onBack }: { onBack?: () => void }) {
  const { activeChat, messages, addMessage, setMessages, updateLastMessage, editMessage, deleteMessage, onlineUsers, lastSeenUsers, typingUsers, setTyping } = useChatStore()
  const { user } = useAuthStore()
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [showAvatarViewer, setShowAvatarViewer] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxScale, setLightboxScale] = useState(1)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null)
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null)
  const [showFormatting, setShowFormatting] = useState(false)
  const [silentMode, setSilentMode] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [selfDestruct, setSelfDestruct] = useState<number>(0) // 0 = off, seconds otherwise
  const [showMediaFilter, setShowMediaFilter] = useState(false)
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video' | 'file'>('all')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chatMessages = activeChat ? (messages[activeChat.id] || []) : []
  
  // Фильтрация по типу медиа
  const filteredMessages = mediaFilter === 'all' 
    ? chatMessages 
    : chatMessages.filter(m => m.fileType === mediaFilter)

  // Сохраняем черновик при изменении текста
  useEffect(() => {
    if (!activeChat) return
    if (text) {
      localStorage.setItem(`draft:${activeChat.id}`, text)
    } else {
      localStorage.removeItem(`draft:${activeChat.id}`)
    }
  }, [text, activeChat?.id])

  useEffect(() => {
    if (!activeChat) return
    // Восстанавливаем черновик
    const draft = localStorage.getItem(`draft:${activeChat.id}`) || ''
    setText(draft)
    setReplyTo(null)
    setSendError('')
    setShowGroupInfo(false)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    setForwardMsg(null)
    setPinnedMessageId(null)
    setPinnedMessage(null)
    // Сбрасываем счётчик непрочитанных при открытии чата
    useChatStore.getState().clearUnread(activeChat.id)
    
    // Загружаем сообщения и инфо о чате
    Promise.all([
      api.get(`/chats/${activeChat.id}/messages`),
      api.get(`/chats/${activeChat.id}/info`)
    ]).then(([messagesRes, infoRes]) => {
      setMessages(activeChat.id, messagesRes.data)
      if (infoRes.data.pinnedMessageId) {
        setPinnedMessageId(infoRes.data.pinnedMessageId)
        const pinned = messagesRes.data.find((m: Message) => m.id === infoRes.data.pinnedMessageId)
        if (pinned) setPinnedMessage(pinned)
      }
    }).catch(() => {})
    socket.emit('join-chat', activeChat.id)
    return () => {
      socket.emit('leave-chat', activeChat.id)
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
      socket.emit('typing:stop', { chatId: activeChat.id })
    }
  }, [activeChat?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  useEffect(() => {
    const onMessage = (msg: Message) => {
      const currentActiveChatId = useChatStore.getState().activeChat?.id
      if (msg.chatId === currentActiveChatId) {
        const currentUser = useAuthStore.getState().user
        if (msg.senderId === currentUser?.id) return
        addMessage(msg.chatId, msg)
        // updateLastMessage вызывается в App.tsx для активного чата
      }
    }
    const onEdit = (msg: Message) => {
      if (msg.chatId === useChatStore.getState().activeChat?.id) editMessage(msg.chatId, msg)
    }
    const onDelete = ({ id, chatId }: { id: string; chatId: string }) => {
      if (chatId === useChatStore.getState().activeChat?.id) {
        deleteMessage(chatId, id)
        // Если удалили закреплённое сообщение, сбрасываем его
        if (pinnedMessageId === id) {
          setPinnedMessageId(null)
          setPinnedMessage(null)
        }
      }
    }

    const onChatUpdate = (data: any) => {
      const currentActiveChatId = useChatStore.getState().activeChat?.id
      if (data.id === currentActiveChatId) {
        const s = useChatStore.getState()
        s.setChats(s.chats.map(c => c.id === data.id ? { ...c, name: data.name, avatar: data.avatar, description: data.description } : c))
        if (s.activeChat?.id === data.id) s.setActiveChat({ ...s.activeChat!, name: data.name, avatar: data.avatar, description: data.description })
      }
    }

    const onMemberAdd = (data: any) => {
      const currentActiveChatId = useChatStore.getState().activeChat?.id
      if (data.chatId === currentActiveChatId) {
        const s = useChatStore.getState()
        s.setChats(s.chats.map(c => c.id === data.chatId ? { ...c, members: [...(c.members || []), data.member] } : c))
        if (s.activeChat?.id === data.chatId) s.setActiveChat({ ...s.activeChat!, members: [...(s.activeChat!.members || []), data.member] })
      }
    }

    const onMemberRemove = (data: any) => {
      const currentActiveChatId = useChatStore.getState().activeChat?.id
      if (data.chatId === currentActiveChatId) {
        const s = useChatStore.getState()
        s.setChats(s.chats.map(c => c.id === data.chatId ? { ...c, members: (c.members || []).filter(m => m.id !== data.userId) } : c))
        if (s.activeChat?.id === data.chatId) s.setActiveChat({ ...s.activeChat!, members: (s.activeChat!.members || []).filter(m => m.id !== data.userId) })
      }
    }

    const onRoleChange = (data: any) => {
      const currentActiveChatId = useChatStore.getState().activeChat?.id
      if (data.chatId === currentActiveChatId) {
        const s = useChatStore.getState()
        const updateMembers = (members: any[]) =>
          members.map(m => m.id === data.userId ? { ...m, role: data.role } : m)
        s.setChats(s.chats.map(c => c.id === data.chatId ? { ...c, members: updateMembers(c.members || []) } : c))
        if (s.activeChat?.id === data.chatId) s.setActiveChat({ ...s.activeChat!, members: updateMembers(s.activeChat!.members || []) })
      }
    }

    const onMessagesRead = ({ chatId }: { chatId: string }) => {
      const s = useChatStore.getState()
      const currentUser = useAuthStore.getState().user
      if (!s.messages[chatId]) return
      s.setMessages(chatId, s.messages[chatId].map(m =>
        m.senderId === currentUser?.id ? { ...m, read: true } : m
      ))
    }

    const onPinnedMessage = ({ chatId, pinnedMessageId }: { chatId: string; pinnedMessageId: string | null }) => {
      if (chatId === useChatStore.getState().activeChat?.id) {
        setPinnedMessageId(pinnedMessageId)
        if (pinnedMessageId) {
          const msg = chatMessages.find(m => m.id === pinnedMessageId)
          if (msg) setPinnedMessage(msg)
        } else {
          setPinnedMessage(null)
        }
      }
    }

    socket.on('message', onMessage)
    socket.on('message:edit', onEdit)
    socket.on('message:delete', onDelete)
    socket.on('chat:update', onChatUpdate)
    socket.on('chat:member_add', onMemberAdd)
    socket.on('chat:member_remove', onMemberRemove)
    socket.on('chat:role_change', onRoleChange)
    socket.on('messages:read', onMessagesRead)
    socket.on('chat:pinned_message', onPinnedMessage)
    const onTypingStart = ({ chatId, displayName }: { chatId: string; displayName: string }) => {
      setTyping(chatId, displayName, true)
    }
    const onTypingStop = ({ chatId, displayName }: { chatId: string; displayName: string }) => {
      setTyping(chatId, displayName, false)
    }
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)

    return () => {
      socket.off('message', onMessage)
      socket.off('message:edit', onEdit)
      socket.off('message:delete', onDelete)
      socket.off('chat:update', onChatUpdate)
      socket.off('chat:member_add', onMemberAdd)
      socket.off('chat:member_remove', onMemberRemove)
      socket.off('chat:role_change', onRoleChange)
      socket.off('messages:read', onMessagesRead)
      socket.off('chat:pinned_message', onPinnedMessage)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
    }
  }, [activeChat?.id])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!val.trim() || val.trim().length < 2) { setSearchResults([]); return }
    const chatId = activeChat?.id
    if (!chatId) return
    searchTimerRef.current = setTimeout(async () => {
      // Проверяем что чат не сменился пока ждали
      if (useChatStore.getState().activeChat?.id !== chatId) return
      setSearchLoading(true)
      try {
        const { data } = await api.get(`/chats/${chatId}/search?q=${encodeURIComponent(val)}`)
        setSearchResults(data)
      } catch (e: any) {
        console.error('Ошибка поиска:', e.response?.data?.message || 'Ошибка')
        setSearchResults([])
      } finally { setSearchLoading(false) }
    }, 300)
  }

  const handleTextChange = (val: string) => {
    setText(val)
    const currentChatId = useChatStore.getState().activeChat?.id
    if (!currentChatId) return
    socket.emit('typing:start', { chatId: currentChatId })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing:stop', { chatId: currentChatId })
    }, 2000)
  }

  const send = async () => {
    const currentChat = useChatStore.getState().activeChat
    if (!text.trim() || !currentChat || sending) return
    
    // Проверка длины
    if (text.length > 4096) {
      setSendError('Сообщение слишком длинное (максимум 4096 символов)')
      setTimeout(() => setSendError(''), 3000)
      return
    }
    
    setSending(true)
    setSendError('')
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    socket.emit('typing:stop', { chatId: currentChat.id })
    try {
      const payload: any = { 
        text, 
        replyToId: replyTo?.id,
        silent: silentMode 
      }
      
      // Если выбрано время отправки
      if (scheduleTime) {
        payload.scheduledFor = new Date(scheduleTime).toISOString()
      }
      
      // Если включено самоуничтожение
      if (selfDestruct > 0) {
        payload.selfDestructSeconds = selfDestruct
      }
      
      const { data } = await api.post(`/chats/${currentChat.id}/messages`, payload)
      
      if (scheduleTime) {
        // Показываем уведомление об отложенном сообщении
        setSendError('✓ Сообщение запланировано')
        setTimeout(() => setSendError(''), 2000)
      } else {
        addMessage(currentChat.id, data)
        updateLastMessage(currentChat.id, data)
      }
      
      setText('')
      localStorage.removeItem(`draft:${currentChat.id}`)
      setReplyTo(null)
      setSilentMode(false)
      setScheduleTime('')
      setShowSchedule(false)
      setSelfDestruct(0)
    } catch (e: any) {
      setSendError(e.response?.data?.message || '')
      setTimeout(() => setSendError(''), 2000)
    } finally {
      setSending(false)
    }
  }

  const applyFormatting = (type: 'bold' | 'italic' | 'mono') => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = text.substring(start, end)
    
    if (!selectedText) return
    
    let formatted = ''
    switch (type) {
      case 'bold':
        formatted = `**${selectedText}**`
        break
      case 'italic':
        formatted = `*${selectedText}*`
        break
      case 'mono':
        formatted = `\`${selectedText}\``
        break
    }
    
    const newText = text.substring(0, start) + formatted + text.substring(end)
    setText(newText)
    
    // Восстанавливаем фокус
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + formatted.length, start + formatted.length)
    }, 0)
  }

  const onDrop = useCallback(async (files: File[]) => {
    const currentChat = useChatStore.getState().activeChat
    if (!currentChat || !files[0]) return
    setUploading(true)
    const form = new FormData()
    form.append('file', files[0])
    try {
      const { data } = await api.post(`/chats/${currentChat.id}/messages/file`, form)
      addMessage(currentChat.id, data)
      updateLastMessage(currentChat.id, data)
    } catch (e: any) {
      setSendError(e.response?.data?.message || 'Ошибка загрузки файла')
      setTimeout(() => setSendError(''), 3000)
    } finally { setUploading(false) }
  }, [addMessage, updateLastMessage])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch (e) {
      setSendError('Нет доступа к микрофону')
      setTimeout(() => setSendError(''), 3000)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const sendVoiceMessage = async () => {
    if (!isRecording || audioChunksRef.current.length === 0) return
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    const currentChat = useChatStore.getState().activeChat
    if (!currentChat) return
    
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    
    setUploading(true)
    const form = new FormData()
    form.append('file', audioBlob, 'voice.webm')
    try {
      const { data } = await api.post(`/chats/${currentChat.id}/messages/file`, form)
      addMessage(currentChat.id, data)
      updateLastMessage(currentChat.id, data)
      audioChunksRef.current = []
    } catch (e: any) {
      setSendError(e.response?.data?.message || 'Ошибка отправки голосового')
      setTimeout(() => setSendError(''), 3000)
    } finally {
      setUploading(false)
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      const stream = mediaRecorderRef.current.stream
      stream.getTracks().forEach(track => track.stop())
      audioChunksRef.current = []
      setIsRecording(false)
      setRecordingTime(0)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true, noKeyboard: true })

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-chat text-muted">
        <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
          <img src="/logo.png" className="w-full h-full object-cover" alt="CocoDack" />
        </div>
        <p className="text-lg font-medium text-white">CocoDack</p>
        <p className="text-sm mt-1">Выберите чат чтобы начать общение</p>
      </div>
    )
  }

  const BOT_NAMES = ['CocoDackBot', 'CocoDack', 'PotaChatBot', 'PotaChat']
  const isBot = activeChat.type === 'private' && activeChat.members?.some(m => BOT_NAMES.includes(m.username || ''))

  return (
    <>
    <div {...getRootProps()} className="flex-1 flex flex-col bg-chat relative" style={{ height: '100dvh' }}>
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-primary border-dashed z-50 flex items-center justify-center rounded-lg">
          <p className="text-white text-lg font-medium">Отпустите файл для отправки</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-header border-b border-border flex-shrink-0 pt-safe">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-muted hover:text-white mr-1 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden cursor-pointer"
          onClick={() => {
            if (activeChat.type === 'private') {
              const otherId = activeChat.members?.find(m => m.id !== user?.id)?.id
              if (otherId) setShowAvatarViewer(otherId)
            } else {
              setShowGroupInfo(true)
            }
          }}>
          {(() => {
            // Для приватного чата — аватарка собеседника, для группы/канала — аватарка чата
            const avatar = activeChat.type === 'private'
              ? activeChat.members?.find(m => m.id !== user?.id)?.avatar
              : activeChat.avatar
            
            if (avatar && (avatar.startsWith('data:') || avatar.startsWith('http'))) {
              return <img src={avatar} className="w-full h-full object-cover" alt="" />
            }
            
            return activeChat.type === 'channel' ? '#' : activeChat.type === 'group' ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            ) : activeChat.name[0]?.toUpperCase()
          })()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{activeChat.name}</p>          {(() => {
            const typing = typingUsers[activeChat.id] || []
            if (typing.length > 0) {
              const names = typing.slice(0, 2).join(', ')
              const more = typing.length > 2 ? ` и ещё ${typing.length - 2}` : ''
              return (
                <p className="text-xs text-primary flex items-center gap-1.5">
                  <span className="flex gap-0.5 items-center">
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {names}{more} {typing.length === 1 ? 'печатает' : 'печатают'}...
                </p>
              )
            }
            return (
              <p className="text-xs text-muted">
                {activeChat.type === 'private'
                  ? (() => {
                      const otherId = activeChat.members?.find(m => m.id !== user?.id)?.id
                      if (otherId && onlineUsers[otherId]) return '🟢 в сети'
                      const ls = otherId ? lastSeenUsers[otherId] : null
                      if (ls) {
                        const diff = Date.now() - new Date(ls).getTime()
                        const mins = Math.floor(diff / 60000)
                        const hours = Math.floor(diff / 3600000)
                        const days = Math.floor(diff / 86400000)
                        if (mins < 1) return 'был(а) только что'
                        if (mins < 60) return `был(а) ${mins} мин. назад`
                        if (hours < 24) return `был(а) ${hours} ч. назад`
                        return `был(а) ${days} дн. назад`
                      }
                      return '⚫ не в сети'
                    })()
                  : `${activeChat.members?.length || 0} участников`}
              </p>
            )
          })()}
        </div>
        <button onClick={() => setShowSearch(v => !v)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${showSearch ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button onClick={() => setShowMediaFilter(v => !v)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${showMediaFilter || mediaFilter !== 'all' ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <button onClick={async () => {
          if (!activeChat) return
          try {
            const { data } = await api.get(`/chats/${activeChat.id}/messages`)
            setMessages(activeChat.id, data)
          } catch {}
        }}
          className="w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 text-muted hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button onClick={() => { setSelectionMode(v => !v); setSelectedMessages(new Set()) }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${selectionMode ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>
      </div>

      {/* Pinned message */}
      {pinnedMessage && (
        <div className="px-4 py-2 bg-primary/10 border-b border-border flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
            const el = document.getElementById(`msg-${pinnedMessage.id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}>
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
              </svg>
              Закреплённое сообщение
            </p>
            <p className="text-xs text-white truncate">{pinnedMessage.text || '📎 Файл'}</p>
          </div>
          {(activeChat?.myRole === 'owner' || activeChat?.myRole === 'admin') && (
            <button onClick={async () => {
              try {
                await api.post(`/chats/${activeChat.id}/messages/${pinnedMessage.id}/pin`)
                setPinnedMessageId(null)
                setPinnedMessage(null)
              } catch {}
            }} className="text-muted hover:text-white flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Search panel */}
      {showSearch && (
        <div className="px-4 py-2 bg-header border-b border-border flex-shrink-0">
          <input
            autoFocus
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Поиск по сообщениям..."
            className="w-full bg-chat border border-border rounded-xl px-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
          />
          {searchLoading && <p className="text-xs text-muted mt-1 text-center">Поиск...</p>}
          {!searchLoading && searchQuery && searchResults.length === 0 && (
            <p className="text-xs text-muted mt-1 text-center">Ничего не найдено</p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map(msg => (
                <div key={msg.id} className="px-3 py-2 bg-chat rounded-xl cursor-pointer hover:bg-sidebar-hover transition"
                  onClick={() => {
                    // Прокручиваем к сообщению если оно загружено
                    const el = document.getElementById(`msg-${msg.id}`)
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-primary'); setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000) }
                    setShowSearch(false)
                  }}>
                  <p className="text-xs text-muted">{msg.sender?.displayName} · {format(new Date(msg.createdAt), 'dd.MM HH:mm', { locale: ru })}</p>
                  <p className="text-sm text-white truncate">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Media filter */}
      {showMediaFilter && (
        <div className="px-4 py-2 bg-header border-b border-border flex gap-2">
          <button onClick={() => { setMediaFilter('all'); setShowMediaFilter(false) }}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${mediaFilter === 'all' ? 'bg-primary text-white' : 'bg-chat text-muted hover:text-white'}`}>
            Все
          </button>
          <button onClick={() => { setMediaFilter('image'); setShowMediaFilter(false) }}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${mediaFilter === 'image' ? 'bg-primary text-white' : 'bg-chat text-muted hover:text-white'}`}>
            Фото
          </button>
          <button onClick={() => { setMediaFilter('video'); setShowMediaFilter(false) }}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${mediaFilter === 'video' ? 'bg-primary text-white' : 'bg-chat text-muted hover:text-white'}`}>
            Видео
          </button>
          <button onClick={() => { setMediaFilter('file'); setShowMediaFilter(false) }}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${mediaFilter === 'file' ? 'bg-primary text-white' : 'bg-chat text-muted hover:text-white'}`}>
            Файлы
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 relative">
        {filteredMessages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderId === user?.id}
            showAvatar={i === 0 || filteredMessages[i - 1]?.senderId !== msg.senderId}
            selectionMode={selectionMode}
            isSelected={selectedMessages.has(msg.id)}
            onSelect={(id) => {
              const newSet = new Set(selectedMessages)
              if (newSet.has(id)) newSet.delete(id)
              else newSet.add(id)
              setSelectedMessages(newSet)
            }}
            onReply={() => setReplyTo(msg)}
            onForward={(m) => setForwardMsg(m)}
            onImageClick={(url) => { setLightboxUrl(url); setLightboxScale(1) }}
            onEdit={async (t) => {
              try {
                const chatId = useChatStore.getState().activeChat?.id
                if (!chatId) return
                const { data } = await api.patch(`/chats/${chatId}/messages/${msg.id}`, { text: t })
                editMessage(chatId, data)
              } catch { /* сообщение не обновится, но не упадёт */ }
            }}
            onDelete={async () => {
              try {
                const chatId = useChatStore.getState().activeChat?.id
                if (!chatId) return
                await api.delete(`/chats/${chatId}/messages/${msg.id}`)
                deleteMessage(chatId, msg.id)
              } catch { /* сообщение не удалится, но не упадёт */ }
            }}
          />
        ))}
        <div ref={bottomRef} />
        
        {/* Scroll to bottom button */}
        <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-primary shadow-lg flex items-center justify-center text-white hover:bg-primary-dark transition opacity-0 hover:opacity-100 focus:opacity-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>

      {/* Selection toolbar */}
      {selectionMode && selectedMessages.size > 0 && (
        <div className="px-4 py-2 bg-primary/20 border-t border-primary flex items-center gap-3">
          <span className="text-sm text-white">{selectedMessages.size} выбрано</span>
          <div className="flex-1" />
          <button onClick={async () => {
            if (!activeChat) return
            for (const msgId of selectedMessages) {
              try {
                await api.delete(`/chats/${activeChat.id}/messages/${msgId}`)
                deleteMessage(activeChat.id, msgId)
              } catch {}
            }
            setSelectedMessages(new Set())
            setSelectionMode(false)
          }} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition">
            Удалить
          </button>
          <button onClick={() => { setSelectedMessages(new Set()); setSelectionMode(false) }}
            className="px-3 py-1.5 bg-sidebar-hover text-white rounded-lg text-sm hover:bg-chat transition">
            Отмена
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-header border-t border-border flex-shrink-0">
        {isBot ? (
          <div className="text-center text-muted text-sm py-1">Это бот — ответить нельзя</div>
        ) : (
          <>
            {sendError && (
              <p className="text-xs text-red-400 mb-2 text-center">{sendError}</p>
            )}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-chat rounded-xl border-l-2 border-primary">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-primary font-medium">{replyTo.sender?.displayName || 'Сообщение'}</p>
                  <p className="text-xs text-muted truncate">{replyTo.text || (replyTo.fileType ? '📎 Файл' : '')}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-muted hover:text-white flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {showFormatting && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-chat rounded-xl">
                <button onClick={() => applyFormatting('bold')} 
                  className="px-2 py-1 text-xs font-bold text-white bg-sidebar-hover hover:bg-primary rounded transition">
                  Ж
                </button>
                <button onClick={() => applyFormatting('italic')} 
                  className="px-2 py-1 text-xs italic text-white bg-sidebar-hover hover:bg-primary rounded transition">
                  К
                </button>
                <button onClick={() => applyFormatting('mono')} 
                  className="px-2 py-1 text-xs font-mono text-white bg-sidebar-hover hover:bg-primary rounded transition">
                  Моно
                </button>
                <div className="flex-1" />
                <button onClick={() => setShowFormatting(false)} className="text-muted hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {showSchedule && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-chat rounded-xl">
                <input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="flex-1 bg-sidebar-hover border border-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-primary" />
                <button onClick={() => { setShowSchedule(false); setScheduleTime('') }} className="text-muted hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <label className="cursor-pointer text-muted hover:text-primary transition flex-shrink-0 pb-2">
                <input type="file" className="hidden" onChange={(e) => e.target.files && onDrop(Array.from(e.target.files))} />
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </label>
              
              {isRecording ? (
                <>
                  <div className="flex-1 bg-red-500/10 rounded-2xl px-4 py-3 flex items-center gap-3 border border-red-500/30">
                    <div className="relative flex-shrink-0">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                    </div>
                    <span className="text-base text-white font-mono font-semibold">{formatTime(recordingTime)}</span>
                    <div className="flex-1 flex items-center justify-center gap-0.5 h-8">
                      {[...Array(30)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1 bg-red-500 rounded-full transition-all duration-150" 
                          style={{ 
                            height: `${Math.sin((recordingTime * 3 + i) * 0.5) * 12 + 16}px`,
                            opacity: 0.6 + Math.random() * 0.4
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                  <button onClick={cancelRecording}
                    className="w-11 h-11 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition flex-shrink-0 border border-red-500/40">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button onClick={sendVoiceMessage} disabled={uploading}
                    className="w-11 h-11 rounded-full bg-primary hover:bg-primary-dark disabled:opacity-40 flex items-center justify-center transition flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 bg-input rounded-2xl px-4 py-2 flex items-end gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => handleTextChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                      placeholder="Сообщение..."
                      rows={1}
                      className="flex-1 bg-transparent text-sm text-white placeholder-muted focus:outline-none resize-none max-h-32"
                    />
                    {text.length > 3000 && (
                      <span className={`text-xs flex-shrink-0 ${text.length > 4096 ? 'text-red-400' : 'text-muted'}`}>
                        {text.length}/4096
                      </span>
                    )}
                  </div>
                  {text.trim() ? (
                    <button onClick={send} disabled={uploading || sending}
                      className="w-10 h-10 rounded-full bg-primary hover:bg-primary-dark disabled:opacity-40 flex items-center justify-center transition flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  ) : (
                    <button onClick={isRecording ? stopRecording : startRecording}
                      className="w-10 h-10 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center transition-all flex-shrink-0 active:scale-110 group">
                      <svg className="w-5 h-5 text-white transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    {showAvatarViewer && activeChat && (
      <AvatarViewer
        userId={showAvatarViewer}
        name={activeChat.name}
        onClose={() => setShowAvatarViewer(null)}
      />
    )}
    {showGroupInfo && activeChat && (
      <GroupInfoModal chat={activeChat} onClose={() => setShowGroupInfo(false)} />
    )}
    {forwardMsg && (
      <ForwardModal
        msg={forwardMsg}
        onClose={() => setForwardMsg(null)}
        onForward={async (targetChatId) => {
          const chatId = useChatStore.getState().activeChat?.id
          if (!chatId) { setForwardMsg(null); return }
          try {
            await api.post(`/chats/${chatId}/messages/${forwardMsg.id}/forward`, { targetChatId })
            setForwardMsg(null)
          } catch {}
        }}
      />
    )}
    {lightboxUrl && (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
        onClick={() => setLightboxUrl(null)}>
        <div className="relative" onClick={e => e.stopPropagation()}>
          <img
            src={lightboxUrl}
            alt=""
            style={{ transform: `scale(${lightboxScale})`, transition: 'transform 0.2s', maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            className="rounded-xl"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <button onClick={() => setLightboxScale(s => Math.max(0.5, s - 0.25))}
              className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition text-lg">−</button>
            <button onClick={() => setLightboxScale(1)}
              className="px-3 h-9 rounded-full bg-white/20 text-white text-xs hover:bg-white/30 transition">{Math.round(lightboxScale * 100)}%</button>
            <button onClick={() => setLightboxScale(s => Math.min(4, s + 0.25))}
              className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition text-lg">+</button>
          </div>
          <button onClick={() => setLightboxUrl(null)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition">✕</button>
          <a href={lightboxUrl} download className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>
    )}
  </>
  )
}

function renderFormattedText(text: string) {
  // Простой парсер для **жирный**, *курсив*, `моноширинный`
  const parts: React.ReactNode[] = []
  let currentIndex = 0
  let key = 0
  
  // Регулярка для поиска форматирования
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let match
  
  while ((match = regex.exec(text)) !== null) {
    // Добавляем текст до совпадения
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index))
    }
    
    const matched = match[0]
    if (matched.startsWith('**') && matched.endsWith('**')) {
      // Жирный
      parts.push(<strong key={key++}>{matched.slice(2, -2)}</strong>)
    } else if (matched.startsWith('*') && matched.endsWith('*')) {
      // Курсив
      parts.push(<em key={key++}>{matched.slice(1, -1)}</em>)
    } else if (matched.startsWith('`') && matched.endsWith('`')) {
      // Моноширинный
      parts.push(<code key={key++} className="bg-black/30 px-1 rounded font-mono text-xs">{matched.slice(1, -1)}</code>)
    }
    
    currentIndex = match.index + matched.length
  }
  
  // Добавляем оставшийся текст
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex))
  }
  
  return parts.length > 0 ? parts : text
}

function extractLinks(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

function VoiceMessagePlayer({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    audio.currentTime = percentage * duration
  }

  const toggleSpeed = () => {
    const audio = audioRef.current
    if (!audio) return

    const speeds = [1, 1.5, 2]
    const currentIndex = speeds.indexOf(playbackRate)
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length]
    setPlaybackRate(nextSpeed)
    audio.playbackRate = nextSpeed
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-2 py-1 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={audioUrl} />
      
      <button onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center transition flex-shrink-0">
        {isPlaying ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-1 bg-white/20 rounded-full cursor-pointer group" onClick={handleSeek}>
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
            style={{ left: `calc(${progress}% - 6px)` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/80 font-mono">{formatTime(currentTime)}</span>
          <span className="text-white/60 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      <button onClick={toggleSpeed}
        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0">
        <span className="text-xs text-white font-semibold">{playbackRate}x</span>
      </button>
    </div>
  )
}

function MessageBubble({ msg, isOwn, showAvatar, selectionMode, isSelected, onSelect, onReply, onEdit, onDelete, onImageClick, onForward }: {
  msg: Message; isOwn: boolean; showAvatar: boolean
  selectionMode?: boolean; isSelected?: boolean; onSelect?: (id: string) => void
  onReply: () => void; onEdit: (text: string) => void; onDelete: () => void
  onImageClick: (url: string) => void; onForward: (msg: Message) => void
}) {
  const { activeChat } = useChatStore()
  const isImage = msg.fileType === 'image'
  const isVideo = msg.fileType === 'video'
  const [showActions, setShowActions] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.text || '')
  const [swipeX, setSwipeX] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [lastTap, setLastTap] = useState<number>(0)
  const [showReaction, setShowReaction] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  
  const isAdminOrOwner = activeChat?.myRole === 'owner' || activeChat?.myRole === 'admin'

  const quickReactions = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏']

  const submitEdit = () => {
    if (editText.trim() && editText !== msg.text) onEdit(editText.trim())
    setEditing(false)
  }

  const pinMessage = async () => {
    if (!activeChat) return
    try {
      await api.post(`/chats/${activeChat.id}/messages/${msg.id}/pin`)
      setShowMenu(false)
    } catch {}
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const currentX = e.touches[0].clientX
    const diff = currentX - touchStart
    
    // Для своих сообщений (справа) - свайп влево, для чужих - вправо
    if (isOwn) {
      // Свайп влево (отрицательный diff)
      if (diff < 0 && diff > -80) {
        setSwipeX(diff)
      }
    } else {
      // Свайп вправо (положительный diff)
      if (diff > 0 && diff < 80) {
        setSwipeX(diff)
      }
    }
  }

  const handleTouchEnd = () => {
    if (Math.abs(swipeX) > 40) {
      onReply()
    }
    setSwipeX(0)
    setTouchStart(null)
  }

  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTap < 300) {
      // Двойной тап - показываем реакцию
      setShowReaction(true)
      setTimeout(() => setShowReaction(false), 1500)
      // Добавляем реакцию ❤️
      addReaction('❤️')
    }
    setLastTap(now)
  }

  const addReaction = async (emoji: string) => {
    if (!activeChat) return
    try {
      await api.post(`/chats/${activeChat.id}/messages/${msg.id}/react`, { emoji })
      // Обновление произойдёт через socket
    } catch {}
  }

  const copyText = () => {
    if (msg.text) {
      navigator.clipboard.writeText(msg.text)
      setShowMenu(false)
    }
  }

  return (
    <div id={`msg-${msg.id}`} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {selectionMode && (
        <button onClick={() => onSelect?.(msg.id)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${isSelected ? 'bg-primary border-primary' : 'border-muted'}`}>
          {isSelected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}
      {!isOwn && (
        <div className={`w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
          {msg.sender?.avatar && (msg.sender.avatar.startsWith('data:') || msg.sender.avatar.startsWith('http'))
            ? <img src={msg.sender.avatar} className="w-full h-full object-cover" alt="" />
            : msg.sender?.displayName?.[0]?.toUpperCase()
          }
        </div>
      )}
      <div className="relative max-w-xs lg:max-w-md xl:max-w-lg">

        {/* Иконка reply при свайпе */}
        {swipeX !== 0 && (
          <div className={`absolute ${isOwn ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 text-muted pointer-events-none`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: Math.min(Math.abs(swipeX) / 40, 1) }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
        )}

        {/* Кнопки действий */}
        {showActions && (
          <div className={`absolute ${isOwn ? 'right-full mr-1' : 'left-full ml-1'} bottom-0 flex gap-1 z-10`}>
            <button onClick={(e) => { e.stopPropagation(); onReply(); setShowActions(false) }}
              className="w-8 h-8 rounded-full bg-sidebar-hover flex items-center justify-center text-muted hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowMenu(true); setShowActions(false) }}
              className="w-8 h-8 rounded-full bg-sidebar-hover flex items-center justify-center text-muted hover:text-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
          </div>
        )}

        {showMenu && (
          <div className={`absolute bottom-8 ${isOwn ? 'right-0' : 'left-0'} bg-sidebar-hover rounded-xl shadow-xl z-50 w-36 py-1 border border-border`}>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="relative z-50">
              <button onClick={() => { onReply(); setShowMenu(false) }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-chat transition">↩️ Ответить</button>
              <button onClick={() => { setShowReactionPicker(true); setShowMenu(false) }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-chat transition">😊 Реакция</button>
              {msg.text && (
                <button onClick={copyText}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-chat transition">📋 Копировать</button>
              )}
              <button onClick={() => { onForward(msg); setShowMenu(false) }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-chat transition">↪️ Переслать</button>
              {isAdminOrOwner && activeChat?.type !== 'private' && (
                <button onClick={pinMessage}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-chat transition">📌 Закрепить</button>
              )}
              {isOwn && msg.text && (
                <button onClick={() => { setEditing(true); setShowMenu(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-chat transition">✏️ Изменить</button>
              )}
              {isOwn && (
                <button onClick={() => { onDelete(); setShowMenu(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-chat transition">🗑️ Удалить</button>
              )}
            </div>
          </div>
        )}

        {showReactionPicker && (
          <div className={`absolute bottom-8 ${isOwn ? 'right-0' : 'left-0'} bg-sidebar-hover rounded-xl shadow-xl z-50 p-2 border border-border`}>
            <div className="fixed inset-0 z-40" onClick={() => setShowReactionPicker(false)} />
            <div className="relative z-50 flex gap-1">
              {quickReactions.map(emoji => (
                <button key={emoji} onClick={() => { addReaction(emoji); setShowReactionPicker(false) }}
                  className="w-8 h-8 rounded-lg hover:bg-chat transition text-xl flex items-center justify-center">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          onClick={() => selectionMode ? onSelect?.(msg.id) : setShowActions(v => !v)}
          onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); setShowActions(false) }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={(e) => { handleTouchEnd(); handleDoubleTap() }}
          style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s' : 'none' }}
          className={`rounded-2xl px-3 py-2 cursor-pointer select-none relative ${isOwn ? 'bg-chat-bubble-out rounded-br-sm' : 'bg-chat-bubble-in rounded-bl-sm'} ${isSelected ? 'ring-2 ring-primary' : ''}`}
        >
          {/* Анимация реакции при двойном тапе */}
          {showReaction && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <span className="text-5xl animate-ping">❤️</span>
            </div>
          )}

          {!isOwn && showAvatar && <p className="text-primary text-xs font-medium mb-1">{msg.sender?.displayName}</p>}

          {msg.replyTo && (
            <div className="border-l-2 border-primary pl-2 mb-2 opacity-80">
              <p className="text-xs text-primary font-medium">{msg.replyTo.sender?.displayName}</p>
              <p className="text-xs text-muted truncate">{msg.replyTo.text || (msg.replyTo.fileType ? '📎 Файл' : '')}</p>
            </div>
          )}

          {isImage && <img src={`/uploads/${msg.fileUrl}`} className="rounded-xl max-w-full mb-1 cursor-zoom-in" alt={msg.fileName}
            onClick={(e) => { e.stopPropagation(); onImageClick(`/uploads/${msg.fileUrl}`) }} />}
          {isVideo && <video src={`/uploads/${msg.fileUrl}`} controls className="rounded-xl max-w-full mb-1" />}
          {msg.fileType === 'audio' && (
            <VoiceMessagePlayer audioUrl={`/uploads/${msg.fileUrl}`} />
          )}
          {msg.fileType && !isImage && !isVideo && msg.fileType !== 'audio' && (
            <a href={`/uploads/${msg.fileUrl}`} download={msg.fileName} className="flex items-center gap-2 text-primary text-sm hover:underline mb-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {msg.fileName}
            </a>
          )}

          {editing ? (
            <div className="flex gap-1">
              <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false) }}
                className="flex-1 bg-transparent text-sm text-white focus:outline-none border-b border-primary" />
              <button onClick={submitEdit} className="text-primary text-xs">✓</button>
              <button onClick={() => setEditing(false)} className="text-muted text-xs">✕</button>
            </div>
          ) : (
            msg.text && (
              <>
                <p className="text-sm text-white whitespace-pre-wrap break-words">{renderFormattedText(msg.text)}</p>
                {/* Предпросмотр ссылок */}
                {extractLinks(msg.text).slice(0, 1).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block mt-2 p-2 bg-black/20 rounded-lg text-xs text-primary hover:bg-black/30 transition truncate">
                    🔗 {url}
                  </a>
                ))}
              </>
            )
          )}

          <p className={`text-xs mt-1 flex items-center gap-1 ${isOwn ? 'justify-end text-blue-300/60' : 'text-muted'}`}>
            {msg.edited && <span className="italic">изменено</span>}
            {format(new Date(msg.createdAt), 'HH:mm', { locale: ru })}
            {isOwn && <span>{msg.read ? '✓✓' : '✓'}</span>}
          </p>
        </div>

        {/* Реакции */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
            {Object.entries(msg.reactions).map(([emoji, userIds]) => (
              <button key={emoji} onClick={() => addReaction(emoji)}
                className="px-1.5 py-0.5 bg-sidebar-hover rounded-full text-xs flex items-center gap-1 hover:bg-chat transition">
                <span>{emoji}</span>
                <span className="text-muted">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ForwardModal({ msg, onClose, onForward }: {
  msg: Message; onClose: () => void; onForward: (chatId: string) => void
}) {
  const { chats } = useChatStore()
  const [search, setSearch] = useState('')
  const [forwarding, setForwarding] = useState<string | null>(null)

  const filtered = chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm">Переслать сообщение</p>
          <button onClick={onClose} className="text-muted hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск чата..."
            className="w-full bg-chat border border-border rounded-xl px-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-primary" />
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.map(chat => (
            <button key={chat.id} disabled={!!forwarding}
              onClick={async () => {
                setForwarding(chat.id)
                await onForward(chat.id)
                setForwarding(null)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-sidebar-hover transition disabled:opacity-50">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                {chat.avatar && (chat.avatar.startsWith('data:') || chat.avatar.startsWith('http'))
                  ? <img src={chat.avatar} className="w-full h-full object-cover" alt="" />
                  : chat.type === 'channel' ? '#' : chat.type === 'group' ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                  ) : chat.name[0]?.toUpperCase()
                }
              </div>
              <p className="text-sm text-white truncate flex-1 text-left">{chat.name}</p>
              {forwarding === chat.id && <span className="text-xs text-primary">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
