import { useState } from 'react'
import { myReports } from '../lib/myReports.js'

// 이 브라우저의 식별번호(앞 8자리)를 본인이 볼 수 있게 한다. 제보를 보낼 때 함께 저장되고, 담당자 화면에는 같은 8자리가 나온다.
// 이름·연락처가 아니라 브라우저가 만든 무작위 값이며, 같은 브라우저에서 반복·몰아서 올린 제보를 가려내는 데만 쓴다.
export default function ClientIdBox() {
  const [code, setCode] = useState(() => myReports.clientCode())
  const [msg, setMsg] = useState('')
  const [nick, setNick] = useState(() => myReports.nickname())
  const [saved, setSaved] = useState(false)
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">이 브라우저의 식별번호</span>
        <span className="rounded bg-page px-2 py-1 font-mono text-[15px] tracking-wider text-ink">{code}</span>
      </div>
      <p className="text-[13px] leading-snug text-sub">제보를 보낼 때 이 번호가 함께 저장돼요. 같은 브라우저에서 반복해서 올린 제보를 담당자가 가려내는 데만 쓰고, 이름이나 연락처가 아니라서 누구인지는 알 수 없어요. 브라우저 데이터를 지우면 새 번호가 생겨요.</p>
      <label className="flex flex-col gap-1 text-[13px] text-sub">별명 (선택, 20자까지)
        <div className="flex gap-2">
          <input value={nick} maxLength={20} onChange={(e) => { setNick(e.target.value); setSaved(false) }} placeholder="예: 안암동 주민"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-[15px] text-ink" />
          <button type="button" onClick={() => { myReports.setNickname(nick); setSaved(true) }} className="h-11 shrink-0 rounded-lg bg-brand px-4 text-sm font-semibold text-white">저장</button>
        </div>
        <span>{saved ? '저장했어요. 앱을 껐다 켜도 이 브라우저에서는 유지돼요.' : '실명이나 연락처는 쓰지 마세요. 담당자 화면에 이 별명이 보여요.'}</span>
      </label>
      <button type="button" onClick={() => { setCode(myReports.resetClientKey()); setMsg('새 번호로 바꿨어요. 이전 제보에 저장된 번호는 그대로예요.') }}
        className="h-11 self-start rounded-lg border border-line px-3 text-[13px] font-medium text-ink">새 번호로 바꾸기</button>
      {msg && <p className="text-[13px] text-sub">{msg}</p>}
    </div>
  )
}
