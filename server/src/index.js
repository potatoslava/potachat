const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const path = require('path')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const authRoutes = require('./routes/authRoutes') // v2
const chatRoutes = require('./routes/chats')
const searchRoutes = require('./routes/search')
const userRoutes = require('./routes/users')
const adminRoutes = require('./routes/admin')
const { getOrCreateBot } = require('./bot')

const prisma = new PrismaClient()
const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
const JWT_SECRET = process.env.JWT_SECRET || 'CocoDack_secret_key'

app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/users', userRoutes)
app.use('/api/admin', adminRoutes)

const clientDist = path.join(__dirname, '../../client/dist')
app.use(express.static(clientDist))
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(clientDist, 'index.html'))
  } else {
    res.status(404).json({ message: 'Not found' })
  }
})

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Unauthorized'))
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    socket.userId = payload.userId
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

io.on('connection', async (socket) => {
  socket.join(`user:${socket.userId}`)
  await prisma.user.update({ where: { id: socket.userId }, data: { online: true } }).catch(() => {})

  // Уведомляем только тех, у кого есть общие чаты с этим пользователем
  const memberships = await prisma.chatMember.findMany({
    where: { userId: socket.userId },
    include: { chat: { include: { members: { where: { userId: { not: socket.userId } } } } } }
  }).catch(() => [])
  const contactIds = [...new Set(memberships.flatMap(m => m.chat.members.map(cm => cm.userId)))]
  contactIds.forEach(id => {
    io.to(`user:${id}`).emit('user:status', { userId: socket.userId, online: true })
  })

  socket.on('join-chat', async (chatId) => {
    // Проверяем что пользователь является участником чата
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: socket.userId } }
    }).catch(() => null)
    if (member) socket.join(`chat:${chatId}`)
  })
  socket.on('leave-chat', (chatId) => socket.leave(`chat:${chatId}`))

  socket.on('disconnect', async () => {
    await prisma.user.update({ where: { id: socket.userId }, data: { online: false, lastSeen: new Date() } }).catch(() => {})
    // Уведомляем только контакты
    const memberships = await prisma.chatMember.findMany({
      where: { userId: socket.userId },
      include: { chat: { include: { members: { where: { userId: { not: socket.userId } } } } } }
    }).catch(() => [])
    const contactIds = [...new Set(memberships.flatMap(m => m.chat.members.map(cm => cm.userId)))]
    contactIds.forEach(id => {
      io.to(`user:${id}`).emit('user:status', { userId: socket.userId, online: false })
    })
  })
})

app.set('io', io)

// Global error handler — catches unhandled async errors in routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: 'Внутренняя ошибка сервера' })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, async () => {
  console.log(`CocoDack server running on port ${PORT}`)
  if (!process.env.DATABASE_URL) console.warn('WARNING: DATABASE_URL not set, using default')
  if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET not set, using default insecure key')
  if (!process.env.BREVO_API_KEY) console.warn('WARNING: BREVO_API_KEY not set, email sending will fail')
  await prisma.user.updateMany({ data: { online: false } })
  getOrCreateBot().catch(console.error)
})
