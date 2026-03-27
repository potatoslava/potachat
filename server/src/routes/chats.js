const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const prisma = new PrismaClient()

const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// Get online statuses for chat members
router.get('/online', auth, async (req, res) => {
  const memberships = await prisma.chatMember.findMany({
    where: { userId: req.userId },
    include: { chat: { include: { members: true } } }
  })
  const userIds = [...new Set(memberships.flatMap(m => m.chat.members.map(cm => cm.userId)))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, online: true }
  })
  const statuses = {}
  users.forEach(u => { statuses[u.id] = u.online })
  res.json(statuses)
})

// Get all chats
router.get('/', auth, async (req, res) => {
  const memberships = await prisma.chatMember.findMany({
    where: { userId: req.userId },
    include: {
      chat: {
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: true } },
          members: { include: { user: true } }
        }
      }
    }
  })

  const chats = memberships.map(({ chat }) => {
    const lastMessage = chat.messages[0] || null
    let name = chat.name
    if (chat.type === 'private') {
      const other = chat.members.find(m => m.userId !== req.userId)
      name = other?.user.displayName || chat.name
    }
    return {
      id: chat.id,
      type: chat.type,
      name,
      avatar: chat.avatar,
      lastMessage: lastMessage ? formatMessage(lastMessage) : null,
      unreadCount: 0,
      members: chat.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar })),
      createdAt: chat.createdAt
    }
  })

  res.json(chats.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.createdAt
    const bTime = b.lastMessage?.createdAt || b.createdAt
    return new Date(bTime) - new Date(aTime)
  }))
})

// Create private chat
router.post('/private', auth, async (req, res) => {
  const { username } = req.body
  const target = await prisma.user.findUnique({ where: { username } })
  if (!target) return res.status(404).json({ message: 'Пользователь не найден' })
  if (target.id === req.userId) return res.status(400).json({ message: 'Нельзя создать чат с собой' })

  const existing = await prisma.chat.findFirst({
    where: {
      type: 'private',
      AND: [
        { members: { some: { userId: req.userId } } },
        { members: { some: { userId: target.id } } }
      ]
    },
    include: { members: { include: { user: true } } }
  })

  if (existing) {
    const name = existing.members.find(m => m.userId !== req.userId)?.user.displayName || ''
    return res.json({ id: existing.id, type: 'private', name, lastMessage: null, unreadCount: 0, members: existing.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar })), createdAt: existing.createdAt })
  }

  const chat = await prisma.chat.create({
    data: {
      type: 'private',
      name: `${req.userId}-${target.id}`,
      members: { create: [{ userId: req.userId }, { userId: target.id }] }
    },
    include: { members: { include: { user: true } } }
  })

  const name = chat.members.find(m => m.userId !== req.userId)?.user.displayName || ''
  res.json({ id: chat.id, type: 'private', name, lastMessage: null, unreadCount: 0, members: chat.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar })), createdAt: chat.createdAt })
})

// Create group or channel
router.post('/group', auth, async (req, res) => {
  const { name, type } = req.body
  if (!name) return res.status(400).json({ message: 'Укажите название' })
  const chat = await prisma.chat.create({
    data: {
      type: type || 'group',
      name,
      members: { create: [{ userId: req.userId, role: 'owner' }] }
    }
  })
  res.json({ id: chat.id, type: chat.type, name: chat.name, lastMessage: null, unreadCount: 0, members: [], createdAt: chat.createdAt })
})

