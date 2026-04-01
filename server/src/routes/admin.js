const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')

const prisma = new PrismaClient()

// Middleware: только @admin
const adminOnly = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || user.username !== 'cocoduckadm') return res.status(403).json({ message: 'Нет доступа' })
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

    const event = await prisma.event.create({ data: { title: title.trim(), description } })

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
        io.to(`chat:${chat.id}`).emit('message', formatted)
        io.to(`user:${userId}`).emit('message', formatted)
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
    // Кикаем до удаления, пока userId ещё существует
    kickUser(req.app.get('io'), req.params.id)
    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (e) { next(e) }
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
    io.to(`chat:${chat.id}`).emit('message', formatMsg(msg))
    io.to(`user:${userId}`).emit('message', formatMsg(msg))
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
      io.to(`chat:${chat.id}`).emit('message', formatted)
      io.to(`user:${userId}`).emit('message', formatted)
    }
    res.json({ success: true })
  } catch (e) { next(e) }
})

function formatMsg(msg) {
  return {
    id: msg.id, chatId: msg.chatId, senderId: msg.senderId,
    sender: { id: msg.sender.id, username: msg.sender.username, displayName: msg.sender.displayName, avatar: msg.sender.avatar },
    text: msg.text, createdAt: msg.createdAt
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

module.exports = router
