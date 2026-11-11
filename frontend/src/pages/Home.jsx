import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ResidentHeader, { residentAsset } from '../components/ResidentHeader.jsx'
import PhotoViewer from '../components/PhotoViewer.jsx'
import ProcessPicture from '../components/ProcessPicture.jsx'
import StatusSteps from '../components/StatusSteps.jsx'
import { api } from '../lib/api.js'
import { myReports } from '../lib/myReports.js'
import { ReportBadge, reportTitle } from './MyReports.jsx'

function RankingRows({ rows }) {
  return (
    <ol className="grid gap-1.5">
      {rows.map((row) => (
        <li key={row.rank} className={`flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 text-xs ${row.rank === 1 || row.is_me ? 'bg-[#ebefcb]' : 'bg-[#e9eff7]'}`}>
          <span className="w-9 shrink-0 font-bold">{row.rank}위</span>
          <span className="min-w-0 flex-1 font-semibold">{row.nickname}{row.is_me && ' (나)'}</span>
          <span className="shrink-0 font-bold">{row.points}점</span>
        </li>
      ))}
    </ol>
  )
}

function RankingPopup({ summary, onClose }) {
  const dialog = useRef(null)
  const [ranking, setRanking] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  useEffect(() => {
    let alive = true
    api.ranking(100, myReports.clientKey())
      .then((rows) => { if (alive) setRanking(rows) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])
  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose() }} aria-labelledby="ranking-title"
      className="resident-card fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-32px)] max-w-[350px] overflow-y-auto p-[18px] text-ink shadow-xl backdrop:bg-brand/35">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="ranking-title" className="text-xl font-bold">우리 동네 안전왕</h2>
          <button type="button" aria-label="순위 닫기" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e9eff7]">
            <img src={residentAsset('ranking-close.svg')} alt="" />
          </button>
        </div>
        <p className="text-xs text-sub">담당자가 확인한 제보 1건당 {summary.points_per_report}점 · 순위에만 반영</p>
        {error ? <p role="alert" className="text-sm text-sub">전체 순위를 불러오지 못했어요. 닫은 뒤 다시 열어 주세요.</p>
          : !ranking ? <p role="status" className="text-sm text-sub">불러오는 중이에요.</p>
          : <RankingRows rows={ranking.top} />}
        {ranking?.me && !ranking.top.some((row) => row.is_me) && (
          <p className="rounded-xl bg-[#ebefcb] px-3 py-2 text-sm font-bold">내 순위 {ranking.me.rank}위 · {ranking.me.points}점</p>
        )}
        {ranking?.total_players > ranking?.top.length && <p className="text-xs text-sub">상위 {ranking.top.length}명 표시 · 총 {ranking.total_players}명</p>}
      </div>
    </dialog>
  )
}

