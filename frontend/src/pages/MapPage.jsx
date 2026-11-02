import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api.js'
import { addBaseLayer } from '../lib/map.js'
import { myReports } from '../lib/myReports.js'

// 주민 3 지도. 필터: 전체 / 주민 제보 / 조치 완료. 소방용수 '점검 필요' 점은 주민이 신경 쓰는 정보가 아니라(멘토 지적) 이 화면에서 뺐고 관리자 목록에만 남김 (docs/decisions.md). 하단 시트에 선택 항목 요약.
// 배경 타일 설정은 lib/map.js (OSM 표준 타일, 출처 표기 필수)
const CENTER = [37.5894, 127.0167]
const COLORS = { received: '#f59e0b', review: '#3b82f6', action: '#8b5cf6', done: '#16a34a' }
const FILTERS = [['all', '전체'], ['resident', '주민 제보'], ['done', '조치 완료']]
const LEGEND = [['received', '접수'], ['review', '검토·조치 중'], ['done', '조치 완료']]

export default function MapPage() {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const [reports, setReports] = useState([])
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [confirmMsg, setConfirmMsg] = useState('')

  // 나도 봤어요(+1): 같은 곳 확인 인원 → 우선순위 점수에 반영. 브라우저당 한 번
  async function confirmSeen(publicId) {
    try {
      const r = await api.confirm(publicId)
      myReports.markConfirmed(publicId)
      setReports((list) => list.map((f) => (f.properties.public_id === publicId
        ? { ...f, properties: { ...f.properties, confirm_count: r.confirm_count, cross_checked: r.cross_checked } } : f)))
      setSelected((f) => ({ ...f, properties: { ...f.properties, confirm_count: r.confirm_count, cross_checked: r.cross_checked } }))
      setConfirmMsg('확인 고마워요. 담당자 화면의 우선순위에 반영됩니다.')
    } catch (e) { setConfirmMsg(`실패: ${e.message}`) }
  }

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: false }).setView(CENTER, 14)
    addBaseLayer(map.current)
    // 어린이보호구역 경계: 얇은 회색 선. 제보·공백 점보다 아래에 깔고, 눌러도 반응하지 않음
    map.current.createPane('zones').style.zIndex = 350
    api.zones().then((z) => {
      const poly = z.features.filter((f) => f.geometry.type === 'MultiPolygon' && f.properties.kind === '어린이')
      L.geoJSON({ type: 'FeatureCollection', features: poly }, {
        pane: 'zones', interactive: false, style: { color: '#dc2626', weight: 1.5, opacity: 0.8, fillColor: '#f87171', fillOpacity: 0.2 }, // 어린이보호구역 도로 포장색(빨강). 회색 '점검 필요'·주황 '접수' 점과 구분
      }).addTo(map.current)
    }).catch(() => {})
    layer.current = L.layerGroup().addTo(map.current)
    api.reportsMap().then((r) => setReports(r.features)).catch(() => {})
    return () => map.current.remove()
  }, [])

  const shown = useMemo(() => {
    const repPts = reports.map((f) => ({ ...f, _color: COLORS[f.properties.status] ?? COLORS.received }))
    if (filter === 'done') return repPts.filter((f) => f.properties.status === 'done')
    return repPts
  }, [reports, filter])

  useEffect(() => {
    layer.current.clearLayers()
    shown.forEach((f) => {
      const [lon, lat] = f.geometry.coordinates
      L.circleMarker([lat, lon], { radius: 6, color: f._color, fillColor: f._color, fillOpacity: 0.8, weight: 1 })
        .on('click', () => { setSelected(f); setConfirmMsg('') })
        .addTo(layer.current)
    })
  }, [shown])

  const p = selected?.properties
  return (
    <div className="relative h-full">
      <div ref={el} className="absolute inset-0" />
      <div className="absolute inset-x-0 top-0 z-[1000] flex flex-wrap gap-1.5 px-4 pt-4">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`h-[34px] rounded-full px-3 text-[13px] ${filter === k ? 'bg-ink text-white' : 'border border-line bg-white text-ink'}`}>{label}</button>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1 rounded-[10px] border border-line bg-white px-2.5 py-2 text-[11px]">
        {LEGEND.map(([k, label]) => (
          <div key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[k] }} />{label}</div>
        ))}
        <div className="flex items-center gap-1"><span className="h-2 w-3 border border-red-600 bg-red-300" />어린이보호구역</div>
      </div>
      {p && (
        <div className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col gap-2.5 rounded-t-[20px] border-t border-line bg-white px-5 pb-4 pt-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto h-1 w-10 rounded bg-line" />
          <button type="button" onClick={() => setSelected(null)} className="float-right text-sm text-sub">닫기</button>
          <div className="text-xs text-gray-500">주민 제보 · {p.status_label}{p.facility_label && ` · ${p.facility_label}`}</div>
          <div className="font-semibold">{p.category ?? '분류 없음'}</div>
          <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString('ko-KR')} · 같은 곳 확인 {p.confirm_count ?? 0}명{p.cross_checked && ' · 교차확인'}</div>
          {p.status !== 'done' && (
            <button type="button" disabled={myReports.confirmed(p.public_id) || myReports.ids().includes(p.public_id)}
              onClick={() => confirmSeen(p.public_id)}
              className="mt-2 h-[46px] w-full rounded-xl bg-brand text-[15px] font-semibold text-white disabled:opacity-40">
              {myReports.confirmed(p.public_id) ? '확인했어요' : '나도 봤어요 (+1)'}
            </button>
          )}
          {confirmMsg && <p className="mt-1 text-xs text-gray-600">{confirmMsg}</p>}
        </div>
      )}
    </div>
  )
}
