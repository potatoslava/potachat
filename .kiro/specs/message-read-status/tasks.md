# Implementation Plan: Message Read Status

## Overview

Реализация системы статусов прочтения сообщений для CocoDack. Порядок: БД → сервис → socket → REST API → клиентские типы → стор → UI.

## Tasks

- [x] 1. БД: добавить модель MessageRead в Prisma-схему
  - Добавить модель `MessageRead` в `server/prisma/schema.prisma` с полями `id`, `messageId`, `userId`, `readAt` и уникальным индексом `@@unique([messageId, userId])`
  - Добавить relation `reads MessageRead[]` в модель `Message`
  - Добавить relation `messageReads MessageRead[]` в модель `User`
  - Добавить `onDelete: Cascade` на оба foreign key
  - _Requirements: 1.1, 1.2, 6.2_

- [-] 2. БД: создать и применить миграцию
  - Выполнить `npx prisma migrate dev --name add_message_read_status` для генерации SQL-миграции
  - Убедиться, что таблица `MessageRead` создана с уникальным индексом и каскадным удалением
  - _Requirements: 1.1, 6.2_

- [ ] 3. Сервер: реализовать ReadStatus_Service
  - [ ] 3.1 Создать `server/src/services/readStatus.js` с функцией `markMessagesAsRead(prisma, chatId, userId)`
    - Получить все сообщения чата, где `senderId !== userId` и нет записи `MessageRead` для данного `userId`
    - Выполнить batch upsert через `prisma.$transaction` (атомарность)
    - Вернуть массив `[{ messageId, senderId }]` для уведомления отправителей
    - _Requirements: 1.2, 1.3, 5.3, 5.4, 6.3_

  - [ ] 3.2 Добавить функцию `getReadCount(prisma, messageId)` в тот же файл
    - Считать уникальные `userId` в `MessageRead` для данного `messageId`
    - Фильтровать только текущих членов чата через JOIN с `ChatMember`
    - _Requirements: 1.4, 6.1_

  - [ ] 3.3 Написать property-тест для идемпотентности markMessagesAsRead
    - **Property 1: Идемпотентность пометки прочтения**
    - Вызвать `markMessagesAsRead` дважды, проверить что `MessageRead.count = 1` и `readAt` не изменился
    - Генераторы: `fc.uuid()` для `messageId`, `userId`
    - **Validates: Requirements 1.2, 5.5**

  - [ ] 3.4 Написать property-тест для полноты пакетной пометки
    - **Property 2: Полнота пакетной пометки**
    - После `markMessagesAsRead(chatId, userId)` каждое чужое сообщение в чате имеет запись `MessageRead`
    - Генераторы: `fc.array(fc.record({ senderId: fc.uuid(), content: fc.string() }))`
    - **Validates: Requirements 1.3, 5.3**

  - [ ] 3.5 Написать property-тест для round-trip записи MessageRead
    - **Property 3: Round-trip записи MessageRead**
    - Записать `MessageRead`, прочитать из БД, сравнить `messageId`, `userId`, `readAt`
    - Генераторы: `fc.record({ messageId: fc.uuid(), userId: fc.uuid() })`
    - **Validates: Requirements 1.5**

  - [ ] 3.6 Написать property-тест для корректности счётчика прочитавших
    - **Property 4: Корректность счётчика прочитавших**
    - Создать N записей `MessageRead`, проверить `getReadCount(messageId) === N`
    - Генераторы: `fc.integer({ min: 1, max: 20 })`
    - **Validates: Requirements 1.4, 6.1**

  - [ ] 3.7 Написать property-тест для исключения записей отправителя
    - **Property 12: Исключение записей для отправителя**
    - `markMessagesAsRead` не создаёт `MessageRead` для сообщений, где `senderId === userId`
    - Генераторы: `fc.uuid()` для общего `userId`, массив сообщений с `senderId === userId`
    - **Validates: Requirements 6.3**

  - [ ] 3.8 Написать property-тест для атомарности пакетной пометки
    - **Property 10: Атомарность пакетной пометки**
    - При ошибке БД в середине транзакции — `MessageRead.count === 0`
    - Мок ошибки через `prisma.$transaction` rejection
    - **Validates: Requirements 5.4**

  - [ ] 3.9 Написать property-тест для каскадного удаления
    - **Property 11: Каскадное удаление записей MessageRead**
    - После удаления сообщения `MessageRead.count({ where: { messageId } }) === 0`
    - Генераторы: `fc.uuid()` для `messageId`
    - **Validates: Requirements 6.2**

