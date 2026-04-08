import { useState, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import api from '../lib/api'
import { getLang, setLang, t } from '../lib/i18n'
import QRModal from '../components/QRModal'

type Section = 'main' | 'profile' | 'account' | 'privacy' | 'language'

export default function SettingsPage({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>('main')

  const sectionTitle: Record<Section, string> = {
    main: t('settings'),
    profile: t('editProfile'),
    account: t('account'),
    privacy: t('privacy'),
    language: t('language'),
  }

  return (
    <div className="flex-1 flex flex-col bg-chat" style={{ height: '100dvh' }}>
      <div className="flex items-center gap-3 px-4 py-3 bg-header border-b border-border flex-shrink-0 pt-safe">
        <button onClick={section === 'main' ? onClose : () => setSection('main')} className="text-muted hover:text-white mr-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-semibold text-sm">{sectionTitle[section]}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {section === 'main' && <MainSection onNavigate={setSection} onClose={onClose} />}
        {section === 'profile' && <ProfileSection />}
        {section === 'account' && <AccountSection />}
        {section === 'privacy' && <PrivacySection />}
        {section === 'language' && <LanguageSection />}
      </div>
    </div>
  )
}

function MainSection({ onNavigate, onClose }: { onNavigate: (s: Section) => void; onClose: () => void }) {
  const { user, logout } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const { setAuth } = useAuthStore()
  const token = useAuthStore(s => s.token)!
  const { setChats } = useChatStore()
  const [showQR, setShowQR] = useState(false)
  const [msg, setMsg] = useState('')

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Проверка размера на клиенте
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой (максимум 5MB)')
      return
    }
    
    const form = new FormData()
    form.append('avatar', file)
    try {
      const { data } = await api.post('/users/me/avatar', form)
      setAuth(data, token)
      api.get('/chats').then(({ data }) => setChats(data))
    } catch (e: any) {
      alert(e.response?.data?.message || 'Ошибка загрузки')
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Profile card */}
      <div className="bg-sidebar rounded-2xl p-4 flex items-center gap-4">
        <div className="relative cursor-pointer flex-shrink-0" onClick={() => fileRef.current?.click()}>
          <div className="w-16 h-16 rounded-full bg-primary overflow-hidden flex items-center justify-center text-white text-2xl font-bold">
            {user?.avatar && (user.avatar.startsWith('data:') || user.avatar.startsWith('http'))
              ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />
              : user?.displayName?.[0]?.toUpperCase()
            }
          </div>
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        </div>
        <div>
          <p className="font-semibold text-white">{user?.displayName}</p>
          <p className="text-sm text-muted">@{user?.username}</p>
          {user?.bio && <p className="text-xs text-muted mt-1">{user.bio}</p>}
        </div>
      </div>

      {/* Menu items */}
      <div className="bg-sidebar rounded-2xl overflow-hidden">
        <MenuItem icon="✏️" label={t('editProfile')} onClick={() => onNavigate('profile')} />
        <MenuItem icon="👤" label={t('account')} onClick={() => onNavigate('account')} border />
        <MenuItem icon="🔒" label={t('privacy')} onClick={() => onNavigate('privacy')} border />
        <MenuItem icon="🌐" label={t('language')} onClick={() => onNavigate('language')} border />
        <MenuItem icon="📷" label="Мой QR-код" onClick={() => setShowQR(true)} border />
      </div>

      {msg && <p className="text-xs text-center text-red-400 bg-sidebar rounded-xl p-2">{msg}</p>}

      <div className="bg-sidebar rounded-2xl overflow-hidden">
        <MenuItem icon="🚪" label={t('logout')} onClick={logout} danger />
      </div>

      {showQR && user && <QRModal username={user.username} onClose={() => setShowQR(false)} />}
    </div>
  )
}

