const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')

const prisma = new PrismaClient()

// Middleware: только с секретным кодом админа
const adminOnly = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) return res.status(403).json({ message: 'Нет доступа' })
    
    // Проверяем секретный код админа из переменной окружения
    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'cocoduck_admin_2026'
    if (user.adminCode !== ADMIN_SECRET) {
      return res.status(403).json({ message: 'Нет доступа' })
    }
    
    next()
  } catch (e) { next(e) }
}

// Кикнуть пользователя из всех сокет-сессий
function kickUser(io, userId) {
  const room = io.sockets.adapter.rooms.get(`user:${userId}`)
  if (room) {
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) socket.disconnect(true)
    }
  }
}

// Получить всех пользователей
router.get('/users', auth, adminOnly, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, displayName: true, avatar: true, online: true, banned: true, frozen: true, bannedIp: true, lastIp: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(users)
  } catch (e) { next(e) }
})

// Бан пользователя
router.post('/users/:id/ban', auth, adminOnly, async (req, res, next) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ message: 'Нельзя забанить себя' })
    const { ip } = req.body
    await prisma.user.update({
      where: { id: req.params.id },
      data: { banned: true, ...(ip && { bannedIp: ip }) }
    })
    // Кикаем активную сессию
    kickUser(req.app.get('io'), req.params.id)
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Разбан
router.post('/users/:id/unban', auth, adminOnly, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { banned: false, bannedIp: null }
    })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Заморозка
router.post('/users/:id/freeze', auth, adminOnly, async (req, res, next) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ message: 'Нельзя заморозить себя' })
    await prisma.user.update({ where: { id: req.params.id }, data: { frozen: true } })
    // Кикаем активную сессию
    kickUser(req.app.get('io'), req.params.id)
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Разморозка
router.post('/users/:id/unfreeze', auth, adminOnly, async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { frozen: false } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Получить ивенты
router.get('/events', auth, adminOnly, async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(events)
  } catch (e) { next(e) }
})

// Создать ивент (рассылка всем через бота)
router.post('/events', auth, adminOnly, async (req, res, next) => {
  try {
    const { title, description } = req.body
    if (!title?.trim()) return res.status(400).json({ message: 'Укажите заголовок' })

    const event = await prisma.event.create({ data: { title: title.trim(), description: description?.trim() || null } })

    const bot = await prisma.user.findUnique({ where: { username: 'CocoDackBot' } })
    if (bot) {
      const text = `📢 *${title}*${description ? `\n\n${description}` : ''}`
      const botChats = await prisma.chat.findMany({
        where: { type: 'private', members: { some: { userId: bot.id } } },
        include: { members: { where: { userId: { not: bot.id } } } }
      })
      const io = req.app.get('io')
      for (const chat of botChats) {
        const userId = chat.members[0]?.userId
        if (!userId) continue
        const msg = await prisma.message.create({
          data: { chatId: chat.id, senderId: bot.id, text },
          include: { sender: true }
        })
        const formatted = formatMsg(msg)
        // Используем отдельные emit чтобы избежать дублирования если пользователь в обоих румах
        const chatRoom = io.sockets.adapter.rooms.get(`chat:${chat.id}`)
        // Проверяем что именно этот пользователь находится в комнате чата
        const userSockets = io.sockets.adapter.rooms.get(`user:${userId}`)
        const userInChatRoom = chatRoom && userSockets && [...userSockets].some(sid => chatRoom.has(sid))
        io.to(`chat:${chat.id}`).emit('message', formatted)
        if (!userInChatRoom) {
          io.to(`user:${userId}`).emit('message', formatted)
        }
      }
    }

    res.json(event)
  } catch (e) { next(e) }
})

