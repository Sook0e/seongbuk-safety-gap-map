// 사진을 올리기 전에 보여 주는 촬영 가이드. 사진을 3x3 격자로 나눠 문제 부분이 가운데 칸에 크게 오도록 찍는 예시다.
// 직접 그린 그림이라 저작권 문제가 없고, 앱 안 카메라가 아니라 안내만 한다 (사진은 기본 카메라나 앨범으로 올림).
// 좋은 예 1개와 안 좋은 예 2개(너무 멀리, 한쪽으로 치우침)를 같은 격자 위에 보여 준다.

// 벽 그림: 회색 벽, 블록 줄눈, 균열 하나. crack은 균열 선 좌표, scale은 균열 크기 배율
function Wall({ crack, strokeWidth }) {
  return (
    <svg viewBox="0 0 120 160" className="block h-full w-full" role="img" aria-hidden="true">
      <rect width="120" height="160" fill="#b8bbb3" />
      {[32, 64, 96, 128].map((y) => <line key={y} x1="0" y1={y} x2="120" y2={y} stroke="#a3a69e" strokeWidth="0.8" />)}
      <polyline points={crack} fill="none" stroke="#2b2b2b" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {/* 3x3 격자와 가운데 칸 */}
      <g stroke="#ffffff" strokeOpacity="0.65" strokeWidth="0.7">
        <line x1="40" y1="0" x2="40" y2="160" /><line x1="80" y1="0" x2="80" y2="160" />
        <line x1="0" y1="53.3" x2="120" y2="53.3" /><line x1="0" y1="106.6" x2="120" y2="106.6" />
      </g>
      <rect x="40" y="53.3" width="40" height="53.4" fill="none" stroke="#dc2626" strokeWidth="1.2" />
    </svg>
  )
}

const CASES = [
  { ok: true, title: '이렇게', desc: '문제 부분이 가운데 칸에 크게', crack: '46,62 54,74 50,84 60,94 56,104 66,100', w: 2.4 },
  { ok: false, title: '너무 멀어요', desc: '작게 보이면 알아보기 어려워요', crack: '58,76 61,80 59,84 62,88', w: 1 },
  { ok: false, title: '치우쳤어요', desc: '가운데에서 벗어났어요', crack: '6,8 14,20 10,30 20,40 16,50 26,46', w: 2.4 },
]

export default function PhotoGuide() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
      <p className="text-sm font-semibold">이렇게 찍어 주세요</p>
      <p className="break-keep text-[13px] leading-snug text-sub"><span className="block">사진을 가로세로 3칸씩 9칸으로 나눈다고 생각하고,</span><span className="block text-balance">문제 부분이 가운데 빨간 칸에 오도록 맞춰 찍어 주세요.</span></p>
      <div className="grid grid-cols-3 gap-2">
        {CASES.map((c) => (
          <figure key={c.title} className="flex flex-col gap-1">
            <div className={`aspect-[3/4] overflow-hidden rounded-lg border-2 ${c.ok ? 'border-brand' : 'border-line'}`}>
              <Wall crack={c.crack} strokeWidth={c.w} />
            </div>
            <figcaption className="text-[13px] leading-snug">
              <span className={`font-semibold ${c.ok ? 'text-brand' : 'text-danger'}`}>{c.title}</span>
              <span className="block break-keep text-balance text-sub">{c.desc}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
