import { useEffect } from 'react'

// 사진을 화면 위에 크게 띄운다. 닫기 버튼, 바깥 눌러서 닫기, Esc 키로 닫는다 (사진 주소를 직접 열면 돌아갈 곳이 없어서 이 창을 쓴다).
export default function PhotoModal({ src, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!src) return null
  return (
    <div role="dialog" aria-modal="true" aria-label={title ?? '사진 보기'} onClick={onClose}
      className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 h-11 rounded-lg bg-white px-4 text-sm font-semibold text-ink">닫기</button>
      <img src={src} alt={title ?? '사진'} onClick={(e) => e.stopPropagation()} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
      {title && <p className="text-sm text-white">{title}</p>}
    </div>
  )
}
