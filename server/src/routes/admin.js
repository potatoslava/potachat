const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')

const prisma = new PrismaClient()

// Middleware: только @admin
const adminOnly = async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user || user.username !== 'admin') return res.status(403).json({ message: 'Нет доступа' })
  next()
}

// Получить всех пользователей
router.get('/users', auth, adminOnly, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true, avatar: true, online: true, banned: true, frozen: true, bannedIp: true, lastIp: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  })
  res.json(users)
})

// Бан пользователя
router.post('/users/:id/ban', auth, adminOnly, async (req, res) => {
  const { ip } = req.body
  await prisma.user.update({
    where: { id: req.params.id },
    data: { banned: true, ...(ip && { bannedIp: ip }) }
  })
  res.json({ success: true })
})

// Разбан
router.post('/users/:id/unban', auth, adminOnly, async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { banned: false, bannedIp: null }
  })
  res.json({ success: true })
})

// Заморозка
router.post('/users/:id/freeze', auth, adminOnly, async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { frozen: true } })
  res.json({ success: true })
})

// Разморозка
router.post('/users/:id/unfreeze', auth, adminOnly, async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { frozen: false } })
  res.json({ success: true })
})

// Получить ивенты
router.get('/events', auth, adminOnly, async (req, res) => {
  const events = await prisma.event.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(events)
})

// Создать ивент (рассылка всем через бота)
router.post('/events', auth, adminOnly, async (req, res) => {
  const { title, description } = req.body
  if (!title) return res.status(400).json({ message: 'Укажите заголовок' })

  const event = await prisma.event.create({ data: { title, description } })

  // Рассылаем сообщение от бота всем пользователям
  const bot = await prisma.user.findUnique({ where: { username: 'CocoDackBot' } })
  if (bot) {
    const text = `📢 *${title}*${description ? `\n\n${description}` : ''}`
    const allUsers = await prisma.user.findMany({ where: { username: { not: 'CocoDackBot' } }, select: { id: true } })

    for (const u of allUsers) {
      const chat = await prisma.chat.findFirst({
        where: { type: 'private', AND: [{ members: { some: { userId: u.id } } }, { members: { some: { userId: bot.id } } }] }
      })
      if (chat) {
        const msg = await prisma.message.create({
          data: { chatId: chat.id, senderId: bot.id, text },
          include: { sender: true }
        })
        req.app.get('io').to(`chat:${chat.id}`).emit('message', formatMsg(msg))
      }
    }
  }

  res.json(event)
})

// Удалить ивент
router.delete('/events/:id', auth, adminOnly, async (req, res) => {
  await prisma.event.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// Удалить пользователя
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})
router.post('/bot-message', auth, adminOnly, async (req, res) => {
  const { userId, text } = req.body
  if (!userId || !text) return res.status(400).json({ message: 'Укажите userId и text' })

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
  req.app.get('io').to(`chat:${chat.id}`).emit('message', formatMsg(msg))
  res.json({ success: true })
})

// Написать от бота всем (broadcast)
router.post('/broadcast', auth, adminOnly, async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ message: 'Укажите текст' })

  const bot = await prisma.user.findUnique({ where: { username: 'CocoDackBot' } })
  if (!bot) return res.status(404).json({ message: 'Бот не найден' })

  const allUsers = await prisma.user.findMany({ where: { username: { not: 'CocoDackBot' } }, select: { id: true } })
  for (const u of allUsers) {
    const chat = await prisma.chat.findFirst({
      where: { type: 'private', AND: [{ members: { some: { userId: u.id } } }, { members: { some: { userId: bot.id } } }] }
    })
    if (chat) {
      const msg = await prisma.message.create({
        data: { chatId: chat.id, senderId: bot.id, text },
        include: { sender: true }
      })
      req.app.get('io').to(`chat:${chat.id}`).emit('message', formatMsg(msg))
    }
  }
  res.json({ success: true })
})

function formatMsg(msg) {
  return {
    id: msg.id, chatId: msg.chatId, senderId: msg.senderId,
    sender: { id: msg.sender.id, username: msg.sender.username, displayName: msg.sender.displayName, avatar: msg.sender.avatar },
    text: msg.text, createdAt: msg.createdAt
  }
}

module.exports = router
