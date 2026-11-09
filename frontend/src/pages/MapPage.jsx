import ResidentHeader, { residentAsset } from '../components/ResidentHeader.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api.js'
import { plainCategory, plainText, PLAIN_CATEGORIES } from '../lib/labels.js'
import { addBaseLayer } from '../lib/map.js'
import PhotoViewer from '../components/PhotoViewer.jsx'
import { myReports } from '../lib/myReports.js'
import { groupPoints, MAX_CLUSTER_ZOOM } from '../lib/cluster.js'
import { REPORT_STATUS_COLORS as COLORS } from '../lib/reportStatus.js'

// 주민 3 지도. 필터: 상태(전체·검토 중·조치 중·조치 완료·재확인 필요)와 유형을 눌러서 고른다. 검색창은 없앴다(멘토·팀장 11/9). 소방용수 '점검 필요' 점은 주민이 신경 쓰는 정보가 아니라(멘토 지적) 이 화면에서 뺐고 관리자 목록에만 남김 (docs/decisions.md). 하단 시트에 선택 항목 요약.
// 배경 타일 설정은 lib/map.js (OSM 표준 타일, 출처 표기 필수)
const CENTER = [37.5894, 127.0167]
const ZONE_STYLE = { color: '#aa7894', weight: 1.5, opacity: 0.85, fillColor: '#edccd9', fillOpacity: 0.35, dashArray: '4 4' }
// 상태 필터 겸 범례: 점 색은 지도 핀 색과 같다. 지도에는 담당자가 확인을 시작한 제보만 나온다(접수 상태는 홈에 '확인 대기 N건'으로만, 11/9 팀 노션 기준)
const STATUS_FILTERS = [['all', '전체', null], ['review', '검토', COLORS.review], ['action', '조치', COLORS.action], ['done', '완료', COLORS.done], ['recheck', '재확인 필요', COLORS.recheck]]
const statusMatch = (p, key) => (key === 'all' ? true : key === 'recheck' ? !!p.recheck : p.status === key)
const catName = (p) => plainCategory(p.category) ?? '기타'
// 멀리서 보면 가까운 제보를 숫자 원으로 묶고, 확대하면 낱개로 풀린다 (lib/cluster.js)
const toLatLng = (f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]]

