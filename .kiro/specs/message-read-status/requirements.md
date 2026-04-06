# Requirements Document

## Introduction

Фича "Статус прочитано" (message read status) добавляет в мессенджер CocoDack визуальные индикаторы прочтения сообщений — аналогично WhatsApp/Telegram. Для личных чатов отображается одна галочка (отправлено) и две галочки (прочитано). Для групповых чатов отображается счётчик прочитавших участников. Статус обновляется в реальном времени через Socket.io и хранится в PostgreSQL.

## Glossary

- **ReadStatus_Service**: серверный модуль, отвечающий за запись и чтение данных о прочтении сообщений
- **MessageRead**: запись в БД, фиксирующая факт прочтения конкретного сообщения конкретным пользователем
- **Read_Indicator**: UI-компонент, отображающий иконку статуса прочтения рядом с сообщением
- **Socket_Server**: серверная часть Socket.io в `server/src/index.js`
- **Socket_Client**: клиентская часть Socket.io в `client/src/lib/socket.ts`
- **ChatWindow**: компонент `client/src/components/ChatWindow.tsx`, отображающий список сообщений
- **ChatStore**: Zustand-стор `client/src/store/chatStore.ts`, хранящий состояние чатов и сообщений
- **Sender**: пользователь, отправивший сообщение
- **Recipient**: пользователь, получивший сообщение в личном чате
- **Group_Member**: участник группового чата, не являющийся отправителем данного сообщения

---

## Requirements

### Requirement 1: Хранение данных о прочтении

**User Story:** As a developer, I want to store read receipts in the database, so that read status persists across sessions and server restarts.

#### Acceptance Criteria

1. THE ReadStatus_Service SHALL хранить записи MessageRead в отдельной таблице БД, содержащей идентификатор сообщения, идентификатор пользователя и временную метку прочтения.
2. THE ReadStatus_Service SHALL обеспечивать уникальность записи MessageRead для каждой пары (messageId, userId) — повторная запись не создаёт дубликат.
3. WHEN пользователь открывает чат, THE ReadStatus_Service SHALL создавать записи MessageRead для всех непрочитанных сообщений этого чата, отправленных другими пользователями.
4. THE ReadStatus_Service SHALL предоставлять API-метод, возвращающий количество уникальных Group_Member, прочитавших конкретное сообщение.
5. FOR ALL записей MessageRead, запись в БД и последующее чтение SHALL возвращать те же значения messageId, userId и readAt (round-trip property).

---

### Requirement 2: Статус прочтения в личных чатах

**User Story:** As a user, I want to see when my message has been read in a private chat, so that I know the recipient has seen it.

#### Acceptance Criteria

1. WHEN Sender отправляет сообщение в личный чат, THE Read_Indicator SHALL отображать одну галочку (статус "отправлено") рядом с сообщением.
2. WHEN Recipient открывает личный чат, содержащий непрочитанные сообщения, THE ReadStatus_Service SHALL пометить все эти сообщения как прочитанные.
3. WHEN сообщение в личном чате помечается как прочитанное, THE Read_Indicator SHALL обновить отображение с одной галочки на две галочки для Sender в реальном времени без перезагрузки страницы.
4. WHILE Recipient не открыл личный чат, THE Read_Indicator SHALL отображать одну галочку для всех сообщений Sender в этом чате.
5. THE Read_Indicator SHALL отображаться только рядом с сообщениями текущего пользователя (Sender), но не рядом с входящими сообщениями.

---

### Requirement 3: Статус прочтения в групповых чатах

**User Story:** As a user, I want to see how many group members have read my message, so that I can track message visibility in group conversations.

#### Acceptance Criteria

