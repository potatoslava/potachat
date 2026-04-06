const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')

const prisma = new PrismaClient()

router.get('/', auth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json({ chats: [], users: [], channels: [] })
    if (q.length > 100) return res.status(400).json({ message: 'Запрос слишком длинный' })

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.userId } },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: { id: true, username: true, displayName: true, avatar: true, online: true },
      take: 10
    })

    const memberships = await prisma.chatMember.findMany({
      where: { userId: req.userId },
      include: { chat: true }
    })

    const myChats = memberships.map(m => m.chat)
    // Для приватных чатов ищем по имени собеседника, а не по внутреннему имени чата
    const privateMemberships = memberships.filter(m => m.chat.type === 'private')
    const privateChatsWithNames = []

    if (privateMemberships.length > 0) {
      const privateMembers = await prisma.chatMember.findMany({
        where: {
          chatId: { in: privateMemberships.map(m => m.chat.id) },
          userId: { not: req.userId }
        },
        include: { user: { select: { displayName: true } } }
      })
      const memberNameMap = {}
      privateMembers.forEach(m => { memberNameMap[m.chatId] = m.user.displayName })

      privateMemberships.forEach(m => {
        const name = memberNameMap[m.chat.id] || m.chat.name
        if (name.toLowerCase().includes(q.toLowerCase())) {
          privateChatsWithNames.push({ id: m.chat.id, name, type: m.chat.type, avatar: m.chat.avatar })
        }
      })
    }

    const chats = [
      ...privateChatsWithNames,
      ...myChats.filter(c => c.type === 'group' && c.name.toLowerCase().includes(q.toLowerCase()))
        .map(c => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar }))
    ]
    const channels = myChats.filter(c => c.type === 'channel' && c.name.toLowerCase().includes(q.toLowerCase()))

    const publicChannels = await prisma.chat.findMany({
      where: {
        type: 'channel',
        name: { contains: q, mode: 'insensitive' },
        members: { none: { userId: req.userId } }
      },
      take: 5
    })

    res.json({
      users,
      chats,
      channels: [...channels.map(c => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar })), ...publicChannels.map(c => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar }))]
    })
  } catch (e) { next(e) }
})

module.exports = router
