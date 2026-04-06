const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')

const prisma = new PrismaClient()

router.get('/', auth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json({ chats: [], users: [], channels: [] })
    if (q.length > 100) return res.status(400).json({ message: 'Запрос слишком длинный' })

    // Получаем список заблокированных пользователей
    const myBlocks = await prisma.block.findMany({
      where: { blockerId: req.userId },
      select: { blockedId: true }
    })
    const blockedByMe = myBlocks.map(b => b.blockedId)

    const blocksMe = await prisma.block.findMany({
      where: { blockedId: req.userId },
      select: { blockerId: true }
    })
    const blockedMeIds = blocksMe.map(b => b.blockerId)

    const allBlockedIds = [...new Set([...blockedByMe, ...blockedMeIds])]

    // Поиск пользователей (исключая заблокированных и ботов)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.userId } },
          { id: { notIn: allBlockedIds } },
          { username: { notIn: ['CocoDackBot', 'PotaChatBot'] } },
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
    
    // Для приватных чатов ищем по имени собеседника и берём его аватарку
    const privateMemberships = memberships.filter(m => m.chat.type === 'private')
    const privateChatsWithNames = []

    if (privateMemberships.length > 0) {
      const privateMembers = await prisma.chatMember.findMany({
        where: {
          chatId: { in: privateMemberships.map(m => m.chat.id) },
          userId: { not: req.userId }
        },
        include: { user: { select: { id: true, displayName: true, avatar: true } } }
      })
      
      const memberDataMap = {}
      privateMembers.forEach(m => { 
        memberDataMap[m.chatId] = { 
          name: m.user.displayName, 
          avatar: m.user.avatar,
          userId: m.user.id
        } 
      })

      privateMemberships.forEach(m => {
        const data = memberDataMap[m.chat.id]
        if (!data) return
        
        // Пропускаем если собеседник заблокирован
        if (allBlockedIds.includes(data.userId)) return
        
        if (data.name.toLowerCase().includes(q.toLowerCase())) {
          privateChatsWithNames.push({ 
            id: m.chat.id, 
            name: data.name, 
            type: m.chat.type, 
            avatar: data.avatar || m.chat.avatar 
          })
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
      channels: [
        ...channels.map(c => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar })), 
        ...publicChannels.map(c => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar }))
      ]
    })
  } catch (e) { next(e) }
})

module.exports = router
