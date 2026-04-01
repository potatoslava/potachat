import { create } from 'zustand'
import type { Chat, Message } from '../types'

interface ChatState {
  chats: Chat[]
  activeChat: Chat | null
  messages: Record<string, Message[]>
  onlineUsers: Record<string, boolean>
  lastSeenUsers: Record<string, string>
  setChats: (chats: Chat[]) => void
  setActiveChat: (chat: Chat | null) => void
  addMessage: (chatId: string, message: Message) => void
  setMessages: (chatId: string, messages: Message[]) => void
  updateLastMessage: (chatId: string, message: Message) => void
  editMessage: (chatId: string, message: Message) => void
  deleteMessage: (chatId: string, messageId: string) => void
  setUserOnline: (userId: string, online: boolean) => void
  setUserLastSeen: (userId: string, lastSeen: string) => void
  updateUserAvatar: (userId: string, avatar: string) => void
  incrementUnread: (chatId: string, message: Message) => void
  clearUnread: (chatId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChat: null,
  messages: {},
  onlineUsers: {},
  lastSeenUsers: {},
  setChats: (chats) => set({ chats }),
  setActiveChat: (chat) => set({ activeChat: chat }),
  addMessage: (chatId, message) =>
    set((state) => {
      const existing = state.messages[chatId] || []
      if (existing.some((m) => m.id === message.id)) return state
      return {
        messages: {
          ...state.messages,
          [chatId]: [...existing, message],
        },
      }
    }),
  setMessages: (chatId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [chatId]: messages },
    })),
  updateLastMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats
        .map((c) => c.id === chatId ? { ...c, lastMessage: message } : c)
        .sort((a, b) => new Date(b.lastMessage?.createdAt || b.createdAt).getTime() - new Date(a.lastMessage?.createdAt || a.createdAt).getTime()),
    })),
  editMessage: (chatId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === message.id ? message : m
        ),
      },
    })),
  deleteMessage: (chatId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).filter((m) => m.id !== messageId),
      },
    })),
  setUserOnline: (userId, online) =>
    set((state) => ({
      onlineUsers: { ...state.onlineUsers, [userId]: online },
    })),
  setUserLastSeen: (userId, lastSeen) =>
    set((state) => ({
      lastSeenUsers: { ...state.lastSeenUsers, [userId]: lastSeen },
    })),
  updateUserAvatar: (userId, avatar) =>
    set((state) => ({
      // обновляем аватар в списке чатов (members)
      chats: state.chats.map((c) => ({
        ...c,
        members: c.members?.map((m) => m.id === userId ? { ...m, avatar } : m),
        // если это приватный чат с этим юзером — обновляем и avatar чата
        avatar: c.type === 'private' && c.members?.some(m => m.id === userId) ? avatar : c.avatar,
      })),
      // обновляем аватар отправителя в сообщениях
      messages: Object.fromEntries(
        Object.entries(state.messages).map(([chatId, msgs]) => [
          chatId,
          msgs.map((m) => m.senderId === userId && m.sender
            ? { ...m, sender: { ...m.sender, avatar } }
            : m
          )
        ])
      ),
    })),
  incrementUnread: (chatId, message) =>
    set((state) => ({
      chats: state.chats
        .map((c) => c.id === chatId ? { ...c, unreadCount: (c.unreadCount || 0) + 1, lastMessage: message } : c)
        .sort((a, b) => new Date(b.lastMessage?.createdAt || b.createdAt).getTime() - new Date(a.lastMessage?.createdAt || a.createdAt).getTime())
    })),
  clearUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) => c.id === chatId ? { ...c, unreadCount: 0 } : c)
    })),
}))
