import { create } from 'zustand'
import type { Chat, Message } from '../types'

interface ChatState {
  chats: Chat[]
  activeChat: Chat | null
  messages: Record<string, Message[]>
  onlineUsers: Record<string, boolean>
  setChats: (chats: Chat[]) => void
  setActiveChat: (chat: Chat | null) => void
  addMessage: (chatId: string, message: Message) => void
  setMessages: (chatId: string, messages: Message[]) => void
  updateLastMessage: (chatId: string, message: Message) => void
  editMessage: (chatId: string, message: Message) => void
  deleteMessage: (chatId: string, messageId: string) => void
  setUserOnline: (userId: string, online: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChat: null,
  messages: {},
  onlineUsers: {},
  setChats: (chats) => set({ chats }),
  setActiveChat: (chat) => set({ activeChat: chat }),
  addMessage: (chatId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), message],
      },
    })),
  setMessages: (chatId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [chatId]: messages },
    })),
  updateLastMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, lastMessage: message } : c
      ),
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
}))