// Get messages
router.get('/:chatId/messages', auth, async (req, res) => {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
  })
  if (!member) return res.status(403).json({ message: 'Нет доступа' })

  const messages = await prisma.message.findMany({
    where: { chatId: req.params.chatId },
    include: { sender: true, replyTo: { include: { sender: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  res.json(messages.reverse().map(formatMessage))
})

// Send text message
router.post('/:chatId/messages', auth, async (req, res) => {
  const { text, replyToId } = req.body
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
  })
  if (!member) return res.status(403).json({ message: 'Нет доступа' })

  // Защита от спама: нельзя отправить то же сообщение в течение 3 секунд
  const recent = await prisma.message.findFirst({
    where: {
      chatId: req.params.chatId,
      senderId: req.userId,
      text,
      createdAt: { gte: new Date(Date.now() - 3000) }
    }
  })
  if (recent) return res.status(429).json({ message: 'Подождите перед повторной отправкой' })

  const message = await prisma.message.create({
    data: { chatId: req.params.chatId, senderId: req.userId, text, ...(replyToId && { replyToId }) },
    include: { sender: true, replyTo: { include: { sender: true } } }
  })

  const formatted = formatMessage(message)
  req.app.get('io').to(`chat:${req.params.chatId}`).emit('message', formatted)
  res.json(formatted)
})

// Send file message
router.post('/:chatId/messages/file', auth, upload.single('file'), async (req, res) => {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
  })
  if (!member) return res.status(403).json({ message: 'Нет доступа' })

  const file = req.file
  if (!file) return res.status(400).json({ message: 'Файл не найден' })

  const mime = file.mimetype
  let fileType = 'file'
  if (mime.startsWith('image/')) fileType = 'image'
  else if (mime.startsWith('video/')) fileType = 'video'
  else if (mime.startsWith('audio/')) fileType = 'audio'

  const message = await prisma.message.create({
    data: { chatId: req.params.chatId, senderId: req.userId, fileUrl: file.filename, fileType, fileName: file.originalname },
    include: { sender: true }
  })

  const formatted = formatMessage(message)
  req.app.get('io').to(`chat:${req.params.chatId}`).emit('message', formatted)
  res.json(formatted)
})

// Edit message
router.patch('/:chatId/messages/:messageId', auth, async (req, res) => {
  const { text } = req.body
  const message = await prisma.message.findUnique({ where: { id: req.params.messageId } })
  if (!message) return res.status(404).json({ message: 'Не найдено' })
  if (message.senderId !== req.userId) return res.status(403).json({ message: 'Нет доступа' })

  const updated = await prisma.message.update({
    where: { id: req.params.messageId },
    data: { text },
    include: { sender: true }
  })

  const formatted = { ...formatMessage(updated), edited: true }
  req.app.get('io').to(`chat:${req.params.chatId}`).emit('message:edit', formatted)
  res.json(formatted)
})

// Delete message
router.delete('/:chatId/messages/:messageId', auth, async (req, res) => {
  const message = await prisma.message.findUnique({ where: { id: req.params.messageId } })
  if (!message) return res.status(404).json({ message: 'Не найдено' })
  if (message.senderId !== req.userId) return res.status(403).json({ message: 'Нет доступа' })

  await prisma.message.delete({ where: { id: req.params.messageId } })
  req.app.get('io').to(`chat:${req.params.chatId}`).emit('message:delete', { id: req.params.messageId, chatId: req.params.chatId })
  res.json({ success: true })
})

// Delete chat
router.delete('/:chatId', auth, async (req, res) => {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
  })
  if (!member) return res.status(403).json({ message: 'Нет доступа' })
  await prisma.chat.delete({ where: { id: req.params.chatId } })
  res.json({ success: true })
})

function formatMessage(msg) {
  return {
    id: msg.id,
    chatId: msg.chatId,
    senderId: msg.senderId,
    sender: msg.sender ? {
      id: msg.sender.id,
      username: msg.sender.username,
      displayName: msg.sender.displayName,
      avatar: msg.sender.avatar,
      online: msg.sender.online
    } : undefined,
    text: msg.text,
    fileUrl: msg.fileUrl,
    fileType: msg.fileType,
    fileName: msg.fileName,
    read: msg.read,
    edited: msg.edited,
    replyTo: msg.replyTo ? {
      id: msg.replyTo.id,
      text: msg.replyTo.text,
      fileType: msg.replyTo.fileType,
      fileName: msg.replyTo.fileName,
      sender: msg.replyTo.sender ? { displayName: msg.replyTo.sender.displayName } : undefined
    } : undefined,
    createdAt: msg.createdAt
  }
}

module.exports = router
