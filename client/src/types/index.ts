export interface User {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  online: boolean
  lastSeen?: string
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
}

export interface Chat {
  id: string
  type: 'private' | 'group' | 'channel'
  name: string
  avatar?: string
  description?: string
  members?: User[]
  lastMessage?: Message
  unreadCount: number
  createdAt: string
}
