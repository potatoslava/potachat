const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function importData(filename) {
  try {
    console.log(`📦 Импорт данных из ${filename}...`)
    
    if (!fs.existsSync(filename)) {
      console.error(`❌ Файл ${filename} не найден`)
      return
    }
    
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'))
    
    // Импортируем в правильном порядке (с учётом зависимостей)
    console.log('👥 Импорт пользователей...')
    for (const user of data.users) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: user,
        create: user,
      })
    }
    
    console.log('💬 Импорт чатов...')
    for (const chat of data.chats) {
      await prisma.chat.upsert({
        where: { id: chat.id },
        update: chat,
        create: chat,
      })
    }
    
    console.log('👤 Импорт участников чатов...')
    for (const member of data.chatMembers) {
      await prisma.chatMember.upsert({
        where: { id: member.id },
        update: member,
        create: member,
      })
    }
    
    console.log('📨 Импорт сообщений...')
    for (const message of data.messages) {
      await prisma.message.upsert({
        where: { id: message.id },
        update: message,
        create: message,
      })
    }
    
    console.log('🚫 Импорт блокировок...')
    for (const block of data.blocks) {
      await prisma.block.upsert({
        where: { id: block.id },
        update: block,
        create: block,
      })
    }
    
    console.log('🖼️ Импорт истории аватаров...')
    for (const avatar of data.avatarHistory) {
      await prisma.avatarHistory.upsert({
        where: { id: avatar.id },
        update: avatar,
        create: avatar,
      })
    }
    
    console.log('📢 Импорт событий...')
    for (const event of data.events) {
      await prisma.event.upsert({
        where: { id: event.id },
        update: event,
        create: event,
      })
    }
    
    console.log('🎫 Импорт тикетов поддержки...')
    for (const ticket of data.supportTickets) {
      await prisma.supportTicket.upsert({
        where: { id: ticket.id },
        update: ticket,
        create: ticket,
      })
    }
    
    console.log('✅ Импорт прочитанных сообщений...')
    for (const read of data.messageReads) {
      await prisma.messageRead.upsert({
        where: { id: read.id },
        update: read,
        create: read,
      })
    }
    
    console.log('📩 Импорт приглашений...')
    for (const invite of data.groupInvites) {
      await prisma.groupInvite.upsert({
        where: { id: invite.id },
        update: invite,
        create: invite,
      })
    }
    
    console.log('🏷️ Импорт подписей...')
    for (const label of data.customLabels) {
      await prisma.customLabel.upsert({
        where: { id: label.id },
        update: label,
        create: label,
      })
    }
    
    console.log('✅ Импорт завершён!')
    console.log(`📊 Импортировано:`)
    console.log(`   Пользователи: ${data.users.length}`)
    console.log(`   Чаты: ${data.chats.length}`)
    console.log(`   Сообщения: ${data.messages.length}`)
    
  } catch (error) {
    console.error('❌ Ошибка импорта:', error)
  } finally {
    await prisma.$disconnect()
  }
}

const filename = process.argv[2] || 'backup.json'
importData(filename)