// Удалить ивент
router.delete('/events/:id', auth, adminOnly, async (req, res, next) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Сбросить пароль пользователя
router.post('/users/:id/reset-password', auth, adminOnly, async (req, res, next) => {
  try {
    const { newPassword } = req.body
    if (!newPassword?.trim()) return res.status(400).json({ message: 'Укажите новый пароль' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'Пароль должен быть не менее 6 символов' })
    const bcrypt = require('bcryptjs')
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } })
    // Кикаем сессию — пусть перелогинится с новым паролем
    kickUser(req.app.get('io'), req.params.id)
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Удалить пользователя
router.delete('/users/:id', auth, adminOnly, async (req, res, next) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ message: 'Нельзя удалить свой аккаунт' })
    
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
    
    // Защита от удаления бота
    if (user.username === 'CocoDackBot' || user.username === 'PotaChatBot') {
      return res.status(400).json({ message: 'Нельзя удалить системного бота' })
    }
    
    // Кикаем до удаления, пока userId ещё существует
    kickUser(req.app.get('io'), req.params.id)
    
    // Удаляем пользователя (каскадное удаление настроено в схеме)
    await prisma.user.delete({ where: { id: req.params.id } })
    
    res.json({ success: true })
  } catch (e) { 
    console.error('Delete user error:', e)
    next(e) 
  }
})

// Написать конкретному пользователю от бота
router.post('/bot-message', auth, adminOnly, async (req, res, next) => {
  try {
    const { userId, text } = req.body
    if (!userId || !text?.trim()) return res.status(400).json({ message: 'Укажите userId и text' })

    const bot = await prisma.user.findUnique({ where: { username: 'CocoDackBot' } })
    if (!bot) return res.status(404).json({ message: 'Бот не найден' })

    const chat = await prisma.chat.findFirst({
      where: { type: 'private', AND: [{ members: { some: { userId } } }, { members: { some: { userId: bot.id } } }] }
    })
    if (!chat) return res.status(404).json({ message: 'Чат с пользователем не найден' })

    const msg = await prisma.message.create({
      data: { chatId: chat.id, senderId: bot.id, text },
      include: { sender: true }
    })
    const io = req.app.get('io')
    const formatted = formatMsg(msg)
    const chatRoom = io.sockets.adapter.rooms.get(`chat:${chat.id}`)
    const userSockets = io.sockets.adapter.rooms.get(`user:${userId}`)
    const userInChatRoom = chatRoom && userSockets && [...userSockets].some(sid => chatRoom.has(sid))
    io.to(`chat:${chat.id}`).emit('message', formatted)
    if (!userInChatRoom) {
      io.to(`user:${userId}`).emit('message', formatted)
    }
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Написать от бота всем (broadcast)
router.post('/broadcast', auth, adminOnly, async (req, res, next) => {
  try {
    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ message: 'Укажите текст' })

    const bot = await prisma.user.findUnique({ where: { username: 'CocoDackBot' } })
    if (!bot) return res.status(404).json({ message: 'Бот не найден' })

    const botChats = await prisma.chat.findMany({
      where: { type: 'private', members: { some: { userId: bot.id } } },
      include: { members: { where: { userId: { not: bot.id } } } }
    })

    const io = req.app.get('io')
    for (const chat of botChats) {
      const userId = chat.members[0]?.userId
      if (!userId) continue
      const msg = await prisma.message.create({
        data: { chatId: chat.id, senderId: bot.id, text },
        include: { sender: true }
      })
      const formatted = formatMsg(msg)
      const chatRoom = io.sockets.adapter.rooms.get(`chat:${chat.id}`)
      const userSockets = io.sockets.adapter.rooms.get(`user:${userId}`)
      const userInChatRoom = chatRoom && userSockets && [...userSockets].some(sid => chatRoom.has(sid))
      io.to(`chat:${chat.id}`).emit('message', formatted)
      if (!userInChatRoom) {
        io.to(`user:${userId}`).emit('message', formatted)
      }
    }
    res.json({ success: true })
  } catch (e) { next(e) }
})

function formatMsg(msg) {
  return {
    id: msg.id, chatId: msg.chatId, senderId: msg.senderId,
    sender: { id: msg.sender.id, username: msg.sender.username, displayName: msg.sender.displayName, avatar: msg.sender.avatar, online: msg.sender.online ?? false },
    text: msg.text, fileUrl: msg.fileUrl, fileType: msg.fileType, fileName: msg.fileName,
    read: msg.read ?? false, edited: msg.edited ?? false, createdAt: msg.createdAt
  }
}

// Получить тикеты поддержки
router.get('/support', auth, adminOnly, async (req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(tickets)
  } catch (e) { next(e) }
})

