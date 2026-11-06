import { formatTaken } from '../lib/exif.js'

// 제보 화면: 사진을 최대 4장까지 붙이고, 사진마다 메모 칸을 하나씩 보여 준다 (AI가 사진마다 쓴 초안이 칸마다 들어감).
// 첫 번째 사진이 대표 사진이고 제보의 AI 분류·점수는 대표 사진 한 장만 쓴다.
const MAX = 4

export default function PhotoStrip({ items, onMemo, onRemove, onAdd, adding, aiDrafted }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-white p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">붙인 사진 {items.length}/{MAX}</p>
        <p className="text-[13px] text-sub">사진마다 메모를 따로 적어요</p>
      </div>
      {aiDrafted && <p className="text-[13px] text-sub">AI가 사진마다 보고 쓴 초안이 들어 있어요. 고쳐서 보내셔도 됩니다.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={it.key} className="flex gap-2.5 rounded-lg bg-page p-2">
            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border border-line">
              <img src={it.preview} alt={`사진 ${i + 1}${i === 0 ? ' (대표)' : ''}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-0 top-0 rounded-br bg-ink px-1.5 py-0.5 text-xs font-semibold text-white">대표</span>}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">사진 {i + 1} 메모 (선택)</span>
                <input value={it.memo} maxLength={200} onChange={(e) => onMemo(i, e.target.value)}
                  placeholder="예: 담장 아래쪽 금이 간 곳" className="h-11 rounded-lg border border-line bg-white px-3 text-[15px] text-ink" />
              </label>
              <div className="flex items-center justify-between text-[13px] text-sub">
                <span>{it.takenAt ? `촬영 ${formatTaken(it.takenAt)}` : '촬영 일시를 알 수 없어요'}</span>
                {i > 0 && <button type="button" onClick={() => onRemove(i)} className="-my-3 py-3 font-medium text-danger underline">이 사진 빼기</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {items.length < MAX && (
        <label className="flex h-11 cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-sub text-[13px] font-medium text-sub">
          {adding ? '올리는 중' : <><span className="text-lg leading-none">+</span>사진 추가</>}
          <input type="file" accept="image/*" multiple className="hidden" disabled={adding}
            onChange={(e) => { if (e.target.files.length) onAdd([...e.target.files]); e.target.value = '' }} />
        </label>
      )}
    </div>
  )
}
