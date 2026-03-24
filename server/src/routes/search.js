const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')

const prisma = new PrismaClient()

router.get('/', auth, async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json({ chats: [], users: [], channels: [] })

  // Search users (excluding self)
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

  // Search group chats user is member of
  const memberships = await prisma.chatMember.findMany({
    where: { userId: req.userId },
    include: { chat: true }
  })

  const myChats = memberships.map(m => m.chat)

  const chats = myChats.filter(c =>
    c.type !== 'channel' && c.name.toLowerCase().includes(q.toLowerCase())
  )

  const channels = myChats.filter(c =>
    c.type === 'channel' && c.name.toLowerCase().includes(q.toLowerCase())
  )

  // Also search public channels not joined
  const publicChannels = await prisma.chat.findMany({
    where: {
      type: 'channel',
      name: { contains: q },
      members: { none: { userId: req.userId } }
    },
    take: 5
  })

  res.json({
    users,
    chats: chats.map(c => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar })),
    channels: [...channels, ...publicChannels].map(c => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar }))
  })
})

module.exports = router
