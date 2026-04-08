const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function exportData() {
  try {
    console.log('📦 Экспорт данных...')
    
    const data = {
      users: await prisma.user.findMany(),
      chats: await prisma.chat.findMany(),
      chatMembers: await prisma.chatMember.findMany(),
      messages: await prisma.message.findMany(),
      blocks: await prisma.block.findMany(),
      avatarHistory: await prisma.avatarHistory.findMany(),
      events: await prisma.event.findMany(),
      supportTickets: await prisma.supportTicket.findMany(),
      messageReads: await prisma.messageRead.findMany(),
      groupInvites: await prisma.groupInvite.findMany(),
      customLabels: await prisma.customLabel.findMany(),
    }
    
    const filename = `backup-${new Date().toISOString().replace(/:/g, '-')}.json`
    fs.writeFileSync(filename, JSON.stringify(data, null, 2))
    
    console.log(`✅ Данные экспортированы в ${filename}`)
    console.log(`📊 Статистика:`)
    console.log(`   Пользователи: ${data.users.length}`)
    console.log(`   Чаты: ${data.chats.length}`)
    console.log(`   Сообщения: ${data.messages.length}`)
    
  } catch (error) {
    console.error('❌ Ошибка экспорта:', error)
  } finally {
    await prisma.$disconnect()
  }
}

exportData()
