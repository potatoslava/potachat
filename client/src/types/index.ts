export interface User {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  online: boolean
  lastSeen?: string
  email?: string
  emailVerified?: boolean
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  sender?: User
  text?: string
  fileUrl?: string
  fileType?: 'image' | 'video' | 'audio' | 'file'
  fileName?: string
  createdAt: string
  read: boolean
  edited?: boolean
  replyTo?: {
    id: string
    text?: string
    fileType?: string
    fileName?: string
    sender?: { displayName: string }
  }
}

export interface Chat {
  id: string
  type: 'private' | 'group' | 'channel'
  name: string
  avatar?: string
  description?: string
  members?: { id: string; username: string; displayName: string; avatar?: string }[]
  lastMessage?: Message
  unreadCount: number
  createdAt: string
}
