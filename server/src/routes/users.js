const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')
const multer = require('multer')

const prisma = new PrismaClient()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })

// Get my profile
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) return res.status(404).json({ message: 'Не найдено' })
    const { password, emailCode, ...rest } = user
    res.json(rest)
  } catch (e) { next(e) }
})

// Update profile
router.patch('/me', auth, async (req, res, next) => {
  try {
    const { displayName, bio, username } = req.body
    if (username) {
      if (username.length < 3 || username.length > 32)
        return res.status(400).json({ message: 'Username должен быть от 3 до 32 символов' })
      if (!/^[a-zA-Z0-9_.]+$/.test(username))
        return res.status(400).json({ message: 'Username может содержать только буквы, цифры, точку и подчёркивание' })
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
    const { password, emailCode, ...rest } = user
    res.json(rest)
  } catch (e) { next(e) }
})

// Change password
router.patch('/me/password', auth, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Заполните все поля' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'Новый пароль должен быть не менее 6 символов' })
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) return res.status(404).json({ message: 'Не найдено' })
    const bcrypt = require('bcryptjs')
    const ok = await bcrypt.compare(oldPassword, user.password)
    if (!ok) return res.status(400).json({ message: 'Неверный текущий пароль' })
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Upload avatar
router.post('/me/avatar', auth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Файл не найден' })
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: 'Только изображения' })
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { avatar: base64 }
    })
    await prisma.avatarHistory.create({ data: { userId: req.userId, avatar: base64 } })
    const { password, emailCode, ...rest } = user
    req.app.get('io').emit('user:avatar', { userId: user.id, avatar: base64 })
    res.json(rest)
  } catch (e) { next(e) }
})

// Get blocked users — должен быть ДО /:userId/avatars чтобы не конфликтовать
router.get('/blocked', auth, async (req, res, next) => {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.userId },
      include: { blocked: { select: { id: true, username: true, displayName: true, avatar: true } } }
    })
    res.json(blocks.map(b => b.blocked))
  } catch (e) { next(e) }
})

// История аватаров пользователя
router.get('/:userId/avatars', auth, async (req, res, next) => {
  try {
    const history = await prisma.avatarHistory.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' }
    })
    res.json(history)
  } catch (e) { next(e) }
})

// Block user
router.post('/block/:userId', auth, async (req, res, next) => {
  try {
    if (req.params.userId === req.userId) return res.status(400).json({ message: 'Нельзя заблокировать себя' })
    const existing = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: req.userId, blockedId: req.params.userId } }
    })
    if (existing) return res.status(400).json({ message: 'Уже заблокирован' })
    await prisma.block.create({ data: { blockerId: req.userId, blockedId: req.params.userId } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Unblock user
router.delete('/block/:userId', auth, async (req, res, next) => {
  try {
    await prisma.block.deleteMany({
      where: { blockerId: req.userId, blockedId: req.params.userId }
    })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Отправить тикет в поддержку
router.post('/support', auth, async (req, res, next) => {
  try {
    const { message } = req.body
    if (!message?.trim()) return res.status(400).json({ message: 'Напишите сообщение' })
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) return res.status(404).json({ message: 'Не найдено' })
    const ticket = await prisma.supportTicket.create({
      data: { userId: req.userId, username: user.username, message }
    })
    res.json(ticket)
  } catch (e) { next(e) }
})

module.exports = router