export default function Home() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(false)
  const [stats, setStats] = useState(null)
  const [pairs, setPairs] = useState({})
  const [viewer, setViewer] = useState(null)
  const [mine, setMine] = useState(null)
  const [ranking, setRanking] = useState(null)
  const [rankOpen, setRankOpen] = useState(false)
  const [rankError, setRankError] = useState(false)
  useEffect(() => {
    api.reportsSummary(5).then((result) => {
      setSummary(result)
      const doneIds = result.recent.filter((report) => report.status === 'done').map((report) => report.public_id)
      if (doneIds.length) api.myReports(doneIds).then((rows) => setPairs(Object.fromEntries(rows
        .filter((row) => row.photo_url && row.after_photo_url)
        .map((row) => [row.public_id, { before: row.photo_url, after: row.after_photo_url }])))).catch(() => {})
    }).catch(() => setError(true))
    api.stats().then(setStats).catch(() => setStats(false))
    const clientKey = myReports.clientKey()
    api.myReports(myReports.ids(), clientKey).then((rows) => setMine(rows.find((row) => !row.not_target) ?? false)).catch(() => setMine(false))
    api.ranking(3, clientKey).then(setRanking).catch(() => setRankError(true))
  }, [])

  return (
    <section className="resident-screen">
      <ResidentHeader caption="우리 동네 안전 체크!" title="안전캐치" />
      <Link to="/report?demo=1" className="flex min-h-20 items-center gap-3 rounded-2xl bg-accent px-3.5 py-3 text-brand">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white"><img src={residentAsset('demo-photos.svg')} alt="" /></span>
        <span className="min-w-0 flex-1">
          <strong className="block text-lg leading-tight">사진 제보 체험하기</strong>
          <span className="mt-1 block text-xs">처음이라면 체험 사진으로 시작해요.</span>
        </span>
        <img src={residentAsset('home-imgChev.svg')} alt="" />
      </Link>
      <Link to="/report" className="resident-primary grid place-items-center">사진으로 제보하기</Link>

      <section className="grid gap-2 rounded-[20px] bg-[#ebefcb] p-3.5">
        <div className="flex items-center gap-2">
          <img src={residentAsset('safety-mascot.png')} width="33" height="33" alt="" />
          <h2 className="text-base font-bold">제보는 이렇게 처리돼요!</h2>
        </div>
        <ProcessPicture />
        <Link to="/guide" className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white px-3 text-sm font-bold">
          서비스 안내 자세히 보기<img src={residentAsset('home-imgChev.svg')} alt="" />
        </Link>
      </section>

      <section className="resident-card grid gap-2.5" aria-labelledby="home-ranking">
        <h2 id="home-ranking" className="text-lg font-bold">우리 동네 안전왕</h2>
        <p className="text-xs text-sub">담당자가 확인한 제보 1건당 {ranking?.points_per_report ?? 10}점 · 순위에만 반영</p>
        {rankError ? <p className="text-sm text-sub">순위를 불러오지 못했어요.</p>
          : !ranking ? <p role="status" className="text-sm text-sub">불러오는 중이에요.</p>
          : ranking.top.length === 0 ? <p className="text-sm text-sub">아직 순위가 없어요.</p>
          : <>
            <RankingRows rows={ranking.top} />
            {ranking.me && <p className="text-sm font-bold">내 순위 {ranking.me.rank}위 · {ranking.me.points}점</p>}
            <button type="button" aria-haspopup="dialog" className="resident-secondary" onClick={() => setRankOpen(true)}>전체 순위 보기 <span aria-hidden="true">›</span></button>
          </>}
      </section>
      {rankOpen && <RankingPopup summary={ranking} onClose={() => setRankOpen(false)} />}

      <a href="tel:119" className="flex min-h-16 items-center gap-2 rounded-2xl border border-[#f4cccf] bg-[#ffefef] p-3 text-[#8d2029]">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white"><img src={residentAsset('emergency-phone.svg')} alt="" /></span>
        <span className="min-w-0 flex-1"><strong className="block text-[15px]">지금 위험한가요?</strong><span className="block text-xs">즉시 119로 연락하세요.</span></span>
        <strong className="shrink-0 rounded-xl bg-[#8d2029] px-2.5 py-2.5 text-xs text-white">119 전화하기</strong>
      </a>
      <details className="weekly-news group overflow-hidden rounded-2xl border border-line bg-white">
        <summary className="flex min-h-[46px] cursor-pointer list-none items-center gap-2 bg-[#ebefcb] px-3 py-2.5 text-brand">
          <span className="min-w-0 flex-1 text-xs font-bold">이번 주 우리 동네</span>
          <span className="shrink-0 text-[11px]">
            {stats ? `제보 ${stats.week_reports}건 · 완료 ${stats.week_done}건` : stats === false ? '집계 확인 불가' : '불러오는 중'}
          </span>
          <img src={residentAsset('weekly-chevron-up.svg')} alt="" className="rotate-180 group-open:rotate-0" />
        </summary>
        <section className="grid gap-2 p-3.5" aria-labelledby="neighborhood-news">
          <p className="text-[11px] text-sub">최근 처리 소식 · 전체 기간</p>
          <h2 id="neighborhood-news" className="text-sm font-bold">최근 제보 진행 상황</h2>
          {error ? <p role="alert" className="text-sm text-sub">제보 현황을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
            : !summary ? <p role="status" className="text-sm text-sub">불러오는 중이에요.</p>
            : summary.recent.length === 0 ? <p className="text-xs text-sub">아직 담당자가 확인한 제보가 없어요.</p>
            : <ul className="grid gap-2.5">
              {summary.recent.slice(0, 3).map((report) => (
                <li key={report.public_id} className="grid gap-2.5 rounded-2xl bg-[#f3f6f9] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{reportTitle({ ai: { category: report.category }, facility_label: report.facility_label === '모름' ? null : report.facility_label })}</strong>
                    <ReportBadge report={{ ...report, status_label: report.result_label ?? report.status_label }} />
                  </div>
                  <StatusSteps status={report.status} publicOnly />
                  {pairs[report.public_id] && <button type="button" onClick={() => setViewer(pairs[report.public_id])} className="resident-primary !min-h-11 text-xs">
                    조치 사진 확인하기 <span aria-hidden="true">›</span>
                  </button>}
                </li>
              ))}
            </ul>}
          <Link to="/map" className="flex min-h-11 items-center justify-between rounded-xl bg-[#ebefcb] px-3 text-sm font-bold">동네 지도 보기<img src={residentAsset('home-imgChev.svg')} alt="" /></Link>
        </section>
      </details>
      {viewer && <PhotoViewer before={viewer.before} after={viewer.after} onClose={() => setViewer(null)} />}

      <section className="resident-card grid gap-2.5">
        <h2 className="text-base font-bold">내 제보</h2>
        {mine === null ? <p role="status" className="text-sm text-sub">불러오는 중이에요.</p>
          : mine ? <>
            <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{reportTitle(mine)}</strong><ReportBadge report={mine} /></div>
            <StatusSteps status={mine.status} highlight />
          </> : <p className="text-xs text-sub">제보를 보내면 여기에서 처리 단계를 바로 볼 수 있어요.</p>}
        <Link to="/my" className="resident-secondary">내 활동에서 자세히 보기 <span aria-hidden="true">›</span></Link>
      </section>
    </section>
  )
}
