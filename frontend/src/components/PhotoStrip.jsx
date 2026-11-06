import { formatTaken } from '../lib/exif.js'

// 제보 화면: 사진을 최대 4장까지 붙이고, 사진을 누르면 아래 메모 칸이 그 사진의 메모로 바뀐다 (사진마다 따로 적음).
// 처음에는 1번(대표) 사진이 선택돼 있다. 첫 번째 사진이 대표 사진이고 제보의 AI 분류·점수는 대표 사진 한 장만 쓴다.
const MAX = 4

export default function PhotoStrip({ items, active, onActive, onMemo, onRemove, onAdd, adding, aiDrafted }) {
  const idx = Math.min(active ?? 0, items.length - 1)
  const cur = items[idx]
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-white p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">붙인 사진 {items.length}/{MAX}</p>
        <p className="text-[13px] text-sub">사진을 누르면 그 사진의 메모 칸이 열려요</p>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {items.map((it, i) => (
          <button key={it.key} type="button" aria-label={`사진 ${i + 1}${i === 0 ? ' (대표)' : ''}`} aria-pressed={idx === i} onClick={() => onActive(i)}
            className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border-2 ${idx === i ? 'border-brand' : 'border-line'}`}>
            <img src={it.preview} alt="" className="h-full w-full object-cover" />
            <span className={`absolute left-0 top-0 rounded-br px-1.5 py-0.5 text-xs font-semibold text-white ${i === 0 ? 'bg-ink' : 'bg-gray-600'}`}>{i === 0 ? '1 대표' : i + 1}</span>
            {it.memo && <span className="absolute bottom-0 right-0 rounded-tl bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">메모</span>}
          </button>
        ))}
        {items.length < MAX && (
          <label className="flex h-[72px] w-[72px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-sub text-[13px] font-medium text-sub">
            {adding ? '올리는 중' : <><span className="text-lg leading-none">+</span>사진 추가</>}
            <input type="file" accept="image/*" multiple className="hidden" disabled={adding}
              onChange={(e) => { if (e.target.files.length) onAdd([...e.target.files]); e.target.value = '' }} />
          </label>
        )}
      </div>
      {cur && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-page p-2.5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">사진 {idx + 1} 메모 (선택)</span>
            <input value={cur.memo} maxLength={200} onChange={(e) => onMemo(idx, e.target.value)}
              placeholder="예: 담장 아래쪽 금이 간 곳" className="h-11 rounded-lg border border-line bg-white px-3 text-[15px] text-ink" />
          </label>
          {aiDrafted && <p className="text-[13px] text-sub">AI가 사진마다 보고 쓴 초안이 들어 있어요. 고쳐서 보내셔도 됩니다.</p>}
          <div className="flex items-center justify-between text-[13px] text-sub">
            <span>{cur.takenAt ? `촬영 ${formatTaken(cur.takenAt)}` : '촬영 일시를 알 수 없어요'}</span>
            {idx > 0 && <button type="button" onClick={() => onRemove(idx)} className="-my-3 py-3 font-medium text-danger underline">이 사진 빼기</button>}
          </div>
        </div>
      )}
    </div>
  )
}
