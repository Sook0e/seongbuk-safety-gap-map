import { useState } from 'react'

// 조치 전·후 사진을 좌우로 밀어서 비교한다 (안전신문고는 글 답변만 오는데, 우리는 사진으로 직접 확인하게 한다).
// 보이지 않는 range 입력이 위에 덮여 있어서 마우스, 터치, 키보드(좌우 화살표)로 모두 움직인다.
export default function BeforeAfter({ before, after }) {
  const [pos, setPos] = useState(50)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-lg bg-gray-200">
        <img src={after} alt="조치 후 사진" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <img src={before} alt="조치 전 사진" draggable={false} className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)]" style={{ left: `${pos}%` }} />
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-ink px-1.5 py-0.5 text-xs font-semibold text-white">조치 전</span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">조치 후</span>
        <input type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))}
          aria-label="조치 전후 사진 비교. 좌우로 움직이세요" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
      <p className="text-[13px] text-sub">좌우로 밀어서 조치 전과 후를 비교해 보세요</p>
    </div>
  )
}
