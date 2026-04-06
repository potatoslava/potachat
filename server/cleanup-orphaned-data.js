// Загружаем переменные окружения из .env файла
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = value
    }
  })
  console.log('✅ Переменные окружения загружены из .env\n')
} else {
  console.warn('⚠️  Файл .env не найден, используются системные переменные окружения\n')
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanupOrphanedData() {
  console.log('🧹 Начинаем очистку базы данных от потерянных записей...\n')

  try {
    // 1. Находим все userId которые используются в разных таблицах
    const chatMembers = await prisma.chatMember.findMany({ select: { userId: true } })
    const messages = await prisma.message.findMany({ select: { senderId: true } })
    const blocks = await prisma.block.findMany({ select: { blockerId: true, blockedId: true } })
    const avatarHistory = await prisma.avatarHistory.findMany({ select: { userId: true } })
    const supportTickets = await prisma.supportTicket.findMany({ select: { userId: true } })
    const messageReads = await prisma.messageRead.findMany({ select: { userId: true } })

    // Собираем все уникальные userId
    const usedUserIds = new Set([
      ...chatMembers.map(m => m.userId),
      ...messages.map(m => m.senderId),
      ...blocks.map(b => b.blockerId),
      ...blocks.map(b => b.blockedId),
      ...avatarHistory.map(a => a.userId),
      ...supportTickets.map(t => t.userId),
      ...messageReads.map(r => r.userId)
    ])

    console.log(`📊 Найдено ${usedUserIds.size} уникальных userId в связанных таблицах`)

    // 2. Проверяем какие из них не существуют в таблице User
    const existingUsers = await prisma.user.findMany({ select: { id: true } })
    const existingUserIds = new Set(existingUsers.map(u => u.id))

    const orphanedUserIds = [...usedUserIds].filter(id => !existingUserIds.has(id))

    if (orphanedUserIds.length === 0) {
      console.log('✅ Потерянных записей не найдено! База данных чистая.\n')
      return
    }

    console.log(`⚠️  Найдено ${orphanedUserIds.length} потерянных userId:\n`)
    orphanedUserIds.forEach(id => console.log(`   - ${id}`))
    console.log('')

    // 3. Удаляем потерянные записи
    let deletedCount = 0

    // ChatMember
    const deletedChatMembers = await prisma.chatMember.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    console.log(`🗑️  Удалено ${deletedChatMembers.count} записей из ChatMember`)
    deletedCount += deletedChatMembers.count

    // Message
    const deletedMessages = await prisma.message.deleteMany({
      where: { senderId: { in: orphanedUserIds } }
    })
    console.log(`🗑️  Удалено ${deletedMessages.count} записей из Message`)
    deletedCount += deletedMessages.count

    // Block
    const deletedBlocks = await prisma.block.deleteMany({
      where: {
        OR: [
          { blockerId: { in: orphanedUserIds } },
          { blockedId: { in: orphanedUserIds } }
        ]
      }
    })
    console.log(`🗑️  Удалено ${deletedBlocks.count} записей из Block`)
    deletedCount += deletedBlocks.count

    // AvatarHistory
    const deletedAvatars = await prisma.avatarHistory.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    console.log(`🗑️  Удалено ${deletedAvatars.count} записей из AvatarHistory`)
    deletedCount += deletedAvatars.count

    // SupportTicket
    const deletedTickets = await prisma.supportTicket.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    console.log(`🗑️  Удалено ${deletedTickets.count} записей из SupportTicket`)
    deletedCount += deletedTickets.count

    // MessageRead
    const deletedReads = await prisma.messageRead.deleteMany({
      where: { userId: { in: orphanedUserIds } }
    })
    console.log(`🗑️  Удалено ${deletedReads.count} записей из MessageRead`)
    deletedCount += deletedReads.count

    // 4. Удаляем пустые чаты (без участников)
    const emptyChats = await prisma.chat.findMany({
      where: { members: { none: {} } },
      select: { id: true }
    })

    if (emptyChats.length > 0) {
      const deletedChats = await prisma.chat.deleteMany({
        where: { id: { in: emptyChats.map(c => c.id) } }
      })
      console.log(`🗑️  Удалено ${deletedChats.count} пустых чатов`)
      deletedCount += deletedChats.count
    }

    console.log(`\n✅ Очистка завершена! Всего удалено ${deletedCount} потерянных записей.\n`)

  } catch (error) {
    console.error('❌ Ошибка при очистке:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем скрипт
cleanupOrphanedData()
  .then(() => {
    console.log('🎉 Скрипт успешно выполнен!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Скрипт завершился с ошибкой:', error)
    process.exit(1)
  })
