const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')

const prisma = new PrismaClient()

// Get my pending invites
router.get('/', auth, async (req, res, next) => {
  try {
    const invites = await prisma.groupInvite.findMany({
      where: { inviteeId: req.userId, status: 'pending' },
      include: {
        chat: { select: { id: true, name: true, avatar: true, type: true } },
        inviter: { select: { id: true, displayName: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(invites.map(inv => ({
      id: inv.id,
      chatId: inv.chat.id,
      chatName: inv.chat.name,
      chatAvatar: inv.chat.avatar,
      chatType: inv.chat.type,
      inviterName: inv.inviter.displayName,
      inviterAvatar: inv.inviter.avatar,
      createdAt: inv.createdAt
    })))
  } catch (e) { next(e) }
})

// Accept invite
router.post('/:inviteId/accept', auth, async (req, res, next) => {
  try {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: req.params.inviteId },
      include: { chat: { include: { members: { include: { user: true } } } } }
    })

    if (!invite) return res.status(404).json({ message: 'Приглашение не найдено' })
    if (invite.inviteeId !== req.userId) return res.status(403).json({ message: 'Нет доступа' })
    if (invite.status !== 'pending') return res.status(400).json({ message: 'Приглашение уже обработано' })

    // Проверяем что пользователь ещё не в группе
    const existing = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: invite.chatId, userId: req.userId } }
    })
    if (existing) {
      await prisma.groupInvite.update({
        where: { id: req.params.inviteId },
        data: { status: 'accepted' }
      })
      return res.status(400).json({ message: 'Вы уже в этой группе' })
    }

    // Добавляем в группу
    const newMember = await prisma.chatMember.create({
      data: { chatId: invite.chatId, userId: req.userId, role: 'member' },
      include: { user: true }
    })

    // Обновляем статус приглашения
    await prisma.groupInvite.update({
      where: { id: req.params.inviteId },
      data: { status: 'accepted' }
    })

    const memberData = {
      id: newMember.user.id,
      username: newMember.user.username,
      displayName: newMember.user.displayName,
      avatar: newMember.user.avatar,
      online: newMember.user.online,
      role: 'member'
    }

    // Уведомляем участников группы
    req.app.get('io').to(`chat:${invite.chatId}`).emit('chat:member_add', {
      chatId: invite.chatId,
      member: memberData
    })

    // Отправляем чат новому участнику
    req.app.get('io').to(`user:${req.userId}`).emit('chat:joined', {
      id: invite.chat.id,
      type: invite.chat.type,
      name: invite.chat.name,
      avatar: invite.chat.avatar,
      description: invite.chat.description,
      lastMessage: null,
      unreadCount: 0,
      myRole: 'member',
      members: [
        ...invite.chat.members.map(m => ({
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName,
          avatar: m.user.avatar,
          online: m.user.online,
          role: m.role
        })),
        memberData
      ],
      createdAt: invite.chat.createdAt
    })

    res.json({ success: true })
  } catch (e) { next(e) }
})

// Decline invite
router.post('/:inviteId/decline', auth, async (req, res, next) => {
  try {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: req.params.inviteId }
    })

    if (!invite) return res.status(404).json({ message: 'Приглашение не найдено' })
    if (invite.inviteeId !== req.userId) return res.status(403).json({ message: 'Нет доступа' })
    if (invite.status !== 'pending') return res.status(400).json({ message: 'Приглашение уже обработано' })

    await prisma.groupInvite.update({
      where: { id: req.params.inviteId },
      data: { status: 'declined' }
    })

    res.json({ success: true })
  } catch (e) { next(e) }
})

// Cancel invite (for inviter or group admin)
router.delete('/:inviteId', auth, async (req, res, next) => {
  try {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: req.params.inviteId },
      include: { chat: true }
    })

    if (!invite) return res.status(404).json({ message: 'Приглашение не найдено' })

    // Проверяем права: либо отправитель, либо админ/владелец группы
    const isInviter = invite.inviterId === req.userId
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: invite.chatId, userId: req.userId } }
    })
    const isAdmin = member && ['owner', 'admin'].includes(member.role)

    if (!isInviter && !isAdmin) {
      return res.status(403).json({ message: 'Нет доступа' })
    }

    await prisma.groupInvite.delete({ where: { id: req.params.inviteId } })

    // Уведомляем приглашённого что приглашение отменено
    req.app.get('io').to(`user:${invite.inviteeId}`).emit('group:invite_cancelled', {
      inviteId: req.params.inviteId
    })

    res.json({ success: true })
  } catch (e) { next(e) }
})

module.exports = router
