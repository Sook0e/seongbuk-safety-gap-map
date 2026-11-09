import { stepTime } from '../lib/time.js'

const STEPS = [['received', '접수'], ['review', '검토'], ['action', '조치'], ['done', '완료']]

// 상태 진행 표시 (접수 → 검토 → 조치 → 완료). 와이어프레임 '내 제보'의 4칸 막대
// times: 단계별로 그 상태가 된 시각 {received, review, action, done} (ISO). 있으면 단계 이름 아래에 날짜와 시간을 적는다
export default function StatusSteps({ status, times, highlight = false, publicOnly = false }) {
  const steps = publicOnly ? STEPS.slice(1) : STEPS
  const current = steps.findIndex(([k]) => k === status)
  const color = 'bg-brand'
  return (
    <ol aria-label="제보 진행 단계" className={`grid gap-1 ${publicOnly ? "grid-cols-3" : "grid-cols-4"}`}>
      {steps.map(([key, label], i) => (
        <li key={key} aria-current={i === current ? "step" : undefined} className="flex flex-col items-center gap-1.5">
          <span className={`h-1.5 w-full rounded ${i <= current ? color : 'bg-gray-200'}`} />
          <span className={`text-xs ${i === current ? 'font-semibold' : 'text-sub'} ${highlight && i === current ? 'rounded-full bg-[#e8effa] px-2 py-0.5 text-[#254c85]' : ''}`}>
            {highlight && i === current && <span aria-hidden="true">✓ </span>}{label}
          </span>
          {times && <span className="min-h-[30px] text-center text-[11px] leading-tight text-sub">
            {stepTime(times[key])?.map((line) => <span key={line} className="block">{line}</span>) ?? <span aria-label="아직 아님">-</span>}
          </span>}
        </li>
      ))}
    </ol>
  )
}
