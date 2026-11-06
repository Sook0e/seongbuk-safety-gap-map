// 로그인이 없으므로 '내 제보'는 이 브라우저에 저장한 public_id 목록으로 찾는다.
// 브라우저 저장소는 막혀 있을 수 있어(사생활 보호 모드 등) 모든 읽기·쓰기를 try/catch 한다.
const IDS = 'sbgap.myReportIds'
const SEEN = 'sbgap.myReportsSeenAt' // 내 제보 화면을 마지막으로 본 시각 → 이후 소식이 있으면 빨간 점
const CLIENT = 'sbgap.clientKey' // 이 브라우저를 구분하는 무작위 값 (로그인이 없어 '한 브라우저당 한 표'를 서버에 알리는 데 씀)
const VOTES = 'sbgap.feedbackVotes' // 조치 완료 제보에 내가 누른 '고쳐졌어요 / 아직 그대로예요'
let memoryKey = null // 브라우저 저장소가 막혀 있어도 이번 방문 동안은 같은 값을 쓴다
const CONFIRMED = 'sbgap.confirmedIds' // 이 브라우저에서 '나도 봤어요'를 누른 제보 (중복 방지, 로그인이 없어 브라우저 기준)

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 저장 불가: 이번 방문 동안만 유지 */ }
  window.dispatchEvent(new Event('sbgap-my-reports'))
}

export const myReports = {
  clientKey: () => {
    let k = read(CLIENT, null)
    if (!k) {
      k = memoryKey ?? (globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
      memoryKey = k
      write(CLIENT, k)
    }
    return k
  },
  vote: (publicId) => read(VOTES, {})[publicId] ?? null,
  setVote: (publicId, kind) => write(VOTES, { ...read(VOTES, {}), [publicId]: kind }),
  ids: () => read(IDS, []),
  add: (publicId) => write(IDS, [publicId, ...read(IDS, []).filter((x) => x !== publicId)].slice(0, 50)),
  seenAt: () => read(SEEN, null),
  markSeen: () => write(SEEN, new Date().toISOString()),
  confirmed: (publicId) => read(CONFIRMED, []).includes(publicId),
  markConfirmed: (publicId) => write(CONFIRMED, [...read(CONFIRMED, []), publicId].slice(-200)),
  hasNews: (reports) => {
    const seen = read(SEEN, null)
    return reports.some((r) => !seen || new Date(r.news_at) > new Date(seen))
  },
}
