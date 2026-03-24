const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const { createWelcomeChat } = require('../bot')

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'CocoDack_secret_key'

router.post('/register', async (req, res) => {
  const { username, displayName, password } = req.body
  if (!username || !displayName || !password)
    return res.status(400).json({ message: 'Заполните все поля' })

  const exists = await prisma.user.findUnique({ where: { username } })
  if (exists) return res.status(400).json({ message: 'Пользователь уже существует' })

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { username, displayName, password: hashed }
  })

  const token = jwt.sign({ userId: user.id }, JWT_SECRET)

  // Create welcome chat with CocoDackBot
  createWelcomeChat(user.id).catch(console.error)

  res.json({ user: sanitize(user), token })
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) return res.status(400).json({ message: 'Пользователь не найден' })

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(400).json({ message: 'Неверный пароль' })

  const token = jwt.sign({ userId: user.id }, JWT_SECRET)

  // Create welcome chat if not exists yet
  createWelcomeChat(user.id).catch(console.error)

  res.json({ user: sanitize(user), token })
})

function sanitize(u) {
  const { password, ...rest } = u
  return rest
}

module.exports = router
