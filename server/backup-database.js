const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Загружаем .env файл
require('dotenv').config()

const prisma = new PrismaClient()

async function backupDatabase() {
  console.log('🔄 Начинаем бэкап базы данных...\n')
  
  const backup = {
    timestamp: new Date().toISOString(),
    data: {}
  }

  try {
    // Экспортируем все таблицы
    console.log('📦 Экспортируем пользователей...')
    backup.data.users = await prisma.user.findMany()
    
    console.log('📦 Экспортируем чаты...')
    backup.data.chats = await prisma.chat.findMany()
    
    console.log('📦 Экспортируем участников чатов...')
    backup.data.chatMembers = await prisma.chatMember.findMany()
    
    console.log('📦 Экспортируем сообщения...')
    backup.data.messages = await prisma.message.findMany()
    
    console.log('📦 Экспортируем блокировки...')
    backup.data.blocks = await prisma.block.findMany()
    
    console.log('📦 Экспортируем историю аватаров...')
    backup.data.avatarHistory = await prisma.avatarHistory.findMany()
    
    console.log('📦 Экспортируем тикеты поддержки...')
    backup.data.supportTickets = await prisma.supportTicket.findMany()
    
    console.log('📦 Экспортируем ивенты...')
    backup.data.events = await prisma.event.findMany()
    
    console.log('📦 Экспортируем приглашения в группы...')
    backup.data.groupInvites = await prisma.groupInvite.findMany()
    
    console.log('📦 Экспортируем прочитанные сообщения...')
    backup.data.messageReads = await prisma.messageRead.findMany()

    // Сохраняем в файл
    const filename = `backup-${Date.now()}.json`
    const filepath = path.join(__dirname, filename)
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2))
    
    console.log(`\n✅ Бэкап успешно создан: ${filename}`)
    console.log(`📊 Статистика:`)
    console.log(`   - Пользователей: ${backup.data.users.length}`)
    console.log(`   - Чатов: ${backup.data.chats.length}`)
    console.log(`   - Сообщений: ${backup.data.messages.length}`)
    console.log(`   - Размер файла: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`)
    
  } catch (error) {
    console.error('❌ Ошибка при создании бэкапа:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backupDatabase()
  .then(() => {
    console.log('\n🎉 Готово!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error)
    process.exit(1)
  })
