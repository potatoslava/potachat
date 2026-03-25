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
  const { displayName, bio } = req.body
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { ...(displayName && { displayName }), ...(bio !== undefined && { bio }) }
  })
  const { password, ...rest } = user
  res.json(rest)
})

// Upload avatar — сохраняем как base64 data URL прямо в БД
router.post('/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не найден' })
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatar: base64 }
  })
  const { password, ...rest } = user
  req.app.get('io').emit('user:avatar', { userId: user.id, avatar: base64 })
  res.json(rest)
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

module.exports = router
