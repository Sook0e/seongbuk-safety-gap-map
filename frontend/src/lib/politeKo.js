// AI(Claude)가 쓴 설명은 "~있다"처럼 끝나기도 하고 "~않습니다"로 끝나기도 한다. 화면에서는 문장 끝을 "~습니다"체로 맞춰 보여 준다.
// 프롬프트를 고치면 분류 결과가 달라질 수 있어서 (poc 평가 기준) 표시할 때만 바꾼다. 저장된 값은 그대로 둔다.
// 규칙: 문장 끝 "…다"만 바꾼다. 이미 "…니다"로 끝난 문장과 "…다고/…다는"처럼 문장 중간의 "다"는 건드리지 않는다.
const BASE = 0xac00
const jong = (ch) => (ch.charCodeAt(0) - BASE) % 28
const withJong = (ch, j) => String.fromCharCode(ch.charCodeAt(0) - jong(ch) + j)
const isHangul = (ch) => ch >= '가' && ch <= '힣'

function endWord(word) {
  // word는 "다"로 끝나는 한 어절 (마침표 제외)
  if (word.length < 2 || !word.endsWith('다')) return word
  const stem = word.slice(0, -1)
  const last = stem[stem.length - 1]
  if (!isHangul(last)) return word
  if (stem.endsWith('니') && stem.length > 1 && isHangul(stem[stem.length - 2]) && jong(stem[stem.length - 2]) === 17) return word // 이미 ~ㅂ니다 (있습니다, 합니다)
  if (last === '는') return stem.slice(0, -1) + '습니다'        // 않는다 → 않습니다, 먹는다 → 먹습니다
  const j = jong(last)
  // 받침이 없거나 ㄴ·ㄹ이면 ㅂ으로 바꾸고 "니다": 하다/한다 → 합니다, 이다 → 입니다, 보인다 → 보입니다, 된다 → 됩니다, 길다 → 깁니다
  if (j === 0 || j === 4 || j === 8) return stem.slice(0, -1) + withJong(last, 17) + '니다'
  return stem + '습니다'                                          // 있다 → 있습니다, 같다 → 같습니다, 있었다 → 있었습니다
}

export function toPolite(text) {
  if (!text) return text
  // 마침표(또는 글 끝) 앞의 "…다"만 바꾼다. 문장 중간의 "바다" 같은 말은 건드리지 않는다
  return String(text).replace(/([가-힣]+다)(?=[.!?](?:\s|$)|$)/g, (w) => (w === '바다' ? w : endWord(w)))
}
