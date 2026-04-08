const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Загружаем .env файл
require('dotenv').config()

const prisma = new PrismaClient()

async function restoreDatabase(backupFile) {
  console.log('🔄 Начинаем восстановление базы данных...\n')
  
  if (!backupFile) {
    console.error('❌ Укажите файл бэкапа: node restore-database.js backup-xxxxx.json')
    process.exit(1)
  }

  const filepath = path.join(__dirname, backupFile)
  
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Файл не найден: ${filepath}`)
    process.exit(1)
  }

  try {
    const backup = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    console.log(`📅 Бэкап от: ${backup.timestamp}\n`)

    // Очищаем существующие данные (ОСТОРОЖНО!)
    console.log('⚠️  Очищаем существующие данные...')
    await prisma.messageRead.deleteMany()
    await prisma.groupInvite.deleteMany()
    await prisma.event.deleteMany()
    await prisma.supportTicket.deleteMany()
    await prisma.avatarHistory.deleteMany()
    await prisma.block.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatMember.deleteMany()
    await prisma.chat.deleteMany()
    await prisma.user.deleteMany()

    // Восстанавливаем данные
    console.log('📥 Восстанавливаем пользователей...')
    for (const user of backup.data.users) {
      await prisma.user.create({ data: user })
    }
    
    console.log('📥 Восстанавливаем чаты...')
    for (const chat of backup.data.chats) {
      await prisma.chat.create({ data: chat })
    }
    
    console.log('📥 Восстанавливаем участников чатов...')
    for (const member of backup.data.chatMembers) {
      await prisma.chatMember.create({ data: member })
    }
    
    console.log('📥 Восстанавливаем сообщения...')
    for (const message of backup.data.messages) {
      await prisma.message.create({ data: message })
    }
    
    console.log('📥 Восстанавливаем блокировки...')
    for (const block of backup.data.blocks) {
      await prisma.block.create({ data: block })
    }
    
    console.log('📥 Восстанавливаем историю аватаров...')
    for (const avatar of backup.data.avatarHistory) {
      await prisma.avatarHistory.create({ data: avatar })
    }
    
    console.log('📥 Восстанавливаем тикеты поддержки...')
    for (const ticket of backup.data.supportTickets) {
      await prisma.supportTicket.create({ data: ticket })
    }
    
    console.log('📥 Восстанавливаем ивенты...')
    for (const event of backup.data.events) {
      await prisma.event.create({ data: event })
    }
    
    console.log('📥 Восстанавливаем приглашения в группы...')
    for (const invite of backup.data.groupInvites) {
      await prisma.groupInvite.create({ data: invite })
    }
    
    console.log('📥 Восстанавливаем прочитанные сообщения...')
    for (const read of backup.data.messageReads) {
      await prisma.messageRead.create({ data: read })
    }

    console.log('\n✅ Восстановление завершено!')
    
  } catch (error) {
    console.error('❌ Ошибка при восстановлении:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

const backupFile = process.argv[2]
restoreDatabase(backupFile)
  .then(() => {
    console.log('\n🎉 Готово!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error)
    process.exit(1)
  })