1. WHEN Sender отправляет сообщение в групповой чат, THE Read_Indicator SHALL отображать одну галочку (статус "отправлено") рядом с сообщением.
2. WHEN хотя бы один Group_Member открывает групповой чат с непрочитанными сообщениями, THE ReadStatus_Service SHALL создать запись MessageRead для этого Group_Member по каждому непрочитанному сообщению.
3. WHEN количество Group_Member, прочитавших сообщение, равно общему количеству Group_Member в чате, THE Read_Indicator SHALL отображать две галочки для этого сообщения.
4. WHILE не все Group_Member прочитали сообщение, THE Read_Indicator SHALL отображать одну галочку рядом с сообщением Sender.
5. WHERE групповой чат содержит более двух участников, THE Read_Indicator SHALL отображать числовой счётчик прочитавших (например, "✓✓ 3") при наведении курсора или в виде подсказки (tooltip).

---

### Requirement 4: Обновление статуса в реальном времени

**User Story:** As a user, I want read status to update instantly without refreshing the page, so that I get immediate feedback when my messages are read.

#### Acceptance Criteria

1. WHEN ReadStatus_Service создаёт запись MessageRead, THE Socket_Server SHALL отправить событие `message:read` в комнату Sender, содержащее messageId, chatId и количество прочитавших.
2. WHEN Socket_Client получает событие `message:read`, THE ChatStore SHALL обновить статус прочтения соответствующего сообщения в локальном состоянии.
3. WHEN ChatStore обновляет статус прочтения сообщения, THE Read_Indicator SHALL немедленно отразить изменение в UI без перезагрузки компонента ChatWindow.
4. IF Socket_Client не получает подтверждение события `message:read` в течение сессии, THEN THE ChatWindow SHALL загружать актуальный статус прочтения с сервера при следующем открытии чата.
5. WHEN пользователь переключается между чатами, THE Socket_Client SHALL отправлять событие `chat:open` на сервер для инициирования пометки сообщений как прочитанных.

---

### Requirement 5: Загрузка статуса прочтения при открытии чата

**User Story:** As a user, I want to see correct read status when I open a chat, so that the indicators reflect the actual state even after reconnecting.

#### Acceptance Criteria

1. WHEN ChatWindow загружает историю сообщений, THE ReadStatus_Service SHALL возвращать вместе с каждым сообщением актуальный статус прочтения (прочитано / не прочитано).
2. WHEN пользователь открывает чат, THE Socket_Client SHALL отправить событие `chat:open` с chatId на Socket_Server.
3. WHEN Socket_Server получает событие `chat:open`, THE ReadStatus_Service SHALL пометить все непрочитанные сообщения в этом чате как прочитанные для данного пользователя и уведомить отправителей через событие `message:read`.
4. THE ReadStatus_Service SHALL обрабатывать пакетную пометку сообщений как прочитанных (batch upsert) за одну транзакцию БД для минимизации нагрузки.
5. IF пользователь открывает чат, в котором нет непрочитанных сообщений, THEN THE ReadStatus_Service SHALL выполнить запрос к БД и вернуть пустой результат без создания новых записей.

---

### Requirement 6: Корректность данных и граничные случаи

**User Story:** As a developer, I want the read status system to handle edge cases correctly, so that the data remains consistent under all conditions.

#### Acceptance Criteria

1. IF пользователь удалён из группового чата, THEN THE ReadStatus_Service SHALL исключать записи MessageRead этого пользователя из подсчёта прочитавших для сообщений, отправленных после его удаления.
2. WHEN сообщение удаляется из чата, THE ReadStatus_Service SHALL каскадно удалять все связанные записи MessageRead.
3. IF Sender открывает собственный чат, THEN THE ReadStatus_Service SHALL НЕ создавать запись MessageRead для сообщений, отправленных самим Sender.
4. THE ReadStatus_Service SHALL корректно обрабатывать случай, когда групповой чат содержит только одного участника (помимо Sender), аналогично логике личного чата.
5. WHEN пользователь отправляет сообщение в чат, в котором Recipient уже находится (чат открыт), THE ReadStatus_Service SHALL немедленно пометить сообщение как прочитанное и уведомить Sender.
