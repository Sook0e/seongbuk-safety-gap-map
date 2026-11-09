import ResidentHeader, { residentAsset } from '../components/ResidentHeader.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BeforeAfter from '../components/BeforeAfter.jsx'
import ClientIdBox from '../components/ClientIdBox.jsx'
import PhotoModal from '../components/PhotoModal.jsx'
import StatusSteps from '../components/StatusSteps.jsx'
import { api } from '../lib/api.js'
import { formatTaken } from '../lib/exif.js'
import { myReports } from '../lib/myReports.js'
import { dateTimeText } from '../lib/time.js'
import { plainCategory } from '../lib/labels.js'

// 주민 4 내 제보: 상태 진행, 조치 전·후 비교, 조치 결과 확인(고쳐졌어요/아직 그대로예요), 재발 안내, 처리 이력, 담당 부서 메모.
// 이 화면을 열면 '확인한 시각'을 저장해 하단바 빨간 점이 꺼진다.
// 화면을 열어 둔 채로 담당자가 처리해도 바뀌도록 15초마다, 그리고 다른 앱에서 돌아올 때 다시 불러온다
// (하단바 빨간 점 확인 주기와 같은 15초. 푸시 알림은 만들지 않음).
const REFRESH_MS = 15000

function useMyReports(markSeen) {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const loaded = useRef(false)
  const version = useRef(0)
  useEffect(() => {
    let alive = true
    const load = () => {
      const request = ++version.current
      return api.myReports(myReports.ids(), myReports.clientKey())
        .then((r) => {
          if (!alive || request !== version.current) return
          setList(r)
          setError('')
          loaded.current = true
          // 새 소식이 있을 때만 확인 시각을 갱신 (매번 저장하면 하단바가 그때마다 다시 조회함)
          if (markSeen && myReports.hasNews(r)) myReports.markSeen()
        })
        .catch((e) => { if (alive && request === version.current && !loaded.current) setError(e.message) }) // 이미 보이는 목록이 있으면 새로고침 실패는 조용히 넘김
    }
    const onVisible = () => { if (document.visibilityState === 'visible') load() }

    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [markSeen])

  return { list, setList, error, invalidate: () => { version.current += 1 } }
}

export const reportTitle = (report) => [plainCategory(report.ai?.category) ?? '분류 없음', report.facility_label].filter(Boolean).join(' · ')

export function ReportBadge({ report }) {
  const color = report.not_target ? 'bg-gray-200 text-sub' : {
    done: 'bg-[#ebefcb] text-brand',
    review: 'bg-[#e8effa] text-[#254c85]',
    action: 'bg-[#e5f1f1] text-[#235c64]',
  }[report.status] ?? 'bg-gray-200 text-ink'
  return <span className={`resident-chip self-start ${color}`}>{report.not_target ? '처리 대상 아님' : (report.status_label ?? report.status)}</span>
}

function ReportBack({ to, children }) {
  return <Link to={to} className="resident-secondary self-start px-3" aria-label={`${children} 돌아가기`}><span aria-hidden="true">‹</span> {children}</Link>
}

function Activity({ list, error }) {
  const [spots, setSpots] = useState(null) // 학생 활동 카드: 지도 데이터로 센 값 {recheck, crowded}
  useEffect(() => {
    api.reportsMap().then(({ features }) => {
      const cells = new Map() // 약 200m 칸으로 나눠 제보가 3건 이상 몰린 곳을 센다
      features.forEach(({ geometry: { coordinates: [lon, lat] } }) => { const k = `${Math.round(lat / 0.002)}:${Math.round(lon / 0.002)}`; cells.set(k, (cells.get(k) ?? 0) + 1) })
      setSpots({ recheck: features.filter(({ properties }) => properties.recheck).length, crowded: [...cells.values()].filter((n) => n >= 3).length })
    }).catch(() => setSpots(null))
  }, [])
  const [score, setScore] = useState(undefined) // 내 점수·순위 (undefined: 불러오는 중, null: 아직 순위 없음)
  useEffect(() => {
    api.ranking(1, myReports.clientKey()).then((r) => setScore(r.me ?? null)).catch(() => setScore(null))
  }, [])

  return (
    <section className="resident-screen">
      <ResidentHeader caption="접수부터 완료까지" title="내 활동" />
      <section className="relative grid gap-3 rounded-[20px] bg-[#ebefcb] p-4">
        <div className="flex min-h-[68px] items-center justify-between gap-2">
          <div>
            <span className="resident-chip bg-white">준비 중</span>
            <h2 className="mt-1 text-lg font-bold">포인트 · 봉사시간</h2>
          </div>
          <img src={residentAsset('safety-mascot.png')} width="76" height="76" alt="" className="object-contain" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[['activity-coins.svg', '포인트'], ['activity-timer.svg', '봉사시간']].map(([icon, label]) =>
            <div key={label} className="flex items-center gap-2 rounded-xl bg-white p-2 text-xs font-bold">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e9eff7]"><img src={residentAsset(icon)} alt="" /></span>{label}
            </div>
          )}
        </div>
        <p className="text-xs text-sub">현재 포인트와 봉사시간은 지급하지 않아요.</p>
      </section>
      <section className="resident-card grid gap-2">
        <h2 className="text-sm font-bold">내 점수</h2>
        {score ? <><p className="text-xl font-bold">{score.points}점 · {score.rank}위</p><p className="text-xs text-sub">확인된 제보 {score.count}건 · 순위에 반영</p></>
          : <p className="text-sm text-sub">{score === undefined ? '불러오는 중이에요.' : '담당자가 확인한 제보가 생기면 점수가 쌓여요.'}</p>}
      </section>
      <section className="resident-card grid gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">내 제보</h2>
          {list && <span className="text-lg font-bold">{list.length}건</span>}
        </div>
        <p className="text-xs text-sub">{error ? '제보 건수를 불러오지 못했어요.' : '이 브라우저에서 보낸 제보를 확인할 수 있어요.'}</p>
        <Link to="/my/reports" className="resident-secondary">내 제보 보기 <span aria-hidden="true">›</span></Link>
      </section>
      <section aria-label="학생이 할 수 있는 일" className="rounded-[20px] bg-[#ebefcb] p-3.5">
        <h2 className="text-base font-bold">학생이 할 수 있는 일</h2>
        <p className="mt-1 text-xs text-sub">모인 제보 중에서 학생이 직접 도울 수 있는 일을 골라 두었어요.</p>
        <ul className="mt-3 grid gap-2.5">
          <li className="rounded-xl bg-white p-3">
            <h3 className="text-sm font-bold">조치 후 재확인</h3>
            <p className="mt-0.5 text-xs leading-snug text-sub">고쳐졌다고 한 곳에 다시 가서 사진으로 확인해요.</p>
            <Link to="/map?filter=recheck" className="mt-1 grid min-h-[44px] items-center text-sm font-bold underline">{spots ? `재확인이 필요한 곳 ${spots.recheck}곳 보기` : '지도에서 재확인이 필요한 곳 보기'}</Link>
          </li>
          <li className="rounded-xl bg-white p-3">
            <h3 className="text-sm font-bold">봉사 순찰</h3>
            <p className="mt-0.5 text-xs leading-snug text-sub">제보가 적은 골목을 돌며 위험한 곳을 찾아요.</p>
            <Link to="/report" className="mt-1 grid min-h-[44px] items-center text-sm font-bold underline">발견하면 제보하기</Link>
          </li>
          <li className="rounded-xl bg-white p-3">
            <h3 className="text-sm font-bold">주의 안내</h3>
            <p className="mt-0.5 text-xs leading-snug text-sub">제보가 몰린 곳에 미끄럼·통행 주의 안내를 해요. 구청이 허가한 범위 안에서만 해요.</p>
            <Link to="/map" className="mt-1 grid min-h-[44px] items-center text-sm font-bold underline">{spots ? `제보가 많은 곳 ${spots.crowded}곳 보기` : '지도에서 제보가 많은 곳 보기'}</Link>
          </li>
        </ul>
      </section>
      <ClientIdBox />
      <Link to="/guide" className="resident-card flex min-h-16 items-center gap-3">
        <img src={residentAsset('home-imgList.svg')} alt="" />
        <span className="min-w-0 flex-1"><strong className="block text-sm">서비스 안내</strong><span className="text-xs text-sub">안전캐치 이용 방법을 알아봐요.</span></span>
        <span aria-hidden="true">›</span>
      </Link>
    </section>
  )
}

