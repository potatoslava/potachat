import { useEffect, useState } from 'react'
import api from '../lib/api'

interface AvatarEntry { id: string; avatar: string; createdAt: string }

export default function AvatarViewer({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [history, setHistory] = useState<AvatarEntry[]>([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    api.get(`/users/${userId}/avatars`).then(({ data }) => setHistory(data))
  }, [userId])

  if (!history.length) return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="text-muted text-sm">Нет аватаров</div>
    </div>
  )

  const entry = history[current]

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50" onClick={onClose}>
      <div className="relative" onClick={e => e.stopPropagation()}>
        {/* Полоски прогресса как в TG */}
        <div className="flex gap-1 mb-3 px-2">
          {history.map((_, i) => (
            <div key={i} onClick={() => setCurrent(i)}
              className={`h-0.5 flex-1 rounded-full cursor-pointer transition-all ${i === current ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>

        <img src={entry.avatar} className="w-72 h-72 rounded-2xl object-cover" alt="" />

        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-white font-medium">{name}</p>
          <p className="text-muted text-xs">{new Date(entry.createdAt).toLocaleDateString('ru')}</p>
        </div>

        {/* Навигация */}
        <div className="flex justify-between mt-3 gap-2">
          <button onClick={() => setCurrent(v => Math.max(0, v - 1))} disabled={current === 0}
            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-30 hover:bg-white/20 transition">
            ← Назад
          </button>
          <button onClick={() => setCurrent(v => Math.min(history.length - 1, v + 1))} disabled={current === history.length - 1}
            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-30 hover:bg-white/20 transition">
            Вперёд →
          </button>
        </div>
      </div>

      <button onClick={onClose} className="mt-6 text-muted hover:text-white text-sm transition">Закрыть</button>
    </div>
  )
}
