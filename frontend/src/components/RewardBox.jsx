import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { myReports } from '../lib/myReports.js'

// 내 제보 화면의 '내 포인트' 카드. 제보는 로그인 없이 하고, 포인트를 기프티콘으로 바꿀 때만 전화번호 인증을 한다.
// 인증은 2시간 유효하고 이 카드를 열 때마다 연장된다(서버가 관리). 문자 발송은 아직 연동 전이라 '테스트 인증'으로 인증번호를 화면에 보여 준다.
const won = (n) => `${Number(n).toLocaleString('ko-KR')}P`
const dateText = (iso) => new Date(iso).toLocaleDateString('ko-KR')

export default function RewardBox() {
  const key = myReports.clientKey()
  const [me, setMe] = useState(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sentCode, setSentCode] = useState(null) // 테스트 인증: 서버가 알려 준 인증번호
  const [amount, setAmount] = useState(3000)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.rewardsMe(key).then(setMe).catch(() => setMe(null))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn, okMsg) {
    setBusy(true); setMsg('')
    try { const r = await fn(); if (okMsg) setMsg(okMsg); return r } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  const requestCode = () => run(async () => { const r = await api.rewardPhoneRequest(key, phone); setSentCode(r.code) }, '인증번호를 보냈어요.')
  const verify = () => run(async () => { await api.rewardPhoneVerify(key, phone, code); setCode(''); setSentCode(null); await load() }, '전화번호 인증이 끝났어요.')
  const redeem = () => run(async () => { await api.rewardRedeem(key, amount); await load() }, '교환을 신청했어요. 담당자가 확인한 뒤 기프티콘을 보내 드려요.')

  if (!me) return null
  const m = me.month
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">내 포인트</span>
        <span className="text-lg font-bold text-brand">{won(me.balance)}</span>
      </div>
      <p className="text-[13px] leading-snug text-sub">담당자가 확인해 승인한 제보에만 포인트가 쌓여요. 일반 1,000P, 긴급 3,000P. 같은 곳에서 이미 적립된 제보와 월 한도({m.count_limit}건·{won(m.points_limit)})를 넘은 제보는 쌓이지 않아요. 이번 달 {m.count}건 · {won(m.points)} 적립.</p>

      {me.entries.length > 0 && (
        <ul className="flex flex-col gap-1 border-l-2 border-line pl-3">
          {me.entries.slice(0, 5).map((e) => (
            <li key={e.public_id} className="text-[13px] leading-snug">
              <span className="text-sub">{dateText(e.at)}</span> · {e.points > 0 ? `+${won(e.points)}` : '0P'}{e.grade === 'urgent' && e.points > 0 ? ' (긴급)' : ''}{e.note ? ` · ${e.note}` : ''}
            </li>
          ))}
        </ul>
      )}

      {me.verified ? (
        <div className="flex flex-col gap-2 rounded-lg bg-page p-2.5">
          <p className="text-[13px] text-sub">전화번호 인증됨 (010-****-{me.phone_last4}) · {me.session_hours}시간 동안 유효하고 이 화면을 열 때마다 연장돼요.</p>
          <div className="flex gap-2">
            <input type="number" min={me.min_redeem} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              aria-label="교환할 포인트" className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-[15px] text-ink" />
            <button type="button" onClick={redeem} disabled={busy || amount < me.min_redeem || amount > me.balance}
              className="h-11 shrink-0 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40">기프티콘 교환 신청</button>
          </div>
          <p className="text-[13px] text-sub">{won(me.min_redeem)} 이상, 1,000P 단위로 바꿀 수 있어요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg bg-page p-2.5">
          <p className="text-[13px] text-sub">기프티콘으로 바꾸려면 전화번호 인증이 필요해요. 번호는 저장하지 않고 확인용 값과 뒤 4자리만 남겨요. 인증은 {me.session_hours}시간 동안 유효해요.{me.phone_linked ? ' (시간이 지나 다시 인증이 필요해요)' : ''}</p>
          <div className="flex gap-2">
            <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="휴대전화 번호"
              aria-label="휴대전화 번호" className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-[15px] text-ink" />
            <button type="button" onClick={requestCode} disabled={busy || phone.replace(/\D/g, '').length < 10}
              className="h-11 shrink-0 rounded-lg border border-brand px-3 text-sm font-semibold text-brand disabled:opacity-40">인증번호 받기</button>
          </div>
          {sentCode && (
            <>
              <p className="rounded bg-amber-50 px-2 py-1.5 text-[13px]">테스트 인증 중이라 인증번호를 화면에 보여 드려요: <strong>{sentCode}</strong> (문자 발송 연동 전)</p>
              <div className="flex gap-2">
                <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="인증번호 6자리"
                  aria-label="인증번호" className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-[15px] text-ink" />
                <button type="button" onClick={verify} disabled={busy || code.length !== 6}
                  className="h-11 shrink-0 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40">확인</button>
              </div>
            </>
          )}
        </div>
      )}

      {me.redeems.length > 0 && (
        <p className="text-[13px] text-sub">교환 신청 {me.redeems.slice(0, 3).map((x) => `${dateText(x.at)} ${won(x.amount)} ${x.status === 'done' ? '발송 완료' : '처리 중'}`).join(' / ')}</p>
      )}
      {msg && <p className="text-[13px] text-ink">{msg}</p>}
    </div>
  )
}
