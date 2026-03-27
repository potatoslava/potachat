import { QRCodeSVG } from 'qrcode.react'

export default function QRModal({ username, onClose }: { username: string; onClose: () => void }) {
  const url = `${window.location.origin}/u/${username}`

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-sidebar rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-white">Мой QR-код</p>
        <div className="bg-white p-4 rounded-2xl">
          <QRCodeSVG value={url} size={200} />
        </div>
        <div className="text-center">
          <p className="text-sm text-white font-medium">@{username}</p>
          <p className="text-xs text-muted mt-1">Отсканируй чтобы написать мне</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-white text-sm transition">Закрыть</button>
      </div>
    </div>
  )
}
