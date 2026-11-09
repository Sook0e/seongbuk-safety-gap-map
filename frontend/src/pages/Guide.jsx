import { Link } from 'react-router-dom'
import ResidentHeader, { residentAsset } from '../components/ResidentHeader.jsx'

const FEATURES = [
  ['/report', '제보하기', '사진과 위치를 보내기', 'Camera'],
  ['/map', '동네 지도', '제보 위치와 처리 상태 보기', 'Map'],
  ['/my', '내 활동', '내 제보와 활동 안내 보기', 'List'],
]

const STEPS = [
  ['사진 제보', '위험한 곳을 안전한 거리에서 찍고 위치와 설명을 확인해요.'],
  ['담당자 검토', '담당자가 내용을 확인하고 조치할 부서를 정해요.'],
  ['현장 조치', '담당 부서가 현장을 확인하고 필요한 조치를 해요.'],
  ['결과 확인', '내 활동에서 처리 결과와 조치 전·후 사진을 봐요.'],
]

export default function Guide() {
  return (
    <section className="resident-screen">
      <ResidentHeader caption="우리 동네 안전 체크!" title="서비스 안내" />
      <section className="grid gap-2" aria-labelledby="guide-features">
        <p className="text-[11px] font-bold text-sub">화면 바로가기</p>
        <h2 id="guide-features" className="text-lg font-bold">기능별 안내</h2>
        <p className="text-xs text-sub">카드를 누르면 해당 화면으로 이동해요.</p>
        <ul className="mt-1 grid gap-2.5">
          {FEATURES.map(([to, title, text, icon]) => (
            <li key={to}>
              <Link to={to} className="flex min-h-16 items-center gap-3 rounded-2xl bg-brand p-3 text-white">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white"><img src={residentAsset(`home-img${icon}.svg`)} alt="" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">{title}</strong><span className="block text-xs text-white/80">{text}</span></span>
                <span aria-hidden="true" className="px-2">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-2 grid gap-2 border-t border-line pt-5" aria-labelledby="guide-process">
        <p className="text-[11px] font-bold text-[#4c6345]">처리 흐름</p>
        <h2 id="guide-process" className="text-lg font-bold">제보 처리 과정</h2>
        <p className="text-xs text-sub">제보를 보내면 아래 순서로 처리돼요.</p>
        <ol className="mt-1 grid rounded-[20px] bg-[#eef2f7] px-4 py-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="relative grid grid-cols-[30px_1fr] gap-3 pb-4 last:pb-0">
              {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[14px] top-5 w-0.5 bg-[#a8bbd4]" />}
              <span className="relative grid size-[30px] place-items-center rounded-full bg-brand text-xs font-bold text-white" aria-hidden="true">{i + 1}</span>
              <div className="pt-1"><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-sub">{text}</p></div>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-1 grid gap-2 rounded-[20px] bg-[#ebefcb] p-3.5">
        <h2 className="text-base font-bold">안전왕 순위와 활동 혜택</h2>
        <p className="text-xs leading-relaxed">담당자가 확인한 제보 1건에 10점이 쌓여요. 접수만으로는 점수가 생기지 않아요.</p>
        <h3 className="text-sm font-bold">포인트 · 봉사시간은 준비 중</h3>
        <p className="text-xs leading-relaxed text-sub">순위 점수는 포인트나 봉사시간으로 교환할 수 있는 적립금이 아니에요.</p>
      </section>
    </section>
  )
}
