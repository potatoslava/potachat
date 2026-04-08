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
    const { password, emailCode, emailCodeExpiry, bannedIp, lastIp, ...rest } = user
    res.json(rest)
  } catch (e) { next(e) }
})

// Update profile
router.patch('/me', auth, async (req, res, next) => {
  try {
    const { displayName, bio, username } = req.body
    
    if (displayName !== undefined) {
      const trimmed = displayName.trim()
      if (trimmed.length === 0) return res.status(400).json({ message: 'Имя не может быть пустым' })
      if (trimmed.length > 64) return res.status(400).json({ message: 'Имя слишком длинное (максимум 64 символа)' })
    }
    
    if (bio !== undefined && bio.length > 512) {
      return res.status(400).json({ message: 'О себе слишком длинное (максимум 512 символов)' })
    }
    
    if (username) {
      if (username.length < 3 || username.length > 32)
        return res.status(400).json({ message: 'Username должен быть от 3 до 32 символов' })
      if (!/^[a-zA-Z0-9_.]+$/.test(username))
        return res.status(400).json({ message: 'Username может содержать только буквы, цифры, точку и подчёркивание' })
      const exists = await prisma.user.findUnique({ where: { username } })
      if (exists && exists.id !== req.userId) return res.status(400).json({ message: 'Имя пользователя занято' })
    }
    
    const updateData = {}
    if (displayName !== undefined && displayName.trim()) {
      updateData.displayName = displayName.trim()
    }
    if (bio !== undefined) {
      updateData.bio = bio
    }
    if (username) {
      updateData.username = username
    }
    
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData
    })
    const { password, emailCode, emailCodeExpiry, bannedIp, lastIp, ...rest } = user
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
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }) // 5MB для аватарок

router.post('/me/avatar', auth, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Файл не найден' })
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: 'Только изображения' })
    
    // Проверяем размер base64 (примерно на 33% больше оригинала)
    const base64Size = Math.ceil(req.file.size * 1.37)
    if (base64Size > 7 * 1024 * 1024) { // ~7MB в base64
      return res.status(400).json({ message: 'Изображение слишком большое' })
    }
    
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { avatar: base64 }
    })
    await prisma.avatarHistory.create({ data: { userId: req.userId, avatar: base64 } })
    const { password, emailCode, emailCodeExpiry, bannedIp, lastIp, ...rest } = user
    // Уведомляем только контакты пользователя, а не всех
    const memberships = await prisma.chatMember.findMany({
      where: { userId: req.userId },
      include: { chat: { include: { members: { where: { userId: { not: req.userId } } } } } }
    })
    const contactIds = [...new Set(memberships.flatMap(m => m.chat.members.map(cm => cm.userId)))]
    const io = req.app.get('io')
    contactIds.forEach(id => {
      io.to(`user:${id}`).emit('user:avatar', { userId: user.id, avatar: base64 })
    })
    // Обновляем и себе (для других вкладок)
    io.to(`user:${req.userId}`).emit('user:avatar', { userId: user.id, avatar: base64 })
    res.json(rest)
  } catch (e) { next(e) }
})

// Get blocked users — должен быть ДО /:userId чтобы не конфликтовать
router.get('/blocked', auth, async (req, res, next) => {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.userId },
      include: { blocked: { select: { id: true, username: true, displayName: true, avatar: true } } }
    })
    res.json(blocks.map(b => b.blocked))
  } catch (e) { next(e) }
})

// Get user profile by ID
router.get('/:userId', auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, username: true, displayName: true, avatar: true, bio: true, online: true, lastSeen: true }
    })
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
    res.json(user)
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

// Delete own account
router.delete('/me', auth, async (req, res, next) => {
  try {
    // Кикаем сокет-сессию до удаления
    const io = req.app.get('io')
    const room = io.sockets.adapter.rooms.get(`user:${req.userId}`)
    if (room) {
      for (const socketId of room) {
        const s = io.sockets.sockets.get(socketId)
        if (s) s.disconnect(true)
      }
    }
    await prisma.user.delete({ where: { id: req.userId } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Отправить тикет в поддержку
router.post('/support', auth, async (req, res, next) => {
  try {
    const { message } = req.body
    if (!message?.trim()) return res.status(400).json({ message: 'Напишите сообщение' })
    if (message.length > 2048) return res.status(400).json({ message: 'Сообщение слишком длинное (максимум 2048 символов)' })
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) return res.status(404).json({ message: 'Не найдено' })
    const ticket = await prisma.supportTicket.create({
      data: { userId: req.userId, username: user.username, message }
    })
    res.json(ticket)
  } catch (e) { next(e) }
})

// Установить кастомную подпись для пользователя
router.put('/label/:userId', auth, async (req, res, next) => {
  try {
    const { label } = req.body
    if (!label || !label.trim()) {
      // Удаляем подпись если пустая
      await prisma.customLabel.deleteMany({
        where: { userId: req.userId, targetUserId: req.params.userId }
      })
      return res.json({ success: true, label: null })
    }
    if (label.length > 64) return res.status(400).json({ message: 'Подпись слишком длинная (максимум 64 символа)' })
    
    const customLabel = await prisma.customLabel.upsert({
      where: { userId_targetUserId: { userId: req.userId, targetUserId: req.params.userId } },
      create: { userId: req.userId, targetUserId: req.params.userId, label: label.trim() },
      update: { label: label.trim() }
    })
    res.json(customLabel)
  } catch (e) { next(e) }
})

// Получить все мои кастомные подписи
router.get('/labels', auth, async (req, res, next) => {
  try {
    const labels = await prisma.customLabel.findMany({
      where: { userId: req.userId },
      include: { targetUser: { select: { id: true, username: true, displayName: true, avatar: true } } }
    })
    res.json(labels)
  } catch (e) { next(e) }
})

// Получить подпись для конкретного пользователя
router.get('/label/:userId', auth, async (req, res, next) => {
  try {
    const label = await prisma.customLabel.findUnique({
      where: { userId_targetUserId: { userId: req.userId, targetUserId: req.params.userId } }
    })
    res.json(label || { label: null })
  } catch (e) { next(e) }
})

module.exports = router
