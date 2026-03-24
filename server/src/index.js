const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const path = require('path')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const authRoutes = require('./routes/auth')
const chatRoutes = require('./routes/chats')
const searchRoutes = require('./routes/search')
const userRoutes = require('./routes/users')
const adminRoutes = require('./routes/admin')
const { getOrCreateBot } = require('./bot')

const prisma = new PrismaClient()
const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
const JWT_SECRET = process.env.JWT_SECRET || 'cocodack_secret_key'

app.use(cors())
app.use(express.json())
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
  await prisma.user.update({ where: { id: socket.userId }, data: { online: true } })
  io.emit('user:status', { userId: socket.userId, online: true })

  socket.on('join-chat', (chatId) => socket.join(`chat:${chatId}`))
  socket.on('leave-chat', (chatId) => socket.leave(`chat:${chatId}`))

  socket.on('disconnect', async () => {
    await prisma.user.update({ where: { id: socket.userId }, data: { online: false, lastSeen: new Date() } })
    io.emit('user:status', { userId: socket.userId, online: false })
  })
})

app.set('io', io)

const PORT = process.env.PORT || 5000
server.listen(PORT, async () => {
  console.log(`CocoDack server running on port ${PORT}`)
  await prisma.user.updateMany({ data: { online: false } })
  getOrCreateBot().catch(console.error)
})