function ReportList({ list, error }) {
  return (
    <section className="resident-screen">
      <ReportBack to="/my">내 활동</ReportBack>
      <ResidentHeader caption="내 활동" title="내 제보" />
      {error ? <p role="alert" className="text-sm text-danger">불러오기 실패: {error}</p>
        : !list ? <p role="status" className="text-sm text-sub">불러오는 중이에요.</p>
        : list.length === 0 ? <p className="resident-card text-sm text-sub">아직 이 브라우저에서 보낸 제보가 없어요.</p>
        : <>
          <h2 className="text-sm font-bold">보낸 제보 {list.length}건</h2>
          <ul className="grid gap-3.5">
            {list.map((report) => (
              <li key={report.public_id}>
                <Link to={`/my/reports/${encodeURIComponent(report.public_id)}`} className="resident-card flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col items-start gap-1.5">
                    <ReportBadge report={report} />
                    <strong className="text-[15px]">{reportTitle(report)}</strong>
                    <span className="text-xs text-sub">{new Date(report.created_at).toLocaleDateString('ko-KR')} · 접수번호 {report.public_id}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>}
    </section>
  )
}

function ReportDetail({ id, list, setList, error, invalidate }) {
  const [viewer, setViewer] = useState(null)
  const [voteMsg, setVoteMsg] = useState({})
  const navigate = useNavigate()
  async function cancel(r) {
    if (!window.confirm('이 제보를 취소할까요? 취소하면 제보와 사진이 삭제되고 되돌릴 수 없어요.')) return
    try {
      await api.cancelReport(r.public_id, myReports.clientKey())
      myReports.remove(r.public_id)
      invalidate()
      setList((rows) => rows.filter((row) => row.public_id !== r.public_id))
      navigate('/my/reports', { replace: true })
    } catch (e) { setVoteMsg((m) => ({ ...m, [r.public_id]: e.message })) }
  }

  async function vote(r, kind) {
    try {
      const out = await api.feedback(r.public_id, kind, myReports.clientKey())
      myReports.setVote(r.public_id, kind)
      invalidate()
      setList((l) => l.map((x) => (x.public_id === r.public_id ? out : x)))
      setVoteMsg((m) => ({ ...m, [r.public_id]: kind === 'not_fixed'
        ? "알려 주셔서 고맙습니다. '아직 그대로'라는 의견이 모이면 담당자가 다시 확인합니다."
        : '알려 주셔서 고맙습니다. 고쳐진 것으로 기록했어요.' }))
    } catch (e) { setVoteMsg((m) => ({ ...m, [r.public_id]: `실패: ${e.message}` })) }
  }

  const r = list?.find((report) => report.public_id === id)
  if (!r) return (
    <section className="resident-screen">
      <ReportBack to="/my/reports">내 제보 목록</ReportBack>
      <ResidentHeader caption="내 활동" title="제보 상세" />
      {error ? <p role="alert" className="text-sm text-danger">불러오기 실패: {error}</p>
        : <p role="status" className="text-sm text-sub">{list ? '이 브라우저에서 보낸 제보를 찾을 수 없어요.' : '불러오는 중이에요.'}</p>}
    </section>
  )
  // 접수 후 경과일, 완료까지 걸린 일수, 처리 대상 아님 사유 (리뷰: '처리 상황도 이유도 모른다'는 불만 대응)
  const days = (a, b = Date.now()) => Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
  const progress = (r) => {
    if (r.status === 'done') {
      const at = [...r.history].reverse().find((h) => h.to_status === 'done')?.at
      const n = at ? days(r.created_at, at) : null
      return n === null ? '조치 완료' : n === 0 ? '접수 당일 조치 완료' : `접수 후 ${n}일 만에 조치 완료`
    }
    const n = days(r.created_at)
    return n === 0 ? '오늘 접수' : `접수 후 ${n}일째`
  }
  // 처리 이력: 상태가 바뀐 날짜와 시스템이 남긴 재발 기록만 보여 준다 (담당자가 적은 내부 메모는 보이지 않음)
  const timeline = (r) => r.history
    .filter((h) => h.from_status !== h.to_status || (h.note ?? '').includes('재발'))
    .map((h) => ({ at: h.at, text: h.from_status === h.to_status ? h.note : h.to_status_label }))
  // 단계별 시각: 접수는 접수한 때, 나머지는 그 상태로 처음 바뀐 때 (건너뛴 단계는 비어 있음)
  const stepTimes = (r) => Object.fromEntries(['received', 'review', 'action', 'done'].map((k) => [k, k === 'received' ? r.created_at : r.history.find((h) => h.to_status === k)?.at]))
  const ac = r.aftercare ?? { fixed: 0, not_fixed: 0, recurrence: null }
  const mine = myReports.vote(r.public_id)
  const photos = (r.photos?.length ? r.photos : [{ photo_url: r.photo_url }]).filter((p) => p.photo_url)
  const history = timeline(r)
  const compare = r.photo_url && r.after_photo_url // 조치 후 사진이 올라오면 완료 처리 전이라도 바로 전·후를 비교해 볼 수 있게
  return (
    <section className="resident-screen">
      <ReportBack to="/my/reports">내 제보 목록</ReportBack>
      <ResidentHeader caption="내 활동" title="제보 상세" />
      <PhotoModal src={viewer?.src} title={viewer?.title} onClose={() => setViewer(null)} />
      <article className="resident-card flex flex-col gap-3.5">
        <div className="flex flex-col items-start gap-2">
          <ReportBadge report={r} />
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold leading-snug">{reportTitle(r)}</span>
            <span className="text-[13px] text-sub">{new Date(r.created_at).toLocaleDateString('ko-KR')} · 접수번호 {r.public_id}</span>
          </div>
        </div>
        {r.not_target
          ? <p className="rounded-lg bg-page px-3 py-2.5 text-sm leading-normal">담당자가 확인한 결과, 처리 대상이 아니라고 판단했습니다.{r.dept_note ? ` 이유: ${r.dept_note}` : ' 이유는 담당 부서에 문의해 주세요.'}</p>
          : <><StatusSteps status={r.status} times={stepTimes(r)} /><p className="text-sm font-medium text-brand">{progress(r)}</p></>}
        {ac.recurrence && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-normal">같은 곳에서 조치된 지 {ac.recurrence.days_after_done}일 만에 다시 제보된 곳이에요. 재발로 담당자에게 전달됩니다.</p>
        )}
        {compare && <BeforeAfter before={r.photo_url} after={r.after_photo_url} />}
        {photos.length > 0 && <h2 className="text-sm font-bold">제보 사진 {photos.length}장</h2>}
        <div className="grid grid-cols-2 gap-2">
          {photos.filter((_, i) => !(compare && i === 0)).map((p, i) => (
            <figure key={p.photo_url} className="flex flex-col gap-1">
              <button type="button" onClick={() => setViewer({ src: p.photo_url, title: `제보 사진 ${i + 1}` })} aria-label={`제보 사진 ${i + 1} 크게 보기`} className="block w-full">
                <img src={p.photo_url} alt={`제보 사진 ${i + 1}`} className="h-24 w-full rounded-lg object-cover" />
              </button>
              <figcaption className="text-[13px] leading-snug text-sub">{p.taken_at ? `촬영 ${formatTaken(p.taken_at)}` : '제보 사진'}{p.memo && <span className="block text-ink">{p.memo}</span>}</figcaption>
            </figure>
          ))}
          {!compare && r.after_photo_url && <figure className="flex flex-col gap-1"><button type="button" onClick={() => setViewer({ src: r.after_photo_url, title: '조치 후 사진' })} aria-label="조치 후 사진 크게 보기" className="block w-full"><img src={r.after_photo_url} alt="조치 후 사진" className="h-24 w-full rounded-lg object-cover" /></button><figcaption className="text-[13px] text-sub">조치 후 사진</figcaption></figure>}
        </div>
        {r.status === 'done' && !r.not_target && (
          <div className="flex flex-col gap-2 rounded-lg bg-page p-3">
            <p className="text-sm font-semibold">조치 결과가 맞나요?</p>
            <div className="grid grid-cols-2 gap-2">
              {[['fixed', '고쳐졌어요'], ['not_fixed', '아직 그대로예요']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => vote(r, k)} aria-pressed={mine === k}
                  className={`h-11 rounded-lg border text-sm font-semibold ${mine === k ? 'border-brand bg-brand text-white' : 'border-brand bg-white text-brand'}`}>{label}</button>
              ))}
            </div>
            <p className="text-[13px] text-sub">주민 확인: 고쳐졌어요 {ac.fixed}명 · 아직 그대로 {ac.not_fixed}명</p>
            {voteMsg[r.public_id] && <p className="text-[13px] text-ink">{voteMsg[r.public_id]}</p>}
          </div>
        )}
        {r.status === 'received' && !r.not_target && (
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => cancel(r)} className="h-11 self-start rounded-lg border border-line px-3 text-[13px] font-medium text-danger">제보 취소하기</button>
            {voteMsg[r.public_id] && <p className="text-[13px] text-sub">{voteMsg[r.public_id]}</p>}
          </div>
        )}
        {(r.dept || (!r.not_target && r.dept_note)) && (
          <div className="rounded-lg bg-page px-3 py-2.5 text-sm leading-normal">
            <p className="text-[13px] font-semibold text-sub">담당 부서{r.dept && ` · ${r.dept}`}</p>
            {!r.not_target && r.dept_note && <p className="mt-1">{r.dept_note}</p>}
          </div>
        )}
        {history.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer py-1 font-medium text-brand">처리 이력 보기</summary>
            <ol className="mt-1.5 flex flex-col gap-1 border-l-2 border-line pl-3">
              {history.map((t, i) => (
                <li key={i} className="text-[13px] leading-snug"><span className="text-sub">{dateTimeText(t.at)}</span> · {t.text}</li>
              ))}
            </ol>
          </details>
        )}
      </article>
    </section>
  )
}

export default function MyReports({ mode }) {
  const data = useMyReports(mode !== 'activity')
  const { id } = useParams()
  if (mode === 'activity') return <Activity {...data} />
  if (mode === 'list') return <ReportList {...data} />
  return <ReportDetail key={id} id={id} {...data} />
}