// Закрыть тикет
router.patch('/support/:id', auth, adminOnly, async (req, res, next) => {
  try {
    await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status: 'closed' } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Удалить тикет
router.delete('/support/:id', auth, adminOnly, async (req, res, next) => {
  try {
    await prisma.supportTicket.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Очистка потерянных записей (orphaned data)
router.post('/cleanup-orphaned', auth, adminOnly, async (req, res, next) => {
  try {
    const report = { deleted: 0, details: {} }

    // 1. Находим все userId которые используются в разных таблицах
    const chatMembers = await prisma.chatMember.findMany({ select: { userId: true } })
    const messages = await prisma.message.findMany({ select: { senderId: true } })
    const blocks = await prisma.block.findMany({ select: { blockerId: true, blockedId: true } })
    const avatarHistory = await prisma.avatarHistory.findMany({ select: { userId: true } })
    const supportTickets = await prisma.supportTicket.findMany({ select: { userId: true } })
    const messageReads = await prisma.messageRead.findMany({ select: { userId: true } })

    // Собираем все уникальные userId
    const usedUserIds = new Set([
      ...chatMembers.map(m => m.userId),
      ...messages.map(m => m.senderId),
      ...blocks.map(b => b.blockerId),
      ...blocks.map(b => b.blockedId),
      ...avatarHistory.map(a => a.userId),
      ...supportTickets.map(t => t.userId),
      ...messageReads.map(r => r.userId)
    ])

    // 2. Проверяем какие из них не существуют в таблице User
    const existingUsers = await prisma.user.findMany({ select: { id: true } })
    const existingUserIds = new Set(existingUsers.map(u => u.id))
    const orphanedUserIds = [...usedUserIds].filter(id => !existingUserIds.has(id))

    if (orphanedUserIds.length === 0) {
      return res.json({ message: 'База данных чистая, потерянных записей не найдено', report })
    }

    // 3. Удаляем потерянные записи
    const deletedChatMembers = await prisma.chatMember.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    report.details.chatMembers = deletedChatMembers.count
    report.deleted += deletedChatMembers.count

    const deletedMessages = await prisma.message.deleteMany({
      where: { senderId: { in: orphanedUserIds } }
    })
    report.details.messages = deletedMessages.count
    report.deleted += deletedMessages.count

    const deletedBlocks = await prisma.block.deleteMany({
      where: {
        OR: [
          { blockerId: { in: orphanedUserIds } },
          { blockedId: { in: orphanedUserIds } }
        ]
      }
    })
    report.details.blocks = deletedBlocks.count
    report.deleted += deletedBlocks.count

    const deletedAvatars = await prisma.avatarHistory.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    report.details.avatarHistory = deletedAvatars.count
    report.deleted += deletedAvatars.count

    const deletedTickets = await prisma.supportTicket.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    report.details.supportTickets = deletedTickets.count
    report.deleted += deletedTickets.count

    const deletedReads = await prisma.messageRead.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    report.details.messageReads = deletedReads.count
    report.deleted += deletedReads.count

    // 4. Удаляем пустые чаты
    const emptyChats = await prisma.chat.findMany({
      where: { members: { none: {} } },
      select: { id: true }
    })

    if (emptyChats.length > 0) {
      const deletedChats = await prisma.chat.deleteMany({
        where: { id: { in: emptyChats.map(c => c.id) } }
      })
      report.details.emptyChats = deletedChats.count
      report.deleted += deletedChats.count
    }

    res.json({ 
      message: `Очистка завершена. Удалено ${report.deleted} потерянных записей`, 
      orphanedUsers: orphanedUserIds.length,
      report 
    })
  } catch (e) { 
    console.error('Cleanup error:', e)
    next(e) 
  }
})

module.exports = router