function MenuItem({ icon, label, onClick, border, danger }: { icon: string; label: string; onClick: () => void; border?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover transition ${border ? 'border-t border-border' : ''}`}>
      <span className="text-lg w-6 text-center">{icon}</span>
      <span className={`text-sm ${danger ? 'text-red-400' : 'text-white'}`}>{label}</span>
      {!danger && <svg className="w-4 h-4 text-muted ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
    </button>
  )
}

function ProfileSection() {
  const { user, setAuth } = useAuthStore()
  const token = useAuthStore(s => s.token)!
  const { setChats } = useChatStore()
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async () => {
    if (!displayName.trim()) {
      setMsg('Имя не может быть пустым')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    if (displayName.trim().length > 64) {
      setMsg('Имя слишком длинное (максимум 64 символа)')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    if (bio.length > 512) {
      setMsg('О себе слишком длинное (максимум 512 символов)')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    
    setSaving(true)
    try {
      const { data } = await api.patch('/users/me', { displayName, bio })
      setAuth(data, token)
      api.get('/chats').then(({ data }) => setChats(data))
      // Обновляем displayName в сокете для typing индикатора
      if (data.displayName) {
        const { socket } = await import('../lib/socket')
        socket.emit('update:displayName', { displayName: data.displayName })
      }
      setMsg('Сохранено')
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Ошибка сохранения')
      setTimeout(() => setMsg(''), 3000)
    }
    finally { setSaving(false) }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="bg-sidebar rounded-2xl p-4 space-y-3">
        <div>
          <label className="text-xs text-muted mb-1 block">Имя</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            maxLength={64}
            className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">О себе</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
            maxLength={512}
            placeholder="Расскажите о себе..."
            className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary resize-none" />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Имя пользователя</label>
          <input value={`@${user?.username}`} disabled
            className="w-full bg-chat/50 border border-border rounded-xl px-4 py-2.5 text-sm text-muted cursor-not-allowed" />
        </div>
      </div>
      {msg && <p className={`text-xs text-center ${msg === 'Сохранено' ? 'text-primary' : 'text-red-400'}`}>{msg}</p>}
      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
        {saving ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  )
}

function AccountSection() {
  const { user, setAuth, logout } = useAuthStore()
  const token = useAuthStore(s => s.token)!
  const [newUsername, setNewUsername] = useState(user?.username || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const saveUsername = async () => {
    if (!newUsername.trim() || newUsername === user?.username) return
    if (newUsername.length < 3 || newUsername.length > 32) {
      setMsg('Username должен быть от 3 до 32 символов')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(newUsername)) {
      setMsg('Username может содержать только буквы, цифры, точку и подчёркивание')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    setSaving(true)
    try {
      const { data } = await api.patch('/users/me', { username: newUsername })
      setAuth(data, token)
      // Перезагружаем чаты чтобы обновить отображение username
      api.get('/chats').then(({ data: chatsData }) => {
        const { setChats } = useChatStore.getState()
        setChats(chatsData)
      }).catch(() => {})
      setMsg('Имя пользователя изменено')
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setMsg(e.response?.data?.message || 'Ошибка') }
    finally { setSaving(false) }
  }

  const savePassword = async () => {
    if (!oldPassword || !newPassword) return
    if (newPassword.length < 6) {
      setMsg('Новый пароль должен быть не менее 6 символов')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    setSaving(true)
    try {
      await api.patch('/users/me/password', { oldPassword, newPassword })
      setOldPassword(''); setNewPassword('')
      setMsg('Пароль изменён')
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setMsg(e.response?.data?.message || 'Ошибка') }
    finally { setSaving(false) }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/users/me')
      logout()
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Ошибка удаления')
      setDeleting(false)
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <div className="p-4 space-y-4">
      <div className="bg-sidebar rounded-2xl p-4 space-y-3">
        <p className="text-xs text-muted font-medium uppercase tracking-wider">Имя пользователя</p>
        <input value={newUsername} onChange={e => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
          maxLength={32}
          className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
        <button onClick={saveUsername} disabled={saving || newUsername === user?.username}
          className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
          Сохранить
        </button>
      </div>

      <div className="bg-sidebar rounded-2xl p-4 space-y-3">
        <p className="text-xs text-muted font-medium uppercase tracking-wider">Изменить пароль</p>
        <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
          placeholder="Текущий пароль"
          className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary" />
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
          placeholder="Новый пароль"
          className="w-full bg-chat border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-primary" />
        <button onClick={savePassword} disabled={saving || !oldPassword || !newPassword}
          className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
          Изменить пароль
        </button>
      </div>

      {msg && <p className={`text-xs text-center ${['Имя пользователя изменено', 'Пароль изменён'].includes(msg) ? 'text-primary' : 'text-red-400'}`}>{msg}</p>}

      <div className="bg-sidebar rounded-2xl overflow-hidden">
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover transition">
          <span className="text-lg">🚪</span>
          <span className="text-sm text-red-400">Выйти из аккаунта</span>
        </button>
      </div>

      <div className="bg-sidebar rounded-2xl overflow-hidden">
        <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover transition disabled:opacity-50">
          <span className="text-lg">🗑️</span>
          <span className="text-sm text-red-500">{deleting ? 'Удаление...' : 'Удалить аккаунт'}</span>
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-sidebar rounded-2xl p-6 w-80 shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
            <p className="font-semibold mb-2">Удалить аккаунт?</p>
            <p className="text-xs text-muted mb-4">Все данные будут потеряны. Это действие необратимо.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-chat text-muted text-sm hover:text-white transition">
                Отмена
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); deleteAccount() }}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PrivacySection() {
  const [showOnline, setShowOnline] = useState(true)
  const [showAvatar, setShowAvatar] = useState(true)
  const [allowSearch, setAllowSearch] = useState(true)

  return (
    <div className="p-4 space-y-4">
      <div className="bg-sidebar rounded-2xl overflow-hidden">
        <ToggleItem label="Показывать статус онлайн" value={showOnline} onChange={setShowOnline} />
        <ToggleItem label="Показывать аватар всем" value={showAvatar} onChange={setShowAvatar} border />
        <ToggleItem label="Находить меня по username" value={allowSearch} onChange={setAllowSearch} border />
      </div>
      <p className="text-xs text-muted text-center px-4">Настройки конфиденциальности будут доступны в следующем обновлении</p>
    </div>
  )
}

function ToggleItem({ label, value, onChange, border }: { label: string; value: boolean; onChange: (v: boolean) => void; border?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${border ? 'border-t border-border' : ''}`}>
      <span className="text-sm text-white">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-primary' : 'bg-border'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function LanguageSection() {
  const current = getLang()
  const langs = [
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ]
  return (
    <div className="p-4">
      <div className="bg-sidebar rounded-2xl overflow-hidden">
        {langs.map((l, i) => (
          <button key={l.code} onClick={() => setLang(l.code as 'ru' | 'en')}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover transition ${i > 0 ? 'border-t border-border' : ''}`}>
            <span className="text-xl">{l.flag}</span>
            <span className="text-sm text-white flex-1 text-left">{l.label}</span>
            {current === l.code && (
              <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted text-center mt-3">При смене языка страница перезагрузится</p>
    </div>
  )
}
