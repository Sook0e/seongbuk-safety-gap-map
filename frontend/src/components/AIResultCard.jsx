// AI 판별 결과 (주민 제보 3단계, 관리자 상세 'AI가 본 것'에서 같이 씀)
import { toPolite } from '../lib/politeKo.js'

// others: 대표 외 사진들의 판별 [{n: 사진 번호, ai}] (주민 제보 화면에서 사진이 여러 장일 때)
// title: 사진이 여러 장일 때 '대표 사진 AI 판별 결과'로 바꿔 대표 사진 기준임을 알린다
// 신뢰도는 모델이 스스로 적은 값이라 '정확도'라고 쓰지 않는다 (CLAUDE.md). highlight: 주민 제보 화면에서 파란 테두리로 강조
export default function AIResultCard({ ai, highlight = false, title = 'AI 판별 결과', others = [] }) {
  if (!ai) return <p className="text-sm text-gray-500">AI 결과 없음</p>
  const conf = Number.isFinite(Number(ai.confidence)) ? Math.max(0, Math.min(100, Number(ai.confidence))) : null
  return (
    <div className={`flex flex-col gap-2.5 break-keep rounded-2xl bg-white p-4 ${highlight ? 'border-2 border-brand' : 'border border-line'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-sub">{title}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] ${ai.mock ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-900'}`}>{ai.mock ? '임시 결과' : '자동 분류'}</span>
      </div>
      <div className="text-[22px] font-bold">{ai.category}</div>
      {conf !== null && (
        <div className="flex items-center gap-2.5">
          <div className="h-2 flex-1 overflow-hidden rounded bg-gray-200"><div className="h-2 bg-accent" style={{ width: `${conf}%` }} /></div>
          <div className="text-sm font-semibold">신뢰도 {conf}%</div>
        </div>
      )}
      {ai.alternatives?.length > 0 && (
        <p className="text-sm text-sub">다른 후보: {ai.alternatives.map((a) => `${a.category} ${a.confidence}%`).join(' · ')}</p>
      )}
      {ai.reason && <p className="text-sm">{toPolite(ai.reason)}</p>}
      {others.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-page px-2.5 py-2.5 text-sm">
          <p className="font-semibold">다른 사진의 판별 결과입니다</p>
          <ul className="flex flex-col gap-2">
            {others.map(({ n, ai: o }) => {
              const c = Number.isFinite(Number(o.confidence)) ? Math.max(0, Math.min(100, Number(o.confidence))) : null
              return (
                <li key={n} className="flex flex-col gap-0.5">
                  <span><b>사진 {n}</b> · {o.category}{c !== null && ` · 신뢰도 ${c}%`}{o.mock && ' · 임시 결과'}</span>
                  {o.reason && <span className="text-sub">{toPolite(o.reason)}</span>}
                </li>
              )
            })}
          </ul>
          <p className="text-[13px] text-sub">제보의 분류와 우선순위 점수는 대표 사진을 기준으로 합니다.</p>
        </div>
      )}
      <p className="rounded-lg bg-page px-2.5 py-2 text-sm">담당자가 사진을 보고 최종 판단합니다</p>
      {ai.mock
        ? <p className="text-[13px] text-amber-700">임시 결과(Mock): AI 키가 없거나 호출에 실패함</p>
        : <p className="text-[13px] text-sub">외부 AI(Claude)가 사진을 보고 분류한 결과입니다. 직접 학습한 모델은 아직 서비스에 연결하지 않았습니다.</p>}
    </div>
  )
}
