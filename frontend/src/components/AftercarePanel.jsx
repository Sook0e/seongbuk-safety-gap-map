import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import BeforeAfter from './BeforeAfter.jsx'

// 관리자 상세: 조치 완료 뒤 주민 확인, 재발 연결, 같은 곳 이력(조치 전후 사진 비교)
const REL = { self: '이 제보', prior: '이전', later: '이후', nearby: '근처' }
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-')

export default function AftercarePanel({ report }) {
  const [hist, setHist] = useState([])
  useEffect(() => { api.adminPlaceHistory(report.id).then(setHist).catch(() => setHist([])) }, [report.id, report.status])
  const ac = report.aftercare
  const compare = hist.find((h) => h.relation === 'prior' && h.photo_url && h.after_photo_url)
  if (!ac && hist.length <= 1) return null
  return (
    <div className="rounded-lg bg-white p-4">
      <h2 className="mb-2 font-semibold">조치 후 관리</h2>
      <div className="flex flex-col gap-1 text-sm">
        {ac?.recurrence && (
          <p className="rounded bg-amber-50 px-2 py-1.5">재발: 같은 곳에서 조치 완료 {ac.recurrence.days_after_done}일 만에 다시 제보됨
            {ac.recurrence.admin_id && <> · <Link className="underline" to={`/admin/reports/${ac.recurrence.admin_id}`}>이전 제보 #{ac.recurrence.admin_id}</Link></>}</p>
        )}
        {report.status === 'done' && (
          <p>주민 확인: 고쳐졌어요 {ac?.fixed ?? 0}명 · 아직 그대로 {ac?.not_fixed ?? 0}명
            {ac?.recheck_due && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">재점검 필요 (예정일 {day(ac.recheck_at)})</span>}</p>
        )}
      </div>
      {compare && <div className="mt-3 max-w-sm"><p className="mb-1 text-xs text-gray-500">이전 제보 #{compare.id}의 조치 전·후</p><BeforeAfter before={compare.photo_url} after={compare.after_photo_url} /></div>}
      {hist.length > 1 && (
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-gray-500"><tr><th className="py-1">구분</th><th>접수</th><th>상태</th><th>거리</th><th>주민 확인</th></tr></thead>
          <tbody>
            {hist.map((h) => (
              <tr key={h.id} className={`border-t ${h.relation === 'self' ? 'font-semibold' : ''}`}>
                <td className="py-1">{REL[h.relation]}</td>
                <td>{day(h.created_at)}</td>
                <td>{h.status_label}{h.done_at && ` (${day(h.done_at)})`}</td>
                <td>{h.relation === 'self' ? '-' : `${h.distance_m}m`}</td>
                <td>{h.status === 'done' ? `고쳐짐 ${h.fixed} · 그대로 ${h.not_fixed}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
