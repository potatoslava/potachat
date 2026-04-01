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
  filename: (_, file, cb) => {
    // Санитизируем имя файла — убираем path traversal и опасные символы
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
    cb(null, `${Date.now()}-${safeName}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// Get online statuses for chat members
router.get('/online', auth, async (req, res, next) => {
  try {
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
  } catch (e) { next(e) }
})

// Get all chats
router.get('/', auth, async (req, res, next) => {
  try {
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

    const chats = memberships.map(({ chat, role }) => {
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
        description: chat.description,
        inviteCode: (role === 'owner' || role === 'admin') ? chat.inviteCode : undefined,
        myRole: role,
        lastMessage: lastMessage ? formatMessage(lastMessage) : null,
        unreadCount: 0,
        members: chat.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, role: m.role })),
        createdAt: chat.createdAt
      }
    })

    res.json(chats.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.createdAt
      const bTime = b.lastMessage?.createdAt || b.createdAt
      return new Date(bTime) - new Date(aTime)
    }))
  } catch (e) { next(e) }
})

// Create private chat
router.post('/private', auth, async (req, res, next) => {
  try {
    const { username } = req.body
    if (!username?.trim()) return res.status(400).json({ message: 'Укажите имя пользователя' })

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
  } catch (e) { next(e) }
})

// Create group or channel
router.post('/group', auth, async (req, res, next) => {
  try {
    const { name, type } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Укажите название' })
    if (!['group', 'channel'].includes(type)) return res.status(400).json({ message: 'Неверный тип чата' })
    const chat = await prisma.chat.create({
      data: {
        type,
        name: name.trim(),
        members: { create: [{ userId: req.userId, role: 'owner' }] }
      },
      include: { members: { include: { user: true } } }
    })
    res.json({
      id: chat.id, type: chat.type, name: chat.name, lastMessage: null, unreadCount: 0,
      myRole: 'owner',
      members: chat.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, role: m.role })),
      createdAt: chat.createdAt
    })
  } catch (e) { next(e) }
})

// Join by invite code — ЗДЕСЬ, до /:chatId роутов
router.post('/join/:inviteCode', auth, async (req, res, next) => {
  try {
    const chat = await prisma.chat.findUnique({
      where: { inviteCode: req.params.inviteCode },
      include: { members: { include: { user: true } } }
    })
    if (!chat) return res.status(404).json({ message: 'Ссылка недействительна' })
    if (!['group', 'channel'].includes(chat.type))
      return res.status(400).json({ message: 'Неверный тип чата' })

    const existing = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: chat.id, userId: req.userId } }
    })
    if (existing) {
      return res.json({
        id: chat.id, type: chat.type, name: chat.name, avatar: chat.avatar,
        description: chat.description, inviteCode: chat.inviteCode,
        lastMessage: null, unreadCount: 0,
        members: chat.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, role: m.role })),
        createdAt: chat.createdAt
      })
    }

    const newMember = await prisma.chatMember.create({
      data: { chatId: chat.id, userId: req.userId, role: 'member' },
      include: { user: true }
    })

    const memberData = { id: newMember.user.id, username: newMember.user.username, displayName: newMember.user.displayName, avatar: newMember.user.avatar, online: newMember.user.online, role: 'member' }
    req.app.get('io').to(`chat:${chat.id}`).emit('chat:member_add', { chatId: chat.id, member: memberData })
    req.app.get('io').to(`user:${req.userId}`).emit('chat:joined', {
      id: chat.id, type: chat.type, name: chat.name, avatar: chat.avatar,
      description: chat.description, lastMessage: null, unreadCount: 0,
      members: [...chat.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, role: m.role })), memberData],
      createdAt: chat.createdAt
    })

    res.json({
      id: chat.id, type: chat.type, name: chat.name, avatar: chat.avatar,
      description: chat.description, lastMessage: null, unreadCount: 0,
      members: [...chat.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, role: m.role })), memberData],
      createdAt: chat.createdAt
    })
  } catch (e) { next(e) }
})

// Get messages
router.get('/:chatId/messages', auth, async (req, res, next) => {
  try {
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
  } catch (e) { next(e) }
})

// Send text message
router.post('/:chatId/messages', auth, async (req, res, next) => {
  try {
    const { text, replyToId } = req.body
    if (!text?.trim()) return res.status(400).json({ message: 'Сообщение не может быть пустым' })

    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!member) return res.status(403).json({ message: 'Нет доступа' })

    // Валидируем replyToId — сообщение должно быть из того же чата
    if (replyToId) {
      const replyMsg = await prisma.message.findUnique({ where: { id: replyToId } })
      if (!replyMsg || replyMsg.chatId !== req.params.chatId) {
        return res.status(400).json({ message: 'Неверный replyToId' })
      }
    }

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
  } catch (e) { next(e) }
})

// Send file message
router.post('/:chatId/messages/file', auth, upload.single('file'), async (req, res, next) => {
  try {
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!member) {
      if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {})
      return res.status(403).json({ message: 'Нет доступа' })
    }

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
  } catch (e) {
    if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {})
    next(e)
  }
})

// Edit message
router.patch('/:chatId/messages/:messageId', auth, async (req, res, next) => {
  try {
    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ message: 'Текст не может быть пустым' })

    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } })
    if (!message) return res.status(404).json({ message: 'Не найдено' })
    if (message.senderId !== req.userId) return res.status(403).json({ message: 'Нет доступа' })
    // Убеждаемся что сообщение принадлежит этому чату
    if (message.chatId !== req.params.chatId) return res.status(403).json({ message: 'Нет доступа' })

    const updated = await prisma.message.update({
      where: { id: req.params.messageId },
      data: { text: text.trim(), edited: true },
      include: { sender: true }
    })

    const formatted = formatMessage(updated)
    req.app.get('io').to(`chat:${req.params.chatId}`).emit('message:edit', formatted)
    res.json(formatted)
  } catch (e) { next(e) }
})

// Delete message
router.delete('/:chatId/messages/:messageId', auth, async (req, res, next) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } })
    if (!message) return res.status(404).json({ message: 'Не найдено' })
    if (message.senderId !== req.userId) return res.status(403).json({ message: 'Нет доступа' })
    if (message.chatId !== req.params.chatId) return res.status(403).json({ message: 'Нет доступа' })

    // Удаляем файл с диска если есть
    if (message.fileUrl) {
      fs.unlink(path.join(uploadDir, message.fileUrl), () => {})
    }

    await prisma.message.delete({ where: { id: req.params.messageId } })
    req.app.get('io').to(`chat:${req.params.chatId}`).emit('message:delete', { id: req.params.messageId, chatId: req.params.chatId })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Get chat info (members with roles, description, inviteCode)
router.get('/:chatId/info', auth, async (req, res, next) => {
  try {
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!member) return res.status(403).json({ message: 'Нет доступа' })

    const chat = await prisma.chat.findUnique({
      where: { id: req.params.chatId },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatar: true, online: true } } } } }
    })
    if (!chat) return res.status(404).json({ message: 'Чат не найден' })

    res.json({
      id: chat.id,
      type: chat.type,
      name: chat.name,
      avatar: chat.avatar,
      description: chat.description,
      inviteCode: member.role === 'owner' || member.role === 'admin' ? chat.inviteCode : undefined,
      myRole: member.role,
      members: chat.members.map(m => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.displayName,
        avatar: m.user.avatar,
        online: m.user.online,
        role: m.role
      }))
    })
  } catch (e) { next(e) }
})

// Update group info (name, description, avatar) — owner/admin only
router.patch('/:chatId/info', auth, async (req, res, next) => {
  try {
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!member || !['owner', 'admin'].includes(member.role))
      return res.status(403).json({ message: 'Нет доступа' })

    const { name, description, avatar } = req.body
    const chat = await prisma.chat.update({
      where: { id: req.params.chatId },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(avatar !== undefined && { avatar })
      }
    })

    // Уведомляем участников об обновлении
    req.app.get('io').to(`chat:${req.params.chatId}`).emit('chat:update', {
      id: chat.id, name: chat.name, avatar: chat.avatar, description: chat.description
    })
    res.json({ success: true, name: chat.name, avatar: chat.avatar, description: chat.description })
  } catch (e) { next(e) }
})

// Add member to group — owner/admin only
router.post('/:chatId/members', auth, async (req, res, next) => {
  try {
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!member || !['owner', 'admin'].includes(member.role))
      return res.status(403).json({ message: 'Нет доступа' })

    const { username } = req.body
    if (!username?.trim()) return res.status(400).json({ message: 'Укажите username' })

    const target = await prisma.user.findUnique({ where: { username } })
    if (!target) return res.status(404).json({ message: 'Пользователь не найден' })

    const existing = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: target.id } }
    })
    if (existing) return res.status(400).json({ message: 'Пользователь уже в группе' })

    await prisma.chatMember.create({ data: { chatId: req.params.chatId, userId: target.id, role: 'member' } })

    const newMember = { id: target.id, username: target.username, displayName: target.displayName, avatar: target.avatar, online: target.online, role: 'member' }
    req.app.get('io').to(`chat:${req.params.chatId}`).emit('chat:member_add', { chatId: req.params.chatId, member: newMember })
    // Уведомляем добавленного пользователя — он получит чат в свой список
    const chatData = await prisma.chat.findUnique({
      where: { id: req.params.chatId },
      include: { members: { include: { user: true } } }
    })
    if (chatData) {
      req.app.get('io').to(`user:${target.id}`).emit('chat:joined', {
        id: chatData.id, type: chatData.type, name: chatData.name, avatar: chatData.avatar,
        description: chatData.description, lastMessage: null, unreadCount: 0, myRole: 'member',
        members: chatData.members.map(m => ({ id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, role: m.role })),
        createdAt: chatData.createdAt
      })
    }
    res.json({ success: true, member: newMember })
  } catch (e) { next(e) }
})

// Remove member from group — owner/admin only (or self-leave)
router.delete('/:chatId/members/:userId', auth, async (req, res, next) => {
  try {
    const myMember = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!myMember) return res.status(403).json({ message: 'Нет доступа' })

    const isSelf = req.params.userId === req.userId
    const isAdminOrOwner = ['owner', 'admin'].includes(myMember.role)

    if (!isSelf && !isAdminOrOwner)
      return res.status(403).json({ message: 'Нет доступа' })

    const targetMember = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.params.userId } }
    })
    if (!targetMember) return res.status(404).json({ message: 'Участник не найден' })

    // Нельзя кикнуть владельца
    if (targetMember.role === 'owner' && !isSelf)
      return res.status(403).json({ message: 'Нельзя удалить владельца' })

    await prisma.chatMember.delete({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.params.userId } }
    })

    req.app.get('io').to(`chat:${req.params.chatId}`).emit('chat:member_remove', { chatId: req.params.chatId, userId: req.params.userId })
    // Если пользователь сам вышел — убираем чат из его списка
    if (isSelf) req.app.get('io').to(`user:${req.userId}`).emit('chat:left', { chatId: req.params.chatId })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Change member role — owner only
router.patch('/:chatId/members/:userId/role', auth, async (req, res, next) => {
  try {
    const myMember = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!myMember || myMember.role !== 'owner')
      return res.status(403).json({ message: 'Только владелец может менять роли' })

    const { role } = req.body
    if (!['admin', 'member'].includes(role))
      return res.status(400).json({ message: 'Роль должна быть admin или member' })

    if (req.params.userId === req.userId)
      return res.status(400).json({ message: 'Нельзя изменить свою роль' })

    await prisma.chatMember.update({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.params.userId } },
      data: { role }
    })

    req.app.get('io').to(`chat:${req.params.chatId}`).emit('chat:role_change', { chatId: req.params.chatId, userId: req.params.userId, role })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Generate/regenerate invite link — owner/admin only
router.post('/:chatId/invite', auth, async (req, res, next) => {
  try {
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!member || !['owner', 'admin'].includes(member.role))
      return res.status(403).json({ message: 'Нет доступа' })

    const { randomBytes } = require('crypto')
    const inviteCode = randomBytes(8).toString('hex')
    await prisma.chat.update({ where: { id: req.params.chatId }, data: { inviteCode } })
    res.json({ inviteCode })
  } catch (e) { next(e) }
})

// Delete chat
router.delete('/:chatId', auth, async (req, res, next) => {
  try {
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: req.params.chatId, userId: req.userId } }
    })
    if (!member) return res.status(403).json({ message: 'Нет доступа' })

    const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId } })
    if (chat && chat.type !== 'private' && member.role !== 'owner') {
      return res.status(403).json({ message: 'Только владелец может удалить этот чат' })
    }
    await prisma.chat.delete({ where: { id: req.params.chatId } })
    res.json({ success: true })
  } catch (e) { next(e) }
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
