const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const { createWelcomeChat } = require('../bot')
const { sendVerificationCode } = require('../mailer')

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'CocoDack_secret_key'

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, displayName, password, email } = req.body
    if (!username || !displayName || !password || !email)
      return res.status(400).json({ message: 'Заполните все поля' })
    if (username.length < 3 || username.length > 32)
      return res.status(400).json({ message: 'Username должен быть от 3 до 32 символов' })
    if (!/^[a-zA-Z0-9_.]+$/.test(username))
      return res.status(400).json({ message: 'Username может содержать только буквы, цифры, точку и подчёркивание' })
    if (displayName.trim().length < 1 || displayName.trim().length > 64)
      return res.status(400).json({ message: 'Отображаемое имя должно быть от 1 до 64 символов' })
    if (password.length < 6)
      return res.status(400).json({ message: 'Пароль должен быть не менее 6 символов' })

    const exists = await prisma.user.findUnique({ where: { username } })
    if (exists) return res.status(400).json({ message: 'Пользователь уже существует' })

    const emailExists = await prisma.user.findUnique({ where: { email } })
    if (emailExists) return res.status(400).json({ message: 'Email уже используется' })

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null
    const hashed = await bcrypt.hash(password, 10)
    const code = generateCode()

    const user = await prisma.user.create({
      data: { username, displayName, password: hashed, email, emailCode: code, lastIp: ip }
    })

    try {
      await sendVerificationCode(email, code)
    } catch (e) {
      console.error('Email send error:', e.message)
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
      return res.status(500).json({ message: 'Не удалось отправить письмо: ' + e.message })
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET)
    createWelcomeChat(user.id).catch(console.error)
    res.json({ user: sanitize(user), token, needVerification: true })
  } catch (e) { next(e) }
})

router.post('/verify-email', async (req, res, next) => {
  try {
    const { userId, code } = req.body
    if (!userId || !code) return res.status(400).json({ message: 'Укажите userId и code' })
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Неверный формат кода' })
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
    if (user.emailVerified) return res.json({ success: true })
    if (user.emailCode !== code) return res.status(400).json({ message: 'Неверный код' })
    await prisma.user.update({ where: { id: userId }, data: { emailVerified: true, emailCode: null } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

router.post('/resend-code', async (req, res, next) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ message: 'Укажите userId' })
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.email) return res.status(404).json({ message: 'Не найдено' })
    if (user.emailVerified) return res.json({ success: true })
    const code = generateCode()
    await prisma.user.update({ where: { id: userId }, data: { emailCode: code } })
    try {
      await sendVerificationCode(user.email, code)
    } catch (e) {
      console.error('Email send error:', e.message)
      return res.status(500).json({ message: 'Не удалось отправить письмо' })
    }
    res.json({ success: true })
  } catch (e) { next(e) }
})

// Привязать email к существующему аккаунту и отправить код
router.post('/send-verification', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' })
    let payload
    try {
      payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
    } catch {
      return res.status(401).json({ message: 'Invalid token' })
    }
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Укажите email' })

    const emailExists = await prisma.user.findFirst({ where: { email, NOT: { id: payload.userId } } })
    if (emailExists) return res.status(400).json({ message: 'Email уже используется' })

    const code = generateCode()
    await prisma.user.update({ where: { id: payload.userId }, data: { email, emailCode: code } })
    try {
      await sendVerificationCode(email, code)
    } catch (e) {
      console.error('Email send error:', e.message)
      return res.status(500).json({ message: 'Не удалось отправить письмо: ' + e.message })
    }
    res.json({ success: true })
  } catch (e) { next(e) }
})

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ message: 'Заполните все поля' })

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return res.status(400).json({ message: 'Пользователь не найден' })

    if (user.banned) return res.status(403).json({ message: 'Аккаунт заблокирован администратором' })
    if (user.frozen) return res.status(403).json({ message: 'Аккаунт заморожен. Обратитесь в поддержку' })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(400).json({ message: 'Неверный пароль' })

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null
    await prisma.user.update({ where: { id: user.id }, data: { lastIp: ip } })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET)
    createWelcomeChat(user.id).catch(console.error)

    res.json({ user: sanitize(user), token, needVerification: !user.emailVerified })
  } catch (e) { next(e) }
})

function sanitize(u) {
  const { password, emailCode, ...rest } = u
  return rest
}

module.exports = router
