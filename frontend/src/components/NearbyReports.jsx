import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { myReports } from '../lib/myReports.js'

// 제보 화면: 같은 곳(50m 안)에 이미 접수된 제보가 있으면 진행 상황을 먼저 보여 준다 (중복 제보 줄이기).
// 같은 문제면 '나도 봤어요'로 확인만 남기고 그 제보를 내 제보에서 따라볼 수 있다. 다른 문제면 그대로 새로 제보한다.
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))

export default function NearbyReports({ pos, category }) {
  const [list, setList] = useState([])
  const [msg, setMsg] = useState('')
  const [, bump] = useState(0)

  useEffect(() => {
    if (!pos) { setList([]); return }
    let alive = true
    const t = setTimeout(() => {
      api.nearby(pos.lat, pos.lon, category).then((r) => alive && setList(r)).catch(() => alive && setList([]))
    }, 400) // 핀을 끄는 동안 계속 부르지 않도록
    return () => { alive = false; clearTimeout(t) }
  }, [pos?.lat, pos?.lon, category])

  async function confirm(id) {
    try {
      await api.confirm(id)
      myReports.markConfirmed(id)
      myReports.add(id) // 내 제보에서 진행 상황을 따라볼 수 있게
      setMsg("확인했어요. 이 제보의 진행 상황은 '내 제보'에서 볼 수 있습니다.")
      bump((n) => n + 1)
    } catch (e) { setMsg(`실패: ${e.message}`) }
  }

  if (!list.length) return null
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
      <p className="text-sm font-semibold">이 근처에 이미 접수된 제보가 {list.length}건 있어요</p>
      <p className="text-xs text-sub">같은 문제라면 새로 보내지 않고 '나도 봤어요'를 눌러 주세요. 다른 문제라면 아래에서 그대로 제보하시면 됩니다.</p>
      {list.map((r) => (
        <div key={r.public_id} className="flex items-center justify-between gap-2 rounded-lg bg-page px-3 py-2">
          <div className="flex flex-col gap-0.5 text-[13px]">
            <span className="font-medium">{r.category ?? '분류 없음'}{r.facility_label && ` · ${r.facility_label}`}</span>
            <span className="text-xs text-sub">{r.status_label} · 접수 후 {daysSince(r.created_at)}일째 · 약 {r.distance_m}m · 확인 {r.confirm_count}명{r.dept && ` · ${r.dept}`}</span>
          </div>
          <button type="button" disabled={myReports.confirmed(r.public_id) || myReports.ids().includes(r.public_id)}
            onClick={() => confirm(r.public_id)}
            className="h-9 shrink-0 rounded-lg bg-brand px-3 text-[13px] font-semibold text-white disabled:opacity-40">
            {myReports.confirmed(r.public_id) ? '확인했어요' : '나도 봤어요'}
          </button>
        </div>
      ))}
      {msg && <p className="text-xs text-sub">{msg}</p>}
    </div>
  )
}