export default function MapPage() {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const [reports, setReports] = useState([])
  const [params] = useSearchParams()
  const [filter, setFilter] = useState(['review', 'action', 'done', 'recheck'].includes(params.get('filter')) ? params.get('filter') : 'all') // 내 활동의 '재확인 필요한 곳'에서 바로 들어오는 길
  const [cat, setCat] = useState('all') // 유형 필터
  const [selected, setSelected] = useState(null)
  const [confirmMsg, setConfirmMsg] = useState('')
  const [shots, setShots] = useState({ before: null, after: null, memo: null, loaded: false }) // 선택한 제보의 조치 전·후 사진 (눌렀을 때 불러옴)
  const [viewer, setViewer] = useState(false)
  const [view, setView] = useState({ zoom: 14, bounds: null }) // 확대·이동할 때마다 갱신 → 묶음과 '이 지역 N건'을 다시 계산

  // 나도 봤어요(+1): 같은 곳 확인 인원 → 우선순위 점수에 반영. 브라우저당 한 번
  const confirming = useRef(new Set()) // 같은 제보를 연달아 눌러도 한 번만 보낸다 (서버는 누를 때마다 +1)
  async function confirmSeen(publicId) {
    if (confirming.current.has(publicId) || myReports.confirmed(publicId)) return
    confirming.current.add(publicId)
    try {
      const r = await api.confirm(publicId)
      myReports.markConfirmed(publicId)
      setReports((list) => list.map((f) => (f.properties.public_id === publicId
        ? { ...f, properties: { ...f.properties, confirm_count: r.confirm_count, cross_checked: r.cross_checked } } : f)))
      setSelected((f) => f?.properties.public_id === publicId ? { ...f, properties: { ...f.properties, confirm_count: r.confirm_count, cross_checked: r.cross_checked } } : f)
      setConfirmMsg('확인 고마워요. 담당자 화면의 우선순위에 반영됩니다.')
    } catch (e) { confirming.current.delete(publicId); setConfirmMsg(`실패: ${e.message}`) }
  }

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: false }).setView(CENTER, 14)
    addBaseLayer(map.current)
    L.control.zoom({ position: 'bottomright' }).addTo(map.current)
    // 어린이 보호구역 경계는 제보 표시보다 아래에 둔다.
    map.current.createPane('zones').style.zIndex = 350
    api.zones().then((z) => {
      const poly = z.features.filter((f) => f.geometry.type === 'MultiPolygon' && f.properties.kind === '어린이')
      L.geoJSON({ type: 'FeatureCollection', features: poly }, {
        pane: 'zones', interactive: false, style: ZONE_STYLE,
      }).addTo(map.current)
    }).catch(() => {})
    layer.current = L.layerGroup().addTo(map.current)
    const syncView = () => setView({ zoom: map.current.getZoom(), bounds: map.current.getBounds() })
    map.current.on('zoomend moveend', syncView)
    syncView()
    api.reportsMap().then((r) => setReports(r.features)).catch(() => {})
    return () => map.current.remove()
  }, [])

  const shown = useMemo(() => {
    return reports.map((f) => ({ ...f, _color: COLORS[f.properties.status] ?? COLORS.received }))
      .filter(({ properties: p }) => (cat === 'all' || catName(p) === cat) && statusMatch(p, filter))
  }, [reports, filter, cat])
  useEffect(() => {
    layer.current.clearLayers()
    groupPoints(shown, map.current, view.zoom, toLatLng).forEach((items) => {
      if (items.length === 1) {
        const f = items[0]
        const [lon, lat] = f.geometry.coordinates
        // 조치 후 재확인 표시에는 필터와 같은 주황 테두리를 쓴다.
        const recheck = f.properties.recheck
        const icon = L.divIcon({
          className: `resident-map-pin${f.properties.status === 'done' ? ' is-done' : ''}`, iconSize: [32, 32],
          html: `<span style="background:${f._color};border-color:${recheck ? COLORS.recheck : '#fff'}"><img src="${residentAsset('home-imgPin.svg')}" alt=""></span>`,
        })
        L.marker([lat, lon], { icon, alt: plainCategory(f.properties.category) ?? '주민 제보' })
          .on('click', () => { setSelected(f); setConfirmMsg('') })
          .addTo(layer.current)
        return
      }
      const lls = items.map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]])
      const center = lls.reduce((a, c) => [a[0] + c[0] / lls.length, a[1] + c[1] / lls.length], [0, 0])
      const size = Math.min(64, 40 + items.length * 2) // 고리가 들어갈 만큼 조금 크게
      const completed = items.filter((item) => item.properties.status === 'done').length
      const percent = completed / items.length * 100
      const icon = L.divIcon({
        className: 'resident-cluster-ring', iconSize: [size, size],
        html: `<span style="background:conic-gradient(${COLORS.done} 0% ${percent}%, #d7dfe5 ${percent}% 100%)"><b>${items.length}</b></span>`,
      })
      L.marker(center, { icon, title: `제보 ${items.length}건 · 완료 ${Math.round(percent)}%` })
        .on('click', () => { setSelected(null); map.current.fitBounds(L.latLngBounds(lls), { padding: [70, 70], maxZoom: MAX_CLUSTER_ZOOM }) })
        .addTo(layer.current)
    })
  }, [shown, view.zoom])

  // 지금 지도에 보이는 영역 안의 제보 수
  const inView = useMemo(() => (view.bounds
    ? shown.filter((f) => view.bounds.contains([f.geometry.coordinates[1], f.geometry.coordinates[0]])).length : shown.length), [shown, view.bounds])

  const p = selected?.properties
  // 마커를 누르면 그 제보의 사진 주소를 불러온다 (지도 응답에는 사진을 싣지 않아 가볍게 유지)
  useEffect(() => {
    setShots({ before: null, after: null, memo: null, loaded: false }); setViewer(false)
    if (!p?.public_id) return undefined
    // 어떤 사진을 보여 줄지는 서버가 정한다: 조치 완료 제보의 사진, 그리고 서버 설정을 켰을 때 AI 공개 검수를 통과한 사진. 내 제보는 내 브라우저에서 모두 보인다
    let alive = true
    api.myReports([p.public_id], myReports.clientKey()).then((list) => { if (alive && list[0]) setShots({ before: list[0].photo_url ?? null, after: list[0].after_photo_url ?? null, memo: list[0].photos?.[0]?.memo ?? list[0].memo ?? null, loaded: true }) }).catch(() => {})
    return () => { alive = false }
  }, [p?.public_id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="resident-screen">
      <ResidentHeader caption="성북구 주민 제보" title="동네 지도" />
      <p className="text-sm leading-snug text-sub">주민이 올린 제보가 지금 어디까지 처리됐는지 보여요.</p>
      <div className="grid gap-2">
        <div role="group" aria-label="처리 상태" className="grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.7fr)] gap-1">
          {STATUS_FILTERS.map(([k, label, color]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => { setFilter(k); setSelected(null) }}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-0.5 text-[11px] font-bold leading-tight ${filter === k ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`}>
              {color && <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full" style={{ background: color }} />}{label}
            </button>
          ))}
        </div>
        <label className="relative block">
          <span className="sr-only">위험 유형</span>
          <select value={cat} onChange={(e) => { setCat(e.target.value); setSelected(null) }}
            className="min-h-[48px] w-full appearance-none rounded-xl border border-line bg-white py-2 pl-3.5 pr-10 text-[15px] font-bold text-ink">
            <option value="all">모든 위험 유형</option>
            {PLAIN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-2.5 -translate-y-[70%] rotate-45 border-b-2 border-r-2 border-ink" />
        </label>
      </div>
      <div className="relative">
        <div ref={el} className="h-[min(47dvh,440px)] min-h-60 overflow-hidden rounded-[16px] resident-neighborhood-map" aria-label="성북구 주민 제보 지도" />
        <span className="resident-chip pointer-events-none absolute left-3 top-3 z-[500] bg-white">
          {view.zoom < MAX_CLUSTER_ZOOM ? '축소 · 제보 묶음' : '확대 · 개별 위치'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-4 rounded-sm border border-dashed border-[#aa7894] bg-[#edccd9]/50" />어린이 보호구역</span>
        {filter === 'recheck' && <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full border-2 border-[#c17b29] bg-accent" />재확인 필요</span>}
      </div>
      {!p && <article className="resident-card">
        <h2 className="text-sm font-bold">이 지역 제보 {inView}건</h2>
        <p className="mt-1 text-xs text-sub">{shown.length === 0 ? '고른 조건에 맞는 제보가 없어요. 다른 상태나 유형을 눌러 보세요.' : '원 안 숫자는 제보 수, 라임색 링은 완료 비율이에요. 묶음을 누르거나 지도를 확대하면 개별 제보를 볼 수 있어요.'}</p>
      </article>}
      {viewer && <PhotoViewer before={shots.before} after={shots.after} onClose={() => setViewer(false)} />}
      {p && (
        <div className="resident-card flex flex-col gap-2.5">
          <button type="button" onClick={() => setSelected(null)} className="self-end text-xs text-sub">닫기</button>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="text-[13px] text-gray-500">주민 제보 · {p.status_label}{p.facility_label && ` · ${p.facility_label}`}</div>
              <div className="font-semibold">{plainCategory(p.category) ?? '분류 없음'}</div>
              <div className="text-[13px] text-gray-500">{new Date(p.created_at).toLocaleString('ko-KR')} · 같은 곳 확인 {p.confirm_count ?? 0}명{p.cross_checked && ' · 교차확인'}</div>
            </div>
            {(shots.before || shots.after) && (
              <div className="flex shrink-0 gap-1.5">
                {[[shots.before, shots.after ? '조치 전' : '제보 사진'], [shots.after, '조치 후']].filter(([src]) => src).map(([src, label]) => (
                  <button key={label} type="button" onClick={() => setViewer(true)} aria-label={`${label} 사진 크게 보기`}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-line">
                    <img src={src} alt={label} className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[11px] font-semibold text-white">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {shots.memo && <p className="text-[13px] leading-snug">{plainText(shots.memo)}</p>}
          {shots.loaded && !shots.before && !shots.after && !shots.memo && (
            <p className="text-xs text-sub">이 제보의 사진과 설명은 개인정보 보호를 위해 공개하지 않아요.</p>
          )}
          {p.recheck && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-snug">조치 완료 뒤에도 '아직 그대로'라는 주민 의견이 더 많은 곳이에요. 담당자가 다시 확인합니다.</p>}
          {p.status !== 'done' && (
            <button type="button" disabled={myReports.confirmed(p.public_id) || myReports.ids().includes(p.public_id)}
              onClick={() => confirmSeen(p.public_id)}
              className="resident-chip self-start bg-[#ebefcb] disabled:opacity-40">
              {myReports.confirmed(p.public_id) ? '확인했어요' : '나도 봤어요 (+1)'}
            </button>
          )}
          {confirmMsg && <p className="mt-1 text-[13px] text-gray-600">{confirmMsg}</p>}
        </div>
      )}
    </section>
  )
}
