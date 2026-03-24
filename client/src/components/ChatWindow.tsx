import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { socket } from '../lib/socket'
import api from '../lib/api'
import type { Message } from '../types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useDropzone } from 'react-dropzone'

export default function ChatWindow({ onBack }: { onBack?: () => void }) {
  const { activeChat, messages, addMessage, setMessages, updateLastMessage, editMessage, deleteMessage } = useChatStore()
  const { user } = useAuthStore()
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chatMessages = activeChat ? (messages[activeChat.id] || []) : []

  useEffect(() => {
    if (!activeChat) return
    api.get(`/chats/${activeChat.id}/messages`).then(({ data }) => {
      setMessages(activeChat.id, data)
    })
    socket.emit('join-chat', activeChat.id)
    return () => { socket.emit('leave-chat', activeChat.id) }
  }, [activeChat?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  useEffect(() => {
    const onMessage = (msg: Message) => {
      if (msg.chatId === activeChat?.id) {
        // Пропускаем если это наше сообщение (уже добавлено через API)
        if (msg.senderId === user?.id) return
        addMessage(msg.chatId, msg)
        updateLastMessage(msg.chatId, msg)
      }
    }
    const onEdit = (msg: Message) => {
      if (msg.chatId === activeChat?.id) editMessage(msg.chatId, msg)
    }
    const onDelete = ({ id, chatId }: { id: string; chatId: string }) => {
      if (chatId === activeChat?.id) deleteMessage(chatId, id)
    }
    socket.on('message', onMessage)
    socket.on('message:edit', onEdit)
    socket.on('message:delete', onDelete)
    return () => {
      socket.off('message', onMessage)
      socket.off('message:edit', onEdit)
      socket.off('message:delete', onDelete)
    }
  }, [activeChat?.id])

  const send = async () => {
    if (!text.trim() || !activeChat) return
    const { data } = await api.post(`/chats/${activeChat.id}/messages`, { text, replyToId: replyTo?.id })
    addMessage(activeChat.id, data)
    updateLastMessage(activeChat.id, data)
    setText('')
    setReplyTo(null)
  }

  const onDrop = useCallback(async (files: File[]) => {
    if (!activeChat || !files[0]) return
    setUploading(true)
    const form = new FormData()
    form.append('file', files[0])
    try {
      const { data } = await api.post(`/chats/${activeChat.id}/messages/file`, form)
      addMessage(activeChat.id, data)
      updateLastMessage(activeChat.id, data)
    } finally {
      setUploading(false)
    }
  }, [activeChat])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, noClick: true, noKeyboard: true
  })

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-chat text-muted">
        <div className="w-24 h-24 rounded-full bg-sidebar flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" className="w-12 h-12 fill-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.25.38-.51 1.07-.78 4.19-1.82 6.98-3.02 8.38-3.61 3.99-1.66 4.82-1.95 5.36-1.96.12 0 .38.03.55.17.14.12.18.28.2.45-.02.07-.02.13-.03.2z"/>
          </svg>
        </div>
        <p className="text-lg font-medium text-white">CocoDack</p>
        <p className="text-sm mt-1">Выберите чат чтобы начать общение</p>
      </div>
    )
  }

  return (
    <div {...getRootProps()} className="flex-1 flex flex-col bg-chat relative" style={{ height: '100dvh' }}>
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-primary border-dashed z-50 flex items-center justify-center rounded-lg">
          <p className="text-white text-lg font-medium">Отпустите файл для отправки</p>
        </div>
      )}

      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-header border-b border-border flex-shrink-0 pt-safe">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-muted hover:text-white mr-1 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
          {activeChat.type === 'channel' ? '#' : activeChat.name[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-sm">{activeChat.name}</p>
          <p className="text-xs text-muted">
            {activeChat.type === 'private' ? 'в сети' : activeChat.type === 'group' ? 'группа' : 'канал'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {chatMessages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderId === user?.id}
            showAvatar={i === 0 || chatMessages[i - 1]?.senderId !== msg.senderId}
            onReply={() => setReplyTo(msg)}
            onEdit={async (text) => {
              const { data } = await api.patch(`/chats/${activeChat!.id}/messages/${msg.id}`, { text })
              editMessage(activeChat!.id, data)
            }}
            onDelete={async () => {
              await api.delete(`/chats/${activeChat!.id}/messages/${msg.id}`)
              deleteMessage(activeChat!.id, msg.id)
            }}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-header border-t border-border flex-shrink-0">
        {/* Reply preview */}
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
        <div className="flex items-end gap-2">
          <label className="cursor-pointer text-muted hover:text-primary transition flex-shrink-0 pb-2">
            <input type="file" className="hidden" onChange={(e) => e.target.files && onDrop(Array.from(e.target.files))} />
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </label>
          <div className="flex-1 bg-input rounded-2xl px-4 py-2 flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Сообщение..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-muted focus:outline-none resize-none max-h-32"
              style={{ height: 'auto' }}
            />
          </div>
          <button
            onClick={send}
            disabled={!text.trim() || uploading}
            className="w-10 h-10 rounded-full bg-primary hover:bg-primary-dark disabled:opacity-40 flex items-center justify-center transition flex-shrink-0"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg, isOwn, showAvatar, onReply, onEdit, onDelete }: {
  msg: Message
  isOwn: boolean
  showAvatar: boolean
  onReply: () => void
  onEdit: (text: string) => void
  onDelete: () => void
}) {
  const isImage = msg.fileType === 'image'
  const isVideo = msg.fileType === 'video'
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.text || '')

  const submitEdit = () => {
    if (editText.trim() && editText !== msg.text) onEdit(editText.trim())
    setEditing(false)
  }

  return (
    <div className={`flex items-end gap-2 group ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && (
        <div className={`w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
          {msg.sender?.displayName?.[0]?.toUpperCase()}
        </div>
      )}
      <div className="relative">
        {/* Action buttons on hover */}
        <div className={`absolute ${isOwn ? '-left-16' : '-right-16'} bottom-2 opacity-0 group-hover:opacity-100 transition flex gap-1`}>
          <button onClick={onReply} className="text-muted hover:text-white p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          {isOwn && (
            <button onClick={() => setShowMenu(!showMenu)} className="text-muted hover:text-white p-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
          )}
        </div>

        {showMenu && (
          <div className={`absolute bottom-8 ${isOwn ? 'right-0' : 'left-0'} bg-sidebar-hover rounded-xl shadow-xl z-50 w-36 py-1 border border-border`}>
            {msg.text && (
              <button onClick={() => { setEditing(true); setShowMenu(false) }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-chat transition">
                ✏️ Изменить
              </button>
            )}
            <button onClick={() => { onDelete(); setShowMenu(false) }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-chat transition">
              🗑️ Удалить
            </button>
          </div>
        )}

        <div className={`max-w-xs lg:max-w-md xl:max-w-lg rounded-2xl px-3 py-2 ${isOwn ? 'bg-chat-bubble-out rounded-br-sm' : 'bg-chat-bubble-in rounded-bl-sm'}`}>
          {!isOwn && showAvatar && (
            <p className="text-primary text-xs font-medium mb-1">{msg.sender?.displayName}</p>
          )}

          {/* Reply quote */}
          {msg.replyTo && (
            <div className="border-l-2 border-primary pl-2 mb-2 opacity-80">
              <p className="text-xs text-primary font-medium">{msg.replyTo.sender?.displayName}</p>
              <p className="text-xs text-muted truncate">{msg.replyTo.text || (msg.replyTo.fileType ? '📎 Файл' : '')}</p>
            </div>
          )}
          {isImage && (
            <img src={`/uploads/${msg.fileUrl}`} className="rounded-xl max-w-full mb-1 cursor-pointer" alt={msg.fileName} />
          )}
          {isVideo && (
            <video src={`/uploads/${msg.fileUrl}`} controls className="rounded-xl max-w-full mb-1" />
          )}
          {msg.fileType && !isImage && !isVideo && (
            <a href={`/uploads/${msg.fileUrl}`} download={msg.fileName} className="flex items-center gap-2 text-primary text-sm hover:underline mb-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {msg.fileName}
            </a>
          )}
          {editing ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false) }}
                className="flex-1 bg-transparent text-sm text-white focus:outline-none border-b border-primary"
              />
              <button onClick={submitEdit} className="text-primary text-xs">✓</button>
              <button onClick={() => setEditing(false)} className="text-muted text-xs">✕</button>
            </div>
          ) : (
            msg.text && <p className="text-sm text-white whitespace-pre-wrap break-words">{msg.text}</p>
          )}
          <p className={`text-xs mt-1 flex items-center gap-1 ${isOwn ? 'justify-end text-blue-300/60' : 'text-muted'}`}>
            {msg.edited && <span className="italic">изменено</span>}
            {format(new Date(msg.createdAt), 'HH:mm', { locale: ru })}
            {isOwn && <span>{msg.read ? '✓✓' : '✓'}</span>}
          </p>
        </div>
      </div>
    </div>
  )
}
