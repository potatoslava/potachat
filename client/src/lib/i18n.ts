type Lang = 'ru' | 'en'

const translations = {
  ru: {
    // Auth
    login: 'Войти в аккаунт',
    register: 'Создать аккаунт',
    username: 'username',
    displayName: 'Отображаемое имя',
    password: 'Пароль',
    loginBtn: 'Войти',
    registerBtn: 'Зарегистрироваться',
    noAccount: 'Нет аккаунта?',
    hasAccount: 'Уже есть аккаунт?',
    create: 'Создать',
    // Sidebar
    search: 'Поиск',
    noChats: 'Нет чатов',
    newChat: 'Новый чат',
    // Chat
    selectChat: 'Выберите чат чтобы начать общение',
    message: 'Сообщение...',
    online: '🟢 в сети',
    offline: '⚫ не в сети',
    group: 'группа',
    channel: 'канал',
    edited: 'изменено',
    dropFile: 'Отпустите файл для отправки',
    botNoReply: 'Это бот — ответить нельзя',
    reply: '↩️ Ответить',
    edit: '✏️ Изменить',
    delete: '🗑️ Удалить',
    replyTo: 'Сообщение',
    // Settings
    settings: 'Настройки',
    editProfile: 'Редактировать профиль',
    account: 'Аккаунт',
    privacy: 'Конфиденциальность',
    language: 'Язык',
    logout: 'Выйти',
    save: 'Сохранить',
    saved: 'Сохранено',
    close: 'Закрыть',
    name: 'Имя',
    bio: 'О себе',
    bioPlaceholder: 'Расскажите о себе...',
    showOnline: 'Показывать статус онлайн',
    showAvatar: 'Показывать аватар всем',
    allowSearch: 'Находить меня по username',
    currentPassword: 'Текущий пароль',
    newPassword: 'Новый пароль',
    changePassword: 'Изменить пароль',
    passwordChanged: 'Пароль изменён',
    usernameChanged: 'Имя пользователя изменено',
    error: 'Ошибка',
  },
  en: {
    // Auth
    login: 'Sign in',
    register: 'Create account',
    username: 'username',
    displayName: 'Display name',
    password: 'Password',
    loginBtn: 'Sign in',
    registerBtn: 'Sign up',
    noAccount: 'No account?',
    hasAccount: 'Already have an account?',
    create: 'Create',
    // Sidebar
    search: 'Search',
    noChats: 'No chats',
    newChat: 'New chat',
    // Chat
    selectChat: 'Select a chat to start messaging',
    message: 'Message...',
    online: '🟢 online',
    offline: '⚫ offline',
    group: 'group',
    channel: 'channel',
    edited: 'edited',
    dropFile: 'Drop file to send',
    botNoReply: 'This is a bot — you cannot reply',
    reply: '↩️ Reply',
    edit: '✏️ Edit',
    delete: '🗑️ Delete',
    replyTo: 'Message',
    // Settings
    settings: 'Settings',
    editProfile: 'Edit profile',
    account: 'Account',
    privacy: 'Privacy',
    language: 'Language',
    logout: 'Log out',
    save: 'Save',
    saved: 'Saved',
    close: 'Close',
    name: 'Name',
    bio: 'Bio',
    bioPlaceholder: 'Tell about yourself...',
    showOnline: 'Show online status',
    showAvatar: 'Show avatar to everyone',
    allowSearch: 'Allow finding me by username',
    currentPassword: 'Current password',
    newPassword: 'New password',
    changePassword: 'Change password',
    passwordChanged: 'Password changed',
    usernameChanged: 'Username changed',
    error: 'Error',
  }
}

export function getLang(): Lang {
  return (localStorage.getItem('lang') as Lang) || 'ru'
}

export function setLang(lang: Lang) {
  localStorage.setItem('lang', lang)
  window.location.reload()
}

export function t(key: keyof typeof translations['ru']): string {
  const lang = getLang()
  return translations[lang][key] || translations['ru'][key]
}
