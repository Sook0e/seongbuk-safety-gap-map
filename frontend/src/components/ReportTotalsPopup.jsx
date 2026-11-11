import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { REPORT_STATUS_COLORS } from '../lib/reportStatus.js'

const STATUS = [['received', '접수'], ['review', '검토'], ['action', '조치'], ['done', '완료']]

export default function ReportTotalsPopup({ onClose }) {
  const dialog = useRef(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const node = dialog.current
    node.showModal()
    let alive = true
    api.reportsSummary(1)
      .then((result) => { if (alive) setSummary(result) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false; node.close() }
  }, [])

  const counts = summary && { received: summary.pending, review: summary.review, action: summary.action, done: summary.done }
  const maxCount = counts ? Math.max(1, ...Object.values(counts)) : 1

  return (
    <dialog ref={dialog} aria-labelledby="report-totals-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      className="resident-card fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-32px)] max-w-[350px] overflow-y-auto p-[18px] text-ink shadow-xl backdrop:bg-brand/35">
      <div className="grid gap-3">
        <h2 id="report-totals-title" className="text-[17px] font-bold">전체 누적 제보 현황</h2>
        <p className="text-[11px] text-sub">접수부터 현재까지</p>
        {error ? <p role="alert" className="text-sm text-sub">제보 현황을 불러오지 못했어요. 닫은 뒤 다시 열어 주세요.</p>
          : !summary ? <p role="status" className="text-sm text-sub">불러오는 중이에요.</p>
          : <>
            <ul className="grid gap-3">
              {STATUS.map(([key, label]) => (
                <li key={key} className="grid grid-cols-[32px_1fr_40px] items-center gap-2 text-xs">
                  <span>{label}</span>
                  <span aria-hidden="true" className="h-[9px] overflow-hidden rounded-full bg-[#edf0f2]">
                    <span className="block h-full rounded-full" style={{ width: `${counts[key] / maxCount * 100}%`, background: REPORT_STATUS_COLORS[key] }} />
                  </span>
                  <strong className="text-right">{counts[key]}건</strong>
                </li>
              ))}
            </ul>
            <p className="resident-chip justify-self-start bg-[#ecf0f4] text-[#46596f]">확인 대기 {summary.pending}건</p>
            <p className="text-[11px] text-sub">담당자가 확인한 제보만 지도에 표시돼요.</p>
          </>}
        <button type="button" onClick={onClose} className="resident-primary !min-h-11 text-xs">닫기</button>
      </div>
    </dialog>
  )
}
