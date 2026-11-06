import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

// 담당자 대시보드: 주민이 신청한 기프티콘 교환 목록. 기프티콘을 보낸 뒤 '처리 완료'를 누른다 (업체 연동 전이라 수동으로 보냄).
export default function RewardRequests() {
  const [rows, setRows] = useState([])
  const load = () => api.adminRedeems('requested').then(setRows).catch(() => setRows([]))
  useEffect(() => { load() }, [])
  if (!rows.length) return null
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-semibold">기프티콘 교환 신청 {rows.length}건</h2>
      <ul className="divide-y text-sm">
        {rows.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 py-2">
            <span>010-****-{x.phone_last4} · {x.amount.toLocaleString('ko-KR')}P · {new Date(x.created_at).toLocaleString('ko-KR')}</span>
            <button type="button" onClick={() => api.adminFinishRedeem(x.id).then(load)} className="rounded border border-line px-3 py-1.5">발송 완료로 처리</button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-400">전화번호는 뒤 4자리만 저장돼 있어 기프티콘 발송 방법(문자 연동 등)은 따로 정해야 합니다.</p>
    </div>
  )
}
