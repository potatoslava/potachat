const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const BOT_USERNAME = 'CocoDackBot'
const BOT_DISPLAY = 'CocoDack'
const BOT_WELCOME = `👋 Привет! Я CocoDackBot — официальный бот мессенджера CocoDack.

Здесь ты можешь:
• Создавать личные чаты с друзьями
• Создавать группы и каналы
• Отправлять файлы, фото и видео

Приятного общения! 🚀`

async function getOrCreateBot() {
  let bot = await prisma.user.findUnique({ where: { username: BOT_USERNAME } })
  if (!bot) {
    const password = await bcrypt.hash('bot_secret_password_123', 10)
    bot = await prisma.user.create({
      data: { username: BOT_USERNAME, displayName: BOT_DISPLAY, password, online: true }
    })
    console.log('CocoDackBot created')
  }
  return bot
}

async function createWelcomeChat(userId) {
  const bot = await getOrCreateBot()

  // Check if already exists
  const existing = await prisma.chat.findFirst({
    where: {
      type: 'private',
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: bot.id } } }
      ]
    }
  })
  if (existing) return

  const chat = await prisma.chat.create({
    data: {
      type: 'private',
      name: `${userId}-${bot.id}`,
      members: { create: [{ userId }, { userId: bot.id }] }
    }
  })

  await prisma.message.create({
    data: { chatId: chat.id, senderId: bot.id, text: BOT_WELCOME }
  })
}

module.exports = { getOrCreateBot, createWelcomeChat }
