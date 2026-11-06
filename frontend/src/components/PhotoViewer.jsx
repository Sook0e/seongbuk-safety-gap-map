import { useEffect } from 'react'
import BeforeAfter from './BeforeAfter.jsx'

// 지도에서 제보 사진을 크게 본다. 조치 전·후 사진이 둘 다 있으면 밀어서 비교하고, 하나뿐이면 그 사진만 보여 준다.
// 닫기 버튼, 바깥 누르기, Esc 키로 닫는다.
export default function PhotoViewer({ before, after, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label="제보 사진" onClick={onClose}
      className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 h-11 rounded-lg bg-white px-4 text-sm font-semibold text-ink">닫기</button>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px]">
        {before && after
          ? <div className="rounded-lg bg-white p-2"><BeforeAfter before={before} after={after} /></div>
          : <img src={before || after} alt="제보 사진" className="max-h-[80vh] w-full rounded-lg object-contain" />}
      </div>
    </div>
  )
}
