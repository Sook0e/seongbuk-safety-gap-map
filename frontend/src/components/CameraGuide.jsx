import { useEffect, useRef, useState } from 'react'

// 가이드 카메라: 앱 안에서 카메라를 열고 3x3 격자와 가운데 빨간 네모를 겹쳐 보여 준다.
// 문제 부분을 가운데 칸에 맞춰 찍으면 사진 구도가 비슷해지고(같은 곳을 다시 찍을 때도 비교가 쉬움), 화면에 보이는 영역 그대로 저장된다.
// 휴대폰 기본 카메라 위에는 격자를 얹을 수 없어서 getUserMedia로 직접 연다 (https 또는 localhost에서만 동작).
// 앱에서 바로 찍은 사진은 촬영 시각이 지금이다. 카메라를 못 열면 onFail로 알려 기본 방식으로 돌아가게 한다.
const ASPECT = 3 / 4 // 세로 사진 (가로 / 세로)
const MAX_SIDE = 1600

export default function CameraGuide({ onCapture, onClose, onFail }) {
  const video = useRef(null)
  const box = useRef(null)
  const stream = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return onFail('이 브라우저에서는 앱 안 카메라를 쓸 수 없어요.')
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false })
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return }
        stream.current = s
        video.current.srcObject = s
        await video.current.play()
        setReady(true)
      } catch (e) {
        onFail(e?.name === 'NotAllowedError' ? '카메라 권한이 꺼져 있어요. 권한을 켜거나 아래 앨범·기본 카메라를 이용해 주세요.' : '카메라를 열지 못했어요. 아래 앨범·기본 카메라를 이용해 주세요.')
      }
    }
    start()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { alive = false; document.removeEventListener('keydown', onKey); stream.current?.getTracks().forEach((t) => t.stop()) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function shoot() {
    const v = video.current
    if (!v?.videoWidth) return
    // 화면에 보이는 영역(object-cover로 잘린 부분)만 그대로 저장한다
    const vw = v.videoWidth
    const vh = v.videoHeight
    let sw = vw
    let sh = vh
    if (vw / vh > ASPECT) sw = vh * ASPECT
    else sh = vw / ASPECT
    const sx = (vw - sw) / 2
    const sy = (vh - sh) / 2
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh))
    const c = document.createElement('canvas')
    c.width = Math.round(sw * scale)
    c.height = Math.round(sh * scale)
    c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height)
    c.toBlob((b) => b && onCapture(new File([b], `camera-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })), 'image/jpeg', 0.9)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="가이드 카메라" className="fixed inset-0 z-[3000] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm">문제 부분이 가운데 빨간 칸 안에 오도록 맞춰 주세요</p>
        <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-lg bg-white px-4 text-sm font-semibold text-ink">닫기</button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        <div ref={box} className="relative max-h-full w-full max-w-[480px] overflow-hidden rounded-lg bg-gray-900" style={{ aspectRatio: `${ASPECT}` }}>
          <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={i === 4 ? 'border-2 border-red-600' : 'border border-white/50'} />
            ))}
          </div>
          {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm text-white">카메라를 여는 중…</p>}
        </div>
      </div>
      <div className="flex items-center justify-center py-4">
        <button type="button" onClick={shoot} disabled={!ready} aria-label="사진 찍기"
          className="h-16 w-16 rounded-full border-4 border-white bg-white/30 disabled:opacity-40" />
      </div>
    </div>
  )
}