- [ ] 4. Checkpoint — убедиться что все тесты сервиса проходят
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Сервер: добавить socket-обработчик chat:open
  - В `server/src/index.js` добавить `socket.on('chat:open', async ({ chatId }) => { ... })`
  - Проверить членство пользователя в чате перед обработкой (игнорировать не-членов)
  - Вызвать `ReadStatus_Service.markMessagesAsRead(prisma, chatId, socket.userId)`
  - Для каждого затронутого отправителя вызвать `getReadCount` и отправить `io.to('user:${senderId}').emit('message:read', { messageId, chatId, readCount })`
  - _Requirements: 4.1, 5.2, 5.3, 6.5_

- [ ] 6. Сервер: обновить REST API GET /chats/:chatId/messages
  - В `server/src/routes/chats.js` обновить запрос `findMany` — добавить `_count: { select: { reads: true } }`
  - Обновить функцию `formatMessage`: добавить вычисление `read` (личный: `readCount >= 1`, групповой: `readCount >= totalMembers - 1`) и поле `readCount`
  - _Requirements: 5.1, 2.1, 3.3_

  - [ ] 6.1 Написать property-тест для консистентности API-ответа
    - **Property 9: Консистентность API-ответа со статусом прочтения**
    - Поле `read` в ответе API соответствует фактическому числу записей `MessageRead` в БД
    - Генераторы: `fc.array(fc.uuid())` для набора читателей
    - **Validates: Requirements 5.1**

- [ ] 7. Клиент: обновить типы
  - В `client/src/types/index.ts` добавить `readCount?: number` в интерфейс `Message`
  - _Requirements: 4.2_

- [ ] 8. Клиент: добавить action в chatStore
  - В `client/src/store/chatStore.ts` добавить action `updateMessageReadStatus(chatId, messageId, readCount)`
  - Найти сообщение по `messageId` в `messages[chatId]`, обновить `readCount`
  - Пересчитать `read`: для личного чата `readCount >= 1`, для группового `readCount >= chat.members.length - 1`
  - _Requirements: 4.2, 4.3_

  - [ ] 8.1 Написать property-тест для обновления стора при получении message:read
    - **Property 8: Обновление стора при получении message:read**
    - После `updateMessageReadStatus(chatId, messageId, readCount)` стор содержит обновлённые `readCount` и пересчитанный `read`
    - Генераторы: `fc.record({ messageId: fc.uuid(), chatId: fc.uuid(), readCount: fc.integer({ min: 0, max: 10 }) })`
    - **Validates: Requirements 4.2**

- [ ] 9. Клиент: обновить ChatWindow и Read_Indicator
  - [ ] 9.1 Добавить socket-listener в `ChatWindow.tsx`
    - В `useEffect` добавить `socket.on('message:read', ({ messageId, chatId, readCount }) => updateMessageReadStatus(chatId, messageId, readCount))`
    - Не забыть `socket.off('message:read')` в cleanup
    - Отправлять `socket.emit('chat:open', { chatId })` при открытии чата
    - _Requirements: 4.2, 4.5, 5.2_

  - [ ] 9.2 Обновить Read_Indicator в MessageBubble
    - Заменить `{msg.read ? '✓✓' : '✓'}` на компонент с поддержкой `readCount`
    - Для группового чата с `readCount > 0` добавить `<sup>` с числом и `title="Прочитали: N"`
    - Индикатор рендерить только при `isOwn === true`
    - _Requirements: 2.1, 2.3, 2.5, 3.1, 3.3, 3.5_

  - [ ] 9.3 Написать property-тест для рендеринга индикатора прочтения
    - **Property 5: Рендеринг индикатора прочтения**
    - `read=false` → отображается `'✓'`; `read=true` → `'✓✓'`; индикатор присутствует только при `isOwn=true`
    - Генераторы: `fc.boolean()` для `read`, `fc.boolean()` для `isOwn`
    - **Validates: Requirements 2.1, 2.3, 2.5, 3.1**

  - [ ] 9.4 Написать property-тест для порога двойной галочки в групповом чате
    - **Property 6: Порог двойной галочки в групповом чате**
    - `read = true` тогда и только тогда, когда `readCount >= N - 1`
    - Генераторы: `fc.integer({ min: 2, max: 10 })` для N, `fc.integer({ min: 0, max: 10 })` для `readCount`
    - **Validates: Requirements 3.3, 3.4**

  - [ ] 9.5 Написать property-тест для tooltip счётчика в групповом чате
    - **Property 7: Tooltip счётчика в групповом чате**
    - При `readCount > 0` в групповом чате атрибут `title` содержит числовое значение `readCount`
    - Генераторы: `fc.integer({ min: 1, max: 50 })` для `readCount`
    - **Validates: Requirements 3.5**

- [ ] 10. Final checkpoint — убедиться что все тесты проходят
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Задачи с `*` опциональны и могут быть пропущены для быстрого MVP
- Каждая задача ссылается на конкретные требования для трассируемости
- Property-тесты используют fast-check, минимум 100 итераций каждый
- Поле `Message.read` сохраняется в API для обратной совместимости
