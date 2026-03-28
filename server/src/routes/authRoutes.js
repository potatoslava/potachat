const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const { createWelcomeChat } = require('../bot')
const { sendVerificationCode } = require('../mailer')

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'CocoDack_secret_key'
// v2

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

router.post('/register', async (req, res) => {
  const { username, displayName, password, email } = req.body
  if (!username || !displayName || !password || !email)
    return res.status(400).json({ message: 'Заполните все поля' })

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
    return res.status(500).json({ message: 'Не удалось отправить письмо: ' + e.message })
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET)
  createWelcomeChat(user.id).catch(console.error)
  res.json({ user: sanitize(user), token, needVerification: true })
})

router.post('/verify-email', async (req, res) => {
  const { userId, code } = req.body
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
  if (user.emailVerified) return res.json({ success: true })
  if (user.emailCode !== code) return res.status(400).json({ message: 'Неверный код' })

  await prisma.user.update({ where: { id: userId }, data: { emailVerified: true, emailCode: null } })
  res.json({ success: true })
})

router.post('/resend-code', async (req, res) => {
  const { userId } = req.body
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.email) return res.status(404).json({ message: 'Не найдено' })
  if (user.emailVerified) return res.json({ success: true })

  const code = generateCode()
  await prisma.user.update({ where: { id: userId }, data: { emailCode: code } })
  await sendVerificationCode(user.email, code)
  res.json({ success: true })
})

// Привязать email к существующему аккаунту и отправить код
router.post('/send-verification', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' })
  const jwt = require('jsonwebtoken')
  const payload = jwt.verify(auth.slice(7), JWT_SECRET)
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
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) return res.status(400).json({ message: 'Пользователь не найден' })

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(400).json({ message: 'Неверный пароль' })

  if (user.banned) return res.status(403).json({ message: 'Аккаунт заблокирован администратором' })
  if (user.frozen) return res.status(403).json({ message: 'Аккаунт заморожен. Обратитесь в поддержку' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null
  await prisma.user.update({ where: { id: user.id }, data: { lastIp: ip } })

  const token = jwt.sign({ userId: user.id }, JWT_SECRET)
  createWelcomeChat(user.id).catch(console.error)

  res.json({
    user: sanitize(user),
    token,
    needVerification: !user.emailVerified
  })
})

function sanitize(u) {
  const { password, emailCode, ...rest } = u
  return rest
}

module.exports = router
