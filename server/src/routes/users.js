const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')
const multer = require('multer')

const prisma = new PrismaClient()

// Храним в памяти, не на диске — потом сохраняем как base64 в БД
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })

// Get my profile
router.get('/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ message: 'Не найдено' })
  const { password, ...rest } = user
  res.json(rest)
})

// Update profile
router.patch('/me', auth, async (req, res) => {
  const { displayName, bio, username } = req.body
  if (username) {
    const exists = await prisma.user.findUnique({ where: { username } })
    if (exists && exists.id !== req.userId) return res.status(400).json({ message: 'Имя пользователя занято' })
  }
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(displayName && { displayName }),
      ...(bio !== undefined && { bio }),
      ...(username && { username })
    }
  })
  const { password, ...rest } = user
  res.json(rest)
})

// Change password
router.patch('/me/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ message: 'Не найдено' })
  const bcrypt = require('bcryptjs')
  const ok = await bcrypt.compare(oldPassword, user.password)
  if (!ok) return res.status(400).json({ message: 'Неверный текущий пароль' })
  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } })
  res.json({ success: true })
})

// Upload avatar — сохраняем как base64 data URL прямо в БД
router.post('/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не найден' })
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatar: base64 }
  })
  // Сохраняем в историю аватаров
  await prisma.avatarHistory.create({ data: { userId: req.userId, avatar: base64 } })
  const { password, ...rest } = user
  req.app.get('io').emit('user:avatar', { userId: user.id, avatar: base64 })
  res.json(rest)
})

// История аватаров пользователя
router.get('/:userId/avatars', auth, async (req, res) => {
  const history = await prisma.avatarHistory.findMany({
    where: { userId: req.params.userId },
    orderBy: { createdAt: 'desc' }
  })
  res.json(history)
})

// Block user
router.post('/block/:userId', auth, async (req, res) => {
  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: req.userId, blockedId: req.params.userId } }
  })
  if (existing) return res.status(400).json({ message: 'Уже заблокирован' })
  await prisma.block.create({ data: { blockerId: req.userId, blockedId: req.params.userId } })
  res.json({ success: true })
})

// Unblock user
router.delete('/block/:userId', auth, async (req, res) => {
  await prisma.block.deleteMany({
    where: { blockerId: req.userId, blockedId: req.params.userId }
  })
  res.json({ success: true })
})

// Get blocked users
router.get('/blocked', auth, async (req, res) => {
  const blocks = await prisma.block.findMany({
    where: { blockerId: req.userId },
    include: { blocked: { select: { id: true, username: true, displayName: true, avatar: true } } }
  })
  res.json(blocks.map(b => b.blocked))
})

// Отправить тикет в поддержку
router.post('/support', auth, async (req, res) => {
  const { message } = req.body
  if (!message?.trim()) return res.status(400).json({ message: 'Напишите сообщение' })
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ message: 'Не найдено' })
  const ticket = await prisma.supportTicket.create({
    data: { userId: req.userId, username: user.username, message }
  })
  res.json(ticket)
})

module.exports = router
